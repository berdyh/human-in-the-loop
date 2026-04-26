import Anthropic from "@anthropic-ai/sdk";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Case, ExtractionResult, StrategyName } from "./types.ts";
import { buildPrompt, decisionSchema } from "./prompts.ts";

const MODEL = "claude-opus-4-7";
const MAX_TOKENS = 16000;
const STRATEGIES: StrategyName[] = ["naive", "structured", "adversarial"];

const CASES_DIR = new URL("../cases/", import.meta.url).pathname;
const OUT_DIR = new URL("../out/", import.meta.url).pathname;

function loadCases(): Case[] {
  return readdirSync(CASES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(CASES_DIR, f), "utf8")) as Case);
}

interface CallResult {
  text: string;
  usage: ExtractionResult["usage"];
}

async function callClaude(client: Anthropic, prompt: string): Promise<CallResult> {
  // Cast params: SDK 0.88 typings may not yet include `output_config` and
  // `thinking: {type: "adaptive"}` shape. The wire-level fields are correct
  // per the claude-api reference for claude-opus-4-7.
  const params = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive" },
    output_config: {
      format: { type: "json_schema", schema: decisionSchema },
    },
    messages: [{ role: "user", content: prompt }],
  };
  const response = (await client.messages.create(params as never)) as Anthropic.Message;

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error(`No text block in response`);
  }
  return {
    text: textBlock.text,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? undefined,
      cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? undefined,
    },
  };
}

async function runCase(client: Anthropic, c: Case, strategy: StrategyName): Promise<ExtractionResult> {
  let firstPass: CallResult | undefined;
  let final: CallResult;

  if (strategy === "adversarial") {
    firstPass = await callClaude(client, buildPrompt("adversarial", c.prompt, c.code));
    final = await callClaude(
      client,
      buildPrompt("adversarial", c.prompt, c.code, firstPass.text),
    );
  } else {
    final = await callClaude(client, buildPrompt(strategy, c.prompt, c.code));
  }

  let parsed: { decisions: ExtractionResult["decisions"] };
  try {
    parsed = JSON.parse(final.text);
  } catch (err) {
    throw new Error(`Failed to parse JSON for ${c.id} / ${strategy}: ${(err as Error).message}\nText: ${final.text.slice(0, 500)}`);
  }

  // For adversarial, sum tokens across both calls
  const usage = firstPass
    ? {
        input_tokens: firstPass.usage!.input_tokens + final.usage!.input_tokens,
        output_tokens: firstPass.usage!.output_tokens + final.usage!.output_tokens,
      }
    : final.usage;

  return {
    case_id: c.id,
    strategy,
    model: MODEL,
    decisions: parsed.decisions,
    usage,
  };
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Set ANTHROPIC_API_KEY (e.g., copy .env.example to .env and fill it).");
    process.exit(1);
  }
  const client = new Anthropic({ apiKey });
  const cases = loadCases();
  console.log(`Loaded ${cases.length} cases × ${STRATEGIES.length} strategies = ${cases.length * STRATEGIES.length} runs.`);

  for (const c of cases) {
    for (const strategy of STRATEGIES) {
      const t0 = Date.now();
      process.stdout.write(`  ${c.id} × ${strategy}... `);
      try {
        const result = await runCase(client, c, strategy);
        const out = join(OUT_DIR, `${c.id}-${strategy}.json`);
        writeFileSync(out, JSON.stringify(result, null, 2));
        const ms = Date.now() - t0;
        const u = result.usage;
        console.log(`${result.decisions.length} decisions · ${u?.input_tokens}↑ ${u?.output_tokens}↓ tokens · ${(ms / 1000).toFixed(1)}s`);
      } catch (err) {
        console.log(`ERROR: ${(err as Error).message}`);
      }
    }
  }

  console.log("\nDone. Run `bun run compare` to build the report.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
