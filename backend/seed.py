from datetime import datetime, timezone
from backend.database import SessionLocal
from backend.models import ABB, SBB, Application, User
import hashlib

FOUNDATION_ABBS = [
    ("BaseRouter",          "Router",        "Routes events to domain orchestrators by event type",               "k9_core.router"),
    ("BaseOrchestrator",    "Orchestrator",  "Owns a domain and controls squad execution flow",                   "k9_core.orchestration"),
    ("BaseSquad",           "Squad",         "Groups agents that progressively enrich a shared context",          "k9_squad"),
    ("BaseAgent",           "Agent",         "Atomic execution unit — execute(payload) returns dict",             "k9_core.agent"),
    ("BaseAdapter",         "Adapter",       "Protocol boundary wrapping external frameworks",                    "k9_core"),
    ("BaseGovernance",      "Governance",    "Pre/post policy gate evaluated on every agent execution",           "k9_core.governance"),
    ("BaseSecurity",        "Security",      "Zero-trust enforcement layer for orchestrator execution",           "k9_core.security"),
    ("BaseMonitor",         "Monitoring",    "Exposes squad lifecycle events and metrics",                        "k9_core.monitoring"),
    ("BasePersistence",     "Persistence",   "Persists routing state and audit trail per execution",              "k9_core.persistence"),
    ("BaseStorage",         "Storage",       "Abstract storage contract for session and artifact data",           "k9_core.storage"),
    ("BaseRetriever",       "Retrieval",     "Retrieves and parses documents for agent context",                  "k9_core.retrieval"),
    ("BaseConnector",       "Integration",   "MCP and external system connector ABB",                            "k9_core.integration"),
    ("BaseSessionStore",    "Session",       "Manages stateful session lifecycle across agent turns",             "k9_core.session"),
    ("BaseUI",              "Presentation",  "Presentation layer ABB for interactive agent interfaces",          "k9_core.presentation"),
    ("BaseCache",           "Cache",         "Provider-agnostic cache ABB — in-memory, Redis, or custom",        "k9_core.cache"),
    ("BaseQueue",           "Messaging",     "Message queue ABB for async event passing between components",     "k9_core.messaging"),
    ("BaseStreamProvider",  "Streaming",     "Streaming ABB for Redpanda/Kafka event fabric integration",        "k9_core.streaming"),
]

COMMON_SYSTEMS_ABBS = [
    ("BaseValidationLoopAgent", "Agent",    "Iterative hypothesis-validate-observe-continue loop skeleton",     "k9_agents.validation"),
    ("K9ValidationLoopAgent",   "Agent",    "OOB LLM-driven validation loop — confidence convergence",         "k9_agents.validation"),
    ("K9PlanningLoopAgent",     "Agent",    "OOB LLM-driven planning loop — dynamic plan + scratchpad",        "k9_agents.planning"),
    ("BaseCriticActorAgent",    "Agent",    "Actor-Critic refinement ABB — generate, critique, refine, accept","k9_agents.critic_actor"),
    ("BaseSecretManager",       "Security", "Provider-agnostic secret management ABB",                         "k9_core.security"),
    ("BaseModelRouter",         "Inference","Routes inference requests to the optimal LLM provider",            "k9_inference.routers"),
]

EXAMPLE_SBBS = [
    # ── Foundation — generic, no domain, reusable reference implementations ──
    dict(name="TemplateAgent",              kind="Agent",
         abb_names=["BaseAgent"],
         description="Minimal reference implementation of BaseAgent — starting point for any custom agent. No domain specialization.",
         tags=["template","reference","starter"],
         project="k9-aif-framework",   published_by="ravinatarajan@k9x.ai", inspect_passed=True),
    dict(name="TemplateOrchestrator",       kind="Orchestrator",
         abb_names=["BaseOrchestrator","BaseGovernance"],
         description="Reference orchestrator with governance gate wired — extend for your domain. Policy-checked on every agent call.",
         tags=["template","reference","governance"],
         project="k9-aif-framework",   published_by="ravinatarajan@k9x.ai", inspect_passed=True),

    # ── Common Systems — implement OOB k9-aif loop patterns ──────────────────
    dict(name="EOCValidationAgent",         kind="Agent",
         abb_names=["K9ValidationLoopAgent","BaseAgent"],
         description="Insurance document validation using K9ValidationLoopAgent — iterates hypothesis → validate → observe until confidence threshold met",
         domain="insurance",           tags=["validation","insurance","loop","eoc"],
         project="EOC",                published_by="ravinatarajan@k9x.ai", inspect_passed=True),
    dict(name="ArchitecturePlannerAgent",   kind="Agent",
         abb_names=["K9PlanningLoopAgent","BaseAgent"],
         description="TOGAF-aligned planning agent using K9PlanningLoopAgent — generates, evaluates, and dynamically refines architecture plans with scratchpad",
         domain="enterprise-architecture", tags=["planning","togaf","k9studio"],
         project="K9Studio",           published_by="ravinatarajan@k9x.ai", inspect_passed=True),
    dict(name="GovernanceReviewAgent",      kind="Agent",
         abb_names=["BaseCriticActorAgent","BaseGovernance"],
         description="Actor-Critic governance reviewer — generates a decision, critiques it against policy, refines until compliant",
         domain="governance",          tags=["governance","critic-actor","compliance"],
         project="k9-aif-framework",   published_by="ravinatarajan@k9x.ai", inspect_passed=True),

    # ── Industry — domain-specific SBBs built on Foundation contracts ─────────
    dict(name="K9ChatAgent",              kind="Agent",
         abb_names=["BaseAgent","BaseSessionStore","BaseConnector"],
         description="Conversational agent using ModelRouterFactory + LLMFactory for multi-provider chat",
         domain="conversational-ai",   tags=["chat","llm","multi-provider"],
         project="K9Chat",             published_by="ravinatarajan@k9x.ai", inspect_passed=True),
    dict(name="AcmeChatAgent",            kind="Agent",
         abb_names=["BaseAgent","BaseRetriever","BaseSessionStore"],
         description="Customer-facing chat agent for ACME Support Center with knowledge base retrieval",
         domain="customer-service",    tags=["chat","retrieval","support"],
         project="ACMESupportCenter",  published_by="ravinatarajan@k9x.ai", inspect_passed=True),
    dict(name="CrewAIOrchestratorAdapter",kind="Adapter",
         abb_names=["BaseAdapter","BaseOrchestrator"],
         description="Protocol bridge adapting CrewAI crews to the k9-aif orchestrator contract",
         domain="framework-integration",tags=["crewai","adapter","integration"],
         project="CrewAIIntegration",  published_by="ravinatarajan@k9x.ai", inspect_passed=True),
    dict(name="ZeroTrustOrchestrator",    kind="Orchestrator",
         abb_names=["BaseOrchestrator","BaseSecurity","BaseGovernance"],
         description="Security-first orchestrator enforcing zero-trust policy on every agent call",
         domain="security",            tags=["zero-trust","security","governance"],
         project="ZeroTrustDemo",      published_by="ravinatarajan@k9x.ai", inspect_passed=True),
    dict(name="DoDAFPipelineSquad",       kind="Squad",
         abb_names=["BaseSquad","BaseAgent","BaseStorage"],
         description="Multi-agent squad generating DoDAF views from architecture inputs",
         domain="defense-architecture",tags=["dodaf","architecture","generation"],
         project="DoDAFPipeline",      published_by="ravinatarajan@k9x.ai", inspect_passed=True),
]

