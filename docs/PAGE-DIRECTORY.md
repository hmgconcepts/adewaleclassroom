# Page directory — every screen and section in the studio

Auto-generated from `assets/js/page-guide.js` (`python3 tools/build_page_guide.py`).
This is the exact knowledge the Studio Assistant answers from, so the chatbot,
the in-app **? Page Help** and this document can never disagree.

**128 pages** · **711 documented sections** · **11 functional groups**.

| Badge | Meaning |
|---|---|
| 🌍 Public | No sign-in. Indexed by search engines. |
| 🔑 Quiz code | No portal password; a quiz code + student ID is the gate. |
| 👨‍👩‍👧 Family | Signed-in parents/learners, limited to their own records by RLS. |
| 🎓 Staff | Tutors, admins and owners. |
| 🛡️ Owner/admin | Money, safeguarding, audit and platform configuration. |

---

## Analytics

### At-risk board · `at-risk.html` · 🎓 Staff

Rule engine: falling scores, low attendance, missing homework, idle 14+ days, hours Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner, admin and tutors see the full picture. A parent sees the same analysis narrowed to their own child.

**Why it matters.** Parents pay for visible progress. These pages turn raw scores into an argument a parent can read, audit and trust.

**How to use it**

1. Select the learner, group or period you want to examine.
2. Read the headline numbers first, then open the charts underneath.
3. Every figure is a published formula, never a black box — open the methodology note to see the arithmetic.
4. Print or export the view and take it into a parent conference.

**Sections on this page**

- **Selector strip** — Choose the learner, group, subject or period you want to analyse.
- **Headline figures** — The KPI tiles. Read these first — they summarise the whole view.
- **Charts** — SVG charts drawn locally, with a table fallback if a chart cannot render.
- **Methodology note** — The published formula behind every number. Nothing here is a black box, so you can defend any figure to a parent.
- **Print / export** — Produces a clean, chrome-free layout suitable for a parent conference.

**What each role sees**

- **Owner:** Studio-wide analysis and at-risk board.
- **Tutor:** Their own learners.
- **Parent:** The same analysis narrowed to their own child.
- **Learner:** Their own progress only.

**Connects to.** Sits in the Analytics group, alongside analytics, exam-targets, group-insights, insights, learner-360, predictions. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Exam targets · `exam-targets.html` · 🎓 Staff

Target exam, date, board, predicted vs target grade. Countdown on the learner dashboard. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner, admin and tutors see the full picture. A parent sees the same analysis narrowed to their own child.

**Why it matters.** Parents pay for visible progress. These pages turn raw scores into an argument a parent can read, audit and trust.

**How to use it**

1. Select the learner, group or period you want to examine.
2. Read the headline numbers first, then open the charts underneath.
3. Every figure is a published formula, never a black box — open the methodology note to see the arithmetic.
4. Print or export the view and take it into a parent conference.

**Sections on this page**

- **Selector strip** — Choose the learner, group, subject or period you want to analyse.
- **Headline figures** — The KPI tiles. Read these first — they summarise the whole view.
- **Charts** — SVG charts drawn locally, with a table fallback if a chart cannot render.
- **Methodology note** — The published formula behind every number. Nothing here is a black box, so you can defend any figure to a parent.
- **Print / export** — Produces a clean, chrome-free layout suitable for a parent conference.

**What each role sees**

- **Owner:** Studio-wide analysis and at-risk board.
- **Tutor:** Their own learners.
- **Parent:** The same analysis narrowed to their own child.
- **Learner:** Their own progress only.

**Connects to.** Sits in the Analytics group, alongside analytics, at-risk, group-insights, insights, learner-360, predictions. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Group insights · `group-insights.html` · 🎓 Staff

Shared-session analytics plus a fairness view: who is being left behind inside the group. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner, admin and tutors see the full picture. A parent sees the same analysis narrowed to their own child.

**Why it matters.** Parents pay for visible progress. These pages turn raw scores into an argument a parent can read, audit and trust.

**How to use it**

1. Select the learner, group or period you want to examine.
2. Read the headline numbers first, then open the charts underneath.
3. Every figure is a published formula, never a black box — open the methodology note to see the arithmetic.
4. Print or export the view and take it into a parent conference.

**Sections on this page**

- **Selector strip** — Choose the learner, group, subject or period you want to analyse.
- **Headline figures** — The KPI tiles. Read these first — they summarise the whole view.
- **Charts** — SVG charts drawn locally, with a table fallback if a chart cannot render.
- **Methodology note** — The published formula behind every number. Nothing here is a black box, so you can defend any figure to a parent.
- **Print / export** — Produces a clean, chrome-free layout suitable for a parent conference.

**What each role sees**

- **Owner:** Studio-wide analysis and at-risk board.
- **Tutor:** Their own learners.
- **Parent:** The same analysis narrowed to their own child.
- **Learner:** Their own progress only.

**Connects to.** Sits in the Analytics group, alongside analytics, at-risk, exam-targets, insights, learner-360, predictions. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Insights Lab · `insights.html` · 👨‍👩‍👧 Family

The differentiator. Graphs and methodologies for one learner, one group, or the whole practice. Rule-based, not AI. The main actions available here are: Sign out, Theme. Requires sign-in. Parents see only their own children; a learner sees only themselves. Row Level Security enforces this in the database, not just in the interface.

**Who it is for.** Owner, admin and tutors see the full picture. A parent sees the same analysis narrowed to their own child.

**Why it matters.** Parents pay for visible progress. These pages turn raw scores into an argument a parent can read, audit and trust.

**How to use it**

1. Select the learner, group or period you want to examine.
2. Read the headline numbers first, then open the charts underneath.
3. Every figure is a published formula, never a black box — open the methodology note to see the arithmetic.
4. Print or export the view and take it into a parent conference.

**Sections on this page**

- **Selector strip** — Choose the learner, group, subject or period you want to analyse.
- **Headline figures** — The KPI tiles. Read these first — they summarise the whole view.
- **Charts** — SVG charts drawn locally, with a table fallback if a chart cannot render.
- **Methodology note** — The published formula behind every number. Nothing here is a black box, so you can defend any figure to a parent.
- **Print / export** — Produces a clean, chrome-free layout suitable for a parent conference.

**What each role sees**

- **Owner:** Studio-wide analysis and at-risk board.
- **Tutor:** Their own learners.
- **Parent:** The same analysis narrowed to their own child.
- **Learner:** Their own progress only.

**Common tasks.** prove progress to a parent · check who is at risk

**Connects to.** Sits in the Analytics group, alongside analytics, at-risk, exam-targets, group-insights, learner-360, predictions. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Learner 360 · `learner-360.html` · 👨‍👩‍👧 Family

One page: identity, engagements, hours, scores over time, mastery heatmap, at-risk flags, notes, invoices. The main actions available here are: Sign out, Theme. Requires sign-in. Parents see only their own children; a learner sees only themselves. Row Level Security enforces this in the database, not just in the interface.

**Who it is for.** Owner, admin and tutors see the full picture. A parent sees the same analysis narrowed to their own child.

**Why it matters.** Parents pay for visible progress. These pages turn raw scores into an argument a parent can read, audit and trust.

**How to use it**

1. Select the learner, group or period you want to examine.
2. Read the headline numbers first, then open the charts underneath.
3. Every figure is a published formula, never a black box — open the methodology note to see the arithmetic.
4. Print or export the view and take it into a parent conference.

**Sections on this page**

- **Selector strip** — Choose the learner, group, subject or period you want to analyse.
- **Headline figures** — The KPI tiles. Read these first — they summarise the whole view.
- **Charts** — SVG charts drawn locally, with a table fallback if a chart cannot render.
- **Methodology note** — The published formula behind every number. Nothing here is a black box, so you can defend any figure to a parent.
- **Print / export** — Produces a clean, chrome-free layout suitable for a parent conference.

**What each role sees**

- **Owner:** Studio-wide analysis and at-risk board.
- **Tutor:** Their own learners.
- **Parent:** The same analysis narrowed to their own child.
- **Learner:** Their own progress only.

**Connects to.** Sits in the Analytics group, alongside analytics, at-risk, exam-targets, group-insights, insights, predictions. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Practice analytics · `analytics.html` · 🎓 Staff

Studio-wide KPIs: utilisation, revenue, conversion, value-added distribution, retention. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner, admin and tutors see the full picture. A parent sees the same analysis narrowed to their own child.

**Why it matters.** Parents pay for visible progress. These pages turn raw scores into an argument a parent can read, audit and trust.

**How to use it**

1. Select the learner, group or period you want to examine.
2. Read the headline numbers first, then open the charts underneath.
3. Every figure is a published formula, never a black box — open the methodology note to see the arithmetic.
4. Print or export the view and take it into a parent conference.

**Sections on this page**

- **Selector strip** — Choose the learner, group, subject or period you want to analyse.
- **Headline figures** — The KPI tiles. Read these first — they summarise the whole view.
- **Charts** — SVG charts drawn locally, with a table fallback if a chart cannot render.
- **Methodology note** — The published formula behind every number. Nothing here is a black box, so you can defend any figure to a parent.
- **Print / export** — Produces a clean, chrome-free layout suitable for a parent conference.

**What each role sees**

- **Owner:** Studio-wide analysis and at-risk board.
- **Tutor:** Their own learners.
- **Parent:** The same analysis narrowed to their own child.
- **Learner:** Their own progress only.

**Connects to.** Sits in the Analytics group, alongside at-risk, exam-targets, group-insights, insights, learner-360, predictions. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Predicted grades · `predictions.html` · 🎓 Staff

Transparent linear projection from the last N scores toward the exam date. Formula is shown to parents. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner, admin and tutors see the full picture. A parent sees the same analysis narrowed to their own child.

**Why it matters.** Parents pay for visible progress. These pages turn raw scores into an argument a parent can read, audit and trust.

**How to use it**

1. Select the learner, group or period you want to examine.
2. Read the headline numbers first, then open the charts underneath.
3. Every figure is a published formula, never a black box — open the methodology note to see the arithmetic.
4. Print or export the view and take it into a parent conference.

**Sections on this page**

- **Selector strip** — Choose the learner, group, subject or period you want to analyse.
- **Headline figures** — The KPI tiles. Read these first — they summarise the whole view.
- **Charts** — SVG charts drawn locally, with a table fallback if a chart cannot render.
- **Methodology note** — The published formula behind every number. Nothing here is a black box, so you can defend any figure to a parent.
- **Print / export** — Produces a clean, chrome-free layout suitable for a parent conference.

**What each role sees**

- **Owner:** Studio-wide analysis and at-risk board.
- **Tutor:** Their own learners.
- **Parent:** The same analysis narrowed to their own child.
- **Learner:** Their own progress only.

**Connects to.** Sits in the Analytics group, alongside analytics, at-risk, exam-targets, group-insights, insights, learner-360. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Scoresheet · `scoresheet.html` · 👨‍👩‍👧 Family

Single ledger of graded quizzes, SOW evaluations and homework. Visible to the linked parent and the learner. The main actions available here are: Sign out, Theme. Requires sign-in. Parents see only their own children; a learner sees only themselves. Row Level Security enforces this in the database, not just in the interface.

**Who it is for.** Owner, admin and tutors see the full picture. A parent sees the same analysis narrowed to their own child.

**Why it matters.** Parents pay for visible progress. These pages turn raw scores into an argument a parent can read, audit and trust.

**How to use it**

1. Select the learner, group or period you want to examine.
2. Read the headline numbers first, then open the charts underneath.
3. Every figure is a published formula, never a black box — open the methodology note to see the arithmetic.
4. Print or export the view and take it into a parent conference.

**Sections on this page**

- **Selector strip** — Choose the learner, group, subject or period you want to analyse.
- **Headline figures** — The KPI tiles. Read these first — they summarise the whole view.
- **Charts** — SVG charts drawn locally, with a table fallback if a chart cannot render.
- **Methodology note** — The published formula behind every number. Nothing here is a black box, so you can defend any figure to a parent.
- **Print / export** — Produces a clean, chrome-free layout suitable for a parent conference.

**What each role sees**

- **Owner:** Studio-wide analysis and at-risk board.
- **Tutor:** Their own learners.
- **Parent:** The same analysis narrowed to their own child.
- **Learner:** Their own progress only.

**Common tasks.** see my child's scores · check a graded quiz result · print a score report

**Questions people ask**

- **Where do these scores come from?** Graded quizzes push themselves here automatically via a database trigger, alongside scheme-of-work evaluations and homework marks.
- **Can another family see my child's scores?** No. Row Level Security filters every query by family in the database itself, so even a typed URL returns nothing.

**Connects to.** Sits in the Analytics group, alongside analytics, at-risk, exam-targets, group-insights, insights, learner-360. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Value-added · `value-added.html` · 🎓 Staff

Current average minus diagnostic baseline. The number parents actually buy. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner, admin and tutors see the full picture. A parent sees the same analysis narrowed to their own child.

**Why it matters.** Parents pay for visible progress. These pages turn raw scores into an argument a parent can read, audit and trust.

**How to use it**

1. Select the learner, group or period you want to examine.
2. Read the headline numbers first, then open the charts underneath.
3. Every figure is a published formula, never a black box — open the methodology note to see the arithmetic.
4. Print or export the view and take it into a parent conference.

**Sections on this page**

