import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { McpServer } from '@ferrlabs/mcp-core';

process.env.FERRLABS_API_TOKEN = 'test-token';

type Handler = (params: Record<string, unknown>) => Promise<unknown>;

const handlers = new Map<string, Handler>();
const mockServer = {
  tool: vi.fn((name: string, _desc: string, _schema: unknown, handler: Handler) => {
    handlers.set(name, handler);
  }),
} as unknown as McpServer;

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('dot segments in path arguments', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    handlers.clear();
    const { registerReleaseTools } = await import('../releases.js');
    const { registerPageTools } = await import('../pages.js');
    registerReleaseTools(mockServer);
    registerPageTools(mockServer);
  });

  it('restore_release refuses ".." as release_id', async () => {
    await expect(
      handlers.get('restore_release')!({ site_id: 'acme', release_id: '..' }),
    ).rejects.toThrow(/Invalid path segment/);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('get_page refuses ".." as site_id', async () => {
    await expect(handlers.get('get_page')!({ site_id: '..', page_slug: 'home' })).rejects.toThrow(
      /Invalid path segment/,
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
