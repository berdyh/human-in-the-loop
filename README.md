# Human in the Loop

Human in the Loop is a repo-local implementation memory toolkit for coding-agent workflows.

It provides a TypeScript CLI named `hitl` that creates and maintains `.humanintheloop/`
workspace docs, records implementation sessions, routes context, tracks reviewable claims,
serves a local human-facing site, exports shareable static docs, and installs matching
Codex and Claude Code skills.

The goal is to keep decisions, tradeoffs, stale-documentation cleanup, and review evidence
close to the code so future agents and humans can continue work with less context loss.
