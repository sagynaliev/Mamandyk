/**
 * Mamandyk — Shared Core Module
 * Handles: i18n, header injection, auth state, API config
 * Version: 2.0
 */

// ─────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────
const APP_CONFIG = {
  // Change this to your production URL when deploying
  API_BASE: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? ''
    : '',   // same-origin in production
  STORAGE_KEYS: {
    TOKEN:    'mamandyk_token',
    USER:     'mamandyk_user',
    CAREERS:  'lastCareers',
  }
};

// ─────────────────────────────────────────────────────
// I18N STUB (тек қазақша, locale файлдары жоқ)
// ─────────────────────────────────────────────────────
const i18n = {
  init:    async () => {},
  t:       (k) => k,
  lang:    'kk',
  setLang: async () => {},
};

// ─────────────────────────────────────────────────────
// AUTH HELPERS
// ─────────────────────────────────────────────────────
const auth = {
  getToken() {
    // Check both new namespaced key and legacy 'token' key for backward compat
    return localStorage.getItem(APP_CONFIG.STORAGE_KEYS.TOKEN)
        || localStorage.getItem('token')
        || null;
  },
  getUser() {
    try {
      const raw = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.USER)
               || localStorage.getItem('user');
      return JSON.parse(raw || 'null');
    } catch { return null; }
  },
  isLoggedIn() {
    return !!(this.getToken() && this.getUser());
  },
  logout() {
    // Clear both new and legacy keys
    localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.TOKEN);
    localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.USER);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
  },
  saveSession(token, user) {
    // Write to new namespaced keys
    localStorage.setItem(APP_CONFIG.STORAGE_KEYS.TOKEN, token);
    localStorage.setItem(APP_CONFIG.STORAGE_KEYS.USER, JSON.stringify(user));
    // Clear legacy keys to avoid confusion
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
  getUserInitials() {
    const u = this.getUser();
    if (!u) return '?';
    return ((u.first_name?.[0] || '') + (u.last_name?.[0] || '')).toUpperCase() || '?';
  },
  redirectToDashboard() {
    const u = this.getUser();
    if (!u) { window.location.href = 'login.html'; return; }
    const map = {
      admin:   'admin.html',
      manager: 'manager.html',
      student: 'profile.html',
    };
    window.location.href = map[u.role] || 'profile.html';
  }
};

