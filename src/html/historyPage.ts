import { escapeHtml } from './escapeHtml.js';
import { pageLayout } from './layout.js';

function countEntries(log: string): number {
  return log.split('\n').map((line) => line.trim()).filter(Boolean).length;
}

function historyEntries(log: string): Array<{ sha: string | null; message: string }> {
  return log
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = /^([0-9a-f]{4,40})(?:\s+\([^)]+\))?\s+(.*)$/i.exec(line);
      if (!match) return { sha: null, message: line };
      return { sha: match[1], message: match[2] };
    });
}

function historyList(log: string): string {
  return `<div class="history-log"><ol class="history-list">${historyEntries(log)
    .map((entry) => {
      if (!entry.sha) {
        return `<li class="history-entry history-entry-raw"><span class="history-message">${escapeHtml(entry.message)}</span></li>`;
      }
      return `<li class="history-entry"><code class="history-sha">${escapeHtml(entry.sha)}</code><span class="history-message">${escapeHtml(
        entry.message
      )}</span></li>`;
    })
    .join('')}</ol></div>`;
}

export function historyPage(log: string, page?: string): string {
  const trimmed = log.trim();
  const pageLabel = page ? `Page: ${page}` : 'Workspace history';
  const body = trimmed
    ? `<h1>HITL History</h1>
<p class="muted">Internal Git commits for repo-local implementation memory.</p>
<div class="history-meta">
  <span class="history-chip">${escapeHtml(pageLabel)}</span>
  <span class="history-chip">${countEntries(trimmed)} commits</span>
</div>
${historyList(trimmed)}`
    : `<h1>HITL History</h1>
<p class="muted">Internal Git commits for repo-local implementation memory.</p>
<div class="empty-state">
  <h2>No internal history yet.</h2>
  <p>Run <code>hitl init</code> or start a HITL session to create the first internal history entry.</p>
</div>`;

  return pageLayout('HITL History', body, { type: 'history', page: page ?? null, commit_count: countEntries(trimmed) });
}
