import { readFile } from 'node:fs/promises';
import { contentPath, exists, writeAtomic } from '../core/paths.js';
import { nowIso } from '../core/time.js';
import { internalGitCommit } from '../git/internalGit.js';
import { ClaimStatus, readClaimIndex, writeClaimIndex } from '../claims/claimIndex.js';

const REVIEW_STATUSES = new Set<ClaimStatus>(['accepted', 'rejected', 'needs-review', 'superseded']);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function reviewClaim(root: string, input: { claimId: string; status: ClaimStatus; supersededBy?: string }): Promise<void> {
  if (!REVIEW_STATUSES.has(input.status)) throw new Error(`Unsupported review status: ${input.status}`);
  if (input.status === 'superseded' && !input.supersededBy) throw new Error('Review status superseded requires supersededBy');
  const index = await readClaimIndex(root);
  const claim = index.claims.find((candidate) => candidate.claim_id === input.claimId);
  if (!claim) throw new Error(`Claim not found: ${input.claimId}`);
  claim.status = input.status;
  claim.updated_at = nowIso();
  if (input.status === 'superseded' && input.supersededBy) claim.superseded_by = [input.supersededBy];
  await writeClaimIndex(root, index);

  const htmlPath = contentPath(root, claim.source_html);
  if (await exists(htmlPath)) {
    const html = await readFile(htmlPath, 'utf8');
    const pattern = new RegExp(`(<div[^>]*data-card-id=["']${escapeRegExp(input.claimId)}["'][^>]*data-status=["'])[^"']+(["'])`);
    if (pattern.test(html)) await writeAtomic(htmlPath, html.replace(pattern, `$1${input.status}$2`));
  }
  await internalGitCommit(root, `hitl review: ${input.claimId} ${input.status}`);
}
