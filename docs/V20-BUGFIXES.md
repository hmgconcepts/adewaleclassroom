# V20 — the 18 reported bugs, fixed and verified

Every item below was **reproduced in the code before being fixed**, and each has
at least one regression assertion so it cannot come back. Test count: **704**
(was 617).

---

## 1. Full CBT editing — School Connect parity

**Before:** two actions per paper (Sit, Copy link).
**Now:** ten, matching School Connect's `cbt.html` action for action, on top of
the workbench's own View / Edit / Copy / Delete.

| Action | What it does |
| --- | --- |
| 🔓 Open / close | Opens or closes the paper to candidates |
| ▶ Sit | Opens it exactly as a candidate sees it |
| 🔗 Link | Copies the candidate sit-link |
| 👁 Preview | Every question and its **recognised** answer; missing answers in red |
| ✏️ Questions | Edit text, type, options, answer and marks; **reorder** ↑↓; delete; save in bulk |
| ＋CSV | Append more questions from a file — nothing is replaced |
| 📊 Results | Who sat it, scores, average, CSV export |
| ⬇ Export | The whole paper as a JSON package |
| 🩺 Diagnose | Finds questions that **can never be marked correct** |
| 📦 Archive | Archive or restore |

The diagnoser is the one worth knowing about: it catches an answer that is not
one of its own options — the commonest reason a paper silently marks everyone
wrong.

## 2. Nav gaps before Dashboard

Section headings (`◈ Core`, `✉ Growth` …) stayed on screen when the role filter
hid **all** the links beneath them. A parent, who can reach few pages, saw a
column of headings with nothing under them. Headings now follow their contents.

## 3. Nav search returning nothing

Two faults. The filter only toggled the `<a>` elements, so a search for "wallet"
left eleven headings on screen with one link buried among them. And it matched
against `textContent`, which includes the bullet glyph, so multi-word searches
like "payment plan" failed. Now: glyphs stripped, whitespace collapsed,
**every word must match**, and the filename and module id are searched too.

## 4. One question per page

`state.questions.map(...).join('')` painted the whole paper at once. Now exactly
one card is visible, with **‹ Previous / Next ›**, a live "Question 3 of 40",
the number palette switching cards instead of scrolling, and ←/→ keys.

Every card stays in the DOM, so answers are never lost when moving about and
`collectAnswers()` is untouched. Subject tabs set state rather than toggling
display — the two mechanisms were fighting.

## 5. Calculator / maths keyboard flagged as cheating

Two causes:

1. `window.blur` logged a violation **unconditionally**. Focus moving to an
   in-page tool — or a phone's soft keyboard appearing — tripped it.
2. `copy`/`cut`/`paste`/`contextmenu` were bound to the whole document, so
   copying a result out of the calculator counted as cheating.

Now the blur handler waits a tick and asks `document.hasFocus()`; if the
document still has focus, nothing left the exam. And any event inside a studio
tool is exempt. **A tool the studio deliberately provides can never be evidence
of cheating.**

## 6. School Connect CSV now imports unchanged

`cbt.js` is now a strict **superset** of School Connect's aliases: `opt_a`,
`choice_a`, `option1`, `answer_key`, `correctOption`, `multiple_select`,
`checkboxes` and more. It also resolves a **letter answer** (`B`) to the option
text, which School Connect did at grading time — so the same file grades
identically in both products.

Verified against five real School Connect row shapes.

## 7. Prompt packs now demand a downloadable file

Added as instruction **0**, before everything else: *"OUTPUT A DOWNLOADABLE .CSV
FILE — NOT RAW CSV TEXT"*, with a named filename and a fallback only if the model
genuinely cannot emit a file. The old "copy the block into a plain text editor"
instruction is gone.

## 8 + 17. Assistant icon did nothing

`app.js` created a **second, dead** 💬 button (`.tc-chat-fab`,
`data-chatbot="open"`) at `right:20px/bottom:20px`, while `chatbot.js` creates
the real one at `right:18px/bottom:18px` — **same z-index**. A grep of the whole
codebase showed **nothing binds `data-chatbot="open"`**. The button users could
hit was the dead one.

Now: when the real assistant is present the duplicate is never created and any
existing one is removed; if it is ever built (stripped build) it is fully wired;
and legacy markup is delegated to the real assistant. Verified: **1 FAB**.

