# Classroom Deck (classdeck) — Bug Report & Fixes · V38

**Audited:** 27 Aug 2026 · `hmgconcepts/tutoringconnect` + `hmgconcepts/adewaleclassroom`
**Method:** headless Chromium with real click-through of all 39 toolbar controls on `teach.html`, plus a load test of all 10 classdeck pages in both repos, plus live REST probing of the production Supabase project.

> **Headline finding:** items 1–7 were **not seven bugs — they were one bug.** A single unguarded DOM lookup on `teach.js:1824` threw a `TypeError` that aborted the remaining 60 % of the file. Everything below it was collateral damage.

---

## The root cause

`teach.js` is one 188 KB top-level classic script. Line 1824 read:

```js
$("#timerStartCustom").addEventListener("click", () => { … });
```

`#timerStartCustom` had been deleted from `teach.html` at some point, so `$()` returned `null` and the script died:

```
TypeError: Cannot read properties of null (reading 'addEventListener')
    at js/teach.js:1824:23
```

A top-level throw **aborts the entire remaining script**. Two consequences cascaded:

1. **Every `const`/`let` declared after line 1824 was left permanently in the Temporal Dead Zone.** Touching one from an already-bound handler throws *"Cannot access 'X' before initialization"* — the exact wording you reported.
2. **Every listener registered after line 1824 was never attached** — so those icons did literally nothing.

Verified binding state before the fix (`typeof` probe from the page):

| binding | line | before | after |
|---|---|---|---|
| `layoutMode` | 50 | `string` ✔ | `string` |
| `workspace` | 925 | `object` ✔ | `object` |
| `recCanvas` | 1864 | **TDZ** | `object` |
| `studioEl` | 2231 | **TDZ** | `object` |
| `CALC_KEYS` | 2696 | **TDZ** | `object` |
| `securityAudit` | 3494 | **TDZ** | `object` |
| `stuBoards` | 3659 | **TDZ** | `object` |
| `AWARDS` | 3787 | **TDZ** | `object` |

The boundary sits exactly between line 925 and 1864 — precisely where the abort was.

---

## Your seven items, mapped to the one cause

| # | Symptom | Mechanism | Status |
|---|---|---|---|
| 1 | Go Live / End → *"cannot access securityAudit before initialization"* | Handlers bound at 1405/1406 (before the abort, so they fire) log to the security audit — `const securityAudit` @3494 never initialised | **Fixed** |
| 2 | Rec icon does nothing | `on("#btnRec")` at line **1877** — 53 lines past the abort, never bound | **Fixed** |
| 3 | PiP works but errors on `securityAudit` | Bound by the fallback toolbar, then hit the same TDZ binding | **Fixed** |
| 4 | Calculator shows display, no keypad | `renderCalcKeys()` @2772 + `btnCalc` @2808 never ran, so `#calcKeys` stayed empty. **Now renders 44 keys.** | **Fixed** |
| 5 | Swap / layout icons dead | Two faults: bound before the abort, but `applyLayout()` reads TDZ bindings — *and* the fallback toolbar double-fired `swapPanes()` (see below) | **Fixed** |
| 6 | Focus / Fullscreen → *"cannot access studioEl before initialization"* | `const studioEl = $(".studio")` @2231, never initialised | **Fixed** |
| 7 | Audit every icon on that row | **20 of 39 controls were bound after the abort** and were entirely dead | **Fixed — all 39 verified** |

### Item 7 — the full list of icons that were dead

Everything bound after line 1824: `btnRec` (1877), `btnSettings` (2134), `btnFocus` (2293), `btnFull` (2298), `btnLessons` (2376), `btnQuiz` (2483), `btnCalc` (2808), `btnReport` (2863), `btnMuteAll` (2997), `btnOpenStreamCentre` (3128), `btnObsSetup` (3130), `btnNoiseMeter` (3191), `btnTabletLive` (3412), `btnTryScreenShare` (3420), `btnCaptions` (3441), `btnTranscript` (3484), `btnAuditCSV` (3505), `btnPiP` (3558), `btnBoards` (3661), `btnActivity` (3732), `btnBehaviorCSV` (3813), `btnGroups` (3823).

