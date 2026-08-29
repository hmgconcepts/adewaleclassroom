/* ============================================================
   ADEWALE CLASSROOM DECK Generator — Template Engine v3 (generator.js)
   Builds a branded ClassDeck website for a client and packages
   it as a ZIP containing TWO folders:
     1) <BRAND>-CLASSDECK/      → the branded, deployable ClassDeck
     2) CLASSDECK-GENERATOR/    → the generator tool + docs (so more
                                  decks can be built / regenerated)
   Also bakes the client's SUBSCRIPTION / LIFETIME license model
   into the generated deck (issue #7).
   ============================================================ */
"use strict";

const CDGenerator = {
  _cache: {},
  _binCache: {},

  async loadFile(path) {
    if (CDGenerator._cache[path]) return CDGenerator._cache[path];
    try {
      const res = await fetch(path, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + path);
      const text = await res.text();
      CDGenerator._cache[path] = text;
      return text;
    } catch (e) {
      console.warn('[CDGen] Failed to load:', path, e.message);
      return '';
    }
  },

  async loadBinary(path) {
    if (CDGenerator._binCache[path]) return CDGenerator._binCache[path];
    try {
      const res = await fetch(path, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + path);
      const data = new Uint8Array(await res.arrayBuffer());
      const prefix = new TextDecoder().decode(data.slice(0, 400));
      if (prefix.toLowerCase().includes('<!doctype html') && prefix.includes('404')) return null;
      CDGenerator._binCache[path] = data;
      return data;
    } catch (e) {
      console.warn('[CDGen] Binary load failed:', path, e.message);
      return null;
    }
  },

  esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load: ' + src));
      document.head.appendChild(s);
    });
  },

  /* ------------------------------------------------------------
     Build the complete two-folder branded ZIP
     ------------------------------------------------------------ */
  async build(config) {
    if (!window.JSZip) {
      await CDGenerator.loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
    }
    const zip = new JSZip();
    const cfg = CDGenerator._resolveConfig(config);

    const deckFolder = cfg.deckFolder;   // e.g. "HMG-ACADEMY-CLASSDECK" or "<BRAND>-CLASSDECK"
    const genFolder = 'CLASSDECK-GENERATOR';

    /* ---------- DECK TEMPLATE FILES (branded to the client) ---------- */
    const deckFiles = [
      'index.html', 'teach.html', 'join.html', 'admin.html', '404.html',
      'stream.html', 'cbt.html', 'classroom.html', 'community.html', 'parent.html',
      'css/style.css', 'manifest.json', 'manifest.webmanifest',
      'version.json', 'robots.txt', 'sitemap.xml', 'vercel.json', '_headers',
      'sw.js', 'revoked.json',
      'js/common.js', 'js/auth.js', 'js/security-config.js', 'js/teach.js',
      'js/whiteboard.js', 'js/rtc.js', 'js/join.js',
      'js/toolkit.js', 'js/toolkit-ext.js',
      'js/toolkit-data.js', 'js/toolkit-data2.js', 'js/toolkit-data3.js',
      'js/webcast.js', 'js/enhancements.js',
      'vendor/peerjs.min.js', 'vendor/pdf.min.js',
      'vendor/pdf.worker.min.js', 'vendor/qrcode.min.js'
    ];
    const contents = {};
    for (const f of deckFiles) contents[f] = await CDGenerator.loadFile(f);

    /* ---------- ASSETS ---------- */
    const assetFiles = [
      'assets/icon-96.png', 'assets/icon-192.png', 'assets/icon-512.png',
      'assets/apple-touch-icon.png', 'assets/hmg-academy-logo.png',
      'assets/founder-photo.jpg'
    ];
    const assetBin = {};
    for (const af of assetFiles) {
      const bin = await CDGenerator.loadBinary(af);
      if (bin) assetBin[af] = bin;
    }

    /* ---------- Branding / logo ---------- */
    const logoData = cfg.logoData || '';
    const logoExt = cfg.logoExt || 'svg';
    const brandSlug = (cfg.deckFolder.replace(/-CLASSDECK$/i, '') || 'classdeck').toLowerCase();

    /* ---------- 1. Branded ClassDeck folder ---------- */
    for (const [path, content] of Object.entries(contents)) {
      if (!content) continue;
      const branded = CDGenerator._brand(path, content, cfg);
      zip.file(deckFolder + '/' + path, branded);
    }
    for (const [path, bin] of Object.entries(assetBin)) {
      zip.file(deckFolder + '/' + path, bin, { binary: true });
    }
    /* Brand logo + favicon */
    if (logoData && /^data:image\//.test(logoData) && logoExt !== 'svg') {
      zip.file(deckFolder + '/assets/brand-logo.' + logoExt, logoData.split(',')[1] || '', { base64: true });
    }
    zip.file(deckFolder + '/assets/brand-logo.png', CDGenerator._logoSVG(cfg));
    zip.file(deckFolder + '/assets/favicon.svg', CDGenerator._faviconSVG(cfg));
    /* Branded config + license engine */
    zip.file(deckFolder + '/js/config.js', CDGenerator._configJS(cfg));
    zip.file(deckFolder + '/js/license.js', CDGenerator._licenseJS(cfg));
    /* SEO / deployment files for the deck folder */
    zip.file(deckFolder + '/robots.txt', CDGenerator._robots(cfg));
    zip.file(deckFolder + '/sitemap.xml', CDGenerator._sitemap(cfg));
    zip.file(deckFolder + '/_headers', CDGenerator._headers());
    zip.file(deckFolder + '/vercel.json', CDGenerator._vercelJSON(cfg));
    zip.file(deckFolder + '/manifest.json', CDGenerator._manifest(cfg));
    zip.file(deckFolder + '/manifest.webmanifest', CDGenerator._manifestWeb(cfg));
    zip.file(deckFolder + '/version.json', JSON.stringify({
      version: cfg.version, build: Date.now(),
      channel: cfg.buildType || 'client',
      released: new Date().toISOString().slice(0, 10),
      brand: cfg.brandName
    }, null, 2));
    /* Branded landing (overwrites the generic one with full marketing page) */
    zip.file(deckFolder + '/index.html', CDGenerator._landingPage(cfg));
    /* README + deployment guide */
    zip.file(deckFolder + '/README.md', CDGenerator._readme(cfg));
    zip.file(deckFolder + '/DEPLOYMENT-GUIDE.md', CDGenerator._deployGuide(cfg));
    zip.file(deckFolder + '/LICENSE-TERMS.md', CDGenerator._licenseTerms(cfg));

    /* ---------- 2. ClassDeck Generator folder ---------- */
    const genFiles = [
      'generate.html', 'js/generator.js', 'js/common.js', 'css/style.css',
      'js/auth.js', 'js/config.js', 'js/license.js', 'js/enhancements.js'
    ];
    for (const gf of genFiles) {
      const content = contents[gf] || await CDGenerator.loadFile(gf);
      if (content) zip.file(genFolder + '/' + gf, CDGenerator._brandGenFiles(gf, content, cfg));
    }
    /* Generator assets */
    for (const af of assetFiles) {
      if (assetBin[af]) zip.file(genFolder + '/' + af, assetBin[af], { binary: true });
    }
    zip.file(genFolder + '/assets/brand-logo.png', CDGenerator._logoSVG(cfg));
    /* Generator docs */
    zip.file(genFolder + '/README.md', CDGenerator._genReadme(cfg));
    zip.file(genFolder + '/DEPLOYMENT-GUIDE.md', CDGenerator._deployGuide(cfg));

    /* ---------- ZIP output ---------- */
    const blob = await zip.generateAsync({
      type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 }
    });
    const fileName = brandSlug + '-classdeck-v3.zip';
    return { blob, fileName, folders: [deckFolder, genFolder] };
  },

  /* ------------------------------------------------------------
     Config resolution (incl. subscription/license billing)
     ------------------------------------------------------------ */
  _resolveConfig(raw) {
    const licenseModel = raw.licenseModel || 'lifetime'; // lifetime | subscription
    return {
      brandName:    raw.brandName    || 'My ClassDeck',
      shortName:    raw.shortName    || 'ClassDeck',
      tagline:      raw.tagline      || 'Teach online like a pro — from any device',
      motto:        raw.motto        || 'Learning Deliberately. Teaching Authentically.',
      address:      raw.address      || '',
      phone:        raw.phone        || '',
      email:        raw.email        || '',
      website:      raw.website      || '',
      socialFacebook: raw.socialFacebook || '',
      socialTwitter:  raw.socialTwitter  || '',
      socialInstagram: raw.socialInstagram || '',
      socialYouTube:  raw.socialYouTube  || '',
      socialWhatsApp: raw.socialWhatsApp || '',
      socialLinkedIn: raw.socialLinkedIn || '',
      socialTikTok:   raw.socialTikTok   || '',
      primaryColor: raw.primaryColor || '#1e2a78',
      accentColor:  raw.accentColor  || '#ffb347',
      bgColor:      raw.bgColor      || '#10142b',
      logoData:     raw.logoData     || '',
      logoExt:      raw.logoExt      || 'svg',
      features:     Array.isArray(raw.features) ? raw.features : [],
      hmgPowered:   raw.hmgPowered !== false,
      hmgLink:      raw.hmgLink      || 'https://hmgconcepts.pages.dev/',
      developer:    raw.developer    || 'Adewale Samson Adeagbo',
      version:      raw.version      || '11.1.1-classdesk-v3',
      buildType:    raw.buildType    || 'client',
      siteUrl:      raw.siteUrl      || '',
      deckFolder:   raw.deckFolder   || (CDGenerator._deckFolderName(raw.brandName, raw.deckFolderName)),
      /* ---- Billing / license (issue #7) ---- */
      licenseModel: licenseModel,
      licensePlan:  raw.licensePlan  || (licenseModel === 'subscription' ? 'Subscription' : 'One-time purchase (lifetime)'),
      licenseCycle: raw.licenseCycle || 'Monthly', // Monthly | Quarterly | Yearly
      licensePrice: raw.licensePrice || '',
      licenseStart: raw.licenseStart || '',
      licenseExpires: raw.licenseExpires || '',
      licenseGrace: raw.licenseGrace == null ? 7 : (+raw.licenseGrace || 0),
      licenseRenewUrl: raw.licenseRenewUrl || '',
      licenseContact: raw.licenseContact || '',
      licenseLockMsg: raw.licenseLockMsg || 'Your subscription has ended. Contact your provider to renew.'
    };
  },

  /* ------------------------------------------------------------
     License engine emitted into every generated deck
     ------------------------------------------------------------ */
  _licenseJS(cfg) {
    const lic = {
      model: cfg.licenseModel,
      plan: cfg.licensePlan,
      cycle: cfg.licenseCycle,
      price: cfg.licensePrice,
      started_on: cfg.licenseStart,
      expires_on: cfg.licenseExpires || null,
      grace_days: cfg.licenseGrace,
      renew_url: cfg.licenseRenewUrl,
      contact: cfg.licenseContact,
      lock_msg: cfg.licenseLockMsg
    };
    return `/* ============================================================
   ${cfg.brandName} — Site License & Subscription Engine
   Free, browser-based. Enforces the billing model chosen at build:
     • lifetime      → never locks (client owns the deck forever)
     • subscription  → reminder 30 days before expiry; grace banner
                       after expiry; full lock screen until renewal.
   ============================================================ */
"use strict";
window.CD_LICENSE = ${JSON.stringify(lic, null, 2)};

(function licenseEngine() {
  const L = window.CD_LICENSE;
  if (!L) return;
  if (L.model !== 'subscription' || !L.expires_on) return; // lifetime: never locks

  const expires = new Date(L.expires_on).getTime();
  if (isNaN(expires)) return;
  const now = Date.now();
  const daysLeft = Math.ceil((expires - now) / 86400000);
  const graceMs = (parseInt(L.grace_days) || 7) * 86400000;

  const brand = (window.CD_CONFIG && CD_CONFIG.brand) || document.title;

  /* 1) Reminder banner 30 days before expiry */
  if (daysLeft > 0 && daysLeft <= 30) {
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#b7791f;color:#fff;padding:9px;font-size:13px;text-align:center;font-weight:600';
    bar.textContent = '⏳ Your ' + brand + ' subscription expires in ' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's') +
      (L.renew_url ? ' — ' : ' ' ) + (L.renew_url ? '<a href="' + L.renew_url + '" style="color:#fff;text-decoration:underline;margin-left:6px">Renew now</a>' : '');
    if (L.renew_url) bar.innerHTML = bar.textContent;
    document.body.appendChild(bar);
  }

  /* 2) Grace banner after expiry */
  if (daysLeft <= 0 && now < expires + graceMs) {
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#e02b2b;color:#fff;padding:9px;font-size:13px;text-align:center;font-weight:600';
    bar.textContent = '⚠ Your subscription has expired — grace period active. Please renew to continue.';
    if (L.contact) bar.textContent += ' Contact: ' + L.contact;
    document.body.appendChild(bar);
  }

  /* 3) Hard lock after grace */
  if (now >= expires + graceMs) {
    document.documentElement.style.overflow = 'hidden';
    const lock = document.createElement('div');
    lock.id = 'cdLicenseLock';
    lock.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#10142b;color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center';
    lock.innerHTML =
      '<div style="max-width:460px">' +
      '<div style="font-size:52px">🔒</div>' +
      '<h2 style="margin:12px 0 8px">' + brand + '</h2>' +
      '<p style="color:#9aa3cf;line-height:1.7">' + (L.lock_msg || 'Your subscription has ended. Contact your provider to renew.') + '</p>' +
      (L.renew_url ? '<a class="btn primary" href="' + L.renew_url + '" style="display:inline-block;margin-top:14px;padding:12px 26px;background:linear-gradient(135deg,#4f6ef7,#7b5cff);border-radius:10px;color:#fff;text-decoration:none;font-weight:700">Renew Subscription</a>' : '') +
      (L.contact ? '<p style="color:#ffb347;margin-top:14px;font-size:13px">' + L.contact + '</p>' : '') +
      '<p style="color:#576079;font-size:12px;margin-top:8px">Powered by HMG Concepts · ' + (window.CD_CONFIG && CD_CONFIG.hmgLink) + '</p>' +
      '</div>';
    document.body.appendChild(lock);
  }
})();
`;
  },

  _licenseTerms(cfg) {
    const esc = this.esc;
    return `# License & Subscription Terms — ${esc(cfg.brandName)}

## Billing Model
- **Model:** ${cfg.licenseModel === 'subscription' ? 'Subscription (recurring)' : 'One-time payment (lifetime ownership)'}
${cfg.licenseModel === 'subscription' ? '- **Cycle:** ' + cfg.licenseCycle + (cfg.licensePrice ? ' · ' + cfg.licensePrice : '') + '\n- **Started:** ' + (cfg.licenseStart || 'at activation') + '\n- **Expires:** ' + (cfg.licenseExpires || 'not set') + '\n- **Grace:** ' + cfg.licenseGrace + ' days after expiry\n- **Renewal link:** ' + (cfg.licenseRenewUrl || 'contact provider') : '- **Cost:** ' + (cfg.licensePrice || 'as agreed') + ' — paid once, owned forever.'}

## How It Works (100% free, no servers)
- The deck ships with a browser-based license engine (\`js/license.js\`).
- **Lifetime:** the app never locks.
- **Subscription:** 30 days before expiry a renewal reminder banner appears; after expiry a grace banner shows; once grace ends the deck locks with a renewal screen. All data stays on the device; renewing simply unlocks it again.

## Renewal & Support
- Contact: ${cfg.licenseContact || cfg.phone || cfg.email || 'HMG Concepts'}
- Renewal URL: ${cfg.licenseRenewUrl || '—'}

---
Built by HMG Concepts · ${cfg.hmgLink}
`;
  },

  /* ------------------------------------------------------------
     Branding replacements applied to template files
     ------------------------------------------------------------ */
  _brand(path, content, cfg) {
    let html = content;
    const reps = {
      'ADEWALE CLASSROOM DECK': cfg.brandName,
      'ADEWALE CLASSROOM': cfg.shortName,
      'ADEWALE CLASSROOM DECK': cfg.shortName || 'ClassDeck',
      'CLASS DECK': (cfg.shortName || 'CLASS DECK').toUpperCase(),
      'ClassDeck': cfg.shortName || 'ClassDeck',
      'hmg-academy-logo.png': 'brand-logo.' + cfg.logoExt,
      'adewaleclassroom.vercel.app': cfg.siteUrl || 'classdeck.example.com',
      'adewaleclassroom.pages.dev': String(cfg.hmgLink).replace(/https?:\/\//, ''),
      '#1e2a78': cfg.primaryColor,
      '#ffb347': cfg.accentColor,
      '#10142b': cfg.bgColor,
      '#0a3d62': cfg.bgColor,
      'Adewale Samson Adeagbo': cfg.developer
    };
    for (const [from, to] of Object.entries(reps)) {
      html = html.split(from).join(to);
    }
    /* config.js / license.js references */
    html = html.replace('</head>', '<style>:root{--brand: ' + cfg.primaryColor + ';--accent: ' + cfg.accentColor + ';--bg: ' + cfg.bgColor + '}</style>\n</head>');
    return html;
  },

  _brandGenFiles(name, content, cfg) {
    /* The generator folder keeps the HMG identity (it's HMG's internal tool). */
    return content;
  },

  slug(s) {
    return String(s || 'classdeck').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'classdeck';
  },

  /* Folder name for the branded deck, e.g. "HMG-ACADEMY-CLASSDECK", "MATH-TUTORS-CLASSDECK" */
  _deckFolderName(brand, override) {
    if (override) return String(override);
    let slug = CDGenerator.slug(brand || 'classdeck').toUpperCase();
    /* avoid "X-CLASS-DECK-CLASSDECK" duplication — strip trailing CLASS-DECK variants */
    slug = slug.replace(/-?(?:CLASS-?DECK)$/, '').replace(/-DECK$/, '');
    if (!slug) return 'CLASSDECK';
    return slug + '-CLASSDECK';
  },

  _configJS(cfg) {
    return `/* Generated-brand configuration for ${cfg.brandName} */
window.CD_CONFIG = {
  brand: ${JSON.stringify(cfg.brandName)},
  shortName: ${JSON.stringify(cfg.shortName)},
  tagline: ${JSON.stringify(cfg.tagline)},
  motto: ${JSON.stringify(cfg.motto)},
  address: ${JSON.stringify(cfg.address)},
  phone: ${JSON.stringify(cfg.phone)},
  email: ${JSON.stringify(cfg.email)},
  website: ${JSON.stringify(cfg.website)},
  primaryColor: ${JSON.stringify(cfg.primaryColor)},
  accentColor: ${JSON.stringify(cfg.accentColor)},
  bgColor: ${JSON.stringify(cfg.bgColor)},
  socials: ${JSON.stringify({ facebook: cfg.socialFacebook, twitter: cfg.socialTwitter, instagram: cfg.socialInstagram, youtube: cfg.socialYouTube, whatsapp: cfg.socialWhatsApp, linkedin: cfg.socialLinkedIn, tiktok: cfg.socialTikTok })},
  features: ${JSON.stringify(cfg.features)},
  hmgPowered: ${!!cfg.hmgPowered},
  hmgLink: ${JSON.stringify(cfg.hmgLink)},
  developer: ${JSON.stringify(cfg.developer)},
  version: ${JSON.stringify(cfg.version)}
};

/* ⚠️ IMPORTANT — client deployments must NOT inherit HMG founder credentials.
   Clearing HMG_OWNER disables the founder "never-expires" account on this
   branded client deck; teachers here use the normal trial/license flow. */
window.HMG_OWNER = { email: "", password: "", name: "" };

console.log('[ClassDeck] Brand config loaded —', CD_CONFIG.brand);`;
  },

  _landingPage(cfg) {
    const esc = this.esc;
    const features = cfg.features.length ? cfg.features : [
      'Split-screen whiteboard & PDF workspace',
      'Built-in live classroom with WebRTC',
      '200+ teaching tools included',
      'Quizzes with leaderboards & auto-scoring',
      'Branded lesson recording with intro & outro',
      'No-OBS social live streaming'
    ];
    const socialLinks = [
      ['facebook', cfg.socialFacebook, '📘'], ['twitter', cfg.socialTwitter, '🐦'],
      ['instagram', cfg.socialInstagram, '📸'], ['youtube', cfg.socialYouTube, '▶️'],
      ['whatsapp', cfg.socialWhatsApp, '💬'], ['linkedin', cfg.socialLinkedIn, '💼'],
      ['tiktok', cfg.socialTikTok, '🎵']
    ].filter(([_, u]) => u).map(([_, u, em]) => '<a href="' + esc(u) + '" target="_blank" rel="noopener" style="font-size:1.5rem;text-decoration:none;margin:0 6px">' + em + '</a>').join('');
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(cfg.brandName)} — ${esc(cfg.tagline)}</title>
<meta name="description" content="${esc(cfg.brandName)}: ${esc(cfg.tagline)}. Built by ${esc(cfg.developer)}." />
<meta name="author" content="${esc(cfg.developer)}" />
<link rel="manifest" href="manifest.webmanifest" />
<link rel="icon" href="assets/favicon.svg" />
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png" />
<meta name="theme-color" content="${cfg.primaryColor}" />
<meta property="og:title" content="${esc(cfg.brandName)} — ${esc(cfg.tagline)}" />
<meta property="og:description" content="${esc(cfg.tagline)}" />
<meta property="og:type" content="website" />
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"SoftwareApplication","name":"${esc(cfg.brandName)}","applicationCategory":"EducationalApplication","operatingSystem":"Web, Android, iOS, Windows, macOS, Linux","description":"${esc(cfg.tagline)}","creator":{"@type":"Person","name":"${esc(cfg.developer)}"},"offers":{"@type":"Offer","price":"0","priceCurrency":"USD"}}
</script>
<link rel="stylesheet" href="css/style.css" />
</head>
<body>
<div class="landing">
  <img class="logo" src="assets/brand-logo.${cfg.logoExt}" alt="${esc(cfg.brandName)}" style="width:auto;max-width:200px;border-radius:14px" />
  <h1>${esc(cfg.brandName)}</h1>
  <p class="tag">${esc(cfg.tagline)}</p>
  ${cfg.motto ? '<p class="tag" style="font-weight:600;margin-top:4px">' + esc(cfg.motto) + '</p>' : ''}
  <div class="cards">
    <a class="card" href="teach.html" style="text-decoration:none;color:inherit"><div class="em">🧑‍🏫</div><h3>I'm a Teacher</h3><p>Open the Teacher Studio — run your own live class with cameras, chat, polls, quizzes and attendance.</p><span class="btn primary">Start teaching ➜</span></a>
    <a class="card" href="join.html" style="text-decoration:none;color:inherit"><div class="em">🎓</div><h3>I'm a Student</h3><p>Got a class link or room code from your teacher? Join in seconds — free, no account, on any device.</p><span class="btn">Join my class ➜</span></a>
  </div>
  <div class="feat-list"><h2>Why choose ${esc(cfg.brandName)}</h2><div class="feat-grid">${features.map(f => '<div class="feat"><b>✦</b> ' + esc(f) + '</div>').join('')}</div></div>
  ${(cfg.address || cfg.phone || cfg.email) ? '<div style="display:flex;gap:16px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px 22px;margin-top:38px;max-width:640px;flex-wrap:wrap;justify-content:center"><div style="min-width:220px;flex:1;text-align:center">' +
    (cfg.address ? '<div style="font-size:13px">📍 ' + esc(cfg.address) + '</div>' : '') +
    (cfg.phone ? '<div style="font-size:13px">📞 ' + esc(cfg.phone) + '</div>' : '') +
    (cfg.email ? '<div style="font-size:13px">✉️ ' + esc(cfg.email) + '</div>' : '') +
    (cfg.website ? '<div style="font-size:13px">🌐 ' + esc(cfg.website) + '</div>' : '') +
    (socialLinks ? '<div style="margin-top:8px">' + socialLinks + '</div>' : '') +
    '</div></div>' : ''}
  <footer><b>${esc(cfg.brandName)}</b> — ${cfg.hmgPowered ? 'Powered by <a href="' + esc(cfg.hmgLink) + '" target="_blank" rel="noopener">HMG Concepts</a>' : 'All rights reserved.'}<button class="btn small install-btn hide" onclick="promptInstall()" style="margin-top:10px">⬇ Install ${esc(cfg.shortName)}</button></footer>
