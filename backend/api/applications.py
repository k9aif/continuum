from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.database import get_db
from backend.models import Application, ApplicationCreate, ApplicationOut, AuditLog

router = APIRouter(prefix="/api/v1/applications", tags=["Applications"])


def _log(db, entity_id, action, actor=None, note=None):
    db.add(AuditLog(entity="app", entity_id=entity_id, action=action, actor=actor, note=note))


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
def register_app(payload: ApplicationCreate, db: Session = Depends(get_db)):
    app = Application(**payload.model_dump())
    db.add(app)
    db.flush()
    _log(db, app.id, "registered", actor=payload.contact)
    db.commit()
    db.refresh(app)
    return app


@router.patch("/{app_id}", response_model=ApplicationOut)
def update_app(app_id: int, payload: ApplicationCreate, db: Session = Depends(get_db)):
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
def delete_app(app_id: int, db: Session = Depends(get_db)):
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    _log(db, app.id, "deleted", note=app.name)
    db.delete(app)
    db.commit()
