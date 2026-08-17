# V16 — audit, fixes and enhancements

**Scope of this turn.** The previous response ended with an explicit admission:

> *"Item 4 (competitor research) I did not do — I'd rather tell you than pad the
> summary… Same for a systematic pass on item 2's page-by-page feature extraction
> and item 3's exam-registration enhancement. Those three are the natural next
> block of work."*

This turn is that block of work. Nothing was removed; everything is additive.

---

## 1. Item 2 — page-by-page feature extraction (the "substandard features" complaint)

### The diagnosis

I stopped guessing and measured. `tools/audit_parity.py` counts capability
signals in every page of all three builds. The first run was damning:

| | Tutoring Connect | School Connect | GOSA |
| --- | --- | --- | --- |
| Total page source lines | 33,505 | 68,588 | 67,138 |
| `<table>` blocks | **10** | 163 | 161 |
| Supabase queries (`.from()`) | **92** | 378 | 380 |
| RPC calls | **6** | 38 | 38 |
| Buttons | **453** | 1,750 | 1,718 |

**The root cause.** 125 of the 130 pages were rendered by a single function —
`CRUD.renderList()` — and that function shipped only:

* the **first six columns** (`schema.cols.slice(0, 6)`); everything beyond
  column six was invisible on every page in the studio
* a hard `LIMIT 200` with **no pagination**
* a "search" that only searched those 200 already-loaded rows
* **no sort, no filters, no totals, no bulk actions, no detail view, no print**
* and a real, user-visible **bug**: a column of type `ref` painted `r[c.key]`
  straight into the cell — which is a UUID. Every page pointing at a learner,
  tutor, engagement or parent showed the operator `0f3c9a12-…` instead of
  `Tolu Adebayo`.

You were right. They were renamed spreadsheets, not extracted features.

### The fix

I did **not** hand-write 125 bespoke pages. That is what makes School Connect
68,000 lines that cannot be maintained. Instead I made the one shared renderer
enterprise-grade, so every capability lands on all 125 pages at once:

| # | Capability | What it does |
| --- | --- | --- |
| 1 | Reference resolution | UUID → human label, with a cache so ten ref columns aren't ten round-trips. **Fixes the UUID bug.** |
| 2 | Every column visible | Plus a column chooser, remembered per page |
| 3 | Click-to-sort headers | Any column, asc/desc |
| 4 | Per-column filters | Free text (`ilike`), or a dropdown for enums and refs |
| 5 | Server-side pagination | 25/50/100/200/500, exact row count, prev/next |
| 6 | KPI summary strip | Row count, sums + averages of numeric columns, status breakdown, "added this month" |
| 7 | Bulk selection | Select page/all, bulk delete via one `.in()`, export just the selection |
| 8 | Record detail drawer | **Every** field, not six, plus resolved labels and copy-id |
| 9 | Duplicate a record | Opens the form pre-filled with the id stripped |
| 10 | Print / PDF view | Clean printable table of exactly what you filtered |
| 11 | Saved views | Name a filter+sort+column set and reuse it |
| 12 | Density toggle | Comfortable / compact |
| 13 | Real empty states | Explains what the table is for and what to do next |
| 14 | Row actions hook | A page can attach its own buttons via `schema.rowActions` |

Cells are now formatted by type: money is thousands-separated, dates are
localised, booleans become badges, URLs become real links showing their host,
status values get a tone-coded badge, and long text truncates with a tooltip.

`assets/js/crud.js`: 687 → 1,251 lines. `assets/css/style.css` gained the
workbench styles (mobile-responsive; the filter row folds away under 720px).

### The result — measured, not asserted

| Capability | Tutoring Connect | School Connect |
| --- | --- | --- |
| list | 128/130 | 116/131 |
| create | 128/130 | 112/131 |
| edit | 125/130 | 78/131 |
| delete | 125/130 | 23/131 |
| search | 125/130 | 7/131 |
| sort | 126/130 | 33/131 |
| filter | 126/130 | 42/131 |
| paginate | 125/130 | **1/131** |
| export | 126/130 | 107/131 |
| print | 125/130 | 17/131 |
| detail | 125/130 | **0/131** |
| bulk | 126/130 | 21/131 |
| kpi | 128/130 | 97/131 |
| rolegate | 128/130 | 110/131 |

**Pages still behind their School Connect analogue: 0.**

Full matrix in `docs/PAGE-PARITY-MATRIX.md`. Regenerate any time with
`python3 tools/audit_parity.py --md docs/PAGE-PARITY-MATRIX.md`.

### A real bug the audit caught

`cbt-multi.html` scored 7/14 when it should have scored 14. Investigating
showed the page **called `CRUD.renderList()` but never loaded `crud.js`** — and
was missing 12 other shared scripts as well. Fixed, then swept all 130 pages for
the same class of bug: **0 remaining**. Its hand-rolled 25-row paper list is now
the shared workbench, with row actions to sit a paper or copy its sit-link.

---

## 2. Item 3 — exam registration

### The diagnosis

`exam-register.html` was a 283-line **dead-drop mailbox**. The candidate typed
their details, a row landed in the table, and that was the end of it:

* no exam number — nothing to quote on the phone
* no way for a candidate to check anything without ringing you
* no record of whether the fee was paid
* nowhere to put a score
* no admission decision, no documents — all done by hand in Word
* and the page description was **the Inquiries page's text pasted in**, telling
  the reader *"families never see the pipeline"* on a page whose entire purpose
  is to be seen by families

### The fix — 283 → 1,065 lines

**Lifecycle:** `submitted → verified → paid → admitted → sat → released`

