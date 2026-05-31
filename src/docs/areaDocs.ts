import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assertSafeContentRelativePath, assertSafePathSegment, contentPath, exists, writeAtomic } from '../core/paths.js';
import { internalGitCommit } from '../git/internalGit.js';
import { escapeHtml } from '../html/escapeHtml.js';
import { pageLayout } from '../html/templates.js';
import { startSession } from '../sessions/sessionStore.js';
import { mappedAreasFromFileAreaMap } from '../validation/validateWorkspace.js';
import { ensureWorkspace } from '../workspace/init.js';

export const AREA_DOC_KINDS = ['database', 'api-surface', 'source-connector', 'retrieval', 'frontend-screen', 'user-journey', 'ops-compliance'] as const;
export type AreaDocKind = typeof AREA_DOC_KINDS[number];

export type AreaDocsInput = {
  kind: AreaDocKind | string;
  area?: string;
  evidence?: string[];
  code?: string[];
  product?: string[];
  force?: boolean;
};

export type AreaDocsResult = {
  kind: AreaDocKind;
  areaId: string;
  path: string;
  route: string;
  sessionId: string;
  wrote: boolean;
  linked: boolean;
  evidence: string[];
};

type TemplateSection = {
  id: string;
  title: string;
  body: string;
};

type AreaDocTemplate = {
  kind: AreaDocKind;
  title: string;
  summary: string;
  defaultArea: string;
  filename: string;
  routeSlug: string;
  generatedMarker: string;
  linkTitle: string;
  linkLabel: string;
  defaultEvidence: string[];
  legendTitle: string;
  legendBody: string;
  sessionSpec: string;
  sessionTask: (areaId: string) => string;
  missingQuestion: (missing: string[]) => string[];
  defaultQuestion: string[];
  sections: TemplateSection[];
};

