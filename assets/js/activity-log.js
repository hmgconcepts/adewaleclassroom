/* ============================================================================
   activity-log.js — the audit trail UI (V27, report item 4)
   ----------------------------------------------------------------------------
   Mounts into #activity-root on activity-log.html. Reads public.activity_log
   (actor, action, table_name, row_id, created_at) plus the actor's profile
   name. Filter by person, table, action and date range; export the filtered
   view to CSV. Rows are immutable — there is deliberately no edit or delete.
   Admin-only by RBAC and by the page's role guard.
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
    try { return new Date(ts).toLocaleString(); } catch (_) { return String(ts); }
  }

  var Log = {
    async mount() {
      var root = d.getElementById('activity-root');
      if (!root) return;
      var self = this;
      root.innerHTML =
        '<div class="card" style="padding:16px;margin-bottom:14px">' +
          '<div class="grid grid-2" style="gap:10px">' +
            '<div class="form-group" style="margin:0"><label>Search (actor, table, action, row)</label><input class="form-input" id="al-q" placeholder="e.g. learner, delete, TC-0001"></div>' +
            '<div class="form-group" style="margin:0"><label>Table</label><select class="form-select" id="al-table"><option value="">All tables</option></select></div>' +
            '<div class="form-group" style="margin:0"><label>From</label><input class="form-input" id="al-from" type="date"></div>' +
            '<div class="form-group" style="margin:0"><label>To</label><input class="form-input" id="al-to" type="date"></div>' +
          '</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' +
            '<button class="btn btn-primary btn-sm" type="button" id="al-run">🔍 Apply filters</button>' +
            '<button class="btn btn-outline btn-sm" type="button" id="al-csv">⬇ Export CSV</button>' +
            '<button class="btn btn-ghost btn-sm" type="button" id="al-clear">Clear</button>' +
            '<span class="muted" id="al-count" style="align-self:center;font-size:.82rem"></span>' +
          '</div>' +
        '</div>' +
        '<div class="card" style="padding:14px 16px;margin-bottom:14px;display:flex;gap:14px;flex-wrap:wrap" id="al-stats"></div>' +
        '<div class="card" style="padding:0;overflow:hidden"><div class="table-wrap"><table style="min-width:820px">' +
          '<thead><tr><th style="padding:12px 14px;text-align:left">When</th><th style="padding:12px 14px;text-align:left">Who</th><th style="padding:12px 14px;text-align:left">Action</th><th style="padding:12px 14px;text-align:left">Table</th><th style="padding:12px 14px;text-align:left">Row</th></tr></thead>' +
          '<tbody id="al-body"><tr><td colspan="5" style="padding:26px;text-align:center" class="muted">Loading…</td></tr></tbody>' +
        '</table></div></div>';
      this._cache = null;
      this._loadTables();
      ['al-run', 'al-clear'].forEach(function (id) {
        var el = d.getElementById(id);
        if (el) el.onclick = function () { self._run(); };
      });
      var q = d.getElementById('al-q');
      q.addEventListener('keydown', function (e) { if (e.key === 'Enter') self._run(); });
      d.getElementById('al-csv').onclick = function () { self._csv(); };
      this._run();
    },

    async _loadTables() {
      if (!w.sb) return;
      try {
        var { data } = await w.sb.from('activity_log').select('table_name').limit(1000);
        var set = {};
        (data || []).forEach(function (r) { if (r.table_name) set[r.table_name] = 1; });
        var sel = d.getElementById('al-table');
        if (!sel) return;
        Object.keys(set).sort().forEach(function (t) {
          var o = d.createElement('option');
          o.value = t; o.textContent = t;
          sel.appendChild(o);
        });
      } catch (_) {}
    },

    async _fetch() {
      if (w.sb) {
        var q = w.sb.from('activity_log').select('*, profiles(full_name)').order('created_at', { ascending: false }).limit(500);
        var qv = (d.getElementById('al-q').value || '').trim();
        var tbl = d.getElementById('al-table').value;
        var from = d.getElementById('al-from').value;
        var to = d.getElementById('al-to').value;
        if (tbl) q = q.eq('table_name', tbl);
        if (qv) q = q.or('action.ilike.%' + qv + '%,table_name.ilike.%' + qv + '%,row_id.ilike.%' + qv + '%');
        if (from) q = q.gte('created_at', from + 'T00:00:00');
        if (to) q = q.lte('created_at', to + 'T23:59:59');
        var { data, error } = await q;
        if (error) throw error;
        return (data || []).map(function (r) {
          return { created_at: r.created_at, actor: r.actor,
                   actor_name: (r.profiles && r.profiles.full_name) || null,
                   action: r.action, table_name: r.table_name, row_id: r.row_id };
        });
      }
      return (w.DEMO && Array.isArray(w.DEMO.activity_log)) ? w.DEMO.activity_log.slice(0, 200) : [];
    },

    async _run() {
      var body = d.getElementById('al-body');
      var count = d.getElementById('al-count');
      if (!body) return;
      body.innerHTML = '<tr><td colspan="5" style="padding:26px;text-align:center" class="muted">Loading…</td></tr>';
      try {
        var rows = await this._fetch();
        this._rows = rows;
        count.textContent = rows.length + ' event(s) shown (latest 500).';
        this._stats(rows);
        if (!rows.length) {
          body.innerHTML = '<tr><td colspan="5" style="padding:26px;text-align:center" class="muted">No activity matches those filters.</td></tr>';
          return;
        }
        body.innerHTML = rows.map(function (r) {
          var who = r.actor_name || (r.actor ? String(r.actor).slice(0, 8) + '…' : 'system');
          var badge = /delete/i.test(r.action || '') ? '#fee2e2'
                    : /insert|create|add/i.test(r.action || '') ? '#d1fae5'
                    : /sign/i.test(r.action || '') ? '#dbeafe' : '#f1f5f9';
          return '<tr>' +
            '<td style="padding:10px 14px;white-space:nowrap;font-size:.82rem">' + esc(when(r.created_at)) + '</td>' +
            '<td style="padding:10px 14px">' + esc(who) + '</td>' +
            '<td style="padding:10px 14px"><span style="background:' + badge + ';border-radius:8px;padding:2px 8px;font-size:.78rem;font-weight:700">' + esc(r.action || '—') + '</span></td>' +
            '<td style="padding:10px 14px"><code style="font-size:.78rem">' + esc(r.table_name || '—') + '</code></td>' +
            '<td style="padding:10px 14px;font-size:.8rem">' + esc(r.row_id || '—') + '</td>' +
          '</tr>';
        }).join('');
      } catch (e) {
        body.innerHTML = '<tr><td colspan="5" style="padding:26px;text-align:center;color:#b42318">Heads up. Could not load entries: ' + esc(e && e.message || e) + '</td></tr>';
      }
    },

    _stats(rows) {
      var box = d.getElementById('al-stats');
      if (!box) return;
      var tables = {};
      var byDay = {};
      rows.forEach(function (r) {
        tables[r.table_name || '—'] = (tables[r.table_name || '—'] || 0) + 1;
        var day = r.created_at ? String(r.created_at).slice(0, 10) : '—';
        byDay[day] = (byDay[day] || 0) + 1;
      });
      var top = Object.keys(tables).sort(function (a, b) { return tables[b] - tables[a]; }).slice(0, 4);
      box.innerHTML =
        '<div style="min-width:120px"><div class="stat-value" style="font-size:1.4rem">' + rows.length + '</div><div class="stat-label">Events</div></div>' +
        '<div style="min-width:120px"><div class="stat-value" style="font-size:1.4rem">' + Object.keys(tables).length + '</div><div class="stat-label">Tables touched</div></div>' +
        '<div style="min-width:140px"><div class="stat-value" style="font-size:1rem">' + top.map(function (t) { return '<span style="display:inline-block;background:#f1f5f9;border-radius:8px;padding:2px 8px;margin:2px;font-size:.78rem">' + esc(t) + ' · ' + tables[t] + '</span>'; }).join(' ') + '</div><div class="stat-label">Top tables</div></div>' +
        '<div style="min-width:120px"><div class="stat-value" style="font-size:1rem">' + esc(Object.keys(byDay).slice(0, 2).join(' · ') || '—') + '</div><div class="stat-label">Latest days</div></div>';
    },

    _csv() {
      var rows = this._rows || [];
      var head = 'when,who,action,table,row';
      var lines = rows.map(function (r) {
        return '"' + String(r.created_at || '').replace(/"/g, '""') + '","' +
               String(r.actor_name || r.actor || '').replace(/"/g, '""') + '","' +
               String(r.action || '').replace(/"/g, '""') + '","' +
               String(r.table_name || '').replace(/"/g, '""') + '","' +
               String(r.row_id || '').replace(/"/g, '""') + '"';
      });
      var blob = new Blob([head + '\n' + lines.join('\n')], { type: 'text/csv' });
      var a = d.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'activity-log-' + new Date().toISOString().slice(0, 10) + '.csv';
      d.body.appendChild(a); a.click(); a.remove();
    }
  };

  w.ActivityLog = Log;
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { Log.mount(); });
  else Log.mount();
})(window, document);
