import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { uniqueId } from '../core/ids.js';
import { contentPath, exists, writeAtomic } from '../core/paths.js';
import { nowIso } from '../core/time.js';
import { internalGitCommit, projectGitHead } from '../git/internalGit.js';
import { cardHtml, insertIntoSection, NOTE_TYPE_TO_SECTION, readMetadata, replaceMetadata } from '../html/cards.js';
import { escapeHtml } from '../html/escapeHtml.js';
import { pageLayout } from '../html/templates.js';
import { routeContext } from '../routing/router.js';
import { addClaim, updateClaimsForSession } from '../claims/claimIndex.js';
import { validateSession } from '../validation/validateWorkspace.js';

export type StartSessionInput = { spec: string; task: string; files: string[] };
export type NoteInput = { sessionId: string; type: string; title: string; body: string; why?: string; files?: string[] };
export type CleanupInput = { sessionId: string; oldClaim?: string; action: string; reason: string };

const REQUIRED_SECTIONS = ['design-decisions', 'spec-interpretations', 'deviations', 'tradeoffs', 'open-questions', 'stale-cleanup'];

function rootRelativeContentPath(...parts: string[]): string {
  return join('.humanintheloop/content', ...parts).replace(/\\/g, '/');
}

function normalizeSessionId(sessionId: string): string {
  return sessionId.endsWith('.html') ? sessionId.slice(0, -5) : sessionId;
}

async function findSession(root: string, sessionId: string): Promise<{ absolute: string; contentRelative: string; rootRelative: string; status: 'active' | 'completed' }> {
  const id = normalizeSessionId(sessionId);
  for (const status of ['active', 'completed'] as const) {
    const contentRelative = `sessions/${status}/${id}.html`;
    const absolute = contentPath(root, contentRelative);
    if (await exists(absolute)) return { absolute, contentRelative, rootRelative: rootRelativeContentPath(contentRelative), status };
  }
  throw new Error(`Session not found: ${sessionId}`);
}

function sessionHtml(input: { id: string; spec: string; task: string; files: string[]; affectedAreas: string[]; projectHead: string | null }): string {
  const affected = input.affectedAreas.map((area) => `<li><a href="/areas/${area}">${escapeHtml(area)}</a></li>`).join('') || '<li class="muted">No affected areas selected.</li>';
  const files = input.files.map((file) => `<li><code>${escapeHtml(file)}</code></li>`).join('') || '<li class="muted">No related files recorded.</li>';
  const memorySections = REQUIRED_SECTIONS.map((section) => `<section id="${section}" data-section="${section}"><h2>${escapeHtml(section.replace(/-/g, ' '))}</h2><p class="muted">Add structured cards here.</p></section>`).join('\n');
  return pageLayout(`HITL Session ${input.id}`, `<h1>HITL Session ${escapeHtml(input.id)}</h1><section id="spec" data-section="spec"><h2>Spec</h2><p>${escapeHtml(input.spec)}</p><p><strong>Task:</strong> ${escapeHtml(input.task)}</p></section><section id="affected-areas" data-section="affected-areas"><h2>Affected Areas</h2><ul>${affected}</ul></section>${memorySections}<section id="related-code" data-section="related-code"><h2>Related Code</h2><ul>${files}</ul></section><section id="related-tests" data-section="related-tests"><h2>Related Tests</h2><p class="muted">No related tests recorded yet.</p></section>`, {
    type: 'session',
    id: input.id,
    status: 'active',
    spec: input.spec,
    task: input.task,
    files: input.files,
    affected_areas: input.affectedAreas,
    project_git_head: input.projectHead,
    cards: [],
    created_at: nowIso(),
    updated_at: nowIso()
  });
}

export async function startSession(root: string, input: StartSessionInput): Promise<{ id: string; path: string; affectedAreas: string[]; requiredSections: string[] }> {
  const routed = routeContext({ task: input.task || input.spec, files: input.files });
  const affectedAreas = routed.required.filter((item) => item.type === 'area').map((item) => item.id);
  const fallbackAreas = routed.recommended.filter((item) => item.type === 'area').map((item) => item.id);
  const selectedAreas = affectedAreas.length ? affectedAreas : fallbackAreas;
  const id = uniqueId('session', input.task);
  const contentRelative = `sessions/active/${id}.html`;
  const path = rootRelativeContentPath(contentRelative);
  const projectHead = await projectGitHead(root);
  await writeAtomic(contentPath(root, contentRelative), sessionHtml({ id, spec: input.spec, task: input.task, files: input.files, affectedAreas: selectedAreas, projectHead }));
  await internalGitCommit(root, `hitl start: ${id}`);
  return { id, path, affectedAreas: selectedAreas, requiredSections: REQUIRED_SECTIONS };
}

export async function addNote(root: string, input: NoteInput): Promise<{ cardId: string; claimId: string; path: string }> {
  const section = NOTE_TYPE_TO_SECTION[input.type];
  if (!section || input.type === 'stale-cleanup') throw new Error(`Unsupported note type: ${input.type}`);
  const session = await findSession(root, input.sessionId);
  const normalizedSessionId = normalizeSessionId(input.sessionId);
  const html = await readFile(session.absolute, 'utf8');
  const metadata = readMetadata(html);
  const affectedAreas = Array.isArray(metadata.affected_areas) ? metadata.affected_areas as string[] : [];
  const claimId = uniqueId('claim', input.title);
  const card = cardHtml({ id: claimId, type: input.type, status: 'agent-draft', title: input.title, body: input.body, why: input.why, files: input.files });
  const cards = Array.isArray(metadata.cards) ? metadata.cards as Record<string, unknown>[] : [];
  cards.push({ id: claimId, type: input.type, title: input.title, status: 'agent-draft', files: input.files ?? [], created_at: nowIso() });
  metadata.cards = cards;
  metadata.updated_at = nowIso();
  const updated = replaceMetadata(insertIntoSection(html, section, card), metadata);
  await writeAtomic(session.absolute, updated);
  await addClaim(root, {
    claim_id: claimId,
    title: input.title,
    type: input.type,
    status: 'agent-draft',
    affected_areas: affectedAreas,
    related_files: input.files ?? [],
    introduced_by_session: normalizedSessionId,
    source_html: session.contentRelative,
    created_at: nowIso(),
    updated_at: nowIso(),
    supersedes: [],
    superseded_by: []
  });
  await internalGitCommit(root, `hitl note: ${input.type} ${input.title}`);
  return { cardId: claimId, claimId, path: session.rootRelative };
}

