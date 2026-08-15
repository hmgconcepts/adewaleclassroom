/* In-browser ZIP generator — emits a parent-facing client site (never the builder). */
const Generator = {
  PRICING: {
    currency: '₦',
    base: 35000,
    perModule: 4500,
    addons: [
      { id: 'onboarding', name: 'Onboarding & training call', price: 15000 },
      { id: 'custom_theme', name: 'Custom theme from brand guide', price: 12000 },
      { id: 'data_import', name: 'Learner / parent CSV import', price: 10000 },
      { id: 'drive_setup', name: 'Google Drive backup setup', price: 8000 }
    ]
  },
  pageFile(id) {
    const m = (window.TC.MODULES || []).find(x => x.id === id);
    return m ? m.file : id.replace(/_/g, '-') + '.html';
  },
  async load(path) {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) return '';
    return res.text();
  },
  configJS(cfg) {
    const theme = cfg.theme || { id: 'lumen', primary: '#134e4a', accent: '#d97706' };
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
    'assets/css/style.css',
    'assets/js/app.js','assets/js/crud.js','assets/js/insights.js','assets/js/super.js',
    'assets/js/cbt.js','assets/js/proctor.js','assets/js/drive-sync.js','assets/js/data-portability.js',
    'assets/js/bookings-engine.js','assets/js/catalog.js','assets/js/license.js',
    'assets/js/media.js','assets/js/brand.js','assets/js/notifications.js','assets/js/pwa-install.js',
    'assets/js/site-help.js','assets/js/assistant-kb.js','assets/js/ics.js','assets/js/chatbot.js','assets/js/ai-assistant.js','assets/js/security-guard.js',
    'assets/js/voting.js','assets/js/enterprise.js','assets/js/analytics.js',
    'database/complete-schema.sql','database/keep-alive.sql','database/drive-sync.sql',
    'database/storage-offload.sql','database/v2-tutoring-ops.sql','database/v3-classroom-exams.sql',
    'database/v4-enterprise-parity.sql','database/v5-ops-parity.sql','database/v6-cbt-modes.sql',
    'DEPLOYMENT-GUIDE.md','README.md','FEATURE-CATALOG.md','SUPABASE_FREE_TIER_PROTECTION.md',
    'docs/GOOGLE-DRIVE-SYNC-GUIDE.md','docs/ONBOARDING-GUIDE.md','docs/INSIGHTS-METHODOLOGY.md',
    'manifest.json','sw.js','robots.txt','sitemap.xml','_headers','.nojekyll',
    'api/keepalive.js','vercel.json',
    '.github/workflows/keep-supabase-alive.yml',
    '.github/workflows/supabase-auto-restore.yml',
    'supabase/functions/ping/index.ts'
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
    const files = this.ALWAYS_FILES.slice();
    const selected = new Set(cfg.modules || []);
    (window.TC.MODULES || []).forEach(m => {
      if (selected.has(m.id) || ['feature_guide', 'apply', 'hmg_ecosystem'].includes(m.id)) {
        if (m.file && !files.includes(m.file)) files.push(m.file);
      }
    });
    this.ALWAYS_PAGES.forEach(f => { if (!files.includes(f)) files.push(f); });
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
    zip.file('PRACTICE.json', JSON.stringify(cfg, null, 2));
    const origin = String(cfg.siteUrl || '').replace(/\/$/, '') || 'https://adewaleclassroom.example';
    // SEO: allow the public marketing/application pages, disallow private ones.
    zip.file('robots.txt', [
      'User-agent: *',
      'Allow: /',
      'Allow: /about.html',
      'Allow: /apply.html',
      'Allow: /contact.html',
      'Allow: /feature-guide.html',
      'Allow: /hmg-ecosystem.html',
      'Allow: /hmg-products.html',
      'Allow: /developer.html',
      'Allow: /exam-register.html',
      'Allow: /public-book.html',
      'Allow: /install.html',
      'Disallow: /dashboard.html',
      'Disallow: /admin-data.html',
      'Disallow: /safeguarding.html',
      'Disallow: /compliance.html',
      'Disallow: /settings.html',
      'Disallow: /approvals.html',
      'Disallow: /activity-log.html',
      'Disallow: /platform-health.html',
      'Disallow: /storage.html',
      'Disallow: /finance.html',
      'Disallow: /payroll.html',
      'Sitemap: ' + origin + '/sitemap.xml',
      ''
    ].join('\n'));
    // SEO: list every public page so Google/Bing index the client site.
    const publicUrls = ['/', '/about.html', '/contact.html', '/apply.html', '/feature-guide.html',
      '/login.html', '/install.html', '/exam-register.html', '/public-book.html',
      '/hmg-ecosystem.html', '/hmg-products.html', '/developer.html', '/flyer.html'];
    const today = new Date().toISOString().slice(0, 10);
    zip.file('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
      + publicUrls.map(p => {
          const pri = (p === '/' ? '1.0' : (p === '/about.html' || p === '/apply.html' ? '0.9' : '0.7'));
          return '  <url><loc>' + origin + p + '</loc><lastmod>' + today + '</lastmod><changefreq>weekly</changefreq><priority>' + pri + '</priority></url>';
        }).join('\n')
      + '\n</urlset>\n');
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
    }
    return zip.generateAsync({ type: 'blob' });
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
      '1. Copy the root portal files into modern/public/ (assets, *.html, sw.js, manifest, database).',
      '2. cd modern && npm install',
      '3. npm run dev (http://localhost:3000)',
      '4. npm run build && npm start for production, or deploy modern/ to Vercel.',
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
  estimate(cfg, addons) {
    const n = (cfg && cfg.modules && cfg.modules.length) || 0;
    const lines = [
      { label: 'Base studio platform', amount: this.PRICING.base },
      { label: n + ' selected modules', amount: n * this.PRICING.perModule }
    ];
    (addons || []).forEach(id => {
      const a = this.PRICING.addons.find(x => x.id === id);
      if (a) lines.push({ label: a.name, amount: a.price });
    });
    const total = lines.reduce((s, l) => s + l.amount, 0);
    return { currency: this.PRICING.currency, lines, total };
  },
  normalizeCfg(cfg) {
    cfg = Object.assign({}, cfg || {});
    cfg.name = cfg.name || cfg.schoolName || 'ADEWALE CLASSROOM';
    cfg.shortName = cfg.shortName || cfg.admissionAcronym || 'ADC';
    cfg.motto = cfg.motto || cfg.schoolMotto || '';
    cfg.timezone = cfg.timezone || 'Africa/Lagos';
    cfg.currency = cfg.currency || '₦';
    cfg.logoUrl = cfg.logoUrl || 'assets/img/logo.svg';
    const theme = (window.TC && TC.THEMES || []).find(t => t.id === cfg.themeId) || (window.TC && TC.THEMES && TC.THEMES[0]) || { id: 'lumen', primary: '#134e4a', accent: '#d97706' };
    cfg.theme = { id: theme.id, primary: theme.primary, accent: theme.accent };
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
      plan: cfg.licensePlan || (cfg.licenseModel === 'subscription' ? (cfg.licenseCycle || 'termly') : 'One-time ownership'),
      status: 'active',
      expires_on: cfg.licenseExpires || null,
      grace_days: Number(cfg.licenseGrace || 7),
      renew_url: cfg.licenseRenewUrl || 'https://wa.me/2348100866322?text=Renew%20Tutoring%20Connect',
      registryUrl: cfg.licenseRegistryUrl || ''
    };
    cfg.buildType = cfg.buildType || 'traditional';
    cfg.demo = cfg.demoMode === 'yes';
    return cfg;
  },
  async build(raw) {
    const cfg = this.normalizeCfg(raw);
    const blob = await this.go(cfg);
    const slug = String(cfg.shortName || cfg.name || 'studio').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'studio';
    return { blob, fileName: slug + '-tutoring-connect.zip' };
  }
};
window.Generator = Generator;
