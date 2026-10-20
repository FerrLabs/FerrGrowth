import { z } from 'zod';
import { getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { growthRequest, orgIdSchema } from '../api-base.js';

interface SiteMember {
  id: string;
  site_id: string;
  email: string;
  display_name: string | null;
  email_verified: boolean;
  status: 'active' | 'suspended';
  created_at: string;
  last_login_at: string | null;
}

interface MemberList {
  total: number;
  items: SiteMember[];
}

function memberPath(site_id: string, member_id: string): string {
  return `/sites/${encodeURIComponent(site_id)}/members/${encodeURIComponent(member_id)}`;
}

export function registerMemberTools(server: McpServer) {
  server.tool(
    'list_site_members',
    'List the end-user members who signed up on a FerrGrowth site, newest first. Returns `total` and a page of `items`.',
    {
      org_id: orgIdSchema,
      site_id: z.string().min(1).describe('Site slug'),
      limit: z.number().int().min(1).max(200).optional().describe('Page size (default 50).'),
      offset: z.number().int().min(0).optional().describe('Members to skip (default 0).'),
    },
    async ({ org_id, site_id, limit, offset }) => {
      const token = await getToken();
      const params = new URLSearchParams();
      if (limit !== undefined) params.set('limit', String(limit));
      if (offset !== undefined) params.set('offset', String(offset));
      const qs = params.size > 0 ? `?${params.toString()}` : '';
      const members = await growthRequest<MemberList>(
        `/sites/${encodeURIComponent(site_id)}/members${qs}`,
        { token, orgId: org_id },
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: toToolText(members, { narrowWith: 'Pass a smaller limit or page with offset.' }),
          },
        ],
      };
    },
  );

  server.tool(
    'update_site_member',
    'Set the status of a FerrGrowth site member and return the updated member. Suspending also signs the member out of every session.',
    {
      org_id: orgIdSchema,
      site_id: z.string().min(1).describe('Site slug'),
      member_id: z.string().min(1).describe('Member id'),
      status: z.enum(['active', 'suspended']),
    },
    async ({ org_id, site_id, member_id, status }) => {
      const token = await getToken();
      const member = await growthRequest<SiteMember>(memberPath(site_id, member_id), {
        token,
        orgId: org_id,
        method: 'PATCH',
        body: { status },
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(member) }],
      };
    },
  );

  server.tool(
    'remove_site_member',
    'Delete a member account from a FerrGrowth site. Irreversible: the account and its sessions are gone, and the person has to sign up again.',
    {
      org_id: orgIdSchema,
      site_id: z.string().min(1).describe('Site slug'),
      member_id: z.string().min(1).describe('Member id'),
    },
    async ({ org_id, site_id, member_id }) => {
      const token = await getToken();
      await growthRequest<void>(memberPath(site_id, member_id), {
        token,
        orgId: org_id,
        method: 'DELETE',
      });
      return {
        content: [{ type: 'text' as const, text: `Member ${member_id} removed from ${site_id}.` }],
      };
    },
  );
}
