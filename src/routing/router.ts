import { DEFAULT_AREAS, DEFAULT_TASKS } from '../html/templates.js';

export type ContextItem = {
  id: string;
  type: 'area' | 'task';
  path: string;
  confidence: number;
  reason: string;
};

export type RouteContextInput = {
  task: string;
  files?: string[];
};

export type RouteContextResult = {
  required: ContextItem[];
  recommended: ContextItem[];
  possible: ContextItem[];
};

const SYNONYMS: Record<string, string[]> = {
  'source-ingestion': ['source', 'provider', 'api', 'connector', 'connectors', 'ingest', 'ingestion', 'pull', 'sync', 'import', 'external', 'data', 'crunchbase', 'organization'],
  'data-spine': ['canonical', 'normalized', 'normalize', 'storage', 'postgres', 'schema', 'database', 'data', 'spine'],
  'graph-indexing': ['index', 'indexing', 'embedding', 'vector', 'graph', 'retrieval', 'search'],
  rag: ['rag', 'answer', 'context', 'retrieval', 'rerank', 'generation'],
  'api-surfaces': ['endpoint', 'route', 'api', 'surface', 'controller', 'handler'],
  'frontend-dashboard': ['dashboard', 'ui', 'widget', 'chart', 'page', 'styling', 'frontend', 'card'],
  'ops-compliance': ['audit', 'compliance', 'ops', 'logging', 'alert', 'retention'],
  'add-source-connector': ['source', 'provider', 'api', 'connector', 'connect', 'ingestion', 'external', 'company', 'profiles', 'crunchbase']
};

function tokenize(value: string): Set<string> {
  return new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 1));
}

function overlap(a: Set<string>, b: Iterable<string>): number {
  let count = 0;
  for (const token of b) if (a.has(token.toLowerCase())) count += 1;
  return count;
}

function globMatches(file: string, glob: string): boolean {
  const normalized = file.replace(/\\/g, '/');
  if (glob.endsWith('/**')) return normalized.startsWith(glob.slice(0, -3));
  if (glob.endsWith('*')) return normalized.startsWith(glob.slice(0, -1));
  return normalized === glob;
}

function scoreDefinition(input: RouteContextInput, def: { id: string; title: string; summary: string; path_globs: string[]; semantic_examples: string[]; negative_examples: string[] }, type: 'area' | 'task'): ContextItem | null {
  const taskTokens = tokenize(input.task);
  const idTokens = tokenize(`${def.id} ${def.title}`);
  const summaryTokens = tokenize(def.summary);
  let score = 0;
  const reasons: string[] = [];
  const files = input.files ?? [];
  const matchedFile = files.find((file) => def.path_globs.some((glob) => globMatches(file, glob)));
  if (matchedFile) {
    score += 0.82;
    reasons.push(`matched file path ${matchedFile}`);
  }
  const direct = overlap(taskTokens, idTokens);
  if (direct) {
    score += Math.min(0.42, direct * 0.16);
    reasons.push('matched title/id');
  }
  const synonymHits = overlap(taskTokens, SYNONYMS[def.id] ?? []);
  if (synonymHits) {
    score += Math.min(0.38, synonymHits * 0.1);
    reasons.push('matched semantic synonyms');
  }
  const summaryHits = overlap(taskTokens, summaryTokens);
  if (summaryHits) {
    score += Math.min(0.24, summaryHits * 0.06);
    reasons.push('matched summary');
  }
  const bestExample = Math.max(0, ...def.semantic_examples.map((example) => overlap(taskTokens, tokenize(example))));
  if (bestExample) {
    score += Math.min(0.6, bestExample * 0.13);
    reasons.push('matched semantic example');
  }
  const negative = Math.max(0, ...def.negative_examples.map((example) => overlap(taskTokens, tokenize(example))));
  if (negative) {
    score -= Math.min(0.55, negative * 0.18);
    reasons.push('reduced by negative example');
  }
  const confidence = Math.max(0, Math.min(0.99, Number(score.toFixed(2))));
  if (confidence < 0.12) return null;
  return {
    id: def.id,
    type,
    path: `.humanintheloop/content/${type === 'area' ? `areas/${def.id}` : `tasks/${def.id}`}/agent-context.html`,
    confidence,
    reason: reasons.join('; ') || 'low-confidence metadata overlap'
  };
}

function sortItems(items: ContextItem[]): ContextItem[] {
  return items.sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id));
}

export function routeContext(input: RouteContextInput): RouteContextResult {
  const files = input.files ?? [];
  const areaItems = DEFAULT_AREAS.map((area) => scoreDefinition({ ...input, files }, area, 'area')).filter((item): item is ContextItem => Boolean(item));
  const taskItems = DEFAULT_TASKS.map((task) => scoreDefinition({ ...input, files }, task, 'task')).filter((item): item is ContextItem => Boolean(item));

  for (const taskItem of taskItems) {
    const task = DEFAULT_TASKS.find((candidate) => candidate.id === taskItem.id);
    if (!task) continue;
    for (const areaId of task.required_areas) {
      let area = areaItems.find((item) => item.id === areaId);
      if (!area) {
        const areaDef = DEFAULT_AREAS.find((candidate) => candidate.id === areaId);
        if (areaDef) {
          area = { id: areaId, type: 'area', path: `.humanintheloop/content/areas/${areaId}/agent-context.html`, confidence: 0.64, reason: `required by task ${task.id}` };
          areaItems.push(area);
        }
      }
      if (area && taskItem.confidence >= 0.45) {
        area.confidence = Math.max(area.confidence, Math.min(0.93, taskItem.confidence + 0.12));
        area.reason = `${area.reason}; required by task ${task.id}`;
      }
    }
    for (const areaId of task.recommended_areas) {
      let area = areaItems.find((item) => item.id === areaId);
      if (!area) {
        const areaDef = DEFAULT_AREAS.find((candidate) => candidate.id === areaId);
        if (areaDef) {
          area = { id: areaId, type: 'area', path: `.humanintheloop/content/areas/${areaId}/agent-context.html`, confidence: 0.45, reason: `recommended by task ${task.id}` };
          areaItems.push(area);
        }
      }
      if (area && taskItem.confidence >= 0.45) {
        area.confidence = Math.max(area.confidence, Math.min(0.78, taskItem.confidence - 0.05));
        area.reason = `${area.reason}; recommended by task ${task.id}`;
      }
    }
  }

  const required: ContextItem[] = [];
  const recommended: ContextItem[] = [];
  const possible: ContextItem[] = [];
  for (const item of [...areaItems, ...taskItems]) {
    if (item.confidence >= 0.62 || (item.type === 'task' && item.confidence >= 0.5)) required.push(item);
    else if (item.confidence >= 0.32) recommended.push(item);
    else possible.push(item);
  }
  return { required: sortItems(required), recommended: sortItems(recommended), possible: sortItems(possible) };
}
