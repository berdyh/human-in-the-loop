#!/usr/bin/env node
import { Command } from 'commander';
import { ensureWorkspace } from './workspace/init.js';
import { routeContext } from './routing/router.js';
import { startSession, addNote, recordCleanup, finalizeSession } from './sessions/sessionStore.js';
import { validateFiles, validateSession, validateWorkspace } from './validation/validateWorkspace.js';
import { internalGitLog, projectChangedFiles } from './git/internalGit.js';
import { reviewClaim } from './review/reviewClaims.js';
import { serve } from './site/server.js';

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

const program = new Command();
program.name('hitl').description('Human in the Loop implementation-memory CLI').version('0.1.0');

program.command('init').description('Create .humanintheloop workspace').action(async () => {
  await ensureWorkspace(process.cwd());
  console.log('Initialized Human in the Loop workspace at .humanintheloop');
});

program.command('serve').option('--port <port>', 'port', '4317').description('Serve local HITL website').action(async (options) => {
  const port = Number(options.port);
  await serve(process.cwd(), port);
  console.log(`Human in the Loop site listening on http://127.0.0.1:${port}`);
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
  .requiredOption('--task <task>')
  .option('--files <files>')
  .option('--session <session>')
  .option('--json')
  .description('Return relevant HITL context')
  .action((options) => {
    const context = routeContext({ task: options.task, files: parseFiles(options.files) });
    if (options.json) {
      console.log(JSON.stringify(context, null, 2));
      return;
    }
    for (const [label, items] of Object.entries(context)) {
      console.log(`${label[0].toUpperCase()}${label.slice(1)}`);
      for (const item of items) console.log(`- ${item.id} (${item.type}, ${item.confidence}): ${item.path} - ${item.reason}`);
    }
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
