# CBT ENHANCEMENT — V39

**Repos:** `tutoringconnect` (generator) · `adewaleclassroom` (generated studio)
**Date:** 28 August 2026
**Scope:** the seven CBT items reported, plus the cross-repo sync (item 7)
**Verification:** `tools/cbt-v39-smoke.py` — 60 checks, 0 failures, both repos

---

## Why every fix landed in both repos

`tutoringconnect` ships its own runtime as the template it hands to every
studio it generates. `adewaleclassroom` is one of those studios. A defect in
`assets/js/cbt.js` is therefore not one defect — it is one defect per studio
ever generated, and it keeps being re-emitted until the generator is fixed.
Everything below was applied to the generator and to the studio, and the
touched files are byte-identical between them except for the four pages that
carry the studio's injected brand block (verified: exactly 2 differing lines
each).

---

## Item 1 — Multi-line maths reached candidates as raw text

### What was actually happening

The CSV you supplied (`algebraic-fractions-matrices-and-determi.csv`, 60 items)
contains cells like:

```
Solve the simultaneous equations:\n2x + 3y = 12\nx - y = 1
Simplify \frac{3x+6}{9}
```

Candidates saw that verbatim. Two independent causes:

**Cause A — the newlines were never newlines.** A CSV cell cannot safely hold a
real line break, so the generator writes the two *characters* backslash and
`n`. The review page had `white-space:pre-wrap` on the question, which looks
like it should help but cannot: `pre-wrap` preserves U+000A, and there was no
U+000A in the string. The exam page (`cbt.js:376`) did not even have that.

**Cause B — the LaTeX was never rendered.** `renderQuestion` emitted
`${TC.esc(q.question)}`. `TC.esc` is an HTML escaper; it has no opinion about
`\frac`. So `\frac{3x+6}{9}` was faithfully escaped and faithfully printed.

### The fix — `assets/js/cbt-richtext.js` (new, ~30 KB, zero dependencies)

A self-contained renderer for the LaTeX subset school maths actually uses.

**Why not KaTeX or MathJax.** This platform is an offline-first PWA with a
service-worker shell and a hard "no paid API, links not uploads" design law. A
300 KB CDN library would break the offline shell, break the sandboxed preview,
burn metered mobile data in a Lagos exam hall, and put a third-party CDN in the
critical path of a timed assessment. The subset that matters is small enough to
own outright.

**What it renders:** stacked fractions with a real rule (`\frac`, `\dfrac`,
`\cfrac`, `\binom`), surds with indices (`\sqrt`, `\sqrt[3]`), superscripts and
subscripts, matrices and determinants as aligned grids with full-height
brackets (`pmatrix`, `bmatrix`, `vmatrix`, `Bmatrix`, `Vmatrix`), piecewise
`cases`, `aligned`/`array`, accents (`\vec`, `\bar`, `\hat`, `\overline`), text
mode (`\text`, `\mathrm`, `\mathbf`), upright function names, ~120 operators and
relations, and the full Greek alphabet. `$…$`, `$$…$$`, `\(…\)` and `\[…\]` are
honoured, and bare commands in running prose are rendered too — because the
STEM prompt emits `\frac` outside delimiters and a candidate must still see a
fraction.

**The `\n` versus `\neq` problem.** Both start with a backslash, so the obvious
`replace(/\\n/g, '\n')` turns "not equal" into a line break followed by the
letters `eq`. Resolved with a tokeniser that, at each backslash, tries in
order: (1) exact match against the known-command table, (2) a leading `n`/`t`/`r`
as a literal escape, (3) longest known command prefix, (4) emit literally.
`\neq` → ≠. `\nGive the value` → line break + "Give the value". Both correct,
deterministically.

**Security.** Input is HTML-escaped before any transformation, and every
transformation emits only markup this file generates. `rich()` is used only in
content positions; anything entering an HTML attribute (`value=`, `src=`,
`name=`, `data-val=`, `<option>` text) stays on `esc()`. That distinction is
documented in both files at the point of use.

