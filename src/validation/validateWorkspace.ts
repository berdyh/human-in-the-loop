import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readJson } from '../core/json.js';
import { contentPath, exists, hitlPath } from '../core/paths.js';
import { readClaimIndex } from '../claims/claimIndex.js';
import { sectionHtml } from '../html/cards.js';
import { routeContext } from '../routing/router.js';

export type ValidationResult = { ok: boolean; errors: string[]; warnings: string[] };

function result(errors: string[], warnings: string[] = []): ValidationResult {
  return { ok: errors.length === 0, errors, warnings };
}

export async function validateWorkspace(root: string): Promise<ValidationResult> {
  const errors: string[] = [];
  for (const path of [
    hitlPath(root),
    contentPath(root),
    hitlPath(root, 'history/git'),
    contentPath(root, 'project.html'),
    contentPath(root, 'graph.html'),
    hitlPath(root, 'indexes/file-area-map.json'),
    hitlPath(root, 'indexes/routing-index.json'),
    hitlPath(root, 'indexes/claim-index.json')
  ]) {
    if (!(await exists(path))) errors.push(`Missing required HITL path: ${path}`);
  }
  if (await exists(contentPath(root, '.git'))) errors.push('.humanintheloop/content/.git must not exist');
  for (const jsonPath of ['file-area-map.json', 'routing-index.json', 'claim-index.json', 'code-state-index.json']) {
    try {
      await readJson(join(root, '.humanintheloop/indexes', jsonPath));
    } catch (error) {
      errors.push(`Invalid JSON index ${jsonPath}: ${(error as Error).message}`);
    }
  }
  try {
    await readClaimIndex(root);
  } catch (error) {
    errors.push(`Invalid claim index: ${(error as Error).message}`);
  }
  return result(errors);
}

async function findSessionPath(root: string, sessionId: string): Promise<string | null> {
  const id = sessionId.endsWith('.html') ? sessionId.slice(0, -5) : sessionId;
  for (const status of ['active', 'completed']) {
    const path = contentPath(root, `sessions/${status}/${id}.html`);
    if (await exists(path)) return path;
  }
  return null;
}

export async function validateSession(root: string, sessionId: string): Promise<ValidationResult> {
  const path = await findSessionPath(root, sessionId);
  if (!path) return result([`Session not found: ${sessionId}`]);
  const html = await readFile(path, 'utf8');
  const errors: string[] = [];
  for (const section of ['design-decisions', 'spec-interpretations', 'deviations', 'tradeoffs', 'open-questions', 'stale-cleanup']) {
    const sectionBody = sectionHtml(html, section);
    if (sectionBody === null) errors.push(`Session missing required section: ${section}`);
    else if (!sectionBody.includes('data-hitl-card="true"')) errors.push(`Session section requires a card or explicit none card: ${section}`);
  }
  try {
    const metadata = /<script type="application\/hitl\+json">\s*([\s\S]*?)\s*<\/script>/.exec(html)?.[1];
    if (!metadata) errors.push('Session missing HITL metadata script');
    else JSON.parse(metadata);
  } catch (error) {
    errors.push(`Session metadata is invalid JSON: ${(error as Error).message}`);
  }
  return result(errors);
}

async function sessionHtmlFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  for (const status of ['active', 'completed']) {
    const dir = contentPath(root, `sessions/${status}`);
    if (!(await exists(dir))) continue;
    for (const file of await readdir(dir)) if (file.endsWith('.html')) files.push(join(dir, file));
  }
  return files;
}

export async function validateFiles(root: string, files: string[]): Promise<ValidationResult> {
  const workspace = await validateWorkspace(root);
  if (!workspace.ok) return workspace;
  const route = routeContext({ task: files.join(' '), files });
  const requiredAreas = route.required.filter((item) => item.type === 'area').map((item) => item.id);
  if (!requiredAreas.length) return result([], ['No required HITL areas matched the supplied files.']);
  const sessions = await sessionHtmlFiles(root);
  const allSessionHtml = (await Promise.all(sessions.map((file) => readFile(file, 'utf8')))).join('\n');
  const errors = requiredAreas.filter((area) => !allSessionHtml.includes(area) && !(allSessionHtml.includes('affected_areas') && allSessionHtml.includes(area))).map((area) => `No HITL session or waiver found for affected area: ${area}`);
  return result(errors);
}
