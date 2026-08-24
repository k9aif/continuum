# k9x Continuum

The governed, queryable catalog where validated Solution Building Blocks
(SBBs) and Architecture Building Blocks (ABBs) are published, discovered,
reused, and promoted — an implementation of TOGAF's Enterprise Continuum as
live, API-first infrastructure rather than static documentation.

k9x Continuum is part of the [K9-AIF ecosystem](https://github.com/k9aif/k9x-ecosystem),
built on the [K9-AIF framework](https://github.com/k9aif/k9-aif-framework).

## What it does

- **Catalogs** ABBs (framework-level contracts) and SBBs (concrete
  implementations) across the Foundation → Common Systems → Industry →
  Organization-Specific continuum levels.
- **Gates publishing** on `k9aif inspect` passing — an SBB that doesn't
  conform to its declared ABB contract cannot enter the catalog.
- **Governs promotion** through a review workflow: submit → pending review →
  published → promoted, with every transition logged to an audit trail.
- **Tracks applications** built on K9-AIF, independent of the SBB/ABB catalog
  they draw from.

## Current status

Catalog registration/search, the `k9aif inspect` publish gate, the
promotion/review workflow, role-based access, and the audit trail are
implemented and running (see [`backend/`](backend)). Full-text search is
PostgreSQL-backed; there is no Elasticsearch or Neo4j lineage graph in the
current build, despite earlier planning notes in this repository describing
them — those remain aspirational, not implemented.

## Architecture

FastAPI backend, PostgreSQL storage via SQLAlchemy, a static-file web UI
served by the same process.

```
backend/
├── main.py          FastAPI app, router registration, schema migration
├── database.py       SQLAlchemy engine/session, schema init
├── models.py         ORM models + Pydantic schemas
├── seed.py           Demo data seeding
└── api/
    ├── auth.py        Login, registration, profile, password change
    ├── abbs.py         ABB catalog read endpoints
    ├── sbbs.py         SBB catalog + publish/approve/reject/promote/delete
    ├── applications.py Application registry + review workflow
    ├── audit.py         Audit log + summary (admin only)
    └── users.py          User and project administration (admin only)
webui/                 Static HTML/CSS/JS frontend
```

## Authentication

Every API endpoint except `/api/v1/auth/login` and `/api/v1/auth/register`
requires a bearer token issued at login (`Authorization: Bearer <token>`,
12-hour expiry). Destructive and administrative actions — user management,
audit log access, SBB/application approve/reject/promote/delete — additionally
require the `admin` role. New self-registrations are created inactive and
must be approved by an admin before they can sign in.

## Running locally

```bash
git clone https://github.com/k9aif/continuum.git
cd continuum
cp .env.sample .env
# Edit .env: point POSTGRES_HOST/PORT/DB/USER/PASSWORD at a running
# PostgreSQL instance, and set JWT_SECRET_KEY to a random value:
#   python3 -c "import secrets; print(secrets.token_urlsafe(48))"
./run.sh
```

`run.sh` creates a local virtualenv, installs `requirements.txt`, and starts
the app on `$REPO_PORT` (default `8085`). On first startup the schema is
created and demo ABBs/examples are seeded automatically.

A `Dockerfile` is included for containerized deployment.

## API

All routes are under `/api/v1/`. Representative endpoints:

```
POST /api/v1/auth/login              — obtain a bearer token
POST /api/v1/auth/register           — self-register (pending admin approval)

GET  /api/v1/abbs                    — list ABBs
GET  /api/v1/sbbs                    — search/list SBBs
POST /api/v1/sbbs                    — publish an SBB (requires inspect_passed)
PATCH /api/v1/sbbs/{id}/approve      — approve a pending SBB (admin)
PATCH /api/v1/sbbs/{id}/promote      — promote a published SBB (admin)

GET  /api/v1/applications            — list registered applications
POST /api/v1/applications            — register an application

GET  /api/v1/audit                   — audit log (admin)
GET  /api/v1/users                   — user administration (admin)
```

The full route table is defined in [`backend/api/`](backend/api).

## License

Apache License 2.0 — see [LICENSE](LICENSE).