### Where it was wired in

- `cbt.js` — new `CBT.rich()` / `CBT.plain()` helpers; passage, stem, all three
  option renderers, and the whole review panel (your answer / correct answer /
  why).
- `cbt-types.js` — new `rich()` helper and **18 call sites**. This mattered:
  `CBTTypes.render()` *wins the render race* in `cbt.js` for all seventeen
  advanced families, so fixing only `cbt.js` would have left every matching
  table, matrix grid, cloze, assertion/reason and multi-part numeric question
  still showing raw `\frac`.
- `cbt-review.html` — the fallback review renderer.
- Script tags added to **140 studio pages / 135 generator pages** (every page
  that loads `cbt.js`), plus a `sw.js` cache bump to `tc-shell-v12-20260828`.

### Verified against your file

60 items parsed, 0 JS exceptions, **0 raw LaTeX or escape sequences visible to
the candidate**, 10 real stacked fractions, 51 real line breaks, superscripts
correct. Screenshot evidence captured during the build.

---

## Item 2 — Randomisation

### The finding that changed the approach

`cbt_exams` has carried `shuffle_questions` and `shuffle_options` **since
migration v20**, and `cbt-results.html` has always offered the two checkboxes.
**Nothing ever read them.** The runtime served the authored CSV order to every
candidate. So this was not a missing feature — it was a dead setting, which is
worse, because a tutor could tick "Shuffle questions", believe the paper was
randomised, and seat thirty candidates in front of identical papers.

### `CBT.applyDelivery(questions, opts)` — the new delivery layer

**It shuffles groups, not rows.** A group is a standalone question or a whole
passage set. This is the constraint that ties items 2 and 5 together: shuffling
row-by-row scatters the five questions belonging to Passage A among Passage B's,
and the pinned passage would have to change on every card.

**It is seeded, not random.** `cbt-multi.html:242` used `Math.random()` at
*build* time — it froze one order into the saved paper (identical for every
candidate) and it split comprehension sets. The new shuffle runs at *sitting*
time, seeded on `exam.code + candidate identity`. Consequences:

- neighbouring candidates get genuinely different papers;
- a candidate who refreshes mid-exam rebuilds the **same** paper and keeps
  their place, instead of being handed a reshuffled one;
- a disputed result can be reconstructed exactly, months later.

**Option shuffling is provably safe.** Verified before writing a line:
`normalizeQuestion` resolves the `CorrectAnswer` letter (A–F) to the option
*text* at import time (`cbt.js:128–145`), and both graders compare by
normalised value, never by index. Moving an option cannot change a mark.

**Options that must not move are detected and pinned.** "All of the above",
"None of these", "Both A and B", and True/False and Yes/No pairs. The original
order is preserved on `q._orig_options`.

### Exposed in the CBT setup

`cbt-multi.html` gains a **Delivery & randomisation** fieldset with three
controls — randomise questions, randomise options, allow read-aloud — each with
an explanation of what it does and when not to use it. They persist to real
columns. `cbt-results.html`'s exam editor exposes the same three.

### Tested

200 simulated candidates × 300 iterations: **0 grading failures**, **0 split
passage sets**, multiple distinct orders, same-seed reproduction byte-identical,
True/False and "All of the above" never moved.

---

## Item 3 — Image / diagram stimulus prompt, hardened

The old pack rendered correctly but produced weak papers. It told the model
*where* to put a link and almost nothing about what makes a figure item valid.
Rewritten to international item-writing practice (Cambridge/Ofqual/WAEC figure
conventions, WCAG 1.1.1 and 1.4.1). New content:

**The honesty rule, first, in capitals.** The most damaging thing an AI can put
in this file is a *plausible* URL it has never seen: it imports cleanly, passes
every automated check, and then fails silently in front of a candidate under
timed conditions. The prompt now gives exactly two lawful options — a real
verifiable link, or the explicit placeholder `[[FIGURE: description]]` which the
tutor pastes over in one pass. Inventing a URL is banned in terms the model can
be graded against, and the checklist greps for the specific failure patterns
(`drive.google.com/file/d`, `google.com/search`, `encrypted-tbn`).

