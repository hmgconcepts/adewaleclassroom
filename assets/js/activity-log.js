/* ═══════════════════════════════════════════════════════════════════════
   ADEWALE CLASSROOM — Activity log console (V45 / round 9, item 3)
   DramaConnect audit-rebuild pattern applied to our immutable log:
     • KPI snapshot (total events, today, distinct actors, deletes)
     • Filters: actor / table / action / date range / free text — pushed to
       the database so a big log never has to be downloaded whole
     • CSV export of the FILTERED view for external auditors
     • Read-only by design: the console never issues insert/update/delete
       against activity_log. Rows load oldest-agnostic (newest first) and
       are capped at 500 for the browser; exports raise that to 5000.
   ═══════════════════════════════════════════════════════════════════════ */
window.ActivityLog = (function () {
  'use strict';
  var PAGE = 500, EXPORT_CAP = 5000, rows = [];

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function kpi(label, value, tone) {
    return '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px 14px;min-width:120px">' +
      '<div style="font-size:.7rem;text-transform:uppercase;font-weight:800;color:#64748b">' + esc(label) + '</div>' +
      '<div style="font-size:1.35rem;font-weight:900;color:' + (tone || '#0f172a') + '">' + esc(value) + '</div></div>';
  }

  function buildQuery(cap) {
    var q = window.sb.from('activity_log')
      .select('id,created_at,actor,action,table_name,row_id,detail')
      .order('created_at', { ascending: false })
      .limit(cap);
    var who = document.getElementById('al-who').value.trim();
    var tbl = document.getElementById('al-table').value.trim();
    var act = document.getElementById('al-action').value;
    var from = document.getElementById('al-from').value;
    var to = document.getElementById('al-to').value;
    if (who) q = q.ilike('actor', '%' + who + '%');
    if (tbl) q = q.ilike('table_name', '%' + tbl + '%');
    if (act) q = q.eq('action', act);
    if (from) q = q.gte('created_at', from + 'T00:00:00');
    if (to) q = q.lte('created_at', to + 'T23:59:59');
    return q;
  }

  function localFilter(r) {
    var q = document.getElementById('al-q').value.trim().toLowerCase();
    if (!q) return true;
    return (r.actor + ' ' + r.action + ' ' + r.table_name + ' ' + (r.detail || '') + ' ' + (r.row_id || '')).toLowerCase().indexOf(q) > -1;
  }

  function render() {
    var wrap = document.getElementById('al-table-wrap');
    var kp = document.getElementById('al-kpis');
    if (!wrap) return;
    if (!window.sb) { wrap.innerHTML = '<p class="muted">Connect Supabase in assets/js/config.js to read the audit log.</p>'; return; }

    var today = new Date().toISOString().slice(0, 10);
    var k = {
      total: rows.length,
      today: rows.filter(function (r) { return String(r.created_at || '').slice(0, 10) === today; }).length,
      actors: Object.keys(rows.reduce(function (a, r) { if (r.actor) a[r.actor] = 1; return a; }, {})).length,
      deletes: rows.filter(function (r) { return String(r.action) === 'delete'; }).length
    };
    if (kp) kp.innerHTML =
      kpi('Events shown', k.total) + kpi('Today', k.today, '#1d4ed8') +
      kpi('Distinct actors', k.actors) + kpi('Deletes', k.deletes, '#b42318') +
      '<div style="margin-left:auto;align-self:center" class="muted" id="al-shown"></div>';

    var shown = 0;
    var body = rows.filter(function (r) { return localFilter(r); }).slice(0, PAGE);
    shown = body.length;
    wrap.innerHTML = !body.length
      ? '<p class="muted">No events match these filters.</p>'
      : '<div class="table-wrap"><table style="width:100%;font-size:.82rem"><thead><tr>' +
        '<th style="text-align:left;padding:6px 8px">When</th><th style="text-align:left;padding:6px 8px">Who</th>' +
        '<th style="text-align:left;padding:6px 8px">Action</th><th style="text-align:left;padding:6px 8px">Table</th>' +
        '<th style="text-align:left;padding:6px 8px">Row</th><th style="text-align:left;padding:6px 8px">Change</th></tr></thead><tbody>' +
        body.map(function (r) {
          var tone = { insert: '#166534', update: '#1e40af', delete: '#991b1b', signin: '#6d28d9' }[r.action] || '#334155';
          return '<tr style="border-bottom:1px solid #f1f5f9">' +
            '<td style="padding:6px 8px;white-space:nowrap">' + esc(String(r.created_at || '').replace('T', ' ').slice(0, 16)) + '</td>' +
            '<td style="padding:6px 8px">' + esc(r.actor || '—') + '</td>' +
            '<td style="padding:6px 8px"><span class="badge" style="background:' + tone + '1a;color:' + tone + '">' + esc(r.action || '') + '</span></td>' +
            '<td style="padding:6px 8px">' + esc(r.table_name || '') + '</td>' +
            '<td style="padding:6px 8px">' + esc(r.row_id || '') + '</td>' +
            '<td style="padding:6px 8px;color:#475569">' + esc(String(r.detail || '').slice(0, 140)) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        (rows.length > PAGE ? '<p class="muted" style="font-size:.78rem;margin-top:6px">Showing first ' + PAGE + ' matching events of ' + rows.length + ' loaded — narrow the filters or export the CSV for the full picture.</p>' : '');
    var note = document.getElementById('al-shown');
    if (note) note.textContent = body.length + ' shown of ' + rows.length + ' loaded';
  }

  async function load() {
    var wrap = document.getElementById('al-table-wrap');
    if (!wrap) return;
    try {
      var r = await buildQuery(EXPORT_CAP);
      if (r.error) throw new Error(r.error.message);
      rows = r.data || [];
      render();
    } catch (e) {
      wrap.innerHTML = '<p class="muted" style="color:#b42318">Could not read the activity log: ' + esc(e.message) + '</p>';
    }
  }

  function exportCsv() {
    var data = rows.filter(localFilter);
    if (!data.length) return alert('Nothing to export under these filters.');
    var head = ['created_at', 'actor', 'action', 'table_name', 'row_id', 'detail'];
    var lines = [head.join(',')].concat(data.map(function (r) {
      return head.map(function (h) {
        var v = r[h] == null ? '' : String(r[h]);
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',');
    }));
    var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'activity-log-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  function init() {
    ['al-who', 'al-table', 'al-from', 'al-to'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('change', load);
    });
    var go = document.getElementById('al-go'); if (go) go.onclick = load;
    var ex = document.getElementById('al-export'); if (ex) ex.onclick = exportCsv;
    var q = document.getElementById('al-q');
    if (q) q.addEventListener('input', function () { clearTimeout(window.__alT); window.__alT = setTimeout(render, 200); });
    load();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { load: load, exportCsv: exportCsv };
})();
