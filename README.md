<div align="center">

<h1><img src=".github/logo.svg" alt="" width="48" height="48" align="absmiddle"> FerrGrowth</h1>

**Manage FerrGrowth sites, pages and analytics from an AI assistant.**

MCP server for [FerrGrowth](https://ferrlabs.com), the site, SEO and analytics product.

[![npm @ferrgrowth/mcp](https://img.shields.io/npm/v/@ferrgrowth/mcp)](https://www.npmjs.com/package/@ferrgrowth/mcp)
[![CI](https://github.com/FerrLabs/FerrGrowth/actions/workflows/ci.yml/badge.svg)](https://github.com/FerrLabs/FerrGrowth/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/FerrLabs/FerrGrowth)](LICENSE)

[MCP server](mcp/README.md) | [npm](https://www.npmjs.com/package/@ferrgrowth/mcp) | [FerrLabs](https://ferrlabs.com)

</div>

## What is in this repository

This repository holds the open source parts of FerrGrowth. For now that is the MCP server in [`mcp/`](mcp), published to npm as [`@ferrgrowth/mcp`](https://www.npmjs.com/package/@ferrgrowth/mcp). The product itself lives in [FerrGrowth-Cloud](https://github.com/FerrLabs/FerrGrowth-Cloud).

## MCP server

Tools cover sites and custom domains, pages with revisions, scheduling and preview links, blog posts, forms and email templates, releases, redirects, robots.txt and JSON-LD, media, SEO audits, analytics, funnels and goals, contacts, site members, server tokens and integrations. Irreversible tools are marked destructive so clients can ask for confirmation. `create_server_token` is disabled unless `FERRLABS_MCP_ALLOW_TOKEN_REVEAL=1`, because the secret would be written into the conversation transcript.

### Install

Add it to your MCP client configuration (Claude Code, Cursor, etc.):

```json
{
  "mcpServers": {
    "ferrgrowth": { "command": "npx", "args": ["-y", "@ferrgrowth/mcp"] }
  }
}
```

The first tool call that needs auth opens a browser for an OAuth loopback flow and saves the token. To skip it (CI, headless), set `FERRLABS_API_TOKEN`. Every tool takes an optional `org_id` that selects the organization for that call.

### Configuration

| Variable | Description | Default |
| --- | --- | --- |
| `FERRGROWTH_API_URL` | Base URL of the FerrGrowth API. | `https://api.ferrgrowth.com` |
| `FERRGROWTH_API_VERSION` | Contract version sent as `x-ferrgrowth-api-version`. | `2026-08-04` |

The full tool list, resources, prompts and the shared variables (token, OAuth, host allowlist, HTTP transport, output cap) are documented in [`mcp/README.md`](mcp/README.md) and the [FerrLabs MCP README](https://github.com/FerrLabs/FerrLabs/blob/main/packages/mcp/README.md#configuration).

## Development

Node 22 or later and pnpm 12.

```bash
cd mcp
pnpm install
pnpm build
pnpm test
pnpm smoke
```

`pnpm smoke` boots the server over stdio and checks the handshake and the advertised tools.

## License

Mozilla Public License 2.0, see [LICENSE](LICENSE).
