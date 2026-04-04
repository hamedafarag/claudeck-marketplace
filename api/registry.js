// Vercel serverless function: GET /api/registry
// Returns marketplace.json enriched with manifest.json data for monorepo plugins.
//
// Query params:
//   page   – 1-based page number (default: 1)
//   limit  – plugins per page (default: 24, max: 100)
//   search – filter by name, description, keywords, author
//   type   – "client" | "server" | "all" (default: "all")
//   sort   – "name-asc" | "name-desc" | "newest" | "author" (default: "name-asc")

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

  // Parse query params
  const url = new URL(req.url, 'http://localhost');
  const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit')) || 24));
  const search = (url.searchParams.get('search') || '').trim().toLowerCase();
  const type = url.searchParams.get('type') || 'all';
  const sort = url.searchParams.get('sort') || 'name-asc';
  const keywords = url.searchParams.get('keywords') ? url.searchParams.get('keywords').split(',') : [];

  let plugins = registry.plugins || [];

  // Filter: type
  if (type === 'client') {
    plugins = plugins.filter(p => !p.hasServer);
  } else if (type === 'server') {
    plugins = plugins.filter(p => p.hasServer);
  }

  // Filter: keywords (AND logic)
  if (keywords.length > 0) {
    plugins = plugins.filter(p => {
      const kws = new Set(p.keywords || []);
      return keywords.every(k => kws.has(k));
    });
  }

  // Filter: search
  if (search) {
    const terms = search.split(/\s+/);
    plugins = plugins.filter(p => {
      const haystack = [p.name, p.description, p.author, ...(p.keywords || [])].join(' ').toLowerCase();
      return terms.every(t => haystack.includes(t));
    });
  }

  // Sort
  switch (sort) {
    case 'name-desc':
      plugins.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
      break;
    case 'newest':
      plugins.reverse();
      break;
    case 'author':
      plugins.sort((a, b) => (a.author || '').localeCompare(b.author || '') || (a.name || '').localeCompare(b.name || ''));
      break;
    case 'name-asc':
    default:
      plugins.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      break;
  }

  // Collect all unique keywords (from full unfiltered set for chip generation)
  const allKeywords = {};
  for (const p of registry.plugins || []) {
    for (const kw of p.keywords || []) {
      allKeywords[kw] = (allKeywords[kw] || 0) + 1;
    }
  }

  // Paginate
  const total = plugins.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const paged = plugins.slice(start, start + limit);

  res.setHeader('Cache-Control', 'public, max-age=60');
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.json({
    plugins: paged,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
    keywords: allKeywords,
  });
}
