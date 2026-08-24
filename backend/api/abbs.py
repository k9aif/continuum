from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.database import get_db
from backend.models import ABB, ABBOut, User
from backend.auth_deps import get_current_user

router = APIRouter(prefix="/api/v1/abbs", tags=["ABBs"])


@router.get("", response_model=List[ABBOut])
def list_abbs(level: Optional[str] = None, db: Session = Depends(get_db),
              _: User = Depends(get_current_user)):
    q = db.query(ABB)
    if level:
        q = q.filter(ABB.level == level)
    return q.order_by(ABB.level, ABB.name).all()


@router.get("/{abb_id}", response_model=ABBOut)
def get_abb(abb_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(ABB).filter(ABB.id == abb_id).first()
