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
    'value-added',
    'predictions',
    'at-risk',
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

  function normRole(r) {
    r = String(r || '').toLowerCase();
    if (r === 'owner' || r === 'administrator') return 'admin';
    if (r === 'teacher') return 'tutor';
    if (r === 'learner') return 'student';
    return r;
  }

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

      if (role === 'admin') return 'write';

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

      // Unknown or guest role: only the public set above.
      return 'none';
    },

    canSee:  function (page, role) { return this.level(page, role) !== 'none'; },
    canWrite: function (page, role) { return this.level(page, role) === 'write'; },

    /* ------------------------------------------------------------------
       Apply the matrix to the page currently on screen.
       ------------------------------------------------------------------ */
    apply: function (role) {
      role = normRole(role || (w.App && (w.App.currentRole || w.App.role)) || '');
      if (!role || role === 'admin') return;      // admin sees everything

      var d = w.document;

      // 1. Navigation: hide anything this role may not reach.
      var nav = d.querySelector('.app-nav');
      if (nav) {
        nav.querySelectorAll('a[href]').forEach(function (a) {
          var href = a.getAttribute('href') || '';
          if (!/\.html$/.test(href)) return;
          if (!RBAC.canSee(href, role)) {
            a.style.display = 'none';
            a.dataset.navRoleHidden = '1';
          } else if (RBAC.level(href, role) === 'read') {
            // A quiet cue, so a parent is not surprised when Save is missing.
            if (!a.dataset.roView) {
              a.dataset.roView = '1';
              a.setAttribute('title', 'You can view this page');
            }
          }
        });
        try { if (w.App && w.App._syncNavSections) w.App._syncNavSections(); } catch (e) {}
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

    /* Turn the current page read-only: disable every writing control, and
       leave a clear banner saying why. Deliberately allows search, filter,
       sort, paging, print and export — reading well is the point. */
    makeReadOnly: function () {
      var d = w.document;
      if (d.body.dataset.tcReadonly === '1') return;
      d.body.dataset.tcReadonly = '1';
      d.body.classList.add('tc-readonly');

      var main = d.querySelector('.app-content') || d.querySelector('main');
      if (main && !d.getElementById('tc-ro-note')) {
        var note = d.createElement('div');
        note.id = 'tc-ro-note';
        note.className = 'tc-ro-note';
        note.innerHTML = '<b>👁 View only.</b> You can read, search, print and export everything on ' +
          'this page. Changes are made by the studio — if something looks wrong, use ' +
          '<a href="complaints.html">Raise a concern</a> or <a href="inbox.html">Messages</a>.';
        main.insertBefore(note, main.firstChild);
      }

      var sweep = function () {
        // Anything that writes.
        d.querySelectorAll('#crud-add,[data-edit],[data-del],[data-dup],[data-rowact],' +
          '[data-crud-add],.btn-danger,#crud-bulk,[data-pick],#crud-all').forEach(function (el) {
          el.style.display = 'none';
        });
        // Forms inside the content area, minus the ones that are reading tools.
        d.querySelectorAll('.app-content form').forEach(function (f) {
          if (f.closest('#crud-root, .crud-toolbar')) return;
          if (f.id === 'crud-form') return;
          f.querySelectorAll('input,select,textarea,button').forEach(function (el) {
            if (el.type === 'search' || el.id === 'crud-q' || el.hasAttribute('data-filter')) return;
            el.disabled = true;
          });
        });
      };
      sweep();
      // The workbench paints asynchronously, so sweep again as rows arrive.
      if (w.MutationObserver) {
        new MutationObserver(sweep).observe(d.documentElement, { childList: true, subtree: true });
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
  setTimeout(function () {
    try {
      var r = (w.App && (w.App.currentRole || w.App.role)) || '';
      if (r) RBAC.apply(r);
    } catch (e) {}
  }, 1500);
})(window);
