# V17 — enforced licensing, sibling billing, and a correction

## A correction first

In my previous response I wrote:

> *"Item 14 (one-time vs subscription licensing) is a well-scoped next piece:
> license.js already supports both models but the builder doesn't expose the choice."*

**The second half of that sentence was wrong.** `builder.html` has exposed the
choice since V8 — a radio pair for lifetime vs subscription, plus plan label,
cycle, expiry date, grace days, renewal URL and registry URL. I asserted a gap
without opening the file.

This is the **second time** I have made exactly this mistake about licensing:
V15's notes record that I "wrongly reported licensing as missing" then too. I am
recording it here rather than quietly fixing it, because a pattern of unverified
claims about the same subsystem is worth you knowing about.

Checking the file properly turned up something far more serious that nobody had
named.

---

## 1. The real defect: licence enforcement was entirely cosmetic

`assets/js/license.js` evaluated the licence **in the browser**, from a value it
read out of `config.js`, and then called `paint()` — which appended a yellow bar
and a modal `<div>` to the page. That was the whole of the enforcement.

Any user could:

* press F12 and delete `#tc-license-lock`, or
* run `License.paint = () => {}` in the console, or
* simply block `assets/js/license.js` in the network tab

...and carry on using an expired studio for ever, **with full write access**. A
"locked" studio was never locked. The `site_license` table even had a `signature`
column that nothing on earth read or wrote.

### The fix — the decision moved to PostgreSQL

| Function | Role |
| --- | --- |
| `tc_license_status()` | Server-computed truth: state, days left, seats used vs cap, writable |
| `tc_license_writable()` | The single boolean the database enforces |
| `tc_license_guard()` | A trigger that refuses writes when not writable |
| `tc_license_set(jsonb)` | Admin-only change, with an audit entry |
| `tc_license_renew(months)` | One-click renewal |
| `tc_license_history` | Audit trail — renewals are money, money needs a paper trail |

The guard is attached to **27 operational tables**. Deleting `license.js` now
buys you nothing: Postgres refuses the write regardless.

### Four design decisions that matter more than the code

1. **Reads are never blocked, in any mode.** An expired studio stays fully
   readable, printable and exportable. "Your data is untouched" is now literally
   true instead of a reassuring sentence in a modal. Holding a client's own data
   hostage would be indefensible, so it is not an option this software offers.
2. **The licence table is never guarded.** Guarding it would make an expired
   studio impossible to renew — you would have bricked it permanently. Verified
   mechanically: the 27-table list contains no licence, heartbeat or schema table.
3. **A missing licence row fails OPEN.** That would be our bug, not the client's,
   and it must never take a paying studio down.
4. **A one-time licence is never blocked**, whatever the enforcement setting says.
   That is what "one-time" means. The generator additionally forces `enforcement`
   to `banner` for lifetime licences, so a mis-click in the wizard cannot lock a
   studio that was bought outright.

Enforcement is now a per-studio choice: `banner` (warn only — the old behaviour,
still the default), `readonly` (writes refused, reads fine), or `lock` (writes
refused and the UI locks too).

---

## 2. `license.html` was a stub

The page named after the licence had **no licence UI on it at all** — a
page-intro card, one line of placeholder text ("Use the related links…"), and an
**empty `<script>` block**. 243 lines of scaffolding around nothing.

Now 578 lines: status KPIs, a plain-English explanation of the current state,
model/tier/plan/expiry/grace/enforcement/seats/licensed-to editing, one-click
renewal presets (+1 month, +1 term, +6 months, +1 year), and the change history.

Renewing **early extends** the term rather than truncating it; renewing **late
starts from today**, so nobody is billed for a period they could not use.

It also has a **"Run write test"** button that attempts a real write and reports
what the database said back — proving enforcement rather than asking you to take
it on trust.

---

## 3. Builder and generator

`builder.html` gained tier, enforcement mode, learner seats, tutor seats,
licensed-to and lock message, with the reads-are-never-blocked guarantee stated
in the form itself.

More importantly, the generator now emits **`database/00-licence-seed.sql`**.
Without it, the wizard's licensing choice would have been written only into
`config.js` while the database sat on its defaults — the owner's choice would
have silently done nothing. Payload: 208 → 211 files.

---

## 4. Sibling / family billing

The competitor benchmark flagged automatic sibling discounting as an open gap
against Jackrabbit and TutorBird, and Nigerian centres advertise it openly
("15% off the second child, 25% off the third").

* Three configurable bands on `practice_settings` (2, 3, 4+ children)
* `tc_sibling_discount_pct(children)` — **highest band reached**, not a sum
* `tc_family_statement()` now returns `children_count`, `sibling_discount_pct`,
  `sibling_discount_amount` and `balance_after_discount`
* Settings page has the bands with a **live worked example** on a ₦100,000 balance
* The family statement on `invoices.html` shows the discount line and the
  discounted total, and **nudges** when a multi-child family has no discount set

The discount is calculated on what is still **outstanding**, never on money
already received — you cannot discount a payment after it has been made.

`tc_family_statement()`'s signature is unchanged and every key the V15 version
returned is still returned, so nothing that already called it breaks.

---

## 5. Verification

| Suite | Result |
| --- | --- |
| Runtime (generator) | **497 pass, 0 fail** (was 439; +58 new) |
| Runtime (client site) | **all passed** |
| Generator build checks | **all passed**, 0 broken assets/links, 211 files |
| `pglast` full-schema parse | **OK** |
| `lint_schema.py` | **0 blockers** |
| Parity audit | **0 pages behind** |
| Guard-list safety check | **no licence/heartbeat/schema table guarded** |

---

## 6. What I have NOT done, and why

Your quote lists items **1, 4, 7, 9, 10, 11, 12, 14**.

* **Item 4** (competitor research) — done last turn, `docs/COMPETITOR-BENCHMARK.md`.
* **Item 14** (licensing) — done this turn, above.
* The **sibling/family invoicing gap** you named explicitly — done this turn.
* **Items 1, 7, 9, 10, 11, 12** — **I do not know what these are.** The numbers
  come from a prompt of yours that is not in my current context, and the original
  list is not saved anywhere in the workspace (I searched). I could guess from the
  general theme, but guessing at six numbered requirements and reporting them as
  "addressed" is exactly the padding you have called me out for before.

Please paste those six items and I will work through them the same way.

### Also still outstanding

* **The live database is still at V4.** Every function in V16 and V17 — including
  all licence enforcement — is inert until `database/complete-schema.sql` is run
  once in the Supabase SQL editor.
* SQL is parser- and linter-validated, **never executed**; there is no PostgreSQL
  in this sandbox.
* `builder.html` is still unauthenticated.
* No visual regression testing across the 20 layouts.
