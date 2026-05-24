import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { ensureWorkspace } from '../../src/workspace/init.js';
import { startSession, addNote, recordCleanup, finalizeSession } from '../../src/sessions/sessionStore.js';
import { validateSession } from '../../src/validation/validateWorkspace.js';
import { readClaimIndex } from '../../src/claims/claimIndex.js';

describe('session HTML workflow', () => {
  test('notes are escaped structured cards and finalize creates pending review delta', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-session-'));
    await ensureWorkspace(root);
    const session = await startSession(root, {
      spec: 'Add Crunchbase API ingestion for company profiles',
      task: 'connect a new provider',
      files: ['src/connectors/crunchbase.ts']
    });

    const design = await addNote(root, { sessionId: `${session.id}.html`, type: 'design-decision', title: '<Normalize>', body: 'Use adapters <script>alert(1)</script>', files: ['src/connectors/crunchbase.ts'] });
    await addNote(root, { sessionId: session.id, type: 'spec-interpretation', title: 'Adapter path', body: 'External source data enters through adapters.' });
    await addNote(root, { sessionId: session.id, type: 'deviation', title: 'Raw payloads', body: 'Raw payloads are not canonical.' });
    await addNote(root, { sessionId: session.id, type: 'tradeoff', title: 'Adapter over direct indexing', body: 'Avoid indexing/provider coupling.' });
    await addNote(root, { sessionId: session.id, type: 'open-question', title: 'Retention', body: 'Retain raw provider payloads?' });
    await recordCleanup(root, { sessionId: session.id, action: 'none', reason: 'No stale HITL claims exist in this fixture.' });

    const validation = await validateSession(root, session.id);
    expect(validation.ok).toBe(true);

    const activeHtml = await readFile(join(root, session.path), 'utf8');
    const reviewQueue = await readFile(join(root, '.humanintheloop/content/review/index.html'), 'utf8');
    expect(activeHtml).toContain('data-hitl-card="true"');
    expect(activeHtml).toContain('data-card-type="design-decision"');
    expect(activeHtml).toContain('&lt;Normalize&gt;');
    expect(activeHtml).not.toContain('<script>alert(1)</script>');
    expect(reviewQueue).toContain('&lt;Normalize&gt;');
    expect(reviewQueue).not.toContain('<Normalize>');

    const finalized = await finalizeSession(root, session.id);
    await expect(readFile(join(root, finalized.completedPath), 'utf8')).resolves.toContain('pending-human-review');
    await expect(readFile(join(root, finalized.deltaPath), 'utf8')).resolves.toContain('Implementation Delta');
    await expect(readFile(join(root, '.humanintheloop/content/areas/source-ingestion/page.html'), 'utf8')).resolves.toContain(finalized.deltaPath.replace('.humanintheloop/content/', ''));
    const claimIndex = await readClaimIndex(root);
    const claim = claimIndex.claims.find((candidate) => candidate.claim_id === design.claimId);
    expect(claim).toMatchObject({
      introduced_by_session: session.id,
      status: 'pending-human-review',
      source_html: finalized.completedPath.replace('.humanintheloop/content/', '')
    });
  });
});
