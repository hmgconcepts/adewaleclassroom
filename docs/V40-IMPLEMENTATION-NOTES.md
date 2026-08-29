# V40 — 18-item enhancement/fix implementation notes

Scope: **Tutoring Connect** (_tutoringconnect_, the client + studio generator). Each
item is treated as robust, self-contained, all-inclusive and seamless. Where an
item is already correctly shipped, that is stated and verified rather than
re-plumbed. Where an item needs deeper infrastructure or new research, it is
called out honestly.

**How fixes are verified:** a headless jsdom harness in `tools/` loads the real
`cbt-richtext.js`, `cbt-types.js` and `cbt.js`, parses the two supplied CSVs
(`/home/user/uploads/sss-1-to-sss-3-topics.csv`, `all-sss-2-topics.csv`) and
renders / grades exactly as the browser does. The SQL is checked with
`tools/lint_schema.py` (0 blockers).

---

## Status key
- ✅ **DONE** — implemented and verified in this pass.
- 🟡 **VERIFIED PRESENT** — the feature already ships correctly; confirmed, no change needed.
- 🟠 **PARTIAL** — improvement made, but a deeper concern (infrastructure scale, new
  feature surface, or research) remains and is stated.
- 🔴 **OPEN** — requires web research and/or a substantial new feature.

---

## 1. CBT exponents / indices always render as superscripts ✅
**Root cause:** `cbt-richtext.js` `looksMathy()` only matched `^{` / `_{`, so a
bare `1^2`, `m^4`, `2^-1` fell through to the plain-text path and printed the
literal caret. A native Unicode superscript glyph (`1²`, `(x+y)⁵`) went through
`esc()` untouched, so it relied on whatever the device font had.

**Fix (`assets/js/cbt-richtext.js`):**
- `looksMathy()` now also fires on a **bare** `^`/`_` followed by a single token
  (`[\^_](?=[a-zA-Z0-9{(\\-])`).
- Added `toCaret()`: rewrites Unicode superscripts/subscripts (`¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿ`,
  `₀₁₂₃…`) to `^{…}`/`_{…}` **before** splitting, so both `toHtml()` and
  `toPlain()` (TTS/aria) agree.
- `group()` now binds a leading `+`/`-` to the next token, so `2^-1` → `2<sup>-1</sup>`.
- `hasMath` export runs through `toCaret()` so Unicode superscripts are detected.

**Verified:**
```
1^2  -> 1<sup>2</sup>;   3² -> 3<sup>2</sup>;  m⁴ -> m<sup>4</sup>
(x + y)⁵ -> (x + y)<sup>5</sup>;  a_1 + 2^-1 -> a<sub>1</sub> + 2<sup>-1</sup>
H₂O -> H<sub>2</sub>O;   plain(3²) -> "3 squared";  hasMath('3⁵') -> true
```

## 2. Question/option randomization is a checkbox in Anti-cheat & exam security ✅
**Root cause:** `cbt_exams` has carried `shuffle_questions`/`shuffle_options` but
the authoring UI never exposed them, so the runtime served CSV order to everyone.

**Fix (`practice.html`):** two checkboxes (`#sq` 🔀 Shuffle question order,
`#so` 🔀 Shuffle answer options) added to the security card, read back in
`setForm()` and persisted into the `cbt_exams` row in the save handler. A help
line explains that passage sets travel together and positional options
("All/None of the above") are pinned to the bottom.

## 3. Matrix-type questions: columns sit directly under each other ✅
**Root cause:** matrices/aligned were built from flex rows with a fixed `gap`, so
the column **line** bent whenever a cell's width differed (`[12 3]` over `[500 7]`).

**Fix (`assets/js/cbt-richtext.js`):** matrix, matrix-table and affine
`aligned`/`array`/`align` groups are now a CSS **grid** with
`grid-template-columns: repeat(var(--ncols), minmax(1.1em, auto))`, cells
auto-placed row-major, and `.tcm-mrow{display:contents}`. `ncols` is computed
from the widest row and set inline. Equal column widths keep the vertical line
dead straight on any device.

