import { apiRequest } from '@ferrlabs/mcp-core';

export const GROWTH_API_URL = process.env.FERRGROWTH_API_URL ?? 'https://api.ferrgrowth.com';

const API_VERSION_HEADER = 'x-ferrgrowth-api-version';

export const GROWTH_API_VERSION = process.env.FERRGROWTH_API_VERSION ?? '2026-08-04';

interface GrowthRequestOptions {
  method?: string;
  body?: unknown;
  token: string;
}

export function growthRequest<T>(path: string, options: GrowthRequestOptions): Promise<T> {
  const { token, ...rest } = options;
  return apiRequest<T>(path, {
    ...rest,
    token,
    baseUrl: GROWTH_API_URL,
    headers: { [API_VERSION_HEADER]: GROWTH_API_VERSION },
  });
}
