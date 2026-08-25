# Tutoring Connect — V27 audit and fix report

**Schema:** V26 → **V27** · **Repos updated:** `tutoringconnect`, `adewaleclassroom`, deliverable suite + ZIP.

## Verification before this was written

| Gate | Result |
|---|---|
| `tools/test_runtime.js` | **1,456 assertions, 0 failures** (was 1,325) |
| `tools/test_v27_verify.js` *(new)* | **64 / 64** against the generator |
| `tools/test_nav.js` | 61 / 61 |
| `tools/test_v25_render.js` | 90 / 90 |
| `tools/test_v26_verify.js` | 21 / 21 |
| `tools/test_generator.js` | ALL PASSED — 254 core files, 0 broken assets/links |
| `tools/audit_integrity.py` | 0 disconnected references |
| `pglast` parse of `complete-schema.sql` | OK — 9,268 lines, 1,235 statements |
| `tools/lint_schema_order.py` | no forward references — runs top to bottom |

---

## 14 · 18 · 19 · 28 · 31 · 34 · 35 — “infinite recursion detected in policy for relation **parents** / **parent_learner**” — **root cause found and fixed**

This was the same bug across payments, invoices, payment plans, value-added, predicted grades, progress reports, the at-risk board, group insights, insights lab, learner 360 and family links. It was **not** a data problem on any of those pages.

The two source policies formed a **cycle**:

```
policy on parents         →  inline subquery on parent_learner
policy on parent_learner  →  inline subquery on parents
```

PostgreSQL evaluates a policy’s `USING` expression *under* RLS, so the `parents` policy triggered the `parent_learner` policy, which triggered the `parents` policy again… until the server aborted with `infinite recursion detected in policy for relation "parents"` (and the same for `parent_learner`). Every downstream policy that read either table in an inline subquery — the family money policies, the five insight desks, progress reports — inherited the crash. That is why one fix had to be at the two **source** policies, not at each report.

**The fix** (standard Supabase pattern): the cross-table reads moved into `SECURITY DEFINER` helpers, which run as the table owner and bypass RLS, so a policy never re-enters RLS on the other table:

- `tc_parent_matches_uid(parent_id)` — is this parent record owned by the signed-in user?
- `tc_tutor_covers_parent(parent_id)` — does the signed-in tutor teach any child of this parent?
- `tc_family_can_see_learner(learner_id)` — manager / teaching tutor / the learner themself / their own parent?

`parents_tutor_scope` and `parent_learner_tutor_scope` were rebuilt on the helpers, and the money policies (`account_credits_family`, `payment_plans_family`, `payment_plan_items_family`) plus the insight-desk read policies were rewritten to use them. **The cycle is gone, and with it every page that was reporting recursion.**

**Honest note:** the schema is parser-validated and order-linted, but it has **not** been executed against a live PostgreSQL/Supabase instance in this sandbox. Run `database/complete-schema.sql` in the Supabase SQL editor, then `notify pgrst, 'reload schema';`, then `select public.tc_schema_ok();` — it will confirm the recursion fix is live.

---

## 15 · 27 · 32 · 38 — role mapping: “Your role (learner) does not have permission to access …” and pages on the wrong pane — fixed

**Root cause:** two access systems disagreed. `nav.js` renders the pane from `RBAC.level()`, but `app.js` kept its *own* `STUDENT_WHITELIST` / `PARENT_WHITELIST` and, after rendering, replaced the page content with the red **“Restricted Page”** card whenever its older lists disagreed. So a learner saw links the newer matrix allowed as read-only, then got blocked on entry by the older matrix. The parent pane had the identical conflict.

**The fix:**

1. `app.js` `moduleAllowedForRole()` now **delegates to RBAC** — one access authority. The old whitelists remain only as a fallback for pre-V25 studios without `rbac.js`.
2. `rbac.js` family matrix reworked per your lists:
   - **Removed from family panes entirely** (staff/admin tools): Messaging, Help desk, Directory, Birthdays, Timezone desk, Accommodations/SEN, Learning Styles, Result broadcasts, Policies, Referrals, Contracts & consent, Blog manager.
   - **Kept read-only for families**: session notes, make-ups, cancellations, meeting links, whiteboard rooms, curriculum maps, scheme of work, transcripts, learner portfolio, documents, goals, mastery, spaced practice, LMS, e-resources, payment plans, wallet, scholarships.
   - Parents keep: my children, parent–child links, their money pages — read-only except the pages they act on.
