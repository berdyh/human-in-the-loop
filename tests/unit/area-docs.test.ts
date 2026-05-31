import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { exists } from '../../src/core/paths.js';
import { AREA_DOC_TEMPLATES, createAreaDocs, type AreaDocKind } from '../../src/docs/areaDocs.js';
import { ensureWorkspace } from '../../src/workspace/init.js';

const expected: Array<{ kind: AreaDocKind; path: string; route: string; snippets: string[] }> = [
  {
    kind: 'api-surface',
    path: '.humanintheloop/content/areas/api-surfaces/api.html',
    route: '/areas/api-surfaces/api',
    snippets: ['API Surface Mental Model', 'Endpoint / Operation Inventory', 'Request + Response Contracts', 'Error Model + Compatibility']
  },
  {
    kind: 'source-connector',
    path: '.humanintheloop/content/areas/source-ingestion/connectors.html',
    route: '/areas/source-ingestion/connectors',
    snippets: ['Connector Mental Model', 'Provider Surface + Auth', 'Sync Modes, Cursor, and Pagination', 'Normalization + Data Quality']
  },
  {
    kind: 'retrieval',
    path: '.humanintheloop/content/areas/rag/retrieval.html',
    route: '/areas/rag/retrieval',
    snippets: ['Retrieval Mental Model', 'Corpus, Chunking, and Metadata', 'Query Pipeline + Reranking', 'Evaluation Set + Metrics']
  },
  {
    kind: 'frontend-screen',
    path: '.humanintheloop/content/areas/frontend-dashboard/screens.html',
    route: '/areas/frontend-dashboard/screens',
    snippets: ['Screen Mental Model', 'User Flows + Entry Points', 'State Matrix', 'Accessibility + Interaction Notes']
  },
  {
    kind: 'user-journey',
    path: '.humanintheloop/content/areas/frontend-dashboard/journey.html',
    route: '/areas/frontend-dashboard/journey',
    snippets: ['Journey Mental Model', 'Frontend / Backend Trace', 'Connection Status Matrix', 'Persona -> trigger -> visible result']
  },
  {
    kind: 'ops-compliance',
    path: '.humanintheloop/content/areas/ops-compliance/ops.html',
    route: '/areas/ops-compliance/ops',
    snippets: ['Operational Mental Model', 'SLOs, SLIs, and Error Budgets', 'Alerts, Dashboards, and Runbooks', 'Incident Response + Escalation']
  }
];

describe('area docs scaffold', () => {
  test.each(expected)('creates $kind docs with required HITL sections', async ({ kind, path, route, snippets }) => {
    const root = await mkdtemp(join(tmpdir(), `hitl-area-docs-${kind}-`));
    const result = await createAreaDocs(root, { kind, code: ['src/example.ts'], product: ['docs/product.md'] });

    expect(result.kind).toBe(kind);
    expect(result.path).toBe(path);
    expect(result.route).toBe(route);
    expect(result.wrote).toBe(true);
    expect(result.linked).toBe(true);
    const html = await readFile(join(root, path), 'utf8');
    expect(html).toContain(`data-hitl-generated="${AREA_DOC_TEMPLATES[kind].generatedMarker}"`);
    expect(html).toContain('Last reviewed:');
    expect(html).toContain('Evidence Inventory');
    expect(html).toContain('Open Questions for Architect');
    expect(html).toContain('Known Shortcuts / Technical Debt');
    expect(html).toContain('Missing:');
    expect(html).toContain('<table>');
    expect(html).toContain('class="panel"');
    expect(html).toContain('<code>src/example.ts</code>');
    expect(html).toContain('<code>docs/product.md</code>');
    for (const snippet of snippets) expect(html).toContain(snippet);
    expect(html).not.toContain('https://');

    const areaPage = await readFile(join(root, `.humanintheloop/content/areas/${result.areaId}/page.html`), 'utf8');
    expect(areaPage).toContain(route);
    const sessionHtml = await readFile(join(root, `.humanintheloop/content/sessions/active/${result.sessionId}.html`), 'utf8');
    expect(sessionHtml).toContain(`/areas/${result.areaId}`);
  });

  test('preserves human-authored area docs and refuses forced overwrite', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-area-docs-preserve-'));
    await ensureWorkspace(root);
    const path = join(root, '.humanintheloop/content/areas/api-surfaces/api.html');
    await writeFile(path, '<!doctype html><p>Human authored API notes</p>', 'utf8');

    const result = await createAreaDocs(root, { kind: 'api-surface' });
    expect(result.wrote).toBe(false);
    await expect(readFile(path, 'utf8')).resolves.toContain('Human authored API notes');
    await expect(createAreaDocs(root, { kind: 'api-surface', force: true })).rejects.toThrow(/Refusing to overwrite human-authored/);
  });

  test('force refreshes only a matching generated area docs page', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-area-docs-force-'));
    const result = await createAreaDocs(root, { kind: 'retrieval' });
    const path = join(root, result.path);
    const original = await readFile(path, 'utf8');
    await writeFile(path, original.replace('Retrieval Mental Model', 'Locally edited generated placeholder'), 'utf8');

    await createAreaDocs(root, { kind: 'retrieval', force: true });
    const refreshed = await readFile(path, 'utf8');
    expect(refreshed).toContain('Retrieval Mental Model');
    expect(refreshed).not.toContain('Locally edited generated placeholder');
  });

  test('refuses to force refresh a different generated marker', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-area-docs-marker-'));
    await ensureWorkspace(root);
    const path = join(root, '.humanintheloop/content/areas/api-surfaces/api.html');
    await writeFile(path, '<article data-hitl-generated="source-connector"><h1>Wrong marker</h1></article>', 'utf8');

    await expect(createAreaDocs(root, { kind: 'api-surface', force: true })).rejects.toThrow(/Refusing to overwrite human-authored/);
  });

  test('preflights session inputs before writing docs or area links', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-area-docs-preflight-'));
    await ensureWorkspace(root);
    const areaPagePath = join(root, '.humanintheloop/content/areas/api-surfaces/page.html');
    const before = await readFile(areaPagePath, 'utf8');
    await writeFile(join(root, '.humanintheloop/indexes/file-area-map.json'), '{bad json', 'utf8');

    await expect(createAreaDocs(root, { kind: 'api-surface', code: ['src/routes/company.ts'] })).rejects.toThrow(/Invalid file-area-map.json/);
    await expect(exists(join(root, '.humanintheloop/content/areas/api-surfaces/api.html'))).resolves.toBe(false);
    await expect(readFile(areaPagePath, 'utf8')).resolves.toBe(before);
  });

  test('preflights area-page link insertion before writing docs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-area-docs-link-preflight-'));
    await ensureWorkspace(root);
    const areaPagePath = join(root, '.humanintheloop/content/areas/api-surfaces/page.html');
    await writeFile(areaPagePath, '<!doctype html><h1>Malformed area page</h1>', 'utf8');

    await expect(createAreaDocs(root, { kind: 'api-surface' })).rejects.toThrow(/Could not insert area docs link/);
    await expect(exists(join(root, '.humanintheloop/content/areas/api-surfaces/api.html'))).resolves.toBe(false);
    await expect(readFile(areaPagePath, 'utf8')).resolves.toContain('Malformed area page');
  });
});
