import { access, mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const HITL_DIR = '.humanintheloop';
export const CONTENT_DIR = join(HITL_DIR, 'content');
export const HISTORY_GIT_DIR = join(HITL_DIR, 'history', 'git');

export function hitlPath(root: string, ...parts: string[]): string {
  return join(root, HITL_DIR, ...parts);
}

export function contentPath(root: string, ...parts: string[]): string {
  return join(root, CONTENT_DIR, ...parts);
}

export function internalGitPath(root: string): string {
  return join(root, HISTORY_GIT_DIR);
}

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function writeAtomic(path: string, value: string): Promise<void> {
  await ensureDir(dirname(path));
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, value, 'utf8');
  await rename(temp, path);
}

export function toContentRelative(rootRelativePath: string): string {
  return rootRelativePath.replace(/^\.humanintheloop\/content\/?/, '');
}
