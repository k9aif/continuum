"""Server-side verification of a submitted SBB's inspection result (Continuum 1.2.0).

The architect declares that `k9aif inspect` passed; the Continuum checks it. It fetches the
submitted commit and runs the same rule set (the K9-AIF framework's k9_inspect, static: Python
AST and YAML, nothing is executed) and returns one of four outcomes:

  compliant      no findings above recommendation          -> review as usual
  warnings       warnings / recommendations only           -> review; approval needs a justification
  non_compliant  any critical finding or violation         -> the submission is refused, with the report
  unverifiable   source not reachable (private, other host,
                 no git_ref) or rules not installed        -> review as "declared, not verified";
                                                              approval needs a justification

Before 1.2.0 the declaration was recorded and never re-run.

Only https URLs on allowed hosts are fetched (CONTINUUM_VERIFY_HOSTS, default github.com,
gitlab.com, bitbucket.org), every address the host resolves to must be public, git never
prompts for credentials, and the fetch is shallow and time-limited (CONTINUUM_VERIFY_TIMEOUT,
default 120 s). CONTINUUM_VERIFY=false turns verification off (every submission unverifiable).
"""

from __future__ import annotations

import ipaddress
import logging
import os
import shutil
import socket
import subprocess
import tempfile
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlparse

log = logging.getLogger("continuum.verification")

COMPLIANT, WARNINGS, NON_COMPLIANT, UNVERIFIABLE = "compliant", "warnings", "non_compliant", "unverifiable"
NEEDS_JUSTIFICATION = (WARNINGS, UNVERIFIABLE)
_DEFAULT_HOSTS = "github.com,gitlab.com,bitbucket.org"
_MAX_FINDINGS = 15


class SourceRefused(Exception):
    """The source reference may not be fetched (scheme, host or address not allowed)."""


def enabled() -> bool:
    return os.getenv("CONTINUUM_VERIFY", "true").strip().lower() not in ("0", "false", "no")


def needs_justification(status: Optional[str]) -> bool:
    return (status or UNVERIFIABLE) in NEEDS_JUSTIFICATION


def _allowed_hosts() -> set:
    return {h.strip().lower() for h in os.getenv("CONTINUUM_VERIFY_HOSTS", _DEFAULT_HOSTS).split(",") if h.strip()}


def parse_source(git_ref: str) -> Tuple[str, Optional[str], str]:
    """(clone URL, ref or None, sub-path) from a repository or tree URL.

    https://github.com/org/repo                      -> repo, None, ""
    https://github.com/org/repo/tree/main/apps/claims -> repo, "main", "apps/claims"
    """
    url = urlparse((git_ref or "").strip())
    if url.scheme != "https":
        raise SourceRefused("only https repository URLs are fetched")
    host = (url.hostname or "").lower()
    if host not in _allowed_hosts():
        raise SourceRefused(f"host {host or '?'} is not in CONTINUUM_VERIFY_HOSTS")
    for info in socket.getaddrinfo(host, 443, proto=socket.IPPROTO_TCP):
        addr = ipaddress.ip_address(info[4][0])
        if not addr.is_global:
            raise SourceRefused(f"host {host} resolves to a non-public address")
    parts = [p for p in url.path.split("/") if p]
    if len(parts) < 2:
        raise SourceRefused("repository URL must name an owner and a repository")
    repo = f"https://{host}/{parts[0]}/{parts[1].removesuffix('.git')}.git"
    if len(parts) >= 4 and parts[2] in ("tree", "src", "blob"):
        return repo, parts[3], "/".join(parts[4:])
    return repo, None, ""


def _git(args, cwd, timeout):
    env = {**os.environ, "GIT_TERMINAL_PROMPT": "0", "GIT_ASKPASS": "true"}
    return subprocess.run(["git", "-c", "protocol.file.allow=never", "-c", "http.followRedirects=false", *args],
                          cwd=cwd, env=env, timeout=timeout, capture_output=True, text=True, check=True)


