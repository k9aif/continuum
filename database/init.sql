-- ─────────────────────────────────────────────────────────────────────────────
-- k9x Repository — Database Init
-- Run as: psql -U postgres -f init.sql
-- Creates database k9x, schema k9repo, all tables and indexes.
-- Safe to re-run: all statements use IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Create database (run separately if already exists)
-- Run: psql -U postgres -c "CREATE DATABASE k9x;"

\connect k9x

-- ─── Schema ───────────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS k9repo;

SET search_path TO k9repo;

-- ─── ABB Registry ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS k9repo.abbs (
    id          SERIAL          PRIMARY KEY,
    name        VARCHAR(255)    NOT NULL,
    kind        VARCHAR(50)     NOT NULL DEFAULT 'ABB',
    description TEXT,
    level       VARCHAR(50)     NOT NULL DEFAULT 'Foundation',
    -- Foundation | CommonSystems | Industry | OrgSpecific
    module      VARCHAR(255),
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT abbs_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_abbs_level  ON k9repo.abbs (level);
CREATE INDEX IF NOT EXISTS idx_abbs_kind   ON k9repo.abbs (kind);

-- ─── SBB Registry ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS k9repo.sbbs (
    id              SERIAL          PRIMARY KEY,
    name            VARCHAR(255)    NOT NULL,
    kind            VARCHAR(50),
    -- Agent | Orchestrator | Squad | Router | Adapter
    description     TEXT,
    domain          VARCHAR(100),
    tags            TEXT[]          DEFAULT '{}',
    abb_name        VARCHAR(255),
    -- FK by name (ABBs are stable; avoids join for discovery)
    version         VARCHAR(20)     NOT NULL DEFAULT '1.0.0',
    status          VARCHAR(20)     NOT NULL DEFAULT 'draft',
    -- draft | published | promoted
    inspect_passed  BOOLEAN         NOT NULL DEFAULT FALSE,
    yaml_snapshot   TEXT,
    -- agent/squad YAML captured at publish time
    git_ref         VARCHAR(500),
    -- org/repo@sha:path/to/file.py
    published_by    VARCHAR(255),
    published_at    TIMESTAMPTZ,
    project         VARCHAR(100),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT sbbs_status_check    CHECK (status IN ('draft','published','promoted')),
    CONSTRAINT sbbs_inspect_check   CHECK (status = 'draft' OR inspect_passed = TRUE)
    -- cannot publish/promote without inspect passing
);

CREATE INDEX IF NOT EXISTS idx_sbbs_kind          ON k9repo.sbbs (kind);
CREATE INDEX IF NOT EXISTS idx_sbbs_domain        ON k9repo.sbbs (domain);
CREATE INDEX IF NOT EXISTS idx_sbbs_status        ON k9repo.sbbs (status);
CREATE INDEX IF NOT EXISTS idx_sbbs_abb_name      ON k9repo.sbbs (abb_name);
CREATE INDEX IF NOT EXISTS idx_sbbs_inspect       ON k9repo.sbbs (inspect_passed);
CREATE INDEX IF NOT EXISTS idx_sbbs_published_by  ON k9repo.sbbs (published_by);
CREATE INDEX IF NOT EXISTS idx_sbbs_project       ON k9repo.sbbs (project);
CREATE INDEX IF NOT EXISTS idx_sbbs_created_at    ON k9repo.sbbs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sbbs_tags          ON k9repo.sbbs USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_sbbs_fts           ON k9repo.sbbs
    USING GIN (to_tsvector('english', coalesce(name,'') || ' ' ||
                                      coalesce(description,'') || ' ' ||
                                      coalesce(domain,'')));

-- ─── Audit log ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS k9repo.audit_log (
    id          SERIAL          PRIMARY KEY,
    entity      VARCHAR(20)     NOT NULL,   -- 'sbb' | 'abb'
    entity_id   INTEGER         NOT NULL,
    action      VARCHAR(50)     NOT NULL,   -- 'published' | 'promoted' | 'deleted' | 'forked'
    actor       VARCHAR(255),
    project     VARCHAR(100),
    note        TEXT,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity     ON k9repo.audit_log (entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_action     ON k9repo.audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON k9repo.audit_log (created_at DESC);

-- ─── Auto-update updated_at ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION k9repo.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sbbs_updated_at ON k9repo.sbbs;
CREATE TRIGGER trg_sbbs_updated_at
    BEFORE UPDATE ON k9repo.sbbs
    FOR EACH ROW EXECUTE FUNCTION k9repo.set_updated_at();

-- ─── Seed: Foundation ABBs ────────────────────────────────────────────────────

INSERT INTO k9repo.abbs (name, kind, description, level, module) VALUES
  ('BaseRouter',         'Router',        'Routes events to domain orchestrators by event type',              'Foundation',    'k9_core.router'),
  ('BaseOrchestrator',   'Orchestrator',  'Owns a domain and controls squad execution flow',                  'Foundation',    'k9_core.orchestration'),
  ('BaseSquad',          'Squad',         'Groups agents that progressively enrich a shared context',         'Foundation',    'k9_squad'),
  ('BaseAgent',          'Agent',         'Atomic execution unit — execute(payload) returns dict',            'Foundation',    'k9_core.agent'),
  ('BaseAdapter',        'Adapter',       'Protocol boundary wrapping external frameworks',                   'Foundation',    'k9_core'),
  ('BaseGovernance',     'Governance',    'Pre/post policy gate evaluated on every agent execution',          'Foundation',    'k9_core.governance'),
  ('BaseSecurity',       'Security',      'Zero-trust enforcement layer for orchestrator execution',          'Foundation',    'k9_core.security'),
  ('BaseMonitor',        'Monitoring',    'Exposes squad lifecycle events and metrics',                       'Foundation',    'k9_core.monitoring'),
  ('BasePersistence',    'Persistence',   'Persists routing state and audit trail per execution',             'Foundation',    'k9_core.persistence'),
  ('BaseStorage',        'Storage',       'Abstract storage contract for session and artifact data',          'Foundation',    'k9_core.storage'),
  ('BaseRetriever',      'Retrieval',     'Retrieves and parses documents for agent context',                 'Foundation',    'k9_core.retrieval'),
  ('BaseConnector',      'Integration',   'MCP and external system connector ABB',                           'Foundation',    'k9_core.integration'),
  ('BaseSessionStore',   'Session',       'Manages stateful session lifecycle across agent turns',            'Foundation',    'k9_core.session'),
  ('BaseUI',             'Presentation',  'Presentation layer ABB for interactive agent interfaces',         'Foundation',    'k9_core.presentation'),
  ('BaseCache',          'Cache',         'Provider-agnostic cache ABB — in-memory, Redis, or custom',       'Foundation',    'k9_core.cache'),
  ('BaseQueue',          'Messaging',     'Message queue ABB for async event passing',                       'Foundation',    'k9_core.messaging'),
  ('BaseStreamProvider', 'Streaming',     'Streaming ABB for Redpanda/Kafka event fabric integration',       'Foundation',    'k9_core.streaming'),
  ('BaseValidationLoopAgent', 'Agent',    'Iterative hypothesis→validate→observe→continue loop skeleton',    'CommonSystems', 'k9_agents.validation'),
  ('K9ValidationLoopAgent',   'Agent',    'OOB LLM-driven validation loop — confidence convergence',         'CommonSystems', 'k9_agents.validation'),
  ('K9PlanningLoopAgent',     'Agent',    'OOB LLM-driven planning loop — dynamic plan + scratchpad',        'CommonSystems', 'k9_agents.planning'),
  ('BaseCriticActorAgent',    'Agent',    'Actor-Critic refinement ABB — generate→critique→refine→accept',  'CommonSystems', 'k9_agents.critic_actor'),
  ('BaseSecretManager',       'Security', 'Provider-agnostic secret management ABB',                        'CommonSystems', 'k9_core.security'),
  ('BaseModelRouter',         'Inference','Routes inference requests to the optimal LLM provider',           'CommonSystems', 'k9_inference.routers')
ON CONFLICT (name) DO NOTHING;