**The figure description contract.** The fallback is now defined as *part of the
item*, not a caption: kind of figure, every label verbatim, every readable
quantity with units and scale, and the orientation that matters — then the
question. With a stated self-test: *cover the image, read Col1 alone; if the
item is now unanswerable, it is defective.*

**Assessment weight.** International boards reject decorative figures. Each item
must require a named operation on the figure — read, compare, trace, identify,
interpolate, spot — tagged in Col16.

**Accessibility and fairness.** Colour is never the only cue (~1 in 12 male
candidates has a CVD); no measuring the screen with a ruler; no zooming to read
a value; text baked into an image is invisible to read-aloud and must be
repeated in Col1. Stems may not say "the diagram below" — on a phone showing one
card at a time there is no below.

**Delivery realities.** Drive links must be `uc?export=view&id=` form (a
`/file/d/.../view` link renders a Drive *page*, not an image); no link may
require sign-in, cookie or redirect; keep figures under ~300 KB.

Supporting runtime change: `normalizeQuestion` now lifts `media_url` out of the
Col14 `Items` JSON, and diverts a `[[FIGURE: …]]` placeholder to
`q.media_pending` so it never becomes a broken `<img src>`.

---

## Item 4 — Read-aloud — `assets/js/cbt-speech.js` (new)

**Free tools only, as instructed.** The Web Speech API (`speechSynthesis`) ships
in every modern browser, uses voices already on the device, needs no key, no
account and no network on most platforms, and costs nothing per character. It
is the only option consistent with this platform's zero-cost design law. There
is no paid fallback and no CDN.

**It reads the meaning, not the markup.** Speech goes through
`CBTRich.plain()`, a *second* renderer that walks the same tokens and emits
English: `\frac{3x+6}{9}` → "the fraction 3x plus 6, over 9"; `\sqrt[3]{27}` →
"the cube root of 27"; `x^2` → "x squared"; a matrix is read row by row;
`\theta` is read as "theta", because most free system voices silently *drop*
glyphs they have no phoneme for — which would delete a variable from the
question. This is the reason the item-1 prompt now insists on real commands:
`3x+6/9` is spoken as "3x plus 6 divided by 9", a different question.

**Exam integrity.** Candidate-initiated and per-question — nothing autoplays.
Cancelled on question change, on submit, on tab blur and on page hide, so audio
can never leak into the next question or over the results screen. During a live
exam the utterance is built from question + options only; explanations and
correct answers are never queued. On a passage set, the passage is read only on
the first question of the set.

**Robustness.** Long text is split at sentence boundaries (several engines
truncate or stall past ~200 characters); `onerror` advances the queue so one bad
chunk cannot hang it; `resume()` works around Chrome's paused-after-cancel bug;
the sentence splitter deliberately avoids regex lookbehind, which is a *parse
time* syntax error on Safari below 16.4 and would have killed the whole file on
older iPhones.

**Accessibility.** Real `<button>` with `aria-pressed`, `aria-live` mirror, Alt+R
/ Alt+S shortcuts (never plain keys — the candidate is typing answers), voice
picker preferring local/offline voices, speed control, and a test button. When
the browser has no support it says so plainly instead of showing a dead button.

**Per-paper switch.** `read_aloud` (new column, default true) — turn it off for
listening or reading-fluency papers where hearing the text voids the construct.

Also mounted on `cbt-review.html`, where reading the *whole* entry including the
correct answer and explanation is not only safe but the point.

---

## Item 5 — Pinned passages (UTME/JAMB English, and every other subject)

> "the passage/stimulus must stay on screen until all questions under it are
> answered before it goes away … it must not be limited to English."

So this was built as a **subject-neutral engine** with English as one dialect.

### Runtime

