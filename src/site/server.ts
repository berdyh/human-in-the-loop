import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { assertSafePathSegment, contentPath, exists } from '../core/paths.js';
import { internalGitLog } from '../git/internalGit.js';
import { historyPage } from '../html/historyPage.js';
import { validateWorkspace } from '../validation/validateWorkspace.js';
import { areaDocFileForRouteSlug } from '../docs/areaDocs.js';
import { registerHitlPort } from './ports.js';

function routeSegment(kind: string, value: string | undefined): string | null {
  if (!value) return null;
  try {
    return assertSafePathSegment(kind, value);
  } catch {
    return null;
  }
}

function routeToContentPath(root: string, pathname: string): string | null {
  if (pathname === '/') return contentPath(root, 'project.html');
  if (pathname === '/graph') return contentPath(root, 'graph.html');
  if (pathname === '/questions') return contentPath(root, 'questions/index.html');
  if (pathname === '/stale') return contentPath(root, 'stale/index.html');
  if (pathname === '/review') return contentPath(root, 'review/index.html');
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 3 && parts[0] === 'areas' && parts[2] === 'agent-context') {
    const id = routeSegment('area id', parts[1]);
    return id ? contentPath(root, 'areas', id, 'agent-context.html') : null;
  }
  if (parts.length === 3 && parts[0] === 'areas') {
    const id = routeSegment('area id', parts[1]);
    const file = areaDocFileForRouteSlug(parts[2]);
    return id && file ? contentPath(root, 'areas', id, file) : null;
  }
  if (parts.length === 2 && parts[0] === 'areas') {
    const id = routeSegment('area id', parts[1]);
    return id ? contentPath(root, 'areas', id, 'page.html') : null;
  }
  if (parts.length === 3 && parts[0] === 'tasks' && parts[2] === 'agent-context') {
    const id = routeSegment('task id', parts[1]);
    return id ? contentPath(root, 'tasks', id, 'agent-context.html') : null;
  }
  if (parts.length === 2 && parts[0] === 'tasks') {
    const id = routeSegment('task id', parts[1]);
    return id ? contentPath(root, 'tasks', id, 'page.html') : null;
  }
  if (parts.length === 2 && parts[0] === 'decisions') {
    const id = routeSegment('decision id', parts[1]);
    return id ? contentPath(root, 'decisions', `${id}.html`) : null;
  }
  if (parts.length === 3 && parts[0] === 'sessions' && (parts[1] === 'active' || parts[1] === 'completed')) {
    const id = routeSegment('session id', parts[2]);
    return id ? contentPath(root, 'sessions', parts[1], `${id}.html`) : null;
  }
  if (parts.length === 2 && parts[0] === 'deltas') {
    const id = routeSegment('delta id', parts[1]);
    return id ? contentPath(root, 'deltas', `${id}.html`) : null;
  }
  return null;
}

export function createHitlServer(root: string): Server {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (url.pathname === '/api/status') {
        const status = await validateWorkspace(root);
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ hitl: true, server_pid: process.pid, ok: status.ok, errors: status.errors, workspace: '.humanintheloop' }));
        return;
      }
      if (url.pathname === '/history') {
        const log = await internalGitLog(root);
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end(historyPage(log));
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

export async function serve(root: string, port: number, options: { register?: boolean } = {}): Promise<Server> {
  const server = createHitlServer(root);
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  if (options.register) {
    await registerHitlPort(root, {
      port,
      pid: process.pid,
      started_at: new Date().toISOString(),
      url: `http://127.0.0.1:${port}`
    });
  }
  return server;
}
