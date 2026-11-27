import { vi, type Mock } from 'vitest';
import { z, type ZodTypeAny } from 'zod';
import type { McpServer } from '@ferrlabs/mcp-core';

process.env.FERRLABS_API_TOKEN = 'test-token';

export const GROWTH = 'https://api.ferrgrowth.com';

type ToolResult = { isError?: boolean; content: { text?: string }[] };
type Handler = (params: Record<string, unknown>) => Promise<ToolResult>;

export const handlers = new Map<string, Handler>();
export const schemas = new Map<string, Record<string, ZodTypeAny>>();

export const mockServer = {
  tool: vi.fn(
    (name: string, _desc: string, schema: Record<string, ZodTypeAny>, handler: Handler) => {
      handlers.set(name, handler);
      schemas.set(name, schema);
    },
  ),
} as unknown as McpServer;

export const mockFetch: Mock = vi.fn();
vi.stubGlobal('fetch', mockFetch);

export function resetHarness(defaultBody: unknown = { id: 'x' }): void {
  vi.clearAllMocks();
  handlers.clear();
  schemas.clear();
  mockFetch.mockReset();
  mockFetch.mockResolvedValue(ok(defaultBody));
}

export function ok(body: unknown = { id: 'x' }, status = 200): Response {
  return {
    ok: true,
    status,
    text: () => Promise.resolve(status === 204 ? '' : JSON.stringify(body)),
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

export function lastCall(): {
  url: string;
  method: string;
  rawBody: unknown;
  body: unknown;
  headers: Record<string, string>;
} {
  const [url, init] = mockFetch.mock.lastCall!;
  return {
    url: String(url),
    method: init.method ?? 'GET',
    rawBody: init.body,
    body: init.body ? JSON.parse(init.body) : undefined,
    headers: init.headers as Record<string, string>,
  };
}

export function call(name: string, params: Record<string, unknown>): Promise<ToolResult> {
  const handler = handlers.get(name);
  if (!handler) throw new Error(`tool ${name} is not registered`);
  return handler(params);
}

export function parses(tool: string, params: Record<string, unknown>): boolean {
  return z.object(schemas.get(tool)!).safeParse(params).success;
}
