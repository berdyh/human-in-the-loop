---
name: hitl
description: Use repo-local Human in the Loop implementation memory with the `hitl` CLI. Use when a repository has AGENTS.md or project guidance requiring HITL, when working with `.humanintheloop/`, when starting or finishing implementation work that should preserve design decisions, spec interpretations, deviations, tradeoffs, open questions, stale-documentation cleanup, or review-state history, and when adopting HITL in an existing codebase or MVP-stage repo.
---

# HITL

Use this skill to keep implementation memory current while coding with the `hitl` CLI. HITL is not a replacement for tests, commits, or normal docs. It is the repo-local record of decisions and context that future agents and humans need.

## Start Every HITL-Managed Task

1. Inspect repo instructions before edits, especially `AGENTS.md`, `CLAUDE.md`, and local docs such as `docs.local/`.
2. Confirm the CLI command form for the repo:
   - Installed package: use `hitl`.
   - HITL source checkout: run `npm install` and `npm run build` if needed, then use `node dist/cli.js`.
3. For mutable implementation work, run `hitl update --workspace --agents` once from the project root before `context`. This refreshes managed `.humanintheloop/` structure/design files and updates the bundled Codex/Claude Code skill for future sessions. Skip this only for explicitly read-only work.
4. Run `hitl context --task "<task>" --files "<planned files>"` before editing source.
5. Run `hitl start --spec "<spec>" --task "<task>" --files "<planned files>"` when implementation will change files, interpret a spec, or create decisions.
6. Preserve the returned session id. Use it for every `note`, `cleanup`, `validate --session`, and `finalize` call.
7. Read required routed context before editing. Read recommended context when it plausibly affects the work.

## During Implementation

Add notes as decisions happen, not as cleanup at the end:

```bash
hitl note \
  --session "<session-id>" \
  --type design-decision \
  --title "<short title>" \
  --body "<what was decided or interpreted>" \
  --why "<why this is the right tradeoff>" \
  --files "<affected files>"
```

Use the specific note type that matches the event: `design-decision`, `spec-interpretation`, `deviation`, `tradeoff`, or `open-question`.

Record stale-doc cleanup before finishing:

```bash
hitl cleanup --session "<session-id>" --action none --reason "Checked relevant docs; no stale claims found."
```

If stale information exists, use `remove`, `supersede`, `needs-review`, or `keep-with-warning` instead of `none`.

## Human Docs Output Style

When creating or updating HITL human-facing HTML docs, prefer visual evidence structures over long prose:

- Use tables for inventories, matrices, contracts, risks, and evidence maps.
- Use cards for small sets of choices, states, personas, invariants, and tradeoffs.
- Use SVG or simple HTML flow diagrams for journeys, lifecycle traces, architecture handoffs, and result paths.
- Keep text short, plain-English, and explanatory. A useful caption plus a table or diagram is better than several paragraphs.
- Mark unknowns explicitly. Do not infer behavior that was not confirmed from code, specs, tests, runtime output, or human input.

## Finish Every Session

1. Run `hitl validate --session "<session-id>"`.
2. Fix missing required sections by adding the right `note` or `cleanup` entry.
3. Run `hitl validate --files "<changed files>"` for the known changed file set, especially when adding new paths. If it reports unmapped files and the mapping should exist, add an `open-question` note before finalizing.
4. Run `hitl finalize --session "<session-id>"`.
5. Run `hitl validate --changed`.
6. If changed-file validation still cannot map new files after finalizing, record the gap in the handoff and create a follow-up HITL session when mapping work starts.

## References

- Read [CLI Command Guide](references/cli-command-guide.md) when you need exact syntax, command timing, command outputs, or failure handling for every current `hitl` command.
- Read [Implementation Workflows](references/implementation-workflows.md) when adopting HITL in an existing codebase, using it during MVP-stage development, delegating to subagents, or recovering when the CLI is unavailable.

## Guardrails

- Do not dump broad docs into the prompt. Use `hitl context` and read only routed context.
- Do not put subsystem-specific guidance into root `AGENTS.md`; root instructions should stay a small HITL bootloader.
- Do not run `hitl update --workspace` during a read-only review unless the user explicitly allows workspace mutations.
- Do not use `hitl install-agents` or `hitl update --agents` with guessed custom directories. Use defaults or explicit user-provided `--codex-dir` / `--claude-dir` paths.
- Do not add decorative visuals to HITL docs. Every table, card, SVG, or interactive control should clarify evidence, status, sequence, ownership, or a decision.
- Do not finalize before stale cleanup is recorded, even when the correct cleanup is explicit `none`.
- Do not try to add `hitl note` cards to a completed session; record final mapping gaps before finalizing or create a follow-up session.
- Do not run mutating HITL commands in parallel. Commands such as `update`, `start`, `note`, `cleanup`, `finalize`, `review`, `db-docs`, and `area-docs` update shared HITL content and internal Git history.
- Do not claim HITL validation passed unless the relevant command exited successfully in the current workspace.
- Do not commit local-only `docs.local/` or `.humanintheloop/` content unless the user explicitly asks.
