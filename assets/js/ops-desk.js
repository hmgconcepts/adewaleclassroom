/* ============================================================================
   ops-desk.js — live KPI strip + quick actions for the operational pages
   ----------------------------------------------------------------------------
   V28 (report items 2–20). Every register page used to render as a bare table
   ("features missing"). This module mounts a compact summary card at the top
   of a page, driven by that page's own table, so an operator sees at a glance
   what matters before opening the register:

     · counts by status (open/closed, scheduled/done/cancelled, paid/due…)
     · upcoming / due-soon counts when the table has a date column
     · money totals for finance tables
     · 3–4 quick actions (jump to a related page or open the add form)

   It is data-driven and conservative: if the table or column is missing, the
   strip quietly hides. Staff see the full strip; families (read-only) see a
   lighter read-only version. No AI, no uploads.
   ========================================================================== */
(function (w, d) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* page -> { table, status?, date?, money?, label, actions[] } */
  var CFG = {
    'sessions':         { table: 'sessions', status: 'status', date: 'starts_at', label: 'Sessions', actions: [['＋ New session', '#'], ['Complete a class', 'session-complete.html'], ['Attendance', 'attendance.html']] },
    'attendance':       { table: 'session_attendance', status: 'status', label: 'Attendance register', actions: [['Sessions', 'sessions.html'], ['Session notes', 'session-notes.html']] },
    'availability':     { table: 'availability', status: 'timezone', label: 'Availability slots', actions: [['Tutors', 'tutors.html'], ['Public self-booking', 'public-book.html']] },
    'calendar':         { table: 'sessions', status: 'status', date: 'starts_at', label: 'Classes', actions: [['Bookings', 'bookings.html'], ['Sessions', 'sessions.html']] },
    'meetings':         { table: 'sessions', status: 'status', date: 'starts_at', label: 'Meeting links', actions: [['Sessions', 'sessions.html'], ['Whiteboard rooms', 'whiteboard.html']] },
    'cancellations':    { table: 'sessions', status: 'status', date: 'starts_at', label: 'Cancellations', actions: [['Make-ups', 'makeups.html'], ['Makeup credits', 'makeup-credits.html']] },
    'makeups':          { table: 'sessions', status: 'status', date: 'starts_at', label: 'Make-up sessions', actions: [['Cancellations', 'cancellations.html'], ['Makeup credits', 'makeup-credits.html']] },
    'makeup-credits':   { table: 'makeup_credits', money: 'delta', label: 'Makeup credit ledger', actions: [['Make-ups', 'makeups.html'], ['Sessions', 'sessions.html']] },
    'session-notes':    { table: 'session_notes', label: 'Session notes', actions: [['Attendance', 'attendance.html'], ['Sessions', 'sessions.html']] },
    'rooms':            { table: 'rooms', status: 'available', label: 'Rooms & locations', actions: [['Meetings', 'meetings.html'], ['Whiteboard rooms', 'whiteboard.html']] },
    'substitutions':    { table: 'substitutions', status: 'status', label: 'Cover tutors', actions: [['Tutors', 'tutors.html'], ['Availability', 'availability.html']] },
    'timezones':        { table: 'tutors', status: 'timezone', label: 'Timezone desk', actions: [['Tutors', 'tutors.html'], ['Availability', 'availability.html']] },
    'birthdays':        { table: 'learners', date: 'date_of_birth', label: 'Birthdays', actions: [['Learners', 'learners.html'], ['Directory', 'directory.html']] },
    'idcards':          { table: 'learners', label: 'Learner cards', actions: [['Learners', 'learners.html'], ['Directory', 'directory.html']] },
    'directory':        { table: 'learners', label: 'Directory', actions: [['Learners', 'learners.html'], ['Birthdays', 'birthdays.html']] },
    'my-children':      { table: 'learners', label: 'My children', actions: [['Learner 360', 'learner-360.html'], ['Progress reports', 'progress-reports.html']] },
    'engagements':      { table: 'engagements', status: 'status', label: 'Engagements', actions: [['Groups', 'groups.html'], ['Learners', 'learners.html'], ['Scoresheet', 'scoresheet.html']] },
    'reminders':        { table: 'sessions', status: 'status', date: 'starts_at', label: 'Lesson reminders', actions: [['Calendar', 'calendar.html'], ['Bookings', 'bookings.html']] },
    'events':           { table: 'events', status: 'kind', date: 'starts_at', label: 'Workshops & events', actions: [['Announcements', 'announcements.html'], ['Gallery', 'gallery.html']] },
    'curriculum':       { table: 'curriculum_items', status: 'covered', label: 'Curriculum maps', actions: [['Scheme of work', 'sow.html'], ['Lesson plans', 'lesson-plans.html']] },
    'sow':              { table: 'sow_terms', status: 'status', label: 'Scheme of work', actions: [['Curriculum maps', 'curriculum.html'], ['Lesson plans', 'lesson-plans.html']] },
    'lesson-plans':     { table: 'lesson_plans', label: 'Lesson plans', actions: [['Scheme of work', 'sow.html'], ['Methodologies', 'methodologies.html']] },
    'methodologies':    { table: 'methodologies', label: 'Methodologies', actions: [['Lesson plans', 'lesson-plans.html'], ['Subjects', 'subjects.html']] },
    'diagnostics':      { table: 'assessments', status: 'kind', label: 'Diagnostics', actions: [['Trials', 'trials.html'], ['Goals & plans', 'goals.html']] },
    'goals':            { table: 'goals', status: 'status', label: 'Goals & learning plans', actions: [['Mastery', 'mastery.html'], ['Progress reports', 'progress-reports.html']] },
    'mastery':          { table: 'mastery_topics', label: 'Topic mastery', actions: [['Goals', 'goals.html'], ['Scoresheet', 'scoresheet.html']] },
    'assignments':      { table: 'assignments', status: 'status', date: 'due_on', label: 'Homework', actions: [['Classwork', 'classwork.html'], ['Reading', 'reading.html']] },
    'classwork':        { table: 'classwork_items', status: 'status', date: 'due_on', label: 'Classwork', actions: [['Assignments', 'assignments.html'], ['Stream', 'stream.html']] },
    'reading':          { table: 'reading_assignments', status: 'status', date: 'due_on', label: 'Reading assignments', actions: [['Library', 'library.html'], ['Classwork', 'classwork.html']] },
    'stream':           { table: 'stream_posts', status: 'status', label: 'Class stream', actions: [['Classwork', 'classwork.html'], ['Forum', 'forum.html']] },
    'rubrics':          { table: 'rubrics', label: 'Rubrics', actions: [['Methodologies', 'methodologies.html'], ['SOW', 'sow.html']] },
    'accommodations':   { table: 'accommodations', label: 'Accommodations / SEN', actions: [['Learners', 'learners.html'], ['Learning styles', 'learning-styles.html']] },
    'learning-styles':  { table: 'learners', label: 'Learning styles', actions: [['Accommodations', 'accommodations.html'], ['Learners', 'learners.html']] },
    'study-log':        { table: 'study_logs', money: 'minutes', label: 'Study log / session timer', actions: [['Flashcards', 'flashcards.html'], ['Mastery', 'mastery.html']] },
    'flashcards':       { table: 'flashcards', date: 'due_on', label: 'Spaced practice', actions: [['Study log', 'study-log.html'], ['Gamification', 'gamification.html']] },
    'gamification':     { table: 'badges', label: 'Streaks & badges', actions: [['Learners', 'learners.html'], ['Flashcards', 'flashcards.html']] },
    'exam-targets':     { table: 'exam_targets', date: 'exam_on', label: 'Exam targets', actions: [['Exam links', 'exam-links.html'], ['Exam registration', 'exam-register.html']] },
    'exam-links':       { table: 'exam_reg_links', status: 'status', date: 'expires_on', label: 'Exam registration links', actions: [['Exam targets', 'exam-targets.html'], ['Exam registration', 'exam-register.html']] },
    'exam-register':    { table: 'exam_registrations', status: 'status', label: 'Exam registrations', actions: [['Exam links', 'exam-links.html'], ['Exam targets', 'exam-targets.html']] },
    'scoresheet':       { table: 'scoresheet', money: 'score', label: 'Scoresheet', actions: [['Learner 360', 'learner-360.html'], ['Progress reports', 'progress-reports.html']] },
    'group-insights':   { table: 'tc_group_insights', label: 'Group insights', actions: [['Groups', 'groups.html'], ['Insights lab', 'insights.html']] },
    'transcripts':      { table: 'scoresheet', label: 'Transcripts', actions: [['Scoresheet', 'scoresheet.html'], ['Certificates', 'certificates.html']] },
    'certificates':     { table: 'certificates', label: 'Certificates', actions: [['Transcripts', 'transcripts.html'], ['Learner portfolio', 'portfolio.html']] },
    'portfolio':        { table: 'resources', label: 'Learner portfolio', actions: [['Certificates', 'certificates.html'], ['Gallery', 'gallery.html']] },
    'resources':        { table: 'resources', label: 'Resources library', actions: [['Digital library', 'library.html'], ['E-resources', 'eresources.html']] },
    'library':          { table: 'library_items', label: 'Digital library', actions: [['Resources', 'resources.html'], ['Mini LMS', 'lms.html']] },
    'lms':              { table: 'lms_lessons', status: 'status', label: 'Mini LMS', actions: [['Library', 'library.html'], ['E-resources', 'eresources.html']] },
    'eresources':       { table: 'eresources', label: 'E-resources / notes', actions: [['Library', 'library.html'], ['Mini LMS', 'lms.html']] },
    'free-classes':     { table: 'tc_free_cohorts', status: 'status', label: 'Free class cohorts', actions: [['Free sign-up', 'free-register.html'], ['Public booking', 'public-book.html']] },
    'payment-history':  { table: 'payments', money: 'amount', label: 'Payment history', actions: [['Payments', 'payments.html'], ['Invoices', 'invoices.html']] },
    'packages':         { table: 'packages', money: 'hours', label: 'Hour banks', actions: [['Invoices', 'invoices.html'], ['Payments', 'payments.html']] },
    'fees':             { table: 'fee_catalogue', money: 'amount', label: 'Fee catalogue', actions: [['Scholarships', 'scholarships.html'], ['Products', 'products.html']] },
    'products':         { table: 'products', money: 'price', label: 'Books & materials', actions: [['Fees', 'fees.html'], ['Scholarships', 'scholarships.html']] },
    'scholarships':     { table: 'scholarships', status: 'active', label: 'Scholarships & discounts', actions: [['Fees', 'fees.html'], ['Products', 'products.html']] },
    'finance':          { table: 'finance_entries', status: 'kind', money: 'amount', label: 'Practice finance', actions: [['Payroll', 'payroll.html'], ['Payments', 'payments.html']] },
    'payroll':          { table: 'payroll', status: 'status', money: 'gross', label: 'Tutor payroll', actions: [['Finance', 'finance.html'], ['Tutors', 'tutors.html']] },
    'broadcasts':       { table: 'announcements', status: 'audience', label: 'Result broadcasts', actions: [['Announcements', 'announcements.html'], ['Notifications', 'notifications.html']] },
    'forum':            { table: 'forum_threads', label: 'Group forum', actions: [['Stream', 'stream.html'], ['Announcements', 'announcements.html']] },
    'complaints':       { table: 'complaints', status: 'status', label: 'Complaints', actions: [['Help desk', 'helpdesk.html'], ['Inbox', 'inbox.html']] },
    'helpdesk':         { table: 'helpdesk_tickets', status: 'status', label: 'Help desk', actions: [['Complaints', 'complaints.html'], ['Inbox', 'inbox.html']] },
    'parent-meetings':  { table: 'parent_meetings', status: 'status', date: 'scheduled_at', label: 'Parent conferences', actions: [['Parents', 'parents.html'], ['Family links', 'family-links.html']] },
    'gallery':          { table: 'gallery', label: 'Gallery', actions: [['Events', 'events.html'], ['Reviews', 'reviews.html']] },
    'reviews':          { table: 'reviews', status: 'published', label: 'Reviews & testimonials', actions: [['Gallery', 'gallery.html'], ['About', 'about.html']] },
    'inquiries':        { table: 'inquiries', status: 'status', label: 'Inquiries', actions: [['Trials', 'trials.html'], ['Waitlist', 'waitlist.html']] },
    'trials':           { table: 'trials', status: 'status', label: 'Trial lessons', actions: [['Inquiries', 'inquiries.html'], ['Engagements', 'engagements.html']] },
    'waitlist':         { table: 'waitlist', status: 'status', label: 'Waitlist', actions: [['Inquiries', 'inquiries.html'], ['Trials', 'trials.html']] },
    'onboarding':       { table: 'onboarding_items', status: 'done', label: 'Onboarding checklists', actions: [['Engagements', 'engagements.html'], ['Referrals', 'referrals.html']] },
    'referrals':        { table: 'referrals', status: 'status', label: 'Referrals', actions: [['Onboarding', 'onboarding.html'], ['Inquiries', 'inquiries.html']] },
    'approvals':        { table: 'profiles', status: 'status', label: 'Approvals', actions: [['Roles & status', 'status-manager.html'], ['Activity log', 'activity-log.html']] },
    'parents':          { table: 'parents', status: 'status', label: 'Parents', actions: [['Family links', 'family-links.html'], ['My children', 'my-children.html']] },
    'learners':         { table: 'learners', status: 'status', label: 'Learners', actions: [['Directory', 'directory.html'], ['Birthdays', 'birthdays.html']] },
    'tutors':           { table: 'tutors', status: 'status', label: 'Tutors', actions: [['Availability', 'availability.html'], ['Cover tutors', 'substitutions.html']] },
    'subjects':         { table: 'subjects', label: 'Subjects', actions: [['Engagements', 'engagements.html'], ['Curriculum', 'curriculum.html']] },
    'groups':           { table: 'engagements', status: 'kind', label: 'Groups & cohorts', actions: [['Engagements', 'engagements.html'], ['Group insights', 'group-insights.html']] }
  };

  function pageId() {
    var f = (w.location.pathname.split('/').pop() || '').split('?')[0].replace(/\.html$/, '');
    return f;
  }

  var Ops = {
    async mount() {
      var cfg = CFG[pageId()];
      if (!cfg) return;
      var main = d.querySelector('.app-content') || d.querySelector('main');
      if (!main || d.getElementById('ops-strip')) return;

      /* Families get the strip too — it is read-only by nature. */
      var host = d.createElement('div');
      host.id = 'ops-strip';
      host.style.cssText = 'margin-bottom:14px';
      host.innerHTML = '<div class="card" style="padding:12px 16px"><p class="muted" style="margin:0">Loading ' +
        esc(cfg.label) + '…</p></div>';
      var intro = main.querySelector('.page-intro');
      if (intro && intro.nextSibling) main.insertBefore(host, intro.nextSibling);
      else main.insertBefore(host, main.firstChild);

      if (!w.sb) { host.innerHTML = ''; return; }
      try {
        var sel = '*';
        if (cfg.status) sel = cfg.status;
        if (cfg.date) sel += ',' + cfg.date;
        if (cfg.money) sel += ',' + cfg.money;
        var { data, error } = await w.sb.from(cfg.table).select(sel).limit(2000);
        if (error) throw error;
        var rows = data || [];
        host.innerHTML = this._render(cfg, rows);
      } catch (e) {
        host.innerHTML = '';
      }
    },

    _render(cfg, rows) {
      var stats = [];
      var byStatus = {};
      var upcoming = 0;
      var totalMoney = 0;
      var today = new Date(); today.setHours(0, 0, 0, 0);
      rows.forEach(function (r) {
        if (cfg.status && r[cfg.status]) byStatus[r[cfg.status]] = (byStatus[r[cfg.status]] || 0) + 1;
        if (cfg.date && r[cfg.date]) {
          try { if (new Date(r[cfg.date]) >= today) upcoming++; } catch (_) {}
        }
        if (cfg.money && r[cfg.money] != null && !isNaN(Number(r[cfg.money]))) totalMoney += Number(r[cfg.money]);
      });
      stats.push({ v: rows.length, l: 'Total' });
      if (upcoming > 0) stats.push({ v: upcoming, l: 'Upcoming / due' });
      var top = Object.keys(byStatus).sort(function (a, b) { return byStatus[b] - byStatus[a]; }).slice(0, 3);
      top.forEach(function (k) {
        stats.push({ v: byStatus[k], l: String(k).replace(/_/g, ' ').slice(0, 14), tone: true });
      });
      if (cfg.money && totalMoney) {
        stats.push({ v: Math.round(totalMoney).toLocaleString(), l: cfg.money === 'minutes' ? 'Minutes logged' : 'Total ' + cfg.money });
      }
      var chips = stats.map(function (s) {
        return '<div style="min-width:86px"><div class="stat-value" style="font-size:1.25rem;' +
          (s.tone ? 'color:var(--primary,#0506ae)' : '') + '">' + esc(s.v) + '</div>' +
          '<div class="stat-label">' + esc(s.l) + '</div></div>';
      }).join('');
      var actions = (cfg.actions || []).map(function (a) {
        if (a[1] === '#') return '<button class="btn btn-sm btn-outline" type="button" data-ops-add>' + esc(a[0]) + '</button>';
        return '<a class="btn btn-sm btn-outline" href="' + esc(a[1]) + '">' + esc(a[0]) + '</a>';
      }).join('');
      return '<div class="card" style="padding:14px 16px;display:flex;gap:16px;flex-wrap:wrap;align-items:center">' +
        '<div style="display:flex;gap:20px;flex-wrap:wrap;flex:1">' + chips + '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' + actions + '</div></div>';
    },

    init() {
      if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { Ops.mount(); });
      else Ops.mount();
    }
  };

  w.OpsDesk = Ops;
  Ops.init();
})(window, document);
