// Gallery — fetches plugin registry and renders cards + preview modals

const grid = document.getElementById('plugin-grid');
const empty = document.getElementById('plugin-empty');
const heroCount = document.getElementById('hero-count');
const statCount = document.getElementById('stat-count');

let plugins = [];

// ── Fetch & Render ──────────────────────────────────────

async function init() {
  try {
    const res = await fetch('/api/registry');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const registry = await res.json();
    plugins = registry.plugins || [];
  } catch (err) {
    console.warn('Failed to fetch registry, trying local fallback:', err);
    try {
      const res = await fetch('/marketplace.json');
      if (res.ok) {
        const registry = await res.json();
        plugins = registry.plugins || [];
      }
    } catch {}
  }

  // Enrich monorepo plugins with manifest data
  await Promise.all(plugins.map(async (p) => {
    if (p.source?.startsWith('./plugins/')) {
      const name = p.source.replace('./plugins/', '');
      try {
        const res = await fetch(`/plugins/${name}/manifest.json`);
        if (res.ok) {
          const manifest = await res.json();
          p.name = p.name || manifest.name;
          p.description = p.description || manifest.description;
          p.author = p.author || manifest.author;
          p.icon = p.icon || manifest.icon;
          p.hasServer = manifest.hasServer || false;
          p.keywords = manifest.keywords || [];
          p._pluginDir = name;
        }
      } catch {}
    }
  }));

  heroCount.textContent = plugins.length;
  if (statCount) statCount.textContent = plugins.length;
  renderGrid(plugins);
  initFilters();
  initReveal();
  initHamburger();
}

function renderGrid(list) {
  grid.innerHTML = '';
  empty.style.display = list.length ? 'none' : '';

  list.forEach((plugin, i) => {
    const card = document.createElement('div');
    card.className = 'plugin-card reveal';
    card.style.transitionDelay = `${i * 0.06}s`;

    const icon = plugin.icon || '&#x1F9E9;';
    const name = plugin.name || formatName(plugin.id);
    const desc = plugin.description || 'A Claudeck plugin';
    const author = plugin.author || 'community';
    const version = plugin.version || '0.0.0';
    const hasServer = plugin.hasServer;
    const isMonorepo = plugin.source?.startsWith('./plugins/');
    const pluginDir = plugin._pluginDir || plugin.id;

    const serverBadge = hasServer
      ? '<span class="card-badge card-badge-server">server</span>'
      : '';

    const previewBtn = isMonorepo
      ? `<button class="card-btn card-btn-preview" data-plugin="${pluginDir}">
           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
           Preview
         </button>`
      : `<a href="https://github.com/${plugin.repo}" target="_blank" rel="noopener" class="card-btn card-btn-github">
           View on GitHub
         </a>`;

    card.innerHTML = `
      <div class="card-icon">${icon}</div>
      <div class="card-body">
        <div class="card-name">${name} ${serverBadge}</div>
        <div class="card-desc">${desc}</div>
        <div class="card-meta">
          <span class="card-author">by ${author}</span>
          <span class="card-version">v${version}</span>
        </div>
      </div>
      <div class="card-actions">
        ${previewBtn}
      </div>
    `;

    card.dataset.hasServer = hasServer ? 'true' : 'false';
    grid.appendChild(card);
  });

  // Attach preview handlers
  grid.querySelectorAll('.card-btn-preview').forEach(btn => {
    btn.addEventListener('click', () => openPreview(btn.dataset.plugin));
  });

  // Re-observe new cards for reveal
  initReveal();
}

// ── Filters ─────────────────────────────────────────────

function initFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      if (filter === 'all') {
        renderGrid(plugins);
      } else if (filter === 'server') {
        renderGrid(plugins.filter(p => p.hasServer));
      } else {
        renderGrid(plugins.filter(p => !p.hasServer));
      }
    });
  });
}

// ── Scroll Reveal ───────────────────────────────────────

function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal:not(.visible)').forEach(el => {
    observer.observe(el);
  });
}

// ── Hamburger Menu ──────────────────────────────────────

function initHamburger() {
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  if (!hamburger || !navLinks) return;

  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });
}

// ── Preview Modal ───────────────────────────────────────

function openPreview(pluginName) {
  if (document.querySelector('.preview-overlay')) return;

  const plugin = plugins.find(p => (p._pluginDir || p.id) === pluginName);
  const displayName = plugin?.name || formatName(pluginName);

  const overlay = document.createElement('div');
  overlay.className = 'preview-overlay';

  overlay.innerHTML = `
    <div class="preview-modal">
      <div class="preview-header">
        <div class="preview-title">
          <span class="preview-icon">${plugin?.icon || '&#x1F9E9;'}</span>
          ${displayName}
        </div>
        <button class="preview-close" aria-label="Close preview">&times;</button>
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
        <span class="preview-hint">This is a sandboxed preview with mock data</span>
        <a href="https://www.npmjs.com/package/claudeck" target="_blank" rel="noopener" class="card-btn card-btn-preview">
          Install Claudeck
        </a>
      </div>
    </div>
  `;

  // Close handlers
  const close = () => overlay.remove();
  overlay.querySelector('.preview-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);

  document.body.appendChild(overlay);
}

// ── Helpers ─────────────────────────────────────────────

function formatName(name) {
  return name
    .replace(/-tab$/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ── Init ────────────────────────────────────────────────
init();
