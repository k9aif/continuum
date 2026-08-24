import hashlib
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.database import get_db
from backend.models import User, UserCreate, UserOut, Project, ProjectCreate, ProjectOut
from backend.auth_deps import get_current_user, require_admin

router = APIRouter(prefix="/api/v1/users", tags=["Users"])


def _hash(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


@router.get("", response_model=List[UserOut])
def list_users(role: Optional[str] = None, active: Optional[bool] = None, db: Session = Depends(get_db),
               _: User = Depends(require_admin)):
    q = db.query(User)
    if role is not None:
        q = q.filter(User.role == role)
    if active is not None:
        q = q.filter(User.is_active == active)
    return q.order_by(User.name).all()


@router.get("/pending", response_model=List[UserOut])
def pending_registrations(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return db.query(User).filter(User.is_active == False).order_by(User.created_at.asc()).all()


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("", response_model=UserOut, status_code=201)
def register_user(payload: UserCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        role=payload.role,
        department=payload.department,
        team=payload.team,
        manager=payload.manager,
        project=payload.project,
        application=payload.application,
        password_hash=_hash(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: UserCreate, db: Session = Depends(get_db),
                 _: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.name  = payload.name
    user.email = payload.email
    user.phone = payload.phone
    user.role  = payload.role
    if payload.password:
        user.password_hash = _hash(payload.password)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}/activate", response_model=UserOut)
def activate_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = True
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}/deactivate", response_model=UserOut)
def deactivate_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()


# ── Projects ──────────────────────────────────────────────────────────────────

projects_router = APIRouter(prefix="/api/v1/projects", tags=["Projects"])


@projects_router.get("", response_model=List[ProjectOut])
def list_projects(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Project).order_by(Project.name).all()


@projects_router.post("", response_model=ProjectOut, status_code=201)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db),
                    _: User = Depends(require_admin)):
    proj = Project(**payload.model_dump())
    db.add(proj)
    db.commit()
    db.refresh(proj)
    return proj


@projects_router.post("/{project_id}/members/{user_id}", status_code=204)
def add_member(project_id: int, user_id: int, db: Session = Depends(get_db),
                _: User = Depends(require_admin)):
    proj = db.query(Project).filter(Project.id == project_id).first()
    user = db.query(User).filter(User.id == user_id).first()
    if not proj or not user:
        raise HTTPException(status_code=404, detail="Project or User not found")
    if user not in proj.members:
        proj.members.append(user)
        db.commit()


@projects_router.delete("/{project_id}/members/{user_id}", status_code=204)
def remove_member(project_id: int, user_id: int, db: Session = Depends(get_db),
                   _: User = Depends(require_admin)):
    proj = db.query(Project).filter(Project.id == project_id).first()
    user = db.query(User).filter(User.id == user_id).first()
    if not proj or not user:
        raise HTTPException(status_code=404, detail="Project or User not found")
    proj.members.discard(user) if hasattr(proj.members, 'discard') else None
    if user in proj.members:
        proj.members.remove(user)
    db.commit()
