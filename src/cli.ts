#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { Command } from 'commander';
import { ensureWorkspace } from './workspace/init.js';
import { routeContext, type ContextItem, type RouteContextResult } from './routing/router.js';
import { startSession, addNote, recordCleanup, finalizeSession, findSession } from './sessions/sessionStore.js';
import { mappedAreasFromFileAreaMap, validateFiles, validateSession, validateWorkspace } from './validation/validateWorkspace.js';
import { internalGitLog, projectChangedFiles } from './git/internalGit.js';
import { reviewClaim } from './review/reviewClaims.js';
import { serve } from './site/server.js';
import { DEFAULT_AREAS, DEFAULT_DECISIONS } from './html/templates.js';
import { assertSafePathSegment, exists, hitlPath } from './core/paths.js';
import { readMetadata } from './html/cards.js';
import { AREA_DOC_KINDS, createAreaDocs } from './docs/areaDocs.js';
import { createDatabaseDocs } from './docs/dbDocs.js';
import { cleanHitlPortRegistry, closeHitlPorts, readHitlPortRegistry, unregisterHitlPid, verifyRegisteredHitlServer } from './site/ports.js';
import { installAgentSkills, parseAgentTargets } from './agents/install.js';

function parseFiles(value?: string): string[] {
  return value ? value.split(/[\s,]+/).map((file) => file.trim()).filter(Boolean) : [];
}

function printValidation(prefix: string, result: { ok: boolean; errors: string[]; warnings: string[] }): void {
  if (result.ok) {
    console.log(`${prefix}: Validation passed`);
    for (const warning of result.warnings) console.log(`Warning: ${warning}`);
  } else {
    console.error(`${prefix}: Validation failed`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  }
}

function parsePort(value: string | number): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid port: ${value}`);
  return port;
}

function packageRoot(): string {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

async function installAgentsFromOptions(options: { target?: string; codexDir?: string; claudeDir?: string }): Promise<void> {
  const installed = await installAgentSkills({
    packageRoot: packageRoot(),
    targets: parseAgentTargets(options.target),
    codexSkillsDir: options.codexDir,
    claudeSkillsDir: options.claudeDir
  });
  for (const result of installed) {
    const verb = result.action === 'installed' ? 'Installed' : 'Updated';
    console.log(`${verb} ${result.target} HITL skill: ${result.path}`);
  }
}

async function waitForExposedServer(root: string, port: number): Promise<void> {
  const deadline = Date.now() + 3000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const record = (await readHitlPortRegistry(root)).find((candidate) => candidate.port === port);
      if (record && await verifyRegisteredHitlServer(record)) return;
      lastError = new Error(`No verified HITL registry entry for port ${port}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveReady) => setTimeout(resolveReady, 50));
  }
  throw lastError instanceof Error ? new Error(`Timed out waiting for registered HITL port ${port}: ${lastError.message}`) : new Error(`Timed out waiting for registered HITL port ${port}`);
}

function sortContextItems(items: ContextItem[]): ContextItem[] {
  return items.sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id));
}

function removeContextItem(items: ContextItem[], id: string, type: ContextItem['type']): ContextItem | undefined {
  const index = items.findIndex((item) => item.id === id && item.type === type);
  if (index === -1) return undefined;
  return items.splice(index, 1)[0];
}

type SessionContextInput = { task: string; files: string[]; areas: string[] };

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

async function contextInputFromSession(root: string, sessionId?: string): Promise<SessionContextInput> {
  if (!sessionId) return { task: '', files: [], areas: [] };
  const session = await findSession(root, sessionId);
  const metadata = readMetadata(await readFile(session.absolute, 'utf8'));
  const task = [metadata.spec, metadata.task].filter((item): item is string => typeof item === 'string').join(' ');
  return {
    task,
    files: stringArray(metadata.files),
    areas: stringArray(metadata.affected_areas).map((area) => assertSafePathSegment('session affected area id', area))
  };
}

