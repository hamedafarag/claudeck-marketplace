// Gallery — server-side paginated plugin catalog

const grid = document.getElementById('plugin-grid');
const empty = document.getElementById('plugin-empty');

// ── State ──────────────────────────────────────────────────
let currentFilter = 'all';
let activeKeywords = new Set();
let searchQuery = '';
let sortMode = 'name-asc';
let viewMode = 'grid';
let currentPage = 0;
let hasMore = true;
let isLoading = false;
let allKeywords = {};
const LIMIT = 24;

// ── Init ───────────────────────────────────────────────────

async function init() {
  grid.innerHTML = '<div class="grid-loading"><span class="load-more-spinner"></span><span>Loading plugins...</span></div>';

  initSearch();
  initTypeFilters();
  initSort();
  initViewToggle();
  initClearButton();
  initHamburger();

  await loadPage(true);
  initReveal();
}

// ── Fetch a page from API ──────────────────────────────────

async function loadPage(reset) {
  if (isLoading || (!hasMore && !reset)) return;
  isLoading = true;

  if (reset) {
    currentPage = 0;
    hasMore = true;
    grid.innerHTML = '<div class="grid-loading"><span class="load-more-spinner"></span><span>Loading plugins...</span></div>';
    const oldBtn = document.getElementById('load-more-wrap');
    if (oldBtn) oldBtn.remove();
  }

  currentPage++;

  const params = new URLSearchParams({
    page: currentPage,
    limit: LIMIT,
    sort: sortMode,
  });
  if (currentFilter !== 'all') params.set('type', currentFilter);
  if (searchQuery) params.set('search', searchQuery);
  if (activeKeywords.size > 0) params.set('keywords', [...activeKeywords].join(','));

  try {
    const res = await fetch(`/api/registry?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    hasMore = data.pagination.hasMore;

    // Build keyword chips on first load
    if (Object.keys(allKeywords).length === 0 && data.keywords) {
      allKeywords = data.keywords;
      buildKeywordChips();
    }

    // Clear loading indicator on first page
    if (reset) {
      grid.innerHTML = '';
    }

    // Remove existing load-more
    const oldWrap = document.getElementById('load-more-wrap');
    if (oldWrap) oldWrap.remove();

    // Render cards
    if (data.plugins.length === 0 && currentPage === 1) {
      empty.style.display = '';
      updateEmptyState();
    } else {
      empty.style.display = 'none';
      const fragment = document.createDocumentFragment();
      data.plugins.forEach((plugin, i) => {
        fragment.appendChild(createCard(plugin, i));
      });
      grid.appendChild(fragment);
    }

    // Update status
    updateStatus(data.pagination.total);

    // Show load-more indicator if more pages
    if (hasMore) {
      const remaining = data.pagination.total - (currentPage * LIMIT);
      showLoadMoreIndicator(remaining);
    }

    grid.classList.toggle('view-list', viewMode === 'list');
    initReveal();
  } catch (err) {
    console.error('Failed to load plugins:', err);
    if (currentPage === 1) {
      grid.innerHTML = '';
      empty.style.display = '';
      const title = document.getElementById('empty-title');
      const desc = document.getElementById('empty-desc');
      if (title) title.textContent = 'Failed to load plugins';
      if (desc) desc.textContent = err.message;
    }
  } finally {
    isLoading = false;
  }
}

// ── Apply filters (resets to page 1) ───────────────────────

function applyFilters() {
  loadPage(true);
}

// ── Load more indicator (auto-scroll) ──────────────────────

function showLoadMoreIndicator(remaining) {
  const old = document.getElementById('load-more-wrap');
  if (old) old.remove();

  const wrap = document.createElement('div');
  wrap.id = 'load-more-wrap';
  wrap.className = 'load-more-wrap';
  wrap.innerHTML = `
    <div class="load-more-indicator">
      <span class="load-more-spinner"></span>
      Loading more plugins... (${remaining > 0 ? remaining : ''} remaining)
    </div>
  `;

  grid.parentNode.insertBefore(wrap, grid.nextSibling);

  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !isLoading) {
      observer.disconnect();
      loadPage(false);
    }
  }, { rootMargin: '200px' });

  observer.observe(wrap);
}

// ── Card creation ──────────────────────────────────────────

function createCard(plugin, index) {
  const card = document.createElement('div');
  card.className = 'plugin-card reveal';
  if (index < 8) {
    card.style.transitionDelay = `${index * 0.04}s`;
  }

  const icon = plugin.icon || '&#x1F9E9;';
  const name = plugin.name || formatName(plugin.id);
  const desc = plugin.description || 'A Claudeck plugin';
  const author = plugin.author || 'community';
  const authorGithub = plugin.authorGithub || '';
  const version = plugin.version || '0.0.0';
  const hasServer = plugin.hasServer;
  const isMonorepo = plugin.source?.startsWith('./plugins/');
  const pluginDir = plugin._pluginDir || plugin.id;

  const serverBadge = hasServer
    ? '<span class="card-badge card-badge-server">server</span>'
    : '';

  const keywordTags = (plugin.keywords || []).slice(0, 3)
    .map(kw => `<span class="card-tag">${kw}</span>`)
    .join('');

  const authorLink = authorGithub
    ? `<a href="https://github.com/${authorGithub}" target="_blank" rel="noopener" class="card-author-link">
         <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
         ${author}
       </a>`
    : `<span class="card-author">by ${author}</span>`;

  const previewBtn = isMonorepo
    ? `<button class="card-btn card-btn-preview" data-plugin="${pluginDir}">
         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
         Preview
       </button>`
    : '';

  card.innerHTML = `
    <div class="card-top">
      <div class="card-icon">${icon}</div>
      <div class="card-header">
        <div class="card-name">${name} ${serverBadge}</div>
        <div class="card-meta">
          ${authorLink}
          <span class="card-version">v${version}</span>
        </div>
      </div>
    </div>
    <div class="card-desc">${desc}</div>
    <div class="card-bottom">
      <div class="card-tags">${keywordTags}</div>
      <div class="card-actions">${previewBtn}</div>
    </div>
  `;

  card.dataset.hasServer = hasServer ? 'true' : 'false';

  const previewBtnEl = card.querySelector('.card-btn-preview');
  if (previewBtnEl) {
    previewBtnEl.addEventListener('click', () => openPreview(previewBtnEl.dataset.plugin));
  }

  return card;
}

// ── Search ─────────────────────────────────────────────────

function initSearch() {
  const input = document.getElementById('plugin-search');
  let debounceTimer;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchQuery = input.value.trim().toLowerCase();
      applyFilters();
    }, 300);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== input && !document.querySelector('.preview-overlay')) {
      e.preventDefault();
      input.focus();
    }
    if (e.key === 'Escape' && document.activeElement === input) {
      input.value = '';
      searchQuery = '';
      input.blur();
      applyFilters();
    }
  });
}

// ── Keyword chips ──────────────────────────────────────────

function buildKeywordChips() {
  const sorted = Object.entries(allKeywords)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  if (sorted.length === 0) return;

  const container = document.getElementById('toolbar-filters');
  const divider = document.getElementById('chip-divider');
  divider.style.display = '';

  sorted.forEach(([keyword]) => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.dataset.keyword = keyword;
    chip.textContent = keyword;
    chip.addEventListener('click', () => {
      if (activeKeywords.has(keyword)) {
        activeKeywords.delete(keyword);
        chip.classList.remove('active');
      } else {
        activeKeywords.add(keyword);
        chip.classList.add('active');
      }
      applyFilters();
    });
    container.appendChild(chip);
  });
}

// ── Type filters ───────────────────────────────────────────

function initTypeFilters() {
  document.querySelectorAll('.chip[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.chip[data-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      applyFilters();
    });
  });
}

// ── Sort ───────────────────────────────────────────────────

function initSort() {
  const select = document.getElementById('plugin-sort');
  select.addEventListener('change', () => {
    sortMode = select.value;
    applyFilters();
  });
}

// ── View toggle ────────────────────────────────────────────

function initViewToggle() {
  const toggle = document.getElementById('view-toggle');

  toggle.addEventListener('click', (e) => {
    const btn = e.target.closest('.view-btn');
    if (!btn) return;
    viewMode = btn.dataset.view;
    toggle.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    grid.classList.toggle('view-list', viewMode === 'list');
  });
}

// ── Status & empty states ──────────────────────────────────

function updateStatus(total) {
  const countEl = document.getElementById('result-count');
  const clearBtn = document.getElementById('clear-filters');
  const searchCount = document.getElementById('search-count');

  countEl.textContent = total;

  const hasActiveFilters = currentFilter !== 'all' || activeKeywords.size > 0 || searchQuery;
  clearBtn.style.display = hasActiveFilters ? '' : 'none';

  if (searchQuery) {
    searchCount.textContent = `${total} results`;
  } else {
    searchCount.textContent = '';
  }
}

function updateEmptyState() {
  const title = document.getElementById('empty-title');
  const desc = document.getElementById('empty-desc');

  if (searchQuery) {
    title.textContent = `No results for "${searchQuery}"`;
    desc.innerHTML = 'Try a different search term or <button class="empty-clear" onclick="window.__clearAll()">clear all filters</button>.';
  } else if (currentFilter !== 'all' || activeKeywords.size > 0) {
    title.textContent = 'No plugins match these filters';
    desc.innerHTML = '<button class="empty-clear" onclick="window.__clearAll()">Clear filters</button> to see all plugins.';
  } else {
    title.textContent = 'No plugins available yet';
    desc.innerHTML = 'Be the first to <a href="https://github.com/hamedafarag/claudeck-marketplace/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener">contribute a plugin</a>.';
  }
}

function clearAll() {
  searchQuery = '';
  currentFilter = 'all';
  activeKeywords.clear();

  document.getElementById('plugin-search').value = '';
  document.querySelectorAll('.chip[data-filter]').forEach(c => {
    c.classList.toggle('active', c.dataset.filter === 'all');
  });
  document.querySelectorAll('.chip[data-keyword]').forEach(c => {
    c.classList.remove('active');
  });

  applyFilters();
}
window.__clearAll = clearAll;

function initClearButton() {
  document.getElementById('clear-filters').addEventListener('click', clearAll);
}

// ── Scroll Reveal ──────────────────────────────────────────

function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal:not(.visible)').forEach(el => observer.observe(el));
}

// ── Hamburger Menu ─────────────────────────────────────────

function initHamburger() {
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  if (!hamburger || !navLinks) return;
  hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
}

// ── Preview Panel ──────────────────────────────────────────

function openPreview(pluginName) {
  if (document.querySelector('.preview-overlay')) return;

  const displayName = formatName(pluginName);

  const overlay = document.createElement('div');
  overlay.className = 'preview-overlay';

  const panel = document.createElement('div');
  panel.className = 'preview-panel';
  panel.innerHTML = `
    <div class="preview-header">
      <div class="preview-title">
        <span class="preview-icon">&#x1F9E9;</span>
        ${displayName}
      </div>
      <button class="preview-close" aria-label="Close preview">ESC</button>
    </div>
    <div class="preview-frame-wrap">
      <iframe
        src="/preview?plugin=${encodeURIComponent(pluginName)}"
        class="preview-frame"
        sandbox="allow-scripts allow-same-origin"
        title="Plugin preview: ${displayName}"
      ></iframe>
    </div>
    <div class="preview-footer">
      <span class="preview-hint">sandboxed preview &middot; mock data</span>
      <a href="https://www.npmjs.com/package/claudeck" target="_blank" rel="noopener" class="card-btn card-btn-preview">
        Install Claudeck
      </a>
    </div>
  `;

  const close = () => {
    panel.classList.add('closing');
    overlay.style.animation = 'fadeIn 0.2s ease reverse';
    panel.addEventListener('animationend', () => {
      overlay.remove();
      panel.remove();
    }, { once: true });
    document.removeEventListener('keydown', onKey);
  };

  panel.querySelector('.preview-close').addEventListener('click', close);
  overlay.addEventListener('click', close);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  document.body.appendChild(overlay);
  document.body.appendChild(panel);
}

// ── Helpers ────────────────────────────────────────────────

function formatName(name) {
  return name
    .replace(/-tab$/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ── Init ───────────────────────────────────────────────────
init();
