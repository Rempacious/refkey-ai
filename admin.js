/**
 * Admin Controller - Handles links management, Gist persistence, and Admin UI
 */

import { CONFIG } from './config.js';
import { GistService } from './gist-service.js';

export class AdminController {
  constructor(app) {
    this.app = app;
    this.isAdminMode = false;
    this.token = localStorage.getItem(CONFIG.STORAGE_KEYS.ADMIN_TOKEN) || '';
    this.gistId = localStorage.getItem(CONFIG.STORAGE_KEYS.GIST_ID) || CONFIG.DEFAULT_GIST_ID || '';

    this.editingLinkId = null;
    this.deletingLinkId = null;

    this.init();
  }

  init() {
    this.bindEvents();
    this.updateAdminBarVisibility();
  }

  get hasAuth() {
    return Boolean(this.token && this.token.trim().length > 0);
  }

  toggleAdminMode() {
    this.isAdminMode = !this.isAdminMode;
    this.updateAdminBarVisibility();
    this.app.render();

    const lockBtn = document.getElementById('btn-admin-toggle');
    if (lockBtn) {
      lockBtn.classList.toggle('is-active', this.isAdminMode);
      lockBtn.title = this.isAdminMode ? 'Admin Mode (Active)' : 'Admin Login';
    }

    if (this.isAdminMode) {
      this.app.showToast('Admin mode activated', 'info');
      // If user hasn't set up token or gist yet, guide them to settings
      if (!this.hasAuth && !this.gistId) {
        setTimeout(() => this.openSettingsModal(), 400);
      }
    } else {
      this.app.showToast('Exited Admin mode', 'info');
    }
  }

  updateAdminBarVisibility() {
    const adminBar = document.getElementById('admin-bar');
    if (!adminBar) return;
    adminBar.style.display = this.isAdminMode ? 'flex' : 'none';

    const gistInfoEl = document.getElementById('admin-gist-display');
    if (gistInfoEl) {
      if (this.gistId) {
        gistInfoEl.textContent = `Gist: ${this.gistId.slice(0, 8)}…`;
        gistInfoEl.title = `Gist ID: ${this.gistId}`;
      } else {
        gistInfoEl.textContent = 'Mode: Browser Storage (No Gist linked)';
        gistInfoEl.title = 'Click Gist Settings to link a GitHub Gist';
      }
    }
  }

