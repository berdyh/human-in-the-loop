import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readJson, writeJsonAtomic } from '../core/json.js';
import { assertSafeContentRelativePath, contentPath, exists, safeContentPath, writeAtomic } from '../core/paths.js';
import { nowIso } from '../core/time.js';
import { readMetadata, replaceCardStatus, replaceMetadata } from '../html/cards.js';
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

const CLAIM_STATUSES = new Set<ClaimStatus>([
  'agent-draft',
  'pending-human-review',
  'accepted',
  'rejected',
  'superseded',
  'needs-review',
  'stale',
  'kept-with-warning'
]);

function stringField(record: Record<string, unknown>, index: number, field: string): string {
  const value = record[field];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`claim-index.json claims[${index}].${field} must be a non-empty string`);
  }
  return value;
}

function stringArrayField(record: Record<string, unknown>, index: number, field: string): string[] {
  const value = record[field];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`claim-index.json claims[${index}].${field} must be an array of strings`);
  }
  return value;
}

function validateClaimRecord(value: unknown, index: number): ClaimRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`claim-index.json claims[${index}] must be an object`);
  }
  const record = value as Record<string, unknown>;
  stringField(record, index, 'claim_id');
  stringField(record, index, 'title');
  stringField(record, index, 'type');
  const status = stringField(record, index, 'status');
  if (!CLAIM_STATUSES.has(status as ClaimStatus)) {
    throw new Error(`claim-index.json claims[${index}].status is invalid: ${status}`);
  }
  stringArrayField(record, index, 'affected_areas');
  stringArrayField(record, index, 'related_files');
  stringField(record, index, 'introduced_by_session');
  record.source_html = assertSafeContentRelativePath('claim source_html path', stringField(record, index, 'source_html'));
  stringField(record, index, 'created_at');
  stringField(record, index, 'updated_at');
  stringArrayField(record, index, 'supersedes');
  stringArrayField(record, index, 'superseded_by');
  return record as ClaimRecord;
}

export function claimIndexPath(root: string): string {
  return join(root, '.humanintheloop/indexes/claim-index.json');
}

export async function readClaimIndex(root: string): Promise<ClaimIndex> {
  const path = claimIndexPath(root);
  if (!(await exists(path))) return { claims: [] };
  const parsed = await readJson<{ claims?: unknown }>(path);
  if (!Array.isArray(parsed.claims)) throw new Error('claim-index.json must contain a claims array');
  return { claims: parsed.claims.map((claim, index) => validateClaimRecord(claim, index)) };
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

export async function findClaim(root: string, claimRef: string): Promise<ClaimRecord | null> {
  const index = await readClaimIndex(root);
  return index.claims.find((candidate) => candidate.claim_id === claimRef || candidate.title === claimRef) ?? null;
}

export async function updateClaimsForSession(root: string, sessionId: string, sourceHtml: string, status: ClaimStatus): Promise<void> {
  const index = await readClaimIndex(root);
  const now = nowIso();
  for (const claim of index.claims) {
    if (claim.introduced_by_session === sessionId) {
      if (claim.status === 'agent-draft') claim.status = status;
      claim.source_html = sourceHtml;
      claim.updated_at = now;
    }
  }
  await writeClaimIndex(root, index);
}

async function updateClaimSourceHtml(root: string, claim: ClaimRecord, status: ClaimStatus, updatedAt: string): Promise<void> {
  const htmlPath = safeContentPath(root, 'claim source_html path', claim.source_html);
  if (!(await exists(htmlPath))) return;
  const html = await readFile(htmlPath, 'utf8');
  let updated = replaceCardStatus(html, claim.claim_id, status);
  const metadata = readMetadata(updated);
  if (Array.isArray(metadata.cards)) {
    let changed = false;
    metadata.cards = (metadata.cards as Record<string, unknown>[]).map((card) => {
      if (String(card.id) !== claim.claim_id) return card;
      changed = true;
      return { ...card, status, updated_at: updatedAt };
    });
    if (changed) {
      metadata.updated_at = updatedAt;
      updated = replaceMetadata(updated, metadata);
    }
  }
  if (updated !== html) await writeAtomic(htmlPath, updated);
}

export async function setClaimStatus(root: string, input: { claimRef: string; status: ClaimStatus; supersededBy?: string }): Promise<ClaimRecord | null> {
  const index = await readClaimIndex(root);
  const claim = index.claims.find((candidate) => candidate.claim_id === input.claimRef || candidate.title === input.claimRef);
  if (!claim) return null;
  safeContentPath(root, 'claim source_html path', claim.source_html);
  const now = nowIso();
  claim.status = input.status;
  claim.updated_at = now;
  claim.superseded_by = input.status === 'superseded' && input.supersededBy ? [input.supersededBy] : [];
  await writeClaimIndex(root, index);
  await updateClaimSourceHtml(root, claim, input.status, now);
  return claim;
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
