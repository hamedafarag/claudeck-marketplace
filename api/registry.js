// Vercel serverless function: GET /api/registry
// Returns marketplace.json enriched with manifest.json data for monorepo plugins.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export default function handler(req, res) {
  const root = process.cwd();
  let registry;

  try {
    registry = JSON.parse(readFileSync(join(root, 'marketplace.json'), 'utf8'));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read marketplace.json' });
  }

  // Enrich monorepo plugins with manifest data
  for (const plugin of registry.plugins || []) {
    if (plugin.source?.startsWith('./plugins/')) {
      const manifestPath = join(root, plugin.source, 'manifest.json');
      if (existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
          plugin.name = plugin.name || manifest.name;
          plugin.description = plugin.description || manifest.description;
          plugin.author = plugin.author || manifest.author;
          plugin.icon = plugin.icon || manifest.icon;
          plugin.hasServer = manifest.hasServer || false;
          plugin.keywords = manifest.keywords || [];
          plugin.minClaudeckVersion = manifest.minClaudeckVersion;
        } catch {}
      }
    }
  }

  res.setHeader('Cache-Control', 'public, max-age=60');
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.json(registry);
}
