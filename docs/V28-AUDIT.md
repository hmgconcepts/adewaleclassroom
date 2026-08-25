# Tutoring Connect — V28 audit and fix report

**Schema:** V27 → **V28** · **Repos updated:** `tutoringconnect`, `adewaleclassroom`, deliverable suite + ZIP.

## Verification before this was written

| Gate | Result |
|---|---|
| `tools/test_runtime.js` | **1,456 assertions, 0 failures** |
| `tools/test_v28_verify.js` *(new)* | **119 / 119** |
| `tools/test_v27_verify.js` | 64 / 64 |
| `tools/test_v26_verify.js` | 21 / 21 |
| `tools/test_v25_render.js` | 90 / 90 |
| `tools/test_nav.js` | 61 / 61 |
| `tools/test_generator.js` | ALL PASSED — 257 core files, 0 broken assets/links |
| `tools/audit_integrity.py` | 0 disconnected references |
| `pglast` parse of `complete-schema.sql` | OK — 9,736 lines, 1,258 statements |
| `tools/lint_schema_order.py` | no forward references — runs top to bottom |

---

## 1 · Settings, Admin data, Storage, Platform health, Roles & status, Site license — understudied against School Connect / GOSA and re-implemented

I read the School Connect / GOSA implementations of all six pages (settings.html, admin-data.html, storage.html, platform-health.html, license.html, status-manager.html). Tutoring Connect's admin-data, storage, platform-health and license pages were already feature-complete; the two real gaps were **Roles & Status** and **Settings parity**. Both are now closed, with stricter behaviour than the reference:

- **Roles & Status Manager (`status-manager.html`)** — was a stub that said "Connect Supabase to load live rows." It is now a working manager: search by name/email, filter by role/status, see what each sign-in is linked to (learner/parent/tutor records), and change role or status from dropdowns. `tc_admin_set_role_status()` is SECURITY DEFINER, manager-only, **refuses to change your own role** (the reference does not guard this), and writes every change to the activity log with the old → new values and the actor. `tc_admin_list_profiles()` powers the list.
- **Settings (`settings.html`)** — added the School-Connect-style cards that were missing:
  - **Security & 2FA** — studio-wide 2FA enforcement switch (`enforce_2fa`) plus a per-account toggle that reuses the existing free email-OTP enterprise hook.
  - **Learner ID numbering** — prefix + format (PREFIX-NNNN / PREFIX/YYYY/NNNN / PREFIXNNNN) with a live "next learner ID" preview; `tc_generate_student_no` now reads the prefix from settings instead of a hard-coded `TC-`.
  - **Attendance geofence** — latitude/longitude/radius/label with "use this device's location" capture (columns already existed; the card and enforcement flag are new).
  - **Site license summary** — reads `site_license` and links to the full license page.
  - **Module access & roles** — links to the Roles & Status manager and the dashboard's Page Access manager.
- **Admin data, Storage, Platform health, License** — audited against the reference: backup/restore, CSV, table browser, Drive sync, quota guard with per-table sizes, heartbeat, idle-lock, lockdown, audit, license KPIs — all present and wired.

---

## 2 · ~60 operational pages — systematic robustness pass

Audit finding: the pages were mounted on the enterprise CRUD workbench (search/sort/filter/export/print), but several had **thin schemas (2–3 fields)**, **no RLS at all** on five public-facing registers, and **no at-a-glance summary**. All three are fixed:

1. **RLS gap closed (security bug).** `products` (Books & Materials), `scholarships`, `gallery`, `events` and `reviews` had **no row-level security** — anyone with the URL could read everything, and any signed-in person could write. Now: staff write, the public reads (reviews only when `published = true`), everyone else is denied.
2. **19 thin CRUD schemas enriched** to match real fields (V28 columns): birthdays, learning styles, parent–learner links, roster seats, subjects, methodologies, inbox/messages, complaints, gallery, scholarships, products, substitutions (cover tutors), accommodations, whiteboard, learner cards, rubrics, compliance, gamification/badges, broadcasts.
3. **Ops KPI strips (`ops-desk.js`)** — every page in the list now opens with a live summary card above the register: total rows, counts by status, upcoming/due-soon, money totals for finance pages, and 3–4 quick-action links. It is data-driven; if the table or column is missing the strip quietly hides. Coverage: sessions, attendance, availability, calendar, meetings, cancellations, makeups, makeup-credits, session-notes, rooms, substitutions, timezones, birthdays, idcards, directory, my-children, subjects, engagements, groups, reminders, events, curriculum, sow, lesson-plans, methodologies, diagnostics, goals, mastery, assignments, classwork, reading, stream, rubrics, accommodations, learning-styles, study-log, flashcards, gamification, exam-targets, exam-links, exam-register, scoresheet, group-insights, transcripts, certificates, portfolio, resources, library, lms, eresources, free-classes, payment-history, packages, fees, products, scholarships, finance, payroll, broadcasts, forum, complaints, helpdesk, parent-meetings, gallery, reviews, inquiries, trials, waitlist, onboarding, referrals, approvals, parents, learners, tutors.

