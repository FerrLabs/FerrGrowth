import { z } from 'zod';
import { getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { growthRequest, orgIdSchema, pathSegment } from '../api-base.js';

interface MediaAsset {
  id: string;
  site_id: string;
  url: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  created_at: string;
}

interface MediaList {
  total: number;
  items: MediaAsset[];
}

const MEDIA_MAX_BYTES = 10 * 1024 * 1024;

const MEDIA_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
  'font/woff2',
  'font/woff',
] as const;

const httpsUrl = z.url({ protocol: /^https$/ });

const siteSlug = z.string().min(1).describe('Site slug');

function mediaPath(site: string): string {
  return `/sites/${pathSegment(site)}/media`;
}

export function registerMediaTools(server: McpServer) {
  server.tool(
    'list_media',
    "List a FerrGrowth site's media library, newest first. Returns the total count and a page of assets with their public URL, type, size and dimensions.",
    {
      org_id: orgIdSchema,
      site_id: siteSlug,
      kind: z.enum(['image', 'font']).optional().describe('Only images or only fonts'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe('Max assets to return (default 50).'),
      offset: z.number().int().min(0).optional().describe('Assets to skip, for paging.'),
    },
    async ({ org_id, site_id, kind, limit, offset }) => {
      const token = await getToken();
      const params = new URLSearchParams();
      if (kind !== undefined) params.set('kind', kind);
      if (limit !== undefined) params.set('limit', String(limit));
      if (offset !== undefined) params.set('offset', String(offset));
      const qs = params.size > 0 ? `?${params.toString()}` : '';
      const media = await growthRequest<MediaList>(`${mediaPath(site_id)}${qs}`, {
        token,
        orgId: org_id,
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: toToolText(media, { narrowWith: 'Pass a smaller limit or a kind.' }),
          },
        ],
      };
    },
  );

  server.tool(
    'upload_media',
    `Upload an image or a font to a FerrGrowth site's media library and get back its public URL, ready to use in a page, post or email. The file is passed as base64 and capped at ${MEDIA_MAX_BYTES / 1024 / 1024} MB; the API checks the bytes match the declared type.`,
    {
      org_id: orgIdSchema,
      site_id: siteSlug,
      filename: z.string().min(1).max(255).describe('File name, e.g. hero.webp'),
      content_type: z.enum(MEDIA_CONTENT_TYPES).describe('MIME type of the file'),
      content_base64: z.base64().min(1).describe('File contents, base64 encoded'),
    },
    async ({ org_id, site_id, filename, content_type, content_base64 }) => {
      const bytes = Buffer.from(content_base64, 'base64');
      if (bytes.length > MEDIA_MAX_BYTES) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `${filename} is ${bytes.length} bytes, over the ${MEDIA_MAX_BYTES}-byte limit. Compress or resize it first.`,
            },
          ],
        };
      }
      const form = new FormData();
      form.append('file', new Blob([bytes], { type: content_type }), filename);
      const token = await getToken();
      const asset = await growthRequest<MediaAsset>(mediaPath(site_id), {
        token,
        orgId: org_id,
        method: 'POST',
        body: form,
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(asset) }],
      };
    },
  );

  server.tool(
    'import_media',
    "Have the server download a public https image (png, jpeg, webp, gif, avif; 10 MB max) into a FerrGrowth site's media library and return its public URL. Use it instead of upload_media for files too large to pass as base64.",
    {
      org_id: orgIdSchema,
      site_id: siteSlug,
      url: httpsUrl.describe('Public https URL of the image to import'),
      filename: z.string().min(1).max(255).optional().describe('File name to store it under'),
    },
    async ({ org_id, site_id, url, filename }) => {
      const token = await getToken();
      const asset = await growthRequest<MediaAsset>(`${mediaPath(site_id)}/import`, {
        token,
        orgId: org_id,
        method: 'POST',
        body: { url, ...(filename !== undefined && { filename }) },
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(asset) }],
      };
    },
  );

  server.tool(
    'delete_media',
    'Delete an asset from a FerrGrowth media library. Irreversible: the file is removed from storage, and pages, posts or emails that still reference its URL will show a broken image.',
    {
      org_id: orgIdSchema,
      site_id: siteSlug,
      media_id: z.string().min(1).describe('Media asset id'),
    },
    async ({ org_id, site_id, media_id }) => {
      const token = await getToken();
      await growthRequest<void>(`${mediaPath(site_id)}/${pathSegment(media_id)}`, {
        token,
        orgId: org_id,
        method: 'DELETE',
      });
      return {
        content: [{ type: 'text' as const, text: `Media asset ${media_id} deleted.` }],
      };
    },
  );
}
