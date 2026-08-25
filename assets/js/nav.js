/* ============================================================================
   nav.js — the ONE thing that draws the navigation pane
   ----------------------------------------------------------------------------
   THE THREE DEFECTS THIS FILE EXISTS TO KILL

   (report items 3, 5 and 7)

   1. "For some roles the pages on the navigation pane keep changing when the
       pane is accessed. Some pages are either removed or added."

      Two independent systems were mutating the same 126 <a> elements:

        App.applyRoleNav()  decided with data-role-allow + moduleAllowedForRole
                            + a localStorage override map, and SET display=''
                            on everything it allowed.
        RBAC.apply()        decided with a completely different matrix, and
                            only ever SET display='none'.

      They did not agree, and neither knew the other existed. App runs on the
      cached session, then again when Supabase resolves; RBAC runs on the
      tc:role event and again from a 500 ms poll. Whichever fired last won.
      So the same account, on the same page, saw a different menu depending on
      network timing. That is exactly "pages are either removed or added
      whenever the navigation pane is accessed".

   2. "Even when any public page is selected, the pages that should not be for
       a role's navigation pane appear."

      App.currentRole starts as the literal string 'guest'. RBAC deliberately
      refuses to act on an unknown role (acting on it was the V23 bug that
      locked administrators out of their own studio). Between first paint and
      session resolution — longer on a public page, which often has no session
      call to wait on at all — NOTHING was filtering the pane, so every visitor
      briefly saw all 126 administrator links. On a slow connection "briefly"
      is several seconds.

   3. "The icons or pages on the navigation pane are scattered, unordered."

      ensureEssentialNav() appended missing items with nav.appendChild, which
      puts them below the LAST section heading regardless of where they belong.
      normalizeNavOrder() then re-sorted links in place on every call.

   THE FIX

   Stop patching a shared DOM from several places. Describe the menu once
   (assets/js/nav-model.js, generated) and REBUILD the pane from that model.

     * Rebuilding is idempotent. Ten renders produce byte-identical markup, so
       the pane cannot drift, reorder, gain or lose an item.
     * There is exactly ONE decision function, TCNav.level(). App and RBAC both
       defer to it.
     * The resolved role is cached in localStorage, so the first paint of the
       next page already knows who you are. No admin-menu flash.
     * Before any role is known at all, only items marked 'public' are drawn.
       Failing closed on the menu is safe: the worst case is that a signed-in
       user waits 200 ms for their full menu. The old failure mode leaked the
       payroll link to a child.

   WHAT THIS FILE DOES NOT DO

   It is not a security boundary. Row-level security in PostgreSQL is. Someone
   who edits this file in their browser gains a link, not data.
   ========================================================================== */
