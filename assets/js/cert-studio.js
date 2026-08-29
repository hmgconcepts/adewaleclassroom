/* ============================================================================
   cert-studio.js — the certificate studio  (report item 19)
   ----------------------------------------------------------------------------
   THE COMPLAINT

   "The certificates generated are not advanced and sophisticated like that on
    School Connect and the GOSA site. Understudy the certificate generation on
    School Connect and the GOSA site and then implement it on Tutoring Connect."

   WHAT SCHOOL CONNECT AND GOSA ACTUALLY DO (read from ref/schoolconnect/
   certificates.html and ref/gosaportal/certificates.html)

     * a PREMIUM layout with mitred navy and gold corner wedges, a double
       gold rule with an offset outline, a gold foil ribbon banner reading
       "THIS IS TO CERTIFY THAT", a radial-gradient rosette with two ribbon
       tails, the organisation's crest, address, phone and motto;
     * three further layouts (classic, modern, elegant) driven by a chosen
       font, primary and accent colour, and border style;
     * a signature pulled from a GOOGLE DRIVE LINK — never an upload —
       rendered with multiply blending so it sits on the paper rather than on
       a white box;
     * a unique VERIFICATION CODE on every certificate, checkable on a public
       page;
     * batch issue straight from CBT results.

   WHAT TUTORING CONNECT HAD

     A CRUD list over a four-column table: learner_name, title, code,
     issued_on. No design, no preview, no print layout, no verification.

   WHAT THIS FILE ADDS

   All of the above, plus four things the reference sites do not have:

     1. SIX layouts, not four. 'minimal' for a weekly effort award that should
        not look like a degree, and 'diploma' in landscape for end-of-programme
        awards.
     2. The DESIGN IS STORED WITH THE AWARD. On the reference sites the design
        lives only in the form, so a certificate reprinted after the studio
        rebrands comes out in the new colours and no longer matches the copy
        the family already has. Here the layout, colours, font, border, seal
        and signature are written onto the certificate row.
     3. REUSABLE TEMPLATES (tc_certificate_templates), so a studio sets its
        house style once instead of re-picking six controls every time.
     4. REVOCATION. A certificate issued in error can be revoked with a reason,
        and verification then reports it as revoked rather than simply
        vanishing — which is the honest behaviour.

   No uploads anywhere: the logo, the signature and the seal are all links,
   which is what keeps the studio inside the Supabase free tier.
   ========================================================================== */
