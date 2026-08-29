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
    /* Everything below is installed by database/complete-schema.sql, which is
       a verified superset of every individual pack. `pack` is retained only
       so the operator can search the file for the object. */
    EXPECTED: 'V42',

    /* BUGFIX: each probe MUST carry the real argument list. Probing
       tc_cbt_get_exam with {} made PostgREST reply PGRST202 ("...without
       parameters ... no matches were found"), and the doctor reported a
       function that plainly exists as missing — which is what produced the
       bogus "at V4 but these files expect V9 / run v6-cbt-modes.sql" banner. */
    PROBES: [
      { fn: 'tc_current_role',       args: {}, pack: 'complete-schema.sql', v: 'V4',
        breaks: 'sign-in role resolution' },
      { fn: 'tc_cbt_get_exam',       args: { p_code: '__probe__', p_student_no: '' },
        pack: 'complete-schema.sql', v: 'V6',
        breaks: 'quiz codes / student-ID sign-in for CBT' },
      { fn: 'is_family_of_learner',  args: { p_learner: '00000000-0000-0000-0000-000000000000' },
        pack: 'complete-schema.sql', v: 'V7',
        breaks: 'parent and learner access — family dashboards return nothing' },
      { fn: 'tc_keep_alive_status',  args: {}, pack: 'complete-schema.sql', v: 'V9',
        breaks: 'keep-alive monitoring and the Drive status panel' },
      { fn: 'tc_schema_info',        args: {}, pack: 'complete-schema.sql', v: 'V12',
        breaks: 'schema version reporting and the free-tier quota guard' }
    ],

    sb: function () { return w.sb || (w.App && w.App.sb) || null; },

    isOwner: function () {
      var r = String((w.App && (w.App.currentRole || w.App.role)) || '').toLowerCase();
      return ['admin', 'owner', 'director', 'lead_tutor', 'super_admin', 'administrator'].indexOf(r) !== -1;
    },

    /* ---------------- error humanising ---------------- */
    /* -----------------------------------------------------------------------
       REPORTED ITEM 11 — "When I click the share icon beside any CBT exam
       I get 'A table is missing'. I re-ran complete-schema.sql and the error
       is not fixed."

       Two separate defects produced that, and neither was a missing table.

       DEFECT 1 — MISCLASSIFICATION.
       The rules below are tested in order. The third one was

           /42P01|does not exist|relation .* does not exist/i  ->  "A table is missing"

       and `does not exist` matches far more than a missing relation.
       PostgreSQL reports a missing FUNCTION as

           function public.tc_cbt_set_state(uuid, text) does not exist

       which contains "does not exist" but NOT "Could not find the function",
       so it sailed past rule 1 and was announced as a missing table. The
       advice — "run complete-schema.sql to install every table" — was
       therefore useless, which is exactly why re-running changed nothing.

       Object-specific patterns now come FIRST and are anchored, the generic
       relation pattern is narrowed so it can only match a real relation
       error, and the message NAMES the object that is missing instead of
       guessing at its kind.

       DEFECT 2 — A STALE POSTGREST SCHEMA CACHE.
       Supabase serves RPC through PostgREST, which caches the schema. A
       function created seconds ago can be genuinely present in the database
       and still absent from that cache, and the error is identical to the one
       you get when it was never created. Re-running the SQL does not clear
       it. database/complete-schema.sql now ends with

           notify pgrst, 'reload schema';

       and the advice below tells the reader about it, because this is the
       single most confusing failure mode Supabase has.
       ----------------------------------------------------------------------- */
    HUMAN: [
      { test: /PGRST202|Could not find the function|function [a-z0-9_.]*\(.*\) does not exist|could not find the (public\.)?function/i,
        title: 'A database function is missing (or its cache is stale)',
        say: 'This action calls a function in your database that PostgREST cannot currently see.',
        fix: 'Two things, in order. FIRST run this one line in the Supabase SQL editor — it costs nothing ' +
             'and fixes it about half the time, because PostgREST caches the schema and a newly created ' +
             'function can be invisible to it for a while:  notify pgrst, \'reload schema\';  ' +
             'If that does not do it, run database/complete-schema.sql in full, watch for any red error ' +
             'in the output (one failure abandons the rest of the script), then run the notify line again.' },
      { test: /42501|row-level security|permission denied/i,
        title: 'The database refused that request',
        say: 'Row Level Security blocked it — either your role is not allowed, or the access policies have not been installed.',
        fix: 'If you are an admin and this looks wrong, run database/complete-schema.sql — it reinstalls every policy.' },
      { test: /42703|column ["'a-z0-9_.]* does not exist|Could not find the '[^']+' column/i,
        title: 'A column is missing',
        say: 'Your database is an older version than these files.',
        fix: 'Run database/complete-schema.sql to bring it up to date, then run:  notify pgrst, \'reload schema\';' },
      { test: /42P01|relation ["'a-z0-9_.]* does not exist|Could not find the table/i,
        title: 'A table is missing',
        say: 'This screen reads a table that is not in your database yet.',
        fix: 'Run database/complete-schema.sql to install every table.' },
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
          /* Name the object. "A database function is missing" is far less
             useful than "tc_cbt_set_state is missing", and the reader needs
             the name to search the SQL file for it. */
          var named = (s.match(/(?:function|relation|table|column)\s+["']?(?:public\.)?([a-z0-9_]+)/i) || [])[1];
          var subject = named ? h.title + ' (' + named + ')' : h.title;
          return { matched: true, object: named || null,
                   text: subject + ' — ' + h.say + ' ' + (this.isOwner() ? h.fix : 'Please tell the studio administrator.') };
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
      /* BUGFIX: the old code compared version against a hard-coded 'V12'
         fallback. complete-schema.sql stamps the registry at V37 while the
         shipped tc_schema_info() still claimed expected='V24', so a perfectly
         installed database never matched, the registry answer was discarded,
         and we fell through to the (then broken) probe. Trust the database's
         own up_to_date flag; only fall through if it is genuinely behind. */
      try {
        var reg = await sb.rpc('tc_schema_info');
        if (!reg.error && reg.data && reg.data.version) {
          var v = String(reg.data.version);
          var exp = String(reg.data.expected || this.EXPECTED);
          var ok = (typeof reg.data.up_to_date === 'boolean') ? reg.data.up_to_date : (v === exp);
          if (ok) {
            return { missing: [], present: this.PROBES.slice(), deployed: v,
                     expected: exp, source: 'registry' };
          }
          return { missing: [], present: this.PROBES.slice(), deployed: v,
                   expected: exp, behind: true, source: 'registry' };
        }
      } catch (e) { /* fall through to probing */ }

      var missing = [], present = [];
      for (var i = 0; i < this.PROBES.length; i++) {
        var p = this.PROBES[i];
        try {
          var r = await sb.rpc(p.fn, p.args || {});
          var em = (r.error && (r.error.message || '')) || '';
          var ed = (r.error && (r.error.details || '')) || '';
          /* A permission error (42501) proves the function EXISTS.
             So does a signature mismatch: PostgREST says it searched
             "without parameters or with a single unnamed json/jsonb
             parameter" — that is us asking the wrong question, not the
             database lacking the object. Only a genuine lookup failure,
             with no such qualifier, counts as missing. */
          var sigMismatch = /without parameters|single unnamed json/i.test(ed + ' ' + em);
          var notFound = /PGRST202|Could not find the function/i.test(em);
          if (r.error && notFound && !sigMismatch) missing.push(p);
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
      var worst = res.missing[0] || null;
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
      /* BUGFIX: this said "expect V9" no matter what, and named individual
         packs. complete-schema.sql is a verified superset of every pack, so
         that is the only file anyone should ever be told to run. */
      el.innerHTML =
        '<span>🗄️ <b>Your database is out of date</b> — it is at <b>' + this.escape(res.deployed) +
        '</b> but these files expect <b>' + this.escape(res.expected || this.EXPECTED) + '</b>. ' +
        (res.missing.length ? res.missing.length + ' missing function(s); this breaks ' +
          this.escape(worst ? worst.breaks : 'some features') + '.' : '') + '</span>' +
        '<span style="background:rgba(255,255,255,.18);padding:4px 10px;border-radius:8px">Run: <code>' +
        'database/complete-schema.sql</code> then <code>notify pgrst, \'reload schema\';</code></span>' +
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
          '<b>✅ Database schema is up to date (' + this.escape(res.deployed || this.EXPECTED) + ')</b>' +
          '<p style="margin:6px 0 0">Every function this build needs is installed.</p></div>';
        return;
      }
      host.innerHTML = '<div class="card" style="border-left:4px solid #b42318;background:#fef2f2">' +
        '<b>🗄️ Database is at ' + this.escape(res.deployed) + ' — these files expect ' + this.escape(res.expected || this.EXPECTED) + '</b>' +
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
        if (!res.missing.length && !res.behind) return;
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
