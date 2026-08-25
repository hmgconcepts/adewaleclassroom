/* ============================================================================
   account-link.js — sign-in ⇄ profile linking (V27, report item 43)
   ----------------------------------------------------------------------------
   Like School Connect / GOSA, a sign-in must connect to the person's real
   record (learner, parent or tutor). This panel on profile.html finds the
   records that share the signed-in email but are not yet linked to any
   account, and links them in one click (tc_link_account). An admin can also
   link a record to another account from the tutors/parents/learners pages —
   the RPC accepts an explicit user id for managers.
   ========================================================================== */
(function (w, d) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var AccountLink = {
    async mount() {
      var root = d.getElementById('link-root');
      if (!root) return;
      if (!w.sb) { return; }
      var self = this;
      var me = w.TC_PROFILE || {};
      if (!me.email) {
        try {
          var u = await w.sb.auth.getUser();
          me.email = u && u.data && u.data.user && u.data.user.email;
        } catch (_) {}
      }
      var { data, error } = await w.sb.rpc('tc_unlinked_records');
      if (error) { root.innerHTML = ''; return; }   // function not installed yet — quiet
      var recs = (data && data.records) || [];
      if (!recs.length) return;
      var label = { learner: 'Learner', parent: 'Parent', tutor: 'Tutor' };
      root.innerHTML =
        '<div class="card" style="max-width:560px;margin-top:16px;border-color:#c7d2fe;background:#eef2ff">' +
          '<h3 style="margin:0 0 6px">🔗 Link my account</h3>' +
          '<p class="muted" style="margin:0 0 10px;font-size:.85rem">There ' + (recs.length === 1 ? 'is a record' : 'are records') +
          ' in the studio that share your email but are not linked to your sign-in yet. Linking gives you (and only you) access to the right data.' +
          (me.email ? ' Matched against <b>' + esc(me.email) + '</b>.' : '') + '</p>' +
          '<div id="link-list"></div>' +
        '</div>';
      var box = d.getElementById('link-list');
      box.innerHTML = recs.map(function (r) {
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid #c7d2fe">' +
          '<div style="flex:1"><b>' + esc(r.full_name || '—') + '</b> <span class="muted" style="font-size:.8rem">· ' + (label[r.kind] || r.kind) + '</span>' +
          (r.student_no ? ' <code style="font-size:.76rem">' + esc(r.student_no) + '</code>' : '') +
          '</div>' +
          '<button class="btn btn-sm btn-primary" type="button" data-link="' + r.kind + '|' + r.id + '">Link</button>' +
        '</div>';
      }).join('');
      box.querySelectorAll('[data-link]').forEach(function (b) {
        b.onclick = async function () {
          var parts = b.getAttribute('data-link').split('|');
          b.disabled = true; b.textContent = 'Linking…';
          var { data: res, error: err } = await w.sb.rpc('tc_link_account', { p_kind: parts[0], p_id: parts[1] });
          if (err || !(res && res.ok)) {
            if (w.toast) toast(err ? err.message : 'Could not link', 'danger');
            b.disabled = false; b.textContent = 'Link';
            return;
          }
          if (w.toast) toast('Linked — you can now see your own records', 'success');
          setTimeout(function () { location.reload(); }, 900);
        };
      });
    }
  };

  w.AccountLink = AccountLink;
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { AccountLink.mount(); });
  else AccountLink.mount();
})(window, document);
