/* ============================================================================
   class-register.js — public registration page for class links (V29)
   ----------------------------------------------------------------------------
   Mounts into #class-reg-root on class-register.html. Opened from a social
   share link (class-register.html?code=…). Shows the class card — what it is,
   what it costs (or that it is free), when it runs and where — then a short
   form. Submitting calls tc_class_register() and shows a registration number,
   the meeting link and the group link. No account needed; nothing uploaded.
   ========================================================================== */
(function (w, d) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtDate(dt) {
    if (!dt) return '';
    try { return new Date(dt).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
    catch (_) { return String(dt).slice(0, 10); }
  }

  var Register = {
    async mount() {
      var root = d.getElementById('class-reg-root');
      if (!root) return;
      var self = this;
      var code = new URLSearchParams(w.location.search).get('code') || '';
      if (!code) {
        root.innerHTML = '<div class="card" style="max-width:560px;margin:30px auto;text-align:center;padding:36px"><div style="font-size:2.4rem">🔗</div><h3>No class link</h3><p class="muted">Open this page from a registration link shared by the studio.</p><p><a class="btn btn-primary" href="apply.html">Request a place</a></p></div>';
        return;
      }
      root.innerHTML = '<p class="muted" style="text-align:center">Loading class…</p>';
      var link = null;
      if (w.sb) {
        try {
          var { data, error } = await w.sb.rpc('tc_class_link_get', { p_code: code });
          if (error) throw error;
          link = data;
        } catch (e) {
          root.innerHTML = '<div class="card" style="max-width:560px;margin:30px auto;text-align:center;padding:36px"><h3>Could not load this class</h3><p class="muted">' + esc(e && e.message || e) + '</p></div>';
          return;
        }
      } else {
        root.innerHTML = '<div class="card" style="max-width:560px;margin:30px auto;text-align:center;padding:36px"><h3>Studio database not connected</h3><p class="muted">This registration page needs the studio database. See DEPLOYMENT-GUIDE.md.</p></div>';
        return;
      }
      if (!link || !link.ok) {
        root.innerHTML = '<div class="card" style="max-width:560px;margin:30px auto;text-align:center;padding:36px"><div style="font-size:2.4rem">🔒</div><h3>' + esc((link && link.error) || 'Registration closed') + '</h3><p class="muted">If you still want a place, use the contact page.</p><p><a class="btn btn-primary" href="apply.html">Request a place</a></p></div>';
        return;
      }
      this._render(root, link, code);
    },

    _render(root, link, code) {
      var price = link.kind === 'free'
        ? '<span style="font-weight:900;font-size:1.4rem;color:#059669">FREE</span>'
        : '<span style="font-weight:900;font-size:1.4rem;color:#0506ae">' + esc((link.currency || '₦') + ' ' + (link.price != null ? Number(link.price).toLocaleString() : '—')) + '</span>';
      var cover = link.image_url
        ? '<div style="border-radius:14px;overflow:hidden;margin-bottom:14px;border:1px solid var(--gray-200,#e2e8f0)"><img src="' + esc(link.image_url) + '" alt="" style="width:100%;max-height:220px;object-fit:cover;display:block"></div>'
        : '<div style="height:96px;border-radius:14px;margin-bottom:14px;background:var(--gradient,linear-gradient(135deg,#0506ae,#964eec));display:flex;align-items:center;justify-content:center;color:#fff;font-size:2rem">' + (link.kind === 'free' ? '🎁' : '🎓') + '</div>';

      var rows = [];
      if (link.subject) rows.push(['📖 Subject', link.subject]);
      if (link.tutor_name) rows.push(['👨‍🏫 Tutor', link.tutor_name]);
      if (link.starts_on) rows.push(['📅 Starts', fmtDate(link.starts_on)]);
      if (link.schedule) rows.push(['⏰ Schedule', link.schedule]);
      if (link.platform) rows.push(['📍 Platform', link.platform]);

      root.innerHTML =
        '<div style="max-width:760px;margin:0 auto">' +
          '<div class="card" style="padding:22px">' +
            cover +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">' +
              '<div><h2 style="margin:0 0 4px">' + esc(link.title) + '</h2>' +
              '<div class="muted" style="font-size:.85rem">' + (link.kind === 'free' ? '🎁 Free class' : '💳 Paid class') + ' · ADEWALE CLASSROOM</div></div>' +
              '<div style="text-align:right">' + price + '</div>' +
            '</div>' +
            (link.intro ? '<p style="margin:12px 0 0;line-height:1.65">' + esc(link.intro) + '</p>' : '') +
            (rows.length ? '<div style="margin-top:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px">' +
              rows.map(function (r) { return '<div style="background:var(--surface-soft,#f8fafc);border:1px solid var(--gray-200,#e2e8f0);border-radius:10px;padding:8px 12px;font-size:.85rem"><span class="muted">' + r[0] + '</span><br><b>' + esc(r[1]) + '</b></div>'; }).join('') +
            '</div>' : '') +
          '</div>' +
          '<div class="card" style="padding:22px;margin-top:16px" id="clr-form">' +
            '<h3 style="margin:0 0 4px">Register for this class</h3>' +
            '<p class="muted" style="margin:0 0 14px;font-size:.88rem">Takes under a minute. No account needed — you will get a registration number and the joining details instantly.</p>' +
            '<div class="grid grid-2">' +
              '<div class="form-group"><label>Parent / guardian name *</label><input class="form-input" id="clr-parent" required></div>' +
              '<div class="form-group"><label>Phone / WhatsApp</label><input class="form-input" id="clr-phone" type="tel"></div>' +
              '<div class="form-group"><label>Email</label><input class="form-input" id="clr-email" type="email"></div>' +
              '<div class="form-group"><label>Learner name</label><input class="form-input" id="clr-learner"></div>' +
              '<div class="form-group"><label>Learner year / age</label><input class="form-input" id="clr-year" placeholder="e.g. SS2 or 15"></div>' +
              '<div class="form-group"><label>School (optional)</label><input class="form-input" id="clr-school"></div>' +
              '<div class="form-group"><label>How did you hear about this class?</label>' +
                '<select class="form-select" id="clr-how"><option value="">— choose —</option>' +
                '<option>WhatsApp</option><option>Instagram</option><option>Facebook</option><option>X / Twitter</option><option>Telegram</option><option>YouTube</option><option>Friend / referral</option><option>Search engine</option><option>Other</option>' +
                '</select></div>' +
              '<div class="form-group"><label>Message (optional)</label><input class="form-input" id="clr-notes" placeholder="Any question or special request"></div>' +
            '</div>' +
            '<label style="display:flex;gap:8px;align-items:flex-start;margin:8px 0"><input type="checkbox" id="clr-consent" style="margin-top:3px"> I confirm I am the parent/guardian and consent to this learner taking part.</label>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">' +
              '<button class="btn btn-primary btn-lg" type="button" id="clr-go">✓ Register now</button>' +
              '<button class="btn btn-outline btn-lg" type="button" id="clr-share">📤 Forward this class</button>' +
            '</div>' +
            '<p class="muted" id="clr-err" style="margin:10px 0 0;color:#b42318"></p>' +
          '</div>' +
        '</div>';

      var self = this;
      d.getElementById('clr-share').onclick = function () {
        var priceTxt = link.kind === 'free' ? 'FREE' : (link.currency || '₦') + ' ' + (link.price != null ? Number(link.price) : '');
        var text = '🎓 ' + link.title + ' — ' + priceTxt +
          (link.starts_on ? ' | Starts ' + fmtDate(link.starts_on) : '') +
          '\nRegister: ' + w.location.href;
        w.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
      };

      d.getElementById('clr-go').onclick = function () { self._submit(link, code, root); };
    },

    async _submit(link, code, root) {
      var g = function (id) { var el = d.getElementById(id); return el ? el.value.trim() : ''; };
      var parent = g('clr-parent');
      var year = g('clr-year');
      var consent = d.getElementById('clr-consent').checked;
      var err = d.getElementById('clr-err');
      if (!parent) { err.textContent = 'Please enter the parent / guardian name.'; return; }
      if (year && /^\d+$/.test(year) && parseInt(year, 10) < 18 && !consent) {
        err.textContent = 'This learner appears to be under 18 — please tick the guardian consent box.';
        return;
      }
      err.textContent = '';
      var btn = d.getElementById('clr-go');
      btn.disabled = true; btn.textContent = 'Registering…';
      try {
        var { data, error } = await w.sb.rpc('tc_class_register', {
          p_code: code, p_parent_name: parent, p_email: g('clr-email') || null,
          p_phone: g('clr-phone') || null, p_learner_name: g('clr-learner') || null,
          p_learner_year: year || null, p_school: g('clr-school') || null,
          p_how_heard: g('clr-how') || null, p_consent: consent, p_notes: g('clr-notes') || null
        });
        if (error) throw error;
        if (!data || !data.ok) { err.textContent = (data && data.error) || 'Could not register.'; btn.disabled = false; btn.textContent = '✓ Register now'; return; }
        var form = d.getElementById('clr-form');
        var meet = data.meeting_url ? '<a class="btn btn-outline" href="' + esc(data.meeting_url) + '" target="_blank" rel="noopener">Join the class</a> ' : '';
        var group = data.group_url ? '<a class="btn btn-outline" href="' + esc(data.group_url) + '" target="_blank" rel="noopener">Join the group chat</a>' : '';
        form.innerHTML =
          '<div style="text-align:center;padding:10px 0">' +
            '<div style="font-size:3rem">✅</div>' +
            '<h3 style="margin:8px 0 4px">You are registered!</h3>' +
            '<p class="muted" style="margin:0 0 14px">' + esc(data.message || '') + '</p>' +
            '<div style="display:inline-block;background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:10px 18px;margin-bottom:14px">' +
              '<div class="muted" style="font-size:.72rem;letter-spacing:.1em">REGISTRATION NUMBER</div>' +
              '<div style="font-weight:900;font-size:1.2rem;color:#0506ae">' + esc(data.reg_no) + '</div>' +
            '</div>' +
            '<p style="font-size:.9rem;margin:0 0 14px"><b>' + esc(data.class_title) + '</b>' +
              (data.platform ? ' · ' + esc(data.platform) : '') +
              (data.starts_on ? ' · starts ' + fmtDate(data.starts_on) : '') + '</p>' +
            '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">' + meet + group +
              '<button class="btn btn-ghost" type="button" onclick="window.print()">🖨 Save this page</button>' +
            '</div>' +
            '<p class="muted" style="font-size:.8rem;margin-top:14px">Keep this number — quote it any time you contact the studio about this class.</p>' +
          '</div>';
        form.scrollIntoView({ behavior: 'smooth' });
      } catch (e) {
        err.textContent = e && e.message || String(e);
        btn.disabled = false; btn.textContent = '✓ Register now';
      }
    }
  };

  w.ClassRegister = Register;
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { Register.mount(); });
  else Register.mount();
})(window, document);
