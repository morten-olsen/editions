import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestApp } from '../test-helpers.ts';
import type { TestContext } from '../test-helpers.ts';

let t: TestContext;

beforeEach(async () => {
  t = await createTestApp();
});

afterEach(async () => {
  await t.stop();
});

type OpenApiDocument = {
  openapi: string;
  paths: Record<string, unknown>;
  components?: { schemas?: Record<string, unknown> };
};

/** The exact URL `apps/web`'s `generate:api` script fetches. */
const OPENAPI_URL = '/api/docs/openapi.json';

const fetchDocument = async (): Promise<OpenApiDocument> => {
  const res = await t.inject({ method: 'GET', url: OPENAPI_URL });
  expect(res.statusCode, `${OPENAPI_URL} must serve the document generate:api consumes`).toBe(200);
  return JSON.parse(res.body) as OpenApiDocument;
};

/** Every `$ref` string anywhere in the document. */
const collectRefs = (node: unknown, found: string[] = []): string[] => {
  if (Array.isArray(node)) {
    for (const child of node) {
      collectRefs(child, found);
    }
    return found;
  }
  if (typeof node === 'object' && node !== null) {
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string') {
        found.push(value);
      } else {
        collectRefs(value, found);
      }
    }
  }
  return found;
};

describe('OpenAPI document', () => {
  /**
   * `task generate:api` runs `openapi-typescript` against this document, and it
   * fails hard on a `$ref` it cannot resolve. That happened once already:
   * schemas registered with `z.globalRegistry.add` emitted refs while
   * `transformObject` was missing from the Swagger setup, so nothing wrote the
   * components they pointed at. The web client's types could not be regenerated
   * at all until it was fixed.
   */
  it('resolves every $ref it emits', async () => {
    const doc = await fetchDocument();
    const defined = new Set(Object.keys(doc.components?.schemas ?? {}));
    const refs = [...new Set(collectRefs(doc))];

    expect(refs.length, 'expected registered schemas to produce refs').toBeGreaterThan(0);

    const dangling = refs.filter((ref) => {
      const name = ref.replace('#/components/schemas/', '');
      return ref.startsWith('#/components/schemas/') ? !defined.has(name) : true;
    });

    expect(dangling, `unresolvable $ref(s); defined schemas: ${[...defined].join(', ')}`).toEqual([]);
  });

  it('emits both the response and request variant of a registered schema', async () => {
    const doc = await fetchDocument();
    const schemas = Object.keys(doc.components?.schemas ?? {});

    // Zod input and output types diverge wherever a `.default()` or
    // `.transform()` is involved, so the two are emitted separately.
    expect(schemas).toContain('ApiKey');
    expect(schemas).toContain('ApiKeyInput');
  });

  it('hides the MCP transport route', async () => {
    const doc = await fetchDocument();
    // JSON-RPC over a single POST — the generator cannot describe it usefully
    // and the web client never calls it.
    expect(Object.keys(doc.paths)).not.toContain('/api/mcp');
  });
});
