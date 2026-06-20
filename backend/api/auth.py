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


class ChangePasswordRequest(BaseModel):
    email: str
    current_password: str
    new_password: str


@router.post("/change-password")
def change_password(payload: ChangePasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or user.password_hash != _hash(payload.current_password):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    user.password_hash = _hash(payload.new_password)
    db.commit()
    return {"ok": True}


class UpdateProfileRequest(BaseModel):
    email: str
    name: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    team: Optional[str] = None
    manager: Optional[str] = None
    project: Optional[str] = None


@router.post("/update-profile", response_model=UserOut)
def update_profile(payload: UpdateProfileRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.name is not None: user.name = payload.name
    if payload.phone is not None: user.phone = payload.phone
    if payload.department is not None: user.department = payload.department
    if payload.team is not None: user.team = payload.team
    if payload.manager is not None: user.manager = payload.manager
    if payload.project is not None: user.project = payload.project
    db.commit()
    db.refresh(user)
    return user