- **Selector strip** — Choose the learner, group, subject or period you want to analyse.
- **Headline figures** — The KPI tiles. Read these first — they summarise the whole view.
- **Charts** — SVG charts drawn locally, with a table fallback if a chart cannot render.
- **Methodology note** — The published formula behind every number. Nothing here is a black box, so you can defend any figure to a parent.
- **Print / export** — Produces a clean, chrome-free layout suitable for a parent conference.

**What each role sees**

- **Owner:** Studio-wide analysis and at-risk board.
- **Tutor:** Their own learners.
- **Parent:** The same analysis narrowed to their own child.
- **Learner:** Their own progress only.

**Connects to.** Sits in the Analytics group, alongside analytics, at-risk, exam-targets, group-insights, insights, learner-360. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

## Comms

### Announcements · `announcements.html` · 👨‍👩‍👧 Family

Practice-wide or engagement-scoped notices. The main actions available here are: Sign out, Theme. Requires sign-in. Parents see only their own children; a learner sees only themselves. Row Level Security enforces this in the database, not just in the interface.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Comms group, alongside broadcasts, complaints, forum, inbox, messages, notifications. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Class stream · `stream.html` · 👨‍👩‍👧 Family

Google Classroom-style feed: announcements, questions, materials. Link previews only. The main actions available here are: Post to stream, Sign out, Theme. Requires sign-in. Parents see only their own children; a learner sees only themselves. Row Level Security enforces this in the database, not just in the interface.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Comms group, alongside announcements, broadcasts, complaints, forum, inbox, messages. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Complaints · `complaints.html` · 🎓 Staff

Submit → route → resolve. Evidence as Drive links. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Comms group, alongside announcements, broadcasts, forum, inbox, messages, notifications. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Group forum · `forum.html` · 👨‍👩‍👧 Family

Discussion threads scoped to a group engagement. Tutor or learner can open a thread; everyone in that group can reply. The main actions available here are: Open thread, Sign out, Theme. Requires sign-in. Parents see only their own children; a learner sees only themselves. Row Level Security enforces this in the database, not just in the interface.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Comms group, alongside announcements, broadcasts, complaints, inbox, messages, notifications. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Inbox · `inbox.html` · 👨‍👩‍👧 Family

Private tutor ↔ parent ↔ learner threads with read state. The main actions available here are: Sign out, Theme. Requires sign-in. Parents see only their own children; a learner sees only themselves. Row Level Security enforces this in the database, not just in the interface.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Common tasks.** message a parent · reply to a message

**Connects to.** Sits in the Comms group, alongside announcements, broadcasts, complaints, forum, messages, notifications. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Messaging (WA / Email / SMS) · `messages.html` · 🎓 Staff

Free device-native WhatsApp, email BCC and SMS links. No Twilio bill. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Comms group, alongside announcements, broadcasts, complaints, forum, inbox, notifications. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Notifications · `notifications.html` · 👨‍👩‍👧 Family

In-app bell + browser push after PWA install. The main actions available here are: Enable browser push, Mark all read, Sign out, Theme. Requires sign-in. Parents see only their own children; a learner sees only themselves. Row Level Security enforces this in the database, not just in the interface.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Comms group, alongside announcements, broadcasts, complaints, forum, inbox, messages. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Parent conferences · `parent-meetings.html` · 🎓 Staff

Book a review slot, attach the latest 360 and report. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Comms group, alongside announcements, broadcasts, complaints, forum, inbox, messages. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Polls · `polls.html` · 🎓 Staff

Schedule votes, topic votes, anonymous parent polls. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Comms group, alongside announcements, broadcasts, complaints, forum, inbox, messages. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Result broadcasts · `broadcasts.html` · 🎓 Staff

One-click share of a score or report via free channels. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Comms group, alongside announcements, complaints, forum, inbox, messages, notifications. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Surveys &amp; CSAT · `surveys.html` · 👨‍👩‍👧 Family

After-trial and termly parent pulse. Feeds retention insight. The main actions available here are: Sign out, Theme. Requires sign-in. Parents see only their own children; a learner sees only themselves. Row Level Security enforces this in the database, not just in the interface.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Comms group, alongside announcements, broadcasts, complaints, forum, inbox, messages. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Voting &amp; polls · `voting.html` · 👨‍👩‍👧 Family

Anonymous or named studio polls with live tally. Multi-channel notify when a poll opens. Free, no AI. The main actions available here are: Sign out, Theme. Requires sign-in. Parents see only their own children; a learner sees only themselves. Row Level Security enforces this in the database, not just in the interface.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Comms group, alongside announcements, broadcasts, complaints, forum, inbox, messages. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

## Core

### Engagements · `engagements.html` · 🎓 Staff

The atomic unit. Each one-on-one student or group is a fully independent teaching engagement with its own curriculum, hours, goals, fees and analytics. Nothing leaks between engagements. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner, admin and tutors do the data entry. Parents and learners only ever see their own linked records.

**Why it matters.** This is master data. If it is wrong here it is wrong everywhere downstream — bookings, invoices, analytics and reports all read from it.

**How to use it**

1. Open the page — the list loads with a search box and filters at the top.
2. Click Add / New to create a record. Only the marked fields are required; the rest can be completed later.
3. Click any row to open the full record, edit it inline, and save.
4. Use Export CSV whenever you want a copy — the data belongs to the studio, not the platform.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full read/write across every record.
- **Tutor:** Read/write for the engagements they teach.
- **Parent:** Only their own children appear.
- **Learner:** Only their own record appears.

**Common tasks.** create a 1:1 contract · create a group · set an hourly rate

**Connects to.** Sits in the Core group, alongside groups, learners, parents, subjects, tutors. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Groups · `groups.html` · 🎓 Staff

Named group engagements (2–12 learners). Shared sessions, individual mastery and scores. Group insights never overwrite personal insight. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner, admin and tutors do the data entry. Parents and learners only ever see their own linked records.

**Why it matters.** This is master data. If it is wrong here it is wrong everywhere downstream — bookings, invoices, analytics and reports all read from it.

**How to use it**

1. Open the page — the list loads with a search box and filters at the top.
2. Click Add / New to create a record. Only the marked fields are required; the rest can be completed later.
3. Click any row to open the full record, edit it inline, and save.
4. Use Export CSV whenever you want a copy — the data belongs to the studio, not the platform.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full read/write across every record.
- **Tutor:** Read/write for the engagements they teach.
- **Parent:** Only their own children appear.
- **Learner:** Only their own record appears.

**Connects to.** Sits in the Core group, alongside engagements, learners, parents, subjects, tutors. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Learners · `learners.html` · 🎓 Staff

Learner records: identity, timezone, exam board, learning style, accommodations, guardian, Drive photo. A learner may sit in one or many engagements independently. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner, admin and tutors do the data entry. Parents and learners only ever see their own linked records.

**Why it matters.** This is master data. If it is wrong here it is wrong everywhere downstream — bookings, invoices, analytics and reports all read from it.

**How to use it**

1. Open the page — the list loads with a search box and filters at the top.
2. Click Add / New to create a record. Only the marked fields are required; the rest can be completed later.
3. Click any row to open the full record, edit it inline, and save.
4. Use Export CSV whenever you want a copy — the data belongs to the studio, not the platform.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full read/write across every record.
- **Tutor:** Read/write for the engagements they teach.
- **Parent:** Only their own children appear.
- **Learner:** Only their own record appears.

**Common tasks.** add a new learner · find a student ID · record an accommodation · export the learner list

**Connects to.** Sits in the Core group, alongside engagements, groups, parents, subjects, tutors. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Parents · `parents.html` · 🎓 Staff

Parent registry and parent–learner mapping. A parent only ever sees their own children. Siblings remain independent engagements. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner, admin and tutors do the data entry. Parents and learners only ever see their own linked records.

**Why it matters.** This is master data. If it is wrong here it is wrong everywhere downstream — bookings, invoices, analytics and reports all read from it.

**How to use it**

1. Open the page — the list loads with a search box and filters at the top.
2. Click Add / New to create a record. Only the marked fields are required; the rest can be completed later.
3. Click any row to open the full record, edit it inline, and save.
4. Use Export CSV whenever you want a copy — the data belongs to the studio, not the platform.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full read/write across every record.
- **Tutor:** Read/write for the engagements they teach.
- **Parent:** Only their own children appear.
- **Learner:** Only their own record appears.

**Common tasks.** link a parent to a child · give a parent portal access

**Connects to.** Sits in the Core group, alongside engagements, groups, learners, subjects, tutors. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Subjects · `subjects.html` · 🎓 Staff

Maths, English, Physics, SAT, WAEC, IGCSE, IELTS… Each subject can carry a board, level and default methodology. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner, admin and tutors do the data entry. Parents and learners only ever see their own linked records.

**Why it matters.** This is master data. If it is wrong here it is wrong everywhere downstream — bookings, invoices, analytics and reports all read from it.

**How to use it**

1. Open the page — the list loads with a search box and filters at the top.
2. Click Add / New to create a record. Only the marked fields are required; the rest can be completed later.
3. Click any row to open the full record, edit it inline, and save.
4. Use Export CSV whenever you want a copy — the data belongs to the studio, not the platform.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full read/write across every record.
- **Tutor:** Read/write for the engagements they teach.
- **Parent:** Only their own children appear.
- **Learner:** Only their own record appears.

**Connects to.** Sits in the Core group, alongside engagements, groups, learners, parents, tutors. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Tutors · `tutors.html` · 🎓 Staff

Solo or multi-tutor practice. Availability, subjects, hourly cost, timezone, specialisms. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner, admin and tutors do the data entry. Parents and learners only ever see their own linked records.

**Why it matters.** This is master data. If it is wrong here it is wrong everywhere downstream — bookings, invoices, analytics and reports all read from it.

**How to use it**

1. Open the page — the list loads with a search box and filters at the top.
2. Click Add / New to create a record. Only the marked fields are required; the rest can be completed later.
3. Click any row to open the full record, edit it inline, and save.
4. Use Export CSV whenever you want a copy — the data belongs to the studio, not the platform.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full read/write across every record.
- **Tutor:** Read/write for the engagements they teach.
- **Parent:** Only their own children appear.
- **Learner:** Only their own record appears.

**Connects to.** Sits in the Core group, alongside engagements, groups, learners, parents, subjects. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

## Finance

### Books &amp; materials · `products.html` · 🎓 Staff

Past papers, workbooks, kits sold alongside tutoring. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner and admin. A parent sees only their own invoices, payments and receipts.

**Why it matters.** Cash flow keeps the studio alive. Because hours, rates and sessions are already in the system, the money side is arithmetic rather than guesswork.

**How to use it**

1. Set your rates and packages once in the fee catalogue.
2. Generate the invoice from a booking or an hour bank — the maths is done for you.
3. Record each payment as it arrives and issue the receipt.
4. Reconcile the totals at month end against your bank.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** All money: invoices, payments, payroll, totals.
- **Tutor:** Their own payroll only.
- **Parent:** Their own invoices, payments and receipts.
- **Learner:** No access.

**Connects to.** Sits in the Finance group, alongside fees, finance, invoices, packages, payment-history, payments. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Fee catalogue · `fees.html` · 🎓 Staff

Rate cards: 1:1 vs group, subject premiums, weekend rates, trial fees. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner and admin. A parent sees only their own invoices, payments and receipts.

**Why it matters.** Cash flow keeps the studio alive. Because hours, rates and sessions are already in the system, the money side is arithmetic rather than guesswork.

**How to use it**

1. Set your rates and packages once in the fee catalogue.
2. Generate the invoice from a booking or an hour bank — the maths is done for you.
3. Record each payment as it arrives and issue the receipt.
4. Reconcile the totals at month end against your bank.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** All money: invoices, payments, payroll, totals.
- **Tutor:** Their own payroll only.
- **Parent:** Their own invoices, payments and receipts.
- **Learner:** No access.

**Connects to.** Sits in the Finance group, alongside finance, invoices, packages, payment-history, payments, payroll. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Hour banks · `packages.html` · 🎓 Staff

Prepaid hours or lesson packs (TutorCruncher/Tutorbase parity). Each engagement has its own bank. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner and admin. A parent sees only their own invoices, payments and receipts.

**Why it matters.** Cash flow keeps the studio alive. Because hours, rates and sessions are already in the system, the money side is arithmetic rather than guesswork.

**How to use it**

1. Set your rates and packages once in the fee catalogue.
2. Generate the invoice from a booking or an hour bank — the maths is done for you.
3. Record each payment as it arrives and issue the receipt.
4. Reconcile the totals at month end against your bank.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** All money: invoices, payments, payroll, totals.
- **Tutor:** Their own payroll only.
- **Parent:** Their own invoices, payments and receipts.
- **Learner:** No access.

**Connects to.** Sits in the Finance group, alongside fees, finance, invoices, payment-history, payments, payroll. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Invoices · `invoices.html` · 👨‍👩‍👧 Family

Generate from sessions or from packages. Printable. Multi-currency. The main actions available here are: Sign out, Theme. Requires sign-in. Parents see only their own children; a learner sees only themselves. Row Level Security enforces this in the database, not just in the interface.

**Who it is for.** Owner and admin. A parent sees only their own invoices, payments and receipts.

**Why it matters.** Cash flow keeps the studio alive. Because hours, rates and sessions are already in the system, the money side is arithmetic rather than guesswork.