(function (w) {
  'use strict';

  var d = w.document;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Roles this module understands, and everything people actually type. */
  function normRole(r) {
    r = String(r || '').trim().toLowerCase();
    if (['owner', 'administrator', 'super_admin', 'superadmin', 'super admin',
         'super', 'proprietor'].indexOf(r) > -1) return 'admin';
    if (['teacher', 'instructor', 'facilitator', 'staff'].indexOf(r) > -1) return 'tutor';
    if (['learner', 'pupil', 'child'].indexOf(r) > -1) return 'student';
    if (['guardian', 'father', 'mother'].indexOf(r) > -1) return 'parent';
    return r;
  }

  var REAL = ['admin', 'tutor', 'parent', 'student'];
  function isKnown(r) { return REAL.indexOf(normRole(r)) > -1; }

  var ROLE_KEY = 'tc-role';          // cached so the next page paints correctly
  var SHOWMAP_KEY = 'tc-nav-show-map';   // owner overrides from the dashboard
  var COLLAPSE_KEY = 'tc-nav-collapsed'; // which sections the user folded away

  var TCNav = {

    MODEL: function () { return w.TC_NAV_MODEL || []; },

    /* ---------------------------------------------------------------------
       The role we should draw for RIGHT NOW.

       Order of preference:
         1. an explicitly passed role
         2. the role the app has resolved this page load
         3. the role we cached last time (this is what removes the flash)
         4. nothing — draw the public menu only
       --------------------------------------------------------------------- */
    role: function (explicit) {
      var r = normRole(explicit);
      if (isKnown(r)) return r;
      r = normRole(w.App && (w.App.currentRole || w.App.role));
      if (isKnown(r)) return r;
      try {
        r = normRole(w.localStorage.getItem(ROLE_KEY));
        if (isKnown(r)) return r;
      } catch (e) {}
      return null;
    },

    rememberRole: function (r) {
      r = normRole(r);
      if (!isKnown(r)) return;
      try { w.localStorage.setItem(ROLE_KEY, r); } catch (e) {}
    },

    forgetRole: function () {
      try { w.localStorage.removeItem(ROLE_KEY); } catch (e) {}
    },

    /* ---------------------------------------------------------------------
       THE SINGLE ACCESS DECISION.

       Returns 'write' | 'read' | 'none' for one menu item.

       This delegates to RBAC.level() when rbac.js is present, because that is
       where the page-by-page matrix lives and there must not be a second copy
       of it. When rbac.js has not loaded yet we fall back to the audience hint
       baked into the model, which is deliberately coarse and deliberately
       conservative.
       --------------------------------------------------------------------- */
    level: function (item, role) {
      // Administrators and the owner see everything, always. This is the
      // guarantee the report asked for in item 21: "Admin has full access to
      // everything without restrictions."
      if (role === 'admin') return 'write';

      if (!role) {
        // No role resolved. Draw only what is safe for a stranger.
        return item.aud === 'public' ? 'write' : 'none';
      }

      if (w.RBAC && typeof w.RBAC.level === 'function') {
        var lvl = w.RBAC.level(item.href, role);
        if (lvl === 'none') return 'none';
        // Owner override from the dashboard's Page Access manager can hide a
        // page from the pane without changing the matrix.
        if (!this._shownByOwner(item.id, role)) return 'none';
        return lvl;
      }

      // rbac.js absent — fall back to the coarse hint.
      if (item.aud === 'public' || item.aud === 'user') return 'write';
      if (item.aud === 'staff') return role === 'tutor' ? 'write' : 'none';
      return 'none';                                  // 'admin'
    },

    /* The owner's per-role show/hide overrides, set on the dashboard. */
    _shownByOwner: function (id, role) {
      var map;
      try { map = JSON.parse(w.localStorage.getItem(SHOWMAP_KEY) || '{}'); }
      catch (e) { return true; }
      var list = map[id];
      if (!Array.isArray(list)) return true;          // no override recorded
      var keys = role === 'tutor'  ? ['staff', 'tutor']
               : role === 'parent' ? ['parent']
               : role === 'student'? ['student', 'learner'] : [];
      for (var i = 0; i < keys.length; i++) if (list.indexOf(keys[i]) > -1) return true;
      return false;
    },

    /* Which section headings the user has folded away. */
    _collapsed: function () {
      try { return JSON.parse(w.localStorage.getItem(COLLAPSE_KEY) || '[]') || []; }
      catch (e) { return []; }
    },
    _setCollapsed: function (list) {
      try { w.localStorage.setItem(COLLAPSE_KEY, JSON.stringify(list)); } catch (e) {}
    },

    /* The page we are on, as a module id. */
    here: function () {
      var f = (w.location.pathname.split('/').pop() || 'index.html').split('?')[0];
      return f.toLowerCase();
    },

    /* =====================================================================
       RENDER — the whole pane, from the model, in one pass.

       Everything the pane contains is produced here. Nothing else may add,
       move, hide or reorder a link; if it needs to, it calls render() again.
       ===================================================================== */
    render: function (explicitRole) {
      var nav = d.querySelector('.app-nav');
      if (!nav || !this.MODEL().length) return;

      var role = this.role(explicitRole);
      var here = this.here();
      var collapsed = this._collapsed();
      var self = this;

      // Preserve what the user had typed into the search box across a
      // re-render, so resolving the session does not wipe a search in
      // progress.
      var prevQuery = '';
      var existing = d.getElementById('nav-search');
      if (existing) prevQuery = existing.value || '';

      var html = [];

      /* ---- Search box, always first. ---------------------------------- */
      html.push(
        '<div id="nav-search-box" class="nav-search-box" role="search">' +
          '<div style="position:relative">' +
            '<input id="nav-search" type="search" placeholder="🔎 Search pages, modules, actions…" ' +
              'autocomplete="off" spellcheck="false" enterkeyhint="search" ' +
              'aria-label="Search every page in the menu" aria-controls="app-nav" ' +
              'style="width:100%;padding:9px 34px 9px 12px;border:1px solid var(--gray-300,#cbd5e1);' +
              'border-radius:10px;font-size:.88rem;background:#fff;color:#0f172a;box-sizing:border-box">' +
            '<button id="nav-search-clear" type="button" title="Clear search" aria-label="Clear search" ' +
              'style="position:absolute;right:6px;top:50%;transform:translateY(-50%);border:0;' +
              'background:#e2e8f0;color:#0f172a;border-radius:999px;width:22px;height:22px;' +
              'cursor:pointer;font-size:.8rem;display:none;line-height:1">✕</button>' +
          '</div>' +
          '<div id="nav-search-meta" style="display:none;font-size:.7rem;color:#64748b;padding:2px 2px 0"></div>' +
          '<div id="nav-search-empty" style="display:none;font-size:.75rem;' +
            'color:#64748b;padding:6px 2px">No page matches. Try another word (e.g. quiz, invoice, blog).</div>' +
        '</div>');

      /* ---- Sections and their links. ---------------------------------- */
      var drawn = 0;
      this.MODEL().forEach(function (sect) {
        var visible = sect.items.filter(function (it) {
          return self.level(it, role) !== 'none';
        });
        if (!visible.length) return;                  // never draw an empty heading

        var isFolded = collapsed.indexOf(sect.title) > -1;

        html.push(
          '<button type="button" class="nav-section-title" data-nav-section="' + esc(sect.title) + '" ' +
            'aria-expanded="' + (isFolded ? 'false' : 'true') + '">' +
            '<span class="nav-section-icon">' + sect.icon + '</span>' +
            '<span class="nav-section-label">' + esc(sect.title) + '</span>' +
            '<span class="nav-section-count">' + visible.length + '</span>' +
            '<span class="nav-section-caret">' + (isFolded ? '▸' : '▾') + '</span>' +
          '</button>');

        visible.forEach(function (it) {
          var lvl = self.level(it, role);
          var active = it.href.toLowerCase() === here;
          drawn++;
          html.push(
            '<a href="' + esc(it.href) + '" ' +
              'class="app-nav-link' + (active ? ' active' : '') + '" ' +
              'data-module-id="' + esc(it.id) + '" ' +
              'data-module="' + esc(it.id) + '" ' +
              'data-nav-section="' + esc(sect.title) + '" ' +
              'data-nav-level="' + lvl + '" ' +
              'data-role-allow="' + (it.aud === 'admin' ? 'admin'
                                   : it.aud === 'staff' ? 'admin tutor staff' : 'any') + '"' +
              (isFolded ? ' style="display:none"' : '') +
              (active ? ' aria-current="page"' : '') +
              (lvl === 'read' ? ' title="You can view this page"' : '') + '>' +
              '<span class="app-nav-icon">' + it.icon + '</span>' +
              '<span class="app-nav-label">' + esc(it.label) + '</span>' +
              (lvl === 'read' ? '<span class="app-nav-ro" aria-hidden="true">👁</span>' : '') +
            '</a>');
        });
      });

      /* ---- Nothing at all? Then something is wrong with the role, not with
              the person. Give them a way out rather than a blank column. --- */
      if (!drawn) {
        html.push('<a href="dashboard.html" class="app-nav-link" data-module-id="dashboard">' +
          '<span class="app-nav-icon">🏠</span><span class="app-nav-label">Dashboard</span></a>');
        html.push('<a href="login.html" class="app-nav-link" data-module-id="login">' +
          '<span class="app-nav-icon">🔑</span><span class="app-nav-label">Sign in</span></a>');
      }

      nav.innerHTML = html.join('');
      nav.dataset.navRole = role || 'unresolved';
      nav.dataset.navCount = String(drawn);
      d.body.dataset.navReady = '1';

      this._wire(nav, prevQuery);
      this._style();
    },

    /* ---- Event wiring for the freshly rendered pane. ------------------- */
    _wire: function (nav, prevQuery) {
      var self = this;
      var inp = nav.querySelector('#nav-search');
      var clr = nav.querySelector('#nav-search-clear');
      var empty = nav.querySelector('#nav-search-empty');

      /* Section fold / unfold. Persisted, so a tutor who never uses Money can
         put it away and keep it away. */
      nav.querySelectorAll('[data-nav-section]').forEach(function (el) {
        if (el.tagName !== 'BUTTON') return;
        el.addEventListener('click', function () {
          var title = el.getAttribute('data-nav-section');
          var list = self._collapsed();
          var i = list.indexOf(title);
          if (i > -1) list.splice(i, 1); else list.push(title);
          self._setCollapsed(list);
          self.render();                              // one code path, always
        });
      });

      if (!inp) return;

      /* Search — robust, all-inclusive, self-contained.

         Matches every visible nav link on:
           • label text (icon stripped)
           • module id (dashes/underscores → spaces)
           • href / filename
           • section title
           • synonym dictionary (quiz→practice/cbt, money→invoices, …)
         Every typed word must match somewhere (order-free). Folded sections
         still yield matches while a query is active. Headings hide when
         empty. Enter opens the first hit; Esc clears. */
      var SYNONYMS = {
        quiz: 'practice cbt exam test paper assessment graded self review',
        quizzes: 'practice cbt exam test paper',
        cbt: 'practice quiz exam multi results prompts review paper',
        test: 'practice cbt quiz exam',
        exam: 'cbt practice quiz exam-register exam-links exam-targets',
        money: 'finance invoices payments fees packages wallet payroll scholarships',
        pay: 'payments invoices payment-plans wallet fees packages',
        invoice: 'invoices payments fees packages finance',
        bill: 'invoices payments fees packages',
        class: 'sessions bookings classwork class-links free-classes calendar attendance',
        lesson: 'sessions bookings lesson-plans sow curriculum',
        student: 'learners learner-360 my-children directory idcards',
        child: 'learners my-children learner-360 parents family-links',
        parent: 'parents family-links my-children',
        teacher: 'tutors tutors payroll leave',
        tutor: 'tutors payroll leave availability',
        group: 'groups group-insights engagements forum',
        book: 'bookings calendar public-book library',
        booking: 'bookings calendar public-book availability',
        link: 'application-links class-links exam-links family-links',
        register: 'class-register free-register exam-register apply',
        signup: 'apply free-register class-register',
        blog: 'blog blog-manage blog-post',
        post: 'blog blog-manage blog-post',
        doc: 'documents contracts policies',
        document: 'documents contracts',
        letter: 'documents contracts certificates',
        report: 'progress-reports analytics insights learner-360 cbt-results',
        score: 'scoresheet cbt-results mastery insights progress-reports',
        mark: 'scoresheet cbt-results cbt-marking mastery',
        risk: 'at-risk insights learner-360',
        health: 'platform-health diagnostics storage admin-data',
        backup: 'admin-data storage platform-health drive',
        drive: 'admin-data storage',
        setting: 'settings profile change-password license security-centre',
        security: 'security-centre settings change-password approvals',
        message: 'inbox messages notifications broadcasts announcements',
        chat: 'inbox messages forum',
        vote: 'voting polls surveys',
        poll: 'voting polls surveys',
        free: 'free-classes free-register',
        social: 'class-links application-links flyer blog',
        share: 'class-links application-links flyer',
        multi: 'cbt-multi practice',
        prompt: 'cbt-prompts practice',
        result: 'cbt-results scoresheet progress-reports',
        review: 'cbt-review practice scoresheet',
        paper: 'cbt-review practice cbt-results cbt-exam',
        help: 'feature-guide helpdesk hmg-ecosystem',
        hmg: 'hmg-ecosystem hmg-products developer feature-guide'
      };

      var norm = function (t) {
        return String(t || '')
          .replace(/[•·\u2022]/g, ' ')
          .replace(/[^a-z0-9\s_-]+/gi, ' ')
          .replace(/[_-]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim().toLowerCase();
      };

      var expand = function (q) {
        var words = norm(q).split(' ').filter(Boolean);
        var out = [];
        words.forEach(function (w) {
          out.push(w);
          if (SYNONYMS[w]) {
            SYNONYMS[w].split(' ').forEach(function (s) { out.push(s); });
          }
          // light stemming: quizzes→quiz, payments→payment, bookings→booking
          if (w.length > 4 && w.charAt(w.length - 1) === 's') out.push(w.slice(0, -1));
          if (w.length > 5 && w.slice(-3) === 'ies') out.push(w.slice(0, -3) + 'y');
          if (w.length > 6 && w.slice(-3) === 'ing') out.push(w.slice(0, -3));
        });
        // unique
        var seen = {};
        return out.filter(function (w) { if (seen[w]) return false; seen[w] = 1; return true; });
      };

      var apply = function () {
        var raw = inp.value || '';
        var q = norm(raw);
        clr.style.display = q ? '' : 'none';
        var words = q ? q.split(' ').filter(Boolean) : [];
        var expanded = q ? expand(raw) : [];
        var shown = 0;
        var collapsed = self._collapsed();
        var meta = nav.querySelector('#nav-search-meta');

        nav.querySelectorAll('a[data-module-id]').forEach(function (a) {
          var label = a.querySelector('.app-nav-label');
          var id = a.getAttribute('data-module-id') || '';
          var href = (a.getAttribute('href') || '').replace(/\.html$/i, '');
          var sect = a.getAttribute('data-nav-section') || '';
          var hay = [
            norm(label ? label.textContent : a.textContent),
            norm(id),
            norm(href),
            norm(sect),
            // also index synonym keys that point at this module
            Object.keys(SYNONYMS).filter(function (k) {
              return (' ' + SYNONYMS[k] + ' ').indexOf(' ' + id.replace(/_/g, '-') + ' ') > -1
                  || (' ' + SYNONYMS[k] + ' ').indexOf(' ' + id + ' ') > -1
                  || (' ' + SYNONYMS[k] + ' ').indexOf(' ' + href + ' ') > -1;
            }).join(' ')
          ].join(' ');

          var match;
          if (!q) {
            match = true;
          } else {
            // Every typed word must match either directly OR via a synonym
            // expansion that appears in the haystack.
            match = words.every(function (word) {
              if (hay.indexOf(word) !== -1) return true;
              var syn = SYNONYMS[word];
              if (syn) {
                return syn.split(' ').some(function (s) {
                  return hay.indexOf(s) !== -1 || hay.indexOf(norm(s)) !== -1;
                });
              }
              // prefix match for partial typing ("paym" → payments)
              if (word.length >= 3) {
                return hay.split(' ').some(function (h) { return h.indexOf(word) === 0; });
              }
              return false;
            });
          }

          var folded = !q && collapsed.indexOf(a.getAttribute('data-nav-section')) > -1;
          a.style.display = (match && !folded) ? '' : 'none';
          if (match && !folded) shown++;
          // highlight active match set for keyboard nav
          if (match && q) a.setAttribute('data-nav-hit', '1');
          else a.removeAttribute('data-nav-hit');
        });

        nav.querySelectorAll('button[data-nav-section]').forEach(function (h) {
          var title = h.getAttribute('data-nav-section');
          var any = false;
          nav.querySelectorAll('a[data-nav-section]').forEach(function (a) {
            if (a.getAttribute('data-nav-section') === title && a.style.display !== 'none') any = true;
          });
          h.style.display = any ? '' : 'none';
          var caret = h.querySelector('.nav-section-caret');
          if (caret) caret.style.visibility = q ? 'hidden' : '';
        });

        empty.style.display = (q && !shown) ? '' : 'none';
        if (meta) {
          if (q && shown) {
            meta.style.display = '';
            meta.textContent = shown + (shown === 1 ? ' page' : ' pages') + ' match';
          } else {
            meta.style.display = 'none';
            meta.textContent = '';
          }
        }
      };

      inp.addEventListener('input', apply);
      inp.addEventListener('search', apply); // native clear on type=search
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { inp.value = ''; apply(); inp.blur(); e.preventDefault(); }
        if (e.key === 'Enter') {
          var first = nav.querySelector('a[data-module-id][data-nav-hit="1"], a[data-module-id]:not([style*="display: none"])');
          // prefer visible
          var pick = null;
          nav.querySelectorAll('a[data-module-id]').forEach(function (a) {
            if (!pick && a.style.display !== 'none') pick = a;
          });
          if (pick) { w.location.href = pick.getAttribute('href'); e.preventDefault(); }
        }
        // "/" focuses search when not in an input — handled globally below
      });
      clr.addEventListener('click', function () { inp.value = ''; apply(); inp.focus(); });

      // Global "/" shortcut to focus nav search (when not typing elsewhere)
      if (!w.__tcNavSlashBound) {
        w.__tcNavSlashBound = true;
        d.addEventListener('keydown', function (e) {
          if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
          var t = e.target;
          if (t && (/^(INPUT|TEXTAREA|SELECT)$/i.test(t.tagName) || t.isContentEditable)) return;
          var box = d.getElementById('nav-search');
          if (box) { e.preventDefault(); box.focus(); box.select(); }
        });
      }

      if (prevQuery) { inp.value = prevQuery; apply(); }
      else { apply(); }                               // applies the fold state
    },

    /* ---- Styles for the elements this file introduces. ------------------
       Injected rather than added to the stylesheet so a generated studio that
       has customised its CSS still gets a working pane. Uses theme variables
       throughout, so it follows the brand and dark mode. */
    _style: function () {
      if (d.getElementById('tc-nav-style')) return;
      var css =
        '.app-nav{display:flex;flex-direction:column;gap:1px}' +
        '.nav-search-box{padding:8px 10px 6px;position:sticky;top:0;z-index:5;' +
          'background:var(--sidebar-bg,inherit)}' +
        '.app-nav button.nav-section-title{display:flex;align-items:center;gap:7px;width:100%;' +
          'margin:10px 0 2px;padding:5px 12px;border:0;background:none;cursor:pointer;' +
          'font:inherit;font-size:.68rem;font-weight:800;letter-spacing:.09em;' +
          'text-transform:uppercase;color:var(--gray-500,#64748b);text-align:left}' +
        '.app-nav button.nav-section-title:hover{color:var(--primary,#0506ae)}' +
        '.nav-section-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '.nav-section-count{font-size:.62rem;font-weight:700;opacity:.55;' +
          'background:var(--gray-100,#f1f5f9);border-radius:999px;padding:1px 6px}' +
        '.nav-section-caret{font-size:.7rem;opacity:.7}' +
        '.app-nav a.app-nav-link{display:flex;align-items:center;gap:10px;padding:7px 12px;' +
          'border-radius:9px;text-decoration:none;color:inherit;font-size:.87rem;line-height:1.3}' +
        '.app-nav a.app-nav-link:hover{background:var(--gray-100,#f1f5f9)}' +
        '.app-nav a.app-nav-link.active{background:var(--gradient,linear-gradient(135deg,#0506ae,#964eec));' +
          'color:#fff;font-weight:700}' +
        '.app-nav a.app-nav-link.active .app-nav-icon{filter:none}' +
        '.app-nav-icon{width:1.25em;flex:0 0 auto;text-align:center}' +
        '.app-nav-label{flex:1;min-width:0}' +
        '.app-nav-ro{font-size:.72rem;opacity:.55}' +
        '@media print{.app-nav,.app-sidebar{display:none!important}}';
      var st = d.createElement('style');
      st.id = 'tc-nav-style';
      st.textContent = css;
      d.head.appendChild(st);
    },

    /* Compatibility shim. Older code called App.collectAccessRows(), which
       walked the DOM. It now reads the model, so the dashboard's access
       manager lists every page even when the current role cannot see it. */
    allItems: function () {
      var out = [];
      this.MODEL().forEach(function (s) {
        s.items.forEach(function (i) {
          out.push({ id: i.id, label: i.label, href: i.href,
                     section: s.title, aud: i.aud });
        });
      });
      return out;
    }
  };

  w.TCNav = TCNav;
  if (w.TC) w.TC.Nav = TCNav;

  /* -----------------------------------------------------------------------
     Draw immediately with whatever we know (usually the cached role), then
     redraw when the session resolves. Two renders, both idempotent, and the
     first one is already correct for a returning user.
     ----------------------------------------------------------------------- */
  function boot() { try { TCNav.render(); } catch (e) {} }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();

  d.addEventListener('tc:role', function (e) {
    try {
      TCNav.rememberRole(e && e.detail);
      TCNav.render(e && e.detail);
    } catch (err) {}
  });

  /* If the user signs out, the cached role must go with them, or the next
     visitor to that browser gets the previous person's menu. */
  d.addEventListener('tc:signout', function () {
    TCNav.forgetRole();
    try { TCNav.render(null); } catch (e) {}
  });
})(window);
