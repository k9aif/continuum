import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from dotenv import load_dotenv

load_dotenv()

_HOST   = os.getenv("POSTGRES_HOST", "localhost")
_PORT   = os.getenv("POSTGRES_PORT", "5432")
_DB     = os.getenv("POSTGRES_DB", "k9aif")
_USER   = os.getenv("POSTGRES_USER", "k9aif")
_PASS   = os.getenv("POSTGRES_PASSWORD", "")
SCHEMA  = os.getenv("POSTGRES_SCHEMA", "k9repo")

DATABASE_URL = f"postgresql://{_USER}:{_PASS}@{_HOST}:{_PORT}/{_DB}"

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
