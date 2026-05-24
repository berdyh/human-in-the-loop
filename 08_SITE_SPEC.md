# Human Website Spec

`hitl serve` should expose one local website, not scattered files.

Default port:

```txt
4317
```

## Minimum routes

```txt
/                       project overview
/graph                  graph page
/areas/:id              area page
/tasks/:id              task page
/decisions/:id          decision page
/sessions/active/:id    active session
/sessions/completed/:id completed session
/deltas/:id             delta page
/questions              questions index
/stale                  stale index
/review                 review queue
/history                HITL internal Git history
/api/status             JSON status
```

## Style

Simple but polished.

Use static HTML/CSS.

No heavy frontend framework.

The site should feel like a single platform:

- common header/nav
- links to areas
- links to tasks
- links to decisions
- active session list
- completed delta list
- review queue
- stale cleanup index

## Graph page

MVP graph can be simple:

- cards or inline SVG
- area nodes
- task nodes
- decision links
- no graph editor required

## Area page purpose

Each area page should teach humans:

- what this area does
- why it exists
- key decisions
- related tasks
- related decisions
- recent implementation memory
- open questions
- agent context link

## Task page purpose

Task pages are readable by humans but optimized for agent workflow:

- when this task applies
- required areas
- recommended areas
- required notes
- validators/checks
- examples
