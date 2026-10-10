"""K9X HIL routing for the Continuum's two human decisions.

1. SBB review: a submitted SBB (status pending_review) is published as a review task to the
   K9X HIL architecture queue; the reviewer's decision comes back on the reply topic and
   approves (published) or rejects it.
2. ABB harvesting: an approved SBB nominated for generalization into an ABB is published as an
   Architecture Board task to the same queue; approval creates the ABB, linked to the SBB.

Tasks follow the K9X HIL message contract (title, description, source_orchestrator,
source_topic, reply_to, correlation_id, priority, payload, artifacts, pii, ttl_hours,
ttl_action). The correlation id names what the decision applies to: SBB-<id>-review or
NOM-<id>-harvest. Every decision is applied once and written to the audit log with the
decider's identity from HIL.

Settings (.env): CONTINUUM_HIL_ENABLED=true, KAFKA_BOOTSTRAP_SERVERS, CONTINUUM_PUBLIC_URL,
optional CONTINUUM_HIL_TASK_TOPIC, CONTINUUM_HIL_REPLY_TOPIC, CONTINUUM_HIL_GROUP.
With routing off, reviews stay in the Continuum's own review queue (admin approve/reject).
"""

from __future__ import annotations

import json
import logging
import os
import threading
from datetime import datetime, timezone
from typing import Any, Dict, Optional

log = logging.getLogger("continuum.hil")

TASK_TOPIC_DEFAULT = "workflow.hil.k9platform.architecture.sbb-promotion"
REPLY_TOPIC_DEFAULT = "continuum.hil.replies"


def enabled() -> bool:
    return os.getenv("CONTINUUM_HIL_ENABLED", "").strip().lower() in ("1", "true", "yes")


def task_topic() -> str:
    return os.getenv("CONTINUUM_HIL_TASK_TOPIC", TASK_TOPIC_DEFAULT)


def reply_topic() -> str:
    return os.getenv("CONTINUUM_HIL_REPLY_TOPIC", REPLY_TOPIC_DEFAULT)


def _broker() -> str:
    return os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092").split(",")[0].strip()


def _public_url() -> str:
    return os.getenv("CONTINUUM_PUBLIC_URL", "https://continuum.k9x.ai").rstrip("/")


def build_task(kind: str, correlation_id: str, title: str, description: str,
               payload: Dict[str, Any], ttl_hours: int = 168) -> Dict[str, Any]:
    return {
        "title": title,
        "description": description,
        "source_orchestrator": "K9X Continuum",
        "source_topic": task_topic(),
        "reply_to": reply_topic(),
        "correlation_id": correlation_id,
        "priority": "medium",
        "payload": {"kind": kind, **payload},
        "artifacts": [f"{_public_url()}/#sbbs"],
        "pii": False,
        "ttl_hours": ttl_hours,
        "ttl_action": "reject",
    }


def review_task(sbb) -> Dict[str, Any]:
    abbs = ", ".join(sbb.abb_names or []) or "none declared"
    return build_task(
        "sbb-review", f"SBB-{sbb.id}-review",
        f"SBB-{sbb.id} · Review SBB {sbb.name}",
        f"{sbb.name} ({sbb.kind or 'SBB'}, v{sbb.version}) was submitted to the K9X Continuum by "
        f"{sbb.published_by or 'an unnamed submitter'} for project {sbb.project or '—'}. It declares the "
        f"ABB contracts {abbs} and a passing k9aif inspection. Approve to publish it in the catalog; "
        f"reject to return it.",
        {"sbb_id": sbb.id, "name": sbb.name, "kind": sbb.kind, "version": sbb.version,
         "abb_contracts": list(sbb.abb_names or []), "domain": sbb.domain, "project": sbb.project,
         "submitted_by": sbb.published_by, "tech_lead": sbb.tech_lead, "git_ref": sbb.git_ref,
         "inspect_passed": bool(sbb.inspect_passed), "description_text": sbb.description})


def harvest_task(nom, sbb) -> Dict[str, Any]:
    return build_task(
        "abb-harvest", f"NOM-{nom.id}-harvest",
        f"NOM-{nom.id} · Architecture Board: harvest {sbb.name} as ABB {nom.abb_name}",
        f"{nom.nominated_by or 'A member'} nominates the approved SBB {sbb.name} (v{sbb.version}) for "
        f"generalization into a {nom.level} ABB named {nom.abb_name}. Approve to create the ABB in the "
        f"catalog, linked to this SBB; reject to keep it as an SBB.",
        {"nomination_id": nom.id, "sbb_id": sbb.id, "sbb_name": sbb.name, "proposed_abb": nom.abb_name,
         "proposed_level": nom.level, "generalized_contract": nom.description,
         "nominated_by": nom.nominated_by, "sbb_project": sbb.project})


