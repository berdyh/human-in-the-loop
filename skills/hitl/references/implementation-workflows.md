# Implementation Workflows

Use these workflows after the skill has triggered. Keep normal code verification separate from HITL validation.

## Existing Codebase Start Workflow

1. Read root instructions:

   ```bash
   sed -n '1,220p' AGENTS.md
   ```

2. Check whether HITL exists:

   ```bash
   test -d .humanintheloop && echo "HITL workspace present" || echo "HITL workspace missing"
   ```

3. If missing and the user wants HITL adoption or repo instructions require it, run:

   ```bash
   hitl init
   ```

4. For mutable implementation work, refresh managed HITL files and installed agent skills:

   ```bash
   hitl update --workspace --agents
   ```

   This is the normal update path after CLI, skill, structure, or design changes. Skip it during read-only review.

5. Before edits, route context from the project root:

   ```bash
   hitl context --task "<task>" --files "<planned files>"
   ```

6. Start an implementation session:

   ```bash
   hitl start --spec "<spec or request>" --task "<task>" --files "<planned files>"
   ```

7. Save the session id in your notes or working plan. Do not rely on memory.

## Active Implementation Workflow

Use this loop whenever the work produces durable implementation knowledge:

1. Make a narrow code or docs change.
2. Run the relevant local verification for that change.
3. Add a HITL note if the change involved a decision, interpretation, deviation, tradeoff, or open question.
4. Re-run `hitl context` if the file set or task changed.
5. Keep stale-doc cleanup current when you touch old docs or claims.

Run mutating HITL commands one at a time. Parallel `hitl note` or `cleanup` calls can collide on the internal HITL Git history.

For human-facing HITL HTML docs, make the output visual when it helps the reader verify evidence quickly: tables for inventories and matrices, cards for compact choices or state summaries, and SVG/HTML flow diagrams for sequences and handoffs. Keep prose short and plain-English, and label unknowns instead of filling gaps by assumption.

Example note cadence:

```bash
hitl note --session "<session-id>" --type spec-interpretation --title "<title>" --body "<interpretation>" --why "<reason>" --files "<files>"
hitl note --session "<session-id>" --type tradeoff --title "<title>" --body "<tradeoff>" --why "<reason>" --files "<files>"
hitl note --session "<session-id>" --type open-question --title "<title>" --body "<question>" --why "<why it matters>" --files "<files>"
```

## MVP-Stage Adoption Workflow

Use this when the repository is early, the architecture is moving, or documentation is incomplete.

1. Initialize HITL early:

   ```bash
   hitl init
   ```

2. Start one session per coherent MVP slice:

   ```bash
   hitl start --spec "MVP slice: <slice>" --task "<task>" --files "<initial files>"
   ```

3. Record explicit interpretations because MVP specs are usually incomplete:

   ```bash
   hitl note --session "<session-id>" --type spec-interpretation --title "<title>" --body "<chosen interpretation>" --why "<why this unblocks the MVP>" --files "<files>"
   ```

4. Record intentional scope control as tradeoffs or deviations:

   ```bash
   hitl note --session "<session-id>" --type tradeoff --title "Keep MVP deterministic" --body "<what was left out>" --why "<why this belongs after MVP>" --files "<files>"
   ```

5. Prefer `open-question` over guessing when a decision changes product semantics.

6. Before closing the slice:

   ```bash
   hitl cleanup --session "<session-id>" --action none --reason "Checked MVP docs and found no stale claims."
   hitl validate --session "<session-id>"
   hitl validate --files "<changed files>"
   hitl finalize --session "<session-id>"
   hitl validate --changed
   ```

   If `hitl validate --files` warns that no required HITL areas match the files, add an `open-question` note before finalizing when future routing should be improved.

## Subagent Handoff Workflow

Use this when delegating implementation or review.

1. Run `hitl context` before dispatching.
2. Pass the subagent only the relevant context paths, the session id, task scope, and owned files.
3. Tell the subagent to add HITL notes for decisions inside its scope or to report exact note text back if it cannot run the CLI.
4. Do not ask every subagent to read all `.humanintheloop/` content.
5. After the subagent returns, verify its diff and run `hitl note` yourself for integration decisions.

Subagent prompt shape:

```txt
Use the HITL session <session-id>. Owned files: <files>. Required context from `hitl context`: <paths>. Add `hitl note` entries for design decisions, spec interpretations, deviations, tradeoffs, or open questions you introduce. Do not finalize the session.
```

## Finish Workflow

Use this sequence before claiming HITL work is complete:

```bash
hitl cleanup --session "<session-id>" --action none --reason "Checked relevant docs; no stale claims found."
hitl validate --session "<session-id>"
hitl validate --files "<changed files>"
hitl finalize --session "<session-id>"
hitl validate --changed
```

Treat `hitl validate --files` as the pre-finalize mapping check for the known file set. Treat `hitl validate --changed` as the post-finalize check that the repo diff is covered.

If `hitl validate --session` fails, add the missing note or cleanup card and re-run validation.

If `hitl validate --changed` fails because new files are unmapped:

```bash
hitl validate --files "<changed files>"
```

If the session is still active, record the mapping gap before finalizing:

```bash
hitl note --session "<session-id>" --type open-question --title "Map new files to HITL areas" --body "Changed-file validation could not map <paths> to an existing area." --why "Future HITL validation should route these files directly." --files "<changed files>"
```

Then re-run session validation and finalize. If the session is already completed, record the gap in the handoff and create a follow-up HITL session when mapping work starts.

## CLI Unavailable Workflow

Use this only when HITL is required but the command cannot run.

1. Try the repo-local source form if this is a HITL checkout:

   ```bash
   npm install
   npm run build
   node dist/cli.js update --workspace --agents
   node dist/cli.js context --task "<task>" --files "<files>"
   ```

2. If package installation or build is blocked, create a local implementation note in the location requested by the user, with:
   - planned files
   - decisions
   - interpretations
   - deviations
   - tradeoffs
   - open questions
   - stale cleanup status

3. State clearly that HITL CLI validation was not run and why.

4. Resume the normal HITL flow as soon as the CLI is available.
