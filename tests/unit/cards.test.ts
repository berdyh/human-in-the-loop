import { describe, expect, test } from 'vitest';
import { insertIntoSection, replaceCardStatus, replaceMetadata } from '../../src/html/cards.js';

describe('card HTML helpers', () => {
  test('section insertion preserves replacement tokens in inserted fragments', () => {
    const fragment = "<p>Preserve literal replacement tokens: $& $1 $' $$</p>";
    const html = '<main><section data-section="notes"><h2>Notes</h2></section></main>';

    expect(insertIntoSection(html, 'notes', fragment)).toContain(fragment);
  });

  test('metadata replacement preserves replacement tokens in JSON values', () => {
    const html = `<main></main>
<script type="application/hitl+json">
{"type":"session"}
</script>`;
    const updated = replaceMetadata(html, { type: 'session', note: "Preserve literal replacement tokens: $& $1 $' $$" });

    expect(updated).toContain('"note": "Preserve literal replacement tokens: $& $1 $\' $$"');
  });

  test('status replacement does not rewrite the next card badge when target is legacy markup', () => {
    const html = `<section data-section="design-decisions">
<div class="hitl-card" data-hitl-card="true" data-card-id="legacy-claim" data-status="agent-draft">
  <h3>Legacy claim</h3>
</div>
<div class="hitl-card" data-hitl-card="true" data-card-id="current-claim" data-status="pending-human-review">
  <div class="card-header">
    <span class="status-badge badge-pending-human-review">pending-human-review</span>
  </div>
</div>
</section>`;

    const updated = replaceCardStatus(html, 'legacy-claim', 'accepted');

    expect(updated).toContain('data-card-id="legacy-claim" data-status="accepted"');
    expect(updated).toContain('data-card-id="current-claim" data-status="pending-human-review"');
    expect(updated).toContain('status-badge badge-pending-human-review">pending-human-review</span>');
    expect(updated).not.toContain('status-badge badge-accepted">accepted</span>');
  });
});