`CBT.passageKey(q)` identifies a set by explicit `passage_id` if given, else by
a hash of the passage text — which means a CSV that simply repeats the passage
on every row (what the prompt instructs) groups correctly with no new column.
`CBT.groupPassages()` collapses the flat list into ordered delivery groups.

`cbt-exam.html` paints the stimulus **once** into a sticky pane above the
question card, refreshed only when the candidate crosses into a *different* set
— repainting on every step would reset their scroll position inside a long
passage — with a live **"3 of 5 answered"** counter that turns "until all are
answered" from an implication into something visible.

Three implementation notes worth keeping, because two obvious approaches failed:

- The pane is **outside `#qbox`**, so the one-card-at-a-time paging cannot hide
  it.
- `position:sticky` had to go on the **wrapper**, not on the card inside it. A
  sticky element is confined to its own containing block; on the inner
  `<section>` it was pinned inside a one-element div and scrolled away — exactly
  the failure the feature exists to prevent.
- Scrolling had to be done by hand. `el.scrollIntoView({block:'start'})` put the
  question *underneath* the pinned furniture; `pane.scrollIntoView()` did
  nothing at all, because a stuck sticky element's current rect *is* its resting
  rect, so the browser computed a zero-pixel scroll. The runtime now measures
  the pinned title bar and pane and scrolls the window explicitly — and measures
  rather than hard-codes, because the title bar wraps to two lines on a narrow
  phone.

`normalizeQuestion` now also lifts `passage` out of the Col14 `Items` JSON (the
17-column header has no Passage column) and promotes a `set:P1` tag from Col16
to a first-class `passage_id`. Without that lift, `q.passage` was empty for
exactly these rows and every comprehension question would have formed its own
group, silently defeating the feature.

### Two new prompt packs

**`passage_set` — "Passage / stimulus set — pinned stimulus, any subject."** The
blueprint. Explains that the repeated Col14 passage *is the join key* and that a
one-character difference splits the set. Covers stimulus authoring for prose,
data tables, experimental methods, legal and constitutional extracts, historical
sources, dialogue, and numbered code listings; copyright; a seven-rung cognitive
ladder (retrieval → vocabulary → inference → purpose/tone → structure →
evaluation → synthesis) with a science/data substitution; the rule that no
question may reference another *by number*, since sets are shuffled as blocks;
and a worked five-row shape.

**`utme_english`** — the English dialect: the six real UTME sections
(Comprehension ×2, Summary, Lexis, Structure, Oral Forms) as `Section` values,
authentic register and passage lengths, the three classic summary distractor
traps *named in the explanation*, Nigerian-English interference points in
Structure, and Oral Forms encoded so it survives being read aloud (every
phonetic value paired with a keyword). Plus key-distribution and
option-length fairness rules.

Both are registered in the `cbt-prompts.html` picker.

---

## Item 6 — Explanation quality, on every type

