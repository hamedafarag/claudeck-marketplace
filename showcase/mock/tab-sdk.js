// Mock Tab SDK for Claudeck Showcase
// Intercepts registerTab() calls and renders plugin UI in the preview page.

import * as api from './api.js';

// ── Event bus ───────────────────────────────────────────
const bus = {};
function on(event, fn) { (bus[event] ||= []).push(fn); }
function emit(event, data) { (bus[event] || []).forEach(fn => { try { fn(data); } catch(e) { console.warn('[showcase] event handler error:', e); } }); }

// ── State store ─────────────────────────────────────────
const state = {
  view: 'home',
  sessionId: 'showcase-session-001',
  ws: null,
  parallelMode: false,
  streamingCharCount: 0,
  prompts: [],
  workflows: [],
  agents: [],
  projectsData: [{ name: 'Demo Project', path: '/demo/claudeck-project' }],
  attachedFiles: [],
  imageAttachments: [],
  allProjectFiles: [],
  backgroundSessions: new Map(),
  notificationsEnabled: false,
  sessionTokens: { input: 1250, output: 3400, cacheRead: 800, cacheCreation: 200 },
};
const stateListeners = {};
function getState(key) { return state[key]; }
function onState(key, fn) { (stateListeners[key] ||= []).push(fn); }

// ── Build ctx (matches real tab-sdk buildCtx) ───────────
function buildCtx(tab) {
  return {
    on,
    emit,
    getState,
    onState,
    api,
    getProjectPath: () => '/demo/claudeck-project',
    getSessionId: () => 'showcase-session-001',
    showBadge(count) {
      const badge = document.getElementById('showcase-badge');
      if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? '' : 'none';
      }
    },
    clearBadge() {
      const badge = document.getElementById('showcase-badge');
      if (badge) badge.style.display = 'none';
    },
    setTitle(text) {
      const title = document.getElementById('showcase-title');
      if (title) title.textContent = text;
    },
  };
}

// ── registerTab ─────────────────────────────────────────
export function registerTab(config) {
  if (!config.id || !config.init) {
    console.error('[showcase] registerTab requires id and init');
    return;
  }

  console.log(`[showcase] Plugin registered: ${config.id}`);

  // Notify the preview page
  if (window.__showcaseOnRegister) {
    window.__showcaseOnRegister(config, buildCtx(config));
  }
}

// Stubs for other Tab SDK exports plugins might reference
export function unregisterTab() {}
export function getRegisteredTabs() { return []; }
export function initTabSDK() {}
