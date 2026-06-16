# k9x Enterprise Continuum — Product Features Specification

> *Agentic SBB & ABB Catalog — Implementing the TOGAF Enterprise Continuum*

---

## Product Overview

**k9x Enterprise Continuum** is the governed, queryable catalog where
validated SBBs and ABBs are published, discovered, reused, and evolved.
It implements the TOGAF Enterprise Continuum as live, API-first
infrastructure — not SharePoint folders, not Confluence pages.

**Current State:** Phases 1 & 2 live. Phases 3 & 4 planned.

**Tech Stack:** Pure Python · K9-AIF native · Neo4j · PostgreSQL · FastAPI
**Theme:** Light default · Dark toggle · System preference detection

---

## Phase 1 — Core Catalog (LIVE)

### Architecture Continuum Features

**Classification & Organisation**
- Foundation Architecture catalog — generic, vendor-neutral ABBs
- Common Systems Architecture patterns — reusable cross-industry
- Industry Architecture reference models — vertical-specific
- Organization-Specific Architecture — enterprise-customized
- Bidirectional navigation — abstract → concrete and back
- Four-level continuum browser (Foundation → Org-Specific)

**ABB Registry**
- ABB registration with contract definition
- Interface boundaries and layer constraints
- ABB versioning and lifecycle management
- Retirement and deprecation management
- Compliance tagging — TOGAF, DoDAF, MODAF, NAF alignment
- ABB → SBB implementation mapping

### Solutions Continuum Features

**SBB Registry**
- SBB registration and publishing
- `k9aif inspect` gate — mandatory before publishing
- Version control — semver aligned with K9-AIF releases
- Dependency mapping — SBB → ABB full traceability
- Status tracking — POC · Active · Production · Deprecated
- Industry vertical tagging — Insurance · Finance · Healthcare · Customer Service · Defense

**Application Catalog**
- Register applications built on K9-AIF
- Team · Department · Project metadata
- Framework version tracking (k9-aif 1.x.x)
- Tag-based discovery
- Application status — POC · Active · Production

**Discovery**
- Full-text search across SBBs, ABBs, applications
- Filter by domain, industry, status, framework version
- Browse by Architecture Continuum level
- Usage count — how many projects use this SBB

---

## Phase 2 — Governance (LIVE)

### Workflow Features

**Promotion Workflows**
- SBB → Team Shared promotion request
- Team Shared → Enterprise promotion review
- Enterprise SBB → ABB elevation workflow
- Multi-level approval chains
- Rejection with feedback loop

**Policy Engine**
- Who can publish SBBs (by role, team, project)
- Who can approve promotions (governance team)
- Who can retire ABBs (architecture board)
- Publishing gates — inspect must pass before catalog entry
- Mandatory metadata requirements before publish

**Audit Trail**
- Every publish, fork, promotion, retirement logged
- Immutable audit log — who did what and when
- Compliance reports by team, project, domain
- Export audit trail for enterprise compliance

### Users & Access

**Roles**
- Developer — publish SBBs, browse catalog, fork
- Team Lead — approve team-level promotions
- Architect — manage ABBs, review patterns
- Governance Admin — enterprise policy, cross-team visibility
- Viewer — read-only catalog access

**Scoping Model**
```
Enterprise Catalog (Admin governed)
    ├── ABBs (promoted from shared SBBs)
    ├── Shared SBBs (promoted from teams)
    └── Industry Templates

Project Catalog (team-level)
    ├── Inherits enterprise catalog
    ├── Project-private SBBs
    └── Pending promotion queue
```

### Compliance Features

- `k9aif inspect` gate enforced at publish time
- Architecture debt tracking — uninspected SBBs flagged
- Drift detection — SBB vs ABB contract divergence alerts
- Compliance dashboard by team, project, domain
- Change impact analysis — what breaks if this ABB changes

---

## Phase 3 — Intelligence (PLANNED)

### Studio Integration

- Studio queries k9x Enterprise Continuum before scaffold generation
- Prompt: *"A validated SBB already exists for this pattern. Use it or fork it."*
- One-click fork from catalog into Studio project
- Auto-publish to catalog when `k9aif inspect` passes in Studio
- Catalog-aware scaffold — uses existing SBBs as base components

### Duplicate Detection

- Pattern similarity scoring before new SBB publish
- Alert: *"This pattern is 87% similar to ExistingAgent in shared catalog"*
- Merge suggestion — extend existing rather than duplicate
- Cross-project pattern consolidation recommendations

### Lineage Graph

- Visual Neo4j-backed dependency explorer
- ABB → SBB implementation graph
- SBB → Project usage graph
- Impact analysis — change ripple detection across the enterprise
- Who is using what — full visibility

### Catalog Intelligence

- Pattern maturity scoring — usage × age × inspect rate
- Recommendation engine — "teams like yours use these SBBs"
- Architecture health score — continuum maturity by team/enterprise
- Adoption metrics — SBB reuse rates across projects
- Pattern trend analysis — what's emerging, what's declining

