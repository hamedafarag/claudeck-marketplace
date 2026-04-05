# Contributing a Plugin to Claudeck Marketplace

## How to Submit a Plugin

1. **Build your plugin** using the Claudeck Tab SDK
2. **Choose a submission method** (monorepo or external repo)
3. **Open a Pull Request** to this repository

### Scaffold with Claude Code

You can use the plugin creator skill to scaffold a complete plugin automatically:

```bash
npx skills add https://github.com/hamedafarag/claudeck-skills
# Then in Claude Code:
/claudeck-plugin-create my-widget A dashboard showing system metrics
```

This generates `manifest.json`, `client.js`, `client.css`, and optionally `server.js` — ready to test and submit.

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
  "minClaudeckVersion": "1.4.1"
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

**Note:** Server plugins run code on the user's machine. Users must set `CLAUDECK_USER_SERVER_PLUGINS=true` to enable server-side plugin routes. Your PR description should explain why server access is needed.

---

## Tab SDK Reference

> Full reference with all events, state keys, CSS tokens, and examples: [TAB-SDK.md](https://github.com/hamedafarag/claudeck/blob/main/docs/TAB-SDK.md)

### registerTab(config)

```javascript
import { registerTab } from '/js/ui/tab-sdk.js';

registerTab({
  id: 'your-plugin',       // required — unique tab ID
  title: 'Your Plugin',    // tab button label
  icon: '🔌',              // emoji shown on the tab button
  lazy: true,              // defer init() until tab is first opened (recommended)

  init(ctx) {
    // Build your UI — must return an HTMLElement
    const root = document.createElement('div');
    root.className = 'my-plugin';
    root.innerHTML = `<h2>Hello!</h2>`;

    // Use ctx to interact with Claudeck (see below)
    loadData(ctx);

    return root;  // MUST return an HTMLElement
  },

  onActivate(ctx) { /* tab became visible — ctx is passed */ },
  onDeactivate(ctx) { /* tab was hidden — ctx is passed */ },
  onDestroy(ctx) { /* tab was removed — ctx is passed */ },
});
```

| Config Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | Unique tab identifier |
| `title` | string | No | Tab button label (defaults to formatted `id`) |
| `icon` | string | No | Emoji for the tab button |
| `lazy` | boolean | No | If `true`, `init()` runs on first open instead of immediately. Recommended. |
| `init(ctx)` | function | Yes | Build your UI. Receives the context object. **Must return an HTMLElement.** |
| `onActivate(ctx)` | function | No | Called each time the tab becomes visible. Receives `ctx`. |
| `onDeactivate(ctx)` | function | No | Called when another tab becomes active. Receives `ctx`. |
| `onDestroy(ctx)` | function | No | Called when the plugin is disabled/removed. Receives `ctx`. |

---

### Context API (ctx)

The `ctx` object passed to `init()` is your interface to Claudeck:

| Method | Description |
|--------|-------------|
| `ctx.pluginId` | Your plugin's ID string |
| `ctx.on(event, fn)` | Subscribe to the app event bus. Returns an unsubscribe function. |
| `ctx.off(event, fn)` | Remove a specific event listener |
| `ctx.emit(event, data)` | Publish to the app event bus |
| `ctx.getState(key)` | Read from the reactive store |
| `ctx.onState(key, fn)` | Subscribe to store key changes. Returns an unsubscribe function. |
| `ctx.api` | Full API module — all `fetch()` helpers (see below) |
| `ctx.getProjectPath()` | Current project path (string, may be `''` if none selected) |
| `ctx.getSessionId()` | Current session ID (string or `null`) |
| `ctx.getTheme()` | Current theme: `'dark'` or `'light'` |
| `ctx.storage.get(key)` | Read from plugin-scoped localStorage (auto-namespaced) |
| `ctx.storage.set(key, value)` | Write to plugin-scoped localStorage |
| `ctx.storage.remove(key)` | Remove from plugin-scoped localStorage |
| `ctx.toast(msg, opts)` | Show a temporary notification. `opts: {duration, type}` where type is `'info'`, `'success'`, or `'error'` |
| `ctx.showBadge(count)` | Show a number badge on the tab button |
| `ctx.clearBadge()` | Hide the badge |
| `ctx.setTitle(text)` | Update the tab button label at runtime |
| `ctx.dispose()` | Unsubscribe all event/state listeners (auto-called on destroy) |

**Subscriptions auto-cleanup:** All listeners registered via `ctx.on()` and `ctx.onState()` are automatically unsubscribed when the plugin is destroyed (disabled/uninstalled). You can also unsubscribe manually:

```javascript
const unsub = ctx.on('projectChanged', reload);
// later:
unsub();
```

---

### Available Events

Subscribe via `ctx.on(event, fn)`:

| Event | Payload | Description |
|-------|---------|-------------|
| `ws:message` | `msg` (object) | Every WebSocket message from the server — streaming text, tool calls, results, errors, completion |
| `ws:connected` | — | WebSocket first connected |
| `ws:reconnected` | — | WebSocket reconnected after drop |
| `ws:disconnected` | — | WebSocket connection lost |
| `projectChanged` | `path` (string) | User switched to a different project |
| `rightPanel:tabChanged` | `tabId` (string) | A different tab became active |
| `rightPanel:opened` | `tabId` (string) | The right panel was opened |

**Most useful for plugins:**
- `ws:message` — react to live streaming, tool calls, or completions
- `projectChanged` — reload your data when the user switches projects

**Note:** `ctx.on` vs `ctx.onState` — use `ctx.on` for events (things that *happen*), use `ctx.onState` for state (values that *change*).

---

### Available State Keys

Read via `ctx.getState(key)`, subscribe via `ctx.onState(key, fn)`:

| Key | Type | Description |
|-----|------|-------------|
| `sessionId` | string \| null | Currently active session ID |
| `view` | string | Current view: `'home'` or `'chat'` |
| `parallelMode` | boolean | Whether parallel mode is active |
| `projectsData` | array | All registered projects `[{name, path}, ...]` |
| `sessionTokens` | object | Token usage: `{input, output, cacheRead, cacheCreation}` |
| `prompts` | array | Saved prompt templates |
| `workflows` | array | Saved workflows |
| `agents` | array | Agent definitions |
| `ws` | WebSocket \| null | The live WebSocket instance |
| `streamingCharCount` | number | Characters received in current stream |
| `notificationsEnabled` | boolean | Whether browser notifications are on |

**Most useful:** `sessionId` (reload data on session switch), `projectsData` (know when projects are loaded).

**Timing note:** When `init()` runs, `projectsData` or `sessionId` may not be populated yet. Use `ctx.onState('projectsData', fn)` to react when the data arrives:

```javascript
init(ctx) {
  const root = document.createElement('div');

  function loadData() {
    const project = ctx.getProjectPath();
    if (!project) return;
    // fetch your data...
  }

  ctx.on('projectChanged', loadData);
  ctx.onState('projectsData', () => loadData());
  loadData(); // try immediately, may be empty

  return root;
}
```

---

### Common API Functions (ctx.api)

The `ctx.api` object exposes 70+ functions. Here are the ones most useful for plugins:

**Projects & Files:**
| Function | Description |
|----------|-------------|
| `ctx.api.fetchProjects()` | List all registered projects |
| `ctx.api.fetchFiles(path)` | List files in a directory |
| `ctx.api.fetchFileContent(basePath, filePath)` | Read a file's content |
| `ctx.api.writeFileContent(basePath, filePath, content)` | Write content to a file |
| `ctx.api.fetchFileTree(basePath, dir)` | Get recursive file tree |
| `ctx.api.searchFiles(basePath, query)` | Search for files by name |
| `ctx.api.browseFolders(dir)` | Browse folder structure |
| `ctx.api.execCommand(command, cwd)` | Execute a shell command |

**Sessions:**
| Function | Description |
|----------|-------------|
| `ctx.api.fetchSessions(projectPath)` | List sessions for a project |
| `ctx.api.fetchMessages(sessionId, opts)` | Get messages for a session |

**Stats:**
| Function | Description |
|----------|-------------|
| `ctx.api.fetchStats(projectPath)` | Get usage stats |
| `ctx.api.fetchHomeData()` | Get home dashboard data |
| `ctx.api.fetchAccountInfo()` | Get account details |

#### Calling Your Own Server Routes

If your plugin has a `server.js`, Claudeck auto-mounts it at `/api/plugins/<your-id>/`. Use standard `fetch()` to call your routes:

```javascript
// In client.js
async function loadMyData() {
  const res = await fetch('/api/plugins/my-plugin/data');
  return res.json();
}

async function saveMyData(data) {
  await fetch('/api/plugins/my-plugin/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
```

```javascript
// In server.js
import { Router } from 'express';
const router = Router();

router.get('/data', (req, res) => {
  res.json({ items: [] });
});

router.post('/data', (req, res) => {
  const { items } = req.body;
  // save items...
  res.json({ ok: true });
});

export default router;
```

---

### CSS Guidelines

#### Scoping

Prefix **all** CSS classes with your plugin ID to avoid collisions:

```css
/* Good */
.my-plugin-header { ... }
.my-plugin-list { ... }
.my-plugin-item { ... }

/* Bad — will break Claudeck UI */
.header { ... }
.list { ... }
div { ... }
```

The CI will warn about broad selectors (`body`, `*`, bare element selectors).

#### Design Tokens

Use these CSS custom properties to match Claudeck's theme (both dark and light modes):

**Colors:**
```css
var(--bg)              /* primary background */
var(--bg-secondary)    /* secondary background */
var(--bg-tertiary)     /* tertiary background */
var(--border)          /* standard border */
var(--border-subtle)   /* subtle border */
var(--text)            /* primary text */
var(--text-secondary)  /* secondary text */
var(--text-dim)        /* dimmed text */
var(--accent)          /* green accent (primary action) */
var(--accent-dim)      /* green accent background */
var(--purple)          /* purple accent */
var(--user)            /* blue accent (user messages) */
var(--success)         /* success state */
var(--warning)         /* warning state */
var(--error)           /* error state */
var(--cyan)            /* cyan accent */
var(--amber)           /* amber accent */
```

**Typography:**
```css
var(--font-display)    /* Chakra Petch — headings */
var(--font-sans)       /* Outfit — body text */
var(--font-mono)       /* JetBrains Mono — code */
```

**Layout:**
```css
var(--radius)          /* 4px */
var(--radius-md)       /* 8px */
var(--radius-lg)       /* 12px */
```

**Effects:**
```css
var(--glow)            /* subtle green glow */
var(--shadow-sm)       /* small shadow */
var(--shadow-md)       /* medium shadow */
var(--ease-smooth)     /* smooth easing */
```

#### Common Patterns

```css
/* Plugin container — fill the tab pane */
.my-plugin {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  font-family: var(--font-sans);
  color: var(--text);
}

/* Scrollable list */
.my-plugin-list {
  flex: 1;
  overflow-y: auto;
}

/* Action button */
.my-plugin-btn {
  padding: 6px 16px;
  border-radius: var(--radius-md);
  background: var(--accent);
  color: #fff;
  border: none;
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: 12px;
}
.my-plugin-btn:hover {
  filter: brightness(1.1);
}

/* Loading spinner */
@keyframes my-plugin-spin {
  to { transform: rotate(360deg); }
}
.my-plugin-spinner {
  width: 20px; height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: my-plugin-spin 0.8s linear infinite;
}
```

---

## Preview & Testing

### Showcase Preview

You can preview plugins in the browser at the [marketplace showcase](https://marketplace.claudeck.app/preview?plugin=your-plugin). The showcase uses a mock Tab SDK that simulates the Claudeck environment.

**What works in preview:**
- `registerTab()` and `init(ctx)` lifecycle
- `ctx.api.*` calls (return demo data, CRUD operations use in-memory state)
- `ctx.showBadge()`, `ctx.clearBadge()`, `ctx.setTitle()`
- `ctx.on()` and `ctx.emit()` (local event bus)

**What does NOT work in preview (real Claudeck only):**
- `ws:message` events never fire (no WebSocket connection)
- `projectChanged` events never fire (no project selector)
- `ctx.onState()` listeners are registered but never triggered (state is static)
- `onActivate()` / `onDeactivate()` lifecycle hooks are not called
- `ctx.getProjectPath()` always returns `'/demo/claudeck-project'`
- `ctx.getSessionId()` always returns `'showcase-session-001'`
- API function arguments are ignored (e.g., `fetchFileContent()` returns demo content regardless of path)
- Error states cannot be tested (all mock API calls succeed)

### Testing Against a Local Claudeck

For full testing, install [Claudeck](https://github.com/hamedafarag/claudeck) and drop your plugin into `~/.claudeck/plugins/`:

```bash
# Install Claudeck
npx claudeck

# Copy your plugin
mkdir -p ~/.claudeck/plugins/my-plugin
cp client.js client.css manifest.json ~/.claudeck/plugins/my-plugin/

# Restart Claudeck and enable your plugin in the marketplace
```

### Running Validation Locally

```bash
# Validate all plugins
node scripts/validate-plugin.js

# Validate a specific plugin
node scripts/validate-plugin.js my-plugin
```

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
- [ ] `init()` returns an `HTMLElement`
- [ ] All CSS classes are prefixed with your plugin ID
- [ ] Plugin works with the latest Claudeck release
- [ ] No hardcoded paths or credentials
- [ ] If `hasServer: true`, explain why in the PR description

## Updating Your Plugin

To release a new version:
1. Update `version` in your `manifest.json` (and in your repo if external)
2. Update the `version` in `marketplace.json`
3. Open a PR

Claudeck will detect the version change and show an "Update" button to users.
