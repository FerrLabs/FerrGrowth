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

function lastCall(): { url: string; method: string; rawBody: unknown; body: unknown } {
  const [url, init] = mockFetch.mock.calls[0];
  return {
    url: String(url),
    method: init.method ?? 'GET',
    rawBody: init.body,
    body: init.body ? JSON.parse(init.body) : undefined,
  };
}

const GROWTH = 'https://api.ferrgrowth.com';

describe('ferrgrowth SEO tools', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    handlers.clear();
    schemas.clear();
    mockFetch.mockResolvedValue(ok());
    const { registerSeoTools } = await import('../seo.js');
    const { registerSeoBulkTools } = await import('../seo-bulk.js');
    registerSeoTools(mockServer);
    registerSeoBulkTools(mockServer);
  });

  it('run_seo_audit always sends a JSON body, which the axum Json extractor requires', async () => {
    await handlers.get('run_seo_audit')!({ site_id: 'shop', page_slug: 'index' });

    const call = lastCall();
    expect(call.url).toBe(`${GROWTH}/sites/shop/pages/index/audits/seo`);
    expect(call.method).toBe('POST');
    expect(call.rawBody).toBe('{}');
  });

  it('run_seo_audit forwards the strategy and encodes both path segments', async () => {
    await handlers.get('run_seo_audit')!({
      site_id: 'my shop',
      page_slug: 'blog/post',
      strategy: 'desktop',
    });

    const call = lastCall();
    expect(call.url).toBe(`${GROWTH}/sites/my%20shop/pages/blog%2Fpost/audits/seo`);
    expect(call.body).toEqual({ strategy: 'desktop' });
  });

  it('run_seo_audit rejects a strategy the API would refuse', () => {
    const strategy = schemas.get('run_seo_audit')!.strategy;
    expect(strategy.safeParse('desktop').success).toBe(true);
    expect(strategy.safeParse('tablet').success).toBe(false);
  });

  it('list_seo_audits reads the page history with the limit in the query', async () => {
    mockFetch.mockResolvedValue(ok([]));
    await handlers.get('list_seo_audits')!({ site_id: 'shop', page_slug: 'pricing', limit: 5 });

    const call = lastCall();
    expect(call.url).toBe(`${GROWTH}/sites/shop/pages/pricing/audits/seo?limit=5`);
    expect(call.method).toBe('GET');
    expect(schemas.get('list_seo_audits')!.limit.safeParse(201).success).toBe(false);
  });

  it('run_site_seo_audits queues the site with staleness and strategy in the body', async () => {
    await handlers.get('run_site_seo_audits')!({
      site_id: 'shop',
      stale_after_days: 0,
      strategy: 'mobile',
    });

    const call = lastCall();
    expect(call.url).toBe(`${GROWTH}/sites/shop/audits/seo/run-all`);
    expect(call.method).toBe('POST');
    expect(call.body).toEqual({ stale_after_days: 0, strategy: 'mobile' });
  });

  it('run_site_seo_audits sends an empty object when no option is given', async () => {
    await handlers.get('run_site_seo_audits')!({ site_id: 'shop' });
    expect(lastCall().rawBody).toBe('{}');
  });

  it('get_site_seo_queue_status reads the site queue', async () => {
    await handlers.get('get_site_seo_queue_status')!({ site_id: 'shop' });

    const call = lastCall();
    expect(call.url).toBe(`${GROWTH}/sites/shop/audits/seo/queue-status`);
    expect(call.method).toBe('GET');
  });

  it('cancel_site_seo_audits posts to the cancel sub-resource of the site queue', async () => {
    await handlers.get('cancel_site_seo_audits')!({ site_id: '../audits' });

    const call = lastCall();
    expect(call.url).toBe(`${GROWTH}/sites/..%2Faudits/audits/seo/queue-status/cancel`);
    expect(call.method).toBe('POST');
  });

  it('run_workspace_seo_audits posts to the workspace route with no site in the path', async () => {
    await handlers.get('run_workspace_seo_audits')!({ stale_after_days: 7 });

    const call = lastCall();
    expect(call.url).toBe(`${GROWTH}/audits/seo/run-all-workspace`);
    expect(call.method).toBe('POST');
    expect(call.body).toEqual({ stale_after_days: 7 });
  });

  it('workspace reads hit their own routes', async () => {
    await handlers.get('get_workspace_seo_queue_status')!({});
    expect(lastCall().url).toBe(`${GROWTH}/audits/seo/queue-status-workspace`);

    vi.clearAllMocks();
    mockFetch.mockResolvedValue(ok([]));
    await handlers.get('get_workspace_seo_overview')!({});
    expect(lastCall().url).toBe(`${GROWTH}/audits/seo/workspace-overview`);
  });
});
