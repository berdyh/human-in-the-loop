import { escapeHtml } from './escapeHtml.js';
export { HITL_LAYOUT_VERSION, metadataScript, pageLayout } from './layout.js';
import { pageLayout } from './layout.js';

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

function panel(title: string, href: string, summary: string, tag?: string, tagClass?: string): string {
  const label = tag ? `<span class="node-tag ${escapeHtml(tagClass ?? '')}">${escapeHtml(tag)}</span>` : '';
  return `<a class="panel panel-link" href="${escapeHtml(href)}"><h3>${label}<span class="panel-title">${escapeHtml(title)}</span></h3><p>${escapeHtml(summary)}</p></a>`;
}

function listItems(ids: string[], pathPrefix: string): string {
  return ids.map((id) => `<li><a href="${pathPrefix}/${escapeHtml(id)}">${escapeHtml(id)}</a></li>`).join('') || '<li class="muted">None.</li>';
}

function taskTitle(id: string): string {
  return DEFAULT_TASKS.find((task) => task.id === id)?.title ?? id;
}

function decisionTitle(id: string): string {
  return DEFAULT_DECISIONS.find((decision) => decision.id === id)?.title ?? id;
}

function chipList(ids: string[], pathPrefix: string, labelForId: (id: string) => string, emptyText: string): string {
  if (ids.length === 0) return `<p class="muted">${escapeHtml(emptyText)}</p>`;
  return `<div class="chip-list">${ids
    .map((id) => `<a class="graph-chip" href="${pathPrefix}/${escapeHtml(id)}">${escapeHtml(labelForId(id))}</a>`)
    .join('')}</div>`;
}

function areaGraphRow(area: AreaDefinition): string {
  return `<div class="graph-row">
  <a class="graph-node" href="/areas/${escapeHtml(area.id)}">
    <span class="node-tag area-tag">Area</span>
    <span class="panel-title">${escapeHtml(area.title)}</span>
    <span class="muted">${escapeHtml(area.summary)}</span>
  </a>
  <div class="graph-links">
    <div class="graph-link-group">
      <h3>Connected tasks</h3>
      ${chipList(area.related_tasks, '/tasks', taskTitle, 'No connected tasks yet.')}
    </div>
    <div class="graph-link-group">
      <h3>Decision anchors</h3>
      ${chipList(area.related_decisions, '/decisions', decisionTitle, 'No decision anchors yet.')}
    </div>
  </div>
</div>`;
}

export function projectPage(): string {
  const cards = DEFAULT_AREAS.map((area) => panel(area.title, `/areas/${area.id}`, area.summary)).join('\n');
  return pageLayout(
    'Human in the Loop',
    `<h1>Human in the Loop</h1>
<p class="muted">Repo-local HTML-native implementation memory for coding-agent workflows.</p>
<section data-section="default-areas">
  <h2>Default Areas</h2>
  <div class="grid">${cards}</div>
</section>`,
    { type: 'project', areas: DEFAULT_AREAS.map((area) => area.id) }
  );
}

export function graphPage(): string {
  const areaRows = DEFAULT_AREAS.map((area) => areaGraphRow(area)).join('\n');
  const taskCards = DEFAULT_TASKS.map((task) => panel(task.title, `/tasks/${task.id}`, task.summary, 'Task', 'task-tag')).join('\n');
  const decisionCards = DEFAULT_DECISIONS.map((decision) =>
    panel(decision.title, `/decisions/${decision.id}`, decision.summary, 'Decision', 'decision-tag')
  ).join('\n');
  return pageLayout(
    'Implementation Memory Graph',
    `<h1>Implementation Memory Graph</h1>
<p class="muted">Areas, tasks, and decisions as grouped implementation-memory relationships.</p>
<section class="graph-section" data-section="graph-map">
  <h2>Area Relationship Map</h2>
  <div class="graph-map">${areaRows}</div>
</section>
<section class="graph-section" data-section="task-entry-points">
  <h2>Task Entry Points</h2>
  <div class="graph-mini-grid">${taskCards}</div>
</section>
<section class="graph-section" data-section="decision-anchors">
  <h2>Decision Anchors</h2>
  <div class="graph-mini-grid">${decisionCards}</div>
</section>`,
    { type: 'graph' }
  );
}

export function areaPage(area: AreaDefinition): string {
  return pageLayout(
    area.title,
    `<h1>${escapeHtml(area.title)}</h1>
<p>${escapeHtml(area.summary)}</p>
<section data-section="purpose"><h2>Purpose</h2><p>${escapeHtml(area.summary)}</p></section>
<section data-section="related-tasks"><h2>Related Tasks</h2><ul>${listItems(area.related_tasks, '/tasks')}</ul></section>
<section data-section="related-decisions"><h2>Related Decisions</h2><ul>${listItems(area.related_decisions, '/decisions')}</ul></section>
<section id="recent-memory" data-section="recent-memory"><h2>Recent implementation memory</h2><p class="muted">No finalized implementation memory yet.</p></section>
<section data-section="open-questions"><h2>Open Questions</h2><p class="muted">No open questions recorded.</p></section>
<p><a href="/areas/${escapeHtml(area.id)}/agent-context">Agent context</a></p>`,
    { ...area, type: 'area' }
  );
}

export function agentContextPage(title: string, summary: string, metadata: unknown): string {
  return pageLayout(
    `${title} Agent Context`,
    `<h1>${escapeHtml(title)} Agent Context</h1>
<p>${escapeHtml(summary)}</p>
<p class="muted">Load this page only when routing selects this context.</p>`,
    metadata
  );
}

export function taskPage(task: TaskDefinition): string {
  return pageLayout(
    task.title,
    `<h1>${escapeHtml(task.title)}</h1>
<p>${escapeHtml(task.summary)}</p>
<section data-section="when-applies"><h2>When this applies</h2><p>${escapeHtml(task.semantic_examples.join('; '))}</p></section>
<section data-section="required-areas"><h2>Required Areas</h2><ul>${listItems(task.required_areas, '/areas')}</ul></section>
<section data-section="recommended-areas"><h2>Recommended Areas</h2><ul>${listItems(task.recommended_areas, '/areas')}</ul></section>
<section data-section="required-notes"><h2>Required Notes</h2><p>Record design decisions, spec interpretations, deviations, tradeoffs, open questions, and stale cleanup.</p></section>
<p><a href="/tasks/${escapeHtml(task.id)}/agent-context">Agent context</a></p>`,
    { ...task, type: 'task' }
  );
}

export function decisionPage(decision: { id: string; title: string; summary: string }): string {
  return pageLayout(
    decision.title,
    `<h1>${escapeHtml(decision.title)}</h1>
<section data-section="decision"><p>${escapeHtml(decision.summary)}</p></section>`,
    { ...decision, type: 'decision' }
  );
}

export function simpleIndexPage(title: string, emptyText: string, type: string): string {
  return pageLayout(
    title,
    `<h1>${escapeHtml(title)}</h1>
<div class="empty-state"><p>${escapeHtml(emptyText)}</p></div>`,
    { type }
  );
}
