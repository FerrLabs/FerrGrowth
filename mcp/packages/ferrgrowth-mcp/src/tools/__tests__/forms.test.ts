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

function lastCall(): { url: string; method: string; body: unknown } {
  const [url, init] = mockFetch.mock.calls[0];
  return {
    url: String(url),
    method: init.method ?? 'GET',
    body: init.body ? JSON.parse(init.body) : undefined,
  };
}

const GROWTH = 'https://api.ferrgrowth.com';

function call(name: string, params: Record<string, unknown>) {
  const handler = handlers.get(name);
  if (!handler) throw new Error(`tool ${name} is not registered`);
  return handler(params);
}

function submissions(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `s-${i}`,
    form_id: 'f-1',
    fields: { email: `user${i}@example.test` },
    submitted_at: '2026-10-01T00:00:00Z',
  }));
}

describe('ferrgrowth form tools', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    handlers.clear();
    schemas.clear();
    mockFetch.mockResolvedValue(ok());
    const { registerFormTools } = await import('../forms.js');
    registerFormTools(mockServer);
  });

  it('list_form_submissions does not send a limit the API would ignore', async () => {
    mockFetch.mockResolvedValue(ok(submissions(3)));
    await call('list_form_submissions', { site_id: 'shop', form_id: 'f-1', limit: 10 });
    expect(lastCall().url).toBe(`${GROWTH}/sites/shop/forms/f-1/submissions`);
  });

  it('list_form_submissions keeps only the most recent N it was asked for', async () => {
    mockFetch.mockResolvedValue(ok(submissions(200)));
    const result = await call('list_form_submissions', {
      site_id: 'shop',
      form_id: 'f-1',
      limit: 2,
    });
    const returned = JSON.parse(result.content[0].text!) as Array<{ id: string }>;
    expect(returned.map((s) => s.id)).toEqual(['s-0', 's-1']);
  });

  it('list_form_submissions caps limit at the 200 the API returns', () => {
    const limit = schemas.get('list_form_submissions')!.limit;
    expect(limit.safeParse(200).success).toBe(true);
    expect(limit.safeParse(201).success).toBe(false);
  });

  it('create_form forwards the destination and its config', async () => {
    await call('create_form', {
      site_id: 'shop',
      name: 'Contact',
      fields: [{ name: 'email', label: 'Email', type: 'email', required: true }],
      destination: 'webhook',
      destination_config: { url: 'https://hooks.example.test/in' },
    });
    const sent = lastCall();
    expect(sent.url).toBe(`${GROWTH}/sites/shop/forms`);
    expect(sent.method).toBe('POST');
    expect(sent.body).toEqual({
      name: 'Contact',
      fields: [{ name: 'email', label: 'Email', type: 'email', required: true }],
      destination: 'webhook',
      destination_config: { url: 'https://hooks.example.test/in' },
    });
  });

  it('update_form can switch the destination without touching the fields', async () => {
    await call('update_form', { site_id: 'shop', form_id: 'f-1', destination: 'hubspot' });
    const sent = lastCall();
    expect(sent.method).toBe('PATCH');
    expect(sent.body).toEqual({ destination: 'hubspot' });
  });

  it('rejects a destination the API does not know', () => {
    const dest = schemas.get('create_form')!.destination;
    expect(dest.safeParse('mailchimp').success).toBe(false);
    expect(dest.safeParse('customer_io').success).toBe(true);
  });
});
