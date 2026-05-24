# Subagent D Prompt — Sessions, Notes, Cleanup, Finalize

You are a GPT-5.3-Codex-Spark subagent. Keep this task bounded.

Read only:

- `01_PRODUCT_SPEC.md`
- `04_CLI_COMMANDS.md`
- `05_HTML_AND_CLAIM_MODEL.md`
- `06_INTERNAL_GIT_SPEC.md`
- existing session/html/claim files

Implement:

- `hitl start` completion if needed
- `hitl note`
- `hitl cleanup`
- `hitl finalize`
- structured card insertion
- claim-index updates
- delta page creation
- affected area page delta links
- unit tests for cards/finalize

Do not allow arbitrary freeform HTML.
Do not mark claims accepted by default.
Do not silently delete stale claims.

Return:

- summary
- sample session/delta paths
- changed files
- tests run
- risks/open questions
