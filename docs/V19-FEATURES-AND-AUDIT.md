# V19 — Competitor research, new features, and the audit behind them

This answers items **1, 7, 9, 10, 11, 12 and 15**.

---

## Item 1 — Deep competitor research → features implemented

### Method

Live web research across vendor sites, Capterra/G2 listings and independent 2026
round-ups, covering **Tutorbase, TutorCruncher, Teachworks, TutorBird, Teach 'n Go,
Oases Online, Pike13, Jackrabbit Class, iClassPro, Sawyer, Jumbula, CourseStorm,
Enrollsy, Amilia, Arlo, Classe365, Gradelink**, plus the FERPA/NDPA compliance
tooling market (OpenEduCat and others).

### Unique features found that we did NOT have — now implemented

| # | Feature | Who has it | Status |
| --- | --- | --- | --- |
| 1 | **Prepaid credit wallet** with auto-deduction and low-balance alerts | Tutorbase (flagship — *"lifts renewals up to 42%"*), TutorCruncher | **Built** — `wallet.html` |
| 2 | **Attendance-driven auto-invoicing** | Tutorbase, Teachworks, Oases | **Built** — trigger |
| 3 | **Instalment / payment plans** | Tutorbase, CourseStorm, Sawyer, Enrollsy, Jackrabbit | **Built** — `payment-plans.html` |
| 4 | **Promo / discount codes** | CourseStorm, Jackrabbit | **Built** — `tc_check_promo()` |
| 5 | **Waitlist auto-promotion** | Jackrabbit, Sawyer, CourseStorm | **Built** — `tc_waitlist_promote()` |
| 6 | **Payroll from real attendance**, multiple rate models | Tutorbase, TutorCruncher, Pike13 | **Built** — `tc_payroll_generate()` |
| 7 | **Revenue per tutor / utilisation** | TutorCruncher, Tutorbase | **Built** — `tc_tutor_performance()` |
| 8 | **Conflict detection / zero double-bookings** | every competitor | **Built** — `tc_session_conflicts()` |
| 9 | **Immutable audit trail** | OpenEduCat, FERPA tooling | **Built** — append-only |
| 10 | **Right-to-inspect export** | OpenEduCat, KyberGate | **Built** — `tc_export_learner()` |
| 11 | **Anonymised export (SHA-256)** | American Digital Education | **Built** — `tc_anonymised_export()` |
| 12 | **Consent management** | OpenEduCat | **Built** — `consent_records` |
| 13 | **Failed-login monitoring** | ADE, KyberGate | **Built** — `tc_security_events()` |

### Deliberately NOT implemented, with reasons

| Feature | Why not |
| --- | --- |
| Stripe / Paystack processing | Holding client money needs a merchant account and PCI scope. Studios use their own payment link. This is what keeps the platform free. |
| "AI Find Slot" scheduling | An AI API is not cost-effective. The **same result** is achieved by pure availability intersection — `tc_session_conflicts()` — which is deterministic, instant and free. |
| Marketplace / lead-gen | A different business model (15–20% commission). |
| Native iOS/Android apps | The PWA installs on every platform at zero cost and zero store review. |

---

## Item 11 — What is now automated (nothing typed that the system knows)

| Was manual | Now automatic |
| --- | --- |
| Writing an invoice after each lesson | Marking attendance raises the invoice, or deducts the wallet |
| Working out instalment dates and amounts | Whole schedule generated from a total + frequency |
| Calculating who is low on credit | Chase list with one-tap WhatsApp per family |
| Typing payroll hours | Generated from real attendance and tutor rates |
| Remembering who is next on the waitlist | `tc_waitlist_promote()` picks by priority then age |
| Typing a learner or parent name | Every picker auto-fills from the database |
| Typing today's date | Pre-filled |
| Calculating sibling discounts | Applied to the family statement automatically |
| Allocating an exam number | Postgres sequence |
| Working out an instalment split | Previewed live as you type |
| Judging if a tutor is double-booked | Interval-overlap check |

**Rounding note:** instalment rounding is absorbed by the **first** payment, never
the last — a family should never meet a surprise odd amount at the end of a plan
they budgeted for.

---

## Items 7 & 9 — Safety, security, portability

### The immutable audit trail

Every compliance source names this control first. The existing `activity_log` was
a plain table that anyone with write access could edit or empty — which is not
evidence of anything. It is now:

* **Append-only.** Two triggers refuse `UPDATE` and `DELETE` outright, and
  `INSERT/UPDATE/DELETE` are revoked from `authenticated` and `anon`. Only the
  audit trigger can write to it.
* **Complete.** Before *and* after values are captured, so "what changed" is
  answerable field by field.
* **Broad.** 20 tables covering people, money, exams, safeguarding **and
  configuration** — because changing a setting is often the thing that caused an
  incident.