async function contextWithFileAreaMap(root: string, task: string, files: string[], sessionAreas: string[] = []): Promise<RouteContextResult> {
  const context = routeContext({ task, files });
  let mappedAreas = [...sessionAreas];
  if (files.length && await exists(hitlPath(root, 'indexes/file-area-map.json'))) {
    mappedAreas = [...new Set([...mappedAreas, ...await mappedAreasFromFileAreaMap(root, files)])];
  }
  for (const area of mappedAreas) {
    const existing = context.required.find((item) => item.id === area && item.type === 'area')
      ?? removeContextItem(context.recommended, area, 'area')
      ?? removeContextItem(context.possible, area, 'area');
    const item: ContextItem = existing
      ? { ...existing, confidence: Math.max(existing.confidence, 0.91), reason: `${existing.reason}; matched persisted file-area-map` }
      : { id: area, type: 'area', path: `.humanintheloop/content/areas/${area}/agent-context.html`, confidence: 0.91, reason: 'matched persisted file-area-map' };
    if (!context.required.some((candidate) => candidate.id === area && candidate.type === 'area')) context.required.push(item);
    const areaDef = DEFAULT_AREAS.find((candidate) => candidate.id === area);
    for (const decisionId of areaDef?.related_decisions ?? []) {
      const knownDecision = DEFAULT_DECISIONS.find((decision) => decision.id === decisionId);
      if (!knownDecision) continue;
      const exists = [...context.required, ...context.recommended, ...context.possible].some((candidate) => candidate.id === decisionId && candidate.type === 'decision');
      if (!exists) context.recommended.push({ id: decisionId, type: 'decision', path: `.humanintheloop/content/decisions/${decisionId}.html`, confidence: 0.61, reason: `related decision for mapped area ${area}` });
    }
  }
  return { required: sortContextItems(context.required), recommended: sortContextItems(context.recommended), possible: sortContextItems(context.possible) };
}

const program = new Command();
program.name('hitl').description('Human in the Loop implementation-memory CLI').version('0.3.0');

program.command('init').description('Create .humanintheloop workspace').action(async () => {
  await ensureWorkspace(process.cwd());
  console.log('Initialized Human in the Loop workspace at .humanintheloop');
});

program.command('serve').option('--port <port>', 'port', '4317').option('--register', 'record this server for hitl close').description('Serve local HITL website').action(async (options) => {
  const port = parsePort(options.port);
  await serve(process.cwd(), port, { register: Boolean(options.register) });
  console.log(`Human in the Loop site listening on http://127.0.0.1:${port}`);
});

program.command('expose').option('--port <port>', 'port', '4317').description('Expose local HITL website in the background').action(async (options) => {
  const root = process.cwd();
  const port = parsePort(options.port);
  await ensureWorkspace(root);
  await cleanHitlPortRegistry(root);
  const existing = (await readHitlPortRegistry(root)).find((record) => record.port === port);
  if (existing) {
    if (await verifyRegisteredHitlServer(existing)) {
      console.log(`Human in the Loop site already tracked on http://127.0.0.1:${port}`);
      return;
    }
    await unregisterHitlPid(root, existing.pid);
  }
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'serve', '--port', String(port), '--register'], {
    cwd: root,
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  await waitForExposedServer(root, port);
  console.log(`Human in the Loop site listening on http://127.0.0.1:${port}`);
});

program.command('install-agents')
  .option('--target <target>', 'codex, claude, or all', 'all')
  .option('--codex-dir <path>', 'Codex skills directory')
  .option('--claude-dir <path>', 'Claude Code skills directory')
  .description('Install or update bundled HITL skills for Codex and Claude Code')
  .action(async (options) => {
    await installAgentsFromOptions(options);
  });

