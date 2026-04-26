# Decision Extraction Spike

Goal: validate the riskiest assumption behind the human-in-the-loop reviewer.

> Can an LLM reliably enumerate the implicit decisions in a code change,
> when given the prompt that produced it?

If yes (recall > ~70% on real examples), the "decision surface" framing is
viable and we can build the product around structured extraction. If no
(recall < ~50%), structured extraction is a research problem and we should
fall back on Socratic interrogation, where the user does the enumeration
and the LLM just asks pointed questions.

## What this measures

For three (prompt, code) pairs, we ask Claude to enumerate every non-trivial
decision the code makes. We compare the output against a hand-written ground
truth list. Three different extraction strategies are tested side by side:

1. **naive** — one-paragraph instruction, no structure.
2. **structured** — categorized prompt with explicit enumeration instruction.
3. **adversarial** — structured + a second pass that asks "what did you miss?".

The output is a markdown report putting ground truth alongside each strategy
so a human can score recall and precision by eye.

## Run

```sh
bun install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
bun run extract
bun run compare
open out/report.md
```

`extract` writes `out/<case>-<strategy>.json`. `compare` reads those plus
the ground truth in `cases/` and writes `out/report.md`.

## What to look for in the report

For each case × strategy:

- **Recall**: of the N ground-truth decisions, how many did the strategy
  surface? (Count by hand from the side-by-side table.)
- **Precision**: of the M decisions the strategy surfaced, how many are
  real (in ground truth) vs hallucinated/trivial?
- **Decision-surface bucket size**: how many "NOT specified in prompt"
  decisions did it find? This is the bucket the actual product cares about.

Report your eyeballed recall/precision for each cell of the 3x3 (case x
strategy) matrix back into the design discussion.

## Cases

- `01-login.json` — Express + bcrypt + JWT login endpoint.
- `02-debounce.json` — `useDebounced` React hook.
- `03-retry.json` — async retry helper with exponential backoff.

Ground truth was hand-written. Edit them if you disagree about what
counts as a decision; that's part of the experiment.

## Interpreting the result

| Recall on real cases | Verdict |
|---|---|
| ≥ 70% across all three cases | Decision-surface framing is viable. Build it. |
| 40–70% | Marginal. Structured extraction needs work. Consider hybrid with Socratic mode. |
| < 40% | Structured extraction is unreliable. Pivot to Socratic interrogation as the primary product. |

This is one afternoon of work. The cost of running it is roughly $0.50 in
API spend (9 calls × ~3K input × claude-opus-4-7 pricing). The cost of
building the product on a wrong assumption is months.
