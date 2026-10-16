import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { McpServer } from '@ferrlabs/mcp-core';

process.env.FERRLABS_API_TOKEN = 'test-token';

type Handler = (
  params: Record<string, unknown>,
) => Promise<{ isError?: boolean; content: { text?: string }[] }>;

const handlers = new Map<string, Handler>();
const mockServer = {
  tool: vi.fn((name: string, _desc: string, _schema: unknown, handler: Handler) => {
    handlers.set(name, handler);
  }),
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

function call(name: string, params: Record<string, unknown>) {
  return handlers.get(name)!(params);
}

const GROWTH = 'https://api.ferrgrowth.com';
const SECRET = 'fgs_live_plaintext_secret_value';

describe('ferrgrowth site admin tools', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    handlers.clear();
    delete process.env.FERRLABS_MCP_ALLOW_TOKEN_REVEAL;
    mockFetch.mockResolvedValue(ok());
    const modules = await Promise.all([
      import('../sites.js'),
      import('../releases.js'),
      import('../forms.js'),
      import('../members.js'),
      import('../server-tokens.js'),
      import('../integrations.js'),
      import('../external-sites.js'),
    ]);
    modules[0].registerSiteTools(mockServer);
    modules[1].registerReleaseTools(mockServer);
    modules[2].registerFormTools(mockServer);
    modules[3].registerMemberTools(mockServer);
    modules[4].registerServerTokenTools(mockServer);
    modules[5].registerIntegrationTools(mockServer);
    modules[6].registerExternalSiteTools(mockServer);
  });

  afterEach(() => {
    delete process.env.FERRLABS_MCP_ALLOW_TOKEN_REVEAL;
  });

  describe('get_form', () => {
    it('reads the forms list, since the API routes no GET on a single form', async () => {
      mockFetch.mockResolvedValue(
        ok([
          { id: 'f1', name: 'Newsletter' },
          { id: 'f2', name: 'Contact' },
        ]),
      );

      const result = await call('get_form', { site_id: 'shop', form_id: 'f2' });

      const req = lastCall();
      expect(req.url).toBe(`${GROWTH}/sites/shop/forms`);
      expect(req.method).toBe('GET');
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Contact');
      expect(result.content[0].text).not.toContain('Newsletter');
    });

    it('reports an unknown form id as an error instead of an empty result', async () => {
      mockFetch.mockResolvedValue(ok([{ id: 'f1', name: 'Newsletter' }]));

      const result = await call('get_form', { site_id: 'shop', form_id: 'nope' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('nope');
    });
  });

  describe('members', () => {
    it('list_site_members forwards paging as query params', async () => {
      await call('list_site_members', { site_id: 'shop', limit: 20, offset: 40 });

      const req = lastCall();
      expect(req.url).toBe(`${GROWTH}/sites/shop/members?limit=20&offset=40`);
      expect(req.method).toBe('GET');
    });

    it('update_site_member patches only the status', async () => {
      await call('update_site_member', { site_id: 'shop', member_id: 'm1', status: 'suspended' });

      const req = lastCall();
      expect(req.url).toBe(`${GROWTH}/sites/shop/members/m1`);
      expect(req.method).toBe('PATCH');
      expect(req.body).toEqual({ status: 'suspended' });
    });

    it('remove_site_member deletes the member and escapes its id', async () => {
      await call('remove_site_member', { site_id: 'shop', member_id: '../m1' });

      const req = lastCall();
      expect(req.url).toBe(`${GROWTH}/sites/shop/members/..%2Fm1`);
      expect(req.method).toBe('DELETE');
    });
  });

  describe('server tokens', () => {
    it('create_server_token refuses without calling the API, so no credential is minted', async () => {
      const result = await call('create_server_token', { site_id: 'shop', label: 'backend' });

      expect(result.isError).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.content[0].text).toMatch(/FERRLABS_MCP_ALLOW_TOKEN_REVEAL=1/);
    });

    it('create_server_token posts the label and returns the secret once opted in', async () => {
      process.env.FERRLABS_MCP_ALLOW_TOKEN_REVEAL = '1';
      mockFetch.mockResolvedValue(
        ok({
          id: 't1',
          token: SECRET,
          prefix: 'fgs_live',
          label: 'backend',
          created_at: '2026-10-03T00:00:00Z',
        }),
      );

      const result = await call('create_server_token', { site_id: 'shop', label: 'backend' });

      const req = lastCall();
      expect(req.url).toBe(`${GROWTH}/sites/shop/server-tokens`);
      expect(req.method).toBe('POST');
      expect(req.body).toEqual({ label: 'backend' });
      const text = result.content[0].text ?? '';
      expect(text).toContain(SECRET);
      expect(text).toMatch(/now in this transcript/);
      expect(text.indexOf(SECRET)).toBe(text.lastIndexOf(SECRET));
    });

    it('revoke_server_token deletes the token under its site', async () => {
      await call('revoke_server_token', { site_id: 'shop', token_id: 't1' });

      const req = lastCall();
      expect(req.url).toBe(`${GROWTH}/sites/shop/server-tokens/t1`);
      expect(req.method).toBe('DELETE');
    });
  });

  it('disconnect_integration posts to the disconnect action of the kind', async () => {
    await call('disconnect_integration', { kind: 'hubspot' });

    const req = lastCall();
    expect(req.url).toBe(`${GROWTH}/integrations/hubspot/disconnect`);
    expect(req.method).toBe('POST');
  });

  it('restore_site posts to the restore action of the site', async () => {
    await call('restore_site', { site_id: 'shop' });

    const req = lastCall();
    expect(req.url).toBe(`${GROWTH}/sites/shop/restore`);
    expect(req.method).toBe('POST');
  });

  it('restore_release restores the named release, not the site', async () => {
    await call('restore_release', { site_id: 'shop', release_id: 'rel-3' });

    const req = lastCall();
    expect(req.url).toBe(`${GROWTH}/sites/shop/releases/rel-3/restore`);
    expect(req.method).toBe('POST');
  });

  it('verify_external_url posts to the verify action', async () => {
    await call('verify_external_url', { site_id: 'shop' });

    const req = lastCall();
    expect(req.url).toBe(`${GROWTH}/sites/shop/external-url/verify`);
    expect(req.method).toBe('POST');
  });

  it('discover_external_pages sends the deep flag, defaulting to a sitemap-only pass', async () => {
    await call('discover_external_pages', { site_id: 'shop' });
    expect(lastCall().body).toEqual({ deep: false });

    mockFetch.mockClear();
    await call('discover_external_pages', { site_id: 'shop', deep: true });

    const req = lastCall();
    expect(req.url).toBe(`${GROWTH}/sites/shop/discover-external`);
    expect(req.method).toBe('POST');
    expect(req.body).toEqual({ deep: true });
  });
});
