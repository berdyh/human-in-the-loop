import { join } from 'node:path';
import { readJson, writeJsonAtomic } from '../core/json.js';
import { contentPath, exists } from '../core/paths.js';
import { nowIso } from '../core/time.js';
import { escapeHtml } from '../html/escapeHtml.js';
import { pageLayout } from '../html/templates.js';

export type ClaimStatus = 'agent-draft' | 'pending-human-review' | 'accepted' | 'rejected' | 'superseded' | 'needs-review' | 'stale' | 'kept-with-warning';

export type ClaimRecord = {
  claim_id: string;
  title: string;
  type: string;
  status: ClaimStatus;
  affected_areas: string[];
  related_files: string[];
  introduced_by_session: string;
  source_html: string;
  created_at: string;
  updated_at: string;
  supersedes: string[];
  superseded_by: string[];
};

export type ClaimIndex = { claims: ClaimRecord[] };

export function claimIndexPath(root: string): string {
  return join(root, '.humanintheloop/indexes/claim-index.json');
}

export async function readClaimIndex(root: string): Promise<ClaimIndex> {
  const path = claimIndexPath(root);
  if (!(await exists(path))) return { claims: [] };
  const parsed = await readJson<ClaimIndex>(path);
  if (!Array.isArray(parsed.claims)) throw new Error('claim-index.json must contain a claims array');
  return parsed;
}

export async function writeClaimIndex(root: string, index: ClaimIndex): Promise<void> {
  await writeJsonAtomic(claimIndexPath(root), index);
  await writeReviewQueue(root, index);
}

export async function addClaim(root: string, claim: ClaimRecord): Promise<void> {
  const index = await readClaimIndex(root);
  index.claims.push(claim);
  await writeClaimIndex(root, index);
}

export async function updateClaimsForSession(root: string, sessionId: string, sourceHtml: string, status: ClaimStatus): Promise<void> {
  const index = await readClaimIndex(root);
  const now = nowIso();
  for (const claim of index.claims) {
    if (claim.introduced_by_session === sessionId) {
      claim.status = status;
      claim.source_html = sourceHtml;
      claim.updated_at = now;
    }
  }
  await writeClaimIndex(root, index);
}

export async function writeReviewQueue(root: string, index?: ClaimIndex): Promise<void> {
  const queueIndex = index ?? await readClaimIndex(root);
  const pending = queueIndex.claims.filter((claim) => claim.status === 'pending-human-review' || claim.status === 'needs-review' || claim.status === 'agent-draft');
  const cards = pending.length
    ? pending.map((claim) => `<div class="hitl-card" data-hitl-card="true" data-card-id="${escapeHtml(claim.claim_id)}" data-card-type="claim" data-status="${escapeHtml(claim.status)}"><h3>${escapeHtml(claim.title)}</h3><p>${escapeHtml(claim.type)} from session ${escapeHtml(claim.introduced_by_session)}</p><p class="muted">${escapeHtml(claim.source_html)}</p></div>`).join('\n')
    : '<p class="muted">No claims awaiting review.</p>';
  await writeJsonAtomic(join(root, '.humanintheloop/indexes/code-state-index.json'), { updated_at: nowIso(), pending_review_count: pending.length });
  await import('../core/paths.js').then(({ writeAtomic }) => writeAtomic(contentPath(root, 'review/index.html'), pageLayout('Review Queue', `<h1>Review Queue</h1><section data-section="review-queue">${cards}</section>`, { type: 'review', pending_claims: pending.map((claim) => claim.claim_id) })));
}