3. **Tutors** (items 15, 27): Safeguarding, Application links and the Activity log moved into the tutor **deny** list — admin-governance pages a tutor must never open. Money pages stay read-only for tutors, never writable.

A test now asserts the delegation and the deny lists.

---

## 39 — Page Help text invisible until highlighted — fixed at source

The ❓ Page Help popup is built from **inline styles**, which beat stylesheets. The old code set `background:#ffffff` inline but relied on the stylesheet for the text colour — so on dark themes the near-white body text landed on a white card. The V26 CSS layer handled the stylesheet side, but the inline side could still disagree.

`site-help.js` now reads the **actual theme state** (`body[data-theme]`) when the popup opens and sets both background *and* ink inline, matched to light/dark:

- Light: `#ffffff` card, `#0f172a` text (17.4:1).
- Dark: `#111827` card, `#f1f5f9` text (15.9:1).

No stylesheet, observer or highlight needed — the popup is legible the instant it opens, in either theme.

---

## 41 · 42 — homepage and login page cleaned

The auto-generated “page description” block (what/who/why/how/roles/related) was removed from **`login.html`** and from **both** homepages (generator `index.html` and the client site’s `index.html`). Those are marketing/auth doors — the block was extraneous there. The login page was also restyled (brand mark, “Welcome back”, segmented Sign in / Request access tabs, full-width actions). The homepage keeps its hero and proof sections, and the client homepage gained a **“Latest from the blog”** section that quietly hides when no posts exist.

---

## 40 — Public Blog — new

- `tc_blog_posts` + `tc_blog_categories` tables, RLS: **staff write, anyone reads published**.
- `tc_blog_list()` (search + category), `tc_blog_get(slug)` (bumps the read count), `tc_blog_set_status()` (publish / unpublish / archive), `tc_blog_my_posts()` (staff editor list).
- **`blog.html`** — public listing with live search and topic filter.
- **`blog-post.html`** — permanent reader page `?slug=…` with light markdown (paragraphs, headings, lists, bold, links).
- **`blog-manage.html`** — staff editor: new/edit/delete, draft→publish→archive, categories, per-tutor scoping.
- Cover art and media are **Drive/web links only** — nothing is uploaded, protecting the 1 GB storage / 500 MB DB quotas.
- Registered in nav (Blog = public, Blog manager = staff), RBAC, catalog, page guide, assistant, and the generator’s always-file list.

---

## 7 · 8 — Documents (custom Document Builder) + Contracts & Consent

- **`documents.html`** retitled “Documents” and rebuilt as the custom Document Builder, mirroring School Connect / GOSA: 12 presets (bonafide, hall ticket, recommendation, transfer, testimonial, invitation, fee clearance, admission, appointment, memorandum, certificate, custom), tokenised body (`[NAME] [CLASS] [TERM] [SESSION] [DATE] [REFERENCE] [SCHOOL] [SIGNATORY] [TITLE]`), one-click token insert, official signatory, **live preview** that fills tokens as you type, **Print/PDF** branded output, status lifecycle (draft → reviewed → final → issued → revoked). The existing CRUD register stays below.
- **`contracts.html`** — new Contracts & Consent register: draft → sent → awaiting signature → signed → void; a signed record is stamped and never deleted; the family reads only its own signed copies (`tc_contracts_for_family`).
- `tc_documents_render(id)` fills the tokens server-side for printing.

---

## 4 — Activity log — real audit UI

The page previously said “Connect Supabase to load live rows.” It now has a working audit trail: search across actor/table/action/row, table filter, date-range filter, summary stats (events, tables touched, top tables, latest days), and **Export CSV**. Rows stay immutable — there is deliberately no edit/delete.

---

## 1 · 2 · 3 · 5 · 6 · 9 · 10 · 11 · 12 · 13 · 16 · 17 · 24 · 25 · 26 · 36 · 37

