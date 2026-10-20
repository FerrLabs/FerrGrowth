import { describe, it, expect, vi } from 'vitest';
import type { ZodTypeAny } from 'zod';
import type { McpServer } from '@ferrlabs/mcp-core';
import { register } from '../register.js';

const ORG_ID = '3f0c6a52-8d1e-4b7a-9c2f-5e6d7a8b9c01';

type Shape = Record<string, ZodTypeAny>;

const schemas = new Map<string, Shape>();
const server = {
  tool: vi.fn((name: string, _description: string, shape: Shape) => {
    schemas.set(name, shape);
  }),
} as unknown as McpServer;

register(server);

describe('tool registry', () => {
  it('registers tools', () => {
    expect(schemas.size).toBeGreaterThan(0);
  });

  it.each([...schemas.keys()])('%s takes an optional UUID org_id', (name) => {
    const orgId = schemas.get(name)?.org_id;
    expect(orgId, `${name} has no org_id`).toBeDefined();
    expect(orgId?.safeParse(undefined).success).toBe(true);
    expect(orgId?.safeParse(ORG_ID).success).toBe(true);
    expect(orgId?.safeParse('nope').success).toBe(false);
  });
});
