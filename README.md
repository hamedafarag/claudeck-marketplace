# Claudeck Plugin Marketplace

The official community plugin registry for [Claudeck](https://github.com/hamedafarag/claudeck) — the browser UI for Claude Code.

## For Users

Community plugins appear automatically in your Claudeck marketplace (the **+** button in the right panel). Switch to the **Community** tab to browse, install, and update plugins.

## For Developers

Want to build a plugin? See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

**Quick start:**
1. Create a plugin using the Tab SDK (`registerTab()`)
2. Add a `manifest.json` with your plugin metadata
3. Submit a PR to this repo

## marketplace.json

The `marketplace.json` file is the registry that Claudeck fetches at runtime. Each entry points to either:

- **Monorepo plugin**: `"source": "./plugins/name"` — plugin code lives in this repo
- **External repo**: `"repo": "owner/repo"` — plugin code lives in a separate GitHub repo

```json
{
  "id": "my-plugin",
  "repo": "jane/claudeck-weather",
  "version": "1.0.0"
}
```

## License

MIT