function table(headers: string[], rows: string[][]): string {
  const head = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
  const body = rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('\n');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function cards(items: Array<[string, string]>): string {
  return `<div class="grid">${items.map(([title, body]) => `<div class="panel"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></div>`).join('\n')}</div>`;
}

function evidenceList(evidence: string[]): string {
  return evidence.map((item) => `<li><code>${escapeHtml(item)}</code></li>`).join('');
}

function flowSvg(label: string, steps: string[]): string {
  const width = 720;
  const boxWidth = 150;
  const gap = 35;
  const boxes = steps.slice(0, 4).map((step, index) => {
    const x = 28 + index * (boxWidth + gap);
    const nextX = x + boxWidth;
    const arrow = index < steps.length - 1 && index < 3
      ? `<line x1="${nextX}" y1="88" x2="${nextX + gap - 8}" y2="88" stroke="var(--accent)" stroke-width="2"/><path d="M ${nextX + gap - 8} 88 l -8 -5 v 10 z" fill="var(--accent)"/>`
      : '';
    return `<rect x="${x}" y="48" width="${boxWidth}" height="80" rx="8" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="1.5"/>
      <text x="${x + boxWidth / 2}" y="84" text-anchor="middle" font-family="var(--font-sans), sans-serif" font-size="14" font-weight="600" fill="var(--text)">${escapeHtml(step)}</text>
      <text x="${x + boxWidth / 2}" y="106" text-anchor="middle" font-family="var(--font-sans), sans-serif" font-size="11" fill="var(--text-muted)">Fill from evidence</text>
      ${arrow}`;
  }).join('\n');
  return `<svg viewBox="0 0 ${width} 180" role="img" aria-label="${escapeHtml(label)}" style="width:100%;max-width:${width}px;border:1px solid var(--border);border-radius:8px;background:var(--surface);transition:all 0.2s ease;">${boxes}</svg>`;
}

const commonDebt = table(
  ['Shortcut', 'Why acceptable now', 'Risk', 'Required fix before scaling'],
  [['Fill from evidence', 'Current reason', 'Concrete failure mode', 'Future fix']]
);

export const AREA_DOC_TEMPLATES: Record<AreaDocKind, AreaDocTemplate> = {
  database: {
    kind: 'database',
    title: 'Database Implementation Notes',
    summary: 'Human-architect notes for the MVP database. Optimize for one careful 10-minute read.',
    defaultArea: 'data-spine',
    filename: 'database.html',
    routeSlug: 'database',
    generatedMarker: 'db-docs',
    linkTitle: 'Database Notes',
    linkLabel: 'Database implementation notes',
    defaultEvidence: ['db', 'prisma', 'migrations', 'src/db/**', 'src/schema/**', 'src/models/**'],
    legendTitle: 'MVP vs Later',
    legendBody: '<span class="panel">MVP</span> captures current required behavior. <span class="panel">Later</span> marks explicitly deferred or unknown database concerns.',
    sessionSpec: 'Create human-architect database implementation notes from actual schema, migration, seed, backend-code, and product-spec evidence.',
    sessionTask: (areaId) => `Document MVP database architecture and invariants for ${areaId}`,
    missingQuestion: (missing) => ['Confirm database evidence source paths', `Missing: ${missing.join(', ')}`, 'Use --db-dir/--code/--product to point HITL at the real schema, migrations, seeds, and backend code.'],
    defaultQuestion: ['Confirm final database source of truth', 'The scaffold lists current evidence paths but does not infer schema relationships automatically.', 'Human/agent should fill this after inspecting the listed files.'],
    sections: [
      { id: 'mvp-db-mental-model', title: 'MVP DB Mental Model', body: '<ul><li>Describe the database core MVP job in 5-8 bullets after inspecting evidence.</li><li>Identify the 3-7 most important entities/tables and what each owns.</li><li>State what is intentionally not modeled yet.</li></ul>' },
      { id: 'minimal-erd', title: 'Minimal ERD / Relationship Map', body: flowSvg('MVP database relationship map placeholder', ['MVP table', 'MVP table', 'Later table']) },
      { id: 'main-data-flows', title: 'Main Data Flows', body: cards([['Creation flow', 'Step -> table(s) touched -> invariant preserved.'], ['Import/lifecycle flow', 'Step -> table(s) touched -> status transition.'], ['Session/Q&A flow', 'Step -> table(s) touched -> source of truth.'], ['Background processing flow', 'Step -> table(s) touched -> idempotency rule.']]) },
      { id: 'architectural-decisions', title: 'Architectural Decisions I Need to Know', body: table(['Decision', 'Why', 'Tradeoff', 'Revisit When'], [['Fill from evidence', 'Explain implementation consequence', 'Name the cost', 'Name the trigger']]) },
      { id: 'mvp-invariants', title: 'MVP Invariants', body: '<ul><li>Ownership boundaries</li><li>Uniqueness constraints</li><li>Lifecycle/status transitions</li><li>Deletion/cascade behavior</li><li>Source-of-truth fields</li><li>Idempotency expectations</li><li>Consistency assumptions</li></ul>' },
      { id: 'known-shortcuts', title: 'Known Shortcuts / Technical Debt', body: commonDebt },
      { id: 'migration-seed-strategy', title: 'Migration + Seed Strategy', body: '<p>Record migration organization, fresh local DB setup, seed data purpose, schema-change tests, and rollback assumptions after inspecting the evidence inventory.</p>' },
      { id: 'indexing-performance', title: 'Indexing / Performance Notes', body: table(['Index', 'Query pattern', 'Why it matters'], [['Fill only real current or clearly needed MVP indexes', 'Query supported', 'MVP correctness or latency reason']]) }
    ]
  },
  'api-surface': {
    kind: 'api-surface',
    title: 'API Surface Notes',
    summary: 'Architect-facing API contract notes for request/response behavior, compatibility, and operational boundaries.',
    defaultArea: 'api-surfaces',
    filename: 'api.html',
    routeSlug: 'api',
    generatedMarker: 'api-surface',
    linkTitle: 'API Surface Notes',
    linkLabel: 'API surface notes',
    defaultEvidence: ['openapi.yaml', 'openapi.json', 'src/api/**', 'src/routes/**', 'src/controllers/**', 'src/handlers/**'],
    legendTitle: 'Current vs Later',
    legendBody: '<span class="panel">Current</span> captures the contract the implementation must honor now. <span class="panel">Later</span> marks intentionally deferred API behavior.',
    sessionSpec: 'Create API surface notes from route handlers, OpenAPI/spec files, tests, and product requirements without inventing endpoint behavior.',
    sessionTask: (areaId) => `Document API surface contracts and review questions for ${areaId}`,
    missingQuestion: (missing) => ['Confirm API evidence source paths', `Missing: ${missing.join(', ')}`, 'Use --code/--product/--evidence to point HITL at route handlers, OpenAPI files, tests, or API specs.'],
    defaultQuestion: ['Confirm API source of truth', 'The scaffold records evidence inputs but does not infer endpoint contracts automatically.', 'Fill after inspecting handlers, OpenAPI descriptions, tests, and product specs.'],
    sections: [
      { id: 'api-surface-mental-model', title: 'API Surface Mental Model', body: cards([['Who calls it', 'Primary consumers, trust boundary, and usage frequency.'], ['What it owns', 'Resources, commands, and state transitions exposed by the API.'], ['What it refuses', 'Out-of-scope operations and unsupported compatibility promises.']]) },
      { id: 'endpoint-operation-inventory', title: 'Endpoint / Operation Inventory', body: table(['Operation', 'Consumer', 'Request evidence', 'Response evidence', 'Status'], [['Fill from evidence', 'User/system caller', 'Handler/spec/test path', 'Schema/example path', 'Current/Later']]) },
      { id: 'request-response-contracts', title: 'Request + Response Contracts', body: table(['Contract point', 'Current rule', 'Example', 'Compatibility risk'], [['Required fields', 'Fill from evidence', 'Use realistic example values', 'Breaking/compatible/unknown']]) },
      { id: 'auth-permissions-tenancy', title: 'Auth, Permissions, and Tenancy', body: table(['Operation/resource', 'Auth required', 'Tenant boundary', 'Denied behavior'], [['Fill from evidence', 'Token/session/service', 'Org/user/project/etc.', '403/404/redaction/etc.']]) },
      { id: 'error-model-compatibility', title: 'Error Model + Compatibility', body: table(['Error class', 'HTTP/status behavior', 'Body shape', 'Client action'], [['Validation', '400 or current equivalent', 'Problem/details/code', 'Fix request and retry']]) },
      { id: 'idempotency-rate-limits-pagination', title: 'Idempotency / Rate Limits / Pagination', body: table(['Concern', 'Current behavior', 'Invariant', 'Open risk'], [['Idempotency', 'Fill from evidence', 'No duplicate side effects', 'Unknown until confirmed']]) },
      { id: 'observability-audit-notes', title: 'Observability + Audit Notes', body: table(['Signal/event', 'Where emitted', 'Correlation id', 'Retention/audit purpose'], [['Fill from evidence', 'Log/metric/trace/audit event', 'Request/session/id', 'Debug/compliance/security']]) },
      { id: 'known-shortcuts', title: 'Known Shortcuts / Technical Debt', body: commonDebt }
    ]
  },
  'source-connector': {
    kind: 'source-connector',
    title: 'Source Connector Notes',
    summary: 'Provider ingestion notes for auth, streams, sync behavior, normalization, and provider-change risk.',
    defaultArea: 'source-ingestion',
    filename: 'connectors.html',
    routeSlug: 'connectors',
    generatedMarker: 'source-connector',
    linkTitle: 'Connector Notes',
    linkLabel: 'Source connector notes',
    defaultEvidence: ['src/connectors/**', 'src/providers/**', 'src/ingestion/**', 'docs/connectors/**'],
    legendTitle: 'Current vs Later',
    legendBody: '<span class="panel">Current</span> captures provider behavior needed for the next reliable sync. <span class="panel">Later</span> marks deferred streams, fields, or resilience work.',
    sessionSpec: 'Create source connector notes from provider docs, connector code, ingestion tests, and product requirements without inventing upstream behavior.',
    sessionTask: (areaId) => `Document source connector assumptions and review questions for ${areaId}`,
    missingQuestion: (missing) => ['Confirm connector evidence source paths', `Missing: ${missing.join(', ')}`, 'Use --code/--product/--evidence to point HITL at connector code, provider docs, sample payloads, and ingestion tests.'],
    defaultQuestion: ['Confirm provider source of truth', 'The scaffold records evidence inputs but does not infer upstream API behavior automatically.', 'Fill after inspecting connector code, provider docs, payload samples, and sync tests.'],
    sections: [
      { id: 'connector-mental-model', title: 'Connector Mental Model', body: cards([['Provider role', 'What external system is trusted for which data.'], ['Sync shape', 'Full refresh, incremental, webhook, or hybrid.'], ['Data boundary', 'What becomes canonical and what remains provider-specific.']]) },
      { id: 'provider-surface-auth', title: 'Provider Surface + Auth', body: table(['Provider/API', 'Credential type', 'Scope', 'Rotation/expiry risk'], [['Fill from evidence', 'API key/OAuth/session/etc.', 'Read/write permissions', 'Refresh/reconnect plan']]) },
      { id: 'stream-object-inventory', title: 'Stream / Object Inventory', body: table(['Stream/object', 'Primary key', 'Cursor/update field', 'Destination owner'], [['Fill from evidence', 'Provider id or composite key', 'updated_at or equivalent', 'Data-spine table/model']]) },
      { id: 'sync-modes-cursor-pagination', title: 'Sync Modes, Cursor, and Pagination', body: table(['Mode', 'Cursor/window', 'Pagination', 'Late/duplicate handling'], [['Incremental/full/current', 'Field and format', 'Token/page/offset', 'Idempotent merge rule']]) },
      { id: 'normalization-data-quality', title: 'Normalization + Data Quality', body: table(['Raw field', 'Canonical field', 'Validation/default', 'Lossy transform risk'], [['Fill from evidence', 'Destination field', 'Required/optional/fallback', 'What data can be lost']]) },
      { id: 'retry-rate-limit-idempotency', title: 'Retry, Rate Limit, and Idempotency', body: table(['Failure/rate limit', 'Current handling', 'Retry boundary', 'Duplication risk'], [['429/5xx/network', 'Backoff/schedule/manual', 'Per request/page/sync', 'How duplicates are prevented']]) },
      { id: 'breaking-changes-versioning', title: 'Breaking Changes + Versioning', body: table(['Provider change', 'Detection signal', 'Compatibility action', 'Owner'], [['Field removed/renamed', 'Test/log/schema diff', 'Adapter migration/fallback', 'Team/person']]) },
      { id: 'known-shortcuts', title: 'Known Shortcuts / Technical Debt', body: commonDebt }
    ]
  },
  retrieval: {
    kind: 'retrieval',
    title: 'Retrieval Notes',
    summary: 'RAG and retrieval notes for corpus shape, indexing, query behavior, grounding, and evaluation.',
    defaultArea: 'rag',
    filename: 'retrieval.html',
    routeSlug: 'retrieval',
    generatedMarker: 'retrieval',
    linkTitle: 'Retrieval Notes',
    linkLabel: 'Retrieval and RAG notes',
    defaultEvidence: ['src/rag/**', 'src/retrieval/**', 'src/search/**', 'src/indexing/**', 'evals/**', 'docs/rag/**'],
    legendTitle: 'Current vs Later',
    legendBody: '<span class="panel">Current</span> captures retrieval behavior required for trusted answers now. <span class="panel">Later</span> marks deferred ranking, corpus, or evaluation improvements.',
    sessionSpec: 'Create retrieval notes from corpus/indexing code, RAG pipeline code, eval sets, traces, and product requirements without inventing retrieval quality claims.',
    sessionTask: (areaId) => `Document retrieval assumptions and evaluation gaps for ${areaId}`,
    missingQuestion: (missing) => ['Confirm retrieval evidence source paths', `Missing: ${missing.join(', ')}`, 'Use --code/--product/--evidence to point HITL at RAG code, index builders, eval sets, traces, and product specs.'],
    defaultQuestion: ['Confirm retrieval quality source of truth', 'The scaffold records evidence inputs but does not infer corpus or model behavior automatically.', 'Fill after inspecting retrieval code, chunking/index config, eval datasets, traces, and product constraints.'],
    sections: [
      { id: 'retrieval-mental-model', title: 'Retrieval Mental Model', body: cards([['User question path', 'How a query becomes retrieval input.'], ['Evidence boundary', 'Which sources can ground an answer.'], ['Answer boundary', 'What the model must refuse or caveat.']]) },
      { id: 'corpus-chunking-metadata', title: 'Corpus, Chunking, and Metadata', body: table(['Corpus/source', 'Chunking rule', 'Metadata', 'Freshness owner'], [['Fill from evidence', 'Size/window/semantic rule', 'Tenant/source/date/etc.', 'Job/team/process']]) },
      { id: 'index-embedding-configuration', title: 'Index / Embedding Configuration', body: table(['Index', 'Embedding/model', 'Similarity/filtering', 'Rebuild trigger'], [['Fill from evidence', 'Model/version/dimensions', 'Vector/hybrid/filter fields', 'Schema/model/corpus change']]) },
      { id: 'query-pipeline-reranking', title: 'Query Pipeline + Reranking', body: table(['Stage', 'Input', 'Output', 'Decision rule'], [['Rewrite/retrieve/rerank/filter', 'Query/context', 'Candidates/context', 'Threshold/top-k/reranker']]) },
      { id: 'grounding-citations-answer-boundaries', title: 'Grounding, Citations, and Answer Boundaries', body: table(['Claim type', 'Required evidence', 'Citation behavior', 'Refusal/caveat rule'], [['Factual answer', 'Retrieved supporting chunk', 'Source/id/page', 'If evidence missing, say so']]) },
      { id: 'evaluation-set-metrics', title: 'Evaluation Set + Metrics', body: table(['Eval slice', 'Metric', 'Pass threshold', 'Regression owner'], [['Golden queries', 'Context precision/recall/faithfulness/relevancy', 'Fill from evidence', 'Team/person']]) },
      { id: 'failure-modes-regression-cases', title: 'Failure Modes + Regression Cases', body: table(['Failure mode', 'Example query', 'Detection signal', 'Mitigation'], [['Hallucination/irrelevant retrieval/stale corpus', 'Real or synthetic query', 'Metric/trace/user report', 'Prompt/index/corpus fix']]) },
      { id: 'known-shortcuts', title: 'Known Shortcuts / Technical Debt', body: commonDebt }
    ]
  },
  'frontend-screen': {
    kind: 'frontend-screen',
    title: 'Frontend Screen Notes',
    summary: 'Human-facing screen notes for flows, state coverage, permissions, accessibility, and responsive behavior.',
    defaultArea: 'frontend-dashboard',
    filename: 'screens.html',
    routeSlug: 'screens',
    generatedMarker: 'frontend-screen',
    linkTitle: 'Screen Notes',
    linkLabel: 'Frontend screen notes',
    defaultEvidence: ['src/dashboard/**', 'src/components/**', 'src/pages/**', 'app/**', 'design/**', 'docs/product/**'],
    legendTitle: 'Current vs Later',
    legendBody: '<span class="panel">Current</span> captures screen behavior needed for the active workflow. <span class="panel">Later</span> marks deferred states, variants, or polish.',
    sessionSpec: 'Create frontend screen notes from UI code, product specs, screenshots/designs, accessibility checks, and analytics requirements without inventing UX behavior.',
    sessionTask: (areaId) => `Document frontend screen behavior and state gaps for ${areaId}`,
    missingQuestion: (missing) => ['Confirm frontend evidence source paths', `Missing: ${missing.join(', ')}`, 'Use --code/--product/--evidence to point HITL at UI code, product specs, screenshots, designs, and accessibility notes.'],
    defaultQuestion: ['Confirm screen source of truth', 'The scaffold records evidence inputs but does not infer actual UI behavior automatically.', 'Fill after inspecting UI code, product specs, screenshots, design artifacts, and state tests.'],
    sections: [
      { id: 'screen-mental-model', title: 'Screen Mental Model', body: cards([['Primary job', 'What user decision/action this screen supports.'], ['Audience', 'Roles, permissions, and frequency of use.'], ['Success signal', 'What proves the workflow completed correctly.']]) },
      { id: 'user-flows-entry-points', title: 'User Flows + Entry Points', body: table(['Flow', 'Entry point', 'Primary action', 'Exit/next screen'], [['Fill from evidence', 'Nav/deeplink/modal/etc.', 'Command or decision', 'Destination/result']]) },
      { id: 'state-matrix', title: 'State Matrix', body: table(['State', 'Trigger', 'UI behavior', 'User recovery'], [['Loading/empty/error/success/permission denied', 'Data or action condition', 'Visible behavior', 'Retry/request access/change input']]) },
      { id: 'data-dependencies-permissions', title: 'Data Dependencies + Permissions', body: table(['Data/API', 'Needed for', 'Permission boundary', 'Fallback'], [['Fill from evidence', 'Component/flow', 'Role/tenant/scope', 'Empty/error/redacted state']]) },
      { id: 'accessibility-interaction-notes', title: 'Accessibility + Interaction Notes', body: table(['Concern', 'Current expectation', 'Evidence/test', 'Risk'], [['Keyboard/focus/status message/label/error', 'Fill from evidence', 'Manual/automated/test path', 'Blocked user/error ambiguity']]) },
      { id: 'responsive-layout-visual-decisions', title: 'Responsive Layout + Visual Decisions', body: table(['Viewport/context', 'Layout rule', 'Critical content', 'Known compromise'], [['Mobile/tablet/desktop', 'Grid/stack/sidebar/etc.', 'What must remain visible', 'Deferred polish or edge case']]) },
      { id: 'analytics-observability', title: 'Analytics + Observability', body: table(['Event/signal', 'When emitted', 'Payload boundary', 'Decision supported'], [['Fill from evidence', 'View/action/error', 'No PII unless justified', 'Product/ops question']]) },
      { id: 'known-shortcuts', title: 'Known Shortcuts / Technical Debt', body: commonDebt }
    ]
  },
  'user-journey': {
    kind: 'user-journey',
    title: 'User Journey Trace Notes',
    summary: 'Domain-neutral trace notes for persona -> trigger -> backend workflow -> persistence -> visible result.',
    defaultArea: 'frontend-dashboard',
    filename: 'journey.html',
    routeSlug: 'journey',
    generatedMarker: 'user-journey',
    linkTitle: 'User Journey Trace Notes',
    linkLabel: 'User journey trace notes',
    defaultEvidence: ['src/app/**', 'app/**', 'src/pages/**', 'src/components/**', 'src/routes/**', 'src/api/**', 'src/services/**', 'src/jobs/**', 'db/**', 'prisma/**', 'tests/e2e/**', 'docs/product/**'],
    legendTitle: 'Trace Shape',
    legendBody: '<span class="panel">Persona -> trigger -> visible result</span> expands to first valuable outcome -> frontend trigger -> backend workflow -> sequential capabilities -> persistence -> visible result. <span class="panel">Unknown</span> is acceptable until evidence confirms the connection.',
    sessionSpec: 'Create domain-neutral user journey trace notes from UI, backend, service/job, database, test, and product evidence without inventing behavior.',
    sessionTask: (areaId) => `Document user journey trace evidence and gaps for ${areaId}`,
    missingQuestion: (missing) => ['Confirm journey evidence source paths', `Missing: ${missing.join(', ')}`, 'Use --code/--product/--evidence to point HITL at UI, backend, service/job, database, test, and product evidence.'],
    defaultQuestion: ['Confirm journey source of truth', 'The scaffold records evidence inputs but does not infer user-flow behavior automatically.', 'Fill after inspecting UI, backend, service/job, database, test, and product evidence.'],
    sections: [
      { id: 'journey-mental-model', title: 'Journey Mental Model', body: cards([['Persona', 'Who is trying to make progress and what context they bring.'], ['First valuable outcome', 'The first visible result that proves the workflow mattered.'], ['Success signal', 'UI, data, or operational evidence that confirms completion.']]) },
      { id: 'entry-auth-context', title: 'Entry + Auth Context', body: table(['Entry Point', 'Auth / Session Behavior', 'Permission Boundary', 'Evidence', 'Gap'], [['Fill from evidence', 'Session/token/service identity behavior', 'Role, tenant, org, project, or public boundary', 'Route/component/middleware/test path', 'Unknown until confirmed']]) },
      { id: 'primary-user-action', title: 'Primary User Action', body: table(['Action', 'User Intent', 'UI Trigger', 'Validation / Guardrail', 'Next System Step'], [['First meaningful action', 'Persona-specific goal', 'Button/form/nav/shortcut/event handler', 'Client or server check', 'Route/API/job/service handoff']]) },
      { id: 'frontend-backend-trace', title: 'Frontend / Backend Trace', body: table(['Journey Step', 'User Intent', 'Frontend Evidence', 'Backend Evidence', 'DB Evidence', 'Capability / Service', 'Connection Status', 'Gap'], [['Fill from evidence', 'Persona-specific goal', 'Component, route, hook, event handler', 'Route, controller, service, job', 'Table/model/query or No DB touch', 'Tool/service/capability or None', 'Connected / Partial / Not Connected / Unknown', 'Missing handoff, ownership check, persistence, result path, etc.']]) },
      { id: 'capability-sequence', title: 'Capability Sequence', body: flowSvg('Persona -> trigger -> visible result trace placeholder', ['Persona', 'Frontend trigger', 'Backend workflow', 'Visible result']) },
      { id: 'persistence-map', title: 'Persistence Map', body: table(['Read / Write', 'Table / Model / Query', 'Ownership Field', 'Lifecycle State', 'Evidence', 'Gap'], [['Fill from evidence', 'Table/model/query or No DB touch', 'user_id/org_id/project_id/etc.', 'created/queued/running/done/error/etc.', 'Code/test/schema path', 'Unknown ownership or state transition']]) },
      { id: 'result-return-path', title: 'Result Return Path', body: table(['Return Mechanism', 'Trigger', 'Payload / State', 'Render Evidence', 'Failure / Empty Behavior'], [['Fetch, polling, subscription, redirect, or server render', 'User action, job completion, cache invalidation, or route load', 'DTO/model/view state', 'Component/hook/route/test path', 'Retry, stale view, empty state, or error state']]) },
      { id: 'connection-status-matrix', title: 'Connection Status Matrix', body: table(['Status', 'Meaning', 'Required Evidence', 'Action'], [['Connected', 'Frontend, backend, persistence, and result path are all evidenced', 'UI + API/service + DB/result evidence', 'Keep as current behavior'], ['Partial', 'At least one handoff is evidenced but another is missing', 'Known path plus missing link', 'Record gap and owner'], ['Not Connected', 'Expected handoff has no implementation evidence', 'Negative search or missing source', 'Do not claim behavior works'], ['Unknown', 'Evidence has not been inspected yet', 'Pending code/spec/test path', 'Inspect before filling claims']]) },
      { id: 'known-shortcuts', title: 'Known Shortcuts / Technical Debt', body: commonDebt }
    ]
  },
  'ops-compliance': {
    kind: 'ops-compliance',
    title: 'Ops / Compliance Notes',
    summary: 'Operational and compliance notes for reliability, telemetry, audit, access, retention, and incident response.',
    defaultArea: 'ops-compliance',
    filename: 'ops.html',
    routeSlug: 'ops',
    generatedMarker: 'ops-compliance',
    linkTitle: 'Ops / Compliance Notes',
    linkLabel: 'Ops and compliance notes',
    defaultEvidence: ['src/ops/**', 'src/audit/**', 'src/compliance/**', 'infra/**', 'runbooks/**', 'docs/ops/**'],
    legendTitle: 'Current vs Later',
    legendBody: '<span class="panel">Current</span> captures controls needed to operate and review the MVP. <span class="panel">Later</span> marks deferred hardening or compliance work.',
    sessionSpec: 'Create ops and compliance notes from runbooks, infra, audit/logging code, alerting config, and policy requirements without inventing control coverage.',
    sessionTask: (areaId) => `Document operational controls and compliance gaps for ${areaId}`,
    missingQuestion: (missing) => ['Confirm ops/compliance evidence source paths', `Missing: ${missing.join(', ')}`, 'Use --code/--product/--evidence to point HITL at infra, runbooks, telemetry, audit code, and policy specs.'],
    defaultQuestion: ['Confirm ops/compliance source of truth', 'The scaffold records evidence inputs but does not infer control coverage automatically.', 'Fill after inspecting infra, runbooks, alert rules, audit events, and compliance requirements.'],
    sections: [
      { id: 'operational-mental-model', title: 'Operational Mental Model', body: cards([['Service boundary', 'What system/component is operated.'], ['Primary failure', 'What user-visible or compliance failure matters most.'], ['Owner', 'Who responds and who approves policy changes.']]) },
      { id: 'slos-slis-error-budgets', title: 'SLOs, SLIs, and Error Budgets', body: table(['Journey/service', 'SLI', 'SLO/error budget', 'Decision rule'], [['Fill from evidence', 'Availability/latency/correctness/etc.', 'Target/window', 'Page/ticket/defer release']]) },
      { id: 'alerts-dashboards-runbooks', title: 'Alerts, Dashboards, and Runbooks', body: table(['Alert/dashboard', 'Signal', 'Runbook link/path', 'Actionability'], [['Fill from evidence', 'Metric/log/trace', 'Runbook or missing runbook', 'Page/ticket/noise risk']]) },
      { id: 'telemetry-audit-events', title: 'Telemetry + Audit Events', body: table(['Event/signal', 'Attributes', 'Retention', 'Consumer'], [['Fill from evidence', 'Trace/log/metric/audit fields', 'Policy/window', 'Ops/security/compliance/product']]) },
      { id: 'access-retention-compliance-boundaries', title: 'Access, Retention, and Compliance Boundaries', body: table(['Control', 'Current rule', 'Evidence', 'Gap/risk'], [['Access/PII/retention/export/delete', 'Fill from evidence', 'Code/policy/config/test', 'Unknown/deferred/control owner']]) },
      { id: 'incident-response-escalation', title: 'Incident Response + Escalation', body: table(['Incident class', 'Detection', 'First action', 'Escalation'], [['Fill from evidence', 'Alert/customer/security report', 'Runbook step', 'Owner/channel/timebox']]) },
      { id: 'backup-recovery-degraded-mode', title: 'Backup / Recovery / Degraded Mode', body: table(['Failure/recovery need', 'Current capability', 'RTO/RPO or limit', 'Test evidence'], [['Fill from evidence', 'Backup/restore/fallback/manual procedure', 'Target or unknown', 'Drill/test/log path']]) },
      { id: 'known-shortcuts', title: 'Known Shortcuts / Technical Debt', body: commonDebt }
    ]
  }
};

export const AREA_DOC_ROUTE_SLUGS = AREA_DOC_KINDS.map((kind) => AREA_DOC_TEMPLATES[kind].routeSlug);

export function areaDocFileForRouteSlug(slug: string): string | null {
  return Object.values(AREA_DOC_TEMPLATES).find((template) => template.routeSlug === slug)?.filename ?? null;
}

function assertAreaDocKind(value: string): AreaDocKind {
  if ((AREA_DOC_KINDS as readonly string[]).includes(value)) return value as AreaDocKind;
  throw new Error(`Invalid area docs kind: ${value}. Expected one of: ${AREA_DOC_KINDS.join(', ')}`);
}

function rootRelativeAreaDocPath(areaId: string, filename: string): string {
  return `.humanintheloop/content/areas/${areaId}/${filename}`;
}

function areaDocRoute(areaId: string, routeSlug: string): string {
  return `/areas/${areaId}/${routeSlug}`;
}

function evidencePath(value: string): string {
  const cleaned = value.trim().replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '');
  return assertSafeContentRelativePath('area docs evidence path', cleaned);
}

