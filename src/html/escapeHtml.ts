export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function safeMetadataJson(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/</g, '\\u003c');
}