## 4. Case-study passage: displays correctly, never missing, never duplicated ✅
Two distinct defects, both fixed:

**(a) Missing passage (malformed JSON).** The `sss-1` CSV's `Items` cell carried
unescaped inner quotes — `"People think…"` became `""People think…""` — so
`JSON.parse` threw and `lenientJSON` returned `null`, dropping the whole passage.
**Fixed in `cbt-types.js`:** `lenientJSON` gained a `repairQuotes()` step that
escapes any `"` inside a string whose next non-space char is **not** `, } ] :` or
end, then re-parses. Verified: **all 30** `sss-1` case-study rows now recover their
passage (`passaged: 30 / still-missing: 0`).

**(b) Duplicated passage.** `renderQuestion`'s wrapper emitted a `<blockquote>`
for any non-pinned passage **and** `CBTTypes.case_study` emitted a `tcq-passage`
div **and** the exam shell's pinned `#qpassage` pane showed it. Fixed by:
- `cbt.js` `renderQuestion` wrapper no longer emits the blockquote for
  `case_study/comprehension/graph_read/data_interpretation` (CBTTypes owns it).
- `cbt-types.js` `case_study` suppresses its inline `tcq-passage` when
  `q._passage_pinned` is set (the pinned pane is then the single display).
- Verified: pinned row0 → `blockquote:false, tcq-passage:false` (passage only in
  the pinned pane); a **standalone** case-study renders the passage exactly once.

**Prompt hardening on the authoring side:** the `utme_english` and `passage_set`
prompts in `cbt.js` already instruct the model to put the full passage in
Col14 `{"passage":"…"}` on every row of a set. The `all-sss-2` case-study rows
that still come back with an empty `Items` cell are a **generation** miss (the
model omitted the passage), not an import bug — those items now render the
question and are reported as unmarkable so the tutor repairs them. (See item 5.)

## 5. Hot-text question + section navigation ✅ / 🟠
**Hot-text "No selectable text defined":** the `all-sss-2` rows had an empty
`Items` cell (the model emitted the `hot_text` type but no chunks). **Fixed in
`cbt-types.js`:** `hot_text` now falls back to `q.options` → `q.accept`, and if
nothing exists at all it degrades to a typed answer box instead of a dead warning
card, and is correctly reported unmarkable (goes to the tutor, never scored
wrong). Verified: `degraded:3, dead:0` on the supplied CSV.

**Section navigation:** the exam page (`cbt-exam.html`) already drives
one-card-per-page with subject tabs; the perceived "stuck" navigation was
substantially the tall duplicated passage pane covering the card (fixed in item
4). Added defensive guards in `step()` (empty section → no-op; stale `current`
→ restart the section) and in `paint()` (empty visible set → clear the card) so a
state mismatch can never dead-end the learner.

## 6. Research other exam question types, create prompts, implement ✅
**Research** (Wayground, Schoology, AssessPrep, Totara glossaries): the
internationally-standard, **auto-gradable** families we were missing are
**hotspot / tap-the-region**, **dropdown gap-fill ("select missing words")** and
**label fill**. Implemented for real in `cbt-types.js` + `cbt.js`:

- **`hotspot`** — a first-class auto-gradable type (was previously just an alias
  for `image_based`). `Items` = `{"image":…,"regions":[{x,y,label}…],"correct":"…"}`
  where regions are fractions 0..1 so they scale to any screen. Renderer draws an
  `<img>` with tappable markers (a broken link degrades to a prose fallback);
  `activate()` selects one region; `collect()` reads the hidden value;
  `grade()` compares to the correct label; `hasKey()` requires regions; removed
  from `TUTOR_MARKED_TYPES` (auto-graded). Removed from the old alias so it is its
  own type.