function normalizeEvidence(values: string[]): string[] {
  return [...new Set(values.filter(Boolean).map(evidencePath))];
}

function isGlob(value: string): boolean {
  return value.includes('*') || value.includes('?');
}

async function missingEvidence(root: string, evidence: string[]): Promise<string[]> {
  const missing: string[] = [];
  for (const candidate of evidence) {
    if (!isGlob(candidate) && !(await exists(join(root, candidate)))) missing.push(candidate);
  }
  return missing;
}

function sectionBlock(section: TemplateSection): string {
  return `<section data-section="${escapeHtml(section.id)}"><h2>${escapeHtml(section.title)}</h2>${section.body}</section>`;
}

async function preflightSessionInputs(root: string, evidence: string[], areaId: string): Promise<void> {
  await mappedAreasFromFileAreaMap(root, evidence);
  assertSafePathSegment('forced affected area id', areaId);
}

function areaDocsHtml(input: { template: AreaDocTemplate; areaId: string; evidence: string[]; missing: string[]; reviewedAt: string }): string {
  const question = input.missing.length ? input.template.missingQuestion(input.missing) : input.template.defaultQuestion;
  const sections = input.template.sections.map(sectionBlock).join('\n');
  return pageLayout(
    input.template.title,
    `<article data-hitl-generated="${escapeHtml(input.template.generatedMarker)}">
  <h1>${escapeHtml(input.template.title)}</h1>
  <p class="muted">${escapeHtml(input.template.summary)}</p>
  <p><strong>Last reviewed:</strong> <time datetime="${escapeHtml(input.reviewedAt)}">${escapeHtml(input.reviewedAt)}</time></p>
  <section data-section="legend"><h2>${escapeHtml(input.template.legendTitle)}</h2><p>${input.template.legendBody}</p></section>
  ${sections}
  <section data-section="evidence-inventory"><h2>Evidence Inventory</h2><ul>${evidenceList(input.evidence)}</ul></section>
  <section data-section="open-questions"><h2>Open Questions for Architect</h2>${table(['Question', 'Why it matters', 'Suggested default'], [question])}</section>
</article>`,
    {
      type: 'area-docs',
      kind: input.template.kind,
      area: input.areaId,
      generated_by: input.template.generatedMarker,
      reviewed_at: input.reviewedAt,
      evidence: input.evidence,
      missing_evidence: input.missing
    }
  );
}

