import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { closeHitlPorts, registerHitlPort, verifyRegisteredHitlServer } from '../../src/site/ports.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HITL port registry', () => {
  test('does not kill an alive PID when the registered server identity does not verify', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-port-verify-'));
    await mkdir(join(root, '.humanintheloop/runtime'), { recursive: true });
    await registerHitlPort(root, {
      port: 4317,
      pid: 12345,
      started_at: '2026-05-31T00:00:00.000Z',
      url: 'http://127.0.0.1:4317'
    }, () => false);

    const killed: number[] = [];
    const result = await closeHitlPorts(root, {
      isAlive: () => true,
      killPid: (pid) => { killed.push(pid); },
      verifyHitlServer: async () => false
    });

    expect(killed).toEqual([]);
    expect(result.closed).toEqual([]);
    expect(result.cleanedStale.map((record) => record.pid)).toEqual([12345]);
    await expect(readFile(join(root, '.humanintheloop/runtime/ports.json'), 'utf8')).resolves.toContain('"ports": []');
  });

  test('verifies default HTTP port 80 registrations', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ hitl: true, server_pid: 80, workspace: '.humanintheloop' })
    })));

    await expect(verifyRegisteredHitlServer({
      port: 80,
      pid: 80,
      started_at: '2026-05-31T00:00:00.000Z',
      url: 'http://127.0.0.1:80'
    })).resolves.toBe(true);
  });
});
