# Tutoring Connect — Bug Report & Fixes

**Audited:** 27 Aug 2026 · generator `hmgconcepts/tutoringconnect` + generated studio `hmgconcepts/adewaleclassroom`
**Method:** full clone, static reference analysis, SQL privilege modelling, live REST probing against the production Supabase project, and a headless-Chromium crawl of all 142 / 143 pages capturing `pageerror`, console and network events.

---

## Audit scorecard

| Check | Result |
|---|---|
| JS syntax (`node --check`, 96 + 88 files) | **Pass** — 0 errors |
| JSON validity (all `.json`) | **Pass** |
| Broken local `href` / `src` targets | **Pass** — 0 (3 hits were template literals, false positives) |
| `nav-model.json` → page targets (136 refs) | **Pass** — 0 missing |
| Duplicate element IDs | **Pass** — 0 pages |
| Script load-order (`config.js` before `app.js`) | **Pass** — 0 pages |
| DB tables referenced by code vs schema (70 distinct) | **Pass** — 0 missing |
| RPCs called vs functions defined | **Pass** — 0 missing |
| **Runtime JS exceptions** | **1 page crashed** → fixed |
| **Anonymous REST access** | **610 × HTTP 401** → root-caused and fixed |

The codebase is unusually disciplined. Both defects below are *privilege / load-order* faults, not logic faults — the kind that static review passes and only a live probe catches.

---

## BUG 1 — CRITICAL · Every public page 401s (`permission denied for function is_tutor`)

### Severity
**Critical.** Breaks the entire anonymous surface of every deployed studio: the marketing landing page, `apply.html`, `public-book.html`, `exam-register.html`, `free-register.html`, `blog.html` and `login.html`.

### Evidence

Live probe against the production project `yqwzbttehegvnvkrmxjz` with the shipped anon key:

```
GET /rest/v1/learners?select=*&limit=1
→ HTTP 401
  {"code":"42501","message":"permission denied for function is_tutor"}
```

Browser crawl of the 8 public pages, Supabase responses only:

```
x16  /rest/v1/practice_settings     statuses={401: 16}
x10  /rest/v1/notifications         statuses={401: 10}
x7   /rest/v1/site_license          statuses={401: 7}
x7   /rest/v1/rpc/tc_license_status statuses={401: 7}
x2   /rest/v1/subjects              statuses={401: 2}
x1   /rest/v1/learners              statuses={401: 1}
x1   /rest/v1/availability          statuses={401: 1}
```

610 × 401 across the full 142-page crawl.

### Root cause

`database/complete-schema.sql` contains **five** catalogue-wide hardening loops (lines 3764, 5123, 5435, 5855, 6232). The first one does:

```sql
revoke all on function <every public fn> from public;
revoke all on function <every public fn> from anon;
grant  execute on function <every public fn> to authenticated;
```

…then re-grants to `anon` a deliberate 7-function allow-list. That reasoning is sound for *callable* RPCs, and the file's own comments explain it well.

But the loop also stripped the helper functions that **RLS policies themselves call** inside `USING` / `WITH CHECK`:

```sql
create policy ..._admin on public.<table>
  for all using (public.is_admin() or public.is_tutor());
```

In PostgreSQL a policy predicate executes **as the querying role**. When `anon` selects from any such table, Postgres must run `is_tutor()` as `anon`, finds no `EXECUTE` privilege, and raises `42501`. PostgREST maps that to **HTTP 401 and aborts the whole request**.

The intended behaviour was for the predicate to evaluate `FALSE` and fall through to the permissive public-read policy sitting beside it. Instead the query dies. That is why even genuinely public tables (`practice_settings`, `subjects`, `availability`) return 401.

### Blast radius — all 13 policy predicates were denied to `anon`

Computed by replaying every grant/revoke in file order:

| predicate | anon | authenticated |
|---|---|---|
| `is_tutor` | **DENIED** | OK |
| `is_admin` | **DENIED** | OK |
| `is_self_learner` | **DENIED** | OK |
| `is_parent_of` | **DENIED** | OK |
| `tc_is_manager` | **DENIED** | OK |
| `tc_my_tutor_id` | **DENIED** | OK |
| `tc_teaches_engagement` | **DENIED** | OK |
| `tc_teaches_learner` | **DENIED** | OK |
| `tc_teaches_session` | **DENIED** | OK |
| `tc_parent_matches_uid` | **DENIED** | OK |
| `tc_family_can_see_learner` | **DENIED** | OK |
| `is_family_of_engagement` | **DENIED** | OK |
| `is_family_of_learner` | **DENIED** | OK |

`is_tutor`, `is_admin` and `is_self_learner` never received *any* explicit grant — they survive for `authenticated` only because of the blanket grant in loop 1. The other ten were granted `to authenticated` only. Signed-in users were therefore unaffected, which is exactly why this shipped unnoticed: the owner tests while logged in.

### Fix

