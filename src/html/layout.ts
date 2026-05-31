import { escapeHtml, safeMetadataJson } from './escapeHtml.js';

export const HITL_LAYOUT_VERSION = '2026-05-31-docs-shell-v3';

export function metadataScript(metadata: unknown): string {
  return `<script type="application/hitl+json">\n${safeMetadataJson(metadata)}\n</script>`;
}

function metadataType(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object' || !('type' in metadata)) return 'page';
  const type = (metadata as { type?: unknown }).type;
  return typeof type === 'string' && type ? type : 'page';
}

function navLink(href: string, label: string, icon: string): string {
  return `<a href="${href}" class="menu-item" data-route="${href}">
    ${icon}
    <span>${label}</span>
  </a>`;
}

const icons = {
  project: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z"/><path d="M12 12 4.4 7.7"/><path d="M12 12l7.6-4.3"/><path d="M12 12v8.5"/></svg>',
  graph: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="7" r="3"/><circle cx="18" cy="7" r="3"/><circle cx="12" cy="18" r="3"/><path d="m8.3 9.4 2.4 5.2"/><path d="m15.7 9.4-2.4 5.2"/><path d="M9 7h6"/></svg>',
  review: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6V3Z"/><path d="M14 3v4h4"/><path d="M9 12h6"/><path d="M9 16h6"/></svg>',
  questions: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.7 2.7 0 0 1 5.2 1c0 1.9-2.7 2.2-2.7 4"/><path d="M12 17.5h.01"/></svg>',
  stale: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.8 19h18.4L12 3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  history: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v6h6"/><path d="M12 7v5l3 2"/></svg>'
};

