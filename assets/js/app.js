/* ====================================================================
   app.js — Tutoring Connect v16 (School Connect–parity runtime)
   Adapted from School Connect v15 for independent 1:1 and group
   tutoring studios. Free stack. No AI API. No file uploads.
   ==================================================================== */

// Pages that may be viewed WITHOUT signing in.
// Anything not in this list requires an authenticated role; anonymous visitors
// are redirected to login.html. Keep this list tight — it is the privacy gate.
const PUBLIC_PAGES = [
  'login','index','about','contact','apply','register','signup','forgot-password',
  'exam-register','public-book','offline','install','feature-guide',
  'hmg-ecosystem','hmg-products','developer','flyer',''
];

(function () {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  try {
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloaded || !hadController) return;
      reloaded = true;
      try { if (sessionStorage.getItem('tc-sw-reloaded') === '1') return; sessionStorage.setItem('tc-sw-reloaded', '1'); } catch (_) {}
      location.reload();
    });
    window.addEventListener('load', function () {
      setTimeout(function () { try { sessionStorage.removeItem('tc-sw-reloaded'); } catch (_) {} }, 5000);
    });
    navigator.serviceWorker.getRegistration().then(function (reg) { if (reg) reg.update().catch(function () {}); });
  } catch (_) {}
})();

