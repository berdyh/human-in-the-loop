# CLI Command Guide

Use `hitl` when the package is installed in the target repo. In a HITL source checkout, build first and use `node dist/cli.js` from the repository root.

All current CLI commands operate on `process.cwd()`. Run them from the intended project or worktree root. File list options are split on whitespace and commas, so avoid paths or globs containing spaces.

Run mutating HITL commands sequentially. `init`, `update --workspace`, `start`, `note`, `cleanup`, `finalize`, `review`, `db-docs`, and `area-docs` write shared HITL content and internal Git history. `install-agents` and `update --agents` write local agent skill directories.

## Command Form

```bash
# installed package
hitl <command> [options]

# source checkout fallback
node dist/cli.js <command> [options]
```

Run every command from the project root unless repo instructions say otherwise.

## `hitl init`

Run when a repo is adopting HITL and `.humanintheloop/` does not exist.

```bash
hitl init
```

Preserve: generated `.humanintheloop/` workspace and any tiny root `AGENTS.md` bootloader it creates. If root `AGENTS.md` already exists, the CLI should not overwrite it.

Caveats:
- If the command is missing, install/build HITL first.
- If `.humanintheloop/` already exists, do not reinitialize unless the user explicitly wants a reset or refresh.
- Treat `init` as mutating; do not run it during read-only review unless the user asked to adopt HITL.

## `hitl update`

Run at the start of mutable HITL work, or after upgrading the CLI/skill/design.

```bash
hitl update --workspace --agents
```

Useful options:

```bash
hitl update --workspace
hitl update --agents --target codex
hitl update --agents --target claude
hitl update --agents --codex-dir "$HOME/.codex/skills" --claude-dir "$HOME/.claude/skills"
```

Effects:
- `--workspace` refreshes managed `.humanintheloop/` structure and design files using the current CLI templates. It preserves human-authored files that are not HITL-managed.
- `--agents` installs or updates the bundled HITL skill for Codex and/or Claude Code.

Caveats:
- Treat `update` as mutating. Do not run it during read-only review unless the user allows edits.
- `--workspace` is the explicit call to bring existing `.humanintheloop` files forward after structure or design changes.
- `--agents` writes to local agent skill directories; use defaults or explicit paths.

## `hitl install-agents`

Run when installing only the bundled HITL skill for future Codex or Claude Code sessions.

```bash
hitl install-agents --target all
```

Useful options:

```bash
hitl install-agents --target codex
hitl install-agents --target claude
hitl install-agents --codex-dir "$HOME/.codex/skills"
hitl install-agents --claude-dir "$HOME/.claude/skills"
```

Preserve: printed install/update paths.

Caveats:
- This updates the skill files only; it does not refresh `.humanintheloop/` workspace HTML. Use `hitl update --workspace` for that.
- The command overwrites the installed `hitl` skill folder with the bundled version from the current package.

## `hitl context`

Run before editing and again when the task scope or file list changes.

```bash
hitl context \
  --task "pull organization data from an external provider" \
  --files "src/connectors/crunchbase.ts"
```

Useful options:

```bash
hitl context --session "<session-id>"
hitl context --task "<task>" --files "<files>" --json
```

Preserve: required and recommended context paths. Read required items before editing.

Caveats:
- If it returns only low-confidence possible matches, proceed with normal repo discovery and record missing routing as an open question if it affects the work.
- If called with no task, files, or session, the CLI errors.
- `--session`, `--task`, and `--files` can be combined. The CLI merges session metadata with explicit task/files.

## `hitl start`

Run when implementation starts changing files or making decisions.

```bash
hitl start \
  --spec "Add Crunchbase API ingestion for company profiles" \
  --task "add external source ingestion" \
  --files "src/connectors/crunchbase.ts src/ingestion/companyNormalizer.ts"
```

Preserve: session id, session file path, affected areas, required sections, and the recommended context command.

Caveats:
- Use one active session for one coherent implementation thread.
- If scope expands materially, run `hitl context` again with the new files and add a note explaining the scope change.
- Treat `start` as mutating; it creates session content and internal HITL history.

## `hitl note`

Run during implementation whenever a durable decision, interpretation, deviation, tradeoff, or open question appears.

```bash
hitl note \
  --session "<session-id>" \
  --type design-decision \
  --title "Normalize provider payloads before data-spine insertion" \
  --body "The spec requires pulling company data from an external API but does not specify whether provider fields should become canonical." \
  --why "This keeps provider-specific fields from leaking into indexing and RAG." \
  --files "src/connectors/crunchbase.ts src/ingestion/companyNormalizer.ts"
```

Supported `--type` values:

- `design-decision`
- `spec-interpretation`
- `deviation`
- `tradeoff`
- `open-question`

Preserve: claim id and card path printed by the command.

Caveats:
- Prefer several precise notes over one broad summary note.
- Do not invent a decision after the fact when the real event is an open question.
- The current commander layer does not constrain `--type`; unsupported types fail deeper in the session store.
- Do not run multiple `hitl note` commands in parallel.

## `hitl cleanup`

Run before final validation to document stale-doc handling.

