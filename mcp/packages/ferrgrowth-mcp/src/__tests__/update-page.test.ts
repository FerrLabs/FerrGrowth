import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z, type ZodTypeAny } from 'zod';
import type { McpServer } from '@ferrlabs/mcp-core';
import { registerPageTools } from '../tools/pages.js';

process.env.FERRLABS_API_TOKEN = 'test-token';

const ORG_ID = '3f0c6a52-8d1e-4b7a-9c2f-5e6d7a8b9c01';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Handler = (params: Record<string, unknown>) => Promise<unknown>;

const handlers = new Map<string, Handler>();
const shapes = new Map<string, Record<string, ZodTypeAny>>();
const server = {
  tool: vi.fn((name: string, _d: string, shape: Record<string, ZodTypeAny>, handler: Handler) => {
    handlers.set(name, handler);
    shapes.set(name, shape);
  }),
} as unknown as McpServer;

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

registerPageTools(server);

const base = { site_id: 'acme', page_slug: 'home' };

function parseUpdate(input: Record<string, unknown>) {
  return z.object(shapes.get('update_page') ?? {}).safeParse({ ...base, ...input });
}

async function patchBody(params: Record<string, unknown>): Promise<Record<string, unknown>> {
  await handlers.get('update_page')?.({ ...base, ...params });
  return JSON.parse(mockFetch.mock.calls[0][1].body);
}

describe('update_page', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('{}'),
    } as unknown as Response);
  });

  it('sends only the keys the caller passed', async () => {
    expect(await patchBody({ title: 'New', meta_title: 'SEO' })).toEqual({
      title: 'New',
      meta_title: 'SEO',
    });
  });

  it('forwards null as JSON null and keeps false', async () => {
    expect(
      await patchBody({ canonical_url: null, head_html: null, robots_noindex: false }),
    ).toEqual({ canonical_url: null, head_html: null, robots_noindex: false });
  });

  it('generates an id only for blocks that lack one', async () => {
    const body = await patchBody({
      blocks: [
        { kind: 'hero', props: { headline: 'Hi' } },
        { id: 'keep-me', kind: 'text', props: { body: 'x' } },
      ],
    });
    const blocks = body.blocks as Array<{ id: string; kind: string }>;
    expect(blocks[0].id).toMatch(UUID);
    expect(blocks[1].id).toBe('keep-me');
  });

  it('maps new_slug to slug', async () => {
    expect(await patchBody({ new_slug: 'about' })).toEqual({ slug: 'about' });
  });

  it('still sends the org header', async () => {
    await handlers.get('update_page')?.({ ...base, org_id: ORG_ID, title: 'T' });
    expect(mockFetch.mock.calls[0][1].headers['x-ferrgrowth-org']).toBe(ORG_ID);
  });

  it('rejects over-long meta fields in the schema', () => {
    expect(parseUpdate({ meta_title: 'a'.repeat(71) }).success).toBe(false);
    expect(parseUpdate({ meta_description: 'a'.repeat(321) }).success).toBe(false);
    expect(
      parseUpdate({ meta_title: 'a'.repeat(70), meta_description: 'a'.repeat(320) }).success,
    ).toBe(true);
  });

  it('rejects custom_css and head_html over 50000 bytes', () => {
    expect(parseUpdate({ custom_css: 'a'.repeat(50_001) }).success).toBe(false);
    expect(parseUpdate({ head_html: 'é'.repeat(25_001) }).success).toBe(false);
    expect(parseUpdate({ custom_css: 'a'.repeat(50_000) }).success).toBe(true);
  });

  it('rejects blocks without a kind', () => {
    expect(parseUpdate({ blocks: [{ props: {} }] }).success).toBe(false);
  });
});

describe('create_page', () => {
  it('has no content param and sends only slug and title', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('{}'),
    } as unknown as Response);
    expect(shapes.get('create_page')).not.toHaveProperty('content');
    await handlers.get('create_page')?.({ site_id: 'acme', slug: 'a', title: 'A' });
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ slug: 'a', title: 'A' });
  });
});
