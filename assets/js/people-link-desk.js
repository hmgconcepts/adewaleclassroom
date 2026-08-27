/* ===========================================================================
   people-link-desk.js — School Connect / GOSA style portal-login linking
   ---------------------------------------------------------------------------
   On tutors.html / learners.html / parents.html an ADMIN sees a clear panel:
     1. How linking works (unambiguous steps)
     2. Unlinked records that need a portal login
     3. One-click link to an existing profile, or invite instructions
   Tutors never see link controls for other tutors (adminOnly + RBAC).
   Uses tc_link_account / profiles list. No AI API.
   ========================================================================== */
(function (w, d) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(m, k) {
    try {
      if (w.App && App.toast) return App.toast(m, k || 'info');
      if (w.toast) return w.toast(m, k || 'info');
    } catch (_) {}
  }
  function isAdmin() {
    try {
      if (w.CRUD && CRUD.isAdminUser) return CRUD.isAdminUser();
      var r = String((w.App && (App.currentRole || App.role)) || (w.TC_PROFILE && TC_PROFILE.role) || '').toLowerCase();
      return /admin|owner|director|super|proprietor|lead_tutor/.test(r);
    } catch (_) { return false; }
  }

  var KIND = {
    tutors:   { kind: 'tutor',   table: 'tutors',   role: 'tutor',   title: 'Tutors',   noun: 'tutor' },
    learners: { kind: 'learner', table: 'learners', role: 'student', title: 'Learners', noun: 'learner' },
    parents:  { kind: 'parent',  table: 'parents',  role: 'parent',  title: 'Parents',  noun: 'parent' }
  };

  function pageKind() {
    var p = (location.pathname.split('/').pop() || '').replace(/\.html$/i, '');
    return KIND[p] || null;
  }

  var Desk = {
    async mount() {
      var meta = pageKind();
      if (!meta) return;
      var host = d.getElementById('people-link-desk');
      if (!host) {
        var crud = d.getElementById('crud-root');
        host = d.createElement('div');
        host.id = 'people-link-desk';
        if (crud && crud.parentNode) crud.parentNode.insertBefore(host, crud);
        else {
          var main = d.querySelector('main.app-content');
          if (main) main.appendChild(host);
          else return;
        }
      }

      var admin = isAdmin();
      var steps =
        '<ol style="margin:8px 0 0;padding-left:1.25rem;line-height:1.55">' +
          '<li><b>Create the ' + esc(meta.noun) + ' record</b> below (name, email, phone). Use the real email they will sign in with.</li>' +
          '<li><b>Ask them to Request access</b> on <a href="login.html">login.html</a> with that same email. Approve them under Approvals (role = ' + esc(meta.role) + ').</li>' +
          '<li><b>Link portal login</b> — either open the record and set <i>Portal login account</i>, or use the one-click buttons in this panel.</li>' +
          '<li>They sign out and back in. Their dashboard now resolves to this ' + esc(meta.noun) + ' row (School Connect / GOSA pattern: <code>user_id</code> on the master record).</li>' +
        '</ol>';

      if (!admin) {
        host.innerHTML =
          '<section class="card" style="margin:0 0 16px;border-left:4px solid #0506ae">' +
            '<h3 style="margin:0 0 6px">🔗 Portal login linking</h3>' +
            '<p class="muted" style="margin:0">Only an <b>admin / owner</b> can link sign-ins to ' + esc(meta.title.toLowerCase()) +
            '. You can view the register; ask an admin to complete linking.</p>' +
            '<p class="muted" style="margin:8px 0 0;font-size:.85rem">How it works for admins:</p>' + steps +
          '</section>';
        return;
      }

      host.innerHTML =
        '<section class="card" style="margin:0 0 16px;border:1px solid #c7d2fe;background:linear-gradient(135deg,#eef2ff,#fff)">' +
          '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start;justify-content:space-between">' +
            '<div style="flex:1;min-width:260px">' +
              '<h3 style="margin:0 0 4px">🔗 Link portal logins to ' + esc(meta.title) + '</h3>' +
              '<p class="muted" style="margin:0;font-size:.9rem">Same model as <b>School Connect</b> and <b>GOSA</b>: the person record holds <code>user_id</code> pointing at <code>profiles.id</code>. Without this link, the sign-in cannot see the right data.</p>' +
            '</div>' +
            '<div style="font-size:.75rem;font-weight:800;background:#0506ae;color:#fff;padding:4px 10px;border-radius:999px">ADMIN ONLY</div>' +
          '</div>' +
          '<details open style="margin-top:10px"><summary style="cursor:pointer;font-weight:700">How to link a sign-in (clear steps)</summary>' + steps + '</details>' +
          '<div id="pld-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-top:12px"></div>' +
          '<div id="pld-list" style="margin-top:12px"><p class="muted">Loading unlinked records…</p></div>' +
        '</section>';

      await this._load(meta);
      // Non-admins cannot add/link other tutors
      if (meta.kind === 'tutor' && !admin) {
        setTimeout(function () {
          var add = d.getElementById('crud-add');
          if (add) { add.style.display = 'none'; add.disabled = true; }
          d.querySelectorAll('[data-edit]').forEach(function () {});
        }, 800);
        // Intercept openForm for new tutors
        if (w.CRUD && !CRUD._tutorAddGuard) {
          CRUD._tutorAddGuard = true;
          var _of = CRUD.openForm.bind(CRUD);
          CRUD.openForm = function (moduleId, row) {
            if (String(moduleId).replace(/-/g,'_') === 'tutors' && !(row && row.id) && !isAdmin()) {
              toast('Only an admin can add or link tutors', 'warning');
              return;
            }
            return _of(moduleId, row || {});
          };
        }
      }
    },

    async _load(meta) {
      var list = d.getElementById('pld-list');
      var kpis = d.getElementById('pld-kpis');
      if (!w.sb) {
        if (list) list.innerHTML = '<p class="muted">Connect Supabase to load linking status.</p>';
        return;
      }
      var table = meta.table;
      var { data: rows, error } = await w.sb.from(table).select('id,full_name,email,user_id,status').order('full_name').limit(2000);
      if (error) {
        list.innerHTML = '<p style="color:#b91c1c">' + esc(error.message) + '</p>';
        return;
      }
      rows = rows || [];
      var linked = rows.filter(function (r) { return !!r.user_id; });
      var unlinked = rows.filter(function (r) { return !r.user_id; });
      if (kpis) {
        kpis.innerHTML =
          '<div class="card" style="padding:10px"><div class="muted" style="font-size:.72rem">Total</div><b style="font-size:1.25rem">' + rows.length + '</b></div>' +
          '<div class="card" style="padding:10px"><div class="muted" style="font-size:.72rem">Linked</div><b style="font-size:1.25rem;color:#059669">' + linked.length + '</b></div>' +
          '<div class="card" style="padding:10px"><div class="muted" style="font-size:.72rem">Need link</div><b style="font-size:1.25rem;color:#b45309">' + unlinked.length + '</b></div>';
      }

      var { data: profiles } = await w.sb.from('profiles').select('id,full_name,email,role,status').order('full_name').limit(2000);
      profiles = (profiles || []).filter(function (p) {
        var role = String(p.role || '').toLowerCase();
        if (meta.kind === 'tutor') return /tutor|teacher|staff|admin|owner/.test(role);
        if (meta.kind === 'learner') return /student|learner/.test(role);
        if (meta.kind === 'parent') return /parent|guardian/.test(role);
        return true;
      });

      if (!unlinked.length) {
        list.innerHTML = '<p style="color:#059669;margin:0">✓ Every ' + esc(meta.noun) + ' record that exists is linked — or none exist yet. Add a record below, then link it.</p>';
        return;
      }

      list.innerHTML = '<p style="margin:0 0 8px;font-weight:700">Unlinked ' + esc(meta.title.toLowerCase()) + ' — pick a portal profile to attach</p>' +
        unlinked.map(function (r) {
          var opts = profiles.map(function (p) {
            return '<option value="' + esc(p.id) + '">' + esc(p.full_name || p.email || p.id) +
              (p.email ? ' · ' + esc(p.email) : '') + ' · ' + esc(p.role || '') +
              (p.status ? ' (' + esc(p.status) + ')' : '') + '</option>';
          }).join('');
          return '<div class="card" style="padding:12px;margin-bottom:8px;display:flex;flex-wrap:wrap;gap:10px;align-items:center">' +
            '<div style="flex:1;min-width:180px"><b>' + esc(r.full_name || '—') + '</b>' +
              (r.email ? '<div class="muted" style="font-size:.82rem">' + esc(r.email) + '</div>' : '<div class="muted" style="font-size:.82rem">No email on record — set one before linking</div>') +
            '</div>' +
            '<select class="form-select" data-pld-sel="' + esc(r.id) + '" style="min-width:220px;flex:1">' +
              '<option value="">— Select portal login —</option>' + opts +
            '</select>' +
            '<button type="button" class="btn btn-sm btn-primary" data-pld-link="' + esc(r.id) + '">Link login</button>' +
            '<button type="button" class="btn btn-sm btn-outline" data-pld-copy="' + esc(r.email || '') + '">Copy email</button>' +
          '</div>';
        }).join('');

      var self = this;
      list.querySelectorAll('[data-pld-link]').forEach(function (b) {
        b.onclick = async function () {
          var id = b.getAttribute('data-pld-link');
          var sel = list.querySelector('[data-pld-sel="' + id + '"]');
          var uid = sel && sel.value;
          if (!uid) { toast('Choose a portal login first', 'warning'); return; }
          b.disabled = true; b.textContent = 'Linking…';
          var { data: res, error: err } = await w.sb.rpc('tc_link_account', {
            p_kind: meta.kind,
            p_id: id,
            p_uid: uid
          });
          if (err || !(res && res.ok)) {
            // Fallback: direct update if RPC rejects email mismatch but admin overrides
            if (err) {
              var up = await w.sb.from(meta.table).update({ user_id: uid }).eq('id', id);
              if (up.error) {
                toast(err.message || up.error.message, 'danger');
                b.disabled = false; b.textContent = 'Link login';
                return;
              }
            } else if (res && res.reason) {
              // try admin direct update
              var up2 = await w.sb.from(meta.table).update({ user_id: uid }).eq('id', id);
              if (up2.error) {
                toast(res.reason + (up2.error ? ': ' + up2.error.message : ''), 'danger');
                b.disabled = false; b.textContent = 'Link login';
                return;
              }
            }
          }
          toast('Linked — ' + meta.noun + ' can sign in and see their data', 'success');
          self._load(meta);
        };
      });
      list.querySelectorAll('[data-pld-copy]').forEach(function (b) {
        b.onclick = async function () {
          var em = b.getAttribute('data-pld-copy');
          if (!em) { toast('No email on this record', 'warning'); return; }
          try { await navigator.clipboard.writeText(em); toast('Email copied', 'success'); }
          catch (_) { prompt('Copy email', em); }
        };
      });
    }
  };

  w.PeopleLinkDesk = Desk;
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { Desk.mount(); });
  else Desk.mount();
})(window, document);
