import { join } from 'node:path';
import { ensureDir, exists, hitlPath, contentPath, writeAtomic } from '../core/paths.js';
import { writeJsonAtomic } from '../core/json.js';
import { ensureInternalGit, internalGitCommit } from '../git/internalGit.js';
import { DEFAULT_AREAS, DEFAULT_DECISIONS, DEFAULT_TASKS, agentContextPage, areaPage, decisionPage, graphPage, projectPage, simpleIndexPage, taskPage } from '../html/templates.js';
import { writeClaimIndex } from '../claims/claimIndex.js';

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

export async function ensureWorkspace(root: string): Promise<void> {
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

  await writeJsonAtomic(hitlPath(root, 'config.json'), { version: 1, content_dir: 'content', internal_git_dir: 'history/git' });
  await writeJsonAtomic(hitlPath(root, 'manifest.json'), { product: 'Human in the Loop', cli: 'hitl', version: 1 });
  await writeAtomic(contentPath(root, 'project.html'), projectPage());
  await writeAtomic(contentPath(root, 'graph.html'), graphPage());
  await writeAtomic(contentPath(root, 'questions/index.html'), simpleIndexPage('Open Questions', 'No cross-session open questions recorded.', 'questions'));
  await writeAtomic(contentPath(root, 'stale/index.html'), simpleIndexPage('Stale Knowledge', 'No stale HITL claims recorded.', 'stale'));

  for (const area of DEFAULT_AREAS) {
    await ensureDir(contentPath(root, 'areas', area.id));
    await writeAtomic(contentPath(root, 'areas', area.id, 'page.html'), areaPage(area));
    await writeAtomic(contentPath(root, 'areas', area.id, 'agent-context.html'), agentContextPage(area.title, area.summary, { ...area, type: 'area-context' }));
    await writeAtomic(contentPath(root, 'areas', area.id, 'templates.html'), agentContextPage(`${area.title} Templates`, 'Structured note templates for this area.', { type: 'area-templates', area: area.id }));
    await writeJsonAtomic(contentPath(root, 'areas', area.id, 'metadata.json'), { ...area, type: 'area' });
  }

  for (const task of DEFAULT_TASKS) {
    await ensureDir(contentPath(root, 'tasks', task.id));
    await writeAtomic(contentPath(root, 'tasks', task.id, 'page.html'), taskPage(task));
    await writeAtomic(contentPath(root, 'tasks', task.id, 'agent-context.html'), agentContextPage(task.title, task.summary, { ...task, type: 'task-context' }));
    await writeAtomic(contentPath(root, 'tasks', task.id, 'examples.html'), agentContextPage(`${task.title} Examples`, task.semantic_examples.join('; '), { type: 'task-examples', task: task.id }));
    await writeJsonAtomic(contentPath(root, 'tasks', task.id, 'metadata.json'), { ...task, type: 'task' });
  }

  await ensureDir(contentPath(root, 'decisions'));
  for (const decision of DEFAULT_DECISIONS) {
    await writeAtomic(contentPath(root, 'decisions', `${decision.id}.html`), decisionPage(decision));
  }

  await writeJsonAtomic(hitlPath(root, 'indexes/file-area-map.json'), Object.fromEntries(DEFAULT_AREAS.map((area) => [area.id, area.path_globs])));
  await writeJsonAtomic(hitlPath(root, 'indexes/routing-index.json'), { areas: DEFAULT_AREAS, tasks: DEFAULT_TASKS });
  await writeClaimIndex(root, { claims: [] });
  await writeJsonAtomic(hitlPath(root, 'indexes/code-state-index.json'), { updated_at: new Date().toISOString(), pending_review_count: 0 });
  await writeAtomic(hitlPath(root, 'adapters/agents-md/AGENTS.md'), AGENTS_BOOTLOADER);
  if (!(await exists(join(root, 'AGENTS.md')))) {
    await writeAtomic(join(root, 'AGENTS.md'), AGENTS_BOOTLOADER);
  }

  await ensureInternalGit(root);
  await internalGitCommit(root, 'hitl init: initialize Human in the Loop workspace');
}
