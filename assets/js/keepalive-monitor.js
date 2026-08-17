/* ============================================================================
   keepalive-monitor.js — Tutoring Connect V9
   ----------------------------------------------------------------------------
   Makes the free-tier keep-alive system VISIBLE and SELF-HEALING in the browser.

   Why this file exists: the V8 audit found the keep-alive stack was completely
   unobservable. platform-health.html tried to read tc_heartbeat directly, but
   the table is (correctly) revoked from clients, so the live project answered
   `42501 permission denied` and the "Last heartbeat" tile was permanently "—".
   An owner therefore had no way to learn that their pings had stopped until the
   project had already paused. Silent failure is the worst property a safety
   system can have.

   V9 reads the SECURITY DEFINER RPC `tc_keep_alive_status()` instead, which
   exposes health without exposing the table, and:
     * shows a dismissible banner to OWNERS/ADMINS when the project is drifting
       toward a pause (warning at 3 days, critical at 5);
     * writes a recovery heartbeat immediately when it sees a stale state, so
       simply opening the portal repairs the situation;
     * renders a full status widget on Platform Health.

   Costs nothing: one RPC call per page load, throttled to once an hour per
   device via localStorage.
   ========================================================================== */
(function (w, d) {
  'use strict';

  var KeepAlive = {
    LS_CHECK: 'tc-ka-checked-at',
    LS_DISMISS: 'tc-ka-dismissed-at',
    CHECK_EVERY_MS: 60 * 60 * 1000,     // 1 hour per device
    DISMISS_FOR_MS: 12 * 60 * 60 * 1000, // banner snooze

    sb: function () { return w.sb || (w.App && w.App.sb) || null; },

    isOwner: function () {
      var r = String((w.App && (w.App.currentRole || w.App.role)) || '').toLowerCase();
      return ['admin', 'owner', 'director', 'lead_tutor', 'super_admin', 'administrator'].indexOf(r) !== -1;
    },

    /* Ask the database how close we are to being paused. */
    status: async function () {
      var sb = this.sb();
      if (!sb) return null;
      try {
        var r = await sb.rpc('tc_keep_alive_status');
        if (r.error) {
          // Older studio that has not run v9 yet — degrade quietly.
          return { state: 'unavailable', note: r.error.message };
        }
        return r.data || null;
      } catch (e) { return null; }
    },

    /* Write a heartbeat right now. */
    ping: async function (src) {
      var sb = this.sb();
      if (!sb) return false;
      try {
        var r = await sb.rpc('tc_keep_alive', { src: src || 'browser-recovery' });
        return !r.error;
      } catch (e) { return false; }
    },

    fmtDays: function (n) {
      n = Number(n || 0);
      if (n < 1) return Math.round(n * 24) + ' hour(s)';
      return n.toFixed(1) + ' day(s)';
    },

    banner: function (st) {
      try {
        if (d.getElementById('tc-ka-banner')) return;
        var dismissed = Number(localStorage.getItem(this.LS_DISMISS) || 0);
        if (Date.now() - dismissed < this.DISMISS_FOR_MS) return;

        var critical = st.state === 'critical';
        var el = d.createElement('div');
        el.id = 'tc-ka-banner';
        el.setAttribute('role', 'alert');
        el.style.cssText =
          'position:fixed;left:0;right:0;top:0;z-index:9996;padding:11px 16px;' +
          'font:600 14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;color:#fff;' +
          'display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap;' +
          'background:' + (critical ? '#b42318' : '#b45309') +
          ';box-shadow:0 3px 14px rgba(0,0,0,.25)';
        el.innerHTML =
          '<span>' + (critical ? '🛑' : '⚠️') + ' <b>Database keep-alive is ' +
          (critical ? 'CRITICAL' : 'stale') + '</b> — no heartbeat for ' +
          this.fmtDays(st.days_since) + '. Supabase pauses a free project after 7 days.</span>' +
          '<button type="button" id="tc-ka-fix" style="background:#fff;color:#0f172a;border:none;' +
          'padding:6px 14px;border-radius:8px;font-weight:800;cursor:pointer">Fix now</button>' +
          '<a href="platform-health.html" style="color:#fff;text-decoration:underline">Details</a>' +
          '<button type="button" id="tc-ka-x" aria-label="Dismiss" style="background:none;border:none;' +
          'color:#fff;font-size:18px;cursor:pointer">×</button>';
        (d.body || d.documentElement).appendChild(el);

        var self = this;
        d.getElementById('tc-ka-fix').onclick = async function () {
          this.textContent = 'Writing…';
          var ok = await self.ping('banner-fix');
          this.textContent = ok ? '✅ Fixed' : '❌ Failed';
          if (ok) setTimeout(function () { el.remove(); }, 1400);
        };
        d.getElementById('tc-ka-x').onclick = function () {
          try { localStorage.setItem(self.LS_DISMISS, String(Date.now())); } catch (_) {}
          el.remove();
        };
      } catch (e) {}
    },

    /* Full widget for platform-health.html */
    renderWidget: async function (host) {
      if (!host) return;
      host.innerHTML = '<p class="muted">Checking keep-alive health…</p>';
      var st = await this.status();

      if (!st) {
        host.innerHTML = '<p class="muted">Connect Supabase to see keep-alive health.</p>';
        return;
      }
      if (st.state === 'unavailable') {
        host.innerHTML =
          '<div class="card" style="border-left:4px solid #b45309;background:#fffbeb">' +
          '<b>⚠️ Status reporting not installed</b>' +
          '<p style="margin:6px 0 0">Run <code>database/v9-keepalive-and-drive.sql</code> in the Supabase ' +
          'SQL editor to enable keep-alive monitoring. Your heartbeat writes still work.</p>' +
          '<p class="muted" style="margin:6px 0 0;font-size:.82rem">' + (st.note || '') + '</p></div>';
        return;
      }

      var colors = { healthy: '#047857', warning: '#b45309', critical: '#b42318' };
      var labels = { healthy: '✅ Healthy', warning: '⚠️ Stale', critical: '🛑 Critical' };
      var c = colors[st.state] || '#334155';

      host.innerHTML =
        '<div class="grid grid-4" style="gap:12px">' +
          '<div class="stat-card" style="border-left:4px solid ' + c + '">' +
            '<div class="stat-value" style="color:' + c + ';font-size:1.15rem">' + (labels[st.state] || st.state) + '</div>' +
            '<div class="stat-label">Keep-alive state</div></div>' +
          '<div class="stat-card"><div class="stat-value">' + this.fmtDays(st.days_since) + '</div>' +
            '<div class="stat-label">Since last heartbeat</div></div>' +
          '<div class="stat-card"><div class="stat-value">' + this.fmtDays(st.days_left) + '</div>' +
            '<div class="stat-label">Margin before pause risk</div></div>' +
          '<div class="stat-card"><div class="stat-value">' + (st.ping_count || 0) + '</div>' +
            '<div class="stat-label">Total heartbeats</div></div>' +
        '</div>' +
        '<p style="margin-top:10px"><b>Last source:</b> <code>' +
          String(st.last_source || 'unknown').replace(/[<>&]/g, '') + '</code> · ' +
          '<b>Last ping:</b> ' + new Date(st.last_ping).toLocaleString() + '</p>' +
        '<p style="margin-top:6px"><button class="btn btn-primary btn-sm" type="button" id="tc-ka-now">' +
          '💓 Write heartbeat now</button> ' +
          '<a class="btn btn-ghost btn-sm" href="docs/KEEP-ALIVE-GUIDE.md" target="_blank">Keep-alive runbook</a></p>' +
        (st.state !== 'healthy'
          ? '<div class="card" style="margin-top:10px;border-left:4px solid ' + c + ';background:#fff7ed">' +
            '<b>What to do</b><ol style="margin:6px 0 0 18px;line-height:1.7">' +
            '<li>Press <b>Write heartbeat now</b> — that buys you another 7 days immediately.</li>' +
            '<li>Check GitHub → <b>Actions</b> → is <i>Keep Supabase Alive</i> still enabled and green?</li>' +
            '<li>Check your external scheduler (cron-job.org / UptimeRobot) is still running.</li>' +
            '<li>Confirm the <code>SUPABASE_URL</code> / <code>SUPABASE_ANON_KEY</code> secrets are still valid.</li>' +
            '</ol></div>'
          : '');

      var self = this;
      var btn = d.getElementById('tc-ka-now');
      if (btn) btn.onclick = async function () {
        btn.disabled = true; btn.textContent = 'Writing…';
        await self.ping('manual-health-page');
        self.renderWidget(host);
      };
    },

    init: async function () {
      try {
        if (!this.sb()) return;
        var last = Number(localStorage.getItem(this.LS_CHECK) || 0);
        if (Date.now() - last < this.CHECK_EVERY_MS) return;
        localStorage.setItem(this.LS_CHECK, String(Date.now()));

        var st = await this.status();
        if (!st || !st.state || st.state === 'unavailable') return;
        w.TC_KEEPALIVE = st;

        // Self-heal: any signed-in visit repairs a drifting project.
        if (st.state !== 'healthy') {
          await this.ping('browser-selfheal');
          if (this.isOwner()) this.banner(st);
        }
      } catch (e) {}
    }
  };

  w.KeepAlive = KeepAlive;

  // Run after app.js has resolved the role, so isOwner() is meaningful.
  function boot() { setTimeout(function () { KeepAlive.init(); }, 4000); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