async function ensureAreaPageExists(root: string, areaId: string): Promise<void> {
  const areaPage = contentPath(root, 'areas', areaId, 'page.html');
  if (!(await exists(areaPage))) throw new Error(`Area page not found: areas/${areaId}/page.html`);
}

async function areaDocPageUpdate(root: string, areaId: string, template: AreaDocTemplate): Promise<{ path: string; html: string } | null> {
  const areaPage = contentPath(root, 'areas', areaId, 'page.html');
  const html = await readFile(areaPage, 'utf8');
  const route = areaDocRoute(areaId, template.routeSlug);
  if (html.includes(route)) return null;
  const linkSection = `<section data-section="${escapeHtml(template.routeSlug)}-notes"><h2>${escapeHtml(template.linkTitle)}</h2><p><a href="${escapeHtml(route)}">${escapeHtml(template.linkLabel)}</a></p></section>`;
  const updated = html.includes('<section id="recent-memory"')
    ? html.replace('<section id="recent-memory"', () => `${linkSection}\n<section id="recent-memory"`)
    : html.replace('</main>', () => `${linkSection}\n  </main>`);
  if (updated === html) throw new Error(`Could not insert area docs link into areas/${areaId}/page.html`);
  return { path: areaPage, html: updated };
}

function assertCanOverwrite(existing: string, template: AreaDocTemplate): void {
  const marker = `data-hitl-generated="${template.generatedMarker}"`;
  if (!existing.includes(marker)) {
    throw new Error(`Refusing to overwrite human-authored ${template.title}; remove the file manually or keep it as the source of truth.`);
  }
}

