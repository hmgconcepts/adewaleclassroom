/* ============================================================================
   schema-doctor.js — Tutoring Connect V11
   ----------------------------------------------------------------------------
   THE PROBLEM THIS SOLVES (reported: "error messages pop up on Attendance and
   Hour banks")

   A studio's static files can be updated independently of its database. When
   the files are newer than the SQL that has actually been run, pages call
   functions and policies that do not exist yet, and the user is shown a stream
   of raw PostgreSQL noise:

       PGRST202  Could not find the function public.tc_keep_alive_status
       42501     new row violates row-level security policy
       42P01     relation "public.xyz" does not exist

   Probing the live ADEWALE CLASSROOM project confirmed exactly this: the code
   was at V9 while the database was still pre-V6 — `tc_cbt_get_exam`,
   `is_family_of_learner` and `tc_keep_alive_status` were all absent. Every
   affected page failed separately, so the operator saw several meaningless
   popups instead of one actionable sentence.

   WHAT THIS DOES
     1. Probes the database ONCE per session for the functions each schema pack
        installs, and works out which version is actually deployed.
     2. If the database is behind, shows the admin ONE clear banner naming the
        exact file to run — instead of letting every page shout separately.
     3. Installs a humaniser that rewrites raw Postgres/PostgREST errors into
        plain English with the fix, and de-duplicates repeats.
     4. Stays completely silent for parents, learners and tutors — they should
        never see infrastructure messages.

   Free, no dependencies, one round-trip per session.
   ========================================================================== */
