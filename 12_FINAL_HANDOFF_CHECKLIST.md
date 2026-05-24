# Final Handoff Checklist

The orchestrator may hand back only when all relevant items are satisfied or explicitly reported as incomplete.

## Build and tests

- [ ] `npm run build` passed
- [ ] `npm test` passed
- [ ] `npm run test:e2e` passed
- [ ] manual smoke test completed

## Required tool behavior

- [ ] `hitl init` works in a clean directory
- [ ] `.humanintheloop` structure is created
- [ ] internal local Git is created under `.humanintheloop/history/git`
- [ ] no `.humanintheloop/content/.git` exists
- [ ] `hitl serve` exposes one website
- [ ] `hitl start` creates active session HTML
- [ ] `hitl context` returns required/recommended/possible context
- [ ] routing handles semantically similar task text
- [ ] `hitl note` appends structured cards
- [ ] `hitl cleanup` records cleanup or explicit none cleanup
- [ ] `hitl finalize` creates delta and updates area page link
- [ ] `hitl validate` catches missing required behavior
- [ ] `hitl review` updates claim status
- [ ] `hitl history` shows meaningful internal commits

## Implementation notes

- [ ] `implementation-notes.html` exists
- [ ] design decisions recorded
- [ ] spec interpretations recorded
- [ ] deviations recorded or explicitly none
- [ ] tradeoffs recorded
- [ ] open questions recorded or explicitly none
- [ ] test evidence recorded
- [ ] commits recorded

## Final response

Include:

- files changed
- commands run
- test results
- commits made
- design decisions
- deviations/tradeoffs/open questions
- known limitations
