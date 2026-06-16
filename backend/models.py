import os
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ARRAY
from sqlalchemy.sql import func
from pydantic import BaseModel
from typing import Optional, List
from backend.database import Base, SCHEMA

_SCHEMA = os.getenv("POSTGRES_SCHEMA", "k9repo")


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
    kind            = Column(String(50))   # Agent | Orchestrator | Squad | Router | Adapter
    description     = Column(Text)
    domain          = Column(String(100))
    tags            = Column(ARRAY(String), default=[])
    abb_name        = Column(String(255))
    version         = Column(String(20), default="1.0.0")
    status          = Column(String(20), default="draft")   # draft | published | promoted
    inspect_passed  = Column(Boolean, default=False)
    published_by    = Column(String(100))
    published_at    = Column(DateTime)
    project         = Column(String(100))
    created_at      = Column(DateTime, server_default=func.now())


# ── Pydantic schemas ──────────────────────────────────────────────────────────

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
    abb_name: Optional[str] = None
    version: str = "1.0.0"
    inspect_passed: bool = False
    published_by: Optional[str] = None
    project: Optional[str] = None


class SBBOut(BaseModel):
    id: int
    name: str
    kind: str
    description: Optional[str]
    domain: Optional[str]
    tags: Optional[List[str]]
    abb_name: Optional[str]
    version: str
    status: str
    inspect_passed: bool
    published_by: Optional[str]
    published_at: Optional[datetime]
    project: Optional[str]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}
