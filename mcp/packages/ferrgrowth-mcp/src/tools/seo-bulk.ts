import { z } from 'zod';
import { getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { growthRequest } from '../api-base.js';

interface RunAllSeoResult {
  enqueued: number;
  already_queued: number;
  total_pages: number;
}

interface SeoQueueStatus {
  queued: number;
  running: number;
  done_today: number;
  failed_recent: number;
}

interface CancelSeoResult {
  cancelled: number;
}

interface WorkspaceSeoEntry {
  site_id: string;
  site_slug: string;
  site_name: string;
  site_status: string;
  pages_total: number;
  pages_audited: number;
  avg_score: number | null;
  last_run_at: string | null;
}

const runAllParams = {
  stale_after_days: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      'Only queue pages whose last audit is older than this many days (default 30, 0 queues every page).',
    ),
  strategy: z
    .enum(['mobile', 'desktop'])
    .optional()
    .describe('Device profile to audit with (default mobile).'),
};

function text(value: unknown) {
  return { content: [{ type: 'text' as const, text: toToolText(value) }] };
}

export function registerSeoBulkTools(server: McpServer) {
  server.tool(
    'run_site_seo_audits',
    'Queue an SEO audit for every stale page of a FerrGrowth site. Audits run in the background; returns counts of pages enqueued, already queued and in total. Poll get_site_seo_queue_status for progress and read results with get_seo_overview.',
    {
      site_id: z.string().min(1).describe('Site slug'),
      ...runAllParams,
    },
    async ({ site_id, stale_after_days, strategy }) => {
      const token = await getToken();
      const result = await growthRequest<RunAllSeoResult>(
        `/sites/${encodeURIComponent(site_id)}/audits/seo/run-all`,
        { token, method: 'POST', body: { stale_after_days, strategy } },
      );
      return text(result);
    },
  );

  server.tool(
    'get_site_seo_queue_status',
    'Progress of the background SEO audit queue for one FerrGrowth site: jobs queued (including retries), running, done in the last 24 hours and dead in the last 24 hours.',
    {
      site_id: z.string().min(1).describe('Site slug'),
    },
    async ({ site_id }) => {
      const token = await getToken();
      const status = await growthRequest<SeoQueueStatus>(
        `/sites/${encodeURIComponent(site_id)}/audits/seo/queue-status`,
        { token },
      );
      return text(status);
    },
  );

  server.tool(
    'cancel_site_seo_audits',
    'Cancel the queued and retry-pending SEO audits of a FerrGrowth site. Those pages are not audited and must be queued again; audits already running still finish and completed results are kept. Returns the number of jobs cancelled.',
    {
      site_id: z.string().min(1).describe('Site slug'),
    },
    async ({ site_id }) => {
      const token = await getToken();
      const result = await growthRequest<CancelSeoResult>(
        `/sites/${encodeURIComponent(site_id)}/audits/seo/queue-status/cancel`,
        { token, method: 'POST' },
      );
      return text(result);
    },
  );

  server.tool(
    'run_workspace_seo_audits',
    'Queue an SEO audit for every stale page of every non-archived site in the organisation the token is bound to. Audits run in the background; returns summed counts of pages enqueued, already queued and in total. Poll get_workspace_seo_queue_status for progress and read results with get_workspace_seo_overview.',
    runAllParams,
    async ({ stale_after_days, strategy }) => {
      const token = await getToken();
      const result = await growthRequest<RunAllSeoResult>('/audits/seo/run-all-workspace', {
        token,
        method: 'POST',
        body: { stale_after_days, strategy },
      });
      return text(result);
    },
  );

  server.tool(
    'get_workspace_seo_queue_status',
    'Progress of the background SEO audit queue across the organisation the token is bound to: jobs queued (including retries), running, done in the last 24 hours and dead in the last 24 hours.',
    {},
    async () => {
      const token = await getToken();
      const status = await growthRequest<SeoQueueStatus>('/audits/seo/queue-status-workspace', {
        token,
      });
      return text(status);
    },
  );

  server.tool(
    'get_workspace_seo_overview',
    'One row per FerrGrowth site in the organisation the token is bound to: total pages, pages audited, average latest SEO score and time of the last audit.',
    {},
    async () => {
      const token = await getToken();
      const overview = await growthRequest<WorkspaceSeoEntry[]>('/audits/seo/workspace-overview', {
        token,
      });
      return text(overview);
    },
  );
}