**Candidate side (no sign-in):**
* Registration form with everything auto-filled that can be: next six sittings,
  board-aware subject chips (IELTS shows bands, not Further Maths), all 36 states
  + FCT, centres, nationality, and the board itself pre-selected from a link code
* Exam number allocated by a **Postgres sequence** — `TC/WAEC/2026/0007` —
  never by a JavaScript row count that two simultaneous submissions would collide on
* Printable acknowledgement slip, copy-number, register-another
* **Check my status**: exam number + surname reveals fee status, docket and,
  once released, the result — no account, no password

**Staff console (row-level-security protected, not merely hidden):**
* KPI strip from `tc_exam_reg_stats()` — candidates, awaiting verification, fees
  paid/outstanding, results released, admitted, fees collected vs owed
* The full V16 workbench over a 36-column candidate schema
* **Advance** walks the lifecycle with a confirmation; **Enrol** converts a
  candidate into a learner idempotently
* **Four printable documents** — docket (with instructions to the candidate),
  result slip, decorative certificate, admission/outcome letter — all over a
  signing officer's name, all A4, all "Save as PDF" from the browser. No PDF
  library, no paid service.

### Security, done properly

`anon` **lost** direct insert on `exam_registrations`. V3 shipped
`with check (true)`, which let anyone insert anything — bypassing link rules and
self-assigning any exam number. Registration now goes exclusively through
`tc_register_candidate()` (SECURITY DEFINER), which validates the link's status,
expiry and usage cap, and returns only the candidate's own exam number.
`tc_candidate_lookup()` requires two shared secrets and **withholds scores until
staff release them** — that is what stops results leaking early.

New SQL: `database/v16-exam-registration.sql`, also folded into
`database/complete-schema.sql`. Registry now reports **V16**.

---

## 3. Item 4 — competitor research

`docs/COMPETITOR-BENCHMARK.md`. 13 sources, live research, every claim cited.
Covers TutorCruncher, Teachworks, TutorBird, Teach 'n Go, Oases, Tutorbase,
Pike13, Jackrabbit, EdisonOS, plus the Nigerian content market (uLesson,
PrepClass, Exambly) — and a 28-row feature matrix.

### Three findings that changed decisions

**a) The category leaders have no gradebook.** TutorCruncher — routinely called
"the most comprehensive" — has **no gradebook and no behaviour tracking at all**.
TutorBird "doesn't offer grading or transcript features". They are billing and
scheduling engines that treat teaching as a black box. Your scoresheet, mastery
tracking, progress reports and CBT engine are a **genuine differentiator**, not
table stakes — and the marketing copy currently buries them.

**b) Nobody in the Western tooling market does WhatsApp.** None of the five main
platforms integrate it; TutorCruncher charges per SMS instead. Meanwhile a Lagos
centre owner with 68 students reportedly spends **four to five hours a day** on
WhatsApp doing intake, fees and progress updates. Your WhatsApp deep links match
how the actual customer works.

**c) Everyone charges for the money.** 2.5–3.85% card fees, or $0.07–0.32 per
lesson, or per-student pricing. A tutor collecting ₦1,800,000/month would pay
roughly **₦69,000/month in card fees alone** on TutorCruncher's entry tier —
more than Paystack's own 1.5% + ₦100 capped at ₦2,000. The zero-cost structure
is the whole commercial argument, and "no paid API" is a **strength to lead
with**, not a limitation to apologise for.

### What I changed as a result

Every competitor separates a **no-show** from an **absence**, and reports a
"no-show rate" — the metric used to prove reminders work. This studio could not
tell them apart. Now fixed, with the *commercial* logic encoded, not just a label:

| Status | Meaning | Charged? | Make-up credit? |
| --- | --- | --- | --- |
| `absent` | told you in time, slot refillable | no | yes |
| `excused` | agreed in advance | no | yes |
| `no-show` | nobody came, nobody said | **yes** | **no** |
| `cancelled-late` | inside the notice window | part | no |

Plus `chargeable` and `notified_at` columns and `tc_no_show_report(days)`
returning no-show rate and attendance rate.

### Gaps I am NOT claiming to have closed

| Gap | Severity | Status |
| --- | --- | --- |
| Automated installment plans | high in Nigeria | **open** |
| Sibling discount rules (15%/25%) | medium | **open** |
| Revenue-per-tutor reporting | medium | **partial** |
| Prepaid money wallet | medium | **open** |
| Lead nurture sequences | medium | **open** |
| Payment processing | — | **deliberately absent** — holding client money is out of scope |
| Multi-branch under one login | low | **by design** |

---

## 4. Verification

| Suite | Result |
| --- | --- |
| Runtime tests (generator) | **439 pass, 0 fail** (was 367; +72 new) |
| Runtime tests (client site) | **434 pass, 0 fail**, 5 generator-only skipped |
| Generator build checks | **all passed** — 0 broken assets, 0 broken links |
| `pglast` full-schema parse | **OK** (real PostgreSQL grammar) |
| `lint_schema.py` | **0 blockers** |
| Parity audit | **0 pages behind** |
| Client brand bake | **129/129 pages, 0 problems** |

Two of the new tests failed on the first run. Both were **my test's** fault —
a phrase wrapping across a source line, and a straight vs curly apostrophe. I
verified the page source before touching either, rather than editing the product
to satisfy a bad assertion.

### Still not solved (unchanged from last turn)

* **The live database is still at V4.** Everything from V6 onward — including
  all of V16 — is inert until someone runs `database/complete-schema.sql` once
  in the Supabase SQL editor. This is the single highest-value action available.
* SQL is validated by parser and linter, **never executed** — there is no
  PostgreSQL in this sandbox.
* `builder.html` is still unauthenticated.
* No visual regression testing across the 20 layouts; jsdom is not a browser.