  bindEvents() {
    // Top admin button
    const toggleBtn = document.getElementById('btn-admin-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleAdminMode());
    }

    // Admin bar actions
    const btnAdd = document.getElementById('admin-btn-add');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => this.openLinkModal(null));
    }

    const btnSettings = document.getElementById('admin-btn-settings');
    if (btnSettings) {
      btnSettings.addEventListener('click', () => this.openSettingsModal());
    }

    const btnExport = document.getElementById('admin-btn-export');
    if (btnExport) {
      btnExport.addEventListener('click', () => this.exportJson());
    }

    const btnImport = document.getElementById('admin-btn-import');
    const inputImport = document.getElementById('admin-file-import');
    if (btnImport && inputImport) {
      btnImport.addEventListener('click', () => inputImport.click());
      inputImport.addEventListener('change', (e) => this.handleFileImport(e));
    }

    const btnExit = document.getElementById('admin-btn-exit');
    if (btnExit) {
      btnExit.addEventListener('click', () => this.toggleAdminMode());
    }

    // Modal close buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal-overlay');
        if (modal) modal.classList.remove('is-open');
      });
    });

    // Close modal on overlay background click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('is-open');
        }
      });
    });

    // Link Form Submit
    const linkForm = document.getElementById('form-link-editor');
    if (linkForm) {
      linkForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveLinkFromForm();
      });
    }

    // Add extra URL row button in link form
    const btnAddUrl = document.getElementById('btn-add-url-row');
    if (btnAddUrl) {
      btnAddUrl.addEventListener('click', () => this.appendUrlRow());
    }

    // Settings Form Submit
    const settingsForm = document.getElementById('form-admin-settings');
    if (settingsForm) {
      settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveSettings();
      });
    }

    // Test Token / Connection button
    const btnTestConn = document.getElementById('btn-test-connection');
    if (btnTestConn) {
      btnTestConn.addEventListener('click', () => this.testConnection());
    }

    // Auto-create Gist button
    const btnAutoGist = document.getElementById('btn-auto-create-gist');
    if (btnAutoGist) {
      btnAutoGist.addEventListener('click', () => this.autoCreateGist());
    }

    // Delete Confirmation Button
    const btnConfirmDelete = document.getElementById('btn-confirm-delete');
    if (btnConfirmDelete) {
      btnConfirmDelete.addEventListener('click', () => this.executeDelete());
    }

    // Toggle token password visibility
    const btnToggleTokenVis = document.getElementById('btn-toggle-token-vis');
    const inputToken = document.getElementById('settings-token');
    if (btnToggleTokenVis && inputToken) {
      btnToggleTokenVis.addEventListener('click', () => {
        const isPass = inputToken.type === 'password';
        inputToken.type = isPass ? 'text' : 'password';
        btnToggleTokenVis.textContent = isPass ? 'Hide' : 'Show';
      });
    }

    // Keyboard shortcut: Ctrl + Shift + A or Alt + A for Admin mode
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') || (e.altKey && e.key.toLowerCase() === 'a')) {
        e.preventDefault();
        this.toggleAdminMode();
      }
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.is-open').forEach(m => m.classList.remove('is-open'));
      }
    });
  }

  /* ==========================================================================
     Link Form Handling (Add / Edit)
     ========================================================================== */
  openLinkModal(linkId = null) {
    this.editingLinkId = linkId;
    const modal = document.getElementById('modal-link-editor');
    const titleEl = document.getElementById('modal-link-title');
    const form = document.getElementById('form-link-editor');
    const urlsContainer = document.getElementById('extra-urls-container');

    urlsContainer.innerHTML = '';
    form.reset();

    if (linkId) {
      const item = this.app.links.find(l => l.id === linkId);
      if (!item) return;

      titleEl.textContent = `Edit Referral Link: ${item.name}`;
      document.getElementById('link-name').value = item.name || '';
      document.getElementById('link-category').value = item.category || 'Top Sites';
      document.getElementById('link-badge').value = item.badge || '';
      document.getElementById('link-bonus').value = item.bonus || '';
      document.getElementById('link-url').value = item.url || '';
      document.getElementById('link-status').value = item.status || 'active';
      document.getElementById('link-notes').value = item.notes || '';

      const chkRec = document.getElementById('link-recommended');
      if (chkRec) chkRec.checked = Boolean(item.recommended);
      const chkVer = document.getElementById('link-verified');
      if (chkVer) chkVer.checked = Boolean(item.verified);

      // Secondary URLs
      if (Array.isArray(item.urls) && item.urls.length > 1) {
        for (let i = 1; i < item.urls.length; i++) {
          const u = item.urls[i];
          const label = typeof u === 'object' ? u.label : (item.linkLabels?.[i] || '');
          const href = typeof u === 'object' ? u.url : u;
          this.appendUrlRow(label, href);
        }
      }
    } else {
      titleEl.textContent = 'Add New Referral Link';
      document.getElementById('link-category').value = this.app.currentCategory !== 'all' ? this.app.currentCategory : 'Top Sites';
      document.getElementById('link-status').value = 'active';
      const chkRec = document.getElementById('link-recommended');
      if (chkRec) chkRec.checked = false;
      const chkVer = document.getElementById('link-verified');
      if (chkVer) chkVer.checked = true; // default to verified
    }

    modal.classList.add('is-open');
    document.getElementById('link-name').focus();
  }

  appendUrlRow(label = '', url = '') {
    const container = document.getElementById('extra-urls-container');
    const row = document.createElement('div');
    row.className = 'url-entry-row';
    row.innerHTML = `
      <input type="text" class="form-input form-url-label" placeholder="Label (e.g. Mirror, Sub)" value="${this.escapeHtml(label)}" style="max-width: 130px;">
      <input type="url" class="form-input mono form-url-href" placeholder="https://..." value="${this.escapeHtml(url)}" required>
      <button type="button" class="btn btn-secondary btn-sm" onclick="this.parentElement.remove()" title="Remove URL">✕</button>
    `;
    container.appendChild(row);
  }

  async saveLinkFromForm() {
    const name = document.getElementById('link-name').value.trim();
    const category = document.getElementById('link-category').value.trim();
    const badge = document.getElementById('link-badge').value.trim();
    const bonus = document.getElementById('link-bonus').value.trim();
    const primaryUrl = document.getElementById('link-url').value.trim();
    const status = document.getElementById('link-status').value;
    const notes = document.getElementById('link-notes').value.trim();
    const recommended = Boolean(document.getElementById('link-recommended')?.checked);
    const verified = Boolean(document.getElementById('link-verified')?.checked);

    if (!name || !primaryUrl) {
      this.app.showToast('Name and primary URL are required', 'error');
      return;
    }

    // Collect extra URLs
    const urls = [{ label: 'Referral Link', url: primaryUrl }];
    document.querySelectorAll('#extra-urls-container .url-entry-row').forEach(row => {
      const lbl = row.querySelector('.form-url-label').value.trim();
      const href = row.querySelector('.form-url-href').value.trim();
      if (href) {
        urls.push({ label: lbl || 'Link', url: href });
      }
    });

    const now = new Date().toISOString();

    if (this.editingLinkId) {
      // Edit existing
      const index = this.app.links.findIndex(l => l.id === this.editingLinkId);
      if (index !== -1) {
        this.app.links[index] = {
          ...this.app.links[index],
          name,
          category,
          badge,
          bonus,
          url: primaryUrl,
          urls,
          status,
          recommended,
          verified,
          notes,
          updatedAt: now
        };
      }
    } else {
      // Create new
      const newId = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newItem = {
        id: newId,
        name,
        category,
        badge,
        bonus,
        url: primaryUrl,
        urls,
        status,
        recommended,
        verified,
        notes,
        createdAt: now,
        updatedAt: now
      };
      this.app.links.unshift(newItem); // Add to beginning
    }

    // Close modal
    document.getElementById('modal-link-editor').classList.remove('is-open');

    // Persist changes
    await this.persistChanges(`Saved "${name}"`);
  }

  /* ==========================================================================
     Real-Time Instant Quick Actions (Status Change, Recommended, Verified & Delete)
     ========================================================================== */
  async updateLinkStatus(linkId, newStatus) {
    const item = this.app.links.find(l => l.id === linkId);
    if (!item) return;

    item.status = newStatus;
    item.updatedAt = new Date().toISOString();

    await this.persistChanges(`Status of ${item.name} set to ${newStatus.toUpperCase()}`);
  }

  async toggleRecommended(linkId) {
    const item = this.app.links.find(l => l.id === linkId);
    if (!item) return;

    item.recommended = !item.recommended;
    item.updatedAt = new Date().toISOString();

    await this.persistChanges(`${item.name} ${item.recommended ? 'marked as ★ Recommended' : 'unmarked from Recommended'}`);
  }

  async toggleVerified(linkId) {
    const item = this.app.links.find(l => l.id === linkId);
    if (!item) return;

    item.verified = !item.verified;
    item.updatedAt = new Date().toISOString();

    await this.persistChanges(`${item.name} ${item.verified ? 'marked as ✓ Verified' : 'unmarked from Verified'}`);
  }

  confirmDelete(linkId) {
    this.deletingLinkId = linkId;
    const item = this.app.links.find(l => l.id === linkId);
    if (!item) return;

    const modal = document.getElementById('modal-delete-confirm');
    const textEl = document.getElementById('delete-item-name');
    if (textEl) textEl.textContent = `"${item.name}"`;
    modal.classList.add('is-open');
  }

  async executeDelete() {
    if (!this.deletingLinkId) return;
    const item = this.app.links.find(l => l.id === this.deletingLinkId);
    const itemName = item ? item.name : 'Item';

    this.app.links = this.app.links.filter(l => l.id !== this.deletingLinkId);
    this.deletingLinkId = null;

    document.getElementById('modal-delete-confirm').classList.remove('is-open');
    await this.persistChanges(`Deleted "${itemName}"`);
  }

  async moveLink(linkId, direction) {
    const index = this.app.links.findIndex(l => l.id === linkId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= this.app.links.length) return;

    const [moved] = this.app.links.splice(index, 1);
    this.app.links.splice(newIndex, 0, moved);

    await this.persistChanges(`Reordered links`);
  }

  /* ==========================================================================
     Persistence (GitHub Gist vs Local Storage)
     ========================================================================== */
  async persistChanges(successMessage = 'Changes saved') {
    // 1. Immediately update UI
    this.app.render();

    // 2. Also save to LocalStorage as a local backup
    try {
      localStorage.setItem(CONFIG.STORAGE_KEYS.LOCAL_LINKS, JSON.stringify(this.app.links));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }

    // 3. If Gist is connected and token is present, update the GitHub Gist
    if (this.gistId && this.token) {
      this.app.showToast('Saving to GitHub Gist…', 'info');
      try {
        await GistService.updateGist(this.gistId, this.token, this.app.links, {
          lastUpdated: new Date().toISOString()
        });
        this.app.lastUpdated = new Date();
        this.app.updateHeaderStats();
        this.app.showToast(successMessage, 'success');
      } catch (err) {
        console.error('Error saving to Gist:', err);
        this.app.showToast(`Failed to update Gist: ${err.message}`, 'error');
      }
    } else {
      // Local mode only
      this.app.lastUpdated = new Date();
      this.app.updateHeaderStats();
      this.app.showToast(`${successMessage} (Saved locally in browser)`, 'success');
    }
  }

  /* ==========================================================================
     Settings & Gist Connection
     ========================================================================== */
  openSettingsModal() {
    const modal = document.getElementById('modal-admin-settings');
    document.getElementById('settings-token').value = this.token;
    document.getElementById('settings-gist-id').value = this.gistId;

    const statusBadge = document.getElementById('connection-status-badge');
    if (statusBadge) {
      statusBadge.style.display = 'inline-block';
      statusBadge.textContent = this.gistId ? '● Gist Linked' : '○ Local Storage';
      statusBadge.style.color = this.gistId ? 'var(--primary)' : 'var(--text-muted)';
    }

    modal.classList.add('is-open');
  }

  async saveSettings() {
    const token = document.getElementById('settings-token').value.trim();
    const gistId = document.getElementById('settings-gist-id').value.trim();

    this.token = token;
    this.gistId = gistId;

    localStorage.setItem(CONFIG.STORAGE_KEYS.ADMIN_TOKEN, token);
    localStorage.setItem(CONFIG.STORAGE_KEYS.GIST_ID, gistId);

    this.updateAdminBarVisibility();
    document.getElementById('modal-admin-settings').classList.remove('is-open');

    this.app.showToast('Settings saved. Refreshing data…', 'success');

    // Reload links with new configuration
    await this.app.loadData();
  }

  async testConnection() {
    const token = document.getElementById('settings-token').value.trim();
    const gistId = document.getElementById('settings-gist-id').value.trim();
    const statusEl = document.getElementById('connection-test-result');

    if (!token && !gistId) {
      statusEl.innerHTML = '<span style="color:#f87171">Enter a GitHub Token or Gist ID to test.</span>';
      return;
    }

    statusEl.innerHTML = '<span style="color:var(--text-muted)">Testing connection…</span>';

    try {
      let msg = '';
      if (token) {
        const auth = await GistService.verifyToken(token);
        if (!auth.valid) throw new Error(`Token invalid: ${auth.error}`);
        msg += `✓ Authenticated as GitHub user @${auth.user.login}. `;
      }
      if (gistId) {
        const data = await GistService.fetchGist(gistId);
        msg += `✓ Successfully reached Gist (${data.links?.length || 0} links found).`;
      }
      statusEl.innerHTML = `<span style="color:var(--primary)">${msg}</span>`;
    } catch (err) {
      statusEl.innerHTML = `<span style="color:#f87171">✕ Error: ${err.message}</span>`;
    }
  }

  async autoCreateGist() {
    const token = document.getElementById('settings-token').value.trim();
    const statusEl = document.getElementById('connection-test-result');

    if (!token) {
      statusEl.innerHTML = '<span style="color:#f87171">Please paste a GitHub Personal Access Token first.</span>';
      return;
    }

    statusEl.innerHTML = '<span style="color:var(--primary)">Creating new GitHub Gist with current links…</span>';

    try {
      const res = await GistService.createGist(token, this.app.links, {
        source: CONFIG.SITE_NAME,
        createdAt: new Date().toISOString()
      }, true);

      this.gistId = res.gistId;
      document.getElementById('settings-gist-id').value = res.gistId;
      localStorage.setItem(CONFIG.STORAGE_KEYS.GIST_ID, res.gistId);

      try {
        await navigator.clipboard.writeText(res.gistId);
      } catch (e) {}

      statusEl.innerHTML = `
        <div style="margin-top:0.35rem; padding:0.5rem; background:rgba(13,242,201,0.08); border:1px solid rgba(13,242,201,0.3); border-radius:6px;">
          <span style="color:var(--primary); font-weight:600;">✓ Created Gist ID:</span>
          <code style="color:#0df2c9; font-weight:700;">${res.gistId}</code>
          <span style="color:var(--text-muted); font-size:0.75rem; display:block; margin-top:0.25rem;">
            (Copied to clipboard! Set <code>DEFAULT_GIST_ID: "${res.gistId}"</code> in <code>config.js</code> so all visitors load this Gist.)
          </span>
        </div>
      `;
      this.app.showToast('Gist created and linked! ID copied.', 'success');
      this.updateAdminBarVisibility();
    } catch (err) {
      statusEl.innerHTML = `<span style="color:#f87171">✕ Failed to create Gist: ${err.message}</span>`;
    }
  }

  /* ==========================================================================
     Import / Export
     ========================================================================== */
  exportJson() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.app.links, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `refkey-links-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    this.app.showToast('Backup JSON exported', 'success');
  }

  handleFileImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target.result);
        if (!Array.isArray(json)) throw new Error('File must contain a JSON array of links');

        const normalized = json.map(item => this.app.normalizeItem(item));
        this.app.links = normalized;
        await this.persistChanges(`Imported ${normalized.length} links`);
      } catch (err) {
        this.app.showToast(`Import error: ${err.message}`, 'error');
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
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
