# Tutoring Connect — V25 audit and fix report

**Date:** 19 August 2026 · **Schema:** V24 → **V25** · **Repos updated:** `tutoringconnect` (generator), `adewaleclassroom` (generated client site), deliverable suite + ZIP.

**Verification before this document was written**

| Check | Result |
|---|---|
| `tools/test_runtime.js` | **1,325 assertions, 0 failures** |
| `tools/test_nav.js` (new) — generator + client | **61 + 61, 0 failures** |
| `tools/test_v25_render.js` (new) — generator + client | **90 + 90, 0 failures** |
| `tools/test_generator.js` | **ALL PASSED** — 233 files, 0 broken assets, 0 broken links |
| `tools/audit_integrity.py` | **0 disconnected references** (was 1) |
| `tools/audit_parity.py` | **0 pages behind School Connect** |
| `pglast` parse of `complete-schema.sql` | **OK** (7,900 lines) |
| Inline + external JS syntax (282 scripts) | **0 real failures** |

---

## The single most important thing to do first

Open the Supabase SQL editor and run **`database/complete-schema.sql`** once.

Almost everything below is inert until you do. The entry desks have no tables, the quiz Close button has no function to call, free-class registration has no RPC, and tutor scoping is not enforced. The file is safe to re-run as many times as you like.

**While you are there, one bug you should know about.** The file used to end with **three** schema-registry upserts — V24, then V22, then V20 — all writing to `id = 1` with `on conflict do update`. The last one won. So after running the file, your database reported it was on **V20** when it was actually on V24. Every tool that reads `tc_schema_registry` to decide whether you are up to date — including `audit_live.py` and the in-app schema doctor — was being told the wrong thing. There is now exactly one upsert and it is the last statement in the file.

---

## 1. Admin Data page

**What was actually wrong.** The entire body of the page was one sentence:

> *"Data portability engine loads with the page. Use the buttons it injects, or call DataPortability from the console."*

It does not load with the page. `data-portability.js` was never in that page's `<script>` list — you can verify this in the old file. No buttons were ever injected, so the placeholder text **was** the page, and the only documented route to a backup was the browser developer console. The page was non-functional, not merely thin.

**What it does now.** Four KPIs (tables readable, total rows, database MB against the 500 MB free-tier limit, last backup date), then:

- **Download full backup** — one JSON archive of every table this account can read, with a **SHA-256 checksum** printed on screen so you can prove later that the file has not been altered. Never leaves your device.
- **Scan what is in there** — a row count per table before you commit to a backup.
- **Anonymised export** — names, contacts, photos and dates of birth replaced with stable pseudonyms. The shape of the data survives; no individual can be identified.
- **Restore** — you are shown exactly what an archive contains, whether its checksum still matches, and how many rows will be written, **before** anything is written. A backup you have never restored is not a backup, so the restore path is on the same page as the export.
- **Export one table as CSV**, and peek at the first five rows.
- **Data-subject requests** — export everything held on a named person, or log an erasure/rectification request.
- Google Drive panel, and both `data-portability.js` and `drive-sync.js` are now actually loaded.

The quota panel called `tc_db_size()`, which does not exist — caught by `audit_integrity.py`. It now calls `tc_db_report()`, which does.

## 2. Settings

The page covered studio identity, timezone, currency, cancellation hours, idle lock and sibling discounts, and stopped. Eleven areas of the studio had **no configuration page at all**. Eight new cards, each saving independently:

- **Contact details & social links** — this is why the Contact page had nothing to display.
- **Booking cycles** — 4 cycles × 7 days, classes per cycle, lesson length, notice period, maximum group size. Your booking rule is a studio policy, not a law, so it now lives here rather than inside the booking engine.
- **Quiz & grading defaults** — including grade boundaries in one place, so the Scoresheet, Progress reports and Certificates cannot disagree with each other.
- **Certificate defaults** — the house style.
- **Notifications** — channels, reminder lead time, invoice chase days, and which events trigger a message.
- **Public pages & search** — headline promise, about text, search description, advertised subjects and boards.
- **Integrations** — Drive client ID and folder, default meeting room, public calendar.
- **Retention & safeguarding** — how long records are kept, who handles data requests, safeguarding lead, minimum age.

