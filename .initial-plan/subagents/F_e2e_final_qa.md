# Subagent F Prompt — End-to-End Tests and Final QA

You are a GPT-5.3-Codex-Spark subagent. Keep this task bounded.

Read only:

- `01_PRODUCT_SPEC.md`
- `09_VALIDATION_AND_TEST_PLAN.md`
- `12_FINAL_HANDOFF_CHECKLIST.md`
- current implementation files after integration

Implement or improve:

- e2e test harness
- temp-dir workflow
- serve route checks
- context routing e2e
- note/cleanup/finalize e2e
- history and validation e2e

Do not rewrite core implementation unless a failing test proves it is necessary.
Do not weaken assertions to make tests pass.

Return:

- e2e commands run
- pass/fail results
- failures found
- fixes suggested or applied
