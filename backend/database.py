import os
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from dotenv import load_dotenv

load_dotenv()

_HOST   = os.getenv("POSTGRES_HOST", "localhost")
_PORT   = os.getenv("POSTGRES_PORT", "5432")
_DB     = os.getenv("POSTGRES_DB", "k9x")
_USER   = os.getenv("POSTGRES_USER", "postgres")
_PASS   = os.getenv("POSTGRES_PASSWORD", "")
SCHEMA  = os.getenv("POSTGRES_SCHEMA", "k9repo")

# Name the driver explicitly. A bare "postgresql://" URL means psycopg2 on
# SQLAlchemy 2.0 but psycopg (v3) on 2.1+ -- and `sqlalchemy>=2.0` resolves
# 2.1 on a fresh build, while this app installs psycopg2-binary: the import
# fails with ModuleNotFoundError: psycopg and the container crash-loops
# (hit live by k9x-hil 2026-09-25; same bug as k9-aif G-20).
# POSTGRES_DRIVER=psycopg switches to v3 for anyone who installs it instead.
_DRIVER = os.getenv("POSTGRES_DRIVER", "psycopg2")

# URL.create escapes the password, so characters like @ / : # can't break it.
DATABASE_URL = URL.create(
    drivername=f"postgresql+{_DRIVER}",
    username=_USER,
    password=_PASS or None,
    host=_HOST,
    port=int(_PORT),
    database=_DB,
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_schema():
    with engine.connect() as conn:
        conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}"))
        conn.execute(text(f"SET search_path TO {SCHEMA}"))
        conn.commit()