**How to use it**

1. Set your rates and packages once in the fee catalogue.
2. Generate the invoice from a booking or an hour bank — the maths is done for you.
3. Record each payment as it arrives and issue the receipt.
4. Reconcile the totals at month end against your bank.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** All money: invoices, payments, payroll, totals.
- **Tutor:** Their own payroll only.
- **Parent:** Their own invoices, payments and receipts.
- **Learner:** No access.

**Common tasks.** raise an invoice · print an invoice · chase an unpaid invoice

**Connects to.** Sits in the Finance group, alongside fees, finance, packages, payment-history, payments, payroll. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Payment history · `payment-history.html` · 👨‍👩‍👧 Family

Family-safe history and printable receipts. The main actions available here are: Sign out, Theme. Requires sign-in. Parents see only their own children; a learner sees only themselves. Row Level Security enforces this in the database, not just in the interface.

**Who it is for.** Owner and admin. A parent sees only their own invoices, payments and receipts.

**Why it matters.** Cash flow keeps the studio alive. Because hours, rates and sessions are already in the system, the money side is arithmetic rather than guesswork.

**How to use it**

1. Set your rates and packages once in the fee catalogue.
2. Generate the invoice from a booking or an hour bank — the maths is done for you.
3. Record each payment as it arrives and issue the receipt.
4. Reconcile the totals at month end against your bank.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** All money: invoices, payments, payroll, totals.
- **Tutor:** Their own payroll only.
- **Parent:** Their own invoices, payments and receipts.
- **Learner:** No access.

**Connects to.** Sits in the Finance group, alongside fees, finance, invoices, packages, payments, payroll. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Payments · `payments.html` · 🎓 Staff

Record bank transfer / cash / Paystack / Flutterwave / Stripe checkout links. No forced processor fee to us. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner and admin. A parent sees only their own invoices, payments and receipts.

**Why it matters.** Cash flow keeps the studio alive. Because hours, rates and sessions are already in the system, the money side is arithmetic rather than guesswork.

**How to use it**

1. Set your rates and packages once in the fee catalogue.
2. Generate the invoice from a booking or an hour bank — the maths is done for you.
3. Record each payment as it arrives and issue the receipt.
4. Reconcile the totals at month end against your bank.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** All money: invoices, payments, payroll, totals.
- **Tutor:** Their own payroll only.
- **Parent:** Their own invoices, payments and receipts.
- **Learner:** No access.

**Common tasks.** record a payment · issue a receipt

**Connects to.** Sits in the Finance group, alongside fees, finance, invoices, packages, payment-history, payroll. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Practice finance · `finance.html` · 🛡️ Owner/admin

Income / expense ledger and simple P&L. Free-tier safe. The main actions available here are: Sign out, Theme. Owner/admin only. These pages control money, safeguarding, audit or platform configuration, so they sit behind the highest role check.

**Who it is for.** Owner and admin. A parent sees only their own invoices, payments and receipts.

**Why it matters.** Cash flow keeps the studio alive. Because hours, rates and sessions are already in the system, the money side is arithmetic rather than guesswork.

**How to use it**

1. Set your rates and packages once in the fee catalogue.
2. Generate the invoice from a booking or an hour bank — the maths is done for you.
3. Record each payment as it arrives and issue the receipt.
4. Reconcile the totals at month end against your bank.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** All money: invoices, payments, payroll, totals.
- **Tutor:** Their own payroll only.
- **Parent:** Their own invoices, payments and receipts.
- **Learner:** No access.

**Connects to.** Sits in the Finance group, alongside fees, invoices, packages, payment-history, payments, payroll. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Scholarships &amp; discounts · `scholarships.html` · 🎓 Staff

Sibling discount, hardship, referral credit — applied per engagement. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner and admin. A parent sees only their own invoices, payments and receipts.

**Why it matters.** Cash flow keeps the studio alive. Because hours, rates and sessions are already in the system, the money side is arithmetic rather than guesswork.

**How to use it**

1. Set your rates and packages once in the fee catalogue.
2. Generate the invoice from a booking or an hour bank — the maths is done for you.
3. Record each payment as it arrives and issue the receipt.
4. Reconcile the totals at month end against your bank.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** All money: invoices, payments, payroll, totals.
- **Tutor:** Their own payroll only.
- **Parent:** Their own invoices, payments and receipts.
- **Learner:** No access.

**Connects to.** Sits in the Finance group, alongside fees, finance, invoices, packages, payment-history, payments. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Tutor payroll · `payroll.html` · 🛡️ Owner/admin

Hours × rate, bonuses, deductions. Solo tutors can ignore this. The main actions available here are: Sign out, Theme. Owner/admin only. These pages control money, safeguarding, audit or platform configuration, so they sit behind the highest role check.

**Who it is for.** Owner and admin. A parent sees only their own invoices, payments and receipts.

**Why it matters.** Cash flow keeps the studio alive. Because hours, rates and sessions are already in the system, the money side is arithmetic rather than guesswork.

**How to use it**

1. Set your rates and packages once in the fee catalogue.
2. Generate the invoice from a booking or an hour bank — the maths is done for you.
3. Record each payment as it arrives and issue the receipt.
4. Reconcile the totals at month end against your bank.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** All money: invoices, payments, payroll, totals.
- **Tutor:** Their own payroll only.
- **Parent:** Their own invoices, payments and receipts.
- **Learner:** No access.

**Connects to.** Sits in the Finance group, alongside fees, finance, invoices, packages, payment-history, payments. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

## Growth

### Application links · `application-links.html` · 🛡️ Owner/admin

Generate robust, expiring, limited-use application URLs for a subject, 1:1 or group. Each code has its own form copy and use counter. The main actions available here are: Create link, Sign out, Theme. Owner/admin only. These pages control money, safeguarding, audit or platform configuration, so they sit behind the highest role check.

**Who it is for.** Owner and admin — this is business development. Families never see the pipeline.

**Why it matters.** Tutoring income is won or lost at the top of the funnel. Recording every enquiry means you can see which channel actually produces paying families.

**How to use it**

1. New enquiries land here automatically from the public Apply form and the contact form.
2. Triage each one: assign an owner, set a status, add a note about what was discussed.
3. Convert a warm enquiry into a trial lesson, then into a full engagement once they commit.
4. Watch the funnel counts at the top — they show you exactly where prospects go cold.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full pipeline and conversion figures.
- **Tutor:** Usually read-only; may add notes after a trial.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Growth group, alongside apply, exam-links, exam-register, flyer, inquiries, onboarding. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Exam registration · `exam-register.html` · 🌍 Public

Candidate form opened by an exam link. Local and international boards. The main actions available here are: Sign out, Submit registration, Theme. It is form-driven — you fill a form and save; the record appears in the list immediately. Open to anyone, no sign-in needed. It is deliberately indexed by search engines so families can find the studio.

**Who it is for.** Owner and admin — this is business development. Families never see the pipeline.

**Why it matters.** Tutoring income is won or lost at the top of the funnel. Recording every enquiry means you can see which channel actually produces paying families.

**How to use it**

1. New enquiries land here automatically from the public Apply form and the contact form.
2. Triage each one: assign an owner, set a status, add a note about what was discussed.
3. Convert a warm enquiry into a trial lesson, then into a full engagement once they commit.
4. Watch the funnel counts at the top — they show you exactly where prospects go cold.

**Sections on this page**

- **Hero** — The headline promise and the primary call to action.
- **Proof** — Statistics and feature cards that answer "why should I trust this studio?".
- **Call to action** — Sign in, or request a place.
- **Footer** — Contact details, social links and the HMG Concepts ecosystem links, which also help search engines connect the sites.

**What each role sees**

- **Owner:** Full pipeline and conversion figures.
- **Tutor:** Usually read-only; may add notes after a trial.
- **Parent:** No access.
- **Learner:** No access.

**Common tasks.** register for WAEC or IGCSE · upload a passport photo link

**Connects to.** Sits in the Growth group, alongside application-links, apply, exam-links, flyer, inquiries, onboarding. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Exam registration links · `exam-links.html` · 🎓 Staff

Shareable links for WAEC, NECO, UTME, IGCSE, IELTS, SAT and more. Passport as Drive link only. The main actions available here are: Create link, Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner and admin — this is business development. Families never see the pipeline.

**Why it matters.** Tutoring income is won or lost at the top of the funnel. Recording every enquiry means you can see which channel actually produces paying families.

**How to use it**

1. New enquiries land here automatically from the public Apply form and the contact form.
2. Triage each one: assign an owner, set a status, add a note about what was discussed.
3. Convert a warm enquiry into a trial lesson, then into a full engagement once they commit.
4. Watch the funnel counts at the top — they show you exactly where prospects go cold.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full pipeline and conversion figures.
- **Tutor:** Usually read-only; may add notes after a trial.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Growth group, alongside application-links, apply, exam-register, flyer, inquiries, onboarding. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Inquiries · `inquiries.html` · 🎓 Staff

Parent-requested tutoring pipeline: new → contacted → trial booked → converted / lost. Source, subject, preferred mode. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner and admin — this is business development. Families never see the pipeline.

**Why it matters.** Tutoring income is won or lost at the top of the funnel. Recording every enquiry means you can see which channel actually produces paying families.

**How to use it**

1. New enquiries land here automatically from the public Apply form and the contact form.
2. Triage each one: assign an owner, set a status, add a note about what was discussed.
3. Convert a warm enquiry into a trial lesson, then into a full engagement once they commit.
4. Watch the funnel counts at the top — they show you exactly where prospects go cold.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full pipeline and conversion figures.
- **Tutor:** Usually read-only; may add notes after a trial.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Growth group, alongside application-links, apply, exam-links, exam-register, flyer, onboarding. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Marketing flyer · `flyer.html` · 🌍 Public

Printable admissions flyer. Free lead-gen. The main actions available here are: Sign out, Theme. Open to anyone, no sign-in needed. It is deliberately indexed by search engines so families can find the studio.

**Who it is for.** Owner and admin — this is business development. Families never see the pipeline.

**Why it matters.** Tutoring income is won or lost at the top of the funnel. Recording every enquiry means you can see which channel actually produces paying families.

**How to use it**

1. New enquiries land here automatically from the public Apply form and the contact form.
2. Triage each one: assign an owner, set a status, add a note about what was discussed.
3. Convert a warm enquiry into a trial lesson, then into a full engagement once they commit.
4. Watch the funnel counts at the top — they show you exactly where prospects go cold.

**Sections on this page**

- **Hero** — The headline promise and the primary call to action.
- **Proof** — Statistics and feature cards that answer "why should I trust this studio?".
- **Call to action** — Sign in, or request a place.
- **Footer** — Contact details, social links and the HMG Concepts ecosystem links, which also help search engines connect the sites.

**What each role sees**

- **Owner:** Full pipeline and conversion figures.
- **Tutor:** Usually read-only; may add notes after a trial.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Growth group, alongside application-links, apply, exam-links, exam-register, inquiries, onboarding. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Onboarding checklists · `onboarding.html` · 🎓 Staff

Consent, goals interview, diagnostic, first package, first session — tracked per engagement. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner and admin — this is business development. Families never see the pipeline.

**Why it matters.** Tutoring income is won or lost at the top of the funnel. Recording every enquiry means you can see which channel actually produces paying families.

**How to use it**

1. New enquiries land here automatically from the public Apply form and the contact form.
2. Triage each one: assign an owner, set a status, add a note about what was discussed.
3. Convert a warm enquiry into a trial lesson, then into a full engagement once they commit.
4. Watch the funnel counts at the top — they show you exactly where prospects go cold.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full pipeline and conversion figures.
- **Tutor:** Usually read-only; may add notes after a trial.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Growth group, alongside application-links, apply, exam-links, exam-register, flyer, inquiries. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Public self-booking · `public-book.html` · 🌍 Public

Parents pick an open slot from tutor availability. No Calendly fee. Lands as an inquiry you confirm into a 4-cycle booking. The main actions available here are: Request this slot, Sign out, Theme. Open to anyone, no sign-in needed. It is deliberately indexed by search engines so families can find the studio.

**Who it is for.** Owner and admin — this is business development. Families never see the pipeline.

**Why it matters.** Tutoring income is won or lost at the top of the funnel. Recording every enquiry means you can see which channel actually produces paying families.

**How to use it**

1. New enquiries land here automatically from the public Apply form and the contact form.
2. Triage each one: assign an owner, set a status, add a note about what was discussed.
3. Convert a warm enquiry into a trial lesson, then into a full engagement once they commit.
4. Watch the funnel counts at the top — they show you exactly where prospects go cold.

**Sections on this page**

- **Hero** — The headline promise and the primary call to action.
- **Proof** — Statistics and feature cards that answer "why should I trust this studio?".
- **Call to action** — Sign in, or request a place.
- **Footer** — Contact details, social links and the HMG Concepts ecosystem links, which also help search engines connect the sites.

**What each role sees**

- **Owner:** Full pipeline and conversion figures.
- **Tutor:** Usually read-only; may add notes after a trial.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Growth group, alongside application-links, apply, exam-links, exam-register, flyer, inquiries. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Referrals · `referrals.html` · 🎓 Staff

Track who referred whom and the credit granted. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner and admin — this is business development. Families never see the pipeline.

