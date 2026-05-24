import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
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

afterEach(() => {
  server?.kill('SIGTERM');
  server = undefined;
});

describe('hitl CLI e2e', () => {
  test('clean temp directory workflow and site routes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-e2e-'));
    runHitl(root, ['init']);

    const port = 45721;
    server = spawn(process.execPath, [cli, 'serve', '--port', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolveReady) => setTimeout(resolveReady, 600));
    await expect(fetchText(`http://127.0.0.1:${port}/`)).resolves.toContain('Human in the Loop');
    await expect(fetchText(`http://127.0.0.1:${port}/graph`)).resolves.toContain('Implementation Memory Graph');
    await expect(fetchText(`http://127.0.0.1:${port}/areas/source-ingestion`)).resolves.toContain('Source Ingestion');
    await expect(fetchText(`http://127.0.0.1:${port}/areas/source-ingestion/agent-context`)).resolves.toContain('Source Ingestion Agent Context');
    await expect(fetchText(`http://127.0.0.1:${port}/tasks/add-source-connector/agent-context`)).resolves.toContain('Add Source Connector Agent Context');
    await expect(fetch(`http://127.0.0.1:${port}/api/status`).then((r) => r.json())).resolves.toMatchObject({ ok: true });

    const start = runHitl(root, ['start', '--spec', 'Add Crunchbase API ingestion for company profiles', '--task', 'connect a new provider', '--files', 'src/connectors/crunchbase.ts']);
    const sessionId = /Session:\s+(\S+)/.exec(start)?.[1];
    expect(sessionId).toBeTruthy();

    const context = runHitl(root, ['context', '--task', 'pull organization data from external provider', '--files', 'src/connectors/crunchbase.ts', '--json']);
    expect(JSON.parse(context).required.map((item: { id: string }) => item.id)).toContain('source-ingestion');

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
