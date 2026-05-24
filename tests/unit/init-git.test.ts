import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { ensureWorkspace } from '../../src/workspace/init.js';
import { internalGitLog } from '../../src/git/internalGit.js';
import { exists } from '../../src/core/paths.js';
import { startSession, addNote } from '../../src/sessions/sessionStore.js';
import { readClaimIndex } from '../../src/claims/claimIndex.js';

describe('workspace init and internal git', () => {
  test('init creates workspace, pages, bootloader, and separate internal git history', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-init-'));
    await ensureWorkspace(root);

    await expect(exists(join(root, '.humanintheloop/config.json'))).resolves.toBe(true);
    await expect(exists(join(root, '.humanintheloop/content/project.html'))).resolves.toBe(true);
    await expect(exists(join(root, '.humanintheloop/history/git/HEAD'))).resolves.toBe(true);
    await expect(exists(join(root, '.humanintheloop/content/.git'))).resolves.toBe(false);
    await expect(exists(join(root, 'AGENTS.md'))).resolves.toBe(true);

    const log = await internalGitLog(root);
    expect(log).toContain('hitl init: initialize Human in the Loop workspace');
  });

  test('re-running init preserves existing sessions and claims', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-reinit-'));
    await ensureWorkspace(root);
    const session = await startSession(root, { spec: 'Spec', task: 'connect a new provider', files: ['src/connectors/foo.ts'] });
    const note = await addNote(root, { sessionId: session.id, type: 'design-decision', title: 'Keep claim', body: 'Claim body' });

    await ensureWorkspace(root);

    await expect(exists(join(root, session.path))).resolves.toBe(true);
    const claimIndex = await readClaimIndex(root);
    expect(claimIndex.claims.map((claim) => claim.claim_id)).toContain(note.claimId);
  });
});
