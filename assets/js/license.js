/* ====================================================================
   license.js — Tutoring Connect: one-time vs subscription
   --------------------------------------------------------------------
   V17 REWRITE. What was wrong with the previous version:

     Enforcement was ENTIRELY COSMETIC. This file evaluated the licence in
     the browser from a value it read out of config.js, then appended a
     yellow bar and a modal <div>. That was the whole of the "lock". Any
     user could press F12 and delete #tc-license-lock, or run
     License.paint = () => {}, or block this script in the network tab,
     and then carry on writing to an expired studio for ever.

   What changed:

     * The DATABASE is now the authority. tc_license_status() computes the
       state server-side and tc_license_writable() is enforced by a trigger
       on 27 operational tables. Deleting this script no longer buys you
       anything: PostgreSQL refuses the write regardless.
     * This file's job is now HONEST COMMUNICATION, not enforcement. It
       explains what the server has already decided, so the user gets a
       clear message instead of a raw Postgres error.
     * Reads are never blocked, so the lock overlay never covers a page the
       user is only reading. "Your data is untouched" is now literally
       true: an expired studio stays readable, printable and exportable.
     * A one-time / lifetime licence is never nagged and never locked.

   Backwards compatible: License.evaluate(), License.apply(), License.paint()
   and License._state all still exist with the same shapes, so anything that
   already called them keeps working.
   ==================================================================== */