export async function recordCleanup(root: string, input: CleanupInput): Promise<{ cardId: string; path: string }> {
  const session = await findSession(root, input.sessionId);
  const html = await readFile(session.absolute, 'utf8');
  const metadata = readMetadata(html);
  const cardId = uniqueId('cleanup', input.action);
  const title = input.action === 'none' ? 'No stale HITL claims found' : `Cleanup: ${input.action}`;
  const body = input.oldClaim ? `${input.reason} Old claim: ${input.oldClaim}` : input.reason;
  const card = cardHtml({ id: cardId, type: 'stale-cleanup', status: input.action === 'none' ? 'agent-draft' : input.action, title, body });
  const cards = Array.isArray(metadata.cards) ? metadata.cards as Record<string, unknown>[] : [];
  cards.push({ id: cardId, type: 'stale-cleanup', action: input.action, status: input.action === 'none' ? 'agent-draft' : input.action, created_at: nowIso() });
  metadata.cards = cards;
  metadata.updated_at = nowIso();
  await writeAtomic(session.absolute, replaceMetadata(insertIntoSection(html, 'stale-cleanup', card), metadata));
  await internalGitCommit(root, `hitl cleanup: ${input.action} ${input.sessionId}`);
  return { cardId, path: session.rootRelative };
}

async function appendAreaDeltaLink(root: string, areaId: string, deltaContentRelative: string, sessionId: string): Promise<void> {
  const page = contentPath(root, 'areas', areaId, 'page.html');
  if (!(await exists(page))) return;
  const html = await readFile(page, 'utf8');
  const link = `<div class="hitl-card" data-hitl-card="true" data-card-id="recent-${escapeHtml(sessionId)}" data-card-type="claim" data-status="pending-human-review"><h3>Recent implementation memory</h3><p><a href="/${escapeHtml(deltaContentRelative.replace(/\.html$/, ''))}">${escapeHtml(deltaContentRelative)}</a></p></div>`;
  await writeAtomic(page, insertIntoSection(html, 'recent-memory', link));
}

export async function finalizeSession(root: string, sessionId: string): Promise<{ completedPath: string; deltaPath: string }> {
  const validation = await validateSession(root, sessionId);
  if (!validation.ok) throw new Error(`Cannot finalize invalid session:\n${validation.errors.join('\n')}`);
  const session = await findSession(root, sessionId);
  if (session.status !== 'active') throw new Error(`Session is already completed: ${sessionId}`);
  let html = await readFile(session.absolute, 'utf8');
  const metadata = readMetadata(html);
  const id = String(metadata.id ?? sessionId);
  const affectedAreas = Array.isArray(metadata.affected_areas) ? metadata.affected_areas as string[] : [];
  metadata.status = 'completed';
  metadata.updated_at = nowIso();
  if (Array.isArray(metadata.cards)) {
    metadata.cards = (metadata.cards as Record<string, unknown>[]).map((card) => ({ ...card, status: card.type === 'stale-cleanup' ? card.status : 'pending-human-review' }));
  }
  html = html.replaceAll('data-status="agent-draft"', 'data-status="pending-human-review"');
  html = replaceMetadata(html, metadata);
  const completedContentRelative = `sessions/completed/${id}.html`;
  const completedAbsolute = contentPath(root, completedContentRelative);
  await mkdir(dirname(completedAbsolute), { recursive: true });
  await writeFile(session.absolute, html, 'utf8');
  await rename(session.absolute, completedAbsolute);

  const deltaContentRelative = `deltas/${id}.html`;
  const deltaRootRelative = rootRelativeContentPath(deltaContentRelative);
  const deltaHtml = pageLayout(`Implementation Delta ${id}`, `<h1>Implementation Delta</h1><section data-section="summary"><p>Session <a href="/sessions/completed/${escapeHtml(id)}">${escapeHtml(id)}</a> was finalized.</p><p>Affected areas: ${escapeHtml(affectedAreas.join(', ') || 'none')}</p></section>`, { type: 'delta', session: id, affected_areas: affectedAreas, created_at: nowIso() });
  await writeAtomic(contentPath(root, deltaContentRelative), deltaHtml);
  for (const area of affectedAreas) await appendAreaDeltaLink(root, area, deltaContentRelative, id);
  await updateClaimsForSession(root, id, completedContentRelative, 'pending-human-review');
  await writeAtomic(contentPath(root, 'stale/index.html'), pageLayout('Stale Knowledge', `<h1>Stale Knowledge</h1><section><p class="muted">Latest finalized session checked stale knowledge: ${escapeHtml(id)}</p></section>`, { type: 'stale', latest_session: id }));
  await internalGitCommit(root, `hitl finalize: ${id}`);
  return { completedPath: rootRelativeContentPath(completedContentRelative), deltaPath: deltaRootRelative };
}
