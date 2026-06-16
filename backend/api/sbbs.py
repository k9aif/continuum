from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.database import get_db
from backend.models import SBB, SBBCreate, SBBOut

router = APIRouter(prefix="/api/v1/sbbs", tags=["SBBs"])


@router.get("", response_model=List[SBBOut])
def list_sbbs(
    search: Optional[str] = None,
    kind: Optional[str] = None,
    domain: Optional[str] = None,
    status: Optional[str] = None,
    abb_name: Optional[str] = None,
    db: Session = Depends(get_db),
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
        q = q.filter(SBB.abb_name == abb_name)
    return q.order_by(SBB.created_at.desc()).all()


@router.get("/{sbb_id}", response_model=SBBOut)
def get_sbb(sbb_id: int, db: Session = Depends(get_db)):
    sbb = db.query(SBB).filter(SBB.id == sbb_id).first()
    if not sbb:
        raise HTTPException(status_code=404, detail="SBB not found")
    return sbb


@router.post("", response_model=SBBOut, status_code=201)
def publish_sbb(payload: SBBCreate, db: Session = Depends(get_db)):
    if not payload.inspect_passed:
        raise HTTPException(
            status_code=422,
            detail="k9aif inspect must pass before publishing"
        )
    sbb = SBB(
        **payload.model_dump(),
        status="published",
        published_at=datetime.now(timezone.utc),
    )
    db.add(sbb)
    db.commit()
    db.refresh(sbb)
    return sbb


@router.patch("/{sbb_id}/promote", response_model=SBBOut)
def promote_sbb(sbb_id: int, db: Session = Depends(get_db)):
    sbb = db.query(SBB).filter(SBB.id == sbb_id).first()
    if not sbb:
        raise HTTPException(status_code=404, detail="SBB not found")
    if sbb.status != "published":
        raise HTTPException(status_code=422, detail="Only published SBBs can be promoted")
    sbb.status = "promoted"
    db.commit()
    db.refresh(sbb)
    return sbb


@router.delete("/{sbb_id}", status_code=204)
def delete_sbb(sbb_id: int, db: Session = Depends(get_db)):
    sbb = db.query(SBB).filter(SBB.id == sbb_id).first()
    if not sbb:
        raise HTTPException(status_code=404, detail="SBB not found")
    db.delete(sbb)
    db.commit()
