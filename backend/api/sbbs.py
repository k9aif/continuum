import re
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc
from typing import List, Optional
from backend.database import get_db
from backend.models import SBB, SBBCreate, SBBOut, SBBReviewOut, AuditLog, User
from backend.auth_deps import get_current_user, require_admin

router = APIRouter(prefix="/api/v1/sbbs", tags=["SBBs"])

# Terms that indicate spam/test/malicious submissions
BLOCKED_TERMS = [
    "exploit", "malware", "virus", "pwn", "xss", "sqli",
    "lorem ipsum", "asdfgh", "qwerty123", "test123",
]


def _log(db, entity_id, action, actor=None, project=None, note=None):
    db.add(AuditLog(entity="sbb", entity_id=entity_id,
                    action=action, actor=actor, project=project, note=note))


def _validate_sbb(payload: SBBCreate, db: Session) -> Optional[User]:
    name = (payload.name or "").strip()
    if len(name) < 3:
        raise HTTPException(422, "Name must be at least 3 characters")
    if re.search(r'\s', name):
        raise HTTPException(422, "Name must not contain spaces — use PascalCase (e.g. ClaimsTriageAgent)")
    if not re.match(r'^[A-Z][A-Za-z0-9_]+$', name):
        raise HTTPException(422, "Name must start with an uppercase letter (PascalCase required)")
    if not payload.abb_names:
        raise HTTPException(422, "At least one ABB contract is required")
    desc = (payload.description or "").strip()
    if desc and len(desc) < 20:
        raise HTTPException(422, "Description must be at least 20 characters or leave it empty")
    combined = (name + " " + desc).lower()
    for term in BLOCKED_TERMS:
        if term in combined:
            raise HTTPException(422, "Submission blocked: disallowed content detected")
    # Must be a registered user
    if payload.published_by:
        user = db.query(User).filter(User.email == payload.published_by).first()
        if not user:
            raise HTTPException(403, "Submitter email is not a registered user — ask your admin to add you first")
        return user
    return None


def _check_rate_limit(db: Session, actor: Optional[str]):
    if not actor:
        return
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=24)
    count = db.query(sqlfunc.count(AuditLog.id)).filter(
        AuditLog.actor == actor,
        AuditLog.action == "submitted",
        AuditLog.created_at >= cutoff,
    ).scalar() or 0
    if count >= 10:
        raise HTTPException(429, "Rate limit: max 10 SBB submissions per 24 hours")


# ── Review queue (must come before /{sbb_id}) ────────────────────────────────

@router.get("/review-queue", response_model=List[SBBReviewOut])
def review_queue(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    sbbs = (db.query(SBB)
              .filter(SBB.status == "pending_review")
              .order_by(SBB.created_at.asc())
              .all())
    result = []
    for sbb in sbbs:
        audit = db.query(AuditLog).filter(
            AuditLog.entity == "sbb",
            AuditLog.entity_id == sbb.id,
            AuditLog.action == "submitted",
        ).first()
        item_data = SBBOut.model_validate(sbb).model_dump()
        item_data["submission_note"] = audit.note if audit else None
        result.append(SBBReviewOut(**item_data))
    return result


# ── Standard CRUD ─────────────────────────────────────────────────────────────

@router.get("", response_model=List[SBBOut])
def list_sbbs(
    search: Optional[str] = None,
    kind: Optional[str] = None,
    domain: Optional[str] = None,
    status: Optional[str] = None,
    abb_name: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(SBB)
    if search:
        q = q.filter(SBB.name.ilike(f"%{search}%") | SBB.description.ilike(f"%{search}%"))
    if kind:
        q = q.filter(SBB.kind == kind)
    if domain:
        q = q.filter(SBB.domain == domain)
    if status:
        q = q.filter(SBB.status == status)
    if abb_name:
        q = q.filter(SBB.abb_names.any(abb_name))
    return q.order_by(SBB.created_at.desc()).all()


@router.get("/{sbb_id}", response_model=SBBOut)
def get_sbb(sbb_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    sbb = db.query(SBB).filter(SBB.id == sbb_id).first()
    if not sbb:
        raise HTTPException(status_code=404, detail="SBB not found")
    return sbb


@router.post("", response_model=SBBOut, status_code=201)
def publish_sbb(payload: SBBCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    if not payload.inspect_passed:
        raise HTTPException(status_code=422, detail="k9aif inspect must pass before submitting")
    user = _validate_sbb(payload, db)
    _check_rate_limit(db, payload.published_by)
    sbb = SBB(**payload.model_dump(), status="pending_review",
               published_at=datetime.now(timezone.utc))
    db.add(sbb)
    db.flush()
    manager = user.manager if user else None
    note = "inspect_passed=True" + (f" | manager={manager}" if manager else "")
    _log(db, sbb.id, "submitted", actor=payload.published_by, project=payload.project, note=note)
    db.commit()
    db.refresh(sbb)
    return sbb


@router.patch("/{sbb_id}/approve", response_model=SBBOut)
def approve_sbb(sbb_id: int, actor: Optional[str] = None, db: Session = Depends(get_db),
                 _: User = Depends(require_admin)):
    sbb = db.query(SBB).filter(SBB.id == sbb_id).first()
    if not sbb:
        raise HTTPException(404, "SBB not found")
    if sbb.status != "pending_review":
        raise HTTPException(422, "Only pending_review SBBs can be approved")
    sbb.status = "published"
    _log(db, sbb.id, "approved", actor=actor, project=sbb.project)
    db.commit()
    db.refresh(sbb)
    return sbb


@router.patch("/{sbb_id}/reject", response_model=SBBOut)
def reject_sbb(sbb_id: int, actor: Optional[str] = None, reason: Optional[str] = None,
               db: Session = Depends(get_db), _: User = Depends(require_admin)):
    sbb = db.query(SBB).filter(SBB.id == sbb_id).first()
    if not sbb:
        raise HTTPException(404, "SBB not found")
    if sbb.status != "pending_review":
        raise HTTPException(422, "Only pending_review SBBs can be rejected")
    sbb.status = "rejected"
    _log(db, sbb.id, "rejected", actor=actor, project=sbb.project, note=reason)
    db.commit()
    db.refresh(sbb)
    return sbb


@router.patch("/{sbb_id}/promote", response_model=SBBOut)
def promote_sbb(sbb_id: int, actor: Optional[str] = None, db: Session = Depends(get_db),
                 _: User = Depends(require_admin)):
    sbb = db.query(SBB).filter(SBB.id == sbb_id).first()
    if not sbb:
        raise HTTPException(status_code=404, detail="SBB not found")
    if sbb.status != "published":
        raise HTTPException(status_code=422, detail="Only published SBBs can be promoted")
    sbb.status      = "promoted"
    sbb.promoted_by = actor or sbb.published_by
    sbb.promoted_at = datetime.now(timezone.utc)
    _log(db, sbb.id, "promoted", actor=sbb.promoted_by, project=sbb.project)
    db.commit()
    db.refresh(sbb)
    return sbb


@router.delete("/{sbb_id}", status_code=204)
def delete_sbb(sbb_id: int, actor: Optional[str] = None, db: Session = Depends(get_db),
                _: User = Depends(require_admin)):
    sbb = db.query(SBB).filter(SBB.id == sbb_id).first()
    if not sbb:
        raise HTTPException(status_code=404, detail="SBB not found")
    _log(db, sbb.id, "deleted", actor=actor, project=sbb.project, note=sbb.name)
    db.delete(sbb)
    db.commit()
