# CLI Commands Spec

## `hitl init`

Creates `.humanintheloop/`, default content, indexes, and internal local Git.

Also creates:

`.humanintheloop/adapters/agents-md/AGENTS.md`

If root `AGENTS.md` does not exist, create a tiny one. If it exists, do not overwrite it.

Root `AGENTS.md` content:

```md
# Human in the Loop

This repository uses Human in the Loop.

Before editing code, run:

hitl context --task "<task>" --files "<planned or changed files>"

While implementing, maintain the active HITL session with:
- design decisions
- spec interpretations
- deviations
- tradeoffs
- open questions
- stale documentation cleanup

Before finishing, run:

hitl finalize --session "<session-id>"
hitl validate --changed

Do not put subsystem-specific guidance in this file. Load relevant HITL context instead.
```

## `hitl serve [--port 4317]`

Serves one local human-facing website.

Required routes:

```txt
/                       -> project.html
/graph                  -> graph.html
/areas/:id              -> areas/:id/page.html
/tasks/:id              -> tasks/:id/page.html
/decisions/:id          -> decisions/:id.html
/sessions/active/:id    -> sessions/active/:id.html
/sessions/completed/:id -> sessions/completed/:id.html
/deltas/:id             -> deltas/:id.html
/questions              -> simple index
/stale                  -> simple index
/review                 -> review queue
/history                -> internal HITL Git history
/api/status             -> JSON status
```

## `hitl start`

Usage:

```bash
hitl start \
  --spec "Add Crunchbase API ingestion for company profiles" \
  --task "add external source ingestion" \
  --files "src/connectors/crunchbase.ts src/ingestion/companyNormalizer.ts"
```

Creates a running session HTML file:

```txt
.humanintheloop/content/sessions/active/<timestamp-slug>.html
```

Outputs:

- session id
- session file path
- affected areas
- required sections
- recommended `hitl context` command

Makes an internal HITL Git commit.

## `hitl context`

Usage:

```bash
hitl context \
  --task "pull organization data from an external provider" \
  --files "src/connectors/crunchbase.ts"
```

Options:

- `--session <id>`
- `--json`

Returns required/recommended/possible context items.

Each item:

```json
{
  "id": "source-ingestion",
  "type": "area",
  "path": ".humanintheloop/content/areas/source-ingestion/agent-context.html",
  "confidence": 0.91,
  "reason": "matched connector file path and external provider semantics"
}
```

## `hitl note`

Usage:

```bash
hitl note \
  --session "<session-id>" \
  --type design-decision \
  --title "Normalize provider payloads before data-spine insertion" \
  --body "The spec requires pulling company data from an external API but does not specify whether provider fields should become canonical." \
  --why "This keeps provider-specific fields from leaking into indexing and RAG." \
  --files "src/connectors/crunchbase.ts src/ingestion/companyNormalizer.ts"
```

Supported `--type`:

- `design-decision`
- `spec-interpretation`
- `deviation`
- `tradeoff`
- `open-question`

Behavior:

- append structured card to correct section
- update metadata
- update claim index when appropriate
- commit internally

## `hitl cleanup`

Usage:

```bash
hitl cleanup \
  --session "<session-id>" \
  --old-claim "Provider fields may be indexed directly" \
  --action supersede \
  --reason "New source ingestion path requires normalization before indexing."
```

Supported actions:

- `remove`
- `supersede`
- `needs-review`
- `keep-with-warning`
- `none`

`none` means the agent checked for stale docs and found nothing relevant.

## `hitl finalize`

Usage:

```bash
hitl finalize --session "<session-id>"
```

Behavior:

- validates session
- moves active session to completed
- creates delta page
- updates affected area pages with a "Recent implementation memory" link/card
- updates review queue
- updates stale index
- updates claim index
- marks generated knowledge as pending-human-review
- commits internally

Do not blindly dump entire session into area pages.

## `hitl validate`

Usage:

```bash
hitl validate --session "<session-id>"
hitl validate --changed
hitl validate --files "src/connectors/crunchbase.ts src/ingestion/companyNormalizer.ts"
```

Validation rules are in `09_VALIDATION_AND_TEST_PLAN.md`.

## `hitl history`

Usage:

```bash
hitl history
hitl history --page areas/source-ingestion/page.html
```

Shows internal HITL Git history.

## `hitl review`

Usage:

```bash
hitl review --claim "<claim-id>" --status accepted
hitl review --claim "<claim-id>" --status rejected
hitl review --claim "<claim-id>" --status needs-review
hitl review --claim "<claim-id>" --status superseded --superseded-by "<claim-id>"
```

Updates claim index, related HTML card status if possible, review queue, and internal Git history.