def publish(task: Dict[str, Any]) -> bool:
    """Publish one HIL task. Never raises: the caller keeps its record and reports the result."""
    try:
        from kafka import KafkaProducer
        producer = KafkaProducer(bootstrap_servers=_broker(),
                                 value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"))
        producer.send(task_topic(), task)
        producer.flush(10)
        producer.close()
        log.info("[hil] published %s to %s (reply_to=%s)", task["correlation_id"], task_topic(), reply_topic())
        return True
    except Exception as exc:
        log.warning("[hil] publish of %s failed: %s", task.get("correlation_id"), exc)
        return False


def apply_decision(db, reply: Dict[str, Any]) -> Optional[str]:
    """Apply one K9X HIL decision. Returns what changed, or None when nothing applies (unknown
    correlation id, already decided, or a status update that is not a decision)."""
    from backend.models import ABB, AbbNomination, AuditLog, SBB
    cid = str(reply.get("correlation_id") or "")
    action = str(reply.get("action") or "").lower()
    actor = reply.get("actor") or "K9X HIL"
    comment = reply.get("comment")
    if action not in ("complete", "approve", "reject", "expire"):
        return None
    approved = action in ("complete", "approve")
    note = "decided in K9X HIL" + (f": {comment}" if comment else "")
    parts = cid.split("-")
    if len(parts) == 3 and parts[0] == "SBB" and parts[2] == "review":
        sbb = db.query(SBB).filter(SBB.id == int(parts[1])).first()
        if not sbb or sbb.status != "pending_review":
            return None
        sbb.status = "published" if approved else "rejected"
        db.add(AuditLog(entity="sbb", entity_id=sbb.id, action="approved" if approved else "rejected",
                        actor=actor, project=sbb.project, note=note))
        db.commit()
        return f"SBB {sbb.id} {sbb.status}"
    if len(parts) == 3 and parts[0] == "NOM" and parts[2] == "harvest":
        nom = db.query(AbbNomination).filter(AbbNomination.id == int(parts[1])).first()
        if not nom or nom.status != "pending":
            return None
        nom.status = "approved" if approved else "rejected"
        nom.decided_by = actor
        nom.decided_at = datetime.now(timezone.utc)
        sbb = db.query(SBB).filter(SBB.id == nom.sbb_id).first()
        if approved:
            abb = db.query(ABB).filter(ABB.name == nom.abb_name).first()
            if abb is None:
                abb = ABB(name=nom.abb_name, kind="ABB", description=nom.description, level=nom.level,
                          module=None, harvested_from=nom.sbb_id)
                db.add(abb)
                db.flush()
            nom.abb_id = abb.id
            db.add(AuditLog(entity="abb", entity_id=abb.id, action="harvested", actor=actor,
                            project=sbb.project if sbb else None,
                            note=f"from SBB {sbb.name if sbb else nom.sbb_id}; {note}"))
        db.add(AuditLog(entity="sbb", entity_id=nom.sbb_id,
                        action="harvest_approved" if approved else "harvest_rejected", actor=actor,
                        project=sbb.project if sbb else None, note=f"ABB {nom.abb_name}; {note}"))
        db.commit()
        return f"nomination {nom.id} {nom.status}"
    return None


def _consume_forever() -> None:
    from kafka import KafkaConsumer
    from backend.database import SessionLocal
    group = os.getenv("CONTINUUM_HIL_GROUP", "continuum-hil-replies")
    while True:
        try:
            consumer = KafkaConsumer(reply_topic(), bootstrap_servers=_broker(), group_id=group,
                                     auto_offset_reset="earliest", enable_auto_commit=True,
                                     value_deserializer=lambda b: json.loads(b.decode("utf-8")))
            log.info("[hil] listening for decisions on %s (group %s)", reply_topic(), group)
            for msg in consumer:
                db = SessionLocal()
                try:
                    changed = apply_decision(db, msg.value or {})
                    if changed:
                        log.info("[hil] %s (%s by %s)", changed, (msg.value or {}).get("action"),
                                 (msg.value or {}).get("actor"))
                except Exception as exc:
                    db.rollback()
                    log.warning("[hil] decision not applied: %s", exc)
                finally:
                    db.close()
        except Exception as exc:
            log.warning("[hil] reply consumer stopped (%s); retrying in 15 s", exc)
            import time
            time.sleep(15)


def start_reply_consumer() -> None:
    if enabled():
        threading.Thread(target=_consume_forever, name="continuum-hil-replies", daemon=True).start()
