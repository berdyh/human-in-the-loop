import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ensureDir, exists, internalGitPath, contentPath } from '../core/paths.js';

const execFileAsync = promisify(execFile);

async function runGit(root: string, args: string[], allowFailure = false): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', [
      `--git-dir=${internalGitPath(root)}`,
      `--work-tree=${contentPath(root)}`,
      ...args
    ], { cwd: root });
    return stdout.trim();
  } catch (error) {
    if (allowFailure) return '';
    throw error;
  }
}

export async function ensureInternalGit(root: string): Promise<void> {
  await ensureDir(contentPath(root));
  await ensureDir(internalGitPath(root));
  if (!(await exists(`${internalGitPath(root)}/HEAD`))) {
    await execFileAsync('git', ['init', '--bare', internalGitPath(root)], { cwd: root });
  }
  await runGit(root, ['config', 'user.name', 'Human in the Loop']);
  await runGit(root, ['config', 'user.email', 'hitl@local']);
}

export async function internalGitCommit(root: string, message: string): Promise<boolean> {
  await ensureInternalGit(root);
  await runGit(root, ['add', '-A']);
  const status = await runGit(root, ['status', '--porcelain']);
  if (!status) return false;
  await runGit(root, ['commit', '-m', message]);
  return true;
}

export async function internalGitLog(root: string, page?: string): Promise<string> {
  await ensureInternalGit(root);
  const args = ['log', '--oneline', '--decorate'];
  if (page) args.push('--', page);
  return runGit(root, args, true);
}

export async function projectGitHead(root: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: root });
    return stdout.trim();
  } catch {
    return null;
  }
}

export async function projectChangedFiles(root: string): Promise<string[] | null> {
  try {
    const { stdout } = await execFileAsync('git', ['diff', '--name-only'], { cwd: root });
    return stdout.split('\n').map((line) => line.trim()).filter(Boolean);
  } catch {
    return null;
  }
}
