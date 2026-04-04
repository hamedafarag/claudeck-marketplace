// Home — fetches plugins and renders a featured preview grid (max 6)

const FEATURED_MAX = 6;

async function init() {
  let plugins = [];

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
    } catch (fallbackErr) {
      console.error('Failed to load plugins:', fallbackErr);
    }
  }

  // Enrich monorepo plugins
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
          p.keywords = p.keywords || manifest.keywords || [];
        }
      } catch {}
    }
  }));

  // Update counters
  const heroCount = document.getElementById('hero-count');
  const statCount = document.getElementById('stat-count');
  if (heroCount) heroCount.textContent = plugins.length;
  if (statCount) statCount.textContent = plugins.length;

  // Render featured grid (max 6)
  const grid = document.getElementById('featured-grid');
  if (!grid) return;

  const featured = plugins.slice(0, FEATURED_MAX);
  featured.forEach((plugin, i) => {
    const card = document.createElement('div');
    card.className = 'plugin-card reveal';
    card.style.transitionDelay = `${i * 0.06}s`;

    const icon = plugin.icon || '&#x1F9E9;';
    const name = plugin.name || plugin.id;
    const desc = plugin.description || 'A Claudeck plugin';
    const author = plugin.author || 'community';
    const version = plugin.version || '0.0.0';
    const hasServer = plugin.hasServer;

    const serverBadge = hasServer
      ? '<span class="card-badge card-badge-server">server</span>'
      : '';

    const keywordTags = (plugin.keywords || []).slice(0, 3)
      .map(kw => `<span class="card-tag">${kw}</span>`)
      .join('');

    card.innerHTML = `
      <div class="card-icon">${icon}</div>
      <div class="card-body">
        <div class="card-name">${name} ${serverBadge}</div>
        <div class="card-desc">${desc}</div>
        <div class="card-tags">${keywordTags}</div>
        <div class="card-meta">
          <span class="card-author">by ${author}</span>
          <span class="card-version">v${version}</span>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });

  // Update "Browse All" button text with count
  const browseBtn = document.querySelector('.browse-all-btn');
  if (browseBtn && plugins.length > FEATURED_MAX) {
    browseBtn.innerHTML = `
      Browse All Plugins (${plugins.length})
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
    `;
  }

  initReveal();
  initHamburger();
}

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

function initHamburger() {
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  if (!hamburger || !navLinks) return;
  hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
}

init();
