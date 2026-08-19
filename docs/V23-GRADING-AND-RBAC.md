# V23 — grading correctness, role mapping, and the reported bugs

**1,069 assertions, 0 failures** (was 932).

---

## Item 1 — Marks awarded for a blank paper (the serious one)

**Reproduced exactly.** A blank 20-question paper scored **3/20** in testing.

Root cause, in `CBTTypes.grade()`:

```js
return res(norm(given) === norm(ans) ? max : 0);
```

With nothing answered, `norm(given)` is `''`. On a question whose key is
missing or blank — **which is what a CSV with an empty CorrectAnswer column
produces** — `norm(ans)` is *also* `''`. So `'' === ''` was true and the
question awarded **full marks**. That is why the review then claimed you had
picked answers correctly: it genuinely believed you had.

Two guards now, in order:

1. **A blank response always scores zero.** No type, no exception. If you did
   not answer, you cannot be right.
2. **A question with no key is never marked correct.** It returns
   `unmarkable`, scores zero, and surfaces in the tutor's item analysis so the
   paper gets repaired. Silently awarding *and* silently failing are both wrong.

The same flaw existed in the legacy grader in `cbt.js` and is guarded there too.

**The "x of y answered" counter** was a separate bug with the same shape: the
test was `a !== ''`, and an empty **array** is not equal to `''` — so every
multi-select, ordering, matching, matrix, categorization, cloze and hot-text
question counted as answered the moment its empty control existed. Now uses a
real emptiness test.

Verified: blank paper → **0/20**, zero marked correct. A real attempt → 6/7.

---

## Item 3 — The audit showed nothing

`per_question` was declared `default '[]'::jsonb`, so it is **never NULL — it
is an empty array**. `coalesce(per_question, review, detail)` therefore
returned that empty default and never fell through to `review`, which is where
the runner actually stored the trail.

Fixed to pick the first source that genuinely *has* rows. Separately, the
runner was only sending score/answers/review — it now also sends
`per_question`, `started_at`, `finished_at`, `duration_sec`, `is_anonymous`,
`attempt_no`, `user_agent`, `exam_code` and `auto_submitted`.

---

## Item 4 — Full CBT management, on every paper

The V20 management actions lived only on `cbt-multi.html`, whose list is
filtered to `multi_subject = true`. **Any single-subject paper had no
management interface at all.** The results page lists every paper, so
**⚙ Manage** now sits there with all ten actions: close/open, share link,
WhatsApp, sit, preview, edit details, questions, export package, archive,
delete.

Preview flags any item whose key is **MISSING** — the exact condition that
caused item 1.

---

## Item 2 — The legend now covers all 32 types

It listed only the 17 base families, so `likert`, `drag_drop`, `timeline`,
`error_spotting`, `map_label` and 19 others were unexplained. Every declared
type is now covered — asserted by walking `CBT.allTypes()`. It also now tells
learners plainly that **an unanswered question always scores zero**.

---

## Item 5 — Multi-subject papers

The single **Subject** and **Topic** fields now hide for a multi-subject pack,
and each subject gets **its own topic box**. The prompt carries them per
subject and explicitly forbids applying one topic to all — "Quadratic
equations" is not a topic in English.

---

## Items 6, 7, 9, 10, 11 — Role mapping

The audit found the real cause: across 134 pages, `data-role-allow` only ever
held three values — `admin tutor staff`, `admin`, or `any`. There was **no
parent/student distinction** and **no concept of read-only**, so a page was
either invisible or fully writable.

New **`assets/js/rbac.js`** — one matrix, three levels (`none` / `read` /
`write`), with two decisions worth stating:

* **Deny by default.** An unlisted page is `none` for families. A new page
  cannot leak by being forgotten.
* **The database still decides.** This is least-privilege and usability; RLS
  remains the security boundary.

| | Student | Parent | Tutor | Admin |
| --- | --- | --- | --- | --- |
| Sessions, Complete a class, Quizzes, Exam targets, Learner cards, Learners, Engagements, Makeup credits, Groups, Tutors | hidden | hidden | write | write |
| The 23 pages you listed (bookings, goals, attendance, mastery, homework, reading, classwork, stream, scoresheet, progress reports, Learner 360, resources, library, LMS, e-resources, spaced practice, certificates, voting, polls, gallery, events, reminders, study log) | **read** | **read** | write | write |
| Invoices, payments, fees, wallet | hidden | **read** | read | write |
| Payroll, finance, licence, settings, security centre | hidden | hidden | hidden | write |

A learner has no business reading the family's invoices, so money is
parent-only. Read-only pages get a banner explaining that reading, searching,
printing and exporting all still work, and pointing at *Raise a concern* —
`crud.js` refuses the writes, so it is not merely cosmetic.

---

## Item 8 — Change password

The page had **no form at all** — its own description promised "a live
strength meter" and the body was one line of placeholder text.

Now built: current-password re-verification before the change (otherwise
anyone at an unlocked laptop could take the account), a transparent strength
meter, match checking, show/hide, **Sign out everywhere**, and an audit entry.

---

## Item 12 — Navigation spelling

**1,290** double-escaped ampersands across **128 pages** — `&amp;amp;` rendering
as `&amp;`. All collapsed; "Goals &amp; learning plans", "Voting &amp; polls",
"Reviews &amp; testimonials" and the rest now read correctly.

---

## Item 13 — Files updated

**New:** `assets/js/rbac.js`
**Changed:** `cbt-types.js`, `cbt.js`, `cbt-exam-kit.js`, `crud.js`, `app.js`,
`style.css`, `cbt-exam.html`, `cbt-results.html`, `cbt-prompts.html`,
`change-password.html`, `generator.js` (payload 218),
`database/v22-*.sql` + `complete-schema.sql`, `tools/test_runtime.js`,
and **128 pages** for the ampersand fix, **132** for `rbac.js`.

| Check | Result |
| --- | --- |
| Runtime (generator / client) | **1,069 pass, 0 fail** / all pass |
| Generator build | **all pass** — 218 files, 0 broken links |
| Integrity / schema / parity | **0 / 0 blockers / 0 behind** |

---

## Re-run `database/complete-schema.sql`

Item 3's audit fix is in SQL. Until you run it, the audit will keep showing an
empty question list even though the runner is now recording it.

## One caveat worth stating

Grading is fixed **from now on**. Results already stored were computed by the
broken grader and their scores are wrong — particularly any paper containing
questions with blank answer keys. Use **⚙ Manage → Preview** to find items
marked **MISSING**, repair them, then have affected candidates re-sit. I have
not silently rewritten historical results, because changing a stored mark
without telling anyone is its own kind of wrong.
