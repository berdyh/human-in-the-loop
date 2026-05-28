import { createAreaDocs, type AreaDocsResult } from './areaDocs.js';

export type DatabaseDocsInput = {
  area?: string;
  dbDir?: string;
  code?: string[];
  product?: string[];
  force?: boolean;
};

export type DatabaseDocsResult = Omit<AreaDocsResult, 'kind'>;

export async function createDatabaseDocs(root: string, input: DatabaseDocsInput = {}): Promise<DatabaseDocsResult> {
  const { kind: _kind, ...result } = await createAreaDocs(root, {
    kind: 'database',
    area: input.area,
    evidence: [input.dbDir ?? 'db'],
    code: input.code,
    product: input.product,
    force: input.force
  });
  return result;
}