function fmtDMY(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}
function fmtDMYT(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  return fmtDMY(d) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
function fmtDT(v) { return fmtDMYT(v); }
function currentPage() {
  return (location.pathname.split('/').pop() || 'index.html').replace('.html', '').split('?')[0];
}
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
window.fmtDMY = fmtDMY; window.fmtDMYT = fmtDMYT; window.fmtDT = fmtDT; window.esc = esc;
if (window.TC && !window.TC.esc) window.TC.esc = esc;
window.TC = window.TC || {};
window.TC.esc = window.TC.esc || esc;

const App = {
  sb: null,
  currentRole: 'guest',
  currentUserName: '',
  currentProfile: {},
  role: 'guest',
  profile: {},

  ensureScript(src) {
    return new Promise(res => {
      if (document.querySelector('script[src="' + src + '"]')) return res();
      const s = document.createElement('script');
      s.src = src; s.onload = () => res(); s.onerror = () => res();
      document.head.appendChild(s);
    });
  },

  init() {
    if (window.sb && !this.sb) this.sb = window.sb;
    this.bindUI();
    this.installSelectDedupe();
    this.dedupeAllSelects();
    this.applyStoredTheme();
    this.hydrateBrandAssets();
    this.loadRoleAccessMap();
    this.heartbeat();
    this.injectChromeExtras();
    try { if (window.Brand) { Brand.injectSeo && Brand.injectSeo(); Brand.injectFooter && Brand.injectFooter(); } } catch (_) {}
    try { if (window.Media) Media.hydrate && Media.hydrate(); } catch (_) {}

    const page = currentPage();
    if (PUBLIC_PAGES.includes(page)) {
      try { if (window.TCGuard) TCGuard.release(); } catch (_) {}
      this.initAuthTabs();
      this.bootShared();
      return;
    }
    // CBT exam runtime is intentionally public: a learner enters a quiz code +
    // student ID (TC-0001) rather than a portal password. It is NOT an open
    // page — the exam code gates access — so allow it through without a role.
    if (page === 'cbt-exam' || page === 'cbt-multi' || page === 'cbt-review') {
      try { if (window.TCGuard) TCGuard.release(); } catch (_) {}
      this.bootShared();
      return;
    }
    this.applyRoleVisibility();
    this.loadPracticeSettings();
  },

  bootShared() {
    try { if (window.PWAInstall) PWAInstall.init(); } catch (_) {}
    try {
      if (window.Notifications) {
        const currentSb = window.sb || this.sb || null;
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('sw.js').then(reg => Notifications.init(currentSb, reg));
        } else Notifications.init(currentSb);
      }
    } catch (_) {}
    try { if (window.Super) Super.init(window.sb || this.sb || null, window.PRACTICE); } catch (_) {}
    try { if (window.Enterprise) Enterprise.init(window.sb || this.sb || null); } catch (_) {}
    try { if (window.CRUD) CRUD.init(window.sb || this.sb || null); } catch (_) {}
    try { if (window.SiteHelp) SiteHelp.init(); } catch (_) {}
    try { if (window.Chatbot) Chatbot.init(); } catch (_) {}
    try { if (window.DataPortability) DataPortability.init(window.sb || this.sb || null); } catch (_) {}
  },

  heartbeat() {
    const ping = (src) => {
      try {
        if (!window.sb) return;
        const KEY = 'tc-keepalive-at';
        const last = +(localStorage.getItem(KEY) || 0);
        if (Date.now() - last < 6 * 60 * 60 * 1000) return; // at most every 6h per device
        window.sb.rpc('tc_keep_alive', { src: src || 'site-visit' }).then(function (r) {
          if (!r.error) {
            localStorage.setItem(KEY, String(Date.now()));
            console.log('[Tutoring Connect] keep-alive heartbeat ok.', src || 'site-visit');
          }
        }).catch(function () {});
      } catch (_) {}
    };
    ping('site-visit');
    document.addEventListener('visibilitychange', () => { if (!document.hidden) ping('tab-focus'); });
    setInterval(() => { if (!document.hidden) ping('interval-6h'); }, 6 * 60 * 60 * 1000);
  },

  async loadPracticeSettings() {
    try {
      const supabase = window.sb || this.sb || null;
      if (!supabase) return;
      const { data } = await supabase.from('practice_settings').select('*').eq('id', 1).maybeSingle();
      if (data) {
        window.TC_SETTINGS = data;
        window.PRACTICE = window.PRACTICE || {};
        /* -----------------------------------------------------------------
           ITEM 3 FIX (reported): the footer showed "Lumen Tutoring Studio"
           beneath every page, even though that string appears NOWHERE in
           the codebase.

           This line was why. practice_settings.name is read from the
           DATABASE and copied over PRACTICE.name, and the footer renders
           PRACTICE.name. The schema seeds that row with
           `on conflict (id) do nothing`, so a studio whose row was created
           by an early version keeps the OLD seeded name for ever — no
           amount of renaming in the code could ever change it.

           Two defences now:
           1. A retired or generic seed name never overrides the studio's
              own name from config.js. A real studio name always wins.
           2. database/complete-schema.sql rewrites any legacy row.
           ----------------------------------------------------------------- */
        const PLACEHOLDER = /^(lumen tutoring studio|hmg tutoring studio|tutoring connect|my tutoring studio|studio)$/i;
        const ownName = (window.PRACTICE.name || '').trim();
        const dbName = (data.name || '').trim();
        if (dbName && !(PLACEHOLDER.test(dbName) && ownName && !PLACEHOLDER.test(ownName))) {
          window.PRACTICE.name = dbName;
        }
        if (data.motto) window.PRACTICE.motto = data.motto;
        if (data.timezone) window.PRACTICE.timezone = data.timezone;
        if (data.currency) window.PRACTICE.currency = data.currency;
        if (data.logo_url) window.PRACTICE.logoUrl = data.logo_url;
        this.hydrateBrandAssets();
      }
    } catch (_) {}
  },

  hydrateBrandAssets() {
    try {
      const p = window.PRACTICE || {};
      const primary = (p.theme && p.theme.primary) || '#134e4a';
      const accent = (p.theme && p.theme.accent) || '#d97706';
      const root = document.documentElement.style;
      root.setProperty('--primary', primary);
      root.setProperty('--accent', accent);
      root.setProperty('--tc-primary', primary);
      root.setProperty('--tc-accent', accent);
      // Premium themes may ship extra shades; surface them to the CSS.
      if (p.theme) {
        if (p.theme.primaryLight) root.setProperty('--tc-primary-light', p.theme.primaryLight);
        if (p.theme.accentLight) root.setProperty('--tc-accent-light', p.theme.accentLight);
        if (p.theme.bg) { root.setProperty('--surface-soft', p.theme.bg); root.setProperty('--tc-ivory', p.theme.bg); }
      }
      // Derive a readable dark variant for gradients/active states.
      root.setProperty('--tc-primary-dark', (p.theme && p.theme.primaryDark) || primary);
      const logo = p.logoUrl || ('assets/img/logo.' + (p.logoExt || 'svg'));
      document.querySelectorAll('.app-brand img, .pwa-install-icon, .nav-logo img, img[data-logo], img[data-practice-logo]').forEach(img => {
        if (!img) return;
        img.setAttribute('src', (window.Media && p.logoUrl && Media.driveId && Media.driveId(p.logoUrl)) ? Media.driveView(p.logoUrl) : logo);
        img.setAttribute('alt', p.name || 'ADEWALE CLASSROOM');
        if (!img.getAttribute('onerror')) img.setAttribute('onerror', "this.onerror=null;this.src='assets/img/logo.svg'");
      });
      document.querySelectorAll('[data-practice-name], .app-brand strong').forEach(el => {
        if (p.name) el.textContent = p.name;
      });
      document.querySelectorAll('[data-practice-motto]').forEach(el => { if (p.motto) el.textContent = p.motto; });
      document.body.classList.add('layout-' + (p.layout || 'sidebar'));
      // Inject the configured Google Font (e.g. Plus Jakarta Sans for Gosa)
      if (p.font && p.font.css) {
        const fid='tc-brand-font';
        let l=document.getElementById(fid);
        if(!l){ l=document.createElement('link'); l.id=fid; l.rel='stylesheet'; document.head.appendChild(l); }
        l.href='https://fonts.googleapis.com/css2?family='+p.font.css+'&display=swap';
        if (p.font.family) document.documentElement.style.setProperty('--font', "'"+p.font.family.replace(/'/g,"")+"', system-ui, sans-serif");
      }
    } catch (e) { console.warn('Brand hydration skipped:', e.message || e); }
  },

  applyStoredTheme() {
    const saved = localStorage.getItem('tc-theme') || localStorage.getItem('sc-theme');
    if (saved) document.body.dataset.theme = saved;
  },

  initAuthTabs() {
    if (document.getElementById('signin-form') || document.getElementById('form-signin')) this.switchAuthTab('signin');
    const signIn = document.getElementById('form-signin') || document.getElementById('signin-form');
    const signUp = document.getElementById('form-signup') || document.getElementById('signup-form');
    document.querySelectorAll('[data-auth-tab]').forEach(btn => {
      btn.onclick = () => {
        const tab = btn.dataset.authTab;
        this.switchAuthTab(tab === 'up' || tab === 'signup' ? 'signup' : 'signin');
      };
    });
    if (signIn && !signIn._bound) {
      signIn._bound = true;
      signIn.onsubmit = (e) => this.handleSignIn(e);
    }
    if (signUp && !signUp._bound) {
      signUp._bound = true;
      signUp.onsubmit = (e) => this.handleSignUp(e);
    }
  },

  getCachedProfile() {
    try {
      const c = localStorage.getItem('tc-cached-profile');
      if (c) return JSON.parse(c);
    } catch (_) {}
    return null;
  },
  setCachedProfile(p) {
    try { localStorage.setItem('tc-cached-profile', JSON.stringify(p)); } catch (_) {}
  },
  primeUserChip() {
    try {
      const cached = this.getCachedProfile();
      const nameEl = document.getElementById('user-display-name') || document.querySelector('[data-user-name]');
      const roleEl = document.getElementById('user-display-role') || document.querySelector('[data-user-role]');
      if (cached && cached.full_name) {
        if (nameEl) nameEl.textContent = cached.full_name;
        if (roleEl) roleEl.textContent = String(cached.role || '').replace(/_/g, ' ');
      }
    } catch (_) {}
  },
  showDashboardLoading(show) {
    let el = document.getElementById('tc-dash-loading');
    if (!el) {
      el = document.createElement('div');
      el.id = 'tc-dash-loading';
      el.style.cssText = 'position:fixed;inset:0;background:rgba(255,255,255,0.9);display:flex;align-items:center;justify-content:center;z-index:9999;flex-direction:column;gap:16px';
      el.innerHTML = '<div style="width:48px;height:48px;border:4px solid #e2e8f0;border-top-color:#134e4a;border-radius:50%;animation:spin 1s linear infinite"></div><div style="color:#475569;font-weight:700">Loading your studio…</div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>';
      document.body.appendChild(el);
    }
    el.style.display = show ? 'flex' : 'none';
  },

  async resolveAndApplyRole() {
    App.primeUserChip();
    const currentSb = window.sb || this.sb || null;
    const page = currentPage();
    if (page === 'dashboard') this.showDashboardLoading(true);
    const cached = this.getCachedProfile();
    // Optimistic pre-paint only. Never pre-paint a privileged role from an
    // unverified localStorage value — that produced a "flash of admin UI"
    // that a tampered cache could trigger deliberately.
    const preRole = String((cached && cached.role) || '').toLowerCase();
    const preIsPrivileged = App.isOwnerRole(preRole) || ['tutor', 'staff', 'teacher'].includes(preRole);
    if (cached && cached.role && page === 'dashboard' && !preIsPrivileged) {
      try {
        App.currentRole = String(cached.role).toLowerCase();
        App.role = App.currentRole;
        window.TC_PROFILE = cached;
        App.applyRoleDashboard(App.currentRole, cached);
        App.applyRoleNav(App.currentRole);
      } catch (_) {}
    }

    if (!currentSb) {
      // Database not configured. Anonymous visitors must NEVER receive admin.
      // Only an explicit opt-in demo flag (set in config.js or via URL) grants
      // a preview role; everyone else is treated as a guest and bounced to
      // login on protected pages.
      const demoOn = (window.PRACTICE && window.PRACTICE.demo && window.PRACTICE.demo.enabled)
        || /[?&]demo=1/.test(location.search)
        || sessionStorage.getItem('tc-demo') === '1';
      if (demoOn) {
        sessionStorage.setItem('tc-demo', '1');
        const effectiveRole = cached ? (cached.role || 'tutor') : 'tutor';
        App.currentRole = effectiveRole;
        App.role = effectiveRole;
        App.currentProfile = cached || { full_name: 'Studio preview', role: effectiveRole, status: 'approved' };
        App.profile = App.currentProfile;
        window.TC_PROFILE = App.currentProfile;
        App.applyRoleDashboard(effectiveRole, App.currentProfile);
        App.applyRoleNav(effectiveRole);
        App.loadPageData();
        this.bootShared();
        this.showDashboardLoading(false);
        return;
      }
      // No DB and no demo → guest. On a protected page this sends the visitor
      // to login (which explains how to connect Supabase). On public pages the
      // caller already returned before reaching here.
      App.currentRole = 'guest';
      App.role = 'guest';
      this.showDashboardLoading(false);
      location.href = 'login.html?reason=noconfig';
      return;
    }

    let user = null;
    for (let attempt = 0; attempt <= 3; attempt++) {
      try {
        const u = await currentSb.auth.getUser();
        user = u && u.data && u.data.user;
        if (user) break;
      } catch (e) {
        if (attempt < 3) await new Promise(r => setTimeout(r, 400 * Math.pow(2, attempt)));
      }
    }
    if (!user) {
      // BUGFIX (privilege escalation): this previously trusted the localStorage
      // profile cache whenever no session could be read, so anyone could set
      // tc-cached-profile.role = "super_admin" in devtools and render the full
      // admin UI. RLS still protected the DATA, but admin-only navigation,
      // controls and page scaffolding were exposed.
      //
      // The cache is now only honoured when a real Supabase auth token is
      // present (i.e. we are genuinely offline / the token refresh failed),
      // and never for privilege-bearing roles.
      const hasStoredSession = (() => {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && /^sb-.*-auth-token$/.test(k) && localStorage.getItem(k)) return true;
          }
        } catch (_) {}
        return false;
      })();
      const cachedRole = String((cached && cached.role) || '').toLowerCase();
      const cacheIsPrivileged = App.isOwnerRole(cachedRole) || ['tutor', 'staff', 'teacher'].includes(cachedRole);

      if (cached && cached.id && hasStoredSession && !cacheIsPrivileged) {
        App.currentRole = cachedRole || 'parent';
        App.role = App.currentRole;
        window.TC_PROFILE = cached;
        App.applyRoleDashboard(App.currentRole, cached);
        App.applyRoleNav(App.currentRole);
        App.loadPageData();
        this.bootShared();
        this.showDashboardLoading(false);
        try { if (window.TCGuard) TCGuard.release(); } catch (_) {}
        return;
      }
      try { localStorage.removeItem('tc-cached-profile'); } catch (_) {}
      location.href = 'login.html';
      return;
    }

    let role = '', status = 'active', name = '', profile = null;
    try {
      const rpc = await currentSb.rpc('tc_current_role');
      if (rpc && rpc.data && !rpc.error) {
        profile = rpc.data;
        role = String(profile.role || 'parent').toLowerCase();
        status = String(profile.status || 'active').toLowerCase();
        name = profile.full_name || user.email || 'User';
      }
    } catch (_) {}
    if (!role) {
      try {
        const { data } = await currentSb.from('profiles').select('*').eq('id', user.id).maybeSingle();
        profile = data || profile;
        role = (profile && profile.role) || user.user_metadata?.role || 'parent';
        status = (profile && profile.status) || 'pending';
        name = (profile && profile.full_name) || user.user_metadata?.full_name || user.email || 'User';
      } catch (_) {
        role = user.user_metadata?.role || cached?.role || 'parent';
        status = 'active';
        name = user.user_metadata?.full_name || cached?.full_name || user.email || 'User';
      }
    }
    if (status === 'pending') {
      document.body.innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:40px"><div style="max-width:440px;text-align:center;background:#ffffff;color:#0f172a;padding:40px;border-radius:16px"><h2 style="margin-bottom:12px">⏳ Account pending approval</h2><p>Your account is awaiting studio admin approval. This keeps family data closed until someone you know lets you in.</p><a href="login.html" class="btn btn-primary" style="margin-top:16px">Back to Login</a></div></div>';
      return;
    }
    if (status === 'suspended') {
      document.body.innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:40px"><div style="max-width:440px;text-align:center;background:#ffffff;color:#0f172a;padding:40px;border-radius:16px"><h2>🚫 Account suspended</h2><p>Please contact the studio administrator.</p><a href="login.html" class="btn btn-outline" style="margin-top:16px">Back to Login</a></div></div>';
      return;
    }
    App.currentRole = String(role).toLowerCase();
    App.role = App.currentRole;
    App.currentUserName = name;
    App.currentProfile = Object.assign({ id: user.id, email: user.email }, profile || {}, { role, status, full_name: name });
    App.profile = App.currentProfile;
    window.TC_PROFILE = App.currentProfile;
    this.setCachedProfile(window.TC_PROFILE);
    App.applyVisibilityTokens(App.currentRole);
    App.applyRoleDashboard(App.currentRole, App.currentProfile);
    App.applyRoleNav(App.currentRole);
    App.loadPageData();
    this.bootShared();
    this.showDashboardLoading(false);
    App._roleResolved = true;
    try { if (window.TCGuard) TCGuard.release(); } catch (_) {}
  },

  applyRoleVisibility() {
    try { return Promise.resolve(App.resolveAndApplyRole()); } catch (e) { console.warn('applyRoleVisibility failed:', e); }
  },

  isOwnerRole(role) {
    return ['super_admin', 'superadmin', 'admin', 'administrator', 'owner', 'director', 'lead_tutor'].includes(String(role || '').toLowerCase().replace(/\s+/g, '_'));
  },
  isAdminRole(role) { return this.isOwnerRole(role); },
  isAdmin(role) { return this.isAdminRole(role || this.currentRole || this.role); },
  isManagerRole(role) { return this.isAdminRole(role); },
  isTutorRole(role) {
    const r = String(role || this.currentRole || '').toLowerCase();
    return this.isAdminRole(r) || ['tutor', 'staff', 'teacher', 'lead_tutor'].includes(r);
  },

  roleSet(role) {
    const r = String(role || '').toLowerCase();
    const set = new Set([r]);
    if (r === 'tutor' || r === 'teacher') { set.add('staff'); set.add('tutor'); }
    if (r === 'staff') set.add('tutor');
    if (r === 'learner') set.add('student');
    if (r === 'student') set.add('learner');
    if (this.isOwnerRole(r)) ['admin', 'staff', 'tutor', 'parent', 'student', 'learner'].forEach(x => set.add(x));
    return set;
  },

  normalizeModuleId(id) {
    id = String(id || '').replace(/\.html(\?.*)?$/, '').replace(/^.*\//, '').trim();
    const map = {
      'admin-data': 'admin_data', 'activity-log': 'activity_log', 'cbt-prompts': 'cbt_prompts',
      'cbt-exam': 'cbt_exam', 'cbt-multi': 'cbt_multi', 'cbt-review': 'cbt_review',
      'session-complete': 'session_complete', 'session-notes': 'session_notes',
      'learner-360': 'learner_360', 'group-insights': 'group_insights',
      'at-risk': 'atrisk', 'exam-targets': 'exam_targets', 'value-added': 'value_added',
      'learning-styles': 'learning_styles', 'lesson-plans': 'lesson_plans',
      'progress-reports': 'progress_reports', 'parent-meetings': 'parent_meetings',
      'payment-history': 'payment_history', 'platform-health': 'platform_health',
      'status-manager': 'status_manager', 'feature-guide': 'feature_guide',
      'hmg-ecosystem': 'hmg_ecosystem', 'hmg-products': 'hmg_products',
      'exam-links': 'exam_links', 'exam-register': 'exam_register',
      'application-links': 'application_links', 'digital-library': 'digital_library',
      'e-resources': 'eresources'
    };
    return map[id] || id.replace(/-/g, '_');
  },

  FAMILY_BLACKLIST: new Set([
    'admin_data', 'admin-data', 'analytics', 'finance', 'payroll', 'storage',
    'compliance', 'activity_log', 'activity-log', 'settings', 'approvals',
    'tutors', 'inquiries', 'waitlist', 'safeguarding', 'license', 'status_manager',
    'status-manager', 'platform_health', 'platform-health', 'developer',
    'cbt_prompts', 'cbt-prompts', 'application_links', 'application-links'
  ]),
  STUDENT_WHITELIST: new Set([
    'dashboard', 'profile', 'change-password', 'change_password', 'notifications',
    'learner-360', 'learner_360', 'attendance', 'assignments', 'practice',
    'cbt-exam', 'cbt_exam', 'cbt-review', 'cbt_review', 'scoresheet', 'reading',
    'reminders', 'study-log', 'study_log', 'makeup-credits', 'makeup_credits', 'public-book', 'public_book',
    'forum', 'stream', 'classwork', 'inbox', 'complaints', 'announcements',
    'events', 'gallery', 'certificates', 'flashcards', 'resources', 'library',
    'lms', 'eresources', 'digital_library', 'goals', 'mastery', 'calendar',
    'sessions', 'bookings', 'session-complete', 'session_complete',
    'feature-guide', 'feature_guide', 'about', 'contact', 'voting', 'polls',
    'surveys', 'hmg_ecosystem', 'hmg_products', 'ecosystem', 'idcards',
    'progress_reports', 'progress-reports', 'exam_targets', 'exam-targets'
  ]),
  PARENT_WHITELIST: new Set([
    'reminders','study-log','study_log','makeup-credits','makeup_credits','public-book','public_book',
    'dashboard', 'profile', 'change-password', 'change_password', 'notifications',
    'learners', 'learner-360', 'learner_360', 'attendance', 'assignments',
    'cbt-exam', 'cbt_exam', 'scoresheet', 'reading', 'inbox', 'complaints',
    'announcements', 'events', 'gallery', 'certificates', 'invoices', 'payments',
    'payment_history', 'payment-history', 'packages', 'fees', 'calendar',
    'sessions', 'bookings', 'progress_reports', 'progress-reports', 'insights',
    'exam_targets', 'exam-targets', 'predictions', 'value_added', 'value-added',
    'parent_meetings', 'parent-meetings', 'feature-guide', 'feature_guide',
    'about', 'contact', 'voting', 'polls', 'surveys', 'hmg_ecosystem',
    'hmg_products', 'apply', 'forum', 'stream', 'classwork', 'idcards',
    'resources', 'library'
  ]),

  moduleAllowedForRole(moduleId, role) {
    const id = this.normalizeModuleId(moduleId);
    const r = String(role || '').toLowerCase();
    if (r === 'learner') return this.moduleAllowedForRole(id, 'student');
    if (r === 'parent') {
      if (this.FAMILY_BLACKLIST.has(id)) return false;
      return this.PARENT_WHITELIST.has(id);
    }
    if (r === 'student') {
      if (this.FAMILY_BLACKLIST.has(id)) return false;
      return this.STUDENT_WHITELIST.has(id);
    }
    return true;
  },

  canWriteModule(moduleId, role) {
    const r = String(role || this.currentRole || '').toLowerCase();
    if (this.isOwnerRole(r)) return true;
    if (r === 'parent' || r === 'student' || r === 'learner') return false;
    if (['tutor', 'staff', 'teacher'].includes(r)) return true;
    return false;
  },

  canAccessAllowList(allowText, role) {
    const allow = String(allowText || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!allow.length) return this.isAdminRole(role);
    if (allow.some(x => ['any', 'all', 'public'].includes(x))) return true;
    const roles = this.roleSet(role);
    return allow.some(a => roles.has(a));
  },

  canAccessPage(pageFileName, role) {
    if (this.isOwnerRole(role)) return true;
    const id = this.normalizeModuleId(pageFileName);
    return this.moduleAllowedForRole(id, role);
  },

  roleAccessMap: null,
  roleWriteMap: null,
  loadRoleAccessMap() {
    try {
      const saved = localStorage.getItem('tc-role-access-map');
      this.roleAccessMap = saved ? JSON.parse(saved) : null;
      const wsaved = localStorage.getItem('tc-role-write-map');
      this.roleWriteMap = wsaved ? JSON.parse(wsaved) : null;
    } catch (e) { this.roleAccessMap = null; }
    const supabase = window.sb || this.sb;
    if (supabase && supabase.from) {
      try {
        supabase.from('practice_settings').select('role_access,role_write').eq('id', 1).maybeSingle().then(({ data }) => {
          if (data) {
            if (data.role_access && typeof data.role_access === 'object') {
              this.roleAccessMap = data.role_access;
              localStorage.setItem('tc-role-access-map', JSON.stringify(data.role_access));
            }
            if (data.role_write && typeof data.role_write === 'object') {
              this.roleWriteMap = data.role_write;
              localStorage.setItem('tc-role-write-map', JSON.stringify(data.role_write));
            }
            if (this.currentRole) {
              this.applyRoleNav(this.currentRole);
              this.applyRoleDashboard(this.currentRole, this.currentProfile);
            }
          }
        }).catch(() => {});
      } catch (e) {}
    }
  },

  allowTextForElement(el) {
    const rawId = el && (el.getAttribute('data-module-id') || el.getAttribute('data-module') || el.getAttribute('href') || '');
    const id = this.normalizeModuleId(rawId);
    const map = this.roleAccessMap || {};
    if (map[id] && Array.isArray(map[id])) {
      return ['super_admin', 'admin', 'owner', 'director'].concat(map[id]).join(' ');
    }
    return (el && el.getAttribute('data-role-allow')) || '';
  },

  NAV_ORDER: [
    'dashboard', 'profile', 'notifications', 'engagements', 'learners', 'groups',
    'parents', 'tutors', 'subjects', 'inquiries', 'waitlist', 'trials', 'onboarding',
    'calendar', 'sessions', 'availability', 'bookings', 'attendance', 'makeups',
    'cancellations', 'session_notes', 'session_complete', 'meetings', 'whiteboard',
    'sow', 'curriculum', 'lesson_plans', 'diagnostics', 'goals', 'mastery',
    'methodologies', 'assignments', 'practice', 'cbt_exam', 'cbt_multi', 'cbt_prompts',
    'cbt_review', 'reading', 'classwork', 'stream', 'scoresheet', 'progress_reports',
    'insights', 'learner_360', 'group_insights', 'atrisk', 'exam_targets',
    'predictions', 'value_added', 'analytics', 'resources', 'library', 'lms',
    'eresources', 'flashcards', 'certificates', 'portfolio', 'packages', 'invoices',
    'payments', 'payment_history', 'fees', 'finance', 'payroll', 'announcements',
    'messages', 'inbox', 'complaints', 'surveys', 'voting', 'polls', 'forum',
    'parent_meetings', 'reviews', 'broadcasts', 'gallery', 'birthdays', 'directory',
    'helpdesk', 'documents', 'policies', 'idcards', 'events', 'apply',
    'application_links', 'exam_links', 'exam_register', 'approvals', 'settings',
    'admin_data', 'storage', 'activity_log', 'platform_health', 'status_manager',
    'license', 'feature_guide', 'hmg_ecosystem', 'hmg_products'
  ],

  ESSENTIAL_NAV: [
    ['profile', '👤', 'My profile', 'profile.html', 'any'],
    ['notifications', '🔔', 'Notifications', 'notifications.html', 'any'],
    ['voting', '🗳️', 'Voting & polls', 'voting.html', 'any'],
    ['hmg_ecosystem', '🌐', 'HMG Ecosystem', 'hmg-ecosystem.html', 'any'],
    ['feature_guide', '📘', 'Feature guide', 'feature-guide.html', 'any']
  ],

  ensureEssentialNav() {
    const nav = document.querySelector('.app-nav');
    if (!nav) return;
    this.ESSENTIAL_NAV.forEach(([id, icon, label, href, allow]) => {
      if (nav.querySelector('[data-module-id="' + id + '"], [data-module="' + id + '"]')) return;
      const a = document.createElement('a');
      a.href = href;
      a.dataset.moduleId = id;
      a.dataset.module = id;
      a.dataset.roleAllow = allow;
      a.innerHTML = '<span class="app-nav-icon">' + icon + '</span><span>' + label + '</span>';
      nav.appendChild(a);
    });
  },

  injectNavSearch() {
    try {
      const nav = document.querySelector('.app-nav');
      if (!nav || document.getElementById('nav-search-box')) return;
      const wrap = document.createElement('div');
      wrap.id = 'nav-search-box';
      wrap.style.cssText = 'padding:8px 10px 4px;position:sticky;top:0;background:inherit;z-index:5';
      wrap.innerHTML = '<div style="position:relative">' +
        '<input id="nav-search" type="search" placeholder="🔎 Search pages…" autocomplete="off" ' +
        'style="width:100%;padding:8px 30px 8px 12px;border:1px solid var(--gray-200,#e2e8f0);border-radius:10px;font-size:.85rem;background:var(--white,#fff);color:inherit">' +
        '<button id="nav-search-clear" title="Clear" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);border:0;background:none;cursor:pointer;font-size:.9rem;display:none">✕</button></div>' +
        '<div id="nav-search-empty" style="display:none;font-size:.75rem;color:var(--gray-500,#64748b);padding:6px 2px">No pages match.</div>';
      nav.insertBefore(wrap, nav.firstChild);
      const inp = wrap.querySelector('#nav-search');
      const clr = wrap.querySelector('#nav-search-clear');
      const empty = wrap.querySelector('#nav-search-empty');
      /* -----------------------------------------------------------------
         BUG FIX 3 (reported): "the search box on the navigation pane is
         not working — when a page is typed, nothing comes up."

         The filter itself matched correctly, but it only ever toggled the
         <a> elements. The <div class="nav-section-title"> headings were
         left visible, so a search for "wallet" produced eleven section
         headings with one link buried among them — which reads as
         "nothing came up". Worse, the match was tested against
         a.textContent, which on this markup includes the bullet glyph and
         collapsed whitespace, so multi-word searches such as "payment
         plan" failed outright.

         BUG FIX 2 (reported): "the navigation pane has many empty spaces
         and gaps before the first item."

         Same root cause seen from the other end: section headings whose
         links are ALL hidden by the role filter stay on screen as empty
         labelled gaps. A parent, who can see very few pages, saw a column
         of headings with nothing under them.

         Both are fixed by making the section heading follow its contents:
         a heading is shown only when at least one link beneath it is
         visible. The search text is also normalised, and now matches the
         page's href and module id as well as its label.
         ----------------------------------------------------------------- */
      const norm = (t) => String(t || '')
        .replace(/[•·\u2022]/g, ' ')          // strip bullet glyphs
        .replace(/\s+/g, ' ')                 // collapse whitespace
        .trim().toLowerCase();

      const syncSections = () => {
        // Show a section heading only if something under it is visible.
        const kids = [...nav.children];
        kids.forEach((el, i) => {
          if (!el.classList || !el.classList.contains('nav-section-title')) return;
          let visible = 0;
          for (let j = i + 1; j < kids.length; j++) {
            const n = kids[j];
            if (n.classList && n.classList.contains('nav-section-title')) break;
            if (n.tagName === 'A' && n.style.display !== 'none') visible++;
          }
          el.style.display = visible ? '' : 'none';
        });
      };
      this._syncNavSections = syncSections;

      const apply = () => {
        const q = norm(inp.value);
        clr.style.display = q ? '' : 'none';
        let shown = 0;
        nav.querySelectorAll('a[data-module-id], a[data-module]').forEach(a => {
          const roleHidden = a.dataset.navRoleHidden === '1';
          const hay = [
            norm(a.textContent),
            norm((a.getAttribute('data-module-id') || a.getAttribute('data-module') || '').replace(/[-_]/g, ' ')),
            norm((a.getAttribute('href') || '').replace(/\.html$/, '').replace(/[-_]/g, ' '))
          ].join(' ');
          // Every word typed must appear somewhere, so "payment plan" works.
          const match = !q || q.split(' ').every(w => hay.indexOf(w) !== -1);
          a.style.display = (roleHidden || !match) ? 'none' : '';
          if (!roleHidden && match) shown++;
        });
        syncSections();
        empty.style.display = (q && !shown) ? '' : 'none';
      };
      inp.addEventListener('input', apply);
      inp.addEventListener('keydown', e => { if (e.key === 'Escape') { inp.value = ''; apply(); inp.blur(); } });
      clr.addEventListener('click', () => { inp.value = ''; apply(); inp.focus(); });
    } catch (e) {}
  },

  normalizeNavOrder() {
    try {
      const nav = document.querySelector('.app-nav');
      if (!nav) return;
      const links = [...nav.querySelectorAll('a[data-module-id], a[data-module]')];
      if (links.length < 2) return;
      const seen = new Set();
      links.forEach(a => {
        const id = this.normalizeModuleId(a.getAttribute('data-module-id') || a.getAttribute('data-module') || a.getAttribute('href'));
        if (seen.has(id)) a.remove(); else seen.add(id);
      });
      const remaining = [...nav.querySelectorAll('a[data-module-id], a[data-module]')];
      const rank = (a) => {
        const id = this.normalizeModuleId(a.getAttribute('data-module-id') || a.getAttribute('data-module'));
        const i = this.NAV_ORDER.indexOf(id);
        return i === -1 ? this.NAV_ORDER.length + remaining.indexOf(a) : i;
      };
      remaining.sort((a, b) => rank(a) - rank(b)).forEach(a => nav.appendChild(a));
    } catch (e) {}
  },

  markActiveNav() {
    try {
      const pageFile = (location.pathname.split('/').pop() || 'index.html').split('?')[0];
      const pageId = this.normalizeModuleId(pageFile.replace(/\.html$/, ''));
      document.querySelectorAll('.app-nav a').forEach(a => {
        const hrefFile = ((a.getAttribute('href') || '').split('/').pop() || '').split('?')[0];
        const mid = this.normalizeModuleId(a.getAttribute('data-module-id') || a.getAttribute('data-module') || hrefFile);
        const active = mid === pageId || hrefFile === pageFile;
        a.classList.toggle('active', !!active);
        if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      });
    } catch (_) {}
  },

  applyRoleNav(role) {
    document.body.dataset.roleReady = '1';
    document.body.dataset.currentRole = String(role || '').toLowerCase();
    document.body.dataset.role = String(role || '').toLowerCase();
    this.ensureEssentialNav();
    this.normalizeNavOrder();
    this.markActiveNav();
    this.injectNavSearch();
    const links = [...document.querySelectorAll('[data-role-allow], .app-nav a')];
    const isAdmin = this.isOwnerRole(role);
    let navShowMap = {};
    try { navShowMap = JSON.parse(localStorage.getItem('tc-nav-show-map') || '{}'); } catch (_) {}
    links.forEach(el => {
      const moduleId = el.getAttribute('data-module-id') || el.getAttribute('data-module') || el.getAttribute('href') || '';
      const familyReadOnly = ['parent', 'student', 'learner'].includes(String(role || '').toLowerCase()) && this.moduleAllowedForRole(moduleId, role);
      const allowOk = familyReadOnly || (this.canAccessAllowList(this.allowTextForElement(el) || 'any', role) && this.moduleAllowedForRole(moduleId, role));
      let ok = allowOk;
      if (ok && navShowMap[this.normalizeModuleId(moduleId)] && Array.isArray(navShowMap[this.normalizeModuleId(moduleId)]) && !isAdmin) {
        const roles = this.roleSet(role);
        const visible = navShowMap[this.normalizeModuleId(moduleId)].some(r => roles.has(r));
        if (!visible) ok = false;
      }
      if (isAdmin) {
        el.style.display = '';
        el.dataset.navRoleHidden = '0';
      } else {
        el.style.display = ok ? '' : 'none';
        el.dataset.navRoleHidden = ok ? '0' : '1';
      }
    });
    this.applyVisibilityTokens(role);
    this.ensureNavNotBlank(role);
    /* Tell rbac.js the role is known, so it can hide pages this role may not
       reach and drop read-only pages into view-only mode. */
    try {
      document.dispatchEvent(new CustomEvent('tc:role', { detail: role }));
    } catch (e) {}
    /* BUG FIX 2 — collapse section headings that have no visible links.
       Without this a parent (who can reach very few pages) sees a column
       of headings with nothing underneath: the "empty spaces and gaps"
       reported before the first item. Guarded because the role filter can
       run before the search box has been injected. */
    try { if (this._syncNavSections) this._syncNavSections(); } catch (e) {}
    this.enforceCurrentPageAccess(role);
    this.refreshCurrentCrudAfterRole(role);
    this.paintUser();
  },

  applyVisibilityTokens(role) {
    const allow = (selector, yes) => document.querySelectorAll(selector).forEach(el => { el.style.display = yes ? '' : 'none'; });
    const r = String(role || '').toLowerCase();
    const isAdmin = this.isManagerRole(r);
    const isOwner = this.isOwnerRole(r);
    const isStaff = ['staff', 'tutor', 'teacher'].includes(r);
    const isParent = r === 'parent';
    const isStudent = r === 'student' || r === 'learner';
    allow('[data-admin-only]', isAdmin);
    allow('[data-owner-only]', isOwner);
    allow('[data-staff-only]', isAdmin || isStaff);
    allow('[data-parent-only]', isParent);
    allow('[data-student-only]', isStudent);
    allow('[data-family-only]', isAdmin || isStaff || isParent || isStudent);
    allow('[data-nonadmin-only]', !isAdmin);
    document.querySelectorAll('[data-signout]').forEach(el => {
      el.style.display = (r === 'guest' || r === 'demo') ? 'none' : '';
    });
  },

  ensureNavNotBlank(role) {
    const nav = document.querySelector('.app-nav');
    if (!nav) return;
    const links = [...nav.querySelectorAll('a')].filter(a => a.style.display !== 'none' && a.id !== 'nav-search');
    if (links.length) return;
    const safe = new Set(['dashboard.html', 'notifications.html', 'feature-guide.html', 'about.html', 'contact.html']);
    [...nav.querySelectorAll('a')].forEach(a => {
      if (safe.has((a.getAttribute('href') || '').toLowerCase())) {
        a.style.display = '';
        a.dataset.navRoleHidden = '0';
      }
    });
  },

  enforceCurrentPageAccess(role) {
    if (!role || role === 'guest' || role === 'demo' || role === 'pending') return;
    if (this.isOwnerRole(role)) return;
    const shell = document.querySelector('.app-layout[data-require-role]');
    if (!shell) return;
    const active = document.querySelector('.app-nav a.active');
    const activeId = active ? (active.getAttribute('data-module-id') || active.getAttribute('href') || '') : currentPage();
    if (this.moduleAllowedForRole(activeId, role)) return;
    const pageTitle = (active && active.textContent.trim()) || document.title || 'this page';
    const content = document.querySelector('.app-content');
    if (content) {
      content.innerHTML = '<div class="card" style="max-width:760px;margin:30px auto;text-align:center;border-color:#fecaca;background:#fff7f7;padding:40px;border-radius:18px">' +
        '<div style="font-size:3rem;margin-bottom:16px">🔒</div>' +
        '<h2 style="margin-bottom:12px">Restricted Page</h2>' +
        '<p style="color:var(--gray-700);margin-bottom:16px">Your role (<strong>' + esc(role) + '</strong>) does not have permission to access <strong>' + esc(pageTitle) + '</strong>.</p>' +
        '<a class="btn btn-primary" href="dashboard.html">Return to Dashboard</a></div>';
    }
  },

  refreshCurrentCrudAfterRole(role) {
    try {
      const page = currentPage();
      const mid = this.normalizeModuleId(page);
      if (window.CRUD && CRUD.def && CRUD.def(mid)) {
        clearTimeout(App._crudRoleTimer);
        App._crudRoleTimer = setTimeout(() => {
          try { CRUD.renderList(mid); } catch (e) {}
        }, 400);
      }
    } catch (e) {}
  },

  applyRoleDashboard(role, profile) {
    const name = (profile && (profile.full_name || profile.email)) || 'User';
    const prettyRole = String(role || 'user').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const roleMap = {
      super_admin: ['admin'], admin: ['admin'], owner: ['admin'], director: ['admin'], lead_tutor: ['admin'],
      staff: ['staff'], tutor: ['staff'], teacher: ['staff'],
      parent: ['parent'], student: ['student'], learner: ['student'],
      demo: ['admin'], guest: ['guest']
    };
    const effectiveRoles = new Set(roleMap[role] || [role]);
    document.querySelectorAll('#user-display-name, #dash-user-name, [data-user-name]').forEach(el => { el.textContent = name; });
    document.querySelectorAll('#user-display-role, #dash-user-role, [data-user-role]').forEach(el => { el.textContent = prettyRole; });
    document.querySelectorAll('[data-dash-role]').forEach(el => {
      const roles = (el.getAttribute('data-dash-role') || '').split(/\s+/).filter(Boolean);
      const show = roles.some(r => effectiveRoles.has(r));
      el.style.display = show ? '' : 'none';
    });
    const q = document.getElementById('dash-quick-links');
    if (q) {
      const links = role === 'parent' ? [
        ['My children', 'learners.html'], ['Next classes', 'bookings.html'], ['Scoresheet', 'scoresheet.html'],
        ['Attendance', 'attendance.html'], ['Invoices', 'invoices.html'], ['Inbox', 'inbox.html'],
        ['Announcements', 'announcements.html'], ['Insights', 'insights.html']
      ] : (role === 'student' || role === 'learner') ? [
        ['Take quiz', 'cbt-exam.html'], ['Reading', 'reading.html'], ['Scoresheet', 'scoresheet.html'],
        ['Assignments', 'assignments.html'], ['Stream', 'stream.html'], ['My classes', 'bookings.html'],
        ['Flashcards', 'flashcards.html'], ['Inbox', 'inbox.html']
      ] : this.isTutorRole(role) && !this.isOwnerRole(role) ? [
        ['Engagements', 'engagements.html'], ['Complete a class', 'session-complete.html'],
        ['Scheme of work', 'sow.html'], ['CBT manager', 'practice.html'], ['Attendance', 'attendance.html'],
        ['Inbox', 'inbox.html'], ['Insights', 'insights.html']
      ] : [
        ['Engagements', 'engagements.html'], ['Learners', 'learners.html'], ['Cycle bookings', 'bookings.html'],
        ['Inquiries', 'inquiries.html'], ['Hour banks', 'packages.html'], ['Insights', 'insights.html'],
        ['Approvals', 'approvals.html'], ['Admin data', 'admin-data.html']
      ];
      q.innerHTML = links.filter(link => this.canAccessPage(link[1], role))
        .map(x => '<a class="btn btn-outline btn-sm" href="' + x[1] + '">' + x[0] + '</a>').join('');
    }
    this.injectAccessManager(role);
    if (role === 'parent' || this.isAdminRole(role)) {
      setTimeout(() => this.renderParentChildrenDashboard(role), 50);
    }
  },

  paintUser() {
    const name = (this.currentProfile && (this.currentProfile.full_name || this.currentProfile.email)) || 'User';
    document.querySelectorAll('[data-user-name]').forEach(el => { el.textContent = name; });
    document.querySelectorAll('[data-user-role]').forEach(el => { el.textContent = this.currentRole; });
  },

  async renderParentChildrenDashboard(role) {
    const box = document.getElementById('dash-parent-kids');
    if (!box) return;
    const supabase = window.sb || this.sb || null;
    const profile = window.TC_PROFILE || {};
    if (!supabase || !supabase.from) {
      box.innerHTML = '<div style="color:var(--gray-500)">Connect Supabase to display linked children. Each child stays in their own engagement — siblings never smear scores.</div>';
      return;
    }
    try {
      const isParent = String(profile.role || role || '').toLowerCase() === 'parent';
      if (!isParent || !profile.id) {
        box.innerHTML = '<div style="color:var(--gray-500)">Admin inspection mode: sign in as a parent to see real linked children here.</div>';
        return;
      }
      const { data: links, error: linkErr } = await supabase.from('parent_learner').select('learner_id,relationship').eq('parent_id', profile.id);
      if (linkErr) throw linkErr;
      const ids = (links || []).map(x => x.learner_id).filter(Boolean);
      if (!ids.length) {
        box.innerHTML = '<div class="card" style="background:#fff7ed;border-color:#fed7aa"><b>No child linked yet.</b><br><span style="color:#9a3412">Ask the studio admin to link your parent account on the Parents page.</span></div>';
        return;
      }
      const { data: kids, error: kidErr } = await supabase.from('learners').select('id,full_name,year_group,student_no,photo_url,school_name').in('id', ids).order('full_name');
      if (kidErr) throw kidErr;
      const rel = {};
      (links || []).forEach(l => { rel[l.learner_id] = l.relationship || 'Parent'; });
      box.innerHTML = (kids || []).map(k => {
        const photo = k.photo_url
          ? '<img src="' + esc(k.photo_url) + '" referrerpolicy="no-referrer" style="width:48px;height:48px;border-radius:14px;object-fit:cover;border:1px solid var(--gray-200)">'
          : '<div style="width:48px;height:48px;border-radius:14px;background:#ecfdf5;display:flex;align-items:center;justify-content:center;font-size:1.5rem">◎</div>';
        return '<div style="display:flex;gap:12px;align-items:flex-start;border:1px solid var(--gray-200);border-radius:14px;padding:12px;background:#fff">' + photo +
          '<div style="flex:1;min-width:0"><b>' + esc(k.full_name || 'Learner') + '</b><div style="font-size:.82rem;color:var(--gray-500)">' +
          esc(k.student_no || '') + ' · ' + esc(k.year_group || '') + ' · ' + esc(rel[k.id] || 'Parent') + '</div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">' +
          '<a class="btn btn-outline btn-sm" href="learner-360.html?learner=' + encodeURIComponent(k.id) + '">360</a>' +
          '<a class="btn btn-outline btn-sm" href="bookings.html?learner=' + encodeURIComponent(k.id) + '">Classes</a>' +
          '<a class="btn btn-outline btn-sm" href="scoresheet.html?learner=' + encodeURIComponent(k.id) + '">Scores</a>' +
          '<a class="btn btn-outline btn-sm" href="attendance.html?learner=' + encodeURIComponent(k.id) + '">Attendance</a>' +
          '</div></div></div>';
      }).join('') || '<div style="color:var(--gray-500)">No linked learner record was found.</div>';
    } catch (e) {
      box.innerHTML = '<div style="color:#b91c1c">Could not load linked children: ' + esc(e.message || e) + '</div>';
    }
  },

  collectAccessRows() {
    const seen = new Map();
    document.querySelectorAll('.app-nav a[data-module-id], .app-nav a[data-module]').forEach(a => {
      const id = this.normalizeModuleId(a.getAttribute('data-module-id') || a.getAttribute('data-module') || a.getAttribute('href'));
      if (!id || seen.has(id)) return;
      seen.set(id, {
        id,
        label: a.textContent.trim().replace(/\s+/g, ' '),
        href: a.getAttribute('href') || '#',
        allow: this.allowTextForElement(a)
      });
    });
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
  },

  injectAccessManager(role) {
    if (!this.isOwnerRole(role) || currentPage() !== 'dashboard') return;
    const content = document.querySelector('.app-content');
    if (!content || document.getElementById('role-access-manager')) return;
    const rows = this.collectAccessRows();
    const readHas = (allow, r) => this.canAccessAllowList(allow || 'any', r);
    const writeMap = this.roleWriteMap || {};
    const writeHas = (id, r) => {
      if (writeMap[id] && Array.isArray(writeMap[id])) return writeMap[id].includes(r);
      return this.canWriteModule(id, r);
    };
    const navShowMap = JSON.parse(localStorage.getItem('tc-nav-show-map') || '{}');
    const navShows = (id, roleKey) => {
      if (navShowMap[id] && Array.isArray(navShowMap[id])) return navShowMap[id].includes(roleKey);
      return true;
    };
    const html = '<section id="role-access-manager" class="card" style="margin-top:18px;border:2px solid rgba(19,78,74,.25)">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">' +
      '<div><h2 style="margin:0 0 6px">🔐 Page Access & Permission Manager</h2>' +
      '<p style="margin:0;color:var(--gray-600);max-width:920px">Owner controls which portal pages appear for Tutors, Parents and Learners, and who can read/write. <b>Nav</b> = sidebar, <b>Read</b> = open the page, <b>Write</b> = Add/Edit/Delete. Admin always keeps full access.</p></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" type="button" onclick="App.saveAccessManager()">💾 Save all</button><button class="btn btn-outline" type="button" onclick="App.resetAccessManager()">↺ Reset</button></div></div>' +
      '<div class="table-wrap" style="margin-top:14px;max-height:560px;overflow:auto"><table><thead><tr><th>Page</th><th colspan="3">Tutor</th><th colspan="3">Parent</th><th colspan="3">Learner</th><th>File</th></tr><tr><th></th><th>Nav</th><th>Read</th><th>Write</th><th>Nav</th><th>Read</th><th>Write</th><th>Nav</th><th>Read</th><th>Write</th><th></th></tr></thead><tbody>' +
      rows.map(r => '<tr data-access-row="' + esc(r.id) + '"><td><strong>' + esc(r.label) + '</strong><br><small>' + esc(r.id) + '</small></td>' +
        '<td style="text-align:center"><input type="checkbox" data-nav-role="staff" ' + (navShows(r.id, 'staff') ? 'checked' : '') + '></td>' +
        '<td style="text-align:center"><input type="checkbox" data-access-role="staff" ' + (readHas(r.allow, 'tutor') ? 'checked' : '') + '></td>' +
        '<td style="text-align:center"><input type="checkbox" data-write-role="staff" ' + (writeHas(r.id, 'tutor') ? 'checked' : '') + '></td>' +
        '<td style="text-align:center"><input type="checkbox" data-nav-role="parent" ' + (navShows(r.id, 'parent') ? 'checked' : '') + '></td>' +
        '<td style="text-align:center"><input type="checkbox" data-access-role="parent" ' + (readHas(r.allow, 'parent') ? 'checked' : '') + '></td>' +
        '<td style="text-align:center"><input type="checkbox" data-write-role="parent" ' + (writeHas(r.id, 'parent') ? 'checked' : '') + '></td>' +
        '<td style="text-align:center"><input type="checkbox" data-nav-role="student" ' + (navShows(r.id, 'student') ? 'checked' : '') + '></td>' +
        '<td style="text-align:center"><input type="checkbox" data-access-role="student" ' + (readHas(r.allow, 'student') ? 'checked' : '') + '></td>' +
        '<td style="text-align:center"><input type="checkbox" data-write-role="student" ' + (writeHas(r.id, 'student') ? 'checked' : '') + '></td>' +
        '<td><small>' + esc(r.href) + '</small></td></tr>').join('') +
      '</tbody></table></div></section>';
    content.insertAdjacentHTML('beforeend', html);
  },

  async saveAccessManager() {
    const readMap = {}, writeMap = {}, navShowMap = {};
    document.querySelectorAll('#role-access-manager [data-access-row]').forEach(row => {
      const id = row.getAttribute('data-access-row');
      readMap[id] = [...row.querySelectorAll('[data-access-role]:checked')].map(c => c.getAttribute('data-access-role'));
      writeMap[id] = [...row.querySelectorAll('[data-write-role]:checked')].map(c => c.getAttribute('data-write-role'));
      navShowMap[id] = [...row.querySelectorAll('[data-nav-role]:checked')].map(c => c.getAttribute('data-nav-role'));
    });
    this.roleAccessMap = readMap;
    this.roleWriteMap = writeMap;
    try {
      localStorage.setItem('tc-nav-show-map', JSON.stringify(navShowMap));
      localStorage.setItem('tc-role-access-map', JSON.stringify(readMap));
      localStorage.setItem('tc-role-write-map', JSON.stringify(writeMap));
    } catch (e) {}
    const supabase = window.sb || this.sb;
    if (supabase && supabase.from) {
      try { await supabase.from('practice_settings').upsert({ id: 1, role_access: readMap, role_write: writeMap }, { onConflict: 'id' }); } catch (e) {}
    }
    toast('Access and write permissions saved.', 'success', 6000);
    this.applyRoleNav(this.currentRole || 'admin');
  },

  async resetAccessManager() {
    if (!confirm('Reset page access to the generator defaults?')) return;
    this.roleAccessMap = null;
    try {
      localStorage.removeItem('tc-role-access-map');
      localStorage.removeItem('tc-role-write-map');
      localStorage.removeItem('tc-nav-show-map');
    } catch (e) {}
    toast('Default role access restored. Reloading…', 'info');
    setTimeout(() => location.reload(), 700);
  },

  async handleSignIn(e) {
    e.preventDefault();
    if (e.target.dataset.signingIn === '1') return;
    e.target.dataset.signingIn = '1';
    const fd = new FormData(e.target);
    let email = String(fd.get('email') || '').trim();
    const password = String(fd.get('password') || '').trim();
    const supabase = window.sb || this.sb || null;
    if (!supabase) {
      toast('Database not configured. Edit assets/js/config.js with your Supabase URL and anon key.', 'warning');
      e.target.dataset.signingIn = '0';
      return;
    }
    const btn = e.target.querySelector('button[type=submit]');
    if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Signing in…'; }
    if (email && email.indexOf('@') === -1) {
      try {
        let resolved = null;
        const a = await supabase.rpc('lookup_login_email', { p_ident: email });
        if (!a.error && a.data) resolved = a.data;
        if (!resolved) {
          const b = await supabase.rpc('lookup_login_email', { p_identifier: email });
          if (!b.error && b.data) resolved = b.data;
        }
        if (resolved) email = String(resolved);
        else {
          if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || 'Sign in'; }
          e.target.dataset.signingIn = '0';
          toast('No account found for ID "' + email.toUpperCase() + '". Use your email or student ID (TC-0001).', 'danger');
          return;
        }
      } catch (_) {}
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || 'Sign in'; }
      e.target.dataset.signingIn = '0';
      toast('Sign-in failed: ' + (error.message || 'Check your email and password.'), 'danger');
      return;
    }
    try { await this.ensureProfileAfterLogin(data && data.user, email); } catch (_) {}
    this.logActivity('login', 'auth', email);
    location.href = 'dashboard.html';
  },

  async ensureProfileAfterLogin(user, email) {
    const supabase = window.sb || this.sb || null;
    if (!supabase || !user) return;
    try {
      const { data: existing } = await supabase.from('profiles').select('id,role,status').eq('id', user.id).maybeSingle();
      if (!existing) {
        await supabase.from('profiles').insert({
          id: user.id, email: email || user.email,
          full_name: user.user_metadata?.full_name || '',
          role: user.user_metadata?.role || 'parent',
          status: 'pending'
        });
      }
    } catch (e) {}
  },

  async handleSignUp(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const supabase = window.sb || this.sb || null;
    if (!supabase) { toast('Database not configured. Edit assets/js/config.js.', 'warning'); return; }
    const btn = e.target.querySelector('button[type=submit]');
    if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Submitting…'; }
    const { error } = await supabase.auth.signUp({
      email: (fd.get('email') || '').trim(),
      password: fd.get('password') || '',
      options: { data: { full_name: fd.get('full_name'), phone: fd.get('phone'), role: fd.get('role') || 'parent' } }
    });
    if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || 'Request access'; }
    if (error) { toast('Request failed: ' + (error.message || 'Could not create request.'), 'danger'); return; }
    toast('Request sent. Check your email, then wait for admin approval.', 'success');
    if (e.target.reset) e.target.reset();
    this.switchAuthTab('signin');
  },

  switchAuthTab(tab) {
    const s = document.getElementById('signin-form') || document.getElementById('form-signin');
    const u = document.getElementById('signup-form') || document.getElementById('form-signup');
    if (!s || !u) return;
    const wantUp = tab === 'signup' || tab === 'up';
    if (s.hasAttribute('hidden') || u.hasAttribute('hidden')) {
      s.hidden = wantUp; u.hidden = !wantUp;
    } else {
      s.style.display = wantUp ? 'none' : 'block';
      u.style.display = wantUp ? 'block' : 'none';
    }
  },

  logActivity(action, entity, entityId, details) {
    const supabase = window.sb || this.sb || null;
    if (!supabase) return;
    try {
      supabase.auth.getUser().then(({ data }) => {
        const u = data && data.user;
        supabase.from('activity_log').insert({
          actor: u ? u.id : null,
          actor_id: u ? u.id : null,
          actor_email: u ? u.email : entityId,
          action, entity, entity_id: String(entityId || ''),
          table_name: entity,
          row_id: String(entityId || ''),
          details: details || null
        }).then(() => {}, () => {});
      });
    } catch (_) {}
  },

  bindUI() {
    document.addEventListener('click', e => {
      const a = e.target.closest('[data-app-action]');
      if (a && App[a.dataset.appAction]) App[a.dataset.appAction](a);
    });
    const toggle = document.querySelector('.mobile-toggle');
    if (toggle) toggle.onclick = () => this.toggleSidebar();
    const dark = document.getElementById('btn-dark');
    if (dark) dark.onclick = () => this.toggleDarkMode();
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (window.Super && Super.palette) Super.palette.toggle();
      }
    });
  },

  toggleDarkMode() {
    const cur = document.body.dataset.theme || 'light';
    document.body.dataset.theme = cur === 'dark' ? 'light' : 'dark';
    localStorage.setItem('tc-theme', document.body.dataset.theme);
  },

  signOut() {
    const supabase = window.sb || this.sb || null;
    try { localStorage.removeItem('tc-cached-profile'); localStorage.removeItem('tc-last-role'); } catch (_) {}
    try { if (window.SecurityGuard) SecurityGuard.audit('logout'); } catch (_) {}
    if (!supabase) { location.href = 'login.html'; return; }
    supabase.auth.signOut().then(() => { location.href = 'login.html'; });
  },

  toggleSidebar() {
    const el = document.getElementById('app-sidebar') || document.querySelector('.app-sidebar');
    if (el) el.classList.toggle('open');
  },

  injectChromeExtras() {
    if (!document.getElementById('toast-container') && !document.querySelector('.toast-container')) {
      const t = document.createElement('div');
      t.id = 'toast-container';
      t.className = 'toast-container';
      document.body.appendChild(t);
    }
    if (!document.getElementById('modal-backdrop')) {
      const b = document.createElement('div');
      b.id = 'modal-backdrop';
      b.className = 'modal-backdrop';
      b.innerHTML = '<div class="modal"><div class="modal-header"><h2 id="modal-title"></h2><button type="button" onclick="closeModal()">×</button></div><div class="modal-body" id="modal-body"></div><div class="modal-footer" id="modal-footer"></div></div>';
      document.body.appendChild(b);
    }
    if (!document.getElementById('pwa-install-banner')) {
      const p = window.PRACTICE || {};
      const ban = document.createElement('div');
      ban.id = 'pwa-install-banner';
      ban.className = 'pwa-install-banner';
      ban.innerHTML = '<img class="pwa-install-icon" data-logo src="assets/img/logo.svg" alt="" width="40" height="40">' +
        '<div class="pwa-install-msg">📲 Install <b>' + esc(p.name || 'ADEWALE CLASSROOM') + '</b> for class reminders, scores and messages — even when the tab is closed.</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
        '<button class="btn btn-sm btn-primary" type="button" data-pwa-action="install">Install</button>' +
        '<button class="btn btn-sm btn-ghost" type="button" data-pwa-action="dismiss">Not now</button></div>';
      document.body.appendChild(ban);
    }
    /* -------------------------------------------------------------------
       BUG FIX 8 / 17 (reported): "when I clicked the message icon for the
       studio assistant, nothing happened."

       Root cause: this block created a SECOND floating 💬 button
       (.tc-chat-fab, data-chatbot="open") at right:20px/bottom:20px with
       z-index 9997 — while chatbot.js creates the real assistant at
       right:18px/bottom:18px with the SAME z-index. Two 💬 circles sat on
       top of one another, and a grep of the whole codebase shows NOTHING
       binds data-chatbot="open". The button the user could actually hit
       was the dead one, so clicking the assistant did literally nothing.

       The real assistant (chatbot.js) is strictly better: it has the
       greeting, the ten suggestion chips, minimise, and knowledge of all
       133 pages. So when it is present we do not build the legacy widget
       at all. When it is absent — a stripped build — we still build it,
       but now we also WIRE it, so the button is never dead again.
       ------------------------------------------------------------------- */
    if (window.Chatbot || document.getElementById('tc-bot-fab')) {
      // Real assistant present: remove any legacy duplicate and stand down.
      document.querySelectorAll('.tc-chat-fab, #chatbot-window').forEach(el => el.remove());
    } else if (!document.getElementById('chatbot-window')) {
      const fab = document.createElement('button');
      fab.type = 'button';
      fab.className = 'tc-chat-fab';
      fab.setAttribute('data-chatbot', 'open');
      fab.setAttribute('aria-label', 'Open studio assistant');
      fab.textContent = '💬';
      fab.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:9997;width:52px;height:52px;border-radius:50%;border:0;background:linear-gradient(135deg,#134e4a,#0f766e);color:#fff;font-size:1.4rem;cursor:pointer;box-shadow:0 8px 20px rgba(19,78,74,.35)';
      const win = document.createElement('div');
      win.id = 'chatbot-window';
      win.style.cssText = 'display:none;position:fixed;right:20px;bottom:80px;z-index:9998;width:min(380px,calc(100vw - 32px));height:460px;background:#fff;color:#0f172a;border-radius:18px;box-shadow:0 20px 50px rgba(15,23,42,.25);flex-direction:column;overflow:hidden;border:1px solid #e2e8f0';
      win.innerHTML = '<div style="padding:12px 14px;background:linear-gradient(135deg,#134e4a,#0f766e);color:#fff;display:flex;justify-content:space-between;align-items:center"><strong>Studio Assistant</strong><button type="button" data-chatbot="close" style="border:0;background:transparent;color:#fff;font-size:1.2rem;cursor:pointer">×</button></div>' +
        '<div id="chatbot-messages" style="flex:1;overflow:auto;padding:12px;background:#f8fafc"></div>' +
        '<div style="display:flex;gap:6px;padding:10px;border-top:1px solid #e2e8f0"><input id="chatbot-input" placeholder="Ask about bookings, quizzes, Drive…" style="flex:1;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px"><button type="button" class="btn btn-primary btn-sm" data-chatbot="send">Send</button></div>';
      document.body.appendChild(fab);
      document.body.appendChild(win);
      // Wire the fallback widget so it can never be a dead button.
      const toggle = (show) => { win.style.display = show ? 'flex' : 'none'; };
      fab.addEventListener('click', () => toggle(win.style.display === 'none'));
      win.querySelector('[data-chatbot="close"]').addEventListener('click', () => toggle(false));
      const send = () => {
        const inp = document.getElementById('chatbot-input');
        const box = document.getElementById('chatbot-messages');
        if (!inp || !box || !inp.value.trim()) return;
        const q = inp.value.trim();
        box.innerHTML += '<div style="margin:6px 0;text-align:right"><span style="display:inline-block;background:#0506ae;color:#fff;padding:7px 11px;border-radius:12px;max-width:80%">' + q.replace(/[<>&]/g, '') + '</span></div>';
        let a = 'Open the ❓ Page Help button on any page for a full explanation of that screen.';
        try {
          const kb = window.ASSISTANT_KB || (window.TC && window.TC.ASSISTANT_KB);
          if (kb && kb.answer) a = kb.answer(q);
        } catch (e) {}
        box.innerHTML += '<div style="margin:6px 0"><span style="display:inline-block;background:#fff;color:#0f172a;border:1px solid #e2e8f0;padding:7px 11px;border-radius:12px;max-width:85%">' + a + '</span></div>';
        box.scrollTop = box.scrollHeight;
        inp.value = '';
      };
      win.querySelector('[data-chatbot="send"]').addEventListener('click', send);
      win.querySelector('#chatbot-input').addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
    }

    /* Any page that hard-codes the legacy markup still works: delegate
       data-chatbot clicks to the real assistant if it is loaded. */
    if (!this._chatDelegated) {
      this._chatDelegated = true;
      document.addEventListener('click', (e) => {
        const t = e.target && e.target.closest && e.target.closest('[data-chatbot="open"]');
        if (!t) return;
        if (window.Chatbot && typeof Chatbot.setOpen === 'function') {
          e.preventDefault();
          Chatbot.setOpen(true);
        }
      });
    }
    this.ensureNotifBell();
  },

  ensureNotifBell() {
    const bar = document.querySelector('.app-topbar');
    if (!bar || document.getElementById('notif-bell')) return;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;margin-left:auto';
    wrap.innerHTML = '<button type="button" id="notif-bell" class="btn btn-sm btn-ghost" aria-label="Notifications" style="position:relative">🔔<span id="notif-badge" style="display:none;position:absolute;top:-4px;right:-4px;background:#dc2626;color:#fff;border-radius:99px;min-width:16px;height:16px;font-size:10px;align-items:center;justify-content:center;padding:0 4px"></span></button>' +
      '<div id="notif-dropdown" class="notif-dropdown" style="display:none;position:absolute;right:0;top:40px;width:min(360px,90vw);max-height:420px;overflow:auto;background:#fff;color:#0f172a;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 16px 40px rgba(15,23,42,.18);z-index:2147483000"><div id="notif-list"></div><div style="padding:8px;text-align:center"><a href="notifications.html">Open notification centre</a></div></div>';
    bar.appendChild(wrap);
    const dd = wrap.querySelector('#notif-dropdown');
    const origAdd = dd.classList.add.bind(dd.classList);
    const origRm = dd.classList.remove.bind(dd.classList);
    dd.classList.add = function (c) { origAdd(c); if (c === 'show') dd.style.display = 'block'; };
    dd.classList.remove = function (c) { origRm(c); if (c === 'show') dd.style.display = 'none'; };
  },

  async loadPageData() {
    const path = currentPage() || 'dashboard';
    if (path === 'dashboard') this.loadDashboard();
    if (path === 'voting' && typeof VotingUI !== 'undefined') VotingUI.renderPollList();
    if (path === 'notifications' && typeof Notifications !== 'undefined') Notifications.loadDropdownItems();
    if (path === 'analytics' && window.Analytics && Analytics.renderDashboard) {
      Analytics.init(window.sb || this.sb);
      Analytics.renderDashboard();
    }
    const mid = this.normalizeModuleId(path);
    if (typeof CRUD !== 'undefined' && CRUD.def && CRUD.def(mid)) {
      try { CRUD.renderList(mid); } catch (e) {}
    }
    if (App['load_' + path]) App['load_' + path]();
    if (App['load_' + mid]) App['load_' + mid]();
  },

  async loadDashboard() {
    const supabase = window.sb || this.sb || null;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const safeCount = async (table) => {
      if (!supabase) return 0;
      try {
        const r = await supabase.from(table).select('id', { count: 'exact', head: true });
        return r && !r.error ? (r.count || 0) : 0;
      } catch (_) { return 0; }
    };
    const safeRows = async (table, select, limit) => {
      if (!supabase) return [];
      try {
        const r = await supabase.from(table).select(select || '*').order('created_at', { ascending: false }).limit(limit || 8);
        return r && !r.error ? (r.data || []) : [];
      } catch (_) { return []; }
    };
    try {
      if (window.Insights) {
        const demo = Insights.demoContext();
        const line = document.getElementById('dash-line');
        if (line) Insights.svgLine(line, demo.scores);
        const flagBox = document.getElementById('dash-flags');
        if (flagBox) {
          const flags = Insights.flags(demo);
          flagBox.innerHTML = flags.map(f => '<span class="badge badge-' + (f.level === 'bad' ? 'bad' : 'warn') + '">' + esc(f.text) + '</span>').join(' ') || '<span class="muted">No flags on the preview sample.</span>';
          set('k-risk', flags.length);
        }
      }
      if (!supabase) {
        set('k-eng', '12'); set('stat-engagements', '12');
        set('k-ses', '27'); set('stat-sessions', '27');
        set('k-hrs', '48'); set('stat-hours', '48');
        set('stat-learners', '18'); set('stat-inquiries', '5');
        const dc = document.getElementById('dash-classes');
        if (dc) dc.innerHTML = '<p>Preview: Cycle 1 · Sat 16:00 (60 min) · Cycle 1 · Wed 16:00 (60 min) — 8 classes across 4 cycles when a parent books 2× per cycle.</p>';
        this.injectDashboardLiveFeed([], [], {});
        return;
      }
      const [engs, sess, learners, inquiries, anns, polls, classes, invoices] = await Promise.all([
        supabase.from('engagements').select('id,hours_prepaid,hours_used,status,name,kind'),
        supabase.from('sessions').select('id,starts_at,status'),
        safeCount('learners'),
        safeCount('inquiries'),
        safeRows('announcements', '*', 5),
        safeRows('polls', '*', 5),
        supabase.from('booking_classes').select('*').eq('status', 'scheduled').order('scheduled_at').limit(8),
        supabase.from('invoices').select('amount,status')
      ]);
      const active = ((engs.data || []).filter(x => x.status === 'active'));
      set('k-eng', active.length); set('stat-engagements', active.length);
      const hours = active.reduce((a, x) => a + Number(x.hours_prepaid || 0) - Number(x.hours_used || 0), 0);
      set('k-hrs', hours.toFixed(1)); set('stat-hours', hours.toFixed(1));
      const week = Date.now() - 7 * 86400000;
      const weekN = (sess.data || []).filter(x => new Date(x.starts_at) > week).length;
      set('k-ses', weekN); set('stat-sessions', weekN);
      set('stat-learners', learners);
      set('stat-inquiries', inquiries);
      const dc = document.getElementById('dash-classes');
      if (dc) {
        dc.innerHTML = (classes.data || []).map(c =>
          '<div>Cycle ' + c.cycle_no + ' · class ' + c.seq_in_cycle + ' · <b>' + fmtDMYT(c.scheduled_at) + '</b> · ' + c.duration_minutes + ' min · <span class="badge">' + esc(c.status) + '</span></div>'
        ).join('') || '<p>No cycle bookings yet. Open <a href="bookings.html">Cycle bookings</a>.</p>';
      }
      const paid = (invoices.data || []).filter(x => x.status === 'paid').reduce((a, b) => a + Number(b.amount || 0), 0);
      set('stat-fees', ((window.PRACTICE && PRACTICE.currency) || '₦') + paid.toLocaleString());
      const annHTML = (anns || []).length
        ? anns.map(a => '<div style="padding:10px 0;border-bottom:1px solid var(--gray-200)"><a href="announcements.html"><strong>' + esc(a.title) + '</strong></a><div style="font-size:0.82rem;color:var(--gray-500)">' + (a.created_at ? fmtDMYT(a.created_at) : '') + '</div></div>').join('')
        : '<p style="color:var(--gray-500)">No announcements yet.</p>';
      document.querySelectorAll('#dash-announcements,.dash-announcements').forEach(el => { el.innerHTML = annHTML; });
      this.injectDashboardLiveFeed(anns || [], (polls || []).filter(p => String(p.status || 'open') === 'open'), {});
      if (this.isAdminRole(this.currentRole)) this.loadActionDigest();
    } catch (e) { console.warn('Dashboard load failed:', e.message); }
  },

  async loadActionDigest() {
    const supabase = window.sb || this.sb;
    if (!supabase) return;
    const box = document.getElementById('dash-actions');
    const body = document.getElementById('dash-actions-body');
    if (!box || !body) return;
    const cnt = async (table, build) => {
      try {
        let q = supabase.from(table).select('id', { count: 'exact', head: true });
        if (build) q = build(q);
        const r = await q;
        return r.error ? 0 : (r.count || 0);
      } catch (_) { return 0; }
    };
    const [pendAcc, openComp, openTickets] = await Promise.all([
      cnt('profiles', q => q.eq('status', 'pending')),
      cnt('complaints', q => q.in('status', ['open', 'in_progress', 'new'])),
      cnt('helpdesk_tickets', q => q.in('status', ['open', 'in_progress']))
    ]);
    const items = [];
    if (pendAcc) items.push('<a class="btn btn-sm btn-outline" href="approvals.html">👤 ' + pendAcc + ' account approval(s)</a>');
    if (openComp) items.push('<a class="btn btn-sm btn-outline" href="complaints.html">📣 ' + openComp + ' open complaint(s)</a>');
    if (openTickets) items.push('<a class="btn btn-sm btn-outline" href="helpdesk.html">🛠 ' + openTickets + ' helpdesk ticket(s)</a>');
    if (items.length) { body.innerHTML = items.join(' '); box.style.display = 'block'; }
  },

  injectDashboardLiveFeed(announcements, openPolls, extra) {
    try {
      extra = extra || {};
      const item = (icon, title, sub, href, badge) =>
        '<div style="display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--gray-200)">' +
        '<span style="font-size:1.15rem">' + icon + '</span><div style="flex:1"><a href="' + esc(href || '#') + '" style="font-weight:700;color:inherit;text-decoration:none">' + esc(title) + '</a>' +
        (badge ? ' <span class="badge badge-success">' + esc(badge) + '</span>' : '') +
        '<div style="font-size:.8rem;color:var(--gray-500)">' + esc(sub || '') + '</div></div></div>';
      const sections = [];
      if ((openPolls || []).length) {
        sections.push({
          title: '🗳️ Voting & Polls',
          html: openPolls.map(p => item('🗳️', p.title, p.description || 'Voting is open', 'voting.html?poll=' + p.id, p.status || 'open')).join('')
        });
      }
      if ((announcements || []).length) {
        sections.push({
          title: '📢 Announcements',
          html: announcements.slice(0, 4).map(a => item('📢', a.title, (a.body || '').slice(0, 90), 'announcements.html')).join('')
        });
      }
      if (!sections.length) return;
      const feedHTML = '<div class="card" style="margin-top:16px"><h3 style="margin-top:0">📡 Live studio feed</h3>' +
        sections.map(s => '<div style="margin-bottom:10px"><div style="font-weight:800;font-size:.82rem;letter-spacing:.04em;color:var(--primary);text-transform:uppercase;margin:8px 0 2px">' + s.title + '</div>' + s.html + '</div>').join('') + '</div>';
      let placed = false;
      document.querySelectorAll('.dash-live,#dash-live').forEach(el => { el.innerHTML = feedHTML; placed = true; });
      if (!placed) {
        const content = document.querySelector('.app-content');
        if (content && !content.querySelector('.tc-live-feed')) {
          const w = document.createElement('div');
          w.className = 'tc-live-feed';
          w.innerHTML = feedHTML;
          content.appendChild(w);
        }
      }
    } catch (e) {}
  },

  async load_gallery() {
    try {
      const supabase = window.sb || this.sb || null;
      if (!supabase) return;
      let grid = document.getElementById('gallery-grid');
      if (!grid) {
        const host = document.querySelector('.app-content');
        if (!host) return;
        grid = document.createElement('div');
        grid.id = 'gallery-grid';
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px;margin:14px 0';
        host.insertBefore(grid, host.firstChild);
      }
      const { data } = await supabase.from('gallery').select('*').order('created_at', { ascending: false }).limit(120);
      const rows = data || [];
      if (!rows.length) {
        grid.innerHTML = '<p style="color:var(--gray-500);grid-column:1/-1">No photos or videos yet. Click “+ Add new” and paste an image/video/YouTube/Drive link — never upload bytes.</p>';
        return;
      }
      const md = window.Media || (window.Super && Super.media) || null;
      grid.innerHTML = rows.map(g => {
        const url = g.url || g.media_url || '';
        const kind = md && md.kind ? md.kind(url) : 'link';
        let inner;
        if (kind === 'youtube' && md && md.ytId) inner = '<img src="https://img.youtube.com/vi/' + md.ytId(url) + '/mqdefault.jpg" style="width:100%;height:140px;object-fit:cover" loading="lazy">';
        else if (kind === 'image') inner = '<img src="' + esc(url) + '" style="width:100%;height:140px;object-fit:cover" loading="lazy">';
        else inner = '<div style="height:140px;display:flex;align-items:center;justify-content:center;background:#f1f5f9;font-size:2rem">🔗</div>';
        return '<a href="' + esc(url) + '" target="_blank" rel="noopener" style="display:block;border:1px solid var(--gray-200);border-radius:14px;overflow:hidden;background:#fff">' + inner +
          '<div style="padding:8px 10px;font-weight:700;font-size:.82rem">' + esc(g.title || g.caption || 'Untitled') + '</div></a>';
      }).join('');
    } catch (e) {}
  },

  dedupeSelectOptions(sel) {
    if (!sel || sel.dataset.tcDedupeRunning === '1') return;
    sel.dataset.tcDedupeRunning = '1';
    try {
      const seen = new Set();
      Array.from(sel.options || []).forEach(o => {
        const key = ((o.textContent || '') + '|' + o.value).replace(/\s+/g, ' ').trim().toLowerCase();
        if (!key) return;
        if (seen.has(key)) o.remove(); else seen.add(key);
      });
    } finally { sel.dataset.tcDedupeRunning = '0'; }
  },
  dedupeAllSelects() {
    try { document.querySelectorAll('select').forEach(sel => App.dedupeSelectOptions(sel)); } catch (_) {}
  },
  installSelectDedupe() {
    if (this._dedupeObserver || typeof MutationObserver === 'undefined') return;
    let t = null;
    this._dedupeObserver = new MutationObserver(() => {
      clearTimeout(t); t = setTimeout(() => App.dedupeAllSelects(), 30);
    });
    try { this._dedupeObserver.observe(document.documentElement || document.body, { childList: true, subtree: true }); } catch (_) {}
  },

  openAddModal(type) {
    if (typeof CRUD !== 'undefined' && CRUD.def && CRUD.def(type)) { CRUD.openForm(type); return; }
    if (typeof openModal === 'function') openModal('Add ' + type, '<p>This module is view-only or has a dedicated page.</p>');
  },

  guard() { return this.applyRoleVisibility(); },
  page() { return currentPage(); },
  applyBrand() { return this.hydrateBrandAssets(); },
  bindChrome() { return this.bindUI(); },
  markNav() { return this.markActiveNav(); },
  applyRole() { return this.applyRoleNav(this.currentRole || this.role); },
  initPublic() { this.initAuthTabs(); this.bootShared(); }
};

