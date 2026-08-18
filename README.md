# Tutoring Connect

**Generator + generated studio** for independent virtual tutors. Sister product of [School Connect](https://hmgschoolconnect.vercel.app/).

A product of **HMG Technologies**, subsidiary of **HMG Concepts** (*His Marvellous Grace*). Founder **Adewale Samson Adeagbo**.

> Recurring payments should not keep your schools from having online presences.

## Two packages, never mixed

| Zip | Who opens it | Homepage |
|---|---|---|
| `tutoring-connect-generator.zip` | HMG staff | Generator landing → **Open Authorized Builder** |
| `adewale-classroom.zip` | Parents / tutors / learners | **ADEWALE CLASSROOM — official tutoring portal** → Sign in |

Parent archive `tutoring-connect.zip` contains **only** those two zips + `README-RELEASE.txt`. Rebuild: `bash tools/pack-release.sh`.

## Product law

1. An **engagement** is atomic: `one_on_one` or `group`. Own curriculum, hour bank, goals, fees, analytics.
2. Siblings and groups **do not** smear data.
3. Full booking = **4 cycles × 7 days**. Times/cycle × 4 = classes. Amount = hourly rate × (minutes/60) × classes.
4. Quizzes: **Self** / **Review** / **Graded**. Sit with student ID `TC-0001`. Graded auto-pushes the scoresheet.
5. **No AI API.** Prompts are copy-paste. Insights are readable formulas.
6. **No file upload** into free Supabase. Images / video / materials = https / Drive / YouTube links.
7. Messaging = `wa.me` / `mailto:` / `sms:`.
8. Default timezone `Africa/Lagos`, currency `₦`.

## Stack

Static PWA + **one Supabase project per studio**. RLS on every table. 10-layer keep-alive. Drive sealed backups.

## Quick start

Client studio: see **[DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md)** section A.

Generator: open `index.html` → `builder.html` → generate a client ZIP.

## Promote the first admin (run after deploying)

After running `database/complete-schema.sql`, the first person who clicks **Request access** on `login.html` is created with `role = 'parent'` and `status = 'pending'`. To make that account the studio owner, open the Supabase **SQL Editor** and run:

```sql
-- 1. Find the account you just registered (by the email you used)
select id, email, full_name, role, status from public.profiles order by created_at desc;

-- 2. Promote it to owner/admin (paste the id from step 1)
update public.profiles
   set role   = 'admin',      -- or 'owner'
       status = 'approved'
 where id = 'THE-USER-UUID-FROM-STEP-1';

-- 3. Create the single studio-settings row if it does not exist yet.
insert into public.practice_settings(id, name, motto, timezone, currency)
values (1, 'ADEWALE CLASSROOM',
        'Independent progress. Visible to parents.',
        'Africa/Lagos', '₦')
on conflict (id) do nothing;
```

Then sign out and back in. The promoted account now sees every module, the Access Manager, Platform Health and the Admin Data pages. Valid roles are `admin`, `owner`, `director`, `lead_tutor`, `super_admin`, `tutor`, `staff`, `parent`, `student`/`learner`; valid statuses are `pending` and `approved`.

## Modules (high level)

People · Growth (apply + coded links) · Sessions (calendar, 4-cycle bookings, complete-a-class) · Learning (SOW, reading, 17+15 CBT, stream, classwork, LMS, library) · Insights (360, value-added, OLS, 6 at-risk rules) · Finance (hour banks, invoices) · Comms (inbox, bell, voting, forum on groups only) · Exam registration (WAEC → GRE) · Platform (health, Drive, license, access manager).

Full catalogue: `feature-guide.html` and `FEATURE-CATALOG.md`.

## License

Lifetime (default) or subscription lock — same idea as School Connect. Client owns the data; export is always available.

---

## 🆕 Version 8 (16 Aug 2026)

V8 was a full audit + fix + enhancement pass. Nothing was removed; ten classes of
defect were fixed and every feature was extended.

### Fixed
| # | Severity | Defect |
|---|---|---|
| 1 | Critical | Theme selection barely rendered — `--gradient`, `--primary-dark/light`, `--ring`, `--on-primary` were never re-themed, so every studio looked the same |
| 2 | Critical | **19 of 20 layouts had no CSS at all** — they changed nothing |
| 3 | High | 51 of 53 themes had incomplete colour tokens; duplicate `sky` id shadowed a theme |
| 4 | High | Anonymous gate ran *after* paint, leaking the whole app structure |
| 5 | High | Install prompt was dead on 5 pages and easy to mute permanently |
| 6 | High | Assistant knew 10 topics for a 128-page platform |
| 7 | Medium | Expired auth tokens were treated as valid sessions |
| 8 | Medium | Private pages had no `noindex` protection |
| 9 | Medium | JSZip getter/setter arity bug silently blanked the entire modern build |
| 10 | Medium | Modern build required manual file copying; module choices could yield 404s |

### Added
* `assets/js/theme-engine.js` — 18-token theme application + **WCAG contrast guard**
* `assets/css/layouts.css` — all **20 layouts** implemented, + print + reduced-motion
* `assets/js/auth-guard.js` — synchronous **pre-paint** navigation gate, fails closed
* `assets/js/page-guide.js` — generated guide for **all 128 pages**
* `assets/js/seo.js` — canonical, OG/Twitter, JSON-LD; `noindex` on private pages
* `tools/build_page_guide.py`, `tools/test_runtime.js`, `tools/test_generator.js`
* `docs/PAGE-DIRECTORY.md`, `docs/SEO-GUIDE.md`

### Numbers
**63** themes · **51** fonts · **20** working layouts · **128** documented pages ·
**228** automated assertions, 0 failures · traditional build 193 files / 1.53 MB ·
modern build 394 files / 3.06 MB · **0** broken links or missing assets.

### Removed
All pricing from the builder (base fee, per-module fee, four add-ons, estimated
total, "Request on WhatsApp"). Commercial terms are agreed offline.

### Testing
```bash
npm install     # jsdom + jszip, developer-only; the studio itself has no deps
npm test
```

> **Stated honestly:** static-site auth is a *navigation* gate. The real data
> boundary is PostgreSQL Row Level Security (`database/v7-family-access-fix.sql`).
> Both layers are required.

---

## 🆕 Version 9 (16 Aug 2026)

Focused on the two systems that protect a studio from data loss, plus assistant depth.

### Fixed
| # | Severity | Defect |
|---|---|---|
| K1 | High | **Keep-alive was unobservable.** `platform-health.html` read `tc_heartbeat` directly, but the table is revoked from clients — the live project returned `42501 permission denied`, so the heartbeat tile was permanently blank and a stalled keep-alive failed silently |
| K2 | Med | No status RPC — nothing could answer "how close am I to being paused?" |
| K3 | Med | `tc_keep_alive` was UPDATE-only and could silently no-op |
| K4 | Med | Vercel route returned `ok:true` even when the write failed |
| K5 | Med | Edge function documented but never deployed (live 404) |
| K6 | Med | Twice-weekly cron left no margin — GitHub can skip scheduled runs entirely |
| D1 | **Critical** | **Google Drive sync had no UI at all.** `admin-data.html` called `DriveSync.renderPanel()`, which was **never defined** — so there was no way anywhere in the product to enter a Client ID, back up, or restore |
| B1 | Med | Assistant documented pages but not sections or role views |

### Added
* `database/v9-keepalive-and-drive.sql` — upsert heartbeat, **`tc_keep_alive_status()`**, capped ping log, staff read policy
* `assets/js/keepalive-monitor.js` — health widget, owner alert banner, **browser self-heal**
* `.github/workflows/keepalive-watchdog.yml` — independent **daily** watchdog that detects a paused project, self-heals, opens a GitHub issue and auto-closes it
* `DriveSync.renderPanel()` + `renderFiles()` — the missing Drive control panel
* `docs/KEEP-ALIVE-GUIDE.md`, rewritten `docs/GOOGLE-DRIVE-SYNC-GUIDE.md`
* Assistant: **711 documented sections**, role views, **57 routed tasks**, FAQs

### Keep-alive facts this release is built on
Supabase pauses a free project after **7 days without real database activity** —
front-end traffic and dashboard visits do **not** count. `pg_cron` cannot save you
(it pauses with the database). **GitHub Actions cron is not guaranteed** and
**Vercel Hobby cron runs once a day at most**. Hence: every-2-days writer, daily
watchdog, browser self-heal, and a documented **independent external scheduler**.

### Numbers
**274** automated assertions, 0 failures · 12 keep-alive layers · 128 pages ·
711 sections · traditional build 198 files / 1.56 MB · modern 404 files / 3.13 MB.

---

## 🆕 Version 10 (16 Aug 2026) — HMG house identity + School Connect parity

Built after a deep study of **School Connect** (`hmgschoolconnect.vercel.app`) and
the **GOSA portal** (`gosaportal.vercel.app`).

### Brand
* **"HMG Tutoring Studio" is retired.** The house theme is now **HMG Tutoring
  Studio**, carrying the HMG palette `#0506ae` / `#964eec`. Generator fallbacks
  and SEO defaults updated; no "HMG" naming remains anywhere.
* **ADEWALE CLASSROOM now matches the GOSA portal exactly** — same primary,
  accent, gradient and **Plus Jakarta Sans**, applied through the *same
  mechanism GOSA uses*: an inline `<style id="tc-brand">:root{…}</style>` baked
  into all 128 pages, so the brand paints on the first frame.
  Verified byte-identical against `gosaportal.vercel.app`:
  `--primary:#0506ae` · `--accent:#964eec` ·
  `--gradient:linear-gradient(135deg,#0506ae,#964eec)` · `--font:'Plus Jakarta Sans'`.
  *(This deliberately reverses the V8 Oxford-Navy change — an explicit brand
  decision to keep one HMG look across School Connect, GOSA and Tutoring Connect.)*

### Multi-subject CBT — was a stub, now real
`cbt-multi.html` was a **56-line redirect** to `cbt-exam.html`. The multi-subject
*runtime* existed (subject tabs) but nothing could **build** such a paper.
It is now a **306-line builder** modelled on School Connect's: one block per
subject, per-subject CSV or file upload, per-subject marks, live blueprint with
mark share, duplicate-name rejection, randomise-within-subject, questions-per-
subject cap, identity mode, full anti-cheat toggles, and a saved-papers list.
Every question is subject-tagged, which is what drives the exam tabs and the
**one scoresheet row per subject plus an overall row**.

### Supabase free-tier protection — now 14 layers (School Connect parity + more)
* **NEW layer 12 — Google Apps Script** (`tools/keepalive.gs`): daily ping from
  **Google's** servers using only the studio's Gmail — independent of GitHub
  *and* Vercel. Beyond SC parity it verifies the write, reads health back, and
  **emails you** on failure while staying silent when healthy.
* **Layer 13 — auto-restore** documented: `SUPABASE_ACCESS_TOKEN` +
  `SUPABASE_PROJECT_REF` let the watchdog actually **un-pause** a paused project
  through the Management API.

### Google Drive backup — School Connect parity + more
* **NEW `overdueBanner()`**: warns owners when a backup is overdue, when the
  studio has **never** been backed up (red), or when an automatic attempt
  **silently needed consent again** — with a one-press *Back up now*.

### Numbers
**146** runtime + **47** traditional-build + **55** modern-build assertions ·
0 failures · 14 keep-alive layers · 128 pages · 711 sections ·
traditional build 199 files / 1.57 MB · modern 406 files / 3.16 MB.

---

## 🆕 Version 11 (16 Aug 2026)

### The Attendance / Hour-bank errors — root cause found
Not a code bug. Probing the **live** ADEWALE CLASSROOM project showed the
database is at **V4** while the files expect **V9**:

| Missing | Installed by | What it breaks |
|---|---|---|
| `tc_cbt_get_exam` | `v6-cbt-modes.sql` | quiz codes / student-ID CBT sign-in |
| `is_family_of_learner` | `v7-family-access-fix.sql` | **all parent & learner access** |
| `tc_keep_alive_status` | `v9-keepalive-and-drive.sql` | keep-alive monitoring |

Every page calling these threw its own raw `PGRST202` / `42501` popup.

**Fix — run `database/complete-schema.sql` once in the Supabase SQL editor.**
It is idempotent and your data is untouched.

**Engineering fix — `assets/js/schema-doctor.js`:** probes the database once per
session, works out the deployed version, and shows the admin **one** banner
naming the exact SQL file — instead of scattered popups. It also rewrites raw
Postgres noise into plain English, de-duplicates repeats, and **never shows
infrastructure errors to parents or learners**.
A schema panel was added to Platform health.

*(Also fixed a bug I introduced in V10: `cbt-multi.html` queried
`engagements.title`, which does not exist — the column is `name`.)*

### AI question prompts — 10 → 18 packs
School Connect parity: **MCQ-only strict CSV**, **Exam-board paper**
(WAEC/NECO/UTME/IGCSE/IELTS/SAT…). Beyond it: **Differentiated
(Support/Core/Stretch)**, **Diagnostic misconception set**, **Multi-subject
paper**, **From a past paper**, **Mark scheme / rubric**, **Oral practice** —
alongside the existing reading-assignment packs that generate questions from the
exact **article or video link** the tutor set. Pack-specific inputs (board,
subjects, source link) now show and hide automatically.

### No file uploads — two real violations removed
* `proctor.js` uploaded a **webcam JPEG to Supabase Storage on every snap** — a
  40-minute exam meant ~40 images per candidate, burning the free 1 GB and
  storing biometric images of minors. Now **metadata-only**: a violation
  timeline with a luminance check (detects a covered camera). Nothing leaves the
  device.
* `data-portability.js` silently uploaded backups to a Storage bucket. Now
  **opt-in** (`{confirm:true}`), and it states the quota cost. Downloads and
  Google Drive remain the recommended destinations.

Verified: no file pickers anywhere except local CSV parsing; `media.js` renders
YouTube thumbnails and Drive previews from links.

### Numbers
**172** runtime + **47** traditional-build + **55** modern-build assertions,
0 failures · 18 prompt packs · 32 question types · 14 keep-alive layers.

---

## 🆕 Version 12 (16 Aug 2026)

### One SQL file, provably safe to re-run
`database/complete-schema.sql` is now **self-contained and self-documenting**.
Run it once; you never need the individual `v*.sql` packs. A new linter,
`tools/lint_schema.py`, checks every statement for re-runnability
(tables/indexes/columns `IF NOT EXISTS`, functions `CREATE OR REPLACE`, every
policy and trigger preceded by a `DROP … IF EXISTS`, seeds with `ON CONFLICT`)
and reports **0 blockers** across all 12 SQL files. Storage-offload and V12 are
now inlined, and the header explains why a few objects are deliberately defined
twice (later packs supersede earlier ones — last definition wins).

### Schema registry — a database that reports its own version
`tc_schema_registry` + `tc_schema_info()` mean the app asks one question instead
of probing function-by-function. `schema-doctor.js` uses it, and I fixed a real
flaw in my own V11 logic: it reported the *last present* probe, so a database
missing V6 but holding a V12 object would falsely claim V12. It now stops at the
**first gap**. Against the live Adewale project it correctly reports **V4**.

### Free-tier quota guard (the 500 MB database)
Uploads were already banned to protect the 1 GB *storage* quota. Nothing
protected the *database*, which on this platform always fills in one place: CBT
results (`answers`/`review`/`detail` JSONB ≈ 30–60 KB per sitting).

* **Compress** — LZ4 on 15 heavy JSONB/text columns (PG14+, guarded, typically
  40–60% off JSONB).
* **Measure** — `tc_db_report()` → total MB, % of 500 MB, worst tables, state.
* **Reclaim** — `tc_prune_logs()` (log retention) and `tc_slim_cbt_results()`
  which drops the per-question *replay* of old quizzes while keeping **every
  score, per-subject score and scoresheet row**.
* **Automate** — weekly `pg_cron` housekeeping.
* **Surface** — a widget on Storage manager and Platform health, plus a quiet
  owner warning past 70%.

Tests assert the reclaim functions can never delete from `scoresheet`,
`assessments`, `payments`, `invoices`, `learners` or `sessions`.

### Verified, not rebuilt
**CBT Open vs Registered** (item 3) and **multi-subject → per-subject scoresheet
rows** (item 8) were already correct; V12 adds regression tests proving the
client emits `{subject:{score,total}}` in exactly the shape the SQL trigger
reads, that a per-subject row plus an overall row are written, and that
aggregate buckets are skipped so nothing is double-counted.

### Numbers
**220** runtime + **47** traditional-build + **55** modern-build assertions,
0 failures · 12 SQL files, 0 idempotency blockers · 18 prompt packs ·
32 question types · 14 keep-alive layers.

---

## 🆕 Version 13 (16 Aug 2026) — reported-bug sweep

### The Studio Assistant: four faults, one root cause
`#tc-bot-panel{display:flex}` is an **ID selector**, so it out-specified the
browser's `[hidden]{display:none}`. The panel was therefore *permanently open*:
the × appeared dead, the launcher appeared dead, it covered the page, and
because it never registered as "opened" the greeting and suggestion chips never
rendered. Visibility is now driven by a **class** (which cannot be
out-specified), plus a new **minimise** button, Esc-to-close, a launcher icon
that flips to ✕, and **10 predefined prompts rendered up front**.
*(Items 1, 3, 4, 5 — all from one CSS specificity bug.)*

### Text you could not read
A contrast audit with the studio's real token values resolved found genuinely
unreadable text on white — worst of all `.form-help`, which sits under **every
form field**, at **2.56:1**. A new legibility layer brings everything to WCAG AA
without touching the brand hues, so the studio still matches GOSA exactly:

| | before | after |
|---|---|---|
| `.form-help` / `.muted` / `.stat-label` | 2.56:1 | **6.17:1** |
| `.badge-warning` | 2.15:1 | **7.03:1** |
| `.badge-success` | 2.54:1 | **6.44:1** |
| `.badge-info` / `.badge-danger` | 3.68 / 3.76:1 | **6.70 / 6.57:1** |
| `::placeholder` | — | **4.83:1** |

Plus visible keyboard focus rings and a readable footer.

### A real description at the head of every page
All **128 pages** now open with a page-intro card generated from the 128-page
knowledge base: what the page is, an access badge, **who it is for**, **why it
matters**, a collapsible **how-to**, and related pages. No page is thin.

### "invalid input syntax for type numeric" — fixed for all 74 CRUD pages
`FormData.get()` returns `""` for a blank field. Postgres accepts that for text
but rejects it for `numeric`, `date`, `timestamp` and `uuid` — which is why
creating an **Engagement** or saving a **Session** failed while text-only records
saved fine. Blank now means **NULL**, numbers are coerced to real numbers, and
an empty `id` is never sent. One fix, every page.

### "Sign in with Supabase to save." on My profile
The handler captured `window.TC_PROFILE` at page load, but app.js resolves the
role **asynchronously** — so the closure always held an empty object. Identity is
now resolved **at click time**, falling back to the auth session.

### New: `ux-enhance.js`
Password **show/hide** on every password field · free-text fields upgrade to
**database-backed dropdowns** (`data-lookup`) so names can never drift ·
auto-fill (today's date, next half hour, "me") · single-option selects
auto-choose · unsaved-changes guard.

### Numbers
**255** runtime + **47** traditional-build + **55** modern-build assertions,
0 failures · 12 SQL files, 0 idempotency blockers.

---

## 🆕 Version 14 (17 Aug 2026) — the CBT cluster + the pages that could not be used

### Exam runtime rebuilt — `assets/js/cbt-exam-kit.js`
* **Studio name bold and centred** at the head of every paper *(item 13)*.
* **Numbered question tabs** — grouped by subject, showing answered / current /
  flagged, jump to any question *(item 20)*.
* **Full anti-cheat suite** *(item 9)*: tab & app switching, window focus loss,
  copy / cut / paste, right-click, devtools & print shortcuts, fullscreen,
  candidate watermark, camera snapshots (metadata only), audio monitoring, a
  live violation counter and **auto-submit at a configurable limit**.
* **Scientific calculator** *(item 14)* — deliberately **not** `eval()`-based
  like School Connect's. A real tokeniser + recursive-descent parser: degrees /
  radians, memory, ANS, history, factorial, nCr/nPr, `logb`, hyperbolics,
  implicit multiplication, right-associative powers. 25/25 expressions correct,
  and it **refuses arbitrary JS**.
* **Maths keyboard** — 73 symbols across 7 groups, inserted into the focused box.

### Quizzes page *(items 8, 12, 23)*
CSV **file upload**, a **downloadable worked template** (7 question types), and
full management of existing papers: **Edit · Duplicate · ＋Append CSV · Delete**.
CSV round-trips (parse → export → parse) with commas and quotes intact, so
School Connect files work here unchanged. The multi-subject builder gets the
same template download and the full anti-cheat config.

### Question prompts *(items 7, 11)*
Added **Subject** and **Exam Type** fields (20 boards). Prompts grew from ~600 to
**3,100+ characters**: an explicit OUTPUT CONTRACT, a QUALITY BAR, a FINAL CHECK,
and a **save-as-.csv** box so the CSV the chat returns becomes a file in one click.

### Pages that existed but could not be used
* **Approvals** *(item 21)* was a 130-line stub — the dashboard counted pending
  accounts but there was **no way to approve anyone**. Now a real console:
  counts, filters, search, role-setting and approve / suspend / reinstate.
* **Navigation** *(item 28)*: **90 of 127 pages were unreachable** from the
  sidebar. Now **120/120**, grouped into 11 labelled sections.
* **Reading assignments and Classwork** *(items 24, 25)* could only create.
  New `record-actions.js` adds **Edit / Duplicate / Delete** with the same
  blank-to-NULL coercion, so a cleared field never throws.
* **Cycle bookings** *(item 18)*: 1–7 classes per cycle, 1–12 cycles, and a
  **day-of-week picker with per-day times** — Mon/Wed/Fri/Sun × 4 cycles
  generates exactly 16 dated classes on those days.
* **E-receipts** *(item 26)*: branded, printable, amount **in words**, stable
  receipt number that never duplicates on reprint, and the outstanding balance.

### Numbers
**324** runtime + **47** traditional-build + **55** modern-build assertions,
0 failures · 12 SQL files, 0 idempotency blockers · nav coverage 120/120.

---

## 🆕 Version 15 (17 Aug 2026) — family portal, real ballots, one bill per family

### Item 16 — the parent portal actually connects now
`parent_learner` had a CRUD schema but **no page anywhere in the product**, so
nothing ever wrote to it. Without that row `is_parent_of()` is false and every
parent portal is empty — the real reason families "can't see anything".

* **`family-links.html`** — link a parent to each child with a relationship, and
  it surfaces the two silent traps automatically: **learners with no parent**
  (invisible to their family) and **parents with no portal login** (linking them
  changes nothing until an account is attached). Both are listed with the fix.
* **`my-children.html`** — the parent's home page: one card per child with the
  next classes (date, time, duration, join link), latest scores by subject,
  attendance, assessments and the reading set before the next lesson.
* New SQL: `tc_my_children()` and `tc_child_summary()`, both SECURITY DEFINER
  and **filtered by the caller**, so passing another family's learner id
  returns `not_permitted` rather than data.

### Item 27 — polls became real ballots
The schema held only `(title, options, anonymous, status)`. Added **closing
date, multi-choice with a maximum, audience, quorum, and a results-disclosure
rule** (always / after you vote / after close) enforced in SQL by
`tc_poll_results()`, not just hidden in the UI. The ballot now shows a live
countdown, how many picks are allowed, the quorum and the disclosure rule;
voting is refused after the deadline; and results **export to CSV**.
A unique index enforces one vote per person.

### Competitor gap closed — combined family invoicing
TutorBird, Teachworks and Teach'n Go all bill **per student**. A parent with
three children wants **one** invoice. `tc_family_statement()` gathers every
invoice across all of a parent's children into a single printable statement
grouped by child, with total billed, total paid and one balance due.

### Item 14 — licensing: I was wrong last turn
I reported that the builder "doesn't expose the choice". It does — and
`normalizeCfg()` writes it correctly. Verified end to end by generating both a
lifetime and a subscription ZIP and reading the licence block out of the
resulting `config.js`. A regression test now locks that behaviour in.

### Numbers
**367** runtime + **47** traditional-build + **55** modern-build assertions,
0 failures · 13 SQL files, 0 idempotency blockers · nav coverage **122/122** ·
130 pages documented.
