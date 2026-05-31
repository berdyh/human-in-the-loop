import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { ensureWorkspace } from '../../src/workspace/init.js';

describe('workspace managed HTML refresh', () => {
  test('refreshes existing managed scaffold pages to the current layout shell', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-managed-refresh-'));
    await ensureWorkspace(root);
    const projectPath = join(root, '.humanintheloop/content/project.html');
    await writeFile(projectPath, `<!doctype html>
<html lang="en">
<head><title>Old shell</title></head>
<body>
  <header>
    <nav><a href="/history">History</a></nav>
  </header>
  <main><h1>Old Project</h1></main>
<script type="application/hitl+json">
{
  "type": "project",
  "areas": ["data-spine"]
}
</script>
</body>
</html>
`, 'utf8');

    await ensureWorkspace(root);

    const html = await readFile(projectPath, 'utf8');
    expect(html).toContain('data-hitl-layout-version=');
    expect(html).toContain('class="sidebar"');
    expect(html).not.toContain('<header>\n    <nav>');
  });

  test('force refresh updates managed pages even when the layout version is current', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-managed-force-refresh-'));
    await ensureWorkspace(root);
    const projectPath = join(root, '.humanintheloop/content/project.html');
    const current = await readFile(projectPath, 'utf8');
    await writeFile(projectPath, current.replace('Default Areas', 'Old Managed Areas'), 'utf8');

    await ensureWorkspace(root, { refreshManaged: true });

    const html = await readFile(projectPath, 'utf8');
    expect(html).toContain('Default Areas');
    expect(html).not.toContain('Old Managed Areas');
  });

  test('force refresh preserves dynamic area links and finalized memory cards', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-managed-dynamic-area-refresh-'));
    await ensureWorkspace(root);
    const areaPath = join(root, '.humanintheloop/content/areas/frontend-dashboard/page.html');
    const current = await readFile(areaPath, 'utf8');
    await writeFile(areaPath, current
      .replace('<section id="recent-memory"', '<section data-section="journey-notes"><h2>User Journey Trace Notes</h2><p><a href="/areas/frontend-dashboard/journey">User journey trace notes</a></p></section>\n<section id="recent-memory"')
      .replace('<p class="muted">No finalized implementation memory yet.</p>', '<div class="hitl-card" data-hitl-card="true"><h3>Recent implementation memory</h3><p><a href="/deltas/session-123">delta</a></p></div>'), 'utf8');

    await ensureWorkspace(root, { refreshManaged: true });

    const refreshed = await readFile(areaPath, 'utf8');
    expect(refreshed).toContain('data-hitl-layout-version=');
    expect(refreshed).toContain('/areas/frontend-dashboard/journey');
    expect(refreshed).toContain('/deltas/session-123');
    expect(refreshed).not.toContain('No finalized implementation memory yet.');
  });

  test('force refresh preserves replacement tokens in dynamic area HTML verbatim', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-managed-replacement-token-refresh-'));
    await ensureWorkspace(root);
    const areaPath = join(root, '.humanintheloop/content/areas/frontend-dashboard/page.html');
    const current = await readFile(areaPath, 'utf8');
    const tokenExample = "Preserve literal replacement tokens: $& $1 $' $$";
    await writeFile(areaPath, current
      .replace('<section id="recent-memory"', () => `<section data-section="journey-notes"><h2>User Journey Trace Notes</h2><pre>${tokenExample}</pre></section>\n<section id="recent-memory"`)
      .replace('<p class="muted">No finalized implementation memory yet.</p>', () => `<div class="hitl-card" data-hitl-card="true"><h3>Recent implementation memory</h3><pre>${tokenExample}</pre></div>`), 'utf8');

    await ensureWorkspace(root, { refreshManaged: true });

    const refreshed = await readFile(areaPath, 'utf8');
    expect(refreshed).toContain(`<pre>${tokenExample}</pre>`);
  });

  test('force refresh preserves dynamic stale knowledge state', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-managed-stale-refresh-'));
    await ensureWorkspace(root);
    const stalePath = join(root, '.humanintheloop/content/stale/index.html');
    const stale = await readFile(stalePath, 'utf8');
    await writeFile(stalePath, stale
      .replace('No stale HITL claims recorded.', 'Latest finalized session checked stale knowledge: session-123')
      .replace('"type": "stale"', '"type": "stale",\n  "latest_session": "session-123"'), 'utf8');

    await ensureWorkspace(root, { refreshManaged: true });

    const refreshed = await readFile(stalePath, 'utf8');
    expect(refreshed).toContain('data-hitl-layout-version=');
    expect(refreshed).toContain('Latest finalized session checked stale knowledge: session-123');
    expect(refreshed).toContain('"latest_session": "session-123"');
  });

  test('force refresh preserves legacy stale knowledge state without content-container wrapper', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-managed-legacy-stale-refresh-'));
    await ensureWorkspace(root);
    const stalePath = join(root, '.humanintheloop/content/stale/index.html');
    await writeFile(stalePath, `<!doctype html>
<html lang="en">
<head><title>Old stale shell</title></head>
<body>
<main><h1>Stale Knowledge</h1><section><p class="muted">Latest finalized session checked stale knowledge: session-legacy</p></section></main>
<script type="application/hitl+json">
{
  "type": "stale",
  "latest_session": "session-legacy"
}
</script>
</body>
</html>
`, 'utf8');

    await ensureWorkspace(root, { refreshManaged: true });

    const refreshed = await readFile(stalePath, 'utf8');
    expect(refreshed).toContain('data-hitl-layout-version=');
    expect(refreshed).toContain('Latest finalized session checked stale knowledge: session-legacy');
    expect(refreshed).toContain('"latest_session": "session-legacy"');
  });

  test('automatic layout migration preserves dynamic HITL memory state', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-managed-auto-dynamic-refresh-'));
    await ensureWorkspace(root);
    const areaPath = join(root, '.humanintheloop/content/areas/frontend-dashboard/page.html');
    const current = await readFile(areaPath, 'utf8');
    await writeFile(areaPath, current
      .replace('data-hitl-layout-version="2026-05-31-docs-shell-v3"', 'data-hitl-layout-version="old-shell"')
      .replace('<section id="recent-memory"', '<section data-section="journey-notes"><h2>User Journey Trace Notes</h2><p><a href="/areas/frontend-dashboard/journey">User journey trace notes</a></p></section>\n<section id="recent-memory"')
      .replace('<p class="muted">No finalized implementation memory yet.</p>', '<div class="hitl-card" data-hitl-card="true"><h3>Recent implementation memory</h3><p><a href="/deltas/session-456">delta</a></p></div>'), 'utf8');

    await ensureWorkspace(root);

    const refreshed = await readFile(areaPath, 'utf8');
    expect(refreshed).toContain('data-hitl-layout-version="2026-05-31-docs-shell-v3"');
    expect(refreshed).toContain('/areas/frontend-dashboard/journey');
    expect(refreshed).toContain('/deltas/session-456');
    expect(refreshed).not.toContain('No finalized implementation memory yet.');
  });

  test('preserves non-managed human-authored HTML content', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-human-preserve-'));
    await ensureWorkspace(root);
    const areaPath = join(root, '.humanintheloop/content/areas/data-spine/custom.html');
    await writeFile(areaPath, '<!doctype html><p>Human-authored notes</p>', 'utf8');

    await ensureWorkspace(root);

    await expect(readFile(areaPath, 'utf8')).resolves.toBe('<!doctype html><p>Human-authored notes</p>');
  });
});
