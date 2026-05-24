# Subagent E Prompt — Validate, Review, History

You are a GPT-5.3-Codex-Spark subagent. Keep this task bounded.

Read only:

- `04_CLI_COMMANDS.md`
- `06_INTERNAL_GIT_SPEC.md`
- `09_VALIDATION_AND_TEST_PLAN.md`
- existing validation/review/history files

Implement:

- `hitl validate`
- `hitl review`
- `hitl history`
- claim status updates
- validation tests
- review tests
- history tests

Validation should fail for missing required implementation-memory behavior, not harmless formatting.

Return:

- summary
- validation failure examples
- changed files
- tests run
- risks/open questions
