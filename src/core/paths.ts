import { access, mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';

export const HITL_DIR = '.humanintheloop';
export const CONTENT_DIR = join(HITL_DIR, 'content');
export const HISTORY_GIT_DIR = join(HITL_DIR, 'history', 'git');

export function hitlPath(root: string, ...parts: string[]): string {
  return join(root, HITL_DIR, ...parts);
}

export function contentPath(root: string, ...parts: string[]): string {
  return join(root, CONTENT_DIR, ...parts);
}

export function assertSafePathSegment(kind: string, value: string): string {
  if (!value || value === '.' || value === '..' || value.includes('/') || value.includes('\\')) {
    throw new Error(`Invalid ${kind}: ${value}`);
  }
  return value;
}

export function assertSafeContentRelativePath(kind: string, value: string): string {
  const normalized = value.replace(/\\/g, '/');
  const parts = normalized.split('/');
  if (
    !normalized
    || isAbsolute(value)
    || isAbsolute(normalized)
    || /^[A-Za-z]:/.test(value)
    || parts.some((part) => !part || part === '.' || part === '..')
  ) {
    throw new Error(`Invalid ${kind}: ${value}`);
  }
  return normalized;
}

export function safeContentPath(root: string, kind: string, relativePath: string): string {
  return contentPath(root, assertSafeContentRelativePath(kind, relativePath));
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
