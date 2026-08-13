# Documentation map

Seven documents, each with one job. Start here to find the right one.

| Doc | Answers | Read it when |
| --- | --- | --- |
| [`implementation-plan.md`](./implementation-plan.md) | **What is built, what isn't, and what ships first.** The hub — workstreams A–F, the traffic-measured launch tiering, open questions, and every "decided on date X" record. | You want the current state of anything, or you're deciding what to work on next. |
| [`design-system.md`](./design-system.md) | **Tokens and primitives**: the Figma `👉 UI` page ↔ `src/shared/` map. Colors, spacing, radius, typography, the component inventory with per-component drift notes. | You're building or changing a shared UI component, or wondering which token a value should come from. |
| [`page-mocks.md`](./page-mocks.md) | **Page mocks**: the Figma `design` page ↔ routes map, section by section, with the node ids to jump to and which mocks are canonical vs. legacy scratch. | You're about to build a page and need to find its mock. |
| [`wp-backend.md`](./wp-backend.md) | **The WordPress side**: hosting and SSH access, the content model (CPTs, taxonomies, the film ACF group, the category ids we hardcode), the plugin cleanup plan, the API surface, the media-offload pipeline. | You're writing a fetcher, chasing a data question, or touching WP. |
| [`prod-migration-runbook.md`](./prod-migration-runbook.md) | **od-dev → od-stage → prod**, in execution order: blockers, recon commands, WP prep, applying the film worksheet, env + config, verification gates, rollback. | You're promoting anything to another environment. |
| [`legacy-page-fallback.md`](./legacy-page-fallback.md) | **A6**: how ~170 not-yet-redesigned pages get served inside the new shell (iframe via a same-origin proxy), why not SSR injection, and what's left to build. | You're working on the catch-all route or the launch gate. |
| [`questions-for-designer.md`](./questions-for-designer.md) | **The open design questions**, in Russian, ready to send. Canonical list — the other docs point here. | You're talking to Design, or you hit an ambiguity in a mock. |

## Conventions across these docs

- **Status legend** is the same everywhere: `[ ]` not started · `[~]` partial or blocked · `[x]` done; and ✅ / ⚠️ / ❌ in tables.
- **Claims carry dates.** "Verified 2026-08-13" means someone actually probed it then. Numbers without a date are inherited and worth re-checking.
- **Decisions are recorded in place, not deleted.** Superseded reasoning is struck through or marked *historical* so it stays findable — if you resolve something, strike it rather than removing it, and strike it in every doc that repeats it.
- **These docs are the reference; the task log is elsewhere.** Operational work against the WP server (DB queries, plugin changes, content migrations) is logged under `~/Projects/servers-agent/tasks/YYYY-MM-DD-slug/`, per that repo's convention.
- **`CLAUDE.md`** at the repo root covers repo mechanics — commands, layering, lint rules — not project state. The [root `README.md`](../README.md) covers local setup and the film data-entry workflow.