---

## Fix 1 — null-safe DOM binding (systemic)

A single missing element must never again be able to take down 20 features. All **92** unguarded bindings were converted:

```js
// before
$("#btnRec").addEventListener("click", …);
// after
on("#btnRec", "click", …);
```

```js
function on(sel, ev, fn, opts) {
  var el = (typeof sel === "string") ? $(sel) : sel;
  if (!el) { /* warn once, never throw */ return null; }
  el.addEventListener(ev, fn, opts);
  return el;
}
```

Markup drift now degrades to a one-line console warning instead of a fatal abort. `$()` itself was deliberately **not** stubbed — 35 sites do `if ($("#x"))` truthiness checks that a null-object stub would silently break.

## Fix 2 — restored the markup that had gone missing

`teach.js` drives four modals that were **absent from `teach.html` entirely**, plus four timer controls. All were re-added with ids matching exactly what the JS queries:

| element | drives | was |
|---|---|---|
| `#mRecSetup` (+ `recSubject/Topic/Class/Students/Brand/Footer/LogoBtn/LogoFile/LogoStatus/recBegin`) | **Rec** | missing |
| `#mReport` (+ `reportBody/reportDownload/reportWhatsApp`) | **Report** | missing |
| `#mNoise` (+ `noiseThreshold/noiseStart/noiseStop`) | **Noise meter** | missing |
| `#mTabletLive` (+ `tlGateway/tlSecret/tlStream/tlFormat/.tlDest×4/tlRemember/tlStatus/tlStart/tlStop/tlHealth/tlOpenCentre`) | **Tablet Live** | missing |
| `#mTimer [data-min]`×8, `#timerCustom`, `#timerStartCustom`, `#timerStop` | **Timer** — *the abort itself* | missing |

## Fix 3 — the fallback toolbar was fighting the real one

`js/teach-toolbar-fix.js` is a shadow toolbar written while `teach.js` was dying. It binds the same 18 buttons **in the capture phase**. With `teach.js` repaired, both handlers fired on one click:

- `btnSwap` → `swapPanes()` ran **twice** = net zero. **This is why Swap appeared to do nothing even though it was bound.**
- `btnLayout` → cycled two modes per click.

`teach.js` now sets `window.__DECK_TEACH_READY__ = true` on its final line. The fallback checks that flag and stands down for the 18 buttons `teach.js` owns — while still doing its useful work (`killBlockers`, topbar scrolling). If `teach.js` ever aborts again, the flag is never set and the fallback takes over exactly as before.

## Fix 4 — `$ is not defined` on 7 generator pages

Pre-existing, generator-repo only. `js/auth.js` uses `$` but never defines it; on `admin`, `cbt`, `classroom`, `parent`, `stream`, `community`, `generate` it loaded **before** `js/common.js` (or without it). Load order corrected. `stream.html` additionally declared its own inline `const $`, which then collided with `common.js` — the duplicate was removed.

---

## Verification — after

| check | ADEWALE | Tutoring Connect |
|---|---|---|
| 10 classdeck pages load | **all clean** | **all clean** |
| 39 toolbar icons clicked | **0 errors** | **0 errors** |
| Calculator keypad | **44 keys** (was 0) | **44 keys** |
| Layout cycle | `split → left-only → right-only → split` ✔ | ✔ |
| Swap | `paneL:notes ↔ paneR:pdf`, DOM children move, labels update ✔ | ✔ |
| `__DECK_TEACH_READY__` | `true` | `true` |
| Restored modals present | 4/4 | 4/4 |

Service worker bumped `hmg-classdeck-v11.1.1` → **`v11.2.0-v38-toolbar-fix`**, `version.json` → **11.2.0-enterprise build 8**, so returning users get the fixed JS instead of the cached broken copy.

---

# Database issue — the "out of date" popup was a **false alarm**

> *"Despite running the latest complete schema SQL, I still get: Your database is out of date — it is at V4 but these files expect V9. 1 missing function(s) … Run: database/v6-cbt-modes.sql"*

