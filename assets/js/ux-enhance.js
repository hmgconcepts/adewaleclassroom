/* ============================================================================
   ux-enhance.js — Tutoring Connect V13
   ----------------------------------------------------------------------------
   Cross-cutting usability fixes that would otherwise have to be repeated in
   every one of the 128 pages. Loaded everywhere, entirely defensive, and it
   never fights a page that already implements one of these itself.

   1. PASSWORD SHOW / HIDE  (reported: no way to reveal a typed password)
      Every input[type=password] gets an eye toggle — sign-in, sign-up,
      password reset and change-password. Mistyped passwords on a phone
      keyboard are the single most common reason a parent cannot get in.

   2. AUTOMATIC DROPDOWNS INSTEAD OF FREE TEXT
      Anything already created in the studio (subjects, tutors, learners,
      parents, engagements, terms, rooms) should be PICKED, never re-typed.
      Any input carrying data-lookup="<table>:<label-column>" is upgraded into
      a native datalist fed from the database, so spelling can never drift
      while still allowing a new value to be typed when genuinely needed.

   3. AUTO-FILL OF THE OBVIOUS
      Date fields default to today, time fields to the next half hour, and
      "my" fields (tutor = me) preselect the signed-in user. Nothing that can
      be inferred should have to be typed.

   4. UNSAVED-CHANGES GUARD
      Warns before leaving a dirty form, so a half-finished lesson note is
      never lost to a stray click.

   Free, no dependencies.
   ========================================================================== */
