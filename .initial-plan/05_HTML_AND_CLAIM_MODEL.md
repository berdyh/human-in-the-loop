# HTML and Claim Model

## HTML requirements

Human-facing docs are HTML.

Every important page should include:

- readable human content
- stable `data-section` sections
- embedded metadata script:

```html
<script type="application/hitl+json">
{ ... }
</script>
```

## Session page sections

Required session sections:

- `spec`
- `affected-areas`
- `design-decisions`
- `spec-interpretations`
- `deviations`
- `tradeoffs`
- `open-questions`
- `stale-cleanup`
- `related-code`
- `related-tests`

## Card structure

Cards should look like:

```html
<div
  class="hitl-card"
  data-hitl-card="true"
  data-card-id="..."
  data-card-type="design-decision"
  data-status="agent-draft"
>
  <h3>...</h3>
  <p>...</p>
</div>
```

Supported card types:

- `design-decision`
- `spec-interpretation`
- `deviation`
- `tradeoff`
- `open-question`
- `stale-cleanup`
- `claim`
- `waiver`

Supported statuses:

- `agent-draft`
- `pending-human-review`
- `accepted`
- `rejected`
- `superseded`
- `needs-review`
- `stale`
- `kept-with-warning`

## Explicit none cards

Validation should require that each required implementation-memory section has either real cards or an explicit "none" card.

Examples:

```txt
No deviations were introduced.
No stale HITL claims existed in this fixture.
```

## Security

Do not write arbitrary scripts from user input.

Escape user-provided strings.

Allow only safe generated HTML templates.

The metadata script may contain JSON, but user strings must be JSON-escaped.

## Claim model

A claim is a documentation statement future developers/agents may rely on.

Track claims in:

```txt
.humanintheloop/indexes/claim-index.json
```

Minimal claim record:

```json
{
  "claim_id": "claim_...",
  "title": "...",
  "type": "design-decision",
  "status": "pending-human-review",
  "affected_areas": [],
  "related_files": [],
  "introduced_by_session": "...",
  "source_html": "sessions/active/...",
  "created_at": "...",
  "updated_at": "...",
  "supersedes": [],
  "superseded_by": []
}
```

Do not overbuild claims. MVP needs only enough for review, cleanup, and validation.