Plus **"Check the studio's configuration"**, which separates *this will actually break something* from *this is worth filling in*.

## 3, 5 & 7. The navigation pane — root cause and structural fix

These three reports are one bug seen from three angles, and I found the cause.

**Two independent systems were mutating the same 126 links.** `App.applyRoleNav()` decided using `data-role-allow` + `moduleAllowedForRole` + a localStorage override map, and set `display=''` on everything it allowed. `RBAC.apply()` decided using a completely different matrix, and only ever set `display='none'`. Neither knew the other existed. App ran on the cached session and again when Supabase resolved; RBAC ran on the `tc:role` event and again from a 500 ms poll. **Whichever fired last won** — so the same account, on the same page, genuinely saw a different menu depending on network timing. That is your "pages are either removed or added whenever the navigation pane is accessed".

**The public-page leak.** `App.currentRole` starts as the literal string `'guest'`. RBAC correctly refuses to act on an unknown role (acting on it was the V23 lockout). So between first paint and session resolution — longer on a public page, which often has no session call to wait on — **nothing** was filtering the pane and every visitor briefly saw all 126 administrator links.

**The scatter.** `ensureEssentialNav()` appended anything missing with `appendChild`, which puts it below the *last* section heading regardless of where it belongs; `normalizeNavOrder()` then re-sorted links in place on every call.

**The fix is structural, not another patch.** The menu is now described **once** in `assets/js/nav-model.js` (generated by `tools/build_nav_model.py`) and **rebuilt** from that description by `assets/js/nav.js`. A rebuild is idempotent: ten renders produce byte-identical markup, so the pane cannot drift, reorder, gain or lose an item. `RBAC.apply()` no longer touches the DOM — its matrix is still the authority, it is just consulted rather than being a second hand in the pane. The resolved role is cached, so the *first* paint of the next page is already correct. Before any role is known, only items marked public are drawn.

**23 KB of duplicated markup was removed from each of 130 pages.** `at-risk.html` went from 31 KB to 9.6 KB.

**Content defects found while auditing the old markup and fixed:**

- **Three separate items were all labelled "Learners"** — `learners.html`, `family-links.html` and `my-children.html`. Now "Learners", "Parent–child links" and "My children".
- **`cbt-review.html`, `site-index.html` and `flyer.html`** are real, reachable pages that appeared nowhere in the pane.
- **Every single item used the same "•" bullet.** All 131 now have an icon that means something.
- **Sections regrouped** by what a person is trying to do — 15 sections, from "🏠 My studio" to "❓ Help & information" — instead of "About the developer" sitting next to "Storage manager".
- Sections **fold away** and the choice is remembered; a heading is never shown with nothing under it.

**Measured result** (`tools/test_nav.js`, run against both repos): admin 131 links, tutor 119, parent 74, student 63; identical pane on a public page and a private page for the same role; byte-identical after 10 renders; no empty headings, no duplicate links, no dead targets.

One judgement call: **At-risk, Predicted grades and Value-added were moved out of family view.** They used to be family-readable when they were read-only analytics. They now carry staff entry desks holding internal working notes ("mother unreachable", "predicted a C, do not tell them yet"). Families still get the conclusion — a published value-added entry or predicted grade appears on the Progress report and Learner 360. Publication is now a deliberate act rather than a side effect.

## 4. HMG Digital Products

The page had a title, a description and **no products**. It now carries the full catalogue — School Connect, Tutoring Connect, HMG Academy CBT Pro, GOSA Portal, HMG Concepts, HMG Academy — each with what it does, who it is for, a live demo link and (for CBT Pro) the source repository. Filterable by organisation type, with a plain "which one fits?" comparison table and a "common to all of them" section.

## 6. Page descriptions

Root cause found: the descriptions are generated by `tools/build_page_guide.py`, and three things in it were producing the noise you saw.

