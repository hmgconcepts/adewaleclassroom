/* ============================================================================
   scope-check.js — show, in the app, exactly what a tutor can reach
   ----------------------------------------------------------------------------
   REPORTED ITEM 10 (and item 21 of the previous round)

   "Each tutor should only have access to students, classes, subjects, CBT, etc
    assigned to them... Admin has full access to everything without
    restrictions."

   The enforcement for this is row-level security in PostgreSQL, and it was
   installed in V24 with the gaps closed in V25. But the report has now been
   raised twice, and I think I understand why: THERE WAS NO WAY TO SEE WHETHER
   IT WAS WORKING.

   Two things make scoping look broken when it is not:

     1. The SQL has not been run. Scoping is entirely RLS, so until
        database/complete-schema.sql is executed the policies do not exist and
        every tutor sees everything. Nothing in the interface said so.

     2. tutors.user_id is not linked. A tutor's sign-in has to be joined to a
        row in the tutors table, or tc_my_tutor_id() returns null and the
        scope predicates match nothing. The failure is SAFE — the tutor sees
        LESS, not more — but it looks like a broken product, and the fix is a
        single field on the Tutors page that nobody knew to fill in.

   This panel answers both questions in plain language, on screen, for the
   person who can act on it. It calls tc_my_scope_report(), which is a
   SECURITY DEFINER function returning only facts about the CALLER — it cannot
   be used to enumerate anyone else's access.
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

  var ScopeCheck = {

    async mount(rootId) {
      var host = d.getElementById(rootId || 'scope-check-root');
      if (!host) return;

      var role = String((w.TCNav && w.TCNav.role && w.TCNav.role()) ||
                        (w.App && w.App.currentRole) || '').toLowerCase();
      // Only staff need this. A parent seeing it would just be noise.
      if (['parent', 'student', 'learner', 'guest', ''].indexOf(role) > -1) return;

      var s = sb();
      if (!s || !s.rpc) return;

      host.innerHTML = '<div class="card"><p class="muted">Checking what you can reach…</p></div>';

      var rows = null, err = null;
      try {
        var r = await s.rpc('tc_my_scope_report');
        if (r.error) throw r.error;
        rows = r.data || [];
      } catch (e) { err = String(e.message || e); }

      if (err) {
        if (/does not exist|schema cache|Could not find the function/i.test(err)) {
          host.innerHTML =
            '<section class="card" style="border-left:4px solid #b91c1c;background:#fef2f2">' +
            '<h3 style="margin:0 0 6px;color:#991b1b">⚠ Tutor scoping is NOT active in this database</h3>' +
            '<p style="margin:0 0 8px;color:#991b1b">The function <code>tc_my_scope_report</code> is not ' +
            'installed, which means the access policies almost certainly are not either. ' +
            '<b>Every tutor can currently see every learner, every paper and every mark.</b></p>' +
            '<p style="margin:0;font-size:.9rem;color:#991b1b"><b>To fix it:</b> open the Supabase SQL ' +
            'editor, run <b>database/complete-schema.sql</b> in full, watch for any red error (one failed ' +
            'statement abandons the rest of the script), then run:<br>' +
            '<code>notify pgrst, \'reload schema\';</code><br>' +
            'Confirm with <code>select public.tc_schema_ok();</code> — it should say "Schema complete".</p>' +
            '</section>';
        } else {
          host.innerHTML = '<div class="card"><p class="muted">Could not check your access scope: ' +
            esc(err) + '</p></div>';
        }
        return;
      }

      var get = function (k) {
        var hit = (rows || []).filter(function (x) { return x.item === k; })[0];
        return hit || { value: '—', note: '' };
      };
      var roleRow = get('role');
      var linkRow = get('tutors.user_id linked');
      var isManager = /manager/i.test(roleRow.value || '');
      var unlinked = /^NO$/i.test(String(linkRow.value || '').trim());

      var tone = isManager ? '#0506ae' : unlinked ? '#b45309' : '#059669';
      var head = isManager
        ? 'You are an administrator — you see everything, and no scope applies to you.'
        : unlinked
          ? 'Your sign-in is not linked to a tutor record, so scoped pages will look empty.'
          : 'You see only the learners, groups and papers assigned to you.';

      host.innerHTML =
        '<section class="card" style="border-left:4px solid ' + tone + '">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">' +
            '<div><h3 style="margin:0 0 4px">🔐 What you can reach</h3>' +
            '<p class="muted" style="margin:0;max-width:760px">' + esc(head) + '</p></div>' +
            '<button class="btn btn-ghost btn-sm" type="button" id="sc-refresh">↻</button>' +
          '</div>' +
          (unlinked
            ? '<div style="margin-top:10px;padding:10px 12px;border-radius:8px;background:#fffbeb;' +
              'border:1px solid #fde68a;color:#92400e;font-size:.88rem">' +
              '<b>This is almost certainly the problem if pages look empty.</b> An administrator must open ' +
              'the <a href="tutors.html">Tutors</a> page, find your row, and set its <b>user account</b> ' +
              'field to your sign-in. Until then the database cannot tell which learners are yours, so it ' +
              'shows you none of them. It fails safe — you see less, never more.</div>'
            : '') +
          '<div class="table-wrap" style="margin-top:10px"><table style="width:100%;font-size:.86rem">' +
            '<tbody>' +
            rows.map(function (x) {
              return '<tr><td style="width:190px"><b>' + esc(x.item) + '</b></td>' +
                '<td style="width:110px">' + esc(x.value) + '</td>' +
                '<td class="muted">' + esc(x.note) + '</td></tr>';
            }).join('') +
            '</tbody></table></div>' +
          (isManager
            ? '<p class="muted" style="margin:10px 0 0;font-size:.85rem">Assign work on ' +
              '<a href="engagements.html">Engagements</a> (set the tutor) and <a href="tutors.html">Tutors</a> ' +
              '(link the user account). Those two fields are what every scope rule reads.</p>'
            : '') +
        '</section>';

      var rb = d.getElementById('sc-refresh');
      var self = this;
      if (rb) rb.onclick = function () { self.mount(rootId); };
    }
  };

  w.ScopeCheck = ScopeCheck;

  /* Mount automatically wherever a host element exists, once the role is
     known — the panel is meaningless before that. */
  d.addEventListener('tc:role', function () {
    if (d.getElementById('scope-check-root')) {
      try { ScopeCheck.mount('scope-check-root'); } catch (e) {}
    }
  });
})(window);
