import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type AgentTarget = 'codex' | 'claude';

export type InstallAgentSkillsInput = {
  packageRoot: string;
  targets: AgentTarget[];
  codexSkillsDir?: string;
  claudeSkillsDir?: string;
};

export type InstallAgentSkillsResult = {
  target: AgentTarget;
  path: string;
  action: 'installed' | 'updated';
};

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function skillsDir(input: InstallAgentSkillsInput, target: AgentTarget): string {
  if (target === 'codex') return input.codexSkillsDir ?? join(homedir(), '.codex/skills');
  return input.claudeSkillsDir ?? join(homedir(), '.claude/skills');
}

export function parseAgentTargets(value?: string): AgentTarget[] {
  const raw = value ?? 'all';
  if (raw === 'all') return ['codex', 'claude'];
  const targets = raw.split(/[\s,]+/).filter(Boolean);
  if (!targets.length) throw new Error('Agent target is required');
  for (const target of targets) {
    if (target !== 'codex' && target !== 'claude') throw new Error(`Invalid agent target: ${target}`);
  }
  return [...new Set(targets)] as AgentTarget[];
}

export async function installAgentSkills(input: InstallAgentSkillsInput): Promise<InstallAgentSkillsResult[]> {
  const source = join(input.packageRoot, 'skills/hitl');
  if (!(await exists(source))) throw new Error(`Bundled HITL skill not found: ${source}`);

  const results: InstallAgentSkillsResult[] = [];
  for (const target of input.targets) {
    const base = skillsDir(input, target);
    const destination = join(base, 'hitl');
    const action = await exists(destination) ? 'updated' : 'installed';
    await mkdir(base, { recursive: true });
    await rm(destination, { recursive: true, force: true });
    await cp(source, destination, { recursive: true, force: true, errorOnExist: false });
    results.push({ target, path: destination, action });
  }
  return results;
}
