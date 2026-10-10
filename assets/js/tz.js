/* ═══════════════════════════════════════════════════════════════════════
   ADEWALE CLASSROOM — tz.js: the timezone truth engine (V52 / round 16)
   ═══════════════════════════════════════════════════════════════════════
   THE BLUEPRINT (from the studio): international students sit in different
   timezones, and a class time shown in only one zone is how students miss
   classes. Every schedule-ish time on the relevant pages must therefore
   render in BOTH the studio's home zone and the viewer's own zone,
   concurrently — and the Timezone desk must let the studio record, per
   tutor / learner / parent / studio / exam board, the IANA zone, the
   working-hours window (in that person's OWN local time), daylight-saving
   behaviour and blackout notes, then PLAN across all of them at once.

   How this engine works:
     · TZ.init()  — one call per page (cheap; sessionStorage-cached):
         tc_my_tz()  (V52 security-definer RPC) → { home, mine, mine_label }
         tc_timezone_desk (all entries, readable by the signed-in) → the
           studio's zone registry for the planner and the live clocks.
         Falls back gracefully on a pre-V52 database (home = studio
         default Africa/Lagos, mine = the browser's zone), so the feature
         degrades to "still correct for the viewer", never to broken.
     · TZ.dualHtml(iso, colKey, row) — the concurrent display. Used by
       crud.js for schedule columns (starts_at and friends) and by the
       dashboard's Next-class card. Renders
         🏠 4:00 PM Lagos · 👤 9:00 AM Toronto (−6h)
       ONLY when the viewer's zone actually differs from home — a Lagos
       tutor and a Lagos student see the familiar single time, exactly as
       before, with zero noise.
     · TZ.planner()/TZ.clocks() — the Timezone desk: a meeting planner
       (one moment shown in every studio zone at once, with
       working-hours conflict flags and blackout notes) and a live
       world-clock board with in-hours/out-of-hours status.
   ═══════════════════════════════════════════════════════════════════════ */
