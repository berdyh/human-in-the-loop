import { readFile } from 'node:fs/promises';
import { hitlPath, exists, writeAtomic } from '../core/paths.js';

export type HitlPortRecord = {
  port: number;
  pid: number;
  started_at: string;
  url: string;
};

export type CloseHitlPortsResult = {
  closed: HitlPortRecord[];
  cleanedStale: HitlPortRecord[];
  remaining: HitlPortRecord[];
};

type Registry = { ports?: unknown };
type IsAlive = (pid: number) => boolean;
type KillPid = (pid: number) => void;
type VerifyHitlServer = (record: HitlPortRecord, root: string) => Promise<boolean>;

function registryPath(root: string): string {
  return hitlPath(root, 'runtime/ports.json');
}

function isPortRecord(value: unknown): value is HitlPortRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<HitlPortRecord>;
  return Number.isInteger(record.port)
    && Number.isInteger(record.pid)
    && typeof record.started_at === 'string'
    && typeof record.url === 'string';
}

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === 'EPERM';
  }
}

export async function readHitlPortRegistry(root: string): Promise<HitlPortRecord[]> {
  const path = registryPath(root);
  if (!(await exists(path))) return [];
  const parsed = JSON.parse(await readFile(path, 'utf8')) as Registry;
  if (!Array.isArray(parsed.ports)) throw new Error('Invalid HITL port registry: ports must be an array');
  return parsed.ports.filter(isPortRecord);
}

async function writeHitlPortRegistry(root: string, ports: HitlPortRecord[]): Promise<void> {
  await writeAtomic(registryPath(root), `${JSON.stringify({ ports }, null, 2)}\n`);
}

export async function registerHitlPort(root: string, record: HitlPortRecord, isAlive: IsAlive = isPidAlive): Promise<HitlPortRecord[]> {
  const records = await readHitlPortRegistry(root);
  const active = records.filter((existing) => isAlive(existing.pid) && existing.pid !== record.pid && existing.port !== record.port);
  const next = [...active, record];
  await writeHitlPortRegistry(root, next);
  return next;
}

export async function unregisterHitlPid(root: string, pid: number): Promise<HitlPortRecord[]> {
  const next = (await readHitlPortRegistry(root)).filter((record) => record.pid !== pid);
  await writeHitlPortRegistry(root, next);
  return next;
}

export async function cleanHitlPortRegistry(root: string, isAlive: IsAlive = isPidAlive): Promise<HitlPortRecord[]> {
  const records = await readHitlPortRegistry(root);
  const active = records.filter((record) => isAlive(record.pid));
  const stale = records.filter((record) => !isAlive(record.pid));
  await writeHitlPortRegistry(root, active);
  return stale;
}

function effectiveHttpPort(url: URL): number {
  return url.port ? Number(url.port) : 80;
}

export async function verifyRegisteredHitlServer(record: HitlPortRecord): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(record.url);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' || (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') || effectiveHttpPort(url) !== record.port) return false;
  url.pathname = '/api/status';
  url.search = '';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 500);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return false;
    const status = await response.json() as { hitl?: unknown; server_pid?: unknown; workspace?: unknown };
    return status.hitl === true && status.server_pid === record.pid && status.workspace === '.humanintheloop';
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function closeHitlPorts(
  root: string,
  input: { port?: number; isAlive?: IsAlive; killPid?: KillPid; verifyHitlServer?: VerifyHitlServer } = {}
): Promise<CloseHitlPortsResult> {
  const isAlive = input.isAlive ?? isPidAlive;
  const killPid = input.killPid ?? ((pid: number) => process.kill(pid, 'SIGTERM'));
  const verifyHitlServer = input.verifyHitlServer ?? ((record) => verifyRegisteredHitlServer(record));
  const records = await readHitlPortRegistry(root);
  const closed: HitlPortRecord[] = [];
  const cleanedStale: HitlPortRecord[] = [];
  const remaining: HitlPortRecord[] = [];

  for (const record of records) {
    const alive = isAlive(record.pid);
    const matches = input.port === undefined || record.port === input.port;
    if (!alive) {
      cleanedStale.push(record);
      continue;
    }
    if (!matches) {
      remaining.push(record);
      continue;
    }
    if (!(await verifyHitlServer(record, root))) {
      cleanedStale.push(record);
      continue;
    }
    try {
      killPid(record.pid);
      closed.push(record);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') cleanedStale.push(record);
      else throw error;
    }
  }

  await writeHitlPortRegistry(root, remaining);
  return { closed, cleanedStale, remaining };
}
