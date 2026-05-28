import { escapeHtml, safeMetadataJson } from './escapeHtml.js';

export type AreaDefinition = {
  id: string;
  title: string;
  summary: string;
  path_globs: string[];
  semantic_examples: string[];
  negative_examples: string[];
  related_tasks: string[];
  related_decisions: string[];
};

export type TaskDefinition = {
  id: string;
  title: string;
  summary: string;
  required_areas: string[];
  recommended_areas: string[];
  path_globs: string[];
  semantic_examples: string[];
  negative_examples: string[];
  related_decisions: string[];
};

export const DEFAULT_AREAS: AreaDefinition[] = [
  {
    id: 'data-spine',
    title: 'Data Spine',
    summary: 'Canonical normalized storage, schema, and durable company/profile records.',
    path_globs: ['src/db/**', 'src/models/**', 'src/schema/**', 'src/ingestion/companyNormalizer.ts'],
    semantic_examples: ['normalize provider payloads', 'canonical company schema', 'postgres storage model'],
    negative_examples: ['dashboard card styling', 'css layout'],
    related_tasks: ['add-source-connector'],
    related_decisions: ['postgres-over-lancedb', 'company-indexing-strategy']
  },
  {
    id: 'source-ingestion',
    title: 'Source Ingestion',
    summary: 'External provider connectors, source API pulls, imports, sync, and adapter behavior.',
    path_globs: ['src/connectors/**', 'src/providers/**', 'src/ingestion/**'],
    semantic_examples: ['add Crunchbase API ingestion', 'connect a new provider for company profiles', 'pull organization data from external provider'],
    negative_examples: ['change dashboard card styling', 'frontend widget layout', 'add api endpoint', 'route handler', 'public api surface'],
    related_tasks: ['add-source-connector'],
    related_decisions: ['api-source-pull-model']
  },
  {
    id: 'graph-indexing',
    title: 'Graph / Indexing',
    summary: 'Search indexes, graph construction, vectorization, embeddings, and retrieval indexes.',
    path_globs: ['src/indexing/**', 'src/graph/**', 'src/search/**'],
    semantic_examples: ['index company graph', 'update vector search', 'build retrieval graph'],
    negative_examples: ['source provider authentication'],
    related_tasks: ['modify-rag-retrieval'],
    related_decisions: ['company-indexing-strategy']
  },
  {
    id: 'rag',
    title: 'RAG',
    summary: 'Retrieval augmented generation, context selection, reranking, and answer generation.',
    path_globs: ['src/rag/**', 'src/retrieval/**', 'src/llm/**'],
    semantic_examples: ['modify rag retrieval', 'rerank retrieved context', 'answer generation'],
    negative_examples: ['dashboard styling'],
    related_tasks: ['modify-rag-retrieval'],
    related_decisions: ['company-indexing-strategy']
  },
  {
    id: 'api-surfaces',
    title: 'API Surfaces',
    summary: 'HTTP routes, controllers, handlers, public/internal API shape, and endpoint contracts.',
    path_globs: ['src/api/**', 'src/routes/**', 'src/controllers/**', 'src/handlers/**'],
    semantic_examples: ['add api endpoint', 'controller route handler', 'public api surface'],
    negative_examples: ['database schema migration only', 'api ingestion', 'provider api', 'external provider api', 'source connector'],
    related_tasks: ['add-api-surface'],
    related_decisions: []
  },
  {
    id: 'frontend-dashboard',
    title: 'Frontend Dashboard',
    summary: 'UI pages, widgets, dashboard cards, charts, and human-facing frontend screens.',
    path_globs: ['src/dashboard/**', 'src/components/**', 'src/pages/**', 'app/**'],
    semantic_examples: ['change dashboard card styling', 'update ui widget', 'chart page layout'],
    negative_examples: ['source provider ingestion connector'],
    related_tasks: [],
    related_decisions: []
  },
  {
    id: 'ops-compliance',
    title: 'Ops / Compliance',
    summary: 'Audit, retention, logging, alerts, compliance, and operational controls.',
    path_globs: ['src/ops/**', 'src/audit/**', 'src/compliance/**', 'infra/**'],
    semantic_examples: ['audit retention policy', 'compliance logging', 'ops alert'],
    negative_examples: ['dashboard CSS'],
    related_tasks: [],
    related_decisions: []
  }
];

