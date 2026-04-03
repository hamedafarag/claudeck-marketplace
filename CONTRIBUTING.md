# Contributing a Plugin to Claudeck Marketplace

## How to Submit a Plugin

1. **Build your plugin** using the Claudeck Tab SDK
2. **Choose a submission method** (monorepo or external repo)
3. **Open a Pull Request** to this repository

---

## Option A: Monorepo Plugin (recommended for small plugins)

Add your plugin directly to this repo:

```
plugins/your-plugin/
  manifest.json    # required
  client.js        # required
  client.css       # optional
  server.js        # optional
```

Then add an entry to `marketplace.json`:

```json
{
  "id": "your-plugin",
  "source": "./plugins/your-plugin",
  "version": "1.0.0"
}
```

## Option B: External Repo

Host your plugin in your own GitHub repo, then add an entry to `marketplace.json`:

```json
{
  "id": "your-plugin",
  "repo": "your-username/claudeck-your-plugin",
  "version": "1.0.0"
}
```

Your repo must contain `manifest.json` and `client.js` at the root.

---

## manifest.json (required)

Every plugin must include a `manifest.json`:

```json
{
  "id": "your-plugin",
  "name": "Your Plugin",
  "version": "1.0.0",
  "description": "A short description (max 120 chars)",
  "author": "your-github-username",
  "icon": "🔌",
  "hasServer": false,
  "minClaudeckVersion": "1.4.0"
}
```

See `manifest.schema.json` for the full schema.

---

## Plugin Structure

### Client-only plugin (simplest)

```
your-plugin/
  manifest.json
  client.js       # Must call registerTab() from the Tab SDK
  client.css      # Optional styles
```

### Full-stack plugin (with server routes)

```
your-plugin/
  manifest.json
  client.js
  client.css
  server.js       # Express router (export default)
  config.json     # Optional default config
```

**Note:** Server plugins run code on the user's machine. They require the user to explicitly enable server plugins in Claudeck settings. Your PR description should explain why server access is needed.

---

## Tab SDK Quick Start

```javascript
import { registerTab } from '/js/ui/tab-sdk.js';

registerTab({
  id: 'your-plugin',
  title: 'Your Plugin',
  icon: '🔌',
  lazy: true,

  init(ctx) {
    const root = document.createElement('div');
    root.textContent = 'Hello from my plugin!';

    // Listen to events
    ctx.on('ws:message', (msg) => { /* ... */ });

    // React to project/session changes
    ctx.on('projectChanged', (path) => { /* reload */ });
    ctx.onState('sessionId', (id) => { /* reload */ });

    // Call API helpers
    // const data = await ctx.api.fetchProjects();

    return root;
  },

  onActivate() { /* tab became visible */ },
  onDeactivate() { /* tab was hidden */ },
});
```

### Context API (ctx)

| Method | Description |
|--------|-------------|
| `ctx.on(event, fn)` | Subscribe to the app event bus |
| `ctx.emit(event, data)` | Publish to the app event bus |
| `ctx.getState(key)` | Read from the reactive store |
| `ctx.onState(key, fn)` | Subscribe to store changes |
| `ctx.api` | Full API module (fetch helpers) |
| `ctx.getProjectPath()` | Current project path |
| `ctx.getSessionId()` | Current session ID |
| `ctx.showBadge(count)` | Show a number badge on the tab |
| `ctx.clearBadge()` | Hide the badge |
| `ctx.setTitle(text)` | Update the tab button label |

---

## Automated CI Validation

Every PR is automatically validated by a GitHub Action. The validator checks:

### Manifest checks
- All required fields present (`id`, `name`, `version`, `description`, `author`)
- `id` is lowercase alphanumeric with hyphens only
- `id` matches the plugin directory name
- `version` is valid semver
- `description` is under 120 characters
- `hasServer` matches whether `server.js` exists
- No unknown fields

### client.js checks
- File exists
- Calls `registerTab()` from the Tab SDK
- No dangerous patterns (`eval()`, `document.cookie`, `document.write()`, etc.)
- File size under 100KB

### server.js security checks (if present)
- Exports a default Express router
- **Blocked patterns** (will fail the PR):
  - `eval()`, `Function()` constructor
  - `child_process` (exec, spawn, etc.)
  - Raw socket modules (`net`, `dgram`)
  - `process.exit()`
  - `vm` sandbox escapes
- **Warned patterns** (flagged for review):
  - `process.env` access
  - Path traversal (`../../`)
  - File deletion (`unlinkSync`, `rmSync`)
  - Global namespace modification

### CSS checks
- No XSS vectors (`expression()`, `javascript:`, `-moz-binding`)
- No external `@import` URLs
- Warns about broad selectors (`body`, `*`, bare `div`) that could break Claudeck UI

### marketplace.json consistency
- No duplicate plugin IDs
- Every entry has `source` or `repo`
- Monorepo plugin versions match between `marketplace.json` and `manifest.json`
- IDs match between registry and manifest

### Server plugins
Plugins with `hasServer: true` are automatically labeled `server-plugin` + `needs-security-review` for manual review.

---

## PR Checklist

- [ ] `manifest.json` is valid (matches schema)
- [ ] `id` in manifest matches the directory name / marketplace entry
- [ ] `version` follows semver
- [ ] `description` is under 120 characters
- [ ] `client.js` calls `registerTab()` with a unique ID
- [ ] Plugin works with the latest Claudeck release
- [ ] No hardcoded paths or credentials
- [ ] If `hasServer: true`, explain why in the PR description

## Updating Your Plugin

To release a new version:
1. Update `version` in your `manifest.json` (and in your repo if external)
2. Update the `version` in `marketplace.json`
3. Open a PR

Claudeck will detect the version change and show an "Update" button to users.

## Running Validation Locally

You can run the validator locally before submitting:

```bash
# Validate all plugins
node scripts/validate-plugin.js

# Validate a specific plugin
node scripts/validate-plugin.js my-plugin
```
