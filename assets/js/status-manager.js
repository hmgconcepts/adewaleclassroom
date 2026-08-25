/* ============================================================================
   status-manager.js — Roles & Status Manager (V28, report item 1)
   ----------------------------------------------------------------------------
   Mounts into #status-root on status-manager.html. Admin-only. Lists every
   account (email, name, role, status, what the sign-in is linked to) and
   lets a manager change a person's role or status with a confirm + audit
   row. Mirrors School Connect / GOSA's "Role & Status Manager" and is
   deliberately stricter: no manager may change their own role/status here,
   and every change is written to the activity log by the RPC itself.
   ========================================================================== */
(function (w, d) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function when(ts) {
    if (!ts) return '—';
    try { return new Date(ts).toLocaleDateString(); } catch (_) { return String(ts).slice(0, 10); }
  }

  var ROLES = ['admin', 'owner', 'director', 'lead_tutor', 'tutor', 'staff', 'parent', 'student', 'learner'];
  var STATUSES = ['pending', 'approved', 'active', 'suspended', 'disabled', 'archived'];
  var ROLE_ICON = { admin: '🛡️', owner: '👑', director: '🎯', lead_tutor: '⭐', tutor: '👨‍🏫', staff: '🧑‍💼', parent: '👪', student: '🎓', learner: '🎓' };
  var STATUS_TONE = { pending: '#f59e0b', approved: '#059669', active: '#059669', suspended: '#b91c1c', disabled: '#6b7280', archived: '#6b7280' };

  var Manager = {
    async mount() {
      var root = d.getElementById('status-root');
      if (!root) return;
      var self = this;
      root.innerHTML =
        '<div class="card" style="padding:16px;margin-bottom:14px">' +
          '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
            '<input id="sm-q" type="search" placeholder="🔎 Search name or email…" style="flex:1;min-width:200px;padding:10px 14px;border:1px solid var(--gray-300,#e2e8f0);border-radius:12px;font:inherit">' +
            '<select id="sm-role" class="form-select" style="width:auto"><option value="">Any role</option>' +
              ROLES.map(function (r) { return '<option value="' + r + '">' + r.replace('_', ' ') + '</option>'; }).join('') + '</select>' +
            '<select id="sm-status" class="form-select" style="width:auto"><option value="">Any status</option>' +
              STATUSES.map(function (s) { return '<option value="' + s + '">' + s + '</option>'; }).join('') + '</select>' +
            '<button class="btn btn-primary btn-sm" type="button" id="sm-run">Apply</button>' +
            '<span class="muted" id="sm-count" style="font-size:.82rem"></span>' +
          '</div>' +
        '</div>' +
        '<div class="card" style="padding:0;overflow:hidden"><div class="table-wrap"><table style="min-width:860px">' +
          '<thead><tr>' +
            '<th style="padding:12px 14px;text-align:left">Person</th>' +
            '<th style="padding:12px 14px;text-align:left">Role</th>' +
            '<th style="padding:12px 14px;text-align:left">Status</th>' +
            '<th style="padding:12px 14px;text-align:left">Linked to</th>' +
            '<th style="padding:12px 14px;text-align:left">Signed up</th>' +
            '<th style="padding:12px 14px;text-align:left">Change</th>' +
          '</tr></thead><tbody id="sm-body"><tr><td colspan="6" style="padding:26px;text-align:center" class="muted">Loading…</td></tr></tbody>' +
        '</table></div></div>' +
        '<div class="card" style="margin-top:14px;padding:12px 14px;font-size:.84rem;color:var(--gray-600,#475569)">' +
          '🔐 <b>Every change is written to the Activity Log with the actor, the old and the new value.</b> ' +
          'A manager cannot change their own role or status on this page — that would orphan the studio.' +
        '</div>';
      var q = d.getElementById('sm-q');
      q.addEventListener('keydown', function (e) { if (e.key === 'Enter') self._run(); });
      d.getElementById('sm-run').onclick = function () { self._run(); };
      d.getElementById('sm-role').onchange = function () { self._run(); };
      d.getElementById('sm-status').onchange = function () { self._run(); };
      this._run();
    },

    async _fetch() {
      if (!w.sb) return [];
      var { data, error } = await w.sb.rpc('tc_admin_list_profiles');
      if (error) throw error;
      return (data && data.ok && data.users) || [];
    },

    async _run() {
      var body = d.getElementById('sm-body');
      var count = d.getElementById('sm-count');
      if (!body) return;
      body.innerHTML = '<tr><td colspan="6" style="padding:26px;text-align:center" class="muted">Loading…</td></tr>';
      try {
        var rows = await this._fetch();
        var q = (d.getElementById('sm-q').value || '').trim().toLowerCase();
        var rf = d.getElementById('sm-role').value;
        var sf = d.getElementById('sm-status').value;
        rows = rows.filter(function (u) {
          if (rf && u.role !== rf) return false;
          if (sf && u.status !== sf) return false;
          if (q && !(String(u.full_name || '').toLowerCase().includes(q) ||
                     String(u.email || '').toLowerCase().includes(q))) return false;
          return true;
        });
        count.textContent = rows.length + ' account(s)';
        if (!rows.length) {
          body.innerHTML = '<tr><td colspan="6" style="padding:26px;text-align:center" class="muted">No accounts match.</td></tr>';
          return;
        }
        var self = this;
        body.innerHTML = rows.map(function (u) {
          var linked = [];
          if (u.linked_learner) linked.push(u.linked_learner + ' learner');
          if (u.linked_parent) linked.push(u.linked_parent + ' parent');
          if (u.linked_tutor) linked.push(u.linked_tutor + ' tutor');
          var me = (w.TC_PROFILE && w.TC_PROFILE.id === u.id);
          return '<tr>' +
            '<td style="padding:10px 14px"><b>' + esc(u.full_name || '—') + '</b>' +
              (me ? ' <span class="muted" style="font-size:.72rem">(you)</span>' : '') +
              '<div class="muted" style="font-size:.78rem">' + esc(u.email || '') + '</div></td>' +
            '<td style="padding:10px 14px">' + (ROLE_ICON[u.role] || '👤') + ' <span class="muted" style="text-transform:capitalize">' + esc(String(u.role || '—').replace(/_/g, ' ')) + '</span></td>' +
            '<td style="padding:10px 14px"><span style="background:' + (STATUS_TONE[u.status] || '#e2e8f0') + '22;color:' + (STATUS_TONE[u.status] || '#475569') + ';border-radius:8px;padding:2px 10px;font-size:.78rem;font-weight:700;text-transform:capitalize">' + esc(u.status || '—') + '</span></td>' +
            '<td style="padding:10px 14px;font-size:.8rem">' + (linked.length ? esc(linked.join(' · ')) : '<span class="muted">unlinked</span>') + '</td>' +
            '<td style="padding:10px 14px;font-size:.8rem;white-space:nowrap">' + when(u.created_at) + '</td>' +
            '<td style="padding:10px 14px;white-space:nowrap">' +
              (me ? '<span class="muted" style="font-size:.78rem">—</span>'
                  : '<button class="btn btn-sm btn-outline" type="button" data-edit="' + u.id + '">✏️ Change</button>') +
            '</td></tr>';
        }).join('');
        body.querySelectorAll('[data-edit]').forEach(function (b) {
          b.onclick = function () {
            var u = rows.filter(function (x) { return x.id === b.getAttribute('data-edit'); })[0];
            if (u) self._form(u);
          };
        });
      } catch (e) {
        body.innerHTML = '<tr><td colspan="6" style="padding:26px;text-align:center;color:#b42318">Heads up. Could not load accounts: ' +
          esc(e && e.message || e) + '</td></tr>';
      }
    },

    _form(u) {
      var body = d.getElementById('sm-body');
      if (!body) return;
      var self = this;
      var tr = d.createElement('tr');
      tr.innerHTML = '<td colspan="6" style="padding:14px 16px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px">' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
          '<b style="min-width:180px">' + esc(u.full_name || u.email) + '</b>' +
          '<select class="form-select" id="sm-new-role" style="width:auto">' + ROLES.map(function (r) {
            return '<option value="' + r + '"' + (r === u.role ? ' selected' : '') + '>' + r.replace('_', ' ') + '</option>';
          }).join('') + '</select>' +
          '<select class="form-select" id="sm-new-status" style="width:auto">' + STATUSES.map(function (s) {
            return '<option value="' + s + '"' + (s === u.status ? ' selected' : '') + '>' + s + '</option>';
          }).join('') + '</select>' +
          '<input class="form-input" id="sm-note" placeholder="Note (optional)" style="flex:1;min-width:160px">' +
          '<button class="btn btn-primary btn-sm" type="button" id="sm-ok">💾 Save & audit</button>' +
          '<button class="btn btn-ghost btn-sm" type="button" id="sm-cancel">Cancel</button>' +
        '</div></td>';
      body.insertBefore(tr, body.firstChild);
      d.getElementById('sm-ok').onclick = async function () {
        var role = d.getElementById('sm-new-role').value;
        var status = d.getElementById('sm-new-status').value;
        var note = d.getElementById('sm-note').value.trim() || null;
        if (role === u.role && status === u.status) { if (w.toast) toast('Nothing changed', 'warning'); return; }
        var btn = d.getElementById('sm-ok');
        btn.disabled = true; btn.textContent = 'Saving…';
        var { data, error } = await w.sb.rpc('tc_admin_set_role_status',
          { p_user_id: u.id, p_role: role, p_status: status, p_note: note });
        if (error || !(data && data.ok)) {
          if (w.toast) toast(error ? error.message : (data && data.reason) || 'Could not change', 'danger');
          btn.disabled = false; btn.textContent = '💾 Save & audit';
          return;
        }
        if (w.toast) toast('Role / status updated and logged', 'success');
        tr.remove();
        self._run();
      };
      d.getElementById('sm-cancel').onclick = function () { tr.remove(); };
    }
  };

  w.StatusManager = Manager;
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { Manager.mount(); });
  else Manager.mount();
})(window, document);
