import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Case, Decision, ExtractionResult, StrategyName } from "./types.ts";

const STRATEGIES: StrategyName[] = ["naive", "structured", "adversarial"];
const CASES_DIR = new URL("../cases/", import.meta.url).pathname;
const OUT_DIR = new URL("../out/", import.meta.url).pathname;

function loadCases(): Case[] {
  return readdirSync(CASES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(CASES_DIR, f), "utf8")) as Case);
}

function loadExtraction(caseId: string, strategy: StrategyName): ExtractionResult | null {
  const path = join(OUT_DIR, `${caseId}-${strategy}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as ExtractionResult;
}

function decisionTable(decisions: Decision[]): string {
  if (decisions.length === 0) return "_(none)_\n";
  const header = "| # | Title | Category | In prompt? |\n|---|---|---|---|";
  const rows = decisions.map((d, i) =>
    `| ${i + 1} | ${escapePipe(d.title)} | ${d.category} | ${d.specified_in_prompt} |`,
  );
  return `${header}\n${rows.join("\n")}\n`;
}

function escapePipe(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function notSpecifiedCount(decisions: Decision[]): number {
  return decisions.filter((d) => d.specified_in_prompt === "no").length;
}

function buildReport(cases: Case[]): string {
  const lines: string[] = [];
  lines.push("# Decision Extraction Spike — Report");
  lines.push("");
  lines.push("For each case: hand-written ground truth on the left, extraction results from each strategy on the right. Eyeball recall and precision; this report does not auto-score.");
  lines.push("");
  lines.push("**Decision-surface bucket = entries marked `specified_in_prompt: no`.** That's the bucket the actual product cares about.");
  lines.push("");

  // Summary table
  lines.push("## Summary");
  lines.push("");
  lines.push("| Case | GT total | GT not-specified | naive total / not-spec | structured total / not-spec | adversarial total / not-spec |");
  lines.push("|---|---|---|---|---|---|");
  for (const c of cases) {
    const gtTotal = c.ground_truth.length;
    const gtNotSpec = notSpecifiedCount(c.ground_truth);
    const cells = STRATEGIES.map((s) => {
      const r = loadExtraction(c.id, s);
      if (!r) return "—";
      return `${r.decisions.length} / ${notSpecifiedCount(r.decisions)}`;
    });
    lines.push(`| \`${c.id}\` | ${gtTotal} | ${gtNotSpec} | ${cells[0]} | ${cells[1]} | ${cells[2]} |`);
  }
  lines.push("");

  // Per-case detail
  for (const c of cases) {
    lines.push("---");
    lines.push("");
    lines.push(`## \`${c.id}\` — ${c.framework}/${c.language}`);
    lines.push("");
    lines.push("### Prompt");
    lines.push("");
    lines.push("> " + c.prompt.replace(/\n/g, "\n> "));
    lines.push("");
    lines.push("### Code");
    lines.push("");
    lines.push("```" + c.language);
    lines.push(c.code.trimEnd());
    lines.push("```");
    lines.push("");
    lines.push(`### Ground truth (${c.ground_truth.length} decisions, ${notSpecifiedCount(c.ground_truth)} not specified)`);
    lines.push("");
    lines.push(decisionTable(c.ground_truth));
    lines.push("");

    for (const strategy of STRATEGIES) {
      const r = loadExtraction(c.id, strategy);
      if (!r) {
        lines.push(`### Extraction · \`${strategy}\``);
        lines.push("");
        lines.push("_No output found — run `bun run extract` first._");
        lines.push("");
        continue;
      }
      lines.push(`### Extraction · \`${strategy}\` (${r.decisions.length} decisions, ${notSpecifiedCount(r.decisions)} not specified)`);
      lines.push("");
      lines.push(decisionTable(r.decisions));
      if (r.usage) {
        lines.push(`_Tokens: ${r.usage.input_tokens}↑ ${r.usage.output_tokens}↓_`);
        lines.push("");
      }
    }
  }

  // Worksheet
  lines.push("---");
  lines.push("");
  lines.push("## Scoring worksheet");
  lines.push("");
  lines.push("Fill in by hand after reading the report. \"Hits\" = ground-truth items the strategy surfaced (with reasonable wording match). \"FPs\" = strategy items that don't correspond to a real decision (hallucinated, trivial, or duplicate).");
  lines.push("");
  lines.push("| Case | Strategy | GT total | Hits | Recall | FPs | Precision |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const c of cases) {
    for (const s of STRATEGIES) {
      lines.push(`| \`${c.id}\` | ${s} | ${c.ground_truth.length} |  |  |  |  |`);
    }
  }
  lines.push("");
  lines.push("### Verdict");
  lines.push("");
  lines.push("- Average recall across all cells: ____ %");
  lines.push("- Best strategy: ____");
  lines.push("- Decision: viable ( ≥70% ) / hybrid ( 40-70% ) / pivot to Socratic ( <40% )");
  lines.push("");

  return lines.join("\n");
}

const cases = loadCases();
const report = buildReport(cases);
const reportPath = join(OUT_DIR, "report.md");
writeFileSync(reportPath, report);
console.log(`Wrote ${reportPath}`);
