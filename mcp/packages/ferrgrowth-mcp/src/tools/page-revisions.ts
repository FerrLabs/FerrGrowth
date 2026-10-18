import { z } from 'zod';
import { getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { growthRequest } from '../api-base.js';

const siteSlug = z.string().min(1).describe('Site slug');
const pageSlug = z.string().min(1).describe('Page slug');
const revisionId = z.string().min(1).describe('Revision id, from list_page_revisions');

function revisionsPath(site: string, page: string): string {
  return `/sites/${encodeURIComponent(site)}/pages/${encodeURIComponent(page)}/revisions`;
}

export function registerPageRevisionTools(server: McpServer) {
  server.tool(
    'list_page_revisions',
    'List the saved revisions of a FerrGrowth page, newest first: who changed it, when, the title and the block count. Consecutive edits by one author within five minutes are merged into one revision.',
    {
      site_id: siteSlug,
      page_slug: pageSlug,
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Max revisions to return (default 50).'),
      offset: z.number().int().min(0).optional().describe('Revisions to skip, for paging.'),
    },
    async ({ site_id, page_slug, limit, offset }) => {
      const token = await getToken();
      const params = new URLSearchParams();
      if (limit !== undefined) params.set('limit', String(limit));
      if (offset !== undefined) params.set('offset', String(offset));
      const qs = params.size > 0 ? `?${params.toString()}` : '';
      const revisions = await growthRequest<unknown[]>(
        `${revisionsPath(site_id, page_slug)}${qs}`,
        { token },
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: toToolText(revisions, { narrowWith: 'Pass a smaller limit.' }),
          },
        ],
      };
    },
  );

  server.tool(
    'get_page_revision',
    'Get one revision of a FerrGrowth page with its full content (blocks, SEO fields, custom code), to inspect it before restoring.',
    { site_id: siteSlug, page_slug: pageSlug, revision_id: revisionId },
    async ({ site_id, page_slug, revision_id }) => {
      const token = await getToken();
      const revision = await growthRequest<unknown>(
        `${revisionsPath(site_id, page_slug)}/${encodeURIComponent(revision_id)}`,
        { token },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(revision) }],
      };
    },
  );

  server.tool(
    'restore_page_revision',
    'Roll a FerrGrowth page back to an earlier revision: its title, blocks, SEO fields and custom code replace the current draft. The restore is itself recorded as a revision, so it can be undone. The live site is not changed until publish_page is called.',
    { site_id: siteSlug, page_slug: pageSlug, revision_id: revisionId },
    async ({ site_id, page_slug, revision_id }) => {
      const token = await getToken();
      const page = await growthRequest<unknown>(
        `${revisionsPath(site_id, page_slug)}/${encodeURIComponent(revision_id)}/restore`,
        { token, method: 'POST' },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(page) }],
      };
    },
  );
}
