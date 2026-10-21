import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z, type ZodTypeAny } from 'zod';
import type { McpServer } from '@ferrlabs/mcp-core';
import { registerSiteTools } from '../sites.js';

process.env.FERRLABS_API_TOKEN = 'test-token';

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

registerSiteTools(server);

const theme = {
  colors: {
    brand: '#a13a1e',
    accent: '#f89f2b',
    bg: '#f8f4e9',
    surface: '#fbf8f0',
    text: '#1a1a1a',
    muted: '#5e6a52',
  },
  spacing: { sm: 24, md: 48, lg: 80, xl: 120 },
  fonts: { heading: { family: 'Fraunces' }, body: { family: 'Inter' } },
};

function parseUpdate(input: Record<string, unknown>) {
  return z.object(shapes.get('update_site') ?? {}).safeParse({ site_id: 'acme', ...input });
}

describe('update_site', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('{}'),
    } as unknown as Response);
  });

  it('forwards the theme untouched and nothing else', async () => {
    await handlers.get('update_site')?.({ site_id: 'acme', theme });
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ theme });
  });

  it('sends null to clear custom_css', async () => {
    await handlers.get('update_site')?.({ site_id: 'acme', custom_css: null });
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ custom_css: null });
  });

  it('rejects a theme without spacing', () => {
    expect(parseUpdate({ theme: { colors: theme.colors } }).success).toBe(false);
  });

  it('rejects oversized site css and head html', () => {
    expect(parseUpdate({ custom_css: 'a'.repeat(50_001) }).success).toBe(false);
    expect(parseUpdate({ head_html: 'a'.repeat(50_001) }).success).toBe(false);
  });
});
