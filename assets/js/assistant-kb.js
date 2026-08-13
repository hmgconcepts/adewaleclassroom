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