**Why it matters.** Tutoring income is won or lost at the top of the funnel. Recording every enquiry means you can see which channel actually produces paying families.

**How to use it**

1. New enquiries land here automatically from the public Apply form and the contact form.
2. Triage each one: assign an owner, set a status, add a note about what was discussed.
3. Convert a warm enquiry into a trial lesson, then into a full engagement once they commit.
4. Watch the funnel counts at the top — they show you exactly where prospects go cold.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full pipeline and conversion figures.
- **Tutor:** Usually read-only; may add notes after a trial.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Growth group, alongside application-links, apply, exam-links, exam-register, flyer, inquiries. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Request a place · `apply.html` · 🌍 Public

Public page parents use to request tutoring. Also opens shareable application links (?code=). The main actions available here are: Sign out, Submit application, Theme. It is form-driven — you fill a form and save; the record appears in the list immediately. Open to anyone, no sign-in needed. It is deliberately indexed by search engines so families can find the studio.

**Who it is for.** Owner and admin — this is business development. Families never see the pipeline.

**Why it matters.** Tutoring income is won or lost at the top of the funnel. Recording every enquiry means you can see which channel actually produces paying families.

**How to use it**

1. New enquiries land here automatically from the public Apply form and the contact form.
2. Triage each one: assign an owner, set a status, add a note about what was discussed.
3. Convert a warm enquiry into a trial lesson, then into a full engagement once they commit.
4. Watch the funnel counts at the top — they show you exactly where prospects go cold.

**Sections on this page**

- **Hero** — The headline promise and the primary call to action.
- **Proof** — Statistics and feature cards that answer "why should I trust this studio?".
- **Call to action** — Sign in, or request a place.
- **Footer** — Contact details, social links and the HMG Concepts ecosystem links, which also help search engines connect the sites.

**What each role sees**

- **Owner:** Full pipeline and conversion figures.
- **Tutor:** Usually read-only; may add notes after a trial.
- **Parent:** No access.
- **Learner:** No access.

**Common tasks.** request a place · apply for tutoring

**Connects to.** Sits in the Growth group, alongside application-links, exam-links, exam-register, flyer, inquiries, onboarding. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Reviews &amp; testimonials · `reviews.html` · 🎓 Staff

Collect and optionally publish reviews on the public site (SEO). The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner and admin — this is business development. Families never see the pipeline.

**Why it matters.** Tutoring income is won or lost at the top of the funnel. Recording every enquiry means you can see which channel actually produces paying families.

**How to use it**

1. New enquiries land here automatically from the public Apply form and the contact form.
2. Triage each one: assign an owner, set a status, add a note about what was discussed.
3. Convert a warm enquiry into a trial lesson, then into a full engagement once they commit.
4. Watch the funnel counts at the top — they show you exactly where prospects go cold.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full pipeline and conversion figures.
- **Tutor:** Usually read-only; may add notes after a trial.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Growth group, alongside application-links, apply, exam-links, exam-register, flyer, inquiries. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Trial lessons · `trials.html` · 🎓 Staff

Free or paid diagnostic trial. Captures baseline score and fit notes before a package is sold. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner and admin — this is business development. Families never see the pipeline.

**Why it matters.** Tutoring income is won or lost at the top of the funnel. Recording every enquiry means you can see which channel actually produces paying families.

**How to use it**

1. New enquiries land here automatically from the public Apply form and the contact form.
2. Triage each one: assign an owner, set a status, add a note about what was discussed.
3. Convert a warm enquiry into a trial lesson, then into a full engagement once they commit.
4. Watch the funnel counts at the top — they show you exactly where prospects go cold.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full pipeline and conversion figures.
- **Tutor:** Usually read-only; may add notes after a trial.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Growth group, alongside application-links, apply, exam-links, exam-register, flyer, inquiries. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Waitlist · `waitlist.html` · 🎓 Staff

Hold demand when a slot or group is full. Promote into an engagement with one click. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner and admin — this is business development. Families never see the pipeline.

**Why it matters.** Tutoring income is won or lost at the top of the funnel. Recording every enquiry means you can see which channel actually produces paying families.

**How to use it**

1. New enquiries land here automatically from the public Apply form and the contact form.
2. Triage each one: assign an owner, set a status, add a note about what was discussed.
3. Convert a warm enquiry into a trial lesson, then into a full engagement once they commit.
4. Watch the funnel counts at the top — they show you exactly where prospects go cold.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full pipeline and conversion figures.
- **Tutor:** Usually read-only; may add notes after a trial.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Growth group, alongside application-links, apply, exam-links, exam-register, flyer, inquiries. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

## HMG Concepts

### HMG Digital Products · `hmg-products.html` · 🌍 Public

Product catalogue and contact paths for the ecosystem. The main actions available here are: Sign out, Theme. Open to anyone, no sign-in needed. It is deliberately indexed by search engines so families can find the studio.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Hero** — The headline promise and the primary call to action.
- **Proof** — Statistics and feature cards that answer "why should I trust this studio?".
- **Call to action** — Sign in, or request a place.
- **Footer** — Contact details, social links and the HMG Concepts ecosystem links, which also help search engines connect the sites.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the HMG Concepts group, alongside hmg-ecosystem. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### HMG Ecosystem · `hmg-ecosystem.html` · 🌍 Public

HMG Concepts, Technologies, Academy, Media, Gospel. Visible on every generated studio. The main actions available here are: Sign out, Theme. Open to anyone, no sign-in needed. It is deliberately indexed by search engines so families can find the studio.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Hero** — The headline promise and the primary call to action.
- **Proof** — Statistics and feature cards that answer "why should I trust this studio?".
- **Call to action** — Sign in, or request a place.
- **Footer** — Contact details, social links and the HMG Concepts ecosystem links, which also help search engines connect the sites.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the HMG Concepts group, alongside hmg-products. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

## Learning

### Accommodations / SEN · `accommodations.html` · 🎓 Staff

Extra time, reader, rest breaks, large print. Printed onto practice tests and reports. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Tutors author the content, learners work through it, parents watch the progress.

**Why it matters.** This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.

**How to use it**

1. Pick the engagement, and the learner if it is a group.
2. Add or import the items you need — topics, tasks, questions or reading links.
3. Publish, so the learner sees it on their own dashboard.
4. Track completion and scores as the work comes back in.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Everything, plus quality oversight.
- **Tutor:** Authors and marks the work.
- **Parent:** Sees what was set and whether it was completed.
- **Learner:** Does the work and sees their feedback.

**Connects to.** Sits in the Learning group, alongside assignments, cbt-exam, cbt-multi, cbt-prompts, cbt-review, certificates. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Certificates · `certificates.html` · 👨‍👩‍👧 Family

Printable milestone certificates with a verification code. The main actions available here are: Sign out, Theme. Requires sign-in. Parents see only their own children; a learner sees only themselves. Row Level Security enforces this in the database, not just in the interface.

**Who it is for.** Tutors author the content, learners work through it, parents watch the progress.

**Why it matters.** This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.

**How to use it**

1. Pick the engagement, and the learner if it is a group.
2. Add or import the items you need — topics, tasks, questions or reading links.
3. Publish, so the learner sees it on their own dashboard.
4. Track completion and scores as the work comes back in.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Everything, plus quality oversight.
- **Tutor:** Authors and marks the work.
- **Parent:** Sees what was set and whether it was completed.
- **Learner:** Does the work and sees their feedback.

**Connects to.** Sits in the Learning group, alongside accommodations, assignments, cbt-exam, cbt-multi, cbt-prompts, cbt-review. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Classwork · `classwork.html` · 👨‍👩‍👧 Family

Work organised by topic. Assignments, quizzes, materials, comment-only return, skills tags. The main actions available here are: Add classwork, Sign out, Theme. Requires sign-in. Parents see only their own children; a learner sees only themselves. Row Level Security enforces this in the database, not just in the interface.

**Who it is for.** Tutors author the content, learners work through it, parents watch the progress.

**Why it matters.** This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.

**How to use it**

1. Pick the engagement, and the learner if it is a group.
2. Add or import the items you need — topics, tasks, questions or reading links.
3. Publish, so the learner sees it on their own dashboard.
4. Track completion and scores as the work comes back in.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Everything, plus quality oversight.
- **Tutor:** Authors and marks the work.
- **Parent:** Sees what was set and whether it was completed.
- **Learner:** Does the work and sees their feedback.

**Connects to.** Sits in the Learning group, alongside accommodations, assignments, cbt-exam, cbt-multi, cbt-prompts, cbt-review. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Curriculum maps · `curriculum.html` · 🎓 Staff

Independent scheme of work per engagement — not a shared school class list. Tick coverage weekly. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Tutors author the content, learners work through it, parents watch the progress.

**Why it matters.** This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.

**How to use it**

1. Pick the engagement, and the learner if it is a group.
2. Add or import the items you need — topics, tasks, questions or reading links.
3. Publish, so the learner sees it on their own dashboard.
4. Track completion and scores as the work comes back in.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Everything, plus quality oversight.
- **Tutor:** Authors and marks the work.
- **Parent:** Sees what was set and whether it was completed.
- **Learner:** Does the work and sees their feedback.

**Connects to.** Sits in the Learning group, alongside accommodations, assignments, cbt-exam, cbt-multi, cbt-prompts, cbt-review. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Diagnostics · `diagnostics.html` · 🎓 Staff

Baseline tests at the start of an engagement. Locks the value-added starting point. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Tutors author the content, learners work through it, parents watch the progress.

**Why it matters.** This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.

**How to use it**

1. Pick the engagement, and the learner if it is a group.
2. Add or import the items you need — topics, tasks, questions or reading links.
3. Publish, so the learner sees it on their own dashboard.
4. Track completion and scores as the work comes back in.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Everything, plus quality oversight.
- **Tutor:** Authors and marks the work.
- **Parent:** Sees what was set and whether it was completed.
- **Learner:** Does the work and sees their feedback.

**Connects to.** Sits in the Learning group, alongside accommodations, assignments, cbt-exam, cbt-multi, cbt-prompts, cbt-review. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Digital library · `library.html` · 🎓 Staff

Catalogued reading / past-paper links with optional comprehension score. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Tutors author the content, learners work through it, parents watch the progress.

**Why it matters.** This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.

**How to use it**

1. Pick the engagement, and the learner if it is a group.
2. Add or import the items you need — topics, tasks, questions or reading links.
3. Publish, so the learner sees it on their own dashboard.
4. Track completion and scores as the work comes back in.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Everything, plus quality oversight.
- **Tutor:** Authors and marks the work.
- **Parent:** Sees what was set and whether it was completed.
- **Learner:** Does the work and sees their feedback.

**Connects to.** Sits in the Learning group, alongside accommodations, assignments, cbt-exam, cbt-multi, cbt-prompts, cbt-review. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### E-resources / notes · `eresources.html` · 🎓 Staff

Study materials as Drive or web links, organised by subject and engagement. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Tutors author the content, learners work through it, parents watch the progress.

**Why it matters.** This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.

**How to use it**

1. Pick the engagement, and the learner if it is a group.
2. Add or import the items you need — topics, tasks, questions or reading links.
3. Publish, so the learner sees it on their own dashboard.
4. Track completion and scores as the work comes back in.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Everything, plus quality oversight.
- **Tutor:** Authors and marks the work.
- **Parent:** Sees what was set and whether it was completed.
- **Learner:** Does the work and sees their feedback.

**Connects to.** Sits in the Learning group, alongside accommodations, assignments, cbt-exam, cbt-multi, cbt-prompts, cbt-review. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Goals &amp; learning plans · `goals.html` · 🎓 Staff

SMART goals and a living plan per engagement and per learner. Review dates, owners, status. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Tutors author the content, learners work through it, parents watch the progress.

**Why it matters.** This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.

**How to use it**

1. Pick the engagement, and the learner if it is a group.
2. Add or import the items you need — topics, tasks, questions or reading links.
3. Publish, so the learner sees it on their own dashboard.
4. Track completion and scores as the work comes back in.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Everything, plus quality oversight.
- **Tutor:** Authors and marks the work.
- **Parent:** Sees what was set and whether it was completed.
- **Learner:** Does the work and sees their feedback.

**Connects to.** Sits in the Learning group, alongside accommodations, assignments, cbt-exam, cbt-multi, cbt-prompts, cbt-review. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Homework · `assignments.html` · 🎓 Staff

Set, collect (Drive link), mark, and score. Completion rate feeds insights. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Tutors author the content, learners work through it, parents watch the progress.

**Why it matters.** This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.

**How to use it**

1. Pick the engagement, and the learner if it is a group.
2. Add or import the items you need — topics, tasks, questions or reading links.
3. Publish, so the learner sees it on their own dashboard.
4. Track completion and scores as the work comes back in.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Everything, plus quality oversight.
- **Tutor:** Authors and marks the work.
- **Parent:** Sees what was set and whether it was completed.
- **Learner:** Does the work and sees their feedback.

**Connects to.** Sits in the Learning group, alongside accommodations, cbt-exam, cbt-multi, cbt-prompts, cbt-review, certificates. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Learner portfolio · `portfolio.html` · 👨‍👩‍👧 Family

Best work, recordings, marked scripts — Drive links curated for applications. The main actions available here are: Sign out, Theme. Requires sign-in. Parents see only their own children; a learner sees only themselves. Row Level Security enforces this in the database, not just in the interface.

