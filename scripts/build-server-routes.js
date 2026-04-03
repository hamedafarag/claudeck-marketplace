#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────
// Build Server Routes — generates Vercel serverless functions
// for server plugins that return mock/demo data.
//
// Runs as the Vercel build command before deployment.
// Real server plugins can't run on Vercel (they depend on SQLite,
// filesystem, external APIs), so we generate lightweight mocks.
// ──────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

console.log('Building server routes for showcase...\n');

// Read marketplace.json
const registry = JSON.parse(readFileSync(join(ROOT, 'marketplace.json'), 'utf8'));

// Ensure output directory exists
const outputDir = join(ROOT, 'api', 'plugins');
mkdirSync(outputDir, { recursive: true });

// Mock data templates for known plugin types
const mockRoutes = {
  tasks: `
// Auto-generated mock for tasks plugin
const todos = [
  { id: 1, text: 'Review PR for authentication module', done: false, priority: 2, archived: false },
  { id: 2, text: 'Write unit tests for API endpoints', done: false, priority: 1, archived: false },
  { id: 3, text: 'Update documentation for v2 release', done: true, priority: 0, archived: false },
];

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') return res.json(todos);
  if (req.method === 'POST') {
    const todo = { id: Date.now(), text: req.body?.text || 'New task', done: false, priority: 0 };
    todos.push(todo);
    return res.json(todo);
  }
  res.json({ ok: true });
}
`,

  repos: `
// Auto-generated mock for repos plugin
const data = {
  groups: [{ id: 1, name: 'Frontend', parent_id: null }, { id: 2, name: 'Backend', parent_id: null }],
  repos: [
    { id: 1, name: 'claudeck', path: '/projects/claudeck', group_id: 1 },
    { id: 2, name: 'api-server', path: '/projects/api', group_id: 2 },
  ],
};

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  res.json(data);
}
`,

  linear: `
// Auto-generated mock for linear plugin
const issues = [
  { id: 'i1', identifier: 'ENG-42', title: 'Add dark mode toggle', state: { name: 'In Progress' }, priority: 2 },
  { id: 'i2', identifier: 'ENG-43', title: 'Fix mobile nav overflow', state: { name: 'Todo' }, priority: 1 },
];

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.url || '';
  if (url.includes('/config')) return res.json({ apiKey: 'lin_****demo', assigneeEmail: 'demo@claudeck.dev' });
  if (url.includes('/teams')) return res.json([{ id: 't1', name: 'Engineering', key: 'ENG' }]);
  if (url.includes('/test')) return res.json({ ok: true, user: { name: 'Demo User' } });
  res.json(issues);
}
`,
};

// Generic fallback for unknown server plugins
const genericMock = `
// Auto-generated generic mock handler
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  res.json({ ok: true, message: 'This is a showcase mock — install Claudeck for the full experience.' });
}
`;

let generated = 0;

for (const plugin of registry.plugins || []) {
  if (!plugin.source?.startsWith('./plugins/')) continue;

  const name = plugin.source.replace('./plugins/', '');
  const manifestPath = join(ROOT, plugin.source, 'manifest.json');

  if (!existsSync(manifestPath)) continue;

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch { continue; }

  if (!manifest.hasServer) continue;

  // Generate mock handler
  const route = mockRoutes[name] || genericMock;
  const outputPath = join(outputDir, `${name}.js`);
  writeFileSync(outputPath, route.trim() + '\n');
  console.log(`  Generated: api/plugins/${name}.js`);
  generated++;
}

console.log(`\nDone. ${generated} server route${generated !== 1 ? 's' : ''} generated.`);
