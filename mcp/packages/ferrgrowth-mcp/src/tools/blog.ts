import { z } from 'zod';
import { getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { growthRequest } from '../api-base.js';

const BLOG_STATUSES = ['draft', 'scheduled', 'published', 'archived'] as const;

interface BlogPost {
  id: string;
  site_id: string;
  slug: string;
  title: string;
  excerpt: string;
  body_md: string;
  cover_url: string | null;
  status: (typeof BLOG_STATUSES)[number];
  scheduled_for: string | null;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const siteSlug = z.string().min(1).describe('Site slug');
const postId = z.string().min(1).describe('Blog post id');

function postPath(site: string, id?: string): string {
  const base = `/sites/${encodeURIComponent(site)}/blog/posts`;
  return id === undefined ? base : `${base}/${encodeURIComponent(id)}`;
}

export function registerBlogTools(server: McpServer) {
  server.tool(
    'list_blog_posts',
    'List blog posts on a FerrGrowth site with their markdown bodies, published first, then scheduled, then drafts.',
    { site_id: siteSlug },
    async ({ site_id }) => {
      const token = await getToken();
      const posts = await growthRequest<BlogPost[]>(postPath(site_id), { token });
      return {
        content: [{ type: 'text' as const, text: toToolText(posts) }],
      };
    },
  );

  server.tool(
    'create_blog_post',
    'Create a draft blog post on a FerrGrowth site and return it. Publish or schedule it with update_blog_post.',
    {
      site_id: siteSlug,
      slug: z
        .string()
        .min(2)
        .max(100)
        .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase alphanumeric with hyphens'),
      title: z.string().min(1).max(200),
      excerpt: z.string().optional(),
      body_md: z.string().optional().describe('Post body in markdown'),
      cover_url: z.string().optional().describe('Cover image URL, e.g. from list_media'),
    },
    async ({ site_id, ...body }) => {
      const token = await getToken();
      const post = await growthRequest<BlogPost>(postPath(site_id), {
        token,
        method: 'POST',
        body,
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(post) }],
      };
    },
  );

  server.tool(
    'update_blog_post',
    "Patch a FerrGrowth blog post and return it. Only fields you pass are touched; a field cannot be cleared. Setting status to 'scheduled' needs scheduled_for; 'published' stamps published_at.",
    {
      site_id: siteSlug,
      post_id: postId,
      title: z.string().min(1).max(200).optional(),
      excerpt: z.string().optional(),
      body_md: z.string().optional(),
      cover_url: z.string().optional(),
      status: z.enum(BLOG_STATUSES).optional(),
      scheduled_for: z.iso
        .datetime({ offset: true })
        .optional()
        .describe('ISO 8601 timestamp the post goes live at'),
    },
    async ({ site_id, post_id, ...body }) => {
      const token = await getToken();
      const post = await growthRequest<BlogPost>(postPath(site_id, post_id), {
        token,
        method: 'PATCH',
        body,
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(post) }],
      };
    },
  );

  server.tool(
    'delete_blog_post',
    'Delete a FerrGrowth blog post. Irreversible: the post is removed, not archived. To hide it instead, set its status to archived.',
    { site_id: siteSlug, post_id: postId },
    async ({ site_id, post_id }) => {
      const token = await getToken();
      await growthRequest<void>(postPath(site_id, post_id), { token, method: 'DELETE' });
      return {
        content: [{ type: 'text' as const, text: `Blog post ${post_id} deleted.` }],
      };
    },
  );
}
