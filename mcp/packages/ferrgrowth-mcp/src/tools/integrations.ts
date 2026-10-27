import { z } from 'zod';
import { getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { growthRequest, orgIdSchema, pathSegment } from '../api-base.js';

const INTEGRATION_KINDS = [
  'stripe',
  'resend',
  'hubspot',
  'salesforce',
  'attio',
  'customer_io',
  'slack',
  'webhook',
] as const;

interface Integration {
  kind: (typeof INTEGRATION_KINDS)[number];
  status: string;
  connected_at: string | null;
}

export function registerIntegrationTools(server: McpServer) {
  server.tool(
    'list_integrations',
    'List every FerrGrowth integration kind for the active org with its status (`disconnected` when never connected) and connection date.',
    { org_id: orgIdSchema },
    async ({ org_id }) => {
      const token = await getToken();
      const integrations = await growthRequest<Integration[]>('/integrations', {
        token,
        orgId: org_id,
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(integrations) }],
      };
    },
  );

  server.tool(
    'disconnect_integration',
    'Disconnect a FerrGrowth integration for the active org. Irreversible: its stored configuration is deleted and it has to be connected again from the app.',
    {
      org_id: orgIdSchema,
      kind: z.enum(INTEGRATION_KINDS),
    },
    async ({ org_id, kind }) => {
      const token = await getToken();
      await growthRequest<void>(`/integrations/${pathSegment(kind)}/disconnect`, {
        token,
        orgId: org_id,
        method: 'POST',
      });
      return {
        content: [{ type: 'text' as const, text: `Integration ${kind} disconnected.` }],
      };
    },
  );
}
