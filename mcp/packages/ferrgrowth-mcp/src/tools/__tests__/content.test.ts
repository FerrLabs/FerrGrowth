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

function noContent(): Response {
  return { ok: true, status: 204, text: () => Promise.resolve('') } as unknown as Response;
}

function lastCall(): { url: string; method: string; body: unknown } {
  const [url, init] = mockFetch.mock.calls[0];
  return {
    url: String(url),
    method: init.method ?? 'GET',
    body: init.body ? JSON.parse(init.body) : undefined,
  };
}

function call(tool: string, params: Record<string, unknown>) {
  return handlers.get(tool)!(params);
}

const GROWTH = 'https://api.ferrgrowth.com';

describe('ferrgrowth content tools', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    handlers.clear();
    schemas.clear();
    mockFetch.mockResolvedValue(ok());
    const { registerBlogTools } = await import('../blog.js');
    const { registerEmailTemplateTools } = await import('../email-templates.js');
    const { registerMediaTools } = await import('../media.js');
    registerBlogTools(mockServer);
    registerEmailTemplateTools(mockServer);
    registerMediaTools(mockServer);
  });

  it('list_blog_posts reads the blog/posts collection of the site', async () => {
    await call('list_blog_posts', { site_id: 'shop' });

    const req = lastCall();
    expect(req.url).toBe(`${GROWTH}/sites/shop/blog/posts`);
    expect(req.method).toBe('GET');
  });

  it('create_blog_post posts the post without the site id in the body', async () => {
    await call('create_blog_post', {
      site_id: 'shop',
      slug: 'launch',
      title: 'Launch',
      body_md: '# Hi',
    });

    const req = lastCall();
    expect(req.url).toBe(`${GROWTH}/sites/shop/blog/posts`);
    expect(req.method).toBe('POST');
    expect(req.body).toEqual({ slug: 'launch', title: 'Launch', body_md: '# Hi' });
  });

  it('update_blog_post patches only the fields passed, never the post id', async () => {
    await call('update_blog_post', {
      site_id: 'shop',
      post_id: 'p1',
      status: 'scheduled',
      scheduled_for: '2026-11-01T09:00:00Z',
    });

    const req = lastCall();
    expect(req.url).toBe(`${GROWTH}/sites/shop/blog/posts/p1`);
    expect(req.method).toBe('PATCH');
    expect(req.body).toEqual({ status: 'scheduled', scheduled_for: '2026-11-01T09:00:00Z' });
  });

  it('update_blog_post rejects a status and a schedule the API would refuse', () => {
    const schema = schemas.get('update_blog_post')!;
    expect(schema.status.safeParse('live').success).toBe(false);
    expect(schema.scheduled_for.safeParse('next monday').success).toBe(false);
    expect(schema.scheduled_for.safeParse('2026-11-01T09:00:00+02:00').success).toBe(true);
  });

  it('delete_blog_post deletes the post and survives an empty 204', async () => {
    mockFetch.mockResolvedValue(noContent());
    const result = await call('delete_blog_post', { site_id: 'shop', post_id: 'p1' });

    const req = lastCall();
    expect(req.url).toBe(`${GROWTH}/sites/shop/blog/posts/p1`);
    expect(req.method).toBe('DELETE');
    expect(result.content[0].text).toContain('p1');
  });

  it('create_email_template posts to the hyphenated email-templates path', async () => {
    await call('create_email_template', {
      site_id: 'shop',
      slug: 'welcome',
      name: 'Welcome',
      subject: 'Hello',
      trigger_kind: 'welcome',
      brand_inherit: false,
    });

    const req = lastCall();
    expect(req.url).toBe(`${GROWTH}/sites/shop/email-templates`);
    expect(req.method).toBe('POST');
    expect(req.body).toEqual({
      slug: 'welcome',
      name: 'Welcome',
      subject: 'Hello',
      trigger_kind: 'welcome',
      brand_inherit: false,
    });
  });

  it('create_email_template only accepts trigger kinds the API knows', () => {
    const trigger = schemas.get('create_email_template')!.trigger_kind;
    expect(trigger.safeParse('form_submit').success).toBe(true);
    expect(trigger.safeParse('signup').success).toBe(false);
  });

  it('update_email_template patches the template and keeps a false flag', async () => {
    await call('update_email_template', {
      site_id: 'shop',
      template_id: 't1',
      status: 'disabled',
      brand_inherit: false,
    });

    const req = lastCall();
    expect(req.url).toBe(`${GROWTH}/sites/shop/email-templates/t1`);
    expect(req.method).toBe('PATCH');
    expect(req.body).toEqual({ status: 'disabled', brand_inherit: false });
  });

  it('delete_email_template deletes the template', async () => {
    mockFetch.mockResolvedValue(noContent());
    await call('delete_email_template', { site_id: 'shop', template_id: 't1' });

    const req = lastCall();
    expect(req.url).toBe(`${GROWTH}/sites/shop/email-templates/t1`);
    expect(req.method).toBe('DELETE');
  });

  it('list_media sends no query string when no filter is given', async () => {
    await call('list_media', { site_id: 'shop' });
    expect(lastCall().url).toBe(`${GROWTH}/sites/shop/media`);
  });

  it('list_media forwards kind, limit and offset as query parameters', async () => {
    await call('list_media', { site_id: 'shop', kind: 'font', limit: 20, offset: 40 });
    expect(lastCall().url).toBe(`${GROWTH}/sites/shop/media?kind=font&limit=20&offset=40`);
  });

  it('list_media keeps an offset of zero', async () => {
    await call('list_media', { site_id: 'shop', offset: 0 });
    expect(lastCall().url).toBe(`${GROWTH}/sites/shop/media?offset=0`);
  });

  it('upload_media posts the decoded bytes as the multipart file field', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    await call('upload_media', {
      site_id: 'my shop',
      filename: 'hero.png',
      content_type: 'image/png',
      content_base64: png.toString('base64'),
    });

    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toBe(`${GROWTH}/sites/my%20shop/media`);
    expect(init.method).toBe('POST');
    const file = (init.body as FormData).get('file') as File;
    expect(file.name).toBe('hero.png');
    expect(file.type).toBe('image/png');
    expect(Buffer.from(await file.arrayBuffer())).toEqual(png);
  });

  it('upload_media refuses a file over the API limit without calling it', async () => {
    const result = (await call('upload_media', {
      site_id: 'shop',
      filename: 'huge.png',
      content_type: 'image/png',
      content_base64: Buffer.alloc(10 * 1024 * 1024 + 1).toString('base64'),
    })) as { isError?: boolean };

    expect(result.isError).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('upload_media only accepts what the API can store, as valid base64', () => {
    const shape = schemas.get('upload_media')!;
    expect(shape.content_type.safeParse('image/svg+xml').success).toBe(false);
    expect(shape.content_type.safeParse('font/woff2').success).toBe(true);
    expect(shape.content_base64.safeParse('not base64!').success).toBe(false);
  });

  it('delete_media deletes the asset', async () => {
    mockFetch.mockResolvedValue(noContent());
    const result = await call('delete_media', { site_id: 'shop', media_id: 'm1' });

    const req = lastCall();
    expect(req.url).toBe(`${GROWTH}/sites/shop/media/m1`);
    expect(req.method).toBe('DELETE');
    expect(result.content[0].text).toContain('m1');
  });

  it('escapes the site and child ids so they cannot climb the path', async () => {
    await call('delete_blog_post', { site_id: '../sites', post_id: '../../x' });
    expect(lastCall().url).toBe(`${GROWTH}/sites/..%2Fsites/blog/posts/..%2F..%2Fx`);

    mockFetch.mockClear();
    await call('delete_media', { site_id: 'shop', media_id: 'a/b' });
    expect(lastCall().url).toBe(`${GROWTH}/sites/shop/media/a%2Fb`);
  });
});
