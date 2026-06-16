from backend.database import SessionLocal
from backend.models import ABB

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
    ("BaseValidationLoopAgent", "Agent",   "Iterative hypothesis→validate→observe→continue loop skeleton",     "k9_agents.validation"),
    ("K9ValidationLoopAgent",   "Agent",   "OOB LLM-driven validation loop — confidence convergence",         "k9_agents.validation"),
    ("K9PlanningLoopAgent",     "Agent",   "OOB LLM-driven planning loop — dynamic plan + scratchpad",        "k9_agents.planning"),
    ("BaseCriticActorAgent",    "Agent",   "Actor-Critic refinement ABB — generate→critique→refine→accept",   "k9_agents.critic_actor"),
    ("BaseSecretManager",       "Security","Provider-agnostic secret management ABB",                          "k9_core.security"),
    ("BaseModelRouter",         "Inference","Routes inference requests to the optimal LLM provider",           "k9_inference.routers"),
]


def seed_abbs():
    db = SessionLocal()
    try:
        for (name, kind, desc, module) in FOUNDATION_ABBS:
            if not db.query(ABB).filter(ABB.name == name).first():
                db.add(ABB(name=name, kind=kind, description=desc,
                           level="Foundation", module=module))

        for (name, kind, desc, module) in COMMON_SYSTEMS_ABBS:
            if not db.query(ABB).filter(ABB.name == name).first():
                db.add(ABB(name=name, kind=kind, description=desc,
                           level="CommonSystems", module=module))

        db.commit()
        print(f"Seeded {len(FOUNDATION_ABBS) + len(COMMON_SYSTEMS_ABBS)} ABBs")
    finally:
        db.close()