window.TZ = (function () {
  'use strict';

  var S = {
    ready: false, loading: null,
    home: null, mine: null, mineLabel: '',
    desk: []            /* the studio's tc_timezone_desk entries */
  };

  /* columns whose datetimes are schedule-ish and get the dual treatment */
  var DUAL_COLS = ['starts_at', 'starts', 'ends_at', 'due_at', 'close_at', 'opens', 'opens_at', 'closes_at', 'taken_at', 'scheduled_at', 'next_session'];

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function validTz(name) {
    if (!name) return false;
    try { new Intl.DateTimeFormat('en-US', { timeZone: name }); return true; }
    catch (e) { return false; }
  }
  function browserTz() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (e) { return null; }
  }
  function zoneShort(tz, date) {
    try {
      var p = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
        .formatToParts(date || new Date()).filter(function (x) { return x.type === 'timeZoneName'; });
      return p.length ? p[0].value : tz;
    } catch (e) { return tz; }
  }
  function inTz(date, tz, opts) {
    try {
      return new Intl.DateTimeFormat('en-GB', Object.assign({ timeZone: tz }, opts || {})).format(date);
    } catch (e) { return date.toLocaleString(); }
  }
  /* hour-of-day + weekday in a zone — for working-hours checks */
  function partsIn(date, tz) {
    try {
      var p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false }).formatToParts(date);
      var out = {};
      p.forEach(function (x) { out[x.type] = x.value; });
      out.minutes = (Number(out.hour) || 0) * 60 + (Number(out.minute) || 0);
      return out;
    } catch (e) { return null; }
  }
  /* the signed difference home→viewer, in hours (e.g. −6) */
  function hourDiff(a, b, date) {
    try {
      var da = new Date(date || new Date()).toLocaleString('en-US', { timeZone: a });
      var db = new Date(date || new Date()).toLocaleString('en-US', { timeZone: b });
      return Math.round((new Date(db) - new Date(da)) / 1800000) / 2;
    } catch (e) { return 0; }
  }

  /* ── init ─────────────────────────────────────────────────────────── */
  function refresh() {
    S.ready = false; S.loading = null; S.home = null; S.mine = null; S.mineLabel = ''; S.desk = [];
    return init();
  }
  function init() {
    if (S.ready) return Promise.resolve(true);
    if (S.loading) return S.loading;
    S.loading = (async function () {
      /* 1. the viewer's truth from the database (V52) */
      try {
        var r = await window.sb.rpc('tc_my_tz');
        if (r.data && r.data.home) {
          S.home = validTz(r.data.home) ? r.data.home : null;
          if (r.data.mine && validTz(r.data.mine)) { S.mine = r.data.mine; S.mineLabel = r.data.mine_label || ''; }
        }
      } catch (e) { /* pre-V52 database — fall through to the graceful path */ }
      /* 2. the studio's zone registry */
      try {
        var d = await window.sb.from('tc_timezone_desk').select('*').eq('active', true).limit(300);
        if (!d.error) S.desk = d.data || [];
      } catch (e) {}
      if (!S.home) {
        var def = S.desk.filter(function (x) { return x.is_default; })[0];
        S.home = (def && validTz(def.tz) && def.tz) || 'Africa/Lagos';
      }
      if (!S.mine) S.mine = browserTz() || S.home;
      S.ready = true;
      return true;
    })();
    return S.loading;
  }

  /* ── the concurrent display ───────────────────────────────────────── */
  function dualHtml(iso, colKey, row) {
    if (!S.ready || !S.home || !S.mine) return '';
    if (colKey && DUAL_COLS.indexOf(colKey) === -1) return '';
    if (S.mine === S.home) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var diff = hourDiff(S.home, S.mine, d);
    if (!diff) return '';
    var diffTxt = (diff > 0 ? '+' : '−') + Math.abs(diff) + 'h';
    var mineCity = (S.mineLabel || String(S.mine).split('/').pop() || '').replace(/_/g, ' ');
    return '<div style="font-size:.78rem;margin-top:2px;white-space:nowrap">' +
      '<span title="The studio\'s home time">🏠 ' + esc(inTz(d, S.home, { weekday: 'short', hour: '2-digit', minute: '2-digit' })) + ' ' + esc(zoneShort(S.home, d)) + '</span>' +
      ' · <span title="Your local time">👤 ' + esc(inTz(d, S.mine, { weekday: 'short', hour: '2-digit', minute: '2-digit' })) + ' ' + esc(mineCity) + '</span>' +
      ' <span class="badge" style="background:#eef2ff;color:#3730a3;font-size:.68rem" title="Your time is ' + diffTxt + ' versus the studio clock">' + esc(diffTxt) + '</span>' +
      '</div>';
  }

  /* ── working-hours status for a desk entry at a moment ────────────── */
  function workStatus(entry, date) {
    var p = partsIn(date || new Date(), entry.tz);
    if (!p) return { ok: null, txt: '' };
    var days = entry.work_days && entry.work_days.length ? entry.work_days : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    var dayOk = days.map(function (x) { return String(x).slice(0, 3); }).indexOf(String(p.weekday || '').slice(0, 3)) > -1;
    if (!dayOk) return { ok: false, txt: 'not a working day (' + p.weekday + ')' };
    var from = String(entry.work_from || '').slice(0, 5);
    var to = String(entry.work_to || '').slice(0, 5);
    if (!from && !to) return { ok: true, txt: 'any hour' };
    var fm = Number(from.slice(0, 2)) * 60 + Number(from.slice(3, 5));
    var tm = Number(to.slice(0, 2)) * 60 + Number(to.slice(3, 5));
    if (tm <= fm) tm += 1440;  /* past-midnight window */
    /* r17 fix: the old comparison mixed two clocks (m >= fm AND
       p.minutes <= tm) — for a normal 09:00–17:00 window it marked 08:00
       as IN hours (m wrapped to 20:00 ≥ 09:00 while 08:00 ≤ 17:00).
       Both bounds must use the same wrapped minute. */
    var m = p.minutes < fm ? p.minutes + 1440 : p.minutes;
    var inWin = m >= fm && m <= tm;
    return {
      ok: inWin,
      txt: inWin ? 'in working hours' : ('outside ' + from + '–' + to + ' their time')
    };
  }

  /* ── the Timezone desk: planner + live clocks ─────────────────────── */
  function uniqueZones() {
    var seen = {}, out = [];
    S.desk.forEach(function (e) {
      if (!e.tz || seen[e.tz] || !validTz(e.tz)) return;
      seen[e.tz] = true;
      out.push(e);
    });
    if (!out.length && validTz(S.home)) out.push({ tz: S.home, city: 'Studio home', is_default: true });
    return out;
  }

  function planner(rootId) {
    var root = document.getElementById(rootId);
    if (!root) return;
    init().then(function () {
      var zones = uniqueZones();
      root.innerHTML =
        '<div class="card" style="margin-bottom:14px">' +
        '<h3 style="margin:0 0 6px">🗓 Meeting planner — one moment, every studio zone</h3>' +
        '<p class="muted" style="margin:0 0 10px;font-size:.86rem">Pick a date and time in ANY zone (it can be the student\'s). Every zone the studio teaches in shows that same moment at once, with working-hours flags — so you never propose a class that lands at 2am again.</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">' +
        '<div class="form-group" style="margin:0"><label>Date</label><input class="form-input" type="date" id="tzp-date"></div>' +
        '<div class="form-group" style="margin:0"><label>Time</label><input class="form-input" type="time" id="tzp-time" value="16:00"></div>' +
        '<div class="form-group" style="margin:0"><label>…as read in</label><select class="form-select" id="tzp-zone" style="min-width:170px">' +
        zones.map(function (z) { return '<option value="' + esc(z.tz) + '">' + esc(z.city || z.tz) + ' · ' + esc(z.tz) + '</option>'; }).join('') +
        (validTz(S.mine) && !zones.some(function (z) { return z.tz === S.mine; }) ? '<option value="' + esc(S.mine) + '">Your zone · ' + esc(S.mine) + '</option>' : '') +
        '</select></div>' +
        '<button class="btn btn-primary" type="button" id="tzp-go">Show everywhere</button>' +
        '<button class="btn btn-outline" type="button" id="tzp-copy" title="Copy a plain-text dual-time line you can paste into a message">📋 Copy dual-time line</button>' +
        '</div><div id="tzp-out" style="margin-top:12px"></div></div>' +
        '<div class="card"><h3 style="margin:0 0 8px">🕐 Studio world clocks — live</h3><div id="tzc-out"></div></div>';

      var d = new Date();
      var dd = document.getElementById('tzp-date');
      if (dd) dd.value = d.toISOString().slice(0, 10);
      var go = document.getElementById('tzp-go');
      if (go) go.onclick = renderPlan;
      renderPlan();
      clocks('tzc-out');

      function planMoment() {
        var dateV = (document.getElementById('tzp-date') || {}).value || new Date().toISOString().slice(0, 10);
        var timeV = (document.getElementById('tzp-time') || {}).value || '16:00';
        var zoneV = (document.getElementById('tzp-zone') || {}).value || S.home;
        /* interpret the wall-clock time in the chosen zone: build a UTC
           moment by trial offset (DST-correct in both directions) */
        var naive = new Date(dateV + 'T' + timeV + ':00Z');
        var guess = new Date(naive.getTime());
        for (var i = 0; i < 2; i++) {
          var shown = partsIn(guess, zoneV);
          if (!shown) break;
          var want = Number(timeV.slice(0, 2)) * 60 + Number(timeV.slice(3, 5));
          var drift = want - shown.minutes;
          if (drift === 0) break;
          if (drift > 720) drift -= 1440;
          if (drift < -720) drift += 1440;
          guess = new Date(guess.getTime() + drift * 60000);
        }
        return guess;
      }

      function renderPlan() {
        var out = document.getElementById('tzp-out');
        if (!out) return;
        var m = planMoment();
        var zones2 = uniqueZones();
        var rows = zones2.map(function (z) {
          var st = workStatus(z, m);
          var flag = st.ok === null ? '' : (st.ok
            ? '<span class="badge" style="background:#dcfce7;color:#166534">🟢 ' + esc(st.txt) + '</span>'
            : '<span class="badge" style="background:#fee2e2;color:#991b1b">🔴 ' + esc(st.txt) + '</span>');
          var homeTag = z.is_default ? ' <span class="badge" style="background:#eef2ff;color:#3730a3">studio home</span>' : '';
          var who = S.desk.filter(function (e) { return e.tz === z.tz; })
            .map(function (e) {
              return e.party_type === 'learner' ? (e.learner_name || 'learner')
                : e.party_type === 'tutor' ? (e.tutor_name || 'tutor')
                : e.party_type === 'parent' ? (e.parent_name || 'parent')
                : (e.label || e.party_type);
            }).filter(function (v, i, a) { return v && a.indexOf(v) === i; }).slice(0, 4).join(', ');
          return '<tr><td><b>' + esc(z.city || z.tz) + homeTag + '</b><br><small class="muted">' + esc(z.tz) + (who ? ' · ' + esc(who) : '') + '</small></td>' +
            '<td style="white-space:nowrap;font-weight:700">' + esc(inTz(m, z.tz, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) + ' ' + esc(zoneShort(z.tz, m)) + '</td>' +
            '<td>' + flag + (z.blackout ? ' <span class="badge" style="background:#fef3c7;color:#92400e" title="' + esc(z.blackout) + '">⚠ blackout note</span>' : '') + '</td></tr>';
        }).join('');
        out.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Zone</th><th>That moment is</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
          '<p class="muted" style="font-size:.78rem;margin:6px 0 0">Working hours and blackout notes come from the Timezone entries below — keep them current and this planner tells the truth.</p>';
      }

      var cp = document.getElementById('tzp-copy');
      if (cp) cp.onclick = function () {
        var m = planMoment();
        var line = '🕐 ' + inTz(m, S.home, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) + ' (studio time, ' + S.home + ')'
          + (S.mine !== S.home ? ' = ' + inTz(m, S.mine, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) + ' (your time, ' + S.mine + ')' : '');
        if (navigator.clipboard) navigator.clipboard.writeText(line).then(function () { toast('Copied: ' + line, 'success', 5000); });
        else prompt('Copy the dual-time line:', line);
      };
    });
  }

  var clockTimer = null;
  function clocks(rootId) {
    var root = document.getElementById(rootId);
    if (!root) return;
    function paint() {
      var now = new Date();
      var zones = uniqueZones();
      root.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px">' +
        zones.map(function (z) {
          var st = workStatus(z, now);
          var dot = st.ok === false ? '🔴' : '🟢';
          var diff = hourDiff(S.home, z.tz, now);
          var diffTxt = !diff ? 'studio home' : ((diff > 0 ? '+' : '−') + Math.abs(diff) + 'h vs home');
          return '<div style="border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;background:#fff">' +
            '<div style="display:flex;justify-content:space-between;align-items:center"><b>' + esc(z.city || z.tz) + '</b><span class="badge" style="background:#f1f5f9;color:#475569">' + esc(diffTxt) + '</span></div>' +
            '<div style="font-size:1.45rem;font-weight:800;margin:4px 0 2px;font-variant-numeric:tabular-nums">' + esc(inTz(now, z.tz, { weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })) + '</div>' +
            '<div class="muted" style="font-size:.75rem">' + dot + ' ' + esc(st.txt || z.tz) + (z.observes_dst ? ' · 🕐 daylight saving' : '') + '</div>' +
            '</div>';
        }).join('') + '</div>';
    }
    paint();
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = setInterval(paint, 1000);
  }

  return {
    init: init, refresh: refresh, dualHtml: dualHtml,
    planner: planner, clocks: clocks,
    home: function () { return S.home; },
    mine: function () { return S.mine; },
    desk: function () { return S.desk; },
    validTz: validTz, workStatus: workStatus, DUAL_COLS: DUAL_COLS
  };
})();
