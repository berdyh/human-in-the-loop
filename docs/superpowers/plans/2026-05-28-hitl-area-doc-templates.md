# HITL Area Documentation Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five HITL-native area documentation template structures for API surfaces, source connectors, retrieval, frontend screens, and ops/compliance.

**Architecture:** Generalize the existing `db-docs` scaffold into a small template registry that owns template metadata, evidence handling, generated HTML, area-page linking, session creation, and route whitelisting. Keep `hitl db-docs` as the database-specific compatibility command, and add `hitl area-docs --kind <kind>` for the five new structures. Each template writes under `.humanintheloop/content/areas/<area>/`, starts a HITL session with the affected area, and preserves human-authored pages unless the file is generated and `--force` is used.

**Tech Stack:** TypeScript, Node built-ins, Commander, Vitest, plain single-file HTML, internal HITL Git.

---

## Research Inputs

- Diataxis: separate explanation/reference/how-to needs; these templates should be explanation-first for architects and reviewers, with compact reference tables where needed. Source: https://diataxis.fr/
- OpenAPI docs: API notes should distinguish short summaries from detailed behavior, include request/response examples, and make error behavior explicit. Source: https://learn.openapis.org/specification/docs.html
- Airbyte connector docs: connector notes should capture auth, pagination, incremental cursor fields, datetime formats, request injection, rate limits, and breaking-change risks. Source: https://docs.airbyte.com/platform/connector-development/connector-builder-ui/incremental-sync
- RAG evaluation docs: retrieval notes should separate retrieval evaluation from answer evaluation, and track faithfulness, context relevancy/precision/recall, and regression queries. Sources: https://developers.llamaindex.ai/python/framework/module_guides/evaluating/ and https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/
- WCAG 2.2: frontend notes should explicitly capture state messaging, focus/labels/errors, and accessibility obligations rather than only visual layout. Source: https://www.w3.org/TR/WCAG22/
- SRE and OpenTelemetry: ops/compliance notes should tie alerts to SLOs, runbooks, telemetry naming, ownership, and escalation paths. Sources: https://sre.google/workbook/alerting-on-slos/ and https://opentelemetry.io/docs/concepts/semantic-conventions/

## File Map

- Create `src/docs/areaDocs.ts`: generic template registry, HTML renderers, evidence normalization, preserve/force rules, area-link insertion, session creation, internal Git commit.
- Modify `src/docs/dbDocs.ts`: keep `createDatabaseDocs()` API as a thin wrapper over the generic registry to avoid duplicate scaffold logic.
- Modify `src/cli.ts`: add `hitl area-docs --kind <kind>` and keep `hitl db-docs`.
- Modify `src/site/server.ts`: whitelist explicit area document routes only; do not add arbitrary area-file serving.
- Modify `tests/unit/db-docs.test.ts`: keep compatibility coverage for database docs through the wrapper.
- Create `tests/unit/area-docs.test.ts`: unit coverage for all five new template kinds, preserve/force behavior, missing evidence open questions, no external CDN.
- Modify `tests/e2e/hitl.e2e.test.ts`: exercise `area-docs`, route serving, area-page link, session context, and internal Git history.
- Maintain `template-creation-notes.html`: running design/deviation/tradeoff/open-question notes for this feature.
- Maintain `simplify-removed-blub-notes.html`: running simplification/removal notes.

## Template Contract

All five templates must:

- Write single-file self-contained HTML inside `.humanintheloop/content/areas/<area>/<filename>.html`.
- Include a generated marker `data-hitl-generated="<kind>"`.
- Include `Last reviewed`, `Evidence Inventory`, `Open Questions for Architect`, and compact cards/tables.
- Include evidence inventory from `--evidence`, `--code`, and `--product`.
- Mark missing evidence as an open question; never invent facts from absent files.
- Link from the area page, preserving any existing link.
- Start a HITL session with `forcedAreas: [areaId]`.
- Commit generated/link changes to HITL internal Git.
- Preserve human-authored pages; `--force` may refresh only pages with the matching generated marker.

## Template Definitions

### `api-surface`

- Default area: `api-surfaces`
- File: `api.html`
- Route: `/areas/:id/api`
- Required sections:
  - API Surface Mental Model
  - Endpoint / Operation Inventory
  - Request + Response Contracts
  - Auth, Permissions, and Tenancy
  - Error Model + Compatibility
  - Idempotency / Rate Limits / Pagination
  - Observability + Audit Notes
  - Known Shortcuts / Technical Debt
  - Evidence Inventory
  - Open Questions for Architect

### `source-connector`

- Default area: `source-ingestion`
- File: `connectors.html`
- Route: `/areas/:id/connectors`
- Required sections:
  - Connector Mental Model
  - Provider Surface + Auth
  - Stream / Object Inventory
  - Sync Modes, Cursor, and Pagination
  - Normalization + Data Quality
  - Retry, Rate Limit, and Idempotency
  - Breaking Changes + Versioning
  - Known Shortcuts / Technical Debt
  - Evidence Inventory
  - Open Questions for Architect

### `retrieval`

- Default area: `rag`
- File: `retrieval.html`
- Route: `/areas/:id/retrieval`
- Required sections:
  - Retrieval Mental Model
  - Corpus, Chunking, and Metadata
  - Index / Embedding Configuration
  - Query Pipeline + Reranking
  - Grounding, Citations, and Answer Boundaries
  - Evaluation Set + Metrics
  - Failure Modes + Regression Cases
  - Known Shortcuts / Technical Debt
  - Evidence Inventory
  - Open Questions for Architect

### `frontend-screen`

