# Subagent Work Orders

This file is for the GPT-5.5 orchestrator. Use GPT-5.3-Codex-Spark subagents when possible.

Do not give every subagent the whole packet. Give each subagent only:

1. this work order section,
2. the listed spec files,
3. any relevant current code files,
4. clear output requirements.

Each subagent must return:

- summary of changes
- files changed
- tests added/updated
- commands run
- risks/open questions
- patch/branch/worktree result

The main orchestrator must review all work before accepting it.

---

## Subagent A — Scaffold, Init, Internal Git

### Read

- `01_PRODUCT_SPEC.md`
- `02_MVP_SCOPE_AND_NON_GOALS.md`
- `03_REPO_STRUCTURE.md`
- `06_INTERNAL_GIT_SPEC.md`
- `11_IMPLEMENTATION_NOTES_TEMPLATE.html`

### Implement

- project scaffold if missing
- CLI entry
- shared paths/config modules
- `hitl init`
- default workspace creation
- internal Git helper
- root `AGENTS.md` bootloader behavior
- initial tests for init/internal Git

### Avoid

- site server
- routing
- session commands beyond init placeholders

### Output

- changed files
- init smoke result
- internal Git status/log result
- test result

---

## Subagent B — HTML Templates and Local Website

### Read

- `01_PRODUCT_SPEC.md`
- `03_REPO_STRUCTURE.md`
- `05_HTML_AND_CLAIM_MODEL.md`
- `08_SITE_SPEC.md`

### Implement

- HTML templates
- HTML escaping helpers
- metadata script helpers
- simple site server
- routes required by spec
- graph/project/area/task/review/stale/history pages where needed
- site tests

### Avoid

- complex frontend framework
- arbitrary generated JavaScript

### Output

- changed files
- routes implemented
- fetch/smoke test result

---

## Subagent C — Context Routing

### Read

- `01_PRODUCT_SPEC.md`
- `03_REPO_STRUCTURE.md`
- `07_ROUTING_SPEC.md`
- relevant metadata files from implementation

### Implement

- metadata loader
- simple glob matching
- tokenization/scoring
- synonym groups
- `hitl context`
- `hitl start` affected-area routing support if not already done
- routing unit tests

### Avoid

- external embeddings
- external API calls
- black-box scoring with no reasons

### Output

- routing examples and scores
- tests run
- known routing limitations

---

## Subagent D — Sessions, Notes, Cleanup, Finalize

### Read

- `01_PRODUCT_SPEC.md`
- `04_CLI_COMMANDS.md`
- `05_HTML_AND_CLAIM_MODEL.md`
- `06_INTERNAL_GIT_SPEC.md`

### Implement

- `hitl start` if not complete
- `hitl note`
- `hitl cleanup`
- `hitl finalize`
- claim-index updates
- delta creation
- area page delta link updates
- tests for HTML card insertion and finalize

### Avoid

- freeform HTML insertion
- marking agent claims accepted by default
- deleting stale claims silently

### Output

- session workflow summary
- sample session file
- tests run

---

## Subagent E — Validate, Review, History

### Read

- `04_CLI_COMMANDS.md`
- `06_INTERNAL_GIT_SPEC.md`
- `09_VALIDATION_AND_TEST_PLAN.md`

### Implement

- `hitl validate`
- `hitl review`
- `hitl history`
- claim status updates
- validation tests

### Avoid

- brittle cosmetic validation
- failing on harmless formatting differences

### Output

- validation matrix
- tests run
- failure examples

---

## Subagent F — End-to-End Tests and Final QA

### Read

- `01_PRODUCT_SPEC.md`
- `09_VALIDATION_AND_TEST_PLAN.md`
- `12_FINAL_HANDOFF_CHECKLIST.md`
- current implementation files after integration

### Implement

- e2e test harness
- clean temp-dir workflow
- serve route checks
- context routing e2e
- note/cleanup/finalize e2e
- history and validation checks

### Avoid

- rewriting core implementation unless required to make tests possible
- weakening assertions to pass tests

### Output

- e2e commands run
- logs or concise results
- failures found and fixes suggested

---

## Main Orchestrator Integration Duties

After each subagent:

1. Read their summary.
2. Inspect the patch.
3. Reject over-engineered or off-spec changes.
4. Integrate carefully.
5. Run relevant tests.
6. Update `implementation-notes.html`.
7. Commit meaningful milestones.

At the end:

1. Run full build/tests.
2. Run manual smoke test.
3. Inspect generated `.humanintheloop` output.
4. Check internal Git history.
5. Check no nested `.git` in `.humanintheloop/content`.
6. Finalize `implementation-notes.html`.
7. Prepare final response.
