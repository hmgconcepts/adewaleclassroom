/* ============================================================================
   rbac.js — one source of truth for who may see and do what
   ----------------------------------------------------------------------------
   THE PROBLEM THIS SOLVES (items 6, 7, 9, 10, 11)

   Before this file, every navigation link carried a `data-role-allow`
   attribute, and across 134 pages those attributes only ever held three
   values: "admin tutor staff", "admin", or "any". There was:

     * no distinction between a PARENT and a STUDENT — both fell under "any";
     * no concept of READ-ONLY. A page was either invisible or fully writable,
       so a parent who could see the attendance register could also edit it;
     * operational pages such as Sessions, Complete a class, Exam targets,
       Learner cards, Learners, Engagements and the Makeup credit bank were
       marked "any" and appeared on a child's dashboard.

   This module replaces that with an explicit matrix. Every page is mapped to
   every role with one of three levels:

       'none'  — the page is hidden from the navigation AND blocked on entry
       'read'  — visible and readable, but every control that writes is
                 disabled, and crud.js refuses inserts, updates and deletes
       'write' — full access

   Two design decisions worth stating:

   1. DENY BY DEFAULT. A page not listed for a role is 'none' for parents and
      students. A new page therefore cannot leak to a family by being
      forgotten — the failure mode is "a parent cannot see it yet", which is
      recoverable, rather than "a child can see the payroll", which is not.

   2. THE DATABASE STILL DECIDES. This is a usability and least-privilege
      layer, not the security boundary. Row-level security in PostgreSQL
      remains the thing that actually protects the data; a family member who
      edits this file in their browser gains nothing.
   ========================================================================== */