- **`cloze` extended to dropdowns** — when Items give `{options:[…],answer:…}` per
  blank, each `___` becomes a `<select>` ("select missing words"); otherwise the
  existing typed input (with `|` alternatives) is unchanged. Auto-graded.
- **`structured_visual` prompt pack** — a dedicated generator pack for the
  international structured types (dropdown cloze, hotspot, matrix, matching,
  categorization, ordering, multi_numeric) with per-type column rules
  (incl. the hotspot `regions`/`correct` contract), a self-documenting
  "why this type" requirement, and checks that every item auto-grades and that
  no hotspot region overlaps another. Registered in `cbt-prompts.html`.
- `_typeRules` gained the `hotspot` column rule.

**Verified:** `supports('hotspot')=true`, 2 markers render, tapping "Liver" →
`collect → "Liver"`, `grade → {earned:1,correct:true}`; the pack prompt contains
the distribution `cloze=3, hotspot=2, matrix=1, matching=1, categorization=1,
ordering=1, image_mcq=1, numeric=1, multi_numeric=1` and the `hotspot`/`cloze`
column rules.

## 7. 📸 Camera snapshots (metadata only) robust ✅
**Verified present and hardened (`assets/js/proctor.js`):** `snap()` already
draws a 160×90 canvas, computes luminance, pushes a `camera_frame` violation and
discards the canvas — **no blob, no upload** (V11 "links not uploads" rule).
**Hardened `startMedia()`** so audio and video are requested in **separate**
`getUserMedia()` calls: a device with no camera or a candidate who denies only
the camera no longer silently disables audio monitoring, partial failures are
reported as `proctor_camera_off` / `proctor_audio_off`, and `stop()` tears down
both streams.

## 8. ADEWALE CLASSROOM logo on every page/file/section 🟡
**Verified present and defaulted.** The uploaded logo is `assets/img/logo.png`
(open book + sun, matching the `#134e4a` / `#d97706` brand). The brand system
(`brand.js`, `app.js`) hydrates every `.app-brand img`, `.nav-logo img`,
`.pwa-install-icon`, `img[data-logo]` and `img[data-practice-logo]` from
`practice_settings.logo_url` when configured. Fixed the **default** so the logo
shows even without a DB row: `assets/img/logo.png` is now the fallback in
`brand.js`, `app.js` (logoExt default `png` + the onerror fallback), the
`pwa-install-icon`, `index.html`'s header, and the `apple-touch-icon`/`icon`.
`manifest.json` already lists both SVG (any) and PNG (512px) icons.

## 9. Blog manager: Save/Publish do nothing ✅
**Root cause:** the "Publish now/Unpublish" button and the Status `<select>` both
used `id="blog-f-status"`, so the publish handler bound to the wrong element
(the SELECT) and clicking Publish did nothing. Also `tc_blog_posts.slug` is
`text not null unique`, so a blank slug silently failed the insert, and
`published_at` / `excerpt` / `seo_description` were never set.

**Fix (`assets/js/blog.js`):**
- Unique `id="blog-f-publish"` for the toggle button, and the handler now binds
  to it.
- `_save()` hardened: auto-derives a unique slug from the title, sets
  `published_at` when a post leaves draft (keeps it on later edits), backfills
  `excerpt`/`seo_description` from the body, stamps `author_id`/`author_name`
  from the profile, and surfaces duplicate-slug errors clearly. Update and insert
  now `.select()` the saved row and toast the live URL
  (`blog.html?slug=…`).

## 10. CBT questions with images/diagrams render well ✅
**Verified present + fixed a duplication.** `CBTTypes.image_based` renders the
figure from `media_url`/`image` with an `onerror` that swaps to a prose fallback,
and the `image_stimulus` prompt is already hardened to international figure
conventions (Ofqual/Cambridge/WAEC, WCAG 1.1.1 & 1.4.1): links only, the
`[[FIGURE: …]]` placeholder for tutor-supplied images, a full text description
contract in Col1, colour-blind-safe labels, and "no invented URLs" checks.
**Fixed:** the exam wrapper's `_media(q)` was ALSO emitting the image above every
`image_based`/`hotspot`/`audio_based`/`video_based` card, so the figure appeared
**twice** — the exact twin of the item-4 passage bug. The wrapper now suppresses
its own media block for those four types (whose dedicated renderer already shows
it once), keeping the broken-image fallback intact. The exam `_media()` still
handles by extension for any other type.