export const DEFAULT_TASKS: TaskDefinition[] = [
  {
    id: 'add-source-connector',
    title: 'Add Source Connector',
    summary: 'Add or change an external data provider connector and normalize provider payloads.',
    required_areas: ['source-ingestion'],
    recommended_areas: ['data-spine'],
    path_globs: ['src/connectors/**', 'src/providers/**'],
    semantic_examples: ['add Crunchbase API ingestion', 'connect a new provider for company profiles', 'pull organization data from external provider'],
    negative_examples: ['dashboard card styling', 'add api endpoint', 'route handler', 'public api surface'],
    related_decisions: ['api-source-pull-model']
  },
  {
    id: 'modify-rag-retrieval',
    title: 'Modify RAG Retrieval',
    summary: 'Change retrieval, reranking, search context, or RAG answer context behavior.',
    required_areas: ['rag'],
    recommended_areas: ['graph-indexing'],
    path_globs: ['src/rag/**', 'src/retrieval/**', 'src/search/**'],
    semantic_examples: ['modify rag retrieval', 'change retrieved context', 'rerank answer context'],
    negative_examples: ['source provider connector'],
    related_decisions: ['company-indexing-strategy']
  },
  {
    id: 'add-api-surface',
    title: 'Add API Surface',
    summary: 'Add routes, controllers, endpoint handlers, or API contracts.',
    required_areas: ['api-surfaces'],
    recommended_areas: [],
    path_globs: ['src/api/**', 'src/routes/**', 'src/controllers/**'],
    semantic_examples: ['add api endpoint', 'new route handler', 'public api surface'],
    negative_examples: ['dashboard styling', 'api ingestion', 'provider api', 'external provider api', 'source connector'],
    related_decisions: []
  }
];

export const DEFAULT_DECISIONS = [
  { id: 'postgres-over-lancedb', title: 'Postgres over LanceDB', summary: 'Use Postgres as canonical durable storage in the MVP.' },
  { id: 'api-source-pull-model', title: 'API Source Pull Model', summary: 'External sources are pulled through provider adapters.' },
  { id: 'company-indexing-strategy', title: 'Company Indexing Strategy', summary: 'Normalize company records before indexing or retrieval use.' }
];

export function metadataScript(metadata: unknown): string {
  return `<script type="application/hitl+json">\n${safeMetadataJson(metadata)}\n</script>`;
}

