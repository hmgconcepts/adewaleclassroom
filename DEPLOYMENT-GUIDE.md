# Tutoring Connect — deployment (clear, unambiguous)

A product of **HMG Technologies**, a subsidiary of **HMG Concepts** (*His Marvellous Grace*). Founder: **Adewale Samson Adeagbo**. WhatsApp [+234 810 086 6322](https://wa.me/2348100866322).

This guide deploys a **generated client studio** (ADEWALE CLASSROOM or any studio the builder stamps). It does **not** deploy the generator as a parent-facing site.

## What you are deploying

| Piece | What it is | Cost |
|---|---|---|
| Static PWA | HTML / CSS / JS. Host on Vercel, Netlify, GitHub Pages or Cloudflare Pages | Free |
| One Supabase project | Postgres + Auth + RLS. **One project per studio** | Free tier |
| Messaging | `wa.me` / `mailto:` / `sms:` | Free |
| Media | Google Drive / YouTube / https **links** | Free (your Drive) |
| AI | None. Prompt packs are copy-paste into a chat **you** already use | ₦0 |

There is **no** paid AI API and **no** file upload into the 500 MB database.

## Release zips

`tutoring-connect.zip` contains **only**:

1. `tutoring-connect-generator.zip` — HMG staff open `index.html` → `builder.html`.
2. `adewale-classroom.zip` — the generated client. **No builder.** Parents see “Sign in to portal”.
3. `README-RELEASE.txt`

Rebuild after source changes: `bash tutoring-connect/tools/pack-release.sh`.

---

## A. Deploy ADEWALE CLASSROOM (or any generated studio)

### 1. Unzip the **client** package

Unzip `adewale-classroom.zip`. You should see `index.html` titled **ADEWALE CLASSROOM — official tutoring portal**. There must be **no** `builder.html`.

### 2. Create a free Supabase project

1. Go to [https://supabase.com](https://supabase.com) and create a project (region: close to Lagos if offered).
2. Wait until the project is healthy.
3. Open **SQL Editor**.
4. Paste **the entire** `database/complete-schema.sql` (it already includes v2 bookings/SOW/quizzes, v3 stream/exams, v4 notifications/audit/library, v5 makeup credits/study log, keep-alive and Drive columns).
5. Run it. You should see the success notices.
6. If this studio was installed **before** v5, also run `database/v4-enterprise-parity.sql` then `database/v5-ops-parity.sql`.

### 3. Turn on Auth

1. Authentication → Providers → **Email** on.
2. Confirm email: leave on (free). Parents click the confirm link, then wait for **Approvals**.
3. Optional: Authentication → URL configuration → add your live origin (`https://yourstudio.vercel.app`) and `http://localhost:5500` for local preview.

### 4. Paste keys

Open `assets/js/config.js`. Replace:

```js
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

with Project Settings → API → **Project URL** and **anon public** key.

Never put the **service_role** key in the website.

### 5. Host the folder

Any static host. Bind to the public internet (not `127.0.0.1` only).

**Vercel:** `vercel` in the folder, or drag-drop. `vercel.json` already pings `/api/keepalive` daily.

**Netlify:** drag the folder. `_headers` is included.

**GitHub Pages:** push the folder, enable Pages. Add `.nojekyll` (already in the zip).

**Cloudflare Pages:** upload the folder.

### 6. Create the first admin

1. Open `/login.html` → Request access as **Studio admin**.
2. Confirm the email.
3. In Supabase → Table Editor → `profiles` → set that row `role = admin` and `status = approved`.
4. Sign in. You should land on `dashboard.html`.

### 7. First-day studio checklist

1. **Settings** — name, motto, timezone `Africa/Lagos`, currency `₦`, logo **URL**.
2. **Subjects** — WAEC / IGCSE / SAT / IELTS as you teach them.
3. **Tutors** + **Availability**.
4. **Learners** (student IDs auto-issue `TC-0001`…) and **Parents**, then link them.
5. **Engagements** — one row per 1:1 or named group. Seat members. Never share a sibling’s contract.
6. **Scheme of work** for the term.
7. **Cycle bookings** — 4 × 7 days. 2×/cycle = 8 classes.
8. **Platform Health** — press 💓 heartbeat. Confirm it writes.
9. **Admin Data** — follow `docs/GOOGLE-DRIVE-SYNC-GUIDE.md` (GIS + `drive.file`).
10. **Approvals** — only people you recognise.

### 8. Keep-alive (do not skip)

Free Supabase **pauses** after ~7 days idle. The product ships **10 layers**. Minimum viable:

| Layer | What you do |
|---|---|
| 1 Site visit | Automatic. Every visitor calls `tc_keep_alive('site-visit')` once/day. |
| 2 GitHub Action | Push the repo; the workflow already calls the RPC Mon/Thu. Add secrets `SUPABASE_URL` + `SUPABASE_ANON_KEY`. |
| 3 Edge ping | Deploy `supabase/functions/ping`. Point UptimeRobot at it; keyword `heartbeat written`. |
| 4 pg_cron | Installed by the SQL if the extension exists. |
| 5 Health page | Owner presses 💓 before a long holiday. |
| 6 cron-job.org | Daily GET of the edge ping or `/api/keepalive`. |
| 7 Vercel Cron | Already in `vercel.json` → `/api/keepalive`. |
| 8 Apps Script | Optional time-driven URL fetch. |
| 9 Self-commit | Optional; see `SUPABASE_FREE_TIER_PROTECTION.md`. |
| 10 Auto-restore | Optional GitHub Action with `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF`. |

Full detail: `SUPABASE_FREE_TIER_PROTECTION.md`.

### 9. Google Drive backup

Admin Data → Drive card. Client ID from Google Cloud (GIS, scopes `drive.file` only). Archives are SHA-256 sealed. Guide: `docs/GOOGLE-DRIVE-SYNC-GUIDE.md`.

---

## B. Use the generator (HMG staff only)

1. Unzip `tutoring-connect-generator.zip`.
2. Serve the folder (any static server, e.g. `python3 -m http.server 8080`). Open `index.html` — you should see **Open Authorized Builder**, not “Sign in to portal”.
3. Open `builder.html` and walk the 6 steps:
   - **Studio** — name, short name, student-ID prefix, motto, timezone (`Africa/Lagos` default), currency (`₦` default), phone, email, logo **URL** (Drive or https — never an upload), site URL, social links, and license model.
   - **Branding** — pick from **50 professional themes**, **50 Google-font pairs**, and an optional custom palette.
   - **Layout** — choose from **20 layouts** (sidebar, topnav, compact, academy, magazine, executive, kanban, etc.).
   - **Structure** — subjects/exam boards (comma-separated).
   - **Modules** — tick every module the studio needs (120+ available). Presets: Solo, Studio, Exam-prep, Everything.
   - **Generate** — optionally paste Supabase URL + anon key now (or later in `assets/js/config.js`), choose **Traditional** (static) or **Modern** (static + Next.js wrapper), then click **Generate & Download ZIP**.
4. The downloaded ZIP is a **client** site: `site-index.html` becomes `index.html`, `config.js`/`manifest.json`/`robots.txt`/`sitemap.xml` are stamped with the studio's brand, and the builder/generator/wizard files are **excluded** so HMG internals never ship to parents.
5. Hand that ZIP to the studio and follow section A.

### Modern (Next.js) output
Choosing **Modern** adds a `modern/` folder to the ZIP: a Next.js 14 wrapper that serves the static portal and includes a serverless `/api/keepalive` route. The generator **mirrors the root portal files into `modern/public/` automatically** — there is nothing to copy by hand. To use it: `cd modern && npm install`, then `npm run dev` / `npm run build`; deploy `modern/` to Vercel. The database and `config.js` stay identical to the traditional build.

---

## C. Roles and family safety

| Role | Sees |
|---|---|
| Admin / owner / director / lead tutor | Everything, including Access Manager on the dashboard |
| Tutor / staff | Teaching modules; not payroll/finance/safeguarding unless granted |
| Parent | Only mapped children: classes, scores, invoices, inbox |
| Learner / student | Only themselves. Sit quizzes with **student ID** `TC-0001` |

Siblings and groups **do not** share scores. Group forum exists only on **group** engagements.

---

## D. SEO and discoverability

Every generated client site is built to be indexed by Google, Bing and other search engines:

1. `robots.txt` allows the public pages (`/`, `/about.html`, `/apply.html`, `/contact.html`, `/feature-guide.html`, `/exam-register.html`, `/public-book.html`, HMG pages) and disallows private ones (`/dashboard.html`, `/admin-data.html`, `/settings.html`, `/finance.html`, etc.).
2. `sitemap.xml` lists every public URL with absolute paths, last-modified dates and priorities.
3. Each public page has `<title>`, meta description, canonical URL, Open Graph and Twitter Card tags, plus JSON-LD `EducationalOrganization` / `SoftwareApplication` structured data that points at **both** the client studio and HMG Technologies / HMG Concepts.
4. Submit `https://yourstudio.example/sitemap.xml` to Google Search Console and Bing Webmaster Tools after going live.
5. The studio name, motto and social links set in the builder (or in `assets/js/config.js`) flow into every meta tag automatically.

## E. What “done” looks like

- Parent opens the live URL and sees the studio name and **Sign in to portal**.
- Anonymous visitors who try to open a protected page are redirected to `login.html` — no data is exposed without sign-in.
- After sign-in they see next classes with **date, time, duration** from the 4-cycle booking.
- A graded quiz sat with `TC-0001` appears on the scoresheet without anyone typing a name.
- Platform Health heartbeat increments.
- The install banner appears and the PWA can be added to the home screen.
- Footer, meta tags and JSON-LD point at the **client site and** hmgconcepts / hmgtechnologies / cssadewale.
- Google Search Console confirms the sitemap is discovered and public pages are indexed.

If any of those fail, do not call the studio “live”.

## F. First-admin promotion (important)

The first user who requests access starts as `pending`. To make them the studio owner:

1. After they submit “Request access”, open Supabase → Table Editor → `profiles`.
2. Find their row. Set `role` to `admin` (or `owner`) and `status` to `approved`.
3. They can now sign in and see the full platform, including the Access Manager on the dashboard.
4. All subsequent approvals are done from **Approvals** in the portal.

---

## V31 one-shot schema (self-contained)

You only need **one** SQL file for a new studio:

1. Open your Supabase project → **SQL Editor**.
2. Paste the entire contents of `database/complete-schema.sql`.
3. Click **Run**.
4. Confirm the last rows show something like:
   - `Tutoring Connect V31 installed …`
   - `install_check` → schema complete / OK
5. You do **not** need to run `v2`…`v30` files separately — they are already folded into `complete-schema.sql`.
6. If an older project failed mid-install with `learner_id` or `foreach` errors, you may also run the small hotfix files once:
   - `database/v30-group-insights-rls-hotfix.sql`
   - then re-run `complete-schema.sql` (it is idempotent: `if not exists` / `create or replace`).

### After SQL

1. **Authentication → URL configuration**: add your site URL and `https://your-domain/login.html` redirect.
2. Paste **Project URL** + **anon public key** into `assets/js/config.js` (or regenerate the client ZIP from the builder with keys filled in).
3. Host the static folder on Vercel / Netlify / Cloudflare Pages / GitHub Pages.
4. Open `login.html` → **Request access** with your email.
5. In SQL Editor promote yourself:

```sql
select id, email, full_name, role, status from public.profiles order by created_at desc;
update public.profiles
   set role = 'admin', status = 'approved'
 where id = 'YOUR-USER-UUID';
insert into public.practice_settings(id, name, motto, timezone, currency)
values (1, 'YOUR STUDIO NAME', 'Independent progress. Visible to parents.', 'Africa/Lagos', '₦')
on conflict (id) do update set name = excluded.name;
```

6. Sign out and back in. Open **Platform Health** — heartbeat should turn green after the keep-alive layers run.
7. Optional: connect Google Drive Client ID under **Admin Data** for sealed backups.
8. Optional: enable the GitHub Actions workflows in `.github/workflows/` (keep-alive + backup) with Supabase secrets.

### Product law reminders (free stack)

- No AI API required (Page Help + Studio Assistant are rules/KB only).
- No file uploads into free Supabase — use Drive / https / YouTube links.
- One Supabase project per studio; RLS is the real security boundary.
- Messaging via `wa.me` / `mailto:` / `sms:`.

---

## V32 — Fix RLS infinite recursion (parents / parent_learner)

If the live portal shows:

> infinite recursion detected in policy for relation "parents"
> infinite recursion detected in policy for relation "parent_learner"

on **Parents**, **Parent–Child links**, **Payments**, **Invoices**, **Payment plans**,
**Progress reports**, **Predicted grades**, or **Value-added**, run this **once** in the
Supabase SQL Editor (even if you already ran complete-schema earlier):

1. Open `database/v32-rls-recursion-hard-break.sql`
2. Paste into SQL Editor → **Run**
3. Confirm: `V32 RLS recursion hard-break installed`
4. Hard-refresh the portal and reopen those pages

**New installs:** `database/complete-schema.sql` already includes V32 at the end.
You only need the one file.

**Also fixed in complete-schema:** `jsonb_agg(x …)` functions now alias the
subquery column as `x` (class registration link RPCs), which previously raised
`ERROR 42703: column "x" does not exist`.

---

## V40 — branding every generated page (generator)

The generator now runs the studio name through **every** ported page, not just the
Classroom Deck. Before this, `site-index.html` (used as the client homepage) was
copied verbatim, so `<title>`, meta description, keywords, `og:title`,
`og:site_name` and `twitter:title` all said **ADEWALE CLASSROOM** no matter what
studio you generated — wrong search title and wrong social-share card on any
non-ADEWALE studio. Now `Generator.brandHtml()` substitutes the studio name into
the static SEO tags and all `data-practice-name` text of every page. No re-work
on your side: just generate a fresh ZIP.

The generator also now **bundles every Class Deck asset** the deck pages reference
(`assets/hmg-academy-logo.png`, `assets/founder-photo.jpg`,
`assets/icon-master.png`) and **`classdeck/js/generator.js`**, so a generated deck
no longer shows a broken logo, a broken founder photograph, or a `generate.html`
that cannot load its engine.

## V42 — deterministic function grants (security hardening)

`complete-schema.sql` now ends with **V42** (`database/v42-enterprise-hardening.sql`).
It re-asserts, after every other pack, that `authenticated` can `EXECUTE` the
public functions and that `anon` can `EXECUTE` only the curated public surface
(forms, CBT code gate, blog, free classes, exam registration, self-booking,
licence and the RLS predicates anonymous reads evaluate). It is **additive only**
(no revokes), so it can never lock out a path that already worked; it only
removes the historical non-determinism of five stacked grant/revoke sweeps.
Run the one `complete-schema.sql` on a fresh project and the version notice reads
**V42**.

If you already ran the schema before V42, you can run
`database/v42-enterprise-hardening.sql` once on the existing project to apply the
consolidated grants.

## V43 — class cohorts, per-class library and the enterprise blog (round 5)

`complete-schema.sql` now ends with **V43**
(`database/v43-engagement-cohorts-library-blog.sql`). It adds:

- **Roster helpers** — `tc_roster_bulk` / `tc_roster_view` on the existing
  `engagement_members` table (teacher-owned: another tutor's class returns
  `not_your_engagement`), powering the roster console on the Engagements
  and Groups pages.
- **Per-class library + e-resources + physical homework** —
  `library_items`, `eresources` and `assignments` gain `engagement_id`
  scoping with author stamps (`tc_stamp_library_author`), so students only
  ever see their own class's shelf and only the owner can edit items.
- **`tc_my_work`** — one RPC that returns a learner's classes, homework
  (physical or online), quizzes, reading, class library and next class;
  the student/parent dashboards render it as the "My Work" board.
- **Enterprise blog layer** — `tc_blog_subscribers`, `tc_blog_reactions`,
  `tc_blog_comments` tables plus `tc_blog_list/get/react/comment_add/
  subscribe/stats/my_posts` functions: reading time, reactions, comments
  with moderation, newsletter, tag filters, scheduling and pinning.

Run the one `complete-schema.sql` on a fresh project and the version notice
reads **V43**. On an existing project, run
`database/v43-engagement-cohorts-library-blog.sql` once (it is idempotent —
`create … if not exists` / `create or replace` throughout).

**Round-5/6 front-end notes:** every platform page loads `?v=44`; the
ClassDeck pages load `?v=47` (v13: TCP/TLS relay entries for hotspot Wi-Fi
students, adaptive retry, student-page chip fix. v13.1: the device
remembers the route that worked — hotspot students join first-try on every
later class. v13.2: the dead OpenRelay TURN entries are removed, Cloudflare
port-53 URLs are filtered, expired relays are skipped, and Cloudflare
credentials renew themselves — the teacher's 2-minute relay setup is
strictly one-time. The fixed top chip is gone: an inline studio link on
topbar pages, a bottom-corner pill elsewhere, nothing on student pages). The blog
(`assets/js/blog.js` V44) is white-label — it reads the practice name from
`[data-practice-name]`, so the same file serves both products.

## V44 — real two-way messaging + ClassDeck v14.0.0 (round 8)

`complete-schema.sql` now ends with **V44**. On an existing project, run
`database/v44-messaging.sql` once (idempotent — `add column if not
exists` / `create or replace` throughout). It adds real person-to-person
message threads: `messages.recipient/sender_name/read_at`, five
security-definer RPCs (`tc_message_directory/send/threads/thread/unread`),
role-scoped routing (families → tutors/admins; tutors → staff + their own
classes' families; admins → everyone), read receipts and automatic
notification rows.

Platform pages now load `?v=45` (shell cache `tc-shell-v13-20261004`,
nav V26 — **Messages is available to every signed-in role** and shows an
unread badge). New front-end files: `assets/js/messages-center.js`;
rebuilt: `messages.html`, `notifications.js`, `app.js` (work-board to-do
bar), `cbt-marking.js` (comment bank).

The ClassDeck ships **v13.2 → v14.0.0** (pages `?v=48`, sw
`hmg-classdeck-v14.0.0-cohost-scrolling-boards-pdf-nav`):

- **Assistant tutors** — 👑 on any admitted student; promoted peers can
  admit the waiting room, mute all, lower hands, kick and lock; the
  teacher verifies every action server-of-truth-wise (TeacherRoom only
  honours promoted peers).
- **Whole-class moderation** — mute-all, lower-all-hands, and an
  upgraded attendance CSV (null-safe, Excel-friendly CRLF).
- **Scrollable whiteboard pages** — every board page is 3 screens tall
  (1–8): wheel scrolls, ctrl/⌘+wheel zooms at the cursor, middle-mouse
  pans, draggable overlay scrollbars; PNG/PDF export captures the whole
  page. Old boards open unchanged.
- **PDF navigation** — safe centring (zoomed pages scroll edge-to-edge),
  always-visible scrollbars, zoom anchored to the viewport centre across
  buttons/pinch/ctrl-wheel, keyboard scrolling.


## V45 — platform-health layer matrix + advanced CBT (round 9)

`complete-schema.sql` now ends with **V45 + the V45b fleet bridge**. On an
existing project, run `database/v45-health-cbt.sql` once (idempotent). It
adds:

- `tc_keepalive_layers()` — the health RPC behind the Platform Health
  keep-alive layer matrix (per-source ledger + heartbeat in one call).
- `trg_cbt_assignment_sync` — publishing a **Graded** CBT to an engagement
  automatically files a homework row (`kind='cbt'`, `cbt_exam_id`), so it
  appears on the assignment page and every learner work board instantly.
- `tc_my_quizzes(p_learner_id?)` — the dedicated learner/parent page feed
  (graded vs practice, windows, attempts, best/last score).
- `tc_cbt_cumulative(p_learner_id, p_from, p_to)` — per-subject CBT
  averages over a period, consumed by the **🧮 Pull CBT marks** action on
  every progress report.
- `tc_absentee_followup` (table + RPC) — the attendance care list.
- `assignments.kind/cbt_exam_id`, `complaints.anonymous/submitted_by/
  category` columns.

Platform pages stay at `?v=45` but the shell cache bumps to
`tc-shell-v14-20261007` (nav **V27** — new **My quizzes** page for every
signed-in role). New front-end files: `assets/js/keepalive-layers.js`,
`assets/js/my-quizzes.js`, `assets/js/activity-log.js`. Rebuilt:
`platform-health.html` (keep-alive layer matrix card), `cbt-exam.html`
(negative marking + draft autosave/resume + JAMB shortcuts + submission
receipts), `cbt-multi.html` (combine published papers + negative marking),
`practice.html` (negative marking), `complaints.html` (anonymous suggestion
box), `attendance.html` (care list), `activity-log.html` (audit console with
filters + CSV export), `my-children.html` (per-child quizzes link),
`crud.js`, `desk-kit.js`, `app.js`, `cbt.js`.

**IMPORTANT — workflows:** the three files under `.github/workflows/` are
part of this release. The keep-alive workflows now ping through
`tc_keep_alive` (honest per-source ledger), `db-backup.yml` gained a
soft-fail `keepalive-heartbeat` job, and the `sc_keep_alive` fleet shim is
re-declared (V45b) to ALSO upsert the ledger, so legacy fleet pings show in
the matrix. Deploy the workflows or the layer matrix will report the
workflows as stale.

**QA:** 14 suites, 469/469 per repo × 2 repos (365 round-8 baseline +
88 round-9 + 16 schema-safety). Round-9 traceability: `PROMPT_AUDIT.md`
(round 9 section + round-9 field fix).

## V45 field fix — running complete-schema.sql on an EXISTING project

A field report showed `ERROR: 42703: column "recipient" does not exist`
when applying complete-schema.sql to a live project: `create table if not
exists` skips on existing databases, and the messages indexes referenced
V44 columns before the ALTER that adds them ran. That whole bug class is
now closed — see PROMPT_AUDIT.md "ROUND 9 FIELD FIX" for the four fixes
(messages guard, cbt_results/marking-queue guard, 201 drop-policy guards,
v45 self-sufficiency) and the tooling that locks it:

- `python3 tools/check_schema_order.py` — fails if any index, policy,
  SQL-function body or view references a version-added column before its
  ALTER runs. Part of the QA battery.
- `bash tools/verify_schema_pg.sh` — optional, needs a local PostgreSQL:
  replays the real schema against fresh, worst-case-legacy, re-run and
  standalone-migration databases (all must report 0 errors; skips with
  exit 77 where pg is absent).

**Action for existing projects: re-run the new complete-schema.sql from
the top.** It is upgrade-safe and idempotent — no cleanup of a previous
half-applied run is needed.


## V46 — laptop mic fix, CBT console, role-aware homework (round 10)

On an existing project run `database/v46-cbt-automation.sql` once
(idempotent). It upgrades the CBT→assignment trigger to a full lifecycle
sync (publish/rename/archive/restore/delete all keep the homework mirror
truthful, with a one-click sit link) and enriches `tc_my_work` with the
windows/multi-subject/negative-marking fields the new learner homework
page arranges papers by.

Front-of-house: the **Quizzes** page gains the GOSA-parity CBT console
(filters, sort, papers grouped by nature, 🗃️ Archive Recovery Center with
restore/undo/export/import). The **Homework** page is role-aware —
learners and parents see homework and CBT papers together (Due next / by
nature / marked), staff keep the workbench. **My quizzes** becomes a
family-only nav item (nav V28). The **ClassDeck** ships v14.1.0 with
MicDoctor: a constraint ladder that ends the laptop mic failures
(channelCount:1 exact-constraint rejections), insecure-context detection,
and a silence watchdog with a Fix-mic banner for hardware-muted mics.

Assets: portal pages `?v=46` (shell cache `tc-shell-v15-20261008`),
deck pages `?v=49` (sw `hmg-classdeck-v14.1.0-micdoctor-cbt-console-homework`).
QA: 16 suites, 564/564 per repo × 2 repos; PostgreSQL harness 5/5 scenarios
(including V46 behavioral assertions).


## V47 — cloud credentials, Drive backup fix, streaming hardening (round 11)

On an existing project run `database/v47-cloud-credentials.sql` once
(idempotent). It creates `school_settings` (fixes the Google Drive backup
card's "A table is missing" error — and pre-seeds the school's OAuth
Client ID) and `user_settings`, the owner-only roaming store behind
credential sync: sign in to the portal on any device and ClassDeck pulls
the TURN key, relay credentials and streaming destinations automatically.

Also in this round: students and parents can message tutors and admins
again (the round-9 V27 RBAC sweep had wrongly denied the messages page to
families — now FAMILY_WRITE), the Quizzes page renders the CBT console
(round-10 shipped it with a render() crash that left the page blank —
fixed and now covered by a runtime smoke suite), and social streaming is
reworked end-to-end: platform presets (paste only the key), preflight
validation, timeouts on every relay call, auto-reconnect with backoff, a
live clock, an fps selector, and cloud sync of the gateway and keys.

Assets: portal pages `?v=47` (shell cache `tc-shell-v16-20261008`),
deck pages `?v=50` (sw `hmg-classdeck-v14.2.0-cloudcreds-streamkit`).
QA: 19 suites, 666/666 per repo × 2 repos; PostgreSQL harness 6/6
scenarios (V47 behavior exercised as the authenticated role).


## V48 — airtight credential roaming, smart stream paste, bell deep links, WhatsApp chat (round 12)

Run `database/v48-notification-links.sql` once on existing projects
(idempotent; complete-schema.sql already carries it for fresh installs).
Message and CBT notifications now carry a destination, so clicking them
in the bell opens the right page — and legacy notifications were
backfilled so they are clickable too.

ClassDeck v14.3.0 makes credential roaming airtight: the portal endpoint
is baked into js/config.js (roaming now also works when the deck is
deployed on its own domain), credentials saved before the V47 update are
auto-published to the cloud on the next studio open, a missing
user_settings table is diagnosed with the exact migration to run, and the
deck login itself links the portal account when the email+password match
(a ☁️ Cloud sync card in Settings shows status, Sync now and Unlink).
Streaming gains a ⚡ smart-paste box (paste a key, a full RTMP URL, or
dashboard text — the platform/server/key are worked out for you) plus
key-shape warnings and a one-press Save-and-sync. The portal chat is now
a WhatsApp replica: bubbles with tails, in-bubble timestamps, ✓/✓✓ read
ticks, date separators, emoji bar, Enter-to-send, phone slide layout.

Assets: portal pages `?v=48` (shell cache `tc-shell-v17-20261008`), deck
pages `?v=51` (sw `hmg-classdeck-v14.3.0-cloudsync-smartpaste-notiflinks`).
QA: 21 suites, 739/739 per repo × 2 repos; PostgreSQL harness 7/7
scenarios; complete-schema containment mechanically verified.

## V49 — family library access, honest link labels, clearable notifications, GOSA toolbars (round 13)

Run `database/v49-family-library-access.sql` once on existing projects
(idempotent; complete-schema.sql already carries it for fresh installs).

**The class shelves reach their families.** LMS lessons and the resource
library had no family read policy at all, so assigned students never saw
them; now every shelf (e-resources, digital library, LMS, resources) is
readable by the students of the class it is scoped to — and their parents
(GOSA parity: parents study with their children). Published LMS lessons
only; drafts stay staff-only. The learner dashboard work board gained a
**Mini LMS — my lessons** section and merges e-resources + resource-library
items into the Class library shelf (the `tc_my_work` RPC feeds them now).

**"Unlinked" was a lie — the rows were linked.** The class-name lookup
failed for staff accounts whose profile status is NULL (created before the
approval workflow); `is_tutor()` now treats NULL as approved. The CRUD
engine also stopped guessing: a ref id it cannot resolve shows
"linked · name unavailable" (with the raw id in the tooltip), a ref table
the role cannot read raises a visible warning banner instead of silent
blanks, the Add/Edit form keeps the current value instead of blanking it,
and `refresh()` re-pulls the link names.

**Notifications clear, and they announce themselves.** Your own
notifications delete; shared broadcasts hide for you only (`notif_clear()`
+ `cleared_by` — another user's bell is untouched). Every bell item and
every notification-centre entry has a ✕, both views have Clear all, and
the bell dropdown **opens by itself** the moment a notification the device
has never seen arrives (realtime or the 30s poll). Devices re-register for
push after install/sign-in.

**Reading links work for students.** reading_items were staff-only, so a
student opening a reading assignment saw nothing to click; the items now
render as Open ↗ links with a **✓ I read this** tick that saves to the
database, and parents see the same cards read-only.

**Pages made unambiguous.** The four shelf pages get the GOSA pattern:
collapsible "What is this page?" card + toolbar (Add new / Refresh /
Export CSV / Export PDF / Import CSV with header-matching and ref-name
resolution). classwork.html gains KPI chips (due this week / overdue /
comment-only / materials), filters (search, class, kind, due-this-week),
kind icons, colour-coded due badges, skills chips and Export CSV/PDF.
stream.html (portal) sheds its wrong governance intro for real comms
guidance, hides scheduled posts from families, and gates posting to staff.
documents.html roles corrected. 19 pages had copy-pasted governance
boilerplate — all now describe their actual purpose.

**admin-data "Tables readable / Rows in total" showing "–"** was the stat
cards waiting for a manual scan: they now fill themselves on load (cheap
head-count, no rows transferred) and read "x / total" with skipped tables
named. The table list also grew the tables later updates added (lms,
reading, user_settings, push_subscriptions, stream_posts, gallery).

**ClassDeck v14.4.0 — restore buttons.** Signing in already pulled the
TURN/streaming credentials automatically; now the login says so with a
toast, and two **☁️ Restore** buttons (Tablet Live panel + the TURN card)
pull credentials on demand. `classdeck/stream.html` gained an
every-field-explained guide with copy-paste examples (gateway URL, secret,
stream name, format, fps, destinations, smart paste, remember, start).

Assets: portal pages `?v=49` (shell cache `tc-shell-v18-20261008`), deck
pages `?v=52` (sw `hmg-classdeck-v14.4.0-restore-family-library-gosa`,
version.json 14.4.0 build 18). QA: 22 suites, 829/829 per repo × 2 repos;
PostgreSQL harness 8/8 scenarios (V49 behavior: cross-class isolation,
draft-hiding, parent parity, reading ticks, clear semantics, work-board
shelves).

## V50 — staff access truth, publish-by-default LMS, TURN-key roaming (round 14)

Run `database/v50-staff-access-truth.sql` once on existing projects
(idempotent; complete-schema.sql already carries it for fresh installs).

**Why: the round-14 field report.** `profiles.status` defaults to
'pending' — not NULL — so round 13's NULL-only fix matched nothing. An
owner (or admin) whose profile sat at the signup default failed every
staff gate: the engagements read policy returned zero rows silently, every
shelf page showed "linked · name unavailable", and the admin-data head
count starved to "–" — while writes kept working, because the write
policies accept `is_admin()`.

**Manager roles are never status-gated.** `is_tutor()` v2 returns true
for owner/admin/director/super_admin/lead_tutor regardless of status
(there is no one above an owner to approve them — gating them on their
own un-approval is a deadlock). Operational roles (tutor, staff, teacher,
instructor) pass on NULL/blank/approved/active; 'pending' and 'suspended'
still require approval, so the approvals workflow keeps its meaning.
`tc_is_manager()` follows the same rule, and `engagements_read` now also
accepts `is_admin()` (write and read are finally symmetric).

**`tc_ref_labels(p_table)` — the link-name fallback.** A security-definer
RPC returning id→label maps for engagements / subjects / tutors / learners
/ parents, granted to authenticated staff only (learners get `{}`). The
CRUD engine calls it automatically whenever a ref table reads back empty,
so link names survive even a future policy regression; if names still
cannot load, the shelf pages show an honest amber note with a ↻ Retry
button instead of a silent "name unavailable".

**New LMS lessons are visible by default.** The old table default and the
old form order both said 'draft' — and drafts are invisible to families —
so every freshly added lesson silently never reached its class. The
default is now 'published' (database and form), the staff list renders
🟢 published / 🟡 draft·hidden badges, and every row carries one-click
🚀 Publish / 🐢 Unpublish actions. Existing rows are untouched — publish
them from the list.

**ClassDeck 14.5.0 — the TURN key follows the login.** Opening Settings on
a device with no saved key now pulls the key from the linked cloud account
automatically (never overwriting unsaved edits), a ☁️ Restore-key button
sits inside the TURN-key card itself, and stream.html was rebuilt for the
first-time user: 3-things orientation, mistake-per-field guide, platform
click-paths, troubleshooting table, persisted first-run checklist.

**Admin-data counts refuse to fail silently.** The head count shows a
signed-out state, live progress, a clickable recount, an automatic retry,
and — if signed in but nothing is readable — a diagnosis that names the
cause and the exact migration file to run.

## V51 — family link names, library quiz, homework points, cloud last-backup (round 15)

Run `database/v51-family-ref-labels-library-quiz.sql` once on existing
projects (idempotent; complete-schema.sql already carries it for fresh
installs — and tools/audit_selfcontained.py now PROVES the complete
schema carries every object of every migration file, so one run of
complete-schema.sql is all a fresh install needs).

**Student-portal link names (items 2–5).** `tc_ref_labels()` is now
role-aware: learners get the id→name map of the engagements they are
members of, parents get their children's — the same visibility predicate
that governs the shelf rows themselves, so a class name resolves exactly
when the row that references it is visible. The four shelf pages are
also role-aware now: learners and parents get a studying view (cards,
search, filters, working links, due chips) instead of the staff table.

**Digital library with comprehension quizzes (GOSA parity).** Readings
carry optional auto-marked questions (mcq, multiple response,
true/false, short answer, keyword; answers typed as letters or positions
mark correctly), an attempt limit, a due date, a max score and an
optional linked CBT code. Attempts are recorded per learner
(library_quiz_attempts: own-insert only, RLS-refused otherwise). The 🏅
points workbench aggregates best attempts per learner per reading
(linked-CBT best attempts merged) and pushes the totals into the
scoresheet as continuous-assessment evidence (source `library_points`).

**Homework points workbench (GOSA parity).** ✍️ Score class on any
homework row opens the class scoring sheet — auto-filled from CBT
results for CBT assignments (scaled to the assignment's max), manual for
physical work — and writes per-learner rows. The term score sheet shows
every assignment as a column with cumulative totals per learner; 🚀
pushes the totals into the scoresheet (source `homework_points`); CSV
export included. Students get a plain-language explainer of how homework
earns points, with their live total.

**"Last backup" is a studio record now.** practice_settings.last_backup_at
is stamped by every backup path (local download, Google Drive) and read
by every device — the card shows the newest record with its source and
age instead of a per-device localStorage guess.

**ClassDeck 14.6.0 — the TURN key actually reaches the cloud.** Settings
→ Save now persists the TURN Token ID / API token boxes AND pushes them
to the linked account immediately (round 15 found the save handler had
never read them — a hand-typed key never left the device, which is why
every other device said "nothing saved there yet"). The cloud-sync card
shows what the account actually holds, "last sync" only counts when data
moved, and the Tablet Live modal documents every field with examples
and ✅/❌ guidance.

## V52 — timezone truth, empty-ref race, TURN-sync truth, last-backup truth (round 16)

**One database step:** run `database/complete-schema.sql` (all-inclusive —
887 objects, nothing else needed). On an existing V51 project you may run
`database/v52-timezone-truth.sql` alone instead: it installs
`tc_my_tz()` (the viewer's home+own zone in one security-definer call),
`tc_last_backup()` (the studio-wide backup truth for any authenticated
member) and the `practice_settings.backup_path` column, then reloads
PostgREST.

**Every schedule time now shows BOTH zones.** The new `assets/js/tz.js`
engine + `tc_my_tz()` render schedule datetimes — sessions, bookings,
dashboard Next-class, homework CBT opens/closes, the LMS/library/
resources/e-resources tables — as 🏠 studio time · 👤 viewer time with
the ±Nh delta, but ONLY when the two zones actually differ (a
Lagos–Lagos pair sees the familiar single time). Record each
international student's, tutor's and parent's zone once on the
**Timezone desk** (timezones.html) — it also hosts the meeting planner
(one moment shown in every studio zone, with 🟢/🔴 working-hours flags,
blackout notes and a copy-ready dual-time line) and live 1-second world
clocks. Zones resolve: desk entry → role-table column → browser zone;
pre-V52 databases degrade gracefully.

**The "🔗 Link names are not loading" banner family is closed at the
root.** The cause was never RLS: crud.js cached the EMPTY engagements
map when the first read raced the session restore (RLS-as-anon returns
0 rows, not an error). Reads are now session-gated, empties consult the
tc_ref_labels RPC, empty maps are never cached, a 2.5s self-healing
repaint recovers, and any auth-state change purges the caches. The five
role-split pages (LMS, library, resources, e-resources, homework) now
decide with `App.detectRole()` — up to 10s, then the tc_current_role
RPC, then the cached profile — so a slow session restore can no longer
drop a learner onto the staff table. Read-only viewers see "🎓 your
class" / "linked ✓" cells and no ref banners at all; the student shelf
gained a class filter.

**ClassDeck 14.7.0 — saved on A, actually restored on B.** The round-16
autopsy found push() uploaded user_id NULL whenever it was the session's
first cloud call (the uid was resolved lazily, after the row was built)
— RLS refused it and the failure was silent, so device A believed the
key was saved while the account stayed empty. push() now resolves the
token+uid first (JWT-sub fallback included), Generate/Save AWAIT their
pushes and toast failures with the remedy, pull() recognises credential
rows by name OR data shape (any legacy label still restores), and
**Sync now** is a real two-way sync: it pushes channels the cloud lacks
or holds differently, then pulls — "last sync" and "Account holds"
update the moment a push lands.

**"Last backup" can no longer say "never" on the wrong device.** The
card is session-gated, reads the studio truth through tc_last_backup()
(any authenticated member), re-renders on every auth change and after
every backup path, and merges local + studio + Drive timestamps (newest
wins, tooltip names the source). Backup paths also record WHERE the
newest archive lives (`backup_path`: device filename or Drive file
name).

**Verify after deploying:** `bash tools/verify_schema_pg.sh` (11
scenarios), `python3 tools/audit_selfcontained.py`, then the QA battery
(25 suites, 1110 checks per repo). Versions: portal `?v=52` / sw
`tc-shell-v21-20261010`; deck `?v=55` / `hmg-classdeck-v14.7.0-turnsync-truth`
/ version.json 14.7.0 build 21.

## V53 — credential truth, backup stamp, tutor isolation, staff monitors (round 17)

**Run it:** `psql "$DATABASE_URL" -f database/v53-credential-truth-staff-monitor.sql`
(all statements are idempotent — `create or replace`, `drop policy if
exists` + `create policy`, `add column if not exists`). An
**upgrade-order guard** at the top re-creates `tc_my_tutor_id`,
`tc_is_manager`, `tc_teaches_engagement` and guarantees the
`tutor_id` columns on `sessions`, `library_items` and `eresources`, so
the pack also applies cleanly to a pre-V53 standalone database.

**Why it exists — three silent lies, closed at the server:**

1. **Credential writes now go through security-definer RPCs.** The deck
   used a REST upsert to `user_settings`; when that failed (RLS, missing
   table, NULL user) the caller saw a generic error and the credential
   silently never reached the account — which is exactly why device B
   said "nothing saved yet" after device A "saved". `tc_set_user_setting
   (p_key, p_value)` upserts `on conflict (user_id, key)` scoped to
   `auth.uid()`, and `tc_get_user_settings()` returns **only the
   caller's rows** — a learner can never read a tutor's TURN key, and
   vice versa. Both are granted to `authenticated` only, revoked from
   `anon`/`public`. The client (`cloud-creds.js`) writes RPC-first,
   reads RPC-first with a table-GET fallback for pre-V53 databases, and
   surfaces the **real error body** (`message` + `hint`) on failure —
   "unknown" errors are gone. Cloud/local comparison now canonicalises
   JSON (deep-sorted keys) before diffing, so jsonb key ORDER can no
   longer make "synced - credentials current" a lie.
2. **The backup stamp is a manager RPC.** `tc_stamp_backup(p_path)`
   (security definer, `tc_is_manager`-guarded, upserts
   `practice_settings` id 1 with an insert fallback) records
   `last_backup_at = now()` and `backup_path`. Both the sealed-download
   path and the Drive path call it RPC-first (plain UPDATE fallback),
   so "Last Backup: never" after a successful backup cannot happen; if
   the stamp itself fails, the admin sees the failure text, not a
   silent nothing.
3. **Tutor content isolation + the two 360° monitors.** Read policies on
   `library_items`, `eresources`, `resources` and `lms_lessons` scope a
   tutor to: rows they authored, rows on engagements they teach, and
   the studio-shared shelf (`engagement_id is null and tutor_id is
   null`). Family read access via `tc_family_reads_engagement` is
   preserved. `tc_tutor_monitor(p_tutor_id)` (manager-only) returns the
   complete audit as jsonb: profile, subjects taught, students taught,
   sessions taken, recent + upcoming sessions, bookings (completed /
   ongoing / earnings), topics covered, CBTs created, assignments set,
   library items authored, and **salary payment history** from payroll.
   `tc_parent_monitor(p_parent_id)` (manager-only) returns children
   with their classes and tutors, invoices, payment history and
   upcoming sessions. Both refuse non-managers at the server, and the
   admin UI (`assets/js/staff-monitor.js`, the 📊 Monitor row action on
   Tutors and Parents) renders them with honest empty states and
   visible error cards.

**Round-16/17 self-audit fixes shipped with this pack:** `TZ.workStatus`
compared two different clocks (08:00 counted as inside 09:00–17:00 —
fixed and now unit-proven for normal and past-midnight windows);
`crud.js` `openRecord`/`printList` dropped the fourth `viewerCanWrite`
argument so staff saw family-safe labels in the drawer and printouts;
the "Full backup & restore" buttons in **admin-data** referenced
`DataTools`, which was never defined — both buttons threw a silent
`ReferenceError` (defined now, wired to the real download + restore
readers). A new auditor, `tools/audit_handlers.py`, sweeps EVERY page
of both trees for dangling inline `onclick`/`onchange` references — the
DataTools class of bug — and runs green on the portal and the deck.

**Verify after deploying:** `bash tools/verify_schema_pg.sh` (**12**
scenarios — scenario 12 exercises the V53 RPC round-trip,
cross-account isolation, the backup stamp, tutor shelf isolation and
both monitors), `python3 tools/audit_selfcontained.py`, `python3
tools/audit_handlers.py`, then the QA battery (26 suites, 1181 checks
per repo). Versions: portal `?v=53` / sw `tc-shell-v22-20261010`; deck
`?v=56` / `hmg-classdeck-v14.8.0-turnsync-rpc` / version.json 14.8.0
build 22.

## V54 — verified credential sync, network-first pages, Drive backup progress (round 18)

**No database change in this round** — V53's RPCs remain the server
truth. This round is the client-side hardening that makes the sync
*provable*, plus the delivery fix that explains why fixed bugs seemed
to persist.

**⚠️ THE REDEPLOY NOTE — read this first.** The deck's service worker
used to serve the **cached page** on every visit and refresh only in
the background. That means the FIRST visit after any redeploy still ran
the PREVIOUS build — a fix that shipped could look unfixed until the
second visit. If the "unknown" sync error or "nothing saved yet"
reappeared after you deployed round 17, this is almost certainly what
happened. Round 18 makes pages **network-first** (the cache is only
the offline fallback), so from this build on every redeploy lands on
the very next visit. After deploying this build, refresh the deck page
**once** (or hard-refresh) to cross over, then check the sync card's
footer: it must say `cloud-creds v54-r18-verified-sync`.

**The verified-sync engine (`classdeck/js/cloud-creds.js`):**
- **A write only counts when the account verifiably holds it.** Every
  push (RPC or pre-V53 REST fallback) is followed by an immediate
  read-back of the account and a canonical comparison — "saved" now
  means *saved and verified*, structurally closing the "looked saved on
  device A while device B saw nothing" class whatever the server did.
- **Pushes are serialized per channel** (Save fires the relay push and
  the key push back-to-back) and the **token refresh is single-flight**
  — two parallel refreshes with the same refresh token are exactly what
  Supabase's rotation-reuse detection revokes the whole session for.
- **`state.reason` can never be empty on failure** — every path goes
  through `fail(stage, message)` carrying the HTTP status and the
  server's own error body; the round-16 "unknown" toast is dead.
- **The sync clock is persisted** (`cd-creds-sync-stamp`): "last
  verified sync" survives page reloads instead of resetting to "not
  yet", and the account-holds line always follows the last successful
  read (a credential cleared on another device stops showing ✓).
- **"Sync now" diffs against a FRESH read** (pull first, then push what
  really differs) — "credentials current" is a statement about the
  account, not a stale in-memory copy.
- **🔍 Diagnose button** on the sync card: walks the exact chain a real
  sync uses (session → endpoint → token → database read → verified
  write), stops at the first broken link and prints its exact remedy.
  With real local credentials the final step is a genuine verified
  re-push — the healing action for a half-migrated database.

**Google Drive backup — real progress before completion (user item
3):** the backup now reports a staged panel on admin-data (Authorise →
Collect *table i of n* → Upload with **byte-level progress** → Record →
done) — the upload switched from `fetch` to XHR because fetch cannot
report upload progress. The automatic background sync shows the same
truth as a floating pill, and restore/recovery report per-table import
progress too. The completion line carries rows, size and duration.

**Verify after deploying:** `bash tools/verify_schema_pg.sh` (12
scenarios — unchanged this round), `python3
tools/audit_selfcontained.py`, `python3 tools/audit_handlers.py`, then
the QA battery (27 suites, 1268 checks per repo — the round-18 suite
includes a behavioral test of the sync engine against a fake
PostgREST). Versions: portal `?v=54` on the changed admin-data assets /
sw `tc-shell-v23-20261010`; deck `?v=57` /
`hmg-classdeck-v15.0.0-r18-verified-sync-netfirst` / version.json
15.0.0 build 23.
