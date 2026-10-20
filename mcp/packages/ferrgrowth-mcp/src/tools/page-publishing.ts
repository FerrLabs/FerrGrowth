import { z } from 'zod';
import { getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { growthRequest, orgIdSchema } from '../api-base.js';

const siteId = z.string().min(1).describe('Site slug');
const pageSlug = z.string().min(1).describe('Page slug');

function pagePath(site: string, page: string): string {
  return `/sites/${encodeURIComponent(site)}/pages/${encodeURIComponent(page)}`;
}

function textResult(value: unknown) {
  return { content: [{ type: 'text' as const, text: toToolText(value) }] };
}

export function registerPagePublishingTools(server: McpServer) {
  server.tool(
    'schedule_page',
    'Schedule a FerrGrowth page to be published automatically at a future time. Replaces any existing schedule. publish_at must be in the future.',
    {
      org_id: orgIdSchema,
      site_id: siteId,
      page_slug: pageSlug,
      publish_at: z
        .string()
        .datetime({ offset: true })
        .describe('ISO 8601 timestamp with offset, e.g. 2026-11-01T09:00:00Z.'),
    },
    async ({ org_id, site_id, page_slug, publish_at }) => {
      const token = await getToken();
      const page = await growthRequest<unknown>(`${pagePath(site_id, page_slug)}/schedule`, {
        token,
        orgId: org_id,
        method: 'POST',
        body: { publish_at },
      });
      return textResult(page);
    },
  );

  server.tool(
    'unschedule_page',
    'Cancel the pending scheduled publication of a FerrGrowth page. The page keeps its current status.',
    { org_id: orgIdSchema, site_id: siteId, page_slug: pageSlug },
    async ({ org_id, site_id, page_slug }) => {
      const token = await getToken();
      const page = await growthRequest<unknown>(`${pagePath(site_id, page_slug)}/schedule`, {
        token,
        orgId: org_id,
        method: 'DELETE',
      });
      return textResult(page);
    },
  );

  server.tool(
    'create_preview_link',
    'Create a shareable preview link for a FerrGrowth page (works on drafts), optionally password-protected. The returned url and token are shown only once.',
    {
      org_id: orgIdSchema,
      site_id: siteId,
      page_slug: pageSlug,
      password: z
        .string()
        .min(6)
        .max(128)
        .optional()
        .describe('Optional password the viewer must enter.'),
      expires_in_hours: z
        .number()
        .int()
        .min(1)
        .max(2160)
        .optional()
        .describe('Link lifetime in hours. Defaults to 168 (7 days), max 2160 (90 days).'),
    },
    async ({ org_id, site_id, page_slug, password, expires_in_hours }) => {
      const token = await getToken();
      const body: Record<string, unknown> = {};
      if (password !== undefined) body.password = password;
      if (expires_in_hours !== undefined) body.expires_in_hours = expires_in_hours;
      const link = await growthRequest<unknown>(`${pagePath(site_id, page_slug)}/preview-links`, {
        token,
        orgId: org_id,
        method: 'POST',
        body,
      });
      return textResult(link);
    },
  );

  server.tool(
    'list_preview_links',
    'List the preview links of a FerrGrowth page with their expiry, revocation and password status. URLs are not recoverable after creation.',
    { org_id: orgIdSchema, site_id: siteId, page_slug: pageSlug },
    async ({ org_id, site_id, page_slug }) => {
      const token = await getToken();
      const links = await growthRequest<unknown>(`${pagePath(site_id, page_slug)}/preview-links`, {
        token,
        orgId: org_id,
      });
      return textResult(links);
    },
  );

  server.tool(
    'revoke_preview_link',
    'Revoke a FerrGrowth preview link so it stops working immediately. Destructive: the link cannot be re-enabled.',
    {
      org_id: orgIdSchema,
      site_id: siteId,
      link_id: z.string().min(1).describe('Preview link id'),
    },
    async ({ org_id, site_id, link_id }) => {
      const token = await getToken();
      const link = await growthRequest<unknown>(
        `/sites/${encodeURIComponent(site_id)}/preview-links/${encodeURIComponent(link_id)}`,
        { token, orgId: org_id, method: 'DELETE' },
      );
      return textResult(link);
    },
  );
}
