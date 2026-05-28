# Human in the Loop

This repository uses Human in the Loop.

Before editing code, run:

hitl context --task "<task>" --files "<planned or changed files>"

While implementing, maintain the active HITL session with:
- design decisions
- spec interpretations
- deviations
- tradeoffs
- open questions
- stale documentation cleanup

Before finishing, run:

hitl finalize --session "<session-id>"
hitl validate --changed

Do not put subsystem-specific guidance in this file. Load relevant HITL context instead.
