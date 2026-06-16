import os
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ARRAY, ForeignKey, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from backend.database import Base, SCHEMA

_SCHEMA = os.getenv("POSTGRES_SCHEMA", "k9repo")


# ── Many-to-many: users ↔ projects ───────────────────────────────────────────

user_projects = Table(
    "user_projects", Base.metadata,
    Column("user_id",    Integer, ForeignKey(f"{_SCHEMA}.users.id",    ondelete="CASCADE")),
    Column("project_id", Integer, ForeignKey(f"{_SCHEMA}.projects.id", ondelete="CASCADE")),
    schema=_SCHEMA,
)


# ── ORM models ────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": _SCHEMA}

    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String(255), nullable=False)
    email        = Column(String(255), unique=True, nullable=False)
    phone        = Column(String(50))
    role         = Column(String(20), default="developer")   # admin | pm | lead | developer | analyst | guest
    department   = Column(String(255))
    team         = Column(String(255))
    manager      = Column(String(255))
    project      = Column(String(255))
    application  = Column(String(255))
    password_hash= Column(String(255))
    is_active    = Column(Boolean, default=True)
    created_at   = Column(DateTime, server_default=func.now())
    updated_at   = Column(DateTime, server_default=func.now(), onupdate=func.now())

    projects = relationship("Project", secondary=user_projects, back_populates="members")


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = {"schema": _SCHEMA}

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(255), unique=True, nullable=False)
    description = Column(Text)
    domain      = Column(String(100))
    created_at  = Column(DateTime, server_default=func.now())

    members = relationship("User", secondary=user_projects, back_populates="projects")


class ABB(Base):
    __tablename__ = "abbs"
    __table_args__ = {"schema": _SCHEMA}

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(255), unique=True, nullable=False)
    kind        = Column(String(50), default="ABB")
    description = Column(Text)
    level       = Column(String(50))   # Foundation | CommonSystems | Industry | OrgSpecific
    module      = Column(String(255))
    created_at  = Column(DateTime, server_default=func.now())


class SBB(Base):
    __tablename__ = "sbbs"
    __table_args__ = {"schema": _SCHEMA}

    id              = Column(Integer, primary_key=True, index=True)
    name            = Column(String(255), nullable=False)
    kind            = Column(String(50))
    description     = Column(Text)
    domain          = Column(String(100))
    tags            = Column(ARRAY(String), default=[])
    abb_name        = Column(String(255))       # legacy, kept for migration compat
    abb_names       = Column(ARRAY(String), default=[])
    version         = Column(String(20), default="1.0.0")
    status          = Column(String(20), default="draft")
    inspect_passed  = Column(Boolean, default=False)
    yaml_snapshot   = Column(Text)
    git_ref         = Column(String(500))
    published_by    = Column(String(255))
    tech_lead       = Column(String(255))
    published_at    = Column(DateTime)
    promoted_by     = Column(String(255))
    promoted_at     = Column(DateTime)
    project         = Column(String(100))
    created_at      = Column(DateTime, server_default=func.now())
    updated_at      = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = {"schema": _SCHEMA}

    id             = Column(Integer, primary_key=True, index=True)
    name           = Column(String(255), unique=True, nullable=False)
    description    = Column(Text)
    domain         = Column(String(100))
    project        = Column(String(255))
    project_url    = Column(String(500))   # Confluence / wiki / request-access page
    department     = Column(String(255))
    url            = Column(String(500))
    team           = Column(String(255))
    contact        = Column(String(255))
    k9aif_version  = Column(String(20))
    status         = Column(String(20), default="poc")  # poc | active | production | archived
    tags           = Column(ARRAY(String), default=[])
    sbbs_used      = Column(ARRAY(String), default=[])
    created_at     = Column(DateTime, server_default=func.now())
    updated_at     = Column(DateTime, server_default=func.now(), onupdate=func.now())


class AuditLog(Base):
    __tablename__ = "audit_log"
    __table_args__ = {"schema": _SCHEMA}

    id         = Column(Integer, primary_key=True)
    entity     = Column(String(20))
    entity_id  = Column(Integer)
    action     = Column(String(50))
    actor      = Column(String(255))
    project    = Column(String(100))
    note       = Column(Text)
    created_at = Column(DateTime, server_default=func.now())


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    role: str = "developer"
    department: Optional[str] = None
    team: Optional[str] = None
    manager: Optional[str] = None
    project: Optional[str] = None
    application: Optional[str] = None
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    phone: Optional[str]
    role: str
    department: Optional[str]
    team: Optional[str]
    manager: Optional[str]
    project: Optional[str]
    application: Optional[str]
    is_active: bool
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    domain: Optional[str] = None


class ProjectOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    domain: Optional[str]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ABBOut(BaseModel):
    id: int
    name: str
    kind: str
    description: Optional[str]
    level: Optional[str]
    module: Optional[str]

    model_config = {"from_attributes": True}


class SBBCreate(BaseModel):
    name: str
    kind: str
    description: Optional[str] = None
    domain: Optional[str] = None
    tags: Optional[List[str]] = []
    abb_names: Optional[List[str]] = []
    version: str = "1.0.0"
    inspect_passed: bool = False
    published_by: Optional[str] = None
    tech_lead: Optional[str] = None
    project: Optional[str] = None
    git_ref: Optional[str] = None       # source code URL — git, bitbucket, ADO, etc.


class SBBOut(BaseModel):
    id: int
    name: str
    kind: str
    description: Optional[str]
    domain: Optional[str]
    tags: Optional[List[str]]
    abb_names: Optional[List[str]]
    version: str
    status: str
    inspect_passed: bool
    published_by: Optional[str]
    tech_lead: Optional[str]
    git_ref: Optional[str]
    published_at: Optional[datetime]
    promoted_by: Optional[str]
    promoted_at: Optional[datetime]
    project: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True}


class SBBReviewOut(SBBOut):
    submission_note: Optional[str] = None  # manager + inspect info from audit log


class ApplicationCreate(BaseModel):
    name: str
    description: Optional[str] = None
    domain: Optional[str] = None
    project: Optional[str] = None
    project_url: Optional[str] = None
    department: Optional[str] = None
    url: Optional[str] = None
    team: Optional[str] = None
    contact: Optional[str] = None
    k9aif_version: Optional[str] = None
    status: str = "poc"
    tags: Optional[List[str]] = []
    sbbs_used: Optional[List[str]] = []


class ApplicationOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    domain: Optional[str]
    project: Optional[str]
    project_url: Optional[str]
    department: Optional[str]
    url: Optional[str]
    team: Optional[str]
    contact: Optional[str]
    k9aif_version: Optional[str]
    status: str
    tags: Optional[List[str]]
    sbbs_used: Optional[List[str]]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class AuditLogOut(BaseModel):
    id: int
    entity: str
    entity_id: int
    action: str
    actor: Optional[str]
    project: Optional[str]
    note: Optional[str]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}
