import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z, type ZodTypeAny } from 'zod';
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

function ok(body: unknown = { id: 'x' }, status = 200): Response {
  return {
    ok: true,
    status,
    text: () => Promise.resolve(status === 204 ? '' : JSON.stringify(body)),
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function lastCall(): { url: string; method: string; body: unknown } {
  const [url, init] = mockFetch.mock.lastCall!;
  return {
    url: String(url),
    method: init.method ?? 'GET',
    body: init.body ? JSON.parse(init.body) : undefined,
  };
}

function parses(tool: string, params: Record<string, unknown>): boolean {
  return z.object(schemas.get(tool)!).safeParse(params).success;
}

const SEO = 'https://api.ferrgrowth.com/sites/shop/seo';

describe('ferrgrowth seo toolkit tools', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    handlers.clear();
    schemas.clear();
    mockFetch.mockResolvedValue(ok());
    const { registerSeoToolkitTools } = await import('../seo-toolkit.js');
    registerSeoToolkitTools(mockServer);
  });

  it('list_redirects reads the redirects of the site', async () => {
    await handlers.get('list_redirects')!({ site_id: 'shop' });

    expect(lastCall()).toMatchObject({ url: `${SEO}/redirects`, method: 'GET' });
  });

  it('create_redirect posts the redirect without the site id in the body', async () => {
    await handlers.get('create_redirect')!({
      site_id: 'shop',
      from_path: '/old',
      to_url: '/new',
      status_code: 308,
    });

    expect(lastCall()).toEqual({
      url: `${SEO}/redirects`,
      method: 'POST',
      body: { from_path: '/old', to_url: '/new', status_code: 308 },
    });
  });

  it('create_redirect only accepts redirect status codes', () => {
    const base = { site_id: 'shop', from_path: '/old', to_url: '/new' };

    expect(parses('create_redirect', base)).toBe(true);
    expect(parses('create_redirect', { ...base, status_code: 302 })).toBe(true);
    expect(parses('create_redirect', { ...base, status_code: 200 })).toBe(false);
  });

  it('delete_redirect deletes by id and encodes it', async () => {
    mockFetch.mockResolvedValue(ok(undefined, 204));

    const result = await handlers.get('delete_redirect')!({
      site_id: 'shop',
      redirect_id: 'a/b',
    });

    expect(lastCall()).toMatchObject({ url: `${SEO}/redirects/a%2Fb`, method: 'DELETE' });
    expect(result.content[0].text).toContain('a/b');
  });

  it('get_robots reads the robots config', async () => {
    await handlers.get('get_robots')!({ site_id: 'shop' });

    expect(lastCall()).toMatchObject({ url: `${SEO}/robots`, method: 'GET' });
  });

  it('update_robots puts the content, null restoring the default', async () => {
    await handlers.get('update_robots')!({ site_id: 'shop', content: null });

    expect(lastCall()).toEqual({ url: `${SEO}/robots`, method: 'PUT', body: { content: null } });
  });

  it('update_robots rejects oversized content', () => {
    expect(parses('update_robots', { site_id: 'shop', content: 'a'.repeat(20001) })).toBe(false);
    expect(parses('update_robots', { site_id: 'shop', content: 'User-agent: *' })).toBe(true);
  });

  it('list_schema_org reads the structured data of the site', async () => {
    await handlers.get('list_schema_org')!({ site_id: 'shop' });

    expect(lastCall()).toMatchObject({ url: `${SEO}/schema-org`, method: 'GET' });
  });

  it('set_schema_org puts the page slug and schema together', async () => {
    const schema = { '@type': 'Article', headline: 'Hi' };

    await handlers.get('set_schema_org')!({ site_id: 'shop', page_slug: 'docs/start', schema });

    expect(lastCall()).toEqual({
      url: `${SEO}/schema-org`,
      method: 'PUT',
      body: { page_slug: 'docs/start', schema },
    });
  });

  it('set_schema_org accepts objects and arrays but not scalars or empty arrays', () => {
    const base = { site_id: 'shop', page_slug: 'index' };

    expect(parses('set_schema_org', { ...base, schema: { '@type': 'Thing' } })).toBe(true);
    expect(parses('set_schema_org', { ...base, schema: [{ '@type': 'Thing' }] })).toBe(true);
    expect(parses('set_schema_org', { ...base, schema: [] })).toBe(false);
    expect(parses('set_schema_org', { ...base, schema: 'Thing' })).toBe(false);
  });

  it('delete_schema_org passes the page slug as an encoded query parameter', async () => {
    mockFetch.mockResolvedValue(ok(undefined, 204));

    await handlers.get('delete_schema_org')!({ site_id: 'shop', page_slug: 'docs/start' });

    expect(lastCall()).toMatchObject({
      url: `${SEO}/schema-org?page=docs%2Fstart`,
      method: 'DELETE',
    });
  });
});