// ─────────────────────────────────────────────────────
// API CLIENT
// ─────────────────────────────────────────────────────
const api = {
  async request(method, path, body = null, requireAuth = false) {
    const headers = { 'Content-Type': 'application/json' };
    const token = auth.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (requireAuth && !token) {
      window.location.href = 'login.html';
      throw new Error('No token');
    }
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    try {
      const res = await fetch(APP_CONFIG.API_BASE + path, opts);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (e) {
      if (e.name === 'TypeError') throw new Error(i18n.t('errors.noConnection'));
      throw e;
    }
  },
  get:    (path, auth = false)       => api.request('GET',    path, null, auth),
  post:   (path, body, auth = false) => api.request('POST',   path, body, auth),
  put:    (path, body, auth = false) => api.request('PUT',    path, body, auth),
  patch:  (path, body, auth = false) => api.request('PATCH',  path, body, auth),
  delete: (path, auth = false)       => api.request('DELETE', path, null, auth),
};

// ─────────────────────────────────────────────────────
// SHARED HEADER COMPONENT
// ─────────────────────────────────────────────────────
const Header = {
  /**
   * headerType: 'main' | 'dashboard' | 'minimal'
   * activePage:  'home' | 'about' | 'careers' | 'simulator' | 'help' | 'profile'
   * badgeHtml:   optional badge HTML for dashboard pages
   */
  inject(options = {}) {
    const {
      headerType = 'main',
      activePage = '',
      badgeHtml  = '',
      extraRight = '',
    } = options;

    const el = document.getElementById('app-header');
    if (!el) return;

    if (headerType === 'minimal') {
      el.innerHTML = this._minimal(options);
    } else if (headerType === 'dashboard') {
      el.innerHTML = this._dashboard(options);
    } else {
      el.innerHTML = this._main(activePage);
    }

    this._bindAuth(headerType);
    this._bindLangSwitcher();
  },

  _langSwitcher() { return ''; },

  _logoHtml() {
    return `<a href="index.html" class="logo" aria-label="Mamandyk Home">
      <div class="logo-dot" aria-hidden="true"></div>Mamandyk
    </a>`;
  },

  _main(activePage) {
    const navItems = [
      { key: 'about',     href: 'about.html',    label: 'Тест туралы' },
      { key: 'careers',   href: 'careers.html',  label: 'Мамандықтар' },
      { key: 'simulator', href: 'simulator.html', label: 'Симулятор'   },
      { key: 'help',      href: 'help.html',      label: 'Көмек'       },
    ];
    const navHtml = navItems.map(item =>
      `<a href="${item.href}" class="nav-link${activePage === item.key ? ' active' : ''}">${item.label}</a>`
    ).join('');

    return `
      ${this._logoHtml()}
      <nav class="header-nav" role="navigation" aria-label="Main navigation">
        ${navHtml}
      </nav>
      <div class="header-right">
        <div id="header-auth-area"></div>
      </div>`;
  },

  _dashboard({ badgeHtml = '', showBack = false, backHref = 'index.html' }) {
    return `
      <div class="header-left-group">
        ${this._logoHtml()}
        ${badgeHtml ? `<span class="header-badge">${badgeHtml}</span>` : ''}
      </div>
      <div class="header-right">
        <div id="header-auth-area"></div>
      </div>`;
  },

  _minimal({ backHref = null, backLabel = null }) {
    const backBtn = backHref
      ? `<a href="${backHref}" class="btn btn-ghost header-back">${backLabel || '← ' + i18n.t('common.back')}</a>`
      : '';
    return `
      ${this._logoHtml()}
      <div class="header-right">
        ${backBtn}
      </div>`;
  },

  _bindAuth(headerType) {
    const area = document.getElementById('header-auth-area');
    if (!area) return;

    const user = auth.getUser();
    const token = auth.getToken();

    if (token && user) {
      const initials = auth.getUserInitials();
      const name = user.first_name || '';
      if (headerType === 'dashboard') {
        area.innerHTML = `
          <div class="user-chip">
            <div class="user-avatar" aria-hidden="true">${initials}</div>
            <span class="user-name">${name}</span>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="auth.logout()" data-i18n="nav.logout">${i18n.t('nav.logout')}</button>`;
      } else {
        area.innerHTML = `
          <button class="btn btn-ghost" onclick="auth.redirectToDashboard()">
            <span class="user-avatar user-avatar--sm" aria-hidden="true">${initials}</span>
            <span>${name}</span>
          </button>
          <button class="btn btn-ghost btn-sm" onclick="auth.logout()" data-i18n="nav.logout">${i18n.t('nav.logout')}</button>`;
      }
    } else {
      area.innerHTML = `
        <a href="login.html" class="btn btn-ghost" data-i18n="nav.login">${i18n.t('nav.login')}</a>
        <a href="register.html" class="btn btn-green" data-i18n="nav.register">${i18n.t('nav.register')}</a>`;
    }
  },

  _bindLangSwitcher() {}
};

// ─────────────────────────────────────────────────────
// TOAST NOTIFICATIONS
// ─────────────────────────────────────────────────────
const toast = (() => {
  let container = null;

  function _getContainer() {
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'false');
      document.body.appendChild(container);
    }
    return container;
  }

  function show(message, type = 'info', duration = 3500) {
    const c = _getContainer();
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.setAttribute('role', 'alert');
    const icons = { success: '✅', error: '❌', warn: '⚠️', info: 'ℹ️' };
    el.innerHTML = `<span class="toast-icon">${icons[type] || ''}</span><span class="toast-msg">${message}</span>`;
    c.appendChild(el);
    // Animate in
    requestAnimationFrame(() => el.classList.add('toast--visible'));
    // Auto remove
    setTimeout(() => {
      el.classList.remove('toast--visible');
      el.addEventListener('transitionend', () => el.remove(), { once: true });
    }, duration);
  }

  return {
    success: (msg) => show(msg, 'success'),
    error:   (msg) => show(msg, 'error'),
    warn:    (msg) => show(msg, 'warn'),
    info:    (msg) => show(msg, 'info'),
    show,
  };
})();

