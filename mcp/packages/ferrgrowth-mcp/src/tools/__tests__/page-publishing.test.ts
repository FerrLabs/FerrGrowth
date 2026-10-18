import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ZodTypeAny } from 'zod';
import { z } from 'zod';
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

function parses(tool: string, input: Record<string, unknown>): boolean {
  return z.object(schemas.get(tool)!).safeParse(input).success;
}

const GROWTH = 'https://api.ferrgrowth.com';

describe('ferrgrowth page publishing tools', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    handlers.clear();
    schemas.clear();
    mockFetch.mockResolvedValue(ok());
    const { registerPagePublishingTools } = await import('../page-publishing.js');
    registerPagePublishingTools(mockServer);
  });

  it('registers the five tools', () => {
    expect([...handlers.keys()].sort()).toEqual([
      'create_preview_link',
      'list_preview_links',
      'revoke_preview_link',
      'schedule_page',
      'unschedule_page',
    ]);
  });

  it('schedule_page posts publish_at and encodes slugs', async () => {
    await handlers.get('schedule_page')!({
      site_id: 'my site',
      page_slug: 'a/b',
      publish_at: '2026-11-01T09:00:00Z',
    });
    expect(lastCall()).toEqual({
      url: `${GROWTH}/sites/my%20site/pages/a%2Fb/schedule`,
      method: 'POST',
      body: { publish_at: '2026-11-01T09:00:00Z' },
    });
  });

  it('schedule_page rejects a timestamp without a timezone offset', () => {
    expect(
      parses('schedule_page', { site_id: 's', page_slug: 'p', publish_at: '2026-11-01' }),
    ).toBe(false);
    expect(
      parses('schedule_page', { site_id: 's', page_slug: 'p', publish_at: '2026-11-01T09:00:00' }),
    ).toBe(false);
    expect(
      parses('schedule_page', {
        site_id: 's',
        page_slug: 'p',
        publish_at: '2026-11-01T09:00:00+02:00',
      }),
    ).toBe(true);
  });

  it('unschedule_page deletes the schedule', async () => {
    await handlers.get('unschedule_page')!({ site_id: 's', page_slug: 'p' });
    expect(lastCall()).toMatchObject({
      url: `${GROWTH}/sites/s/pages/p/schedule`,
      method: 'DELETE',
    });
  });

  it('create_preview_link sends only the fields that were given', async () => {
    await handlers.get('create_preview_link')!({ site_id: 's', page_slug: 'p' });
    expect(lastCall()).toEqual({
      url: `${GROWTH}/sites/s/pages/p/preview-links`,
      method: 'POST',
      body: {},
    });

    mockFetch.mockClear();
    await handlers.get('create_preview_link')!({
      site_id: 's',
      page_slug: 'p',
      password: 'secret1',
      expires_in_hours: 24,
    });
    expect(lastCall().body).toEqual({ password: 'secret1', expires_in_hours: 24 });
  });

  it('create_preview_link validates password length and expiry bounds', () => {
    const base = { site_id: 's', page_slug: 'p' };
    expect(parses('create_preview_link', { ...base, password: 'short' })).toBe(false);
    expect(parses('create_preview_link', { ...base, expires_in_hours: 0 })).toBe(false);
    expect(parses('create_preview_link', { ...base, expires_in_hours: 2161 })).toBe(false);
    expect(parses('create_preview_link', { ...base, expires_in_hours: 1.5 })).toBe(false);
    expect(
      parses('create_preview_link', { ...base, password: 'secret1', expires_in_hours: 2160 }),
    ).toBe(true);
  });

  it('list_preview_links reads the page links', async () => {
    await handlers.get('list_preview_links')!({ site_id: 's', page_slug: 'p' });
    expect(lastCall()).toMatchObject({
      url: `${GROWTH}/sites/s/pages/p/preview-links`,
      method: 'GET',
    });
  });

  it('revoke_preview_link deletes by link id under the site', async () => {
    await handlers.get('revoke_preview_link')!({ site_id: 's', link_id: 'abc-123' });
    expect(lastCall()).toMatchObject({
      url: `${GROWTH}/sites/s/preview-links/abc-123`,
      method: 'DELETE',
    });
  });
});
