import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ensureDir, exists, hitlPath, contentPath, writeAtomic } from '../core/paths.js';
import { writeJsonAtomic } from '../core/json.js';
import { ensureInternalGit, internalGitCommit } from '../git/internalGit.js';
import { DEFAULT_AREAS, DEFAULT_DECISIONS, DEFAULT_TASKS, HITL_LAYOUT_VERSION, agentContextPage, areaPage, decisionPage, graphPage, projectPage, simpleIndexPage, taskPage } from '../html/templates.js';
import { readMetadata, replaceMetadata } from '../html/cards.js';
import { claimIndexPath, readClaimIndex, writeClaimIndex, writeReviewQueue } from '../claims/claimIndex.js';

const AGENTS_BOOTLOADER = `# Human in the Loop

This repository uses Human in the Loop.

Before editing code, run:

hitl context --task "<task>" --files "<planned or changed files>"

While implementing, maintain the active HITL session with:
- design decisions
- spec interpretations
- deviations
- tradeoffs
- open questions
- stale documentation cleanup

Before finishing, run:

hitl finalize --session "<session-id>"
hitl validate --changed

Do not put subsystem-specific guidance in this file. Load relevant HITL context instead.
`;

async function writeIfMissing(path: string, value: string): Promise<void> {
  if (!(await exists(path))) await writeAtomic(path, value);
}

type EnsureWorkspaceOptions = {
  refreshManaged?: boolean;
  commitMessage?: string;
};

function sectionBlocks(html: string): Map<string, string> {
  const sections = new Map<string, string>();
  for (const match of html.matchAll(/<section\b[^>]*data-section="([^"]+)"[^>]*>[\s\S]*?<\/section>/g)) {
    sections.set(match[1], match[0]);
  }
  return sections;
}

function replaceSection(html: string, sectionId: string, replacement: string): string {
  return html.replace(new RegExp(`<section\\b[^>]*data-section="${sectionId}"[^>]*>[\\s\\S]*?<\\/section>`), () => replacement);
}

function insertBeforeSection(html: string, sectionId: string, fragment: string): string {
  return html.replace(new RegExp(`(<section\\b[^>]*data-section="${sectionId}"[^>]*>)`), (match) => `${fragment}\n${match}`);
}

function contentContainer(html: string): string | null {
  return /<div class="content-container">\s*([\s\S]*?)\s*<\/div>\s*<\/main>/.exec(html)?.[1] ?? null;
}

function legacyMainContent(html: string): string | null {
  return /<main\b[^>]*>\s*([\s\S]*?)\s*<\/main>/.exec(html)?.[1] ?? null;
}

function replaceContentContainer(html: string, content: string): string {
  return html.replace(/(<div class="content-container">\s*)[\s\S]*?(\s*<\/div>\s*<\/main>)/, (_match, before, after) => `${before}${content}${after}`);
}

function preserveAreaDynamicSections(existing: string, next: string): string {
  const existingSections = sectionBlocks(existing);
  const nextSections = sectionBlocks(next);
  let merged = next;

  const recentMemory = existingSections.get('recent-memory');
  if (recentMemory && recentMemory.includes('data-hitl-card="true"')) {
    merged = replaceSection(merged, 'recent-memory', recentMemory);
  }

  const extraSections = [...existingSections.entries()]
    .filter(([sectionId]) => !nextSections.has(sectionId) && sectionId.endsWith('-notes'))
    .map(([, section]) => section)
    .join('\n');
  return extraSections ? insertBeforeSection(merged, 'recent-memory', extraSections) : merged;
}

function preserveDynamicManagedContent(existing: string, next: string, managedType: string, metadata: Record<string, unknown>): string {
  if (managedType === 'area') return preserveAreaDynamicSections(existing, next);
  if (managedType === 'stale' && typeof metadata.latest_session === 'string') {
    const content = contentContainer(existing) ?? legacyMainContent(existing);
    return content ? replaceMetadata(replaceContentContainer(next, content), metadata) : next;
  }
  return next;
}

async function writeManagedHtml(path: string, value: string, managedType: string, options: EnsureWorkspaceOptions = {}): Promise<void> {
  if (!(await exists(path))) {
    await writeAtomic(path, value);
    return;
  }
  const existing = await readFile(path, 'utf8');
  try {
    const metadata = readMetadata(existing);
    if (metadata.type === managedType && (options.refreshManaged || !existing.includes(`data-hitl-layout-version="${HITL_LAYOUT_VERSION}"`))) {
      await writeAtomic(path, preserveDynamicManagedContent(existing, value, managedType, metadata));
    }
  } catch {
    // Malformed or human-authored HTML remains untouched; validation reports bad metadata separately.
  }
}

async function writeJsonIfMissing(path: string, value: unknown): Promise<void> {
  if (!(await exists(path))) await writeJsonAtomic(path, value);
}

