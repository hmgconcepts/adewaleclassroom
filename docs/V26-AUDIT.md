# Tutoring Connect — V26 audit and fix report

**Schema:** V25 → **V26** · **Repos updated:** `tutoringconnect`, `adewaleclassroom`, deliverable suite + ZIP.

## Verification before this was written

| Gate | Result |
|---|---|
| `tools/test_runtime.js` | **1,456 assertions, 0 failures** (was 1,325) |
| `tools/test_v26_verify.js` — **against the client build, using your three CSVs** | **21 / 21** |
| `tools/test_nav.js` — both repos | 61 + 61, 0 failures |
| `tools/test_v25_render.js` — both repos | 90 + 90, 0 failures |
| `tools/test_generator.js` | ALL PASSED — 244 files, 0 broken assets/links |
| `tools/audit_integrity.py` | 0 disconnected references |
| `tools/lint_schema_order.py` *(new)* | no forward references — the file runs top to bottom |
| `pglast` parse of `complete-schema.sql` | OK (8,354 lines) |

---

## Do this first

Run **`database/complete-schema.sql`**, then run this one line on its own:

```sql
notify pgrst, 'reload schema';
```

Then check it:

```sql
select public.tc_schema_ok();
```

It answers `Schema complete ✅ — N objects checked, none missing.` or names exactly what is absent.

---

## 9. Blank CBT scoring marks — **found and fixed**

You reported this twice. I reproduced it exactly, and the previous fixes missed it because they were looking at the *grader*. The grader was fine. The bug was in how answers were **harvested from the page**.

In `CBTTypes.collect`:

```js
var el = root.querySelector('[name="'+name+'"]:checked')
      || root.querySelector('[name="'+name+'"]');
return el ? el.value : '';
```

When a radio group has nothing checked, the first selector returns null and the `||` falls through to the second — which matches **the first radio in the group regardless of its state**. Every multiple-choice question silently answered itself with option A the moment the paper rendered.

Measured on your own files, untouched:

| Paper | Before | After |
|---|---|---|
| `your-new-beginning-in-christ.csv` | **56 / 100** | **0 / 100** |
| `navigating-tech-space-as-a-newbie.csv` | **35.4 / 60 (59%)** | **0 / 60** |
| `Ade your-new-beginning-in-christ.csv` | **15 / 100** | **0 / 100** |

The 59% is the tell: that paper keys most answers to A, so "always pick A" nearly passed it.

This one line caused all three symptoms you described — the score, the review page showing answers you never chose, and "x of y answered" before you had touched anything (it was reporting 65 of 100).

A second, smaller leak: **ordering** questions render pre-populated in a shuffled order, and `sync()` wrote that shuffle into the hidden input just to paint the position numbers. An untouched ordering question submitted a complete answer and collected partial credit by luck — the residual 2.3%. The hidden input is now only written once you actually move something.

## 2. "N questions have no answer key" — two causes

Diagnosed against your CSVs. Both causes were real; neither was your prompts' fault.

**Cause A — the key isn't in `CorrectAnswer`.** For cloze, ordering, matching and similar types, the HMG template puts the key in the **`Items`** column (a cloze with three blanks cannot fit in one cell). The importer only ever read `CorrectAnswer`. The importer now lifts the key out of `Items`/`Pairs`.

**Cause B — the cell is Python, not JSON.** Your files contained `['new creature|new creation', 'new']` and `{"min_words":40,"keywords":['sinner', 'forgiven']}`. `JSON.parse` rejects both. There is now a lenient parser handling single quotes, smart quotes, `True/False/None` and trailing commas.

| Paper | Flagged before | Flagged after | What remains |
|---|---|---|---|
| `your-new-beginning-in-christ.csv` | 20 | 10 | all essays |
| `Ade your-new-beginning-in-christ.csv` | 20 | 10 | all essays |
| `navigating-tech-space-as-a-newbie.csv` | 12 | 6 | all essays |

The remainder are **essays**, which correctly have no machine key. The preview no longer lumps them together with broken rows — it now shows two separate, differently-coloured messages: a red one for genuinely unkeyed questions (with the question numbers), and a blue one explaining that essays go to your marking queue and are never scored as wrong.