**Who it is for.** Tutors author the content, learners work through it, parents watch the progress.

**Why it matters.** This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.

**How to use it**

1. Pick the engagement, and the learner if it is a group.
2. Add or import the items you need — topics, tasks, questions or reading links.
3. Publish, so the learner sees it on their own dashboard.
4. Track completion and scores as the work comes back in.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Everything, plus quality oversight.
- **Tutor:** Authors and marks the work.
- **Parent:** Sees what was set and whether it was completed.
- **Learner:** Does the work and sees their feedback.

**Connects to.** Sits in the Learning group, alongside accommodations, assignments, cbt-exam, cbt-multi, cbt-prompts, cbt-review. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Learning styles · `learning-styles.html` · 🎓 Staff

Observed notes (visual, verbal, worked-example first…). Not a quiz religion — a working memory for the tutor. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Tutors author the content, learners work through it, parents watch the progress.

**Why it matters.** This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.

**How to use it**

1. Pick the engagement, and the learner if it is a group.
2. Add or import the items you need — topics, tasks, questions or reading links.
3. Publish, so the learner sees it on their own dashboard.
4. Track completion and scores as the work comes back in.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Everything, plus quality oversight.
- **Tutor:** Authors and marks the work.
- **Parent:** Sees what was set and whether it was completed.
- **Learner:** Does the work and sees their feedback.

**Connects to.** Sits in the Learning group, alongside accommodations, assignments, cbt-exam, cbt-multi, cbt-prompts, cbt-review. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Lesson plans · `lesson-plans.html` · 🎓 Staff

Objectives, resources, checks for understanding. Linked to a session and a methodology. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Tutors author the content, learners work through it, parents watch the progress.

**Why it matters.** This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.

**How to use it**

1. Pick the engagement, and the learner if it is a group.
2. Add or import the items you need — topics, tasks, questions or reading links.
3. Publish, so the learner sees it on their own dashboard.
4. Track completion and scores as the work comes back in.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Everything, plus quality oversight.
- **Tutor:** Authors and marks the work.
- **Parent:** Sees what was set and whether it was completed.
- **Learner:** Does the work and sees their feedback.

**Connects to.** Sits in the Learning group, alongside accommodations, assignments, cbt-exam, cbt-multi, cbt-prompts, cbt-review. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Methodologies · `methodologies.html` · 🎓 Staff

Your teaching methods library (spaced retrieval, worked examples, CRA, exam-technique drills…). Attach one to each engagement. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Tutors author the content, learners work through it, parents watch the progress.

**Why it matters.** This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.

**How to use it**

1. Pick the engagement, and the learner if it is a group.
2. Add or import the items you need — topics, tasks, questions or reading links.
3. Publish, so the learner sees it on their own dashboard.
4. Track completion and scores as the work comes back in.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Everything, plus quality oversight.
- **Tutor:** Authors and marks the work.
- **Parent:** Sees what was set and whether it was completed.
- **Learner:** Does the work and sees their feedback.

**Connects to.** Sits in the Learning group, alongside accommodations, assignments, cbt-exam, cbt-multi, cbt-prompts, cbt-review. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Mini LMS · `lms.html` · 🎓 Staff

Courses, lessons, completion — scoped to an engagement. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Tutors author the content, learners work through it, parents watch the progress.

**Why it matters.** This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.

**How to use it**

1. Pick the engagement, and the learner if it is a group.
2. Add or import the items you need — topics, tasks, questions or reading links.
3. Publish, so the learner sees it on their own dashboard.
4. Track completion and scores as the work comes back in.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Everything, plus quality oversight.
- **Tutor:** Authors and marks the work.
- **Parent:** Sees what was set and whether it was completed.
- **Learner:** Does the work and sees their feedback.

**Connects to.** Sits in the Learning group, alongside accommodations, assignments, cbt-exam, cbt-multi, cbt-prompts, cbt-review. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Multi-subject CBT · `cbt-multi.html` · 🔑 Quiz code

One sitting, subject tabs (UTME-style). Shared timer, per-subject breakdown, same anti-cheat. The main actions available here are: Open paper. Reachable without a portal password, but useless without a valid quiz code plus the learner's student ID. The code is the gate.

**Who it is for.** Tutors author the content, learners work through it, parents watch the progress.

**Why it matters.** This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.

**How to use it**

1. Pick the engagement, and the learner if it is a group.
2. Add or import the items you need — topics, tasks, questions or reading links.
3. Publish, so the learner sees it on their own dashboard.
4. Track completion and scores as the work comes back in.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Everything, plus quality oversight.
- **Tutor:** Authors and marks the work.
- **Parent:** Sees what was set and whether it was completed.
- **Learner:** Does the work and sees their feedback.

**Connects to.** Sits in the Learning group, alongside accommodations, assignments, cbt-exam, cbt-prompts, cbt-review, certificates. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Progress reports · `progress-reports.html` · 👨‍👩‍👧 Family

Parent-ready branded reports: hours, attendance, mastery, value-added, next steps, methodology used. The main actions available here are: Sign out, Theme. Requires sign-in. Parents see only their own children; a learner sees only themselves. Row Level Security enforces this in the database, not just in the interface.

**Who it is for.** Tutors author the content, learners work through it, parents watch the progress.

**Why it matters.** This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.

**How to use it**

1. Pick the engagement, and the learner if it is a group.
2. Add or import the items you need — topics, tasks, questions or reading links.
3. Publish, so the learner sees it on their own dashboard.
4. Track completion and scores as the work comes back in.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Everything, plus quality oversight.
- **Tutor:** Authors and marks the work.
- **Parent:** Sees what was set and whether it was completed.
- **Learner:** Does the work and sees their feedback.

**Connects to.** Sits in the Learning group, alongside accommodations, assignments, cbt-exam, cbt-multi, cbt-prompts, cbt-review. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Question bank prompts · `cbt-prompts.html` · 🎓 Staff

Copy-paste prompts for any free external chat to emit CSV questions. The platform never calls a paid AI. The main actions available here are: Build prompt, Copy, Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Tutors author the content, learners work through it, parents watch the progress.

**Why it matters.** This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.

**How to use it**

1. Pick the engagement, and the learner if it is a group.
2. Add or import the items you need — topics, tasks, questions or reading links.
3. Publish, so the learner sees it on their own dashboard.
4. Track completion and scores as the work comes back in.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Everything, plus quality oversight.
- **Tutor:** Authors and marks the work.
- **Parent:** Sees what was set and whether it was completed.
- **Learner:** Does the work and sees their feedback.

**Connects to.** Sits in the Learning group, alongside accommodations, assignments, cbt-exam, cbt-multi, cbt-review, certificates. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Quiz review + PDF · `cbt-review.html` · 🔑 Quiz code

After a quiz the learner sees every item, their answer, the key and the explanation, then saves a study PDF. The main actions available here are: Sign out, Theme. Reachable without a portal password, but useless without a valid quiz code plus the learner's student ID. The code is the gate.

**Who it is for.** Tutors author the content, learners work through it, parents watch the progress.

**Why it matters.** This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.

**How to use it**

1. Pick the engagement, and the learner if it is a group.
2. Add or import the items you need — topics, tasks, questions or reading links.
3. Publish, so the learner sees it on their own dashboard.
4. Track completion and scores as the work comes back in.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Everything, plus quality oversight.
- **Tutor:** Authors and marks the work.
- **Parent:** Sees what was set and whether it was completed.
- **Learner:** Does the work and sees their feedback.

**Connects to.** Sits in the Learning group, alongside accommodations, assignments, cbt-exam, cbt-multi, cbt-prompts, certificates. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Quizzes — Self / Review / Graded · `practice.html` · 👨‍👩‍👧 Family

Three quiz kinds. Self = iterative practice. Review = diagnose after class. Graded = exhaustive paper that auto-pushes to the scoresheet. The main actions available here are: Parse CSV preview, Save quiz, Sign out, Theme. Requires sign-in. Parents see only their own children; a learner sees only themselves. Row Level Security enforces this in the database, not just in the interface.

**Who it is for.** Tutors author the content, learners work through it, parents watch the progress.

**Why it matters.** This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.

**How to use it**

1. Pick the engagement, and the learner if it is a group.
2. Add or import the items you need — topics, tasks, questions or reading links.
3. Publish, so the learner sees it on their own dashboard.
4. Track completion and scores as the work comes back in.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Everything, plus quality oversight.
- **Tutor:** Authors and marks the work.
- **Parent:** Sees what was set and whether it was completed.
- **Learner:** Does the work and sees their feedback.

**Common tasks.** create a quiz · import questions from CSV · set a graded quiz

**Questions people ask**

- **Does this use AI?** No. There is no paid AI API anywhere in the platform. Questions are imported from CSV or pasted from any free chat tool.
- **What are the three quiz modes?** Self (unmarked practice), Review (answers plus explanations plus PDF) and Graded (auto-pushes to the scoresheet).

**Connects to.** Sits in the Learning group, alongside accommodations, assignments, cbt-exam, cbt-multi, cbt-prompts, cbt-review. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Reading assignments · `reading.html` · 👨‍👩‍👧 Family

Pre-class reading and video links tied to the next SOW topic. Learners tick items as they finish. The main actions available here are: Save assignment + item, Sign out, Theme. Requires sign-in. Parents see only their own children; a learner sees only themselves. Row Level Security enforces this in the database, not just in the interface.

**Who it is for.** Tutors author the content, learners work through it, parents watch the progress.

**Why it matters.** This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.

**How to use it**

1. Pick the engagement, and the learner if it is a group.
2. Add or import the items you need — topics, tasks, questions or reading links.
3. Publish, so the learner sees it on their own dashboard.
4. Track completion and scores as the work comes back in.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Everything, plus quality oversight.
- **Tutor:** Authors and marks the work.
- **Parent:** Sees what was set and whether it was completed.
- **Learner:** Does the work and sees their feedback.

**Common tasks.** set reading before a class · add a YouTube or Drive link

**Connects to.** Sits in the Learning group, alongside accommodations, assignments, cbt-exam, cbt-multi, cbt-prompts, cbt-review. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Resource library · `resources.html` · 🎓 Staff

Drive / YouTube / PDF links scoped to an engagement or shared. No file uploads into the free database. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Tutors author the content, learners work through it, parents watch the progress.

**Why it matters.** This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.

**How to use it**

1. Pick the engagement, and the learner if it is a group.
2. Add or import the items you need — topics, tasks, questions or reading links.
3. Publish, so the learner sees it on their own dashboard.
4. Track completion and scores as the work comes back in.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Everything, plus quality oversight.
- **Tutor:** Authors and marks the work.
- **Parent:** Sees what was set and whether it was completed.
- **Learner:** Does the work and sees their feedback.

**Connects to.** Sits in the Learning group, alongside accommodations, assignments, cbt-exam, cbt-multi, cbt-prompts, cbt-review. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Rubrics · `rubrics.html` · 🎓 Staff

Criteria and scale for essays and projects. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Tutors author the content, learners work through it, parents watch the progress.

**Why it matters.** This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.

**How to use it**

1. Pick the engagement, and the learner if it is a group.
2. Add or import the items you need — topics, tasks, questions or reading links.
3. Publish, so the learner sees it on their own dashboard.
4. Track completion and scores as the work comes back in.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Everything, plus quality oversight.
- **Tutor:** Authors and marks the work.
- **Parent:** Sees what was set and whether it was completed.
- **Learner:** Does the work and sees their feedback.

**Connects to.** Sits in the Learning group, alongside accommodations, assignments, cbt-exam, cbt-multi, cbt-prompts, cbt-review. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Scheme of work · `sow.html` · 🎓 Staff

At the start of a term enter every subject topic. Follow coverage, evaluate each learner on each topic, push scores into the scoresheet. The main actions available here are: Add topic, Create term, Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Tutors author the content, learners work through it, parents watch the progress.

**Why it matters.** This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.

**How to use it**

1. Pick the engagement, and the learner if it is a group.
2. Add or import the items you need — topics, tasks, questions or reading links.
3. Publish, so the learner sees it on their own dashboard.
4. Track completion and scores as the work comes back in.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Everything, plus quality oversight.
- **Tutor:** Authors and marks the work.
- **Parent:** Sees what was set and whether it was completed.
- **Learner:** Does the work and sees their feedback.

**Connects to.** Sits in the Learning group, alongside accommodations, assignments, cbt-exam, cbt-multi, cbt-prompts, cbt-review. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Spaced practice · `flashcards.html` · 🎓 Staff

SM-2 spaced repetition (classic free algorithm). Cards belong to a learner, not a group. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Tutors author the content, learners work through it, parents watch the progress.

**Why it matters.** This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.

**How to use it**

1. Pick the engagement, and the learner if it is a group.
2. Add or import the items you need — topics, tasks, questions or reading links.
3. Publish, so the learner sees it on their own dashboard.
4. Track completion and scores as the work comes back in.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Everything, plus quality oversight.
- **Tutor:** Authors and marks the work.
- **Parent:** Sees what was set and whether it was completed.
- **Learner:** Does the work and sees their feedback.

**Connects to.** Sits in the Learning group, alongside accommodations, assignments, cbt-exam, cbt-multi, cbt-prompts, cbt-review. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Streaks &amp; badges · `gamification.html` · 🎓 Staff

Homework streaks, mastery badges. Transparent point log. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Tutors author the content, learners work through it, parents watch the progress.

