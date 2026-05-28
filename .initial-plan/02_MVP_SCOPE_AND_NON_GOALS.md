# MVP Scope and Non-Goals

## Build in MVP

Build these core capabilities:

1. `hitl init`
2. `hitl serve`
3. `hitl start`
4. `hitl context`
5. `hitl note`
6. `hitl cleanup`
7. `hitl finalize`
8. `hitl validate`
9. `hitl history`
10. `hitl review`

Also build:

- internal local Git helper
- structured HTML templates
- lightweight claim index
- lightweight semantic/fuzzy routing
- basic website from one local port
- unit tests and e2e tests
- root `AGENTS.md` bootloader behavior

## Do not build in MVP

Do not build:

- full DeepWiki clone
- code graph intelligence engine
- MCP server
- remote sync
- CI/CD integration
- rich React app
- graph editor
- hosted embeddings
- external LLM/API calls
- database server
- team collaboration
- full Codex/Claude skill export

You may create placeholder directories for future adapters, but do not overbuild them.

## Over-engineering warning

If an implementation choice requires a large framework or complex subsystem, choose the simpler local deterministic alternative.

Good examples:

- Node HTTP server instead of Express if sufficient.
- Plain HTML/CSS instead of React.
- Deterministic tokenizer/scorer instead of embeddings.
- Shelling out to `git` instead of adding a heavy Git library.
- Structured card templates instead of arbitrary HTML generation.

## Correct abstraction

Wrong:

```txt
Let agents freely write docs.
```

Right:

```txt
Let agents submit structured implementation-memory cards; render and validate them as HTML.
```
