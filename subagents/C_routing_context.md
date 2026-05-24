# Subagent C Prompt — Context Routing

You are a GPT-5.3-Codex-Spark subagent. Keep this task bounded.

Read only:

- `01_PRODUCT_SPEC.md`
- `03_REPO_STRUCTURE.md`
- `07_ROUTING_SPEC.md`
- existing routing/metadata files

Implement:

- metadata loader
- deterministic tokenization/scoring
- small synonym groups
- glob/path matching
- required/recommended/possible grouping
- `hitl context`
- routing support for `hitl start` if needed
- routing unit tests

No external embeddings, no LLM calls, no hosted services.

Return:

- summary
- examples with confidence/reasons
- changed files
- tests run
- known limitations