```bash
hitl cleanup \
  --session "<session-id>" \
  --action none \
  --reason "Checked relevant context and found no stale claims."
```

Use `--old-claim` when superseding or reviewing a specific claim:

```bash
hitl cleanup \
  --session "<session-id>" \
  --old-claim "Provider fields may be indexed directly" \
  --action supersede \
  --reason "New source ingestion path requires normalization before indexing."
```

Supported actions:

- `remove`
- `supersede`
- `needs-review`
- `keep-with-warning`
- `none`

Caveats:
- Finalization validation requires stale cleanup or explicit `none`.
- Use `none` only after actually checking relevant context.
- Non-`none` cleanup actions require `--old-claim`.

## `hitl finalize`

Run only after session validation passes and the implementation thread is ready to close.

```bash
hitl finalize --session "<session-id>"
```

Preserve: completed session path and delta path.

Caveats:
- Finalize moves the session from active to completed and creates review/delta artifacts.
- Do not blindly copy session text into area pages; let the CLI produce the linked delta/review artifacts.

## `hitl validate`

Run at three points: before finalizing the session, after finalizing changed work, and when checking specific files.

```bash
hitl validate --session "<session-id>"
hitl validate --changed
hitl validate --files "src/connectors/crunchbase.ts src/ingestion/companyNormalizer.ts"
```

Preserve: errors and warnings. Fix errors before claiming validation passed.

Caveats:
- `--changed` needs a Git repo and uses the project diff.
- New paths may need area mapping before `--changed` can prove coverage. Use `--files` as a fallback and record the mapping gap.
- If multiple validation options are passed, the current CLI checks `--session` first, then `--files`, then `--changed`, then workspace validation. Use one validation target per command.

## `hitl serve`

Run when the user wants to inspect the local HITL website.

```bash
hitl serve --port 4317
```

Expected URL:

```txt
http://127.0.0.1:4317
```

Caveats:
- If the port is busy, choose another port and report the exact URL.
- Stop long-running servers when they are no longer needed unless the user asked to keep them running.
- Port values are converted with `Number()`. Use a plain numeric port.

## `hitl expose` and `hitl close`

Use `expose` when the user wants a background HITL site and `close` when the server should be cleaned up.

```bash
hitl expose --port 4317
hitl close --port 4317
hitl close
```

Effects:
- `expose` starts a detached local server and records it in `.humanintheloop/runtime/ports.json`.
- `close --port` closes a matching registered server or removes a stale record.
- `close` without `--port` closes all registered HITL servers.

Caveats:
- `close` only acts on HITL-registered PIDs. It does not scan and kill arbitrary host processes.
- If a port was started with plain `serve` and not `serve --register` or `expose`, `close` will not know about it.

## `hitl history`

Run when reviewing HITL internal history or tracing changes to a page.

```bash
hitl history
hitl history --page areas/source-ingestion/page.html
```

Preserve: relevant commit messages or page history entries.

Caveats:
- This is HITL's internal content history, not the project Git history.

## `hitl review`

Run when a human or agent is updating claim review state.

```bash
hitl review --claim "<claim-id>" --status accepted
hitl review --claim "<claim-id>" --status rejected
hitl review --claim "<claim-id>" --status needs-review
hitl review --claim "<claim-id>" --status superseded --superseded-by "<claim-id>"
```

Preserve: updated claim status.

Caveats:
- Use `superseded` only when there is a replacement claim id.
- Do not mark claims accepted without evidence from the code, tests, or human review.

## `hitl db-docs`

Run when creating HITL-native database documentation from schema, migration, seed, backend, or product evidence.

```bash
hitl db-docs \
  --area data-spine \
  --db-dir db \
  --code "src/server src/db" \
  --product "docs/product.md"
```

Useful option:

```bash
hitl db-docs --force
```

Preserve: database notes path, route, session id, and status.

Caveats:
- Use `--force` only when intentionally refreshing a HITL-generated scaffold.
- Inspect evidence before treating the generated scaffold as true.
- This command is mutating and was added after the original MVP command spec. Do not run it during read-only review.

## `hitl area-docs`

Run when creating HITL-native area documentation for a non-database area.

```bash
hitl area-docs \
  --kind api-surface \
  --area api-surfaces \
  --evidence "docs/api.md" \
  --code "src/routes"
```

Useful option:

```bash
hitl area-docs --kind api-surface --force
hitl area-docs --kind user-journey --area frontend-dashboard
```

Preserve: area notes path, kind, route, session id, and status.

Caveats:
- The current CLI lists valid kinds in the command help.
- Use this to scaffold reviewable docs, not to bypass normal implementation notes.
- Current non-database kinds are `api-surface`, `source-connector`, `retrieval`, `frontend-screen`, `user-journey`, and `ops-compliance`; use `db-docs` for database notes.
- `user-journey` writes `.humanintheloop/content/areas/<area>/journey.html` and serves it at `/areas/<area>/journey`.
- Area docs should be visual-first when useful: prefer tables, cards, status matrices, and SVG/HTML flow traces over long prose, while keeping captions concise and evidence-based.
- This command is mutating and was added after the original MVP command spec. Do not run it during read-only review.