EXAMPLE_APPS = [
    dict(name="EOC",
         description="Evidence of Coverage processor — extracts, validates and routes insurance documents through a multi-agent pipeline",
         domain="insurance",            project="EOC",              department="AI & Automation",
         team="Professional Services",  contact="ravinatarajan@k9x.ai",
         k9aif_version="1.2.6",         status="active",
         tags=["insurance","document-processing","kafka"],
         sbbs_used=["K9ValidationLoopAgent","ZeroTrustOrchestrator"]),
    dict(name="K9 Chat",
         description="Reference implementation of a conversational agent using k9-aif with multi-provider LLM routing",
         domain="conversational-ai",    project="K9Chat",           department="Platform Engineering",
         team="k9x",                    contact="ravinatarajan@k9x.ai",
         k9aif_version="1.2.6",         status="production",
         tags=["chat","reference","multi-llm"],
         sbbs_used=["K9ChatAgent"]),
    dict(name="ACME Support Center",
         description="Customer support center demo with knowledge base retrieval and live agent handoff",
         domain="customer-service",     project="ACMESupportCenter", department="Platform Engineering",
         team="k9x",                    contact="ravinatarajan@k9x.ai",
         k9aif_version="1.2.6",         status="active",
         tags=["support","retrieval","demo"],
         sbbs_used=["AcmeChatAgent","K9ValidationLoopAgent"]),
    dict(name="Zero Trust Demo",
         description="Security showcase demonstrating zero-trust enforcement across the k9-aif orchestration layer",
         domain="security",             project="ZeroTrustDemo",    department="Security",
         team="k9x",                    contact="ravinatarajan@k9x.ai",
         k9aif_version="1.2.6",         status="poc",
         tags=["security","demo","zero-trust"],
         sbbs_used=["ZeroTrustOrchestrator"]),
    dict(name="DoDAF Pipeline",
         description="Architecture document generator producing DoDAF views from TOGAF intake using multi-agent squads",
         domain="defense-architecture", project="DoDAFPipeline",    department="Enterprise Architecture",
         team="k9x",                    contact="ravinatarajan@k9x.ai",
         k9aif_version="1.2.6",         status="poc",
         tags=["dodaf","togaf","architecture"],
         sbbs_used=["DoDAFPipelineSquad"]),
]


def seed_abbs():
    db = SessionLocal()
    try:
        for (name, kind, desc, module) in FOUNDATION_ABBS:
            if not db.query(ABB).filter(ABB.name == name).first():
                db.add(ABB(name=name, kind=kind, description=desc, level="Foundation", module=module))
        for (name, kind, desc, module) in COMMON_SYSTEMS_ABBS:
            if not db.query(ABB).filter(ABB.name == name).first():
                db.add(ABB(name=name, kind=kind, description=desc, level="CommonSystems", module=module))
        db.commit()
    finally:
        db.close()


def seed_examples():
    db = SessionLocal()
    try:
        for data in EXAMPLE_SBBS:
            if not db.query(SBB).filter(SBB.name == data["name"]).first():
                db.add(SBB(**data, status="published", published_at=datetime.now(timezone.utc)))

        for data in EXAMPLE_APPS:
            if not db.query(Application).filter(Application.name == data["name"]).first():
                db.add(Application(**data))

        if not db.query(User).filter(User.email == "ravinatarajan@k9x.ai").first():
            db.add(User(
                name="Ravi Natarajan",
                email="ravinatarajan@k9x.ai",
                role="admin",
                password_hash=hashlib.sha256(b"changeme").hexdigest(),
            ))
        db.commit()
    finally:
        db.close()
