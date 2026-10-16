import { z } from 'zod';
import { getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { growthRequest } from '../api-base.js';

const TRIGGER_KINDS = [
  'form_submit',
  'welcome',
  'quote_followup',
  'cart_abandon',
  'newsletter_optin',
  'invoice_paid',
  'custom',
] as const;

const TEMPLATE_STATUSES = ['draft', 'active', 'disabled'] as const;

interface EmailTemplate {
  id: string;
  site_id: string;
  slug: string;
  name: string;
  subject: string;
  body_md: string;
  trigger_kind: (typeof TRIGGER_KINDS)[number];
  status: (typeof TEMPLATE_STATUSES)[number];
  brand_inherit: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const siteSlug = z.string().min(1).describe('Site slug');
const templateId = z.string().min(1).describe('Email template id');
const triggerKind = z.enum(TRIGGER_KINDS).describe('Event that sends the email');
const brandInherit = z.boolean().describe("Inherit the site's brand styling (default true)");

function templatePath(site: string, id?: string): string {
  const base = `/sites/${encodeURIComponent(site)}/email-templates`;
  return id === undefined ? base : `${base}/${encodeURIComponent(id)}`;
}

export function registerEmailTemplateTools(server: McpServer) {
  server.tool(
    'list_email_templates',
    'List the email templates of a FerrGrowth site (subject, markdown body, trigger, status), most recently updated first.',
    { site_id: siteSlug },
    async ({ site_id }) => {
      const token = await getToken();
      const templates = await growthRequest<EmailTemplate[]>(templatePath(site_id), { token });
      return {
        content: [{ type: 'text' as const, text: toToolText(templates) }],
      };
    },
  );

  server.tool(
    'create_email_template',
    'Create an email template on a FerrGrowth site and return it. New templates start as drafts; activate one with update_email_template.',
    {
      site_id: siteSlug,
      slug: z
        .string()
        .min(2)
        .max(80)
        .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase alphanumeric with hyphens'),
      name: z.string().min(1).max(100),
      subject: z.string().min(1).max(200),
      body_md: z.string().optional().describe('Email body in markdown'),
      trigger_kind: triggerKind,
      brand_inherit: brandInherit.optional(),
    },
    async ({ site_id, ...body }) => {
      const token = await getToken();
      const template = await growthRequest<EmailTemplate>(templatePath(site_id), {
        token,
        method: 'POST',
        body,
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(template) }],
      };
    },
  );

  server.tool(
    'update_email_template',
    'Patch a FerrGrowth email template and return it. Only fields you pass are touched; the slug cannot change.',
    {
      site_id: siteSlug,
      template_id: templateId,
      name: z.string().min(1).max(100).optional(),
      subject: z.string().min(1).max(200).optional(),
      body_md: z.string().optional(),
      trigger_kind: triggerKind.optional(),
      status: z.enum(TEMPLATE_STATUSES).optional(),
      brand_inherit: brandInherit.optional(),
    },
    async ({ site_id, template_id, ...body }) => {
      const token = await getToken();
      const template = await growthRequest<EmailTemplate>(templatePath(site_id, template_id), {
        token,
        method: 'PATCH',
        body,
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(template) }],
      };
    },
  );

  server.tool(
    'delete_email_template',
    'Delete a FerrGrowth email template. Irreversible. To stop it sending without losing it, set its status to disabled.',
    { site_id: siteSlug, template_id: templateId },
    async ({ site_id, template_id }) => {
      const token = await getToken();
      await growthRequest<void>(templatePath(site_id, template_id), { token, method: 'DELETE' });
      return {
        content: [{ type: 'text' as const, text: `Email template ${template_id} deleted.` }],
      };
    },
  );
}