(function () {
  'use strict';

  var License = {
    _state: null,
    _server: null,

    /* Local fallback evaluation. Used only when the database cannot be
       reached (offline, or the schema has not been installed yet). It is
       advisory — it can warn, but it can no longer pretend to enforce. */
    evaluate: function (lic) {
      lic = lic || (window.PRACTICE && window.PRACTICE.license) || { model: 'lifetime', status: 'active' };
      if (!lic || lic.model === 'lifetime' || lic.model === 'one_time' ||
          lic.model === 'perpetual' || !lic.expires_on) {
        return { state: 'ok', model: lic.model || 'lifetime', writable: true, source: 'local' };
      }
      if (String(lic.status || '').toLowerCase() === 'suspended') {
        return { state: 'locked', daysLeft: -999, model: 'subscription',
                 reason: 'suspended', writable: false, source: 'local' };
      }
      var exp   = new Date(lic.expires_on);
      var grace = Number(lic.grace_days || 7);
      var left  = Math.ceil((exp - new Date()) / 86400000);
      if (left >= 0) {
        return { state: left <= 30 ? 'remind' : 'ok', daysLeft: left,
                 model: 'subscription', exp: exp, writable: true, source: 'local' };
      }
      if (Math.abs(left) <= grace) {
        return { state: 'grace', daysLeft: left, model: 'subscription',
                 exp: exp, writable: true, source: 'local' };
      }
      return { state: 'locked', daysLeft: left, model: 'subscription',
               exp: exp, writable: false, source: 'local' };
    },

    /* Ask the server. This is the authoritative path. */
    loadServer: async function () {
      var sb = window.sb || window.SB || (window.App && window.App.sb);
      if (!sb) return null;
      try {
        var res = await sb.rpc('tc_license_status');
        if (res.error || !res.data) return null;
        this._server = res.data;
        return res.data;
      } catch (e) { return null; }
    },

    /* Legacy shape retained so older callers do not break. */
    loadRemote: async function () {
      var p = window.PRACTICE || {};
      var lic = Object.assign({}, p.license || {});
      var sb = window.sb || window.SB || (window.App && window.App.sb);
      try {
        if (sb) {
          var r = await sb.from('site_license').select('*').eq('id', 1).maybeSingle();
          if (r && r.data) Object.assign(lic, r.data);
        }
      } catch (e) {}
      try {
        var url = lic.registry_url || (p.license && p.license.registryUrl);
        if (url) {
          var f = await fetch(url, { cache: 'no-store' });
          if (f.ok) {
            var j = await f.json();
            var row = (j.sites && (j.sites[p.shortName] || j.sites[p.name])) || j;
            if (row && (row.model || row.expires_on)) Object.assign(lic, row);
          }
        }
      } catch (e) {}
      return lic;
    },

    /* Map the server payload onto the state shape the UI already speaks. */
    _fromServer: function (d) {
      var map = { ok: 'ok', remind: 'remind', grace: 'grace',
                  expired: 'locked', suspended: 'locked' };
      return {
        state: map[d.state] || 'ok',
        model: d.model,
        tier: d.tier,
        plan: d.plan,
        enforcement: d.enforcement,
        daysLeft: d.days_left,
        exp: d.expires_on ? new Date(d.expires_on) : null,
        writable: d.writable !== false,
        seats: d.seats || null,
        reason: d.status === 'suspended' ? 'suspended' : null,
        renewUrl: d.renew_url,
        lockMessage: d.lock_message,
        source: 'server'
      };
    },

    _renewUrl: function (r) {
      return (r && r.renewUrl) ||
        (window.PRACTICE && PRACTICE.license && PRACTICE.license.renew_url) ||
        'https://wa.me/2348100866322?text=Renew%20Tutoring%20Connect';
    },

    paint: function (r) {
      // Clean up any previous render so repeated apply() calls do not stack.
      var old = document.getElementById('tc-license-lock');
      var overLimit = r && r.seats && r.seats.over_limit;

      if (!r || (r.state === 'ok' && !overLimit)) {
        var bar0 = document.getElementById('tc-license-bar');
        if (bar0) bar0.remove();
        if (old) old.remove();
        return;
      }

      var bar = document.getElementById('tc-license-bar');
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'tc-license-bar';
        bar.style.cssText = 'position:sticky;top:0;z-index:90;padding:9px 14px;' +
          'background:#fde68a;color:#78350f;font-weight:700;text-align:center;' +
          'font-size:.86rem;line-height:1.45';
        document.body.prepend(bar);
      }
      var renew = this._renewUrl(r);
      var link = ' <a href="' + renew + '" target="_blank" rel="noopener" ' +
                 'style="color:inherit;text-decoration:underline">Renew with HMG</a>';

      if (r.state === 'locked') {
        bar.style.background = '#fecaca';
        bar.style.color = '#7f1d1d';
        bar.innerHTML = (r.reason === 'suspended'
          ? 'This studio\u2019s licence is suspended.'
          : 'Subscription expired.') +
          ' Your data is safe \u2014 you can still read, print and export everything. ' +
          'Only new changes are paused.' + link;

        /* The overlay appears ONLY where the server is genuinely blocking
           writes. If enforcement is 'banner', the studio is still fully
           usable and throwing a modal over it would be a lie. */
        if (r.writable === false && r.enforcement === 'lock') {
          if (!old) {
            var lock = document.createElement('div');
            lock.id = 'tc-license-lock';
            lock.className = 'modal-backdrop show';
            lock.innerHTML =
              '<div class="modal" style="max-width:520px"><div class="modal-body">' +
                '<h2 style="margin-top:0">Renewal required</h2>' +
                '<p>' + (r.lockMessage ||
                  'This studio\u2019s subscription has expired and its licence is set to ' +
                  'enforce. <b>Your data is untouched.</b> Everything can still be read, ' +
                  'printed and exported \u2014 only new changes are paused.') + '</p>' +
                '<p class="muted" style="font-size:.85rem">Enforcement happens in the ' +
                'database, not in this page, so closing this box will not restore writing.</p>' +
                '<p><a class="btn btn-primary" href="' + renew + '" target="_blank" ' +
                'rel="noopener">Renew with HMG</a> ' +
                '<a class="btn btn-outline" href="license.html">Open the License page</a></p>' +
              '</div></div>';
            document.body.appendChild(lock);
          }
        } else if (old) { old.remove(); }

      } else if (r.state === 'grace') {
        if (old) old.remove();
        bar.style.background = '#fed7aa';
        bar.style.color = '#7c2d12';
        bar.innerHTML = 'Grace period \u2014 the subscription expired ' +
          Math.abs(r.daysLeft) + ' day(s) ago. The studio still works, but it ' +
          'will stop accepting changes when the grace period ends.' + link;

      } else if (r.state === 'remind') {
        if (old) old.remove();
        bar.innerHTML = 'Subscription reminder: ' + r.daysLeft +
          ' day(s) remaining on the ' + (r.plan || r.tier || 'current') + ' plan.' + link;

      } else if (overLimit) {
        if (old) old.remove();
        var s = r.seats;
        bar.innerHTML = 'Seat limit exceeded \u2014 ' +
          (s.learners_cap != null ? s.learners_used + '/' + s.learners_cap + ' learners ' : '') +
          (s.tutors_cap   != null ? s.tutors_used   + '/' + s.tutors_cap   + ' tutors '   : '') +
          '\u2014 please upgrade the plan.' + link;
      }
    },

    apply: async function () {
      var d = await this.loadServer();
      var r;
      if (d) {
        r = this._fromServer(d);
      } else {
        // No database yet, or offline. Fall back to advisory local logic.
        r = this.evaluate(await this.loadRemote());
      }
      this._state = r;
      this.paint(r);
      return r;
    },

    /* Convenience for other scripts: "may I offer a Save button?" */
    canWrite: function () {
      return !this._state || this._state.writable !== false;
    }
  };

  window.License = License;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { License.apply(); });
  } else {
    License.apply();
  }
  setInterval(function () { License.apply(); }, 15 * 60 * 1000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) License.apply();
  });
})();