export async function ensureWorkspace(root: string, options: EnsureWorkspaceOptions = {}): Promise<void> {
  await ensureDir(hitlPath(root));
  await ensureDir(contentPath(root));
  await ensureDir(hitlPath(root, 'indexes'));
  await ensureDir(hitlPath(root, 'adapters/agents-md'));
  await ensureDir(hitlPath(root, 'adapters/codex-skills'));
  await ensureDir(hitlPath(root, 'adapters/claude-skills'));
  await ensureDir(hitlPath(root, 'validators'));
  await ensureDir(contentPath(root, 'sessions/active'));
  await ensureDir(contentPath(root, 'sessions/completed'));
  await ensureDir(contentPath(root, 'deltas'));
  await ensureDir(contentPath(root, 'questions'));
  await ensureDir(contentPath(root, 'stale'));
  await ensureDir(contentPath(root, 'review'));

  await writeJsonIfMissing(hitlPath(root, 'config.json'), { version: 1, content_dir: 'content', internal_git_dir: 'history/git' });
  await writeJsonIfMissing(hitlPath(root, 'manifest.json'), { product: 'Human in the Loop', cli: 'hitl', version: 1 });
  await writeManagedHtml(contentPath(root, 'project.html'), projectPage(), 'project', options);
  await writeManagedHtml(contentPath(root, 'graph.html'), graphPage(), 'graph', options);
  await writeManagedHtml(contentPath(root, 'questions/index.html'), simpleIndexPage('Open Questions', 'No cross-session open questions recorded.', 'questions'), 'questions', options);
  await writeManagedHtml(contentPath(root, 'stale/index.html'), simpleIndexPage('Stale Knowledge', 'No stale HITL claims recorded.', 'stale'), 'stale', options);

  for (const area of DEFAULT_AREAS) {
    await ensureDir(contentPath(root, 'areas', area.id));
    await writeManagedHtml(contentPath(root, 'areas', area.id, 'page.html'), areaPage(area), 'area', options);
    await writeManagedHtml(contentPath(root, 'areas', area.id, 'agent-context.html'), agentContextPage(area.title, area.summary, { ...area, type: 'area-context' }), 'area-context', options);
    await writeManagedHtml(contentPath(root, 'areas', area.id, 'templates.html'), agentContextPage(`${area.title} Templates`, 'Structured note templates for this area.', { type: 'area-templates', area: area.id }), 'area-templates', options);
    await writeJsonIfMissing(contentPath(root, 'areas', area.id, 'metadata.json'), { ...area, type: 'area' });
  }

  for (const task of DEFAULT_TASKS) {
    await ensureDir(contentPath(root, 'tasks', task.id));
    await writeManagedHtml(contentPath(root, 'tasks', task.id, 'page.html'), taskPage(task), 'task', options);
    await writeManagedHtml(contentPath(root, 'tasks', task.id, 'agent-context.html'), agentContextPage(task.title, task.summary, { ...task, type: 'task-context' }), 'task-context', options);
    await writeManagedHtml(contentPath(root, 'tasks', task.id, 'examples.html'), agentContextPage(`${task.title} Examples`, task.semantic_examples.join('; '), { type: 'task-examples', task: task.id }), 'task-examples', options);
    await writeJsonIfMissing(contentPath(root, 'tasks', task.id, 'metadata.json'), { ...task, type: 'task' });
  }

  await ensureDir(contentPath(root, 'decisions'));
  for (const decision of DEFAULT_DECISIONS) {
    await writeManagedHtml(contentPath(root, 'decisions', `${decision.id}.html`), decisionPage(decision), 'decision', options);
  }

  await writeJsonIfMissing(hitlPath(root, 'indexes/file-area-map.json'), Object.fromEntries(DEFAULT_AREAS.map((area) => [area.id, area.path_globs])));
  await writeJsonIfMissing(hitlPath(root, 'indexes/routing-index.json'), { areas: DEFAULT_AREAS, tasks: DEFAULT_TASKS });
  if (await exists(claimIndexPath(root))) {
    await writeReviewQueue(root, await readClaimIndex(root));
  } else {
    await writeClaimIndex(root, { claims: [] });
  }
  await writeJsonIfMissing(hitlPath(root, 'indexes/code-state-index.json'), { updated_at: new Date().toISOString(), pending_review_count: 0 });
  await writeIfMissing(hitlPath(root, 'adapters/agents-md/AGENTS.md'), AGENTS_BOOTLOADER);
  if (!(await exists(join(root, 'AGENTS.md')))) {
    await writeAtomic(join(root, 'AGENTS.md'), AGENTS_BOOTLOADER);
  }

  await ensureInternalGit(root);
  await internalGitCommit(root, options.commitMessage ?? 'hitl init: initialize Human in the Loop workspace');
}
