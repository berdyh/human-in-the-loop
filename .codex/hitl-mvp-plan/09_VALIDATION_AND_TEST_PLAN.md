# Validation and Test Plan

## `hitl validate`

Support:

```bash
hitl validate --session "<id>"
hitl validate --changed
hitl validate --files "src/connectors/crunchbase.ts"
```

## Workspace validation

Check:

- `.humanintheloop` exists
- `.humanintheloop/content` exists
- `.humanintheloop/history/git` exists
- `.humanintheloop/content/.git` does not exist
- required top-level pages exist
- indexes exist and are valid JSON
- claim index is valid

## Session validation

Required session sections:

- design-decisions
- spec-interpretations
- deviations
- tradeoffs
- open-questions
- stale-cleanup

Each must contain either:

- at least one relevant card
- or an explicit none card

## Changed-file validation

If `--changed` is used and project repo has Git:

- infer changed files from project Git diff
- map files to areas using `file-area-map.json`
- require an active/completed session or explicit waiver for affected area

If project repo has no Git:

- print useful message
- allow `--files`

## Finalize validation

Before `hitl finalize`:

- session is valid
- stale-cleanup exists or explicit none cleanup exists
- metadata parse succeeds

After `hitl finalize`:

- session moved to completed
- delta page created
- affected area page linked to delta
- review queue updated
- claim index updated

## Unit tests

Cover:

### Routing

- exact task match
- semantically similar task match
- negative examples reduce score
- file path globs strongly select areas
- required/recommended/possible grouping
- reasons returned

Required test examples:

- "add Crunchbase API ingestion" selects `source-ingestion` and `add-source-connector`
- "connect a new provider for company profiles" also selects them
- "change dashboard card styling" does not select `source-ingestion` as required
- `src/connectors/foo.ts` selects `source-ingestion`

### HTML

- note inserts card into correct section
- card has stable id
- card has correct `data-card-type`
- metadata updates
- HTML remains parseable
- user text is escaped

### Internal Git

- init creates history Git DB
- no content `.git`
- status/log works
- meaningful commits are created

### Validation

- missing required sections fail
- missing stale-cleanup fails unless explicit none cleanup exists
- completed session passes
- changed files mapping works
- invalid claim index fails

### Review

- review updates claim status
- review updates relevant HTML card status if possible

## E2E test

Use a temporary fixture directory and run the real CLI.

Flow:

1. Create temp repo.
2. Run `hitl init`.
3. Assert `.humanintheloop` exists.
4. Assert content pages exist.
5. Assert internal Git exists.
6. Assert no `.humanintheloop/content/.git`.
7. Run `hitl serve` on a temp port and fetch:
   - `/`
   - `/graph`
   - `/areas/source-ingestion`
   - `/api/status`
8. Run `hitl start`.
9. Run `hitl context` with semantically similar wording.
10. Add notes for:
    - design-decision
    - spec-interpretation
    - deviation
    - tradeoff
    - open-question
11. Add cleanup with `--action none`.
12. Validate session.
13. Finalize.
14. Assert:
    - session moved to completed
    - delta page created
    - source-ingestion page links to delta
    - claim-index updated
    - review queue contains pending claims
    - history shows meaningful commits
15. Run full validation with `--files`.
16. Confirm all tests pass.

## Required scripts

```json
{
  "scripts": {
    "build": "...",
    "test": "...",
    "test:e2e": "..."
  }
}
```
