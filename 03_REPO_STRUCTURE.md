# Repository and Module Structure

## Recommended source layout

```txt
src/
  cli.ts
  commands/
    init.ts
    serve.ts
    start.ts
    context.ts
    note.ts
    cleanup.ts
    finalize.ts
    validate.ts
    history.ts
    review.ts

  core/
    paths.ts
    config.ts
    ids.ts
    time.ts
    errors.ts

  git/
    internalGit.ts

  html/
    templates.ts
    htmlParse.ts
    htmlCards.ts
    metadata.ts
    escapeHtml.ts

  routing/
    metadata.ts
    router.ts
    scoring.ts
    glob.ts
    synonyms.ts

  sessions/
    sessionStore.ts
    noteStore.ts
    finalize.ts

  claims/
    claimIndex.ts

  site/
    server.ts
    routes.ts
    renderIndex.ts

  validation/
    validateWorkspace.ts
    validateSession.ts
    validateChanged.ts
    validateClaims.ts

  review/
    reviewClaims.ts

tests/
  unit/
  e2e/
```

## Implementation rules

- Keep modules small.
- No circular dependencies.
- CLI commands should call core services, not contain all logic.
- HTML escaping must be centralized.
- All file writes should be atomic enough for MVP: write temp file then rename where easy.
- Use clear error messages.
- Do not silently ignore invalid workspace state.

## Dependencies

Acceptable:

- `commander`
- `zod`
- `cheerio`
- `vitest`
- `tsx`
- `typescript`
- small utility dependency for glob matching if needed

Avoid heavy frameworks.