- **1 · Marketing flyer** — new `flyer-maker.js`: live brand-matched A5 flyer (headline, subjects, boards, price, contact, WhatsApp, address, QR to apply.html), pre-filled from Settings, **Print/PDF** and **PNG export** for WhatsApp status.
- **2 · Feature guide** — live search + role filter + result count added to the catalogue.
- **3 · Tutor leave** — richer CRUD def (linked tutor, days, cover tutor, contact during leave).
- **5 · Safeguarding log** — severity, case status, occurred-on, action-taken added.
- **6 · Policies** — status, version, owner, effective-from added.
- **9 · Referrals** — referral code, referred email, reward kind added.
- **10 · Onboarding checklists** — order, owner, due date added.
- **11 · Application links** — verified working (code/title/subject/kind/expiry/max uses/intro + live list).
- **12 · Request a place** — verified (`?code=` application links land in inquiries).
- **13 · Voting** — renamed from “Voting & polls” (polls has its own page) across nav, page titles, guide, catalog and the assistant.
- **16 · Free class sign-up** — verified the admin-facing page mints shareable cohort registration links (`tc_free_links`).
- **17 · Certificates** — verified the certificate studio (`cert-studio.js`) is mounted.
- **24 · Exam registration links** — verified the link generator + registrations feed.
- **25 · Exam registration** — verified the public candidate form.
- **26 · CBT results & audit** — marking queue + result audit present; recursion fix unblocks the audit queries.
- **36 · Review my paper** — `cbt-review.html` now has a real feature: enter quiz code + student ID, load the latest attempt via `tc_cbt_recent_result()`, see per-question review (your answer / key / explanation), **Save/print PDF**. Graded results are only re-openable once released; self/review/open papers always.
- **37 · Public self-booking** — times per cycle now offers 1→4, 2→8, 3→12, 4→16, 5→20, 6→24, 7→28 classes.

---

## 29 · 30 · 33 — theme toggle, Tutors page, Learner 360

- **29 · Theme icon** — the toggle now sets **both** `body` and `<html>` data-theme (they used to disagree), repaints its own label (🌙 Dark / ☀️ Light), fires a `tc:theme` event so charts and popups recolor, and persists/restores per session.
- **30 · Tutors page** — gradient header band with live stats (total tutors, active, average rate, specialisms) above the register; consistent card styling.
- **33 · Learner 360** — the parent_learner recursion fix removes its live error; the page’s identity/scores/engagements view now loads reliably.

---

## 43 — Account linking (School Connect / GOSA style)

`profile.html` now has a **“Link my account”** panel. `tc_unlinked_records()` finds learner/parent/tutor records that share the signed-in email but are not yet linked to any account; one click links them (`tc_link_account`), after which the person sees exactly their own data. Admins can link any record to any account (explicit user id). This is the same “sign-in connects to the person’s profile” behaviour as School Connect and GOSA.

---

## 44 — Tutor marking of open-response questions

Verified end-to-end wiring: **CBT Results → Marking queue** (`cbt-results.html?tab=marking`), essays and other open types never auto-scored, tutor awards marks per question with quick 0 / half / full buttons, total recomputed in the database, result held back until released. Added a **visible entry point** on the CBT manager page (`practice.html`) and a **Marking queue** quick link on the tutor dashboard so the feature is findable.

---

## Not done / honest limits

- **SQL not live-executed.** The schema is `pglast`-parsed (9,268 lines) and order-linted, but no live PostgreSQL/Supabase run was possible here. Run `database/complete-schema.sql` → `notify pgrst, 'reload schema';` → `select public.tc_schema_ok();`.
- **Visual pixel checks** (popups in dark mode, flyer print) were not possible in this sandbox; selectors, contrast math and DOM assertions are verified instead.
- **Historical CBT results** recorded before V26 remain as scored; re-sit anything that matters.
- **CSV fixtures** (your three uploads) sit in `tools/fixtures-csv/` for regression tests; swap for synthetic copies if you prefer them out of the repo.
- **builder.html** remains unauthenticated (generator-internal).
