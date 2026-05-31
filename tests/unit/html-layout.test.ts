import { describe, expect, test } from 'vitest';
import { graphPage, pageLayout, projectPage } from '../../src/html/templates.js';
import { historyPage } from '../../src/html/historyPage.js';

describe('HITL HTML layout system', () => {
  test('pageLayout renders a versioned modern docs shell without legacy top nav', () => {
    const html = pageLayout('Example Page', '<h1>Example Page</h1><section><p>Body</p></section>', { type: 'example' });

    expect(html).toContain('data-hitl-layout-version=');
    expect(html).toContain('class="sidebar"');
    expect(html).toContain('class="site-main"');
    expect(html).toContain('id="theme-toggle"');
    expect(html).toContain('data-theme');
    expect(html).toContain('application/hitl+json');
    expect(html).not.toContain('<header>\n    <nav>');
    expect(html).not.toContain('ui-serif');
  });

  test('pageLayout suppresses the trailing divider on the final content section', () => {
    const html = pageLayout('Example Page', '<h1>Example Page</h1><section><p>Body</p></section>', { type: 'example' });

    expect(html).toContain('.content-container > section:last-child');
    expect(html).toContain('border-bottom: 0');
  });

  test('projectPage makes each area card a full-card link target', () => {
    const html = projectPage();

    expect(html).toContain('<a class="panel panel-link" href="/areas/data-spine">');
    expect(html).toContain('<span class="panel-title">Data Spine</span>');
    expect(html).not.toContain('<div class="panel"><h3><a href="/areas/data-spine">');
  });

  test('graphPage renders grouped relationship sections instead of one flat catalog grid', () => {
    const html = graphPage();

    expect(html).toContain('data-section="graph-map"');
    expect(html).toContain('class="graph-row"');
    expect(html).toContain('Connected tasks');
    expect(html).toContain('Decision anchors');
    expect(html).toContain('data-section="task-entry-points"');
    expect(html).toContain('data-section="decision-anchors"');
  });

  test('historyPage escapes log text and renders a route-specific history panel', () => {
    const html = historyPage('a1b2c3d hitl note: <Normalize>\n4e5f6g7 hitl finalize', undefined);

    expect(html).toContain('data-page="history"');
    expect(html).toContain('class="history-log"');
    expect(html).toContain('class="history-entry"');
    expect(html).toContain('class="history-sha">a1b2c3d</code>');
    expect(html).toContain('&lt;Normalize&gt;');
    expect(html).not.toContain('<Normalize>');
    expect(html).toContain('HITL History');
  });

  test('historyPage shows a clear empty state when no internal history exists', () => {
    const html = historyPage('', undefined);

    expect(html).toContain('No internal history yet.');
    expect(html).toContain('class="empty-state"');
  });
});
