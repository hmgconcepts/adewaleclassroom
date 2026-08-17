/* ====================================================================
   assistant-kb.js — Tutoring Connect studio assistant knowledge base
   Rules only. No AI API. Shared by Chatbot + SiteHelp + Super.
   Every page and every core process is explained: who, why, how, next.
   ==================================================================== */
(function (w) {
  const P = () => (w.PRACTICE && PRACTICE.name) || 'ADEWALE CLASSROOM';

  const PAGES = {
    dashboard: {
      title: 'Dashboard',
      who: 'Everyone after sign-in. What you see depends on your role.',
      why: 'One place to see what needs attention today — without opening ten modules.',
      what: 'Role-aware studio hub. Admin/tutor: whole-practice KPIs (engagements, sessions this week, at-risk flags, hours left), action digest (pending approvals, open complaints, helpdesk), live feed (polls + announcements), and the 4-cycle class timetable. Parent: only linked children, each with 360 / classes / scores / attendance shortcuts. Learner: only you. A group average never hides a child who is falling behind.',
      how: [
        'Sign in. The shell caches your profile so a slow network does not flash “guest”.',
        'Read the four KPI tiles. Click a quick-action button for your role.',
        'Parents: use the children cards. Each child is a separate engagement.',
        'Admins: the Access Manager at the bottom sets Nav / Read / Write per role. Save once.',
        'Press Ctrl/Cmd+K to jump to any module by name.'
      ],
      next: [['bookings.html', 'Next classes'], ['insights.html', 'Insights Lab'], ['approvals.html', 'Approvals'], ['feature-guide.html', 'All features']]
    },
    engagements: {
      title: 'Engagements (1:1 and groups)',
      who: 'Admin and tutors create. Parents/learners only see engagements they belong to.',
      why: 'This is the atomic unit of Tutoring Connect. Everything else (SOW, hours, fees, quizzes, forum) hangs off one engagement so siblings and groups never smear data.',
      what: 'A row is one independent teaching contract. Kind is one_on_one or group. It has its own subject, exam board, methodology, tutor, timezone, currency, hourly rate, hour bank, diagnostic baseline, target score and exam date.',
      how: [
        'Click + Add. Name it clearly (e.g. “Ama — IGCSE Maths 1:1” or “SAT Weekend Group”).',
        'Set kind. Groups get a forum; 1:1 does not.',
        'Attach a tutor, methodology and hourly rate.',
        'Open Learners / Groups to seat people on engagement_members.',
        'Then sell a 4-cycle booking and write the scheme of work.'
      ],
      next: [['learners.html', 'Seat learners'], ['bookings.html', '4-cycle booking'], ['sow.html', 'Scheme of work'], ['packages.html', 'Hour bank']]
    },
    learners: {
      title: 'Learners',
      who: 'Admin/tutor write. Parents see only mapped children. A learner sees only themselves.',
      why: 'Identity, student ID, timezone and accommodations live here so quizzes, cards and reports stay accurate.',
      what: 'Each insert auto-issues student_no TC-0001, TC-0002… That ID — not a typed name — is how a learner sits a quiz. Photo is a Drive/https link.',
      how: [
        'Add the learner. Note timezone (Africa/Lagos default, or London/NY for internationals).',
        'On Parents, link the guardian (parent_learner). Without the link the family portal is empty.',
        'Seat them on an engagement. One learner may sit in many independent engagements.',
        'Give them the student ID for Take quiz.'
      ],
      next: [['parents.html', 'Link a parent'], ['engagements.html', 'Seat on an engagement'], ['cbt-exam.html', 'Take quiz'], ['idcards.html', 'Print a card']]
    },
    groups: {
      title: 'Groups',
      who: 'Admin/tutor.',
      why: 'A named group is still one engagement. Sessions are shared; mastery and scores stay individual.',
      what: 'Filter of engagements where kind = group. Capacity, subject, status. Group Insights shows who is being left behind.',
      how: ['Create with kind=group.', 'Add members on the roster.', 'Forum and stream become available.', 'Never average away a weak member — open Group Insights.'],
      next: [['forum.html', 'Group forum'], ['group-insights.html', 'Fairness view'], ['stream.html', 'Class stream']]
    },
    parents: {
      title: 'Parents & families',
      who: 'Admin/tutor write. The link is what makes the family portal work.',
      why: 'A parent must never see another family’s child. Linking is the privacy gate.',
      what: 'Parent registry (name, WhatsApp, timezone, billing name) plus parent_learner rows.',
      how: ['Add the parent.', 'Add a Parent–learner link (relationship: mother/father/guardian).', 'Ask them to request access on login.html as role=parent.', 'Approve them. Their dashboard lists only linked children.'],
      next: [['approvals.html', 'Approve the account'], ['invoices.html', 'Bill the parent'], ['apply.html', 'Public inquiry']]
    },
    tutors: {
      title: 'Tutors',
      who: 'Admin.',
      why: 'Solo studios still create one tutor row so availability, payroll and cover work.',
      what: 'Name, email, phone, timezone, specialisms, hourly cost, Drive photo.',
      how: ['Add the tutor.', 'Set weekly availability.', 'Assign them on engagements.', 'Payroll uses hours × rate when you want staff pay.'],
      next: [['availability.html', 'Availability'], ['payroll.html', 'Payroll'], ['leave.html', 'Leave']]
    },
    subjects: {
      title: 'Subjects & exam boards',
      who: 'Admin/tutor.',
      why: 'WAEC, IGCSE, SAT, IELTS and school subjects share one catalogue so SOW, quizzes and exam registration stay consistent.',
      what: 'Name, default board, level.',
      how: ['Add each subject you teach.', 'When you create an engagement, pick or type the same name.', 'Exam registration boards are a separate public list (WAEC→GRE).'],
      next: [['engagements.html', 'Attach to an engagement'], ['exam-links.html', 'Exam registration']]
    },
    inquiries: {
      title: 'Inquiries / CRM',
      who: 'Admin/tutor. Public apply.html writes here.',
      why: 'Parents request tutoring before they are in the roster. This is the pipeline.',
      what: 'new → contacted → trial_booked → converted / lost. Source can be apply.html or link:CODE.',
      how: ['Read new rows daily.', 'WhatsApp the parent from their phone field.', 'Book a trial and capture a baseline.', 'Convert: create learner + parent + engagement + hour bank.'],
      next: [['apply.html', 'Public form'], ['application-links.html', 'Coded links'], ['trials.html', 'Trials']]
    },
    waitlist: {
      title: 'Waitlist',
      who: 'Admin/tutor.',
      why: 'Hold demand when a group is full or a tutor’s evenings are taken — TutorBird/Teachworks parity, free.',
      what: 'Learner name, subject, 1:1 or group, status waiting/offered/placed/withdrawn.',
      how: ['Add when you cannot seat them this cycle.', 'When a seat frees, set offered, then create the engagement and mark placed.'],
      next: [['engagements.html', 'Place them'], ['inquiries.html', 'CRM']]
    },
    trials: {
      title: 'Trial lessons',
      who: 'Admin/tutor.',
      why: 'A diagnostic trial locks the value-added baseline before anyone pays for a package.',
      what: 'Learner, time, baseline %, fit notes, status booked/done/no_show/converted.',
      how: ['Book from an inquiry.', 'Sit a short diagnostic (or enter the score).', 'Write fit notes.', 'If they convert, copy baseline onto the engagement.'],
      next: [['diagnostics.html', 'Diagnostics'], ['value-added.html', 'Value-added'], ['packages.html', 'Sell hours']]
    },
    bookings: {
      title: 'Cycle bookings (4 × 7 days)',
      who: 'Admin/tutor create. Parent and learner read their own classes.',
      why: 'International tutoring sells in cycles, not “random Tuesdays”. Parents hired you personally — they need date, time, duration and the amount on one screen.',
      what: 'A full booking is 4 cycles of 7 days. Times per cycle × 4 = classes (1→4, 2→8, 3→12). Amount = hourly rate × (minutes/60) × classes. Saving a booking_blocks row fires tc_expand_booking_block, which writes every booking_classes row.',
      how: [
        'Pick learner + engagement (dropdowns, not raw UUIDs).',
        'Set start of cycle 1, times per cycle, duration, rate, weekdays and clock times.',
        'Read the live quote. Save. SQL expands the 28-day timetable.',
        'Everyone sees the same dates on Dashboard, Calendar and Reminders.',
        'Download an .ics from Reminders to drop into Google/Outlook/Apple — no paid Calendar API.'
      ],
      next: [['session-complete.html', 'Mark a class done'], ['reminders.html', 'Remind + ICS'], ['invoices.html', 'Raise the invoice'], ['public-book.html', 'Parent self-book']]
    },
    'session-complete': {
      title: 'Complete a class',
      who: 'Tutor after the lesson.',
      why: 'Parents bought feedback, not silence. Completing also feeds insights and can debit the hour bank.',
      what: 'Pick a scheduled booking class, write what was taught, tick SOW topics. Status becomes done. Feedback appears on parent and learner dashboards.',
      how: ['Select the class.', 'Write feedback.', 'Multi-select SOW topics.', 'Mark complete.', 'Optional: tick the quality checklist (recording link, homework set).'],
      next: [['sow.html', 'Topics'], ['reading.html', 'Next reading'], ['insights.html', 'Insights']]
    },
    sessions: {
      title: 'Sessions',
      who: 'Tutor write. Family read their own.',
      why: 'Ad-hoc lessons (workshops, extras) that are not part of a 4-cycle block still need a row so hours deduct.',
      what: 'Engagement, start/end, mode, meeting URL, whiteboard URL, hours, status. When status becomes done, consume_session_hours deducts the bank.',
      how: ['Add a session.', 'Paste Jitsi/Meet/Zoom and Excalidraw links — we do not host video.', 'Mark done to debit hours.'],
      next: [['meetings.html', 'Meeting links'], ['whiteboard.html', 'Whiteboard'], ['packages.html', 'Hour bank']]
    },
    attendance: {
      title: 'Attendance',
      who: 'Tutor marks. Family reads their own.',
      why: 'Attendance < 80% is at-risk rule 1. Groups mark each learner separately.',
      what: 'session_attendance: present / late / absent / excused + minutes.',
      how: ['Open the session.', 'Mark each learner.', 'Absences feed Insights automatically.'],
      next: [['at-risk.html', 'At-risk board'], ['makeups.html', 'Make-ups']]
    },
    sow: {
      title: 'Scheme of work',
      who: 'Tutor writes. Family can see coverage.',
      why: 'A term without a topic list cannot be evaluated. Groups share the topic list; scores stay individual.',
      what: 'sow_terms → sow_topics → sow_evaluations. Evaluations can push the scoresheet.',
      how: ['Create a term on an engagement.', 'Add week + topic + objectives.', 'Assign reading to the next topic.', 'After class, evaluate each learner (score %).', 'Save evaluation — it writes scoresheet.'],
      next: [['reading.html', 'Reading'], ['session-complete.html', 'Tick after class'], ['scoresheet.html', 'Scoresheet']]
    },
    practice: {
      title: 'Quizzes (Self / Review / Graded)',
      who: 'Tutor creates. Learner sits on Take quiz.',
      why: 'Three kinds exist so practice never pollutes the official ledger.',
      what: 'Self = private practice, off scoresheet. Review = after class, off scoresheet. Graded = official; trigger tc_push_cbt_to_scoresheet writes the ledger. 17 School Connect types + 15 studio extras. Anti-cheat is browser-side (tab focus, block copy, optional camera/audio links).',
      how: ['Paste CSV from a prompt pack (or write items).', 'Set kind, code, duration, subject, engagement.', 'Save. Share the code.', 'Learner opens Take quiz with student ID TC-0001.'],
      next: [['cbt-prompts.html', 'Prompt packs'], ['cbt-exam.html', 'Take quiz'], ['cbt-multi.html', 'Multi-subject'], ['scoresheet.html', 'Scoresheet']]
    },
    'cbt-exam': {
      title: 'Take a quiz',
      who: 'Learner (or parent helping). Public page — student ID, not a typed name.',
      why: 'Typed names collide. The studio already issued TC-0001.',
      what: 'Two access modes, decided by the paper (exam_mode). Registered: only enrolled learners; enter student ID TC-0001; official name loads and is read-only — you never type a name to identify yourself. Open: guests type a display name; registered learners may still enter an ID so the score lands on their scoresheet. Multi-subject papers show subject tabs. Graded trigger writes one scoresheet row per subject plus overall.',
      how: ['Enter the quiz code (also works as ?code=). The paper tells you Registered or Open.', 'Registered: student ID required. Name field fills automatically.', 'Open: ID optional; guests fill the name field only.', 'Start. Timer + anti-cheat. Submit or auto-submit.', 'Review: your answer / correct / explanation + PDF. Graded → scoresheet by subject.'],
      next: [['scoresheet.html', 'Scoresheet'], ['cbt-review.html', 'Review page'], ['practice.html', 'More quizzes']]
    },
    'cbt-prompts': {
      title: 'Question bank prompts',
      who: 'Tutor.',
      why: 'We do not call a paid AI API. You paste a pack into any free chat you already use and paste the CSV back.',
      what: 'Ten packs: Simple, Intermediate, Advanced, Enterprise 17-type, Self, Review, Graded, Reading article, Reading video, Reading pack.',
      how: ['Pick pack, topic, count, level, optional source URL.', 'Build prompt → Copy.', 'Paste into ChatGPT / Gemini / Claude (your account).', 'Paste the CSV into Quizzes.'],
      next: [['practice.html', 'Save as a quiz'], ['reading.html', 'Reading sources']]
    },
    scoresheet: {
      title: 'Scoresheet',
      who: 'Family-safe. Parent = linked children. Learner = self. Tutor = their engagements.',
      why: 'One ledger so parents are not hunting across quizzes, SOW and homework.',
      what: 'source graded_quiz | sow | homework | manual. pct = score/max*100.',
      how: ['Open the page. Optional ?learner= filter.', 'Graded quizzes appear automatically.', 'SOW evaluations push from the SOW page.'],
      next: [['learner-360.html', '360'], ['insights.html', 'Insights']]
    },
    reading: {
      title: 'Reading assignments',
      who: 'Tutor assigns. Learner ticks.',
      why: 'Class time is for thinking. Reading happens first. Loop: read → Self-Quiz → class.',
      what: 'Assignment tied to a SOW topic. Items are article/video/pdf/playlist URLs with previews. No uploads.',
      how: ['Pick engagement + topic.', 'Paste the URL. Preview appears.', 'Save. Learner marks reading_progress done.', 'Set a Self-Quiz from the reading prompt pack.'],
      next: [['sow.html', 'Topics'], ['cbt-prompts.html', 'Reading prompts'], ['practice.html', 'Self-Quiz']]
    },
    forum: {
      title: 'Group forum',
      who: 'Members of a group engagement only.',
      why: '1:1 contracts stay private. Groups need a place to ask without smearing other groups.',
      what: 'forum_threads + forum_posts scoped by engagement_id. Only kind=group appears in the picker.',
      how: ['Pick the group.', 'Open a thread.', 'Reply. Pin important threads as tutor.'],
      next: [['groups.html', 'Groups'], ['stream.html', 'Stream']]
    },
    stream: {
      title: 'Class stream',
      who: 'Tutor posts. Members read.',
      why: 'Google Classroom-style feed without Gemini or file uploads.',
      what: 'Announcements, questions, materials. publish_at for scheduled posts. media_url is a link with thumbnail.',
      how: ['Pick engagement.', 'Choose kind, title, body, optional future publish time, media URL.', 'Post. Learners see it newest first.'],
      next: [['classwork.html', 'Classwork'], ['announcements.html', 'Practice-wide notices']]
    },
    classwork: {
      title: 'Classwork',
      who: 'Tutor sets. Learner submits a Drive link.',
      why: 'Work organised by topic. Comment-only return (blank points) is supported — Classroom parity, no Gemini.',
      what: 'topic, kind assignment/quiz/material, due, points (null = comment only), skills tags, media URL.',
      how: ['Add the item.', 'Leave points blank for comment-only.', 'Tag skills (algebra, exam-technique).', 'Learner returns a Drive link on Homework.'],
      next: [['assignments.html', 'Homework'], ['sow.html', 'Topics'], ['rubrics.html', 'Rubrics']]
    },
    insights: {
      title: 'Insights Lab',
      who: 'Tutor and parent (family-safe).',
      why: 'Parents hired you for progress they can see. Formulas are readable — no AI black box.',
      what: 'value_added = current_avg − baseline. prediction = OLS on last N scores projected to exam date. Six at-risk rules: attendance<80%, idle≥14d, hours<2, homework<60%, last 3 declining, >40% topics <50%.',
      how: ['Open the lab. Sample charts show even without data.', 'Connect Supabase for live scores.', 'Drill into one child on Learner 360.'],
      next: [['learner-360.html', '360'], ['at-risk.html', 'Rules'], ['predictions.html', 'OLS'], ['value-added.html', 'Baseline delta']]
    },
    'learner-360': {
      title: 'Learner 360',
      who: 'Tutor; parent for linked children; learner for self.',
      why: 'One page instead of eight tabs.',
      what: 'Identity, student ID, engagements, recent scores, hours, flags.',
      how: ['Pick the learner (or arrive with ?learner=).', 'Jump to scoresheet or classes.'],
      next: [['scoresheet.html', 'Scoresheet'], ['bookings.html', 'Classes'], ['study-log.html', 'Study log']]
    },
    analytics: {
      title: 'Practice analytics',
      who: 'Admin.',
      why: 'Studio-level decisions: conversion, utilisation, revenue, score bands.',
      what: 'Counts from learners, tutors, engagements, sessions, quizzes, inquiries, payments. Chart.js or SVG bars if the CDN is blocked.',
      how: ['Open the page. Tiles fill from Supabase.', 'Read the insight cards at the bottom.'],
      next: [['insights.html', 'Per-learner'], ['inquiries.html', 'Funnel']]
    },
    packages: {
      title: 'Hour banks / packages',
      who: 'Admin. Parent sees their bank.',
      why: 'TutorCruncher/TutorBird prepaid hours — without their monthly fee. Completing a session deducts via consume_session_hours.',
      what: 'Package name, hours, price, purchased_on, status active/exhausted/expired. hour_ledger records every delta.',
      how: ['Create a package on the engagement.', 'Teach. Mark session done.', 'Hours used rise. When low, Insights flags hours<2.'],
      next: [['sessions.html', 'Sessions'], ['invoices.html', 'Invoice the pack']]
    },
    invoices: {
      title: 'Invoices',
      who: 'Admin write. Parent reads own.',
      why: 'From a 4-cycle quote or a package. Multi-currency. Printable.',
      what: 'parent, engagement, amount, currency, due, status draft/sent/paid/overdue/void. Late-fee policy can add a percent after due_on.',
      how: ['Create from the booking quote.', 'Mark sent. Compose a WhatsApp/email from Reminders.', 'Record a payment when money lands.'],
      next: [['payments.html', 'Record payment'], ['reminders.html', 'Chase overdue'], ['fees.html', 'Rate card']]
    },
    payments: {
      title: 'Payments',
      who: 'Admin. Parent sees history.',
      why: 'We do not force Paystack/Stripe. Record bank/cash or paste a checkout link.',
      what: 'invoice, amount, method bank/cash/paystack/flutterwave/stripe/other, reference, paid_on.',
      how: ['Add the row when paid.', 'Print a receipt from payment history.'],
      next: [['payment-history.html', 'History'], ['invoices.html', 'Invoices']]
    },
    inbox: {
      title: 'In-app inbox',
      who: 'All signed-in roles.',
      why: 'Private threads with a paper trail. Also fires the notification bell.',
      what: 'messages: to_role, subject, body.',
      how: ['Compose to a role.', 'For WhatsApp/email/SMS fan-out use Messages or Reminders.'],
      next: [['messages.html', 'Free channels'], ['notifications.html', 'Bell']]
    },
    messages: {
      title: 'Messaging (WhatsApp / email / SMS)',
      who: 'Tutor/admin.',
      why: 'No Twilio bill. Device-native compose: wa.me, mailto, sms.',
      what: 'Build a message, open the OS composer. Confirm flags TC_CONFIRM_FREE_* in config.js.',
      how: ['Write title + body.', 'Click WhatsApp / Email / SMS.', 'Send from your phone or mail app.'],
      next: [['reminders.html', 'Class reminders'], ['broadcasts.html', 'Result broadcast']]
    },
    notifications: {
      title: 'Notification centre',
      who: 'Everyone.',
      why: 'Bell + optional browser push after PWA install. Audience filters keep family messages closed.',
      what: 'in-app, push, email/WA/SMS compose. Realtime INSERT on notifications.',
      how: ['Enable browser push if you installed the app.', 'Mark all read.', 'Admins create notices with an audience.'],
      next: [['install.html', 'Install the app'], ['announcements.html', 'Announcements']]
    },
    voting: {
      title: 'Voting & polls',
      who: 'Tutor creates. Family votes.',
      why: 'Schedule votes, topic votes, anonymous parent polls — School Connect voting, tutoring-sized.',
      what: 'Single/multi/ranked. Anonymous mode. Live tally.',
      how: ['Create a poll.', 'Share. Cast a ballot.', 'Watch the tally.'],
      next: [['polls.html', 'Simple polls'], ['surveys.html', 'Longer surveys']]
    },
    apply: {
      title: 'Public inquiry / application',
      who: 'Anyone. No account required.',
      why: 'Parents request a place. Coded links (?code=) support campaigns per subject.',
      what: 'Without a code → inquiries insert. With a code → tc_submit_application (expiry, max uses, counter, then inquiries).',
      how: ['Open apply.html or apply.html?code=igcse-maths.', 'Fill parent + learner + subject + timezone.', 'Submit. Studio converts via Inquiries.'],
      next: [['application-links.html', 'Create a code'], ['inquiries.html', 'Pipeline'], ['public-book.html', 'Self-book a slot']]
    },
    'application-links': {
      title: 'Application links',
      who: 'Admin.',
      why: 'One form, many campaigns. Each code has copy, expiry, max uses.',
      what: 'application_links + applications.',
      how: ['Create a code.', 'Share apply.html?code=…', 'Watch the use counter.'],
      next: [['apply.html', 'Public form']]
    },
    'exam-links': {
      title: 'Exam registration links',
      who: 'Admin/tutor.',
      why: 'Studios also register candidates for WAEC, NECO, UTME, IGCSE, IELTS, SAT, GRE, GMAT, JUPEB…',
      what: 'Shareable codes. Passport is a Drive link with preview — never an upload.',
      how: ['Create a link.', 'Share exam-register.html?code=…', 'Review registrations on this page.'],
      next: [['exam-register.html', 'Public form']]
    },
    'exam-register': {
      title: 'Public exam form',
      who: 'Candidates. No account required.',
      why: 'Local + international boards on one form.',
      what: 'Name, student ID, contacts, board, series, centre, subjects, Drive passport + supporting doc.',
      how: ['Pick the board.', 'Paste the Drive passport URL — preview appears.', 'Submit.'],
      next: [['exam-links.html', 'Staff links']]
    },
    settings: {
      title: 'Settings',
      who: 'Admin/owner.',
      why: 'Brand, timezone, currency, cancellation hours, idle lock. Logo is a URL.',
      what: 'practice_settings id=1. Also 2FA via Supabase email OTP, dark mode, high contrast.',
      how: ['Edit fields. Preview the logo.', 'Save. Every page hydrates the brand.', 'Idle minutes = 0 disables auto-lock.'],
      next: [['platform-health.html', 'Lockdown + heartbeat'], ['profile.html', 'Your profile']]
    },
    'admin-data': {
      title: 'Admin data',
      who: 'Owner.',
      why: 'You own the data. Export is always available. Drive sync uses GIS + drive.file only.',
      what: 'Local JSON backup/restore, SHA-256 sealed portable archives, Google Drive backup, table browser.',
      how: ['Export a sealed archive.', 'Optional: connect Drive (see docs/GOOGLE-DRIVE-SYNC-GUIDE.md).', 'Restore into the same or a new project.'],
      next: [['storage.html', '500 MB watch'], ['platform-health.html', 'Health']]
    },
    'platform-health': {
      title: 'Platform health',
      who: 'Owner.',
      why: 'Free Supabase pauses after ~7 idle days. This page proves keep-alive is writing.',
      what: 'Last heartbeat, ping count, source, manual 💓, emergency lockdown, login audit.',
      how: ['Press 💓 before a holiday.', 'Confirm last_source updates.', 'Toggle lockdown only in an incident.'],
      next: [['admin-data.html', 'Backups'], ['license.html', 'License']]
    },
    reminders: {
      title: 'Lesson reminders + calendar (.ics)',
      who: 'Tutor/admin. Parents can download their own .ics.',
      why: 'TutorBird and Teachworks charge for SMS/email reminders and Google Calendar sync. We compose wa.me / mailto / sms and download a standard .ics that Google, Outlook and Apple Calendar import — no paid API.',
      what: 'Upcoming booking_classes, one-click channel compose, .ics file for the next 4 cycles.',
      how: [
        'Page loads scheduled classes.',
        'Click WhatsApp / Email / SMS to open your device composer with date, time and duration already written.',
        'Click Download .ics and import into Google Calendar (Settings → Import) or Outlook/Apple.',
        'Parents: same file works on a phone.'
      ],
      next: [['bookings.html', 'Cycle bookings'], ['calendar.html', 'Calendar'], ['messages.html', 'Free channels']]
    },
    'study-log': {
      title: 'Study log / session timer',
      who: 'Learner (and tutor reviewing).',
      why: 'TutorBird’s study log with timer. Spaced practice needs minutes on task, not just class time. No AI.',
      what: 'Start/stop a timer per learner + subject. Rows store minutes, topic, notes. Feeds homework diligence.',
      how: ['Pick subject/topic.', 'Start. Study. Stop.', 'Save notes. Tutor sees the log on 360.'],
      next: [['flashcards.html', 'Spaced cards'], ['reading.html', 'Reading'], ['learner-360.html', '360']]
    },
    'makeup-credits': {
      title: 'Makeup credit bank',
      who: 'Admin/tutor write. Parent reads their balance.',
      why: 'TutorBird makeup credits: when the studio cancels inside policy, the family earns a credit instead of losing a class. Spent on a makeup session.',
      what: 'Ledger: +credit when we cancel, −credit when a makeup is taken. Never smeared across siblings — credit is per engagement.',
      how: ['When you cancel, add a +1 credit on this engagement.', 'When you run the makeup, add a −1 and create the session.', 'Balance = sum of deltas.'],
      next: [['makeups.html', 'Make-up sessions'], ['cancellations.html', 'Cancellations']]
    },
    'public-book': {
      title: 'Public self-booking',
      who: 'Parents. No login required to request a slot; admin confirms.',
      why: 'TutorBird/Calendly-style open slots without a Calendly bill. Requests land as inquiries + a proposed booking.',
      what: 'Shows tutor availability. Parent picks a weekday/time, leaves contact details. You confirm and expand a 4-cycle block.',
      how: ['Publish this page.', 'Parent picks a slot and submits.', 'You see it under Inquiries.', 'Convert to a cycle booking.'],
      next: [['availability.html', 'Set availability'], ['bookings.html', 'Confirm the cycle'], ['apply.html', 'Full application']]
    },
    calendar: {
      title: 'Calendar',
      who: 'All roles (family-safe).',
      why: 'See sessions and 4-cycle classes in one place. Timezone-aware display; stored in UTC.',
      what: 'Upcoming sessions + booking_classes.',
      how: ['Open the page.', 'Export .ics from Reminders for Google/Outlook/Apple.'],
      next: [['reminders.html', 'ICS + reminders'], ['bookings.html', 'Create a cycle']]
    },
    profile: {
      title: 'My profile',
      who: 'Signed-in user.',
      why: 'Name, phone, timezone, Drive photo. Password via change-password / Supabase.',
      what: 'Updates profiles row.',
      how: ['Edit and save.', 'Photo is a link, never an upload.'],
      next: [['change-password.html', 'Password'], ['notifications.html', 'Bell']]
    },
    'feature-guide': {
      title: 'Feature guide',
      who: 'Everyone.',
      why: 'Every module in the catalogue, grouped, with the why.',
      what: 'Generated from TC.MODULES live.',
      how: ['Scroll by group.', 'Click a card to open the module.', 'Ask the assistant “what is X”.'],
      next: [['hmg-ecosystem.html', 'HMG'], ['developer.html', 'Founder']]
    },
    'hmg-ecosystem': {
      title: 'HMG Concepts Ecosystem',
      who: 'Everyone — also public SEO.',
      why: 'Tutoring Connect is a product of HMG Technologies, subsidiary of HMG Concepts (His Marvellous Grace). Founder Adewale Samson Adeagbo.',
      what: 'Links to Concepts, Technologies, Academy, Media, Gospel, founder site, WhatsApp +234 810 086 6322.',
      how: ['Share these links. JSON-LD on the public home also points here.'],
      next: [['about.html', 'About this studio'], ['developer.html', 'Developer']]
    },
    about: {
      title: 'About this studio',
      who: 'Public. SEO page.',
      why: 'Google should index the studio AND the HMG ecosystem.',
      what: 'Studio name, motto, Sign in, Apply, HMG attribution.',
      how: ['Keep motto and address current in Settings / config.js.'],
      next: [['login.html', 'Sign in'], ['apply.html', 'Apply']]
    },
    login: {
      title: 'Sign in',
      who: 'Everyone.',
      why: 'Email, name or student ID TC-0001. New accounts wait for approval so strangers cannot see family data.',
      what: 'Supabase Auth. lookup_login_email resolves IDs. Password meter is local.',
      how: ['Sign in, or Request access (pick your role).', 'Confirm email.', 'Wait for Approvals if you are new.'],
      next: [['forgot-password.html', 'Reset password'], ['approvals.html', 'Admin: approve'], ['apply.html', 'No account? Apply']]
    },
    install: {
      title: 'Install the app',
      who: 'Parents, learners, tutors.',
      why: 'PWA: home screen, offline shell, push after install. No app-store fee.',
      what: 'Chrome/Edge/Android native prompt. iOS: Share → Add to Home Screen.',
      how: ['Tap Install on the banner.', 'iPhone must use Safari.'],
      next: [['notifications.html', 'Enable push'], ['offline.html', 'Offline page']]
    },
    'availability': {
      title: 'Tutor availability',
      who: 'Admin/tutor.',
      why: 'Self-booking and conflict checks need a weekly availability table in the tutor’s own timezone.',
      what: 'Repeating weekly slots. Public self-booking reads open slots; Calendar warns on clashes.',
      how: ['Add the days/times you teach each week.', 'Parents can only request slots inside these windows.', 'Adjust before each cycle.'],
      next: [['bookings.html', 'Self-booking'], ['public-book.html', 'Public booking page']]
    },
    'makeups': {
      title: 'Make-up sessions',
      who: 'Admin/tutor.',
      why: 'Policy-aware rescheduling protects both the family and the studio.',
      what: 'Records the original session, the reason, who cancelled, and whether hours were restored or a makeup credit was earned.',
      how: ['Open the missed class.', 'Choose who cancelled and the notice given.', 'The system suggests the credit action.', 'Schedule the makeup.'],
      next: [['makeup-credits.html', 'Credit bank'], ['cancellations.html', 'Cancellations']]
    },
    'cancellations': {
      title: 'Cancellations',
      who: 'Admin/tutor. Parents see their own.',
      why: 'Transparent cancellation history prevents billing disputes.',
      what: 'Who cancelled, notice hours, fee applied, hours returned, linked makeup.',
      how: ['Record the cancellation against the class.', 'Set the notice window in Settings.', 'Fees appear on the next invoice.'],
      next: [['makeups.html', 'Make-ups'], ['invoices.html', 'Invoice']]
    },
    'session-notes': {
      title: 'Session notes',
      who: 'Tutor writes; admin and linked parent/learner read.',
      why: 'A per-class narrative feeds progress reports and the parent portal.',
      what: 'Note per session and optionally per learner, with a Drive recording link.',
      how: ['Open the class.', 'Write what was taught and next steps.', 'Tick "share with parent" to surface it on the dashboard.'],
      next: [['session-complete.html', 'Complete a class'], ['progress-reports.html', 'Reports']]
    },
    'session-complete': {
      title: 'Complete a class',
      who: 'Tutor.',
      why: 'Marking a class done is what deducts hours, ticks SOW topics and pushes feedback to families.',
      what: 'Status, hours used, topics covered, feedback, attendance.',
      how: ['Open the class.', 'Mark each learner present/late/absent.', 'Tick the SOW topics taught.', 'Write feedback and save.'],
      next: [['sow.html', 'Scheme of work'], ['attendance.html', 'Attendance']]
    },
    'meetings': {
      title: 'Meeting links',
      who: 'Admin/tutor.',
      why: 'A standing room per engagement means the same Jitsi/Meet/Zoom link every class — no paid classroom iframe.',
      what: 'Per-session or standing meeting URL plus a whiteboard URL.',
      how: ['Paste a free Jitsi/Meet link.', 'Optionally paste an Excalidraw whiteboard.', 'Families click through from the dashboard.'],
      next: [['whiteboard.html', 'Whiteboard rooms'], ['sessions.html', 'Sessions']]
    },
    'whiteboard': {
      title: 'Whiteboard rooms',
      who: 'Tutor/learner during class.',
      why: 'Free Excalidraw / Jamboard / FigJam links replace a paid whiteboard subscription.',
      what: 'Named board links per engagement, opened in a new tab.',
      how: ['Paste the shared board URL.', 'Learners open it from the class reminder.', 'Save the link once.'],
      next: [['meetings.html', 'Meeting links']]
    },
    'rooms': {
      title: 'Rooms / locations',
      who: 'Admin/tutor.',
      why: 'For hybrid studios that also teach in person, rooms avoid double-booking.',
      what: 'Room name, capacity, address or video link.',
      how: ['Add each room.', 'Assign it on sessions.', 'Calendar flags clashes.'],
      next: [['sessions.html', 'Sessions'], ['calendar.html', 'Calendar']]
    },
    'timezones': {
      title: 'Timezone desk',
      who: 'Everyone.',
      why: 'A Lagos tutor teaching a London family must see both clocks before booking.',
      what: 'Converter between the studio timezone and any learner/parent timezone.',
      how: ['Pick the two timezones.', 'Choose a time. The equivalent is shown instantly.', 'Use it when arranging a class.'],
      next: [['availability.html', 'Availability'], ['bookings.html', 'Bookings']]
    },
    'diagnostics': {
      title: 'Diagnostic baseline',
      who: 'Admin/tutor.',
      why: 'The baseline is the start point for every value-added calculation.',
      what: 'Initial assessment score per learner, captured at trial or onboarding.',
      how: ['Sit a short diagnostic.', 'Enter the percentage.', 'It locks the value-added starting point.'],
      next: [['trials.html', 'Trials'], ['value-added.html', 'Value-added']]
    },
    'goals': {
      title: 'Goals & learning plans',
      who: 'Tutor (shared with the family).',
      why: 'SMART goals turn "improve maths" into reviewable targets.',
      what: 'Goal, owner, target date, status, review notes — per engagement and per learner.',
      how: ['Add a goal.', 'Set the review date.', 'Update status each cycle.'],
      next: [['progress-reports.html', 'Reports'], ['learner-360.html', '360 view']]
    },
    'mastery': {
      title: 'Topic mastery',
      who: 'Tutor; learner/parent see progress.',
      why: 'A heatmap shows exactly which topics are green, amber or red.',
      what: 'Per-topic score 0–100, independent even inside a group.',
      how: ['Add topics from the SOW.', 'Score after each topic.', 'Red cells drive the next lessons.'],
      next: [['sow.html', 'Scheme of work'], ['at-risk.html', 'At-risk']]
    },
    'methodologies': {
      title: 'Methodologies library',
      who: 'Tutor.',
      why: 'Consistent teaching methods (spaced retrieval, worked examples, CRA…) can be attached to engagements and suggested by at-risk rules.',
      what: 'Named method, description, when to use it.',
      how: ['Add your methods.', 'Attach one to an engagement.', 'Insights recommends a method per at-risk flag.'],
      next: [['engagements.html', 'Engagements'], ['insights.html', 'Insights']]
    },
    'curriculum': {
      title: 'Curriculum maps',
      who: 'Admin/tutor.',
      why: 'An independent map per engagement means two siblings never share a sequence by accident.',
      what: 'Topics, sequence and coverage status per engagement.',
      how: ['Pick the engagement.', 'Add or import topics.', 'Tick coverage weekly.'],
      next: [['sow.html', 'Scheme of work'], ['lesson-plans.html', 'Lesson plans']]
    },
    'lesson-plans': {
      title: 'Lesson plans',
      who: 'Tutor.',
      why: 'Objectives, resources and checks for understanding keep each class focused.',
      what: 'Plan linked to a session and a methodology, with resources as links.',
      how: ['Create the plan.', 'Link it to the session.', 'Reflect after class.'],
      next: [['sessions.html', 'Sessions'], ['methodologies.html', 'Methods']]
    },
    'assignments': {
      title: 'Homework / assignments',
      who: 'Tutor sets; learner submits; parent sees status.',
      why: 'Completion percentage feeds the at-risk rules.',
      what: 'Title, due date, Drive submission link, status (set/submitted/marked), score.',
      how: ['Set the work with a Drive return link.', 'Learner submits.', 'Mark and the score flows to mastery.'],
      next: [['mastery.html', 'Mastery'], ['at-risk.html', 'At-risk']]
    },
    'practice': {
      title: 'Quizzes / CBT manager',
      who: 'Tutor builds; learner sits.',
      why: 'Self, Review and Graded papers with 32 question types — no paid CBT platform.',
      what: 'Quiz builder, CSV import, kind, access mode, timer, anti-cheat.',
      how: ['Paste CSV from question prompts.', 'Pick Self/Review/Graded and Open/Registered.', 'Share the code.', 'Graded auto-pushes to the scoresheet.'],
      next: [['cbt-exam.html', 'Take quiz'], ['cbt-prompts.html', 'Question prompts']]
    },
    'cbt-prompts': {
      title: 'Question bank prompts',
      who: 'Tutor.',
      why: 'Copy-paste prompts produce CSV questions in any free chat — the platform never pays for AI.',
      what: 'Packs for Simple/Intermediate/Advanced/Self/Review/Graded/Reading.',
      how: ['Choose the pack.', 'Copy the prompt.', 'Paste the returned CSV into Quizzes.'],
      next: [['practice.html', 'CBT manager'], ['cbt-exam.html', 'Take quiz']]
    },
    'cbt-multi': {
      title: 'Multi-subject CBT',
      who: 'Learner.',
      why: 'UTME-style one sitting with subject tabs and a shared timer.',
      what: 'Subject tabs, per-subject breakdown, same anti-cheat as a single paper.',
      how: ['Enter the code and student ID.', 'Move between tabs.', 'Submit once.'],
      next: [['cbt-exam.html', 'Single quiz'], ['scoresheet.html', 'Scoresheet']]
    },
    'cbt-review': {
      title: 'Quiz review + PDF',
      who: 'Learner.',
      why: 'After each quiz the learner sees their answer, the key and the explanation, then saves a study PDF.',
      what: 'Item-by-item review with score and per-subject breakdown; print to PDF.',
      how: ['Finish a quiz.', 'Read every explanation.', 'Use Print → Save as PDF.'],
      next: [['cbt-exam.html', 'Take quiz'], ['scoresheet.html', 'Scoresheet']]
    },
    'progress-reports': {
      title: 'Progress reports',
      who: 'Tutor writes; parent reads.',
      why: 'Parent-ready branded reports: hours, attendance, mastery, value-added and next steps.',
      what: 'Generated report with methodology used and next steps; printable.',
      how: ['Pick the learner and engagement.', 'Review the auto-filled numbers.', 'Add narrative and print.'],
      next: [['learner-360.html', '360 view'], ['insights.html', 'Insights']]
    },
    'learner-360': {
      title: 'Learner 360',
      who: 'Tutor/admin; parent sees their child.',
      why: 'One page for identity, engagements, hours, scores, mastery, flags, notes and invoices.',
      what: 'Consolidated profile with charts and at-risk flags.',
      how: ['Open a learner.', 'Switch engagements.', 'Drill into scores or flags.'],
      next: [['insights.html', 'Insights'], ['progress-reports.html', 'Reports']]
    },
    'group-insights': {
      title: 'Group insights (fairness)',
      who: 'Tutor/admin.',
      why: 'A group average can hide a child who is falling behind; this view shows each member.',
      what: 'Per-member scores, attendance and mastery within a group engagement.',
      how: ['Open the group.', 'Sort by lowest score.', 'Plan intervention.'],
      next: [['groups.html', 'Groups'], ['at-risk.html', 'At-risk']]
    },
    'at-risk': {
      title: 'At-risk board',
      who: 'Tutor/admin.',
      why: 'Six transparent rules catch learners before they fail: attendance <80%, idle ≥14d, hours <2, homework <60%, three declining scores, >40% topics under 50%.',
      what: 'Flagged learners with the rule that fired and a suggested methodology.',
      how: ['Open the board.', 'Click a flag.', 'Follow the suggested action.'],
      next: [['insights.html', 'Insights'], ['methodologies.html', 'Methods']]
    },
    'exam-targets': {
      title: 'Exam targets',
      who: 'Tutor/learner.',
      why: 'A target exam, date and board drives a countdown and predicted-vs-target grade on the dashboard.',
      what: 'Exam, board, target grade, target date per learner.',
      how: ['Set the exam and date.', 'Track predicted grade against target.', 'Countdown shows on the dashboard.'],
      next: [['predictions.html', 'Predictions'], ['exam-links.html', 'Exam registration']]
    },
    'predictions': {
      title: 'Predicted grades',
      who: 'Tutor/parent.',
      why: 'An ordinary-least-squares projection from the last N scores, shown transparently — no black-box AI.',
      what: 'Predicted %, slope, and the formula used.',
      how: ['Open a learner.', 'Read the projection.', 'Adjust teaching if the slope is negative.'],
      next: [['exam-targets.html', 'Targets'], ['insights.html', 'Insights']]
    },
    'value-added': {
      title: 'Value-added',
      who: 'Tutor/admin.',
      why: 'Current average minus diagnostic baseline is the number parents actually buy.',
      what: 'Delta per learner and per engagement, over time.',
      how: ['Run a diagnostic first.', 'Teach.', 'Watch the delta rise.'],
      next: [['diagnostics.html', 'Diagnostics'], ['progress-reports.html', 'Reports']]
    },
    'analytics': {
      title: 'Practice analytics',
      who: 'Owner/admin.',
      why: 'Studio KPIs: utilisation, conversion, revenue, value-added distribution, retention.',
      what: 'Charts (Chart.js with SVG fallback) across the whole practice.',
      how: ['Open Analytics.', 'Filter by date or engagement.', 'Export figures for planning.'],
      next: [['insights.html', 'Insights'], ['finance.html', 'Finance']]
    },
    'resources': {
      title: 'Resource library',
      who: 'Tutor curates; everyone reads.',
      why: 'Catalogued links to articles, videos and past papers — never uploads into the 500 MB DB.',
      what: 'Link, subject, engagement, type, optional comprehension score.',
      how: ['Paste a Drive/YouTube/https link.', 'Tag subject and engagement.', 'Learners open it from Reading.'],
      next: [['reading.html', 'Reading'], ['library.html', 'Digital library']]
    },
    'library': {
      title: 'Digital library',
      who: 'Tutor curates; learners browse.',
      why: 'A searchable catalogue of reading and past-paper links.',
      what: 'Catalogue entry with link, subject, level.',
      how: ['Add a link.', 'Search by subject.', 'Open in a new tab.'],
      next: [['eresources.html', 'E-resources'], ['resources.html', 'Resources']]
    },
    'lms': {
      title: 'Mini LMS',
      who: 'Tutor builds; learner completes.',
      why: 'Lightweight courses and lessons scoped to an engagement, with completion ticks.',
      what: 'Course → lessons (links), completion tracking.',
      how: ['Create a course.', 'Add lesson links.', 'Learners tick completion.'],
      next: [['classwork.html', 'Classwork'], ['stream.html', 'Stream']]
    },
    'eresources': {
      title: 'E-resources / notes',
      who: 'Tutor; learners.',
      why: 'Study notes as Drive or web links, organised by subject and engagement.',
      what: 'Link, subject, engagement, description.',
      how: ['Paste a link.', 'Tag it.', 'Share with the engagement.'],
      next: [['library.html', 'Library'], ['resources.html', 'Resources']]
    },
    'flashcards': {
      title: 'Flashcards (spaced practice)',
      who: 'Learner.',
      why: 'SM-2 style spaced retrieval improves retention without a paid app.',
      what: 'Decks of cards; rating schedules the next review.',
      how: ['Open a deck.', 'Rate each card.', 'Cards return at increasing intervals.'],
      next: [['practice.html', 'Quizzes'], ['study-log.html', 'Study log']]
    },
    'certificates': {
      title: 'Certificates',
      who: 'Admin/tutor issues; learner downloads.',
      why: 'Branded completion certificates reward milestones and are printable.',
      what: 'Certificate template, learner, engagement, date.',
      how: ['Issue after a target is met.', 'Learner downloads/prints.'],
      next: [['progress-reports.html', 'Reports']]
    },
    'portfolio': {
      title: 'Learner portfolio',
      who: 'Learner/tutor; parent views.',
      why: 'A showcase of best work, all as links.',
      what: 'Curated items with title, link and reflection.',
      how: ['Add standout work.', 'Reflect on progress.', 'Share with parents.'],
      next: [['progress-reports.html', 'Reports']]
    },
    'packages': {
      title: 'Hour banks / packages',
      who: 'Admin.',
      why: 'Prepaid hours are the financial unit. Completing a class deducts from the bank.',
      what: 'Hours prepaid, price, engagement; trigger writes hour_ledger.',
      how: ['Sell a package.', 'Teach classes.', 'Watch hours_used rise.'],
      next: [['invoices.html', 'Invoices'], ['sessions.html', 'Sessions']]
    },
    'invoices': {
      title: 'Invoices',
      who: 'Admin; parent pays.',
      why: 'Invoices from cycle bookings or packages, multi-currency, printable.',
      what: 'Line items, amount, status, due date.',
      how: ['Generate from a booking or package.', 'Send the invoice.', 'Record payment.'],
      next: [['payments.html', 'Payments'], ['bookings.html', 'Bookings']]
    },
    'payments': {
      title: 'Payments',
      who: 'Admin records; parent sees.',
      why: 'Bank/cash/Paystack/Flutterwave/Stripe links — no forced processor.',
      what: 'Payment against an invoice, method, reference.',
      how: ['Record the payment.', 'Attach a processor link.', 'Parent sees the receipt.'],
      next: [['invoices.html', 'Invoices'], ['payment-history.html', 'History']]
    },
    'payment-history': {
      title: 'Payment history',
      who: 'Parent; admin.',
      why: 'A family sees every invoice and payment in one place.',
      what: 'Ledger of invoices and payments for linked learners.',
      how: ['Open the page.', 'Filter by date.', 'Download a receipt.'],
      next: [['invoices.html', 'Invoices']]
    },
    'fees': {
      title: 'Fee catalogue',
      who: 'Admin.',
      why: 'Standard hourly rates and package prices speed up invoicing.',
      what: 'Named fee, amount, currency, scope.',
      how: ['Add your standard fees.', 'Pick them when invoicing.'],
      next: [['packages.html', 'Packages'], ['invoices.html', 'Invoices']]
    },
    'finance': {
      title: 'Finance',
      who: 'Owner/admin.',
      why: 'Double-entry-style ledger plus revenue and outstanding figures.',
      what: 'finance_entries plus invoice/payment roll-ups.',
      how: ['Record income and costs.', 'Review the monthly roll-up.'],
      next: [['payroll.html', 'Payroll'], ['analytics.html', 'Analytics']]
    },
    'payroll': {
      title: 'Tutor payroll',
      who: 'Owner/admin.',
      why: 'For staff tutors, hours taught × pay rate gives an estimated payroll.',
      what: 'Sessions × hourly_cost per tutor.',
      how: ['Set tutor pay rates.', 'Mark classes done.', 'Review the payroll report.'],
      next: [['tutors.html', 'Tutors'], ['finance.html', 'Finance']]
    },
    'scholarships': {
      title: 'Scholarships & discounts',
      who: 'Admin.',
      why: 'Track discounts and scholarships per engagement without losing revenue visibility.',
      what: 'Discount code/name, percent or amount, recipient.',
      how: ['Add a scholarship.', 'Apply it on an invoice.'],
      next: [['fees.html', 'Fees'], ['invoices.html', 'Invoices']]
    },
    'announcements': {
      title: 'Announcements',
      who: 'Admin/tutor post; families read.',
      why: 'Studio-wide or per-engagement notices in the bell and feed.',
      what: 'Title, body, audience, optional scheduled date.',
      how: ['Write the notice.', 'Pick the audience.', 'Publish or schedule.'],
      next: [['notifications.html', 'Notifications'], ['stream.html', 'Stream']]
    },
    'messages': {
      title: 'Messages',
      who: 'All roles.',
      why: 'Free device-native messaging via wa.me, mailto and sms: — no Twilio bill.',
      what: 'Compose window that opens the device app with the text pre-filled.',
      how: ['Write the message.', 'Pick WhatsApp/Email/SMS.', 'Your device sends it.'],
      next: [['inbox.html', 'Inbox'], ['notifications.html', 'Notifications']]
    },
    'inbox': {
      title: 'Inbox',
      who: 'All roles.',
      why: 'In-app tutor ↔ parent ↔ learner threads, with a bell for new items.',
      what: 'Threads scoped to an engagement, with read state.',
      how: ['Open a thread.', 'Reply.', 'The bell clears when read.'],
      next: [['messages.html', 'Messages'], ['notifications.html', 'Notifications']]
    },
    'complaints': {
      title: 'Complaints',
      who: 'Parent/learner raises; admin resolves.',
      why: 'A formal, auditable complaint record builds trust.',
      what: 'Subject, body, status (open/in_progress/resolved).',
      how: ['Raise a complaint.', 'Admin responds.', 'Resolve and close.'],
      next: [['helpdesk.html', 'Help desk'], ['approvals.html', 'Approvals']]
    },
    'surveys': {
      title: 'Surveys',
      who: 'Admin sends; families respond.',
      why: 'After-trial and end-of-term pulse surveys feed retention insight.',
      what: 'Question set, audience, open/closed, responses.',
      how: ['Create a survey.', 'Share it.', 'Review responses.'],
      next: [['voting.html', 'Polls'], ['analytics.html', 'Analytics']]
    },
    'polls': {
      title: 'Simple polls',
      who: 'Admin/tutor asks; families vote.',
      why: 'Quick single-question polls alongside the richer Voting module.',
      what: 'Question, options, tally.',
      how: ['Ask a question.', 'Share.', 'Watch the tally.'],
      next: [['voting.html', 'Voting'], ['surveys.html', 'Surveys']]
    },
    'voting': {
      title: 'Voting & polls',
      who: 'Tutors create; parents/learners vote.',
      why: 'Anonymous or named polls with live real-time tally — no paid polling tool.',
      what: 'Poll, candidates, single/multi/ranked, audience, open/closed.',
      how: ['Create a poll.', 'Share the link.', 'Watch results live.'],
      next: [['announcements.html', 'Announcements'], ['surveys.html', 'Surveys']]
    },
    'forum': {
      title: 'Group forum',
      who: 'Group members only.',
      why: 'Discussion threads scoped to a group engagement; 1:1 contracts have no forum.',
      what: 'Threads and posts within a group.',
      how: ['Open the group.', 'Start a thread.', 'Reply.'],
      next: [['groups.html', 'Groups'], ['stream.html', 'Stream']]
    },
    'parent-meetings': {
      title: 'Parent conferences',
      who: 'Admin schedules; parents book.',
      why: 'Structured parent–teacher conferences with slots.',
      what: 'Meeting slots, bookings, agenda.',
      how: ['Open slots.', 'Parents book.', 'Hold the meeting online or in person.'],
      next: [['meetings.html', 'Meeting links'], ['calendar.html', 'Calendar']]
    },
    'reviews': {
      title: 'Reviews / testimonials',
      who: 'Parents leave; admin publishes.',
      why: 'Public reviews on the landing page build trust.',
      what: 'Rating, quote, author, published flag.',
      how: ['Request a review.', 'Approve for the public page.'],
      next: [['referrals.html', 'Referrals'], ['about.html', 'About']]
    },
    'broadcasts': {
      title: 'Result broadcasts',
      who: 'Admin/tutor.',
      why: 'Send graded results to parents in one action across multiple channels.',
      what: 'Bulk message with results summary, via wa.me/mailto/sms.',
      how: ['Pick the engagement/quiz.', 'Compose the summary.', 'Broadcast.'],
      next: [['scoresheet.html', 'Scoresheet'], ['announcements.html', 'Announcements']]
    },
    'gallery': {
      title: 'Gallery',
      who: 'Tutor curates; families view.',
      why: 'Celebrate classes and achievements with image/video links.',
      what: 'Drive/YouTube/https links, never uploads.',
      how: ['Paste a link.', 'Add a caption.', 'It appears in the gallery.'],
      next: [['events.html', 'Events'], ['announcements.html', 'Announcements']]
    },
    'birthdays': {
      title: 'Birthdays',
      who: 'Everyone.',
      why: 'A small personal touch — upcoming learner birthdays on the dashboard.',
      what: 'Derived from learner profiles.',
      how: ['Add birth dates on learner records.', 'See upcoming cards.'],
      next: [['learners.html', 'Learners']]
    },
    'directory': {
      title: 'Directory',
      who: 'Signed-in users (family-safe).',
      why: 'A searchable studio directory of tutors and staff contact details.',
      what: 'Name, role, contact links.',
      how: ['Search by name.', 'Click to message.'],
      next: [['tutors.html', 'Tutors'], ['inbox.html', 'Inbox']]
    },
    'helpdesk': {
      title: 'Help desk tickets',
      who: 'Families raise; admin resolves.',
      why: 'Track technical and pastoral issues to closure.',
      what: 'Ticket, subject, status, messages.',
      how: ['Open a ticket.', 'Admin responds.', 'Close when done.'],
      next: [['complaints.html', 'Complaints'], ['platform-health.html', 'Health']]
    },
    'documents': {
      title: 'Documents',
      who: 'Admin shares; families read.',
      why: 'Policies, consent forms and handouts as Drive links.',
      what: 'Document link, category, audience.',
      how: ['Upload to Drive.', 'Paste the link here.', 'Families open it.'],
      next: [['policies.html', 'Policies'], ['admin-data.html', 'Admin data']]
    },
    'policies': {
      title: 'Policies',
      who: 'Public/families.',
      why: 'Safeguarding, privacy and cancellation policies in one place.',
      what: 'Policy links and text.',
      how: ['Read the policies.', 'Contact the studio with questions.'],
      next: [['safeguarding.html', 'Safeguarding'], ['documents.html', 'Documents']]
    },
    'idcards': {
      title: 'Learner ID cards',
      who: 'Admin/tutor.',
      why: 'Printable cards showing the student ID (TC-0001) used to sit quizzes.',
      what: 'Branded card with name, ID, photo link.',
      how: ['Open a learner.', 'Print the card.', 'Hand it to the learner.'],
      next: [['learners.html', 'Learners'], ['cbt-exam.html', 'Take quiz']]
    },
    'events': {
      title: 'Events & workshops',
      who: 'Admin/tutor; families RSVP.',
      why: 'Workshops, open days and exam clinics.',
      what: 'Event, date, location/link, RSVP count.',
      how: ['Create an event.', 'Share it.', 'Track RSVPs.'],
      next: [['calendar.html', 'Calendar'], ['announcements.html', 'Announcements']]
    },
    'apply': {
      title: 'Apply / request a place',
      who: 'Public parents.',
      why: 'The public entry point for new families, with optional coded links.',
      what: 'Parent + learner + subject form → inquiries or applications.',
      how: ['Open apply.html (or ?code=…).', 'Fill the form.', 'The studio follows up.'],
      next: [['application-links.html', 'Coded links'], ['inquiries.html', 'Inquiries']]
    },
    'inquiries': {
      title: 'Inquiries / CRM',
      who: 'Admin/tutor.',
      why: 'The sales pipeline from first contact to converted engagement.',
      what: 'new → contacted → trial_booked → converted/lost.',
      how: ['Read new inquiries daily.', 'WhatsApp the parent.', 'Convert after a trial.'],
      next: [['trials.html', 'Trials'], ['engagements.html', 'Engagements']]
    },
    'waitlist': {
      title: 'Waitlist',
      who: 'Admin/tutor.',
      why: 'Hold demand when a slot or group is full.',
      what: 'Learner, subject, status waiting/offered/placed/withdrawn.',
      how: ['Add when full.', 'Offer when a seat frees.', 'Place them.'],
      next: [['inquiries.html', 'Inquiries']]
    },
    'trials': {
      title: 'Trials',
      who: 'Admin/tutor.',
      why: 'A diagnostic trial locks the baseline before a package is sold.',
      what: 'Learner, scheduled time, baseline %, fit notes, status.',
      how: ['Book from an inquiry.', 'Sit the diagnostic.', 'Convert.'],
      next: [['diagnostics.html', 'Diagnostics'], ['engagements.html', 'Engagements']]
    },
    'onboarding': {
      title: 'Onboarding checklists',
      who: 'Admin/tutor.',
      why: 'Consent, goals interview, diagnostic, first package, first session — tracked per engagement.',
      what: 'Checklist items with owners and status.',
      how: ['Work the list top to bottom.', 'Tick each step.', 'Nothing is missed.'],
      next: [['engagements.html', 'Engagements'], ['trials.html', 'Trials']]
    },
    'referrals': {
      title: 'Referrals',
      who: 'Families refer; admin tracks.',
      why: 'Word-of-mouth growth with optional rewards.',
      what: 'Referrer, referred family, status, reward.',
      how: ['Share the referral link.', 'Track sign-ups.', 'Reward referrers.'],
      next: [['reviews.html', 'Reviews'], ['inquiries.html', 'Inquiries']]
    },
    'approvals': {
      title: 'Approvals',
      who: 'Owner/admin.',
      why: 'New accounts start pending; approving only people you recognise keeps family data closed.',
      what: 'Pending profiles with approve/reject.',
      how: ['Open Approvals.', 'Verify the person.', 'Approve or reject.'],
      next: [['login.html', 'Login'], ['profiles', 'Profiles']]
    },
    'settings': {
      title: 'Settings',
      who: 'Owner/admin.',
      why: 'Studio brand, timezone, currency, cancellation hours and security defaults.',
      what: 'practice_settings plus 2FA, dark mode, accessibility.',
      how: ['Edit fields.', 'Save.', 'Every page rehydrates.'],
      next: [['platform-health.html', 'Health'], ['profile.html', 'Profile']]
    },
    'admin-data': {
      title: 'Admin data',
      who: 'Owner.',
      why: 'You own the data — export, sealed archive, Drive backup and table browser.',
      what: 'JSON export/restore, SHA-256 sealed archives, Google Drive sync.',
      how: ['Export regularly.', 'Connect Drive optionally.', 'Restore when needed.'],
      next: [['storage.html', 'Storage'], ['platform-health.html', 'Health']]
    },
    'platform-health': {
      title: 'Platform health',
      who: 'Owner.',
      why: 'Proves the 10-layer keep-alive is writing and the free project is not about to pause.',
      what: 'Heartbeat, ping count, DB size, lockdown toggle, login audit.',
      how: ['Press 💓 before a holiday.', 'Confirm last_source updates.', 'Lockdown only in an incident.'],
      next: [['admin-data.html', 'Backups'], ['license.html', 'License']]
    },
    'storage': {
      title: 'Storage manager',
      who: 'Owner.',
      why: 'Guardian of the free 500 MB: archive then purge old logs.',
      what: 'Table sizes, archive action, purge old activity.',
      how: ['Review sizes.', 'Archive before purging.', 'Keep under the limit.'],
      next: [['admin-data.html', 'Backups'], ['platform-health.html', 'Health']]
    },
    'activity-log': {
      title: 'Activity log',
      who: 'Owner/admin.',
      why: 'An audit trail of who created, edited, deleted or signed in.',
      what: 'Actor, action, entity, timestamp, details.',
      how: ['Filter by actor or action.', 'Investigate incidents.'],
      next: [['platform-health.html', 'Health'], ['safeguarding.html', 'Safeguarding']]
    },
    'safeguarding': {
      title: 'Safeguarding log',
      who: 'Admin/tutor (never shown to families).',
      why: 'Confidential incident records kept separately from ordinary activity.',
      what: 'Incident, people involved, action, date, confidential notes.',
      how: ['Record facts only.', 'Link to complaints if needed.', 'Keep access tight.'],
      next: [['complaints.html', 'Complaints'], ['compliance.html', 'Compliance']]
    },
    'compliance': {
      title: 'Compliance',
      who: 'Owner/admin.',
      why: 'Consent, data-processing and policy compliance records.',
      what: 'Consent status, policy versions, data requests.',
      how: ['Track consent.', 'Record data requests.', 'Keep policies current.'],
      next: [['policies.html', 'Policies'], ['safeguarding.html', 'Safeguarding']]
    },
    'license': {
      title: 'Site license',
      who: 'Owner.',
      why: 'Lifetime (default) or subscription lock with grace period and renewal path.',
      what: 'Model, status, expiry, grace, renew URL.',
      how: ['Lifetime needs no action.', 'Subscription shows a reminder then a lock after grace.'],
      next: [['settings.html', 'Settings'], ['platform-health.html', 'Health']]
    },
    'status-manager': {
      title: 'Status manager',
      who: 'Owner/admin.',
      why: 'Bulk-set learner/engagement statuses (active/paused/churned).',
      what: 'Status updates across records.',
      how: ['Select records.', 'Change status.', 'Save.'],
      next: [['learners.html', 'Learners'], ['engagements.html', 'Engagements']]
    },
    'learning-styles': {
      title: 'Learning styles & notes',
      who: 'Tutor.',
      why: 'Observed learning preferences and accommodations per learner.',
      what: 'Free-text notes and SEN/accommodation flags.',
      how: ['Observe and record.', 'Use the notes when planning.'],
      next: [['accommodations.html', 'Accommodations'], ['learners.html', 'Learners']]
    },
    'accommodations': {
      title: 'Accommodations / SEN',
      who: 'Tutor.',
      why: 'Extra time, quiet room, larger text — recorded so every quiz respects them.',
      what: 'Accommodation text per learner, surfaced to the tutor.',
      how: ['Record needs.', 'Apply them in assessments.'],
      next: [['learning-styles.html', 'Learning notes'], ['cbt-exam.html', 'Take quiz']]
    },
    'transcripts': {
      title: 'Transcripts',
      who: 'Admin/tutor; learner/parent.',
      why: 'An official record of hours, topics and grades for applications.',
      what: 'Generated transcript, printable.',
      how: ['Pick the learner.', 'Generate.', 'Print to PDF.'],
      next: [['certificates.html', 'Certificates'], ['progress-reports.html', 'Reports']]
    },
    'rubrics': {
      title: 'Rubrics',
      who: 'Tutor.',
      why: 'Consistent grading criteria across essays and performances.',
      what: 'Criteria, levels, descriptors.',
      how: ['Build a rubric.', 'Attach it to an assignment.', 'Grade against it.'],
      next: [['assignments.html', 'Assignments'], ['mastery.html', 'Mastery']]
    },
    'gamification': {
      title: 'Streaks & badges',
      who: 'Learners.',
      why: 'Light motivation: streaks and badges for consistent study.',
      what: 'Streak counter and earned badges.',
      how: ['Study daily to keep a streak.', 'Earn badges.'],
      next: [['flashcards.html', 'Flashcards'], ['study-log.html', 'Study log']]
    },
    'leave': {
      title: 'Tutor leave',
      who: 'Tutors request; admin approves.',
      why: 'Cover and rescheduling need a leave record.',
      what: 'Date range, reason, status.',
      how: ['Request leave.', 'Admin approves.', 'Classes are reassigned.'],
      next: [['substitutions.html', 'Cover tutors'], ['availability.html', 'Availability']]
    },
    'substitutions': {
      title: 'Cover tutors',
      who: 'Admin.',
      why: 'When a tutor is on leave, assign cover without losing the class.',
      what: 'Original tutor, cover tutor, date range.',
      how: ['Pick the absent tutor.', 'Assign cover.', 'Notify the family.'],
      next: [['leave.html', 'Leave'], ['tutors.html', 'Tutors']]
    },
    'reminders': {
      title: 'Reminders + ICS',
      who: 'Tutor/admin; parents download.',
      why: 'Class reminders through free channels plus a .ics for Google/Outlook/Apple.',
      what: 'Upcoming classes, one-click compose, .ics download.',
      how: ['Open Reminders.', 'Send via WhatsApp/Email/SMS.', 'Download the calendar file.'],
      next: [['bookings.html', 'Bookings'], ['calendar.html', 'Calendar']]
    },
    'study-log': {
      title: 'Study log / timer',
      who: 'Learner.',
      why: 'Minutes on task, not just class time, feed diligence insights.',
      what: 'Timer per subject/topic, saved minutes and notes.',
      how: ['Pick a topic.', 'Start the timer.', 'Stop and save.'],
      next: [['flashcards.html', 'Flashcards'], ['learner-360.html', '360']]
    },
    'makeup-credits': {
      title: 'Makeup credit bank',
      who: 'Admin/tutor; parent reads balance.',
      why: 'When the studio cancels, the family earns a credit, never silently losing hours.',
      what: 'Per-engagement ledger of + and − credits.',
      how: ['Add credit when you cancel.', 'Subtract when a makeup is held.'],
      next: [['makeups.html', 'Make-ups'], ['cancellations.html', 'Cancellations']]
    },
    'public-book': {
      title: 'Public self-booking',
      who: 'Parents (no login).',
      why: 'Open slots bookable like Calendly, with no Calendly fee.',
      what: 'Availability grid, contact form, lands as an inquiry.',
      how: ['Publish the page.', 'Parent picks a slot.', 'Confirm into a cycle.'],
      next: [['availability.html', 'Availability'], ['bookings.html', 'Bookings']]
    },
    'stream': {
      title: 'Class stream',
      who: 'Tutors post; engagement members read.',
      why: 'A Google Classroom-style feed of announcements, questions and materials.',
      what: 'Posts in reverse-chronological order, link previews only.',
      how: ['Post to the stream.', 'Learners comment.', 'Pin important items.'],
      next: [['classwork.html', 'Classwork'], ['forum.html', 'Forum']]
    },
    'classwork': {
      title: 'Classwork',
      who: 'Tutor organises; learners submit.',
      why: 'Work organised by topic: assignments, quizzes, materials, comment-only return.',
      what: 'Topic-organised work, skills tags, submissions.',
      how: ['Create a topic.', 'Add work.', 'Review submissions.'],
      next: [['stream.html', 'Stream'], ['assignments.html', 'Assignments']]
    },
    'reading': {
      title: 'Reading assignments',
      who: 'Tutor assigns; learner ticks.',
      why: 'Pre-class reading/video links tied to the next SOW topic create the read → quiz → class loop.',
      what: 'Links, due tick, completion.',
      how: ['Assign links.', 'Learners read/watch.', 'Tick complete, then Self-Quiz.'],
      next: [['resources.html', 'Resources'], ['practice.html', 'Quizzes']]
    },
    'sow': {
      title: 'Scheme of Work',
      who: 'Tutor.',
      why: 'Termly topics, coverage and per-learner evaluation push scores to the mastery heatmap.',
      what: 'Terms, topics, coverage, evaluations.',
      how: ['Enter topics at term start.', 'Tick coverage weekly.', 'Evaluate each learner.'],
      next: [['curriculum.html', 'Curriculum'], ['mastery.html', 'Mastery']]
    },
    'scoresheet': {
      title: 'Scoresheet',
      who: 'Tutor/admin; linked parent/learner read.',
      why: 'One ledger of graded quizzes, SOW evaluations and homework.',
      what: 'Score, max, percent, subject, date, source.',
      how: ['Graded quizzes arrive automatically.', 'Add manual rows.', 'Filter by subject.'],
      next: [['cbt-exam.html', 'Take quiz'], ['progress-reports.html', 'Reports']]
    },
    'cbt-exam': {
      title: 'Take quiz',
      who: 'Learner.',
      why: 'The runtime: code entry, student ID, timer, navigator, anti-cheat, review and PDF.',
      what: 'Runs Open or Registered papers; 32 question types.',
      how: ['Enter the code.', 'Enter student ID (TC-0001).', 'Answer, submit, review, save PDF.'],
      next: [['practice.html', 'CBT manager'], ['cbt-review.html', 'Review + PDF']]
    },
    'cbt-multi': {
      title: 'Multi-subject quiz',
      who: 'Learner.',
      why: 'UTME-style one sitting with subject tabs and a shared timer.',
      what: 'Tabbed multi-subject paper.',
      how: ['Enter code + ID.', 'Move across tabs.', 'Submit once.'],
      next: [['cbt-exam.html', 'Single quiz'], ['scoresheet.html', 'Scoresheet']]
    },
    'cbt-review': {
      title: 'Quiz review',
      who: 'Learner.',
      why: 'Item-by-item answers, keys and explanations, printable to PDF.',
      what: 'Review screen with per-subject breakdown.',
      how: ['After submitting, read explanations.', 'Print → Save as PDF.'],
      next: [['cbt-exam.html', 'Take quiz'], ['scoresheet.html', 'Scoresheet']]
    },
    'insights': {
      title: 'Insights Lab',
      who: 'Tutor/admin.',
      why: 'Readable formulas — value-added, OLS prediction, six at-risk rules, methodology suggestions.',
      what: 'Charts and flags per learner, group or practice.',
      how: ['Pick a learner.', 'Read the chart and flags.', 'Apply the suggested method.'],
      next: [['at-risk.html', 'At-risk'], ['learner-360.html', '360']]
    },
    'sessions': {
      title: 'Sessions',
      who: 'Tutor/admin; families see their own.',
      why: 'Every lesson with start/end, mode, meeting link, whiteboard and hours deducted when done.',
      what: 'Session rows linked to engagements.',
      how: ['Schedule a session.', 'Add a meeting link.', 'Mark done to deduct hours.'],
      next: [['calendar.html', 'Calendar'], ['session-complete.html', 'Complete']]
    },
    'attendance': {
      title: 'Attendance',
      who: 'Tutor marks; families read.',
      why: 'Present/late/absent/excused per learner feeds the 80% at-risk rule.',
      what: 'Attendance marks per session per learner.',
      how: ['Open the session.', 'Mark each learner.', 'Save.'],
      next: [['sessions.html', 'Sessions'], ['at-risk.html', 'At-risk']]
    },
    'calendar': {
      title: 'Calendar',
      who: 'All roles (family-safe).',
      why: 'Timezone-aware view of sessions and cycle classes.',
      what: 'Upcoming sessions and booking_classes.',
      how: ['Browse the month.', 'Click a class for details.', 'Export .ics from Reminders.'],
      next: [['reminders.html', 'Reminders'], ['bookings.html', 'Bookings']]
    },
    'bookings': {
      title: 'Cycle bookings',
      who: 'Admin/tutor create; families read.',
      why: '4 cycles × 7 days, times/cycle × 4 = classes, amount = rate × hours.',
      what: 'Booking blocks expanded by a trigger into every class.',
      how: ['Pick learner and engagement.', 'Set cycle start, times, duration and rate.', 'Save — the timetable writes itself.'],
      next: [['sessions.html', 'Sessions'], ['invoices.html', 'Invoices']]
    },
    'contact': {
      title: 'Contact',
      who: 'Public.',
      why: 'A simple contact route for the studio (WhatsApp/email).',
      what: 'Contact details and links.',
      how: ['Use the WhatsApp or email link.', 'The studio responds.'],
      next: [['about.html', 'About'], ['apply.html', 'Apply']]
    },
    'forgot-password': {
      title: 'Forgot password',
      who: 'Anyone with an account.',
      why: 'Supabase password reset via email.',
      what: 'Email field → reset link.',
      how: ['Enter your email.', 'Click the reset link.', 'Set a new password.'],
      next: [['login.html', 'Sign in']]
    },
    'change-password': {
      title: 'Change password',
      who: 'Signed-in users.',
      why: 'Update a known password.',
      what: 'Current + new password fields.',
      how: ['Enter current and new.', 'Save.'],
      next: [['profile.html', 'Profile'], ['settings.html', 'Settings']]
    },
    'offline': {
      title: 'Offline',
      who: 'Anyone.',
      why: 'The page shown when there is no connection (PWA shell).',
      what: 'Friendly offline message.',
      how: ['Reconnect to continue.'],
      next: [['install.html', 'Install']]
    },
    'notifications': {
      title: 'Notification centre',
      who: 'All roles.',
      why: 'Bell, push after PWA install, and multi-channel compose in one place.',
      what: 'In-app notifications, push subscription, recent items.',
      how: ['Allow notifications.', 'Read items.', 'Mark all read.'],
      next: [['inbox.html', 'Inbox'], ['install.html', 'Install']]
    },
    'hmg-products': {
      title: 'HMG Digital Products',
      who: 'Public. SEO page.',
      why: 'Catalogue of the wider HMG Concepts product family.',
      what: 'Product cards with contact paths.',
      how: ['Browse products.', 'Reach out via WhatsApp.'],
      next: [['hmg-ecosystem.html', 'Ecosystem'], ['developer.html', 'Developer']]
    },
    'developer': {
      title: 'Developer / founder',
      who: 'Public. SEO page.',
      why: 'Credits and links for Adewale Samson Adeagbo and HMG Technologies.',
      what: 'Founder bio and ecosystem links.',
      how: ['Read the story.', 'Connect with the founder.'],
      next: [['hmg-ecosystem.html', 'Ecosystem']]
    },
    'flyer': {
      title: 'Marketing flyer',
      who: 'Admin.',
      why: 'A printable one-page flyer to share on WhatsApp and socials.',
      what: 'Branded flyer with studio details and a QR-ready apply link.',
      how: ['Open the flyer.', 'Print or save as PDF.', 'Share it.'],
      next: [['about.html', 'About'], ['apply.html', 'Apply']]
    },
    'site-index': {
      title: 'Site index',
      who: 'Public/search engines.',
      why: 'A simple A–Z of public pages for discoverability.',
      what: 'Link list of public pages.',
      how: ['Browse or search.'],
      next: [['feature-guide.html', 'Feature guide']]
    },
    'products': {
      title: 'Books & materials',
      who: 'Parents/learners browse; admin manages.',
      why: 'Studios often sell past papers, workbooks and kits alongside tutoring.',
      what: 'Catalogue of materials with price and a buy link (wa.me or a payment link).',
      how: ['Browse the catalogue.', 'Enquire or pay via the link shown.', 'Admin adds items from the CRUD.'],
      next: [['fees.html', 'Fees'], ['resources.html', 'Resources']]
    },
    'index': {
      title: 'Home',
      who: 'Public.',
      why: 'The landing page explains the studio and routes visitors to sign-in or apply.',
      what: 'Hero, feature cards, sign-in and apply CTAs, HMG attribution, SEO metadata and JSON-LD.',
      how: ['Use Sign in if you have an account.', 'Use Apply to request a place.', 'Install the app from the banner.'],
      next: [['login.html', 'Sign in'], ['apply.html', 'Apply'], ['about.html', 'About']]
    },
    wallet: {
      title: 'Prepaid wallet',
      who: 'Staff top up and inspect any family. A parent sees only their own balance.',
      why: 'Chasing an invoice after the lesson is already taught is the weakest position a studio can be in. A prepaid wallet reverses the cash flow: the money arrives first and the teaching draws it down. The market leader builds its whole billing on this and reports it lifts monthly renewals by up to 42%.',
      what: 'A credit ledger per family, in money or in sessions. Every movement is a permanent row, so the balance is always the sum of its history and cannot quietly drift. Attending a session deducts automatically. A low-balance chase list shows exactly who is about to run out, each with a one-tap WhatsApp link.',
      how: [
        'Switch the wallet on in Settings and set your low-balance threshold.',
        'Choose a family (the list auto-fills), enter the amount and the bank reference, press Add credit.',
        'Choose the unit: Currency holds money, Sessions holds a number of lessons.',
        'Teach normally — marking a learner present on Attendance deducts the session for you.',
        'Work the Low balances list weekly. To fix a mistake, add a reversing entry rather than editing history.'
      ],
      next: [['attendance.html', 'Attendance'], ['payment-plans.html', 'Payment plans'], ['settings.html', 'Settings']]
    },
    payment_plans: {
      title: 'Payment plans',
      who: 'Owner, admin and staff. Parents see their own plan read-only.',
      why: 'Termly fees are routinely paid in parts. A family who cannot pay N180,000 at once will happily pay N60,000 three times. Without this the conversation lived in WhatsApp and the tracking lived in somebody\u2019s head.',
      what: 'Enter a total, a number of instalments and a frequency; every due date and amount is generated. Rounding is absorbed by the FIRST instalment, never the last, so a family never meets a surprise odd amount at the end of a plan they budgeted for. Overdue parts appear in an arrears list with days late.',
      how: [
        'Choose the family and optionally the learner \u2014 both lists auto-fill.',
        'Enter the TOTAL owed, not the instalment. The split previews live as you type.',
        'Pick weekly, fortnightly, monthly or termly, then press Generate schedule.',
        'Press "Mark paid" as money arrives; today\u2019s date fills itself in.',
        'Work the Arrears panel weekly.'
      ],
      next: [['invoices.html', 'Invoices'], ['wallet.html', 'Prepaid wallet'], ['payments.html', 'Payments']]
    },
    security_centre: {
      title: 'Security & compliance centre',
      who: 'Owner and administrator only. Every function re-checks your role inside the database.',
      why: 'You hold children\u2019s names, dates of birth, guardian phone numbers, addresses, exam scores and safeguarding notes. Nigeria\u2019s NDPA 2023 gives families the right to see and correct that data; GDPR and FERPA impose the same duty elsewhere. The control all of them name first is an immutable audit trail.',
      what: 'A security scan that asks the database what an anonymous stranger can reach; a list of tables with row-level security off; failed sign-in monitoring; an append-only audit trail showing the before-and-after of every change; a one-click full export of everything held on one learner; an anonymised SHA-256 export for analytics; and registers for consent and data requests.',
      how: [
        'Press Run security scan. Everything listed should be something a stranger is supposed to reach.',
        'Confirm "Tables without row-level security" is empty.',
        'Review failed sign-ins \u2014 three or more against one address is a forgotten password or a guesser.',
        'Use the Audit trail to answer "who changed this?" by table and record id.',
        'Answer a family\u2019s data request with Export a learner\u2019s full record. The deadline is 30 days here, 45 under FERPA.',
        'Log every request so the clock is visible, and record photo/trip/marketing consent with a Drive link as evidence.'
      ],
      next: [['activity-log.html', 'Activity log'], ['safeguarding.html', 'Safeguarding'], ['license.html', 'Licence']]
    },
    default: {
      title: 'This page',
      who: 'Depends on the module.',
      why: 'Every module has a purpose card at the top and ❓ Page Help.',
      what: 'Use the feature card, the assistant, and the Feature Guide.',
      how: ['Ask “what is this page?”', 'Ask “how do bookings work?”', 'Open Feature Guide for the full catalogue.'],
      next: [['feature-guide.html', 'Feature guide'], ['dashboard.html', 'Dashboard']]
    }
  };

  // Alias hyphen/underscore
  ['session_complete', 'learner_360', 'cbt_exam', 'cbt_prompts', 'application_links',
   'exam_links', 'exam_register', 'admin_data', 'platform_health', 'feature_guide',
   'hmg_ecosystem', 'study_log', 'makeup_credits', 'public_book', 'at-risk', 'atrisk',
   'value-added', 'value_added', 'payment-history', 'payment_history', 'parent-meetings',
   'parent_meetings', 'session-notes', 'session_notes', 'lesson-plans', 'lesson_plans',
   'group-insights', 'group_insights', 'progress-reports', 'progress_reports',
   'learning-styles', 'learning_styles', 'cbt-multi', 'cbt_multi', 'cbt-review', 'cbt_review',
   'status-manager', 'status_manager', 'activity-log', 'activity_log', 'hmg-products',
   'hmg_products', 'change-password', 'change_password', 'forgot-password', 'forgot_password'
  ].forEach(k => {
    const canon = k.replace(/_/g, '-');
    if (PAGES[canon] && !PAGES[k]) PAGES[k] = PAGES[canon];
    if (PAGES[k] && !PAGES[canon]) PAGES[canon] = PAGES[k];
  });

  const PROCESSES = [
    {
      id: 'onboard',
      m: ['onboard', 'get started', 'first day', 'how do i start', 'new studio', 'setup studio'],
      title: 'First-day studio setup',
      r: '**Process — open a studio**\n1. Run database/complete-schema.sql in a free Supabase project (includes v2–v4).\n2. Paste Project URL + anon key into assets/js/config.js.\n3. Host the folder. Request access as admin; in profiles set role=admin and status=approved.\n4. Settings: name, motto, Africa/Lagos, ₦, logo URL.\n5. Subjects → Tutors → Availability → Learners + Parents (link them) → Engagements → SOW → Cycle booking.\n6. Platform Health 💓 then Drive backup.\nOpen DEPLOYMENT-GUIDE.md for the full checklist.'
    },
    {
      id: 'book',
      m: ['how to book', 'how booking', '4 cycle', 'four cycle', '8 class', 'eight class', 'times per cycle'],
      title: 'How a 4-cycle booking works',
      r: '**Process — sell a cycle**\nA cycle is 7 days. A full booking is 4 cycles (28 days).\n• 1 time/cycle = 4 classes. 2 times/cycle = 8 classes. 3 = 12.\n• Amount = hourly rate × (minutes ÷ 60) × class count.\n1. Open Cycle bookings. Pick learner + engagement.\n2. Set start of cycle 1, weekdays and clock times.\n3. Read the quote. Save. SQL trigger tc_expand_booking_block writes every class.\n4. Tutor, parent and learner all see date, time and duration.\n5. After each class: Complete a class (feedback + SOW ticks).\n6. Optional: Reminders → Download .ics for Google/Outlook/Apple.'
    },
    {
      id: 'quiz',
      m: ['how to quiz', 'how to cbt', 'self quiz', 'review quiz', 'graded quiz', 'student id', 'tc-0001', 'sit exam'],
      title: 'How quizzes work',
      r: '**Process — three quiz kinds + two access modes**\n• **Self** = practice, off the scoresheet.\n• **Review** = after class, off the scoresheet.\n• **Graded** = official. Trigger writes **overall + one scoresheet row per subject**.\n• **Registered** paper: only enrolled learners. Student ID required. Official name auto-fills and is read-only.\n• **Open** paper: guests type a display name; registered learners may still enter an ID so the score attaches to them.\n1. Tutor: Question prompts → CSV into Quizzes. Set kind + Access mode.\n2. Share the code (or cbt-exam.html?code=…).\n3. Learner looks up the paper. Registered = ID only. Open = ID optional.\n4. Multi-subject papers show subject tabs. Shared timer.\n5. Review + PDF. Graded Maths/English/… each land on their own scoresheet subject.'
    },
    {
      id: 'applyproc',
      m: ['how to apply', 'application link', 'inquiry form', 'public form'],
      title: 'How applications work',
      r: '**Process — a parent requests a place**\n1. Admin may create an Application link (code, expiry, max uses).\n2. Parent opens apply.html or apply.html?code=…\n3. Fills parent + learner + subject + timezone. No account needed.\n4. With a code: RPC tc_submit_application checks expiry/uses, writes applications + inquiries.\n5. Without a code: row lands in Inquiries.\n6. You contact → trial + baseline → engagement + hour bank + 4-cycle booking.'
    },
    {
      id: 'deploy',
      m: ['deploy', 'host', 'vercel', 'netlify', 'github pages', 'supabase', 'go live', 'launch'],
      title: 'How to deploy (free)',
      r: '**Process — go live**\n1. Unzip the CLIENT package (adewale-classroom or the ZIP the builder emitted). Confirm there is no builder.html.\n2. supabase.com → new project → SQL Editor → entire database/complete-schema.sql.\n3. Auth → Email on. Add your live origin to redirect URLs.\n4. Paste Project URL + anon key into assets/js/config.js. Never the service_role key.\n5. Host the folder on Vercel, Netlify, GitHub Pages or Cloudflare Pages.\n6. Request access as admin → profiles: role=admin, status=approved.\n7. Settings + Platform Health 💓 + Drive card.\n8. Keep-alive: site-visit is automatic; add the GitHub Action secrets and/or Vercel cron. See SUPABASE_FREE_TIER_PROTECTION.md.\nFull steps: DEPLOYMENT-GUIDE.md.'
    },
    {
      id: 'family',
      m: ['sibling', 'smear', 'privacy', 'family', 'parent see', 'only my child', 'rls'],
      title: 'How family privacy works',
      r: '**Process — no smeared data**\n• An engagement is one contract. Siblings get separate engagements.\n• A group shares sessions but mastery, scores and at-risk flags stay per learner.\n• A parent only sees rows for learners linked in parent_learner.\n• A learner only sees themselves. Student ID identifies them on quizzes.\n• Safeguarding, payroll, admin-data never appear in the family nav.\n• New accounts start pending. Approvals is the gate.'
    },
    {
      id: 'hours',
      m: ['hour bank', 'prepaid', 'deduct hour', 'hours left', 'consume_session'],
      title: 'How hour banks work',
      r: '**Process — prepaid hours**\n1. Sell a package on the engagement (hours + price).\n2. Teach. Mark the session or booking class done.\n3. Trigger consume_session_hours adds hours_used and writes hour_ledger.\n4. Insights flags hours < 2.\n5. Makeup credits are a separate ledger (when WE cancel) — they do not silently eat prepaid hours.'
    },
    {
      id: 'noai',
      m: ['ai api', 'chatgpt api', 'openai', 'gemini api', 'paid ai', 'why no ai'],
      title: 'Why there is no AI API',
      r: 'Tutoring Connect never calls a paid model. Question packs are copy-paste text for a chat you already use. Grading, predictions and at-risk flags are formulas in insights.js and cbt.js that a parent can read. That is how we stay on the free tier and keep trust.'
    },
    {
      id: 'media',
      m: ['upload', 'drive', 'youtube', '500 mb', 'file', 'photo', 'passport'],
      title: 'Why everything is a link',
      r: 'Free Supabase is ~500 MB. Uploading images would burn it. Logo, photos, passports, recordings, PDFs and videos are https / Google Drive / YouTube links. media.js renders previews and thumbnails. Admin Data archives are downloaded locally or synced to YOUR Drive (drive.file scope only).'
    },
    {
      id: 'keepalive',
      m: ['pause', 'keepalive', 'keep-alive', 'heartbeat', 'idle project'],
      title: 'How keep-alive works',
      r: 'Free Supabase pauses after ~7 days with no database activity. Layer 1: every visitor calls tc_keep_alive(\'site-visit\') once per day. Also: GitHub Action, edge ping + UptimeRobot, pg_cron, Platform Health 💓, cron-job.org, Vercel /api/keepalive, Apps Script, optional auto-restore. Open Platform Health and press the heartbeat. Full map: SUPABASE_FREE_TIER_PROTECTION.md.'
    },
    {
      id: 'ics',
      m: ['ics', 'google calendar', 'outlook', 'apple calendar', 'calendar sync', 'ical'],
      title: 'How calendar sync works (free)',
      r: 'We do not use a paid Google Calendar API. Reminders → Download .ics. In Google Calendar: Settings → Import & export → Import. Outlook and Apple Calendar open the same file. Each event has the class date, time and duration from the 4-cycle booking.'
    },
    {
      id: 'makeup',
      m: ['makeup credit', 'make-up credit', 'cancelled class credit'],
      title: 'How makeup credits work',
      r: 'When the studio cancels inside policy, add a +credit on Makeup credits (per engagement, never per sibling). When you deliver the makeup, add a −credit and create the session. Different from prepaid hour banks.'
    },
    {
      id: 'generator',
      m: ['builder', 'generator', 'generate zip', 'wizard', 'stamp a site'],
      title: 'How the generator works',
      r: 'HMG staff only. Unzip tutoring-connect-generator.zip. Open index.html → Open Authorized Builder. Six steps: studio details (logo is a URL), theme, layout, subjects, modules, optional Supabase keys. Generate. The ZIP is a CLIENT site: site-index.html becomes index.html (“Sign in to portal”). It does not contain the builder. Hand that ZIP to the studio and follow DEPLOYMENT-GUIDE.md section A.'
    },
    {
      id: 'cost',
      m: ['cost', 'price', 'naira', 'how much', 'quote', '₦35'],
      title: 'What it costs',
      r: 'Monthly software cost: ₦0 (Vercel/Pages + free Supabase + wa.me/mailto/sms). HMG build quote (internal): base ₦35,000 + ₦4,500 per module + optional add-ons (onboarding, custom theme, CSV import, Drive setup). WhatsApp +234 810 086 6322.'
    },
    {
      id: 'roles',
      m: ['role', 'permission', 'who can', 'access manager', 'whitelist'],
      title: 'How roles work',
      r: 'Admin/owner/director/lead_tutor: everything, including the dashboard Access Manager (Nav / Read / Write per page per role). Tutor/staff: teaching modules. Parent: mapped children only. Learner: self only; sit quizzes with TC-0001. New users are pending until Approvals.'
    },
    {
      id: 'examreg',
      m: ['waec', 'neco', 'jamb', 'utme', 'ielts', 'sat', 'gre', 'igcse', 'exam registration'],
      title: 'How exam registration works',
      r: 'Create an Exam link (board + series + expiry). Share exam-register.html?code=… Candidate fills local or international board (WAEC, NECO, GCE, NABTEB, BECE, UTME/JAMB, IGCSE, IELTS, TOEFL, SAT, GRE, GMAT, JUPEB). Passport = Drive link with preview. Staff review on Exam links.'
    },
    {
      id: 'classroom',
      m: ['google classroom', 'stream', 'classwork', 'comment only', 'gemini'],
      title: 'How Classroom-style tools work',
      r: 'Stream = announcements/questions/materials, optional scheduled publish_at, link previews. Classwork = items by topic, skills tags, blank points = comment-only return. No Gemini. Files are links.'
    },
    {
      id: 'help',
      m: ['help', 'what can you do', 'how to use assistant', 'commands'],
      title: 'How to use this assistant',
      r: 'I am a rules assistant — no AI API. I know every page and the core processes.\n• Ask **“what is this page?”** for a full briefing (who / why / how / next).\n• Ask **how do bookings / quizzes / apply / deploy / hours / privacy work?**\n• Type a module name (sow, scoresheet, reminders…).\n• Use ❓ Page Help (bottom left) for the same briefing as a modal.\n• Feature Guide lists every module.\n• Human help: WhatsApp HMG +234 810 086 6322.'
    }
  ];

  function pageId() {
    return (location.pathname.split('/').pop() || 'index.html').replace('.html', '').split('?')[0] || 'dashboard';
  }

  function getPage(id) {
    id = String(id || pageId());
    return PAGES[id] || PAGES[id.replace(/_/g, '-')] || PAGES[id.replace(/-/g, '_')] || PAGES.default;
  }

  function formatPage(id) {
    const g = getPage(id);
    const steps = (g.how || []).map((s, i) => (i + 1) + '. ' + s).join('\n');
    const next = (g.next || []).map(x => '→ ' + x[1] + ' (' + x[0] + ')').join('\n');
    return '**' + g.title + '** — ' + P() + '\n\n' +
      '**Who uses it:** ' + g.who + '\n\n' +
      '**Why it exists:** ' + g.why + '\n\n' +
      '**What it is:** ' + g.what + '\n\n' +
      '**How to use it:**\n' + steps + '\n\n' +
      (next ? '**Where to go next:**\n' + next : '');
  }

  function score(q, keys) {
    q = String(q || '').toLowerCase();
    let s = 0;
    (keys || []).forEach(k => {
      k = String(k).toLowerCase();
      if (!k) return;
      if (q === k) s += 8;
      else if (q.includes(k)) s += Math.min(6, k.length / 2);
    });
    return s;
  }

  w.TC = w.TC || {};
  w.TC.ASSISTANT = {
    PAGES, PROCESSES, pageId, getPage, formatPage, score,
    suggestFor(id) {
      const g = getPage(id);
      return [
        'What is this page?',
        'How do bookings work?',
        'How do quizzes work?',
        'How do I deploy?',
        'How does family privacy work?',
        ...(g.next || []).slice(0, 2).map(x => 'What is ' + x[1] + '?')
      ];
    }
  };
})(window);
