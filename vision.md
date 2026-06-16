# k9x_Repository — Product Specification

> *The Agentic SBB/ABB Catalog for the Enterprise*

---

## Vision

In the API world, we have API catalogs — SwaggerHub, Apigee, Kong.
In the data world, we have data catalogs — DataHub, Alation.
In the agentic world, we need an  **agentic catalog** .

**k9x_Repository** is the governed, queryable catalog where validated
SBBs and ABBs are published, discovered, reused, and evolved —
implementing the TOGAF Enterprise Continuum as living infrastructure,
not SharePoint folders.

---

## The Problem It Solves

| Old World               | Problem                                       |
| ----------------------- | --------------------------------------------- |
| SharePoint / Confluence | Static, unversioned, undiscoverable           |
| Folders and docs        | No governance, no lineage, no reuse tracking  |
| Copy-paste SBBs         | Architecture drift, no compliance enforcement |
| Siloed teams            | Reinventing the same patterns independently   |

**k9x_Repository** replaces all of this with a live, API-first,
governance-enforced catalog.

---

## Architecture

### Three Portals

#### 1. Admin Portal — Governance Layer

* Manage ABB contracts — create, version, retire
* Review and approve SBB promotions from team to shared catalog
* Monitor usage across projects and teams
* Set governance policies — what can be published, by whom
* Enterprise-wide visibility into pattern adoption and lineage
* Promote validated SBBs → ABBs via governed workflow

#### 2. Dev Portal — Discovery Layer

* Search and browse catalog by domain, type, tag, industry
* View SBB details — contract, dependencies, `k9aif inspect` status
* One-click scaffold generation via K9X Studio integration
* Fork an existing SBB into your project
* Publish your validated SBB back to the shared catalog
* See who else is using this SBB and how

#### 3. Project Portal — Team Layer

* Each project sees the shared enterprise catalog
* PLUS its own private SBBs not yet promoted
* Private → Shared promotion via governance workflow
* Studio is catalog-aware — queries before generating scaffold

---

## Catalog Scope

### Two Registries

#### ABB Registry — Architecture Continuum

| Level                 | Description               | Example                                           |
| --------------------- | ------------------------- | ------------------------------------------------- |
| Foundation            | Core K9-AIF contracts     | `BaseAgent`,`BaseRouter`,`BaseOrchestrator` |
| Common Systems        | Reusable patterns         | `ValidationLoopAgent`,`CriticActorAgent`      |
| Industry              | Reference implementations | EOC Insurance, Financial Analysis                 |
| Organization-Specific | Enterprise-customized     | `AcmeCorp BaseAgent extension`                  |

#### SBB Registry — Solutions Continuum

| Level                 | Description        | Example                                                |
| --------------------- | ------------------ | ------------------------------------------------------ |
| Foundation            | Runtime framework  | K9-AIF runtime executing every agent                   |
| Common Systems        | Shared agents      | Validation-loop and critic-actor running across squads |
| Industry              | Domain deployments | Claims, fraud, document processing                     |
| Organization-Specific | Live instances     | One org's generated and deployed scaffold              |

---

## The Governed Flow

```
Developer searches catalog
        ↓
Finds existing SBB for this pattern
        ↓
Forks into project (or creates new)
        ↓
Implements business logic into SBB
        ↓
k9aif inspect passes — SBB complies with ABB
        ↓
Developer publishes SBB to catalog
        ↓
Governance reviews pattern
        ↓
Promotes to shared catalog (team → enterprise)
        ↓
Governance evaluates for ABB promotion
        ↓
ABB evolves — next SBB starts stronger
```

---

## Studio Integration

K9X Studio queries k9x_Repository  **before generating a scaffold** :

> *"A validated SBB already exists for this pattern. Use it or fork it."*

This closes the Continuum loop shown on k9x.ai:

**ABB Defines Contract → SBB Implements → Pattern Emerges
→ Governance Evaluates → ABB Evolves → back to start**

---