(function (w) {
  'use strict';

  var d = w.document;
  function sb() { return w.sb || (w.App && w.App.sb) || null; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(m, k, ms) {
    if (w.toast) return w.toast(m, k || 'info', ms || 4000);
    console.log(m);
  }
  function studio() { return w.PRACTICE || w.SCHOOL || {}; }

  /* A Google Drive share link is not an image URL. Convert it, exactly as the
     reference sites do, or every signature renders as a broken image. */
  function directImage(u) {
    u = String(u || '').trim();
    if (!u) return '';
    var m = u.match(/drive\.google\.com\/file\/d\/([^/]+)/) ||
            u.match(/drive\.google\.com\/open\?id=([^&]+)/) ||
            u.match(/[?&]id=([^&]+)/);
    if (m) return 'https://drive.google.com/uc?export=view&id=' + m[1];
    return u;
  }

  function dmy(v) {
    var dt = v ? new Date(v) : new Date();
    if (isNaN(dt)) dt = new Date();
    return String(dt.getDate()).padStart(2, '0') + '/' +
           String(dt.getMonth() + 1).padStart(2, '0') + '/' + dt.getFullYear();
  }

  /* A code a human can read over the phone: no O/0 or I/1 confusion. */
  function newCode() {
    var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
    for (var i = 0; i < 8; i++) s += A[Math.floor(Math.random() * A.length)];
    return 'TC-' + s.slice(0, 4) + '-' + s.slice(4);
  }

  var KINDS = ['achievement', 'completion', 'merit', 'distinction',
               'attendance', 'participation', 'improvement', 'testimonial'];

  var LAYOUTS = [
    ['premium',  'Premium gold — crest, rosette, ribbon (School Connect style)'],
    ['diploma',  'Diploma — landscape, formal, for end of programme'],
    ['classic',  'Classic — double border, serif, restrained'],
    ['modern',   'Modern — gradient wash, sans-serif, clean'],
    ['elegant',  'Elegant — cream paper, thin rules, script name'],
    ['minimal',  'Minimal — for a weekly award that should not look like a degree']
  ];

  var FONTS = ['Georgia, serif', "'Times New Roman', serif", 'Garamond, serif',
               "'Plus Jakarta Sans', system-ui, sans-serif", 'Arial, sans-serif',
               "'Courier New', monospace"];

  var CertStudio = {

    state: { code: '', sig: '', editing: null, rows: [], templates: [], learners: [] },

    /* ======================================================================
       THE RENDERER — one function, six layouts.
       ====================================================================== */
    html: function (o) {
      var s = studio();
      var logo = o.logo_url ? directImage(o.logo_url) : (s.logo || 'assets/img/logo.png');
      var sig = o.sig ? directImage(o.sig) : '';
      var pc = o.pc || '#0506ae';
      var ac = o.ac || '#964eec';
      var name = esc(o.name || '\u00A0');
      var body = esc(o.body || 'has successfully completed the programme.');
      var code = esc(o.code || '');
      var sigBlock = sig
        ? '<img src="' + esc(sig) + '" referrerpolicy="no-referrer" alt="" ' +
          'style="height:48px;display:block;margin:0 auto -6px;mix-blend-mode:multiply;' +
          'filter:contrast(1.25) brightness(1.05)" onerror="this.style.display=\'none\'">'
        : '';
      var verify = '<p style="margin-top:14px;font-size:.66rem;color:#94a3b8;letter-spacing:.3px">' +
        'Verification code <strong>' + code + '</strong>' +
        (o.valid_until ? ' · valid until ' + esc(dmy(o.valid_until)) : '') +
        ' · verify at <em>certificates.html?verify=' + code + '</em></p>';

      /* ---- PREMIUM ---------------------------------------------------- */
      if (o.layout === 'premium') {
        var gold = '#c9a227', navy = pc;
        var seal = esc((o.seal_text || s.shortName || s.name || 'STUDIO').toUpperCase()).slice(0, 22);
        var rosette =
          '<div style="position:relative;width:120px;margin:10px auto 0">' +
            '<div style="width:100px;height:100px;margin:0 auto;border-radius:50%;' +
              'background:radial-gradient(circle at 32% 28%,#f6e27a,#c9a227 58%,#8a6d1a);' +
              'display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.25)">' +
              '<div style="width:76px;height:76px;border-radius:50%;border:2px solid #fff8e1;' +
                'display:flex;align-items:center;justify-content:center;text-align:center;' +
                'color:#3b2f0b;font-family:Georgia,serif;font-weight:800;font-size:.52rem;' +
                'line-height:1.25;padding:6px">' + seal + '<br>★ ★ ★</div></div>' +
            '<div style="position:absolute;left:50%;transform:translateX(-58%);bottom:-24px;' +
              'width:24px;height:34px;background:' + navy + ';clip-path:polygon(0 0,100% 0,100% 100%,50% 72%,0 100%)"></div>' +
            '<div style="position:absolute;left:50%;transform:translateX(-8%);bottom:-24px;' +
              'width:24px;height:34px;background:' + navy + ';clip-path:polygon(0 0,100% 0,100% 100%,50% 72%,0 100%)"></div>' +
          '</div>';

        return '<div class="cert-sheet" style="position:relative;width:780px;max-width:96vw;' +
          'background:#fff;padding:6px;box-shadow:0 12px 34px rgba(0,0,0,.18)">' +
          '<div style="position:absolute;inset:0;pointer-events:none;background:' +
            'linear-gradient(135deg,' + navy + ' 0,transparent 18%),' +
            'linear-gradient(315deg,' + navy + ' 0,transparent 18%);opacity:.92"></div>' +
          '<div style="position:absolute;inset:0;pointer-events:none;background:' +
            'linear-gradient(135deg,' + gold + ' 0,transparent 12%),' +
            'linear-gradient(315deg,' + gold + ' 0,transparent 12%);opacity:.85"></div>' +
          '<div style="position:relative;border:2px solid ' + gold + ';outline:1px solid ' + gold + ';' +
            'outline-offset:6px;padding:42px 46px;text-align:center;' +
            'font-family:Georgia,\'Times New Roman\',serif;background:#fffefb">' +
            '<img src="' + esc(logo) + '" alt="" style="width:84px;height:84px;object-fit:contain" ' +
              'onerror="this.style.display=\'none\'">' +
            '<h1 style="margin:10px 0 4px;color:' + navy + ';font-size:1.85rem;letter-spacing:1.5px;' +
              'font-weight:900">' + esc((s.name || 'TUTORING STUDIO').toUpperCase()) + '</h1>' +
            (s.address ? '<p style="margin:2px 0;font-size:.82rem;color:#334155">📍 ' + esc(s.address) + '</p>' : '') +
            (s.phone ? '<p style="margin:2px 0;font-size:.82rem;color:#334155">📞 ' + esc(s.phone) + '</p>' : '') +
            (s.motto ? '<p style="margin:10px auto;font-style:italic;color:#7c2d12;font-size:.9rem;' +
              'max-width:560px;border-top:1px solid ' + gold + ';border-bottom:1px solid ' + gold + ';' +
              'padding:5px 0">— ' + esc(s.motto) + ' —</p>' : '') +
            '<h2 style="margin:18px 0 0;font-size:2.7rem;letter-spacing:8px;color:' + gold + ';' +
              'font-weight:700">CERTIFICATE</h2>' +
            '<div style="font-size:1rem;letter-spacing:6px;color:' + navy + ';margin:2px 0 16px">— OF ' +
              esc((o.subtitle || o.kind || 'ACHIEVEMENT').toUpperCase()) + ' —</div>' +
            '<div style="display:inline-block;background:linear-gradient(90deg,#8a6d1a,' + gold +
              ',#f6e27a,' + gold + ',#8a6d1a);color:#fff;font-size:.76rem;letter-spacing:3px;' +
              'padding:7px 34px;clip-path:polygon(3% 0,97% 0,100% 50%,97% 100%,3% 100%,0 50%);' +
              'font-weight:700">THIS IS TO CERTIFY THAT</div>' +
            '<h2 style="margin:24px auto 0;max-width:560px;border-bottom:2px solid ' + navy + ';' +
              'padding-bottom:8px;font-size:1.65rem;color:#111;font-family:\'Segoe Script\',Georgia,serif">' +
              name + '</h2>' +
            (o.subject ? '<p style="margin:8px 0 0;font-size:.9rem;color:' + navy + ';font-weight:700">' +
              esc(o.subject) + (o.grade ? ' · Grade ' + esc(o.grade) : '') +
              (o.score != null && o.score !== '' ? ' · ' + esc(o.score) + '%' : '') + '</p>' : '') +
            '<p style="max-width:560px;margin:14px auto 4px;line-height:1.7;color:#1f2937">' + body + '</p>' +
            rosette +
            '<div style="display:flex;justify-content:space-between;align-items:flex-end;' +
              'margin-top:42px;font-size:.74rem;color:' + navy + ';font-weight:700">' +
              '<div style="width:190px"><div style="border-top:1.5px solid ' + navy + ';padding-top:4px">' +
                esc((o.countersign || 'EXAMINATION OFFICER').toUpperCase()) + '</div></div>' +
              '<div style="width:190px">' + sigBlock +
                '<div style="border-top:1.5px solid ' + navy + ';padding-top:4px">' +
                esc((o.signatory || 'LEAD TUTOR').toUpperCase()) + '</div></div></div>' +
            '<div style="margin-top:16px;font-size:.78rem;color:' + navy + ';font-weight:700">DATE: ' +
              '<span style="border-bottom:1px solid ' + navy + ';padding:0 30px">' + esc(dmy(o.date)) + '</span></div>' +
            verify +
          '</div></div>';
      }

      /* ---- DIPLOMA (landscape) ---------------------------------------- */
      if (o.layout === 'diploma') {
        return '<div class="cert-sheet" style="width:900px;max-width:96vw;background:' +
          'linear-gradient(#fffdf6,#fffdf6) padding-box,linear-gradient(135deg,' + pc + ',' + ac +
          ') border-box;border:10px solid transparent;border-radius:4px;padding:40px 54px;' +
          'text-align:center;font-family:' + esc(o.font || 'Georgia, serif') + ';' +
          'box-shadow:0 14px 40px rgba(0,0,0,.16)">' +
          '<div style="display:flex;align-items:center;justify-content:center;gap:14px">' +
            '<img src="' + esc(logo) + '" alt="" style="width:56px;height:56px;object-fit:contain" ' +
              'onerror="this.style.display=\'none\'">' +
            '<div style="text-align:left"><div style="font-size:1.35rem;font-weight:900;color:' + pc + '">' +
              esc(s.name || 'Tutoring studio') + '</div>' +
              '<div style="font-size:.8rem;color:#64748b">' + esc(s.motto || '') + '</div></div></div>' +
          '<div style="height:2px;background:linear-gradient(90deg,transparent,' + ac + ',transparent);margin:18px 0"></div>' +
          '<div style="font-size:.78rem;letter-spacing:7px;color:' + ac + ';font-weight:800">' +
            esc((o.title || 'DIPLOMA').toUpperCase()) + '</div>' +
          '<h2 style="margin:18px 0 4px;font-size:2.1rem;color:#111">' + name + '</h2>' +
          '<div style="width:220px;height:2px;background:' + pc + ';margin:0 auto 14px"></div>' +
          '<p style="max-width:640px;margin:0 auto;line-height:1.75;color:#1f2937">' + body + '</p>' +
          (o.subject ? '<p style="margin:12px 0 0;font-weight:700;color:' + pc + '">' + esc(o.subject) +
            (o.grade ? ' — ' + esc(o.grade) : '') + '</p>' : '') +
          '<div style="display:flex;justify-content:space-around;margin-top:44px;font-size:.8rem">' +
            '<div style="width:220px"><div style="border-top:1px solid #94a3b8;padding-top:5px">' +
              esc(dmy(o.date)) + '</div><small style="color:#64748b">Date</small></div>' +
            '<div style="width:220px">' + sigBlock +
              '<div style="border-top:1px solid #94a3b8;padding-top:5px">' + esc(o.signatory || 'Lead Tutor') +
              '</div><small style="color:#64748b">' + esc(o.signatory_role || 'For the studio') + '</small></div>' +
          '</div>' + verify + '</div>';
      }

      /* ---- MINIMAL ----------------------------------------------------- */
      if (o.layout === 'minimal') {
        return '<div class="cert-sheet" style="width:620px;max-width:96vw;background:#fff;' +
          'border-top:6px solid ' + pc + ';border-radius:10px;padding:34px 38px;' +
          'font-family:' + esc(o.font || "'Plus Jakarta Sans', system-ui, sans-serif") + ';' +
          'box-shadow:0 8px 26px rgba(0,0,0,.10)">' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">' +
            '<img src="' + esc(logo) + '" alt="" style="width:34px;height:34px;object-fit:contain" ' +
              'onerror="this.style.display=\'none\'">' +
            '<b style="color:' + pc + '">' + esc(s.name || 'Tutoring studio') + '</b></div>' +
          '<div style="font-size:.72rem;letter-spacing:3px;color:' + ac + ';font-weight:800">' +
            esc((o.title || 'AWARD').toUpperCase()) + '</div>' +
          '<h2 style="margin:6px 0 10px;font-size:1.5rem">' + name + '</h2>' +
          '<p style="margin:0;line-height:1.6;color:#334155">' + body + '</p>' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:26px;' +
            'font-size:.78rem;color:#64748b">' +
            '<span>' + esc(dmy(o.date)) + '</span>' +
            '<span>' + sigBlock + esc(o.signatory || 'Lead Tutor') + '</span></div>' +
          verify + '</div>';
      }

      /* ---- CLASSIC / MODERN / ELEGANT ---------------------------------- */
      var bg = o.layout === 'modern'
        ? 'background:linear-gradient(135deg,' + pc + '12,' + ac + '12)'
        : o.layout === 'elegant' ? 'background:#fffef8' : 'background:#fff';
      var border = o.layout === 'elegant'
        ? '3px solid ' + ac
        : '12px ' + (o.border || 'double') + ' ' + pc;

      return '<div class="cert-sheet" style="width:800px;max-width:96vw;border:' + border + ';' +
        'padding:40px;text-align:center;font-family:' + esc(o.font || 'Georgia, serif') + ';' + bg + ';' +
        'box-shadow:0 10px 30px rgba(0,0,0,.12)">' +
        '<img src="' + esc(logo) + '" alt="" style="width:62px;height:62px;border-radius:12px;' +
          'object-fit:contain" onerror="this.style.display=\'none\'">' +
        '<h1 style="margin:8px 0 2px;color:' + pc + '">' + esc(s.name || 'Tutoring studio') + '</h1>' +
        '<p style="color:#64748b;margin:0 0 18px">' + esc(s.motto || '') + '</p>' +
        '<h2 style="letter-spacing:3px;color:' + ac + '">' + esc(o.title || 'CERTIFICATE') + '</h2>' +
        '<p style="margin:16px 0 4px">This is to certify that</p>' +
        '<h2 style="margin:0;border-bottom:2px solid ' + ac + ';display:inline-block;padding:0 30px 6px;' +
          (o.layout === 'elegant' ? 'font-family:\'Segoe Script\',Georgia,serif;' : '') + '">' + name + '</h2>' +
        (o.subject ? '<p style="margin:10px 0 0;font-weight:700;color:' + pc + '">' + esc(o.subject) +
          (o.grade ? ' · ' + esc(o.grade) : '') + '</p>' : '') +
        '<p style="max-width:560px;margin:18px auto;line-height:1.65">' + body + '</p>' +
        '<div style="display:flex;justify-content:space-between;margin-top:38px;font-size:.84rem">' +
          '<div>____________________<br>Date: ' + esc(dmy(o.date)) + '</div>' +
          '<div>' + sigBlock + '____________________<br>' + esc(o.signatory || 'Lead Tutor') + '</div></div>' +
        verify + '</div>';
    },

    /* ======================================================================
       MOUNT — build the page.
       ====================================================================== */
    async mount(rootId) {
      var host = d.getElementById(rootId || 'cert-root');
      if (!host) return;
      var self = this;

      host.innerHTML = '<div class="card"><p class="muted">Loading the certificate studio…</p></div>';
      await this._load();

      host.innerHTML =
        '<div class="grid" style="grid-template-columns:minmax(320px,420px) 1fr;gap:16px;align-items:start">' +

        /* ---- left: the controls ---- */
        '<div>' +
          '<section class="card">' +
            '<h2 style="margin:0 0 4px">🏆 Issue a certificate</h2>' +
            '<p class="muted" style="margin:0 0 12px">The preview on the right updates as you type. ' +
              'Nothing is uploaded — the logo and the signature are links, which is what keeps the ' +
              'studio inside the free tier.</p>' +

            '<div class="form-group"><label for="ct-template">Start from a saved design</label>' +
              '<select class="form-select" id="ct-template"></select>' +
              '<div class="form-help">Saved designs keep your house style. Pick one, or build a new one below and save it.</div></div>' +

            '<div class="form-group"><label for="ct-learner">Recipient</label>' +
              '<select class="form-select" id="ct-learner"></select>' +
              '<div class="form-help">Pick from the roll, or type a name below for someone who is not on it.</div></div>' +
            '<div class="form-group"><label for="ct-name">Name as it should be printed</label>' +
              '<input class="form-input" id="ct-name"></div>' +

            '<div class="grid grid-2">' +
              '<div class="form-group"><label for="ct-kind">Kind of award</label>' +
                '<select class="form-select" id="ct-kind">' +
                  KINDS.map(function (k) { return '<option value="' + k + '">' + k + '</option>'; }).join('') +
                '</select></div>' +
              '<div class="form-group"><label for="ct-date">Date</label>' +
                '<input class="form-input" type="date" id="ct-date"></div>' +
              '<div class="form-group"><label for="ct-subject">Subject (optional)</label>' +
                '<input class="form-input" id="ct-subject"></div>' +
              '<div class="form-group"><label for="ct-grade">Grade / score (optional)</label>' +
                '<input class="form-input" id="ct-grade"></div>' +
            '</div>' +

            '<div class="form-group"><label for="ct-title">Certificate title</label>' +
              '<input class="form-input" id="ct-title" value="CERTIFICATE OF ACHIEVEMENT"></div>' +
            '<div class="form-group"><label for="ct-subtitle">Sub-title</label>' +
              '<input class="form-input" id="ct-subtitle" value="ACHIEVEMENT"></div>' +
            '<div class="form-group"><label for="ct-body">Body text</label>' +
              '<textarea class="form-textarea" id="ct-body" rows="3">has successfully met the requirements of the programme and is hereby recognised for outstanding achievement.</textarea></div>' +

            '<h3 style="margin:16px 0 6px">🎨 Design</h3>' +
            '<div class="form-group"><label for="ct-layout">Layout</label>' +
              '<select class="form-select" id="ct-layout">' +
                LAYOUTS.map(function (l) { return '<option value="' + l[0] + '">' + esc(l[1]) + '</option>'; }).join('') +
              '</select></div>' +
            '<div class="grid grid-2">' +
              '<div class="form-group"><label for="ct-font">Font</label><select class="form-select" id="ct-font">' +
                FONTS.map(function (f) { return '<option value="' + esc(f) + '">' + esc(f.split(',')[0].replace(/\'/g, '')) + '</option>'; }).join('') +
              '</select></div>' +
              '<div class="form-group"><label for="ct-border">Border</label>' +
                '<select class="form-select" id="ct-border">' +
                  ['double', 'solid', 'ridge', 'groove', 'dashed'].map(function (b) {
                    return '<option>' + b + '</option>'; }).join('') + '</select></div>' +
              '<div class="form-group"><label for="ct-pc">Primary colour</label>' +
                '<input class="form-input" type="color" id="ct-pc" value="#0506ae"></div>' +
              '<div class="form-group"><label for="ct-ac">Accent colour</label>' +
                '<input class="form-input" type="color" id="ct-ac" value="#964eec"></div>' +
            '</div>' +
            '<div class="grid grid-2">' +
              '<div class="form-group"><label for="ct-sig">Signatory</label>' +
                '<input class="form-input" id="ct-sig" value="Lead Tutor"></div>' +
              '<div class="form-group"><label for="ct-countersign">Counter-signatory</label>' +
                '<input class="form-input" id="ct-countersign" value="Examination Officer"></div>' +
            '</div>' +
            '<div class="form-group"><label for="ct-sigurl">Signature image link</label>' +
              '<input class="form-input" type="url" id="ct-sigurl" placeholder="https://drive.google.com/file/d/…">' +
              '<div class="form-help">A Google Drive share link works — it is converted to a direct image link for you. Nothing is uploaded or stored in the database.</div></div>' +
            '<div class="form-group"><label for="ct-seal">Seal text</label>' +
              '<input class="form-input" id="ct-seal" placeholder="Shown inside the gold rosette on the premium layout"></div>' +
            '<div class="form-group"><label for="ct-valid">Valid until (optional)</label>' +
              '<input class="form-input" type="date" id="ct-valid"></div>' +

            '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">' +
              '<button class="btn btn-primary" type="button" id="ct-issue">🏆 Issue &amp; print</button>' +
              '<button class="btn btn-outline" type="button" id="ct-print">🖨 Print preview only</button>' +
              '<button class="btn btn-outline" type="button" id="ct-savetpl">💾 Save this design</button>' +
              '<button class="btn btn-ghost" type="button" id="ct-newcode">↻ New code</button>' +
            '</div>' +
          '</section>' +

          '<section class="card" style="margin-top:14px">' +
            '<h3 style="margin:0 0 6px">📦 Batch issue from a quiz</h3>' +
            '<p class="muted" style="margin:0 0 10px">Issue the same certificate to everyone who reached a pass mark on a paper, in one pass. Each one still gets its own verification code.</p>' +
            '<div class="grid grid-2">' +
              '<div class="form-group"><label for="ct-exam">Quiz</label><select class="form-select" id="ct-exam"></select></div>' +
              '<div class="form-group"><label for="ct-passmark">Issue to everyone at or above (%)</label>' +
                '<input class="form-input" type="number" id="ct-passmark" value="50"></div>' +
            '</div>' +
            '<button class="btn btn-outline" type="button" id="ct-batch">📦 Preview the batch</button>' +
            '<div id="ct-batch-out" style="margin-top:10px"></div>' +
          '</section>' +

          '<section class="card" style="margin-top:14px">' +
            '<h3 style="margin:0 0 6px">🔎 Verify a certificate</h3>' +
            '<p class="muted" style="margin:0 0 10px">Anyone holding a certificate can check it here. A revoked certificate is reported as revoked rather than simply disappearing.</p>' +
            '<div style="display:flex;gap:8px"><input class="form-input" id="ct-verify" placeholder="TC-XXXX-XXXX">' +
              '<button class="btn btn-outline" type="button" id="ct-verify-btn">Check</button></div>' +
            '<div id="ct-verify-out" style="margin-top:10px"></div>' +
          '</section>' +
        '</div>' +

        /* ---- right: preview + register ---- */
        '<div>' +
          '<section class="card" style="overflow:auto">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
              '<h3 style="margin:0">Live preview</h3>' +
              '<span class="muted" style="font-size:.8rem">Code <b id="ct-code-lbl"></b></span></div>' +
            '<div id="ct-preview" style="display:flex;justify-content:center"></div>' +
          '</section>' +
          '<section class="card" style="margin-top:14px">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">' +
              '<h3 style="margin:0">Issued certificates <span class="muted" id="ct-count"></span></h3>' +
              '<div style="display:flex;gap:6px">' +
                '<input id="ct-q" class="form-input" type="search" placeholder="🔎 Filter…" style="width:170px;padding:6px 10px">' +
                '<button class="btn btn-sm btn-ghost" type="button" id="ct-reload">↻</button></div></div>' +
            '<div id="ct-list" style="margin-top:10px"></div>' +
          '</section>' +
        '</div></div>';

      this._wire(host);
      this.state.code = newCode();
      var dt = d.getElementById('ct-date');
      if (dt) dt.value = new Date().toISOString().slice(0, 10);
      this.render();
      this._paintList();

      // Deep link: certificates.html?verify=CODE
      try {
        var vq = new URLSearchParams(w.location.search).get('verify');
        if (vq) { d.getElementById('ct-verify').value = vq; this.verify(); }
      } catch (e) {}
    },

    async _load() {
      var s = sb();
      if (!s || !s.from) return;
      try {
        var r = await Promise.all([
          s.from('certificates').select('*').order('created_at', { ascending: false }).limit(400),
          s.from('tc_certificate_templates').select('*').order('name'),
          s.from('learners').select('id,full_name').order('full_name').limit(1000),
          s.from('cbt_exams').select('id,title,code').order('created_at', { ascending: false }).limit(100)
        ]);
        this.state.rows = (r[0] && r[0].data) || [];
        this.state.templates = (r[1] && r[1].data) || [];
        this.state.learners = (r[2] && r[2].data) || [];
        this.state.exams = (r[3] && r[3].data) || [];
      } catch (e) {}
    },

    opts: function () {
      var v = function (id) { var e = d.getElementById(id); return e ? e.value : ''; };
      return {
        name: v('ct-name'), title: v('ct-title'), subtitle: v('ct-subtitle'),
        kind: v('ct-kind'), body: v('ct-body'), subject: v('ct-subject'),
        grade: v('ct-grade'), date: v('ct-date'), valid_until: v('ct-valid'),
        layout: v('ct-layout'), font: v('ct-font'), pc: v('ct-pc'), ac: v('ct-ac'),
        border: v('ct-border'), signatory: v('ct-sig'), countersign: v('ct-countersign'),
        sig: v('ct-sigurl'), seal_text: v('ct-seal'), code: this.state.code
      };
    },

    render: function () {
      var box = d.getElementById('ct-preview');
      if (box) box.innerHTML = this.html(this.opts());
      var lbl = d.getElementById('ct-code-lbl');
      if (lbl) lbl.textContent = this.state.code;
    },

    _wire: function (host) {
      var self = this;
      ['ct-name', 'ct-title', 'ct-subtitle', 'ct-body', 'ct-subject', 'ct-grade',
       'ct-date', 'ct-valid', 'ct-layout', 'ct-font', 'ct-pc', 'ct-ac', 'ct-border',
       'ct-sig', 'ct-countersign', 'ct-sigurl', 'ct-seal', 'ct-kind'].forEach(function (id) {
        var el = d.getElementById(id);
        if (el) el.addEventListener('input', function () { self.render(); });
        if (el && el.tagName === 'SELECT') el.addEventListener('change', function () { self.render(); });
      });

      // Kind drives the default wording, so a "merit" award does not read like
      // a graduation. Only overwritten while the tutor has not edited it.
      var kindEl = d.getElementById('ct-kind');
      if (kindEl) kindEl.addEventListener('change', function () {
        var k = kindEl.value;
        var t = d.getElementById('ct-title'), st = d.getElementById('ct-subtitle');
        if (t && !t.dataset.touched) t.value = 'CERTIFICATE OF ' + k.toUpperCase();
        if (st && !st.dataset.touched) st.value = k.toUpperCase();
        self.render();
      });
      ['ct-title', 'ct-subtitle'].forEach(function (id) {
        var el = d.getElementById(id);
        if (el) el.addEventListener('input', function () { el.dataset.touched = '1'; });
      });

      var ls = d.getElementById('ct-learner');
      if (ls) {
        ls.innerHTML = '<option value="">— type a name instead —</option>' +
          this.state.learners.map(function (l) {
            return '<option value="' + esc(l.id) + '" data-name="' + esc(l.full_name) + '">' +
                   esc(l.full_name) + '</option>';
          }).join('');
        ls.addEventListener('change', function () {
          var o = ls.options[ls.selectedIndex];
          var nm = d.getElementById('ct-name');
          if (o && o.dataset.name && nm) nm.value = o.dataset.name;
          self.render();
        });
      }

      var ts = d.getElementById('ct-template');
      if (ts) {
        ts.innerHTML = '<option value="">— build a new design —</option>' +
          this.state.templates.map(function (t) {
            return '<option value="' + esc(t.id) + '">' + esc(t.name) + '</option>';
          }).join('');
        ts.addEventListener('change', function () {
          var t = self.state.templates.filter(function (x) { return String(x.id) === ts.value; })[0];
          if (!t) return;
          var set = function (id, v) { var e = d.getElementById(id); if (e && v != null) e.value = v; };
          set('ct-title', t.title); set('ct-subtitle', t.subtitle); set('ct-body', t.body);
          set('ct-layout', t.layout); set('ct-font', t.font); set('ct-pc', t.primary_color);
          set('ct-ac', t.accent_color); set('ct-border', t.border_style);
          set('ct-sig', t.signatory); set('ct-sigurl', t.signature_url);
          set('ct-seal', t.seal_text); set('ct-kind', t.kind);
          self.render();
        });
      }

      var ex = d.getElementById('ct-exam');
      if (ex) ex.innerHTML = '<option value="">— choose a quiz —</option>' +
        (this.state.exams || []).map(function (e) {
          return '<option value="' + esc(e.id) + '">' + esc(e.title) + '</option>';
        }).join('');

      d.getElementById('ct-newcode').addEventListener('click', function () {
        self.state.code = newCode(); self.render();
      });
      d.getElementById('ct-print').addEventListener('click', function () { self.print(self.opts()); });
      d.getElementById('ct-issue').addEventListener('click', function () { self.issue(); });
      d.getElementById('ct-savetpl').addEventListener('click', function () { self.saveTemplate(); });
      d.getElementById('ct-verify-btn').addEventListener('click', function () { self.verify(); });
      d.getElementById('ct-batch').addEventListener('click', function () { self.batch(); });
      d.getElementById('ct-reload').addEventListener('click', async function () {
        await self._load(); self._paintList();
      });
      var q = d.getElementById('ct-q');
      if (q) q.addEventListener('input', function () { self._paintList(q.value); });
    },

    print: function (o) {
      var wnd = w.open('', '_blank');
      if (!wnd) return toast('Your browser blocked the print window.', 'warning');
      var land = o.layout === 'diploma';
      wnd.document.write('<html><head><title>Certificate — ' + esc(o.name) + '</title>' +
        '<style>@page{size:A4 ' + (land ? 'landscape' : 'portrait') + ';margin:8mm}' +
        'body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;' +
        'background:#fff;font-family:system-ui,sans-serif}' +
        '.cert-sheet{box-shadow:none!important}</style></head><body>' +
        this.html(o) + '</body></html>');
      wnd.document.close();
      wnd.focus();
      setTimeout(function () { wnd.print(); }, 500);
    },

    async issue() {
      var o = this.opts();
      if (!o.name || !o.name.trim()) return toast('Enter the recipient\u2019s name first.', 'warning');
      var s = sb();
      var ls = d.getElementById('ct-learner');
      var row = {
        learner_name: o.name.trim(),
        learner_id: (ls && ls.value) || null,
        title: o.title, subtitle: o.subtitle, kind: o.kind, body: o.body,
        subject: o.subject || null,
        grade: o.grade || null,
        code: o.code,
        issued_on: o.date || new Date().toISOString().slice(0, 10),
        valid_until: o.valid_until || null,
        signatory: o.signatory, countersign: o.countersign,
        signature_url: o.sig || null, seal_text: o.seal_text || null,
        layout: o.layout, font: o.font,
        primary_color: o.pc, accent_color: o.ac, border_style: o.border
      };
      if (!s || !s.from) {
        toast('Not connected to the database — printing without recording it.', 'warning', 6000);
        return this.print(o);
      }
      try {
        var res = await s.from('certificates').insert(row).select();
        if (res.error) throw res.error;
        toast('Certificate issued. Code ' + o.code, 'success', 6000);
        this.print(o);
        this.state.code = newCode();
        this.render();
        await this._load();
        this._paintList();
      } catch (err) {
        var m = String(err.message || err);
        if (/schema cache|does not exist/i.test(m)) {
          toast('Your certificates table is missing the design columns. Run database/complete-schema.sql (V25 or later), then try again.', 'danger', 12000);
        } else {
          toast('Could not record the certificate: ' + m, 'danger', 9000);
        }
      }
    },

    async saveTemplate() {
      var s = sb();
      if (!s || !s.from) return toast('Not connected to the database.', 'warning');
      var name = w.prompt('Name this design (e.g. "House style — Merit"):');
      if (!name) return;
      var o = this.opts();
      var res = await s.from('tc_certificate_templates').insert({
        name: name, kind: o.kind, title: o.title, subtitle: o.subtitle, body: o.body,
        layout: o.layout, font: o.font, primary_color: o.pc, accent_color: o.ac,
        border_style: o.border, signatory: o.signatory, signature_url: o.sig,
        seal_text: o.seal_text
      }).select();
      if (res.error) return toast(res.error.message, 'danger', 8000);
      toast('Design saved. It is now in the "Start from a saved design" list.', 'success');
      await this._load();
      var ts = d.getElementById('ct-template');
      if (ts) ts.innerHTML = '<option value="">— build a new design —</option>' +
        this.state.templates.map(function (t) {
          return '<option value="' + esc(t.id) + '">' + esc(t.name) + '</option>';
        }).join('');
    },

    async verify() {
      var out = d.getElementById('ct-verify-out');
      var code = (d.getElementById('ct-verify') || {}).value || '';
      if (!code.trim()) return;
      var s = sb();
      if (!s) return;
      out.innerHTML = '<p class="muted">Checking…</p>';
      try {
        var r = await s.rpc('tc_verify_certificate', { p_code: code.trim() });
        var v = r.data || {};
        if (r.error) throw r.error;
        if (!v.ok && !v.revoked) {
          out.innerHTML = '<div style="padding:10px;border-radius:8px;background:#fef2f2;color:#991b1b">' +
            '<b>No certificate carries that code.</b> Check for a typo — the codes never contain the letters O or I, or the digits 0 or 1.</div>';
        } else if (v.revoked) {
          out.innerHTML = '<div style="padding:10px;border-radius:8px;background:#fff7ed;color:#9a3412">' +
            '<b>⚠ This certificate has been revoked.</b><br>' + esc(v.name || '') + ' · ' + esc(v.title || '') + '</div>';
        } else {
          out.innerHTML = '<div style="padding:10px;border-radius:8px;background:#ecfdf5;color:#065f46">' +
            '<b>✅ Genuine.</b><br>' + esc(v.name || '') + '<br>' + esc(v.title || '') +
            (v.subject ? ' · ' + esc(v.subject) : '') + (v.grade ? ' · ' + esc(v.grade) : '') +
            '<br><small>Issued ' + esc(v.issued_on || '—') + ' · signed ' + esc(v.signatory || '—') + '</small></div>';
        }
      } catch (e) {
        out.innerHTML = '<p style="color:#b91c1c">Could not check that code: ' + esc(e.message || e) + '</p>';
      }
    },

    async batch() {
      var out = d.getElementById('ct-batch-out');
      var examId = (d.getElementById('ct-exam') || {}).value;
      var pass = parseFloat((d.getElementById('ct-passmark') || {}).value || '50');
      if (!examId) return toast('Choose a quiz first.', 'warning');
      var s = sb();
      if (!s) return;
      out.innerHTML = '<p class="muted">Loading results…</p>';
      try {
        var r = await s.from('cbt_results').select('*').eq('exam_id', examId).limit(500);
        if (r.error) throw r.error;
        var rows = (r.data || []).filter(function (x) {
          var p = x.percent != null ? x.percent
                : (x.score != null && x.total ? (x.score / x.total) * 100 : null);
          return p != null && p >= pass;
        });
        if (!rows.length) {
          out.innerHTML = '<p class="muted">Nobody reached ' + pass + '% on that paper yet.</p>';
          return;
        }
        var self = this;
        out.innerHTML = '<p><b>' + rows.length + '</b> candidate(s) reached ' + pass + '%.</p>' +
          '<div class="table-wrap" style="max-height:220px;overflow:auto"><table style="width:100%;font-size:.84rem">' +
          '<thead><tr><th>Name</th><th>Score</th></tr></thead><tbody>' +
          rows.map(function (x) {
            var p = x.percent != null ? x.percent : Math.round((x.score / x.total) * 100);
            return '<tr><td>' + esc(x.student_name || x.full_name || '—') + '</td><td>' + esc(p) + '%</td></tr>';
          }).join('') + '</tbody></table></div>' +
          '<button class="btn btn-primary btn-sm" type="button" id="ct-batch-go" style="margin-top:8px">' +
            '🏆 Issue ' + rows.length + ' certificate(s)</button>';
        d.getElementById('ct-batch-go').addEventListener('click', async function () {
          var o = self.opts();
          var payload = rows.map(function (x) {
            var p = x.percent != null ? x.percent : Math.round((x.score / x.total) * 100);
            return {
              learner_name: x.student_name || x.full_name || 'Candidate',
              title: o.title, subtitle: o.subtitle, kind: o.kind, body: o.body,
              subject: o.subject || null, score: p, grade: o.grade || null,
              code: newCode(), issued_on: o.date || new Date().toISOString().slice(0, 10),
              signatory: o.signatory, countersign: o.countersign,
              signature_url: o.sig || null, seal_text: o.seal_text || null,
              layout: o.layout, font: o.font, primary_color: o.pc,
              accent_color: o.ac, border_style: o.border
            };
          });
          var res = await s.from('certificates').insert(payload).select();
          if (res.error) return toast(res.error.message, 'danger', 9000);
          toast('Issued ' + payload.length + ' certificate(s).', 'success', 6000);
          await self._load();
          self._paintList();
        });
      } catch (e) {
        out.innerHTML = '<p style="color:#b91c1c">' + esc(e.message || e) + '</p>';
      }
    },

    _paintList(filter) {
      var box = d.getElementById('ct-list');
      if (!box) return;
      var self = this;
      var rows = this.state.rows || [];
      if (filter) {
        var q = filter.toLowerCase();
        rows = rows.filter(function (r) {
          return [r.learner_name, r.title, r.code, r.subject].join(' ').toLowerCase().indexOf(q) > -1;
        });
      }
      var cnt = d.getElementById('ct-count');
      if (cnt) cnt.textContent = '(' + rows.length + ')';

      if (!rows.length) {
        box.innerHTML = '<p class="muted" style="padding:16px 0">No certificates issued yet. ' +
          'Fill the form on the left and press <b>Issue &amp; print</b>.</p>';
        return;
      }
      box.innerHTML = '<div class="table-wrap" style="max-height:420px;overflow:auto">' +
        '<table style="width:100%;font-size:.85rem"><thead><tr>' +
        '<th>Recipient</th><th>Award</th><th>Code</th><th>Issued</th><th style="text-align:right">Actions</th>' +
        '</tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr' + (r.revoked ? ' style="opacity:.55"' : '') + '>' +
            '<td><b>' + esc(r.learner_name) + '</b>' + (r.subject ? '<br><small>' + esc(r.subject) + '</small>' : '') + '</td>' +
            '<td>' + esc(r.title || r.kind || '') + (r.revoked ? ' <span style="color:#b91c1c">· revoked</span>' : '') + '</td>' +
            '<td><code>' + esc(r.code || '') + '</code></td>' +
            '<td>' + esc(r.issued_on || '') + '</td>' +
            '<td style="text-align:right;white-space:nowrap">' +
              '<button class="btn btn-sm btn-outline" type="button" data-cert-print="' + esc(r.id) + '">🖨</button>' +
              '<button class="btn btn-sm btn-outline" type="button" data-cert-load="' + esc(r.id) + '">✏️</button>' +
              '<button class="btn btn-sm btn-ghost" type="button" data-cert-revoke="' + esc(r.id) + '" ' +
                'style="color:#b45309">' + (r.revoked ? 'Restore' : 'Revoke') + '</button>' +
              '<button class="btn btn-sm btn-ghost" type="button" data-cert-del="' + esc(r.id) + '" ' +
                'style="color:#b42318">🗑</button>' +
            '</td></tr>';
        }).join('') + '</tbody></table></div>';

      var fromRow = function (r) {
        return { name: r.learner_name, title: r.title, subtitle: r.subtitle, kind: r.kind,
                 body: r.body, subject: r.subject, grade: r.grade, date: r.issued_on,
                 valid_until: r.valid_until, layout: r.layout, font: r.font,
                 pc: r.primary_color, ac: r.accent_color, border: r.border_style,
                 signatory: r.signatory, countersign: r.countersign,
                 sig: r.signature_url, seal_text: r.seal_text, code: r.code };
      };

      box.querySelectorAll('[data-cert-print]').forEach(function (b) {
        b.addEventListener('click', function () {
          var r = self.state.rows.filter(function (x) { return String(x.id) === b.dataset.certPrint; })[0];
          // The stored design is used, not the current form. A reprint two
          // years later must match the copy the family already holds.
          if (r) self.print(fromRow(r));
        });
      });
      box.querySelectorAll('[data-cert-load]').forEach(function (b) {
        b.addEventListener('click', function () {
          var r = self.state.rows.filter(function (x) { return String(x.id) === b.dataset.certLoad; })[0];
          if (!r) return;
          var o = fromRow(r);
          var set = function (id, v) { var e = d.getElementById(id); if (e) e.value = v == null ? '' : v; };
          set('ct-name', o.name); set('ct-title', o.title); set('ct-subtitle', o.subtitle);
          set('ct-body', o.body); set('ct-subject', o.subject); set('ct-grade', o.grade);
          set('ct-date', o.date); set('ct-layout', o.layout); set('ct-font', o.font);
          set('ct-pc', o.pc); set('ct-ac', o.ac); set('ct-border', o.border);
          set('ct-sig', o.signatory); set('ct-countersign', o.countersign);
          set('ct-sigurl', o.sig); set('ct-seal', o.seal_text); set('ct-kind', o.kind);
          self.state.code = o.code;
          self.render();
          toast('Loaded into the form. Issuing again creates a NEW certificate with a new code.', 'info', 7000);
          w.scrollTo({ top: 0, behavior: 'smooth' });
        });
      });
      box.querySelectorAll('[data-cert-revoke]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var r = self.state.rows.filter(function (x) { return String(x.id) === b.dataset.certRevoke; })[0];
          if (!r) return;
          var s = sb();
          if (!s) return;
          var payload;
          if (r.revoked) payload = { revoked: false, revoked_reason: null };
          else {
            var why = w.prompt('Why is this certificate being revoked?\n\n(The reason is stored, and verification will report it as revoked.)');
            if (why === null) return;
            payload = { revoked: true, revoked_reason: why };
          }
          var res = await s.from('certificates').update(payload).eq('id', r.id);
          if (res.error) return toast(res.error.message, 'danger');
          toast(r.revoked ? 'Restored.' : 'Revoked.', 'success');
          await self._load(); self._paintList();
        });
      });
      box.querySelectorAll('[data-cert-del]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!w.confirm('Delete this certificate record permanently?\n\nRevoking is usually better — it keeps the audit trail.')) return;
          var s = sb();
          if (!s) return;
          var res = await s.from('certificates').delete().eq('id', b.dataset.certDel);
          if (res.error) return toast(res.error.message, 'danger');
          toast('Deleted.', 'success');
          await self._load(); self._paintList();
        });
      });
    }
  };

  w.CertStudio = CertStudio;
  if (w.TC) w.TC.CertStudio = CertStudio;
})(window);
