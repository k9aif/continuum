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
from backend.seed import seed_abbs

_ROOT    = Path(__file__).resolve().parent.parent
_WEBUI   = _ROOT / "webui"
_STATIC  = _WEBUI / "static"
_INDEX   = _WEBUI / "index.html"

app = FastAPI(title="k9x Repository", version="1.0.0")

app.include_router(abbs_router)
app.include_router(sbbs_router)

if _STATIC.exists():
    app.mount("/static", StaticFiles(directory=str(_STATIC)), name="static")


@app.on_event("startup")
def startup():
    init_schema()
    Base.metadata.create_all(bind=engine, checkfirst=True)
    seed_abbs()


@app.get("/health")
def health():
    return {"status": "ok", "schema": SCHEMA}


@app.get("/{full_path:path}")
def serve_ui(full_path: str):
    if _INDEX.exists():
        return FileResponse(str(_INDEX))
    return {"error": "webui not found"}
