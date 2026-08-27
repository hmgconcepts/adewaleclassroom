# Deep Analysis — Tutoring Connect (generator) & ADEWALE CLASSROOM (generated studio)

**Vendor:** HMG Technologies, a subsidiary of HMG Concepts (Lagos, Nigeria)
**Audited:** 27 Aug 2026

---

## 1. What this actually is

This is **not one product — it is a factory and one of its outputs.**

| | Generator | Generated studio |
|---|---|---|
| Site | tutoringconnect.vercel.app | adewaleclassroom.vercel.app |
| Repo | `hmgconcepts/tutoringconnect` | `hmgconcepts/adewaleclassroom` |
| Role | Internal HMG build tool | A real, live tutoring business |
| Files | 422 | 388 |
| Commits | 120 | 125 |

**Tutoring Connect** is an internal HMG representative tool. Its landing page is a pitch; its real payload is `builder.html` — a wizard that collects a studio's name, logo URL, colour palette, module selection and optional Supabase keys, then emits a complete downloadable ZIP: a full PWA plus a one-click SQL schema.

**ADEWALE CLASSROOM** is exactly that output, deployed. Its `PACKAGE.txt` states it plainly: *"This package is the GENERATED Tutoring Connect studio… There is no builder in this zip."*

### The delta between them — proof of the model

A file-by-file diff shows the generated studio is the generator **minus the factory**:

- `builder.html` — removed
- `tools/` — 31 build/audit scripts removed (`generate_pages.py`, `build_nav_model.py`, `test_generator.js`, `pack-release.sh`, …)
- `package.json` — removed
- `assets/js/config.js` — **rewritten** with the client's real identity and live Supabase keys

Everything else — all 153 HTML pages, all 88 JS modules, the entire `database/` folder — is byte-identical. The generator ships its *own* runtime as the template, which is why both repos share every bug found.

### Business model
One-time lifetime licence, self-hosted, ₦0 running cost. One Supabase project **per studio** — deliberately not multi-tenant, which the docs justify as safer on the free tier. The client owns the data outright; HMG is not a marketplace and takes no cut of the tutoring relationship. This is positioned explicitly *against* Wyzant/Preply.

---

## 2. Architecture

```
Static PWA (no build step, no framework, no bundler)
   ├─ 153 hand-generated HTML pages, flat at repo root
   ├─ 88 vanilla-JS modules in assets/js/  (~1.8 MB)
   ├─ 2 CSS files (style.css 78 KB + layouts.css)
   ├─ sw.js — offline shell, stale-while-revalidate, push
   └─ manifest.json — installable, shortcuts, maskable icons
        ↓ supabase-js v2 via CDN
PostgreSQL (Supabase free tier)
   ├─ 130 tables, 122 functions, RLS on everything
   └─ database/complete-schema.sql — 10,753 lines, single-file install
        ↑ kept alive by
Keep-alive mesh (10 layers)
   ├─ .github/workflows/  keep-supabase-alive · keepalive-watchdog
   │                      supabase-auto-restore · db-backup
   ├─ api/keepalive.js    Vercel cron, daily 05:00
   └─ supabase/functions/ping/index.ts   edge function
```

**Zero dependencies at runtime.** No React, no bundler, no `node_modules`. `package.json` exists only in the generator, for its test scripts. Every page is a plain document that loads ~40 `<script src>` tags in a fixed order. This is a deliberate choice: it makes the output hostable on Vercel, Netlify, GitHub Pages or Cloudflare Pages with no pipeline, and it is why the whole thing runs at ₦0/month.

### Design law (from `FEATURE-CATALOG.md`, enforced in code)
1. An **engagement** is independent — 1:1 = one learner; a group shares sessions but keeps individual analytics.
2. A **parent** sees only mapped children.
3. A **learner** sees only themselves.
4. Media is a **link**, never a byte in Postgres — protects the free 500 MB quota.
5. Messaging is **device-native** — `wa.me`, `mailto:`, `sms:`. No paid gateway.
6. Insights are **formulas you can read** — no AI API anywhere.

Rule 4 and rule 6 are the commercial engine: they are what make a genuinely free tier viable.

---

## 3. How the core systems actually work

### 3.1 Authentication — three distinct doors

**Door 1 · Portal session (Supabase Auth).** `auth-guard.js` loads *synchronously in `<head>`*, before `<body>` exists. It classifies the page against an explicit allow-list, and on a protected page with no `sb-*-auth-token` in localStorage it calls `location.replace()` **before any protected markup is parsed**. If a token exists but is unverified, it hides the document behind a splash until `app.js` confirms the role, with a 6-second failsafe so a script error never strands the user on a blank screen.

