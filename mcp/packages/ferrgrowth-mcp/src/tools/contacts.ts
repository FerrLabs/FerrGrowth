import { z } from 'zod';
import { getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { growthRequest } from '../api-base.js';

interface Contact {
  id: string;
  email: string | null;
  name: string | null;
  first_seen_at: string;
  last_seen_at: string;
  seen_count: number;
}

interface ContactList {
  total: number;
  items: Array<Contact & { sources: string[]; last_source: string }>;
}

interface ContactDetail {
  contact: Contact;
  events: Array<{
    id: string;
    contact_id: string;
    site_id: string;
    source: string;
    source_ref: string | null;
    payload: unknown;
    occurred_at: string;
  }>;
}

export function registerContactTools(server: McpServer) {
  server.tool(
    'list_contacts',
    'List contacts of the active organisation across all its FerrGrowth sites, most recently seen first. Returns the total count and a page of contacts with the sources they came from.',
    {
      limit: z.number().int().min(1).max(200).optional().describe('Page size (default 50).'),
      offset: z.number().int().min(0).optional().describe('Contacts to skip (default 0).'),
    },
    async ({ limit, offset }) => {
      const token = await getToken();
      const params = new URLSearchParams();
      if (limit !== undefined) params.set('limit', String(limit));
      if (offset !== undefined) params.set('offset', String(offset));
      const qs = params.toString() ? `?${params.toString()}` : '';
      const contacts = await growthRequest<ContactList>(`/contacts${qs}`, { token });
      return {
        content: [
          {
            type: 'text' as const,
            text: toToolText(contacts, {
              narrowWith: 'Pass a smaller limit and page with offset.',
            }),
          },
        ],
      };
    },
  );

  server.tool(
    'get_contact',
    'Get one contact of the active organisation with its 50 most recent events (form submissions and other sources, with their payload).',
    {
      contact_id: z.string().min(1).describe('Contact id'),
    },
    async ({ contact_id }) => {
      const token = await getToken();
      const contact = await growthRequest<ContactDetail>(
        `/contacts/${encodeURIComponent(contact_id)}`,
        { token },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(contact) }],
      };
    },
  );
}