You were right that video/material-link prompts trigger it more: those packs generate more essay and ordering questions.

## 7. Tutor marking of open-response questions — new

There was a worse problem here than a missing feature. The grader already returned `pending: true` for essays, but **nothing consumed it**. The score written to the database counted only auto-marked questions while the total counted all of them — so a 20-question paper with 5 essays reported 11/20 when only 15 questions had been assessed, and that mark went to the scoresheet and the progress report as if final. Nobody was told.

Now: **CBT results → Marking queue** (top of the page). It shows the question, the candidate's answer, machine notes (keyword hits, word count), the model answer side by side, and quick 0 / half / full buttons. The total is **recomputed in the database** by `tc_cbt_award_marks()` from auto marks plus awarded marks, so a typed total cannot disagree with its parts. The result is **held back from the family** until marking is complete, then released deliberately. `marked_by` and `marked_at` are stamped every time.

## 11. "A table is missing" on Share

Two causes, neither a missing table.

**The message was wrong.** `schema-doctor.js` tested `/does not exist/` — which matches `function ... does not exist` — *before* any function-specific pattern. A missing **function** was announced as a missing **table**, so the advice ("run complete-schema.sql to install every table") was useless.

**Re-running couldn't help.** Supabase serves RPC through PostgREST, which **caches the schema**. A function created seconds ago can exist and still be invisible to the API, with an identical error. Re-running the SQL does not clear it. `complete-schema.sql` now **ends** with `notify pgrst, 'reload schema';`.

Also: Share no longer refuses to work. The link doesn't need the database — the paper already has a code — so the link is built and shown first, and the tracking token is a bonus. If the RPC is unavailable you get a working link plus precise instructions, not a dead end mid-class.

## 8. Popup legibility — **the previous fixes were dead code**

Your frustration was justified. Every dark-mode popup rule was written as `body.dark-mode .modal`, but nothing sets that class. `App.toggleDarkMode()` does `document.body.dataset.theme = 'dark'` → `body[data-theme="dark"]`. **A different selector.** So in dark mode none of it applied: the popup kept `background:#ffffff !important` from the light rule and the text inherited the near-white body colour. White on white.

Second fault: only `.modal` was covered. Page Help, the assistant panel, the notification tray, the quiz dialogs and the record drawer are separate elements with inline styles, most setting a background and no colour.

One authoritative layer now covers all of them, in both themes, with both selectors. Contrast measured: 17.4:1 light, 15.9:1 dark, 7.0:1 and 6.4:1 for muted text (AA needs 4.5:1).

## 1. Maths keyboard and scientific calculator

**Calculator.** The `2nd` key was literally `if (k === '2nd') { return; }` — a dead button. And `logb(8,2)` returned **0.333 instead of 3**: it read its arguments as `logb(base, value)` while Excel, Casio and Desmos all take the value first. In an exam that is a lost mark the candidate cannot see. Added: sec/csc/cot and inverses, inverse hyperbolics, `hypot`, `mod`, `gcd`, `lcm`, `min`, `max`, `mean`, `trunc`, `frac`, `log2`, `root(x,n)`, `atan2`, `±` sign toggle, `EE`, working `2nd` shift, physics constants, and an on-screen reference. Your expression survives a mode toggle now.

**Maths keyboard.** From ~70 symbols in 7 groups to **292 in 15 groups**, with a **search box** (type "integral", "alpha", "subset"). Added: full Greek upper and lower, superscripts and subscripts 0–9, number sets ℕ ℤ ℚ ℝ ℂ, logic, geometry, brackets, statistics (x̄, χ², ŷ, p̂, H₀), vectors and matrices, and a chemistry set that can now actually write a formula.

## 12. Topic boxes losing focus

Each topic box had `addEventListener('input', build)` → `build()` → `syncFields()` → `syncSubjectTopics()` → `host.innerHTML = ...`. **Every keystroke destroyed the input you were typing into.** On a phone, losing focus closes the keyboard — one letter per tap, exactly as you described.

`syncSubjectTopics()` is now incremental: it returns immediately if the subject list hasn't changed, and when it has, it **reuses** the existing elements (`appendChild` moves a node, it doesn't clone it). Typing a topic calls only `renderPrompt()`, which touches nothing but the output box.

