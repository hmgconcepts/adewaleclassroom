/* ============================================================================
   pwa-install.js — Tutoring Connect V8 · persistent install invitation
   ----------------------------------------------------------------------------
   V7 required a #pwa-install-banner element to already exist in the page.
   Five pages did not ship one, so the invitation silently never appeared
   there, and a single dismissal muted it everywhere for 24h with no other
   entry point. V8:
     * self-injects the banner on ANY page, so all 128 pages can invite;
     * adds a permanent "Install app" affordance in the header/nav that never
       disappears until the app really is installed;
     * uses an escalating, respectful cadence rather than one flat 24h snooze;
     * explains the *benefit* (offline scores, class reminders, faster login);
     * gives correct per-platform instructions for iOS, Android, desktop
       Chrome/Edge, and Firefox;
     * never nags once the app is actually installed.
   No external library. No AI. Free.
   ========================================================================== */

const PWAInstall = {
  deferredPrompt: null,
  installed: false,
  _snoozed: false,
  /* Escalating cadence in hours: the first snooze is short, later ones longer,
     so we stay present without becoming hostile. */
  CADENCE: [6, 12, 24, 72, 168],

  brand() { return (window.PRACTICE && window.PRACTICE.name) || 'this studio'; },

  init() {
    if (this._init) return; this._init = true;

    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.renderTrigger();
      setTimeout(() => this.maybeShowBanner(), 2500);
    });

    window.addEventListener('appinstalled', () => {
      this.installed = true;
      this.deferredPrompt = null;
      try { localStorage.setItem('tc_pwa_installed', '1'); } catch (_) {}
      this.hideBanner();
      this.renderTrigger();
      if (typeof toast === 'function') {
        toast('🎉 Installed! Look for "' + this.brand() + '" on your home screen.', 'success', 6000);
      }
    });

    this.detectInstalled();
    this.renderTrigger();

    setTimeout(() => this.maybeShowBanner(), 3500);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.maybeShowBanner(); });
    setInterval(() => this.maybeShowBanner(), 60 * 60 * 1000); // hourly re-check
    this.bindUI();
  },

  detectInstalled() {
    try { if (localStorage.getItem('tc_pwa_installed') === '1') this.installed = true; } catch (_) {}
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) this.installed = true;
    if (window.navigator && window.navigator.standalone === true) this.installed = true;
    if (document.referrer && document.referrer.startsWith('android-app://')) this.installed = true;
    return this.installed;
  },

  /* ---------- platform detection ---------- */
  isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream; },
  isAndroid() { return /Android/i.test(navigator.userAgent); },
  isFirefox() { return /Firefox/i.test(navigator.userAgent); },
  isSafariDesktop() { return /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Edg/.test(navigator.userAgent) && !this.isIOS(); },

  /* ---------- a permanent, non-dismissable entry point ---------- */
  renderTrigger() {
    try {
      const existing = document.getElementById('tc-install-trigger');
      if (this.installed) { if (existing) existing.remove(); return; }
      if (existing) return;
      const host = document.querySelector('.topbar') || document.querySelector('.app-header') ||
                   document.querySelector('header') || null;
      if (!host) return;
      const b = document.createElement('button');
      b.id = 'tc-install-trigger';
      b.type = 'button';
      b.className = 'btn btn-sm btn-outline';
      b.setAttribute('data-pwa-action', 'install');
      b.setAttribute('title', 'Install ' + this.brand() + ' as an app');
      b.setAttribute('aria-label', 'Install this studio as an app');
      b.innerHTML = '📲 <span class="tc-install-label">Install app</span>';
      b.style.cssText = 'margin-left:auto;white-space:nowrap';
      host.appendChild(b);
    } catch (_) {}
  },

  /* ---------- the banner (self-injecting) ---------- */
  ensureBanner() {
    let banner = document.getElementById('pwa-install-banner');
    if (banner) return banner;
    banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.className = 'pwa-install-banner tc-install-nudge';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-label', 'Install this app');
    banner.style.cssText =
      'position:fixed;left:14px;right:14px;bottom:14px;z-index:9998;max-width:520px;margin:0 auto;' +
      'background:var(--surface,#fff);color:var(--ink,#0f172a);border:1px solid var(--gray-300,#e2e8f0);' +
      'border-radius:16px;box-shadow:0 18px 40px rgba(0,0,0,.20);padding:14px 16px;' +
      'display:none;gap:12px;align-items:flex-start';
    banner.innerHTML =
      '<div style="font-size:1.7rem;line-height:1">📲</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-weight:800;margin-bottom:2px">Install ' + this._esc(this.brand()) + '</div>' +
        '<div class="pwa-install-msg" style="font-size:.88rem;line-height:1.45;color:var(--gray-600,#64748b)">' +
          'Get class reminders, scores and messages — even when the tab is closed. Works offline.' +
        '</div>' +
        '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">' +
          '<button type="button" class="btn btn-primary btn-sm" data-pwa-action="install">Install</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-pwa-action="dismiss">Not now</button>' +
        '</div>' +
      '</div>' +
      '<button type="button" aria-label="Close" data-pwa-action="dismiss" ' +
        'style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--gray-500,#94a3b8)">×</button>';
    (document.body || document.documentElement).appendChild(banner);
    return banner;
  },

  _esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); },

  snoozeCount() { try { return Number(localStorage.getItem('tc_pwa_snoozes') || 0); } catch (_) { return 0; } },
  waitMs() {
    const i = Math.min(this.snoozeCount(), this.CADENCE.length - 1);
    return this.CADENCE[i] * 60 * 60 * 1000;
  },

  maybeShowBanner() {
    if (this.detectInstalled()) { this.hideBanner(); return; }
    if (this._snoozed) return;
    try { if (localStorage.getItem('tc_pwa_never') === '1') return; } catch (_) {}
    let dismissedAt = 0;
    try { dismissedAt = Number(localStorage.getItem('tc_pwa_dismissed_at') || 0); } catch (_) {}
    if (dismissedAt && (Date.now() - dismissedAt) < this.waitMs()) return;

    const banner = this.ensureBanner();
    const msg = banner.querySelector('.pwa-install-msg');
    if (msg) msg.innerHTML = this.instructionHTML();
    banner.style.display = 'flex';
    banner.classList.add('show');
  },

  instructionHTML() {
    if (this.deferredPrompt) return 'Get class reminders, scores and messages — even when the tab is closed. Works offline.';
    if (this.isIOS()) return 'Tap <strong>Share</strong> ⬆️ then <strong>Add to Home Screen</strong> to install.';
    if (this.isFirefox()) return 'Open the <strong>⋮</strong> menu and choose <strong>Install</strong> / <strong>Add to Home screen</strong>.';
    if (this.isSafariDesktop()) return 'Choose <strong>File → Add to Dock</strong> to install this studio.';
    return 'Open your browser menu and choose <strong>Install app</strong> / <strong>Add to Home screen</strong>.';
  },

  bindUI() {
    if (this._bound) return; this._bound = true;
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-pwa-action]');
      if (!t) return;
      e.preventDefault();
      const action = t.dataset.pwaAction;
      if (action === 'install') this.prompt();
      if (action === 'dismiss') this.dismiss();
      if (action === 'ios-help') this.showHelp();
      if (action === 'never') this.neverShow();
    });
  },

  async prompt() {
    if (!this.deferredPrompt) { this.showHelp(); return; }
    try {
      this.deferredPrompt.prompt();
      const choice = await this.deferredPrompt.userChoice;
      if (choice && choice.outcome === 'accepted') {
        if (typeof toast === 'function') toast('Installing…', 'success');
        try { localStorage.removeItem('tc_pwa_snoozes'); } catch (_) {}
      } else {
        this.dismiss();
      }
    } catch (_) { this.showHelp(); }
    this.deferredPrompt = null;
  },

  dismiss() {
    this.hideBanner();
    try {
      localStorage.setItem('tc_pwa_dismissed_at', String(Date.now()));
      localStorage.setItem('tc_pwa_snoozes', String(this.snoozeCount() + 1));
    } catch (_) {}
  },

  neverShow() {
    this.hideBanner();
    try { localStorage.setItem('tc_pwa_never', '1'); } catch (_) {}
    if (typeof toast === 'function') toast('We will stop asking. You can still install from the ' +
      '"Install app" button in the header at any time.', 'info', 6000);
  },

  hideBanner() {
    const b = document.getElementById('pwa-install-banner');
    if (b) { b.classList.remove('show'); b.style.display = 'none'; }
  },

  /* Per-platform instructions, used when no native prompt is available. */
  showHelp() {
    const steps = this.isIOS() ? [
      'Open this page in <strong>Safari</strong> (Chrome on iOS cannot install).',
      'Tap the <strong>Share</strong> button ⬆️ at the bottom of the screen.',
      'Scroll and tap <strong>Add to Home Screen</strong>.',
      'Tap <strong>Add</strong> in the top-right corner.'
    ] : this.isAndroid() ? [
      'Open the <strong>⋮</strong> menu in your browser.',
      'Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.',
      'Confirm with <strong>Install</strong>.'
    ] : this.isFirefox() ? [
      'Open the <strong>⋮</strong> / hamburger menu.',
      'Choose <strong>Install</strong> or <strong>Add to Home screen</strong>.'
    ] : this.isSafariDesktop() ? [
      'Open the <strong>File</strong> menu.',
      'Choose <strong>Add to Dock…</strong>, then <strong>Add</strong>.'
    ] : [
      'Look for the <strong>install icon</strong> ⊕ in the address bar.',
      'Or open the <strong>⋮</strong> menu and choose <strong>Install ' + this._esc(this.brand()) + '</strong>.',
      'Confirm with <strong>Install</strong>.'
    ];
    const body =
      '<div style="padding:6px 0">' +
        '<div style="text-align:center;font-size:2.6rem;margin-bottom:10px">📲</div>' +
        '<ol style="text-align:left;line-height:1.9;padding-left:22px;margin:0">' +
          steps.map(s => '<li>' + s + '</li>').join('') +
        '</ol>' +
        '<div style="margin-top:14px;padding:12px;border-radius:12px;background:var(--surface-soft,#f8fafc);font-size:.88rem">' +
          '<strong>Why install?</strong><br>• Class reminders and result alerts even when the tab is closed<br>' +
          '• Opens instantly from your home screen<br>• Your dashboard still loads when the network drops' +
        '</div>' +
      '</div>';
    if (typeof openModal === 'function') openModal('Install ' + this.brand(), body);
    else if (typeof toast === 'function') toast('Use your browser menu → Install app.', 'info', 6000);
  }
};

window.PWAInstall = PWAInstall;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => PWAInstall.init());
else PWAInstall.init();