export function pageLayout(title: string, body: string, metadata: unknown): string {
  const type = metadataType(metadata);
  return `<!doctype html>
<html lang="en" data-hitl-layout-version="${HITL_LAYOUT_VERSION}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <script>
    (function() {
      try {
        var savedTheme = window.localStorage && window.localStorage.getItem('hitl-theme');
        var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        var activeTheme = savedTheme || (prefersDark ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', activeTheme);
      } catch (_) {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    })();
  </script>
  <style>
    :root {
      color-scheme: light;
      --font-sans: Aptos, "Segoe UI", ui-sans-serif, system-ui, sans-serif;
      --font-mono: "Cascadia Code", "SFMono-Regular", Consolas, ui-monospace, monospace;
      --bg: #f7f9fb;
      --surface: #ffffff;
      --surface-2: #f1f5f7;
      --sidebar: #fbfcfd;
      --border: #d9e1e7;
      --border-strong: #bcc9d3;
      --text: #16202a;
      --text-muted: #5f6f7f;
      --text-soft: #7a8998;
      --accent: #0f766e;
      --accent-strong: #0b5f59;
      --accent-soft: rgba(15, 118, 110, 0.1);
      --blue: #2563eb;
      --amber: #b45309;
      --rose: #be123c;
      --shadow: 0 8px 24px rgba(21, 31, 43, 0.06);
    }

    html[data-theme="dark"] {
      color-scheme: dark;
      --bg: #0b1117;
      --surface: #101820;
      --surface-2: #141f29;
      --sidebar: #0e151d;
      --border: #24313d;
      --border-strong: #354555;
      --text: #e7edf3;
      --text-muted: #a7b4c0;
      --text-soft: #7f90a0;
      --accent: #34d399;
      --accent-strong: #6ee7b7;
      --accent-soft: rgba(52, 211, 153, 0.12);
      --blue: #60a5fa;
      --amber: #fbbf24;
      --rose: #fb7185;
      --shadow: 0 14px 34px rgba(0, 0, 0, 0.3);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-sans);
      line-height: 1.6;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }

    a { color: var(--accent-strong); text-decoration: none; font-weight: 600; }
    a:hover { color: var(--accent); text-decoration: underline; }

    .mobile-bar {
      display: none;
      height: 56px;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0 1rem;
      background: var(--sidebar);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 20;
    }

    .sidebar {
      width: 272px;
      min-height: 100vh;
      position: sticky;
      top: 0;
      align-self: flex-start;
      flex: 0 0 272px;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      padding: 1.25rem 1rem;
      background: var(--sidebar);
      border-right: 1px solid var(--border);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 0;
    }

    .brand-mark {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      display: inline-grid;
      place-items: center;
      color: var(--accent-strong);
      background: var(--accent-soft);
      border: 1px solid rgba(15, 118, 110, 0.18);
      font-family: var(--font-mono);
      font-size: 0.8rem;
      font-weight: 700;
    }

    .brand-title {
      display: block;
      color: var(--text);
      font-size: 0.95rem;
      line-height: 1.2;
      font-weight: 700;
      letter-spacing: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .brand-subtitle {
      display: block;
      color: var(--text-soft);
      font-family: var(--font-mono);
      font-size: 0.72rem;
      line-height: 1.4;
    }

    .sidebar-section-label {
      margin: 0 0 0.35rem;
      color: var(--text-soft);
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    .sidebar-menu {
      display: grid;
      gap: 0.2rem;
    }

    .menu-item {
      display: flex;
      align-items: center;
      gap: 0.7rem;
      min-height: 36px;
      padding: 0.45rem 0.6rem;
      border-radius: 8px;
      color: var(--text-muted);
      font-size: 0.92rem;
      font-weight: 600;
    }

    .menu-item svg {
      width: 18px;
      height: 18px;
      flex: 0 0 auto;
      stroke: currentColor;
      stroke-width: 1.8;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .menu-item:hover,
    .menu-item.active {
      background: var(--surface-2);
      color: var(--text);
      text-decoration: none;
    }

    .menu-item.active {
      box-shadow: inset 3px 0 0 var(--accent);
    }

    .sidebar-footer {
      margin-top: auto;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
    }

    .theme-toggle,
    .menu-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 34px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      color: var(--text);
      font: inherit;
      font-size: 0.86rem;
      font-weight: 700;
      cursor: pointer;
    }

    .theme-toggle {
      width: 100%;
      gap: 0.45rem;
    }

    .theme-toggle:hover,
    .menu-toggle:hover {
      border-color: var(--border-strong);
      box-shadow: var(--shadow);
    }

    html[data-theme="dark"] .theme-label-light,
    html:not([data-theme="dark"]) .theme-label-dark {
      display: none;
    }

    .site-main {
      flex: 1 1 auto;
      min-width: 0;
      display: block;
    }

    .content-container {
      width: min(100%, 980px);
      margin: 0 auto;
      padding: 3rem 2rem 5rem;
    }

    h1, h2, h3, h4 {
      margin-top: 0;
      color: var(--text);
      line-height: 1.2;
      letter-spacing: 0;
    }

    h1 { margin-bottom: 0.6rem; font-size: 2.3rem; }
    h2 { margin: 2rem 0 0.9rem; font-size: 1.35rem; }
    h3 { margin: 0 0 0.45rem; font-size: 1rem; }

    p { margin: 0 0 1rem; color: var(--text-muted); }
    .muted { color: var(--text-muted); }

    .panel,
    .hitl-card,
    .callout,
    .empty-state {
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      box-shadow: var(--shadow);
    }

    .panel,
    .hitl-card,
    .empty-state {
      padding: 1.15rem;
      margin: 1rem 0;
    }

    section {
      margin: 2rem 0;
      padding: 0 0 1.25rem;
      border-bottom: 1px solid var(--border);
    }

    .content-container > section:last-child {
      padding-bottom: 0;
      border-bottom: 0;
    }

    .panel:hover,
    .hitl-card:hover {
      border-color: var(--border-strong);
    }

    a.panel-link {
      display: block;
      min-height: 9.25rem;
      color: inherit;
      text-decoration: none;
      font-weight: inherit;
    }

    a.panel-link:hover {
      color: inherit;
      text-decoration: none;
      transform: translateY(-1px);
    }

    a.panel-link:focus-visible {
      outline: 3px solid var(--accent-soft);
      outline-offset: 3px;
    }

    .panel h3 {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      flex-wrap: wrap;
    }

    .panel-title {
      display: block;
      color: var(--accent-strong);
      font-weight: 700;
    }

    .panel-link:hover .panel-title {
      color: var(--accent);
    }

    .panel p:last-child {
      margin-bottom: 0;
    }

    .panel-link p {
      font-weight: 400;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 0.9rem;
      margin-top: 1rem;
    }

    ul, ol {
      margin: 0 0 1rem 0;
      padding-left: 1.25rem;
      color: var(--text-muted);
    }

    li { margin: 0.35rem 0; }

    code,
    pre {
      font-family: var(--font-mono);
    }

    code {
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.1rem 0.35rem;
      background: var(--surface-2);
      color: var(--accent-strong);
      font-size: 0.88em;
    }

    pre,
    .history-log {
      overflow: auto;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface-2);
      padding: 1rem;
      color: var(--text);
      font-size: 0.88rem;
      line-height: 1.7;
    }

    .history-log {
      max-height: 60vh;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .history-list {
      list-style: none;
      margin: 0;
      padding: 0;
      background: var(--surface);
      white-space: normal;
      word-break: normal;
    }

    .history-entry {
      display: grid;
      grid-template-columns: minmax(6.5rem, 7.5rem) minmax(0, 1fr);
      gap: 0.85rem;
      align-items: start;
      padding: 0.75rem 0.85rem;
      border-bottom: 1px solid var(--border);
      color: var(--text-muted);
    }

    .history-entry:last-child {
      border-bottom: 0;
    }

    .history-sha {
      width: fit-content;
      color: var(--accent-strong);
    }

    .history-message {
      min-width: 0;
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 0.88rem;
      overflow-wrap: anywhere;
    }

    .history-entry-raw .history-message {
      color: var(--text-muted);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
      font-size: 0.92rem;
    }

    th, td {
      padding: 0.65rem 0.75rem;
      border-bottom: 1px solid var(--border);
      text-align: left;
      vertical-align: top;
    }

    th {
      color: var(--text);
      background: var(--surface-2);
      font-weight: 700;
    }

    td { color: var(--text-muted); }

    .callout {
      padding: 1rem;
      border-color: rgba(15, 118, 110, 0.25);
      background: var(--accent-soft);
    }

    .callout p:last-child,
    .empty-state p:last-child {
      margin-bottom: 0;
    }

    .hitl-card {
      border-left: 4px solid var(--accent);
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
      flex-wrap: wrap;
    }

    .card-type-tag,
    .status-badge,
    .node-tag {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      border: 1px solid var(--border);
      padding: 0.13rem 0.5rem;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    .card-type-tag { color: var(--text-muted); background: var(--surface-2); }
    .status-badge { color: var(--blue); background: rgba(37, 99, 235, 0.1); }
    .badge-accepted { color: var(--accent-strong); background: var(--accent-soft); }
    .badge-agent-draft { color: var(--blue); background: rgba(37, 99, 235, 0.1); }
    .badge-pending-human-review { color: var(--amber); background: rgba(180, 83, 9, 0.12); }
    .badge-stale,
    .badge-superseded,
    .badge-kept-with-warning { color: var(--rose); background: rgba(190, 18, 60, 0.1); }

    .card-why,
    .card-files {
      padding-top: 0.65rem;
      margin-top: 0.65rem;
      border-top: 1px dashed var(--border);
      font-size: 0.9rem;
    }

    .node-tag { margin-right: 0.45rem; }
    .area-tag { color: var(--accent-strong); background: var(--accent-soft); }
    .task-tag { color: var(--blue); background: rgba(37, 99, 235, 0.1); }
    .decision-tag { color: var(--amber); background: rgba(180, 83, 9, 0.12); }

    .history-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin: 1rem 0;
    }

    .history-chip {
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 0.2rem 0.65rem;
      color: var(--text-muted);
      background: var(--surface);
      font-family: var(--font-mono);
      font-size: 0.78rem;
    }

    .graph-section {
      margin-top: 2rem;
    }

    .graph-map {
      display: grid;
      gap: 0.85rem;
      margin-top: 1rem;
    }

    .graph-row {
      display: grid;
      grid-template-columns: minmax(220px, 0.92fr) minmax(0, 1.35fr);
      gap: 1rem;
      align-items: start;
      padding: 1rem 0;
      border-bottom: 1px solid var(--border);
    }

    .graph-row:first-child {
      border-top: 1px solid var(--border);
    }

    .graph-node {
      display: block;
      color: inherit;
      text-decoration: none;
      font-weight: inherit;
    }

    .graph-node:hover {
      text-decoration: none;
    }

    .graph-node .panel-title {
      margin-top: 0.45rem;
    }

    .graph-node .muted {
      display: block;
      margin-top: 0.3rem;
      font-size: 0.92rem;
      font-weight: 400;
    }

    .graph-links {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
    }

    .graph-link-group {
      min-width: 0;
    }

    .graph-link-group h3 {
      margin-bottom: 0.45rem;
      color: var(--text-soft);
      font-size: 0.78rem;
      text-transform: uppercase;
    }

    .chip-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
    }

    .graph-chip {
      display: inline-flex;
      align-items: center;
      min-height: 2rem;
      max-width: 100%;
      padding: 0.25rem 0.6rem;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: var(--surface-2);
      color: var(--text-muted);
      font-size: 0.86rem;
      font-weight: 700;
      overflow-wrap: anywhere;
    }

    .graph-chip:hover {
      border-color: var(--border-strong);
      color: var(--accent-strong);
      text-decoration: none;
    }

    .graph-mini-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 0.9rem;
      margin-top: 1rem;
    }

    @media (max-width: 820px) {
      body { display: block; }
      .mobile-bar { display: flex; }
      .sidebar {
        position: fixed;
        inset: 0 auto 0 0;
        transform: translateX(-100%);
        transition: transform 0.18s ease;
        z-index: 30;
        box-shadow: 18px 0 40px rgba(0, 0, 0, 0.22);
      }
      .sidebar.mobile-open { transform: translateX(0); }
      .content-container { padding: 2rem 1rem 4rem; }
      h1 { font-size: 1.8rem; }
      .graph-row,
      .graph-links {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 620px) {
      .history-entry {
        grid-template-columns: 1fr;
        gap: 0.45rem;
      }
    }
  </style>
</head>
<body data-page="${escapeHtml(type)}">
  <div class="mobile-bar">
    <div class="brand">
      <span class="brand-mark">H</span>
      <span class="brand-title">Human in the Loop</span>
    </div>
    <button class="menu-toggle" id="mobile-menu-toggle" type="button" aria-label="Open navigation">Menu</button>
  </div>

  <aside class="sidebar" aria-label="Primary navigation">
    <div class="brand">
      <span class="brand-mark">H</span>
      <span>
        <span class="brand-title">Human in the Loop</span>
        <span class="brand-subtitle">.humanintheloop</span>
      </span>
    </div>

    <div>
      <p class="sidebar-section-label">Workspace</p>
      <nav class="sidebar-menu">
        ${navLink('/', 'Project', icons.project)}
        ${navLink('/graph', 'Graph', icons.graph)}
        ${navLink('/review', 'Review', icons.review)}
        ${navLink('/questions', 'Questions', icons.questions)}
        ${navLink('/stale', 'Stale', icons.stale)}
        ${navLink('/history', 'History', icons.history)}
      </nav>
    </div>

    <div class="sidebar-footer">
      <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Toggle color theme">
        <span class="theme-label-light">Use dark theme</span>
        <span class="theme-label-dark">Use light theme</span>
      </button>
    </div>
  </aside>

  <main class="site-main">
    <div class="content-container">
      ${body}
    </div>
  </main>

  ${metadataScript(metadata)}

  <script>
    (function() {
      var sidebar = document.querySelector('.sidebar');
      var mobileToggle = document.getElementById('mobile-menu-toggle');
      var themeToggle = document.getElementById('theme-toggle');

      if (mobileToggle && sidebar) {
        mobileToggle.addEventListener('click', function(event) {
          event.stopPropagation();
          sidebar.classList.toggle('mobile-open');
        });
        document.querySelector('.site-main').addEventListener('click', function() {
          sidebar.classList.remove('mobile-open');
        });
      }

      if (themeToggle) {
        themeToggle.addEventListener('click', function() {
          var current = document.documentElement.getAttribute('data-theme') || 'light';
          var next = current === 'dark' ? 'light' : 'dark';
          document.documentElement.setAttribute('data-theme', next);
          try { window.localStorage && window.localStorage.setItem('hitl-theme', next); } catch (_) {}
        });
      }

      var path = window.location.pathname || '/';
      document.querySelectorAll('.menu-item').forEach(function(link) {
        var href = link.getAttribute('data-route');
        if (href === path || (href !== '/' && path.indexOf(href) === 0)) {
          link.classList.add('active');
        }
      });
    })();
  </script>
</body>
</html>
`;
}
