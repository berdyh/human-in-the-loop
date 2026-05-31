import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { installAgentSkills } from '../../src/agents/install.js';

const packageRoot = resolve('.');

describe('agent skill installation', () => {
  test('installs and updates the bundled HITL skill for Codex and Claude Code', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-agent-install-'));
    const codexSkillsDir = join(root, 'codex-skills');
    const claudeSkillsDir = join(root, 'claude-skills');

    const first = await installAgentSkills({ packageRoot, codexSkillsDir, claudeSkillsDir, targets: ['codex', 'claude'] });

    expect(first.map((item) => item.target).sort()).toEqual(['claude', 'codex']);
    await expect(readFile(join(codexSkillsDir, 'hitl/SKILL.md'), 'utf8')).resolves.toContain('name: hitl');
    await expect(readFile(join(claudeSkillsDir, 'hitl/SKILL.md'), 'utf8')).resolves.toContain('name: hitl');

    await writeFile(join(codexSkillsDir, 'hitl/SKILL.md'), 'stale skill body\n', 'utf8');
    await writeFile(join(codexSkillsDir, 'hitl/obsolete.md'), 'removed from bundle\n', 'utf8');
    const second = await installAgentSkills({ packageRoot, codexSkillsDir, targets: ['codex'] });

    expect(second).toEqual([{ target: 'codex', path: join(codexSkillsDir, 'hitl'), action: 'updated' }]);
    await expect(readFile(join(codexSkillsDir, 'hitl/SKILL.md'), 'utf8')).resolves.toContain('Start Every HITL-Managed Task');
    await expect(stat(join(codexSkillsDir, 'hitl/obsolete.md'))).rejects.toThrow();
  });
});