**Your database was never out of date, and `v6-cbt-modes.sql` was never missing.** Two chained defects manufactured that banner.

### Defect A — `tc_schema_info()` disagreed with its own schema

`complete-schema.sql` stamps the registry through successive packs, finishing at **V29**. But the last definition of `tc_schema_info()` hard-codes:

```sql
'expected', 'V24',   'up_to_date', (r.version = 'V24')
```

So a perfectly installed database reports `version=V29, expected=V24, up_to_date=false`. `schema-doctor.js` compares `v === reg.data.expected`, gets `false`, **discards the authoritative registry answer** and falls through to guessing — straight into defect B. Two hard-coded strings in two places that had drifted apart.

### Defect B — the fallback probe asked PostgREST the wrong question

The probe called every function with **no arguments**:

```js
sb.rpc('tc_cbt_get_exam', {})
```

but the real signature is `tc_cbt_get_exam(p_code text, p_student_no text default '')`. Confirmed live against your project:

```
tc_cbt_get_exam()      → PGRST202  "Searched for the function public.tc_cbt_get_exam
                                    without parameters ... no matches were found"
tc_current_role()      → 42501     permission denied   (= present ✔)
tc_keep_alive_status() → 42501     permission denied   (= present ✔)
is_family_of_learner() → 42501     permission denied   (= present ✔)
```

Only `tc_cbt_get_exam` returned PGRST202 — **a signature mismatch, not a missing function.** The doctor tested only for `/PGRST202|Could not find the function/`, declared it missing, and since the probe list stops at the first gap, reported the whole database as "V4". Hence *exactly* "1 missing function(s)" and *exactly* the CBT wording.

### Fixes

**`database/v37-schema-version-truth.sql`** (appended to `complete-schema.sql`) — establishes one single source of truth so the two values can never drift again:

```sql
create or replace function public.tc_schema_expected()
returns text language sql immutable as $$ select 'V37'::text $$;
```

Both the registry row and `tc_schema_info()` now *derive* from it (`up_to_date = (r.version = public.tc_schema_expected())`).

**`assets/js/schema-doctor.js`** —
- every probe now carries its **real argument list**;
- a PostgREST reply containing *"without parameters"* / *"single unnamed json"* is recognised as a **signature mismatch = function present**, not missing;
- the registry's own `up_to_date` flag is trusted instead of a hard-coded `'V12'` fallback;
- the banner no longer hard-codes "expect V9" and no longer names individual packs — it names `complete-schema.sql` and the `notify pgrst` line.

### "complete-schema.sql should address every other SQL"

**It already does — verified, not assumed.** I parsed every `create table` / `create or replace function` / `create view` in all 29 individual `v*.sql` files and checked each against `complete-schema.sql`:

```
objects defined in individual v*.sql but ABSENT from complete-schema.sql:
   NONE — complete-schema.sql is a true superset ✓
```

It now also **ends** with `notify pgrst, 'reload schema';`, which is essential: PostgREST caches the schema, so a function created seconds ago can be genuinely present and still invisible to the REST API — producing the very PGRST202 that started this.

**Deploy:** run `database/complete-schema.sql` (10,875 lines, idempotent). That is the only file you need. It now contains v36 and v37.

---

## Files changed (identical in both repos)

| file | change |
|---|---|
| `classdeck/js/teach.js` | 92 bindings made null-safe; `on()` helper; ready flag |
| `classdeck/js/teach-toolbar-fix.js` | stands down when `teach.js` is healthy |
| `classdeck/teach.html` | 4 missing modals + 4 timer controls restored |
| `classdeck/sw.js`, `classdeck/version.json` | cache bump → 11.2.0 |
| `assets/js/schema-doctor.js` | correct probe args; signature-mismatch handling; derived version |
| `database/v37-schema-version-truth.sql` | **new** |
| `database/complete-schema.sql` | v37 appended; ends with `notify pgrst` |
| `classdeck/{admin,cbt,classroom,parent,stream,community,generate}.html` | *(generator repo only)* script order fixed |
