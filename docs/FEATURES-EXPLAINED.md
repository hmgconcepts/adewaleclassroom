# V31 — Chat compliance audit, bug fixes, schema, testing & deployment

**Date:** 2026-08-25  
**Live sites reviewed:** https://tutoringconnect.vercel.app/ · https://adewaleclassroom.vercel.app/  
**Repos:** hmgconcepts/tutoringconnect · hmgconcepts/adewaleclassroom  
**Working trees:** `/home/user/tutoringconnect-fixed` · `/home/user/adewaleclassroom-fixed` (also synced into non-fixed clones)

---

## 1. Prompt compliance — what was obeyed vs incomplete

| # | Your prompt (summarised) | Status before V31 | Status now |
|---|---|---|---|
| A | Download all files; ZIP originals with folder structure | Obeyed | Still available in `deliverables/*-original.zip` |
| B | Identify all features; deep analysis of generator + client | Obeyed (report) | Extended in this doc |
| C | Identify errors/bugs and fix | Partial — several rounds of fixes, some incomplete | V31 closes remaining hard failures |
| D | Nav search robust / all-inclusive | Obeyed (V30 synonyms, sticky, Enter/Esc, `/`) | Kept & verified |
| E | Page Help text invisible | Visibility fixed V30 | **Formatting still broken until V31** (see §3) |
| F | Schema `learner_id` on `tc_group_insights` | Fixed V30 | Kept |
| G | Schema must be one self-contained file | Claimed, but V28 `foreach t,c` still aborted install | **Fixed V31** — pglast PARSE OK |
| H | Feature pages (blog, app links, CBT…) complete | Blog.js wired; app links enhanced | Kept |
| I | Update every file across all repos | Done for touched paths each round | Full sync again this round |
| J | No AI API; free stack; do not drop features | Obeyed | Obeyed |
| K | Detailed feature explanation + clear deployment steps | Partial | **DEPLOYMENT-GUIDE V31 section + this report** |
| L | Software-testing audit; enterprise enhancements on free tools | Partial | §6–§8 below |

**Honest incomplete items earlier:** Page Help markdown was “visible but unreadable”; schema still had a syntax bomb; live Vercel may still serve **pre-fix** assets until you redeploy from these trees.

---

## 2. Features requested vs omitted / dropped

| Feature / ask | Omitted? | Dropped pre-existing? | Action |
|---|---|---|---|
| Generator ZIP client studios | No | No | Intact (`generator.js` / `builder.html` on TC only) |
| ADEWALE parent portal | No | No | Intact; generator artifacts stripped from client |
| Public free/class register, blog | Auth lists fixed; blog.js was missing → restored | No | Kept |
| 4-cycle bookings, CBT, insights, Drive, keep-alive | No | No | Untouched core engines |
| Page Help | Broken presentation | No | **Rewritten formatter V31** |
| complete-schema one-shot | Syntax error mid-file | No | **foreach rewrite V31** |
| Enterprise free extras | Not a full new SaaS layer | N/A | Enhancements are additive (help, schema safety, docs) |

**Nothing intentional was removed from product surface area.** Client no longer ships stale `generator.js`/`wizard.js` (those are generator-only and were incorrectly left in the client package).

---

## 3. Bugs fixed this round (root cause → fix)

### 3.1 Page Help — HTML/markdown garbage + everything bold

**Verified cause (not assumed):**

1. `showHelp` used  
   `String(desc).replace(/\\n/g, ...).replace(/\\*\\*(.+?)\\*\\*/g, ...)`  
   i.e. **double-escaped** regexes that never matched real `\n` or `**`, so:
   - literal `**Dashboard**` stayed on screen  
   - assistant `formatPage()` newlines stayed as one wall of text  
2. CSS + JS pinned **every** descendant to the same heavy ink, so the card looked “all bold”.  
3. Curated blurbs + PAGE_GUIDE HTML + assistant markdown were concatenated without a real formatter.

**Fix (`assets/js/site-help.js` V31):**

