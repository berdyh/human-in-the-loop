import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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
    const sessionHtml = await readFile(join(root, session.path), 'utf8');
    const sessionMetadata = JSON.parse(/<script type="application\/hitl\+json">\s*([\s\S]*?)\s*<\/script>/.exec(sessionHtml)![1]);
    expect(claimIndex).toContain('accepted');
    expect(sessionMetadata.cards.find((card: { id: string }) => card.id === note.claimId)).toMatchObject({ status: 'accepted' });
  });

  test('workspace validation fails when required route pages or internal git head are missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-workspace-missing-'));
    await ensureWorkspace(root);
    await rm(join(root, '.humanintheloop/content/review/index.html'));
    await rm(join(root, '.humanintheloop/history/git/HEAD'));

    const validation = await validateWorkspace(root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.join('\n')).toContain('review/index.html');
    expect(validation.errors.join('\n')).toContain('history/git/HEAD');
  });

  test('workspace validation fails when generated route pages are missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-generated-route-missing-'));
    await ensureWorkspace(root);
    await rm(join(root, '.humanintheloop/content/areas/source-ingestion/page.html'));
    await rm(join(root, '.humanintheloop/content/tasks/add-source-connector/page.html'));
    await rm(join(root, '.humanintheloop/content/decisions/api-source-pull-model.html'));

    const validation = await validateWorkspace(root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.join('\n')).toContain('areas/source-ingestion/page.html');
    expect(validation.errors.join('\n')).toContain('tasks/add-source-connector/page.html');
    expect(validation.errors.join('\n')).toContain('decisions/api-source-pull-model.html');
  });

  test('workspace validation rejects malformed routing-index ids', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-bad-routing-index-'));
    await ensureWorkspace(root);
    await writeFile(
      join(root, '.humanintheloop/indexes/routing-index.json'),
      JSON.stringify({ areas: [{ id: '../evil' }], tasks: [{ id: 'bad/task' }] }),
      'utf8'
    );

    const validation = await validateWorkspace(root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.join('\n')).toContain('Invalid routing-index areas id');
    expect(validation.errors.join('\n')).toContain('Invalid routing-index tasks id');
  });

  test('file validation uses session metadata areas instead of raw note text', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-area-metadata-'));
    await ensureWorkspace(root);
    const session = await startSession(root, { spec: 'Spec', task: 'connect a new provider', files: ['src/connectors/foo.ts'] });
    await addNote(root, { sessionId: session.id, type: 'design-decision', title: 'Mention another area', body: 'This note mentions data-spine but does not cover it.' });

    const validation = await validateFiles(root, ['src/db/model.ts']);
    expect(validation.ok).toBe(false);
    expect(validation.errors.join('\n')).toContain('data-spine');
  });

  test('file validation honors persisted file-area-map entries', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-file-map-'));
    await ensureWorkspace(root);
    await writeFile(
      join(root, '.humanintheloop/indexes/file-area-map.json'),
      JSON.stringify({ 'source-ingestion': ['lib/custom/**'] }),
      'utf8'
    );

    const validation = await validateFiles(root, [join(root, 'lib/custom/foo.ts')]);
    expect(validation.ok).toBe(false);
    expect(validation.errors.join('\n')).toContain('source-ingestion');
  });

  test('start session uses persisted file-area-map entries for affected areas', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-start-file-map-'));
    await ensureWorkspace(root);
    await writeFile(
      join(root, '.humanintheloop/indexes/file-area-map.json'),
      JSON.stringify({ 'source-ingestion': ['lib/custom/**'] }),
      'utf8'
    );

    const session = await startSession(root, { spec: 'Spec', task: 'minor refactor', files: ['lib/custom/foo.ts'] });
    expect(session.affectedAreas).toContain('source-ingestion');
    const sessionHtml = await readFile(join(root, session.path), 'utf8');
    const sessionMetadata = JSON.parse(/<script type="application\/hitl\+json">\s*([\s\S]*?)\s*<\/script>/.exec(sessionHtml)![1]);
    expect(sessionMetadata.affected_areas).toContain('source-ingestion');
  });

  test('file-area-map rejects traversal-shaped and unknown area ids', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-bad-file-map-area-'));
    await ensureWorkspace(root);
    await writeFile(
      join(root, '.humanintheloop/indexes/file-area-map.json'),
      JSON.stringify({ '../../../victim': ['lib/custom/**'] }),
      'utf8'
    );

    await expect(startSession(root, { spec: 'Spec', task: 'minor refactor', files: ['lib/custom/foo.ts'] })).rejects.toThrow(/Invalid file-area-map area id/);

    await writeFile(
      join(root, '.humanintheloop/indexes/file-area-map.json'),
      JSON.stringify({ 'unknown-area': ['lib/custom/**'] }),
      'utf8'
    );
    await expect(startSession(root, { spec: 'Spec', task: 'minor refactor', files: ['lib/custom/foo.ts'] })).rejects.toThrow(/Unknown file-area-map area id/);
  });

  test('file-area-map rejects malformed pattern values', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-bad-file-map-patterns-'));
    await ensureWorkspace(root);
    const mapPath = join(root, '.humanintheloop/indexes/file-area-map.json');
    await writeFile(mapPath, JSON.stringify({ 'source-ingestion': 'lib/custom/**' }), 'utf8');

    await expect(validateFiles(root, ['lib/custom/foo.ts'])).rejects.toThrow(/must map to an array of string patterns/);
    await expect(startSession(root, { spec: 'Spec', task: 'minor refactor', files: ['lib/custom/foo.ts'] })).rejects.toThrow(/must map to an array of string patterns/);

    await writeFile(mapPath, JSON.stringify({ 'source-ingestion': ['lib/custom/**', 42] }), 'utf8');
    await expect(validateFiles(root, ['lib/custom/foo.ts'])).rejects.toThrow(/must map to an array of string patterns/);
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

  test('changed-file detection uses local base branches before last-commit fallback', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-local-base-'));
    await execFileAsync('git', ['init', '-b', 'main'], { cwd: root });
    await execFileAsync('git', ['config', 'user.email', 'hitl@example.test'], { cwd: root });
    await execFileAsync('git', ['config', 'user.name', 'HITL Test'], { cwd: root });
    await writeFile(join(root, 'README.md'), '# fixture\n', 'utf8');
    await execFileAsync('git', ['add', 'README.md'], { cwd: root });
    await execFileAsync('git', ['commit', '-m', 'initial'], { cwd: root });
    await execFileAsync('git', ['checkout', '-b', 'feature'], { cwd: root });
    await mkdir(join(root, 'src/connectors'), { recursive: true });
    await writeFile(join(root, 'src/connectors/first.ts'), 'export const first = true;\n', 'utf8');
    await execFileAsync('git', ['add', 'src/connectors/first.ts'], { cwd: root });
    await execFileAsync('git', ['commit', '-m', 'add first connector'], { cwd: root });
    await mkdir(join(root, 'src/db'), { recursive: true });
    await writeFile(join(root, 'src/db/second.ts'), 'export const second = true;\n', 'utf8');
    await execFileAsync('git', ['add', 'src/db/second.ts'], { cwd: root });
    await execFileAsync('git', ['commit', '-m', 'add second file'], { cwd: root });
    const remote = await mkdtemp(join(tmpdir(), 'hitl-local-base-origin-'));
    await execFileAsync('git', ['init', '--bare', remote], { cwd: root });
    await execFileAsync('git', ['remote', 'add', 'origin', remote], { cwd: root });
    await execFileAsync('git', ['push', '-u', 'origin', 'feature'], { cwd: root });

    await expect(projectChangedFiles(root)).resolves.toEqual(expect.arrayContaining([
      'src/connectors/first.ts',
      'src/db/second.ts'
    ]));
  });
});
