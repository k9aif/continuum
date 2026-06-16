import hashlib
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from backend.database import get_db
from backend.models import User, UserOut

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    department: Optional[str] = None
    team: Optional[str] = None


def _hash(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


@router.post("/login", response_model=UserOut)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or user.password_hash != _hash(payload.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account pending admin approval")
    return user


@router.post("/register", response_model=UserOut, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=_hash(payload.password),
        department=payload.department,
        team=payload.team,
        role="developer",
        is_active=False,   # pending admin approval
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
