# Context Routing Spec

`hitl context` must not rely only on exact keywords.

It should use a deterministic local semantic/fuzzy router.

Inputs:

- task text
- optional session id
- optional file list
- area metadata
- task metadata
- file path globs
- semantic examples
- negative examples
- related areas/tasks
- built-in synonym groups

## Output groups

Return:

```txt
Required
Recommended
Possible
```

Each context item should include:

- id
- type
- path
- confidence
- reason

## Scoring signals

Strong positive:

- file path glob match
- explicit required area/task relation
- direct title/id match

Medium positive:

- semantic examples overlap
- synonym group overlap
- summary overlap
- related decision/task boost

Negative:

- negative example overlap
- unrelated path category

## Built-in synonym groups

```json
{
  "source-ingestion": [
    "source",
    "provider",
    "api",
    "connector",
    "ingest",
    "pull",
    "sync",
    "import",
    "external data"
  ],
  "data-spine": [
    "canonical",
    "normalized",
    "storage",
    "postgres",
    "schema",
    "database",
    "data spine"
  ],
  "graph-indexing": [
    "index",
    "indexing",
    "embedding",
    "vector",
    "graph",
    "retrieval",
    "search"
  ],
  "rag": [
    "rag",
    "answer",
    "context",
    "retrieval",
    "rerank",
    "generation"
  ],
  "api-surfaces": [
    "endpoint",
    "route",
    "api",
    "surface",
    "controller",
    "handler"
  ],
  "frontend-dashboard": [
    "dashboard",
    "ui",
    "widget",
    "chart",
    "page"
  ],
  "ops-compliance": [
    "audit",
    "compliance",
    "ops",
    "logging",
    "alert",
    "retention"
  ]
}
```

## Required behavior examples

- "add Crunchbase API ingestion" selects:
  - required: `source-ingestion`
  - required/recommended: `add-source-connector`
  - recommended: `data-spine`

- "connect a new provider for company profiles" selects the same even without exact phrase.

- files under `src/connectors/**` select `source-ingestion` strongly even if task text is vague.

- "change dashboard card styling" should not make `source-ingestion` required.

## Metadata examples

Area metadata and task metadata should include:

- id
- type
- title
- summary
- path_globs
- semantic_examples
- negative_examples
- related_tasks / required_areas / recommended_areas
- related_decisions