program.command('update')
  .option('--workspace', 'refresh managed .humanintheloop structure and design files')
  .option('--agents', 'install or update bundled HITL skills')
  .option('--target <target>', 'codex, claude, or all', 'all')
  .option('--codex-dir <path>', 'Codex skills directory')
  .option('--claude-dir <path>', 'Claude Code skills directory')
  .description('Update HITL workspace files and/or local agent skills')
  .action(async (options) => {
    const updateWorkspace = Boolean(options.workspace) || !options.agents;
    if (updateWorkspace) {
      await ensureWorkspace(process.cwd(), {
        refreshManaged: true,
        commitMessage: 'hitl update: refresh managed workspace files'
      });
      console.log('Updated managed HITL workspace files');
    }
    if (options.agents) await installAgentsFromOptions(options);
  });

program.command('close').option('--port <port>', 'only close one registered HITL port').description('Close background HITL website ports and clean stale records').action(async (options) => {
  const port = options.port === undefined ? undefined : parsePort(options.port);
  const result = await closeHitlPorts(process.cwd(), { port });
  for (const record of result.cleanedStale) console.log(`Cleaned stale HITL port record: ${record.port}`);
  for (const record of result.closed) console.log(`Closed HITL port: ${record.port}`);
  if (!result.cleanedStale.length && !result.closed.length) console.log(port ? `No HITL port record found for ${port}` : 'No HITL ports to close');
});

program.command('start')
  .requiredOption('--spec <spec>')
  .requiredOption('--task <task>')
  .option('--files <files>')
  .description('Start an implementation-memory session')
  .action(async (options) => {
    const session = await startSession(process.cwd(), { spec: options.spec, task: options.task, files: parseFiles(options.files) });
    console.log(`Session: ${session.id}`);
    console.log(`Path: ${session.path}`);
    console.log(`Affected areas: ${session.affectedAreas.join(', ') || 'none'}`);
    console.log(`Required sections: ${session.requiredSections.join(', ')}`);
    console.log(`Recommended context: hitl context --task "${options.task}" --files "${parseFiles(options.files).join(' ')}"`);
  });

program.command('context')
  .option('--task <task>')
  .option('--files <files>')
  .option('--session <session>')
  .option('--json')
  .description('Return relevant HITL context')
  .action(async (options) => {
    const sessionInput = await contextInputFromSession(process.cwd(), options.session);
    const task = [sessionInput.task, options.task].filter(Boolean).join(' ');
    const files = [...new Set([...sessionInput.files, ...parseFiles(options.files)])];
    if (!task && !files.length) throw new Error('hitl context requires --task, --files, or --session');
    const context = await contextWithFileAreaMap(process.cwd(), task, files, sessionInput.areas);
    if (options.json) {
      console.log(JSON.stringify(context, null, 2));
      return;
    }
    for (const [label, items] of Object.entries(context)) {
      console.log(`${label[0].toUpperCase()}${label.slice(1)}`);
      for (const item of items) console.log(`- ${item.id} (${item.type}, ${item.confidence}): ${item.path} - ${item.reason}`);
    }
  });

program.command('db-docs')
  .option('--area <id>', 'HITL area to attach database notes to', 'data-spine')
  .option('--db-dir <path>', 'database schema/migration/seed evidence directory', 'db')
  .option('--code <globs>', 'backend code evidence globs or paths')
  .option('--product <files>', 'product/spec evidence files')
  .option('--force', 'refresh an existing HITL-generated database notes scaffold')
  .description('Create HITL-native database documentation scaffold and session')
  .action(async (options) => {
    const result = await createDatabaseDocs(process.cwd(), {
      area: options.area,
      dbDir: options.dbDir,
      code: parseFiles(options.code),
      product: parseFiles(options.product),
      force: Boolean(options.force)
    });
    console.log(`Database notes: ${result.path}`);
    console.log(`Route: ${result.route}`);
    console.log(`Session: ${result.sessionId}`);
    console.log(`Status: ${result.wrote ? 'created-or-refreshed' : 'preserved-existing'}, ${result.linked ? 'linked-area-page' : 'area-link-present'}`);
  });

