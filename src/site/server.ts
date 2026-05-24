import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { contentPath, exists } from '../core/paths.js';
import { internalGitLog } from '../git/internalGit.js';
import { escapeHtml } from '../html/escapeHtml.js';
import { pageLayout } from '../html/templates.js';
import { validateWorkspace } from '../validation/validateWorkspace.js';

function routeToContentPath(root: string, pathname: string): string | null {
  if (pathname === '/') return contentPath(root, 'project.html');
  if (pathname === '/graph') return contentPath(root, 'graph.html');
  if (pathname === '/questions') return contentPath(root, 'questions/index.html');
  if (pathname === '/stale') return contentPath(root, 'stale/index.html');
  if (pathname === '/review') return contentPath(root, 'review/index.html');
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === 'areas' && parts[1] && parts[2] === 'agent-context') return contentPath(root, 'areas', parts[1], 'agent-context.html');
  if (parts[0] === 'areas' && parts[1]) return contentPath(root, 'areas', parts[1], 'page.html');
  if (parts[0] === 'tasks' && parts[1] && parts[2] === 'agent-context') return contentPath(root, 'tasks', parts[1], 'agent-context.html');
  if (parts[0] === 'tasks' && parts[1]) return contentPath(root, 'tasks', parts[1], 'page.html');
  if (parts[0] === 'decisions' && parts[1]) return contentPath(root, 'decisions', `${parts[1]}.html`);
  if (parts[0] === 'sessions' && (parts[1] === 'active' || parts[1] === 'completed') && parts[2]) return contentPath(root, 'sessions', parts[1], `${parts[2]}.html`);
  if (parts[0] === 'deltas' && parts[1]) return contentPath(root, 'deltas', `${parts[1]}.html`);
  return null;
}

export function createHitlServer(root: string): Server {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (url.pathname === '/api/status') {
        const status = await validateWorkspace(root);
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ ok: status.ok, errors: status.errors, workspace: '.humanintheloop' }));
        return;
      }
      if (url.pathname === '/history') {
        const log = await internalGitLog(root);
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end(pageLayout('HITL History', `<h1>HITL History</h1><pre>${escapeHtml(log || 'No internal history yet.')}</pre>`, { type: 'history' }));
        return;
      }
      const path = routeToContentPath(root, url.pathname);
      if (!path || !(await exists(path))) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('Not found');
        return;
      }
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(await readFile(path, 'utf8'));
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end((error as Error).message);
    }
  });
}

export async function serve(root: string, port: number): Promise<Server> {
  const server = createHitlServer(root);
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  return server;
}