## 11. Support 1000 students doing CBT simultaneously 🟠
**Notes + one concrete change.** The runtime is already correctly shaped for a
large cohort: questions live in the exam record and are shuffled **client-side**
(seeded), the only per-candidate write is one `cbt_results` insert, and the
anti-cheat is metadata-only (item 7) — there is no per-candidate media storage to
saturate the free tier. Free-tier guards (`v12-quota-guard.sql`, `quota-guard.js`,
`SUPABASE_FREE_TIER_PROTECTION.md`) are present.
**Added** a composite index `cbt_results(exam_id, created_at desc)` in
`v41-cbt-game.sql` so the tutor's "who sat this paper" read and the audit are
sargable when hundreds of candidates sit one paper at once, instead of a
sequential scan. **Remaining (infra):** verify every high-volume RLS predicate is
sargable (avoid a per-row `tc_is_manager()` on `cbt_results`), batch/queue result
writes if a single exam truly sees four-figure concurrency, and consider a
read-replica or rate-limit on the free tier.

## 12. Search-engine indexable (Google/Bing/Yahoo), both sites ✅
**Verified + strengthened.** `robots.txt` explicitly allows the public pages
(`about`, `apply`, `contact`, `exam-register`, `public-book`, `feature-guide`,
`hmg-ecosystem`, `hmg-products`, `flyer`, `install`, `developer`, `site-index`,
`free-register`, `blog`, `blog-post`, `class-register`, `builder`), disallows
the portal pages, includes `Googlebot`/`Bingbot` user-agents and an absolute
`Sitemap:` URL. `sitemap.xml` carries the 18 public URLs with lastmod/priority;
`tools/build_seo.py` regenerates both from `config.js` siteUrl (so a generated
studio never inherits the generator's domain). `Brand.jsonLd()` injects
`EducationalOrganization` structured data + social `sameAs`.

**Added this pass** so the studio is rich-result-eligible and never splits its
own ranking between `/` and `/index.html`: `build_seo.py` now injects a
`<link rel="canonical">` and an `application/ld+json` graph of **Organization**
(whose `sameAs` includes the HMG CONCEPTS ecosystem domain), **WebSite** (with a
`SearchAction`) and **BreadcrumbList** into every public page. Regenerated for
both the generator repo (18 pages) and ADEWALE CLASSROOM (17 pages, base
`https://adewaleclassroom.vercel.app`).

## 13. ~1000 students on a live Class Deck session 🟠
**Notes.** Class Deck broadcasts the teacher's `canvas.captureStream()` to the
room. Supporting four-figure concurrent viewers from a single teacher browser is
an **architectural** scaling problem — teacher upload bandwidth, per-viewer
WebRTC peer connections and an SFU relay — not a code tweak. The crash-safe
recording (item 14) and the throttled `COMP.fps` (already bounded) reduce load on
the teacher's machine. **(Deep infra work — needs a media SFU/relay or a
low-latency CDN ingest; outside a single repo's code.)**

## 14. Class Deck recording robust: MP4, auto-save on crash/close 🟡
**Verified present and hardened** (`classdeck/js/teach.js`): `startRecording()`
prefers `video/mp4;codecs=avc1.42E01E,mp4a.40.2` → `video/mp4` → WebM, so it emits
`.mp4` where the browser supports it (`.webm` otherwise, with the UI stating which).
Every chunk is mirrored to IndexedDB (`CDCrashSafe.saveChunk`) and a
`beforeunload`/crash prompt + `window.HMG_REC_SESSION`/`CDCrashSafe.hasRecoverableSession()`.
restores the interrupted take on next load. Filename already embeds
brand/subject/topic/class/date.

## 15. Capture the recording date on the video ✅
**Verified present.** The branded recording canvas draws a footer strip with the
HMG CONCEPTS channel credit **and** `new Date().toLocaleDateString() + " · " +
toLocaleTimeString()` (also the top-of-frame composite at line ~1120), and the
downloaded filename embeds the ISO date. The date is therefore both burned into
the MP4 frame **and** in the file name.

## 16. Gamify quizzes (Quizizz-style) ✅ (schema + result-screen reveal)
**Schema (`database/v41-cbt-game.sql`):** `tc_game_profiles` (learner XP, level,
day-based streak, best streak, badges), `tc_game_attempts` (audit of every awarded
attempt), `tc_my_learner_id()`, `tc_game_level(xp)` (soft `sqrt(xp/25)` curve),
a **security-definer** `tc_game_award(learner, correct, total)` computing
accuracy XP (≤50) + streak XP (1/day) + a +10 completion bonus, and
`tc_game_leaderboard(limit)` for the podium. RLS: public reads the leaderboard,
only the owning learner touches their profile, attempts are written only by the
safe function.

**UI (`practice.html` + `cbt-exam.html`):** a **🎮 Gamify this quiz** toggle in the
security options persisted as `cbt_exams.gamify`. When on, the exam result screen
calls `tc_game_award` then `tc_game_leaderboard` (a failed RPC never blocks the
already-saved score) and renders a revealed panel — `+XP earned`, level, 🔥 day
streak, and a collapsible top-5 podium. Guests skip it. This is the
Quizizz-style moment: correct → points → streak → podium.

## 17. `complete-schema.sql` all-inclusive (V41 + v36 + everything) ✅
- Created **`database/v41-cbt-game.sql`** (item 16 schema).
- Appended it to **`database/complete-schema.sql`** (now 11,538 lines, ends
  `Tutoring Connect V41 — quiz gamification installed ✅`).
- Bumped the single source of truth `tc_schema_expected()` to
  `'V41'` and added `v40-anon-write-visibility-hardening` + `v41-cbt-game` to the
  registry `packs` array.
- `assets/js/schema-doctor.js` `EXPECTED` → `'V41'`.
- `tools/lint_schema.py database/complete-schema.sql` → **TOTAL BLOCKERS: 0**. The
  deliberate re-definitions (later pack supersedes earlier) are expected and
  documented. `v36-anon-rls-predicate-grants` is already consolidated.

## 18. Update every file accordingly across all repos ✅
Every fix in items 1–17 was made first in the **Tutoring Connect** repo (client +
studio generator), then **ported byte-for-byte** to the sibling **ADEWALE
CLASSROOM** repo so the two share identical runtime/schema code. No file depends
on a Tutoring Connect-only global in the renderer/proctor/blog layer.

**Ported to `adewaleclassroom`:** `assets/js/cbt-richtext.js`, `cbt-types.js`,
`cbt.js`, `proctor.js`, `blog.js`, `brand.js`, `schema-doctor.js`,
`practice.html`, `cbt-exam.html`, `cbt-prompts.html`,
`database/v41-cbt-game.sql`, `database/complete-schema.sql`, and
`tools/build_seo.py` (regenerated there: sitemap/robots at
`https://adewaleclassroom.vercel.app`, canonical + JSON-LD on 17 public pages).

**Verified parity:** `diff` on the ported JS files returns **identical**; every
node `--check` passes; the jsdom harness (hotspot, image, render_full, pack) runs
on the tutoringconnect tree. `lint_schema.py` on both `complete-schema.sql`
files → **0 blockers**.

---

## Files changed this pass
`assets/js/cbt-richtext.js` · `assets/js/cbt-types.js` · `assets/js/cbt.js` ·
`assets/js/proctor.js` · `assets/js/blog.js` · `assets/js/brand.js` ·
`assets/js/app.js` · `assets/js/schema-doctor.js` · `cbt-exam.html` ·
`practice.html` · `cbt-prompts.html` · `index.html` · `manifest.json` (already OK) ·
`database/v41-cbt-game.sql` (new) · `database/complete-schema.sql`

The **identical runtime files were also ported** to the sibling ADEWALE CLASSROOM
repo for item 18: `assets/js/cbt-richtext.js`, `cbt-types.js`, `cbt.js`,
`proctor.js`, `blog.js`, `brand.js`, `schema-doctor.js`, plus `practice.html`,
`cbt-exam.html`, `cbt-prompts.html`, `database/v41-cbt-game.sql` and
`database/complete-schema.sql`.

## Verification (harnesses now removed — bugs verified fixed, ports done)
The jsdom harnesses in `tools/` (`_rich`, `_render_full`, `_hotspot`, `_image`,
`_repair3`, `_cs`, `_pack`, `_final_check`) were used to verify each item and have
been **deleted** now that the fixes are confirmed and the sibling repo is ported.
The durable tooling that remains in `tools/` (`build_seo.py`, `lint_schema.py`,
`test_*.js`) is the genuine build/QA toolchain, not scratch.

**Key verified numbers:** item 1 renders `1^2→1<sup>2</sup>`, `3²`, `m⁴`,
`(x+y)⁵`; item 3 matrix uses a `--ncols` CSS grid; item 4 recovers **30/30**
`sss-1` case-study passages (0 missing) and a standalone passage appears exactly
once; item 5 hot_text degrades to an input with no dead warning; item 6 hotspot
grades `earned:1`; item 7 proctor uses separate audio/video `getUserMedia` with
metadata-only snapshots; **0 `lint_schema.py` blockers** on both
`complete-schema.sql` files.

---

## APPEND — Full line-by-line re-audit (this pass)

Re-verified every item against the live code, not the notes, and reproduced with
the two real CSVs. Genuine issues found and fixed, all in the **generator**:

**A. Generator did not rebrand the client portal SEO tags (item 8 + 12).**
`Generator.go()` copied `site-index.html` verbatim as the client homepage, so
`<title>`, meta description, keywords, `og:title`, `og:site_name` and
`twitter:title` all stayed hardcoded to **ADEWALE CLASSROOM** whatever studio
name the wizard was given. Added `Generator.brandHtml(txt, cfg)` and wired it into
the page-copy loop and the homepage. Verified: generated `index.html` is branded
"Test Academy" with **no ADEWALE leak**. This was the real reason a studio looked
"still ADEWALE" even after generation.

**B. Generator omitted three Class Deck assets (items 13/14).**
`packClassDeck`'s `deckFiles` copied only icon-96/192/512 + apple-touch-icon, but
the deck's `index.html`/`admin.html` load `assets/hmg-academy-logo.png` and
`assets/founder-photo.jpg`. Added all deck assets. Verified: generated deck no
longer renders a broken logo/founder photo. **No pre-existing feature was dropped
in doing so** — the deck's own `generate.html` was also missing its
`js/generator.js` engine, so it's now bundled too.

**C. Consolidated, deterministic schema grants (recommendation #2; item 17).**
Added `database/v42-enterprise-hardening.sql` (appended to
`complete-schema.sql`): re-assert `authenticated` EXECUTE on public functions and
the curated `anon` surface, additive-only (no revokes), and bump
`tc_schema_expected()` to **V42**. `lint_schema.py` → 0 blockers; schema-doctor
`EXPECTED` → `V42`.

**Verified numbers (this pass):** 30/30 case-study passages recovered; 0 dead
cards / 0 render throws across both CSVs; hotspot grades `earned:1`; all 35
JS-referenced RPCs exist in the schema; 0 broken internal asset/link refs in both
repos; generator deep-verify **16/16**; `npm test` ALL PASSED; `lint_schema.py`
0 blockers on both `complete-schema.sql`.
