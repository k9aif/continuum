from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.database import get_db
from backend.models import Application, ApplicationCreate, ApplicationOut, AuditLog, User
from backend.auth_deps import get_current_user, require_admin

router = APIRouter(prefix="/api/v1/applications", tags=["Applications"])


def _log(db, entity_id, action, actor=None, note=None):
    db.add(AuditLog(entity="app", entity_id=entity_id, action=action, actor=actor, note=note))


# ── Review queue (before /{app_id}) ──────────────────────────────────────────

@router.get("/review-queue", response_model=List[ApplicationOut])
def app_review_queue(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return (db.query(Application)
              .filter(Application.status == "pending_review")
              .order_by(Application.created_at.asc())
              .all())


@router.patch("/{app_id}/approve", response_model=ApplicationOut)
def approve_app(app_id: int, actor: Optional[str] = None, db: Session = Depends(get_db),
                 _: User = Depends(require_admin)):
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(404, "Application not found")
    if app.status != "pending_review":
        raise HTTPException(422, "Only pending_review applications can be approved")
    app.status = "poc"
    _log(db, app.id, "approved", actor=actor)
    db.commit()
    db.refresh(app)
    return app


@router.patch("/{app_id}/reject", response_model=ApplicationOut)
def reject_app(app_id: int, actor: Optional[str] = None, reason: Optional[str] = None,
               db: Session = Depends(get_db), _: User = Depends(require_admin)):
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(404, "Application not found")
    if app.status != "pending_review":
        raise HTTPException(422, "Only pending_review applications can be rejected")
    app.status = "rejected"
    _log(db, app.id, "rejected", actor=actor, note=reason)
    db.commit()
    db.refresh(app)
    return app


# ── Standard CRUD ─────────────────────────────────────────────────────────────

@router.get("", response_model=List[ApplicationOut])
def list_apps(
    search: Optional[str] = None,
    domain: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Application)
    if search:
        q = q.filter(
            Application.name.ilike(f"%{search}%") |
            Application.description.ilike(f"%{search}%")
        )
    if domain:
        q = q.filter(Application.domain == domain)
    if status:
        q = q.filter(Application.status == status)
    return q.order_by(Application.created_at.desc()).all()


@router.get("/{app_id}", response_model=ApplicationOut)
def get_app(app_id: int, db: Session = Depends(get_db)):
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


@router.post("", response_model=ApplicationOut, status_code=201)
def register_app(payload: ApplicationCreate, db: Session = Depends(get_db),
                  _: User = Depends(get_current_user)):
    data = payload.model_dump()
    data["status"] = "pending_review"
    app = Application(**data)
    db.add(app)
    db.flush()
    _log(db, app.id, "submitted", actor=payload.contact)
    db.commit()
    db.refresh(app)
    return app


@router.patch("/{app_id}", response_model=ApplicationOut)
def update_app(app_id: int, payload: ApplicationCreate, db: Session = Depends(get_db),
                _: User = Depends(get_current_user)):
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(app, k, v)
    _log(db, app.id, "updated", actor=payload.contact)
    db.commit()
    db.refresh(app)
    return app


@router.delete("/{app_id}", status_code=204)
def delete_app(app_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    _log(db, app.id, "deleted", note=app.name)
    db.delete(app)
    db.commit()
