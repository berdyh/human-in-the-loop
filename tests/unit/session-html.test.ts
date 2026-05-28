import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { ensureWorkspace } from '../../src/workspace/init.js';
import { startSession, addNote, recordCleanup, finalizeSession } from '../../src/sessions/sessionStore.js';
import { validateSession, validateWorkspace } from '../../src/validation/validateWorkspace.js';
import { readClaimIndex } from '../../src/claims/claimIndex.js';
import { reviewClaim } from '../../src/review/reviewClaims.js';

function readMetadataFromHtml(html: string): { cards: unknown[] } {
  return JSON.parse(/<script type="application\/hitl\+json">\s*([\s\S]*?)\s*<\/script>/.exec(html)![1]);
}

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
    const spec = await addNote(root, { sessionId: session.id, type: 'spec-interpretation', title: 'Adapter path', body: 'External source data enters through adapters.' });
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

    await reviewClaim(root, { claimId: design.claimId, status: 'accepted' });
    const finalized = await finalizeSession(root, session.id);
    const completedHtml = await readFile(join(root, finalized.completedPath), 'utf8');
    const completedMetadata = JSON.parse(/<script type="application\/hitl\+json">\s*([\s\S]*?)\s*<\/script>/.exec(completedHtml)![1]);
    expect(completedHtml).toContain('data-status="accepted"');
    expect(completedHtml).toContain('data-status="pending-human-review"');
    expect(completedHtml).toContain('data-card-type="stale-cleanup" data-status="agent-draft"');
    expect(completedMetadata.cards.find((card: { id: string }) => card.id === design.claimId)).toMatchObject({ status: 'accepted' });
    expect(completedMetadata.cards.find((card: { id: string }) => card.id === spec.claimId)).toMatchObject({ status: 'pending-human-review' });
    expect(completedMetadata.cards.find((card: { type: string }) => card.type === 'stale-cleanup')).toMatchObject({ status: 'agent-draft' });
    await expect(readFile(join(root, finalized.deltaPath), 'utf8')).resolves.toContain('Implementation Delta');
    const areaHtml = await readFile(join(root, '.humanintheloop/content/areas/source-ingestion/page.html'), 'utf8');
    expect(areaHtml).toContain(finalized.deltaPath.replace('.humanintheloop/content/', ''));
    expect(areaHtml).not.toContain('No finalized implementation memory yet.');
    const claimIndex = await readClaimIndex(root);
    expect(claimIndex.claims.find((candidate) => candidate.claim_id === design.claimId)).toMatchObject({
      introduced_by_session: session.id,
      status: 'accepted',
      source_html: finalized.completedPath.replace('.humanintheloop/content/', '')
    });
    expect(claimIndex.claims.find((candidate) => candidate.claim_id === spec.claimId)).toMatchObject({
      introduced_by_session: session.id,
      status: 'pending-human-review',
      source_html: finalized.completedPath.replace('.humanintheloop/content/', '')
    });
    await expect(addNote(root, { sessionId: session.id, type: 'design-decision', title: 'Post-finalize', body: 'Nope.' })).rejects.toThrow(/already completed/);
    await expect(recordCleanup(root, { sessionId: session.id, action: 'none', reason: 'Nope.' })).rejects.toThrow(/already completed/);
    await expect(addNote(root, { sessionId: `../completed/${session.id}`, type: 'design-decision', title: 'Traversal', body: 'Nope.' })).rejects.toThrow(/Invalid session id/);
    await expect(recordCleanup(root, { sessionId: `..\\completed\\${session.id}`, action: 'none', reason: 'Nope.' })).rejects.toThrow(/Invalid session id/);
  });

  test('cleanup actions map to declared card statuses and reject unknown actions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-cleanup-'));
    await ensureWorkspace(root);
    const session = await startSession(root, { spec: 'Spec', task: 'connect a new provider', files: ['src/connectors/foo.ts'] });
    const oldClaim = await addNote(root, { sessionId: session.id, type: 'design-decision', title: 'Old claim', body: 'Old guidance.' });
    const warningClaim = await addNote(root, { sessionId: session.id, type: 'tradeoff', title: 'Warning claim', body: 'Useful with caveats.' });

    const cleanup = await recordCleanup(root, { sessionId: session.id, action: 'supersede', oldClaim: oldClaim.claimId, reason: 'New claim replaces old one.' });
    await recordCleanup(root, { sessionId: session.id, action: 'keep-with-warning', oldClaim: warningClaim.claimId, reason: 'Still useful with caveat.' });
    await expect(recordCleanup(root, { sessionId: session.id, action: 'remove', reason: 'No target.' })).rejects.toThrow(/requires --old-claim/);
    await expect(recordCleanup(root, { sessionId: session.id, action: 'needs-review', oldClaim: 'missing-claim', reason: 'No target.' })).rejects.toThrow(/Cleanup target not found/);
    await expect(recordCleanup(root, { sessionId: session.id, action: 'bogus', reason: 'Nope.' })).rejects.toThrow(/Unsupported cleanup action/);

    const html = await readFile(join(root, session.path), 'utf8');
    const claimIndex = await readClaimIndex(root);
    expect(claimIndex.claims.find((claim) => claim.claim_id === oldClaim.claimId)).toMatchObject({
      status: 'superseded',
      superseded_by: [cleanup.cardId]
    });
    expect(claimIndex.claims.find((claim) => claim.claim_id === warningClaim.claimId)).toMatchObject({
      status: 'kept-with-warning'
    });
    expect(html).toContain('data-status="superseded"');
    expect(html).toContain('data-status="kept-with-warning"');
    expect(html).not.toContain('data-status="supersede"');
  });

  test('review rejects unsupported statuses and requires superseded-by for superseded', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-review-status-'));
    await ensureWorkspace(root);
    const session = await startSession(root, { spec: 'Spec', task: 'connect a new provider', files: ['src/connectors/foo.ts'] });
    const note = await addNote(root, { sessionId: session.id, type: 'design-decision', title: 'Decision', body: 'Body' });
    const replacement = await addNote(root, { sessionId: session.id, type: 'design-decision', title: 'Replacement', body: 'Body' });

    await expect(reviewClaim(root, { claimId: note.claimId, status: 'acceptd' as never })).rejects.toThrow(/Unsupported review status/);
    await expect(reviewClaim(root, { claimId: note.claimId, status: 'superseded' })).rejects.toThrow(/requires supersededBy/);
    await expect(reviewClaim(root, { claimId: note.claimId, status: 'superseded', supersededBy: 'missing-claim' })).rejects.toThrow(/Superseded-by claim not found/);
    await expect(reviewClaim(root, { claimId: note.claimId, status: 'superseded', supersededBy: note.claimId })).rejects.toThrow(/cannot supersede itself/);
    await reviewClaim(root, { claimId: note.claimId, status: 'superseded', supersededBy: replacement.claimId });
    let claimIndex = await readClaimIndex(root);
    expect(claimIndex.claims.find((claim) => claim.claim_id === note.claimId)).toMatchObject({
      status: 'superseded',
      superseded_by: [replacement.claimId]
    });
    await reviewClaim(root, { claimId: note.claimId, status: 'accepted' });
    claimIndex = await readClaimIndex(root);
    expect(claimIndex.claims.find((claim) => claim.claim_id === note.claimId)).toMatchObject({
      status: 'accepted',
      superseded_by: []
    });
  });

  test('review rejects claim source_html traversal before writing card status', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-claim-source-traversal-'));
    await ensureWorkspace(root);
    const session = await startSession(root, { spec: 'Spec', task: 'connect a new provider', files: ['src/connectors/foo.ts'] });
    const note = await addNote(root, { sessionId: session.id, type: 'design-decision', title: 'Decision', body: 'Body' });
    const claimIndexPath = join(root, '.humanintheloop/indexes/claim-index.json');
    const claimIndex = JSON.parse(await readFile(claimIndexPath, 'utf8'));
    claimIndex.claims[0].source_html = '../../victim.html';
    await writeFile(claimIndexPath, JSON.stringify(claimIndex, null, 2), 'utf8');
    const victimPath = join(root, 'victim.html');
    await writeFile(victimPath, `<div data-card-id="${note.claimId}" data-status="agent-draft">x</div>`, 'utf8');

    await expect(reviewClaim(root, { claimId: note.claimId, status: 'accepted' })).rejects.toThrow(/Invalid claim source_html path/);
    await expect(readFile(victimPath, 'utf8')).resolves.toContain('data-status="agent-draft"');
    const rawIndex = JSON.parse(await readFile(claimIndexPath, 'utf8'));
    expect(rawIndex.claims[0].status).toBe('agent-draft');
    await expect(readClaimIndex(root)).rejects.toThrow(/Invalid claim source_html path/);
  });

  test('claim index rejects malformed records during workspace validation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-malformed-claim-index-'));
    await ensureWorkspace(root);
    await writeFile(join(root, '.humanintheloop/indexes/claim-index.json'), JSON.stringify({ claims: [{ status: 'agent-draft' }] }), 'utf8');

    await expect(readClaimIndex(root)).rejects.toThrow(/claim-index\.json claims\[0\]\.claim_id/);
    const validation = await validateWorkspace(root);
    expect(validation.ok).toBe(false);
    expect(validation.errors.join('\n')).toContain('claim-index.json claims[0].claim_id');
  });

  test('finalize rejects invalid affected areas before mutating session state', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-finalize-affected-area-'));
    await ensureWorkspace(root);
    const session = await startSession(root, { spec: 'Spec', task: 'connect a new provider', files: ['src/connectors/foo.ts'] });
    for (const type of ['design-decision', 'spec-interpretation', 'deviation', 'tradeoff', 'open-question']) {
      await addNote(root, { sessionId: session.id, type, title: type, body: 'Body' });
    }
    await recordCleanup(root, { sessionId: session.id, action: 'none', reason: 'No stale claims.' });
    const activeSessionPath = join(root, session.path);
    const completedSessionPath = join(root, '.humanintheloop/content/sessions/completed', `${session.id}.html`);
    const deltaPath = join(root, '.humanintheloop/content/deltas', `${session.id}.html`);
    const originalSessionHtml = await readFile(activeSessionPath, 'utf8');
    await writeFile(activeSessionPath, originalSessionHtml.replace(/"affected_areas":\s*\[[\s\S]*?\]/, '"affected_areas": ["../../evil"]'), 'utf8');

    await expect(finalizeSession(root, session.id)).rejects.toThrow(/Invalid affected area id/);
    await expect(readFile(activeSessionPath, 'utf8')).resolves.toContain('"../../evil"');
    await expect(readFile(completedSessionPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(deltaPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('finalize rejects missing affected area pages before mutating session state', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-finalize-missing-area-'));
    await ensureWorkspace(root);
    const session = await startSession(root, { spec: 'Spec', task: 'connect a new provider', files: ['src/connectors/foo.ts'] });
    for (const type of ['design-decision', 'spec-interpretation', 'deviation', 'tradeoff', 'open-question']) {
      await addNote(root, { sessionId: session.id, type, title: type, body: 'Body' });
    }
    await recordCleanup(root, { sessionId: session.id, action: 'none', reason: 'No stale claims.' });
    const activeSessionPath = join(root, session.path);
    const completedSessionPath = join(root, '.humanintheloop/content/sessions/completed', `${session.id}.html`);
    const deltaPath = join(root, '.humanintheloop/content/deltas', `${session.id}.html`);
    await rm(join(root, '.humanintheloop/content/areas/source-ingestion/page.html'));

    await expect(finalizeSession(root, session.id)).rejects.toThrow(/affected area pages are missing/);
    await expect(readFile(activeSessionPath, 'utf8')).resolves.toContain('"status": "active"');
    await expect(readFile(completedSessionPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(deltaPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('cleanup rejects invalid target source before writing cleanup card', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-cleanup-source-traversal-'));
    await ensureWorkspace(root);
    const session = await startSession(root, { spec: 'Spec', task: 'connect a new provider', files: ['src/connectors/foo.ts'] });
    const note = await addNote(root, { sessionId: session.id, type: 'design-decision', title: 'Old', body: 'Body' });
    const claimIndexPath = join(root, '.humanintheloop/indexes/claim-index.json');
    const claimIndex = JSON.parse(await readFile(claimIndexPath, 'utf8'));
    claimIndex.claims[0].source_html = '../../victim.html';
    await writeFile(claimIndexPath, JSON.stringify(claimIndex, null, 2), 'utf8');

    await expect(recordCleanup(root, { sessionId: session.id, action: 'remove', oldClaim: note.claimId, reason: 'Bad target.' })).rejects.toThrow(/Invalid claim source_html path/);
    const html = await readFile(join(root, session.path), 'utf8');
    expect(html).not.toContain('Cleanup: remove');
    expect(readMetadataFromHtml(html).cards).toHaveLength(1);
  });

  test('finalize uses opaque session id instead of mutable metadata id for paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-finalize-id-'));
    await ensureWorkspace(root);
    const session = await startSession(root, { spec: 'Spec', task: 'connect a new provider', files: ['src/connectors/foo.ts'] });
    const note = await addNote(root, { sessionId: session.id, type: 'design-decision', title: 'Decision', body: 'Body' });
    await addNote(root, { sessionId: session.id, type: 'spec-interpretation', title: 'Interpretation', body: 'Body' });
    await addNote(root, { sessionId: session.id, type: 'deviation', title: 'Deviation', body: 'Body' });
    await addNote(root, { sessionId: session.id, type: 'tradeoff', title: 'Tradeoff', body: 'Body' });
    await addNote(root, { sessionId: session.id, type: 'open-question', title: 'Question', body: 'Body' });
    await recordCleanup(root, { sessionId: session.id, action: 'none', reason: 'No stale HITL claims exist.' });
    const activePath = join(root, session.path);
    const tampered = (await readFile(activePath, 'utf8')).replace(`"id": "${session.id}"`, '"id": "../../review/index"');
    await writeFile(activePath, tampered, 'utf8');

    const finalized = await finalizeSession(root, session.id);
    expect(finalized.completedPath).toBe(`.humanintheloop/content/sessions/completed/${session.id}.html`);
    const completedHtml = await readFile(join(root, finalized.completedPath), 'utf8');
    const completedMetadata = JSON.parse(/<script type="application\/hitl\+json">\s*([\s\S]*?)\s*<\/script>/.exec(completedHtml)![1]);
    expect(completedMetadata.id).toBe(session.id);
    const claimIndex = await readClaimIndex(root);
    expect(claimIndex.claims.find((claim) => claim.claim_id === note.claimId)).toMatchObject({
      status: 'pending-human-review',
      source_html: `sessions/completed/${session.id}.html`
    });
  });
});
