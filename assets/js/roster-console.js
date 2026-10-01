/* ============================================================================
   roster-console.js — V43 "assign students to a class, seamlessly"
   ----------------------------------------------------------------------------
   Mounted on Engagements / Groups pages above the CRUD table.
   One panel: pick the class (engagement / group / cohort) → see its students
   as chips → add any learner with a tick-list search → remove with one tap.
   All writes go through tc_roster_bulk() in the database, so tutor scoping
   (a teacher only edits their own classes) and RLS stay in force.
   ========================================================================== */
(function (w, d) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var R = {
    eng: [],          // engagements for the picker
    engId: null,      // selected engagement id
    members: [],      // active members of the selected engagement
    learners: [],     // all learners (for the add panel)
    picked: {},       // learnerId -> true (tick-list)
    q: '',            // learner search text
    loading: false,

    mount: function () {
      var host = d.getElementById('roster-console');
      if (!host) return;
      if (!w.sb || !w.sb.rpc) { host.innerHTML = ''; return; }
      var self = this;
      var kindFilter = host.getAttribute('data-kind-filter') || '';
      host.innerHTML =
        '<div class="card" style="padding:16px;margin-bottom:16px">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">' +
            '<b>👥 Class roster — assign students to this class</b>' +
            '<span class="muted" style="font-size:.8rem">Every student here sees this class\u2019s quizzes, homework, reading and library on their dashboard.</span>' +
          '</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">' +
            '<select id="rc-eng" class="form-select" style="max-width:340px"></select>' +
            '<span id="rc-eng-info" class="muted" style="font-size:.82rem"></span>' +
          '</div>' +
          '<div id="rc-members"></div>' +
          '<details id="rc-add-wrap" style="margin-top:10px">' +
            '<summary style="cursor:pointer;font-weight:700">➕ Add / remove students</summary>' +
            '<div style="margin-top:8px">' +
              '<input id="rc-q" type="search" placeholder="🔎 Search learners by name, ID or year…" class="form-control" style="max-width:420px;margin-bottom:8px">' +
              '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap">' +
                '<button id="rc-all" class="btn btn-outline btn-sm" type="button">Tick all shown</button>' +
                '<button id="rc-none" class="btn btn-outline btn-sm" type="button">Clear ticks</button>' +
                '<button id="rc-add" class="btn btn-primary btn-sm" type="button">➕ Add ticked to class</button>' +
                '<span id="rc-count" class="muted" style="font-size:.8rem"></span>' +
              '</div>' +
              '<div id="rc-learners" style="max-height:260px;overflow:auto;border:1px solid #e2e8f0;border-radius:10px;padding:6px"></div>' +
            '</div>' +
          '</details>' +
        '</div>';
      d.getElementById('rc-eng').addEventListener('change', function () {
        self.engId = this.value || null;
        try { w.sessionStorage.setItem('rc-eng', self.engId || ''); } catch (e) {}
        self.loadMembers();
      });
      d.getElementById('rc-q').addEventListener('input', function () { self.q = this.value; self.renderLearners(); });
      d.getElementById('rc-all').addEventListener('click', function () {
        self.visibleLearners().forEach(function (l) { if (!self.isMember(l.id)) self.picked[l.id] = true; });
        self.renderLearners(); self.renderMembers();
      });
      d.getElementById('rc-none').addEventListener('click', function () { self.picked = {}; self.renderLearners(); });
      d.getElementById('rc-add').addEventListener('click', function () { self.bulk('add'); });
      this.loadEngagements(kindFilter);
    },

    isMember: function (id) {
      return this.members.some(function (m) { return m.learner_id === id; });
    },
    visibleLearners: function () {
      var q = this.q.trim().toLowerCase();
      var self = this;
      return this.learners.filter(function (l) {
        if (self.isMember(l.id)) return false;
        if (!q) return true;
        return ((l.full_name || '') + ' ' + (l.student_no || '') + ' ' + (l.year_group || '')).toLowerCase().indexOf(q) > -1;
      });
    },

    loadEngagements: async function (kindFilter) {
      var self = this;
      try {
        var sel = d.getElementById('rc-eng');
        sel.innerHTML = '<option value="">Loading…</option>';
        var q = w.sb.from('engagements').select('id,name,kind,subject,capacity').order('name').limit(300);
        var res = await q;
        var list = (res.data || []).filter(function (e) {
          return coalesce(e.status, 'active') === 'active';
        });
        function coalesce(v, dflt) { return v == null ? dflt : v; }
        if (kindFilter) {
          var kinds = kindFilter.split(',');
          list = list.filter(function (e) { return kinds.indexOf(e.kind) > -1; });
        }
        this.eng = list;
        var remembered = '';
        try { remembered = w.sessionStorage.getItem('rc-eng') || ''; } catch (e) {}
        sel.innerHTML = '<option value="">— pick a class —</option>' + list.map(function (e) {
          var label = e.name + (e.kind === 'cohort' ? ' (cohort)' : e.kind === 'group' ? ' (group)' : '');
          return '<option value="' + esc(e.id) + '">' + esc(label) + '</option>';
        }).join('');
        if (remembered && list.some(function (e) { return e.id === remembered; })) {
          sel.value = remembered; this.engId = remembered;
        }
        this.loadLearners();
        if (this.engId) this.loadMembers(); else this.renderMembers();
      } catch (e) {
        d.getElementById('rc-eng').innerHTML = '<option value="">Could not load classes</option>';
      }
    },

    loadLearners: async function () {
      try {
        var res = await w.sb.from('learners').select('id,full_name,student_no,year_group,status').order('full_name').limit(1000);
        this.learners = (res.data || []).filter(function (l) { return coalesce(l.status, 'active') === 'active'; });
        function coalesce(v, dflt) { return v == null ? dflt : v; }
        this.renderLearners();
      } catch (e) { this.learners = []; this.renderLearners(); }
    },

    loadMembers: async function () {
      var self = this;
      this.members = [];
      this.renderMembers();
      if (!this.engId) return;
      try {
        var res = await w.sb.rpc('tc_roster_view', { p_engagement_id: this.engId });
        var data = res.data;
        if (!data || data.ok === false) {
          d.getElementById('rc-eng-info').textContent = (data && data.reason === 'not_your_engagement')
            ? 'This class belongs to another teacher — you can view it in the table below but cannot change its roster.'
            : '';
          return;
        }
        var e = data.engagement || {};
        d.getElementById('rc-eng-info').textContent =
          (e.kind === 'cohort' ? 'cohort' : e.kind === 'group' ? 'group' : '1:1') +
          (e.subject ? ' · ' + e.subject : '') +
          (e.capacity ? ' · capacity ' + e.capacity : '');
        this.members = data.members || [];
      } catch (err) { /* leave empty */ }
      this.renderMembers();
      this.renderLearners();
    },

    renderMembers: function () {
      var box = d.getElementById('rc-members');
      if (!box) return;
      var self = this;
      if (!this.engId) { box.innerHTML = '<p class="muted" style="margin:4px 0">Pick a class above to see and manage its students.</p>'; return; }
      if (!this.members.length) { box.innerHTML = '<p class="muted" style="margin:4px 0">No students in this class yet — open “➕ Add / remove students” below.</p>'; return; }
      box.innerHTML = '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
        this.members.map(function (m) {
          return '<span class="badge" style="display:inline-flex;gap:6px;align-items:center;background:#eef2ff;color:#3730a3;padding:5px 10px">' +
            esc(m.name) + (m.student_no ? ' <span style="opacity:.65">' + esc(m.student_no) + '</span>' : '') +
            '<button type="button" data-rc-remove="' + esc(m.learner_id) + '" title="Remove from this class" style="background:none;border:0;cursor:pointer;color:#3730a3;font-weight:800;padding:0 2px">✕</button>' +
          '</span>';
        }).join('') + '</div>';
      box.querySelectorAll('[data-rc-remove]').forEach(function (b) {
        b.addEventListener('click', function () { self.removeOne(b.getAttribute('data-rc-remove')); });
      });
    },

    renderLearners: function () {
      var box = d.getElementById('rc-learners');
      if (!box) return;
      var self = this;
      var list = this.visibleLearners();
      var pickedN = Object.keys(this.picked).filter(function (k) { return self.picked[k]; }).length;
      d.getElementById('rc-count').textContent = list.length + ' available · ' + pickedN + ' ticked';
      if (!list.length) {
        box.innerHTML = '<p class="muted" style="margin:6px 8px">No learners to show — everyone matching is already in this class, or nothing matches your search.</p>';
        return;
      }
      box.innerHTML = list.slice(0, 200).map(function (l) {
        var on = !!self.picked[l.id];
        return '<label style="display:flex;gap:8px;align-items:center;padding:5px 8px;border-radius:8px;cursor:pointer;' + (on ? 'background:#eef2ff' : '') + '">' +
          '<input type="checkbox" data-rc-pick="' + esc(l.id) + '"' + (on ? ' checked' : '') + '>' +
          '<b>' + esc(l.full_name) + '</b>' +
          (l.student_no ? '<span class="muted" style="font-size:.8rem">' + esc(l.student_no) + '</span>' : '') +
          (l.year_group ? '<span class="muted" style="font-size:.8rem">· ' + esc(l.year_group) + '</span>' : '') +
        '</label>';
      }).join('');
      box.querySelectorAll('[data-rc-pick]').forEach(function (c) {
        c.addEventListener('change', function () {
          self.picked[c.getAttribute('data-rc-pick')] = c.checked;
          if (!c.checked) delete self.picked[c.getAttribute('data-rc-pick')];
          self.renderLearners();
        });
      });
    },

    removeOne: async function (learnerId) {
      this.bulk('remove', [learnerId]);
    },

    bulk: async function (action, ids) {
      var self = this;
      if (!this.engId) return;
      var list = ids || Object.keys(this.picked).filter(function (k) { return self.picked[k]; });
      if (!list.length) {
        if (w.toast) w.toast('Tick at least one learner first.', 'warning');
        return;
      }
      this.loading = true;
      try {
        var res = await w.sb.rpc('tc_roster_bulk', {
          p_engagement_id: this.engId,
          p_learner_ids: list,
          p_action: action
        });
        var data = res.data;
        if (res.error || !data || data.ok === false) {
          if (w.toast) w.toast('Could not update the roster: ' + ((data && data.reason) || (res.error && res.error.message) || 'unknown'), 'danger');
          return;
        }
        if (w.toast) w.toast(action === 'add'
          ? '✅ Added to the class — ' + data.members + ' student(s) now in it. They will see this class\u2019s work on their dashboard immediately.'
          : 'Removed — ' + data.members + ' student(s) remain in the class.', 'success');
        this.picked = {};
        this.loadMembers();
      } catch (e) {
        if (w.toast) w.toast('Could not update the roster: ' + (e.message || e), 'danger');
      } finally {
        this.loading = false;
      }
    }
  };

  w.RosterConsole = R;
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { R.mount(); });
  else R.mount();
})(window, document);
