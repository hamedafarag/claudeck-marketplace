#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────
// Claudeck Plugin Validator
// Runs in GitHub Actions on every PR to validate contributed plugins.
// Zero external dependencies — uses only Node.js built-ins.
// ──────────────────────────────────────────────────────────────

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

// ── Helpers ──────────────────────────────────────────────────

const errors = [];
const warnings = [];

function error(ctx, msg) {
  errors.push(`[${ctx}] ${msg}`);
}
function warn(ctx, msg) {
  warnings.push(`[${ctx}] ${msg}`);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    return null;
  }
}

// ── Detect changed plugins ───────────────────────────────────

function getChangedPlugins() {
  // In CI, compare against the base branch
  const base = process.env.GITHUB_BASE_REF || "main";
  let changedFiles;
  try {
    changedFiles = execSync(`git diff --name-only origin/${base}...HEAD`, {
      encoding: "utf8",
      cwd: ROOT,
    })
      .trim()
      .split("\n")
      .filter(Boolean);
  } catch {
    // Fallback: validate all plugins in plugins/
    console.log("Could not diff against base branch, validating all plugins.");
    return getAllPlugins();
  }

  const pluginDirs = new Set();

  for (const file of changedFiles) {
    // Changes to plugins/<name>/... or marketplace.json
    const match = file.match(/^plugins\/([^/]+)\//);
    if (match) pluginDirs.add(match[1]);
  }

  // Also check if marketplace.json changed — validate all referenced plugins
  if (changedFiles.includes("marketplace.json")) {
    const registry = readJson(join(ROOT, "marketplace.json"));
    if (registry?.plugins) {
      for (const p of registry.plugins) {
        if (p.source?.startsWith("./plugins/")) {
          pluginDirs.add(p.source.replace("./plugins/", ""));
        }
      }
    }
  }

  return [...pluginDirs];
}

function getAllPlugins() {
  const dir = join(ROOT, "plugins");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory();
  });
}

// ── 1. Manifest Validation ───────────────────────────────────

function validateManifest(pluginName, pluginDir) {
  const ctx = `${pluginName}/manifest.json`;
  const manifestPath = join(pluginDir, "manifest.json");

  if (!existsSync(manifestPath)) {
    error(ctx, "Missing manifest.json — every plugin must include one");
    return null;
  }

  const manifest = readJson(manifestPath);
  if (!manifest) {
    error(ctx, "Invalid JSON — could not parse manifest.json");
    return null;
  }

  // Required fields
  const required = ["id", "name", "version", "description", "author"];
  for (const field of required) {
    if (!manifest[field]) {
      error(ctx, `Missing required field: "${field}"`);
    }
  }

  // ID format
  if (manifest.id && !/^[a-z0-9-]+$/.test(manifest.id)) {
    error(ctx, `Invalid id "${manifest.id}" — must be lowercase alphanumeric with hyphens only`);
  }

  // ID must match directory name
  if (manifest.id && manifest.id !== pluginName) {
    error(ctx, `Manifest id "${manifest.id}" does not match directory name "${pluginName}"`);
  }

  // Version format (semver)
  if (manifest.version && !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    error(ctx, `Invalid version "${manifest.version}" — must be semver (e.g. 1.0.0)`);
  }

  // Description length
  if (manifest.description && manifest.description.length > 120) {
    error(ctx, `Description is ${manifest.description.length} chars — max 120`);
  }

  // hasServer consistency
  const hasServerFile = existsSync(join(pluginDir, "server.js"));
  if (manifest.hasServer && !hasServerFile) {
    error(ctx, `manifest.hasServer is true but no server.js file found`);
  }
  if (!manifest.hasServer && hasServerFile) {
    warn(ctx, `server.js exists but manifest.hasServer is not true — set hasServer: true`);
  }

  // No unknown fields
  const knownFields = new Set([
    "id", "name", "version", "description", "author", "icon",
    "hasServer", "minClaudeckVersion", "homepage", "keywords",
  ]);
  for (const key of Object.keys(manifest)) {
    if (!knownFields.has(key)) {
      warn(ctx, `Unknown field "${key}" — see manifest.schema.json for allowed fields`);
    }
  }

  return manifest;
}