Verified headlessly: typing 19 characters → **0 element replacements, 0 focus losses**, and adding a fourth subject preserves the topics already typed.

## 4, 5, 13, 3. HMG content — corrected against the live sites

I opened them rather than guessing.

- **Item 5:** GOSA was wrong. It is **God of Seed Academy — School Portal**, a live School Connect deployment for a real school, motto *Excellence in Learning and Character*. Rewritten with what the site actually offers, and the comparison table no longer files it under "association".
- **Item 13:** the School Connect link now points to **schoolconnectdemo.vercel.app**. The generator link is gone from the catalogue entirely — a test asserts it can't come back.
- **Item 4:** HMG Ecosystem now carries the same **eight flyer-led service cards** School Connect and GOSA use (Business Connect, CBT Solutions, Church Connect, IELTS, E-commerce, School Connect, HMG Academy, Website Development). The flyers themselves ship with the build.
- **Item 3:** brand and persona taken from your sites — est. 2015, *His Marvellous Grace*, "Learning Deliberately. Teaching Authentically.", the four live arms, and the three builder modes with your correct titles and links.

## 6. Self-contained schema

- `tc_schema_selftest()` lists **every** table, function and column the app depends on and reports presence — `select * from public.tc_schema_selftest() where present = false;`
- `tc_schema_ok()` gives the one-line answer.
- The file **ends** with the PostgREST reload, then the self-check, so the last thing you see is whether it worked.
- New `tools/lint_schema_order.py` proves no statement references an object before it is created — the failure mode where one error abandons the rest of the script and re-running can't help.
- All the Settings columns the V25 cards write to are now created, so that page can't fail on a missing column.

## 10. Tutor scoping

The RLS was installed in V24/V25. What was missing is that **you had no way to see whether it was working** — which is why this keeps coming back. Two things make it look broken when it isn't: the SQL hasn't been run, or `tutors.user_id` isn't linked (which fails *safe* — the tutor sees less, not more — but looks like a broken product).

There is now a **"What you can reach"** panel on the Dashboard, Tutors and Roles & status pages. It states your role, whether your sign-in is linked to a tutor record, and how many engagements, learners and papers you can see. If scoping isn't installed at all it says so **in red**, warning that every tutor can currently see everything.

## 14. All repos updated

`sync_all.sh` now runs three verification suites against **both** repos before packaging. Generator manifest updated with the new scripts, the SQL pack and the eight flyers — without that, a generated ZIP would ship a broken ecosystem page.

- `tutoringconnect` 136 pages / 293 files · `adewaleclassroom` 135 pages / 261 files
- ZIP: 636 entries, 11 MB (up from 4.7 MB — the flyers are 2.8 MB)

---

## What I did not do, and what I'm unsure about

1. **The SQL is still parser-validated, not executed.** No PostgreSQL binary in this sandbox and I can't install one. `tc_schema_ok()` exists precisely so *you* can verify in one line.

2. **Item 11 — I could not reproduce your exact failure**, because I can't reach your database. I fixed the misclassified message (certain), added the cache reload (the most likely real cause), and made Share degrade gracefully (certain). If it persists after the reload, run `select public.tc_schema_ok();` and send me the output — that will name the missing object.

3. **Historical CBT results are still wrong** and I have still not rewritten them. Every result recorded before today was scored by the harvester that auto-answered option A. **They are not merely imprecise — they are inflated.** I did not touch them because silently rewriting a student's mark is worse than leaving a known-bad one. Recommendation: re-sit anything that matters, or discount pre-V26 results.

4. **Item 7's marking queue needs `per_question` on the submission.** Papers sat before V22 don't have it; the desk says so plainly rather than guessing.

5. **The three CSVs are now test fixtures** in `tools/fixtures-csv/`. They contain your teaching content. If you'd rather they not ship in the repo, say so and I'll replace them with synthetic equivalents.

6. **I have not visually inspected the popup fix in a real browser** — I verified the CSS selectors and contrast ratios statically. Please open one popup in dark mode and tell me if anything is still unreadable.

7. **`builder.html` remains unauthenticated**, and there is still **no update channel** across generated studios.
