# V21 — HMG Academy CBT Pro parity, CSV interop, brand and popup fixes

---

## Item 1 — Studied cbtsystem-hmgacademy.vercel.app and its repo

I read the live site, `ADVANCED_QUESTION_TYPES_GUIDE.md`, `PROMPT_TEMPLATE.md`,
and the 231 KB `student.html` / 439 KB `teacher.html` sources.

### 1a. The prompt — restructured on their model

Their prompt is better than ours was in four specific ways, all now adopted:

| What they do | Why it matters | Status |
| --- | --- | --- |
| Explicit **type distribution** (`mcq=10, tf=5, mrq=5 …`) | Without it a model returns 60 MCQs and calls it a varied paper | **Adopted** — and ours is computed so it **always sums exactly** to the requested count |
| **Per-type column rules, by column number** | This is what makes output *importable* rather than merely plausible | **Adopted** — all 17 types |
| The **full 17-column header** | Structured types die without `Pairs` / `Items` | **Adopted** |
| Worked **JSON shapes** + "escape inner quotes as `""`" | The single commonest reason a generated CSV fails to import | **Adopted** |

Prompt grew from ~4,500 to **7,000+ characters**. Verified: a 20-question
request yields a distribution summing to 20; a 60-question request sums to 60.

**All 18 pre-existing packs are kept.** My first pass silently dropped
`mcq_only`, `exam_board`, `reading_video`, `reading_article`, `multi_subject`
and the rest — the test suite caught it. Each pack now *reshapes* the
distribution and *appends* its briefing on top of the richer base, rather than
replacing it. `mcq_only` correctly collapses the distribution to `mcq=5`.

### 1b. The 17 question types — real controls, not a text box

The reference gives every type a purpose-built control. Tutoring Connect
*declared* 17+ types but rendered most through a bare `<textarea>` — a matching
question looked identical to a short-answer one.

New file **`assets/js/cbt-types.js`** (~700 lines):

| Type | What the learner now sees |
| --- | --- |
| mcq / true_false | Tappable option cards, lettered badge, 3 selection cues |
| mrq | Cards with checkboxes and a "select all that apply" hint |
| matching | Left column fixed, dropdown per row, right-hand pool **shuffled once and remembered** |
| ordering | **Drag-and-drop** list, plus ↑↓ buttons for touch and keyboard |
| categorization | One row per item, category dropdown |
| matrix | Statement rows against shared options |
| hot_text | Tappable chips |
| cloze | Inputs sitting **inline at each `___`** in the sentence |
| multi_numeric | One labelled input per sub-part |
| numeric | Number field with unit chip and tolerance shown |
| assertion_reason | Assertion/Reason block, then the standard five options |
| case_study | Scrollable passage, then the question |
| image_based | Figure with a graceful failure message if the link dies |
| essay | Textarea with a **live word count** against the minimum |
| code | Monospace dark editor with the language named |

**Partial credit** throughout: ordering scores per item in place, matching and
matrix per row, hot-text credits hits and penalises wrong picks, multi-numeric
respects per-part tolerance. Essay and code are marked by keyword and word
count and **always flagged for tutor review** — never silently auto-final.
No AI API anywhere.

22 type aliases verified rendering **and** grading. Delegation is guarded: if
`cbt-types.js` is missing or a type is unhandled, the original renderer still
runs, so **no existing paper changes behaviour**.

Phone-first CSS: 44px minimum touch targets, tables collapse to stacked cards
under 640px, and no colour depends on a theme variable — an exam must look the
same on all 63 themes.

---

## Item 2 — School Connect / HMG CSV now imports

I found **a genuine CSV parser bug** while testing this:

```js
if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; }   // WRONG
```

`""` is an escaped quote **only inside a quoted field**. At the start of a
field it means *empty*. So `"a","","b"` decoded its middle column as a literal
`"` character. Since the HMG and School Connect templates are fully quoted and
most rows leave `Tolerance`, `Unit`, `Accept`, `MRQ_AON`, `Pairs` and `Items`
blank, **every one of those columns arrived as `"`** — which is why a numeric
question imported with unit `"` and tolerance `"`.

Now a correct RFC 4180 state machine, plus support for a newline **inside** a
quoted field (essay prompts and case-study passages routinely contain one).

Also found: `pairs` was declared **twice** in the same object literal. The
later raw-string version silently overwrote the JSON-parsed one, so matching
questions imported with their pairs still a string.

Verified against a real 10-row HMG CSV — every type, unit, tolerance, pairs,
items and the all-or-nothing flag now import correctly.

---

## Item 3 — "Lumen Tutoring Studio" — why my last fix could never have worked

The string appears **nowhere** in the codebase or on the live site. I renamed
code last turn and it changed nothing, because the footer does not read the
code:

```js
if (data.name) window.PRACTICE.name = data.name;   // from practice_settings
```

The name comes from the **database**, and the seed uses
`on conflict (id) do nothing` — so a studio whose row was created by an early
version keeps the old seeded name **for ever**. No amount of renaming in the
repo could reach it.

Two defences now:

1. **`app.js`** — a retired or generic seed name never overrides the studio's
   own name from `config.js`. A real studio name always wins.
2. **SQL** — `complete-schema.sql` rewrites any legacy row in place.

---

## Item 4 — Popup legibility — also misdiagnosed last turn

I fixed `.modal`. The popup users actually meet on every page is **❓ Page
Help**, and it has **no class at all** — it is built from inline styles, which
beat any stylesheet. It set `background:white` and never set a text colour, so
the contents inherited a near-white intended for a dark surface.

Fixed **at source** in `site-help.js`: explicit inline `color:#0f172a` on the
surface (17.4:1) **and** a `tc-popup` class so themes can reach it. Also pinned
the assistant panel (which used `var(--surface)`), the notification dropdown,
and the guard banners — with a full dark-mode set for each.

---

## Item 5 — Files updated

**New:** `assets/js/cbt-types.js`
**Changed:** `assets/js/cbt.js` (CSV parser, HMG columns, prompt, delegation),
`assets/js/app.js`, `assets/js/site-help.js`, `assets/css/style.css` (+320 lines),
`cbt-exam.html`, `assets/js/generator.js` (payload 215), `database/*.sql`,
`tools/test_runtime.js`, plus `cbt-types.js` added to **130 pages**.

Both repos and both suite copies, via `tools/sync_all.sh`. Zip: **551 entries**.

---

## Verification

| Check | Result |
| --- | --- |
| Runtime (generator) | **795 pass, 0 fail** (was 704) |
| Runtime (client) | **all pass** |
| Generator build | **all pass** — 215 files, 0 broken assets/links |
| Integrity audit | **0 disconnected references** |
| `pglast` parse / `lint_schema` | **OK / 0 blockers** |
| Parity | **0 pages behind** |
| Real HMG CSV import | **10/10 rows, all types correct** |
| 18 prompt packs | **18/18 produce a real prompt** |

### Three bugs my own tooling caught mid-work

* The test suite caught me **dropping the 18 prompt packs** — a pre-existing
  feature I was told never to remove.
* The CSV round-trip test exposed the **`""` empty-field bug**, which had been
  corrupting imports silently.
* The same test exposed the **duplicate `pairs` key**.

---

## You must re-run the schema

`database/complete-schema.sql` — item 3's database rewrite and the V20 CBT
columns both live there. Until you run it, the footer keeps the old name and
saving a quiz still fails.
