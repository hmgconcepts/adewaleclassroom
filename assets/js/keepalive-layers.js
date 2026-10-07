/* ============================================================================
   keepalive-layers.js — Tutoring Connect V45 (round 9)
   ------------------------------------------------------------------------------
   14-layer keep-alive MONITORING, ported from the School Connect / GOSA
   Portal "Platform Health" console (itself from DramaConnect v14.2) and
   adapted to THIS product's layer inventory. Every layer that protects the
   free-tier Supabase project from the 7-day inactivity pause is listed —
   including the ones that have NEVER reported — with:

     · when it last carried out its function (per-source last ping + count,
       straight from the database — not guessed in the browser),
     · whether it is automated or human,
     · the SPECIFIC fix when it is stale or never ran,
     · a 168-hour pause countdown,
     · quorum detection: three or more independent fresh layers means no
       single company's outage can pause the project; fewer means the
       single-point-of-failure warning is shown.

   The per-layer data comes from tc_keepalive_layers() (security definer):
   tc_keep_alive(src) upserts public.tc_keepalive_sources on every ping,
   so "the reporting shows when these layers carry out their functions" is
   literal — each row is the last real database write from that layer.

   Loaded on platform-health.html. Free tier only; no external API.
   ========================================================================== */
window.KeepAliveLayers = (function () {
  'use strict';

  /* Every layer, including never-reported ones — a missing row used to hide
     a scheduler that never ran. Order = the layer matrix in
     SUPABASE_FREE_TIER_PROTECTION.md. */
  var LAYERS = [
    { source: 'pg-cron',             name: 'L1 · pg_cron (inside the database)',   kind: 'automated',
      fix: 'Re-run database/complete-schema.sql — it schedules the tc-keep-alive job every 2 days at 05:23 UTC when the pg_cron extension is available on your plan.' },
    { source: 'site-visit',          name: 'L2 · Site visits (app.js)',            kind: 'human',
      fix: 'Automatic: any signed visit writes a heartbeat once per device per 24h (assets/js/app.js). No setup needed.' },
    { source: 'github-actions',      name: 'L3 · GitHub Actions heartbeat',        kind: 'automated',
      fix: 'Push this repo to GitHub and add the SUPABASE_URL + SUPABASE_ANON_KEY secrets (Settings → Secrets and variables → Actions). .github/workflows/keep-supabase-alive.yml then pings every Monday and Thursday — and re-reads assets/js/config.js, so no other setup is required.' },
    { source: 'vercel-cron',         name: 'L4 · Vercel Cron (/api/keepalive.js)', kind: 'automated',
      fix: 'Redeploy on Vercel — the cron entry in vercel.json calls /api/keepalive.js daily and it self-configures from assets/js/config.js (CRON_SECRET optional).' },
    { source: 'google-apps-script',  name: 'L5 · Google Apps Script',              kind: 'automated',
      fix: 'Paste tools/keepalive.gs into script.google.com, put your Supabase URL + anon key in its constants, and add a daily time-driven trigger. Full steps: SUPABASE_FREE_TIER_PROTECTION.md → Layer 8.' },
    { source: 'cron-job-org',        name: 'L6 · cron-job.org (external pinger)',  kind: 'automated',
      fix: 'Create a free job at cron-job.org POSTing to <your-site>/api/keepalive.js (or directly to /rest/v1/rpc/tc_keep_alive with body {"src":"cron-job.org"}). Daily is enough.' },
    { source: 'edge-ping',           name: 'L7 · Edge Function + UptimeRobot',     kind: 'automated',
      fix: 'Deploy supabase/functions/ping with the Supabase CLI (see SUPABASE_FREE_TIER_PROTECTION.md → Layer 3), then point a free UptimeRobot monitor at the function URL. It writes a real database row on every call.' },
    { source: 'manual-health-page',  name: 'L8 · Manual button (Platform Health)', kind: 'human',
      fix: 'Press "Ping now (manual heartbeat)" on this page — always available, even from a phone.' },
    { source: 'auto-restore-watchdog', name: 'L9 · Auto-restore watchdog',         kind: 'automated',
      fix: '.github/workflows/supabase-auto-restore.yml checks the project daily via the Supabase Management API and restores it if paused. Add SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF secrets to enable the actual un-pausing; without them it still pings after every healthy check.' },
    { source: 'db-backup',           name: 'L10 · Weekly backup workflow',         kind: 'automated',
      fix: '.github/workflows/db-backup.yml runs weekly and now always writes a heartbeat too (V45). Needs the same SUPABASE_URL / SUPABASE_ANON_KEY secrets as Layer 3.' },
    { source: 'watchdog-selfheal',   name: 'L11 · Drift watchdog (self-heal)',     kind: 'automated',
      fix: '.github/workflows/keepalive-watchdog.yml reads tc_keep_alive_status() daily and writes a recovery heartbeat the moment the project drifts toward a pause. Needs the SUPABASE_URL / SUPABASE_ANON_KEY secrets.' },
    { source: 'browser-recovery',    name: 'L12 · Browser recovery (self-heal)',   kind: 'human',
      fix: 'Automatic: assets/js/keepalive-monitor.js writes a recovery heartbeat the moment an owner opens any page while the project is drifting. No setup needed.' },
    { source: 'fleet-console',       name: 'L13 · HMG Fleet Console',              kind: 'human',
      fix: 'Register this project in the HMG Fleet Console — it reads the same tc_keep_alive contract, can ping on demand and auto-pilots every client project from one place.' },
    { source: 'external',            name: 'L14 · Other external callers',         kind: 'human',
      fix: 'Any caller using an unrecognised source name lands here — nothing to fix; it still resets the inactivity timer.' }
  ];

  var FRESH_HOURS = 72;      // a layer counts as "fresh" if it ran in the last 3 days
  var PAUSE_WINDOW_H = 168;  // Supabase pauses after ~7 days without database activity

  /* Sources that are the SAME layer under a slightly different name (the
     Fleet Console has sent 'fleet', 'hmg-fleet-console' and 'fleet-actions'
     at different times; older manuals wrote 'manual' / 'manual-button').
     Grouped so a layer never looks "never ran" because of spelling. */
  var SOURCE_ALIASES = {
    'fleet': 'fleet-console', 'hmg-fleet-console': 'fleet-console', 'fleet-actions': 'fleet-console',
    'manual': 'manual-health-page', 'manual-button': 'manual-health-page',
    'github-action': 'github-actions', 'apps-script': 'google-apps-script',
    'uptime-robot': 'edge-ping', 'cron-job': 'cron-job-org'
  };
  function canonicalSource(src) {
    var k = String(src == null ? '' : src);
    return SOURCE_ALIASES[k] || k;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function sb() { return window.sb || (window.App && window.App.sb) || null; }

  function formatAgo(ts) {
    if (!ts) return 'never';
    var s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
    if (s < 90) return 'just now';
    if (s < 5400) return Math.round(s / 60) + ' min ago';
    if (s < 172800) return Math.round(s / 3600) + ' h ago';
    return Math.round(s / 86400) + ' days ago';
  }

  /* Manual heartbeat (Layer 8) — the button on Platform Health. */
  async function ping(source) {
    if (!sb()) throw new Error('Database not configured.');
    var r = await sb().rpc('tc_keep_alive', { src: source || 'manual-health-page' });
    if (r.error) throw r.error;
    return r.data;
  }

  /* The feed: summary + per-source rows, straight from the database. */
  async function getHealth() {
    if (!sb()) throw new Error('Database not configured.');
    var r = await sb().rpc('tc_keepalive_layers');
    if (r.error) throw r.error;
    var h = r.data || {};
    var bySource = {};
    (h.sources || []).forEach(function (row) {
      var key = canonicalSource(row.source);
      var prev = bySource[key];
      /* keep the most recent of the aliased rows, summing their counts */
      if (!prev) { bySource[key] = Object.assign({}, row, { source: key }); }
      else {
        prev.ping_count = Number(prev.ping_count || 0) + Number(row.ping_count || 0);
        if (new Date(row.last_ping_at) > new Date(prev.last_ping_at)) {
          prev.last_ping_at = row.last_ping_at;
          prev.hours_since = row.hours_since;
        }
      }
    });
    var rows = LAYERS.map(function (layer) {
      var found = bySource[layer.source] || null;
      var hours = found ? Number(found.hours_since) : null;
      var fresh = found ? hours < FRESH_HOURS : false;
      return {
        layer: layer,
        found: found,
        last: found ? found.last_ping_at : null,
        count: found ? Number(found.ping_count) : 0,
        hours: hours,
        fresh: fresh,
        state: found ? (fresh ? 'ok' : 'warn') : 'never',
        stateLabel: found ? (fresh ? '✅ Fresh' : '⚠️ Stale') : '⚪ Never ran'
      };
    });
    return {
      summary: h,
      rows: rows,
      freshCount: rows.filter(function (r2) { return r2.fresh; }).length,
      quorum: Number(h.fresh_count || 0) >= 3,
      totalPings: Number(h.total_pings || 0)
    };
  }

  /* Render the whole panel into #ka-layers (platform-health.html). */
  async function render() {
    var host = document.getElementById('ka-layers');
    if (!host) return null;
    var health;
    try { health = await getHealth(); }
    catch (e) {
      host.innerHTML = '<div class="card" style="padding:12px;background:#fef2f2;border-color:#fca5a5;color:#991b1b">' +
        'Could not read the keep-alive layers: ' + esc(e.message || e) + '</div>';
      return null;
    }
    var s = health.summary || {};
    var hrs = Number(s.hours_since);

    /* KPI strip */
    document.getElementById('ka-age').textContent = s.last_ping ? formatAgo(s.last_ping) : 'never';
    document.getElementById('ka-at').textContent = s.last_ping ? new Date(s.last_ping).toLocaleString() : 'no heartbeat recorded yet';
    document.getElementById('ka-source').textContent = s.last_source || '—';
    document.getElementById('ka-total').textContent = health.totalPings;
    var left = Math.max(0, PAUSE_WINDOW_H - (isFinite(hrs) ? hrs : PAUSE_WINDOW_H));
    document.getElementById('ka-countdown').textContent = isFinite(hrs) ? Math.round(left) + ' h left' : '—';
    document.getElementById('ka-countdown-note').textContent = 'of the 7-day window (last ping ' + (isFinite(hrs) ? Math.round(hrs) + ' h ago' : 'never') + ')';
    var qc = document.getElementById('ka-quorum');
    if (qc) {
      qc.textContent = health.quorum ? '🟢 Quorum: ' + health.freshCount + ' fresh layers' : '🟡 Only ' + health.freshCount + ' fresh layer' + (health.freshCount === 1 ? '' : 's');
      qc.style.color = health.quorum ? '#166534' : '#92400e';
      var qn = document.getElementById('ka-quorum-note');
      if (qn) qn.textContent = health.quorum
        ? 'No single provider outage can pause this project.'
        : (health.freshCount === 0 ? 'No layer has reported recently — press Ping now, then activate Layer 3 (GitHub Actions).'
           : 'Single point of failure — activate at least one more independent layer (Layer 3 GitHub Actions is the 5-minute fix).');
    }

    /* The 14-row matrix — including never-run layers. */
    var stateCls = { ok: 'phb-ok', warn: 'phb-warn', never: 'phb-never' };
    host.innerHTML =
      '<div class="table-wrap"><table style="width:100%;font-size:.85rem;border-collapse:collapse" id="ka-table">' +
      '<thead><tr>' +
      '<th style="text-align:left;padding:8px 10px">Layer</th>' +
      '<th style="text-align:left;padding:8px 10px">Kind</th>' +
      '<th style="text-align:left;padding:8px 10px">Last did its job</th>' +
      '<th style="text-align:right;padding:8px 10px">Pings</th>' +
      '<th style="text-align:left;padding:8px 10px">State</th>' +
      '<th style="text-align:left;padding:8px 10px">If stale / never ran — the specific fix</th>' +
      '</tr></thead><tbody>' +
      health.rows.map(function (r2) {
        return '<tr style="border-bottom:1px solid #f1f5f9">' +
          '<td style="padding:8px 10px"><b>' + esc(r2.layer.name) + '</b></td>' +
          '<td style="padding:8px 10px">' + (r2.layer.kind === 'automated' ? '🤖 automated' : '👤 human') + '</td>' +
          '<td style="padding:8px 10px">' + (r2.last ? esc(formatAgo(r2.last)) : '<span class="muted">never</span>') + '</td>' +
          '<td style="text-align:right;padding:8px 10px">' + r2.count + '</td>' +
          '<td style="padding:8px 10px"><span class="ph-badge ' + stateCls[r2.state] + '">' + r2.stateLabel + '</span></td>' +
          '<td style="padding:8px 10px;color:#64748b">' + esc(r2.layer.fix) + '</td>' +
          '</tr>';
      }).join('') +
      '</tbody></table></div>' +
      '<p class="muted" style="margin:10px 0 0;font-size:.8rem">Fresh = reported within ' + FRESH_HOURS + ' hours. ' +
      'Every row is the last real database write recorded from that layer (tc_keepalive_sources) — not a guess. ' +
      'Layers with no row yet have simply never run; their fix column tells you exactly how to start them.</p>';
    return health;
  }

  return { LAYERS: LAYERS, ping: ping, getHealth: getHealth, render: render, formatAgo: formatAgo };
})();
