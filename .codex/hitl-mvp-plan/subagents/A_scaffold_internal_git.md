# Subagent A Prompt — Scaffold, Init, Internal Git

You are a GPT-5.3-Codex-Spark subagent. Keep this task bounded.

Read only:

- `01_PRODUCT_SPEC.md`
- `02_MVP_SCOPE_AND_NON_GOALS.md`
- `03_REPO_STRUCTURE.md`
- `06_INTERNAL_GIT_SPEC.md`
- `11_IMPLEMENTATION_NOTES_TEMPLATE.html`
- existing scaffold files relevant to init/internal Git

Implement:

- Node/TypeScript scaffold if missing
- CLI entry
- shared paths/config helpers
- `hitl init`
- default `.humanintheloop` content structure
- internal Git helper using explicit `--git-dir` and `--work-tree`
- default root/adapted `AGENTS.md` bootloader behavior
- tests for init and internal Git

Do not implement site server, routing, session notes, review, or validation beyond what init needs.

Return:

- summary
- changed files
- tests run
- risks/open questions
