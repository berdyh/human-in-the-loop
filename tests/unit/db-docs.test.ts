import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { createDatabaseDocs } from '../../src/docs/dbDocs.js';
import { ensureWorkspace } from '../../src/workspace/init.js';

describe('database docs scaffold', () => {
  test('creates HITL-native database notes, area link, and data-spine session', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-db-docs-'));
    const result = await createDatabaseDocs(root);

    expect(result.path).toBe('.humanintheloop/content/areas/data-spine/database.html');
    expect(result.route).toBe('/areas/data-spine/database');
    expect(result.wrote).toBe(true);
    expect(result.linked).toBe(true);
    const html = await readFile(join(root, result.path), 'utf8');
    expect(html).toContain('data-hitl-generated="db-docs"');
    expect(html).toContain('MVP DB Mental Model');
    expect(html).toContain('Minimal ERD / Relationship Map');
    expect(html).toContain('Main Data Flows');
    expect(html).toContain('Architectural Decisions I Need to Know');
    expect(html).toContain('MVP Invariants');
    expect(html).toContain('Known Shortcuts / Technical Debt');
    expect(html).toContain('Migration + Seed Strategy');
    expect(html).toContain('Indexing / Performance Notes');
    expect(html).toContain('Open Questions for Architect');
    expect(html).toContain('<svg');
    expect(html).toContain('Last reviewed:');
    expect(html).toContain('MVP vs Later');
    expect(html).toContain('Missing: db');
    expect(html).not.toContain('https://');
    const areaPage = await readFile(join(root, '.humanintheloop/content/areas/data-spine/page.html'), 'utf8');
    expect(areaPage).toContain('/areas/data-spine/database');
    const sessionHtml = await readFile(join(root, `.humanintheloop/content/sessions/active/${result.sessionId}.html`), 'utf8');
    expect(sessionHtml).toContain('/areas/data-spine');
    expect(sessionHtml).toContain('Document MVP database architecture');
  });

  test('records existing evidence paths without treating db as output', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-db-docs-evidence-'));
    await mkdir(join(root, 'db/migrations'), { recursive: true });
    await mkdir(join(root, 'src/db'), { recursive: true });
    await writeFile(join(root, 'db/migrations/001_init.sql'), 'CREATE TABLE companies (id text primary key);\n', 'utf8');

    const result = await createDatabaseDocs(root, { code: ['src/db/company.ts'], product: ['docs/mvp.md'] });
    const html = await readFile(join(root, result.path), 'utf8');
    expect(html).toContain('<code>db</code>');
    expect(html).toContain('<code>src/db/company.ts</code>');
    expect(html).toContain('<code>docs/mvp.md</code>');
    expect(html).not.toContain('db/db-implementation-notes.html');
  });

  test('preserves human-authored database notes and refuses forced overwrite', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hitl-db-docs-preserve-'));
    await ensureWorkspace(root);
    const path = join(root, '.humanintheloop/content/areas/data-spine/database.html');
    await writeFile(path, '<!doctype html><p>Human authored database notes</p>', 'utf8');

    const result = await createDatabaseDocs(root);
    expect(result.wrote).toBe(false);
    await expect(readFile(path, 'utf8')).resolves.toContain('Human authored database notes');
    await expect(createDatabaseDocs(root, { force: true })).rejects.toThrow(/Refusing to overwrite human-authored/);
  });
});
