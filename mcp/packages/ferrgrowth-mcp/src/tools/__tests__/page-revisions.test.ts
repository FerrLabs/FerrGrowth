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

function ok(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function lastCall(): { url: string; method: string } {
  const [url, init] = mockFetch.mock.calls.at(-1)!;
  return { url: String(url), method: init.method ?? 'GET' };
}

const GROWTH = 'https://api.ferrgrowth.com';

describe('page revision tools', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    handlers.clear();
    schemas.clear();
    mockFetch.mockResolvedValue(ok([]));
    const { registerPageRevisionTools } = await import('../page-revisions.js');
    registerPageRevisionTools(mockServer);
  });

  it('list_page_revisions reads the page revisions with paging', async () => {
    await handlers.get('list_page_revisions')!({
      site_id: 'shop',
      page_slug: 'pricing',
      limit: 10,
      offset: 20,
    });

    const call = lastCall();
    expect(call.url).toBe(`${GROWTH}/sites/shop/pages/pricing/revisions?limit=10&offset=20`);
    expect(call.method).toBe('GET');
  });

  it('list_page_revisions sends no query string by default', async () => {
    await handlers.get('list_page_revisions')!({ site_id: 'shop', page_slug: 'pricing' });

    expect(lastCall().url).toBe(`${GROWTH}/sites/shop/pages/pricing/revisions`);
  });

  it('encodes slugs and ids in the path', async () => {
    await handlers.get('get_page_revision')!({
      site_id: 'shop',
      page_slug: 'a/b',
      revision_id: 'rev 1',
    });

    expect(lastCall().url).toBe(`${GROWTH}/sites/shop/pages/a%2Fb/revisions/rev%201`);
  });

  it('restore_page_revision posts to the restore action of that revision', async () => {
    mockFetch.mockResolvedValue(ok({ slug: 'pricing' }));
    const result = await handlers.get('restore_page_revision')!({
      site_id: 'shop',
      page_slug: 'pricing',
      revision_id: 'rev-7',
    });

    const call = lastCall();
    expect(call.url).toBe(`${GROWTH}/sites/shop/pages/pricing/revisions/rev-7/restore`);
    expect(call.method).toBe('POST');
    expect(result.content[0].text).toContain('pricing');
  });

  it('rejects a limit above the API cap', () => {
    const limit = schemas.get('list_page_revisions')!.limit;
    expect(limit.safeParse(101).success).toBe(false);
    expect(limit.safeParse(100).success).toBe(true);
  });

  it('requires a revision id to restore', () => {
    const id = schemas.get('restore_page_revision')!.revision_id;
    expect(id.safeParse('').success).toBe(false);
  });
});
