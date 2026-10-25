import { z } from 'zod';
import { ApiRequestError, apiRequest } from '@ferrlabs/mcp-core';

export const GROWTH_API_URL = process.env.FERRGROWTH_API_URL ?? 'https://api.ferrgrowth.com';

const API_VERSION_HEADER = 'x-ferrgrowth-api-version';
const ORG_HEADER = 'x-ferrgrowth-org';

export const GROWTH_API_VERSION = process.env.FERRGROWTH_API_VERSION ?? '2026-08-04';

export const orgIdSchema = z
  .guid()
  .optional()
  .describe('Organization id. Defaults to the organization the token is bound to.');

interface GrowthRequestOptions {
  method?: string;
  body?: unknown;
  token: string;
  orgId?: string | undefined;
}

function orgHeader(orgId: string | undefined): Record<string, string> {
  if (orgId === undefined) return {};
  if (!z.guid().safeParse(orgId).success) {
    throw new Error('org_id must be a UUID');
  }
  return { [ORG_HEADER]: orgId };
}

function forbiddenOrgError(orgId: string, cause: ApiRequestError): ApiRequestError {
  return new ApiRequestError(
    `Access to organization ${orgId} denied: ${cause.message}`,
    cause.status,
    cause.code,
  );
}

export async function growthRequest<T>(path: string, options: GrowthRequestOptions): Promise<T> {
  const { token, orgId, ...rest } = options;
  try {
    return await apiRequest<T>(path, {
      ...rest,
      token,
      baseUrl: GROWTH_API_URL,
      headers: { [API_VERSION_HEADER]: GROWTH_API_VERSION, ...orgHeader(orgId) },
    });
  } catch (error) {
    if (orgId !== undefined && error instanceof ApiRequestError && error.status === 403) {
      throw forbiddenOrgError(orgId, error);
    }
    throw error;
  }
}

export function pathSegment(value: string): string {
  if (value === '.' || value === '..') {
    throw new Error(`Invalid path segment: "${value}"`);
  }
  return encodeURIComponent(value);
}
