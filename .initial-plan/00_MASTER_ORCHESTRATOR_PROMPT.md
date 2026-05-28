/goal

Build the MVP of **Human in the Loop**, a repo-local HTML-native implementation-memory tool for coding-agent workflows.

This prompt is for the **main GPT-5.5 orchestrator**. Use GPT-5.3-Codex-Spark subagents for focused implementation and test tasks when possible. Keep subagent context small: pass only the specific work order and the relevant spec files listed for that subagent.

Do not treat this as a one-shot monolithic prompt. Materialize the plan files, split implementation into bounded work orders, integrate the results, review them yourself, run all tests end-to-end, and only then hand the work back.

## Immediate first actions

1. Inspect the repository.
2. If it is not a Git repo, initialize local Git. Do not configure a remote.
3. Create `implementation-notes.html` at repo root using `11_IMPLEMENTATION_NOTES_TEMPLATE.html`.
4. Commit the initial notes/scaffold when appropriate.
5. Materialize this implementation packet into the repo, preferably under:

   `.codex/hitl-mvp-plan/`

6. Read:

   - `01_PRODUCT_SPEC.md`
   - `02_MVP_SCOPE_AND_NON_GOALS.md`
   - `10_SUBAGENT_WORK_ORDERS.md`
   - `12_FINAL_HANDOFF_CHECKLIST.md`

7. Decide whether to run parallel subagents. If subagents are available, use them. If not, execute the same work orders sequentially.

## Implementation-note requirement

As you work, maintain the root `implementation-notes.html` file. This file is for this implementation project because the tool does not exist yet.

It must capture:

- Design decisions: choices made where the product spec was ambiguous.
- Spec interpretations: how you interpreted this packet when implementation details were not fully specified.
- Deviations: places where you intentionally departed from the packet, and why.
- Tradeoffs: alternatives considered and why the chosen path was selected.
- Open questions: anything the human should confirm or revise.
- Test evidence: commands run and results.
- Commits made: meaningful commit hashes/messages.

Update it during the work, not only at the end.

## Model/subagent strategy

Use GPT-5.3-Codex-Spark subagents only for bounded tasks with explicit inputs and outputs.

Good Spark subagent tasks:

- implement one command family
- write focused tests
- review one module
- inspect routing behavior
- verify internal Git behavior
- generate fixture-based e2e test cases

Bad Spark subagent tasks:

- deciding the whole architecture
- rewriting the whole product spec
- making broad cross-cutting changes without review
- final acceptance

The main orchestrator owns:

- architecture consistency
- integration
- conflict resolution
- security review
- final test run
- final handoff summary

## Parallelization rules

Parallel subagents must avoid editing the same files when possible.

Preferred sequence:

1. Main orchestrator creates project scaffold, shared types, and clear module boundaries.
2. Spawn parallel subagents on separate areas:
   - Internal Git + init
   - HTML templates + local site
   - Routing + context
   - Sessions/notes/cleanup/finalize
   - Validation/review/history
   - Tests
3. Integrate one subagent at a time.
4. Run tests after each integration batch.
5. Resolve overlapping edits yourself.

If the environment supports branches/worktrees for subagents, use them. If not, coordinate sequentially.

## Quality bar

The implementation should be elegant and clean, not over-engineered.

Prefer:

- deterministic local behavior
- minimal dependencies
- readable TypeScript
- small cohesive modules
- structured HTML cards
- simple site server
- real e2e tests

Avoid:

- external LLM/API calls
- hosted embeddings/vector DBs
- heavy frontend frameworks
- MCP implementation in MVP
- DeepWiki clone functionality
- arbitrary unsafe HTML/JS
- silently deleting stale info
- dumping all docs into `AGENTS.md`

## Required final verification

Before handoff, run:

- `npm run build`
- `npm test`
- `npm run test:e2e`

Then run a clean manual smoke test from a temporary directory:

```bash
hitl init
hitl start --spec "Add Crunchbase API ingestion for company profiles" --task "connect a new provider" --files "src/connectors/crunchbase.ts"
hitl context --task "pull organization data from external provider" --files "src/connectors/crunchbase.ts"
hitl note --session "<id>" --type design-decision --title "Normalize provider payloads" --body "Provider payloads are normalized before data-spine insertion."
hitl note --session "<id>" --type spec-interpretation --title "External source data enters through adapters" --body "The spec was interpreted as provider adapter -> normalization -> storage."
hitl note --session "<id>" --type deviation --title "Raw payloads are not canonical" --body "Raw provider payloads are not stored as canonical records."
hitl note --session "<id>" --type tradeoff --title "Adapter path over direct indexing" --body "Direct provider-to-indexing was rejected because it couples indexing to provider schema."
hitl note --session "<id>" --type open-question --title "Raw payload retention" --body "Should raw provider payloads be retained for audit/compliance?"
hitl cleanup --session "<id>" --action none --reason "No stale HITL claims exist in this new fixture."
hitl validate --session "<id>"
hitl finalize --session "<id>"
hitl validate --files "src/connectors/crunchbase.ts"
hitl history
hitl serve --port 4317
```

Verify the local site loads:

- `/`
- `/graph`
- `/areas/source-ingestion`
- `/api/status`

## Final response requirements

Return:

- files changed
- commands run
- test results
- commits made
- summary of design decisions
- deviations/tradeoffs/open questions from `implementation-notes.html`
- anything not completed
