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
            f"ALTER TABLE {SCHEMA}.applications ADD COLUMN IF NOT EXISTS source_url   VARCHAR(500)",
            f"ALTER TABLE {SCHEMA}.sbbs        ADD COLUMN IF NOT EXISTS git_ref      VARCHAR(500)",
            f"ALTER TABLE {SCHEMA}.sbbs        ADD COLUMN IF NOT EXISTS promoted_by  VARCHAR(255)",
            f"ALTER TABLE {SCHEMA}.sbbs        ADD COLUMN IF NOT EXISTS promoted_at  TIMESTAMP",
            f"ALTER TABLE {SCHEMA}.abbs        ADD COLUMN IF NOT EXISTS harvested_from INTEGER",
            f"ALTER TABLE {SCHEMA}.sbbs        ADD COLUMN IF NOT EXISTS git_commit   VARCHAR(64)",
            f"ALTER TABLE {SCHEMA}.sbbs        ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20)",
            f"ALTER TABLE {SCHEMA}.sbbs        ADD COLUMN IF NOT EXISTS verification_report JSON",
            f"ALTER TABLE {SCHEMA}.sbbs        ADD COLUMN IF NOT EXISTS verified_commit VARCHAR(64)",
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
    # Review routing and harvesting decisions from K9X HIL (CONTINUUM_HIL_ENABLED)
    from backend import hil_bridge
    hil_bridge.start_reply_consumer()


@app.get("/health")
def health():
    from backend import hil_bridge
    return {"status": "ok", "schema": SCHEMA, "hil_routing": hil_bridge.enabled()}


def _versioned_index() -> str:
    """index.html with each /static/<file>?v=... replaced by a hash of that file's content, so a
    changed app.js or app.css gets a new URL and no browser or CDN serves the old copy."""
    import hashlib
    import re
    html = _INDEX.read_text(encoding="utf-8")

    def stamp(m):
        f = _STATIC / m.group(1)
        v = hashlib.sha256(f.read_bytes()).hexdigest()[:12] if f.exists() else "0"
        return f"/static/{m.group(1)}?v={v}"
    return re.sub(r"/static/([\w.-]+)\?v=[\w]+", stamp, html)


@app.get("/{full_path:path}")
def serve_ui(full_path: str):
    from fastapi.responses import HTMLResponse
    if _INDEX.exists():
        return HTMLResponse(_versioned_index(), headers={"Cache-Control": "no-cache"})
    return {"error": "webui not found"}
