import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ZodTypeAny } from 'zod';
import type { McpServer } from '@ferrlabs/mcp-core';

process.env.FERRLABS_API_TOKEN = 'test-token';

type Handler = (params: Record<string, unknown>) => Promise<{ content: { text?: string }[] }>;

const handlers = new Map<string, Handler>();
const schemas = new Map<string, Record<string, ZodTypeAny>>();
const mockServer = {
  tool: vi.fn(
    (name: string, _desc: string, schema: Record<string, ZodTypeAny>, handler: Handler) => {
      handlers.set(name, handler);
      schemas.set(name, schema);
    },
  ),
} as unknown as McpServer;

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function ok(body: unknown = { id: 'x' }): Response {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function lastCall(): { url: string; method: string; body: unknown } {
  const [url, init] = mockFetch.mock.calls[0];
  return {
    url: String(url),
    method: init.method ?? 'GET',
    body: init.body ? JSON.parse(init.body) : undefined,
  };
}

const GROWTH = 'https://api.ferrgrowth.com';

function call(name: string, params: Record<string, unknown>) {
  const handler = handlers.get(name);
  if (!handler) throw new Error(`tool ${name} is not registered`);
  return handler(params);
}

describe('ferrgrowth insight tools', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    handlers.clear();
    schemas.clear();
    mockFetch.mockResolvedValue(ok());
    const { registerAnalyticsTools } = await import('../analytics.js');
    const { registerFunnelTools } = await import('../funnels.js');
    const { registerGoalTools } = await import('../goals.js');
    const { registerContactTools } = await import('../contacts.js');
    registerAnalyticsTools(mockServer);
    registerFunnelTools(mockServer);
    registerGoalTools(mockServer);
    registerContactTools(mockServer);
  });

  it('create_funnel omits steps so the API seeds its default funnel', async () => {
    await call('create_funnel', { site_id: 'shop', name: 'Checkout' });

    const sent = lastCall();
    expect(sent.url).toBe(`${GROWTH}/sites/shop/funnels`);
    expect(sent.method).toBe('POST');
    expect(sent.body).toEqual({ name: 'Checkout' });
  });

  it('create_funnel forwards the ordered steps as given', async () => {
    const steps = [
      { kind: 'pageview', target: 'pricing', label: 'Pricing' },
      { kind: 'form', target: 'contact', label: 'Lead' },
    ];
    await call('create_funnel', { site_id: 'shop', name: 'Lead', steps });

    expect(lastCall().body).toEqual({ name: 'Lead', steps });
  });

  it('update_funnel patches only the fields that were passed', async () => {
    await call('update_funnel', { site_id: 'shop', funnel_id: 'f-1', name: 'Renamed' });

    const sent = lastCall();
    expect(sent.url).toBe(`${GROWTH}/sites/shop/funnels/f-1`);
    expect(sent.method).toBe('PATCH');
    expect(sent.body).toEqual({ name: 'Renamed' });
  });

  it('rejects a funnel step kind the API does not accept', () => {
    const steps = schemas.get('create_funnel')!.steps;
    expect(steps.safeParse([{ kind: 'click', target: 'x', label: 'X' }]).success).toBe(false);
    expect(steps.safeParse([]).success).toBe(false);
  });

  it('delete_funnel deletes the funnel, not the site', async () => {
    const result = await call('delete_funnel', { site_id: 'shop', funnel_id: 'f-1' });

    const sent = lastCall();
    expect(sent.url).toBe(`${GROWTH}/sites/shop/funnels/f-1`);
    expect(sent.method).toBe('DELETE');
    expect(result.content[0].text).toContain('f-1');
  });

  it('get_funnel_analytics sends the window as days', async () => {
    await call('get_funnel_analytics', { site_id: 'shop', funnel_id: 'f-1', days: 7 });
    expect(lastCall().url).toBe(`${GROWTH}/sites/shop/funnels/f-1/analytics?days=7`);
  });

  it('create_goal posts the goal definition to the site', async () => {
    await call('create_goal', { site_id: 'shop', name: 'Signup', kind: 'event', target: 'signup' });

    const sent = lastCall();
    expect(sent.url).toBe(`${GROWTH}/sites/shop/goals`);
    expect(sent.method).toBe('POST');
    expect(sent.body).toEqual({ name: 'Signup', kind: 'event', target: 'signup' });
  });

  it('rejects a goal kind the API does not accept', () => {
    const kind = schemas.get('create_goal')!.kind;
    expect(kind.safeParse('click').success).toBe(false);
    expect(kind.safeParse('form').success).toBe(true);
  });

  it('list_goals targets the site goals', async () => {
    await call('list_goals', { site_id: 'shop' });
    expect(lastCall().url).toBe(`${GROWTH}/sites/shop/goals`);
  });

  it('delete_goal deletes the goal, not the site', async () => {
    const result = await call('delete_goal', { site_id: 'shop', goal_id: 'g 1' });

    const sent = lastCall();
    expect(sent.url).toBe(`${GROWTH}/sites/shop/goals/g%201`);
    expect(sent.method).toBe('DELETE');
    expect(result.content[0].text).toContain('g 1');
  });

  it('get_goal_stats sends the window as days', async () => {
    await call('get_goal_stats', { site_id: 'shop', days: 7 });
    expect(lastCall().url).toBe(`${GROWTH}/sites/shop/goals/stats?days=7`);
  });

  it('get_goal_stats leaves the window to the API when days is omitted', async () => {
    await call('get_goal_stats', { site_id: 'shop' });
    expect(lastCall().url).toBe(`${GROWTH}/sites/shop/goals/stats`);
  });

  it('get_page_heatmap escapes the page slug and passes days', async () => {
    await call('get_page_heatmap', { site_id: 'shop', page_slug: 'blog/launch', days: 14 });
    expect(lastCall().url).toBe(`${GROWTH}/sites/shop/pages/blog%2Flaunch/heatmap?days=14`);
  });

  it('get_page_heatmap leaves the window to the API when days is omitted', async () => {
    await call('get_page_heatmap', { site_id: 'shop', page_slug: 'pricing' });
    expect(lastCall().url).toBe(`${GROWTH}/sites/shop/pages/pricing/heatmap`);
  });

  it('get_analytics_summary sends the window as the range_days the API reads', async () => {
    await call('get_analytics_summary', { site_id: 'my shop', range_days: 7 });
    expect(lastCall().url).toBe(`${GROWTH}/sites/my%20shop/analytics?range_days=7`);
  });

  it('get_analytics_summary leaves the window to the API when range_days is omitted', async () => {
    await call('get_analytics_summary', { site_id: 'shop' });
    expect(lastCall().url).toBe(`${GROWTH}/sites/shop/analytics`);
  });

  it('get_analytics_summary bounds range_days the way the API clamps it', () => {
    const rangeDays = schemas.get('get_analytics_summary')!.range_days;
    expect(rangeDays.safeParse(0).success).toBe(false);
    expect(rangeDays.safeParse(366).success).toBe(false);
    expect(rangeDays.safeParse(365).success).toBe(true);
  });

  it('get_realtime_analytics and get_tracking_status read their site sub-resources', async () => {
    await call('get_realtime_analytics', { site_id: 'shop' });
    expect(lastCall().url).toBe(`${GROWTH}/sites/shop/analytics/realtime`);

    mockFetch.mockClear();
    await call('get_tracking_status', { site_id: 'shop' });
    expect(lastCall().url).toBe(`${GROWTH}/sites/shop/tracking/status`);
  });

  it('list_contacts pages with limit and offset at the org level', async () => {
    await call('list_contacts', { limit: 20, offset: 40 });
    expect(lastCall().url).toBe(`${GROWTH}/contacts?limit=20&offset=40`);
  });

  it('list_contacts caps the page size at the API maximum', () => {
    const limit = schemas.get('list_contacts')!.limit;
    expect(limit.safeParse(200).success).toBe(true);
    expect(limit.safeParse(201).success).toBe(false);
  });

  it('get_contact escapes the contact id so it cannot climb the path', async () => {
    await call('get_contact', { contact_id: '../sites' });
    expect(lastCall().url).toBe(`${GROWTH}/contacts/..%2Fsites`);
  });
});
