import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readJson } from '../core/json.js';
import { assertSafePathSegment, contentPath, exists, hitlPath } from '../core/paths.js';
import { readClaimIndex } from '../claims/claimIndex.js';
import { readMetadata, sectionHtml } from '../html/cards.js';
import { DEFAULT_AREAS, DEFAULT_DECISIONS, DEFAULT_TASKS } from '../html/templates.js';
import { routeContext } from '../routing/router.js';

export type ValidationResult = { ok: boolean; errors: string[]; warnings: string[] };

function result(errors: string[], warnings: string[] = []): ValidationResult {
  return { ok: errors.length === 0, errors, warnings };
}

async function generatedRoutePaths(root: string): Promise<{ paths: string[]; errors: string[] }> {
  let areas = DEFAULT_AREAS.map((area) => area.id);
  let tasks = DEFAULT_TASKS.map((task) => task.id);
  const errors: string[] = [];
  const safeIds = (kind: string, values: Array<{ id?: unknown }> | undefined, fallback: string[]): string[] => {
    if (!Array.isArray(values)) return fallback;
    const ids: string[] = [];
    values.forEach((value, index) => {
      if (typeof value.id !== 'string') {
        errors.push(`Invalid routing-index ${kind}[${index}].id: expected string`);
        return;
      }
      try {
        ids.push(assertSafePathSegment(`routing-index ${kind} id`, value.id));
      } catch (error) {
        errors.push((error as Error).message);
      }
    });
    return ids;
  };
  try {
    const routingIndex = await readJson<{ areas?: Array<{ id?: unknown }>; tasks?: Array<{ id?: unknown }> }>(hitlPath(root, 'indexes/routing-index.json'));
    areas = safeIds('areas', routingIndex.areas, areas);
    tasks = safeIds('tasks', routingIndex.tasks, tasks);
  } catch {
    // validateWorkspace reports invalid routing-index JSON below; defaults keep route checks useful.
  }
  return { paths: [
    ...areas.flatMap((area) => [contentPath(root, 'areas', area, 'page.html'), contentPath(root, 'areas', area, 'agent-context.html')]),
    ...tasks.flatMap((task) => [contentPath(root, 'tasks', task, 'page.html'), contentPath(root, 'tasks', task, 'agent-context.html')]),
    ...DEFAULT_DECISIONS.map((decision) => contentPath(root, 'decisions', `${decision.id}.html`))
  ], errors };
}

async function knownAreaIds(root: string): Promise<Set<string>> {
  let areas = DEFAULT_AREAS.map((area) => area.id);
  try {
    const routingIndex = await readJson<{ areas?: Array<{ id?: unknown }> }>(hitlPath(root, 'indexes/routing-index.json'));
    if (Array.isArray(routingIndex.areas)) areas = routingIndex.areas.map((area) => area.id).filter((id): id is string => typeof id === 'string');
  } catch {
    // Missing routing metadata is reported by workspace validation; defaults are enough for uninitialized context calls.
  }
  return new Set(areas.map((area) => assertSafePathSegment('routing area id', area)));
}