- **The scraper collected every `<button>` on the page, including the shell.** So 116 of 128 descriptions ended with *"The main actions available here are: **Sign out**, **Theme**."* — true of every page, useless everywhere, and on the stub pages it was the only "actions" sentence, so the At-risk board announced that its main actions were signing out and changing the theme. Shell controls are now excluded, and if nothing page-specific remains the sentence is dropped rather than padded.
- **Role views were looked up by catalogue group, producing statements that were false.** The public About page — linked from every footer and deliberately indexed — told tutors, parents and learners *"No access."* Role views are now derived from the real access model, and every page shows a "What each role sees here" panel.
- **Related links were the first six alphabetical siblings.** That is how About came to recommend "activity-log, admin-data, approvals" to a prospective parent. They now come from the navigation model, which groups by intent.

Beyond the mechanical fixes, **34 pages got hand-written descriptions**, including all 23 that were one-liners (Activity log, Birthdays, Broadcasts, Complaints, Compliance, Directory, Feature guide, Finance, Flyer, Gamification, Help desk, HMG Ecosystem, Learner cards, Mini LMS, Parent conferences, Payroll, Platform health, Polls, Products, Referrals, Rubrics, Roles & status, Storage). A test now fails the build if any description drops below 200 characters or if the boilerplate reappears.

## 8. Free / outreach classes

A free student is **not** a client. Putting them in `learners` would put them into the fee ledger, the invoice run, the payroll calculation and the family statement — the first invoice run would either bill them or produce a zero-value invoice for every one of them. So they get their own tables and a deliberate one-way door.

**`free-classes.html`** (staff) — create a cohort with exam board, series, subjects, level and schedule; choose the platform (YouTube / Zoom / Google Meet / FreeConference / Teams); paste the meeting link, replay link, WhatsApp group and Telegram group. **Everything is a link, nothing is uploaded.** Then mint **one or more shareable registration links per cohort**, each with its own label, expiry and usage cap — give Instagram one and WhatsApp status another and you can see which actually works. Then work the roll: approve, record sessions attended and average score, and **Convert** a strong registrant into a real learner record with their whole free-class history attached.

**`free-register.html`** (public, indexed, no sign-in) — opened from the link. Shows what the class covers, when it runs and where, then collects name, contact, school, level, subjects and goal, with parent/guardian consent required for minors. Issues a registration number immediately and shows the joining links.

Security: the anon role has **no** table grants. Registration goes through `tc_free_register()`, a `SECURITY DEFINER` function that refuses a missing, inactive, expired or exhausted token, refuses a closed cohort, enforces capacity and consent, ignores every column the caller may not set, and returns the registration number. Numbers come from a PostgreSQL sequence, so two people registering in the same second cannot collide.

## 9, 12, 13, 14, 15, 16, 17, 18, 20. The nine stub pages

All nine had the same body: a description card and *"Use the related links and the ❓ Page Help button."* No form, no list, no table behind them. The original intent was that every figure would be derived — which is right for the arithmetic and wrong for the judgement.

One engine (`assets/js/desk-kit.js`), nine configurations. Every desk gets: an entry form with **every dropdown auto-filled from the database** (learners, engagements, tutors, subjects — never typed), plain-language validation, a live list with **Edit, Copy and Delete on every row**, sorting, filtering, CSV export, a print view, and a computed summary strip so the page still does the analysis it always promised.

| Page | Table | What it captures that could not be derived |
|---|---|---|
| **At-risk board** | `tc_at_risk_reviews` | The evidence, the action agreed, whether the parent was told, the review date, the outcome |
| **Practice analytics** | `tc_practice_analytics` | Practice done **off** the platform — past papers, worksheets, school-set work |
| **Value-added** | `tc_value_added` | The baseline **and its source** — which predates the platform |
| **Predicted grades** | `tc_predicted_grades` | Board, scale, prediction, confidence, and the required written basis |
| **Group insights** | `tc_group_insights` | Observations true of the whole set, which are simply wrong against a learner |
| **Insights Lab** | `tc_insight_notes` | The hypothesis, how you'll know it worked, and what actually happened |
| **Scoresheet** | `scoresheet` (extended) | Mocks, homework and paper-marked work |
| **Progress reports** | `tc_progress_reports` | The whole report — per-subject rows, comments, draft/published |
| **Timezone desk** | `tc_timezone_desk` | Each person's own working window, DST position and blackouts |

