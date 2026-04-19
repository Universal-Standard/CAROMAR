# SWARM Consolidation Packet

Generated: 2026-04-01 19:23:38 UTC
Project root: C:\Users\Administrator\Documents\GitHub\CAROMAR

## Canonical Target

- Canonical org/repo: `Universal-Standard/SWARM`
- In-scope handles: `UniversalStandards`, `Universal-Standard`, `US-SPURS`, `usgov`
- Rule: preserve history before moving code
- Rule: do not keep duplicate stacks for auth, database, workflow engine, editor, or queueing

## Repo Matrix

| Handle | Repository | Role | Decision | Destination | Last Commit | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Universal-Standard | SWARM | Base | keep | apps/api + core monorepo root | not cloned locally | Canonical repo and strongest workflow backend. |
| UniversalStandards | SWARM | Donor | import | apps/console | not cloned locally | Use as source for product shell, Next.js UX, docs, and App Router patterns. |
| UniversalStandards | PROJECT-SWARM | Donor | import | packages/workflow-core + apps/api | not cloned locally | Use for parity checks and recovery of missing workflow features. |
| Universal-Standard | PROJECT-SWARM | Donor | import | packages/workflow-core + apps/api | not cloned locally | Secondary lineage repo; preserve history and mine feature deltas. |
| US-SPURS | SWARM | Blueprint | rewrite | backlog only | not cloned locally | Snapshot zip with useful roadmap items like RBAC, plugins, NATS, and monitoring. |
| UniversalStandards | OpenMemory | Integration | integrate | services/memory | not cloned locally | Memory system should stay modular; do not flatten merge. |
| UniversalStandards | mcp | Integration | integrate | services/mcp-hub | not cloned locally | Best candidate for the primary MCP hub. |
| Universal-Standard | Universal-Standard-MCP-Server | Integration | import | packages/integrations-mcp-spurs | not cloned locally | Mine tools and patterns; do not keep a second MCP product shell. |
| US-SPURS | ATLANTIS-AI | Integration | import | packages/orchestration-strategies | not cloned locally | Good source for hierarchical coordination patterns. |
| US-SPURS | github-mcp-server | Reference | archive | reference only | not cloned locally | Reference fork only; extract ideas narrowly if needed. |
| Universal-Standard | openai-swarm | Reference | archive | reference only | not cloned locally | Educational reference, not production merge material. |
| UniversalStandards | mcp-mcp | Reference | archive | reference only | not cloned locally | Upstream/reference only. |
| US-SPURS | n8n | Reference | archive | reference only | not applicable | Competitor/reference system; do not merge. |
| usgov | (no SWARM repos found) | Monitor | drop | none | not applicable | Keep out of scope unless a SWARM repo appears. |

## Final Package Map

| Package | Purpose | Source |
| --- | --- | --- |
| apps/console | Next.js UI shell | UniversalStandards/SWARM |
| apps/api | Express workflow API | Universal-Standard/SWARM |
| packages/workflow-core | Execution graph, scheduler, webhooks, versioning | Universal-Standard/SWARM + PROJECT-SWARM repos |
| packages/ui-workflow | ReactFlow editor and workflow builder | Universal-Standard/SWARM + UniversalStandards/SWARM |
| packages/auth | GitHub-first auth and session model | UniversalStandards/SWARM + Universal-Standard/SWARM |
| packages/db | Canonical Drizzle schema and migrations | Universal-Standard/SWARM |
| packages/integrations-github | GitHub automation and repo tooling | Universal-Standard/SWARM + MCP adapters |
| packages/orchestration-strategies | Hive-mind and hierarchical coordination | US-SPURS/ATLANTIS-AI + local orchestrator code |
| services/mcp-hub | Primary MCP service | UniversalStandards/mcp |
| services/memory | Memory service adapter | UniversalStandards/OpenMemory |

## 6-Hour Operator Plan

1. T+00:00-00:15 lock canonical target and repo classifications.
2. T+00:15-00:30 assign four parallel lanes.
3. T+00:30-02:30 run repo, backend, frontend, and integrations analysis concurrently.
4. T+02:30-03:00 merge lane outputs into one keep/import/rewrite/drop/archive matrix.
5. T+03:00-04:00 lock the final package structure.
6. T+04:00-05:00 create the first-wave migration backlog.
7. T+05:00-06:00 publish the execution packet and archive plan.

## Parallel Lane Instructions

### Lane A

- Scope: Repo graph and archive plan
- Output format: `Source Repo`, `Subsystem`, `Decision`, `Destination`, `Risk`, `Next Action`
- Prompt: Confirm which repos are base, donor, integration, reference, or archive. Flag mirrors, snapshots, and repos that should not be merged wholesale.

### Lane B

- Scope: Backend and schema
- Output format: `Source Repo`, `Subsystem`, `Decision`, `Destination`, `Risk`, `Next Action`
- Prompt: Compare execution engine, scheduler, webhooks, routes, schema, persistence, monitoring, cost tracking, and workflow versioning. Prefer the most complete working implementation.

### Lane C

- Scope: Frontend and UX
- Output format: `Source Repo`, `Subsystem`, `Decision`, `Destination`, `Risk`, `Next Action`
- Prompt: Compare app shell, auth UX, dashboard, workflow builder UI, templates, settings, and navigation. Identify what to port into a single console.

### Lane D

- Scope: Integrations and orchestration
- Output format: `Source Repo`, `Subsystem`, `Decision`, `Destination`, `Risk`, `Next Action`
- Prompt: Compare MCP, memory, GitHub automation, orchestration strategies, and hierarchical coordination. Extract capabilities rather than whole repos.

## First Wave Backlog

- Scaffold the monorepo inside Universal-Standard/SWARM without changing the public repo identity.
- Import donor repositories with preserved history under legacy paths before moving any code.
- Lift the backend and schema from Universal-Standard/SWARM into apps/api and packages/db.
- Port the stronger product shell from UniversalStandards/SWARM into apps/console.
- Wire services/mcp-hub and services/memory as external or workspace services.
- Convert US-SPURS/SWARM zip features into tracked backlog items instead of direct code imports.

## Top Risks

- Auth duplication between Replit-centric flows and GitHub-first flows can create migration churn.
- There are multiple overlapping workflow schemas across repos; only one canonical schema should survive.
- Reference repos can easily bloat the codebase if imported wholesale instead of mined surgically.
- US-SPURS/SWARM is a packaged snapshot, not a stable live source repo.
- Frontend and backend stacks diverge enough that a direct file merge would be slower than package extraction.

## Done Definition

- One canonical `SWARM` repo
- One destination architecture
- One repo-by-repo merge matrix
- One first-wave implementation backlog
- Duplicate repos clearly marked as merged, integrated, reference, or archived
