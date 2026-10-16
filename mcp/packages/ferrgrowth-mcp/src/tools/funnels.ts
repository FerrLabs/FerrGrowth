import { z } from 'zod';
import { getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { growthRequest } from '../api-base.js';

const STEP_KINDS = ['pageview', 'event', 'form'] as const;

type StepKind = (typeof STEP_KINDS)[number];

interface FunnelStep {
  id: string;
  kind: StepKind;
  target: string;
  label: string;
}

interface Funnel {
  id: string;
  site_id: string;
  name: string;
  steps: FunnelStep[];
  created_at: string;
  updated_at: string;
}

interface FunnelAnalytics {
  funnel: Funnel;
  range_days: number;
  steps: Array<{
    step_index: number;
    kind: StepKind;
    target: string;
    label: string;
    visitors: number;
    conversion_rate: number;
    drop_off_rate: number;
  }>;
  overall_conversion_rate: number;
}

const stepsSchema = z
  .array(
    z.object({
      kind: z
        .enum(STEP_KINDS)
        .describe(
          'pageview matches a page slug, event a custom event name, form a form name on the site.',
        ),
      target: z.string().min(1).max(200).describe('Page slug, event name or form name to match.'),
      label: z.string().min(1).max(100).describe('Display name of the step.'),
    }),
  )
  .min(1)
  .max(20);

export function registerFunnelTools(server: McpServer) {
  server.tool(
    'list_funnels',
    'List conversion funnels defined on a FerrGrowth site, most recently updated first, with their ordered steps.',
    {
      site_id: z.string().min(1).describe('Site slug'),
    },
    async ({ site_id }) => {
      const token = await getToken();
      const funnels = await growthRequest<Funnel[]>(
        `/sites/${encodeURIComponent(site_id)}/funnels`,
        { token },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(funnels) }],
      };
    },
  );

  server.tool(
    'create_funnel',
    'Create a conversion funnel on a FerrGrowth site and return it. Without steps the API seeds a default Visit, Signup, Activate funnel.',
    {
      site_id: z.string().min(1).describe('Site slug'),
      name: z.string().min(1).max(100),
      steps: stepsSchema.optional().describe('Ordered funnel steps, 1 to 20.'),
    },
    async ({ site_id, name, steps }) => {
      const token = await getToken();
      const funnel = await growthRequest<Funnel>(`/sites/${encodeURIComponent(site_id)}/funnels`, {
        token,
        method: 'POST',
        body: steps === undefined ? { name } : { name, steps },
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(funnel) }],
      };
    },
  );

  server.tool(
    'update_funnel',
    'Rename a FerrGrowth funnel or replace its steps, and return it. Passing steps replaces the whole list and assigns new step ids.',
    {
      site_id: z.string().min(1).describe('Site slug'),
      funnel_id: z.string().min(1).describe('Funnel id'),
      name: z.string().min(1).max(100).optional(),
      steps: stepsSchema.optional().describe('Full replacement list of ordered steps, 1 to 20.'),
    },
    async ({ site_id, funnel_id, name, steps }) => {
      const token = await getToken();
      const funnel = await growthRequest<Funnel>(
        `/sites/${encodeURIComponent(site_id)}/funnels/${encodeURIComponent(funnel_id)}`,
        {
          token,
          method: 'PATCH',
          body: {
            ...(name !== undefined && { name }),
            ...(steps !== undefined && { steps }),
          },
        },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(funnel) }],
      };
    },
  );

  server.tool(
    'delete_funnel',
    'Delete a FerrGrowth funnel definition. Irreversible. The underlying analytics events are kept.',
    {
      site_id: z.string().min(1).describe('Site slug'),
      funnel_id: z.string().min(1).describe('Funnel id'),
    },
    async ({ site_id, funnel_id }) => {
      const token = await getToken();
      await growthRequest<void>(
        `/sites/${encodeURIComponent(site_id)}/funnels/${encodeURIComponent(funnel_id)}`,
        { token, method: 'DELETE' },
      );
      return {
        content: [{ type: 'text' as const, text: `Funnel ${funnel_id} deleted.` }],
      };
    },
  );

  server.tool(
    'get_funnel_analytics',
    'Conversion analytics of a FerrGrowth funnel: visitors reaching each step in order, conversion rate from the entry step, drop-off from the previous step and the overall conversion rate.',
    {
      site_id: z.string().min(1).describe('Site slug'),
      funnel_id: z.string().min(1).describe('Funnel id'),
      days: z
        .number()
        .int()
        .min(1)
        .max(365)
        .optional()
        .describe('Look-back window in days (default 30).'),
    },
    async ({ site_id, funnel_id, days }) => {
      const token = await getToken();
      const qs = days !== undefined ? `?days=${days}` : '';
      const analytics = await growthRequest<FunnelAnalytics>(
        `/sites/${encodeURIComponent(site_id)}/funnels/${encodeURIComponent(funnel_id)}/analytics${qs}`,
        { token },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(analytics) }],
      };
    },
  );
}