export async function validateWorkspace(root: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const generatedRoutes = await generatedRoutePaths(root);
  errors.push(...generatedRoutes.errors);
  for (const path of [
    hitlPath(root),
    contentPath(root),
    hitlPath(root, 'history/git/HEAD'),
    contentPath(root, 'project.html'),
    contentPath(root, 'graph.html'),
    contentPath(root, 'questions/index.html'),
    contentPath(root, 'stale/index.html'),
    contentPath(root, 'review/index.html'),
    hitlPath(root, 'indexes/file-area-map.json'),
    hitlPath(root, 'indexes/routing-index.json'),
    hitlPath(root, 'indexes/claim-index.json'),
    ...generatedRoutes.paths
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
  if (id.includes('/') || id.includes('\\')) throw new Error(`Invalid session id: ${sessionId}`);
  for (const status of ['active', 'completed']) {
    const path = contentPath(root, `sessions/${status}/${id}.html`);
    if (await exists(path)) return path;
  }
  return null;
}

export async function validateSession(root: string, sessionId: string): Promise<ValidationResult> {
  let path: string | null;
  try {
    path = await findSessionPath(root, sessionId);
  } catch (error) {
    return result([(error as Error).message]);
  }
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

function coveredAreasFromMetadata(metadata: Record<string, unknown>): string[] {
  const areas = new Set<string>();
  if (Array.isArray(metadata.affected_areas)) {
    for (const area of metadata.affected_areas) if (typeof area === 'string') areas.add(area);
  }
  if (Array.isArray(metadata.waived_areas)) {
    for (const area of metadata.waived_areas) if (typeof area === 'string') areas.add(area);
  }
  if (Array.isArray(metadata.cards)) {
    for (const card of metadata.cards as Record<string, unknown>[]) {
      if (card.type !== 'waiver') continue;
      if (typeof card.area === 'string') areas.add(card.area);
      if (Array.isArray(card.areas)) for (const area of card.areas) if (typeof area === 'string') areas.add(area);
      if (Array.isArray(card.affected_areas)) for (const area of card.affected_areas) if (typeof area === 'string') areas.add(area);
    }
  }
  return [...areas];
}

async function coveredSessionAreas(root: string): Promise<Set<string>> {
  const covered = new Set<string>();
  for (const file of await sessionHtmlFiles(root)) {
    const metadata = readMetadata(await readFile(file, 'utf8'));
    for (const area of coveredAreasFromMetadata(metadata)) covered.add(area);
  }
  return covered;
}

function normalizeValidationPath(root: string, file: string): string {
  const normalized = file.replace(/\\/g, '/').replace(/^\.\/+/, '');
  const normalizedRoot = root.replace(/\\/g, '/').replace(/\/+$/, '');
  return normalized.startsWith(`${normalizedRoot}/`) ? normalized.slice(normalizedRoot.length + 1) : normalized;
}

function globToRegExp(glob: string): RegExp {
  let source = '^';
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    if (char === '*') {
      if (glob[index + 1] === '*') {
        source += '.*';
        index += 1;
      } else {
        source += '[^/]*';
      }
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`${source}$`);
}

function matchesFilePattern(file: string, pattern: string): boolean {
  const normalizedPattern = pattern.replace(/\\/g, '/').replace(/^\.\/+/, '');
  if (!normalizedPattern.includes('*') && !normalizedPattern.includes('?')) {
    const prefix = normalizedPattern.replace(/\/+$/, '');
    return file === prefix || file.startsWith(`${prefix}/`);
  }
  return globToRegExp(normalizedPattern).test(file);
}

export async function mappedAreasFromFileAreaMap(root: string, files: string[]): Promise<string[]> {
  let map: Record<string, unknown>;
  try {
    map = await readJson<Record<string, unknown>>(hitlPath(root, 'indexes/file-area-map.json'));
  } catch (error) {
    throw new Error(`Invalid file-area-map.json: ${(error as Error).message}`);
  }
  const knownAreas = await knownAreaIds(root);
  const normalizedFiles = files.map((file) => normalizeValidationPath(root, file));
  const areas = new Set<string>();
  for (const [area, patterns] of Object.entries(map)) {
    const safeArea = assertSafePathSegment('file-area-map area id', area);
    if (!knownAreas.has(safeArea)) throw new Error(`Unknown file-area-map area id: ${area}`);
    if (!Array.isArray(patterns) || patterns.some((pattern) => typeof pattern !== 'string')) {
      throw new Error(`Invalid file-area-map.json: ${area} must map to an array of string patterns`);
    }
    if (patterns.some((pattern) => typeof pattern === 'string' && normalizedFiles.some((file) => matchesFilePattern(file, pattern)))) {
      areas.add(safeArea);
    }
  }
  return [...areas];
}

export async function validateFiles(root: string, files: string[]): Promise<ValidationResult> {
  const workspace = await validateWorkspace(root);
  if (!workspace.ok) return workspace;
  const mappedAreas = await mappedAreasFromFileAreaMap(root, files);
  const route = routeContext({ task: files.join(' '), files });
  const requiredAreas = [...new Set([...mappedAreas, ...route.required.filter((item) => item.type === 'area').map((item) => item.id)])];
  if (!requiredAreas.length) return result([], ['No required HITL areas matched the supplied files.']);
  const coveredAreas = await coveredSessionAreas(root);
  const errors = requiredAreas.filter((area) => !coveredAreas.has(area)).map((area) => `No HITL session or waiver found for affected area: ${area}`);
  return result(errors);
}
