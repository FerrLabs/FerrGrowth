import { z } from 'zod';
import { getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { growthRequest, orgIdSchema, pathSegment } from '../api-base.js';

interface SeoRedirect {
  id: string;
  site_id: string;
  from_path: string;
  to_url: string;
  status_code: 301 | 302 | 307 | 308;
  created_at: string;
}

interface SeoRobots {
  content: string | null;
  effective: string;
}

interface PageSchemaOrg {
  page_slug: string;
  schema: unknown;
  updated_at: string;
}

const siteSlug = z.string().min(1).describe('Site slug');
const pageSlug = z.string().min(1).describe('Page slug, e.g. "index" or "docs/start"');

function seoPath(site: string, ...segments: string[]): string {
  return [`/sites/${pathSegment(site)}/seo`, ...segments.map(pathSegment)].join('/');
}

function text(value: unknown) {
  return { content: [{ type: 'text' as const, text: toToolText(value) }] };
}

export function registerSeoToolkitTools(server: McpServer) {
  server.tool(
    'list_redirects',
    'List the redirects of a FerrGrowth site (source path, target, status code), ordered by source path.',
    { org_id: orgIdSchema, site_id: siteSlug },
    async ({ org_id, site_id }) => {
      const token = await getToken();
      return text(
        await growthRequest<SeoRedirect[]>(seoPath(site_id, 'redirects'), { token, orgId: org_id }),
      );
    },
  );

  server.tool(
    'create_redirect',
    'Create a redirect on a FerrGrowth site. Requests to from_path answer with the status code and a Location header before any page renders. Defaults to a permanent 301.',
    {
      org_id: orgIdSchema,
      site_id: siteSlug,
      from_path: z
        .string()
        .min(1)
        .describe('Source path starting with "/", without query or fragment. Not "/".'),
      to_url: z.string().min(1).describe('Absolute http(s) URL, or a path starting with "/".'),
      status_code: z
        .union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)])
        .optional(),
    },
    async ({ org_id, site_id, ...body }) => {
      const token = await getToken();
      return text(
        await growthRequest<SeoRedirect>(seoPath(site_id, 'redirects'), {
          token,
          orgId: org_id,
          method: 'POST',
          body,
        }),
      );
    },
  );

  server.tool(
    'delete_redirect',
    'Delete a FerrGrowth redirect. Irreversible; the source path goes back to resolving normally.',
    {
      org_id: orgIdSchema,
      site_id: siteSlug,
      redirect_id: z.string().min(1).describe('Redirect id'),
    },
    async ({ org_id, site_id, redirect_id }) => {
      const token = await getToken();
      await growthRequest<void>(seoPath(site_id, 'redirects', redirect_id), {
        token,
        orgId: org_id,
        method: 'DELETE',
      });
      return { content: [{ type: 'text' as const, text: `Redirect ${redirect_id} deleted.` }] };
    },
  );

  server.tool(
    'get_robots',
    'Get the robots.txt of a FerrGrowth site: the custom content (null when using the default) and the effective file that is served.',
    { org_id: orgIdSchema, site_id: siteSlug },
    async ({ org_id, site_id }) => {
      const token = await getToken();
      return text(
        await growthRequest<SeoRobots>(seoPath(site_id, 'robots'), { token, orgId: org_id }),
      );
    },
  );

  server.tool(
    'update_robots',
    'Set the robots.txt of a FerrGrowth site and return it. A Sitemap line is appended when the content has none. Pass null or an empty string to restore the default.',
    {
      org_id: orgIdSchema,
      site_id: siteSlug,
      content: z
        .string()
        .max(20000)
        .nullable()
        .describe('robots.txt body, or null for the default'),
    },
    async ({ org_id, site_id, content }) => {
      const token = await getToken();
      return text(
        await growthRequest<SeoRobots>(seoPath(site_id, 'robots'), {
          token,
          orgId: org_id,
          method: 'PUT',
          body: { content },
        }),
      );
    },
  );

  server.tool(
    'list_schema_org',
    'List the schema.org (JSON-LD) structured data attached to the pages of a FerrGrowth site.',
    { org_id: orgIdSchema, site_id: siteSlug },
    async ({ org_id, site_id }) => {
      const token = await getToken();
      return text(
        await growthRequest<PageSchemaOrg[]>(seoPath(site_id, 'schema-org'), {
          token,
          orgId: org_id,
        }),
      );
    },
  );

  server.tool(
    'set_schema_org',
    'Set the schema.org JSON-LD of a page, replacing any existing one. Injected into the page head on the next render. Pass an object, or an array of objects, each with an "@type" (or "@graph"); "@context" defaults to https://schema.org.',
    {
      org_id: orgIdSchema,
      site_id: siteSlug,
      page_slug: pageSlug,
      schema: z
        .union([
          z.record(z.string(), z.unknown()),
          z.array(z.record(z.string(), z.unknown())).min(1),
        ])
        .describe('JSON-LD object or array of objects'),
    },
    async ({ org_id, site_id, page_slug, schema }) => {
      const token = await getToken();
      return text(
        await growthRequest<PageSchemaOrg>(seoPath(site_id, 'schema-org'), {
          token,
          orgId: org_id,
          method: 'PUT',
          body: { page_slug, schema },
        }),
      );
    },
  );

  server.tool(
    'delete_schema_org',
    'Remove the schema.org JSON-LD from a page of a FerrGrowth site. Irreversible; set it again with set_schema_org to restore it.',
    { org_id: orgIdSchema, site_id: siteSlug, page_slug: pageSlug },
    async ({ org_id, site_id, page_slug }) => {
      const token = await getToken();
      await growthRequest<void>(
        `${seoPath(site_id, 'schema-org')}?page=${encodeURIComponent(page_slug)}`,
        {
          token,
          orgId: org_id,
          method: 'DELETE',
        },
      );
      return {
        content: [{ type: 'text' as const, text: `Structured data removed from ${page_slug}.` }],
      };
    },
  );
}
