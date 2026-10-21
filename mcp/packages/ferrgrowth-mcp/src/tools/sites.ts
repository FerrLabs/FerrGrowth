import { z } from 'zod';
import { getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { growthRequest, orgIdSchema } from '../api-base.js';
import { updateSiteFields } from './site-update-schema.js';

interface Site {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export function registerSiteTools(server: McpServer) {
  server.tool(
    'list_sites',
    "List FerrGrowth sites in the authenticated user's org.",
    { org_id: orgIdSchema },
    async ({ org_id }) => {
      const token = await getToken();
      const sites = await growthRequest<Site[]>('/sites', { token, orgId: org_id });
      return {
        content: [{ type: 'text' as const, text: toToolText(sites) }],
      };
    },
  );

  server.tool(
    'get_site',
    'Get details for a single FerrGrowth site (status, custom domain, etc.).',
    {
      org_id: orgIdSchema,
      site_id: z.string().min(1).describe('Site slug'),
    },
    async ({ org_id, site_id }) => {
      const token = await getToken();
      const site = await growthRequest<Site>(`/sites/${encodeURIComponent(site_id)}`, {
        token,
        orgId: org_id,
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(site) }],
      };
    },
  );

  server.tool(
    'create_site',
    'Create a new FerrGrowth site. The slug becomes the default `<slug>.ferrgrowth.app` subdomain until you attach a custom domain.',
    {
      org_id: orgIdSchema,
      slug: z
        .string()
        .min(2)
        .max(40)
        .regex(/^[a-z0-9-]+$/, 'lowercase alphanumeric + hyphens'),
      name: z.string().min(1).max(100),
    },
    async ({ org_id, slug, name }) => {
      const token = await getToken();
      const site = await growthRequest<Site>('/sites', {
        token,
        orgId: org_id,
        method: 'POST',
        body: { slug, name },
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(site) }],
      };
    },
  );

  server.tool(
    'update_site',
    'Update a FerrGrowth site: name, slug (also moves the default subdomain), theme, site-wide custom CSS and head HTML.',
    {
      org_id: orgIdSchema,
      site_id: z.string().min(1).describe('Site slug'),
      slug: z
        .string()
        .min(2)
        .max(40)
        .regex(/^[a-z0-9-]+$/)
        .optional(),
      name: z.string().min(1).max(100).optional(),
      ...updateSiteFields,
    },
    async ({ org_id, site_id, ...patch }) => {
      const token = await getToken();
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) body[k] = v;
      }
      const site = await growthRequest<Site>(`/sites/${encodeURIComponent(site_id)}`, {
        token,
        orgId: org_id,
        method: 'PATCH',
        body,
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(site) }],
      };
    },
  );

  server.tool(
    'archive_site',
    'Archive a FerrGrowth site: takes it offline and stops serving its custom domain. Reversible with restore_site.',
    {
      org_id: orgIdSchema,
      site_id: z.string().min(1).describe('Site slug'),
    },
    async ({ org_id, site_id }) => {
      const token = await getToken();
      await growthRequest<void>(`/sites/${encodeURIComponent(site_id)}`, {
        token,
        orgId: org_id,
        method: 'DELETE',
      });
      return {
        content: [{ type: 'text' as const, text: `Site ${site_id} archived.` }],
      };
    },
  );

  server.tool(
    'restore_site',
    'Unarchive a FerrGrowth site. It comes back as a draft and the updated site is returned; publish again to serve it.',
    {
      org_id: orgIdSchema,
      site_id: z.string().min(1).describe('Site slug'),
    },
    async ({ org_id, site_id }) => {
      const token = await getToken();
      const site = await growthRequest<Site>(`/sites/${encodeURIComponent(site_id)}/restore`, {
        token,
        orgId: org_id,
        method: 'POST',
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(site) }],
      };
    },
  );

  server.tool(
    'attach_domain',
    'Attach a custom domain to a FerrGrowth site. The domain is registered in the pending state until verify_domain succeeds — DNS-01 verification via a TXT record.',
    {
      org_id: orgIdSchema,
      site_id: z.string().min(1).describe('Site slug'),
      domain: z
        .string()
        .min(3)
        .max(253)
        .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, 'looks like a valid domain'),
    },
    async ({ org_id, site_id, domain }) => {
      const token = await getToken();
      const result = await growthRequest<unknown>(`/sites/${encodeURIComponent(site_id)}/domain`, {
        token,
        orgId: org_id,
        method: 'POST',
        body: { domain },
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(result) }],
      };
    },
  );

  server.tool(
    'verify_domain',
    "Verify the custom domain previously attached to a FerrGrowth site. Checks the DNS TXT challenge — succeeds when the challenge matches, fails otherwise. Idempotent: retry after fixing DNS if it's not propagated yet.",
    {
      org_id: orgIdSchema,
      site_id: z.string().min(1).describe('Site slug'),
    },
    async ({ org_id, site_id }) => {
      const token = await getToken();
      const result = await growthRequest<unknown>(
        `/sites/${encodeURIComponent(site_id)}/domain/verify`,
        { token, orgId: org_id, method: 'POST' },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(result) }],
      };
    },
  );

  server.tool(
    'detach_domain',
    'Detach the custom domain from a FerrGrowth site. The site falls back to its `<slug>.ferrgrowth.app` subdomain.',
    {
      org_id: orgIdSchema,
      site_id: z.string().min(1).describe('Site slug'),
    },
    async ({ org_id, site_id }) => {
      const token = await getToken();
      await growthRequest<void>(`/sites/${encodeURIComponent(site_id)}/domain`, {
        token,
        orgId: org_id,
        method: 'DELETE',
      });
      return {
        content: [{ type: 'text' as const, text: `Custom domain detached from ${site_id}.` }],
      };
    },
  );
}