(function (w, d) {
  'use strict';

  var UX = {
    /* ---------------- 1. password reveal ---------------- */
    passwordToggles: function (root) {
      var scope = root || d;
      var inputs = scope.querySelectorAll('input[type="password"]:not([data-pw-toggle])');
      Array.prototype.forEach.call(inputs, function (inp) {
        inp.dataset.pwToggle = '1';
        // Wrap so the button can sit inside the field without layout surprises.
        var wrap = d.createElement('div');
        wrap.style.cssText = 'position:relative;display:block';
        inp.parentNode.insertBefore(wrap, inp);
        wrap.appendChild(inp);
        inp.style.paddingRight = '44px';

        var btn = d.createElement('button');
        btn.type = 'button';
        btn.className = 'tc-pw-eye';
        btn.setAttribute('aria-label', 'Show password');
        btn.setAttribute('title', 'Show password');
        btn.setAttribute('tabindex', '0');
        btn.textContent = '👁';
        btn.style.cssText =
          'position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;' +
          'border:none;cursor:pointer;font-size:1.05rem;line-height:1;padding:6px 8px;' +
          'border-radius:8px;color:#566276';
        btn.onclick = function () {
          var show = inp.type === 'password';
          inp.type = show ? 'text' : 'password';
          btn.textContent = show ? '🙈' : '👁';
          var label = show ? 'Hide password' : 'Show password';
          btn.setAttribute('aria-label', label);
          btn.setAttribute('title', label);
          try { inp.focus(); } catch (e) {}
        };
        wrap.appendChild(btn);
      });
    },

    /* ---------------- 2. lookup -> datalist ---------------- */
    LOOKUPS: {
      subject:    ['subjects', 'name'],
      tutor:      ['tutors', 'full_name'],
      learner:    ['learners', 'full_name'],
      parent:     ['parents', 'full_name'],
      engagement: ['engagements', 'name'],
      room:       ['rooms', 'name'],
      term:       ['sow_terms', 'term_label']
    },
    _cache: {},

    fetchList: async function (table, col) {
      var key = table + ':' + col;
      if (this._cache[key]) return this._cache[key];
      var sb = w.sb || (w.App && w.App.sb);
      if (!sb) return [];
      try {
        var r = await sb.from(table).select('id,' + col).order(col).limit(500);
        if (r.error) return [];
        this._cache[key] = (r.data || []).map(function (x) { return x[col]; }).filter(Boolean);
        return this._cache[key];
      } catch (e) { return []; }
    },

    datalists: async function (root) {
      var scope = root || d;
      var nodes = scope.querySelectorAll('input[data-lookup]:not([data-lookup-done])');
      for (var i = 0; i < nodes.length; i++) {
        var inp = nodes[i];
        inp.dataset.lookupDone = '1';
        var spec = String(inp.dataset.lookup || '');
        var table, col;
        if (spec.indexOf(':') !== -1) { table = spec.split(':')[0]; col = spec.split(':')[1]; }
        else if (this.LOOKUPS[spec]) { table = this.LOOKUPS[spec][0]; col = this.LOOKUPS[spec][1]; }
        else continue;

        var values = await this.fetchList(table, col);
        if (!values.length) continue;
        var id = 'dl-' + table + '-' + col;
        if (!d.getElementById(id)) {
          var dl = d.createElement('datalist');
          dl.id = id;
          dl.innerHTML = values.map(function (v) {
            return '<option value="' + String(v).replace(/"/g, '&quot;') + '">';
          }).join('');
          d.body.appendChild(dl);
        }
        inp.setAttribute('list', id);
        inp.setAttribute('autocomplete', 'off');
        if (!inp.placeholder) inp.placeholder = 'Pick an existing ' + spec + ', or type a new one';
      }
    },

    /* ---------------- 3. sensible defaults ---------------- */
    autofill: function (root) {
      var scope = root || d;
      var today = new Date();
      var iso = today.toISOString().slice(0, 10);
      // next half hour, local
      var t = new Date(today.getTime() + (30 - (today.getMinutes() % 30)) * 60000);
      var hhmm = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');

      Array.prototype.forEach.call(scope.querySelectorAll('input[data-default="today"]'), function (el) {
        if (!el.value) el.value = iso;
      });
      Array.prototype.forEach.call(scope.querySelectorAll('input[data-default="now"]'), function (el) {
        if (!el.value) el.value = (el.type === 'time') ? hhmm : iso + 'T' + hhmm;
      });
      // "me" — the signed-in user's own name/id
      var me = w.TC_PROFILE || {};
      Array.prototype.forEach.call(scope.querySelectorAll('[data-default="me"]'), function (el) {
        if (!el.value) el.value = me.full_name || '';
      });
      Array.prototype.forEach.call(scope.querySelectorAll('[data-default="me-id"]'), function (el) {
        if (!el.value) el.value = me.id || '';
      });
      // A single-option select should simply be chosen.
      Array.prototype.forEach.call(scope.querySelectorAll('select'), function (sel) {
        var real = Array.prototype.filter.call(sel.options, function (o) { return o.value !== ''; });
        if (!sel.value && real.length === 1) sel.value = real[0].value;
      });
    },

    /* ---------------- 4. unsaved-changes guard ---------------- */
    dirtyGuard: function () {
      if (this._dirtyBound) return;
      this._dirtyBound = true;
      var dirty = false;
      d.addEventListener('input', function (e) {
        if (e.target.closest && e.target.closest('form')) dirty = true;
      }, true);
      d.addEventListener('submit', function () { dirty = false; }, true);
      w.addEventListener('beforeunload', function (e) {
        if (!dirty) return;
        e.preventDefault();
        e.returnValue = '';
      });
      // A deliberate sign-out or nav click is not an accident.
      d.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('[data-signout],a.app-nav-link,.app-nav a')) dirty = false;
      }, true);
    },

    refresh: function (root) {
      try { this.passwordToggles(root); } catch (e) {}
      try { this.datalists(root); } catch (e) {}
      try { this.autofill(root); } catch (e) {}
    },

    init: function () {
      this.refresh(d);
      this.dirtyGuard();
      // Modals inject their fields after load, so watch for new nodes.
      try {
        var self = this;
        var mo = new w.MutationObserver(function (muts) {
          for (var i = 0; i < muts.length; i++) {
            if (muts[i].addedNodes && muts[i].addedNodes.length) {
              clearTimeout(self._t);
              self._t = setTimeout(function () { self.refresh(d); }, 120);
              break;
            }
          }
        });
        mo.observe(d.body, { childList: true, subtree: true });
      } catch (e) {}
    }
  };

  w.UXEnhance = UX;
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { UX.init(); });
  else UX.init();
})(window, document);

/* ============================================================================
   ITEM 5 (V22) — AUTO-DROPDOWNS FOR ANYTHING ALREADY IN THE DATABASE
   ----------------------------------------------------------------------------
   "When class, term, session, subject, student, tutor etc. are created, and
   are needed on other pages, they should not be typed but selected."

   crud.js already covers the 125 workbench pages, via `ref` (stores an id)
   and `lookup` (stores the text). What it cannot reach is a hand-written
   form on a bespoke page — and every new bespoke page can reintroduce the
   problem.

   This closes that gap structurally. Any text input whose id or name names a
   known entity is upgraded IN PLACE into a datalist-backed picker fed from
   the live database. The user can still type a genuinely new value, so
   nothing is ever blocked; they simply no longer HAVE to.

   It is idempotent, runs after the shell has booted, and re-runs when new
   markup appears, so a form built by JavaScript is upgraded too.
   ========================================================================== */