</div>
<script src="js/common.js"></script>
<script src="js/config.js"></script>
<script src="js/license.js"></script>
</body>
</html>`;
  },

  _logoSVG(cfg) {
    const initial = (cfg.shortName || cfg.brandName || 'C')[0].toUpperCase();
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="40" fill="' + cfg.primaryColor + '"/><text x="100" y="135" font-family="Arial, sans-serif" font-size="110" font-weight="900" text-anchor="middle" fill="' + cfg.accentColor + '">' + initial + '</text></svg>';
  },
  _faviconSVG(cfg) {
    const initial = (cfg.shortName || 'C')[0].toUpperCase();
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="' + cfg.primaryColor + '"/><text x="16" y="23" font-family="Arial" font-size="20" font-weight="900" text-anchor="middle" fill="' + cfg.accentColor + '">' + initial + '</text></svg>';
  },

  _robots(cfg) {
    const base = cfg.siteUrl ? cfg.siteUrl.replace(/\/+$/, '') : '';
    return 'User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /revoked.json\n\nSitemap: ' + (base ? base + '/sitemap.xml' : '/sitemap.xml') + '\n';
  },
  _sitemap(cfg) {
    const base = (cfg.siteUrl || 'https://example.com').replace(/\/+$/, '');
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      ['/', '/teach.html', '/join.html', '/stream.html'].map(p => '  <url><loc>' + base + p + '</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>').join('\n') + '\n</urlset>';
  },
  _headers() {
    return '/*\n  X-Frame-Options: SAMEORIGIN\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload\n  Cross-Origin-Resource-Policy: same-origin\n  Permissions-Policy: camera=(self), microphone=(self), display-capture=(self), geolocation=()\n  Cross-Origin-Opener-Policy: same-origin-allow-popups\n\n/sw.js\n  Cache-Control: public, max-age=0, must-revalidate\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/vendor/*\n  Cache-Control: public, max-age=31536000, immutable\n';
  },
  _vercelJSON(cfg) {
    return JSON.stringify({ headers: [
      { source: '/(.*)', headers: [
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), display-capture=(self)' }
      ] },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }] }
    ] }, null, 2);
  },
  _manifest(cfg) {
    return JSON.stringify({ name: cfg.brandName + ' v3', short_name: cfg.shortName || 'ClassDeck', description: cfg.tagline + ' — ' + (cfg.motto || ''), start_url: './index.html', display: 'standalone', background_color: cfg.bgColor, theme_color: cfg.primaryColor, categories: ['education', 'productivity'], icons: [
      { src: 'assets/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'assets/icon-512.png', sizes: '512x512', type: 'image/png' }
    ] }, null, 2);
  },
  _manifestWeb(cfg) {
    return JSON.stringify({ name: cfg.brandName + ' — Split-Screen Teaching Studio', short_name: cfg.shortName || 'ClassDeck', description: cfg.tagline, id: '/', start_url: './index.html', scope: './', display: 'standalone', orientation: 'any', background_color: cfg.bgColor, theme_color: cfg.primaryColor, lang: 'en', categories: ['education', 'productivity'], display_override: ['window-controls-overlay', 'minimal-ui', 'standalone'], icons: [
      { src: 'assets/icon-96.png', sizes: '96x96', type: 'image/png' },
      { src: 'assets/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: 'assets/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    ], shortcuts: [
      { name: 'Start a class', url: './teach.html', description: 'Open the teacher studio' },
      { name: 'Join a class', url: './join.html', description: 'Join as a student' }
    ] }, null, 2);
  },

  _readme(cfg) {
    return `# ${cfg.brandName} — ClassDeck v3

