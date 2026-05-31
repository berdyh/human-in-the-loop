import { escapeHtml, safeMetadataJson } from './escapeHtml.js';

export const NOTE_TYPE_TO_SECTION: Record<string, string> = {
  'design-decision': 'design-decisions',
  'spec-interpretation': 'spec-interpretations',
  deviation: 'deviations',
  tradeoff: 'tradeoffs',
  'open-question': 'open-questions',
  'stale-cleanup': 'stale-cleanup'
};

export function cardHtml(input: {
  id: string;
  type: string;
  status: string;
  title: string;
  body: string;
  why?: string;
  files?: string[];
}): string {
  const why = input.why ? `<p class="card-why"><strong>Why:</strong> ${escapeHtml(input.why)}</p>` : '';
  const files = input.files?.length ? `<p class="card-files"><strong>Files:</strong> ${escapeHtml(input.files.join(', '))}</p>` : '';
  const friendlyType = input.type.replace(/-/g, ' ');
  return `<div class="hitl-card" data-hitl-card="true" data-card-id="${escapeHtml(input.id)}" data-claim-id="${escapeHtml(input.id)}" data-card-type="${escapeHtml(input.type)}" data-status="${escapeHtml(input.status)}">
  <div class="card-header">
    <span class="card-type-tag">${escapeHtml(friendlyType)}</span>
    <span class="status-badge badge-${escapeHtml(input.status)}">${escapeHtml(input.status)}</span>
  </div>
  <h3>${escapeHtml(input.title)}</h3>
  <p class="card-body-text">${escapeHtml(input.body)}</p>
  ${why}
  ${files}
</div>`;
}

export function insertIntoSection(html: string, sectionId: string, fragment: string): string {
  const pattern = new RegExp(`(<section[^>]*(?:id|data-section)=["']${sectionId}["'][^>]*>[\\s\\S]*?)(</section>)`);
  if (!pattern.test(html)) throw new Error(`Missing HITL section: ${sectionId}`);
  return html.replace(pattern, (_match, before, after) => `${before}\n${fragment}\n${after}`);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function replaceCardStatus(html: string, cardId: string, status: string): string {
  const escapedCardId = escapeRegex(cardId);
  const escapedStatus = escapeHtml(status);
  const cardOpenPattern = new RegExp(`<div\\b[^>]*data-card-id=["']${escapedCardId}["'][^>]*>`);
  const cardMatch = cardOpenPattern.exec(html);
  if (!cardMatch) return html;

  const cardStart = cardMatch.index;
  const bodyStart = cardStart + cardMatch[0].length;
  const nextCardMatch = /<div\b[^>]*data-card-id=["'][^"']+["'][^>]*>/.exec(html.slice(bodyStart));
  const cardEnd = nextCardMatch ? bodyStart + nextCardMatch.index : html.length;
  const openingTag = cardMatch[0].replace(/(data-status=["'])[^"']+(["'])/, `$1${escapedStatus}$2`);
  const body = html
    .slice(bodyStart, cardEnd)
    .replace(/(<span class=["']status-badge )badge-[^"']+(["'][^>]*>)[\s\S]*?(<\/span>)/, `$1badge-${escapedStatus}$2${escapedStatus}$3`);

  return `${html.slice(0, cardStart)}${openingTag}${body}${html.slice(cardEnd)}`;
}

export function sectionHtml(html: string, sectionId: string): string | null {
  const pattern = new RegExp(`<section[^>]*(?:id|data-section)=["']${sectionId}["'][^>]*>([\\s\\S]*?)</section>`);
  return pattern.exec(html)?.[1] ?? null;
}

export function readMetadata(html: string): Record<string, unknown> {
  const match = /<script type="application\/hitl\+json">\s*([\s\S]*?)\s*<\/script>/.exec(html);
  if (!match) return {};
  return JSON.parse(match[1]) as Record<string, unknown>;
}

export function replaceMetadata(html: string, metadata: Record<string, unknown>): string {
  const script = `<script type="application/hitl+json">\n${safeMetadataJson(metadata)}\n</script>`;
  if (/<script type="application\/hitl\+json">[\s\S]*?<\/script>/.test(html)) {
    return html.replace(/<script type="application\/hitl\+json">[\s\S]*?<\/script>/, () => script);
  }
  return `${html}\n${script}`;
}
