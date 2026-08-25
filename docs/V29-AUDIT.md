# Tutoring Connect — V29 audit and fix report

**Schema:** V28 → **V29** · **Repos updated:** `tutoringconnect`, `adewaleclassroom`, deliverable suite + ZIP.

## The request

> "Ensure that I am able to create links that I can share on my social media handles for parents/students to register for my paid and free classes."

One short, shareable link per class → post it on WhatsApp / Facebook / X / LinkedIn / Telegram / email (or print it as a QR) → the parent taps it and lands on a clean public registration page → registers in under a minute → gets a registration number and the joining details. The studio sees, per link, how many people clicked and who registered, with a follow-up funnel.

**Note on the blueprint:** no blueprint file arrived with this message (nothing was attached). I built the complete, standard implementation below. If you share your blueprint (image/PDF/text), I will align any details to it precisely.

## What was built

### Schema (`database/v29-social-registration-links.sql`, spliced into `complete-schema.sql`)
- **`tc_class_links`** — one row per shareable link: unique `code`, kind (`paid` | `free`), title, subject, tutor, starts_on, schedule, platform, price + currency (0/NULL = free), image_url, intro, meeting_url, group_url, status (`open`/`closed`/`archived`), expires_on, max_uses, live `uses` counter.
- **`tc_class_registrations`** — parent name, contact, learner name/year, school, how-heard, guardian consent flag, notes, unique `reg_no` (REG-XXXXXXXX), funnel `status` (new → contacted → booked → converted → closed).
- **RPCs**: `tc_class_link_get(code)` (public read, validates open/expiry/limit), `tc_class_register(...)` (public insert, bumps uses, issues reg_no), `tc_class_links_my()` (staff list + registration counts), `tc_class_regs_for(link)` (staff registrations), `tc_class_reg_status(reg, status)`, `tc_class_link_set_status(id, status)`.
- **RLS**: staff write; anon/authenticated read only `open` links; registrations staff-only (public writes flow through the SECURITY DEFINER RPC). Minors require the guardian consent flag (enforced in the RPC when the learner year is under 18).
- `tc_v29_check()` folded into `tc_schema_ok()`; registry upserts **V29** with the new pack.

### Admin studio — `class-links.html` + `assets/js/class-links.js`
- **＋ New class link** form: paid/free toggle (price hides for free), title, subject, tutor, start date, schedule, platform dropdown, cover image link, intro message, meeting link, group link, expiry, max registrations.
- **Share card** on save: the full link, plus one-tap composers pre-filled with the class details and link — **WhatsApp, Facebook, X/Twitter, LinkedIn, Telegram, Email** — plus **Copy link** and a **QR code**, and a **Preview page** button.
- **Your links** list: kind badge (💳/🎁), status, uses/max, registrations (with a "new" counter), per-link actions — Share again, Registrations (inline list with funnel dropdown), Edit, Close/Reopen.
- Follow-up funnel per registration: new → contacted → booked → converted.

### Public landing — `class-register.html` + `assets/js/class-register.js`
- Opens with `?code=…`; shows the class card: cover image, title, **FREE / price**, subject, tutor, start date, schedule, platform, intro message.
- Registration form: parent/guardian name (required), phone/WhatsApp, email, learner name, learner year/age, school, how-did-you-hear dropdown, optional message, guardian-consent checkbox for minors.
- Success screen: registration number, class details, **Join the class** and **Join the group chat** buttons (when links exist), print/save. A **Forward this class** button re-shares it on WhatsApp so one parent can pass it on.
- No account needed, nothing uploaded; SEO-indexable.

### Wiring
- Nav (Class registration links → staff, under Enrolment & growth), RBAC (class-register public for everyone; class-links staff-only, denied to families), catalog, page guide (both pages documented), assistant KB, generator always-files (pages + JS + SQL), SEO (class-register public/indexable; class-links private).

## Verification

| Gate | Result |
|---|---|
| `tools/test_v29_verify.js` *(new)* | **44 / 44** |
| `tools/test_runtime.js` | **1,456 assertions, 0 failures** |
| `tools/test_v27_verify.js` / `test_v28_verify.js` | 64 / 64 · 119 / 119 |
| `tools/test_nav.js` / `test_v25_render.js` / `test_v26_verify.js` | 61 / 61 · 90 / 90 · 21 / 21 |
| `tools/test_generator.js` | ALL PASSED — 0 broken assets/links |
| `tools/audit_integrity.py` | OK — nothing disconnected |
| `pglast` parse of `complete-schema.sql` | OK — 10,164 lines, 1,300 statements |
| `tools/lint_schema_order.py` | no forward references — runs top to bottom |

## How to use it (deployment steps)

1. Run `database/complete-schema.sql` in the Supabase SQL editor, then on its own:
   ```sql
   notify pgrst, 'reload schema';
   ```
   Confirm with `select public.tc_schema_ok();` — it should say "Schema complete".
2. Sign in as admin/tutor → **Enrolment & growth → Class registration links** (or open `class-links.html`).
3. **＋ New class link** → pick 💳 Paid or 🎁 Free → fill the details → **Save link**.
4. Post the generated link on WhatsApp/Facebook/X/LinkedIn/Telegram/Email, or show the QR on a flyer. Test with **Preview page** first.
5. Watch usage on each link and follow up registrations from **📝 Registrations**.

## Honest limits
- The schema is parser-validated, **not live-executed**; run step 1 above to activate it.
- Until the SQL is run, the admin page shows a clear "could not load links" message and the public page explains the database is not connected — nothing crashes.
- The blueprint you mentioned was not attached; send it and I'll align (e.g. share-message wording, link format, extra fields).
