# V22 — CBT results & audit, per-pack prompts, legibility guard

**932 assertions, 0 failures** (was 796).

---

## Item 1 — See, audit and be notified about every CBT

New page **`cbt-results.html`**, new SQL pack `v22-cbt-results-audit.sql`.

### A Results button beside every paper
The exam index lists every paper with sittings, unreviewed count, flagged
count and class average. **📊 Results** opens it.

### Registered *and* anonymous candidates
Anonymous sittings are first-class, not hidden. A candidate who used only a
code appears with an `anonymous` badge alongside registered learners — you
asked for both, and a result with no `learner_id` is still a real result.

### Full audit of one sitting — "what did this student do"
**🔍 Audit** opens the whole paper for that candidate:

* every question, **their answer beside the expected one**, and the mark
* started / submitted / **time taken** / attempt number / device
* an **integrity timeline** of anything the anti-cheat layer saw

The audit states plainly that using the calculator or maths keyboard is *not*
a violation and never appears there — that was a real bug in V20 and the page
should say so.

### Item analysis — the part that turns scores into teaching
**🧪 Item analysis** computes facility per question and gives a verdict:

| Facility | Verdict |
| --- | --- |
| < 25% | **CHECK THE KEY — almost nobody got this** |
| < 50% | hard — worth reteaching |
| > 95% | very easy — low discrimination |

A facility below 25% usually means the *answer key* is wrong, not that thirty
learners are confused. Catching that before publishing a grade is the
difference between a defensible mark and an argument with a parent.

### Notification on every submission
A database trigger writes a notification row the moment anyone submits; the
page polls it every 30 seconds and each entry deep-links to the result.
No push service, no email bill — it costs nothing to run.

### Review and override
Essays and code are marked by keyword and word count, never by AI, so they
always need a human eye. **✏️ Review** overrides the mark, adds a private
comment and flags for follow-up. **The original machine score is kept beside
yours.**

> **A bug I caught before shipping:** `notifications` is only
> `(id, user_id, title, body, read_at, created_at)` — it has no `kind`,
> `audience` or `link`, which my trigger writes. Every CBT submission would
> have failed on the notification insert. Columns added, and a staff read
> policy too. Same discipline that caught `sessions.tutor_id` in V19.

---

## Item 2 — Every pack is now a different prompt

You were right and this was a real defect. All 18 packs shared one base with a
short paragraph bolted on — a *misconception-hunting* pack and a *marking
scheme* pack were ~98% identical text, so a model returned nearly the same
paper for both.

Each pack now has its **own**:

* **role** — who the model is being asked to be
* **mission** — what this specific paper is *for*
* **type distribution** — its own mix, scaled to your count
* **briefing sections** — unique to the pack
* **quality bar** — its own, not a generic one

Only the CSV output contract and column rules are shared, because those must
be byte-identical or files stop importing.

| Pack | Its own distribution |
| --- | --- |
| `mcq_only` | `mcq=20` — nothing else, ever |
| `advanced` | multi_numeric, assertion_reason, case_study, matrix lead |
| `reading_pack` | `case_study=10` around one shared passage |
| `marking_scheme` | short/numeric/multi_numeric lead; Col7 is a real M1/A1 scheme |
| `oral_practice` | `essay=8, short=6` — speakable in under two minutes |
| `misconception` | every distractor a named error, tagged in Col16 |

Worst similarity between any two packs is now **76%** (the shared CSV
contract), down from ~98%. Column rules are also **scoped** — an MCQ-only pack
no longer carries eight pages of matching and matrix rules.

> **Two bugs in my own work, caught by testing:** `enterprise` promised all 17
> types but silently dropped `image_mcq`, `essay` and `code` at small counts,
> because `floor(1 × 20 / 33) = 0`. Fixed with a `minOne` guarantee — verified
> at n=17, 20, 34 and 60. I had also left a **Cyrillic typo** ("идея") in the
> self-quiz pack.

---

## Item 3 — Popup legibility, fixed structurally this time

Two previous attempts were partial because the problem is structural, not in
any one file: popups are built in a dozen scripts, most set
`background:#fff` **inline** with no text colour, and inline styles beat any
stylesheet. Chasing that with string edits is whack-a-mole.

New **`assets/js/legibility.js`**: a MutationObserver watches for popup-like
elements, computes the *real* WCAG relative luminance of the painted
background, and if contrast is under **4.5:1** pins ink that clears it — using
`important` so it beats the offending inline style.

Verified in a real DOM: it detected **1.05:1** (white on white — exactly the
reported bug) and forced **17.9:1**. It is deliberately conservative: a
deliberately dark panel or a coloured toast is left alone.

Loaded on 131 pages, plus the known inline offenders fixed at source.

---

## Item 4 — No type dropped, and guidance for the confusing ones

**All 32 declared types render** — asserted, not assumed: the test walks
`CBT.allTypes()` and fails if any one cannot be rendered.

Added a **how-to line above every unfamiliar control**, written for a nervous
fifteen-year-old:

> *Ordering* — "Put the items into the correct order. Drag them, or use the ↑
> and ↓ buttons. You earn a mark for every item that ends up in the right place."

Plain MCQ and True/False get **no** note — it would be noise. Plus a full
**❓ How do I answer these?** legend, openable at any time during the exam,
which closes with the point most learners miss: *partial credit is normal, so
always attempt matching, ordering, grids and gap-fills.*

---

## Item 5 — Dropdowns instead of typing, everywhere

`crud.js` already covered the 125 workbench pages. The gap was hand-written
forms on bespoke pages — and every new page could reintroduce it.

Added an auto-picker to `ux-enhance.js`: any text input whose id, name or
placeholder names a known entity (learner, tutor, parent, subject,
engagement/class, term, room, exam) is upgraded **in place** into a
datalist-backed picker fed from the live database. Typing a genuinely new
value still works — you simply no longer *have* to.

Runs on new markup too, so JavaScript-built forms are covered.

---

## Item 6 — Scheme of work is now editable

`sow_terms`, `sow_topics` and `sow_evaluations` had **no CRUD at all** — a term
could be created but never corrected or deleted. All three now use the shared
workbench: edit, delete, duplicate, filter, sort, page, export, print.

---

## Item 7 — School Connect CSV

Re-verified after this round of changes: a School Connect CSV parses, empty
quoted fields stay empty, and the `Pairs` JSON column still resolves to an
array. Guarded by assertions so a future change cannot silently break it.

---

## Item 8 — Files updated

**New:** `cbt-results.html`, `assets/js/legibility.js`,
`database/v22-cbt-results-audit.sql`
**Changed:** `cbt.js` (18 pack definitions), `cbt-types.js` (how-to + legend),
`crud.js` (SoW schemas), `ux-enhance.js` (auto-pickers), `app.js`,
`style.css`, `cbt-exam.html`, `sow.html`, `generator.js` (payload 217),
`complete-schema.sql` (→ V22), `page-guide.js` (134 pages, 747 sections),
nav on **128 pages**.

Both repos and both suite copies. Zip: **561 entries**.

| Check | Result |
| --- | --- |
| Runtime (generator / client) | **932 pass, 0 fail** / all pass |
| Generator build | **all pass** — 217 files, 0 broken links |
| Integrity / schema / parity | **0 / 0 blockers / 0 behind** |

---

## Re-run `database/complete-schema.sql`

V22 adds the results functions, the notification trigger and the
`notifications` columns. Until you run it, `cbt-results.html` will say
*"Not installed yet"* — that is the designed message, not a crash.
