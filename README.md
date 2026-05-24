# Human in the Loop MVP — Codex Implementation Packet

Use this packet as a multi-file implementation brief.

The intended workflow:

1. Give `00_MASTER_ORCHESTRATOR_PROMPT.md` to the GPT-5.5 orchestrator.
2. The orchestrator should materialize this packet into the target repo, for example under `.codex/hitl-mvp-plan/`.
3. The orchestrator should create `implementation-notes.html` at repo root before coding.
4. The orchestrator should delegate bounded tasks to GPT-5.3-Codex-Spark subagents when possible.
5. Subagents should read only the files listed in their work order.
6. The orchestrator should review, integrate, test end-to-end, and make the final call.

Do not paste the entire packet into every subagent. The point is progressive disclosure.

Recommended read order for the orchestrator:

1. `00_MASTER_ORCHESTRATOR_PROMPT.md`
2. `01_PRODUCT_SPEC.md`
3. `02_MVP_SCOPE_AND_NON_GOALS.md`
4. `10_SUBAGENT_WORK_ORDERS.md`
5. Relevant detailed spec files only when needed.

Recommended model split:

- Main orchestrator/reviewer: GPT-5.5
- Focused implementation subagents: GPT-5.3-Codex-Spark
- Subagents should handle bounded implementation or test work, not global product decisions.

Core deliverable:

A TypeScript/Node CLI named `hitl` that creates and maintains a repo-local `.humanintheloop/` workspace with HTML-native implementation memory, internal local Git history, semantic-ish context routing, structured session notes, validation, review, history, and one local human-facing website.
