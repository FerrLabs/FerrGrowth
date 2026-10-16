import { z } from 'zod';
import { getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { growthRequest } from '../api-base.js';

interface Form {
  id: string;
  site_id: string;
  name: string;
  fields: unknown;
  destination: string;
  destination_config: unknown;
  submissions_30d: number;
  updated_at: string;
}

interface FormSubmission {
  id: string;
  form_id: string;
  fields: Record<string, unknown>;
  submitted_at: string;
}

const SUBMISSIONS_RETURNED_BY_API = 200;

const FIELD_TYPES = ['text', 'email', 'phone', 'textarea', 'select', 'checkbox', 'number'] as const;

const destination = z
  .enum(['database', 'webhook', 'hubspot', 'salesforce', 'attio', 'customer_io'])
  .describe('Where submissions are sent. The API defaults to database.');

const destinationConfig = z
  .record(z.string(), z.string())
  .describe('Settings for the destination, as string key/value pairs (e.g. a webhook URL).');

const fieldLabel = z.string().min(1).max(200).optional().describe('Label shown above the input.');

const fieldOptions = z
  .array(z.string().min(1).max(200))
  .optional()
  .describe('Choices for a select field.');

export function registerFormTools(server: McpServer) {
  server.tool(
    'get_form',
    'Get a single FerrGrowth form: name, field schema, destination and 30-day submission count.',
    {
      site_id: z.string().min(1).describe('Site slug'),
      form_id: z.string().min(1).describe('Form id'),
    },
    async ({ site_id, form_id }) => {
      const token = await getToken();
      const forms = await growthRequest<Form[]>(`/sites/${encodeURIComponent(site_id)}/forms`, {
        token,
      });
      const form = forms.find((f) => f.id === form_id);
      if (!form) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `No form ${form_id} on site ${site_id}.` }],
        };
      }
      return {
        content: [{ type: 'text' as const, text: toToolText(form) }],
      };
    },
  );

  server.tool(
    'list_forms',
    'List forms attached to a FerrGrowth site.',
    {
      site_id: z.string().min(1).describe('Site slug'),
    },
    async ({ site_id }) => {
      const token = await getToken();
      const forms = await growthRequest<Form[]>(`/sites/${encodeURIComponent(site_id)}/forms`, {
        token,
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(forms) }],
      };
    },
  );

  server.tool(
    'list_form_submissions',
    `List submissions for a FerrGrowth form, most recent first. The API returns at most the latest ${SUBMISSIONS_RETURNED_BY_API}; older ones are not reachable from here.`,
    {
      site_id: z.string().min(1).describe('Site slug'),
      form_id: z.string().min(1).describe('Form id'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(SUBMISSIONS_RETURNED_BY_API)
        .optional()
        .describe(`Keep only the most recent N (default ${SUBMISSIONS_RETURNED_BY_API}).`),
    },
    async ({ site_id, form_id, limit }) => {
      const token = await getToken();
      const latest = await growthRequest<FormSubmission[]>(
        `/sites/${encodeURIComponent(site_id)}/forms/${encodeURIComponent(form_id)}/submissions`,
        { token },
      );
      const subs = latest.slice(0, limit ?? SUBMISSIONS_RETURNED_BY_API);
      return {
        content: [
          {
            type: 'text' as const,
            text: toToolText(subs, { narrowWith: 'Pass a smaller limit.' }),
          },
        ],
      };
    },
  );

  server.tool(
    'create_form',
    'Create a new form on a FerrGrowth site. Fields are typed; submissions land in list_form_submissions and are forwarded to the destination.',
    {
      site_id: z.string().min(1).describe('Site slug'),
      name: z.string().min(1).max(100),
      fields: z
        .array(
          z.object({
            name: z
              .string()
              .min(1)
              .max(80)
              .regex(/^[a-z][a-z0-9_]*$/, 'snake_case identifier'),
            label: fieldLabel,
            type: z.enum(FIELD_TYPES),
            required: z.boolean().optional(),
            options: fieldOptions,
          }),
        )
        .min(1)
        .describe('Form schema, at least one field.'),
      destination: destination.optional(),
      destination_config: destinationConfig.optional(),
    },
    async ({ site_id, ...formBody }) => {
      const token = await getToken();
      const form = await growthRequest<Form>(`/sites/${encodeURIComponent(site_id)}/forms`, {
        token,
        method: 'POST',
        body: formBody,
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(form) }],
      };
    },
  );

  server.tool(
    'update_form',
    'Patch a FerrGrowth form: rename it, replace the field schema, or change where submissions go. Only fields you pass are touched.',
    {
      site_id: z.string().min(1).describe('Site slug'),
      form_id: z.string().min(1).describe('Form id'),
      name: z.string().min(1).max(100).optional(),
      fields: z
        .array(
          z.object({
            name: z.string().min(1).max(80),
            label: fieldLabel,
            type: z.enum(FIELD_TYPES),
            required: z.boolean().optional(),
            options: fieldOptions,
          }),
        )
        .optional(),
      destination: destination.optional(),
      destination_config: destinationConfig.optional(),
    },
    async ({ site_id, form_id, ...patch }) => {
      const token = await getToken();
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) body[k] = v;
      }
      const form = await growthRequest<Form>(
        `/sites/${encodeURIComponent(site_id)}/forms/${encodeURIComponent(form_id)}`,
        { token, method: 'PATCH', body },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(form) }],
      };
    },
  );

  server.tool(
    'delete_form',
    'Delete a FerrGrowth form. Existing submissions are kept in the audit table; the form definition is removed.',
    {
      site_id: z.string().min(1).describe('Site slug'),
      form_id: z.string().min(1).describe('Form id'),
    },
    async ({ site_id, form_id }) => {
      const token = await getToken();
      await growthRequest<void>(
        `/sites/${encodeURIComponent(site_id)}/forms/${encodeURIComponent(form_id)}`,
        { token, method: 'DELETE' },
      );
      return {
        content: [{ type: 'text' as const, text: `Form ${form_id} deleted.` }],
      };
    },
  );
}