- Real `md()` → escape → `**bold**` → lists → paragraphs → `<code>`  
- `fromGuide()` builds clean HTML with escaped fields, title, badge, how-to OL, sections  
- Sections separated by rules; body `font-weight: 400`; only `<strong>` / titles are 700  
- Light card + dark ink retained (invisible-text cannot return)  
- CSS V31 scopes typography under `#page-help-modal`  

**Check:** unit samples produce `<strong>Dashboard</strong>` with **no** leaked `**`.

### 3.2 Schema `ERROR 42601: syntax error at or near "["` (line ~9439)

**Verified cause:** invalid PL/pgSQL:

```sql
foreach t, c in array[
  ('substitutions','cover_tutor_name text'),
  ...
] loop
```

PostgreSQL does **not** allow multi-target `FOREACH` over a list like that.

**Fix:** replaced with:

```sql
for rec in
  select * from (values
    ('substitutions', 'cover_tutor_name text'),
    ...
  ) as v(tbl, coldef)
loop
  execute format('alter table public.%I add column if not exists %s', rec.tbl, rec.coldef);
exception when others then raise notice ...
end loop;
```

147 column pairs preserved. Applied to:

- `database/complete-schema.sql`  
- `database/v28-admin-and-ops-enrichment.sql`  

**Validation:** `pglast.parse_sql(complete-schema.sql)` → **PARSE OK** (entire file).

### 3.3 Prior fixes still in tree

- Public pages in auth-guard / app PUBLIC lists  
- `tc_group_insights` not given `learner_id` family policy (V30)  
- Blog.js script tags  
- Application links desk (share/QR/KPI)  
- Nav search synonyms  

---

## 4. complete-schema.sql — self-contained contract

| Property | Evidence |
|---|---|
| Single install path | Final `notify pgrst, 'reload schema'` + `select public.tc_schema_ok()` |
| Idempotent patterns | `create table if not exists`, `create or replace function`, `drop policy if exists`, `add column if not exists` |
| Version packs | Registry includes through V29 + V30 hotfix + V31 note |
| Standalone vN files | Optional; **not required** if complete-schema succeeds |
| Parse | pglast OK |
| Tables / functions / policies (approx) | 136+ tables · 137 functions · 167 policies |

**You should only need:**

```text
database/complete-schema.sql
```

Hotfixes remain only for databases that failed mid-run on older copies.

---

## 5. Page / workflow audit (testing expert)

### 5.1 Automated gates (this environment)

| Gate | Generator | Client |
|---|---|---|
| `test_runtime.js` | **1456 PASS** | **1415 PASS** |
| `test_nav.js` | 61 pass | 61 pass |
| `test_v29_verify.js` | 44 pass | 44 pass |
| `audit_integrity.py` | OK — 0 missing tables/fns | same schema |

### 5.2 Workflow interconnectedness (manual design review)

```
Apply / class-register / free-register / exam-register
        → inquiries / registrations / free cohorts
        → trials → engagements (1:1|group) + parent_learner
        → bookings (4×7) → sessions → attendance → hour_ledger
        → SOW / classwork / reading / practice (CBT)
        → scoresheet / mastery → insights / at-risk / 360
        → invoices / payments / packages
        → inbox / notifications / parent dashboards
```

**Security boundary:** RLS + SECURITY DEFINER RPCs for public forms. JS gates are navigation only.

**Known free-tier limits (not bugs):** no AI API; no heavy uploads; keep-alive needs at least one external pinger; static files are public (RLS protects data).

### 5.3 Generator → full studio

`generator.js` traditional build still asserts: full page set, schema, keep-alive workflows, Drive panel, no builder in client ZIP, no broken links. That is the SaaS-shaped **single-tenant** deliverable (one Supabase per studio), not a multi-tenant control plane.

---

## 6. Enterprise-oriented enhancements (free tools only)

Additive — nothing removed:

1. **Page Help** is now a proper in-product manual (curated + guide sections + optional assistant detail), still **no AI API**.  
2. **Schema install resilience** — column enrichment cannot abort the whole script on one bad column (`exception when others` + notice).  
3. **Deployment guide** — one-shot SQL + promote-admin + keep-alive/Drive steps in unambiguous order.  
4. **Nav search** — synonym map so staff find “quiz / money / register” without memorising filenames.  
5. **Application / class links** — share + QR + funnel (acquisition enterprise pattern without paid SMS).  
6. **Integrity + runtime suites** — regression net so generator/client stay connected.

