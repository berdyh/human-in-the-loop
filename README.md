# Human in the Loop MVP — Codex Implementation Packet

## Install And Update

From this source checkout:

```bash
npm install
npm run build
node dist/cli.js install-agents --target all
```

In a repo that already uses HITL, refresh managed workspace structure/design and update the local Codex/Claude Code skill with:

```bash
hitl update --workspace --agents
```

`hitl update --workspace` is the explicit migration path after HITL design or structure changes. It refreshes managed `.humanintheloop/` files while preserving non-managed human-authored files.

For user-flow evidence reviews, create the generic journey scaffold with:

```bash
hitl area-docs --kind user-journey --area frontend-dashboard
```

The generated page lives at `.humanintheloop/content/areas/<area>/journey.html` and is served at `/areas/<area>/journey`.

Use this packet as a multi-file implementation brief.

The intended workflow:

1. Give `.initial-plan/00_MASTER_ORCHESTRATOR_PROMPT.md` to the GPT-5.5 orchestrator.
2. The orchestrator should materialize this packet into the target repo, for example under `.codex/hitl-mvp-plan/`.
3. The orchestrator should create `implementation-notes.html` at repo root before coding.
4. The orchestrator should delegate bounded tasks to GPT-5.3-Codex-Spark subagents when possible.
5. Subagents should read only the files listed in their work order.
6. The orchestrator should review, integrate, test end-to-end, and make the final call.

Do not paste the entire packet into every subagent. The point is progressive disclosure.

Recommended read order for the orchestrator:

1. `.initial-plan/00_MASTER_ORCHESTRATOR_PROMPT.md`
2. `.initial-plan/01_PRODUCT_SPEC.md`
3. `.initial-plan/02_MVP_SCOPE_AND_NON_GOALS.md`
4. `.initial-plan/10_SUBAGENT_WORK_ORDERS.md`
5. Relevant detailed spec files only when needed.

Recommended model split:

- Main orchestrator/reviewer: GPT-5.5
- Focused implementation subagents: GPT-5.3-Codex-Spark
- Subagents should handle bounded implementation or test work, not global product decisions.

Core deliverable:

A TypeScript/Node CLI named `hitl` that creates and maintains a repo-local `.humanintheloop/` workspace with HTML-native implementation memory, internal local Git history, semantic-ish context routing, structured session notes, validation, review, history, and one local human-facing website.