### Catalog Chat

- Natural language catalog search
- "Find me a validation agent for financial compliance"
- K9-AIF aware — understands ABB/SBB/Squad/Orchestrator context
- Powered by Claude via Anthropic API

---

## Phase 4 — Enterprise (PLANNED)

### Authentication & Identity

- SSO / SAML 2.0 / OAuth2 enterprise integration
- LDAP / Active Directory support
- Multi-tenant architecture — one instance, many enterprises
- Project-level and enterprise-level access scoping
- API key management for CI/CD integration

### Standards Alignment

**Reference Models Browser**
- TOGAF ADM phase alignment
- DoDAF viewpoints (AV, OV, SV, TV, DIV)
- MODAF / NAF support
- Industry reference models — eTOM · BIAN · ARTS
- Custom enterprise reference models import

**Patterns Library**
- Reusable architecture patterns catalog
- Pattern relationships and dependencies
- Pattern maturity rating (community + governance scored)
- Community contributions with governance gate
- Export patterns as TOGAF-compliant documentation

### Deployment Options

- SaaS — hosted at continuum.k9x.ai
- On-premise — Docker / Kubernetes deployment
- Air-gapped — for defense and regulated industries
- Hybrid — on-premise catalog, cloud governance portal

### Enterprise Reporting

- Adoption metrics dashboard — SBB reuse rates
- Architecture debt heatmap
- Team contribution leaderboard
- Continuum maturity score — how mature is your architecture
- Executive summary — architecture health by business unit
- Export — TOGAF-compliant architecture documentation

### SLA & Support

- Enterprise SLA tiers
- Dedicated support channel
- Architecture advisory services
- On-premise installation support
- Custom industry template development

---

## Integration Features (All Phases)

### CI/CD Pipeline Integration
- `k9aif inspect` → auto-publish on pass
- GitHub Actions / GitLab CI / Jenkins hooks
- Pre-commit hooks — inspect before commit
- Pipeline badge — catalog status visible in repo

### REST API
```
GET  /api/v1/sbbs                    — list/search SBBs
GET  /api/v1/sbbs/{id}               — SBB detail
POST /api/v1/sbbs                    — publish SBB
GET  /api/v1/abbs                    — list ABBs
GET  /api/v1/abbs/{id}/sbbs          — SBBs implementing this ABB
GET  /api/v1/applications            — list applications
POST /api/v1/applications            — register application
GET  /api/v1/projects/{id}/sbbs      — SBBs in a project
POST /api/v1/sbbs/{id}/promote       — request promotion
GET  /api/v1/lineage/{sbb_id}        — dependency graph
GET  /api/v1/analytics/adoption      — reuse metrics
```

### Webhook Notifications
- SBB deprecation alerts to all users
- Promotion approval/rejection notifications
- Breaking change warnings
- New SBB available in domain alerts

---

## UI Portals

### Dev Portal — Discovery
- Search and browse catalog
- View SBB/ABB details and contracts
- Fork SBB into project
- Publish validated SBB
- See usage and lineage

### Admin Portal — Governance
- Manage ABB contracts
- Review promotion requests
- Set policies
- Monitor enterprise adoption
- Audit trail viewer

### Project Portal — Team Scope
- Project-private catalog
- Promotion queue management
- Team SBB library
- Studio integration panel

---

## Roadmap Summary

| Phase | Status | Key Features |
|---|---|---|
| 1 — Core Catalog | ✅ LIVE | SBB/ABB registry · search · inspect gate · application catalog |
| 2 — Governance | ✅ LIVE | Promotion workflows · audit trail · policy engine · roles |
| 3 — Intelligence | 🔵 PLANNED | Studio sync · duplicate detection · lineage graph · catalog chat |
| 4 — Enterprise | 🔵 PLANNED | SSO · multi-tenant · DoDAF/MODAF · on-premise · SLA tiers |

---

## Competitive Positioning

| Catalog | Domain | k9x Enterprise Continuum |
|---|---|---|
| npm / PyPI | Libraries | SBB package registry |
| SwaggerHub / Apigee | APIs | ABB contract registry |
| DataHub / Alation | Data assets | Agentic asset catalog |
| Confluence / SharePoint | Documents | Governed living catalog |
| **k9x Enterprise Continuum** | **Agentic SBBs/ABBs** | **The missing piece** |

---

## The Continuum Loop — Made Real

```
ABB Defines Contract
        ↓
Studio generates scaffold (SBBs)
        ↓
Developer implements business logic
        ↓
k9aif inspect validates SBB → ABB compliance
        ↓
SBB published to k9x Enterprise Continuum
        ↓
Governance evaluates — promotes to shared catalog
        ↓
Pattern matures → promoted to ABB level
        ↓
ABB Evolves → next SBB starts stronger
        ↓
(loop continues)
```

The diagram on k9x.ai is no longer just a homepage graphic.
**k9x Enterprise Continuum is the infrastructure behind it.**

---

*k9x Enterprise Continuum — Where governed agentic architecture lives, grows, and compounds.*
