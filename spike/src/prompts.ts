import type { StrategyName } from "./types.ts";

export const decisionSchema = {
  type: "object" as const,
  properties: {
    decisions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short summary of the decision (5-12 words)." },
          category: {
            type: "string",
            enum: [
              "defaults",
              "error_handling",
              "algorithm",
              "dependencies",
              "edge_cases",
              "security",
              "ux",
              "validation",
            ],
          },
          specified_in_prompt: {
            type: "string",
            enum: ["yes", "partial", "no"],
            description: "Whether the user prompt explicitly required this choice.",
          },
          description: { type: "string", description: "1-2 sentence explanation of what was decided and why it matters." },
          evidence: { type: "string", description: "Code snippet or line that shows the decision." },
        },
        required: ["title", "category", "specified_in_prompt", "description", "evidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["decisions"],
  additionalProperties: false,
};

const SHARED_HEADER = `You are reviewing AI-generated code. The user gave a coding agent a prompt. The agent produced the code below. Your job: enumerate every non-trivial DECISION the code makes — choices the implementer had to make that may or may not have been specified in the prompt.

A decision is anything where a different reasonable implementer might have chosen differently: defaults, library picks, error-handling shape, algorithm details, edge case behavior, validation strictness, security tradeoffs, API shape.

Mark each decision with:
- specified_in_prompt: "yes" if the prompt literally required this choice; "partial" if the prompt implied the area but not the specific choice; "no" if the prompt said nothing about it.

The "no" bucket is the most important — that's where the agent made a judgment call the user might not realize was made.`;

const STRUCTURED_GUIDANCE = `Be exhaustive. Cover at minimum these angles for the code below:

- DEFAULTS: hardcoded numbers, default option values, fallback values
- DEPENDENCIES: which library / framework was chosen, when others would work
- ERROR_HANDLING: which errors are caught, what happens, what messages are returned, what status codes
- ALGORITHM: which approach was chosen (e.g., trailing edge debounce vs leading, exponential vs linear backoff, sync vs streaming)
- EDGE_CASES: behavior on empty input, missing data, concurrent calls, cancellation, unmount, retries
- SECURITY: timing attacks, info leaks, missing rate limits, missing CSRF, missing input sanitization
- UX: response shape, error messages visible to users, loading states, latency
- VALIDATION: what is and isn't checked

Aim for 10-20 decisions per non-trivial code snippet. Trivial syntactic choices (semicolons, indentation) do not count. Library-internal defaults that the agent did not explicitly set do not count. ONLY enumerate things the agent's code actively decided.`;

const ADVERSARIAL_REVIEW = `You just produced a list of decisions. Now adversarially review your own output. For the code below, ask:

1. What did I MISS? Hardcoded magic numbers I glossed over. Default fallbacks I treated as obvious. Implicit type choices. Sequential-vs-parallel choices. Validation that's NOT present (negative space — what's missing matters as much as what's there). Status codes that have semantic meaning. Choice of which information to log or NOT log.
2. What did I DOUBLE-COUNT or repeat? Merge duplicates.
3. Anything I marked "specified_in_prompt: yes" — am I sure the prompt LITERALLY said it? If the prompt only implied the area, downgrade to "partial" or "no".

Return the FULL revised list. Add anything missed. Remove duplicates. Re-grade specified_in_prompt honestly.`;

export function buildPrompt(strategy: StrategyName, prompt: string, code: string, priorPass?: string): string {
  const intro = `USER PROMPT (what the agent was asked to build):\n<prompt>\n${prompt}\n</prompt>\n\nCODE the agent produced:\n<code>\n${code}\n</code>\n`;

  switch (strategy) {
    case "naive":
      return `${intro}\nList the implicit decisions the agent made. Return JSON matching the provided schema.`;
    case "structured":
      return `${SHARED_HEADER}\n\n${STRUCTURED_GUIDANCE}\n\n${intro}\nReturn JSON matching the provided schema.`;
    case "adversarial":
      if (!priorPass) {
        // First pass = same as structured
        return `${SHARED_HEADER}\n\n${STRUCTURED_GUIDANCE}\n\n${intro}\nReturn JSON matching the provided schema.`;
      }
      return `${SHARED_HEADER}\n\n${intro}\nYour previous extraction:\n<prior>\n${priorPass}\n</prior>\n\n${ADVERSARIAL_REVIEW}\n\nReturn the full revised list as JSON matching the provided schema.`;
  }
}
