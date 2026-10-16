import type { McpServer } from '@ferrlabs/mcp-core';
import { registerSiteTools } from './tools/sites.js';
import { registerPageTools } from './tools/pages.js';
import { registerFormTools } from './tools/forms.js';
import { registerAnalyticsTools } from './tools/analytics.js';
import { registerSeoTools } from './tools/seo.js';
import { registerSeoBulkTools } from './tools/seo-bulk.js';
import { registerReleaseTools } from './tools/releases.js';
import { registerFunnelTools } from './tools/funnels.js';
import { registerContactTools } from './tools/contacts.js';
import { registerMemberTools } from './tools/members.js';
import { registerServerTokenTools } from './tools/server-tokens.js';
import { registerIntegrationTools } from './tools/integrations.js';
import { registerExternalSiteTools } from './tools/external-sites.js';
import { registerBlogTools } from './tools/blog.js';
import { registerEmailTemplateTools } from './tools/email-templates.js';
import { registerMediaTools } from './tools/media.js';

export function register(server: McpServer): void {
  registerSiteTools(server);
  registerPageTools(server);
  registerFormTools(server);
  registerAnalyticsTools(server);
  registerSeoTools(server);
  registerSeoBulkTools(server);
  registerReleaseTools(server);
  registerFunnelTools(server);
  registerContactTools(server);
  registerMemberTools(server);
  registerServerTokenTools(server);
  registerIntegrationTools(server);
  registerExternalSiteTools(server);
  registerBlogTools(server);
  registerEmailTemplateTools(server);
  registerMediaTools(server);
}
