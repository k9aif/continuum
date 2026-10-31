"""Server-side verification of a submitted SBB (backend/verification.py, Continuum 1.2.0).

The source fetch is replaced by a local folder (no network); the inspection itself is the real
K9-AIF k9_inspect rule set, run on a small compliant and a small non-compliant solution.
"""
import socket
import textwrap
import types

import pytest
from fastapi import HTTPException

from backend import hil_bridge, verification
from backend.api import sbbs
from backend.models import AuditLog, SBB, SBBCreate


def _write(root, rel, text):
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(textwrap.dedent(text))


def solution(root, *, bad=False):
    _write(root, "agents/summary_agent.py", """
        from k9_aif_abb.k9_core.agent.base_agent import BaseAgent
        from k9_aif_abb.k9_utils.llm_invoke import llm_invoke
        class SummaryAgent(BaseAgent):
            def execute(self, payload):
                return {"output": llm_invoke(self.config, payload["request"]).output}
    """)
    if bad:   # a model call that bypasses llm_invoke(): critical
        _write(root, "agents/rogue_agent.py", """
            import openai
            from k9_aif_abb.k9_core.agent.base_agent import BaseAgent
            class RogueAgent(BaseAgent):
                def execute(self, payload):
                    return {"output": openai.chat.completions.create(model="x", messages=[])}
        """)
    return root


@pytest.fixture
def fetched(monkeypatch, tmp_path):
    """verification.fetch() returns a local solution instead of cloning."""
    def use(folder):
        monkeypatch.setattr(verification, "fetch", lambda ref, commit: (str(tmp_path / "unused"), str(folder), "c0ffee1234567890"))
        (tmp_path / "unused").mkdir(exist_ok=True)
    return use


# ── source reference safety ─────────────────────────────────────────────────

def _resolve_to(monkeypatch, ip):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *a, **k: [(None, None, None, "", (ip, 443))])


@pytest.mark.parametrize("ref", ["http://github.com/o/r", "file:///etc", "ssh://git@github.com/o/r",
                                 "https://internal.example.com/o/r"])
def test_only_https_on_allowed_hosts_is_fetched(monkeypatch, ref):
    _resolve_to(monkeypatch, "140.82.112.3")
    with pytest.raises(verification.SourceRefused):
        verification.parse_source(ref)


def test_a_host_resolving_to_a_private_address_is_refused(monkeypatch):
    _resolve_to(monkeypatch, "10.0.0.5")
    with pytest.raises(verification.SourceRefused, match="non-public"):
        verification.parse_source("https://github.com/o/r")


def test_tree_urls_name_the_ref_and_the_sub_path(monkeypatch):
    _resolve_to(monkeypatch, "140.82.112.3")
    assert verification.parse_source("https://github.com/k9aif/dow-k9x/tree/v1.3.3/src") == \
        ("https://github.com/k9aif/dow-k9x.git", "v1.3.3", "src")
    assert verification.parse_source("https://github.com/k9aif/dow-k9x") == \
        ("https://github.com/k9aif/dow-k9x.git", None, "")


# ── outcomes ────────────────────────────────────────────────────────────────

def test_a_compliant_solution_is_verified(fetched, tmp_path):
    fetched(solution(tmp_path / "ok"))
    v = verification.verify("https://github.com/o/r")
    assert v["status"] in (verification.COMPLIANT, verification.WARNINGS)
    assert v["commit"] == "c0ffee1234567890" and v["counts"]["critical"] == 0


def test_a_critical_finding_makes_it_non_compliant(fetched, tmp_path):
    fetched(solution(tmp_path / "bad", bad=True))
    v = verification.verify("https://github.com/o/r")
    assert v["status"] == verification.NON_COMPLIANT
    assert any(f["rule_id"] == "K9-LLM-001" for f in v["findings"])


def test_no_reference_or_unreachable_source_is_unverifiable_not_an_error(monkeypatch):
    assert verification.verify(None)["status"] == verification.UNVERIFIABLE
    def refuse(ref, commit):
        raise verification.SourceRefused("host x is not in CONTINUUM_VERIFY_HOSTS")
    monkeypatch.setattr(verification, "fetch", refuse)
    v = verification.verify("https://x/o/r")
    assert v["status"] == verification.UNVERIFIABLE and "CONTINUUM_VERIFY_HOSTS" in v["reason"]


# ── submission ──────────────────────────────────────────────────────────────

class _DB:
    def __init__(self):
        self.added = []
    def add(self, o):
        self.added.append(o)
        if isinstance(o, SBB):
            o.id = 11
    def flush(self): pass
    def commit(self): pass
    def refresh(self, o): pass