program.command('area-docs')
  .requiredOption('--kind <kind>', `documentation template kind: ${AREA_DOC_KINDS.filter((kind) => kind !== 'database').join(', ')}`)
  .option('--area <id>', 'HITL area to attach notes to')
  .option('--evidence <paths>', 'evidence paths or globs the agent should inspect')
  .option('--code <globs>', 'code paths/globs the agent should inspect')
  .option('--product <files>', 'product/spec files the agent should inspect')
  .option('--force', 'refresh an existing HITL-generated scaffold for the same kind')
  .description('Create a HITL-native area documentation scaffold and review session')
  .action(async (options) => {
    const result = await createAreaDocs(process.cwd(), {
      kind: options.kind,
      area: options.area,
      evidence: parseFiles(options.evidence),
      code: parseFiles(options.code),
      product: parseFiles(options.product),
      force: Boolean(options.force)
    });
    console.log(`Area notes: ${result.path}`);
    console.log(`Kind: ${result.kind}`);
    console.log(`Route: ${result.route}`);
    console.log(`Session: ${result.sessionId}`);
    console.log(`Status: ${result.wrote ? 'created-or-refreshed' : 'preserved-existing'}, ${result.linked ? 'linked-area-page' : 'area-link-present'}`);
  });

program.command('note')
  .requiredOption('--session <session>')
  .requiredOption('--type <type>')
  .requiredOption('--title <title>')
  .requiredOption('--body <body>')
  .option('--why <why>')
  .option('--files <files>')
  .description('Add a structured implementation-memory card')
  .action(async (options) => {
    const note = await addNote(process.cwd(), { sessionId: options.session, type: options.type, title: options.title, body: options.body, why: options.why, files: parseFiles(options.files) });
    console.log(`Added note: ${note.claimId}`);
    console.log(`Path: ${note.path}`);
  });

program.command('cleanup')
  .requiredOption('--session <session>')
  .requiredOption('--action <action>')
  .requiredOption('--reason <reason>')
  .option('--old-claim <oldClaim>')
  .description('Record stale documentation cleanup')
  .action(async (options) => {
    const cleanup = await recordCleanup(process.cwd(), { sessionId: options.session, action: options.action, reason: options.reason, oldClaim: options.oldClaim });
    console.log(`Recorded cleanup: ${cleanup.cardId}`);
    console.log(`Path: ${cleanup.path}`);
  });

program.command('finalize').requiredOption('--session <session>').description('Finalize an active HITL session').action(async (options) => {
  const finalized = await finalizeSession(process.cwd(), options.session);
  console.log(`Completed: ${finalized.completedPath}`);
  console.log(`Delta: ${finalized.deltaPath}`);
});

program.command('validate')
  .option('--session <session>')
  .option('--changed')
  .option('--files <files>')
  .description('Validate HITL workspace, session, or changed files')
  .action(async (options) => {
    if (options.session) return printValidation('Session', await validateSession(process.cwd(), options.session));
    if (options.files) return printValidation('Files', await validateFiles(process.cwd(), parseFiles(options.files)));
    if (options.changed) {
      const changed = await projectChangedFiles(process.cwd());
      if (!changed) return printValidation('Changed', { ok: false, errors: ['Project is not a Git repo. Use hitl validate --files "<files>" instead.'], warnings: [] });
      return printValidation('Changed', await validateFiles(process.cwd(), changed));
    }
    return printValidation('Workspace', await validateWorkspace(process.cwd()));
  });

program.command('history').option('--page <page>').description('Show internal HITL history').action(async (options) => {
  console.log(await internalGitLog(process.cwd(), options.page));
});

program.command('review')
  .requiredOption('--claim <claim>')
  .requiredOption('--status <status>')
  .option('--superseded-by <claim>')
  .description('Update claim review status')
  .action(async (options) => {
    await reviewClaim(process.cwd(), { claimId: options.claim, status: options.status, supersededBy: options.supersededBy });
    console.log(`Reviewed claim ${options.claim}: ${options.status}`);
  });

program.parseAsync(process.argv).catch((error) => {
  console.error((error as Error).message);
  process.exit(1);
});