(function (w, d) {
  'use strict';

  var Doctor = {
    LS_KEY: 'tc-schema-checked',
    CHECK_EVERY_MS: 6 * 60 * 60 * 1000,

    /* Each probe = one function, the pack that installs it, and what breaks
       without it. Ordered oldest → newest. */
    PROBES: [
      { fn: 'tc_current_role',       pack: 'complete-schema.sql', v: 'V4',
        breaks: 'sign-in role resolution' },
      { fn: 'tc_cbt_get_exam',       pack: 'database/v6-cbt-modes.sql', v: 'V6',
        breaks: 'quiz codes / student-ID sign-in for CBT' },
      { fn: 'is_family_of_learner',  pack: 'database/v7-family-access-fix.sql', v: 'V7',
        breaks: 'parent and learner access — family dashboards return nothing' },
      { fn: 'tc_keep_alive_status',  pack: 'database/v9-keepalive-and-drive.sql', v: 'V9',
        breaks: 'keep-alive monitoring and the Drive status panel' },
      { fn: 'tc_schema_info',        pack: 'database/v12-quota-guard.sql', v: 'V12',
        breaks: 'schema version reporting and the free-tier quota guard' }
    ],

    sb: function () { return w.sb || (w.App && w.App.sb) || null; },

    isOwner: function () {
      var r = String((w.App && (w.App.currentRole || w.App.role)) || '').toLowerCase();
      return ['admin', 'owner', 'director', 'lead_tutor', 'super_admin', 'administrator'].indexOf(r) !== -1;
    },

    /* ---------------- error humanising ---------------- */
    HUMAN: [
      { test: /PGRST202|Could not find the function/i,
        title: 'Your database is behind the app',
        say: 'This screen needs a database function that has not been installed yet.',
        fix: 'Run database/complete-schema.sql in the Supabase SQL editor (it is idempotent — safe to re-run).' },
      { test: /42501|row-level security|permission denied/i,
        title: 'The database refused that request',
        say: 'Row Level Security blocked it — either your role is not allowed, or the access policies have not been installed.',
        fix: 'If you are an admin and this looks wrong, run database/v7-family-access-fix.sql.' },
      { test: /42P01|does not exist|relation .* does not exist/i,
        title: 'A table is missing',
        say: 'This screen reads a table that is not in your database yet.',
        fix: 'Run database/complete-schema.sql to install every table.' },
      { test: /42703|column .* does not exist/i,
        title: 'A column is missing',
        say: 'Your database is an older version than these files.',
        fix: 'Run database/complete-schema.sql to bring it up to date.' },
      { test: /JWT|invalid token|expired/i,
        title: 'Your session expired',
        say: 'You have been signed out for security.',
        fix: 'Sign in again.' },
      { test: /Failed to fetch|NetworkError|ERR_INTERNET/i,
        title: 'No connection to the database',
        say: 'The request could not leave this device, or the project is paused.',
        fix: 'Check your connection. If it persists, the Supabase project may be paused — open the dashboard and press Restore.' }
    ],

    humanise: function (msg) {
      var s = String(msg == null ? '' : msg);
      for (var i = 0; i < this.HUMAN.length; i++) {
        if (this.HUMAN[i].test.test(s)) {
          var h = this.HUMAN[i];
          return { matched: true, text: h.title + ' — ' + h.say + ' ' + (this.isOwner() ? h.fix : 'Please tell the studio administrator.') };
        }
      }
      return { matched: false, text: s };
    },

    /* Wrap toast() so raw database noise never reaches a human, and the same
       message cannot stack up five times. */
    installToastFilter: function () {
      if (this._wrapped) return;
      var self = this;
      var seen = {};
      var original = w.toast;
      if (typeof original !== 'function') return;
      w.toast = function (msg, type, ms) {
        try {
          var h = self.humanise(msg);
          if (h.matched) {
            // Infrastructure problems are for admins only.
            if (!self.isOwner()) return;
            var key = h.text.slice(0, 60);
            if (seen[key] && Date.now() - seen[key] < 60000) return;   // de-dupe for 60s
            seen[key] = Date.now();
            return original.call(w, h.text, 'warning', Math.max(ms || 0, 9000));
          }
        } catch (e) {}
        return original.call(w, msg, type, ms);
      };
      this._wrapped = true;
    },

    /* ---------------- version probing ---------------- */
    probe: async function () {
      var sb = this.sb();
      if (!sb) return null;

      /* V12: ask the database what version it is. This is one round-trip and
         is authoritative. Probing function-by-function (below) remains as the
         fallback for studios installed before the registry existed. */
      try {
        var reg = await sb.rpc('tc_schema_info');
        if (!reg.error && reg.data && reg.data.version) {
          var v = String(reg.data.version);
          if (v === (reg.data.expected || 'V12')) {
            return { missing: [], present: this.PROBES.slice(), deployed: v, source: 'registry' };
          }
        }
      } catch (e) { /* fall through to probing */ }

      var missing = [], present = [];
      for (var i = 0; i < this.PROBES.length; i++) {
        var p = this.PROBES[i];
        try {
          var r = await sb.rpc(p.fn, p.fn === 'is_family_of_learner'
            ? { p_learner: '00000000-0000-0000-0000-000000000000' } : {});
          // PGRST202 = the function itself is absent. Any other error (e.g. a
          // permission error) still proves the function EXISTS.
          if (r.error && /PGRST202|Could not find the function/i.test(r.error.message || '')) missing.push(p);
          else present.push(p);
        } catch (e) { present.push(p); }
      }
      /* The deployed version is the highest pack present BEFORE the first gap.
         Taking simply "the last present probe" is wrong: a database can be
         missing V6 yet still have a V12 object, and reporting V12 would hide
         the real problem. Stop at the first hole. */
      var deployed = 'unknown';
      for (var k = 0; k < this.PROBES.length; k++) {
        if (missing.indexOf(this.PROBES[k]) !== -1) break;
        deployed = this.PROBES[k].v;
      }
      return { missing: missing, present: present, deployed: deployed, source: 'probe' };
    },

    banner: function (res) {
      if (d.getElementById('tc-schema-banner')) return;
      var worst = res.missing[0];
      var packs = [];
      res.missing.forEach(function (m) { if (packs.indexOf(m.pack) === -1) packs.push(m.pack); });

      var el = d.createElement('div');
      el.id = 'tc-schema-banner';
      el.setAttribute('role', 'alert');
      el.style.cssText =
        'position:fixed;left:0;right:0;top:0;z-index:9994;padding:12px 16px;' +
        'font:600 14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;color:#fff;' +
        'background:#b42318;box-shadow:0 3px 14px rgba(0,0,0,.28);display:flex;gap:12px;' +
        'align-items:center;justify-content:center;flex-wrap:wrap';
      el.innerHTML =
        '<span>🗄️ <b>Your database is out of date</b> — it is at <b>' + res.deployed +
        '</b> but these files expect <b>V9</b>. ' + res.missing.length +
        ' missing function(s); this breaks ' + this.escape(worst.breaks) + '.</span>' +
        '<span style="background:rgba(255,255,255,.18);padding:4px 10px;border-radius:8px">Run: <code>' +
        this.escape(packs.join(' + ')) + '</code></span>' +
        '<a href="platform-health.html" style="color:#fff;text-decoration:underline">Details</a>' +
        '<button type="button" id="tc-schema-x" aria-label="Dismiss" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer">×</button>';
      (d.body || d.documentElement).appendChild(el);
      d.getElementById('tc-schema-x').onclick = function () {
        try { sessionStorage.setItem('tc-schema-dismissed', '1'); } catch (_) {}
        el.remove();
      };
    },

    escape: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    },

    /* Rendered inside platform-health.html */
    renderWidget: async function (host) {
      if (!host) return;
      host.innerHTML = '<p class="muted">Checking database version…</p>';
      var res = await this.probe();
      if (!res) { host.innerHTML = '<p class="muted">Connect Supabase to check the schema version.</p>'; return; }
      if (!res.missing.length) {
        host.innerHTML = '<div class="card" style="border-left:4px solid #047857;background:#f0fdf4">' +
          '<b>✅ Database schema is up to date (V12)</b>' +
          '<p style="margin:6px 0 0">Every function this build needs is installed.</p></div>';
        return;
      }
      host.innerHTML = '<div class="card" style="border-left:4px solid #b42318;background:#fef2f2">' +
        '<b>🗄️ Database is at ' + this.escape(res.deployed) + ' — these files expect V12</b>' +
        '<p style="margin:6px 0">Missing objects, and what each one breaks:</p>' +
        '<ul style="margin:0 0 8px 18px">' +
        res.missing.map(function (m) {
          return '<li><code>' + m.fn + '()</code> — breaks <b>' + m.breaks + '</b><br>' +
                 '<span class="muted">installed by <code>' + m.pack + '</code></span></li>';
        }).join('') + '</ul>' +
        '<p style="margin:0"><b>Fix:</b> open Supabase → SQL Editor → paste all of ' +
        '<code>database/complete-schema.sql</code> → Run. It is idempotent, so re-running is safe ' +
        'and existing data is untouched.</p></div>';
    },

    init: async function () {
      this.installToastFilter();
      try {
        if (!this.sb()) return;
        var last = Number(localStorage.getItem(this.LS_KEY) || 0);
        if (Date.now() - last < this.CHECK_EVERY_MS) return;

        var res = await this.probe();
        if (!res) return;
        localStorage.setItem(this.LS_KEY, String(Date.now()));
        w.TC_SCHEMA = res;
        if (!res.missing.length) return;
        // Only an owner can act on this, and only once per browser session.
        if (!this.isOwner()) return;
        try { if (sessionStorage.getItem('tc-schema-dismissed')) return; } catch (_) {}
        this.banner(res);
      } catch (e) {}
    }
  };

  w.SchemaDoctor = Doctor;
  function boot() { setTimeout(function () { Doctor.init(); }, 4500); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
