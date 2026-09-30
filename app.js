/**
 * RefKey // AI Directory - Main Application
 */

import { CONFIG, MODEL_LOGOS, getModelInfo } from './config.js';
import { GistService } from './gist-service.js';
import { AdminController } from './admin.js';

class App {
  constructor() {
    this.links = [];
    this.categories = [];
    this.currentCategory = 'all';
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.modelFilter = 'all';
    this.sortBy = 'default';
    this.lastUpdated = null;
    this.isLoading = true;
    this.viewMode = localStorage.getItem('refkey_view_mode') || 'grid';

    this.admin = new AdminController(this);
    this.init();
  }

  async init() {
    this.initTheme();
    this.bindEvents();
    await this.loadData();
    this.setupAutoRefresh();
  }

  /* ==========================================================================
     Theme Management (Tokyo Night, Obsidian, Matrix, Nord, Light)
     ========================================================================== */
  initTheme() {
    const savedTheme = localStorage.getItem(CONFIG.STORAGE_KEYS.THEME) || 'tokyo-night';
    this.setTheme(savedTheme);

    // Theme Selector Dropdown
    const themeSelector = document.getElementById('theme-selector');
    if (themeSelector) {
      themeSelector.value = savedTheme;
      themeSelector.addEventListener('change', (e) => {
        this.setTheme(e.target.value);
      });
    }

    // Quick Dark/Light Toggle Icon Button
    const themeToggleBtn = document.getElementById('btn-theme-toggle');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'tokyo-night';
        const newTheme = currentTheme === 'light' ? 'tokyo-night' : 'light';
        this.setTheme(newTheme);
      });
    }
  }

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(CONFIG.STORAGE_KEYS.THEME, theme);

    // Sync dropdown if exists
    const themeSelector = document.getElementById('theme-selector');
    if (themeSelector && themeSelector.value !== theme) {
      themeSelector.value = theme;
    }

    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
      if (theme === 'light') {
        // Sun icon for light mode
        themeIcon.innerHTML = `
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        `;
      } else {
        // Moon icon for dark themes
        themeIcon.innerHTML = '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"></path>';
      }
    }
  }

  /* ==========================================================================
     Event Handlers & Shortcuts
     ========================================================================== */
  bindEvents() {
    // Search input
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('clear-search-btn');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        if (clearBtn) {
          clearBtn.classList.toggle('visible', this.searchQuery.length > 0);
        }
        this.render();
      });

      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          searchInput.value = '';
          this.searchQuery = '';
          clearBtn.classList.remove('visible');
          searchInput.focus();
          this.render();
        });
      }
    }

    // Status filter select
    const statusSelect = document.getElementById('status-filter-select');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        this.statusFilter = e.target.value;
        this.render();
      });
    }

    // Manual Refresh button
    const refreshBtn = document.getElementById('btn-refresh-data');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.classList.add('spinning');
        await this.loadData();
        setTimeout(() => refreshBtn.classList.remove('spinning'), 600);
        this.showToast('Data refreshed', 'info');
      });
    }

    // Layout view mode buttons
    document.querySelectorAll('#view-mode-toggle .btn-view').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        this.setViewMode(view);
      });
    });

    // Global keyboard shortcut: "/" to focus search
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== searchInput && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        if (searchInput) searchInput.focus();
      }
    });
  }

  setViewMode(mode) {
    this.viewMode = mode;
    localStorage.setItem('refkey_view_mode', mode);
    document.querySelectorAll('#view-mode-toggle .btn-view').forEach(btn => {
      btn.classList.toggle('is-active', btn.getAttribute('data-view') === mode);
    });
    this.render();
  }

  setupAutoRefresh() {
    // Refresh when user navigates back to tab
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !this.admin.isAdminMode) {
        this.loadData(true); // silent refresh
      }
    });

    // Background interval refresh every 2 minutes
    setInterval(() => {
      if (document.visibilityState === 'visible' && !this.admin.isAdminMode) {
        this.loadData(true);
      }
    }, 120000);
  }

  /* ==========================================================================
     Data Loading & Normalization
     ========================================================================== */
  async loadData(silent = false) {
    if (!silent) {
      this.isLoading = true;
      this.render();
    }

    const gistId = localStorage.getItem(CONFIG.STORAGE_KEYS.GIST_ID) || CONFIG.DEFAULT_GIST_ID || '';

    let loadedItems = null;

    // 1. Try loading from GitHub Gist if configured
    if (gistId) {
      try {
        const gistData = await GistService.fetchGist(gistId);
        if (Array.isArray(gistData.links)) {
          loadedItems = gistData.links;
          if (gistData.updatedAt) this.lastUpdated = new Date(gistData.updatedAt);
        }
      } catch (err) {
        console.warn('Could not load from Gist, falling back to cache:', err.message);
        if (!silent) {
          this.showToast(`Gist sync failed: ${err.message}`, 'error');
        }
      }
    }

    // 2. If Gist failed or wasn't configured, check local storage
    if (!loadedItems) {
      const cached = localStorage.getItem(CONFIG.STORAGE_KEYS.LOCAL_LINKS);
      if (cached) {
        try {
          loadedItems = JSON.parse(cached);
        } catch (e) {
          console.warn('LocalStorage parse error:', e);
        }
      }
    }

    // 3. Fallback to sample-links.json
    if (!loadedItems || loadedItems.length === 0) {
      try {
        const res = await fetch('./sample-links.json');
        if (res.ok) {
          loadedItems = await res.json();
        }
      } catch (e) {
        console.warn('Failed to load sample-links.json:', e);
      }
    }

    this.links = (loadedItems || []).map(item => this.normalizeItem(item));
    this.isLoading = false;
    this.updateCategories();
    this.updateHeaderStats();
    this.render();
  }

  normalizeItem(item) {
    // Collect URLs and link labels
    const rawUrls = Array.isArray(item.urls) && item.urls.length > 0
      ? item.urls
      : (item.url ? [item.url] : []);

    const formattedUrls = rawUrls.map((u, idx) => {
      if (typeof u === 'object' && u !== null && u.url) {
        return { label: u.label || `Link ${idx + 1}`, url: u.url };
      }
      const label = item.linkLabels?.[idx] || (idx === 0 ? 'Referral Link' : `Mirror ${idx + 1}`);
      return { label, url: String(u) };
    });

    const primaryUrl = formattedUrls[0]?.url || item.url || '#';

    // Normalize or auto-detect supported AI models
    let models = [];
    if (Array.isArray(item.models) && item.models.length > 0) {
      models = item.models.map(m => String(m).trim()).filter(Boolean);
    } else if (typeof item.models === 'string' && item.models.trim()) {
      models = item.models.split(',').map(m => m.trim()).filter(Boolean);
    } else {
      // Smart Auto-detection from notes, name, or badge for existing links
      const textToScan = `${item.name || ''} ${item.notes || ''} ${item.badge || ''} ${item.bonus || ''}`.toLowerCase();
      if (textToScan.includes('claude') || textToScan.includes('sonnet') || textToScan.includes('opus')) {
        models.push('Claude 3.5');
      }
      if (textToScan.includes('gpt') || textToScan.includes('openai') || textToScan.includes('o1') || textToScan.includes('o3') || textToScan.includes('chatgpt')) {
        models.push('GPT-4o');
      }
      if (textToScan.includes('deepseek') || textToScan.includes('r1') || textToScan.includes('v3')) {
        models.push('DeepSeek');
      }
      if (textToScan.includes('glm') || textToScan.includes('zhipu') || textToScan.includes('chatglm')) {
        models.push('GLM-4');
      }
      if (models.length === 0 && (item.category === 'AI Routers' || item.category === 'Top Sites')) {
        models = ['Claude 3.5', 'GPT-4o'];
      }
    }

    return {
      id: item.id || `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: item.name || 'Untitled Provider',
      category: (item.category && item.category.trim()) ? item.category.trim() : 'Top Sites',
      badge: item.badge || '',
      bonus: item.bonus || '',
      models: Array.from(new Set(models)),
      notes: item.notes || '',
      url: primaryUrl,
      urls: formattedUrls,
      status: (item.status || 'active').toLowerCase(),
      recommended: item.recommended !== undefined
        ? Boolean(item.recommended)
        : Boolean(item.isRecommended || (item.badge && (item.badge.includes('$150') || item.badge.includes('Free Models')))),
      verified: item.verified !== undefined
        ? Boolean(item.verified)
        : (item.status === 'active'),
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString()
    };
  }

  updateCategories() {
    const knownKeys = new Set();
    const categories = [];

    // Add preset categories first if present
    CONFIG.DEFAULT_CATEGORIES.forEach(c => {
      knownKeys.add(c.key);
      categories.push({ key: c.key, label: c.label });
    });

    // Add any unique dynamic categories from items
    this.links.forEach(item => {
      if (!knownKeys.has(item.category)) {
        knownKeys.add(item.category);
        categories.push({ key: item.category, label: item.category });
      }
    });

    this.categories = categories;
  }

  updateHeaderStats() {
    const totalCountEl = document.getElementById('stat-total-count');
    const activeCountEl = document.getElementById('stat-active-count');
    const lastUpdatedEl = document.getElementById('stat-last-updated');

    const total = this.links.length;
    const active = this.links.filter(l => l.status === 'active').length;

    if (totalCountEl) totalCountEl.textContent = total;
    if (activeCountEl) activeCountEl.textContent = active;

    if (lastUpdatedEl) {
      if (this.lastUpdated) {
        const timeStr = this.lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = this.lastUpdated.toLocaleDateString([], { month: 'short', day: 'numeric' });
        lastUpdatedEl.textContent = `Updated ${dateStr} ${timeStr}`;
      } else {
        lastUpdatedEl.textContent = 'Live';
      }
    }

    const footerUpdated = document.getElementById('footer-last-updated');
    if (footerUpdated) {
      footerUpdated.textContent = this.lastUpdated
        ? `Last updated: ${this.lastUpdated.toLocaleDateString()} ${this.lastUpdated.toLocaleTimeString()}`
        : 'Last updated: Real-time';
    }
  }

  /* ==========================================================================
     Filtering & Sorting
     ========================================================================== */
  getFilteredLinks() {
    return this.links.filter(item => {
      // 1. Category filter
      if (this.currentCategory !== 'all' && item.category !== this.currentCategory) {
        return false;
      }

      // 2. Status filter
      if (this.statusFilter === 'recommended') {
        if (!item.recommended) return false;
      } else if (this.statusFilter === 'verified') {
        if (!item.verified) return false;
      } else if (this.statusFilter !== 'all' && item.status !== this.statusFilter) {
        return false;
      }

      // 3. AI Model filter
      if (this.modelFilter && this.modelFilter !== 'all') {
        const itemModels = Array.isArray(item.models) ? item.models : [];
        const hasMatchingModel = itemModels.some(m => {
          const info = getModelInfo(m);
          return info.brand === this.modelFilter || m.toLowerCase().includes(this.modelFilter.toLowerCase());
        });
        if (!hasMatchingModel) {
          return false;
        }
      }

      // 4. Search query (matches name, category, bonus, notes, and supported models)
      if (this.searchQuery) {
        const searchable = [
          item.name,
          item.category,
          item.badge,
          item.bonus,
          ...(item.models || []),
          item.notes,
          item.url,
          ...item.urls.map(u => u.url + ' ' + u.label)
        ].join(' ').toLowerCase();

        if (!searchable.includes(this.searchQuery)) {
          return false;
        }
      }

      return true;
    });
  }

  /* ==========================================================================
     DOM Rendering
     ========================================================================== */
  render() {
    this.renderCategoryPills();
    this.renderModelsFilterBar();
    this.renderLinksList();
  }

  renderModelsFilterBar() {
    const container = document.getElementById('models-filter-bar');
    if (!container) return;

    const html = `
      <span class="models-filter-label">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3"></path>
        </svg>
        Models:
      </span>
      ${CONFIG.POPULAR_MODELS.map(m => {
        const isActive = this.modelFilter === m.key;
        const logoSvg = m.key === 'all'
          ? `<svg class="model-logo-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="4 12 9 17 20 6"></polyline></svg>`
          : (MODEL_LOGOS[m.brand] || MODEL_LOGOS.default);
        return `
          <button type="button" class="btn-model-filter ${isActive ? 'is-active' : ''}" data-model="${this.escapeHtml(m.key)}" title="Filter by ${this.escapeHtml(m.label)}">
            ${logoSvg}
            <span>${this.escapeHtml(m.label)}</span>
          </button>
        `;
      }).join('')}
    `;

    container.innerHTML = html;

    // Attach click events on model buttons
    container.querySelectorAll('.btn-model-filter').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const model = btn.getAttribute('data-model');
        this.modelFilter = (this.modelFilter === model && model !== 'all') ? 'all' : model;
        this.render();
      });
    });
  }

  renderModelTags(models, isCompact = false) {
    if (!models || !models.length) return '';
    return models.map(modelName => {
      const info = getModelInfo(modelName);
      return `
        <span class="tag-model tag-model-${info.brand} ${isCompact ? 'tag-model-compact' : ''}" 
              data-model-filter="${info.brand}" 
              title="Click to filter by ${this.escapeHtml(info.label)}">
          ${info.svg}
          <span>${this.escapeHtml(info.label)}</span>
        </span>
      `;
    }).join('');
  }

  renderCategoryPills() {
    const nav = document.getElementById('categories-nav');
    if (!nav) return;

    // Calculate item counts per category
    const counts = { all: this.links.length };
    this.links.forEach(l => {
      counts[l.category] = (counts[l.category] || 0) + 1;
    });

    const pills = [];

    // "All" pill
    const isAllActive = this.currentCategory === 'all';
    pills.push(`
      <button class="cat-btn ${isAllActive ? 'is-active' : ''}" data-cat="all">
        All
        <span class="count">${counts.all || 0}</span>
      </button>
    `);

    // Individual categories
    this.categories.forEach(cat => {
      const count = counts[cat.key] || 0;
      if (count > 0 || this.admin.isAdminMode) {
        const isActive = this.currentCategory === cat.key;
        pills.push(`
          <button class="cat-btn ${isActive ? 'is-active' : ''}" data-cat="${this.escapeHtml(cat.key)}">
            ${this.escapeHtml(cat.label)}
            <span class="count">${count}</span>
          </button>
        `);
      }
    });

    nav.innerHTML = pills.join('');

    // Bind click events on category buttons
    nav.querySelectorAll('.cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentCategory = btn.getAttribute('data-cat');
        this.render();
      });
    });
  }

  renderLinksList() {
    const container = document.getElementById('main-content-area');
    if (!container) return;

    if (this.isLoading) {
      container.innerHTML = `
        <div class="state-message-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinning"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>
          <div class="state-title">Loading referral links…</div>
          <div class="state-desc">Fetching real-time API directories and bonuses.</div>
        </div>
      `;
      return;
    }

    const filtered = this.getFilteredLinks();

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="state-message-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <div class="state-title">No matching referral links found</div>
          <div class="state-desc">Try clearing your search term, selecting "All Categories", or switching status filters.</div>
          ${this.admin.isAdminMode ? `
            <button class="btn btn-primary" id="btn-empty-add-link">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Add First Link
            </button>
          ` : ''}
        </div>
      `;
      const emptyAddBtn = document.getElementById('btn-empty-add-link');
      if (emptyAddBtn) {
        emptyAddBtn.addEventListener('click', () => this.admin.openLinkModal(null));
      }
      return;
    }

    // Render items according to current view mode (Grid, Table, Compact)
    if (this.currentCategory === 'all' && !this.searchQuery) {
      const activeCats = this.categories.filter(c => filtered.some(item => item.category === c.key));
      let html = '';

      activeCats.forEach(cat => {
        const catItems = filtered.filter(item => item.category === cat.key);
        if (catItems.length === 0) return;

        html += `
          <section class="directory-section">
            <div class="section-header">
              <h2 class="section-heading">${this.escapeHtml(cat.label)}</h2>
              <span class="section-count">${catItems.length} available</span>
            </div>
            ${this.renderItemsContainer(catItems)}
          </section>
        `;
      });

      // Catch any items that belong to categories not in activeCats
      const categorizedIds = new Set(activeCats.flatMap(c => filtered.filter(i => i.category === c.key).map(i => i.id)));
      const uncategorized = filtered.filter(i => !categorizedIds.has(i.id));

      if (uncategorized.length > 0) {
        html += `
          <section class="directory-section">
            <div class="section-header">
              <h2 class="section-heading">More AI Links</h2>
              <span class="section-count">${uncategorized.length} available</span>
            </div>
            ${this.renderItemsContainer(uncategorized)}
          </section>
        `;
      }

      container.innerHTML = html;
    } else {
      // Flat view for specific category or search results
      container.innerHTML = `
        <section class="directory-section">
          <div class="section-header">
            <h2 class="section-heading">
              ${this.searchQuery ? `Search Results for "${this.escapeHtml(this.searchQuery)}"` : this.escapeHtml(this.currentCategory)}
            </h2>
            <span class="section-count">${filtered.length} found</span>
          </div>
          ${this.renderItemsContainer(filtered)}
        </section>
      `;
    }

    // Attach card event listeners (Copy link, Notes toggle, Admin inline actions)
    this.attachCardEventListeners(container);
  }

  renderItemsContainer(items) {
    if (this.viewMode === 'table') {
      return this.renderTable(items);
    } else if (this.viewMode === 'compact') {
      return this.renderCompact(items);
    } else {
      return `<div class="providers-grid">${items.map(item => this.renderCard(item)).join('')}</div>`;
    }
  }

  renderTable(items) {
    return `
      <div class="table-responsive-wrapper">
        <table class="directory-table">
          <thead>
            <tr>
              <th style="width: 110px; min-width: 110px;">Status</th>
              <th style="width: 200px; min-width: 170px;">Provider</th>
              <th style="width: 180px; min-width: 160px;">Models</th>
              <th style="width: 120px; min-width: 100px;">Category</th>
              <th style="width: 240px; min-width: 180px;">Bonus / Reward</th>
              <th style="min-width: 240px;">Notes</th>
              <th style="width: 160px; min-width: 150px; text-align: right;">Links</th>
              ${this.admin.isAdminMode ? '<th style="width: 180px; min-width: 180px; text-align: right;">Admin</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${items.map(item => this.renderTableRow(item)).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderTableRow(item) {
    const statusDef = CONFIG.STATUS_MAP[item.status] || {
      label: item.status,
      badgeCls: 'status-fake',
      dotCls: 'dot-fake'
    };

    return `
      <tr data-id="${this.escapeHtml(item.id)}" class="${item.recommended ? 'table-row-recommended' : ''}">
        <td style="width: 110px;">
          <span class="status-pill ${statusDef.badgeCls}">
            <span class="status-dot ${statusDef.dotCls}"></span>
            ${this.escapeHtml(statusDef.label)}
          </span>
        </td>
        <td>
          <div class="table-provider-cell">
            <span class="table-provider-name">${this.escapeHtml(item.name)}</span>
            ${item.recommended ? '<span class="badge-recommended" style="font-size:0.6rem; padding:0.12rem 0.35rem;">★ Rec</span>' : ''}
            ${item.verified ? '<span class="badge-verified" style="font-size:0.6rem; padding:0.12rem 0.35rem;">✓ Ver</span>' : ''}
            ${item.badge ? `<span class="badge-reward" style="font-size:0.65rem;">⚡ ${this.escapeHtml(item.badge)}</span>` : ''}
          </div>
        </td>
        <td>
          <div class="table-models-cell">
            ${this.renderModelTags(item.models)}
          </div>
        </td>
        <td class="table-category-cell">
          ${this.escapeHtml(item.category)}
        </td>
        <td class="table-bonus-cell">
          ${item.bonus ? `<span class="bonus-credit-tag" style="margin-right:0.35rem;">🎁 Credits</span><strong>${this.escapeHtml(item.bonus)}</strong>` : '—'}
        </td>
        <td class="table-notes-cell" title="${this.escapeHtml(item.notes || '')}">
          ${this.escapeHtml(item.notes || '—')}
        </td>
        <td style="text-align: right;">
          <div class="table-actions-cell" style="justify-content: flex-end;">
            <button type="button" class="btn-secondary-action btn-copy-link" data-url="${this.escapeHtml(item.url)}" title="Copy link">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              <span>Copy</span>
            </button>
            <a href="${this.escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="btn-primary-action btn-sm">
              <span>Open</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </a>
          </div>
        </td>
        ${this.admin.isAdminMode ? `
          <td style="text-align: right;">
            <div style="display:flex; align-items:center; gap:0.3rem; justify-content: flex-end;">
              <select class="card-admin-status-select" data-id="${this.escapeHtml(item.id)}" title="Status">
                <option value="active" ${item.status === 'active' ? 'selected' : ''}>Active</option>
                <option value="down" ${item.status === 'down' ? 'selected' : ''}>Down</option>
                <option value="unconfirmed" ${item.status === 'unconfirmed' ? 'selected' : ''}>Unconfirmed</option>
                <option value="dead" ${item.status === 'dead' ? 'selected' : ''}>Dead</option>
                <option value="fake" ${item.status === 'fake' ? 'selected' : ''}>Fake</option>
              </select>
              <button type="button" class="btn-card-admin btn-admin-toggle-rec" data-id="${this.escapeHtml(item.id)}" title="Toggle Recommended">${item.recommended ? '★ Rec' : '☆ Rec'}</button>
              <button type="button" class="btn-card-admin btn-admin-toggle-ver" data-id="${this.escapeHtml(item.id)}" title="Toggle Verified">${item.verified ? '✓ Ver' : '○ Ver'}</button>
              <button type="button" class="btn-card-admin btn-admin-edit" data-id="${this.escapeHtml(item.id)}">Edit</button>
              <button type="button" class="btn-card-admin delete btn-admin-delete" data-id="${this.escapeHtml(item.id)}">✕</button>
            </div>
          </td>
        ` : ''}
      </tr>
    `;
  }

  renderCompact(items) {
    return `
      <div class="compact-list">
        ${items.map(item => this.renderCompactItem(item)).join('')}
      </div>
    `;
  }

  renderCompactItem(item) {
    const statusDef = CONFIG.STATUS_MAP[item.status] || {
      label: item.status,
      badgeCls: 'status-fake',
      dotCls: 'dot-fake'
    };

    return `
      <div class="compact-item ${item.recommended ? 'is-recommended' : ''}" data-id="${this.escapeHtml(item.id)}" data-status="${this.escapeHtml(item.status)}">
        <div class="compact-left">
          <span class="status-pill ${statusDef.badgeCls}" style="padding: 0.15rem 0.45rem;">
            <span class="status-dot ${statusDef.dotCls}"></span>
            ${this.escapeHtml(statusDef.label)}
          </span>
          <span class="compact-title">${this.escapeHtml(item.name)}</span>
          ${item.recommended ? '<span class="badge-recommended" style="font-size:0.6rem; padding:0.1rem 0.35rem;">★ Rec</span>' : ''}
          ${item.verified ? '<span class="badge-verified" style="font-size:0.6rem; padding:0.1rem 0.35rem;">✓</span>' : ''}
          ${item.badge ? `<span class="badge-reward" style="font-size:0.65rem;">⚡ ${this.escapeHtml(item.badge)}</span>` : ''}
          ${item.models && item.models.length > 0 ? `
            <span class="compact-models">
              ${this.renderModelTags(item.models, true)}
            </span>
          ` : ''}
          <span class="table-category-cell">• ${this.escapeHtml(item.category)}</span>
          ${item.bonus ? `<span class="compact-bonus"><span class="bonus-credit-tag" style="font-size:0.58rem; padding:0.05rem 0.3rem;">🎁 Credits</span> ${this.escapeHtml(item.bonus)}</span>` : ''}
        </div>
        <div class="compact-actions">
          <button type="button" class="btn-secondary-action btn-copy-link" data-url="${this.escapeHtml(item.url)}" title="Copy link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span>Copy</span>
          </button>
          <a href="${this.escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="btn-primary-action btn-sm">
            <span>Open</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </a>
          ${this.admin.isAdminMode ? `
            <select class="card-admin-status-select" data-id="${this.escapeHtml(item.id)}" title="Status">
              <option value="active" ${item.status === 'active' ? 'selected' : ''}>Active</option>
              <option value="down" ${item.status === 'down' ? 'selected' : ''}>Down</option>
              <option value="unconfirmed" ${item.status === 'unconfirmed' ? 'selected' : ''}>Unconfirmed</option>
              <option value="dead" ${item.status === 'dead' ? 'selected' : ''}>Dead</option>
            </select>
            <button type="button" class="btn-card-admin btn-admin-toggle-rec" data-id="${this.escapeHtml(item.id)}" title="Toggle Recommended">${item.recommended ? '★' : '☆'}</button>
            <button type="button" class="btn-card-admin btn-admin-toggle-ver" data-id="${this.escapeHtml(item.id)}" title="Toggle Verified">${item.verified ? '✓' : '○'}</button>
            <button type="button" class="btn-card-admin btn-admin-edit" data-id="${this.escapeHtml(item.id)}">Edit</button>
            <button type="button" class="btn-card-admin delete btn-admin-delete" data-id="${this.escapeHtml(item.id)}">✕</button>
          ` : ''}
        </div>
      </div>
    `;
  }

  renderCard(item) {
    const statusDef = CONFIG.STATUS_MAP[item.status] || {
      label: item.status,
      badgeCls: 'status-fake',
      dotCls: 'dot-fake'
    };

    const hasMultipleUrls = item.urls && item.urls.length > 1;

    return `
      <article class="card-provider ${item.recommended ? 'is-recommended' : ''}" data-id="${this.escapeHtml(item.id)}" data-status="${this.escapeHtml(item.status)}">
        <!-- Top header -->
        <div class="card-top">
          <div class="card-title-group">
            <h3 class="card-title" title="${this.escapeHtml(item.name)}">${this.escapeHtml(item.name)}</h3>
            ${item.recommended ? '<span class="badge-recommended">★ Recommended</span>' : ''}
            ${item.verified ? '<span class="badge-verified"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="9" height="9"><polyline points="20 6 9 17 4 12"></polyline></svg> Verified</span>' : ''}
            ${item.badge ? `<span class="badge-reward" title="${this.escapeHtml(item.bonus || item.badge)}">⚡ ${this.escapeHtml(item.badge)}</span>` : ''}
          </div>
          <span class="status-pill ${statusDef.badgeCls}" title="${this.escapeHtml(statusDef.description || '')}">
            <span class="status-dot ${statusDef.dotCls}"></span>
            ${this.escapeHtml(statusDef.label)}
          </span>
        </div>

        <!-- Bonus / Credits highlight -->
        ${item.bonus ? `
          <div class="card-bonus-desc" title="Bonus Offer">
            <span class="bonus-credit-tag">🎁 Credits</span>
            <span class="bonus-credit-text">${this.escapeHtml(item.bonus)}</span>
          </div>
        ` : ''}

        <!-- Supported AI Models with official logos -->
        ${item.models && item.models.length > 0 ? `
          <div class="card-models-row">
            <span class="card-models-label">Models:</span>
            ${this.renderModelTags(item.models)}
          </div>
        ` : ''}

        <!-- Notes / Instructions -->
        ${item.notes ? `
          <div class="card-notes">
            ${this.escapeHtml(item.notes)}
          </div>
        ` : ''}

        <!-- Actions Row -->
        <div class="card-actions-row">
          <a href="${this.escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="btn-primary-action">
            <span>Open</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </a>

          <button type="button" class="btn-secondary-action btn-copy-link" data-url="${this.escapeHtml(item.url)}" title="Copy referral link to clipboard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span>Copy</span>
          </button>

          ${hasMultipleUrls ? `
            ${item.urls.slice(1).map(u => `
              <a href="${this.escapeHtml(u.url)}" target="_blank" rel="noopener noreferrer" class="btn-secondary-action" title="${this.escapeHtml(u.label)}">
                <span>${this.escapeHtml(u.label)}</span>
              </a>
            `).join('')}
          ` : ''}
        </div>

        <!-- Admin Inline Toolbar (Only visible when Admin Mode is ON) -->
        ${this.admin.isAdminMode ? `
          <div class="card-admin-toolbar">
            <select class="card-admin-status-select" data-id="${this.escapeHtml(item.id)}" title="Quick Change Status">
              <option value="active" ${item.status === 'active' ? 'selected' : ''}>● Active</option>
              <option value="down" ${item.status === 'down' ? 'selected' : ''}>● Down</option>
              <option value="unconfirmed" ${item.status === 'unconfirmed' ? 'selected' : ''}>● Unconfirmed</option>
              <option value="dead" ${item.status === 'dead' ? 'selected' : ''}>● Dead</option>
              <option value="fake" ${item.status === 'fake' ? 'selected' : ''}>● Fake</option>
            </select>

            <div class="card-admin-btns">
              <button type="button" class="btn-card-admin btn-admin-toggle-rec" data-id="${this.escapeHtml(item.id)}" title="Toggle Recommended">${item.recommended ? '★ Rec' : '☆ Rec'}</button>
              <button type="button" class="btn-card-admin btn-admin-toggle-ver" data-id="${this.escapeHtml(item.id)}" title="Toggle Verified">${item.verified ? '✓ Ver' : '○ Ver'}</button>
              <button type="button" class="btn-card-admin btn-admin-move-up" data-id="${this.escapeHtml(item.id)}" title="Move Up">↑</button>
              <button type="button" class="btn-card-admin btn-admin-move-down" data-id="${this.escapeHtml(item.id)}" title="Move Down">↓</button>
              <button type="button" class="btn-card-admin btn-admin-edit" data-id="${this.escapeHtml(item.id)}">Edit</button>
              <button type="button" class="btn-card-admin delete btn-admin-delete" data-id="${this.escapeHtml(item.id)}">Delete</button>
            </div>
          </div>
        ` : ''}
      </article>
    `;
  }

  attachCardEventListeners(container) {
  // Copy referral link button
  container.querySelectorAll('.btn-copy-link').forEach(btn => {
    btn.addEventListener('click', async () => {
      const url = btn.getAttribute('data-url');
      if (!url) return;
      try {
        await navigator.clipboard.writeText(url);
        const originalText = btn.innerHTML;
        btn.classList.add('copied');
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>Copied!</span>
          `;
        this.showToast('Referral link copied to clipboard!', 'success');
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = originalText;
        }, 2000);
      } catch (e) {
        // Fallback
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
        this.showToast('Copied to clipboard!', 'success');
      }
    });
  });

  // 1-Click Filter by AI Model tag
  container.querySelectorAll('.tag-model[data-model-filter]').forEach(tag => {
    tag.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const brand = tag.getAttribute('data-model-filter');
      if (brand) {
        this.modelFilter = (this.modelFilter === brand) ? 'all' : brand;
        this.render();
        const filterBar = document.getElementById('models-filter-bar');
        if (filterBar) {
          filterBar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    });
  });

  // Admin inline actions
  if (this.admin.isAdminMode) {
    // 1-Click Status dropdown
    container.querySelectorAll('.card-admin-status-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const id = sel.getAttribute('data-id');
        this.admin.updateLinkStatus(id, e.target.value);
      });
    });

    // Edit button
    container.querySelectorAll('.btn-admin-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.admin.openLinkModal(id);
      });
    });

    // Toggle Recommended button
    container.querySelectorAll('.btn-admin-toggle-rec').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.admin.toggleRecommended(id);
      });
    });

    // Toggle Verified button
    container.querySelectorAll('.btn-admin-toggle-ver').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.admin.toggleVerified(id);
      });
    });

    // Delete button
    container.querySelectorAll('.btn-admin-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.admin.confirmDelete(id);
      });
    });

    // Move Up
    container.querySelectorAll('.btn-admin-move-up').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.admin.moveLink(id, 'up');
      });
    });

    // Move Down
    container.querySelectorAll('.btn-admin-move-down').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.admin.moveLink(id, 'down');
      });
    });
  }
}

  /* ==========================================================================
     Toast Notifications
     ========================================================================== */
  showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--primary);"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#ef4444;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
    } else {
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--accent-cyan);"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }

    toast.innerHTML = `
      ${iconSvg}
      <span>${this.escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Bootstrap application on DOM ready
window.App = App;
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});

export { App };
