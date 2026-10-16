import { z } from 'zod';
import { getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { growthRequest } from '../api-base.js';

type SeoStrategy = 'mobile' | 'desktop';

interface SeoAuditRun {
  id: string;
  site_id: string;
  page_id: string | null;
  kind: string;
  target: string;
  strategy: SeoStrategy | null;
  score: number | null;
  payload: unknown;
  source: string;
  triggered_by: string | null;
  run_at: string;
}

interface SeoOverviewEntry {
  page_id: string;
  page_slug: string;
  page_title: string;
  target: string;
  last_run: SeoAuditRun | null;
}

function pageAuditPath(siteId: string, pageSlug: string): string {
  return `/sites/${encodeURIComponent(siteId)}/pages/${encodeURIComponent(pageSlug)}/audits/seo`;
}

export function registerSeoTools(server: McpServer) {
  server.tool(
    'get_seo_overview',
    'One entry per page of a FerrGrowth site: page slug, title, audited URL and the latest SEO audit run (null if the page was never audited).',
    {
      site_id: z.string().min(1).describe('Site slug'),
    },
    async ({ site_id }) => {
      const token = await getToken();
      const overview = await growthRequest<SeoOverviewEntry[]>(
        `/sites/${encodeURIComponent(site_id)}/audits/seo/overview`,
        { token },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(overview) }],
      };
    },
  );

  server.tool(
    'run_seo_audit',
    'Run a fresh SEO audit on a single FerrGrowth page, synchronously. Returns the stored audit run: audited URL, composite score and the full FerrLens payload.',
    {
      site_id: z.string().min(1).describe('Site slug'),
      page_slug: z.string().min(1).describe('Page slug'),
      strategy: z
        .enum(['mobile', 'desktop'])
        .optional()
        .describe('Device profile to audit with (default mobile).'),
    },
    async ({ site_id, page_slug, strategy }) => {
      const token = await getToken();
      const result = await growthRequest<SeoAuditRun>(pageAuditPath(site_id, page_slug), {
        token,
        method: 'POST',
        body: { strategy },
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(result) }],
      };
    },
  );

  server.tool(
    'list_seo_audits',
    'SEO audit history of a single FerrGrowth page, most recent first. Each run carries the score, strategy, audited URL and full payload.',
    {
      site_id: z.string().min(1).describe('Site slug'),
      page_slug: z.string().min(1).describe('Page slug'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe('Max runs to return (default 30).'),
    },
    async ({ site_id, page_slug, limit }) => {
      const token = await getToken();
      const qs = limit !== undefined ? `?limit=${limit}` : '';
      const runs = await growthRequest<SeoAuditRun[]>(`${pageAuditPath(site_id, page_slug)}${qs}`, {
        token,
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: toToolText(runs, { narrowWith: 'Pass a smaller limit.' }),
          },
        ],
      };
    },
  );
}
