/* ============================================================================
   quota-guard.js — Tutoring Connect V12
   ----------------------------------------------------------------------------
   Makes the Supabase free-tier budget VISIBLE and ACTIONABLE.

   The platform already protects the 1 GB *storage* quota by refusing file
   uploads outright — media is always a link (Drive, YouTube, https), rendered
   as a preview. But the 500 MB *database* quota has had no guard at all, and on
   this platform it will always fill in the same place: CBT results. Each
   submitted paper stores `answers`, `review` and `detail` as JSONB, so a
   60-question sitting is roughly 30-60 KB per candidate. A studio running mocks
   for two or three years will eventually notice, and on the free tier there is
   no email warning before writes start failing.

   This surfaces:
     * total database size against the 500 MB budget, with a state
       (healthy < 70%, warning < 84%, critical above);
     * the worst tables, so the cause is never a mystery;
     * two safe reclaim actions, both admin-only and both confirmation-gated:
         - Prune logs         (activity log, login audit, read notifications)
         - Slim old quiz replay (keeps every score; drops only the per-question
                                 blob for results older than N days)

   Nothing here can delete a mark, a payment, a session or a learner.
   Backed by tc_db_report(), tc_prune_logs() and tc_slim_cbt_results() in
   database/v12-quota-guard.sql.
   ========================================================================== */
