import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { ensureWorkspace } from '../../src/workspace/init.js';
import { startSession, addNote, recordCleanup } from '../../src/sessions/sessionStore.js';
import { validateSession, validateWorkspace, validateFiles } from '../../src/validation/validateWorkspace.js';
import { reviewClaim } from '../../src/review/reviewClaims.js';

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
});