- Default area: `frontend-dashboard`
- File: `screens.html`
- Route: `/areas/:id/screens`
- Required sections:
  - Screen Mental Model
  - User Flows + Entry Points
  - State Matrix
  - Data Dependencies + Permissions
  - Accessibility + Interaction Notes
  - Responsive Layout + Visual Decisions
  - Analytics + Observability
  - Known Shortcuts / Technical Debt
  - Evidence Inventory
  - Open Questions for Architect

### `ops-compliance`

- Default area: `ops-compliance`
- File: `ops.html`
- Route: `/areas/:id/ops`
- Required sections:
  - Operational Mental Model
  - SLOs, SLIs, and Error Budgets
  - Alerts, Dashboards, and Runbooks
  - Telemetry + Audit Events
  - Access, Retention, and Compliance Boundaries
  - Incident Response + Escalation
  - Backup / Recovery / Degraded Mode
  - Known Shortcuts / Technical Debt
  - Evidence Inventory
  - Open Questions for Architect

## Task 1: Generic Area Docs Module

**Files:**
- Create: `src/docs/areaDocs.ts`
- Modify: `src/docs/dbDocs.ts`

- [ ] Move reusable db-docs behavior into a generic `createAreaDocs(root, input)` function.
- [ ] Define `AreaDocKind`, `AreaDocInput`, `AreaDocResult`, and a typed registry for `database` plus the five new kinds.
- [ ] Keep database behavior compatible with existing tests: default output `.humanintheloop/content/areas/data-spine/database.html`, route `/areas/data-spine/database`, and `createDatabaseDocs()` result shape.
- [ ] Implement matching generated-marker overwrite rules: preserve any existing file without marker; refuse `--force` if marker does not match the requested kind.
- [ ] Use one renderer that takes template sections, evidence, missing paths, reviewed timestamp, and route metadata.
- [ ] Run `npm test -- tests/unit/db-docs.test.ts` and expect database compatibility to pass.

## Task 2: CLI and Route Whitelist

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/site/server.ts`

- [ ] Add `hitl area-docs --kind <kind>`.
- [ ] Add options `--area <id>`, `--evidence <paths>`, `--code <globs>`, `--product <files>`, and `--force`.
- [ ] Print path, route, session, and status using the same shape as `db-docs`.
- [ ] Add explicit area document route slugs: `api`, `connectors`, `retrieval`, `screens`, `ops`, and keep `database`.
- [ ] Validate area IDs with `assertSafePathSegment`.
- [ ] Confirm `/areas/<id>/<slug>/extra` still returns 404.

## Task 3: Unit Tests for Five Templates

**Files:**
- Create: `tests/unit/area-docs.test.ts`
- Modify: `tests/unit/db-docs.test.ts`

- [ ] Test each new kind creates the expected default area path and route.
- [ ] Test each generated page includes required sections, last reviewed timestamp, evidence inventory, open questions, generated marker, compact tables/cards, and no external CDN URLs.
- [ ] Test missing evidence paths are recorded as open questions instead of throwing or inventing facts.
- [ ] Test human-authored pages are preserved and forced overwrite is refused.
- [ ] Test `--force` refreshes only a matching generated page.

## Task 4: E2E Workflow

**Files:**
- Modify: `tests/e2e/hitl.e2e.test.ts`

- [ ] Run `area-docs --kind api-surface --code src/routes/company.ts --product docs/api.md` inside the existing clean temp workflow.
- [ ] Verify `.humanintheloop/content/areas/api-surfaces/api.html` exists.
- [ ] Verify `/areas/api-surfaces/api` serves the generated API notes.
- [ ] Verify `/areas/api-surfaces` links to `/areas/api-surfaces/api`.
- [ ] Verify the generated session context includes affected area `api-surfaces`.
- [ ] Verify internal HITL history includes `hitl area-docs`.
- [ ] Verify an invalid nested route under the generated slug returns 404.

## Task 5: Running Notes and Simplification

**Files:**
- Maintain: `template-creation-notes.html`
- Maintain: `simplify-removed-blub-notes.html`
- HITL session: `session_20260528114117-implement-area-documenta-6789a9`

- [ ] Record why the solution uses a generic registry instead of five independent command modules.
- [ ] Record that `db-docs` remains as a compatibility alias/wrapper.
- [ ] Record any intentional deviations from the user's requested five-template scope.
- [ ] Record any simplification/removal of duplicated db-docs helpers.
- [ ] Add HITL session notes for design decision, spec interpretation, deviation, tradeoff, open question, and stale cleanup.

## Task 6: Review and Verification

**Files:**
- All changed implementation and test files.

- [ ] Run `npm test`.
- [ ] Run `npm run test:e2e`.
- [ ] Dispatch `/review` subagents for spec compliance and code quality.
- [ ] Fix Critical and Important review findings.
- [ ] Run `npx tsx src/cli.ts finalize --session session_20260528114117-implement-area-documenta-6789a9`.
- [ ] Run `npx tsx src/cli.ts validate --changed`.
- [ ] Do a final requirement-by-requirement completion audit before marking the goal complete.

## Self-Review

- Spec coverage: the plan covers five template structures, planning before implementation, internet research, parallel agent orchestration, notes, simplification review, tests, subagent reviews, HITL finalize, and changed-file validation.
- Placeholder scan: no `TBD`/`TODO` placeholders are used as implementation instructions; template HTML may intentionally contain fill-in prompts for human-authored notes after scaffold creation.
- Type consistency: `area-docs`, `AreaDocKind`, `createAreaDocs`, route slugs, and result fields are named consistently across tasks.
