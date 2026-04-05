// Mock Tab SDK for Claudeck Showcase
// Intercepts registerTab() calls and renders plugin UI in the preview page.

import * as api from './api.js';

// ── Event bus ───────────────────────────────────────────
const bus = {};
function on(event, fn) {
  (bus[event] ||= []).push(fn);
  return () => { bus[event] = (bus[event] || []).filter(f => f !== fn); };
}
function off(event, fn) { bus[event] = (bus[event] || []).filter(f => f !== fn); }
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
function onState(key, fn) {
  (stateListeners[key] ||= []).push(fn);
  return () => { stateListeners[key] = (stateListeners[key] || []).filter(f => f !== fn); };
}

// ── Build ctx (matches real tab-sdk buildCtx) ───────────
function buildCtx(tab) {
  const _unsubs = [];

  return {
    pluginId: tab.id,

    on(event, fn) {
      const unsub = on(event, fn);
      _unsubs.push(unsub);
      return unsub;
    },
    off,
    emit,

    getState,
    onState(key, fn) {
      const unsub = onState(key, fn);
      _unsubs.push(unsub);
      return unsub;
    },

    api,

    getProjectPath: () => '/demo/claudeck-project',
    getSessionId: () => 'showcase-session-001',
    getTheme: () => document.documentElement.getAttribute('data-theme') || 'dark',

    storage: {
      get(key) {
        try { return JSON.parse(localStorage.getItem(`claudeck-plugin-${tab.id}-${key}`)); }
        catch { return null; }
      },
      set(key, value) {
        localStorage.setItem(`claudeck-plugin-${tab.id}-${key}`, JSON.stringify(value));
      },
      remove(key) {
        localStorage.removeItem(`claudeck-plugin-${tab.id}-${key}`);
      },
    },

    toast(message, opts = {}) {
      const { duration = 3000, type = 'info' } = opts;
      const el = document.createElement('div');
      el.textContent = message;
      el.style.cssText = `
        position:fixed;bottom:24px;right:24px;z-index:99999;
        padding:10px 20px;border-radius:8px;font-size:13px;
        font-family:var(--font-sans,sans-serif);color:#fff;
        animation:claudeck-toast-in .3s ease;
        background:${type === 'error' ? '#e54' : type === 'success' ? '#33d17a' : '#333'};
        border:1px solid ${type === 'error' ? '#e54' : type === 'success' ? '#33d17a' : '#444'};
        box-shadow:0 4px 12px rgba(0,0,0,.3);
      `;
      document.body.appendChild(el);
      setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, duration - 300);
      setTimeout(() => el.remove(), duration);
    },

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

    dispose() {
      _unsubs.forEach(fn => fn());
      _unsubs.length = 0;
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