Two things are computed by PostgreSQL rather than typed, so a row can never contradict itself: **practice accuracy** (a generated column) and **scoresheet percentage** (a trigger). The engine strips generated columns before writing, or the write would be rejected.

Extras: Timezone desk shows **live clocks** using your browser's own IANA database, so DST is always right without anyone maintaining a table. Progress reports have repeating per-subject rows and a **printable report that carries a DRAFT watermark** until published. Analytics and Insights Lab **keep their existing charts** and gain a desk below them.

## 19. Certificates

I read `ref/schoolconnect/certificates.html` and reproduced what it actually does: the premium layout with mitred navy-and-gold corner wedges, double gold rule with offset outline, the "THIS IS TO CERTIFY THAT" foil ribbon, the radial-gradient rosette with two ribbon tails, crest, address, phone and motto — plus the classic/modern/elegant variants, the Drive-link signature rendered with `mix-blend-mode: multiply`, verification codes, and batch issue from CBT results.

Then four things the reference sites do **not** have:

1. **Six layouts, not four** — `minimal` for a weekly effort award that should not look like a degree, and `diploma` in landscape for end-of-programme awards.
2. **The design is stored with the award.** On the reference sites the design lives only in the form, so a certificate reprinted after a rebrand comes out in the new colours and no longer matches the copy the family already holds. Here the layout, colours, font, border, seal and signature are written onto the certificate row, and the reprint button uses the stored design.
3. **Reusable templates** (`tc_certificate_templates`) — set the house style once.
4. **Revocation with a reason.** Verification then reports it as revoked rather than the certificate silently vanishing.

Verification codes avoid O/0 and I/1 so they can be read over the phone, and `tc_verify_certificate()` works without signing in.

## 10. Contact

The page had a description and nothing else — no phone number, no WhatsApp button, no address, no hours, no form. For a tutoring studio the contact page is a sales page.

Now: studio details pulled from `practice_settings` (so changing your number in Settings updates this page), one-tap WhatsApp / Call / Email / Map, stated response times, and **teaching hours converted into the visitor's own time zone** — half your enquiries come from other countries and "6pm" without a zone is the commonest cause of a missed first class. The form writes into the studio **inbox** and returns a reference number, rather than opening a `mailto:` link that fails silently on most phones. Choosing a subject routes the message.

## 11. About the Developer

The page had no body at all, and its generated description told tutors, parents and learners they had *"No access"* to a page that is public and linked from every footer.

Now: HMG Technologies as the software arm of HMG Concepts (*His Marvellous Grace*, est. 2015); Adewale Samson Adeagbo, AI-Augmented Solutions Developer · Data Scientist · STEM Educator, Lagos; the honest technology statement (vanilla HTML/CSS/JS, Supabase, free-tier hosting, PWA, **no paid AI service anywhere**); a plain data-custody section (your own Supabase project, no uploads, exportable, RLS is the real boundary); both licensing models; and the ecosystem links. Every fact is taken from what the repository already publishes, so the page cannot contradict the rest of the site.

## 21. Tutor scoping

V24 introduced the helpers and applied them in two loops. **Auditing those loops against the tables that actually exist found that several of the names were wrong.** Each loop is guarded by `if exists (... column_name = 'learner_id')`, so a misspelt table name does not raise an error — it **silently does nothing** and the table stays unscoped. That is the worst possible failure mode for an access-control change: it reports success and protects nothing.

Names that never matched a real table: `mastery` (→ `mastery_topics`), `curriculum` (→ `curriculum_items`), `progress_reports` (→ `tc_progress_reports`), `bookings` (→ `booking_classes`), and `diagnostics`, `whiteboard_rooms`, `meetings`, `makeups`, `cancellations` (no such tables).

Never in either list at all: `scoresheet`, `parents`, `parent_learner`, `attendance_checkins`, `cbt_roster`, and all nine new desk tables.

V25 re-applies the scoping with verified names, adds the missing tables, and **raises a `NOTICE` naming any table it could not find** so a future rename cannot fail silently the same way. Two deliberate exceptions, stated because they are judgement calls: **tutors can see each other** (needed for cover and handover; pay lives in `tutor_rates`/`payroll`, which are manager-only), and **subjects are a shared catalogue** (otherwise a tutor could not tag a lesson "Physics" because somebody else created the row). `tc_is_manager()` short-circuits every predicate — admin is unrestricted.

