# Product Spec: Human in the Loop MVP

## Product name

Human in the Loop

## CLI name

`hitl`

## Workspace directory

`.humanintheloop/`

## Product purpose

Human in the Loop is a repo-local implementation-memory system for coding-agent workflows.

It helps coding agents preserve useful human-facing knowledge while they implement specs:

- design decisions
- spec interpretations
- deviations from spec
- tradeoffs
- open questions
- stale or superseded documentation cleanup

The tool stores human-facing knowledge as HTML, not Markdown.

The tool must not feed all docs to agents at once. It should return only relevant area/task context through `hitl context`.

## MVP deliverable

Build a TypeScript/Node CLI tool named `hitl`.

If the repository has no stack, create a clean Node 20+ TypeScript project with:

- `package.json`
- `tsconfig.json`
- `src/`
- `tests/`
- executable CLI entry
- Vitest
- build/test/e2e scripts

## Core principles

1. HTML is the primary human-facing documentation medium.
2. Agent-written implementation notes are structured cards, not freeform blobs.
3. Root `AGENTS.md` should remain a tiny bootloader.
4. Relevant context should be selected by area/task/file routing.
5. The `.humanintheloop/content` workspace should have its own internal local Git history.
6. Human truth requires review states.
7. Stale information should be removed, superseded, marked needs-review, or kept with warning.
8. No external LLM/API calls in MVP.
9. Keep the MVP small and deterministic.

## Workspace structure

After `hitl init`, create:

```txt
.humanintheloop/
  config.json
  manifest.json

  content/
    project.html
    graph.html

    areas/
      data-spine/
        page.html
        agent-context.html
        templates.html
        metadata.json

      source-ingestion/
        page.html
        agent-context.html
        templates.html
        metadata.json

      graph-indexing/
        page.html
        agent-context.html
        templates.html
        metadata.json

      rag/
        page.html
        agent-context.html
        templates.html
        metadata.json

      api-surfaces/
        page.html
        agent-context.html
        templates.html
        metadata.json

      frontend-dashboard/
        page.html
        agent-context.html
        templates.html
        metadata.json

      ops-compliance/
        page.html
        agent-context.html
        templates.html
        metadata.json

    tasks/
      add-source-connector/
        page.html
        agent-context.html
        examples.html
        metadata.json

      modify-rag-retrieval/
        page.html
        agent-context.html
        examples.html
        metadata.json

      add-api-surface/
        page.html
        agent-context.html
        examples.html
        metadata.json

    decisions/
      postgres-over-lancedb.html
      api-source-pull-model.html
      company-indexing-strategy.html

    sessions/
      active/
      completed/

    deltas/
    questions/
    stale/
    review/

  history/
    git/

  indexes/
    file-area-map.json
    routing-index.json
    claim-index.json
    code-state-index.json

  adapters/
    agents-md/
    codex-skills/
    claude-skills/

  validators/
```

## Default areas

- Data Spine
- Source Ingestion
- Graph / Indexing
- RAG
- API Surfaces
- Frontend Dashboard
- Ops / Compliance

## Default tasks

- Add Source Connector
- Modify RAG Retrieval
- Add API Surface

## Default decisions

- Postgres over LanceDB
- API Source Pull Model
- Company Indexing Strategy
