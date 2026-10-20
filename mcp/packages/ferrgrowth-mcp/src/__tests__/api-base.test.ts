import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiRequestError } from '@ferrlabs/mcp-core';
import { growthRequest, orgIdSchema } from '../api-base.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const ORG_ID = '3f0c6a52-8d1e-4b7a-9c2f-5e6d7a8b9c01';

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('growthRequest org header', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(response(200, { ok: true }));
  });

  it('sends x-ferrgrowth-org when orgId is set', async () => {
    await growthRequest('/sites', { token: 't', orgId: ORG_ID });
    const { headers } = mockFetch.mock.calls[0][1];
    expect(headers['x-ferrgrowth-org']).toBe(ORG_ID);
    expect(headers['x-ferrgrowth-api-version']).toBeDefined();
  });

  it('sends no org header when orgId is unset', async () => {
    await growthRequest('/sites', { token: 't' });
    expect(mockFetch.mock.calls[0][1].headers).not.toHaveProperty('x-ferrgrowth-org');
  });

  it('rejects an invalid orgId without calling fetch', async () => {
    await expect(growthRequest('/sites', { token: 't', orgId: 'nope' })).rejects.toThrow(/org_id/);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('names the organization when the API answers 403', async () => {
    mockFetch.mockResolvedValue(response(403, { error: 'not a member' }));
    await expect(growthRequest('/sites', { token: 't', orgId: ORG_ID })).rejects.toThrow(ORG_ID);
  });

  it('keeps the ApiRequestError type and status on a 403 with an org', async () => {
    mockFetch.mockResolvedValue(response(403, { error: 'not a member' }));
    const error = await growthRequest('/sites', { token: 't', orgId: ORG_ID }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error.status).toBe(403);
  });

  it('leaves a 403 untouched when no org was requested', async () => {
    mockFetch.mockResolvedValue(response(403, { error: 'forbidden' }));
    await expect(growthRequest('/sites', { token: 't' })).rejects.toThrow(/^forbidden$/);
  });

  it('accepts only an optional UUID in the schema', () => {
    expect(orgIdSchema.safeParse(undefined).success).toBe(true);
    expect(orgIdSchema.safeParse(ORG_ID).success).toBe(true);
    expect(orgIdSchema.safeParse('nope').success).toBe(false);
  });
});