**Why it matters.** This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.

**How to use it**

1. Pick the engagement, and the learner if it is a group.
2. Add or import the items you need — topics, tasks, questions or reading links.
3. Publish, so the learner sees it on their own dashboard.
4. Track completion and scores as the work comes back in.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Everything, plus quality oversight.
- **Tutor:** Authors and marks the work.
- **Parent:** Sees what was set and whether it was completed.
- **Learner:** Does the work and sees their feedback.

**Connects to.** Sits in the Learning group, alongside accommodations, assignments, cbt-exam, cbt-multi, cbt-prompts, cbt-review. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Study log / session timer · `study-log.html` · 👨‍👩‍👧 Family

Learner start/stop timer per subject. Minutes on task, not just class time. TutorBird study-log parity. The main actions available here are: Sign out, Start, Theme. Requires sign-in. Parents see only their own children; a learner sees only themselves. Row Level Security enforces this in the database, not just in the interface.

**Who it is for.** Tutors author the content, learners work through it, parents watch the progress.

**Why it matters.** This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.

**How to use it**

1. Pick the engagement, and the learner if it is a group.
2. Add or import the items you need — topics, tasks, questions or reading links.
3. Publish, so the learner sees it on their own dashboard.
4. Track completion and scores as the work comes back in.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Everything, plus quality oversight.
- **Tutor:** Authors and marks the work.
- **Parent:** Sees what was set and whether it was completed.
- **Learner:** Does the work and sees their feedback.

**Connects to.** Sits in the Learning group, alongside accommodations, assignments, cbt-exam, cbt-multi, cbt-prompts, cbt-review. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Take a quiz · `cbt-exam.html` · 🔑 Quiz code

Learner runtime: code entry, timer, navigator. Open or rostered. The main actions available here are: Save / print PDF, Start quiz, Submit. Reachable without a portal password, but useless without a valid quiz code plus the learner's student ID. The code is the gate.

**Who it is for.** Tutors author the content, learners work through it, parents watch the progress.

**Why it matters.** This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.

**How to use it**

1. Pick the engagement, and the learner if it is a group.
2. Add or import the items you need — topics, tasks, questions or reading links.
3. Publish, so the learner sees it on their own dashboard.
4. Track completion and scores as the work comes back in.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Everything, plus quality oversight.
- **Tutor:** Authors and marks the work.
- **Parent:** Sees what was set and whether it was completed.
- **Learner:** Does the work and sees their feedback.

**Common tasks.** take a quiz · enter a quiz code · save my result as PDF

**Connects to.** Sits in the Learning group, alongside accommodations, assignments, cbt-multi, cbt-prompts, cbt-review, certificates. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Topic mastery · `mastery.html` · 🎓 Staff

Topic-by-topic heatmap (0–100) per learner. Independent even when the learner sits in a group. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Tutors author the content, learners work through it, parents watch the progress.

**Why it matters.** This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.

**How to use it**

1. Pick the engagement, and the learner if it is a group.
2. Add or import the items you need — topics, tasks, questions or reading links.
3. Publish, so the learner sees it on their own dashboard.
4. Track completion and scores as the work comes back in.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Everything, plus quality oversight.
- **Tutor:** Authors and marks the work.
- **Parent:** Sees what was set and whether it was completed.
- **Learner:** Does the work and sees their feedback.

**Connects to.** Sits in the Learning group, alongside accommodations, assignments, cbt-exam, cbt-multi, cbt-prompts, cbt-review. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Transcripts · `transcripts.html` · 👨‍👩‍👧 Family

Cumulative record across independent engagements. The main actions available here are: Sign out, Theme. Requires sign-in. Parents see only their own children; a learner sees only themselves. Row Level Security enforces this in the database, not just in the interface.

**Who it is for.** Tutors author the content, learners work through it, parents watch the progress.

**Why it matters.** This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.

**How to use it**

1. Pick the engagement, and the learner if it is a group.
2. Add or import the items you need — topics, tasks, questions or reading links.
3. Publish, so the learner sees it on their own dashboard.
4. Track completion and scores as the work comes back in.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Everything, plus quality oversight.
- **Tutor:** Authors and marks the work.
- **Parent:** Sees what was set and whether it was completed.
- **Learner:** Does the work and sees their feedback.

**Connects to.** Sits in the Learning group, alongside accommodations, assignments, cbt-exam, cbt-multi, cbt-prompts, cbt-review. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

## Media

### Birthdays · `birthdays.html` · 🎓 Staff

Upcoming learner and tutor birthdays. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Media group, alongside directory, gallery, idcards. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Directory · `directory.html` · 🎓 Staff

Searchable people directory, role-filtered. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Media group, alongside birthdays, gallery, idcards. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Gallery · `gallery.html` · 🎓 Staff

Drive photos and YouTube recaps. No base64 in the database. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Media group, alongside birthdays, directory, idcards. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Learner cards · `idcards.html` · 🎓 Staff

Printable branded cards with QR for in-person check-in. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Media group, alongside birthdays, directory, gallery. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

## Ops

### Compliance · `compliance.html` · 🛡️ Owner/admin

DBS/background checks, insurance, data-protection tasks. The main actions available here are: Sign out, Theme. Owner/admin only. These pages control money, safeguarding, audit or platform configuration, so they sit behind the highest role check.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Ops group, alongside documents, helpdesk, leave, policies, rooms, safeguarding. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Contracts &amp; consent · `documents.html` · 🎓 Staff

Service agreement, safeguarding consent, recording consent — Drive links + status. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Ops group, alongside compliance, helpdesk, leave, policies, rooms, safeguarding. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Cover tutors · `substitutions.html` · 🎓 Staff

Assign cover when a tutor is away. Hours still belong to the engagement. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Ops group, alongside compliance, documents, helpdesk, leave, policies, rooms. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Help desk · `helpdesk.html` · 🎓 Staff

IT / scheduling / billing tickets. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Ops group, alongside compliance, documents, leave, policies, rooms, safeguarding. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Policies · `policies.html` · 🎓 Staff

Cancellation, refund, safeguarding, late policy. Shown on parent portal. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Ops group, alongside compliance, documents, helpdesk, leave, rooms, safeguarding. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Rooms / locations · `rooms.html` · 🎓 Staff

In-person rooms or virtual standing rooms. Conflict check. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Ops group, alongside compliance, documents, helpdesk, leave, policies, safeguarding. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Safeguarding log · `safeguarding.html` · 🛡️ Owner/admin

Confidential incidents. Admin/tutor only. Never in the parent nav. The main actions available here are: Sign out, Theme. Owner/admin only. These pages control money, safeguarding, audit or platform configuration, so they sit behind the highest role check.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Ops group, alongside compliance, documents, helpdesk, leave, policies, rooms. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Timezone desk · `timezones.html` · 🎓 Staff

International tutoring: convert a slot across learner, parent and tutor zones. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Ops group, alongside compliance, documents, helpdesk, leave, policies, rooms. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Tutor leave · `leave.html` · 🎓 Staff

Tutors request leave. Only an administrator can approve or reject. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Ops group, alongside compliance, documents, helpdesk, policies, rooms, safeguarding. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

## Platform

### ADEWALE CLASSROOM · `site-index.html` · 🌍 Public

A complete, human-readable index of every page in the studio, grouped by function — the fastest way to find a module when you know what it is called but not where it lives. Open to anyone, no sign-in needed. It is deliberately indexed by search engines so families can find the studio.

**Who it is for.** Everyone; staff use it most.

**Why it matters.** With well over a hundred modules enabled, browsing beats hunting through a nav tree.

**How to use it**

1. Scan the groups, or press Ctrl/Cmd+F and type what you want.
2. Click straight through to the module.

**Sections on this page**

- **Hero** — The headline promise and the primary call to action.
- **Proof** — Statistics and feature cards that answer "why should I trust this studio?".
- **Call to action** — Sign in, or request a place.
- **Footer** — Contact details, social links and the HMG Concepts ecosystem links, which also help search engines connect the sites.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** The human counterpart to sitemap.xml, which is the machine version search engines read.

---

### About · `about.html` · 🌍 Public

Explains who runs the studio, the teaching philosophy and the track record. A credibility page for a parent comparing two or three tutors before committing. The main actions available here are: Sign out, Theme. Open to anyone, no sign-in needed. It is deliberately indexed by search engines so families can find the studio.

**Who it is for.** Public.

**Why it matters.** Tutoring is a trust purchase. Parents read this page before they read your prices.

**How to use it**

1. Read the studio story, the approach and the credentials.
2. Follow the call to action to apply or sign in.

**Sections on this page**

- **Hero** — The headline promise and the primary call to action.
- **Proof** — Statistics and feature cards that answer "why should I trust this studio?".
- **Call to action** — Sign in, or request a place.
- **Footer** — Contact details, social links and the HMG Concepts ecosystem links, which also help search engines connect the sites.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Linked from the landing page and every footer; indexed for search.

---

### About the developer · `developer.html` · 🌍 Public

Credits the build, documents the technology stack and the design constraints, and links to HMG Technologies for studios wanting bespoke work. The main actions available here are: Sign out, Theme. Open to anyone, no sign-in needed. It is deliberately indexed by search engines so families can find the studio.

**Who it is for.** Public, and technically-minded readers.

**Why it matters.** Transparency about the stack is part of the pitch: no vendor lock-in, no recurring platform fee, and the client owns the source.

**How to use it**

1. Read the architecture and constraint summary.
2. Follow the ecosystem links to the wider HMG network.

**Sections on this page**

- **Hero** — The headline promise and the primary call to action.
- **Proof** — Statistics and feature cards that answer "why should I trust this studio?".
- **Call to action** — Sign in, or request a place.
- **Footer** — Contact details, social links and the HMG Concepts ecosystem links, which also help search engines connect the sites.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Part of the HMG Concepts ecosystem link graph, which is also how the sites reinforce each other for search.

---

### Activity log · `activity-log.html` · 🛡️ Owner/admin

Who created, edited, deleted, signed in. The main actions available here are: Sign out, Theme. Owner/admin only. These pages control money, safeguarding, audit or platform configuration, so they sit behind the highest role check.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Platform group, alongside about, admin-data, approvals, builder, change-password, contact. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Admin data · `admin-data.html` · 🛡️ Owner/admin

Backup, restore, CSV export, table browser. SHA-256 sealed JSON archive. The main actions available here are: Sign out, Theme. Owner/admin only. These pages control money, safeguarding, audit or platform configuration, so they sit behind the highest role check.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Common tasks.** back up the studio · restore a backup · set up Google Drive sync

**Questions people ask**

- **Where are backups stored?** A sealed SHA-256 JSON archive downloads to your device, and optionally syncs to your own Google Drive folder.
- **Does Drive sync cost anything?** No. It uses the free Google Identity Services flow and the drive.file scope, which can only see files this app created.

**Connects to.** Sits in the Platform group, alongside about, activity-log, approvals, builder, change-password, contact. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Approvals · `approvals.html` · 🛡️ Owner/admin

Approve parent/learner/tutor self-signups. The main actions available here are: Sign out, Theme. Owner/admin only. These pages control money, safeguarding, audit or platform configuration, so they sit behind the highest role check.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Common tasks.** approve a new account · reject a sign-up

**Connects to.** Sits in the Platform group, alongside about, activity-log, admin-data, builder, change-password, contact. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Change password · `change-password.html` · 👨‍👩‍👧 Family

Change your password while signed in, with a live strength meter that scores length, case mixing, digits and symbols. The main actions available here are: Sign out, Theme. Requires sign-in. Parents see only their own children; a learner sees only themselves. Row Level Security enforces this in the database, not just in the interface.

**Who it is for.** Every signed-in user.

**Why it matters.** Shared family devices are common. A periodic password change, plus the idle auto-lock, is what keeps a portal safe on a household laptop.

**How to use it**

1. Enter your current password, then the new one twice.
2. Aim for Strong or Very strong on the meter.
3. Save — you remain signed in on this device.

**Sections on this page**

- **Introduction** — Explains who the form is for and what happens after submission.
- **Form fields** — The information being collected. Validation runs as you type.
- **Submit** — Writes the record and shows a confirmation. Public forms submit through a security-definer function, never direct table access.
- **What happens next** — Where the submission lands and who reviews it.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** The security guard records the change in the login audit trail.

---

### Contact · `contact.html` · 🌍 Public

Every way to reach the studio — WhatsApp, email, phone and social — plus an enquiry form that lands directly in the staff CRM. The main actions available here are: Sign out, Theme. Open to anyone, no sign-in needed. It is deliberately indexed by search engines so families can find the studio.

**Who it is for.** Public.

**Why it matters.** A parent who cannot reach you in under a minute contacts the next tutor on their list.

**How to use it**

1. Choose the channel you prefer; WhatsApp and email open your own device app.
2. Or submit the form and the studio replies from the Inquiries board.

**Sections on this page**

- **Hero** — The headline promise and the primary call to action.
- **Proof** — Statistics and feature cards that answer "why should I trust this studio?".
- **Call to action** — Sign in, or request a place.
- **Footer** — Contact details, social links and the HMG Concepts ecosystem links, which also help search engines connect the sites.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Writes to the inquiries table, which staff triage in the Inquiries/CRM module.

---

### Dashboard · `dashboard.html` · 👨‍👩‍👧 Family