**${cfg.tagline}**

## Contents
- \`${cfg.deckFolder}/\` — the complete branded ClassDeck website (deploy this folder)
- \`CLASSDECK-GENERATOR/\` — the generator tool, so more branded decks can be produced

## Quick Start
1. Upload the \`${cfg.deckFolder}\` folder contents to a GitHub repository
2. Deploy to Vercel / Netlify / Cloudflare Pages / GitHub Pages
3. Open the live URL and start teaching!

## Billing
- Model: **${cfg.licenseModel === 'subscription' ? cfg.licenseCycle + ' subscription' : 'one-time lifetime'}**
- See LICENSE-TERMS.md for full terms.

---
${cfg.hmgPowered ? 'Built by HMG Concepts · ' + cfg.hmgLink : ''}
`;
  },

  _deployGuide(cfg) {
    const esc = this.esc;
    return `# 🚀 Deployment Guide — ${esc(cfg.brandName)}

## Step 1: Upload to GitHub
1. Create a new repository at https://github.com/new
2. Upload ALL files from the \`${cfg.deckFolder}\` folder (keep structure)
3. Commit to main branch

## Step 2: Deploy (pick one — all free)

### Vercel (recommended)
1. https://vercel.com → Import repository
2. Framework: Other → Root: ./ → Build: (none) → Output: ./
3. Deploy

### Netlify
1. https://app.netlify.com/drop → drag the \`${cfg.deckFolder}\` folder → live

### Cloudflare Pages
1. Dashboard → Pages → Connect to Git → Framework: None → Deploy

### GitHub Pages
1. Repo → Settings → Pages → main / root → Save

## Step 3: Post-deploy checklist
- [ ] Landing page shows your brand/logo
- [ ] Teacher Studio signup works (teach.html)
- [ ] Student join works (join.html)
- [ ] Recording opens the branded studio (⏺ Rec)
- [ ] Subscription/license engine shows correct banner (js/license.js)

## Support
${esc(cfg.developer)} · ${cfg.contact ? esc(cfg.licenseContact) : ''} · ${cfg.hmgLink}

**${esc(cfg.brandName)}** — ${esc(cfg.tagline)}
`;
  },

  _genReadme(cfg) {
    return `# ClassDeck Generator (HMG Concepts internal tool)

Use \`generate.html\` to build a branded ClassDeck for any client:
1. Open generate.html
2. Fill brand details, colors, contact/socials, features
3. Choose the billing model (lifetime or monthly/quarterly/yearly subscription)
4. Generate & download the ZIP
5. Upload the <CLIENT>-CLASSDECK folder to GitHub and deploy

The generated ZIP contains two folders:
- **<CLIENT>-CLASSDECK/** — the client's branded, deployable deck
- **CLASSDECK-GENERATOR/** — this generator (so more decks can be built)

Deployment options: Vercel, Netlify, Cloudflare Pages, GitHub Pages — all free.
No AI APIs, no paid servers, no database required.

Built by HMG Concepts · ${cfg.hmgLink}
`;
  }
};

window.CDGenerator = CDGenerator;
console.log('[ClassDeck Generator v3] Loaded — two-folder builds + subscription licensing.');