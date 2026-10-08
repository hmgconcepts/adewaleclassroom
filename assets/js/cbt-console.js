/* ═══════════════════════════════════════════════════════════════════════
   ADEWALE CLASSROOM — CBT console (V46 / round 10, item 2)
   GOSA "CBT / Online Exams" parity for the Quizzes page:
     • Filter bar — search, subject, class, kind (graded/self/review),
       identity mode, single vs multi-subject, status, archive view, sort
     • Arrangement by NATURE — papers are grouped the way a tutor thinks
       (Graded exams / Drafts / Practice / Review / Archived), each section
       with a count chip, badges for multi-subject + negative marking,
       windows with countdown, and the full manage button set
     • 🗃️ Archive Recovery Center (GOSA V12.7 port) — view archived only /
       active only / all, one-click restore ALL, restore only the filtered
       (visible) ones, undo the last bulk action, export archived papers as
       a portable JSON backup, import a backup back in, and an advanced
       restore-by-filter panel (subject / class / kind — blank matches all)
   Self-contained: only needs window.sb, window.TC.esc and the rows.
   ═══════════════════════════════════════════════════════════════════════ */
window.CBTConsole = (function () {
  'use strict';

  var state = { q: '', subject: '', engagement: '', kind: 'all', mode: 'all', group: 'all',
                status: 'all', view: 'active', sort: 'newest' };
  var lastBulk = null;      /* { archive:boolean, ids:[…] } — one-level undo */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function opts(list, sel, label) {
    return '<option value="">' + label + '</option>' + list.map(function (v) {
      return '<option value="' + esc(v) + '"' + (sel === v ? ' selected' : '') + '>' + esc(v) + '</option>';
    }).join('');
  }

  function kindBadge(x) {
    var k = String(x.quiz_kind || 'graded');
    var map = {
      graded: ['🔴 Graded', '#fee2e2', '#991b1b'],
      self:   ['🧪 Practice', '#fef3c7', '#92400e'],
      review: ['🔵 Review', '#dbeafe', '#1e40af']
    };
    var m = map[k] || ['⚪ ' + k, '#f1f5f9', '#475569'];
    return '<span class="badge" style="background:' + m[1] + ';color:' + m[2] + '">' + m[0] + '</span>';
  }

  function isMulti(x) { return !!x.multi_subject || (Array.isArray(x.subjects) && x.subjects.length > 1); }

  function windowChip(x, now) {
    var bits = [];
    if (x.start_at && new Date(x.start_at) > now) bits.push('opens ' + new Date(x.start_at).toLocaleDateString([], { day: 'numeric', month: 'short' }));
    if (x.close_at) bits.push('closes ' + new Date(x.close_at).toLocaleDateString([], { day: 'numeric', month: 'short' }));
    return bits.join(' · ');
  }

  /* ---- filtering + sorting + grouping ---------------------------------- */
  function applyFilters(rows, engName) {
    var now = new Date();
    var q = state.q.trim().toLowerCase();
    var out = rows.filter(function (x) {
      if (state.view === 'active' && x.is_archived) return false;
      if (state.view === 'archived' && !x.is_archived) return false;
      if (state.kind !== 'all' && String(x.quiz_kind || 'graded') !== state.kind) return false;
      if (state.mode !== 'all') {
        var m = String(x.identity_mode || x.exam_mode || 'open');
        if (state.mode === 'registered' && m === 'open') return false;
        if (state.mode === 'open' && m !== 'open') return false;
      }
      if (state.group !== 'all') {
        if (state.group === 'multi' && !isMulti(x)) return false;
        if (state.group === 'single' && isMulti(x)) return false;
      }
      if (state.status !== 'all' && String(x.status || 'draft') !== state.status) return false;
      if (state.subject && String(x.subject || '') !== state.subject) return false;
      if (state.engagement && String(x.engagement_id || '') !== state.engagement) return false;
      if (q) {
        var hay = (x.title || '') + ' ' + (x.code || '') + ' ' + (x.subject || '') + ' ' + (engName(x.engagement_id) || '');
        if (hay.toLowerCase().indexOf(q) === -1) return false;
      }
      return true;
    });
    var dir = state.sort === 'oldest' ? 1 : -1;
    out.sort(function (a, b) {
      if (state.sort === 'title') return String(a.title || '').localeCompare(String(b.title || ''));
      if (state.sort === 'code') return String(a.code || '').localeCompare(String(b.code || ''));
      return (new Date(a.created_at || 0) - new Date(b.created_at || 0)) * dir;
    });
    return out;
  }

  function groupOf(x) {
    if (x.is_archived) return 'archived';
    var k = String(x.quiz_kind || 'graded');
    if (k === 'self') return 'practice';
    if (k === 'review') return 'review';
    var pub = ['published', 'live', 'open'].indexOf(String(x.status || 'draft').toLowerCase()) > -1 || x.is_open;
    return pub ? 'graded' : 'drafts';
  }

  var GROUPS = [
    ['graded',   '🔴 Graded papers — these count', 'Published graded papers. They file themselves onto the class homework list automatically and push scores to the scoresheet.'],
    ['drafts',   '📝 Drafts — not visible to students yet', 'Finish building, then publish — publishing is what files them onto the homework list.'],
    ['practice', '🧪 Practice — never graded', 'Self-quizzes students may sit as often as they like. No scoresheet impact.'],
    ['review',   '🔵 Review — answers + explanations', 'After-class gap finders. Not graded.'],
    ['archived', '📦 Archived — withdrawn from the working list', 'Results are kept; the paper no longer files homework. Restore from the Archive Recovery Center.']
  ];

  /* ---- rendering -------------------------------------------------------- */
  function rowHTML(x, engName, now) {
    var manage = (window.CBTManage && CBTManage.buttons) ? CBTManage.buttons(x) : '';
    var chips = kindBadge(x);
    if (isMulti(x)) chips += ' <span class="badge" style="background:#f3e8ff;color:#6b21a8">🎯 Multi-subject</span>';
    if (Number(x.negative_mark) > 0) chips += ' <span class="badge" style="background:#fee2e2;color:#991b1b" title="Wrong answers deduct ' + esc(x.negative_mark) + ' mark(s)">⚠️ Negative marking</span>';
    var win = windowChip(x, now);
    return '<tr' + (x.is_archived ? ' style="opacity:.62"' : '') + '>' +
      '<td style="padding:8px 10px"><b>' + esc(x.title || '') + '</b>' +
      '<div class="muted" style="font-size:.78rem">' + esc(x.subject || '—') +
      (engName(x.engagement_id) ? ' · ' + esc(engName(x.engagement_id)) : '') +
      (win ? ' · ' + esc(win) : '') + '</div></td>' +
      '<td style="padding:8px 10px"><code>' + esc(x.code || '') + '</code></td>' +
      '<td style="padding:8px 10px;white-space:nowrap">' + (window.CBTManage && CBTManage.badge ? CBTManage.badge(x) : esc(x.status || '')) + '</td>' +
      '<td style="padding:8px 10px;white-space:nowrap">' + chips + '</td>' +
      '<td style="padding:8px 10px;text-align:right">' + ((x.questions || []).length) + ' Qs · ' + (x.duration_min || 40) + 'm</td>' +
      '<td style="padding:8px 10px;text-align:right;white-space:nowrap">' + manage + '</td></tr>';
  }

  function render(opts) {
    var host = document.getElementById(opts.host || 'cbt-console');
    if (!host) return;
    var rows = opts.rows || [];
    var engName = opts.engagementName || function () { return ''; };
    var reload = opts.reload || function () {};
    var now = new Date();

    var subjects = [], engagements = [];
    rows.forEach(function (x) {
      if (x.subject && subjects.indexOf(x.subject) === -1) subjects.push(x.subject);
      if (x.engagement_id && engagements.indexOf(x.engagement_id) === -1) engagements.push(x.engagement_id);
    });
    subjects.sort(); engagements.sort();

    var shown = applyFilters(rows, engName);
    var counts = { graded: 0, drafts: 0, practice: 0, review: 0, archived: 0 };
    shown.forEach(function (x) { counts[groupOf(x)]++; });

    host.innerHTML =
      /* ── Archive Recovery Center (GOSA V12.7 port) ── */
      '<details class="card" id="arc" style="margin:12px 0;border:1px dashed #94a3b8">' +
      '<summary style="cursor:pointer;font-weight:800">🗃️ Archive Recovery Center — restore archived papers</summary>' +
      '<p class="muted" style="font-size:.85rem;margin:8px 0">Archiving withdraws a paper from the working list; its results are never touched. Everything here is reversible.</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
      '<button class="btn btn-primary btn-sm" data-arc="restoreAll">♻️ Restore ALL archived papers</button>' +
      '<button class="btn btn-outline btn-sm" data-arc="restoreVisible">♻️ Restore the filtered (visible) ones</button>' +
      '<button class="btn btn-outline btn-sm" data-arc="viewArchived">👁️ View archived only</button>' +
      '<button class="btn btn-outline btn-sm" data-arc="viewActive">👁️ View active only</button>' +
      '<button class="btn btn-outline btn-sm" data-arc="viewAll">👁️ View all</button>' +
      '<button class="btn btn-outline btn-sm" data-arc="undo" ' + (lastBulk ? '' : 'disabled') + '>↩️ Undo last bulk action</button>' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
      '<button class="btn btn-outline btn-sm" data-arc="export">📦 Export archived as portable backup</button>' +
      '<label class="btn btn-outline btn-sm">📥 Import backup<input type="file" id="arc-file" accept=".json" hidden></label>' +
      '</div>' +
      '<details style="border:1px solid #fcd34d;border-radius:10px;padding:8px 12px;background:#fffbeb">' +
      '<summary style="cursor:pointer;font-size:.85rem;font-weight:700">⚙️ Advanced — restore by subject / class / kind</summary>' +
      '<div class="grid grid-3" style="gap:8px;margin-top:8px">' +
      '<div class="form-group" style="margin:0"><label style="font-size:.78rem">Subject</label><input class="form-input" id="arc-subject" list="arc-subjects" placeholder="blank = all"><datalist id="arc-subjects">' + subjects.map(function (s) { return '<option value="' + esc(s) + '">'; }).join('') + '</datalist></div>' +
      '<div class="form-group" style="margin:0"><label style="font-size:.78rem">Class</label><select class="form-input" id="arc-eng"><option value="">blank = all</option>' + engagements.map(function (id) { return '<option value="' + esc(id) + '">' + esc(engName(id)) + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-group" style="margin:0"><label style="font-size:.78rem">Kind</label><select class="form-input" id="arc-kind"><option value="">blank = all</option><option value="graded">Graded</option><option value="self">Practice</option><option value="review">Review</option></select></div>' +
      '</div>' +
      '<div style="margin-top:8px"><button class="btn btn-primary btn-sm" data-arc="restoreFilteredAdvanced">♻️ Restore matching archived papers</button></div>' +
      '<p style="font-size:.78rem;color:#92400e;margin:6px 0 0">Blank fields match everything. Only archived papers matching ALL filled fields are restored.</p>' +
      '</details>' +
      '<div id="arc-log" class="muted" style="font-size:.82rem;margin-top:8px"></div>' +
      '</details>' +

      /* ── Filter bar ── */
      '<div class="card" style="margin-bottom:12px"><div class="grid grid-3" style="gap:8px">' +
      '<div class="form-group" style="margin:0"><label style="font-size:.78rem">Search</label><input class="form-input" id="cf-q" value="' + esc(state.q) + '" placeholder="title · code · subject · class"></div>' +
      '<div class="form-group" style="margin:0"><label style="font-size:.78rem">Subject</label><select class="form-input" id="cf-subject">' + opts(subjects, state.subject, 'All subjects') + '</select></div>' +
      '<div class="form-group" style="margin:0"><label style="font-size:.78rem">Class</label><select class="form-input" id="cf-eng">' + engagements.map(function (id) { return '<option value="' + esc(id) + '"' + (state.engagement === id ? ' selected' : '') + '>' + esc(engName(id)) + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-group" style="margin:0"><label style="font-size:.78rem">Kind</label><select class="form-input" id="cf-kind">' +
      ['all:All kinds', 'graded:🔴 Graded', 'self:🧪 Practice', 'review:🔵 Review'].map(function (o) { var p = o.split(':'); return '<option value="' + p[0] + '"' + (state.kind === p[0] ? ' selected' : '') + '>' + p[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-group" style="margin:0"><label style="font-size:.78rem">Mode</label><select class="form-input" id="cf-mode">' +
      ['all:All modes', 'registered:Registered', 'open:Open / guests'].map(function (o) { var p = o.split(':'); return '<option value="' + p[0] + '"' + (state.mode === p[0] ? ' selected' : '') + '>' + p[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-group" style="margin:0"><label style="font-size:.78rem">Type</label><select class="form-input" id="cf-group">' +
      ['all:Single + multi-subject', 'single:Single-subject', 'multi:🎯 Multi-subject'].map(function (o) { var p = o.split(':'); return '<option value="' + p[0] + '"' + (state.group === p[0] ? ' selected' : '') + '>' + p[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-group" style="margin:0"><label style="font-size:.78rem">Status</label><select class="form-input" id="cf-status">' +
      ['all:Any status', 'draft:Draft', 'published:Published', 'closed:Closed', 'archived:Archived'].map(function (o) { var p = o.split(':'); return '<option value="' + p[0] + '"' + (state.status === p[0] ? ' selected' : '') + '>' + p[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-group" style="margin:0"><label style="font-size:.78rem">View</label><select class="form-input" id="cf-view">' +
      ['active:Active / current', 'archived:Archived only', 'all:All'].map(function (o) { var p = o.split(':'); return '<option value="' + p[0] + '"' + (state.view === p[0] ? ' selected' : '') + '>' + p[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-group" style="margin:0"><label style="font-size:.78rem">Sort</label><select class="form-input" id="cf-sort">' +
      ['newest:Newest first', 'oldest:Oldest first', 'title:Title A–Z', 'code:Code A–Z'].map(function (o) { var p = o.split(':'); return '<option value="' + p[0] + '"' + (state.sort === p[0] ? ' selected' : '') + '>' + p[1] + '</option>'; }).join('') + '</select></div>' +
      '</div>' +
      '<div style="display:flex;gap:10px;align-items:center;margin-top:10px;flex-wrap:wrap">' +
      '<button class="btn btn-outline btn-sm" id="cf-reset">↺ Reset filters</button>' +
      '<span class="muted" style="font-size:.82rem">' + shown.length + ' of ' + rows.length + ' papers · ' + counts.graded + ' graded · ' + counts.drafts + ' draft · ' + counts.practice + ' practice · ' + counts.review + ' review · ' + counts.archived + ' archived</span>' +
      '</div></div>' +

      /* ── Grouped arrangement ── */
      GROUPS.filter(function (g) { return counts[g[0]] > 0 || (g[0] !== 'archived' && state.view !== 'archived'); }).map(function (g) {
        var list = shown.filter(function (x) { return groupOf(x) === g[0]; });
        if (!list.length) return '';
        return '<div class="card" style="margin-bottom:12px"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px">' +
          '<b>' + g[1] + '</b><span class="badge">' + list.length + '</span></div>' +
          '<p class="muted" style="font-size:.8rem;margin:0 0 8px">' + g[2] + '</p>' +
          '<div class="table-wrap"><table style="width:100%;font-size:.88rem"><thead><tr>' +
          '<th style="text-align:left;padding:6px 10px">Paper</th><th style="text-align:left;padding:6px 10px">Code</th>' +
          '<th style="text-align:left;padding:6px 10px">State</th><th style="text-align:left;padding:6px 10px">Nature</th>' +
          '<th style="text-align:right;padding:6px 10px">Size</th><th style="text-align:right;padding:6px 10px">Manage</th>' +
          '</tr></thead><tbody>' + list.map(function (x) { return rowHTML(x, engName, now); }).join('') + '</tbody></table></div></div>';
      }).join('') || '<p class="muted">No papers match these filters.</p>';

    wireFilters(host, rows, engName, reload);
    wireRecovery(host, rows, engName, reload);
  }

  /* ---- filter wiring (state survives re-render) ------------------------- */
  function wireFilters(host, rows, engName, reload) {
    var map = { 'cf-q': 'q', 'cf-subject': 'subject', 'cf-eng': 'engagement', 'cf-kind': 'kind',
                'cf-mode': 'mode', 'cf-group': 'group', 'cf-status': 'status', 'cf-view': 'view', 'cf-sort': 'sort' };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.oninput = null; el.onchange = null;
      el.oninput = function () { state[map[id]] = el.value; render({ host: host.id, rows: window.__cbtRows || rows, engagementName: engName, reload: reload }); };
      el.onchange = el.oninput;
    });
    var rst = document.getElementById('cf-reset');
    if (rst) rst.onclick = function () {
      state = { q: '', subject: '', engagement: '', kind: 'all', mode: 'all', group: 'all', status: 'all', view: 'active', sort: 'newest' };
      render({ host: host.id, rows: window.__cbtRows || rows, engagementName: engName, reload: reload });
    };
  }

  /* ---- Archive Recovery Center wiring ------------------------------------ */
  function log(host, msg, ok) {
    var el = document.getElementById('arc-log');
    if (el) el.innerHTML = '<span style="color:' + (ok ? '#166534' : '#b42318') + '">' + esc(msg) + '</span>';
  }

  async function bulkSetArchived(ids, archived, host, rows, engName, reload) {
    if (!ids.length) { log(host, 'Nothing matched — nothing to do.', false); return; }
    var done = 0, fail = 0;
    for (var i = 0; i < ids.length; i++) {
      var r = await window.sb.from('cbt_exams').update({ is_archived: archived }).eq('id', ids[i]);
      if (r.error) fail++; else done++;
    }
    lastBulk = { archive: archived, ids: ids.slice() };
    log(host, (archived ? 'Archived ' : 'Restored ') + done + ' paper(s)' + (fail ? ' · ' + fail + ' failed' : '') + '.', !fail);
    reload();
  }

  function wireRecovery(host, rows, engName, reload) {
    var archived = rows.filter(function (x) { return x.is_archived; });
    host.querySelectorAll('[data-arc]').forEach(function (b) {
      b.onclick = async function () {
        var a = b.getAttribute('data-arc');
        if (a === 'viewArchived') { state.view = 'archived'; render({ host: host.id, rows: window.__cbtRows || rows, engagementName: engName, reload: reload }); return; }
        if (a === 'viewActive') { state.view = 'active'; render({ host: host.id, rows: window.__cbtRows || rows, engagementName: engName, reload: reload }); return; }
        if (a === 'viewAll') { state.view = 'all'; render({ host: host.id, rows: window.__cbtRows || rows, engagementName: engName, reload: reload }); return; }
        if (a === 'restoreAll') {
          if (!archived.length) { log(host, 'No archived papers to restore.', false); return; }
          if (!window.confirm('Restore ALL ' + archived.length + ' archived paper(s) to the working list?')) return;
          await bulkSetArchived(archived.map(function (x) { return x.id; }), false, host, rows, engName, reload);
          return;
        }
        if (a === 'restoreVisible') {
          var vis = applyFilters(rows, engName).filter(function (x) { return x.is_archived; });
          if (!vis.length) { log(host, 'No archived papers are visible under the current filters — switch the View to "Archived only" or "All" first.', false); return; }
          if (!window.confirm('Restore the ' + vis.length + ' archived paper(s) visible under the current filters?')) return;
          await bulkSetArchived(vis.map(function (x) { return x.id; }), false, host, rows, engName, reload);
          return;
        }
        if (a === 'restoreFilteredAdvanced') {
          var sub = (document.getElementById('arc-subject') || {}).value || '';
          var eng = (document.getElementById('arc-eng') || {}).value || '';
          var knd = (document.getElementById('arc-kind') || {}).value || '';
          var match = rows.filter(function (x) {
            if (!x.is_archived) return false;
            if (sub && String(x.subject || '') !== sub) return false;
            if (eng && String(x.engagement_id || '') !== eng) return false;
            if (knd && String(x.quiz_kind || 'graded') !== knd) return false;
            return true;
          });
          if (!match.length) { log(host, 'No archived papers match those filters.', false); return; }
          if (!window.confirm('Restore ' + match.length + ' archived paper(s) matching the advanced filters?')) return;
          await bulkSetArchived(match.map(function (x) { return x.id; }), false, host, rows, engName, reload);
          return;
        }
        if (a === 'undo') {
          if (!lastBulk) return;
          await bulkSetArchived(lastBulk.ids, !lastBulk.archive, host, rows, engName, reload);
          return;
        }
        if (a === 'export') {
          if (!archived.length) { log(host, 'No archived papers to export.', false); return; }
          var payload = { exportedAt: new Date().toISOString(), kind: 'tutoring-connect-cbt-archive', exams: archived };
          var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
          var link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = 'cbt-archive-backup-' + new Date().toISOString().slice(0, 10) + '.json';
          link.click();
          setTimeout(function () { URL.revokeObjectURL(link.href); }, 4000);
          log(host, 'Exported ' + archived.length + ' archived paper(s) as a portable backup.', true);
          return;
        }
      };
    });
    var file = document.getElementById('arc-file');
    if (file && !file._arcWired) {
      file._arcWired = true;
      file.onchange = async function () {
        var f = file.files && file.files[0];
        if (!f) return;
        try {
          var data = JSON.parse(await f.text());
          var exams = Array.isArray(data) ? data : (data.exams || []);
          exams = exams.filter(function (x) { return x && x.title; });
          if (!exams.length) { log(host, 'That file contains no papers.', false); return; }
          var done = 0, fail = 0;
          for (var i = 0; i < exams.length; i++) {
            var x = exams[i];
            var row = {
              title: x.title, code: (x.code || '') + '', subject: x.subject || null,
              quiz_kind: x.quiz_kind || 'graded', status: x.status || 'draft',
              duration_min: x.duration_min || 40, questions: x.questions || [],
              multi_subject: !!x.multi_subject, is_archived: true,
              negative_mark: x.negative_mark || 0
            };
            if (x.code) row.code = String(x.code).toUpperCase();
            var r = await window.sb.from('cbt_exams').insert(row);
            if (r.error) fail++; else done++;
          }
          log(host, 'Imported ' + done + ' paper(s) as archived' + (fail ? ' · ' + fail + ' skipped (duplicate codes?)' : '') + '. Restore them from the buttons above.', !fail);
          reload();
        } catch (e) {
          log(host, 'Could not read that backup: ' + (e.message || e), false);
        }
      };
    }
  }

  return { render: render, state: state };
})();