The file is refreshingly honest about its own limits:

> *"This is a NAVIGATION gate, not a data gate. Any static file can be fetched directly. The real protection is PostgreSQL Row Level Security."*

That candour is the single most important sentence in the codebase — and it is precisely why Bug 1 (RLS predicates denied to `anon`) is critical rather than cosmetic.

**Door 2 · Code-gated CBT.** `cbt-exam`, `cbt-multi`, `cbt-review` are deliberately reachable without a portal account. A learner authenticates with a quiz code + student ID via the `anon`-granted RPC `tc_cbt_get_exam(text, text)`.

**Door 3 · Public forms.** `apply`, `free-register`, `class-register`, `exam-register`, `public-book` post through a tight allow-list of seven `SECURITY DEFINER` RPCs — `tc_submit_application`, `tc_register_candidate`, `tc_candidate_lookup`, `tc_class_register`, `tc_keep_alive`, `lookup_login_email`, `tc_license_writable`.

### 3.2 Authorisation — RLS as the real boundary

All enforcement lives in Postgres. Policies are expressed through 13 `SECURITY DEFINER` predicate helpers that resolve from `auth.uid()`:

- **Staff:** `is_admin()`, `is_tutor()`, `tc_is_manager()`
- **Tutor scoping:** `tc_my_tutor_id()`, `tc_teaches_engagement/learner/session()`
- **Family:** `is_parent_of()`, `tc_parent_matches_uid()`, `tc_family_can_see_learner()`, `is_family_of_engagement/learner()`
- **Self:** `is_self_learner()`

The schema's version history reads as a genuine fight with RLS recursion — `v27-rls-recursion-blog-documents.sql`, `v30-group-insights-rls-hotfix.sql`, `v32-rls-recursion-hard-break.sql`. The `SECURITY DEFINER` helper pattern is the standard, correct escape from infinite policy recursion. It was implemented well; only the **grants** on those helpers were wrong.

### 3.3 The booking engine — `bookings-engine.js`

The commercial heart, and admirably small (2 KB). A full booking is **4 cycles × 7 days**:

```
classes = timesPerCycle × cycleCount
hours   = classes × durationMin / 60
amount  = hours × hourlyRate
```

`explain()` returns the arithmetic as **eight plain-English sentences** rendered to the parent — "Total classes = 2 × 4 = 8… Amount due = 8 × ₦5000 = ₦40,000." Nothing is a black box. A SQL trigger `consume_session_hours` then debits the hour bank as attendance is marked, so the balance is derived from teaching actually delivered rather than hand-maintained.

### 3.4 Insights — `insights.js`, 7.5 KB, no AI

Every number is an auditable formula:

- **Prediction** — ordinary least squares on the last *n* scores, projected to the exam date in fortnight steps, clamped 0–100. Returns its own methodology string: *"Each fortnight changes the score by X points."*
- **Value-added** — `current − baseline`, from the diagnostic taken at intake.
- **At-risk** — six explicit rules: attendance < 80 %, no session in 14 days, hour bank < 2, homework < 60 %, three consecutive declining scores, > 40 % of topics below 50 % mastery.
- **Methodology suggestions** — each flag maps to concrete teaching advice ("Stop introducing new topics. Two sessions of worked-example → faded example → independent item").
- **Charts** — hand-rolled inline SVG line/bar/heatmap. No Chart.js, no CDN.

This is the honest alternative to an LLM summary: cheaper, explainable to a parent, and defensible in a dispute.

### 3.5 Free-tier survival — the most distinctive engineering

Ten layers keep a free Supabase project from being paused for inactivity, and keep the data recoverable:

- Four GitHub Actions: scheduled ping, a **watchdog that watches the pinger**, auto-restore, and DB backup
- Vercel cron → `api/keepalive.js`
- Supabase edge function `ping`
- `keepalive-monitor.js` + `quota-guard.js` in the browser
- `database/keep-alive.sql`, `storage-offload.sql`, `drive-sync.sql`
- Sealed Google Drive backups (`drive-sync.js`, 25 KB)

`tc_heartbeat` and `tc_keepalive_log` are explicitly revoked from `anon` so the mechanism itself is not a data leak. `SUPABASE_FREE_TIER_PROTECTION.md` runs to 36 KB. This is a serious, well-documented answer to the real failure mode of free-tier SaaS.

---

## 4. Feature inventory

**~120 modules / 142 live pages.** Grouped as the catalogue defines them:

- **Core people** — engagements, learners, groups, parents & families, tutors, subjects & exam boards
- **Growth** — inquiries/CRM, waitlist, trials, onboarding checklists, public inquiry form, referrals, reviews, marketing flyer generator
- **Sessions** — calendar, availability, public self-booking, attendance, make-ups, cancellations, session notes, meeting links (Jitsi/Meet/Zoom), Excalidraw whiteboard rooms, workshops, rooms, timezone desk
- **Learning** — diagnostics, goals, topic mastery heatmap, methodologies, curriculum maps, lesson plans, homework, **32 CBT types**, CSV question prompts, progress reports, learning styles, SEN accommodations, resource library, SM-2 spaced practice, certificates, portfolio, mini-LMS, streaks & badges, rubrics, transcripts, digital library
- **Analytics** — Insights Lab, Learner 360, group fairness insights, at-risk board, exam targets, predicted grades, value-added, practice analytics
- **Finance** — hour banks, packages, invoices, payments, payment plans, wallet, fee catalogue, scholarships, books, tutor payroll
- **Communication** — announcements, WA/email/SMS, in-app inbox, complaints, surveys, parent conferences, notification centre, result broadcasts, polls & voting with live tally
- **Media & ops** — gallery, birthdays, directory, help desk, contracts & consent, policies, learner ID cards, cover tutors, **safeguarding log (hidden from families)**, compliance
- **Platform** — settings (2FA email OTP, i18n, a11y, dark mode, idle lock), approvals, role & status manager, admin data, storage manager, activity log, platform health (heartbeat + lockdown + login audit), site licence, PWA install, offline page, **Ctrl/K command palette**, rules-based studio assistant, page access manager

### The CBT engine — the deepest subsystem
~370 KB across `cbt.js`, `cbt-types.js`, `cbt-exam-kit.js`, `cbt-manage.js`, `cbt-marking.js`, plus `proctor.js`. Three modes:

- **Self** — practice, instant feedback
- **Review** — answer + key + explanation + PDF export
- **Graded** — auto-pushes to the scoresheet via the `tc_push_cbt_to_scoresheet` trigger

Student-ID login, no account needed. Questions import from CSV. Entirely offline of any AI API.

### The assistant — rules, not a model
`assistant-kb.js` (94 KB) + `page-guide.js` (**414 KB**, the single largest file) form a hand-authored knowledge base covering *every page and process*. The chatbot answers "what is this page?", "how do bookings work?", "who can see my child's scores?" and navigates you there. Zero inference cost, zero hallucination, works offline. `page-guide.js` is machine-generated by `tools/build_page_guide.py`.

---

## 5. Engineering assessment

**Strengths**

- **Documentation is exceptional.** 49 markdown files, including per-version audits (`V16`…`V29`), a disaster-recovery runbook, an insights methodology paper and a competitor benchmark. Code comments explain *why*, and repeatedly admit past mistakes — the V19 block openly states *"I wrote those ineffective revokes and reported them as security. They were not."* That is rare and valuable.
- **Complete DB/code coverage.** All 70 tables and every RPC referenced in code exist in the schema. Zero drift.
- **Clean static hygiene.** No broken links, no duplicate IDs, no script-order faults, no syntax errors across 184 JS files.
- **Defensive by default.** Atomic-free SW precache (each URL cached individually so one 404 can't abort the install), 6-second gate failsafe, SVG chart fallbacks, "fails safe: features silently disable rather than break the page."
- **Real product thinking.** The 8-sentence booking explanation, the safeguarding log hidden from families, sibling data isolation, group averages that can't hide a struggling child.

**Risks**

- **`complete-schema.sql` is 10,753 lines with five stacked catalogue-wide privilege sweeps.** A function's effective privilege now depends on its line number relative to those sweeps. This produced Bug 1 and will produce its successor. The fix is one consolidated grant block at the end of the file.
- **~40 `<script>` tags per page, all global-scope.** No modules, no namespacing. This produced Bug 2. `page-guide.js` alone is 414 KB parsed on every page load.
- **The generator ships its own runtime as the template**, so any defect is cloned into every studio ever generated — as confirmed here: both bugs were byte-identical in both repos.
- **Testing is generator-side only** (`tools/test_*.js`) and static. Neither bug found in this audit was catchable without a browser and a live database — there is no headless smoke test in CI.

**Verdict**

Genuinely impressive work: a 120-module, 130-table education platform with real RLS, real offline support and real free-tier survival engineering, built with no framework and no running cost. The two defects found are both **privilege/load-order faults at the seams between layers** — invisible to static review, invisible to a logged-in developer, and caught only by probing as an anonymous user in a real browser. Both are now fixed.

The highest-value next investment is a CI smoke test that loads every page headless as `anon` and fails the build on any `pageerror` or any HTTP 401 — the exact harness used for this audit.