---

## 3–20 · The 18 specific pages — what was missing and what was added

All 18 were audited individually. The fixes landed as: enriched schemas (real fields), ops KPI strips, and — where a page had none — a working data mount:

- **Meeting links** — sessions schema now carries `meeting_url` (plus ends_at/tutor/status/outcome/hours/notes); KPI strip shows upcoming sessions with links.
- **Cancellations** — sessions status/dates; strip shows cancelled vs scheduled; quick links to make-ups and the credit bank.
- **Makeup credit bank** — already had a working ledger (engagement, delta, reason, balance); strip adds totals.
- **Make-up sessions** — sessions status; strip + quick actions.
- **Session notes** — `session_notes` table (body, recording_url, share_with_parent) with strip.
- **Complete a class** — already functional (class, feedback, SOW topics); tutor-only by RBAC.
- **Attendance** — `session_attendance` gained `note`, `marked_by`, `marked_at`; strip tallies present/late/absent/excused/no-show.
- **Availability** — strip counts slots; timezone desk columns present.
- **Calendar** — sessions strip with upcoming count.
- **Sessions** — the core register enriched (starts/ends, mode, location, meeting_url, whiteboard_url, status, outcome, hours, notes).
- **Birthdays** — learners schema: name, DOB, email, phone, year group; strip.
- **Learner Cards / ID cards** — learners name/student_no/year/photo; strip.
- **Directory** — learners name/email/phone/year; strip.
- **My Children** — learners; strip (family view).
- **Subjects** — subjects gained exam_board, level, icon, colour; strip.
- **Engagements** — status strip; roster/hours quick actions.
- **Groups & cohorts** — engagements kind=group strip.
- **Tutors** — V27 header band + stats retained; ops strip added.

---

## 21 · Read-only pages no longer show deactivated fields

When a parent or learner has read-only access, RBAC used to *disable* the fields — leaving a row of greyed-out boxes (the "deactivated fields" you flagged on Cycle bookings). It now **hides the whole labelled field** (the `.form-group` wrapper) instead. On Cycle bookings a parent/learner no longer sees Learner, Engagement, start of cycle 1, cycles, times per cycle, duration, hourly rate, weekdays or times — only the readable schedule and quote remain. The same rule applies automatically to every read-only page: Classwork, Reading Assignments, Class Stream, Study log, Certificates, Voting, etc. Read-only viewers still keep search/sort/filter/print/export, and the "View only" note tells them how to raise a concern. The restore path (`RBAC.unlock`) brings hidden wrappers back when the role resolves to staff/admin.

---

## 22 · Files updated

- **Schema:** `database/complete-schema.sql` (9,736 lines, V28 registry) + `database/v28-admin-and-ops-enrichment.sql` (new, standalone).
- **JS:** `assets/js/status-manager.js` (new), `assets/js/ops-desk.js` (new), `assets/js/rbac.js` (read-only field hiding + a real syntax fix: an earlier edit had dropped the closing brace of `RBAC.unlock`, which broke the whole module — found by the test suite, fixed), `assets/js/crud.js` (19 enriched defs), `assets/js/generator.js` (V28 always-files).
- **HTML:** `status-manager.html` (stub → working manager), `settings.html` (5 new cards), all 136 pages gain `ops-desk.js`.
- **Tests:** `tools/test_v28_verify.js` (new, 119 checks), `tools/test_v27_verify.js` (registry assertion now accepts V28), `tools/sync_all.sh` (runs V28 verify on both repos).
- Both repos synced; deliverable suite + ZIP rebuilt (see sync output).

---

## Honest limits

- The schema is `pglast`-parsed and order-linted, **not live-executed**. Run `database/complete-schema.sql` → `notify pgrst, 'reload schema';` → `select public.tc_schema_ok();`.
- The ops strips and status manager need the V28 columns/functions; until the SQL is run they degrade gracefully (strip hides, manager shows a clear message).
- Visual pixel checks were not possible in this sandbox; DOM/selector/contrast assertions cover the read-only hiding and popup fixes.
- `builder.html` remains generator-internal and unauthenticated.