New final migration **`database/v36-anon-rls-predicate-grants.sql`**, also appended to `complete-schema.sql` so fresh installs are correct first time. Idempotent, transactional, catalogue-driven:

```sql
grant execute on function <each of the 13 predicates> to anon, authenticated;
```

Ships with a verification query that must return `true / true` for all 13 rows.

### Why granting these to `anon` is safe

Each predicate is `SECURITY DEFINER`, takes no user-controlled table name, and resolves purely from `auth.uid()`. For an anonymous caller `auth.uid()` is `NULL`, so every one returns `FALSE`. They are booleans **about the caller**, not data readers — executing them cannot leak a row, while being unable to execute them breaks the site. The anon RPC allow-list is untouched, and staff reporting functions (`tc_exam_reg_stats`, `tc_db_report`, `tc_security_report`) stay revoked from `anon` and keep their internal `is_tutor()` re-check.

### Deploy step required
Run `database/v36-anon-rls-predicate-grants.sql` in the Supabase SQL editor. **Keep it as the last migration** — any future hardening loop will silently re-break RLS unless this is re-applied afterwards. The file carries that warning inline.

---

## BUG 2 — HIGH · `cbt-multi.html` dies with a SyntaxError

### Severity
**High.** `cbt-multi.html` is the multi-subject CBT runtime — a core exam-delivery page. It was the only page in either repo to throw a hard JS exception.

### Evidence

Headless crawl, before fix:

```
### pages=142  with_JS_exceptions=1
  cbt-multi.html :: ["Identifier 'SecurityGuard' has already been declared"]
```

A top-level `SyntaxError` aborts the entire script, so `SecurityGuard` never initialises — no idle lock, no lockdown enforcement — on the one page where a learner sits an exam.

### Root cause

`assets/js/security-guard.js` declares `const SecurityGuard = {…}` at top level. `assets/js/app.js:1770` lazily injects the same file:

```js
(function () { if (window.SecurityGuard) return;
  const s = document.createElement('script');
  s.src = 'assets/js/security-guard.js'; s.defer = true;
  document.head.appendChild(s); })();
```

`cbt-multi.html` is the only page that lists `security-guard.js` (line 50) **after** `app.js` (line 34). When `app.js` executes, that later tag has not been parsed into the DOM yet and the file has not run, so `window.SecurityGuard` is still `undefined` — the guard passes and a **second** copy is injected. Both execute, `const SecurityGuard` is declared twice in the same global scope, and the page dies.

Two sibling injectors — `DataPortability` (`app.js:1768`) and `DriveSync` (`app.js:1769`) — carry the identical latent defect and would fail the same way the moment any page reorders its tags.

### Fix — defence in depth, applied to both repos

1. **`app.js`** — all three injectors now also check for an existing tag, and defer the check until the parser has finished so a tag further down the page is actually visible:

```js
function need() {
  if (window.SecurityGuard) return false;
  if (document.querySelector('script[src$="security-guard.js"]')) return false;
  return true;
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
else load();
```

2. **`security-guard.js`, `data-portability.js`, `drive-sync.js`** — each wrapped in an idempotency guard, so a double include is a harmless no-op rather than a fatal re-declaration:

```js
if (!window.SecurityGuard) (function () { … })();
```

3. **`sw.js`** — cache bumped `tc-shell-v10-20260815` → `tc-shell-v11-20260827` so returning PWA users receive the fixed JS instead of the cached broken copy.

### Verification

| page | before | after |
|---|---|---|
| `cbt-multi.html` (ADC) | `SyntaxError`, 2 script tags | **no errors**, 1 tag, `SecurityGuard: object` |
| `cbt-multi.html` (TC) | `SyntaxError`, 2 script tags | **no errors**, 1 tag, `SecurityGuard: object` |
| `dashboard`, `index`, `login`, `settings`, `security-centre`, `cbt-exam`, `cbt-review` | clean | clean (no regression) |

---

## Observations — not bugs, worth knowing

1. **Committed anon key.** `adewaleclassroom/assets/js/config.js` ships a live Supabase URL + anon key. That is correct Supabase practice — the anon key is a public identifier and RLS is the real boundary. It is only safe *because* RLS is right, which makes Bug 1 doubly important.

2. **Leaked client identity in the generator (already fixed upstream).** `tutoringconnect/assets/js/config.js` carries a comment noting it previously shipped a live client's name, phone and socials in the public generator repo. Current values are correctly neutral.

3. **Sitemap lists 17–18 of 142 pages.** Intentional — portal screens are `Disallow`ed in `robots.txt` and carry `noindex`. Correct.

4. **Five stacked hardening loops** in one schema file is fragile by construction. The privilege state of any function now depends on its line number relative to five separate catalogue sweeps. A single consolidated grant block at the end of the file would remove this whole class of bug; `v36` is the pragmatic version of that.

5. **`auth-guard.js` is honest about itself** — it documents that it is a navigation gate, not a data gate, and that RLS is the real control. That honesty is why Bug 1 matters so much: the documented safety net was the thing that was broken.