Previously each pack carried its own one-line wish ("Explanations show the
working") and most packs said nothing, so a generator would happily emit
`Explanation = "B is correct."` A learner reading that on the review sheet
learns nothing — they already know they got it wrong.

`CBT.EXPLANATION_STANDARD` is now injected into **every** generated prompt,
ahead of the pack sections, so no pack can forget it or dilute it. It is written
as a fixed **four-move structure**, because "be detailed" is advice a model
ignores while "name the misconception behind each wrong option" is an
instruction it can be graded against:

1. **Verdict** — the answer in full words, never a bare letter. *Explicitly
   because option order can now be randomised per candidate, so a review sheet
   that says "B" is meaningless.* Items 2 and 6 interlock here.
2. **Reasoning** — numbered steps, the rule named at the step where it is used,
   quoted evidence for language items. "By simple calculation" is banned by
   name — it is the exact sentence a struggling learner cannot fill in.
3. **Distractor autopsy** — each wrong option in turn, with the *specific* slip
   that produces it ("Option A, 7/12, comes from adding numerators and
   denominators separately"). This is what turns a score into a diagnosis.
4. **Takeaway** — the transferable rule that prevents it next time.

With enforceable specifics: ≥45 words for a one-mark objective, ≥80 for numeric,
multi-part, case-study, essay and code; numbered lines using `\n`; the same
maths encoding as the stem; no "see above" or "as in question 4" (the learner
may be on a phone, out of order, weeks later); and tailored guidance for types
with no wrong options to dissect — numeric, matching/ordering/categorisation,
essay/code (full mark scheme, model answer, the two common ways marks are lost),
and fill-blank/short (every accepted variant, and why a near-miss is or is not
accepted).

Six matching entries were added to the **final checklist** of every prompt, so
the standard is graded rather than merely stated.

---

## Item 7 — Files changed

### New
| File | Purpose |
|---|---|
| `assets/js/cbt-richtext.js` | LaTeX + escape renderer, HTML and speech |
| `assets/js/cbt-speech.js` | Web Speech read-aloud engine |
| `database/v38-cbt-delivery-and-readaloud.sql` | `read_aloud` column + column comments |
| `tools/cbt-v39-smoke.py` | 60-check regression suite (generator repo) |

### Modified
| File | Change |
|---|---|
| `assets/js/cbt.js` | `rich()`/`plain()`; `applyDelivery`, `seededShuffle`, `groupPassages`, `passageKey`, `deliverySeed`; Col14 passage/media lift; `set:` tag → `passage_id`; `EXPLANATION_STANDARD`; `multiline_math` and `image_stimulus` rewritten; `passage_set` and `utme_english` added |
| `assets/js/cbt-types.js` | `rich()` + 18 display call sites |
| `cbt-exam.html` | delivery layer, pinned passage pane + counter, read-aloud mount, sticky measurement, speech stop on submit |
| `cbt-review.html` | rich rendering, per-question read-aloud |
| `cbt-multi.html` | Delivery & randomisation fieldset; build-time `Math.random()` removed; flags persisted |
| `cbt-prompts.html` | two new packs in the picker; encoding help rewritten |
| `cbt-results.html` | `read_aloud` in the exam editor; shuffle labels clarified |
| `database/complete-schema.sql` | v38 folded in; `read_aloud` added to `tc_cbt_schema_check` |
| `sw.js` | cache → `tc-shell-v12-20260828` |
| 140 studio / 135 generator pages | two script tags |

### Database

`tc_cbt_get_exam` returns `to_jsonb(exam)` — the whole row — so `read_aloud`,
`shuffle_questions` and `shuffle_options` reach the candidate page with no RPC
change. Only `database/complete-schema.sql` needs running; it remains a true
superset.

> **Still outstanding from the previous cycle:** `v36-anon-rls-predicate-grants.sql`
> has not been applied to the live Supabase project (no service-role key here).
> The 401s in the console during testing are that, not this work.

---

## Verification

```
$ python3 tools/cbt-v39-smoke.py
  ... 60 checks across http://127.0.0.1:8801 and :8802
  FAILURES: 0
```

Also run: `node --check` on every JS file in both repos (clean); inline-JS parse
of every HTML page (clean — the three flagged pages fail identically at `HEAD`
and are an artefact of the crude checker, not a regression); byte-parity diff of
every synced file.

### Known limits, stated plainly

- **Handwriting-grade LaTeX only.** The renderer covers the school/UTME/WAEC
  subset. Exotic packages, `\usepackage`, TikZ and commutative diagrams are not
  supported — they degrade to readable plain text rather than breaking, and the
  prompt tells authors to stay inside the subset.
- **Voice quality is the device's.** Web Speech uses whatever voices are
  installed; a low-end Android will sound worse than an iPhone. That is the
  trade for zero cost and offline operation.
- **Randomisation needs the tutor to switch it on.** Existing papers keep their
  current stored values; new papers created in `cbt-multi.html` default to
  question-shuffle on, option-shuffle off, read-aloud on.
