#!/usr/bin/env python3
"""k9x_continuum — database connectivity smoke test.

Reads connection details from .env (same file the app itself loads via
load_dotenv() in backend/main.py) — not config.yaml, since this project
has no config.yaml. Run directly, no test framework needed:

    python3 tests/db_test.py

Exits 0 if Postgres is reachable and the k9repo schema/tables exist,
non-zero otherwise.
"""
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

import psycopg2  # noqa: E402


def main() -> int:
    host = os.environ.get("POSTGRES_HOST", "localhost")
    port = os.environ.get("POSTGRES_PORT", "5432")
    db = os.environ.get("POSTGRES_DB", "k9x")
    user = os.environ.get("POSTGRES_USER", "postgres")
    password = os.environ.get("POSTGRES_PASSWORD", "")
    schema = os.environ.get("POSTGRES_SCHEMA", "k9repo")

    print(f"Connecting to postgres://{user}@{host}:{port}/{db} (schema={schema}) ...")
    try:
        conn = psycopg2.connect(host=host, port=port, user=user, password=password, dbname=db)
    except Exception as e:  # noqa: BLE001
        print(f"FAIL: could not connect — {e}", file=sys.stderr)
        return 1

    ok = True
    try:
        cur = conn.cursor()

        cur.execute("SELECT version()")
        print(f"  PASS: connected — {cur.fetchone()[0]}")

        cur.execute(
            "SELECT schema_name FROM information_schema.schemata WHERE schema_name = %s",
            (schema,),
        )
        if cur.fetchone():
            print(f"  PASS: schema '{schema}' exists")
        else:
            print(f"  FAIL: schema '{schema}' does not exist", file=sys.stderr)
            ok = False

        for table in ("abbs", "sbbs", "applications", "audit_log"):
            cur.execute(
                "SELECT count(*) FROM information_schema.tables "
                "WHERE table_schema = %s AND table_name = %s",
                (schema, table),
            )
            if cur.fetchone()[0]:
                cur.execute(f"SELECT count(*) FROM {schema}.{table}")
                print(f"  PASS: {schema}.{table} exists ({cur.fetchone()[0]} rows)")
            else:
                print(f"  FAIL: {schema}.{table} does not exist", file=sys.stderr)
                ok = False
    finally:
        conn.close()

    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
