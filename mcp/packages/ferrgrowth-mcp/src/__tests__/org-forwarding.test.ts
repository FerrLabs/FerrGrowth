import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ZodTypeAny } from 'zod';
import type { McpServer } from '@ferrlabs/mcp-core';
import { registerSiteTools } from '../tools/sites.js';

process.env.FERRLABS_API_TOKEN = 'test-token';

const ORG_ID = '3f0c6a52-8d1e-4b7a-9c2f-5e6d7a8b9c01';

type Handler = (params: Record<string, unknown>) => Promise<unknown>;

const handlers = new Map<string, Handler>();
const server = {
  tool: vi.fn((name: string, _d: string, _s: Record<string, ZodTypeAny>, handler: Handler) => {
    handlers.set(name, handler);
  }),
} as unknown as McpServer;

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

registerSiteTools(server);

function headersOfLastCall(): Record<string, string> {
  return mockFetch.mock.calls[0][1].headers;
}

describe('tool org_id forwarding', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('[]'),
    } as unknown as Response);
  });

  it('sends the org header when the tool gets an org_id', async () => {
    await handlers.get('list_sites')?.({ org_id: ORG_ID });
    expect(headersOfLastCall()['x-ferrgrowth-org']).toBe(ORG_ID);
  });

  it('sends no org header when the tool gets no org_id', async () => {
    await handlers.get('list_sites')?.({});
    expect(headersOfLastCall()).not.toHaveProperty('x-ferrgrowth-org');
  });
});