def fetch(git_ref: str, commit: Optional[str]) -> Tuple[str, str, str]:
    """Shallow-fetch the submission into a temporary folder: (folder, inspected path, commit sha)."""
    repo, ref, sub = parse_source(git_ref)
    timeout = float(os.getenv("CONTINUUM_VERIFY_TIMEOUT", "120"))
    tmp = tempfile.mkdtemp(prefix="continuum-verify-")
    try:
        _git(["init", "-q"], tmp, timeout)
        _git(["fetch", "-q", "--depth", "1", repo, commit or ref or "HEAD"], tmp, timeout)
        _git(["checkout", "-q", "FETCH_HEAD"], tmp, timeout)
        sha = _git(["rev-parse", "HEAD"], tmp, timeout).stdout.strip()
    except Exception:
        shutil.rmtree(tmp, ignore_errors=True)
        raise
    path = os.path.normpath(os.path.join(tmp, sub)) if sub else tmp
    if not path.startswith(tmp) or not os.path.isdir(path):
        shutil.rmtree(tmp, ignore_errors=True)
        raise SourceRefused(f"path {sub!r} not found in the repository")
    return tmp, path, sha


def inspect_folder(path: str, source: str) -> Dict[str, Any]:
    from k9_aif_abb.k9_inspect.inspector import K9Inspector
    return K9Inspector().inspect(path, source=source).to_dict()


def outcome(report: Dict[str, Any]) -> str:
    c = report.get("counts") or {}
    if c.get("critical") or c.get("violation"):
        return NON_COMPLIANT
    return WARNINGS if (c.get("warning") or c.get("recommendation")) else COMPLIANT


def verify(git_ref: Optional[str], commit: Optional[str] = None) -> Dict[str, Any]:
    """Re-run the inspection on the submitted source. Never raises: an unreachable source is
    reported as unverifiable with the reason."""
    def unverifiable(reason):
        log.info("[verify] %s: unverifiable (%s)", git_ref, reason)
        return {"status": UNVERIFIABLE, "reason": reason, "commit": commit, "counts": None, "findings": []}

    if not enabled():
        return unverifiable("server-side verification is turned off")
    if not git_ref:
        return unverifiable("no source reference (git_ref) was submitted")
    try:
        tmp, path, sha = fetch(git_ref, commit)
    except SourceRefused as exc:
        return unverifiable(str(exc))
    except subprocess.TimeoutExpired:
        return unverifiable("the repository could not be fetched in time")
    except subprocess.CalledProcessError:
        return unverifiable("the repository or commit could not be fetched (private, moved or wrong ref)")
    except OSError as exc:
        return unverifiable(f"the repository could not be fetched ({exc.__class__.__name__})")
    try:
        report = inspect_folder(path, git_ref)
    except ImportError:
        log.error("[verify] k9_aif_abb is not installed: install k9-aif to verify submissions")
        return unverifiable("the inspection rules (k9-aif) are not installed on this server")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    status = outcome(report)
    log.info("[verify] %s @ %s: %s %s", git_ref, sha[:12], status, report.get("counts"))
    return {"status": status, "reason": report.get("verdict"), "commit": sha, "counts": report.get("counts"),
            "framework_version": report.get("framework_version"), "score": report.get("score"),
            "findings": [{k: f.get(k) for k in ("rule_id", "severity", "message", "file", "line")}
                         for f in report.get("findings", [])[:_MAX_FINDINGS]]}


def summary(v: Optional[Dict[str, Any]]) -> str:
    """One line for the review task and the audit log."""
    if not v:
        return "not verified"
    if v["status"] == UNVERIFIABLE:
        return f"declared, not verified: {v.get('reason')}"
    c = v.get("counts") or {}
    return (f"verified at {str(v.get('commit'))[:12]}: {v.get('reason')} "
            f"({c.get('critical', 0)} critical, {c.get('violation', 0)} violations, "
            f"{c.get('warning', 0)} warnings, {c.get('recommendation', 0)} recommendations)")
