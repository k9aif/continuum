from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from backend.database import get_db, SCHEMA
from backend.models import AuditLog, AuditLogOut, SBB, Application, User

router = APIRouter(prefix="/api/v1/audit", tags=["Audit"])


@router.get("", response_model=List[AuditLogOut])
def list_audit(
    entity: Optional[str] = None,
    entity_id: Optional[int] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    q = db.query(AuditLog)
    if entity:
        q = q.filter(AuditLog.entity == entity)
    if entity_id is not None:
        q = q.filter(AuditLog.entity_id == entity_id)
    return q.order_by(AuditLog.created_at.desc()).limit(limit).all()


@router.get("/summary")
def audit_summary(days: int = 30, db: Session = Depends(get_db)):
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)

    # Activity by day (last N days)
    daily = db.execute(text(f"""
        SELECT DATE(created_at) as day, action, COUNT(*) as cnt
        FROM {SCHEMA}.audit_log
        WHERE created_at >= :cutoff
        GROUP BY DATE(created_at), action
        ORDER BY day ASC
    """), {"cutoff": cutoff}).fetchall()

    # Action totals
    action_totals = db.execute(text(f"""
        SELECT action, COUNT(*) as cnt
        FROM {SCHEMA}.audit_log
        WHERE created_at >= :cutoff
        GROUP BY action ORDER BY cnt DESC
    """), {"cutoff": cutoff}).fetchall()

    # Top contributors
    top_contributors = db.execute(text(f"""
        SELECT actor, COUNT(*) as cnt
        FROM {SCHEMA}.audit_log
        WHERE created_at >= :cutoff AND actor IS NOT NULL
        GROUP BY actor ORDER BY cnt DESC LIMIT 5
    """), {"cutoff": cutoff}).fetchall()

    # SBB status breakdown
    sbb_statuses = db.execute(text(f"""
        SELECT status, COUNT(*) as cnt FROM {SCHEMA}.sbbs GROUP BY status
    """)).fetchall()

    # App status breakdown
    app_statuses = db.execute(text(f"""
        SELECT status, COUNT(*) as cnt FROM {SCHEMA}.applications GROUP BY status
    """)).fetchall()

    # Recent activity feed
    recent = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(20).all()

    return {
        "daily_activity": [{"day": str(r.day), "action": r.action, "count": r.cnt} for r in daily],
        "action_totals":  [{"action": r.action, "count": r.cnt} for r in action_totals],
        "top_contributors": [{"actor": r.actor, "count": r.cnt} for r in top_contributors],
        "sbb_statuses":   [{"status": r.status, "count": r.cnt} for r in sbb_statuses],
        "app_statuses":   [{"status": r.status, "count": r.cnt} for r in app_statuses],
        "recent_activity": [
            {"entity": r.entity, "entity_id": r.entity_id, "action": r.action,
             "actor": r.actor, "note": r.note, "created_at": r.created_at.isoformat() if r.created_at else None}
            for r in recent
        ],
    }
