# FerrGrowth MCP

FerrGrowth as Model Context Protocol server, so an AI assistant can drive it.

[![npm @ferrgrowth/mcp](https://img.shields.io/npm/v/@ferrgrowth/mcp)](https://www.npmjs.com/package/@ferrgrowth/mcp)

## Quick start

Add to your MCP client configuration (Claude Code, Cursor, etc.):

```json
{
  "mcpServers": {
    "ferrgrowth": { "command": "npx", "args": ["-y", "@ferrgrowth/mcp"] }
  }
}
```

The first tool call that needs auth opens a browser for an OAuth loopback flow and saves the token. To skip it (CI, headless), set `FERRLABS_API_TOKEN`. Details in the [FerrLabs MCP README](https://github.com/FerrLabs/FerrLabs/blob/main/packages/mcp/README.md#how-auth-resolution-works).

## Tools

Tools marked **destructive** are irreversible or high-impact. MCP clients should gate them behind a confirmation.

### `@ferrgrowth/mcp`

| Tool                                                                                                     | Notes                                                                                                                  |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `list_sites`, `get_site`, `create_site`, `update_site`, `archive_site`                                   | `archive_site` is **destructive**                                                                                      |
| `attach_domain`, `detach_domain`, `verify_domain`                                                        | custom domains                                                                                                         |
| `list_pages`, `get_page`, `create_page`, `update_page`, `publish_page`, `discover_pages`, `import_pages` | pages                                                                                                                  |
| `list_forms`, `get_form`, `create_form`, `update_form`, `delete_form`, `list_form_submissions`           | `delete_form` is **destructive**                                                                                       |
| `list_releases`, `get_release`, `activate_release`                                                       | `activate_release` is **destructive** (switches live serving)                                                          |
| `get_analytics_summary`, `get_seo_overview`, `run_seo_audit`, `list_seo_audits`                          | read / audit                                                                                                           |
| `run_site_seo_audits`, `get_site_seo_queue_status`, `cancel_site_seo_audits`                             | queued bulk audits for one site                                                                                        |
| `run_workspace_seo_audits`, `get_workspace_seo_queue_status`, `get_workspace_seo_overview`               | queued bulk audits across the token's organisation                                                                     |
| `get_realtime_analytics`, `get_tracking_status`, `get_page_heatmap`                                      | read                                                                                                                   |
| `list_funnels`, `create_funnel`, `update_funnel`, `delete_funnel`, `get_funnel_analytics`                | `delete_funnel` is **destructive**                                                                                     |
| `list_contacts`, `get_contact`                                                                           | read, org-wide personal data                                                                                           |
| `verify_external_url`, `discover_external_pages`                                                         | external sites                                                                                                         |
| `list_site_members`, `update_site_member`, `remove_site_member`                                          | `remove_site_member` is **destructive**                                                                                |
| `list_server_tokens`, `create_server_token`, `revoke_server_token`                                       | `create_server_token` is disabled unless `FERRLABS_MCP_ALLOW_TOKEN_REVEAL=1`; `revoke_server_token` is **destructive** |
| `list_integrations`, `disconnect_integration`                                                            | `disconnect_integration` is **destructive**                                                                            |
| `list_blog_posts`, `create_blog_post`, `update_blog_post`, `delete_blog_post`                            | `delete_blog_post` is **destructive**                                                                                  |
| `list_email_templates`, `create_email_template`, `update_email_template`, `delete_email_template`        | `delete_email_template` is **destructive**                                                                             |
| `list_media`, `upload_media`, `delete_media`                                                             | `upload_media` takes base64, 10 MB cap; `delete_media` is **destructive**                                              |

## Configuration

| Variable                 | Description                                                               | Default                      |
| ------------------------ | ------------------------------------------------------------------------- | ---------------------------- |
| `FERRGROWTH_API_URL`     | Base URL for the FerrGrowth API (`@ferrgrowth/mcp`).                      | `https://api.ferrgrowth.com` |
| `FERRGROWTH_API_VERSION` | Contract version sent as `x-ferrgrowth-api-version` by `@ferrgrowth/mcp`. | `2026-08-04`                 |

Shared variables (token, OAuth, host allowlist, HTTP transport, output cap) are read by [`@ferrlabs/mcp-core`](https://github.com/FerrLabs/FerrLabs/tree/main/packages/mcp-core) and documented in the [FerrLabs MCP README](https://github.com/FerrLabs/FerrLabs/blob/main/packages/mcp/README.md#configuration).

## Development

```bash
cd mcp
pnpm install
pnpm build
pnpm test
pnpm smoke
```

`pnpm smoke` boots each server over stdio and checks the handshake and the advertised tools.

## License

Mozilla Public License 2.0, see [LICENSE](../LICENSE).