Your personalised home screen, and the most role-aware page in the studio. An owner sees studio-wide KPIs, cash position and at-risk learners. A tutor sees today's classes, attendance to mark and work to grade. A parent sees the next class, the latest scores and the balance owing. A learner sees homework, reading and quizzes due. The main actions available here are: Sign out, Theme. Requires sign-in. Parents see only their own children; a learner sees only themselves. Row Level Security enforces this in the database, not just in the interface.

**Who it is for.** Every signed-in role — the same URL renders a completely different page per role.

**Why it matters.** It is the daily habit that keeps families engaged. A parent who opens this page each week and sees movement is a parent who renews.

**How to use it**

1. Read the KPI tiles across the top for the headline position.
2. Use the quick-link tiles to jump straight into a module.
3. Check the alert strip for at-risk learners, unpaid invoices or an hour bank about to run dry.
4. Open the bell for anything new since your last visit.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** The hub of the entire studio — it links to every module that has been enabled.

---

### Feature guide · `feature-guide.html` · 🌍 Public

In-app explanation of every module. The main actions available here are: Sign out, Theme. Open to anyone, no sign-in needed. It is deliberately indexed by search engines so families can find the studio.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Hero** — The headline promise and the primary call to action.
- **Proof** — Statistics and feature cards that answer "why should I trust this studio?".
- **Call to action** — Sign in, or request a place.
- **Footer** — Contact details, social links and the HMG Concepts ecosystem links, which also help search engines connect the sites.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Platform group, alongside about, activity-log, admin-data, approvals, builder, change-password. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Give your tutoring studio a complete digital platform · `index.html` · 🌍 Public

The public front door of the studio. It introduces the practice to a parent who has never met you, states the core promise — independent progress that a parent can actually see — and drives two actions: sign in, or request a place. Open to anyone, no sign-in needed. It is deliberately indexed by search engines so families can find the studio.

**Who it is for.** Anyone on the internet. No sign-in required.

**Why it matters.** This is the page that converts a stranger into an enquiry. It is also the page search engines rank, so it carries the studio's structured data and social preview.

**How to use it**

1. Read the promise and the proof statistics.
2. Click Sign in to portal if you already have an account.
3. Click Request a place to submit an application — it takes about two minutes.
4. Accept the install prompt to add the studio to your home screen.

**Sections on this page**

- **Hero** — The headline promise and the primary call to action.
- **Proof** — Statistics and feature cards that answer "why should I trust this studio?".
- **Call to action** — Sign in, or request a place.
- **Footer** — Contact details, social links and the HMG Concepts ecosystem links, which also help search engines connect the sites.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Feeds login.html and apply.html, and links out to the HMG Concepts ecosystem in the footer.

---

### Install the app · `install.html` · 🌍 Public

A complete, illustrated walkthrough for installing the studio as a real app on iPhone, Android, Windows, macOS and Chromebook — including what you gain by doing it. The main actions available here are: Install now, Sign out, Theme. Open to anyone, no sign-in needed. It is deliberately indexed by search engines so families can find the studio.

**Who it is for.** Everyone.

**Why it matters.** Installed users open the portal far more often, and only an installed app can deliver class reminders when the browser tab is closed.

**How to use it**

1. Find your device in the list.
2. Follow the numbered steps for that platform.
3. Confirm the studio icon has appeared on your home screen or dock.
4. Allow notifications when asked, so reminders can reach you.

**Sections on this page**

- **Hero** — The headline promise and the primary call to action.
- **Proof** — Statistics and feature cards that answer "why should I trust this studio?".
- **Call to action** — Sign in, or request a place.
- **Footer** — Contact details, social links and the HMG Concepts ecosystem links, which also help search engines connect the sites.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Common tasks.** install the app · get class reminders

**Connects to.** Backed by manifest.json and sw.js, and reinforced by the install banner that appears across the platform.

---

### My profile · `profile.html` · 👨‍👩‍👧 Family

Name, phone, timezone, Drive photo, password. Family-safe. The main actions available here are: Save profile, Sign out, Theme. Requires sign-in. Parents see only their own children; a learner sees only themselves. Row Level Security enforces this in the database, not just in the interface.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Introduction** — Explains who the form is for and what happens after submission.
- **Form fields** — The information being collected. Validation runs as you type.
- **Submit** — Writes the record and shows a confirmation. Public forms submit through a security-definer function, never direct table access.
- **What happens next** — Where the submission lands and who reviews it.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Platform group, alongside about, activity-log, admin-data, approvals, builder, change-password. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Platform health · `platform-health.html` · 🛡️ Owner/admin

Keep-alive heartbeat, DB size, Drive backup, license, idle lock. The main actions available here are: Sign out, Theme. Owner/admin only. These pages control money, safeguarding, audit or platform configuration, so they sit behind the highest role check.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Section groups** — Related settings are grouped into cards; each control has a note explaining its effect.
- **Save** — Applies changes for every device at once — these are stored in the database, not in your browser.
- **Danger zone** — Irreversible or high-impact actions, deliberately separated and confirmation-gated.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Common tasks.** check keep-alive health · stop the project pausing · write a heartbeat

**Questions people ask**

- **Why would the project pause?** Supabase pauses a free project after 7 days without database activity. The keep-alive layers prevent that.
- **What if it already paused?** Open the Supabase dashboard and press Restore. Data is safe — but a project left paused is eventually deleted.

**Connects to.** Sits in the Platform group, alongside about, activity-log, admin-data, approvals, builder, change-password. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Reset password · `forgot-password.html` · 🌍 Public

Sends a secure password-reset link by email through Supabase Auth. Nobody at the studio can see or set your password. The main actions available here are: Sign out, Theme. Open to anyone, no sign-in needed. It is deliberately indexed by search engines so families can find the studio.

**Who it is for.** Anyone locked out of their account.

**Why it matters.** Self-service recovery keeps the admin out of the credential business entirely, which is both safer and less work.

**How to use it**

1. Type the email address on your account.
2. Open the email and click the link — it expires shortly.
3. Choose a new password; the strength meter shows you when it is strong enough.

**Sections on this page**

- **Hero** — The headline promise and the primary call to action.
- **Proof** — Statistics and feature cards that answer "why should I trust this studio?".
- **Call to action** — Sign in, or request a place.
- **Footer** — Contact details, social links and the HMG Concepts ecosystem links, which also help search engines connect the sites.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Pairs with login.html and change-password.html.

---

### Role &amp; status · `status-manager.html` · 🛡️ Owner/admin

Change role/status with an audit row. The main actions available here are: Sign out, Theme. Owner/admin only. These pages control money, safeguarding, audit or platform configuration, so they sit behind the highest role check.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Section groups** — Related settings are grouped into cards; each control has a note explaining its effect.
- **Save** — Applies changes for every device at once — these are stored in the database, not in your browser.
- **Danger zone** — Irreversible or high-impact actions, deliberately separated and confirmation-gated.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Platform group, alongside about, activity-log, admin-data, approvals, builder, change-password. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Settings · `settings.html` · 🛡️ Owner/admin

Brand, signatures, 2FA, language, accessibility, cancellation policy, default timezone/currency. The main actions available here are: Save to database, Sign out, Theme, Toggle dark mode, Toggle high contrast. Owner/admin only. These pages control money, safeguarding, audit or platform configuration, so they sit behind the highest role check.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Section groups** — Related settings are grouped into cards; each control has a note explaining its effect.
- **Save** — Applies changes for every device at once — these are stored in the database, not in your browser.
- **Danger zone** — Irreversible or high-impact actions, deliberately separated and confirmation-gated.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Common tasks.** change the studio name · change the logo · set the timezone

**Connects to.** Sits in the Platform group, alongside about, activity-log, admin-data, approvals, builder, change-password. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Site license · `license.html` · 🛡️ Owner/admin

Lifetime or subscription lock. Same idea as School Connect, adapted. The main actions available here are: Sign out, Theme. Owner/admin only. These pages control money, safeguarding, audit or platform configuration, so they sit behind the highest role check.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Section groups** — Related settings are grouped into cards; each control has a note explaining its effect.
- **Save** — Applies changes for every device at once — these are stored in the database, not in your browser.
- **Danger zone** — Irreversible or high-impact actions, deliberately separated and confirmation-gated.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Platform group, alongside about, activity-log, admin-data, approvals, builder, change-password. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Storage manager · `storage.html` · 🛡️ Owner/admin

Watch the free 500 MB. Archive then purge old logs. The main actions available here are: Sign out, Theme. Owner/admin only. These pages control money, safeguarding, audit or platform configuration, so they sit behind the highest role check.

**Who it is for.** Owner and admin. This is configuration and governance, not day-to-day teaching.

**Why it matters.** Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log.

**How to use it**

1. Only an owner or admin should change anything on this page.
2. Read the note beside each setting before you touch it.
3. Save, then reload any normal page to confirm the change took effect.
4. If something looks wrong afterwards, the activity log records who changed what and when.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Sits in the Platform group, alongside about, activity-log, admin-data, approvals, builder, change-password. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Studio sign in · `login.html` · 🌍 Public

The single entry point to the private portal. It signs in parents, learners, tutors and admins, and offers password recovery and a route to apply. The main actions available here are: Request access, Sign in. It is form-driven — you fill a form and save; the record appears in the list immediately. Open to anyone, no sign-in needed. It is deliberately indexed by search engines so families can find the studio.

**Who it is for.** Everyone who has an account.

**Why it matters.** Every privacy guarantee in the product begins here. The role attached to your account decides what the database will and will not return for the rest of your session.

**How to use it**

1. Enter your email — or a learner's student ID such as TC-0001 — and your password.
2. Use Forgot password to get a secure reset link by email.
3. New families should use Apply instead; accounts require admin approval before they open.
4. After sign-in you land on the dashboard built for your role.

**Sections on this page**

- **Hero** — The headline promise and the primary call to action.
- **Proof** — Statistics and feature cards that answer "why should I trust this studio?".
- **Call to action** — Sign in, or request a place.
- **Footer** — Contact details, social links and the HMG Concepts ecosystem links, which also help search engines connect the sites.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Common tasks.** sign in · reset my password

**Connects to.** The gateway to every protected page. Each sign-in and sign-out is written to the login audit trail.

---

### You are offline · `offline.html` · 🌍 Public

The friendly page the service worker serves when the device loses connection, so a family on poor mobile data never sees a raw browser error. The main actions available here are: Sign out, Theme. Open to anyone, no sign-in needed. It is deliberately indexed by search engines so families can find the studio.

**Who it is for.** Everyone.

**Why it matters.** Intermittent connectivity is normal for the studio's audience. Failing gracefully is the difference between 'the network dropped' and 'this app is broken'.

**How to use it**

1. Reconnect, then press retry.
2. Pages you have already visited still open from the offline cache.

**Sections on this page**

- **Hero** — The headline promise and the primary call to action.
- **Proof** — Statistics and feature cards that answer "why should I trust this studio?".
- **Call to action** — Sign in, or request a place.
- **Footer** — Contact details, social links and the HMG Concepts ecosystem links, which also help search engines connect the sites.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Served automatically by sw.js whenever a navigation request fails.

---

### 🚀 Build a tutoring studio · `builder.html` · 🎓 Staff

The internal HMG wizard that generates a complete, branded studio for a client: studio name, logo, theme, font, layout, modules and optional Supabase keys, then produces a ready-to-deploy ZIP with a one-click SQL schema. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** HMG representatives only — this page is never shipped inside a client build.

**Why it matters.** It is the factory. Every client studio in existence is stamped out of this one page, which is why its output has to be complete and correct.

**How to use it**

1. Work through the wizard step by step.
2. Preview the chosen theme, font and layout live before committing.
3. Download the ZIP, then follow DEPLOYMENT-GUIDE.md exactly.
4. Run database/complete-schema.sql in a fresh Supabase project and promote the first admin.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Full configuration control.
- **Tutor:** No access.
- **Parent:** No access.
- **Learner:** No access.

**Connects to.** Generator-only. It reads the same page files the client will receive, so what you preview is what they get.

---

## Sessions

### Attendance · `attendance.html` · 🎓 Staff

Present / late / absent / excused per learner, even inside a group. Feeds at-risk rules. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Tutors run this day to day. Parents and learners see their own sessions and nothing else.

**Why it matters.** Attendance is what deducts hours from the hour bank, which is what justifies the invoice. Get this right and billing disputes disappear.

**How to use it**

1. Choose the date range or the engagement you are working on.
2. Create or open a session and set the date, time, duration and tutor.
3. Mark attendance — this is the step that deducts hours from the hour bank.
4. Write session notes so the parent has a permanent record of what was actually taught.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Every session in the studio.
- **Tutor:** Their own timetable, attendance and notes.
- **Parent:** Their child's classes, dates, times and amounts.
- **Learner:** Their own upcoming and past classes.

**Common tasks.** mark attendance · record an absence · fix a wrong attendance mark

**Connects to.** Sits in the Sessions group, alongside availability, bookings, calendar, cancellations, events, makeup-credits. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Availability · `availability.html` · 🎓 Staff

Weekly tutor availability in the tutor’s timezone. Used by self-booking and conflict checks. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Tutors run this day to day. Parents and learners see their own sessions and nothing else.

**Why it matters.** Attendance is what deducts hours from the hour bank, which is what justifies the invoice. Get this right and billing disputes disappear.