export async function createAreaDocs(root: string, input: AreaDocsInput): Promise<AreaDocsResult> {
  await ensureWorkspace(root);
  const kind = assertAreaDocKind(input.kind);
  const template = AREA_DOC_TEMPLATES[kind];
  const areaId = assertSafePathSegment('area docs area id', input.area ?? template.defaultArea);
  await ensureAreaPageExists(root, areaId);
  const evidence = normalizeEvidence([...(input.evidence ?? []), ...template.defaultEvidence, ...(input.code ?? []), ...(input.product ?? [])]);
  await preflightSessionInputs(root, evidence, areaId);
  const missing = await missingEvidence(root, evidence);
  const outputPath = contentPath(root, 'areas', areaId, template.filename);
  const pendingAreaPageUpdate = await areaDocPageUpdate(root, areaId, template);
  let wrote = false;
  if (await exists(outputPath)) {
    const existing = await readFile(outputPath, 'utf8');
    if (input.force) {
      assertCanOverwrite(existing, template);
      await writeAtomic(outputPath, areaDocsHtml({ template, areaId, evidence, missing, reviewedAt: new Date().toISOString() }));
      wrote = true;
    }
  } else {
    await writeAtomic(outputPath, areaDocsHtml({ template, areaId, evidence, missing, reviewedAt: new Date().toISOString() }));
    wrote = true;
  }
  const linked = Boolean(pendingAreaPageUpdate);
  if (pendingAreaPageUpdate) await writeAtomic(pendingAreaPageUpdate.path, pendingAreaPageUpdate.html);
  if (wrote || linked) {
    const commitMessage = kind === 'database' ? `hitl db-docs: ${areaId}` : `hitl area-docs: ${kind} ${areaId}`;
    await internalGitCommit(root, commitMessage);
  }
  const session = await startSession(root, {
    spec: template.sessionSpec,
    task: template.sessionTask(areaId),
    files: evidence,
    forcedAreas: [areaId]
  });
  return {
    kind,
    areaId,
    path: rootRelativeAreaDocPath(areaId, template.filename),
    route: areaDocRoute(areaId, template.routeSlug),
    sessionId: session.id,
    wrote,
    linked,
    evidence
  };
}