New: `select public.tc_my_scope_report();` tells a tutor what they can reach and, crucially, says plainly when `tutors.user_id` is not linked — which is the real cause of "why can't I see my students any more?".

## 22. Full CBT lifecycle beside every quiz

`practice.html` already had Sit, Edit, ＋CSV, Duplicate and Delete. Six things were missing, and one mattered a great deal: **there was no way to stop a paper accepting sittings.** The only way to end a quiz was to delete it, which destroyed the paper behind every result already recorded. Tutors were doing it.

Beside every paper now: a **state badge** (Open / Closed / Scheduled / Expired / Archived) and — **Sit · 👁 Preview · ❓ Questions · ✏️ Edit · 📊 Results · 🔗 Share · 🔒 Close / 🔓 Open · 📦 Archive / 📤 Unarchive · ⧉ Duplicate · ＋CSV · 🗑 Delete**.

- **Preview** shows the paper as a candidate sees it, with the answers visible to you, nothing recorded — and flags in red any question with **no answer key**, which marks every candidate wrong.
- **Questions** lists, reorders and removes individual questions without re-importing the CSV.
- **Share** mints a link; "turn the link off" is explained as *not* the same as closing.
- **Close is enforced by the database.** `tc_cbt_set_state()` writes the state and a `BEFORE INSERT` trigger on `cbt_results` refuses a sitting for a paper that is closed, archived, not yet open, or past its closing time. A browser check is a suggestion; this is a lock.

## 23. Every repo updated

`tools/sync_all.sh` was run. It now also **verifies both repos before packaging** — the suite used to be zipped without anything having been executed against the client copy, so a mirror that dropped a file would have shipped.

- `tutoringconnect` — 136 pages, 275 files
- `adewaleclassroom` — 135 pages, 249 files (byte-identical except config/generator/wizard/index/manifest)
- `generator.js` `ALWAYS_FILES` and `ALL_PAGES` updated — **without this a generated ZIP would have shipped with an empty navigation pane**, since pages no longer carry hard-coded links
- Deliverable suite + ZIP rebuilt: 601 entries, 4.7 MB
- Per-site SEO regenerated; `free-register.html` added to the public/indexable list
- `theme-color` meta corrected from `#4f46e5` to `#0506ae` on every page — a leftover from the source template, and the one place your brand was visibly wrong (it is what a phone paints around the installed PWA)

---

## Things I did not do, or could not verify

I would rather say this plainly than let you discover it.

1. **The SQL is parser-validated, not executed.** `pglast` parses `complete-schema.sql` cleanly and every referenced table and function resolves, but there is no PostgreSQL binary in this sandbox and I could not install one. It has never been run inside a transaction test. Run it on your project and read the output — the V25 block deliberately raises `NOTICE` lines telling you how many tables were scoped and naming any it could not find.

2. **I did not probe your live database this turn.** The last verified reading was V17. Everything about tutor scoping and the entry desks assumes you run the schema file.

3. **Historical CBT results are still wrong** and I have still not silently rewritten them. They were computed by the grader that scored blank papers 3/20. Use ⚙ Manage → Preview to find papers with missing answer keys, repair them, and re-sit.

4. **Tutor scoping depends on data hygiene.** `tutors.user_id` and `engagements.tutor_id` must be set. When they are not, a tutor sees *less* than expected, not more — it fails safe — and `tc_my_scope_report()` now says so explicitly.

5. **`builder.html` is still unauthenticated.**

6. **There is still no update channel** across generated studios. Architectural; unchanged.

7. **No visual regression testing.** I verified structure and behaviour headlessly (jsdom) and served the site locally, but I have not compared rendered pixels across the 20 layouts.

8. **`data_requests` insert on Admin data is best-effort** — it is wrapped in a `try` and the export proceeds whether or not the log write succeeds. That was deliberate (never block a subject-access request on a logging failure) but it does mean a failed log is silent.

9. **The Contact form writes to `inquiries`.** If your RLS on that table refuses anonymous inserts, the form will fail and tell the visitor to use WhatsApp. Worth testing signed out.