**How to use it**

1. Choose the date range or the engagement you are working on.
2. Create or open a session and set the date, time, duration and tutor.
3. Mark attendance — this is the step that deducts hours from the hour bank.
4. Write session notes so the parent has a permanent record of what was actually taught.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Every session in the studio.
- **Tutor:** Their own timetable, attendance and notes.
- **Parent:** Their child's classes, dates, times and amounts.
- **Learner:** Their own upcoming and past classes.

**Connects to.** Sits in the Sessions group, alongside attendance, bookings, calendar, cancellations, events, makeup-credits. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Calendar · `calendar.html` · 👨‍👩‍👧 Family

Timezone-aware calendar for 1:1 and group sessions. Conflict detection on tutor and learner. The main actions available here are: Sign out, Theme. Requires sign-in. Parents see only their own children; a learner sees only themselves. Row Level Security enforces this in the database, not just in the interface.

**Who it is for.** Tutors run this day to day. Parents and learners see their own sessions and nothing else.

**Why it matters.** Attendance is what deducts hours from the hour bank, which is what justifies the invoice. Get this right and billing disputes disappear.

**How to use it**

1. Choose the date range or the engagement you are working on.
2. Create or open a session and set the date, time, duration and tutor.
3. Mark attendance — this is the step that deducts hours from the hour bank.
4. Write session notes so the parent has a permanent record of what was actually taught.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Every session in the studio.
- **Tutor:** Their own timetable, attendance and notes.
- **Parent:** Their child's classes, dates, times and amounts.
- **Learner:** Their own upcoming and past classes.

**Connects to.** Sits in the Sessions group, alongside attendance, availability, bookings, cancellations, events, makeup-credits. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Cancellations · `cancellations.html` · 🎓 Staff

Who cancelled, notice hours, fee applied, hours returned. Transparent for parents. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Tutors run this day to day. Parents and learners see their own sessions and nothing else.

**Why it matters.** Attendance is what deducts hours from the hour bank, which is what justifies the invoice. Get this right and billing disputes disappear.

**How to use it**

1. Choose the date range or the engagement you are working on.
2. Create or open a session and set the date, time, duration and tutor.
3. Mark attendance — this is the step that deducts hours from the hour bank.
4. Write session notes so the parent has a permanent record of what was actually taught.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Every session in the studio.
- **Tutor:** Their own timetable, attendance and notes.
- **Parent:** Their child's classes, dates, times and amounts.
- **Learner:** Their own upcoming and past classes.

**Connects to.** Sits in the Sessions group, alongside attendance, availability, bookings, calendar, events, makeup-credits. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Complete a class · `session-complete.html` · 🎓 Staff

Tutor marks a class done, writes what was taught, ticks SOW topics. Feedback lands on parent and learner dashboards and feeds insights. The main actions available here are: Mark complete, Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Tutors run this day to day. Parents and learners see their own sessions and nothing else.

**Why it matters.** Attendance is what deducts hours from the hour bank, which is what justifies the invoice. Get this right and billing disputes disappear.

**How to use it**

1. Choose the date range or the engagement you are working on.
2. Create or open a session and set the date, time, duration and tutor.
3. Mark attendance — this is the step that deducts hours from the hour bank.
4. Write session notes so the parent has a permanent record of what was actually taught.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Every session in the studio.
- **Tutor:** Their own timetable, attendance and notes.
- **Parent:** Their child's classes, dates, times and amounts.
- **Learner:** Their own upcoming and past classes.

**Connects to.** Sits in the Sessions group, alongside attendance, availability, bookings, calendar, cancellations, events. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Cycle bookings · `bookings.html` · 👨‍👩‍👧 Family

A full booking is 4 cycles of 7 days. Times per cycle × 4 = total classes. Hourly rate × duration × classes = invoice. Visible to tutor, parent and learner. The main actions available here are: Sign out, Theme. Requires sign-in. Parents see only their own children; a learner sees only themselves. Row Level Security enforces this in the database, not just in the interface.

**Who it is for.** Tutors run this day to day. Parents and learners see their own sessions and nothing else.

**Why it matters.** Attendance is what deducts hours from the hour bank, which is what justifies the invoice. Get this right and billing disputes disappear.

**How to use it**

1. Choose the date range or the engagement you are working on.
2. Create or open a session and set the date, time, duration and tutor.
3. Mark attendance — this is the step that deducts hours from the hour bank.
4. Write session notes so the parent has a permanent record of what was actually taught.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Every session in the studio.
- **Tutor:** Their own timetable, attendance and notes.
- **Parent:** Their child's classes, dates, times and amounts.
- **Learner:** Their own upcoming and past classes.

**Common tasks.** create a booking · work out the amount due · see how many classes remain

**Questions people ask**

- **How is the amount calculated?** Amount = hours x hourly rate, where hours = classes x duration. A full booking is 4 cycles of 7 days, so 2 classes per cycle gives 8 classes.
- **Can a parent see this?** Yes — the parent sees the same dates, times, duration and amount on their own dashboard.

**Connects to.** Sits in the Sessions group, alongside attendance, availability, calendar, cancellations, events, makeup-credits. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Lesson reminders + calendar · `reminders.html` · 👨‍👩‍👧 Family

WhatsApp/email/SMS class reminders and a standard .ics download for Google, Outlook and Apple Calendar. No paid Calendar API. The main actions available here are: Email reminder, SMS reminder, Sign out, Theme, WhatsApp reminder. Requires sign-in. Parents see only their own children; a learner sees only themselves. Row Level Security enforces this in the database, not just in the interface.

**Who it is for.** Tutors run this day to day. Parents and learners see their own sessions and nothing else.

**Why it matters.** Attendance is what deducts hours from the hour bank, which is what justifies the invoice. Get this right and billing disputes disappear.

**How to use it**

1. Choose the date range or the engagement you are working on.
2. Create or open a session and set the date, time, duration and tutor.
3. Mark attendance — this is the step that deducts hours from the hour bank.
4. Write session notes so the parent has a permanent record of what was actually taught.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Every session in the studio.
- **Tutor:** Their own timetable, attendance and notes.
- **Parent:** Their child's classes, dates, times and amounts.
- **Learner:** Their own upcoming and past classes.

**Connects to.** Sits in the Sessions group, alongside attendance, availability, bookings, calendar, cancellations, events. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Make-up sessions · `makeups.html` · 🎓 Staff

Policy-aware make-ups. Hours can be restored or consumed depending on who cancelled. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Tutors run this day to day. Parents and learners see their own sessions and nothing else.

**Why it matters.** Attendance is what deducts hours from the hour bank, which is what justifies the invoice. Get this right and billing disputes disappear.

**How to use it**

1. Choose the date range or the engagement you are working on.
2. Create or open a session and set the date, time, duration and tutor.
3. Mark attendance — this is the step that deducts hours from the hour bank.
4. Write session notes so the parent has a permanent record of what was actually taught.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Every session in the studio.
- **Tutor:** Their own timetable, attendance and notes.
- **Parent:** Their child's classes, dates, times and amounts.
- **Learner:** Their own upcoming and past classes.

**Connects to.** Sits in the Sessions group, alongside attendance, availability, bookings, calendar, cancellations, events. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Makeup credit bank · `makeup-credits.html` · 👨‍👩‍👧 Family

When the studio cancels, the family earns a credit on that engagement. Spent on a makeup. Never smeared across siblings. The main actions available here are: Post to ledger, Sign out, Theme. Requires sign-in. Parents see only their own children; a learner sees only themselves. Row Level Security enforces this in the database, not just in the interface.

**Who it is for.** Tutors run this day to day. Parents and learners see their own sessions and nothing else.

**Why it matters.** Attendance is what deducts hours from the hour bank, which is what justifies the invoice. Get this right and billing disputes disappear.

**How to use it**

1. Choose the date range or the engagement you are working on.
2. Create or open a session and set the date, time, duration and tutor.
3. Mark attendance — this is the step that deducts hours from the hour bank.
4. Write session notes so the parent has a permanent record of what was actually taught.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Every session in the studio.
- **Tutor:** Their own timetable, attendance and notes.
- **Parent:** Their child's classes, dates, times and amounts.
- **Learner:** Their own upcoming and past classes.

**Connects to.** Sits in the Sessions group, alongside attendance, availability, bookings, calendar, cancellations, events. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Meeting links · `meetings.html` · 🎓 Staff

Jitsi (free), Google Meet or Zoom links stored per session or as a standing room. No paid classroom required. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Tutors run this day to day. Parents and learners see their own sessions and nothing else.

**Why it matters.** Attendance is what deducts hours from the hour bank, which is what justifies the invoice. Get this right and billing disputes disappear.

**How to use it**

1. Choose the date range or the engagement you are working on.
2. Create or open a session and set the date, time, duration and tutor.
3. Mark attendance — this is the step that deducts hours from the hour bank.
4. Write session notes so the parent has a permanent record of what was actually taught.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Every session in the studio.
- **Tutor:** Their own timetable, attendance and notes.
- **Parent:** Their child's classes, dates, times and amounts.
- **Learner:** Their own upcoming and past classes.

**Connects to.** Sits in the Sessions group, alongside attendance, availability, bookings, calendar, cancellations, events. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Session notes · `session-notes.html` · 🎓 Staff

Per-session, optionally per-learner notes. Shareable to the parent portal. Drive recording link. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Tutors run this day to day. Parents and learners see their own sessions and nothing else.

**Why it matters.** Attendance is what deducts hours from the hour bank, which is what justifies the invoice. Get this right and billing disputes disappear.

**How to use it**

1. Choose the date range or the engagement you are working on.
2. Create or open a session and set the date, time, duration and tutor.
3. Mark attendance — this is the step that deducts hours from the hour bank.
4. Write session notes so the parent has a permanent record of what was actually taught.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Every session in the studio.
- **Tutor:** Their own timetable, attendance and notes.
- **Parent:** Their child's classes, dates, times and amounts.
- **Learner:** Their own upcoming and past classes.

**Connects to.** Sits in the Sessions group, alongside attendance, availability, bookings, calendar, cancellations, events. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Sessions · `sessions.html` · 🎓 Staff

Every lesson: start/end, mode (online/in-person/hybrid), meeting link, whiteboard, attendance, hours deducted. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Tutors run this day to day. Parents and learners see their own sessions and nothing else.

**Why it matters.** Attendance is what deducts hours from the hour bank, which is what justifies the invoice. Get this right and billing disputes disappear.

**How to use it**

1. Choose the date range or the engagement you are working on.
2. Create or open a session and set the date, time, duration and tutor.
3. Mark attendance — this is the step that deducts hours from the hour bank.
4. Write session notes so the parent has a permanent record of what was actually taught.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Every session in the studio.
- **Tutor:** Their own timetable, attendance and notes.
- **Parent:** Their child's classes, dates, times and amounts.
- **Learner:** Their own upcoming and past classes.

**Common tasks.** schedule a class · add a meeting link · cancel a class

**Connects to.** Sits in the Sessions group, alongside attendance, availability, bookings, calendar, cancellations, events. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Whiteboard rooms · `whiteboard.html` · 🎓 Staff

Free Excalidraw / Google Jamboard / FigJam links per engagement. Opens in a new tab. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Tutors run this day to day. Parents and learners see their own sessions and nothing else.

**Why it matters.** Attendance is what deducts hours from the hour bank, which is what justifies the invoice. Get this right and billing disputes disappear.

**How to use it**

1. Choose the date range or the engagement you are working on.
2. Create or open a session and set the date, time, duration and tutor.
3. Mark attendance — this is the step that deducts hours from the hour bank.
4. Write session notes so the parent has a permanent record of what was actually taught.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Every session in the studio.
- **Tutor:** Their own timetable, attendance and notes.
- **Parent:** Their child's classes, dates, times and amounts.
- **Learner:** Their own upcoming and past classes.

**Connects to.** Sits in the Sessions group, alongside attendance, availability, bookings, calendar, cancellations, events. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---

### Workshops &amp; events · `events.html` · 🎓 Staff

One-off workshops, bootcamps, exam clinics. Optional public RSVP. The main actions available here are: Sign out, Theme. Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.

**Who it is for.** Tutors run this day to day. Parents and learners see their own sessions and nothing else.

**Why it matters.** Attendance is what deducts hours from the hour bank, which is what justifies the invoice. Get this right and billing disputes disappear.

**How to use it**

1. Choose the date range or the engagement you are working on.
2. Create or open a session and set the date, time, duration and tutor.
3. Mark attendance — this is the step that deducts hours from the hour bank.
4. Write session notes so the parent has a permanent record of what was actually taught.

**Sections on this page**

- **Page header** — The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.
- **Toolbar / filters** — Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.
- **Records table** — Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.
- **Row actions** — Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.
- **Record form (modal)** — Opens over the list. Required fields are marked; everything else can be completed later.
- **Export** — Download the current view as CSV. Your data is always portable — nothing is locked in.

**What each role sees**

- **Owner:** Every session in the studio.
- **Tutor:** Their own timetable, attendance and notes.
- **Parent:** Their child's classes, dates, times and amounts.
- **Learner:** Their own upcoming and past classes.

**Connects to.** Sits in the Sessions group, alongside attendance, availability, bookings, calendar, cancellations, makeup-credits. Data is scoped to the engagement it belongs to, so one learner's records never appear inside another's.

---