## 9. "Lumen Tutoring Studio" → "HMG Tutoring Studio"

Renamed everywhere. Worth flagging: my blanket rename also rewrote a test
assertion into `!/HMG/` — the opposite of intent. Caught it and replaced it with
an explicit pair: "Lumen" absent **and** "HMG Tutoring Studio" present.

## 10. `Could not find the 'calculator' column`

`cbt_exams` was created with **seven** columns; the builder writes twenty-eight.
`calculator`, `math_keyboard`, `subject_breakdown`, `identity_mode`,
`instructions`, `exam_type`, `csv_data`, `csv_source` had **never** been added.
PostgREST rejects the whole insert at the first unknown column, so saving failed
outright.

All added, plus 8 more the builder will want (pass_mark, shuffle, opens/closes),
plus **`tc_cbt_schema_check()`** so this class of bug is caught by a query rather
than by a tutor losing their work.

## 11. Popup text illegible

`.modal` set `background: white` but **never set a text colour**, so it inherited
from the app shell — a light grey meant for a dark surface. White on white.
Now pinned to `#0f172a` (**17.4:1**), with muted text at 7.0:1, inputs, links,
toasts and a full dark-mode set.

## 12. Voting & polls — no way to create

Correct: the page could list and vote but had **no create path**. Added the full
School Connect set: unlimited options, single/multi with a cap, audience, closing
time, quorum, results-visibility policy, anonymity, three one-click option
presets, and a management grid so any poll can be edited or reopened.

Also fixed **my own V20 bug**: `tc_create_poll` wrote to a `question` column that
does not exist (the table has `title`, and `options` is `text`, not jsonb).

## 13. E-receipts wouldn't print

Three faults: the panel queried `invoices.total` (the column is `amount`), it
gave up permanently if Supabase hadn't initialised within 900 ms, and receipts
could only be printed from a separate panel — never from the row just created.
All three fixed; the payments grid now carries its own 🧾 Receipt button.

## 14. Class stream not editable

`stream_posts` had **no CRUD schema**, so the page could only append. Registered
it — the page now has the full workbench: edit, delete, duplicate, filter, sort,
page, export, print.

## 15. Type-in fields that should be dropdowns

19 fields converted. These columns store a **name**, not a foreign key, so `ref`
could not be used — I added a **`lookup`** control that offers a real dropdown
built from live rows but stores the text the column expects, with "➕ Type a new
one" so nobody is ever blocked by a name not yet on the list.

Covers learner, tutor, cover tutor, parent, subject, exam and student ID fields.

## 16. No predefined prompts on the bot

Verified present — 10 suggestion chips render on open. What was broken was
**reaching** the bot at all (items 8/17). With the dead button removed the chips
are visible.

## Two-factor authentication (as promised)

TOTP via **Supabase Auth**, which is free — no SMS bill, no third-party service.
QR enrolment, six-digit verification, unenrol, per-role policy, grace period, and
an admin compliance report showing who has and has not enrolled.

The studio stores **only whether you enrolled** — never a secret, never a code.
Stated plainly on the page, because a security feature that overstates itself is
worse than none.

---

## Verification

| Check | Result |
| --- | --- |
| Runtime (generator) | **704 pass, 0 fail** |
| Runtime (client) | **all pass** |
| Generator build | **all pass**, 0 broken assets, 0 broken links |
| Integrity audit | **0 disconnected references** |
| `pglast` parse | **OK** |
| `lint_schema.py` | **0 blockers** |
| Parity | **0 pages behind** |
| Live preview | all pages 200, every fix marker present |

## Item 18 — files updated

`database/v20-cbt-2fa-polls.sql` (new), `complete-schema.sql` (→ V20),
`assets/js/` — `crud.js`, `app.js`, `cbt.js`, `cbt-exam-kit.js`,
`assets/css/style.css`, and pages `cbt-exam.html`, `cbt-multi.html`,
`voting.html`, `stream.html`, `payments.html`, `security-centre.html`,
plus `README.md`, `tools/test_runtime.js`.

All present in **both** repos and both suite copies. Zip: **546 entries**.

---

## You must re-run the schema

`database/complete-schema.sql` — **bug 10 cannot be fixed from the front end.**
Until you run it, saving a quiz will keep failing, and the wallet, payment plans,
polls creation and 2FA pages will say *"Not installed yet"*.
