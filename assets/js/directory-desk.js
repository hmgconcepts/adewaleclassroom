/* ===========================================================================
   directory-desk.js — studio-wide people directory (beyond School Connect)
   ---------------------------------------------------------------------------
   Aggregates learners + parents + tutors + staff profiles into one searchable
   directory with role tabs, link status, WhatsApp/mailto, CSV export, and
   admin deep-links to the master registers. Family-safe: tutors only see
   people connected to their engagements when RLS filters the queries.
   ========================================================================== */
(function (w, d) {
  'use strict';
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function toast(m, k) { try { (w.App && App.toast ? App.toast : w.toast)(m, k || 'info'); } catch (_) {} }

  var state = { q: '', tab: 'all', rows: [] };

  var Desk = {
    async mount() {
      var root = d.getElementById('directory-root') || d.getElementById('crud-root');
      if (!root) return;
      root.id = 'directory-root';
      root.innerHTML =
        '<section class="card" style="margin-bottom:14px">' +
          '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">' +
            '<input id="dir-q" class="form-input" type="search" placeholder="🔎 Search name, email, phone, role, student ID…" style="flex:1;min-width:220px">' +
            '<div id="dir-tabs" style="display:flex;flex-wrap:wrap;gap:6px"></div>' +
            '<button type="button" class="btn btn-outline btn-sm" id="dir-csv">⬇ CSV</button>' +
            '<button type="button" class="btn btn-outline btn-sm" id="dir-print">🖨 Print</button>' +
            '<a class="btn btn-outline btn-sm" href="learners.html">Learners</a>' +
            '<a class="btn btn-outline btn-sm" href="parents.html">Parents</a>' +
            '<a class="btn btn-outline btn-sm" href="tutors.html">Tutors</a>' +
          '</div>' +
          '<div id="dir-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-top:12px"></div>' +
        '</section>' +
        '<div id="dir-list" class="muted">Loading directory…</div>';

      d.getElementById('dir-q').addEventListener('input', function (e) {
        state.q = e.target.value || ''; Desk.render();
      });
      d.getElementById('dir-csv').onclick = function () { Desk.exportCsv(); };
      d.getElementById('dir-print').onclick = function () { w.print(); };
      await this.load();
    },

    async load() {
      var list = d.getElementById('dir-list');
      if (!w.sb) { list.innerHTML = '<p class="muted">Connect Supabase to load the directory.</p>'; return; }
      var rows = [];
      try {
        var L = await w.sb.from('learners').select('id,full_name,email,phone,year_group,student_no,user_id,status').order('full_name').limit(3000);
        (L.data || []).forEach(function (r) {
          rows.push({ kind: 'learner', kindLabel: 'Learner', id: r.id, name: r.full_name, email: r.email, phone: r.phone,
            extra: [r.student_no, r.year_group].filter(Boolean).join(' · '), linked: !!r.user_id, status: r.status,
            href: 'learners.html' });
        });
      } catch (_) {}
      try {
        var P = await w.sb.from('parents').select('id,full_name,email,phone,user_id,status').order('full_name').limit(3000);
        (P.data || []).forEach(function (r) {
          rows.push({ kind: 'parent', kindLabel: 'Parent', id: r.id, name: r.full_name, email: r.email, phone: r.phone,
            extra: '', linked: !!r.user_id, status: r.status, href: 'parents.html' });
        });
      } catch (_) {}
      try {
        var T = await w.sb.from('tutors').select('id,full_name,email,phone,specialisms,user_id,status').order('full_name').limit(1000);
        (T.data || []).forEach(function (r) {
          rows.push({ kind: 'tutor', kindLabel: 'Tutor', id: r.id, name: r.full_name, email: r.email, phone: r.phone,
            extra: r.specialisms || '', linked: !!r.user_id, status: r.status, href: 'tutors.html' });
        });
      } catch (_) {}
      try {
        var S = await w.sb.from('profiles').select('id,full_name,email,phone,role,status').order('full_name').limit(2000);
        (S.data || []).forEach(function (r) {
          var role = String(r.role || '');
          if (/student|learner|parent|tutor|teacher/.test(role.toLowerCase())) return; // already in master tables ideally
          rows.push({ kind: 'staff', kindLabel: 'Staff / ' + role, id: r.id, name: r.full_name || r.email, email: r.email, phone: r.phone,
            extra: role, linked: true, status: r.status, href: 'status-manager.html' });
        });
      } catch (_) {}
      state.rows = rows;
      this.render();
    },

    filtered() {
      var q = String(state.q || '').trim().toLowerCase();
      return state.rows.filter(function (r) {
        if (state.tab !== 'all' && r.kind !== state.tab) return false;
        if (!q) return true;
        var hay = [r.name, r.email, r.phone, r.extra, r.kindLabel, r.status].join(' ').toLowerCase();
        return q.split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
      });
    },

    render() {
      var rows = this.filtered();
      var tabs = [
        ['all', 'All'], ['learner', 'Learners'], ['parent', 'Parents'], ['tutor', 'Tutors'], ['staff', 'Staff']
      ];
      var tabHost = d.getElementById('dir-tabs');
      if (tabHost) {
        tabHost.innerHTML = tabs.map(function (t) {
          var n = state.rows.filter(function (r) { return t[0] === 'all' || r.kind === t[0]; }).length;
          var on = state.tab === t[0];
          return '<button type="button" class="btn btn-sm ' + (on ? 'btn-primary' : 'btn-outline') + '" data-dir-tab="' + t[0] + '">' +
            t[1] + ' (' + n + ')</button>';
        }).join('');
        tabHost.querySelectorAll('[data-dir-tab]').forEach(function (b) {
          b.onclick = function () { state.tab = b.getAttribute('data-dir-tab'); Desk.render(); };
        });
      }
      var k = d.getElementById('dir-kpis');
      if (k) {
        var linked = state.rows.filter(function (r) { return r.linked; }).length;
        k.innerHTML =
          '<div class="card" style="padding:10px"><div class="muted" style="font-size:.7rem">People</div><b>' + state.rows.length + '</b></div>' +
          '<div class="card" style="padding:10px"><div class="muted" style="font-size:.7rem">Showing</div><b>' + rows.length + '</b></div>' +
          '<div class="card" style="padding:10px"><div class="muted" style="font-size:.7rem">Portal linked</div><b>' + linked + '</b></div>' +
          '<div class="card" style="padding:10px"><div class="muted" style="font-size:.7rem">Need link</div><b>' + (state.rows.length - linked) + '</b></div>';
      }
      var list = d.getElementById('dir-list');
      if (!rows.length) {
        list.innerHTML = '<div class="card"><p class="muted">No people match. Adjust search or add records under Learners / Parents / Tutors.</p></div>';
        return;
      }
      list.innerHTML = '<div class="table-wrap"><table class="table" style="width:100%"><thead><tr>' +
        '<th>Name</th><th>Role</th><th>Contact</th><th>Detail</th><th>Portal</th><th></th></tr></thead><tbody>' +
        rows.map(function (r) {
          var wa = r.phone ? ('https://wa.me/' + String(r.phone).replace(/\D/g, '').replace(/^0/, '234')) : '';
          var mail = r.email ? ('mailto:' + r.email) : '';
          return '<tr>' +
            '<td><b>' + esc(r.name || '—') + '</b></td>' +
            '<td>' + esc(r.kindLabel) + '</td>' +
            '<td style="font-size:.85rem">' + esc(r.email || '') +
              (r.phone ? '<br>' + esc(r.phone) : '') + '</td>' +
            '<td class="muted" style="font-size:.82rem">' + esc(r.extra || '') + '</td>' +
            '<td>' + (r.linked
              ? '<span style="color:#059669;font-weight:700">Linked</span>'
              : '<span style="color:#b45309;font-weight:700">Unlinked</span>') + '</td>' +
            '<td style="white-space:nowrap">' +
              (mail ? '<a class="btn btn-sm btn-ghost" href="' + esc(mail) + '">Email</a>' : '') +
              (wa ? '<a class="btn btn-sm btn-ghost" target="_blank" rel="noopener" href="' + esc(wa) + '">WA</a>' : '') +
              '<a class="btn btn-sm btn-outline" href="' + esc(r.href) + '">Open</a>' +
            '</td></tr>';
        }).join('') + '</tbody></table></div>';
    },

    exportCsv() {
      var rows = this.filtered();
      var lines = ['name,role,email,phone,detail,linked,status'];
      rows.forEach(function (r) {
        lines.push([r.name, r.kindLabel, r.email, r.phone, r.extra, r.linked ? 'yes' : 'no', r.status]
          .map(function (x) { return '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"'; }).join(','));
      });
      var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      var a = d.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'directory.csv'; a.click();
    }
  };

  w.DirectoryDesk = Desk;
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { Desk.mount(); });
  else Desk.mount();
})(window, document);
