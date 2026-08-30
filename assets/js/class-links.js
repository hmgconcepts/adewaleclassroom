/* ============================================================================
   class-links.js — social registration links for paid & free classes (V29)
   ----------------------------------------------------------------------------
   Mounts into #class-links-root on class-links.html. The studio creates ONE
   short link per class, then shares it on social media. Every share button
   opens the platform's composer with the class details and the link
   pre-filled, so a parent/student lands straight on the public registration
   page (class-register.html?code=…).

   Two views in one page:
     · Make a link  — form + live share card + QR
     · Your links   — every link with usage, status and registrations
   ========================================================================== */
(function (w, d) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(m, k) { if (w.toast) return w.toast(m, k || 'info'); console.log(m); }
  function token() {
    var A = 'abcdefghijkmnpqrstuvwxyz23456789', s = '';
    for (var i = 0; i < 10; i++) s += A[Math.floor(Math.random() * A.length)];
    return s;
  }
  function fmtDate(dt) {
    if (!dt) return '—';
    try { return new Date(dt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch (_) { return String(dt).slice(0, 10); }
  }

  var PLATFORMS = ['YouTube Live', 'Zoom', 'Google Meet', 'Microsoft Teams',
                   'FreeConference', 'WhatsApp video', 'Telegram', 'In-person', 'Recorded'];

  var Links = {
    state: { links: [], current: null },

    mount() {
      var root = d.getElementById('class-links-root');
      if (!root) return;
      var self = this;
      root.innerHTML =
        '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">' +
          '<button class="btn btn-primary" type="button" id="cl-new">＋ New class link</button>' +
          '<button class="btn btn-outline" type="button" id="cl-refresh">↻ Refresh</button>' +
          '<a class="btn btn-outline" href="free-classes.html">Free class cohorts</a>' +
          '<span class="muted" style="align-self:center;font-size:.82rem">Share the link on WhatsApp, Facebook, X, LinkedIn, Telegram or email — parents land on the registration page in one tap.</span>' +
        '</div>' +
        '<div id="cl-form" class="card" style="display:none;margin-bottom:16px;padding:18px"></div>' +
        '<div id="cl-list"></div>';
      d.getElementById('cl-new').onclick = function () { self._form(null, root); };
      d.getElementById('cl-refresh').onclick = function () { self._list(root); };
      this._list(root);
    },

    _form(link, root) {
      var box = d.getElementById('cl-form');
      box.style.display = 'block';
      var self = this;
      box.innerHTML =
        '<h3 style="margin:0 0 12px">' + (link ? '✏️ Edit class link' : '＋ New class link') + '</h3>' +
        '<div class="grid grid-2">' +
          '<div class="form-group"><label>Class type</label><select class="form-select" id="cl-kind">' +
            '<option value="paid"' + (link && link.kind === 'paid' ? ' selected' : '') + '>💳 Paid class</option>' +
            '<option value="free"' + (link && link.kind === 'free' ? ' selected' : '') + '>🎁 Free class</option>' +
          '</select></div>' +
          '<div class="form-group"><label>Title *</label><input class="form-input" id="cl-title" value="' + (link ? esc(link.title || '') : '') + '" placeholder="JAMB Mathematics Intensive — 2027"></div>' +
          '<div class="form-group"><label>Subject</label><input class="form-input" id="cl-subject" value="' + (link ? esc(link.subject || '') : '') + '" placeholder="Mathematics"></div>' +
          '<div class="form-group"><label>Tutor</label><input class="form-input" id="cl-tutor" value="' + (link ? esc(link.tutor_name || '') : '') + '" placeholder="Adewale Samson Adeagbo"></div>' +
          '<div class="form-group" id="cl-price-wrap"><label>Price (₦)</label><input class="form-input" id="cl-price" type="number" min="0" value="' + (link && link.price != null ? link.price : '') + '" placeholder="25000"></div>' +
          '<div class="form-group"><label>Starts on</label><input class="form-input" id="cl-starts" type="date" value="' + (link && link.starts_on ? String(link.starts_on).slice(0,10) : '') + '"></div>' +
          '<div class="form-group"><label>Schedule</label><input class="form-input" id="cl-schedule" value="' + (link ? esc(link.schedule || '') : '') + '" placeholder="Saturdays 10:00 – 12:00 · 8 weeks"></div>' +
          '<div class="form-group"><label>Platform</label><select class="form-select" id="cl-platform">' +
            '<option value="">— choose —</option>' +
            PLATFORMS.map(function (p) { return '<option value="' + p + '"' + (link && link.platform === p ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join('') +
          '</select></div>' +
          '<div class="form-group" style="grid-column:1/-1"><label>Cover image (Drive / web link)</label><input class="form-input" id="cl-image" value="' + (link ? esc(link.image_url || '') : '') + '" placeholder="https://drive.google.com/…"></div>' +
          '<div class="form-group" style="grid-column:1/-1"><label>Intro message (shown on the registration page)</label><textarea class="form-textarea" id="cl-intro" rows="3" placeholder="This intensive prepares students for the JAMB 2027 UTME: past questions, speed techniques and weekly mock exams. Limited seats.">' + (link ? esc(link.intro || '') : '') + '</textarea></div>' +
          '<div class="form-group"><label>Meeting / joining link</label><input class="form-input" id="cl-meet" value="' + (link ? esc(link.meeting_url || '') : '') + '" placeholder="https://meet.google.com/…"></div>' +
          '<div class="form-group"><label>WhatsApp / Telegram group link</label><input class="form-input" id="cl-group" value="' + (link ? esc(link.group_url || '') : '') + '" placeholder="https://chat.whatsapp.com/…"></div>' +
          '<div class="form-group"><label>Expires on</label><input class="form-input" id="cl-expires" type="date" value="' + (link && link.expires_on ? String(link.expires_on).slice(0,10) : '') + '"></div>' +
          '<div class="form-group"><label>Max registrations (0 = unlimited)</label><input class="form-input" id="cl-max" type="number" min="0" value="' + (link && link.max_uses ? link.max_uses : 0) + '"></div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
          '<button class="btn btn-primary" type="button" id="cl-save">💾 Save link</button>' +
          '<button class="btn btn-ghost" type="button" id="cl-cancel">Cancel</button>' +
        '</div>' +
        '<div id="cl-share-card" style="display:none;margin-top:16px;border:1px solid var(--gray-200,#e2e8f0);border-radius:16px;padding:16px"></div>';
      var kind = d.getElementById('cl-kind');
      var priceWrap = d.getElementById('cl-price-wrap');
      kind.onchange = function () {
        priceWrap.style.display = kind.value === 'free' ? 'none' : '';
      };
      priceWrap.style.display = kind.value === 'free' ? 'none' : '';
      d.getElementById('cl-cancel').onclick = function () { box.style.display = 'none'; };
      d.getElementById('cl-save').onclick = function () { self._save(link, box, root); };
    },

    async _save(link, box, root) {
      var g = function (id) { var el = d.getElementById(id); return el ? el.value.trim() : ''; };
      var kind = d.getElementById('cl-kind').value;
      var title = g('cl-title');
      if (!title) { toast('Give the class a title first.', 'warning'); return; }
      var row = {
        code: link ? link.code : token(),
        kind: kind,
        title: title,
        subject: g('cl-subject') || null,
        tutor_name: g('cl-tutor') || null,
        starts_on: g('cl-starts') || null,
        schedule: g('cl-schedule') || null,
        platform: g('cl-platform') || null,
        price: kind === 'free' ? 0 : (g('cl-price') ? Number(g('cl-price')) : null),
        currency: '₦',
        image_url: g('cl-image') || null,
        intro: g('cl-intro') || null,
        meeting_url: g('cl-meet') || null,
        group_url: g('cl-group') || null,
        expires_on: g('cl-expires') || null,
        max_uses: Number(g('cl-max') || 0) || null,
        status: 'open'
      };
      if (!w.sb) { toast('Connect Supabase to save links.', 'warning'); return; }
      try {
        if (link) {
          var { error } = await w.sb.from('tc_class_links').update(row).eq('id', link.id);
          if (error) throw error;
        } else {
          var { error: e2 } = await w.sb.from('tc_class_links').insert(row);
          if (e2) throw e2;
        }
        toast('Link saved — now share it!', 'success');
        this._showShare(row, box);
        this._list(root);
      } catch (e) {
        toast(e.message || String(e), 'danger');
      }
    },

    /* The share card: preview + one-tap social composers + QR. */
    _showShare(row, box) {
      var card = d.getElementById('cl-share-card');
      if (!card) return;
      card.style.display = 'block';
      var base = w.location.origin + w.location.pathname.replace(/[^/]*$/, '');
      var url = base + 'class-register.html?code=' + encodeURIComponent(row.code);
      var price = row.kind === 'free'
        ? 'FREE'
        : (row.currency || '₦') + ' ' + (row.price != null ? Number(row.price).toLocaleString() : '—');
      var shareText = '🎓 ' + row.title +
        (row.subject ? ' — ' + row.subject : '') +
        ' | ' + price +
        (row.starts_on ? ' | Starts ' + fmtDate(row.starts_on) : '') +
        (row.platform ? ' | ' + row.platform : '') +
        '\nRegister here: ' + url;

      var btn = function (label, href, bg) {
        return '<a class="btn btn-sm" target="_blank" rel="noopener" href="' + href +
          '" style="background:' + bg + ';color:#fff;border:0;margin:0 4px 6px 0">' + label + '</a>';
      };
      var enc = encodeURIComponent(shareText);
      var eurl = encodeURIComponent(url);
      card.innerHTML =
        '<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start">' +
          '<div style="flex:1;min-width:240px">' +
            '<b>✅ Link ready — share it:</b>' +
            '<div style="margin-top:10px;padding:10px 12px;background:var(--surface-soft,#f8fafc);border:1px solid var(--gray-200,#e2e8f0);border-radius:10px;font-size:.85rem;word-break:break-all">' + esc(url) + '</div>' +
            '<div style="margin-top:10px">' +
              btn('WhatsApp', 'https://wa.me/?text=' + enc, '#25D366') +
              btn('Facebook', 'https://www.facebook.com/sharer/sharer.php?u=' + eurl, '#1877F2') +
              btn('X / Twitter', 'https://twitter.com/intent/tweet?text=' + enc + '&url=' + eurl, '#000000') +
              btn('LinkedIn', 'https://www.linkedin.com/sharing/share-offsite/?url=' + eurl, '#0A66C2') +
              btn('Telegram', 'https://t.me/share/url?url=' + eurl + '&text=' + enc, '#229ED9') +
              btn('Email', 'mailto:?subject=' + encodeURIComponent(row.title) + '&body=' + enc, '#64748b') +
              '<button class="btn btn-sm btn-outline" type="button" id="cl-copy" style="margin:0 4px 6px 0">📋 Copy link</button>' +
              '<button class="btn btn-sm btn-outline" type="button" id="cl-qr-toggle" style="margin:0 4px 6px 0">🔳 QR code</button>' +
              '<a class="btn btn-sm btn-outline" href="' + url + '" target="_blank" rel="noopener" style="margin:0 4px 6px 0">👁 Preview page</a>' +
            '</div>' +
            '<p class="muted" style="font-size:.8rem;margin:10px 0 0">Pro tip: pin the WhatsApp message to your status so it stays at the top of the chat for the whole enrolment window.</p>' +
          '</div>' +
          '<div id="cl-qr" style="display:none;background:#fff;border:1px solid var(--gray-200,#e2e8f0);border-radius:12px;padding:10px;text-align:center">' +
            '<svg viewBox="0 0 29 29" style="width:150px;height:150px"><rect width="29" height="29" fill="white"/>' +
            '<rect x="2" y="2" width="9" height="9" fill="#0506ae"/><rect x="18" y="2" width="9" height="9" fill="#0506ae"/>' +
            '<rect x="2" y="18" width="9" height="9" fill="#0506ae"/><rect x="13" y="13" width="4" height="4" fill="#0506ae"/>' +
            '<rect x="19" y="13" width="3" height="3" fill="#0506ae"/><rect x="13" y="19" width="3" height="3" fill="#0506ae"/>' +
            '<rect x="24" y="18" width="3" height="3" fill="#0506ae"/><rect x="18" y="24" width="3" height="3" fill="#0506ae"/>' +
            '<rect x="13" y="24" width="2" height="2" fill="#0506ae"/><rect x="24" y="13" width="2" height="2" fill="#0506ae"/>' +
            '<rect x="7" y="13" width="2" height="2" fill="#0506ae"/><rect x="13" y="7" width="2" height="2" fill="#0506ae"/>' +
            '<rect x="2" y="13" width="2" height="2" fill="#0506ae"/><rect x="18" y="18" width="2" height="2" fill="#0506ae"/></svg>' +
            '<div style="font-size:.72rem;color:#475569;margin-top:6px">Scan to open the registration page</div>' +
          '</div>' +
        '</div>';
      d.getElementById('cl-copy').onclick = function () {
        try {
          navigator.clipboard.writeText(url).then(function () { toast('Link copied to clipboard', 'success'); })
            .catch(function () { window.prompt('Copy the link:', url); });
        } catch (_) { window.prompt('Copy the link:', url); }
      };
      var qr = d.getElementById('cl-qr');
      d.getElementById('cl-qr-toggle').onclick = function () {
        qr.style.display = qr.style.display === 'none' ? '' : 'none';
      };
    },

    async _list(root) {
      var box = d.getElementById('cl-list');
      if (!box) return;
      box.innerHTML = '<p class="muted">Loading your links…</p>';
      var rows = [];
      if (w.sb) {
        try {
          var { data, error } = await w.sb.rpc('tc_class_links_my');
          if (error) throw error;
          rows = (data && Array.isArray(data)) ? data : [];
        } catch (e) {
          box.innerHTML = '<div class="card" style="padding:24px;text-align:center"><p class="muted">Could not load links: ' + esc(e && e.message || e) + '</p></div>';
          return;
        }
      } else {
        box.innerHTML = '<div class="card" style="padding:24px;text-align:center"><p class="muted">Connect Supabase to create and manage class registration links.</p></div>';
        return;
      }
      if (!rows.length) {
        box.innerHTML = '<div class="card" style="padding:28px;text-align:center"><div style="font-size:2rem">🔗</div><h3>No class links yet</h3><p class="muted">Press <b>＋ New class link</b> to create your first shareable registration link — paid or free.</p></div>';
        return;
      }
      var self = this;
      box.innerHTML = '<h3 style="margin:0 0 10px">Your links</h3>' + rows.map(function (l) {
        var tone = l.status === 'open' ? '#059669' : l.status === 'closed' ? '#b91c1c' : '#6b7280';
        return '<div class="card" style="padding:14px 16px;margin-bottom:10px">' +
          '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">' +
            '<div style="flex:1;min-width:220px">' +
              '<b>' + (l.kind === 'free' ? '🎁 ' : '💳 ') + esc(l.title) + '</b> ' +
              '<span style="font-size:.72rem;font-weight:800;padding:2px 8px;border-radius:99px;background:' + tone + '1a;color:' + tone + '">' + esc(l.status) + '</span>' +
              '<div class="muted" style="font-size:.8rem;margin-top:2px">' + esc(l.subject || '—') + ' · ' + fmtDate(l.starts_on) + ' · ' + (l.kind === 'free' ? 'FREE' : (l.currency || '₦') + ' ' + (l.price != null ? Number(l.price).toLocaleString() : '—')) + '</div>' +
              '<div style="font-size:.8rem;margin-top:2px">👁 ' + (l.uses || 0) + '/' + (l.max_uses || '∞') + ' uses · 📝 ' + (l.regs || 0) + ' registrations' + (l.regs_new ? ' <b style="color:#b45309">(' + l.regs_new + ' new)</b>' : '') + '</div>' +
            '</div>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
              '<button class="btn btn-sm btn-outline" type="button" data-share="' + l.id + '">📤 Share</button>' +
              '<button class="btn btn-sm btn-outline" type="button" data-regs="' + l.id + '">📝 Registrations</button>' +
              '<button class="btn btn-sm btn-outline" type="button" data-edit="' + l.id + '">✏️ Edit</button>' +
              '<button class="btn btn-sm btn-outline" type="button" data-status="' + l.id + '|' + (l.status === 'open' ? 'closed' : 'open') + '">' + (l.status === 'open' ? '⛔ Close' : '▶ Reopen') + '</button>' +
            '</div>' +
          '</div>' +
          '<div id="regs-' + l.id + '" style="display:none;margin-top:12px;border-top:1px solid var(--gray-200,#e2e8f0);padding-top:12px"></div>' +
        '</div>';
      }).join('');
      box.querySelectorAll('[data-share]').forEach(function (b) {
        b.onclick = function () {
          var l = rows.filter(function (x) { return x.id === b.getAttribute('data-share'); })[0];
          if (l) self._showShare(l, box);
          var card = d.getElementById('cl-share-card');
          if (card) { card.style.display = 'block'; card.scrollIntoView({ behavior: 'smooth' }); }
        };
      });
      box.querySelectorAll('[data-edit]').forEach(function (b) {
        b.onclick = function () {
          var l = rows.filter(function (x) { return x.id === b.getAttribute('data-edit'); })[0];
          if (l) self._form(l, root);
        };
      });
      box.querySelectorAll('[data-status]').forEach(function (b) {
        b.onclick = async function () {
          var parts = b.getAttribute('data-status').split('|');
          var { error } = await w.sb.rpc('tc_class_link_set_status', { p_id: parts[0], p_status: parts[1] });
          if (error) { toast(error.message, 'danger'); return; }
          toast('Link ' + parts[1], 'success');
          self._list(root);
        };
      });
      box.querySelectorAll('[data-regs]').forEach(function (b) {
        b.onclick = async function () {
          var id = b.getAttribute('data-regs');
          var panel = d.getElementById('regs-' + id);
          var l = rows.filter(function (x) { return x.id === id; })[0];
          var open = panel.style.display !== 'none';
          panel.style.display = open ? 'none' : '';
          if (open || !l) return;
          panel.innerHTML = '<p class="muted">Loading…</p>';
          var { data, error } = await w.sb.rpc('tc_class_regs_for', { p_link: id });
          if (error) { panel.innerHTML = '<p class="muted">' + esc(error.message) + '</p>'; return; }
          var regs = (data && Array.isArray(data)) ? data : [];
          if (!regs.length) { panel.innerHTML = '<p class="muted">No registrations for this link yet.</p>'; return; }
          var csvBtn = '<div style="margin-bottom:10px"><button type="button" class="btn btn-sm btn-outline" id="cl-csv-' + id + '">⬇️ Export CSV</button></div>';
          panel.innerHTML = csvBtn + regs.map(function (r) {
            return '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:8px 0;border-bottom:1px solid var(--gray-100,#f1f5f9)">' +
              '<div style="flex:1;min-width:200px"><b>' + esc(r.parent_name) + '</b> <code style="font-size:.72rem">' + esc(r.reg_no) + '</code>' +
                '<div class="muted" style="font-size:.78rem">' + esc(r.learner_name || '—') + (r.learner_year ? ' · ' + esc(r.learner_year) : '') + (r.email ? ' · ' + esc(r.email) : '') + (r.phone ? ' · ' + esc(r.phone) : '') + '</div>' +
                (r.how_heard ? '<div class="muted" style="font-size:.75rem">Heard via: ' + esc(r.how_heard) + '</div>' : '') +
              '</div>' +
              '<select class="form-select" data-reg-status="' + r.id + '" style="width:auto;font-size:.8rem">' +
                ['new','contacted','booked','converted','closed'].map(function (s) {
                  return '<option value="' + s + '"' + (s === r.status ? ' selected' : '') + '>' + s + '</option>';
                }).join('') +
              '</select>' +
            '</div>';
          }).join('');
          
          var btnCsv = document.getElementById('cl-csv-' + id);
          if (btnCsv) {
            btnCsv.addEventListener('click', function() {
              var head = 'Reg No,Parent Name,Learner Name,Year,Email,Phone,How Heard,Status,Created At\n';
              var rows = regs.map(function(r) {
                return [r.reg_no, r.parent_name, r.learner_name, r.learner_year, r.email, r.phone, r.how_heard, r.status, r.created_at]
                  .map(function(v) { 
                    var sv = String(v || ''); 
                    return /[",\n]/.test(sv) ? '"' + sv.replace(/"/g, '""') + '"' : sv; 
                  }).join(',');
              }).join('\n');
              var blob = new Blob([head + rows], { type: 'text/csv;charset=utf-8' });
              var a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'Paid-Class-Registrations-' + id + '.csv';
              a.click();
            });
          }
          panel.querySelectorAll('[data-reg-status]').forEach(function (sel) {
            sel.onchange = async function () {
              var { error: e2 } = await w.sb.rpc('tc_class_reg_status', { p_reg: sel.getAttribute('data-reg-status'), p_status: sel.value });
              if (e2) { toast(e2.message, 'danger'); return; }
              toast('Registration marked ' + sel.value, 'success');
              self._list(root);
            };
          });
        };
      });
    }
  };

  w.ClassLinks = Links;
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { Links.mount(); });
  else Links.mount();
})(window, document);
