import { describe, expect, test } from 'vitest';
import { routeContext } from '../../src/routing/router.js';

describe('context routing', () => {
  test('Crunchbase API ingestion selects source ingestion and add source connector', () => {
    const result = routeContext({ task: 'add Crunchbase API ingestion', files: [] });
    expect(result.required.map((item) => item.id)).toContain('source-ingestion');
    expect(result.required.map((item) => item.id)).toContain('add-source-connector');
    expect([...result.required, ...result.recommended].map((item) => item.id)).toContain('data-spine');
  });

  test('semantic provider wording selects source ingestion without exact phrase', () => {
    const result = routeContext({ task: 'connect a new provider for company profiles', files: [] });
    expect(result.required.map((item) => item.id)).toContain('source-ingestion');
    expect(result.required.map((item) => item.id)).toContain('add-source-connector');
  });

  test('dashboard styling does not require source ingestion', () => {
    const result = routeContext({ task: 'change dashboard card styling', files: [] });
    expect(result.required.map((item) => item.id)).not.toContain('source-ingestion');
    expect(result.required.map((item) => item.id)).not.toContain('rag');
    expect([...result.required, ...result.recommended].map((item) => item.id)).toContain('frontend-dashboard');
  });

  test('weak task relation matches do not inject unrelated required areas', () => {
    const api = routeContext({ task: 'add api endpoint', files: [] });
    expect(api.required.map((item) => item.id)).toContain('api-surfaces');
    expect(api.required.map((item) => item.id)).not.toContain('source-ingestion');

    const provider = routeContext({ task: 'connect a new provider', files: [] });
    expect(provider.required.map((item) => item.id)).toContain('source-ingestion');
    expect(provider.required.map((item) => item.id)).not.toContain('api-surfaces');
  });

  test('connector file path strongly selects source ingestion', () => {
    const result = routeContext({ task: 'update provider wiring', files: ['src/connectors/foo.ts'] });
    const source = result.required.find((item) => item.id === 'source-ingestion');
    expect(source?.confidence).toBeGreaterThanOrEqual(0.8);
    expect(source?.reason).toMatch(/file path/i);
  });
});
