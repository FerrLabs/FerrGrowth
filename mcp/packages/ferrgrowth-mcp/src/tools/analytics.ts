import { z } from 'zod';
import { getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { growthRequest } from '../api-base.js';

interface PeriodTotals {
  visits: number;
  unique_visitors: number;
  conversions: number;
}

interface AnalyticsSummary extends PeriodTotals {
  range_days: number;
  conversion_rate: number;
  series: Array<PeriodTotals & { date: string }>;
  previous: PeriodTotals & { conversion_rate: number };
  top_pages: Array<{ slug: string; title: string; visits: number; conversion_rate: number }>;
  top_referrers: Array<{ source: string; visits: number }>;
  top_countries: Array<{ country_code: string; visits: number }>;
}

interface RealtimeSnapshot {
  visitors: number;
  pageviews_last_5min: number;
  top_pages: Array<{ slug: string; title: string; visitors: number }>;
}

interface TrackingStatus {
  tracking_id: string;
  first_seen_at: string | null;
  last_seen_at: string | null;
  events_last_24h: number;
  events_total: number;
}

interface Heatmap {
  page_slug: string;
  total_clicks: number;
  clicks: Array<{ x: number; y: number }>;
  viewport_buckets: Array<{ vw_min: number; vw_max: number; count: number }>;
}

export function registerAnalyticsTools(server: McpServer) {
  server.tool(
    'get_analytics_summary',
    'Visits, unique visitors, conversions and conversion rate for a FerrGrowth site over the last range_days days, with a daily series, the same totals for the previous period, and the top pages, referrers and countries.',
    {
      site_id: z.string().min(1).describe('Site slug'),
      range_days: z
        .number()
        .int()
        .min(1)
        .max(365)
        .optional()
        .describe('Window in days, counted back from now (default 30).'),
    },
    async ({ site_id, range_days }) => {
      const token = await getToken();
      const qs = range_days !== undefined ? `?range_days=${range_days}` : '';
      const summary = await growthRequest<AnalyticsSummary>(
        `/sites/${encodeURIComponent(site_id)}/analytics${qs}`,
        { token },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(summary) }],
      };
    },
  );

  server.tool(
    'get_realtime_analytics',
    'Live snapshot of a FerrGrowth site: distinct visitors in the last 30 seconds, pageviews in the last 5 minutes and the top 5 pages being viewed right now.',
    {
      site_id: z.string().min(1).describe('Site slug'),
    },
    async ({ site_id }) => {
      const token = await getToken();
      const snapshot = await growthRequest<RealtimeSnapshot>(
        `/sites/${encodeURIComponent(site_id)}/analytics/realtime`,
        { token },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(snapshot) }],
      };
    },
  );

  server.tool(
    'get_tracking_status',
    'Check whether the tracking snippet of a FerrGrowth site is installed and firing: tracking id, first and last event timestamps (null when nothing was ever received), events in the last 24 hours and in total.',
    {
      site_id: z.string().min(1).describe('Site slug'),
    },
    async ({ site_id }) => {
      const token = await getToken();
      const status = await growthRequest<TrackingStatus>(
        `/sites/${encodeURIComponent(site_id)}/tracking/status`,
        { token },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(status) }],
      };
    },
  );

  server.tool(
    'get_page_heatmap',
    'Click heatmap of a FerrGrowth page: total clicks, a random sample of up to 5000 click points (x and y as 0..1 fractions of the page) and click counts per viewport width bucket.',
    {
      site_id: z.string().min(1).describe('Site slug'),
      page_slug: z.string().min(1).describe('Page slug'),
      days: z
        .number()
        .int()
        .min(1)
        .max(365)
        .optional()
        .describe('Look-back window in days (default 30).'),
    },
    async ({ site_id, page_slug, days }) => {
      const token = await getToken();
      const qs = days !== undefined ? `?days=${days}` : '';
      const heatmap = await growthRequest<Heatmap>(
        `/sites/${encodeURIComponent(site_id)}/pages/${encodeURIComponent(page_slug)}/heatmap${qs}`,
        { token },
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: toToolText(heatmap, { narrowWith: 'Pass a smaller days window.' }),
          },
        ],
      };
    },
  );
}
