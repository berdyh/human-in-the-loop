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
  const why = input.why ? `<p><strong>Why:</strong> ${escapeHtml(input.why)}</p>` : '';
  const files = input.files?.length ? `<p class="muted"><strong>Files:</strong> ${escapeHtml(input.files.join(', '))}</p>` : '';
  return `<div class="hitl-card" data-hitl-card="true" data-card-id="${escapeHtml(input.id)}" data-claim-id="${escapeHtml(input.id)}" data-card-type="${escapeHtml(input.type)}" data-status="${escapeHtml(input.status)}">
  <h3>${escapeHtml(input.title)}</h3>
  <p>${escapeHtml(input.body)}</p>
  ${why}
  ${files}
</div>`;
}

export function insertIntoSection(html: string, sectionId: string, fragment: string): string {
  const pattern = new RegExp(`(<section[^>]*(?:id|data-section)=["']${sectionId}["'][^>]*>[\\s\\S]*?)(</section>)`);
  if (!pattern.test(html)) throw new Error(`Missing HITL section: ${sectionId}`);
  return html.replace(pattern, `$1\n${fragment}\n$2`);
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
    return html.replace(/<script type="application\/hitl\+json">[\s\S]*?<\/script>/, script);
  }
  return `${html}\n${script}`;
}
