import { z } from 'zod';
import { getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { growthRequest, orgIdSchema } from '../api-base.js';

const GOAL_KINDS = ['pageview', 'event', 'form'] as const;

type GoalKind = (typeof GOAL_KINDS)[number];

interface Goal {
  id: string;
  site_id: string;
  name: string;
  kind: GoalKind;
  target: string;
  created_at: string;
}

interface GoalsReport {
  range_days: number;
  total_visitors: number;
  goals: Array<{
    goal: Goal;
    converters: number;
    conversion_rate: number;
  }>;
}

export function registerGoalTools(server: McpServer) {
  server.tool(
    'list_goals',
    'List the conversion goals defined on a FerrGrowth site, newest first.',
    {
      org_id: orgIdSchema,
      site_id: z.string().min(1).describe('Site slug'),
    },
    async ({ org_id, site_id }) => {
      const token = await getToken();
      const goals = await growthRequest<Goal[]>(`/sites/${encodeURIComponent(site_id)}/goals`, {
        token,
        orgId: org_id,
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(goals) }],
      };
    },
  );

  server.tool(
    'create_goal',
    'Create a conversion goal on a FerrGrowth site and return it. A site can have one goal per kind and target.',
    {
      org_id: orgIdSchema,
      site_id: z.string().min(1).describe('Site slug'),
      name: z.string().min(1).max(100),
      kind: z
        .enum(GOAL_KINDS)
        .describe(
          'pageview matches a page slug, event a custom event name, form a form name on the site.',
        ),
      target: z.string().min(1).max(200).describe('Page slug, event name or form name to match.'),
    },
    async ({ org_id, site_id, name, kind, target }) => {
      const token = await getToken();
      const goal = await growthRequest<Goal>(`/sites/${encodeURIComponent(site_id)}/goals`, {
        token,
        orgId: org_id,
        method: 'POST',
        body: { name, kind, target },
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(goal) }],
      };
    },
  );

  server.tool(
    'delete_goal',
    'Delete a FerrGrowth conversion goal. Irreversible. The underlying analytics events are kept.',
    {
      org_id: orgIdSchema,
      site_id: z.string().min(1).describe('Site slug'),
      goal_id: z.string().min(1).describe('Goal id'),
    },
    async ({ org_id, site_id, goal_id }) => {
      const token = await getToken();
      await growthRequest<void>(
        `/sites/${encodeURIComponent(site_id)}/goals/${encodeURIComponent(goal_id)}`,
        { token, orgId: org_id, method: 'DELETE' },
      );
      return {
        content: [{ type: 'text' as const, text: `Goal ${goal_id} deleted.` }],
      };
    },
  );

  server.tool(
    'get_goal_stats',
    'Conversion stats for every goal of a FerrGrowth site: visitors who converted, and the conversion rate against the unique visitors of the window.',
    {
      org_id: orgIdSchema,
      site_id: z.string().min(1).describe('Site slug'),
      days: z
        .number()
        .int()
        .min(1)
        .max(365)
        .optional()
        .describe('Look-back window in days (default 30).'),
    },
    async ({ org_id, site_id, days }) => {
      const token = await getToken();
      const qs = days !== undefined ? `?days=${days}` : '';
      const report = await growthRequest<GoalsReport>(
        `/sites/${encodeURIComponent(site_id)}/goals/stats${qs}`,
        { token, orgId: org_id },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(report) }],
      };
    },
  );
}
