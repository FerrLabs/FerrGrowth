import { z } from 'zod';
import { getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { growthRequest, orgIdSchema, pathSegment } from '../api-base.js';

interface Release {
  id: string;
  site_id: string;
  version: string;
  active: boolean;
  size_bytes: number;
  created_at: string;
}

export function registerReleaseTools(server: McpServer) {
  server.tool(
    'get_release',
    'Get details of a single FerrGrowth release (build metadata, size, active flag).',
    {
      org_id: orgIdSchema,
      site_id: z.string().min(1).describe('Site slug'),
      release_id: z.string().min(1).describe('Release id'),
    },
    async ({ org_id, site_id, release_id }) => {
      const token = await getToken();
      const release = await growthRequest<Release>(
        `/sites/${pathSegment(site_id)}/releases/${pathSegment(release_id)}`,
        { token, orgId: org_id },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(release) }],
      };
    },
  );

  server.tool(
    'list_releases',
    'List bundle releases of a FerrGrowth site (built artefacts). The one with `active: true` is the one currently served.',
    {
      org_id: orgIdSchema,
      site_id: z.string().min(1).describe('Site slug'),
    },
    async ({ org_id, site_id }) => {
      const token = await getToken();
      const releases = await growthRequest<Release[]>(`/sites/${pathSegment(site_id)}/releases`, {
        token,
        orgId: org_id,
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(releases) }],
      };
    },
  );

  server.tool(
    'activate_release',
    'Switch the live serving release for a FerrGrowth site to a specific release id (rollback or roll-forward). Atomic — no downtime.',
    {
      org_id: orgIdSchema,
      site_id: z.string().min(1).describe('Site slug'),
      release_id: z.string().min(1).describe('Release id'),
    },
    async ({ org_id, site_id, release_id }) => {
      const token = await getToken();
      const release = await growthRequest<Release>(
        `/sites/${pathSegment(site_id)}/releases/${pathSegment(release_id)}/activate`,
        { token, orgId: org_id, method: 'POST' },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(release) }],
      };
    },
  );

  server.tool(
    'restore_release',
    'Copy the page snapshot of an older FerrGrowth release back into the editor as drafts and return how many pages were restored. Overwrites the current draft of every page with the same slug; the live release is not changed.',
    {
      org_id: orgIdSchema,
      site_id: z.string().min(1).describe('Site slug'),
      release_id: z.string().min(1).describe('Release id'),
    },
    async ({ org_id, site_id, release_id }) => {
      const token = await getToken();
      const result = await growthRequest<{ restored_pages: number }>(
        `/sites/${pathSegment(site_id)}/releases/${pathSegment(release_id)}/restore`,
        { token, orgId: org_id, method: 'POST' },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(result) }],
      };
    },
  );
}