export function pageLayout(title: string, body: string, metadata: unknown): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; --ink:#172033; --muted:#667085; --line:#d8dee9; --card:#ffffff; --wash:#f6f8fb; --accent:#0f766e; }
    body { margin:0; font-family: ui-serif, Georgia, Cambria, "Times New Roman", serif; background: radial-gradient(circle at top left, #ecfeff, transparent 28rem), var(--wash); color: var(--ink); line-height: 1.55; }
    header { border-bottom:1px solid var(--line); background:rgba(255,255,255,.88); backdrop-filter: blur(8px); padding:18px 28px; position:sticky; top:0; }
    nav { display:flex; gap:14px; flex-wrap:wrap; font-family: ui-sans-serif, system-ui, sans-serif; font-size:14px; }
    nav a { color:#0f766e; text-decoration:none; font-weight:700; }
    main { max-width:1040px; margin:34px auto; padding:0 20px 60px; }
    h1,h2,h3 { line-height:1.15; }
    h1 { font-size: clamp(2rem, 5vw, 4rem); letter-spacing:-.045em; margin:.2em 0 .35em; }
    h2 { margin-top:1.8em; }
    section, .hitl-card, .panel { background:rgba(255,255,255,.92); border:1px solid var(--line); border-radius:18px; padding:18px 20px; margin:16px 0; box-shadow:0 10px 30px rgba(23,32,51,.05); }
    .hitl-card { border-left:5px solid var(--accent); }
    .muted { color:var(--muted); }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:14px; }
    code, pre { background:#eef2f7; border-radius:8px; padding:2px 6px; }
    pre { overflow:auto; padding:14px; }
    a { color:#0f766e; }
  </style>
</head>
<body>
  <header>
    <nav>
      <a href="/">Project</a>
      <a href="/graph">Graph</a>
      <a href="/review">Review</a>
      <a href="/stale">Stale</a>
      <a href="/questions">Questions</a>
      <a href="/history">History</a>
    </nav>
  </header>
  <main>
${body}
  </main>
${metadataScript(metadata)}
</body>
</html>
`;
}

export function projectPage(): string {
  const cards = DEFAULT_AREAS.map((area) => `<div class="panel"><h3><a href="/areas/${area.id}">${escapeHtml(area.title)}</a></h3><p>${escapeHtml(area.summary)}</p></div>`).join('\n');
  return pageLayout('Human in the Loop', `<h1>Human in the Loop</h1><p class="muted">Repo-local HTML-native implementation memory for coding-agent workflows.</p><section><h2>Default Areas</h2><div class="grid">${cards}</div></section>`, { type: 'project', areas: DEFAULT_AREAS.map((a) => a.id) });
}

export function graphPage(): string {
  const nodes = [...DEFAULT_AREAS.map((a) => a.title), ...DEFAULT_TASKS.map((t) => t.title), ...DEFAULT_DECISIONS.map((d) => d.title)]
    .map((title) => `<div class="panel">${escapeHtml(title)}</div>`).join('\n');
  return pageLayout('Implementation Memory Graph', `<h1>Implementation Memory Graph</h1><p class="muted">MVP graph: areas, tasks, and decisions as navigable cards.</p><div class="grid">${nodes}</div>`, { type: 'graph' });
}

export function areaPage(area: AreaDefinition): string {
  const tasks = area.related_tasks.map((id) => `<li><a href="/tasks/${id}">${escapeHtml(id)}</a></li>`).join('') || '<li class="muted">No default task relation.</li>';
  const decisions = area.related_decisions.map((id) => `<li><a href="/decisions/${id}">${escapeHtml(id)}</a></li>`).join('') || '<li class="muted">No default decision relation.</li>';
  return pageLayout(area.title, `<h1>${escapeHtml(area.title)}</h1><p>${escapeHtml(area.summary)}</p><section data-section="purpose"><h2>Purpose</h2><p>${escapeHtml(area.summary)}</p></section><section data-section="related-tasks"><h2>Related Tasks</h2><ul>${tasks}</ul></section><section data-section="related-decisions"><h2>Related Decisions</h2><ul>${decisions}</ul></section><section id="recent-memory" data-section="recent-memory"><h2>Recent implementation memory</h2><p class="muted">No finalized implementation memory yet.</p></section><section data-section="open-questions"><h2>Open Questions</h2><p class="muted">No open questions recorded.</p></section><p><a href="/areas/${escapeHtml(area.id)}/agent-context">Agent context</a></p>`, { ...area, type: 'area' });
}

export function agentContextPage(title: string, summary: string, metadata: unknown): string {
  return pageLayout(`${title} Agent Context`, `<h1>${escapeHtml(title)} Agent Context</h1><p>${escapeHtml(summary)}</p><p class="muted">Load this page only when routing selects this context.</p>`, metadata);
}

export function taskPage(task: TaskDefinition): string {
  const required = task.required_areas.map((id) => `<li><a href="/areas/${id}">${escapeHtml(id)}</a></li>`).join('');
  const recommended = task.recommended_areas.map((id) => `<li><a href="/areas/${id}">${escapeHtml(id)}</a></li>`).join('') || '<li class="muted">None.</li>';
  return pageLayout(task.title, `<h1>${escapeHtml(task.title)}</h1><p>${escapeHtml(task.summary)}</p><section data-section="when-applies"><h2>When this applies</h2><p>${escapeHtml(task.semantic_examples.join('; '))}</p></section><section data-section="required-areas"><h2>Required Areas</h2><ul>${required}</ul></section><section data-section="recommended-areas"><h2>Recommended Areas</h2><ul>${recommended}</ul></section><section data-section="required-notes"><h2>Required Notes</h2><p>Record design decisions, spec interpretations, deviations, tradeoffs, open questions, and stale cleanup.</p></section><p><a href="/tasks/${escapeHtml(task.id)}/agent-context">Agent context</a></p>`, { ...task, type: 'task' });
}

export function decisionPage(decision: { id: string; title: string; summary: string }): string {
  return pageLayout(decision.title, `<h1>${escapeHtml(decision.title)}</h1><section data-section="decision"><p>${escapeHtml(decision.summary)}</p></section>`, { ...decision, type: 'decision' });
}

export function simpleIndexPage(title: string, emptyText: string, type: string): string {
  return pageLayout(title, `<h1>${escapeHtml(title)}</h1><section><p class="muted">${escapeHtml(emptyText)}</p></section>`, { type });
}
