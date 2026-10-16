import { z } from 'zod';
import {
  getToken,
  type McpServer,
  revealedSecretText,
  secretRevealRefusal,
  toToolText,
} from '@ferrlabs/mcp-core';
import { growthRequest } from '../api-base.js';

interface ServerToken {
  id: string;
  prefix: string;
  label: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

interface CreatedServerToken {
  id: string;
  token: string;
  prefix: string;
  label: string;
  created_at: string;
}

export function registerServerTokenTools(server: McpServer) {
  server.tool(
    'list_server_tokens',
    'List the server tokens of a FerrGrowth site (used to send server-side events). Returns prefix, label, last use and revocation date, never the secret.',
    {
      site_id: z.string().min(1).describe('Site slug'),
    },
    async ({ site_id }) => {
      const token = await getToken();
      const tokens = await growthRequest<ServerToken[]>(
        `/sites/${encodeURIComponent(site_id)}/server-tokens`,
        { token },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(tokens) }],
      };
    },
  );

  server.tool(
    'create_server_token',
    'Create a server token for a FerrGrowth site. Disabled unless FERRLABS_MCP_ALLOW_TOKEN_REVEAL=1, because the API shows the secret exactly once and returning it here writes it into the conversation transcript.',
    {
      site_id: z.string().min(1).describe('Site slug'),
      label: z.string().min(1).max(80).describe('Label to tell the token apart'),
    },
    async ({ site_id, label }) => {
      const refusal = secretRevealRefusal({
        action: 'create a server token',
        instead: 'Create the token from the site settings in app.ferrgrowth.com',
      });
      if (refusal) return refusal;

      const token = await getToken();
      const created = await growthRequest<CreatedServerToken>(
        `/sites/${encodeURIComponent(site_id)}/server-tokens`,
        { token, method: 'POST', body: { label } },
      );
      const { token: secret, ...meta } = created;
      return {
        content: [
          {
            type: 'text' as const,
            text: revealedSecretText({
              label: 'Server token created',
              secret,
              revokeTool: 'revoke_server_token',
              details: toToolText(meta),
            }),
          },
        ],
      };
    },
  );

  server.tool(
    'revoke_server_token',
    'Revoke a server token of a FerrGrowth site. Irreversible: requests signed with it are rejected from now on.',
    {
      site_id: z.string().min(1).describe('Site slug'),
      token_id: z.string().min(1).describe('Server token id'),
    },
    async ({ site_id, token_id }) => {
      const token = await getToken();
      await growthRequest<void>(
        `/sites/${encodeURIComponent(site_id)}/server-tokens/${encodeURIComponent(token_id)}`,
        { token, method: 'DELETE' },
      );
      return {
        content: [{ type: 'text' as const, text: `Server token ${token_id} revoked.` }],
      };
    },
  );
}
