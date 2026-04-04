# Claudeck Plugin Marketplace

The official community plugin registry for [Claudeck](https://github.com/hamedafarag/claudeck) — the browser UI for Claude Code.

## Architecture

The marketplace is a two-page site deployed on Vercel:

- **`/`** — Landing page with hero, featured plugins, and "Build Your Own" CTA
- **`/plugins`** — Full catalog with search, filters, sort, view toggle, and server-side pagination
- **`/preview?plugin=name`** — Sandboxed plugin preview with mock Tab SDK

### API

`GET /api/registry` — Returns paginated, filterable plugin data.

| Param | Description | Default |
|-------|-------------|---------|
| `page` | Page number (1-based) | `1` |
| `limit` | Plugins per page (max 100) | `24` |
| `search` | Search name, description, keywords, author | — |
| `type` | `client`, `server`, or `all` | `all` |
| `sort` | `name-asc`, `name-desc`, `newest`, `author` | `name-asc` |
| `keywords` | Comma-separated keyword filter (AND logic) | — |

Response:
```json
{
  "plugins": [...],
  "pagination": { "page": 1, "limit": 24, "total": 47, "totalPages": 2, "hasMore": true },
  "keywords": { "game": 3, "developer": 5, ... }
}
```

## For Users

Community plugins appear automatically in your Claudeck marketplace (the **+** button in the right panel). Switch to the **Community** tab to browse, install, and update plugins.

## For Developers

Want to build a plugin? See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

**Quick start:**
1. Create a plugin using the Tab SDK (`registerTab()`)
2. Add a `manifest.json` with your plugin metadata
3. Submit a PR to this repo

### manifest.json

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Short description (max 120 chars)",
  "author": "your-name",
  "authorGithub": "your-github-username",
  "icon": "🚀",
  "keywords": ["productivity", "utility"],
  "hasServer": false
}
```

See [manifest.schema.json](manifest.schema.json) for the full schema.

### marketplace.json

The registry that Claudeck fetches at runtime. Each entry points to either:

- **Monorepo plugin**: `"source": "./plugins/name"` — plugin code lives in this repo
- **External repo**: `"repo": "owner/repo"` — plugin code lives in a separate GitHub repo

## Local Development

```bash
npm run dev
# → http://localhost:3000
# → http://localhost:3000/plugins
# → http://localhost:3000/preview?plugin=tic-tac-toe
```

## License

MIT