(function (w, d) {
  'use strict';

  var QuotaGuard = {
    LS_CHECK: 'tc-quota-checked',
    CHECK_EVERY_MS: 12 * 60 * 60 * 1000,

    sb: function () { return w.sb || (w.App && w.App.sb) || null; },
    isOwner: function () {
      var r = String((w.App && (w.App.currentRole || w.App.role)) || '').toLowerCase();
      return ['admin', 'owner', 'director', 'lead_tutor', 'super_admin', 'administrator'].indexOf(r) !== -1;
    },
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    },

    report: async function () {
      var sb = this.sb();
      if (!sb) return null;
      try {
        var r = await sb.rpc('tc_db_report');
        if (r.error) return { state: 'unavailable', note: r.error.message };
        return r.data;
      } catch (e) { return null; }
    },

    bar: function (pct, colour) {
      var w2 = Math.max(0, Math.min(100, Number(pct) || 0));
      return '<div style="height:12px;border-radius:99px;background:#e2e8f0;overflow:hidden;margin:6px 0">' +
             '<div style="height:100%;width:' + w2 + '%;background:' + colour + '"></div></div>';
    },

    renderWidget: async function (host) {
      if (!host) return;
      host.innerHTML = '<p class="muted">Measuring database usage…</p>';
      var rep = await this.report();

      if (!rep) { host.innerHTML = '<p class="muted">Connect Supabase to see database usage.</p>'; return; }
      if (rep.state === 'unavailable') {
        host.innerHTML = '<div class="card" style="border-left:4px solid #b45309;background:#fffbeb">' +
          '<b>⚠️ Quota reporting not installed</b><p style="margin:6px 0 0">Run ' +
          '<code>database/complete-schema.sql</code> (V12) to enable the free-tier quota guard.</p></div>';
        return;
      }

      var colours = { healthy: '#047857', warning: '#b45309', critical: '#b42318' };
      var labels  = { healthy: '✅ Healthy', warning: '⚠️ Filling up', critical: '🛑 Critical' };
      var c = colours[rep.state] || '#334155';
      var tops = rep.top_tables || [];

      host.innerHTML =
        '<div class="grid grid-4" style="gap:12px">' +
          '<div class="stat-card" style="border-left:4px solid ' + c + '">' +
            '<div class="stat-value" style="color:' + c + ';font-size:1.1rem">' + (labels[rep.state] || rep.state) + '</div>' +
            '<div class="stat-label">Database quota</div></div>' +
          '<div class="stat-card"><div class="stat-value">' + rep.used_mb + ' MB</div>' +
            '<div class="stat-label">Used of 500 MB</div></div>' +
          '<div class="stat-card"><div class="stat-value">' + rep.used_pct + '%</div>' +
            '<div class="stat-label">Of the free budget</div></div>' +
          '<div class="stat-card"><div class="stat-value">' +
            Math.max(0, (500 - Number(rep.used_mb)).toFixed(1)) + ' MB</div>' +
            '<div class="stat-label">Headroom left</div></div>' +
        '</div>' +
        this.bar(rep.used_pct, c) +

        '<h4 style="margin:14px 0 6px">What is using the space</h4>' +
        '<div class="table-wrap"><table style="width:100%;font-size:.88rem">' +
        '<thead><tr><th align="left">Table</th><th align="right">MB</th><th align="right">Share</th></tr></thead><tbody>' +
        tops.map(function (t) {
          return '<tr><td><code>' + this.esc(t.table) + '</code></td>' +
                 '<td align="right">' + t.mb + '</td><td align="right">' + t.pct + '%</td></tr>';
        }, this).join('') +
        '</tbody></table></div>' +

        '<h4 style="margin:14px 0 6px">Reclaim space safely</h4>' +
        '<p class="muted" style="font-size:.88rem">Neither action can touch a mark, a payment, a session or a ' +
        'learner record. Scores are permanent — only logs and the per-question <i>replay</i> of long-past ' +
        'quizzes are affected.</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
          '<label style="font-size:.86rem">Keep logs for <input id="qg-log-days" type="number" value="365" min="30" ' +
            'style="width:80px;padding:5px;border:1px solid #e2e8f0;border-radius:8px"> days</label>' +
          '<button class="btn btn-sm btn-outline" type="button" id="qg-prune">🧹 Prune logs</button>' +
          '<label style="font-size:.86rem;margin-left:10px">Slim quiz replay older than ' +
            '<input id="qg-slim-days" type="number" value="730" min="90" ' +
            'style="width:80px;padding:5px;border:1px solid #e2e8f0;border-radius:8px"> days</label>' +
          '<button class="btn btn-sm btn-outline" type="button" id="qg-slim">📦 Slim old results</button>' +
          '<button class="btn btn-sm btn-ghost" type="button" id="qg-refresh">↻ Refresh</button>' +
        '</div>' +
        '<div id="qg-status" style="margin-top:10px"></div>' +

        (rep.state !== 'healthy'
          ? '<div class="card" style="margin-top:12px;border-left:4px solid ' + c + ';background:#fff7ed">' +
            '<b>Recommended now</b><ol style="margin:6px 0 0 18px;line-height:1.7">' +
            '<li>Run <b>Slim old results</b> — this is almost always the biggest win.</li>' +
            '<li>Run <b>Prune logs</b>.</li>' +
            '<li>Take a <a href="admin-data.html">Drive backup</a> first if you want a full copy of the replay data.</li>' +
            '<li>Remember: media must stay as <b>links</b>. Never upload files.</li>' +
            '</ol></div>' : '');

      var self = this;
      var say = function (h, bad) {
        d.getElementById('qg-status').innerHTML =
          '<div style="padding:10px 12px;border-radius:10px;background:#fff;border-left:4px solid ' +
          (bad ? '#b42318' : '#047857') + '">' + h + '</div>';
      };

      d.getElementById('qg-refresh').onclick = function () { self.renderWidget(host); };

      d.getElementById('qg-prune').onclick = async function () {
        var days = Number(d.getElementById('qg-log-days').value || 365);
        if (!confirm('Delete activity-log, login-audit and READ notification rows older than ' + days +
                     ' days?\n\nNo academic or financial record is touched.')) return;
        say('Pruning…');
        try {
          var r = await self.sb().rpc('tc_prune_logs', { p_days: days });
          if (r.error) throw r.error;
          say('✅ Pruned. ' + JSON.stringify(r.data.deleted));
          setTimeout(function () { self.renderWidget(host); }, 1200);
        } catch (e) { say('❌ ' + self.esc(e.message || e), true); }
      };

      d.getElementById('qg-slim').onclick = async function () {
        var days = Number(d.getElementById('qg-slim-days').value || 730);
        if (!confirm('Remove the per-question replay from quiz results older than ' + days + ' days?\n\n' +
                     'KEPT: every score, per-subject score and scoresheet row.\n' +
                     'REMOVED: the stored answer-by-answer replay used for the review screen and PDF.\n\n' +
                     'Take a Drive backup first if you want to keep the replay. Continue?')) return;
        say('Slimming…');
        try {
          var r = await self.sb().rpc('tc_slim_cbt_results', { p_days: days });
          if (r.error) throw r.error;
          say('✅ Slimmed <b>' + r.data.slimmed + '</b> old result(s), freeing about <b>' +
              r.data.freed_mb_estimate + ' MB</b>. All scores untouched.');
          setTimeout(function () { self.renderWidget(host); }, 1200);
        } catch (e) { say('❌ ' + self.esc(e.message || e), true); }
      };
    },

    /* Quiet background check — warns an owner before writes start failing. */
    init: async function () {
      try {
        if (!this.sb() || !this.isOwner()) return;
        var last = Number(localStorage.getItem(this.LS_CHECK) || 0);
        if (Date.now() - last < this.CHECK_EVERY_MS) return;
        localStorage.setItem(this.LS_CHECK, String(Date.now()));
        var rep = await this.report();
        if (!rep || !rep.state || rep.state === 'unavailable' || rep.state === 'healthy') return;
        w.TC_QUOTA = rep;
        if (typeof w.toast === 'function') {
          w.toast('🗄️ Database is ' + rep.used_pct + '% of the free 500 MB budget. ' +
                  'Open Storage manager to reclaim space safely.', 'warning', 10000);
        }
      } catch (e) {}
    }
  };

  w.QuotaGuard = QuotaGuard;
  function boot() { setTimeout(function () { QuotaGuard.init(); }, 6000); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