window.SCDelete = {
  async byId(client, table, id) {
    if (!client) return { ok: false, error: 'Database not configured' };
    const { data, error } = await client.from(table).delete().eq('id', id).select('id');
    if (error) return { ok: false, error: error.message || String(error) };
    if (!data || !data.length) return { ok: false, error: 'No row was deleted. It may already be removed or your role lacks permission.' };
    return { ok: true, deleted: data.length };
  }
};

function openModal(title, body, footer) {
  if (arguments.length === 1 && typeof title === 'string' && !body) {
    const el = document.getElementById(title);
    if (el) { el.classList.add('show'); return; }
  }
  const b = document.getElementById('modal-backdrop');
  if (!b) return;
  const t = document.getElementById('modal-title');
  const bd = document.getElementById('modal-body');
  const ft = document.getElementById('modal-footer');
  if (t) t.textContent = typeof title === 'string' ? title : 'Dialog';
  if (bd) bd.innerHTML = body || '';
  if (ft) ft.innerHTML = footer || '<button class="btn btn-outline" type="button" onclick="closeModal()">Close</button>';
  b.classList.add('show');
  try { if (window.App) App.dedupeAllSelects(); } catch (_) {}
}
function closeModal(id) {
  if (id) { document.getElementById(id)?.classList.remove('show'); return; }
  const b = document.getElementById('modal-backdrop');
  if (b) b.classList.remove('show');
}
function toast(msg, type, ms) {
  type = type || 'info';
  ms = ms || 3500;
  let c = document.getElementById('toast-container') || document.querySelector('.toast-container');
  if (!c) {
    c = document.createElement('div');
    c.id = 'toast-container';
    c.className = 'toast-container';
    document.body.appendChild(c);
  }
  const t = document.createElement('div');
  t.className = 'toast toast-' + type;
  t.innerHTML = '<div class="toast-msg"></div>';
  t.querySelector('.toast-msg').textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.animation = 'slideOut 0.3s ease forwards'; setTimeout(() => t.remove(), 300); }, ms);
}
function handleSignIn(e) { return App.handleSignIn(e); }
function handleSignUp(e) { return App.handleSignUp(e); }

(function () { if (window.DataPortability) return; const s = document.createElement('script'); s.src = 'assets/js/data-portability.js'; s.defer = true; document.head.appendChild(s); })();
(function () { if (window.DriveSync) return; const s = document.createElement('script'); s.src = 'assets/js/drive-sync.js'; s.defer = true; document.head.appendChild(s); })();
(function () { if (window.SecurityGuard) return; const s = document.createElement('script'); s.src = 'assets/js/security-guard.js'; s.defer = true; document.head.appendChild(s); })();

window.App = App;
window.toast = toast;
window.openModal = openModal;
window.closeModal = closeModal;
window.handleSignIn = handleSignIn;
window.handleSignUp = handleSignUp;

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => App.init());
else App.init();

console.log('%c[Tutoring Connect v16] app.js loaded — RBAC, family-safe nav, keep-alive, School Connect parity.', 'color:#0f766e;font-weight:bold');
