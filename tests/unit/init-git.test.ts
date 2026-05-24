import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { ensureWorkspace } from '../../src/workspace/init.js';
import { internalGitLog } from '../../src/git/internalGit.js';
import { exists } from '../../src/core/paths.js';

describe('workspace init and internal git', () => {
  test('init creates workspace, pages, bootloader, and separate internal git history', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-init-'));
    await ensureWorkspace(root);

    await expect(exists(join(root, '.humanintheloop/config.json'))).resolves.toBe(true);
    await expect(exists(join(root, '.humanintheloop/content/project.html'))).resolves.toBe(true);
    await expect(exists(join(root, '.humanintheloop/history/git/HEAD'))).resolves.toBe(true);
    await expect(exists(join(root, '.humanintheloop/content/.git'))).resolves.toBe(false);
    await expect(exists(join(root, 'AGENTS.md'))).resolves.toBe(true);

    const log = await internalGitLog(root);
    expect(log).toContain('hitl init: initialize Human in the Loop workspace');
  });
});
