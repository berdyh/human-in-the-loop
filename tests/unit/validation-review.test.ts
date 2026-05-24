import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, test } from 'vitest';
import { ensureWorkspace } from '../../src/workspace/init.js';
import { startSession, addNote, recordCleanup } from '../../src/sessions/sessionStore.js';
import { validateSession, validateWorkspace, validateFiles } from '../../src/validation/validateWorkspace.js';
import { reviewClaim } from '../../src/review/reviewClaims.js';
import { projectChangedFiles } from '../../src/git/internalGit.js';

const execFileAsync = promisify(execFile);

describe('validation and review', () => {
  test('session validation fails until every required memory section has a card or explicit none', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-validation-'));
    await ensureWorkspace(root);
    const session = await startSession(root, { spec: 'Spec', task: 'Task', files: ['src/connectors/foo.ts'] });
    await addNote(root, { sessionId: session.id, type: 'design-decision', title: 'Decision', body: 'Body' });

    const result = await validateSession(root, session.id);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('spec-interpretations');
    expect(result.errors.join('\n')).toContain('stale-cleanup');
  });

  test('workspace, changed-file validation, and review claim update work', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-review-'));
    await ensureWorkspace(root);
    const session = await startSession(root, { spec: 'Spec', task: 'connect a new provider', files: ['src/connectors/foo.ts'] });
    const note = await addNote(root, { sessionId: session.id, type: 'design-decision', title: 'Decision', body: 'Body', files: ['src/connectors/foo.ts'] });
    await recordCleanup(root, { sessionId: session.id, action: 'none', reason: 'No stale HITL claims exist.' });

    await expect(validateWorkspace(root)).resolves.toMatchObject({ ok: true });
    await expect(validateFiles(root, ['src/connectors/foo.ts'])).resolves.toMatchObject({ ok: true });

    await reviewClaim(root, { claimId: note.claimId, status: 'accepted' });
    const claimIndex = await readFile(join(root, '.humanintheloop/indexes/claim-index.json'), 'utf8');
    expect(claimIndex).toContain('accepted');
  });

  test('changed-file detection includes staged and untracked files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-changed-'));
    await execFileAsync('git', ['init'], { cwd: root });
    await mkdir(join(root, 'src/connectors'), { recursive: true });
    await mkdir(join(root, '.humanintheloop/content/areas/rag'), { recursive: true });
    await writeFile(join(root, 'src/connectors/staged.ts'), 'export const staged = true;\n', 'utf8');
    await writeFile(join(root, 'src/connectors/untracked.ts'), 'export const untracked = true;\n', 'utf8');
    await writeFile(join(root, '.humanintheloop/content/areas/rag/page.html'), '<h1>RAG</h1>\n', 'utf8');
    await execFileAsync('git', ['add', 'src/connectors/staged.ts'], { cwd: root });

    const changed = await projectChangedFiles(root);
    expect(changed).toEqual(expect.arrayContaining([
      'src/connectors/staged.ts',
      'src/connectors/untracked.ts'
    ]));
    expect(changed).not.toContain('.humanintheloop/content/areas/rag/page.html');
  });

  test('changed-file detection includes committed branch files when worktree is clean', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-committed-'));
    await execFileAsync('git', ['init'], { cwd: root });
    await execFileAsync('git', ['config', 'user.email', 'hitl@example.test'], { cwd: root });
    await execFileAsync('git', ['config', 'user.name', 'HITL Test'], { cwd: root });
    await writeFile(join(root, 'README.md'), '# fixture\n', 'utf8');
    await execFileAsync('git', ['add', 'README.md'], { cwd: root });
    await execFileAsync('git', ['commit', '-m', 'initial'], { cwd: root });
    await mkdir(join(root, 'src/connectors'), { recursive: true });
    await writeFile(join(root, 'src/connectors/committed.ts'), 'export const committed = true;\n', 'utf8');
    await execFileAsync('git', ['add', 'src/connectors/committed.ts'], { cwd: root });
    await execFileAsync('git', ['commit', '-m', 'add committed connector'], { cwd: root });

    await expect(projectChangedFiles(root)).resolves.toContain('src/connectors/committed.ts');
  });
});
