/* In-browser ZIP generator — emits a parent-facing client site (never the builder). */
const Generator = {
  pageFile(id) {
    const m = (window.TC.MODULES || []).find(x => x.id === id);
    return m ? m.file : id.replace(/_/g, '-') + '.html';
  },
  async load(path) {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) return '';
    return res.text();
  },

  /* V36 — pack Classroom Deck runtime stamped with THIS client's brand */
  async packClassDeck(zip, cfg) {
    const brandName = String((cfg && (cfg.name || cfg.studioName)) || 'Classroom Studio');
    const shortName = String((cfg && (cfg.shortName || cfg.short)) || brandName);
    const primary = (cfg && cfg.theme && cfg.theme.primary) || '#0506ae';
    const accent = (cfg && cfg.theme && cfg.theme.accent) || '#964eec';
    const email = (cfg && cfg.email) || '';
    const siteUrl = (cfg && cfg.siteUrl) || '';
    const logoUrl = (cfg && (cfg.logoUrl || cfg.logo)) || 'assets/img/logo.svg';
    const phone = (cfg && cfg.phone) || '';
    const wa = phone
      ? ('https://wa.me/' + String(phone).replace(/\D/g, '').replace(/^0/, '234'))
      : 'https://wa.me/2348100866322';
    const logoRel = String(logoUrl).indexOf('http') === 0
      ? logoUrl
      : ('../' + String(logoUrl).replace(/^\//, ''));

    const deckConfig = [
      '/* ' + brandName.replace(/\*\//g, '') + ' — Classroom Deck (generated) */',
      'window.CLASSDECK = window.CLASSDECK || {};',
      'window.CLASSDECK.BRAND = {',
      '  productName: ' + JSON.stringify(brandName + ' DECK') + ',',
      '  shortName: ' + JSON.stringify(shortName + ' Deck') + ',',
      '  studioName: ' + JSON.stringify(brandName) + ',',
      '  tagline: ' + JSON.stringify('Teach live inside ' + brandName + '.') + ',',
      '  founder: "Adewale Samson Adeagbo",',
      '  ecosystem: "HMG Concepts Ecosystem",',
      '  email: ' + JSON.stringify(email) + ',',
      '  whatsapp: ' + JSON.stringify(wa) + ',',
      '  siteUrl: ' + JSON.stringify(siteUrl) + ',',
      '  parentPortal: "../index.html",',
      '  portalSessions: "../sessions.html",',
      '  portalCalendar: "../calendar.html",',
      '  portalLogin: "../login.html",',
      '  logoUrl: ' + JSON.stringify(logoRel) + ',',
      '  primary: ' + JSON.stringify(primary) + ',',
      '  accent: ' + JSON.stringify(accent) + ',',
      '  requirePortalSession: false,',
      '  studentJoinFree: true',
      '};',
      'window.CD_CONFIG = Object.assign({}, window.CD_CONFIG || {}, window.CLASSDECK.BRAND);',
      'window.APP_NAME = window.CLASSDECK.BRAND.productName;',
      'window.SCHOOL_NAME = window.CLASSDECK.BRAND.studioName;',
      'window.PRACTICE = window.PRACTICE || {',
      '  name: window.CLASSDECK.BRAND.studioName,',
      '  shortName: window.CLASSDECK.BRAND.shortName,',
      '  theme: { primary: window.CLASSDECK.BRAND.primary, accent: window.CLASSDECK.BRAND.accent },',
      '  logoUrl: window.CLASSDECK.BRAND.logoUrl, email: window.CLASSDECK.BRAND.email, siteUrl: window.CLASSDECK.BRAND.siteUrl',
      '};',
      'console.log("[Classroom Deck] branded for", window.CLASSDECK.BRAND.studioName);',
      ''
    ].join('\\n');

    const deckFiles = [
      'index.html','teach.html','join.html','stream.html','classroom.html','admin.html',
      'cbt.html','parent.html','community.html','generate.html','404.html',
      'css/style.css','manifest.json','manifest.webmanifest','sw.js','version.json','TC-INTEGRATION.md',
      'js/common.js','js/config.js','js/portal-bridge.js','js/teach-toolbar-fix.js',
      'js/license.js','js/whiteboard.js','js/webcast.js','js/toolkit.js',
      'js/toolkit-data.js','js/toolkit-data2.js','js/toolkit-data3.js','js/toolkit-ext.js',
      'js/security-config.js','js/auth.js','js/rtc.js','js/teach.js','js/enhancements.js',
      'js/ecosystem-branding.js','js/enterprise-enhanced.js','js/join.js',
      'vendor/peerjs.min.js','vendor/pdf.min.js','vendor/pdf.worker.min.js','vendor/qrcode.min.js',
      'assets/icon-96.png','assets/icon-192.png','assets/icon-512.png','assets/apple-touch-icon.png'
    ];

    const brandText = (txt) => {
      if (typeof txt !== 'string') return txt;
      let s = txt;
      const bn = brandName;
      s = s.replace(/ADEWALE CLASSROOM DECK/g, bn + ' DECK');
      s = s.replace(/ADEWALE CLASSROOM/g, bn);
      s = s.replace(/ADEWALE&nbsp;CLASSROOM&nbsp;DECK/g, bn.replace(/ /g, '&nbsp;') + '&nbsp;DECK');
      s = s.replace(/ADEWALE&nbsp;CLASSROOM/g, bn.replace(/ /g, '&nbsp;'));
      s = s.replace(/HMG ACADEMY CLASS DECK/g, bn + ' DECK');
      s = s.replace(/HMG ACADEMY/g, bn);
      return s;
    };

    for (const rel of deckFiles) {
      try {
        const res = await fetch('classdeck/' + rel, { cache: 'no-store' });
        if (!res.ok) continue;
        if (/\\.(png|jpe?g|gif|webp|ico)$/i.test(rel)) {
          zip.file('classdeck/' + rel, await res.arrayBuffer());
          continue;
        }
        let txt = await res.text();
        if (rel === 'js/config.js') txt = deckConfig;
        else txt = brandText(txt);
        if (rel === 'teach.html') {
          if (txt.indexOf('teach-toolbar-fix.js') === -1) {
            txt = txt.replace('js/teach.js"></script>',
              'js/teach.js"></script>\\n<script src="js/teach-toolbar-fix.js"></script>');
          }
          if (txt.indexOf('portal-bridge.js') === -1) {
            txt = txt.replace('js/config.js"></script>',
              'js/config.js"></script>\\n<script src="js/portal-bridge.js"></script>');
          }
        }
        zip.file('classdeck/' + rel, txt);
      } catch (e) { /* skip */ }
    }

    // Client hub
    const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const hub = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>' +
      '<meta name="viewport" content="width=device-width,initial-scale=1"/>' +
      '<title>' + esc(brandName) + ' DECK</title>' +
      '<link rel="stylesheet" href="assets/css/style.css"/>' +
      '<style>body{font-family:system-ui,sans-serif;margin:0;background:#f8fafc;color:#0f172a}' +
      '.wrap{max-width:960px;margin:0 auto;padding:28px 16px}' +
      '.hero{background:linear-gradient(135deg,' + primary + ',' + accent + ');color:#fff;border-radius:16px;padding:28px;margin-bottom:18px}' +
      '.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}' +
      'a.card{display:block;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;text-decoration:none;color:inherit}' +
      '.btn{display:inline-block;margin-top:10px;background:' + primary + ';color:#fff;padding:8px 12px;border-radius:10px;font-weight:700;font-size:13px}</style></head><body><div class="wrap">' +
      '<div class="hero"><div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.9">Live teaching</div>' +
      '<h1 style="margin:6px 0 8px;font-size:1.8rem">' + esc(brandName) + ' DECK</h1>' +
      '<p style="margin:0;max-width:40rem;line-height:1.5;opacity:.95">Split-screen teach, live classroom, Meet companion, free learner join. Uses your ' + esc(brandName) + ' portal — no second login.</p></div>' +
      '<div class="grid">' +
      '<a class="card" href="classdeck/teach.html"><b>Teacher Studio</b><div style="color:#64748b;font-size:13px;margin-top:6px">Whiteboard, toolkit, go-live, roster.</div><span class="btn">Open</span></a>' +
      '<a class="card" href="classdeck/teach.html?meet=1"><b>Meet / Zoom companion</b><div style="color:#64748b;font-size:13px;margin-top:6px">Share screen; teach from one app.</div><span class="btn">Open</span></a>' +
      '<a class="card" href="classdeck/join.html"><b>Learner join</b><div style="color:#64748b;font-size:13px;margin-top:6px">Free room code — no account.</div><span class="btn">Open</span></a>' +
      '<a class="card" href="sessions.html"><b>Sessions</b><div style="color:#64748b;font-size:13px;margin-top:6px">Paste join URL into Meeting URL.</div><span class="btn">Open</span></a>' +
      '</div><p style="margin-top:18px;color:#64748b;font-size:13px">' + esc(brandName) + ' · HMG Concepts Ecosystem</p></div></body></html>';
    zip.file('class-deck.html', hub);
  },

  configJS(cfg) {
    const theme = cfg.theme || { id: 'hmg', primary: '#0506ae', accent: '#964eec' };
    return `window.TC = window.TC || {};
window.PRACTICE = ${JSON.stringify({
      name: cfg.name, shortName: cfg.shortName || cfg.name, motto: cfg.motto || '',
      theme, layout: cfg.layout || 'sidebar', font: cfg.font,
      address: cfg.address || '', phone: cfg.phone || '', email: cfg.email || '',
      siteUrl: cfg.siteUrl || '', timezone: cfg.timezone || 'Africa/Lagos',
      currency: cfg.currency || '₦', logoExt: cfg.logoExt || 'svg',
      logoUrl: cfg.logoUrl || 'assets/img/logo.svg',
      socials: cfg.socials || {},
      hmg: {
        concepts: 'https://hmgconcepts.pages.dev/',
        technologies: 'https://hmgtechnologies.pages.dev/',
        academy: 'https://hmgacademy.pages.dev/',
        media: 'https://hmgmedia.pages.dev/',
        gospel: 'https://hmggospel.pages.dev/',
        founder: 'https://cssadewale.pages.dev/'
      },
      license: cfg.license || { model: 'lifetime', status: 'active' },
      demo: { enabled: !!cfg.demo }
    }, null, 2)};
window.TC.esc = function(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');};
const SUPABASE_URL = ${JSON.stringify(cfg.supabaseUrl || 'YOUR_SUPABASE_URL')};
const SUPABASE_ANON_KEY = ${JSON.stringify(cfg.supabaseKey || 'YOUR_SUPABASE_ANON_KEY')};
window.sb = null;
if (window.supabase && SUPABASE_URL && !String(SUPABASE_URL).includes('YOUR_') && SUPABASE_ANON_KEY && !String(SUPABASE_ANON_KEY).includes('YOUR_')) {
  window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
}
window.TC_CONFIRM_FREE_EMAIL = true; window.TC_CONFIRM_FREE_WA = true; window.TC_CONFIRM_FREE_SMS = true;
console.log('[Tutoring Connect] config —', window.PRACTICE.name);
`;
  },
  ALWAYS_FILES: [
    'login.html','dashboard.html','about.html','contact.html','apply.html','install.html','offline.html',
    'forgot-password.html','change-password.html','profile.html','feature-guide.html','developer.html',
    'hmg-ecosystem.html','hmg-products.html','notifications.html',
    /* V25 — free / outreach classes. free-register.html is PUBLIC and is
       what a student opens from a WhatsApp registration link. */
    'free-classes.html','free-register.html',
    /* V27 — public blog. blog-post.html is the reader (reached from cards,
       not the menu); blog-manage.html is the staff editor. */
    'blog.html','blog-post.html','blog-manage.html',
    /* V27 — documents builder + contracts register. */
    'contracts.html','assets/js/document-builder.js',
    /* V27 — flyer studio + audit trail. */
    'assets/js/flyer-maker.js','assets/js/activity-log.js','assets/js/account-link.js','assets/js/people-link-desk.js','assets/js/directory-desk.js',
    /* V28 — roles & status manager + ops KPI strips + document/flyer studios. */
    'assets/js/status-manager.js','assets/js/ops-desk.js',
    /* V29 — social registration links for paid & free classes. */
    'class-links.html','class-register.html','assets/js/class-links.js','assets/js/class-register.js',
    'assets/css/style.css',
    'assets/js/app.js','assets/js/rbac.js','assets/js/legibility.js','assets/js/crud.js','assets/js/insights.js','assets/js/super.js',
    /* V25 — the navigation model and its renderer. If either of these is
       missing from a generated ZIP the client site ships with an EMPTY
       navigation pane, because the pages no longer carry hard-coded links.
       nav-model.json is included too: tools and tests read the JSON copy
       rather than regexing the JavaScript. */
    'assets/js/nav-model.js','assets/js/nav-model.json','assets/js/nav.js',
    /* V25 — entry desks, certificate studio, quiz lifecycle, free classes. */
    'assets/js/desk-kit.js','assets/js/cert-studio.js','assets/js/cbt-manage.js','assets/js/free-classes.js',
    /* V26 — tutor marking of open responses, and the access self-check. */
    'assets/js/cbt-marking.js','assets/js/scope-check.js',
    /* V26 — the HMG services flyers used by hmg-ecosystem.html. Without these
       the ecosystem page ships with eight broken images. */
    'assets/img/ecosystem-flyers/flyer-1.jpg','assets/img/ecosystem-flyers/flyer-2.jpg',
    'assets/img/ecosystem-flyers/flyer-3.jpg','assets/img/ecosystem-flyers/flyer-4.jpg',
    'assets/img/ecosystem-flyers/flyer-5.jpg','assets/img/ecosystem-flyers/flyer-6.jpg',
    'assets/img/ecosystem-flyers/flyer-7.jpg','assets/img/ecosystem-flyers/flyer-8.jpg',
    'assets/js/cbt.js','assets/js/cbt-types.js','assets/js/proctor.js','assets/js/drive-sync.js','assets/js/data-portability.js',
    /* V39 — CBT rich-text maths renderer + candidate read-aloud. Both are
       referenced by every one of the 140 pages; omitting them ships a client
       ZIP with 140 pages carrying 2 dead script tags (278 broken asset
       references), killing the rich-text editor and the read-aloud feature. */
    'assets/js/cbt-richtext.js','assets/js/cbt-speech.js',
    'assets/js/bookings-engine.js','assets/js/catalog.js','assets/js/license.js',
    'assets/js/media.js','assets/js/brand.js','assets/js/notifications.js','assets/js/pwa-install.js',
    'assets/js/site-help.js','assets/js/assistant-kb.js','assets/js/ics.js','assets/js/chatbot.js','assets/js/ai-assistant.js','assets/js/security-guard.js',
    'assets/js/voting.js','assets/js/enterprise.js','assets/js/analytics.js',
    'assets/js/theme-engine.js','assets/js/auth-guard.js','assets/js/page-guide.js','assets/js/seo.js','assets/js/keepalive-monitor.js','assets/js/schema-doctor.js','assets/js/quota-guard.js','assets/js/ux-enhance.js','assets/js/cbt-exam-kit.js','assets/js/record-actions.js','assets/js/receipts.js',
    'assets/css/layouts.css',
    'docs/SEO-GUIDE.md','docs/PAGE-DIRECTORY.md','docs/KEEP-ALIVE-GUIDE.md','tools/keepalive.gs',
    'database/complete-schema.sql','database/keep-alive.sql','database/drive-sync.sql',
    'database/storage-offload.sql','database/v2-tutoring-ops.sql','database/v3-classroom-exams.sql',
    'database/v4-enterprise-parity.sql','database/v5-ops-parity.sql','database/v6-cbt-modes.sql',
    'database/v7-family-access-fix.sql','database/v9-keepalive-and-drive.sql','database/v12-quota-guard.sql','database/v15-family-polls-billing.sql',
    'database/v16-exam-registration.sql','database/v17-licensing-and-family-billing.sql',
    'database/v18-security-hardening.sql','database/v19-revenue-and-security.sql',
    'database/v20-cbt-2fa-polls.sql','database/v22-cbt-results-audit.sql',
    'database/v24-tutor-scoping.sql','database/v25-desks-lifecycle-free-classes.sql',
    'database/v26-tutor-marking-and-selftest.sql',
    'database/v27-rls-recursion-blog-documents.sql',
    'database/v28-admin-and-ops-enrichment.sql',
    'database/v29-social-registration-links.sql',
    /* V27 — blog engine + account linking + review lookup. */
    'assets/js/blog.js',
    'DEPLOYMENT-GUIDE.md','README.md','FEATURE-CATALOG.md','SUPABASE_FREE_TIER_PROTECTION.md',
    'docs/GOOGLE-DRIVE-SYNC-GUIDE.md','docs/ONBOARDING-GUIDE.md','docs/INSIGHTS-METHODOLOGY.md',
    'manifest.json','sw.js','robots.txt','sitemap.xml','_headers','.nojekyll',
    'api/keepalive.js','vercel.json',
    '.github/workflows/keep-supabase-alive.yml',
    '.github/workflows/supabase-auto-restore.yml','.github/workflows/keepalive-watchdog.yml','.github/workflows/db-backup.yml',
    'supabase/functions/ping/index.ts'
  ],
  ALL_PAGES: [
    'about.html','free-classes.html','free-register.html','accommodations.html','activity-log.html','admin-data.html','analytics.html',
    'announcements.html','application-links.html','apply.html','approvals.html',
    'assignments.html','at-risk.html','attendance.html','availability.html','birthdays.html',
    'bookings.html','broadcasts.html','calendar.html','cancellations.html','cbt-exam.html',
    'cbt-multi.html','cbt-results.html','cbt-prompts.html','cbt-review.html','certificates.html',
    'change-password.html','classwork.html','complaints.html','compliance.html','contact.html',
    'curriculum.html','dashboard.html','developer.html','diagnostics.html','directory.html',
    'documents.html','engagements.html','eresources.html','events.html','exam-links.html',
    'exam-register.html','exam-targets.html','feature-guide.html','fees.html','finance.html',
    'flashcards.html','flyer.html','forgot-password.html','forum.html','gallery.html',
    'gamification.html','goals.html','group-insights.html','groups.html','helpdesk.html',
    'hmg-ecosystem.html','hmg-products.html','idcards.html','inbox.html','index.html',
    'inquiries.html','insights.html','install.html','invoices.html','learner-360.html',
    'learners.html','learning-styles.html','leave.html','lesson-plans.html','library.html',
    'license.html','lms.html','login.html','makeup-credits.html','makeups.html','mastery.html',
    /* V19 — prepaid wallet, instalment plans and the security/compliance console. */
    'wallet.html','payment-plans.html','security-centre.html',
    'meetings.html','messages.html','methodologies.html','notifications.html','offline.html',
    'onboarding.html','packages.html','parent-meetings.html','parents.html',
    'payment-history.html','payments.html','payroll.html','platform-health.html',
    'policies.html','polls.html','portfolio.html','practice.html','predictions.html',
    'products.html','profile.html','progress-reports.html','public-book.html','reading.html',
    'referrals.html','reminders.html','resources.html','reviews.html','rooms.html',
    'rubrics.html','safeguarding.html','scholarships.html','scoresheet.html',
    'session-complete.html','session-notes.html','sessions.html','settings.html',
    'site-index.html','sow.html','status-manager.html','storage.html','stream.html',
    'study-log.html','subjects.html','substitutions.html','surveys.html','timezones.html',
    'transcripts.html','trials.html','tutors.html','value-added.html','voting.html',
    'waitlist.html','whiteboard.html','class-deck.html','family-links.html','my-children.html'
  ],
  ALWAYS_PAGES: [
    'engagements.html','learners.html','insights.html','learner-360.html','calendar.html',
    'bookings.html','session-complete.html','sow.html','practice.html','cbt-exam.html','cbt-multi.html',
    'cbt-prompts.html','cbt-review.html','scoresheet.html','reading.html','forum.html','apply.html',
    'application-links.html','admin-data.html','platform-health.html','storage.html','dashboard.html',
    'exam-register.html','exam-links.html','stream.html','classwork.html','settings.html',
    'hmg-ecosystem.html','hmg-products.html','developer.html','voting.html','profile.html',
    'analytics.html','inbox.html','announcements.html','parents.html',
    'reminders.html','study-log.html','makeup-credits.html','public-book.html','license.html'
  ],
  async go(cfg, onProgress) {
    if (!window.JSZip) throw new Error('JSZip did not load. Check your network (CDN).');
    const zip = new JSZip();
    // V8: remember every file we actually wrote, so the build can (a) mirror
    // itself into modern/public automatically and (b) emit an honest manifest
    // instead of the operator having to trust that the ZIP is complete.
    const written = [];
    const _origFile = zip.file.bind(zip);
    zip.file = function (name, data, opts) {
      // CRITICAL: JSZip.file() is BOTH a getter and a setter and it switches on
      // arguments.length, not on whether data is undefined. Forwarding an
      // explicit `undefined` turns a read into a write and silently blanks the
      // file. Preserve the original arity exactly.
      if (arguments.length <= 1) return _origFile(name);
      if (typeof name === 'string') written.push(name);
      return _origFile(name, data, opts);
    };
    const files = this.ALWAYS_FILES.slice();
    const selected = new Set(cfg.modules || []);
    (window.TC.MODULES || []).forEach(m => {
      if (selected.has(m.id) || ['feature_guide', 'apply', 'hmg_ecosystem'].includes(m.id)) {
        if (m.file && !files.includes(m.file)) files.push(m.file);
      }
    });
    this.ALWAYS_PAGES.forEach(f => { if (!files.includes(f)) files.push(f); });
    // V8: an "all-inclusive" build ships every page that exists, so a client is
    // never missing a screen a nav link points at. Module selection now controls
    // what is *shown in the menu*, not what is present on disk — this removes a
    // whole class of 404s that used to depend on wizard checkboxes.
    if (cfg.allInclusive !== false) {
      this.ALL_PAGES.forEach(f => { if (!files.includes(f)) files.push(f); });
    }
    let n = 0;
    for (const f of files) {
      if (f === 'index.html' || f === 'builder.html' || f === 'generator.js' || f === 'wizard.js') continue;
      // Dotfiles (e.g. .nojekyll) may be legitimately empty — fetch the
      // response directly so a 200 with an empty body is still included,
      // while a genuine 404 is skipped.
      if (f.startsWith('.')) {
        try {
          const res = await fetch(f, { cache: 'no-store' });
          if (res.ok) zip.file(f, await res.text());
        } catch (_) {}
      } else {
        const txt = await this.load(f);
        if (txt) zip.file(f, txt);
      }
      n++;
      if (onProgress) onProgress(n, files.length, f);
    }
    const logo = await fetch('assets/img/logo.svg').then(r => r.ok ? r.text() : '');
    if (logo) zip.file('assets/img/logo.svg', logo);
    try {
      const pngRes = await fetch('assets/img/logo.png');
      if (pngRes.ok) zip.file('assets/img/logo.png', await pngRes.arrayBuffer());
    } catch (_) {}
    const clientIndex = await this.load('site-index.html');
    if (clientIndex) zip.file('index.html', clientIndex);
    zip.file('assets/js/config.js', this.configJS(cfg));
    try { await this.packClassDeck(zip, cfg); } catch (e) { console.warn('[generator] classdeck', e); }
    zip.file('PRACTICE.json', JSON.stringify(cfg, null, 2));

    /* V17 — emit a licence seed so the DATABASE agrees with the wizard.
       Enforcement lives in public.site_license and is applied by a trigger;
       writing the choice only into config.js would leave the database on
       its defaults and the owner's choice would silently do nothing. */
    zip.file('database/00-licence-seed.sql', this.licenceSeedSQL(cfg));
    const origin = String(cfg.siteUrl || '').replace(/\/$/, '') || 'https://your-studio.example';
    const today = new Date().toISOString().slice(0, 10);

    // ---- SEO: pages we WANT indexed. Everything else is explicitly disallowed
    // so a parent dashboard or a safeguarding log can never reach a search index.
    const PUBLIC_URLS = [
      ['/', '1.0', 'weekly'], ['/index.html', '1.0', 'weekly'], ['/about.html', '0.9', 'monthly'],
      ['/apply.html', '0.9', 'monthly'], ['/contact.html', '0.8', 'monthly'],
      ['/feature-guide.html', '0.7', 'monthly'], ['/install.html', '0.6', 'yearly'],
      ['/exam-register.html', '0.7', 'monthly'], ['/public-book.html', '0.7', 'monthly'],
      ['/login.html', '0.5', 'yearly'], ['/site-index.html', '0.5', 'monthly'],
      ['/hmg-ecosystem.html', '0.5', 'yearly'], ['/hmg-products.html', '0.5', 'yearly'],
      ['/developer.html', '0.4', 'yearly'], ['/flyer.html', '0.4', 'yearly']
    ];
    const PRIVATE = ['/dashboard.html','/admin-data.html','/safeguarding.html','/compliance.html',
      '/settings.html','/approvals.html','/activity-log.html','/platform-health.html','/storage.html',
      '/finance.html','/payroll.html','/invoices.html','/payments.html','/scoresheet.html',
      '/learners.html','/parents.html','/learner-360.html','/insights.html','/inbox.html',
      '/messages.html','/session-notes.html','/profile.html','/engagements.html'];

    zip.file('robots.txt', [
      '# ' + (cfg.name || 'Tutoring studio') + ' - generated by Tutoring Connect (HMG Technologies)',
      'User-agent: *',
      ...PUBLIC_URLS.filter(u => u[0] !== '/').map(u => 'Allow: ' + u[0]),
      ...PRIVATE.map(p => 'Disallow: ' + p),
      '',
      '# Major engines - explicit, so indexing is never ambiguous',
      'User-agent: Googlebot', 'Allow: /', ...PRIVATE.map(p => 'Disallow: ' + p), '',
      'User-agent: Bingbot', 'Allow: /', ...PRIVATE.map(p => 'Disallow: ' + p), '',
      'User-agent: DuckDuckBot', 'Allow: /', '',
      'User-agent: Slurp', 'Allow: /', '',
      'Sitemap: ' + origin + '/sitemap.xml',
      'Host: ' + origin.replace(/^https?:\/\//, ''),
      ''
    ].join('\n'));

    zip.file('sitemap.xml',
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      PUBLIC_URLS.filter(u => u[0] !== '/index.html').map(u =>
        '  <url><loc>' + origin + u[0] + '</loc><lastmod>' + today +
        '</lastmod><changefreq>' + u[2] + '</changefreq><priority>' + u[1] + '</priority></url>'
      ).join('\n') + '\n</urlset>\n');

    // Google/Bing verification placeholders the studio can fill in later.
    zip.file('SEO-SETUP.md', [
      '# Getting ' + (cfg.name || 'this studio') + ' found on Google and Bing',
      '',
      'The site already ships everything an engine needs: sitemap.xml, robots.txt,',
      'canonical URLs, Open Graph cards and schema.org JSON-LD (injected by',
      'assets/js/seo.js). You only have to tell the engines it exists.',
      '',
      '## 1. Set your real domain (2 minutes)',
      'Open assets/js/config.js and set siteUrl to your live address, e.g.',
      '    siteUrl: "https://' + ((cfg.shortName || 'studio') + '').toLowerCase().replace(/[^a-z0-9]/g, '') + '.vercel.app"',
      'Redeploy. Canonical tags and the sitemap use this value.',
      '',
      '## 2. Google Search Console',
      '1. Go to https://search.google.com/search-console and add your URL prefix.',
      '2. Verify with the HTML tag method - paste the meta tag into index.html <head>.',
      '3. Sitemaps -> add "sitemap.xml" -> Submit.',
      '4. URL Inspection -> paste your homepage -> Request indexing.',
      '',
      '## 3. Bing / Microsoft Webmaster Tools',
      '1. Go to https://www.bing.com/webmasters and add the site.',
      '2. Import from Google Search Console (fastest) or verify with the meta tag.',
      '3. Submit sitemap.xml. Bing also powers DuckDuckGo and Yahoo.',
      '',
      '## 4. Make the studio easy to find by name',
      '- Put the exact studio name in the page title (already done).',
      '- Add the site link to your WhatsApp Business profile, Instagram bio and',
      '  Facebook page - social links are read as sameAs signals in the JSON-LD.',
      '- Ask your first families for a Google review if you have a Business Profile.',
      '',
      '## 5. HMG ecosystem cross-linking',
      'Every page footer links to HMG Concepts, HMG Technologies, HMG Academy,',
      'HMG Media, HMG Gospel and the founder site, and the JSON-LD declares',
      'HMG Concepts as the parentOrganization. That reciprocal linking helps both',
      'this studio and the wider ecosystem rank.',
      '',
      '## 6. Check it worked',
      '- Rich results: https://search.google.com/test/rich-results',
      '- Share the link in WhatsApp - you should see a preview card with the logo.',
      '- Search: site:' + origin.replace(/^https?:\/\//, '') + ' (after a few days)',
      ''
    ].join('\n'));

    zip.file('manifest.json', JSON.stringify({
      name: cfg.name || 'ADEWALE CLASSROOM',
      short_name: cfg.shortName || 'ADC',
      start_url: 'dashboard.html',
      display: 'standalone',
      background_color: '#f7f4ef',
      theme_color: (cfg.theme && cfg.theme.primary) || '#134e4a',
      icons: [
        { src: 'assets/img/logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        { src: 'assets/img/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
      ]
    }, null, 2));
    if (String(cfg.buildType || cfg.build_type || '').toLowerCase() === 'modern') {
      this.writeModernScaffold(zip, cfg);
      // V8 FIX: the modern README used to tell the operator to "copy the root
      // portal files into modern/public/" by hand. A build that needs manual
      // assembly is not a build. Mirror everything automatically instead.
      const skip = /^modern\//;
      const mirrored = [];
      for (const name of written.slice()) {
        if (skip.test(name)) continue;
        const f = zip.file(name);
        if (!f) continue;
        try {
          const isBin = /\.(png|jpg|jpeg|gif|ico|woff2?|ttf)$/i.test(name);
          const data = await (isBin ? f.async('arraybuffer') : f.async('string'));
          _origFile('modern/public/' + name, data);
          mirrored.push(name);
        } catch (_) {}
      }
      _origFile('modern/public/.mirrored', mirrored.length + ' files mirrored from the traditional build\n');
      zip._tcMirrored = mirrored.length;
    }

    // ---- BUILD MANIFEST: a verifiable record of what this ZIP contains ----
    // Several files are written twice on purpose (fetched from the generator,
    // then overwritten with a rebranded version: manifest.json, robots.txt,
    // sitemap.xml). Dedupe so the manifest reports what the ZIP really holds.
    const uniq = Array.from(new Set(written));
    const grouped = {};
    uniq.forEach(n => {
      const k = n.indexOf('/') === -1 ? '(root)' : n.split('/')[0];
      (grouped[k] = grouped[k] || []).push(n);
    });
    _origFile('BUILD-MANIFEST.json', JSON.stringify({
      studio: cfg.name || '',
      shortName: cfg.shortName || '',
      generatedAt: new Date().toISOString(),
      generator: 'Tutoring Connect V8 (HMG Technologies)',
      buildType: String(cfg.buildType || 'traditional').toLowerCase(),
      allInclusive: cfg.allInclusive !== false,
      theme: (cfg.theme && cfg.theme.id) || null,
      font: (cfg.font && cfg.font.id) || null,
      layout: cfg.layout || null,
      supabaseConfigured: !!(cfg.supabaseUrl && cfg.supabaseKey),
      counts: {
        total: uniq.length,
        pages: uniq.filter(f => /\.html$/.test(f) && f.indexOf('/') === -1).length,
        scripts: uniq.filter(f => /^assets\/js\//.test(f)).length,
        styles: uniq.filter(f => /^assets\/css\//.test(f)).length,
        sql: uniq.filter(f => /^database\//.test(f)).length,
        docs: uniq.filter(f => /\.md$/.test(f)).length
      },
      mirroredToModernPublic: zip._tcMirrored || 0,
      byFolder: Object.keys(grouped).sort().reduce((a, k) => (a[k] = grouped[k].length, a), {}),
      files: uniq.slice().sort()
    }, null, 2));

    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  },
  /* Build a standalone HTML preview of the CLIENT landing page (site-index.html
     with branding substituted). Used by Wizard.previewLive(). */
  pageIndex(cfg) {
    const theme = cfg.theme || { primary: cfg.themePrimary || '#134e4a', accent: cfg.themeAccent || '#d97706' };
    const fontCss = (cfg.fontCss || 'DM+Sans:wght@400;500;600;700;800|Source+Serif+4:wght@500;700;800');
    const fontFamily = cfg.fontFamily || (cfg.font && cfg.font.family) || 'DM Sans';
    const name = this._esc(cfg.name || cfg.schoolName || 'ADEWALE CLASSROOM');
    const motto = this._esc(cfg.motto || cfg.schoolMotto || 'Independent progress. Visible to parents.');
    const primary = theme.primary || '#134e4a';
    const accent = theme.accent || '#d97706';
    const fontLink = '<link href="https://fonts.googleapis.com/css2?family=' + fontCss + '" rel="stylesheet">';
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name} — official tutoring portal</title>
<link rel="icon" type="image/svg+xml" href="assets/img/logo.svg">
${fontLink}
<style>
:root{--primary:${primary};--accent:${accent};--tc-primary:${primary};--tc-accent:${accent}}
body{margin:0;font-family:'${fontFamily}',system-ui,sans-serif;background:#f7f4ef;color:#0f172a;line-height:1.6}
.hero{max-width:900px;margin:0 auto;padding:64px 24px;text-align:center}
h1{font-family:Georgia,'Source Serif 4',serif;font-size:clamp(2rem,5vw,3.4rem);margin:.2em 0;color:${primary}}
.serif{font-family:Georgia,'Source Serif 4',serif}
.btn{display:inline-block;padding:12px 22px;border-radius:12px;text-decoration:none;font-weight:700;margin:6px;border:2px solid ${primary}}
.btn-primary{background:${primary};color:#fff}.btn-outline{color:${primary};background:#fff}
.muted{color:#475569}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;max-width:900px;margin:32px auto;padding:0 24px}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:20px;box-shadow:0 4px 14px rgba(15,23,42,.05)}
.badge{display:inline-block;background:${accent};color:#fff;padding:6px 14px;border-radius:999px;font-weight:700;font-size:.85rem}
</style></head><body>
<header style="display:flex;justify-content:space-between;align-items:center;padding:18px 28px"><strong>${name}</strong><nav><a href="about.html" style="margin:0 8px;color:inherit">About</a><a href="apply.html" style="margin:0 8px;color:inherit">Apply</a></nav></header>
<section class="hero">
<span class="badge">🎓 Official tutoring portal</span>
<h1>${name}</h1>
<p class="serif" style="font-size:1.25rem">${motto}</p>
<p><a class="btn btn-primary" href="login.html">Sign in to portal</a><a class="btn btn-outline" href="about.html">Learn more</a></p>
</section>
<div class="grid">
<div class="card"><h3>100% family-safe RLS</h3><p class="muted">Siblings and groups never smear data. A parent sees only mapped children.</p></div>
<div class="card"><h3>24/7 portal access</h3><p class="muted">Installable PWA with offline shell and class reminders.</p></div>
<div class="card"><h3>4×7 booking cycles</h3><p class="muted">A full booking is 4 cycles of 7 days. Amount = rate × hours.</p></div>
</div>
<footer style="text-align:center;padding:32px;color:#64748b">Built with Tutoring Connect · HMG Technologies / HMG Concepts</footer>
</body></html>`;
  },

  /* Build a full multi-page interactive preview inside one HTML document
     (an iframe with a sidebar nav and sample data). Used by
     Wizard.fullPreviewHtml(). The string __STYLE__ is replaced with the
     real style.css by the caller. */
  fullPreviewHtml(cfg) {
    const name = this._esc(cfg.name || cfg.schoolName || 'ADEWALE CLASSROOM');
    const modules = (cfg.modules || []).slice(0, 40);
    const nav = modules.map((m, i) => {
      const def = (window.TC && window.TC.MODULES || []).find(x => x.id === m);
      const label = def ? def.name : m.replace(/_/g, ' ');
      return '<a href="#" data-pg="' + i + '" style="display:block;padding:8px 12px;color:inherit;text-decoration:none;border-radius:8px">' + label + '</a>';
    }).join('');
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name} — full preview</title><style>__STYLE__</style>
<style>body{margin:0}.preview-shell{display:grid;grid-template-columns:240px 1fr;min-height:100vh}.preview-nav{background:var(--primary,#134e4a);color:#fff;padding:18px 10px;overflow:auto}.preview-nav a:hover{background:rgba(255,255,255,.12)}.preview-main{padding:28px;overflow:auto}.preview-bar{background:#fef3c7;color:#92400e;padding:10px 16px;font-size:.85rem}</style>
</head><body><div class="preview-bar">🔎 Full preview — sample data only. Connect Supabase after download for live records.</div>
<div class="preview-shell"><nav class="preview-nav"><strong style="display:block;padding:8px 12px 16px">${name}</strong>${nav}</nav>
<main class="preview-main"><h1>${name}</h1><p class="muted">This is an interactive preview of the selected modules. Every page runs against sample data — no database is required to click around.</p>
<div id="preview-page" class="app-content"></div></main></div>
<script>
const PAGES = ${JSON.stringify(modules)};
const MODS = (window.TC && window.TC.MODULES) || [];
document.querySelectorAll('.preview-nav a').forEach(a=>a.onclick=e=>{e.preventDefault();const i=+a.dataset.pg;const id=PAGES[i];const def=MODS.find(m=>m.id===id)||{};document.getElementById('preview-page').innerHTML='<div class=card><h2>'+(def.name||id)+'</h2><p class=muted>'+(def.desc||'')+'</p><p class=muted>Sample data preview.</p></div>';});
</script></body></html>`;
  },

  _esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  writeModernScaffold(zip, cfg) {
    const name = cfg.name || 'ADEWALE CLASSROOM';
    const nl = String.fromCharCode(10);
    zip.file('modern/README.md', [
      '# ' + name + ' - modern (Next.js) delivery',
      '',
      'The traditional static portal (HTML/CSS/JS at the ZIP root) remains the',
      'source of truth. modern/ is an optional Next.js 14 wrapper that serves',
      'those files with edge caching and gives a place for serverless routes.',
      'Supabase + RLS stay the authority. No paid AI API.',
      '',
      'Quick start:',
      'The portal files are ALREADY mirrored into modern/public/ by the generator,',
      'so there is nothing to copy by hand.',
      '',
      '1. cd modern && npm install',
      '2. npm run dev   (http://localhost:3000)',
      '3. npm run build && npm start for production, or deploy modern/ to Vercel.',
      '',
      'Set SUPABASE_URL and SUPABASE_ANON_KEY env vars (never service_role).',
      ''
    ].join(nl));
    zip.file('modern/package.json', JSON.stringify({
      private: true, name: 'tutoring-connect-modern', version: '1.0.0',
      scripts: { dev: 'next dev', build: 'next build', start: 'next start', lint: 'next lint' },
      dependencies: { next: '14.2.5', react: '18.3.1', 'react-dom': '18.3.1' }
    }, null, 2));
    zip.file('modern/next.config.js', [
      '/** @type {import("next").NextConfig} */',
      'const nextConfig = {',
      '  trailingSlash: true,',
      '  reactStrictMode: true,',
      '  async headers() {',
      '    return [{ source: "/(.*)", headers: [',
      '      { key: "X-Content-Type-Options", value: "nosniff" },',
      '      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },',
      '      { key: "X-Frame-Options", value: "SAMEORIGIN" }',
      '    ]}];',
      '  }',
      '};',
      'module.exports = nextConfig;',
      ''
    ].join(nl));
    zip.file('modern/.gitignore', 'node_modules/\n.next/\nout/\n.env*.local\n.vercel\n*.tsbuildinfo\n' + nl);
    zip.file('modern/app/globals.css', '/* Real styles live in /public/assets/css/style.css */\n' + nl);
    zip.file('modern/app/layout.js', [
      'import "./globals.css";',
      'export const metadata = {',
      '  title: ' + JSON.stringify(name) + ',',
      '  description: ' + JSON.stringify(cfg.motto || 'Independent tutoring portal.') + ',',
      '};',
      'export default function RootLayout({ children }) {',
      '  return (<html lang="en"><body>{children}</body></html>);',
      '}',
      ''
    ].join(nl));
    zip.file('modern/app/page.js', [
      '// The generated studio is a static PWA in /public; send users there.',
      'export default function Page() {',
      '  if (typeof window !== "undefined") window.location.replace("/index.html");',
      '  return null;',
      '}',
      ''
    ].join(nl));
    zip.file('modern/app/api/keepalive/route.js', [
      '// Keep-alive route hit by the Vercel cron (see vercel.json).',
      'export async function GET() {',
      '  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;',
      '  if (!url || !key) return Response.json({ ok:false, error:"Set SUPABASE_URL and SUPABASE_ANON_KEY." }, { status:500 });',
      '  try {',
      '    const r = await fetch(url + "/rest/v1/rpc/tc_keep_alive", {',
      '      method:"POST",',
      '      headers:{ apikey:key, Authorization:"Bearer "+key, "Content-Type":"application/json" },',
      '      body: JSON.stringify({ src:"modern-cron" })',
      '    });',
      '    return Response.json({ ok:r.ok, status:r.status, at:new Date().toISOString() });',
      '  } catch(e){ return Response.json({ ok:false, error:String(e && e.message || e) }); }',
      '}',
      ''
    ].join(nl));
  },
  normalizeCfg(cfg) {
    cfg = Object.assign({}, cfg || {});
    cfg.name = cfg.name || cfg.schoolName || 'ADEWALE CLASSROOM';
    cfg.shortName = cfg.shortName || cfg.admissionAcronym || 'ADC';
    cfg.motto = cfg.motto || cfg.schoolMotto || '';
    cfg.timezone = cfg.timezone || 'Africa/Lagos';
    cfg.currency = cfg.currency || '₦';
    cfg.logoUrl = cfg.logoUrl || 'assets/img/logo.svg';
    const theme = (window.TC && TC.THEMES || []).find(t => t.id === cfg.themeId) || (window.TC && TC.THEMES && TC.THEMES[0]) || { id: 'hmg', primary: '#0506ae', accent: '#964eec' };
    // Preserve every shade the theme defines so the branded config and the
    // CSS premium layer can use light/dark/bg variants.
    cfg.theme = {
      id: theme.id,
      primary: theme.primary,
      accent: theme.accent,
      primaryLight: theme.primaryLight || theme.primary,
      accentLight: theme.accentLight || theme.accent,
      primaryDark: theme.primaryDark || theme.primary,
      bg: theme.bg || '#f8fafc'
    };
    const font = (window.TC && TC.FONTS || []).find(f => f.id === cfg.fontId) || (window.TC && TC.FONTS && TC.FONTS[0]);
    if (font) cfg.font = font;
    cfg.socials = {
      facebook: cfg.socialFacebook || '',
      instagram: cfg.socialInstagram || '',
      x: cfg.socialTwitter || '',
      linkedin: cfg.socialLinkedIn || '',
      youtube: cfg.socialYouTube || '',
      tiktok: cfg.socialTikTok || '',
      whatsapp: cfg.socialWhatsApp || ''
    };
    cfg.license = {
      model: cfg.licenseModel || 'lifetime',
      /* V17 — the builder now also collects tier, seats, enforcement mode
         and the lock message. These are written into config.js AND into the
         seed row for public.site_license, which is what the database
         trigger actually consults. Enforcement is only ever meaningful for
         a subscription; a one-time licence is forced to 'banner' so a
         mis-click in the wizard can never lock a studio that was bought
         outright. */
      tier: cfg.licenseTier || 'studio',
      plan: cfg.licensePlan || (cfg.licenseModel === 'subscription' ? (cfg.licenseCycle || 'termly') : 'One-time ownership'),
      status: 'active',
      enforcement: cfg.licenseModel === 'subscription' ? (cfg.licenseEnforcement || 'banner') : 'banner',
      expires_on: cfg.licenseModel === 'subscription' ? (cfg.licenseExpires || null) : null,
      grace_days: Number(cfg.licenseGrace || 7),
      seats_learners: cfg.licenseSeatsLearners === '' || cfg.licenseSeatsLearners == null
        ? null : Number(cfg.licenseSeatsLearners),
      seats_tutors: cfg.licenseSeatsTutors === '' || cfg.licenseSeatsTutors == null
        ? null : Number(cfg.licenseSeatsTutors),
      issued_to: cfg.licenseIssuedTo || cfg.schoolName || cfg.name || '',
      lock_message: cfg.licenseLockMessage || '',
      renew_url: cfg.licenseRenewUrl || 'https://wa.me/2348100866322?text=Renew%20Tutoring%20Connect',
      registryUrl: cfg.licenseRegistryUrl || ''
    };
    cfg.buildType = cfg.buildType || 'traditional';
    cfg.demo = cfg.demoMode === 'yes';
    return cfg;
  },
  /* Builds the one-row seed for public.site_license from the wizard.
     Idempotent and safe to re-run: it UPDATES the existing row rather than
     failing on the primary key, so re-seeding never wipes a renewal. */
  licenceSeedSQL(cfg) {
    const L = cfg.license || {};
    const q = v => (v === null || v === undefined || v === '')
      ? 'null' : "'" + String(v).replace(/'/g, "''") + "'";
    const n = v => (v === null || v === undefined || v === '') ? 'null' : Number(v);
    return [
      '-- =====================================================================',
      '-- LICENCE SEED for ' + (cfg.schoolName || cfg.name || 'this studio'),
      '-- Generated by Tutoring Connect. Run AFTER complete-schema.sql.',
      '--',
      '-- This writes the licensing choice you made in the builder into the',
      '-- database, which is where it is actually enforced. Without this the',
      '-- studio falls back to a one-time/lifetime licence in warn-only mode.',
      '--',
      '-- Model       : ' + (L.model || 'lifetime'),
      '-- Tier        : ' + (L.tier || 'studio'),
      '-- Enforcement : ' + (L.enforcement || 'banner'),
      '-- Reads are NEVER blocked, in any mode.',
      '-- =====================================================================',
      '',
      'insert into public.site_license (id, model, tier, plan, status, enforcement,',
      '                                 expires_on, grace_days, seats_learners,',
      '                                 seats_tutors, issued_to, renew_url, lock_message)',
      'values (1, ' + q(L.model || 'lifetime') + ', ' + q(L.tier || 'studio') + ', ' + q(L.plan) + ", 'active', " + q(L.enforcement || 'banner') + ',',
      '        ' + (L.expires_on ? q(L.expires_on) + '::date' : 'null') + ', ' + n(L.grace_days || 7) + ', ' + n(L.seats_learners) + ',',
      '        ' + n(L.seats_tutors) + ', ' + q(L.issued_to) + ', ' + q(L.renew_url) + ', ' + q(L.lock_message) + ')',
      'on conflict (id) do update set',
      '  model = excluded.model, tier = excluded.tier, plan = excluded.plan,',
      '  status = excluded.status, enforcement = excluded.enforcement,',
      '  expires_on = excluded.expires_on, grace_days = excluded.grace_days,',
      '  seats_learners = excluded.seats_learners, seats_tutors = excluded.seats_tutors,',
      '  issued_to = excluded.issued_to, renew_url = excluded.renew_url,',
      '  lock_message = excluded.lock_message, last_checked_at = now();',
      '',
      "select 'Licence seeded \\u2705' as status, model, tier, enforcement, expires_on",
      '  from public.site_license where id = 1;',
      ''
    ].join('\n');
  },

  async build(raw) {
    const cfg = this.normalizeCfg(raw);
    const blob = await this.go(cfg);
    const slug = String(cfg.shortName || cfg.name || 'studio').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'studio';
    return { blob, fileName: slug + '-tutoring-connect.zip' };
  }
};
window.Generator = Generator;
