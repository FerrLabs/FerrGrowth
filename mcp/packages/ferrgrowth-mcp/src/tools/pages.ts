import { z } from 'zod';
import { getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { growthRequest, orgIdSchema } from '../api-base.js';
import { buildUpdatePageBody } from './page-update-body.js';
import { updatePageFields } from './page-update-schema.js';

interface Page {
  id: string;
  site_id: string;
  slug: string;
  title: string;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export function registerPageTools(server: McpServer) {
  server.tool(
    'list_pages',
    'List pages on a FerrGrowth site.',
    {
      org_id: orgIdSchema,
      site_id: z.string().min(1).describe('Site slug'),
    },
    async ({ org_id, site_id }) => {
      const token = await getToken();
      const pages = await growthRequest<Page[]>(`/sites/${encodeURIComponent(site_id)}/pages`, {
        token,
        orgId: org_id,
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(pages) }],
      };
    },
  );

  server.tool(
    'get_page',
    'Get a single FerrGrowth page (full content + metadata).',
    {
      org_id: orgIdSchema,
      site_id: z.string().min(1).describe('Site slug'),
      page_slug: z.string().min(1).describe('Page slug'),
    },
    async ({ org_id, site_id, page_slug }) => {
      const token = await getToken();
      const page = await growthRequest<Page>(
        `/sites/${encodeURIComponent(site_id)}/pages/${encodeURIComponent(page_slug)}`,
        { token, orgId: org_id },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(page) }],
      };
    },
  );

  server.tool(
    'publish_page',
    "Publish a FerrGrowth page — flips it live on the site's active release. Idempotent: re-publishing an already-live page is a no-op.",
    {
      org_id: orgIdSchema,
      site_id: z.string().min(1).describe('Site slug'),
      page_slug: z.string().min(1).describe('Page slug'),
    },
    async ({ org_id, site_id, page_slug }) => {
      const token = await getToken();
      const page = await growthRequest<Page>(
        `/sites/${encodeURIComponent(site_id)}/pages/${encodeURIComponent(page_slug)}/publish`,
        { token, orgId: org_id, method: 'POST' },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(page) }],
      };
    },
  );

  server.tool(
    'create_page',
    'Create a new page on a FerrGrowth site. Newly created pages are unpublished by default — call publish_page when ready.',
    {
      org_id: orgIdSchema,
      site_id: z.string().min(1).describe('Site slug'),
      slug: z
        .string()
        .min(1)
        .max(80)
        .regex(/^[a-z0-9/-]+$/, 'lowercase alphanumeric + slashes + hyphens'),
      title: z.string().min(1).max(200),
    },
    async ({ org_id, site_id, slug, title }) => {
      const token = await getToken();
      const page = await growthRequest<Page>(`/sites/${encodeURIComponent(site_id)}/pages`, {
        token,
        orgId: org_id,
        method: 'POST',
        body: { slug, title },
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(page) }],
      };
    },
  );

  server.tool(
    'update_page',
    'Patch a FerrGrowth page: title, slug, blocks, SEO metadata (meta title/description, og image, canonical, noindex), custom CSS and head HTML. Only fields you pass are touched; null clears nullable fields. Publishing remains via publish_page.',
    {
      org_id: orgIdSchema,
      site_id: z.string().min(1).describe('Site slug'),
      page_slug: z.string().min(1).describe('Page slug'),
      ...updatePageFields,
    },
    async ({ org_id, site_id, page_slug, ...fields }) => {
      const token = await getToken();
      const body = buildUpdatePageBody(fields);
      const page = await growthRequest<Page>(
        `/sites/${encodeURIComponent(site_id)}/pages/${encodeURIComponent(page_slug)}`,
        { token, orgId: org_id, method: 'PATCH', body },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(page) }],
      };
    },
  );

  server.tool(
    'discover_pages',
    'Crawl a URL and discover candidate pages to import into a FerrGrowth site (sitemap / link graph). Returns a list of candidate page slugs + titles; no pages are created yet — feed the result to import_pages.',
    {
      org_id: orgIdSchema,
      site_id: z.string().min(1).describe('Site slug'),
      url: z.string().url().describe('Origin URL to crawl.'),
    },
    async ({ org_id, site_id, url }) => {
      const token = await getToken();
      const result = await growthRequest<unknown>(
        `/sites/${encodeURIComponent(site_id)}/pages/discover`,
        {
          token,
          orgId: org_id,
          method: 'POST',
          body: { url },
        },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(result) }],
      };
    },
  );

  server.tool(
    'import_pages',
    'Import the pages discovered by discover_pages into the site. Each item creates an unpublished page; review then publish_page when ready.',
    {
      org_id: orgIdSchema,
      site_id: z.string().min(1).describe('Site slug'),
      pages: z
        .array(
          z.object({
            url: z.string().url(),
            slug: z.string().min(1).max(80),
            title: z.string().min(1).max(200),
          }),
        )
        .min(1)
        .describe('Pages to import (typically the output of discover_pages).'),
    },
    async ({ org_id, site_id, pages }) => {
      const token = await getToken();
      const result = await growthRequest<unknown>(
        `/sites/${encodeURIComponent(site_id)}/pages/import`,
        {
          token,
          orgId: org_id,
          method: 'POST',
          body: { pages },
        },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(result) }],
      };
    },
  );
}
