import { internalGitCommit } from '../git/internalGit.js';
import { ClaimStatus, findClaim, setClaimStatus } from '../claims/claimIndex.js';

const REVIEW_STATUSES = new Set<ClaimStatus>(['accepted', 'rejected', 'needs-review', 'superseded']);

export async function reviewClaim(root: string, input: { claimId: string; status: ClaimStatus; supersededBy?: string }): Promise<void> {
  if (!REVIEW_STATUSES.has(input.status)) throw new Error(`Unsupported review status: ${input.status}`);
  if (input.status === 'superseded' && !input.supersededBy) throw new Error('Review status superseded requires supersededBy');
  const target = await findClaim(root, input.claimId);
  if (!target) throw new Error(`Claim not found: ${input.claimId}`);
  const replacement = input.status === 'superseded' ? await findClaim(root, input.supersededBy!) : null;
  if (input.status === 'superseded' && !replacement) throw new Error(`Superseded-by claim not found: ${input.supersededBy}`);
  if (input.status === 'superseded' && replacement?.claim_id === target.claim_id) throw new Error('A claim cannot supersede itself');
  const claim = await setClaimStatus(root, { claimRef: target.claim_id, status: input.status, supersededBy: replacement?.claim_id });
  if (!claim) throw new Error(`Claim not found: ${input.claimId}`);
  await internalGitCommit(root, `hitl review: ${input.claimId} ${input.status}`);
}