## Key Features

### Discovery

* Full-text search across SBB names, descriptions, domains, tags
* Filter by: industry, pattern type, ABB contract, inspect status
* Browse by Architecture Continuum level
* See usage count — how many projects use this SBB

### Reuse

* Fork any catalog SBB into your project with one click
* Studio generates scaffold using catalog SBBs as base
* Dependency graph — see what this SBB depends on

### Governance

* Every SBB in catalog must pass `k9aif inspect` before publishing
* Promotion workflow — team → shared → enterprise → ABB
* Policy engine — who can publish, who can promote, who can retire
* Audit trail — every publish, fork, promotion is logged

### Lineage

* Which SBB implements which ABB — full traceability
* Which projects are using which SBBs
* Which SBBs have been promoted to ABB level and when
* Powered by Neo4j — already in the K9-AIF stack

### Versioning

* SBBs are versioned — semver aligned with K9-AIF releases
* Deprecation workflow — notify all users before retiring
* Breaking change detection against ABB contract

---

## API Design

REST API — catalog queries from Studio and CI/CD pipelines:

```
GET  /api/v1/sbbs                    — list/search SBBs
GET  /api/v1/sbbs/{id}               — SBB detail
POST /api/v1/sbbs                    — publish SBB
GET  /api/v1/abbs                    — list ABBs
GET  /api/v1/abbs/{id}/sbbs          — SBBs implementing this ABB
GET  /api/v1/projects/{id}/sbbs      — SBBs in a project
POST /api/v1/sbbs/{id}/promote       — request promotion
GET  /api/v1/lineage/{sbb_id}        — dependency graph
```

---

## Tech Stack

| Component         | Technology                                           |
| ----------------- | ---------------------------------------------------- |
| Core              | Pure Python — K9-AIF native                         |
| API               | FastAPI                                              |
| Catalog DB        | PostgreSQL                                           |
| Lineage Graph     | Neo4j — already in K9-AIF stack                     |
| Search            | Elasticsearch or PostgreSQL FTS                      |
| Auth              | OAuth2 — project-level and enterprise-level scoping |
| CI/CD Integration | `k9aif inspect`→ publish pipeline hook            |

---

## Scoping Model

```
Enterprise Catalog (Admin governed)
    ├── Shared SBBs (promoted from teams)
    ├── ABBs (promoted from shared SBBs)
    └── Industry Templates

Project Catalog (team-level)
    ├── Inherits enterprise catalog
    ├── Project-private SBBs
    └── Pending promotion queue
```

---

## Competitive Positioning

| Catalog                  | Domain                      | k9x_Repository Equivalent   |
| ------------------------ | --------------------------- | --------------------------- |
| npm / PyPI               | Libraries                   | SBB package registry        |
| SwaggerHub               | APIs                        | ABB contract registry       |
| DataHub                  | Data assets                 | Agentic asset catalog       |
| **k9x_Repository** | **Agentic SBBs/ABBs** | **The missing piece** |

---

## The Grady Booch Connection

K9-AIF is grounded in OOA/OOD principles — the same principles
Grady Booch defined. A repository of reusable, governed,
versioned architectural components is the natural expression
of those principles in the agentic world.

Not agents. **Architecture.**

---

## Phased Roadmap

### Phase 1 — Core Catalog

* SBB publish and browse
* `k9aif inspect` gate before publish
* Basic search and filter
* REST API for Studio integration

### Phase 2 — Governance

* Promotion workflow (team → shared → ABB)
* Admin portal
* Policy engine
* Audit trail

### Phase 3 — Intelligence

* Studio queries catalog before scaffold generation
* Duplicate detection — "this pattern already exists"
* Usage analytics and adoption metrics
* Neo4j lineage graph UI

### Phase 4 — Enterprise

* Multi-tenant scoping
* SSO / enterprise auth
* On-premise deployment option
* SLA and support tiers

---

*k9x_Repository — Where governed agentic architecture lives, grows, and compounds.*