def _submit(monkeypatch, v):
    monkeypatch.setattr(sbbs, "_validate_sbb", lambda payload, db: None)
    monkeypatch.setattr(sbbs, "_check_rate_limit", lambda db, who: None)
    monkeypatch.setattr(verification, "verify", lambda ref, commit=None: v)
    monkeypatch.setattr(hil_bridge, "enabled", lambda: False)
    db = _DB()
    payload = SBBCreate(name="ClaimsTriageAgent", kind="Agent", inspect_passed=True,
                        published_by="dev@k9x.ai", git_ref="https://github.com/o/r")
    return sbbs.publish_sbb(payload, db=db, _=None), db


def test_a_declared_pass_contradicted_by_the_server_is_refused(monkeypatch):
    v = {"status": "non_compliant", "reason": "NON-COMPLIANT", "commit": "abc", "counts": {"critical": 1}, "findings": []}
    with pytest.raises(HTTPException) as e:
        _submit(monkeypatch, v)
    assert e.value.status_code == 422 and e.value.detail["verification"]["status"] == "non_compliant"


def test_a_verified_submission_records_the_result_and_the_commit(monkeypatch):
    v = {"status": "warnings", "reason": "COMPLIANT WITH WARNINGS", "commit": "abc123",
         "counts": {"critical": 0, "violation": 0, "warning": 2, "recommendation": 0}, "findings": []}
    s, db = _submit(monkeypatch, v)
    assert s.status == "pending_review" and s.verification_status == "warnings" and s.verified_commit == "abc123"
    log = [a for a in db.added if isinstance(a, AuditLog)][0]
    assert "verified at abc123" in log.note and "2 warnings" in log.note


# ── review: approval with findings needs a justification ────────────────────

class _FakeDB:
    def __init__(self, sbb):
        self.sbb, self.added = sbb, []
    def query(self, model):
        return types.SimpleNamespace(filter=lambda *a, **k: types.SimpleNamespace(first=lambda: self.sbb))
    def add(self, o): self.added.append(o)
    def commit(self): pass


def _sbb(status):
    return SBB(id=7, name="ClaimsTriageAgent", kind="Agent", version="1.0.0", status="pending_review",
               abb_names=["BaseAgent"], project="EOC", published_by="dev@k9x.ai", inspect_passed=True,
               verification_status=status,
               verification_report={"status": status, "reason": "x", "commit": "abc", "counts": {}, "findings": []})


def test_the_review_task_asks_for_a_justification_only_when_needed():
    assert hil_bridge.review_task(_sbb("warnings"))["require_comment"] is True
    assert hil_bridge.review_task(_sbb("unverifiable"))["require_comment"] is True
    t = hil_bridge.review_task(_sbb("compliant"))
    assert t["require_comment"] is False and t["payload"]["verification"]["status"] == "compliant"


def test_hil_approval_without_justification_is_refused_and_stays_in_review():
    s = _sbb("warnings"); db = _FakeDB(s)
    out = hil_bridge.apply_decision(db, {"correlation_id": "SBB-7-review", "action": "complete", "actor": "lead@k9x.ai"})
    assert s.status == "pending_review" and "approval refused" in out
    assert db.added[0].action == "approval_refused"


def test_hil_approval_with_justification_publishes_and_records_it():
    s = _sbb("unverifiable"); db = _FakeDB(s)
    hil_bridge.apply_decision(db, {"correlation_id": "SBB-7-review", "action": "complete", "actor": "lead@k9x.ai",
                                   "comment": "private repo; reviewed the diff with the team"})
    assert s.status == "published"
    assert "justification: private repo" in db.added[0].note


def test_a_compliant_sbb_needs_no_justification():
    s = _sbb("compliant"); db = _FakeDB(s)
    hil_bridge.apply_decision(db, {"correlation_id": "SBB-7-review", "action": "complete", "actor": "lead@k9x.ai"})
    assert s.status == "published"


def test_admin_approval_needs_a_justification_too():
    s = _sbb("warnings")
    with pytest.raises(HTTPException) as e:
        sbbs.approve_sbb(7, actor="admin", justification=None, db=_FakeDB(s), _=None)
    assert e.value.status_code == 422 and s.status == "pending_review"
    sbbs.approve_sbb(7, actor="admin", justification="two warnings, both in test fixtures", db=_DBWith(s), _=None)
    assert s.status == "published"


class _DBWith(_FakeDB):
    def refresh(self, o): pass