(function (w, d) {
  'use strict';

  // entity -> [table, column]. Order matters: the first pattern that matches wins.
  var MAP = [
    [/\b(learner|student)s?_?(name|no|id)?\b/i, ['learners', 'full_name']],
    [/\b(tutor|teacher)s?_?(name|id)?\b/i,      ['tutors', 'full_name']],
    [/\b(parent|guardian)s?_?(name|id)?\b/i,    ['parents', 'full_name']],
    [/\bsubjects?\b/i,                          ['subjects', 'name']],
    [/\b(engagement|class|group)s?\b/i,         ['engagements', 'name']],
    [/\b(term|session)s?\b/i,                   ['sow_terms', 'term_label']],
    [/\broom s?\b/i,                            ['rooms', 'name']],
    [/\bexams?\b/i,                             ['cbt_exams', 'title']]
  ];

  var cache = {};

  async function values(table, col) {
    var key = table + '.' + col;
    if (cache[key]) return cache[key];
    var sb = w.sb || w.SB || (w.App && w.App.sb);
    if (!sb) return [];
    try {
      var r = await sb.from(table).select(col).limit(500);
      if (r.error) { cache[key] = []; return []; }
      var seen = {}, out = [];
      (r.data || []).forEach(function (row) {
        var v = row[col];
        if (v == null || String(v).trim() === '' || seen[v]) return;
        seen[v] = 1; out.push(String(v));
      });
      out.sort(function (a, b) { return a.localeCompare(b); });
      cache[key] = out;
      return out;
    } catch (e) { cache[key] = []; return []; }
  }

  async function upgrade(el) {
    if (!el || el.dataset.tcPicker === '1') return;
    if (el.tagName !== 'INPUT') return;
    var t = (el.type || 'text').toLowerCase();
    if (['text', 'search', ''].indexOf(t) === -1) return;
    if (el.getAttribute('list')) { el.dataset.tcPicker = '1'; return; }   // already has one

    var hay = ((el.id || '') + ' ' + (el.name || '') + ' ' +
               (el.getAttribute('placeholder') || '')).replace(/[-_]/g, ' ');
    var found = null;
    for (var i = 0; i < MAP.length; i++) {
      if (MAP[i][0].test(hay)) { found = MAP[i][1]; break; }
    }
    if (!found) return;

    el.dataset.tcPicker = '1';
    var list = await values(found[0], found[1]);
    if (!list.length) return;

    var id = 'tcpick-' + found[0] + '-' + Math.random().toString(36).slice(2, 7);
    var dl = d.createElement('datalist');
    dl.id = id;
    dl.innerHTML = list.map(function (v) {
      return '<option value="' + String(v).replace(/"/g, '&quot;') + '">';
    }).join('');
    el.parentNode.insertBefore(dl, el.nextSibling);
    el.setAttribute('list', id);
    el.setAttribute('autocomplete', 'off');

    if (!el.placeholder || /type|enter/i.test(el.placeholder)) {
      el.placeholder = 'Choose from your ' + found[0].replace(/_/g, ' ') + ', or type a new one';
    }
    // A quiet cue that this field now offers choices.
    if (!el.title) el.title = list.length + ' existing ' + found[0].replace(/_/g, ' ') + ' to choose from';
  }

  function sweep(root) {
    try {
      var els = (root || d).querySelectorAll('input:not([data-tc-picker])');
      for (var i = 0; i < els.length; i++) upgrade(els[i]);
    } catch (e) {}
  }

  function start() {
    setTimeout(function () { sweep(d); }, 900);   // after the shell has a client
    if (w.MutationObserver) {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          for (var j = 0; j < muts[i].addedNodes.length; j++) {
            var n = muts[i].addedNodes[j];
            if (n.nodeType === 1) sweep(n);
          }
        }
      }).observe(d.documentElement, { childList: true, subtree: true });
    }
    w.TCPickers = { sweep: sweep, _values: values, MAP: MAP };
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();
})(window, document);