Possible future free-tier adds (not blocking): ICS reminders already present; deeper offline queue; more CSV fixtures — can be layered without removing modules.

---

## 7. Detailed feature map (what the system is)

See also `FEATURE-CATALOG.md` and live `feature-guide.html`.

**Generator (Tutoring Connect)** — HMG staff builder: brand, theme, modules, optional Supabase keys → ZIP of static PWA + SQL.  
**Client (e.g. ADEWALE CLASSROOM)** — parent/tutor/learner portal.

| Domain | Capabilities |
|---|---|
| People | Learners, parents, family links, tutors, engagements, groups |
| Growth | Apply, inquiries, waitlist, trials, application links, class links, free classes, blog |
| Sessions | Calendar, 4-cycle bookings, attendance, make-ups, credits, session notes, meetings |
| Learning | SOW, lesson plans, classwork, stream, LMS, library, reading, flashcards, mastery |
| CBT | Self/Review/Graded, 17+ types, multi-subject, prompts (no AI API), review PDF, results audit, marking |
| Insights | 360, value-added, OLS prediction, at-risk rules, group insights |
| Finance | Hour banks, invoices, payments, plans, wallet, payroll, scholarships |
| Comms | Inbox, bell, broadcasts, voting, forum (groups), complaints |
| Exams | Local + international registration links; passport as Drive link |
| Platform | RLS, approvals, roles, admin data, Drive backup, quota, keep-alive, license, PWA, Page Help, assistant KB |

---

## 8. Deployment process (clear, ordered)

### A. Brand-new studio

1. Create a free Supabase project (region close to users).  
2. SQL Editor → paste **entire** `database/complete-schema.sql` → Run.  
3. Confirm final `install_check` / V31 status row.  
4. Auth → URL config: Site URL + redirect `https://YOUR_DOMAIN/login.html`.  
5. Either:  
   - **Generator path:** open Tutoring Connect `builder.html` → fill studio name, colours, Supabase URL + anon key → Download ZIP; or  
   - **ADEWALE path:** set `assets/js/config.js` `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `PRACTICE.*`.  
6. Deploy the **client** folder to Vercel/Netlify/Cloudflare/GitHub Pages (static).  
7. Visit `login.html` → Request access.  
8. SQL: promote that profile to `admin`/`approved`; ensure `practice_settings` row.  
9. Sign in → Platform Health green; create a test engagement; run one Self quiz.  
10. Optional: GitHub Actions secrets for keep-alive/backup; Drive OAuth client id in Admin Data.

### B. Existing project that failed SQL earlier

1. Run `database/v30-group-insights-rls-hotfix.sql` if you saw `learner_id` errors.  
2. Re-run full **fixed** `complete-schema.sql` (idempotent).  
3. Redeploy static assets from **fixed** ZIP (hard refresh / purge CDN + service worker).

### C. What you must not do

- Do not deploy the **generator** folder as the parent portal.  
- Do not upload large files into Supabase storage on free tier — use links.  
- Do not rely on JS alone for privacy — confirm RLS with a parent test account.

---

## 9. Deliverables

| File | Purpose |
|---|---|
| `deliverables/tutoringconnect-fixed.zip` | Generator + all fixes |
| `deliverables/adewaleclassroom-fixed.zip` | Client + all fixes |
| `deliverables/tutoring-connect-both-fixed.zip` | Both |
| `deliverables/*-original.zip` | Untouched first clones |
| `deliverables/V31-COMPLIANCE-AND-FIX-REPORT.md` | This document |
| `database/complete-schema.sql` | One-shot install (pglast OK) |

---

## 10. Residual risks (stated honestly)

1. **Live Vercel** may still run old JS until you push these files.  
2. Static HTML is fetchable; **RLS** is mandatory.  
3. Keep-alive needs an external scheduler; GitHub cron is best-effort.  
4. Full browser E2E against your live Supabase was not executed here (no staff credentials); SQL is parser-validated and suites cover static/runtime contracts.  
5. Optional AI assistant module remains admin-gated; core product stays no-AI-API.

---

*End of V31 report.*
