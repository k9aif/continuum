"""K9X HIL routing for SBB review and ABB harvesting (backend/hil_bridge.py), without Kafka or a DB."""
import types

from backend import hil_bridge
from backend.models import ABB, AbbNomination, AuditLog, SBB

CONTRACT = {"title", "description", "source_orchestrator", "source_topic", "reply_to", "correlation_id",
            "priority", "payload", "artifacts", "pii", "ttl_hours", "ttl_action"}


class FakeDB:
    """query(Model).filter(...).first() returns the stored object of that model (one per model)."""

    def __init__(self, **objs):
        self.objs, self.added, self.commits = objs, [], 0

    def query(self, model):
        obj = self.objs.get(model.__name__)
        return types.SimpleNamespace(filter=lambda *a, **k: types.SimpleNamespace(first=lambda: obj))

    def add(self, o):
        self.added.append(o)
        if isinstance(o, ABB):
            o.id = 99
            self.objs["ABB"] = o

    def flush(self):
        pass

    def commit(self):
        self.commits += 1


def sbb(status="pending_review"):
    return SBB(id=7, name="ClaimsTriageAgent", kind="Agent", version="1.0.0", status=status,
               abb_names=["BaseAgent"], project="EOC", published_by="dev@k9x.ai", inspect_passed=True)


def test_review_task_follows_the_hil_contract():
    t = hil_bridge.review_task(sbb())
    assert CONTRACT <= set(t) and t["correlation_id"] == "SBB-7-review"
    assert t["reply_to"] == hil_bridge.reply_topic() and t["payload"]["abb_contracts"] == ["BaseAgent"]


def test_hil_approval_publishes_the_sbb_with_the_decider_in_the_audit_log():
    s = sbb(); db = FakeDB(SBB=s)
    out = hil_bridge.apply_decision(db, {"correlation_id": "SBB-7-review", "action": "complete",
                                         "actor": "architect@k9x.ai", "comment": "fits the catalog"})
    assert s.status == "published" and out == "SBB 7 published"
    log = [a for a in db.added if isinstance(a, AuditLog)][0]
    assert log.actor == "architect@k9x.ai" and "K9X HIL" in log.note and "fits the catalog" in log.note


def test_hil_rejection_rejects_and_a_second_decision_changes_nothing():
    s = sbb(); db = FakeDB(SBB=s)
    hil_bridge.apply_decision(db, {"correlation_id": "SBB-7-review", "action": "reject", "actor": "a"})
    assert s.status == "rejected"
    assert hil_bridge.apply_decision(db, {"correlation_id": "SBB-7-review", "action": "complete"}) is None
    assert s.status == "rejected"


def test_status_updates_and_unknown_ids_are_ignored():
    db = FakeDB(SBB=sbb())
    assert hil_bridge.apply_decision(db, {"correlation_id": "SBB-7-review", "action": "claim"}) is None
    assert hil_bridge.apply_decision(db, {"correlation_id": "JOB-1", "action": "complete"}) is None


def test_harvest_approval_creates_the_abb_linked_to_its_sbb():
    nom = AbbNomination(id=3, sbb_id=7, abb_name="BaseClaimsTriageAgent", level="CommonSystems",
                        description="Triage contract for claims-like intake", status="pending")
    db = FakeDB(AbbNomination=nom, SBB=sbb("published"), ABB=None)
    t = hil_bridge.harvest_task(nom, sbb("published"))
    assert CONTRACT <= set(t) and t["correlation_id"] == "NOM-3-harvest"
    out = hil_bridge.apply_decision(db, {"correlation_id": "NOM-3-harvest", "action": "complete", "actor": "board@k9x.ai"})
    abb = [a for a in db.added if isinstance(a, ABB)][0]
    assert out == "nomination 3 approved" and abb.name == "BaseClaimsTriageAgent" and abb.harvested_from == 7
    assert nom.abb_id == 99 and nom.decided_by == "board@k9x.ai"
    assert {a.action for a in db.added if isinstance(a, AuditLog)} == {"harvested", "harvest_approved"}


def test_routing_is_off_unless_enabled(monkeypatch):
    monkeypatch.delenv("CONTINUUM_HIL_ENABLED", raising=False)
    assert hil_bridge.enabled() is False
    monkeypatch.setenv("CONTINUUM_HIL_ENABLED", "true")
    assert hil_bridge.enabled() is True