(function (w) {
  'use strict';

  /* ---------------------------------------------------------------------
     What a family may READ. These are the pages a parent or a learner has a
     legitimate interest in — their own progress, their own timetable, their
     own resources — but no business changing. A tutor records attendance; a
     parent reads it.
     --------------------------------------------------------------------- */
  var FAMILY_READ = [
    /* ITEMS 2 & 6 — 'dashboard' was missing from every list, so deny-by-
       default blocked a parent or learner from their OWN HOME PAGE the
       instant they signed in. The core shell pages are listed first now, and
       a test asserts every role can reach its dashboard. */
    'dashboard',
    'my-children',         // a parent's children summary
    'learner-360',
    'bookings',            // cycle bookings
    'goals',               // goals & learning plans
    'attendance',
    'mastery',             // topic mastery
    'assignments',         // homework
    'reading',             // reading assignments
    'classwork',
    'stream',              // class stream
    'scoresheet',
    'progress-reports',
    'learner-360',
    'resources',           // resource library
    'library',             // digital library
    'lms',                 // mini LMS
    'eresources',          // e-resources / notes
    'flashcards',          // spaced practice
    'certificates',
    'voting',              // may vote; may not create
    'polls',
    'gallery',
    'events',              // workshops & events
    'reminders',           // lesson reminders + calendar
    'study-log',           // study log / session timer
    'calendar',
    'session-notes',
    'curriculum',
    'sow',                 // scheme of work — what will be taught
    'timezones',
    'portfolio',
    'transcripts',
    'learning-styles',
    'accommodations',
    'makeups',             // may see a rescheduled class
    'cancellations',
    'meetings',            // the join link for their own class
    'whiteboard',
    'documents',
    'policies',
    'announcements',
    'broadcasts',
    'notifications',
    'directory',
    'birthdays',
    'feature-guide',
    'hmg-ecosystem',
    'hmg-products',
    'about',
    'install',
    'site-index'
  ];

  /* Pages a family member genuinely acts on. Everything else is read at most. */
  var FAMILY_WRITE = [
    'profile',
    'change-password',
    'inbox',
    'messages',
    'complaints',          // raising a concern is the whole point
    'helpdesk',
    'surveys',             // answering one
    'cbt-exam',            // sitting a paper
    'cbt-review',          // reviewing their own paper
    'practice-sit',        // (reserved) sitting a practice quiz
    'contact',
    'apply',
    'public-book',
    'referrals'
  ];

  /* Extra pages a PARENT gets that a student does not: money and the
     family-level views. A learner should not be reading invoices. */
  var PARENT_ONLY_READ = [
    'invoices', 'payments', 'payment-history', 'fees', 'receipts',
    'my-children', 'family-links', 'wallet', 'payment-plans',
    'parent-meetings', 'scholarships', 'packages'
  ];
  var PARENT_ONLY_WRITE = ['parent-meetings'];

  /* Explicitly denied to BOTH families, whatever else happens. Named because
     these were the ones actually reported as leaking. */
  var FAMILY_DENY = [
    /* V25 — at-risk, predictions and value-added moved here from FAMILY_READ.
       They used to be family-readable because they were read-only analytics
       pages. They are not any more: each now carries a staff entry desk that
       records the EVIDENCE and the INTERNAL ACTION behind a judgement —
       "3 no-shows, mother unreachable", "predicted a C, do not tell them yet".
       That is a professional working note, not a parent-facing figure.

       The family still gets the conclusion, and gets it deliberately: a
       value-added entry or a predicted grade reaches a parent only when it is
       ticked as published, at which point it appears on the Progress report
       and on Learner 360. Publication is an act, not a side effect. */
    'at-risk', 'predictions', 'value-added',
    'sessions', 'session-complete', 'practice', 'exam-targets', 'idcards',
    'makeup-credits',
    'learners', 'engagements', 'groups', 'tutors', 'parents', 'subjects',
    'availability', 'substitutions', 'rooms', 'payroll', 'finance',
    'approvals', 'admin-data', 'activity-log', 'compliance', 'safeguarding',
    'security-centre', 'license', 'settings', 'developer', 'builder',
    'analytics', 'insights', 'group-insights', 'platform-health', 'storage',
    'status-manager', 'onboarding', 'inquiries', 'waitlist', 'trials',
    'exam-register', 'exam-links', 'application-links', 'cbt-multi',
    'cbt-prompts', 'cbt-results', 'diagnostics', 'lesson-plans',
    'methodologies', 'rubrics', 'assessments', 'leave', 'products',
    'flyer', 'quota', 'admin', 'super'
  ];

  /* Staff (a tutor) run teaching but not the business. */
  var STAFF_DENY = [
    'payroll', 'finance', 'license', 'settings', 'developer', 'builder',
    'security-centre', 'admin-data', 'storage', 'platform-health',
    'status-manager', 'approvals', 'compliance'
  ];
  var STAFF_READ = ['invoices', 'payments', 'fees', 'wallet', 'payment-plans',
                    'scholarships', 'packages', 'activity-log'];

  /* The four real roles this matrix understands. ANYTHING ELSE — 'guest',
     'pending', 'demo', an empty string, or a value we have not seen — is NOT
     a role we may make decisions about. See KNOWN() below. */
  var REAL = ['admin', 'tutor', 'staff', 'parent', 'student'];

  function normRole(r) {
    r = String(r || '').trim().toLowerCase();
    if (['owner', 'administrator', 'super_admin', 'superadmin', 'super admin',
         'super', 'proprietor'].indexOf(r) > -1) return 'admin';
    if (['teacher', 'instructor', 'facilitator'].indexOf(r) > -1) return 'tutor';
    if (['learner', 'pupil', 'child'].indexOf(r) > -1) return 'student';
    if (['guardian', 'father', 'mother'].indexOf(r) > -1) return 'parent';
    return r;
  }

  /* Is this a role we are confident about? */
  function isKnown(r) { return REAL.indexOf(normRole(r)) > -1; }

  function normPage(p) {
    return String(p || '').toLowerCase()
      .replace(/^.*\//, '').replace(/\.html$/, '').replace(/_/g, '-');
  }

  var RBAC = {
    FAMILY_READ: FAMILY_READ,
    FAMILY_WRITE: FAMILY_WRITE,
    FAMILY_DENY: FAMILY_DENY,
    PARENT_ONLY_READ: PARENT_ONLY_READ,
    STAFF_DENY: STAFF_DENY,
    STAFF_READ: STAFF_READ,

    /** 'none' | 'read' | 'write' for a page and a role. */
    level: function (page, role) {
      page = normPage(page);
      role = normRole(role);

      // Public pages everyone reaches, signed in or not.
      if (['index', 'login', 'forgot-password', 'apply', 'contact', 'about',
           'install', 'offline', 'public-book', 'exam-register', 'cbt-exam',
           'feature-guide', 'site-index', 'hmg-ecosystem', 'hmg-products',
           'flyer'].indexOf(page) > -1 && (!role || role === 'guest')) {
        return 'write';
      }

      // Staff run the studio; decide for them before anything else.
      if (role === 'admin') return 'write';

      /* Pages that belong to the USER, not to a department. Blocking any of
         these strands someone in their own portal, so they are reachable by
         every role. Writing is only meaningful on the personal ones. */
      var SHELL = ['dashboard', 'profile', 'change-password', 'notifications',
                   'inbox', 'messages', 'offline', 'install', 'about',
                   'feature-guide', 'site-index', 'contact', 'helpdesk',
                   'hmg-ecosystem', 'hmg-products'];
      if (SHELL.indexOf(page) > -1) {
        if (role === 'tutor' || role === 'staff') return 'write';
        return ['profile', 'change-password', 'inbox', 'messages', 'helpdesk',
                'contact'].indexOf(page) > -1 ? 'write' : 'read';
      }

      if (role === 'tutor' || role === 'staff') {
        if (STAFF_DENY.indexOf(page) > -1) return 'none';
        if (STAFF_READ.indexOf(page) > -1) return 'read';
        return 'write';
      }

      if (role === 'parent' || role === 'student') {
        if (FAMILY_DENY.indexOf(page) > -1) return 'none';
        if (FAMILY_WRITE.indexOf(page) > -1) return 'write';
        if (role === 'parent') {
          if (PARENT_ONLY_WRITE.indexOf(page) > -1) return 'write';
          if (PARENT_ONLY_READ.indexOf(page) > -1) return 'read';
        } else {
          // A learner has no business in the family's money.
          if (PARENT_ONLY_READ.indexOf(page) > -1) return 'none';
        }
        if (FAMILY_READ.indexOf(page) > -1) return 'read';
        return 'none';                       // deny by default
      }

      /* ------------------------------------------------------------------
         CRITICAL FIX (item 7): this used to `return 'none'` for any role it
         did not recognise. App.currentRole is initialised to 'guest' and
         stays that way until the session resolves, and 'super_admin' was
         never normalised at all — so the matrix confidently blocked EVERY
         page for EVERY user, including administrators, with the message
         "Your account is a guest account".

         An access-control layer that is unsure must never be the thing that
         locks a legitimate user out. Where the role is not one we actually
         understand, we defer: return 'write' and let row-level security in
         the database decide, which is the real boundary anyway.
         ------------------------------------------------------------------ */
      return 'write';
    },

    /* If a page was made read-only while the role was still resolving, and
       the resolved role turns out to be admin or staff, undo it. Without
       this a slow session left an administrator staring at a read-only
       banner until they reloaded. */
    unlock: function () {
      var d = w.document;
      if (d.body.dataset.tcReadonly !== '1') return;
      delete d.body.dataset.tcReadonly;
      d.body.classList.remove('tc-readonly');
      var n = d.getElementById('tc-ro-note');
      if (n) n.remove();
      d.querySelectorAll('[data-tc-ro-disabled="1"]').forEach(function (el) {
        el.disabled = false;
        el.removeAttribute('data-tc-ro-disabled');
      });
      d.querySelectorAll('[data-tc-ro-hidden="1"]').forEach(function (el) {
        el.style.display = '';
        el.removeAttribute('data-tc-ro-hidden');
      });
    },

    canSee:  function (page, role) { return this.level(page, role) !== 'none'; },
    canWrite: function (page, role) { return this.level(page, role) === 'write'; },

    /* ------------------------------------------------------------------
       Apply the matrix to the page currently on screen.
       ------------------------------------------------------------------ */
    isKnown: isKnown,
    REAL: REAL,

    apply: function (role) {
      var raw = role || (w.App && (w.App.currentRole || w.App.role)) || '';
      role = normRole(raw);

      /* Do nothing at all unless we KNOW the role. 'guest', 'pending',
         'demo' and an unresolved session must never trigger a lockout —
         that was the bug that blocked administrators out of their own
         studio. */
      if (!isKnown(role)) return;
      if (role === 'admin') { RBAC.unlock(); return; }   // admin: no restrictions

      var d = w.document;

      /* 1. Navigation.

         This block used to walk .app-nav and hide links. It no longer does,
         and that removal IS the fix for the reported defect "the pages on the
         navigation pane keep changing when the pane is accessed".

         Two systems were mutating the same elements from two different rule
         sets — this one, and App.applyRoleNav. RBAC only ever hid; App re-showed
         whatever its own rules allowed. Whichever ran last won, and which ran
         last depended on how fast the session resolved, so the menu genuinely
         differed between page loads for the same account.

         The pane now has exactly one owner: assets/js/nav.js, which rebuilds
         it from assets/js/nav-model.js. It calls RBAC.level() for every item,
         so THIS matrix is still the authority on who may see what — it simply
         is no longer a second hand reaching into the DOM.

         nav.js listens for the same 'tc:role' event that got us here, so the
         pane is already being redrawn as this runs. The call below is a
         safety net for the polling path, where no event was dispatched. */
      if (w.TCNav && typeof w.TCNav.render === 'function') {
        try { w.TCNav.rememberRole(role); w.TCNav.render(role); } catch (e) {}
      }

      // 2. This page: block entry, or drop to read-only.
      var here = normPage(w.location.pathname);
      var lvl = RBAC.level(here, role);

      if (lvl === 'none') {
        var main = d.querySelector('.app-content') || d.querySelector('main');
        if (main) {
          main.innerHTML =
            '<section class="card" style="max-width:620px;margin:40px auto;text-align:center">' +
            '<h2 style="margin-top:0">This page is not part of your portal</h2>' +
            '<p class="muted">Your account is a <b>' + role + '</b> account, and this page belongs to ' +
            'the studio\u2019s staff area. Nothing has gone wrong.</p>' +
            '<p><a class="btn btn-primary" href="dashboard.html">Back to my dashboard</a></p>' +
            '</section>';
        }
        return;
      }

      if (lvl === 'read') { RBAC.makeReadOnly(); }
    },

    /* -----------------------------------------------------------------------
       READ-ONLY MODE — allow-list, not deny-list (items 3 and 5).

       The first version disabled controls inside `.app-content form` plus a
       short list of CRUD selectors. That missed the pages the report actually
       named — cycle bookings, reading assignments, classwork, class stream,
       study log — because those pages contain NO <form> at all: they build
       their buttons in JavaScript. So a parent still had working Save and
       Delete buttons on exactly the pages that were reported.

       The posture is now inverted. Everything that could write is disabled,
       and only controls that are demonstrably READING TOOLS are allowed
       through. Getting the allow-list wrong makes a page slightly less
       convenient; getting a deny-list wrong lets a parent edit the register.
       ----------------------------------------------------------------------- */

    /* Controls a viewer legitimately keeps: searching, filtering, sorting,
       paging, printing, exporting, opening a record, switching theme,
       navigating, and closing a dialog. */
    _isReadTool: function (el) {
      var id = (el.id || '').toLowerCase();
      var cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
      var txt = (el.textContent || '').trim().toLowerCase();
      var t = (el.getAttribute && el.getAttribute('type') || '').toLowerCase();

      if (el.hasAttribute && (el.hasAttribute('data-filter') || el.hasAttribute('data-sort') ||
          el.hasAttribute('data-open') || el.hasAttribute('data-audit') ||
          el.hasAttribute('data-res') || el.hasAttribute('data-signout') ||
          el.hasAttribute('data-view-only'))) return true;
      if (t === 'search') return true;
      if (/^(crud-q|crud-csv|crud-print|crud-cols|crud-dense|crud-clear|crud-prev|crud-next|crud-size|crud-saved|nav-search|nav-search-clear|btn-dark|page-help-btn|tc-bot-fab|notif-bell)$/.test(id)) return true;
      if (/(^|\s)(nav-|crud-pager|crud-toolbar|tab|chip-view)/.test(cls)) return true;
      if (/^(search|filter|sort|print|export|download|csv|close|cancel|back|view|open|audit|results|refresh|reload|theme|sign out|help|next|prev|previous|page)\b/.test(txt)) return true;
      if (/(⬇|🖨|🔎|🔍|❓|×|‹|›)/.test(txt)) return true;
      // Anchors are navigation, not writes.
      if (el.tagName === 'A') return true;
      return false;
    },

    makeReadOnly: function () {
      var d = w.document;
      d.body.dataset.tcReadonly = '1';
      d.body.classList.add('tc-readonly');

      var main = d.querySelector('.app-content') || d.querySelector('main');
      if (main && !d.getElementById('tc-ro-note')) {
        var note = d.createElement('div');
        note.id = 'tc-ro-note';
        note.className = 'tc-ro-note';
        note.innerHTML = '<b>👁 View only.</b> You can read, search, sort, print and export ' +
          'everything on this page. Changes are made by the studio — if something looks wrong, use ' +
          '<a href="complaints.html">Raise a concern</a> or <a href="inbox.html">Messages</a>.';
        main.insertBefore(note, main.firstChild);
      }

      var self = this;
      var sweep = function () {
        var scope = d.querySelector('.app-content') || d.body;
        if (!scope) return;

        // Every control that could write, unless it is a reading tool.
        scope.querySelectorAll('button, input, select, textarea, [role="button"]').forEach(function (el) {
          if (el.closest('#tc-ro-note')) return;
          if (el.closest('.app-sidebar, .app-topbar, .app-nav')) return;   // chrome
          if (el.closest('#tc-bot-panel, .tc-popup, #page-help-btn')) return;
          if (self._isReadTool(el)) return;
          if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') {
            if (el.style.display !== 'none') {
              el.style.display = 'none';
              el.setAttribute('data-tc-ro-hidden', '1');
            }
          } else if (!el.disabled) {
            el.disabled = true;
            el.setAttribute('data-tc-ro-disabled', '1');
          }
        });

        // The workbench's own writing affordances.
        scope.querySelectorAll('#crud-add,[data-edit],[data-del],[data-dup],[data-rowact],' +
          '#crud-bulk,[data-pick],#crud-all').forEach(function (el) {
          if (el.style.display !== 'none') {
            el.style.display = 'none';
            el.setAttribute('data-tc-ro-hidden', '1');
          }
        });
      };

      sweep();
      // Pages paint asynchronously, so keep sweeping as content arrives.
      if (w.MutationObserver && !this._roObserver) {
        this._roObserver = new MutationObserver(function () {
          if (d.body.dataset.tcReadonly === '1') sweep();
        });
        this._roObserver.observe(d.documentElement, { childList: true, subtree: true });
      }
    }
  };

  w.RBAC = RBAC;
  if (w.TC) w.TC.RBAC = RBAC;

  /* Run once the shell knows the role. app.js dispatches this; the timeout is
     a fallback for pages that resolve the role by another route. */
  w.document.addEventListener('tc:role', function (e) {
    try { RBAC.apply(e && e.detail); } catch (err) {}
  });
  /* A guarded fallback for pages that resolve the role by another route. It
     re-checks a few times, and only ever acts on a role it recognises, so an
     unresolved session can never cause a lockout. */
  (function poll() {
    var tries = 0;
    var t = setInterval(function () {
      var r = (w.App && (w.App.currentRole || w.App.role)) || '';
      if (isKnown(r)) { clearInterval(t); try { RBAC.apply(r); } catch (e) {} }
      else if (++tries > 20) { clearInterval(t); }     // ~10s, then give up quietly
    }, 500);
  })();
})(window);