### Data-subject rights

| Right | Implementation |
| --- | --- |
| Inspect | `tc_export_learner()` — everything on one child in one JSON file |
| Portability | Same export, machine-readable |
| Correction / erasure | `data_requests` register with a 30-day clock |
| Consent | `consent_records` — purpose, method, evidence link, expiry |
| Minimisation | Anonymised SHA-256 export for analytics |

*Deadlines: NDPA 2023 expects "without undue delay"; FERPA allows 45 days. The
default is 30, which satisfies both.*

### Portability — you own everything

No lock-in: standard PostgreSQL, static HTML/CSS/JS with **no build step and no
framework**, full CSV export on all 125 workbench pages, JSON export per learner,
and Google Drive backup. If you leave, `pg_dump` and a folder of files is the
whole migration.

---

## Item 12 — Lapses found and fixed this round

| # | Lapse | Severity | How found | Fix |
| --- | --- | --- | --- | --- |
| 1 | `sessions` had **no `tutor_id`** — payroll, revenue-per-tutor and conflict detection were all impossible | **High** | Verifying assumptions before shipping | Column added + indexed |
| 2 | `sessions` had no `duration_min` | Medium | Same | Added and **backfilled** from `ends_at`/`hours` |
| 3 | Generator payload missing the 3 new pages → **372 broken links** in generated ZIPs | **High** | `test_generator.js` | Added to payload (214 files) |
| 4 | `tc_schema_info` expected constant left at V18 | Low | Own test suite | Bumped, and a test now guards it |
| 5 | Auto-invoice could double-charge on a row edit | **High** | Design review | Guarded: no charge unless `status` actually changes |
| 6 | Wallet balance as a stored column would drift | Design | — | Built as an **immutable ledger**; balance is always the sum |
| 7 | New functions would inherit the `PUBLIC` execute grant (the V18 bug) | **High** | Applying the V18 lesson | Catalogue-wide revoke re-run at the end of V19 |

**Bugs 1 and 2 are the important ones.** I wrote three functions against columns
I *assumed* existed. Checking the schema instead of trusting the assumption
caught it before it shipped — the same discipline that was missing when I
shipped ineffective `revoke … from anon` in V16 and V17.

---

## Item 10 — Page descriptions and the bot

* **133 pages** now carry a description at the head: *what it is, who it is for,
  why it matters, a step-by-step, and related pages*.
* **741 documented sections** across the studio.
* Each new page has a **7-step** walkthrough and a purpose paragraph over 150
  characters — asserted by the test suite, not just claimed.
* The Studio Assistant has **41 curated page answers** and falls back to the full
  `PAGE_GUIDE` for every other page, so **no page is unanswered**.
* Descriptions explain *consequences*, not just mechanics — e.g. the wallet page
  explains why a reversing entry is correct and editing history is not.

---

## Item 15 — Files updated

**New pages:** `wallet.html`, `payment-plans.html`, `security-centre.html`
**New SQL:** `database/v19-revenue-and-security.sql` (folded into `complete-schema.sql`)
**Changed:** `complete-schema.sql` (registry → V19), `generator.js` (payload +
new pack + 3 pages), `assistant-kb.js` (+3 curated), `page_guide_custom.json`
(+3 rich entries), `page-guide.js` (regenerated, 133 pages), `test_runtime.js`
(+78 assertions), **nav on 127 pages**, `docs/DEPLOYMENT-GUIDE.md` (rewritten,
12 numbered steps), this document.

All present in **both** repos and both suite copies via `tools/sync_all.sh`.
Deliverable: `tutoring-connect-suite.zip`, **540 entries**.

---

## Verification

| Check | Result |
| --- | --- |
| Runtime (generator) | **616 pass, 0 fail** (was 538) |
| Runtime (client) | **all pass** |
| Generator build | **all pass** — 214 files, 0 broken assets, 0 broken links |
| Integrity audit | **0 disconnected references** |
| `pglast` parse | **OK** |
| `lint_schema.py` | **0 blockers** |
| Parity | **0 pages behind** |
| Nav coverage | **133/133 pages** link the new pages |

---

## Still outstanding — named, not hidden

* **Run `database/complete-schema.sql` again.** V19 is inert until you do. The
  three new pages will say *"Not installed yet"* — that is the expected message,
  not a crash.
* **No update channel** across generated studios (architectural).
* **`builder.html` unauthenticated.**
* SQL is parser-validated and live-probed, but **never executed in a transaction
  test** — no PostgreSQL in this sandbox.
* No visual regression testing across the 20 layouts.
* **2FA**: Supabase supports TOTP MFA free, but enabling it needs a project-level
  setting plus an enrolment screen. Not built yet — the honest next item.
