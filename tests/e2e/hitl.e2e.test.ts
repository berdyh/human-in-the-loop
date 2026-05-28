import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

const cli = resolve('dist/cli.js');
let server: ReturnType<typeof spawn> | undefined;

function runHitl(cwd: string, args: string[]) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`hitl ${args.join(' ')} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
  return result.stdout.trim();
}

async function fetchText(url: string) {
  const response = await fetch(url);
  expect(response.status).toBe(200);
  return response.text();
}

async function fetchStatus(url: string) {
  const response = await fetch(url);
  return response.status;
}

async function reservePort(): Promise<number> {
  return await new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() => {
        if (address && typeof address === 'object') resolvePort(address.port);
        else reject(new Error('Could not reserve an e2e port'));
      });
    });
  });
}

async function waitForServer(port: number): Promise<void> {
  const deadline = Date.now() + 3000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/status`);
      if (response.ok) return;
      lastError = new Error(`Server responded with ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveReady) => setTimeout(resolveReady, 50));
  }
  throw lastError instanceof Error ? lastError : new Error('Timed out waiting for HITL server');
}

afterEach(() => {
  server?.kill('SIGTERM');
  server = undefined;
});

describe('hitl CLI e2e', () => {
  test('clean temp directory workflow and site routes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-e2e-'));
    runHitl(root, ['init']);

    const port = await reservePort();
    server = spawn(process.execPath, [cli, 'serve', '--port', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    await waitForServer(port);
    await expect(fetchText(`http://127.0.0.1:${port}/`)).resolves.toContain('Human in the Loop');
    await expect(fetchText(`http://127.0.0.1:${port}/graph`)).resolves.toContain('Implementation Memory Graph');
    await expect(fetchText(`http://127.0.0.1:${port}/areas/source-ingestion`)).resolves.toContain('Source Ingestion');
    await expect(fetchText(`http://127.0.0.1:${port}/areas/source-ingestion/agent-context`)).resolves.toContain('Source Ingestion Agent Context');
    await expect(fetchText(`http://127.0.0.1:${port}/tasks/add-source-connector/agent-context`)).resolves.toContain('Add Source Connector Agent Context');
    await expect(fetchStatus(`http://127.0.0.1:${port}/areas/source-ingestion/extra`)).resolves.toBe(404);
    await expect(fetchStatus(`http://127.0.0.1:${port}/areas/source-ingestion/agent-context/extra`)).resolves.toBe(404);
    await expect(fetch(`http://127.0.0.1:${port}/api/status`).then((r) => r.json())).resolves.toMatchObject({ ok: true });
    await mkdir(join(root, 'db/migrations'), { recursive: true });
    await mkdir(join(root, 'src/db'), { recursive: true });
    await writeFile(join(root, 'db/migrations/001_init.sql'), 'CREATE TABLE companies (id text primary key);\n', 'utf8');
    await writeFile(join(root, 'src/db/company.ts'), 'export const table = "companies";\n', 'utf8');
    const dbDocs = runHitl(root, ['db-docs', '--code', 'src/db/company.ts', '--product', '01_PRODUCT_SPEC.md']);
    const dbSessionId = /Session:\s+(\S+)/.exec(dbDocs)?.[1];
    expect(dbDocs).toContain('.humanintheloop/content/areas/data-spine/database.html');
    expect(dbDocs).toContain('/areas/data-spine/database');
    expect(dbSessionId).toBeTruthy();
    await expect(fetchText(`http://127.0.0.1:${port}/areas/data-spine/database`)).resolves.toContain('MVP DB Mental Model');
    await expect(fetchText(`http://127.0.0.1:${port}/areas/data-spine`)).resolves.toContain('/areas/data-spine/database');
    await expect(fetchStatus(`http://127.0.0.1:${port}/areas/data-spine/database/extra`)).resolves.toBe(404);
    const dbSessionContext = runHitl(root, ['context', '--session', dbSessionId!, '--json']);
    expect(JSON.parse(dbSessionContext).required.map((item: { id: string }) => item.id)).toContain('data-spine');
    expect(runHitl(root, ['history'])).toContain('hitl db-docs');

    const areaDocs = runHitl(root, ['area-docs', '--kind', 'api-surface', '--code', 'src/routes/company.ts', '--product', 'docs/api.md']);
    const areaSessionId = /Session:\s+(\S+)/.exec(areaDocs)?.[1];
    expect(areaDocs).toContain('.humanintheloop/content/areas/api-surfaces/api.html');
    expect(areaDocs).toContain('/areas/api-surfaces/api');
    expect(areaSessionId).toBeTruthy();
    await expect(fetchText(`http://127.0.0.1:${port}/areas/api-surfaces/api`)).resolves.toContain('API Surface Mental Model');
    await expect(fetchText(`http://127.0.0.1:${port}/areas/api-surfaces`)).resolves.toContain('/areas/api-surfaces/api');
    await expect(fetchStatus(`http://127.0.0.1:${port}/areas/api-surfaces/api/extra`)).resolves.toBe(404);
    await expect(fetchStatus(`http://127.0.0.1:${port}/areas/api-surfaces/unknown-template`)).resolves.toBe(404);
    const areaSessionContext = runHitl(root, ['context', '--session', areaSessionId!, '--json']);
    expect(JSON.parse(areaSessionContext).required.map((item: { id: string }) => item.id)).toContain('api-surfaces');
    expect(runHitl(root, ['history'])).toContain('hitl area-docs: api-surface');

    const start = runHitl(root, ['start', '--spec', 'Add Crunchbase API ingestion for company profiles', '--task', 'connect a new provider', '--files', 'src/connectors/crunchbase.ts']);
    const sessionId = /Session:\s+(\S+)/.exec(start)?.[1];
    expect(sessionId).toBeTruthy();

    const sessionContext = runHitl(root, ['context', '--session', sessionId!, '--task', 'minor refactor', '--json']);
    expect(JSON.parse(sessionContext).required.map((item: { id: string }) => item.id)).toContain('source-ingestion');
    const sessionOnlyContext = runHitl(root, ['context', '--session', sessionId!, '--json']);
    expect(JSON.parse(sessionOnlyContext).required.map((item: { id: string }) => item.id)).toContain('source-ingestion');
    const invalidSessionContext = spawnSync(process.execPath, [cli, 'context', '--session', 'bogus', '--json'], { cwd: root, encoding: 'utf8' });
    expect(invalidSessionContext.status).not.toBe(0);
    expect(invalidSessionContext.stderr).toContain('Session not found');

    const context = runHitl(root, ['context', '--task', 'pull organization data from external provider', '--files', 'src/connectors/crunchbase.ts', '--json']);
    expect(JSON.parse(context).required.map((item: { id: string }) => item.id)).toContain('source-ingestion');
    await writeFile(join(root, '.humanintheloop/indexes/file-area-map.json'), '{bad json', 'utf8');
    const invalidContext = spawnSync(process.execPath, [cli, 'context', '--task', 'minor refactor', '--files', 'lib/custom/foo.ts', '--json'], { cwd: root, encoding: 'utf8' });
    expect(invalidContext.status).not.toBe(0);
    expect(invalidContext.stderr).toContain('Invalid file-area-map.json');
    await writeFile(join(root, '.humanintheloop/indexes/file-area-map.json'), JSON.stringify({ 'source-ingestion': ['lib/custom/**'] }), 'utf8');
    const mappedContext = runHitl(root, ['context', '--task', 'minor refactor', '--files', 'lib/custom/foo.ts', '--json']);
    expect(JSON.parse(mappedContext).required.map((item: { id: string }) => item.id)).toContain('source-ingestion');

    for (const [type, title, body] of [
      ['design-decision', '<Normalize provider payloads>', 'Provider payloads are normalized before data-spine insertion.'],
      ['spec-interpretation', 'External source data enters through adapters', 'The spec was interpreted as provider adapter -> normalization -> storage.'],
      ['deviation', 'Raw payloads are not canonical', 'Raw provider payloads are not stored as canonical records.'],
      ['tradeoff', 'Adapter path over direct indexing', 'Direct provider-to-indexing was rejected because it couples indexing to provider schema.'],
      ['open-question', 'Raw payload retention', 'Should raw provider payloads be retained for audit/compliance?']
    ]) {
      runHitl(root, ['note', '--session', sessionId!, '--type', type, '--title', title, '--body', body]);
    }

    runHitl(root, ['cleanup', '--session', sessionId!, '--action', 'none', '--reason', 'No stale HITL claims exist in this new fixture.']);
    await expect(fetchText(`http://127.0.0.1:${port}/history`)).resolves.toContain('&lt;Normalize provider payloads&gt;');
    await expect(fetchText(`http://127.0.0.1:${port}/history`)).resolves.not.toContain('<Normalize provider payloads>');
    expect(runHitl(root, ['validate', '--session', sessionId!])).toContain('Validation passed');
    runHitl(root, ['finalize', '--session', sessionId!]);
    expect(runHitl(root, ['validate', '--files', 'src/connectors/crunchbase.ts'])).toContain('Validation passed');
    expect(runHitl(root, ['history'])).toContain('hitl finalize');

    const area = await readFile(join(root, '.humanintheloop/content/areas/source-ingestion/page.html'), 'utf8');
    expect(area).toContain('deltas/');
    const claims = await readFile(join(root, '.humanintheloop/indexes/claim-index.json'), 'utf8');
    expect(claims).toContain('pending-human-review');
  });
});