// ─────────────────────────────────────────────────────
// SHARED CSS VARIABLES (injected once)
// ─────────────────────────────────────────────────────
(function injectSharedStyles() {
  if (document.getElementById('mamandyk-shared-styles')) return;
  const style = document.createElement('style');
  style.id = 'mamandyk-shared-styles';
  style.textContent = `
    /* ── Shared Header Styles ── */
    #app-header {
      background: var(--white, #fff);
      border-bottom: 1px solid var(--border, #e2e8f0);
      padding: 0 5%;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 200;
      box-shadow: 0 1px 8px rgba(0,0,0,.06);
      gap: 16px;
    }
    .logo {
      font-family: 'Geologica', sans-serif;
      font-size: 1.1rem;
      font-weight: 900;
      color: var(--green, #22c55e);
      display: flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
      white-space: nowrap;
    }
    .logo-dot {
      width: 8px; height: 8px;
      background: var(--green, #22c55e);
      border-radius: 50%;
      animation: pulse 2s infinite;
      flex-shrink: 0;
    }
    @keyframes pulse {
      0%,100%{ transform:scale(1); }
      50%{ transform:scale(1.5); opacity:.6; }
    }
    .header-nav { display: flex; gap: 4px; }
    .nav-link {
      color: var(--muted, #64748b);
      text-decoration: none;
      font-weight: 600;
      font-size: .85rem;
      padding: 7px 12px;
      border-radius: 9px;
      transition: all .2s;
      white-space: nowrap;
    }
    .nav-link:hover, .nav-link.active {
      background: var(--green-light, #f0fdf4);
      color: var(--green-dark, #16a34a);
    }
    .header-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
    .header-left-group { display: flex; align-items: center; gap: 12px; }
    .header-badge {
      font-size: .72rem; font-weight: 800; padding: 4px 10px;
      border-radius: 50px; border: 1px solid; white-space: nowrap;
    }
    /* Auth area */
    .user-chip { display: flex; align-items: center; gap: 8px; }
    .user-avatar {
      width: 30px; height: 30px;
      background: var(--green-mid,#dcfce7); color: var(--green-dark,#16a34a);
      border-radius: 8px; display: flex; align-items: center; justify-content: center;
      font-weight: 900; font-size: .72rem; flex-shrink: 0;
    }
    .user-avatar--sm { width: 24px; height: 24px; font-size: .65rem; border-radius: 6px; }
    .user-name { font-size: .83rem; font-weight: 600; color: var(--muted,#64748b); }
    /* Common buttons */
    .btn {
      padding: 7px 16px; border-radius: 10px; font-weight: 700;
      font-family: 'Inter', sans-serif; font-size: .82rem;
      cursor: pointer; transition: all .2s; border: none;
      display: inline-flex; align-items: center; gap: 6px; text-decoration: none;
    }
    .btn-green { background: var(--green,#22c55e); color: #fff; box-shadow: 0 3px 10px rgba(34,197,94,.3); }
    .btn-green:hover { background: var(--green-dark,#16a34a); }
    .btn-ghost { background: transparent; border: 1.5px solid var(--border,#e2e8f0); color: var(--muted,#64748b); }
    .btn-ghost:hover { border-color: var(--green,#22c55e); color: var(--green,#22c55e); }
    .btn-sm { padding: 5px 11px; font-size: .75rem; }
    /* Toast */
    #toast-container {
      position: fixed; bottom: 24px; right: 24px;
      display: flex; flex-direction: column; gap: 8px;
      z-index: 9999; pointer-events: none;
    }
    .toast {
      background: #1e293b; color: white;
      padding: 11px 18px; border-radius: 12px;
      font-size: .83rem; font-weight: 700;
      display: flex; align-items: center; gap: 9px;
      box-shadow: 0 4px 16px rgba(0,0,0,.2);
      opacity: 0; transform: translateY(8px);
      transition: opacity .25s, transform .25s;
      pointer-events: auto;
      max-width: 320px;
    }
    .toast--visible { opacity: 1; transform: translateY(0); }
    .toast--success { background: #166534; }
    .toast--error   { background: #991b1b; }
    .toast--warn    { background: #92400e; }
    /* Responsive */
    @media (max-width: 768px) {
      .header-nav { display: none; }
      #app-header { padding: 0 16px; }
    }
  `;
  document.head.appendChild(style);
})();

// ─────────────────────────────────────────────────────
// INPUT VALIDATORS
// ─────────────────────────────────────────────────────
const validators = {
  email:    (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  required: (v) => v != null && String(v).trim().length > 0,
  minLen:   (v, n) => String(v).trim().length >= n,
  sanitize: (v) => String(v).replace(/[<>'"&]/g, c => ({'<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;','&':'&amp;'}[c])),
};

// ─────────────────────────────────────────────────────
// EXPORT (makes available globally, no module bundler needed)
// ─────────────────────────────────────────────────────
window.i18n        = i18n;
window.auth        = auth;
window.api         = api;
window.Header      = Header;
window.toast       = toast;
window.validators  = validators;
window.APP_CONFIG  = APP_CONFIG;
