# Tutoring Connect — feature catalogue

Every selectable module from `assets/js/catalog.js`, with the **why** and the **how**. Nothing here calls a paid AI API.

## Design law

1. An **engagement** is independent. 1:1 = one learner. Group = shared sessions + individual analytics.
2. A **parent** sees only mapped children.
3. A **learner** sees only themselves.
4. Media is a **link**, never a byte in Postgres.
5. Messaging is **device-native** (`wa.me`, `mailto:`, `sms:`).
6. Insights are **formulas you can read**.

## How modules chain

- **Growth:** public apply → inquiries → trial + diagnostic baseline → engagement + hour bank.
- **Sessions:** availability → calendar / self-booking → session → attendance → notes → hours deducted.
- **Learning:** methodology + curriculum → homework / practice tests → mastery heatmap → progress report.
- **Insight:** scores + attendance + hours → value-added, prediction, at-risk, methodology suggestion.
- **Money:** fee catalogue → package → invoice → payment → receipt.
- **Trust:** contracts/consent, safeguarding log (hidden from families), activity log, sealed backup.

## Module list

Open `feature-guide.html` on a running site for the same list as cards. Groups:

### Core people
Engagements, Learners, Groups, Parents & families, Tutors, Subjects & exam boards.

### Growth
Inquiries/CRM, Waitlist, Trial lessons, Onboarding checklists, Public inquiry form, Referrals, Reviews, Marketing flyer.

### Sessions
Calendar, Sessions, Availability, Self-booking, Attendance, Make-ups, Cancellations, Session notes, Meeting links (Jitsi/Meet/Zoom), Whiteboard rooms (Excalidraw), Workshops & events, Rooms/locations, Timezone desk.

### Learning
Diagnostics, Goals & learning plans, Topic mastery, Methodologies, Curriculum maps, Lesson plans, Homework, Practice tests / CBT, Take practice test, CSV prompts, Progress reports, Learning styles, Accommodations/SEN, Resource library, Spaced practice (SM-2), Certificates, Learner portfolio, Mini LMS, Streaks & badges, Rubrics, Transcripts, Digital library.

### Analytics
Insights Lab, Learner 360, Group insights (fairness), At-risk board, Exam targets, Predicted grades, Value-added, Practice analytics.

### Finance
Hour banks/packages, Invoices, Payments, Payment history, Fee catalogue, Scholarships & discounts, Books & materials, Tutor payroll, Practice finance.

### Communication
Announcements, WA/Email/SMS, In-app inbox, Complaints, Surveys, Parent conferences, Notification centre, Result broadcasts, Polls.

### Media & ops
Gallery, Birthdays, Directory, Help desk, Contracts & consent, Policies, Learner cards, Cover tutors, Safeguarding log, Compliance.

### Platform
Settings (2FA email OTP, language, a11y, dark mode, idle lock), Approvals, Role & status, Admin data, Storage manager, Activity log, Platform health (heartbeat + lockdown + login audit), Site license, Feature guide, PWA install, offline page, command palette (Ctrl/K), rules chatbot, my profile, page access manager on the dashboard.

### Added from international tutoring platforms (v17, still free)
Reminders + **.ics** calendar export (TutorBird/Teachworks Calendar sync without their API) · **Study log / timer** (TutorBird) · **Makeup credit bank** per engagement (TutorBird credits) · **Public self-booking** from availability (Calendly/TutorBird booking page, no fee) · Studio assistant that can brief **every page and process**.

### Added for School Connect parity (v16)
Voting & polls with live tally · multi-channel notifications (bell + push + mailto/wa.me/sms) · security guard (idle lock, lockdown, password meter, login audit) · page help on every screen · studio assistant (no AI API) · analytics charts with SVG fallback · e-resources · tutor leave · exam registration (local + international) · Google Classroom-style stream & classwork · application links · 32 CBT types · v4 schema pack.

## Competitor features absorbed

| Source | What we took | How we kept it free |
|---|---|---|
| TutorCruncher / Teachworks | Hour banks, attendance→hours, payroll, family portal | SQL trigger `consume_session_hours` |
| TutorBird / Clark | Lesson notes, progress reports, self-booking | Browser print + availability table |
| Oases / Teach ’n Go | Session tracking, parent portal | RLS + parent_learner |
| Lessonspace contrast | Live classroom | Links to Jitsi / Meet / Excalidraw — not a paid iframe |
| Wyzant/Preply contrast | We are **not** a marketplace | You own the relationship and the data |
| Learning analytics (Schoolytics et al.) | Heatmaps, risk, value-added | `insights.js` formulas |
| School Connect | Generator, PWA, RLS, keep-alive, Drive links, CBT CSV, license lock | Same free-tier architecture, tutoring data model |

## What we deliberately did not copy

- Paid AI session summaries.
- A shared multi-tenant control plane (one Supabase **per studio** is safer on free tier).
- Uploading images into the 500 MB database.
