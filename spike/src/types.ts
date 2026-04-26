export type Category =
  | "defaults"
  | "error_handling"
  | "algorithm"
  | "dependencies"
  | "edge_cases"
  | "security"
  | "ux"
  | "validation";

export type Specified = "yes" | "partial" | "no";

export interface Decision {
  title: string;
  category: Category;
  specified_in_prompt: Specified;
  description: string;
  evidence?: string;
}

export interface Case {
  id: string;
  language: string;
  framework: string;
  prompt: string;
  code: string;
  ground_truth: Decision[];
}

export type StrategyName = "naive" | "structured" | "adversarial";

export interface ExtractionResult {
  case_id: string;
  strategy: StrategyName;
  model: string;
  decisions: Decision[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  raw?: unknown;
}