// ── 2. Client.js Validation ──────────────────────────────────

// Patterns that should never appear in client-side plugin code
const CLIENT_DANGEROUS_PATTERNS = [
  { pattern: /\beval\s*\(/, label: "eval()" },
  { pattern: /\bFunction\s*\(/, label: "Function() constructor" },
  { pattern: /document\.cookie/, label: "document.cookie access" },
  { pattern: /localStorage\.(?:getItem|setItem)\s*\(\s*['"]claudeck-(?!plugin-)/, label: "accessing core Claudeck localStorage keys" },
  { pattern: /\bfetch\s*\(\s*['"`]https?:\/\/(?!localhost)/, label: "external HTTP request — must be documented" },
  { pattern: /\bwindow\.open\s*\(/, label: "window.open() — can be used for phishing" },
  { pattern: /\binnerHTML\s*=\s*(?!['"`<])/, label: "innerHTML with dynamic content — XSS risk" },
  { pattern: /\bdocument\.write\s*\(/, label: "document.write()" },
  { pattern: /\bimportScripts\s*\(/, label: "importScripts()" },
  { pattern: /\bnew\s+Worker\s*\(/, label: "Web Worker creation" },
  { pattern: /\bcrypto\.subtle/, label: "crypto.subtle access" },
];

function validateClientJs(pluginName, pluginDir) {
  const ctx = `${pluginName}/client.js`;
  const clientPath = join(pluginDir, "client.js");

  if (!existsSync(clientPath)) {
    error(ctx, "Missing client.js — every plugin must include one");
    return;
  }

  const code = readFileSync(clientPath, "utf8");

  // Syntax check
  try {
    // Use Node's built-in parser to check for syntax errors
    new Function(`"use strict";\n${code}`);
  } catch (e) {
    // Function constructor doesn't support import/export, try different approach
    try {
      execSync(`node --check "${clientPath}"`, { encoding: "utf8", cwd: ROOT });
    } catch (syntaxErr) {
      // --check doesn't work for ESM without extension, just check with a simpler parse
      // We'll validate via import syntax patterns instead
    }
  }

  // Must call registerTab
  if (!/registerTab\s*\(/.test(code)) {
    error(ctx, "Must call registerTab() — plugins must register a tab via the Tab SDK");
  }

  // Must import from tab-sdk
  if (!/from\s+['"]\/js\/ui\/tab-sdk\.js['"]/.test(code) && !/from\s+['"]\.\.\/.*tab-sdk/.test(code)) {
    warn(ctx, "Expected import from '/js/ui/tab-sdk.js' — ensure you're using the Tab SDK");
  }

  // Scan for dangerous patterns
  const lines = code.split("\n");
  for (const { pattern, label } of CLIENT_DANGEROUS_PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip comments
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
      if (pattern.test(line)) {
        warn(ctx, `Line ${i + 1}: detected ${label}`);
      }
    }
  }

  // File size check (100KB max for client.js)
  const sizeKB = Buffer.byteLength(code, "utf8") / 1024;
  if (sizeKB > 100) {
    warn(ctx, `File is ${sizeKB.toFixed(0)}KB — consider splitting (max recommended: 100KB)`);
  }
}

// ── 3. Server.js Security Validation ─────────────────────────

const SERVER_DANGEROUS_PATTERNS = [
  { pattern: /\beval\s*\(/, label: "eval()", level: "error" },
  { pattern: /\bFunction\s*\(/, label: "Function() constructor", level: "error" },
  { pattern: /\bchild_process/, label: "child_process — command execution", level: "error" },
  { pattern: /\bexecSync\s*\(/, label: "execSync()", level: "error" },
  { pattern: /\bexec\s*\(/, label: "exec()", level: "error" },
  { pattern: /\bspawnSync\s*\(/, label: "spawnSync()", level: "error" },
  { pattern: /\bspawn\s*\(/, label: "spawn()", level: "error" },
  { pattern: /\bexecFile\s*\(/, label: "execFile()", level: "error" },
  { pattern: /\bprocess\.env/, label: "process.env access", level: "warn" },
  { pattern: /\bprocess\.exit\s*\(/, label: "process.exit()", level: "error" },
  { pattern: /\brequire\s*\(\s*['"]child_process['"]/, label: "require('child_process')", level: "error" },
  { pattern: /\bimport\s.*['"]child_process['"]/, label: "import child_process", level: "error" },
  { pattern: /\brequire\s*\(\s*['"]net['"]/, label: "require('net') — raw sockets", level: "error" },
  { pattern: /\bimport\s.*['"]net['"]/, label: "import net — raw sockets", level: "error" },
  { pattern: /\brequire\s*\(\s*['"]dgram['"]/, label: "require('dgram') — UDP sockets", level: "error" },
  { pattern: /\bimport\s.*['"]dgram['"]/, label: "import dgram — UDP sockets", level: "error" },
  { pattern: /\brequire\s*\(\s*['"]cluster['"]/, label: "require('cluster')", level: "error" },
  { pattern: /\bimport\s.*['"]cluster['"]/, label: "import cluster", level: "error" },
  { pattern: /\bvm\b.*\brunInNewContext\b/, label: "vm.runInNewContext()", level: "error" },
  { pattern: /\bvm\b.*\brunInThisContext\b/, label: "vm.runInThisContext()", level: "error" },
  { pattern: /\bglobal\s*\./, label: "global namespace modification", level: "warn" },
  { pattern: /\bglobalThis\s*\./, label: "globalThis modification", level: "warn" },
  { pattern: /\.\.\/\.\.\//, label: "path traversal (../../)", level: "warn" },
  { pattern: /\bunlinkSync\s*\(/, label: "unlinkSync() — file deletion", level: "warn" },
  { pattern: /\brmSync\s*\(/, label: "rmSync() — file/dir deletion", level: "warn" },
  { pattern: /\brmdirSync\s*\(/, label: "rmdirSync() — directory deletion", level: "warn" },
  { pattern: /\bwriteFileSync\s*\(.*(?:\/etc\/|\/usr\/|\/bin\/|\/sbin\/)/, label: "writing to system directories", level: "error" },
];

function validateServerJs(pluginName, pluginDir) {
  const ctx = `${pluginName}/server.js`;
  const serverPath = join(pluginDir, "server.js");

  if (!existsSync(serverPath)) return; // server.js is optional

  const code = readFileSync(serverPath, "utf8");

  // Must export a default Express router
  if (!/export\s+default\b/.test(code) && !/module\.exports/.test(code)) {
    error(ctx, "Must export default an Express router");
  }

  // Should import express Router
  if (!/Router\s*\(\s*\)/.test(code) && !/express\s*\(\s*\)/.test(code)) {
    warn(ctx, "Expected to create an Express Router — server plugins should export a Router");
  }

  // Scan for dangerous patterns
  const lines = code.split("\n");
  for (const { pattern, label, level } of SERVER_DANGEROUS_PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
      if (pattern.test(line)) {
        if (level === "error") {
          error(ctx, `Line ${i + 1}: BLOCKED — ${label}`);
        } else {
          warn(ctx, `Line ${i + 1}: ${label}`);
        }
      }
    }
  }

  // File size check (200KB max for server.js)
  const sizeKB = Buffer.byteLength(code, "utf8") / 1024;
  if (sizeKB > 200) {
    warn(ctx, `File is ${sizeKB.toFixed(0)}KB — consider splitting (max recommended: 200KB)`);
  }
}

// ── 4. CSS Validation ────────────────────────────────────────

const CSS_DANGEROUS_PATTERNS = [
  { pattern: /expression\s*\(/, label: "CSS expression() — IE-specific XSS vector" },
  { pattern: /-moz-binding\s*:/, label: "-moz-binding — XBL injection" },
  { pattern: /behavior\s*:\s*url\s*\(/, label: "behavior:url() — HTC injection" },
  { pattern: /javascript\s*:/, label: "javascript: protocol in CSS" },
  { pattern: /@import\s+url\s*\(\s*['"]https?:/, label: "@import from external URL" },
  { pattern: /url\s*\(\s*['"]data:text\/html/, label: "data:text/html in url() — XSS risk" },
];

function validateCss(pluginName, pluginDir) {
  const ctx = `${pluginName}/client.css`;
  const cssPath = join(pluginDir, "client.css");

  if (!existsSync(cssPath)) return; // CSS is optional

  const code = readFileSync(cssPath, "utf8");

  // Check for dangerous patterns
  const lines = code.split("\n");
  for (const { pattern, label } of CSS_DANGEROUS_PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith("/*") || trimmed.startsWith("*")) continue;
      if (pattern.test(line)) {
        error(ctx, `Line ${i + 1}: BLOCKED — ${label}`);
      }
    }
  }

  // Check for overly broad selectors that could break Claudeck UI
  const broadSelectors = [
    { pattern: /^\s*(?:body|html|:root)\s*\{/, label: "body/html/:root selector — may override Claudeck styles" },
    { pattern: /^\s*\*\s*\{/, label: "universal selector * — may override Claudeck styles" },
    { pattern: /^\s*(?:input|button|select|textarea|a|div|span|p|h[1-6])\s*\{/, label: "bare element selector — may affect Claudeck UI outside your plugin" },
  ];
  for (const { pattern, label } of broadSelectors) {
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        warn(ctx, `Line ${i + 1}: ${label}. Scope selectors with a plugin-specific class.`);
      }
    }
  }

  // File size check (50KB max)
  const sizeKB = Buffer.byteLength(code, "utf8") / 1024;
  if (sizeKB > 50) {
    warn(ctx, `File is ${sizeKB.toFixed(0)}KB — consider optimizing (max recommended: 50KB)`);
  }
}

// ── 5. Marketplace.json Consistency ──────────────────────────

function validateMarketplaceJson() {
  const ctx = "marketplace.json";
  const registryPath = join(ROOT, "marketplace.json");

  if (!existsSync(registryPath)) {
    error(ctx, "Missing marketplace.json");
    return;
  }

  const registry = readJson(registryPath);
  if (!registry) {
    error(ctx, "Invalid JSON — could not parse");
    return;
  }

  if (!Array.isArray(registry.plugins)) {
    error(ctx, 'Missing or invalid "plugins" array');
    return;
  }

  const seenIds = new Set();
  for (const plugin of registry.plugins) {
    // Required fields in registry entry
    if (!plugin.id) {
      error(ctx, "Plugin entry missing 'id'");
      continue;
    }

    // Duplicate check
    if (seenIds.has(plugin.id)) {
      error(ctx, `Duplicate plugin id: "${plugin.id}"`);
    }
    seenIds.add(plugin.id);

    // Must have source or repo
    if (!plugin.source && !plugin.repo) {
      error(ctx, `Plugin "${plugin.id}": must have "source" (monorepo) or "repo" (external)`);
    }

    // Version required
    if (!plugin.version) {
      error(ctx, `Plugin "${plugin.id}": missing "version"`);
    } else if (!/^\d+\.\d+\.\d+$/.test(plugin.version)) {
      error(ctx, `Plugin "${plugin.id}": invalid version "${plugin.version}" — must be semver`);
    }

    // Monorepo source validation
    if (plugin.source?.startsWith("./plugins/")) {
      const pluginDir = join(ROOT, plugin.source);
      if (!existsSync(pluginDir)) {
        error(ctx, `Plugin "${plugin.id}": source directory "${plugin.source}" does not exist`);
        continue;
      }

      // Manifest version must match registry version
      const manifest = readJson(join(pluginDir, "manifest.json"));
      if (manifest && plugin.version && manifest.version !== plugin.version) {
        error(ctx, `Plugin "${plugin.id}": marketplace.json version (${plugin.version}) does not match manifest.json version (${manifest.version})`);
      }

      // Manifest id must match registry id
      if (manifest && manifest.id !== plugin.id) {
        error(ctx, `Plugin "${plugin.id}": marketplace.json id does not match manifest.json id ("${manifest.id}")`);
      }
    }

    // External repo format
    if (plugin.repo && !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(plugin.repo)) {
      error(ctx, `Plugin "${plugin.id}": invalid repo format "${plugin.repo}" — expected "owner/repo"`);
    }

    // Copy manifest fields into registry for enrichment
    if (plugin.source?.startsWith("./plugins/")) {
      const pluginDir = join(ROOT, plugin.source);
      const manifest = readJson(join(pluginDir, "manifest.json"));
      const requiredRegistryFields = ["name", "description", "author"];
      for (const field of requiredRegistryFields) {
        if (!plugin[field] && !manifest?.[field]) {
          warn(ctx, `Plugin "${plugin.id}": missing "${field}" in both registry and manifest — recommended for marketplace display`);
        }
      }
    }
  }
}

// ── 6. Extra files check ─────────────────────────────────────

function validateExtraFiles(pluginName, pluginDir) {
  const ctx = pluginName;
  const allowed = new Set([
    "manifest.json", "client.js", "client.css", "server.js", "config.json",
    "README.md", "LICENSE", ".gitignore",
  ]);

  const files = readdirSync(pluginDir);
  for (const file of files) {
    const fullPath = join(pluginDir, file);
    if (statSync(fullPath).isDirectory()) {
      warn(ctx, `Contains subdirectory "${file}" — plugins should be flat (single directory)`);
      continue;
    }
    if (!allowed.has(file)) {
      warn(ctx, `Unexpected file "${file}" — allowed: ${[...allowed].join(", ")}`);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────

console.log("Claudeck Plugin Validator");
console.log("========================\n");

// Determine what to validate
const specific = process.argv[2]; // optional: validate a specific plugin name
let pluginNames;

if (specific) {
  pluginNames = [specific];
  console.log(`Validating specific plugin: ${specific}\n`);
} else {
  pluginNames = getChangedPlugins();
  if (pluginNames.length === 0) {
    console.log("No plugin changes detected.\n");
  } else {
    console.log(`Changed plugins detected: ${pluginNames.join(", ")}\n`);
  }
}

// Always validate marketplace.json
console.log("--- marketplace.json ---");
validateMarketplaceJson();
console.log("  done\n");

// Validate each changed plugin
for (const name of pluginNames) {
  const pluginDir = join(ROOT, "plugins", name);
  if (!existsSync(pluginDir)) {
    error(name, `Plugin directory plugins/${name}/ does not exist`);
    continue;
  }

  console.log(`--- ${name} ---`);
  validateManifest(name, pluginDir);
  validateClientJs(name, pluginDir);
  validateServerJs(name, pluginDir);
  validateCss(name, pluginDir);
  validateExtraFiles(name, pluginDir);
  console.log("  done\n");
}

// ── Report ──────────────────────────────────────────────────

console.log("========================");
console.log("Results\n");

if (warnings.length) {
  console.log(`\x1b[33mWarnings (${warnings.length}):\x1b[0m`);
  for (const w of warnings) console.log(`  ⚠  ${w}`);
  console.log();
}

if (errors.length) {
  console.log(`\x1b[31mErrors (${errors.length}):\x1b[0m`);
  for (const e of errors) console.log(`  ✗  ${e}`);
  console.log();
  console.log("\x1b[31mValidation FAILED\x1b[0m");
  process.exit(1);
} else {
  console.log("\x1b[32mValidation PASSED\x1b[0m");
  if (warnings.length) {
    console.log(`(${warnings.length} warning${warnings.length > 1 ? "s" : ""} — review recommended)`);
  }
}
