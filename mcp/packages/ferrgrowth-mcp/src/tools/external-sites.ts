import { z } from 'zod';
import { getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { growthRequest } from '../api-base.js';

interface DiscoverExternalResult {
  discovered: number;
  upserted: number;
}

export function registerExternalSiteTools(server: McpServer) {
  server.tool(
    'verify_external_url',
    'Prove ownership of the external URL of an external FerrGrowth site and return the updated site. Passes when the host is an already verified custom domain, or carries the verification token in a DNS TXT record or at /.well-known/ferrgrowth-verify.txt. Retry after publishing the token.',
    {
      site_id: z.string().min(1).describe('Site slug'),
    },
    async ({ site_id }) => {
      const token = await getToken();
      const site = await growthRequest<unknown>(
        `/sites/${encodeURIComponent(site_id)}/external-url/verify`,
        { token, method: 'POST' },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(site) }],
      };
    },
  );

  server.tool(
    'discover_external_pages',
    'Read the sitemap of the verified external URL of an external FerrGrowth site and upsert the pages found. Returns how many were discovered and upserted.',
    {
      site_id: z.string().min(1).describe('Site slug'),
      deep: z
        .boolean()
        .optional()
        .describe('Also crawl links on top of the sitemap (default false).'),
    },
    async ({ site_id, deep }) => {
      const token = await getToken();
      const result = await growthRequest<DiscoverExternalResult>(
        `/sites/${encodeURIComponent(site_id)}/discover-external`,
        { token, method: 'POST', body: { deep: deep ?? false } },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(result) }],
      };
    },
  );
}
