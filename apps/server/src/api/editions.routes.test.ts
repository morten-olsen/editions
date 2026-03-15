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

// --- Helpers ---

const createSource = async (headers: { authorization: string }, name: string): Promise<string> => {
  const res = await t.inject({
    method: 'POST',
    url: '/api/sources',
    headers,
    payload: { name, url: `https://example.com/${name}/feed.xml` },
  });
  return (JSON.parse(res.body) as { id: string }).id;
};

const createFocus = async (
  headers: { authorization: string },
  name: string,
  sourceIds: string[] = [],
): Promise<string> => {
  const res = await t.inject({
    method: 'POST',
    url: '/api/focuses',
    headers,
    payload: {
      name,
      sources: sourceIds.map((id) => ({ sourceId: id })),
    },
  });
  return (JSON.parse(res.body) as { id: string }).id;
};

describe('edition config CRUD', () => {
  it('returns empty list when no configs', async () => {
    const { headers } = await t.register();

    const res = await t.inject({
      method: 'GET',
      url: '/api/editions/configs',
      headers,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
  });

  it('creates an edition config', async () => {
    const { headers } = await t.register();
    const sourceId = await createSource(headers, 'hn');
    const focusId = await createFocus(headers, 'Technology', [sourceId]);

    const res = await t.inject({
      method: 'POST',
      url: '/api/editions/configs',
      headers,
      payload: {
        name: 'Morning Briefing',
        schedule: '0 7 * * *',
        lookbackHours: 24,
        focuses: [{ focusId, position: 0, budgetType: 'count', budgetValue: 5 }],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.name).toBe('Morning Briefing');
    expect(body.schedule).toBe('0 7 * * *');
    expect(body.lookbackHours).toBe(24);
    expect(body.excludePriorEditions).toBe(false);
    expect(body.enabled).toBe(true);
    expect(body.focuses).toHaveLength(1);
    expect(body.focuses[0].focusId).toBe(focusId);
    expect(body.focuses[0].focusName).toBe('Technology');
    expect(body.focuses[0].budgetType).toBe('count');
    expect(body.focuses[0].budgetValue).toBe(5);
  });

  it('gets an edition config by id', async () => {
    const { headers } = await t.register();
    const focusId = await createFocus(headers, 'Technology');

    const createRes = await t.inject({
      method: 'POST',
      url: '/api/editions/configs',
      headers,
      payload: {
        name: 'Morning Briefing',
        schedule: '0 7 * * *',
        lookbackHours: 24,
        focuses: [{ focusId, position: 0, budgetType: 'count', budgetValue: 5 }],
      },
    });
    const { id } = JSON.parse(createRes.body);

    const res = await t.inject({
      method: 'GET',
      url: `/api/editions/configs/${id}`,
      headers,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).name).toBe('Morning Briefing');
  });

  it('returns 404 for nonexistent config', async () => {
    const { headers } = await t.register();

    const res = await t.inject({
      method: 'GET',
      url: '/api/editions/configs/nonexistent',
      headers,
    });

    expect(res.statusCode).toBe(404);
  });

  it('updates an edition config', async () => {
    const { headers } = await t.register();
    const focusId = await createFocus(headers, 'Technology');

    const createRes = await t.inject({
      method: 'POST',
      url: '/api/editions/configs',
      headers,
      payload: {
        name: 'Morning Briefing',
        schedule: '0 7 * * *',
        lookbackHours: 24,
        focuses: [{ focusId, position: 0, budgetType: 'count', budgetValue: 5 }],
      },
    });
    const { id } = JSON.parse(createRes.body);

    const res = await t.inject({
      method: 'PATCH',
      url: `/api/editions/configs/${id}`,
      headers,
      payload: {
        name: 'Evening Digest',
        lookbackHours: 12,
        excludePriorEditions: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.name).toBe('Evening Digest');
    expect(body.lookbackHours).toBe(12);
    expect(body.excludePriorEditions).toBe(true);
    // focuses unchanged
    expect(body.focuses).toHaveLength(1);
  });

  it('updates focuses on a config', async () => {
    const { headers } = await t.register();
    const focus1 = await createFocus(headers, 'Technology');
    const focus2 = await createFocus(headers, 'Science');

    const createRes = await t.inject({
      method: 'POST',
      url: '/api/editions/configs',
      headers,
      payload: {
        name: 'Morning Briefing',
        schedule: '0 7 * * *',
        lookbackHours: 24,
        focuses: [{ focusId: focus1, position: 0, budgetType: 'count', budgetValue: 5 }],
      },
    });
    const { id } = JSON.parse(createRes.body);

    const res = await t.inject({
      method: 'PATCH',
      url: `/api/editions/configs/${id}`,
      headers,
      payload: {
        focuses: [
          { focusId: focus1, position: 0, budgetType: 'count', budgetValue: 3 },
          { focusId: focus2, position: 1, budgetType: 'time', budgetValue: 10 },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.focuses).toHaveLength(2);
    expect(body.focuses[0].budgetValue).toBe(3);
    expect(body.focuses[1].focusName).toBe('Science');
    expect(body.focuses[1].budgetType).toBe('time');
  });

  it('deletes an edition config', async () => {
    const { headers } = await t.register();
    const focusId = await createFocus(headers, 'Technology');

    const createRes = await t.inject({
      method: 'POST',
      url: '/api/editions/configs',
      headers,
      payload: {
        name: 'Morning Briefing',
        schedule: '0 7 * * *',
        lookbackHours: 24,
        focuses: [{ focusId, position: 0, budgetType: 'count', budgetValue: 5 }],
      },
    });
    const { id } = JSON.parse(createRes.body);

    const delRes = await t.inject({
      method: 'DELETE',
      url: `/api/editions/configs/${id}`,
      headers,
    });
    expect(delRes.statusCode).toBe(204);

    const getRes = await t.inject({
      method: 'GET',
      url: `/api/editions/configs/${id}`,
      headers,
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('isolates configs between users', async () => {
    const { headers } = await t.register();
    const { headers: otherHeaders } = await t.register('otheruser', 'password456');
    const focusId = await createFocus(headers, 'Technology');

    await t.inject({
      method: 'POST',
      url: '/api/editions/configs',
      headers,
      payload: {
        name: 'My Config',
        schedule: '0 7 * * *',
        lookbackHours: 24,
        focuses: [{ focusId, position: 0, budgetType: 'count', budgetValue: 5 }],
      },
    });

    const res = await t.inject({
      method: 'GET',
      url: '/api/editions/configs',
      headers: otherHeaders,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
  });
});

describe('edition generation', () => {
  it('generates an empty edition when no articles exist', async () => {
    const { headers } = await t.register();
    const sourceId = await createSource(headers, 'hn');
    const focusId = await createFocus(headers, 'Technology', [sourceId]);

    const configRes = await t.inject({
      method: 'POST',
      url: '/api/editions/configs',
      headers,
      payload: {
        name: 'Morning Briefing',
        schedule: '0 7 * * *',
        lookbackHours: 24,
        focuses: [{ focusId, position: 0, budgetType: 'count', budgetValue: 5 }],
      },
    });
    const config = JSON.parse(configRes.body);

    const res = await t.inject({
      method: 'POST',
      url: `/api/editions/configs/${config.id}/generate`,
      headers,
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.articleCount).toBe(0);
    expect(body.articles).toEqual([]);
    expect(body.currentPosition).toBe(0);
  });

  it('returns 400 when config has no focuses', async () => {
    const { headers } = await t.register();

    const configRes = await t.inject({
      method: 'POST',
      url: '/api/editions/configs',
      headers,
      payload: {
        name: 'Empty Config',
        schedule: '0 7 * * *',
        lookbackHours: 24,
        focuses: [],
      },
    });
    const config = JSON.parse(configRes.body);

    const res = await t.inject({
      method: 'POST',
      url: `/api/editions/configs/${config.id}/generate`,
      headers,
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('edition listing and viewing', () => {
  it('lists editions for a config', async () => {
    const { headers } = await t.register();
    const focusId = await createFocus(headers, 'Technology');

    const configRes = await t.inject({
      method: 'POST',
      url: '/api/editions/configs',
      headers,
      payload: {
        name: 'Morning Briefing',
        schedule: '0 7 * * *',
        lookbackHours: 24,
        focuses: [{ focusId, position: 0, budgetType: 'count', budgetValue: 5 }],
      },
    });
    const config = JSON.parse(configRes.body);

    // Generate an edition
    await t.inject({
      method: 'POST',
      url: `/api/editions/configs/${config.id}/generate`,
      headers,
    });

    const res = await t.inject({
      method: 'GET',
      url: `/api/editions/configs/${config.id}/editions`,
      headers,
    });

    expect(res.statusCode).toBe(200);
    const editions = JSON.parse(res.body);
    expect(editions).toHaveLength(1);
    expect(editions[0].configName).toBe('Morning Briefing');
  });

  it('deletes a generated edition', async () => {
    const { headers } = await t.register();
    const focusId = await createFocus(headers, 'Technology');

    const configRes = await t.inject({
      method: 'POST',
      url: '/api/editions/configs',
      headers,
      payload: {
        name: 'Morning Briefing',
        schedule: '0 7 * * *',
        lookbackHours: 24,
        focuses: [{ focusId, position: 0, budgetType: 'count', budgetValue: 5 }],
      },
    });
    const config = JSON.parse(configRes.body);

    const genRes = await t.inject({
      method: 'POST',
      url: `/api/editions/configs/${config.id}/generate`,
      headers,
    });
    const edition = JSON.parse(genRes.body);

    const delRes = await t.inject({
      method: 'DELETE',
      url: `/api/editions/${edition.id}`,
      headers,
    });
    expect(delRes.statusCode).toBe(204);

    const getRes = await t.inject({
      method: 'GET',
      url: `/api/editions/${edition.id}`,
      headers,
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('updates reading progress', async () => {
    const { headers } = await t.register();
    const focusId = await createFocus(headers, 'Technology');

    const configRes = await t.inject({
      method: 'POST',
      url: '/api/editions/configs',
      headers,
      payload: {
        name: 'Morning Briefing',
        schedule: '0 7 * * *',
        lookbackHours: 24,
        focuses: [{ focusId, position: 0, budgetType: 'count', budgetValue: 5 }],
      },
    });
    const config = JSON.parse(configRes.body);

    const genRes = await t.inject({
      method: 'POST',
      url: `/api/editions/configs/${config.id}/generate`,
      headers,
    });
    const edition = JSON.parse(genRes.body);

    const res = await t.inject({
      method: 'PATCH',
      url: `/api/editions/${edition.id}/progress`,
      headers,
      payload: { currentPosition: 3 },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).currentPosition).toBe(3);
  });
});

describe('edition preview', () => {
  it('returns 404 for non-existent config', async () => {
    const { headers } = await t.register();

    const res = await t.inject({
      method: 'POST',
      url: '/api/editions/configs/nonexistent/preview',
      headers,
      payload: {},
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns empty sections for config with no focuses', async () => {
    const { headers } = await t.register();

    // Use existing helpers to create a source and focus, then config with a focus
    const sourceId = await createSource(headers, 'preview-source');
    const focusId = await createFocus(headers, 'Preview Focus', [sourceId]);

    const createRes = await t.inject({
      method: 'POST',
      url: '/api/editions/configs',
      headers,
      payload: { name: 'Test Edition', schedule: '0 7 * * *', lookbackHours: 24, focuses: [{ focusId, position: 0, budgetType: 'count', budgetValue: 10 }] },
    });
    expect(createRes.statusCode).toBe(201);
    const configId = (JSON.parse(createRes.body) as { id: string }).id;

    // Preview — no articles exist so result should be empty
    const res = await t.inject({
      method: 'POST',
      url: `/api/editions/configs/${configId}/preview`,
      headers,
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.sections).toEqual([]);
    expect(body.totalArticles).toBe(0);
    expect(body.totalReadingMinutes).toBe(0);
  });

  it('does not create an actual edition', async () => {
    const { headers } = await t.register();

    const sourceId = await createSource(headers, 'preview-source2');
    const focusId = await createFocus(headers, 'Preview Focus 2', [sourceId]);

    const createRes = await t.inject({
      method: 'POST',
      url: '/api/editions/configs',
      headers,
      payload: { name: 'Test Edition 2', schedule: '0 7 * * *', lookbackHours: 24, focuses: [{ focusId, position: 0, budgetType: 'count', budgetValue: 10 }] },
    });
    expect(createRes.statusCode).toBe(201);
    const configId = (JSON.parse(createRes.body) as { id: string }).id;

    await t.inject({
      method: 'POST',
      url: `/api/editions/configs/${configId}/preview`,
      headers,
      payload: {},
    });

    // Verify no editions were created
    const listRes = await t.inject({
      method: 'GET',
      url: `/api/editions/configs/${configId}/editions`,
      headers,
    });
    expect(listRes.statusCode).toBe(200);
    expect(JSON.parse(listRes.body)).toEqual([]);
  });
});
