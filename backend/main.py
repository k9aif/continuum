import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv

load_dotenv()

from backend.database import engine, init_schema, SCHEMA
from backend.models import Base
from backend.api.abbs import router as abbs_router
from backend.api.sbbs import router as sbbs_router
from backend.api.applications import router as apps_router
from backend.api.audit import router as audit_router
from backend.api.users import router as users_router, projects_router
from backend.api.auth import router as auth_router
from backend.seed import seed_abbs, seed_examples

_ROOT   = Path(__file__).resolve().parent.parent
_WEBUI  = _ROOT / "webui"
_STATIC = _WEBUI / "static"
_INDEX  = _WEBUI / "index.html"

app = FastAPI(title="k9x Continuum", version="1.0.0")

app.include_router(abbs_router)
app.include_router(sbbs_router)
app.include_router(apps_router)
app.include_router(audit_router)
app.include_router(users_router)
app.include_router(projects_router)
app.include_router(auth_router)

if _STATIC.exists():
    app.mount("/static", StaticFiles(directory=str(_STATIC)), name="static")


def _migrate():
    """Additive column migrations — safe to run on every startup."""
    with engine.connect() as conn:
        migrations = [
            f"ALTER TABLE {SCHEMA}.applications ADD COLUMN IF NOT EXISTS project_url  VARCHAR(500)",
            f"ALTER TABLE {SCHEMA}.sbbs        ADD COLUMN IF NOT EXISTS git_ref      VARCHAR(500)",
            f"ALTER TABLE {SCHEMA}.sbbs        ADD COLUMN IF NOT EXISTS promoted_by  VARCHAR(255)",
            f"ALTER TABLE {SCHEMA}.sbbs        ADD COLUMN IF NOT EXISTS promoted_at  TIMESTAMP",
        ]
        for sql in migrations:
            conn.execute(__import__("sqlalchemy").text(sql))
        conn.commit()


@app.on_event("startup")
def startup():
    init_schema()
    Base.metadata.create_all(bind=engine, checkfirst=True)
    _migrate()
    seed_abbs()
    seed_examples()


@app.get("/health")
def health():
    return {"status": "ok", "schema": SCHEMA}


@app.get("/{full_path:path}")
def serve_ui(full_path: str):
    if _INDEX.exists():
        return FileResponse(str(_INDEX))
    return {"error": "webui not found"}
