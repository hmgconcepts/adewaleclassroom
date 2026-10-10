# PROMPT AUDIT — Rounds 5 + 6 (2026-10-01)

Every binding item from the round-5 brief, traced to the exact files that
implement it and the exact test that proves it. The QA battery lives in
`/home/user/classdeck-qa/` and runs against **both** repos
(`CD_REPO=… node test_…`). Round-4 acceptance criteria (204/204) remain
green — the v12 suites still pass unmodified on the v13 engine.

---

## Item 1 — Blog pages enhanced GREATLY (Ghost/Substack/Medium-class)

**Research basis:** Ghost/Substack/Medium feature matrices (2026 comparisons:
typeflo.io, stackalts.com, seocontentai.com et al.) → per-post SEO + JSON-LD,
reading time, TOC, related posts, prev/next, drafts, scheduling, analytics
dashboard, newsletter, share, tags/archives, author cards, view counts,
portable export/import.

| Feature | Where | Verified by |
|---|---|---|
| Markdown engine: fenced code + copy button + lang label, blockquotes, heading ids | `assets/js/blog.js` `md()` | unit test (8/8) + harness C2/C3/C20 |
| Reading time (⏱ min) on cards + posts | `blog.js` `readMin()`, reader meta | A5, C1 |
| 3px gradient reading-progress bar | `blog.js` `_enhancePost` step 1 | C5 |
| Table of contents (source `##`, ≥3 headings, before body) | `_enhancePost` step 2 | C4 |
| Reactions ❤️/👏/💡 with per-visitor dedup + server tally | `tc_blog_react` + `wireReactions` | C6–C11 |
| Share row: native + WhatsApp/Telegram/𝕏/Facebook/copy-link | `shareRow()` | C7 |
| Prev/older · next/newer navigation | `_enhancePost` step 5 | C12 |
| Related reading (same category OR shared tag, top 3) | `_enhancePost` step 5 | C13 |
| Newsletter subscribe (compact + full, validation, RPC) | `subscribeBox`/`wireSubscribe` → `tc_blog_subscribe` | C14–C16 |
| Comments with sign-in gating + moderation (hide/restore) | `_renderComments`, `_loadCommentsMod` → `tc_blog_comments` | C17–C18, D1, E3, E7 |
| JSON-LD BlogPosting + og:image injection | `_enhancePost` step 8 | C19–C20 |
| Tag deep-links `blog.html?tag=…` + top-12 chip row | `_loadList` | B1–B3, C8 |
| Pagination (9/page) + load-more | `_loadList` | A2/A3/A7 |
| Pinned hero (unfiltered listing) + 📌 badges | `_loadList` | A1/A6 |
| Search + category filter | `mountList` → `tc_blog_list(p_category, p_q)` | A8 |
| Admin dashboard: 7 stat tiles + top posts | `_loadStats` → `tc_blog_stats` | E1/E2 |
| Drafts, scheduled publishing (future `published_at` stays hidden) | editor `#blog-f-when` + `_save` | E12, E5 |
| Pin/unpin from the admin table | `_adminList` data-pin toggle | E6 |
| Live preview + word/read-time counters + draft autosave/recovery | `_form` | E8–E11, F1 |
| Export/Import full-content JSON backup (dup slugs skipped) | `_exportAll`/`_importAll` | E14, F2 |
| Author card (white-label: reads `[data-practice-name]`) | `practiceName()` | C1 (author initials + name) |
| Schema layer (subscribers, reactions, comments + 11 RPCs) | `database/v43-engagement-cohorts-library-blog.sql` (also appended to `complete-schema.sql`) | SQL lint: dollar-tags paired, 11 functions |

**Bugs the new harness caught and fixed:** `_form` referenced `window.self`
(Save button threw in production); `_renderComments` dropped its `note`
argument (sign-in message never shown); heading regex in the harness itself.

## Item 2 — Class-scoped delivery + teacher ownership (School Connect / GOSA blueprint)

| Requirement | Where | Verified by |
|---|---|---|
| Assign registered students to engagements/groups/cohorts seamlessly | `assets/js/roster-console.js` mounted on `engagements.html` + `groups.html`; `tc_roster_bulk/view` on `engagement_members` | R1–R12 |
| Quiz set on an engagement appears on those students' dashboards | quiz editors carry `engagement_id` (`practice.html` L390, `cbt-multi.html` L337, `crud.js` 30+ field defs); `tc_my_work` returns them | W1–W7 |
| Class A must NOT see class B's content | `library_items`/`eresources`/`assignments` scoped by `engagement_id` + RLS (v43); work board renders per-engagement | W9, R13 |
| Other teachers cannot edit another teacher's work | `not_your_engagement` guard in `tc_roster_bulk/view`; `tc_stamp_library_author()` stamps author_id; RLS owner checks | R13 |
| Physical assignments per class (mode) | `assignments.mode` + work board shows "📄 hand in on paper" | W3 |
| Digital library per class | `library_items` + `eresources` engagement scoping + work board merge | W9 |

## Item 3 — Joins seamless on mobile data AND hotspot Wi-Fi (no relay setup)

| Layer | Change | Verified by |
|---|---|---|
| `classdeck/js/rtc.js` v13 | handshake timeout 15s→20s (hotspot NATs are slow); +3 TCP/TLS TURN entries (OpenRelay :80 tcp, :443, turns :443 tcp — DPI/hotspot friendly); `preferTcp` reorder; ICE pool 6 | RTC ICE suite 6/6 + all 102 v12 checks |
| `classdeck/js/join.js` v13 | first failed attempt flips `window.__cdPreferTcp` → TCP/TLS-first retry with clearer messaging | v12 regress suites (join paths unchanged) |
| Cost | zero — OpenRelay free 20 GB/mo credentials baked in as built-ins | — |

## Item 4 — Top bar no longer blocks student top icons

| Layer | Change | Verified by |
|---|---|---|
| `classdeck/js/portal-bridge.js` v13 | student join page NEVER installs the chip (pathname + `#joinGate` detection); teachers keep it; chip is dismissible (✕, per-session); body padding only when chip present | portal-bridge suite 12/12 |
| `classdeck/join.html` | safe-area + z-index hardening (fixed tops z-700) | manual + suite |

## Item 5 — Every file updated across all repos

- `?v=44` platform-wide (150 pages adewale + 151 twin), `?v=45` classdeck-wide.
- classdeck v13: `version.json` 13.0.0/build 13, `sw.js` cache bump (returning
  students get the chip fix), all 11 HTML pages + 3 JS synced.
- Twin (`tutoringconnect`): `blog.js`, `crud.js`, `app.js`, `roster-console.js`
  (new), classdeck ×3 JS + all HTML, `v43` SQL + complete-schema append.
  Fixed pre-existing stray `</head>` in `exam-register.html`, `invoices.html`;
  fixed missing `</head>` in adewale `blog.html`, `blog-post.html`,
  `blog-manage.html`, `class-links.html`, `contracts.html`.
- `blog.js` is brand-parameterised (one file serves both products).

## Final QA tally (both repos, `/home/user/classdeck-qa/`)

    v11 regression  24 ✓      v12 features    34 ✓
    captains/scale  21 ✓      settings        23 ✓
    blog V44        48 ✓      roster console  15 ✓
    work board      16 ✓      ─────────────────────
                               181/181 per repo × 2 repos

`node -c` clean on every touched JS file in both repos. SQL dollar-tag
parity verified on all four schema files.

---

# ROUND 6 — hotspot joins & the top bar (classdeck v13.1)

The two field-reported issues were re-stated; both were hardened beyond
the v13 fixes. All work ships in `classdeck v13.1.0` (pages `?v=46`,
service-worker cache bumped so returning devices update immediately).

## Item 1 — hotspot Wi-Fi students join seamlessly, no relay setup

v13 already baked free TCP/TLS TURN entries (OpenRelay :80/:443/turns:443)
into the ICE list and flipped to TCP-first after a failed attempt. v13.1
removes the remaining tax and closes the remaining gaps:

| Upgrade | File | Verified by |
|---|---|---|
| **Transport memory** — a device that ever needed the TCP/TLS route remembers it (`ice_pref`) and starts every future class TCP-first; the doomed UDP-first attempt is skipped entirely | `rtc.js` (orders ICE from the store), `join.js` (restores the flag at boot) | H1–H5, H10–H11 |
| **Honest classification** — only a TCP-first success that followed a real transport failure ("Could not reach", "closed before admission", signalling) stores `tcp`; "class not live" failures never poison the memory; any clean UDP-first success stores `udp` and heals a stale entry | `join.js` `rememberTransport()`/`isTransportFailure()` | H7, H14, H15 |
| **Faster escalation** — first lobby retry at 2s (was 4s); later retries keep jittered backoff | `join.js` `startLobby()` | H16 |
| **Mid-class rejoin escalates too** — the auto-reconnect loop now flips TCP-first after one failed attempt and feeds the same transport memory | `join.js` `attemptRejoin()` | H17–H18 |
| **Returning-device status line** says "🔁 using the TCP/TLS route that worked here before" | `join.js` `lobbyStatusLine()` | H5 |
| End-to-end hotspot journey: UDP-first fail → auto-retry TCP-first → admitted → memory saved → next class instant | all | H6–H11 |
| Teacher + rejoin paths read the stored preference directly (not just the runtime flag) | `rtc.js` | H19 |

## Item 2 — the "ADEWALE CLASSROOM · Classroom Deck" top bar never blocks a student's icons

v13 suppressed the chip on student pages and made it dismissible. v13.1
completes the hardening:

| Upgrade | File | Verified by |
|---|---|---|
| Student suppression covers every entry variant — `join.html`, `join.htm`, `/join/`, `/join`, `?query` and any page carrying `#joinGate`/`#stuControls` | `portal-bridge.js` `isStudentJoinPage()` | C1 (6 paths) |
| Chip is **notch/safe-area aware** — height and body offset are `calc(28px + env(safe-area-inset-top,0px))` so it never sits under the OS status bar on phones | `portal-bridge.js` | C2 |
| **Compact on phones** — `@media (max-width:520px)` shrinks type/gaps and folds the secondary Sessions link away so nothing crowds the topbar | `portal-bridge.js` | C2 |
| Studio height compensates chip + notch; topbar buttons keep pointer-events | `portal-bridge.js` | C2 |
| Dismiss (✕) clears chip + style + CSS var, remembered per session | `portal-bridge.js` | C2 |
| join.html's own fixed tops sit below the notch (z-700) and above the home indicator | `join.html` | C3 |

## Item 3 — every file updated across all repos

`classdeck v13.1.0` synced byte-identical to `tutoringconnect` (rtc.js,
join.js, portal-bridge.js, all 11 HTML pages `?v=46`, version.json,
sw.js cache string). One pre-existing flaky v12 test (class-full 30s
jittered poll vs a fixed 31s wait) was de-flaked to wait for the outcome.

## Round-6 QA tally (per repo, both repos green)

    v11 regression  24 ✓      v12 features    34 ✓   (de-flaked, 10/10 stable)
    captains/scale  21 ✓      settings        23 ✓
    blog V44        48 ✓      roster console  15 ✓
    work board      16 ✓      hotspot v13.1   19 ✓   (NEW)
    chip v13.1      20 ✓      ─────────────────────
                               220/220 per repo × 2 repos

**Deployment note:** the fixes live in the workspace + ZIPs. The live
site only changes after the new build is uploaded and redeployed — a
device that still shows the old behaviour is serving the old snapshot.


---

# ROUND 7 — root causes found by research, not guesswork (classdeck v13.2)

The same two symptoms survived two rounds of fixes, so this round started
with research instead of code. Web verification (2026-10-01) found the
REAL causes — both were outside anything the earlier rounds touched.

## Item 1 & 2 — hotspot students blocked, with AND without the Cloudflare relay

| Root cause (verified) | Evidence | Fix | Verified by |
|---|---|---|---|
| **The free OpenRelay TURN servers are dead.** OpenRelay now requires an account + API key; the shared `openrelayproject` credentials baked in since v13 answer 401. Five dead relays poisoned every join's ICE gathering with handshake timeouts. | dev.to OpenRelay list (Jun 2026): "to prevent abuse you need to create an account"; metered.ca's own pages now route TURN through signup | Removed all five dead entries. Built-ins are now three free STUN servers (Google · Cloudflare · metered) — honest, keyless, fast-gathering | RELAY C1–C2 |
| **Cloudflare's response contains port-53 URLs that browsers REFUSE.** Every student behind a configured Cloudflare relay paid a TURN-gathering timeout per :53 URL — "relay set up, students blocked". | Cloudflare Realtime docs (Sep 2026): "The alternate port 53 is known to be blocked by web browsers… filter out the URL with port 53" | `cdStripPort53()` + a `:53` filter in the normaliser — no path can store or run one (5349 stays) | RELAY A1–A5, B1, E2, F3 |
| **Cloudflare credentials EXPIRE (ttl ≤ 24 h) and nothing renewed them.** The teacher had to "come back and press Generate again"; nobody does, so every relay student 401s the next day. | Cloudflare docs: credentials are short-lived by design | **Auto-renewal**: the generator now stores the key, token and expiry; `maybeRenewCloudflareRelay()` renews on studio load + hourly + whenever <2 h of life remains. One-time setup, zero maintenance | RELAY F1–F10 |
| Expired credentials sat first in the ICE list even when dead | — | Runtime skip: an expired stored relay is dropped (with a teacher warning toast); manual pastes (no stored expiry) are always trusted | RELAY C5–C6, F7 |
| `credentialType` (a type descriptor) was used as the TURN password | — | Normaliser only reads `credential`/`password` | RELAY B2–B3 |
| The student-side promise "tries TCP/TLS routes" was only true with a live relay | — | Lobby + doctor messages now state exactly what helps: the free 2-minute Cloudflare relay, auto-renewed forever | HOTSPOT suite wording |

**What "no relay setup" now means (the honest engineering position):**
zero-signup public TURN no longer exists in 2026. Direct paths (STUN) work
for mobile-data students; hotspot students need ONE relay somewhere. The
self-contained answer shipped: the teacher's one-time 2-minute Cloudflare
setup (free, 1 TB/mo) which the studio now maintains by itself — after
that, hotspot students join first-try via Cloudflare's tcp:80 / turns:443
routes (DPI/hotspot-proof), with transport memory (v13.1) making those
routes lead on devices that ever needed them.

## Item 3 — the top bar

After three field reports, the fixed-position chip approach is ABOLISHED:
**no fixed top bar exists anywhere in the deck any more.**

| Page | What students/teachers get now | Why it cannot block the top icons | Verified by |
|---|---|---|---|
| join.html (students) | NOTHING injected, every path variant (`join.html`, `.htm`, `/join/`, `/join`, `?query`, `#joinGate` pages) | Nothing exists to block | CHIP C1 |
| teach.html / classroom.html | An INLINE "← Studio" link appended inside the page's own `<header class="topbar">` | Participates in layout flow — inline elements cannot cover other controls | CHIP C2 |
| other staff pages | A dismissible pill pinned to the BOTTOM-right corner, safe-area aware | A bottom-anchored element physically cannot block the top of the screen | CHIP C3 |

## Item 4 — every file, both repos

classdeck **v13.2.0** (pages `?v=47`, sw cache bumped, `portal-bridge.js`
added to the offline shell): rtc.js, join.js, teach.js, portal-bridge.js,
all 11 HTML pages, version.json, sw.js — byte-identical in both repos.

## Round-7 QA tally (per repo, both repos green)

    v11 regression  24 ✓   v12 features    34 ✓   captains/scale  21 ✓
    settings        23 ✓   blog V44        48 ✓   roster console  15 ✓
    work board      16 ✓   hotspot         19 ✓   relay v13.2     38 ✓
    chip v13.2      20 ✓   ─────────────────────────────────────────────
                          258/258 per repo × 2 repos

**Deployment note (unchanged, and now critical):** these fixes exist in
the workspace + ZIPs. A device still showing the old bar or the old join
behaviour is serving an old snapshot — upload the new build and redeploy.

# ROUND 8 — enterprise features from Google Classroom & the big meeting platforms (classdeck v14.0.0 / portal V44)

Requested: (1) understudy Google Classroom and implement its enterprise
features; (2) understudy Google Meet / Zoom / Teams / FreeConference / Zoho
and implement their enterprise features on the ClassDeck; (3) navigate
WITHIN a whiteboard page (scroll up/down), not only page-to-page; (4) PDF
zoom with proper scrollbars; (5) students/parents must be able to message
the tutor/admin; (6) teacher can enable a participant as assistant tutor;
(7) every file updated across both repos.

## Item 3 — scroll INSIDE a whiteboard page (whiteboard.js)

A page used to be exactly one screen: `_clampView` pinned `y` to
`[1-s, 0]` — anything drawn off-screen was unreachable. Now every page is
a **long board, 3 screens tall** (1–8, clamped), with strokes still stored
in board coordinates so old saved decks and live sync remain 100%
compatible (legacy pages normalise to h=3; nothing moves).

| Gesture | What it does now | Verified by |
|---|---|---|
| wheel / trackpad | scrolls down/up the long page (delta-mode aware) | W6 |
| shift + wheel | pans sideways | W7 |
| ctrl/⌘ + wheel | zoom anchored at the cursor (the point under the cursor never moves) | W8 |
| middle mouse | grab-and-pan | W14 |
| overlay scrollbars | always visible while there is somewhere to go; draggable thumbs | W10–W13 |
| pinch (existing) | unchanged two-finger zoom/pan | (r5/v12 suites) |
| PNG / PDF export | exports the WHOLE scrollable page, not just the visible window | W15–W17 |

The PDF annotation overlay is exempt — it stays one screen so it remains
glued to the PDF page underneath (W3), and its wheel is never hijacked
(W9).

## Item 4 — PDF zoom navigation (teach.js + style.css)

Two real bugs: `.pdf-scroll` used flex `justify-content:center`, which
pushes the left overflow of an oversized page **out of reach**, and the
scrollbars were invisible. Fixed:

- `.pdf-pagewrap { margin: 14px auto }` + `flex-start` — centred when it
  fits, fully scrollable edge-to-edge when zoomed (P1–P2);
- fat, always-visible scrollbars (WebKit + Firefox `scrollbar-color`) (P3);
- `zoomTo()` re-anchors every zoom (buttons, pinch AND ctrl-wheel) to the
  viewport centre instead of the page corner (P4–P6);
- plain wheel keeps scrolling natively — no preventDefault without
  ctrl/⌘ (P7–P8); arrows / PgUp / PgDn / Home / End when focused (P9);
- the broadcast viewport (`getViewportRegion`) still follows the teacher's
  scroll — the class sees exactly what the teacher sees (P10).

## Item 6 — assistant tutor / co-host (rtc.js, teach.js, join.js)

Zoom-style: the teacher taps 👑 on any admitted student.

- `TeacherRoom.setCoHost(pid, on)` — registry `coHosts`, roster broadcasts
  carry the flag, every change logged to attendance (A3–A5);
- the promoted student gets a floating **Assistant tutor** panel: admit
  all, mute all, lower hands, lock/unlock (A6, A16);
- actions travel as `cohostAction` and are honoured **only** from
  promoted peers — impersonation is ignored (A7, A21);
- a co-host can kick but never themselves (A18–A19);
- demotion is instant and total (A20).

## Item 2 — meeting-platform enterprise gaps (deck)

Research verdict: waiting room, lock, per-student mic/cam/screen, kick,
polls, quizzes, hand raise, reactions, recording, captions, spotlight and
the captain relay already existed. The true gaps, now closed:

- **mute all** — one tap silences every student mic (A8);
- **lower all hands** — class-wide, students' local hand state drops too
  via `handSync` (A10–A13);
- **attendance report** — the pre-existing CSV export is upgraded:
  null-safe fields (no more `"undefined"` cells), CRLF line endings so
  Excel opens it cleanly (A22–A24).

## Item 5 — students/parents messaging the tutor/admin (V44)

Before: `messages` was a one-way `to_role` note drop and the Messaging
page was a staff-only WhatsApp/email link helper — a learner could not
actually message anyone. Now:

- `database/v44-messaging.sql`: `recipient` / `sender_name` / `read_at`
  columns + pair/unread indexes + five security-definer RPCs —
  `tc_message_directory/send/threads/thread/unread` (M1–M4, M9);
- routing rules enforced IN THE DATABASE: families write to staff only
  (M5); tutors reach staff + their own engagements' families, or anyone
  with an existing thread (M6); admins reach everyone;
- every send raises a notification row for the recipient (M8);
- opening a thread marks it read — ✓ sent / ✓✓ read receipts (M7);
- `messages.html` rebuilt as a two-pane Messages Center (threads,
  directory picker, composer, Ctrl+Enter send) — `messages-center.js`
  (MC1–MC13), XSS-escaped bodies (MC7);
- **Messages is now for every signed-in role** — nav V26, aud `user`
  (V4); unread badge on the nav link polls on every page via
  notifications.js (V5, MC14);
- the old WA/email/SMS capability survives as the directory's deep links.

## Item 1 — Google Classroom enterprise features (portal)

Already present from earlier rounds: rubrics, assignments, announcements,
scoresheet/gradebook, originality-friendly CBT, analytics dashboards.
Added this round:

- **comment bank** (Google Classroom's most-loved grading feature): 💾
  saves any phrase while marking, 💬 inserts one into any per-question or
  overall comment; stored locally, works offline (C1–C6) — and a
  save-handler shadowing bug was caught and fixed by the new tests;
- **to-do bar**: the learner work board now computes what is due TODAY
  (homework + quizzes + reading) plus an overdue count, with a one-tap
  "Ask your tutor / admin" route into messages (C7–C8).

## Item 7 — every file, both repos

classdeck **v14.0.0** (build 17, pages `?v=48`, sw cache
`hmg-classdeck-v14.0.0-cohost-scrolling-boards-pdf-nav`): whiteboard.js,
teach.js, rtc.js, join.js, style.css, teach.html, all HTML pages,
version.json, sw.js.
Portal **V44** (pages `?v=45`, shell cache `tc-shell-v13-20261004`):
v44-messaging.sql + complete-schema.sql, messages-center.js (new),
messages.html, notifications.js, nav-model.js/.json (V26), app.js,
cbt-marking.js, sw.js.
All of it byte-identical in both repos (V8).

## Round-8 QA tally (per repo, both repos green)

    12 suites — 365/365 per repo × 2 repos
    (258 pre-existing + 65 test_r8_deck + 42 test_r8_portal; nothing regressed)

**Deployment note:** run `database/v44-messaging.sql` once on existing
projects (idempotent). Devices still seeing single-screen boards or the
old Messaging page are serving stale caches — upload the new build.


---

# ROUND 9 — platform health layers, advanced CBT, dedicated quiz pages

Prompt (8 items, abridged): understudy gosaportal + hmgconcepts/gosaportal +
schoolconnectdemo (per-layer keep-alive monitoring on Platform Health);
understudy hmgacademycbtsystem + cbtgen (advanced CBT features); understudy
lp25-dramaconnect (same); understudy gosa + CBT pages + Assignment page —
explicitly: combining pre-existing CBTs into multi-subject CBTs, cumulative
CBT score collation pushable to the report card, CBT assignments created in
CBT pages that automatically appear on the assignment page; CBTs for an
engagement must appear on DEDICATED pages by nature; only relevant features;
expert sweep of every page/process; update every file across all repos.

## Item 1 — per-layer keep-alive monitoring (GOSA parity)

**The bug under the feature:** the workflows called `sc_keep_alive` — the
fleet-compat shim — which wrote `sc_keepalive` + `tc_heartbeat` but BYPASSED
the per-source ledger `tc_keepalive_sources`, so Platform Health could never
say where the last ping came from. Fix is two-sided: (a) all three workflows
now call `tc_keep_alive` with honest sources (`keep-supabase-alive.yml` ×4,
`supabase-auto-restore.yml`, and `db-backup.yml` gained a soft-fail
`keepalive-heartbeat` job, source `db-backup` — GOSA Layer-10 parity);
(b) `sc_keep_alive` is re-declared (V45b bridge, appended at the very END of
complete-schema.sql after the V45 status line — function re-declarations must
come after earlier definitions) to ALSO upsert `tc_keepalive_sources`, so
legacy fleet pings are visible in the matrix without breaking the Fleet
Console contract. No `sc_keep_alive` reference remains under `.github/`.

**The matrix itself:** new `assets/js/keepalive-layers.js` — a 14-layer
catalog (`pg-cron, site-visit, github-actions, vercel-cron,
google-apps-script, cron-job-org, edge-ping, manual-health-page,
auto-restore-watchdog, db-backup, watchdog-selfheal, browser-recovery,
fleet-console, external`), each with a plain-English fix hint. Freshness
window 72 h, Supabase pause window 168 h, quorum ≥3 fresh sources. A
`SOURCE_ALIASES` map canonicalises legacy source strings
(fleet/hmg-fleet-console/fleet-actions→fleet-console, manual→manual-health-page,
github-action→github-actions, apps-script→google-apps-script,
uptime-robot→edge-ping, cron-job→cron-job-org) and the merge loop groups by
canonical source (newest last_ping + summed counts). Health reads the
`tc_keepalive_layers` RPC and merges alias rows. `platform-health.html` gets
the layers card: KPI grid (last ping age, source, total pings, pause
countdown, quorum) + a 14-row matrix — every layer shows, including
never-run ones (⚪ Never), each with its fix. The manual-ping caption now
names the canonical source `manual-health-page`.

## Item 2 — advanced CBT (HMG Academy parity)

- **Negative marking** (`assets/js/cbt.js`): `grade(questions, answers,
  opts)` accepts `opts.negative_mark`; every WRONG non-blank answer deducts,
  blanks are never penalised, total AND per-subject scores clamp at zero.
  Returns `wrong`, `negative_mark`, `deducted`. Authored on both builders
  (`practice.html` #neg, `cbt-multi.html` #mm-neg). The runner warns the
  candidate BEFORE starting and shows a deduction line on completion.
- **Draft autosave + resume** (`cbt-exam.html`): every input/change writes a
  sidecar draft to `localStorage` (`tc-cbt-draft:CODE:student`, 24 h). On
  reopen the runner offers Resume / Start fresh; resuming adopts the answers,
  flags and position, and KEEPS the original started time so refresh can
  never reset the clock. Visual restore pass re-selects radios/checkboxes.
- **JAMB shortcuts:** N/→/PageDown next, P/←/PageUp prev, R flag, S submit,
  A–E or 1–5 pick option (guarded on the visible set).
- **Submission receipts** (cert_code, HMG parity): generated on-device
  (`CBT-XXXX-XXXX-XXXX`), stored on the result row, shown on the completion
  screen with a keep-this-code note — verifiable against the results audit.
- **Combined answers at finish:** the draft sidecar merges with a fresh DOM
  collect, so a widget that failed to re-render can never cost marks.

## Item 3 — DramaConnect parity (suggestion box, care list, audit console)

- **complaints.html** gains a suggestion box any signed-in member can use:
  category (suggestion/complaint/question/praise) + optional anonymous flag —
  anonymous rows store `submitted_by='anonymous'`, never the account id.
  Staff triage (crud.js) gains the category + anonymous columns on top of the
  existing priority/assignee/status flow. Schema columns ship in V45.
- **attendance.html** gains the Care list card: `tc_absentee_followup` RPC
  surfaces consecutive-absence learners with class, streak, last seen and
  open follow-ups; staff log calls/notes from the row (or pick any learner).
- **activity-log.html** rebuilt as an audit console: KPI snapshot (events
  shown, today, distinct actors, deletes), db-side filters (actor / table /
  action / date range) + client free-text, capped loads (500 shown, 5000
  export), CSV export for external auditors. Read-only by design — the log
  stays immutable.

## Item 4 — combine CBTs, cumulative scores, auto-assignments

- **Combine published papers** (cbt-multi.html): the 🧩 panel lists published
  papers; ticked ones load straight from the database (`.in('id', ids)`) and
  become subject blocks with their question objects intact — no CSV
  round-trip, no copy-paste, no question loss. Renaming per sitting; editing
  the textarea reverts that block to CSV mode (author override).
- **Cumulative collation → report card** (desk-kit.js): every progress report
  row gets **🧮 Pull CBT marks** — calls `tc_cbt_cumulative(learner, from,
  to)`, merges per-subject averages into matching subject rows (score +
  honest collation comment), appends subjects with CBT history but no row.
  The report stays a draft; publishing stays a human decision.
- **CBT → assignment automation (database):** trigger `trg_cbt_assignment_sync`
  files a homework row (kind `cbt`, linked `cbt_exam_id`) the moment a Graded
  CBT is published to an engagement. The assignments table (crud.js) shows
  the kind column with an explainer; the learner work board (app.js) renders
  CBT rows with a CBT chip, score when present, and a direct Start link.

## Item 5 — CBTs on DEDICATED pages by nature

New **my-quizzes.html** + `assets/js/my-quizzes.js` (nav V27, user audience,
also linked from the work board and from each child card on my-children.html
via `?learner=`): graded papers (incl. UTME-style multi-subject sittings)
with windows/countdowns, attempts, best/last %, negative-marking badges and
Start/Retake links — and practice/review papers in their own never-graded
section. Data from the `tc_my_quizzes` security-definer RPC (attempts matched
by learner id OR student number; parents verified database-side). KPI strip:
graded / open now / practice / attempted.

## Items 6–7 — relevance filter + expert sweep

Only portable, self-contained patterns were taken (no paywalled APIs, no
external services): layer matrix + auto-restore hygiene, negative marking,
drafts, receipts, JAMB keys, combine-papers, cumulative collation, suggestion
box, care list, audit console. Rejected as not portable or not ours:
adaptive difficulty engines, camera proctoring backends, psychometric
reporting, paper/OMR export. Sweep fixes shipped this round: workflow source
ledger bypass (V45b), resume clock integrity, receipt persistence, twin
parity on all touched surfaces, parse checks on every edited page/script.

## Item 8 — every file, both repos

Portal **V45** (pages `?v=45`, shell cache `tc-shell-v14-20261007`,
nav V27): database/v45-health-cbt.sql + complete-schema.sql (incl. V45b
bridge), 3 workflows, keepalive-layers.js (new), my-quizzes.js (new),
activity-log.js (new), cbt.js, crud.js, desk-kit.js, app.js,
nav-model.js/.json, sw.js, platform-health.html, cbt-exam.html,
cbt-multi.html, practice.html, complaints.html, attendance.html,
activity-log.html, my-children.html, my-quizzes.html (new). All touched
surfaces byte-identical in both repos.

## Round-9 QA tally (per repo, both repos green)

    13 suites — 453/453 per repo × 2 repos
    (365 round-8 baseline + 88 test_r9_portal; nothing regressed)

**Deployment note:** run `database/v45-health-cbt.sql` once on existing
projects (idempotent; complete-schema.sql already carries it for fresh
installs). Re-deploy BOTH the workflows and the site — the keep-alive fix
only takes effect when GitHub Actions runs the new workflow files.


---

# ROUND 9 FIELD FIX — "ERROR: 42703: column \"recipient\" does not exist"

Field report: running complete-schema.sql on an existing project aborts
with `column "recipient" does not exist`. Root cause class: the schema
creates tables with `create table if not exists`, so on an EXISTING
database the CREATE is skipped and the table keeps its OLD shape — any
index, policy or SQL-language function body that references a
version-added column BEFORE the `alter table ... add column if not exists`
that upgrades it kills the whole run (Supabase's SQL editor aborts on the
first error). Fresh installs never see it; upgrades always did.

## Fixes (complete-schema.sql + v45-health-cbt.sql)

1. **messages upgrade-order guard** — the V44 columns (recipient,
   sender_name, read_at) are now ALTERed in immediately after the base
   create table, BEFORE the two indexes that reference them (the field
   report). The V44 section's own alters stay (idempotent no-ops).
2. **cbt_results guard before tc_cbt_marking_queue** — that function is
   `language sql`, so Postgres validates its column references at CREATE
   time; candidate_name / pending_count / marking_status are now
   guaranteed before it (previously only guaranteed 1,300 lines later).
3. **Ten drop-policy guards** — library_items (4), eresources (4) and
   tc_blog_comments (2) had `create policy` without `drop policy if
   exists`, so RE-RUNNING the schema aborted with "policy already
   exists". All 201 create-policy statements are now drop-guarded.
4. **v45-health-cbt.sql self-sufficiency** — the assignment-sync trigger
   lists status/is_open/engagement_id/quiz_kind/title/close_at/questions
   in `UPDATE OF`, which requires every column to exist at CREATE TRIGGER
   time. The migration now guarantees the version-added ones itself
   (complete-schema.sql already did, earlier in the file).

## New permanent tooling (both repos)

- **tools/check_schema_order.py** — static upgrade-order checker. A real
  SQL tokenizer (comments, $$-bodies, string literals all handled) tracks
  which columns each table is guaranteed to have at every point in the
  file, then verifies every index, policy, SQL-function body and view
  only references columns that are ALTER-guaranteed BEFORE that point.
  Version-added columns (proven by the file itself carrying a later
  ALTER) are the flag condition. Catches the exact field-report class;
  negative control (guards stripped) proves it fires.
- **tools/pg_stubs.sql + tools/gen_legacy_shape.py +
  tools/verify_schema_pg.sh** — empirical harness: runs the REAL
  complete-schema.sql against a local PostgreSQL in four scenarios —
  FRESH (empty db), LEGACY (146 tables pre-created in their old shapes:
  every version-added column removed), RE-RUN (twice, idempotency), and
  MIGRATIONS (v44 + v45 standalone on legacy). All four report 0 errors
  on both repos. Exits 77 (skip) where PostgreSQL is unavailable.
- **Battery: test_r9_schema (16 checks)** — checker passes + negative
  control fires + guards present and positioned + all 201 policies
  drop-guarded + the four pg scenarios. 469/469 per repo.

## What the reporter should do

Re-run the NEW complete-schema.sql on the project that errored — it is
now safe on legacy databases AND re-runnable (idempotent). No manual
cleanup of the half-applied run is needed: every statement is
`if not exists` / `create or replace` / drop-guarded, so re-running from
the top converges.


---

# ROUND 10 — laptop mic fix, GOSA-parity CBT console, student-portal CBT placement

Prompt (5 items, abridged): (1) ClassDeck mic dead on the reporter's laptop
while Google Meet works on the same laptop and the deck works on their
tablet — audit, diagnose, fix robustly. (2) Implement the GOSA/School
Connect "CBT / Online Exams" features — Archive Recovery Center (V12.7),
filtering/sorting, arrangement by type/kind. (3) CBTs set for an engagement
should appear on the student HOMEWORK/CLASSWORK page, not just the homepage;
clarify the purpose of "My quizzes" (staff saw it and had no use for it).
(4) GOSA's automatic CBT→assignment mirroring is robust and seamless —
match it. (5) Update every file across all repos.

## Item 1 — the laptop mic (ClassDeck v14.1 "MicDoctor")

**Diagnosis.** The teacher path requested `channelCount: 1` — an EXACT
constraint (bare values are exact in getUserMedia) — plus a 48 kHz ideal
and Chrome-only `goog*` flags. Laptop drivers that cannot satisfy exact
constraints (Windows communications devices, some Realtek/BT stacks)
reject the entire request; the catch then showed a *permission* message,
so nobody knew what actually failed. Tablets worked because their drivers
accept mono; Google Meet worked on the same laptop because it never pins
exact constraints. Two further laptop-only failure modes had no detection
at all: pages opened over http:// (desktop browsers disable mediaDevices
entirely) and streams that open but carry silence (hardware mic-mute key,
zero input volume, wrong OS device) — the failure Meet detects with a
level meter.

**Fix (classdeck/js/rtc.js MicKit + teach.js + join.js).** A constraint
LADDER that never uses exact values (preferred-device → default with
processing → plain `{audio:true}`), permission-denial aborts (constraints
cannot fix permissions), precise error classification (NotAllowed /
NotFound / NotReadable / Overconstrained / insecure-context, each with an
actionable message), a remembered device choice, and a Web-Audio level
watchdog that raises `silence` once when an enabled, unmuted track has
never produced signal. Teacher side gets a MicDoctor banner (Fix mic +
device picker + hearing-you confirmation) whose recovery re-feeds the
live stage stream (`setStageStream` re-calls every student safely);
student `shareMic` uses the same ladder and surfaces `micSilent` events
into join.js guidance. The watchdog stops on every teardown path.

## Item 2 — CBT console on the Quizzes page (GOSA parity)

New `assets/js/cbt-console.js`, mounted on practice.html (fetch widened
60 → 500 papers): filter bar (search / subject / class / kind / identity
mode / single-vs-multi / status / active-archived-all view / sort by
newest-oldest-title-code), papers ARRANGED BY NATURE — 🔴 Graded · 📝
Drafts · 🧪 Practice · 🔵 Review · 📦 Archived — each group with a count
chip, explainer line, state badge, multi-subject and negative-marking
badges, windows, and the full CBTManage action set. The 🗃️ Archive
Recovery Center (GOSA V12.7) ports in full: view archived/active/all,
restore ALL, restore only the filtered-visible ones, undo the last bulk
action, export archived papers as a portable JSON backup, import a backup
back in, and an advanced restore-by-filter panel (subject / class / kind,
blank = match all). (GOSA term/session concepts were adapted out — a
tutoring studio organises by engagement, not term.)

## Item 3 — where CBTs appear for students (the expert call)

A CBT set for a class is **work due**, so it now lives wherever homework
lives, and it is differentiated by nature everywhere it appears:

- **Homework page (assignments.html) is role-aware.** Learners and parents
  get a new view (`assets/js/homework-student.js`, fed by `tc_my_work`):
  *Due next* — homework and CBT papers in ONE soonest-first list (CBT rows
  carry a CBT chip + Start link); *CBT papers by nature* — 🟢 Live now /
  🕓 Upcoming / 🧪 Practice / 🔒 Closed; *Done & marked* with scores.
  Staff keep the marking workbench below.
- **My quizzes is now a FAMILY page.** It was invisible to the families it
  was built for (rbac deny-by-default) and cluttered staff menus — the
  exact confusion reported. rbac.js lists it under FAMILY_READ; a new nav
  audience `family` (nav.js) keeps it out of tutor/admin menus while the
  page itself stays reachable; nav model → V28.
- Work board cross-links Homework page · My quizzes.

## Item 4 — seamless CBT → assignment automation (V46)

`tc_sync_cbt_assignment()` is now a full lifecycle sync, behaviorally
verified on PostgreSQL (tools/v46_behavior.sql): publish → mirror with
sit link + summed max score; rename/close-date/max changes → mirror
follows; archive → mirror withdrawn; restore → mirror returns; delete →
mirror removed (no orphans, ever); practice/unclassed papers never
mirror. `tc_my_work` v3 feeds the homework page with windows,
multi-subject flag and negative-marking, and drops archived papers.
Migration: `database/v46-cbt-automation.sql` (self-sufficient guards;
also appended to complete-schema.sql).

## Item 5 — every file, both repos

Portal V46 (pages `?v=46`, shell cache `tc-shell-v15-20261008`, nav V28):
practice.html, assignments.html, my-quizzes.html, app.js, nav.js, rbac.js,
nav-model.js/.json, cbt-console.js (new), homework-student.js (new),
database/v46-cbt-automation.sql + complete-schema.sql, sw.js.
ClassDeck v14.1.0 (pages `?v=49`, sw
`hmg-classdeck-v14.1.0-micdoctor-cbt-console-homework`): rtc.js, teach.js,
join.js, teach.html, join.html, version.json, sw.js.

## Round-10 QA tally (per repo, both repos green)

    16 suites — 564/564 per repo × 2 repos
    (469 round-9 baseline + 27 test_r10_mic + 67 test_r10_portal + 1 pin update)
    PostgreSQL harness: 5/5 scenarios clean (incl. V46 behavioral asserts)

**Deployment note:** run `database/v46-cbt-automation.sql` once on
existing projects (idempotent; complete-schema.sql already carries it for
fresh installs) and re-upload the ClassDeck — the mic fix only takes
effect when the new v49 assets are served.


---

# ROUND 11 — credential roaming, Drive backup, streaming, the console blank-page bug, family messaging

Prompt (7 items, abridged): (1) TURN credentials entered on one device must
be available on every device after signing in — and other credentials
likewise. (2) Google Drive backup setup failed: "A table is missing
(school_settings)" — fix with Client ID 1051552536424-….apps.googleusercontent.com.
(3) Make Facebook/TikTok/YouTube streaming robust, self-contained,
all-inclusive, seamless — enterprise features, every error imagined and
fixed. (4) The GOSA "CBT/Online Exams" features were reported as not
implemented (Archive Recovery Center, filtering/sorting, arrangement).
(5) Students and parents still cannot message tutors/admins; all four
roles must message one another. (6) The Quizzes page showed NO CBT
papers; all sorting/filtering parameters must work. (7) Update every file
across all repos.

## Item 6+4 — the Quizzes page was blank: root cause and fix

The round-10 console PARSED but CRASHED at render time:
`render(opts)` shadowed the `opts()` option-builder helper, so render died
with "opts is not a function" at the Subject dropdown and — with the old
flat list hidden — the page showed nothing. This is why the GOSA features
were "not implemented": they shipped but never drew. Fixed (render(cfg)),
and this round's QA EXECUTES the real console in a VM with a mock DOM:
render completes, all five nature groups draw, all 9 filters flip through
the wired handlers (search/subject/class/kind/mode/type/status/view/sort),
sort re-orders papers within a group, reset restores the list, and the
Archive Recovery Center's restore-ALL actually updates supabase. Static
checks could not catch the original bug; the runtime smoke now can.

## Item 5 — family messaging: root cause and fix

The v44 RPCs were built for families, but round 9's V27 RBAC sweep had
swept `messages` into the family DENY list — learners/parents hit
"Your role does not have permission" on the exact page built for them.
rbac.js now lists messages under FAMILY_WRITE (deny lifted; the rest of
the V27 sweep stands). v47 also fixes the messages read policy to allow
`recipient = auth.uid()` (person-to-person inbox reads were only possible
through the security-definer RPCs). The full chain is proven on
PostgreSQL as the authenticated role with jwt claims: learner directory
lists staff; learner→tutor sends; tutor reply works; tutor→unlinked
learner refused; parent→admin sends; admin unread badge counts.

## Item 1 — credentials follow the login (V47 + CloudCreds)

ClassDeck ships inside the portal (same origin), so when the teacher is
signed in to ADEWALE CLASSROOM the session token is in localStorage.
New `classdeck/js/cloud-creds.js` uses it to sync through the new
owner-only `user_settings` table: on studio open, pull; on
generate/save/renew/clear, push. Channels: cd-turn (Cloudflare TURN key,
generated relay credentials, expiry) and cd-stream (gateway, secret,
destinations). Merge policy is conservative: pull only fills EMPTY local
values; a deliberate clear pushes a tombstone so removed credentials are
never resurrected. Expired sessions are refreshed from the deck via the
refresh token and written back. The Google Drive settings were already
designed to roam via school_settings ("shared by all admin devices") —
v47 finally creates that table, so all three credential families now
follow the account.

## Item 2 — school_settings existed nowhere (V47)

The Drive card read a table no schema file created. v47 creates it
(readable by signed-in members, admin-writable), pre-seeds the school's
Google OAuth Client ID (never overwriting a saved one), and the setup
guide now names the one remaining manual step: Authorized JavaScript
origins in Google Cloud Console.

## Item 3 — enterprise streaming (V47 StreamKit)

New `classdeck/js/stream-kit.js` + teach.js rework: 7 platform presets
(pick a platform, paste ONLY the key — YouTube/Facebook RTMPS-443/TikTok/
Instagram/Twitch/Kick/custom, with per-platform guidance); key hygiene
(masked, trimmed, full-URL-pasted-as-key detected); preflight before a
byte leaves the device (empty keys, duplicates, TikTok-landscape warning,
http gateway on https page blocked, relay health probe); fetch timeouts
on every relay call (a dead gateway can never hang the UI) with relay
error bodies surfaced; a WHIP watchdog with exponential-backoff
auto-reconnect (1s→30s, 5 attempts, escalates to re-starting
destinations); a live clock; fps selector wired into the encoder with
honest bitrate guidance; beforeunload guard; cloud sync of gateway and
keys. Legacy saved destinations are parsed back into the new UI — nothing
is lost.

## Item 7 — every file, both repos

Portal V47 (pages `?v=47`, shell cache `tc-shell-v16-20261008`):
cbt-console.js (render fix), rbac.js, database/v47-cloud-credentials.sql
(new) + complete-schema.sql, tools/v47_behavior.sql (new) + harness,
docs/GOOGLE-DRIVE-SYNC-GUIDE.md, sw.js.
ClassDeck v14.2.0 (pages `?v=50`, sw `hmg-classdeck-v14.2.0-cloudcreds-streamkit`):
cloud-creds.js (new), stream-kit.js (new), teach.js, teach.html, join.html,
version.json, sw.js.

## Round-11 QA tally (per repo, both repos green)

    19 suites — 666/666 per repo × 2 repos
    (666 round-10 baseline + 18 console smoke + 38 cloud/stream + 46 portal
     + version-pin updates; includes runtime-DOM tests, not just greps)
    PostgreSQL harness: 6/6 scenarios clean (incl. V47 credentials +
    messaging behavior as the authenticated role)


---

# ROUND 12 — roaming made airtight, smart stream paste, bell deep links, WhatsApp replica

Prompt (6 items, abridged): (1) The TURN key entered and saved on one
device must be there after signing in on ANY other device — robustly, and
other credentials likewise. (2) Streaming to Facebook/TikTok/YouTube etc:
robust, self-contained, seamless; make entering credentials (rtmp etc)
easy; enterprise features; imagine every error and fix it. (3) Clicking a
message in the notification bell must lead directly to the message page.
(4) Make the chat a replica of WhatsApp. (5) complete-schema.sql must be
self-contained — running it alone must be enough. (6) Update every file
across all repos.

## Item 1 — why roaming could still fail, and the airtight fix

Round 11 synced credentials through the portal session, but two real
holes remained: (a) the deck discovered the portal endpoint by fetching
../assets/js/config.js — which 404s when the deck is deployed on its own
domain, silently disabling roaming; (b) credentials saved BEFORE the V47
update ran were never in the cloud, so a pull on the new laptop found
nothing — and the failure was silent. Fixes: the endpoint is now BAKED
into classdeck/js/config.js at generation time (window.CLASSDECK.SUPABASE
— per-repo, placeholder in the generator template, with the ../ fetch as
fallback); a pull now AUTO-PUBLISHES any channel that exists locally but
not in the cloud (the working setup wins, awaited so pull() = sync
complete); a missing user_settings table is diagnosed precisely ("run
database/v47-cloud-credentials.sql") instead of a vague "unreachable";
and the deck login itself now signs in to the portal with the same
email+password (fire-and-forget), with a visible ☁️ Cloud sync card in
Settings (status, Sync now, Link account, Unlink). All proven in a VM:
endpoint priority, 404 diagnosis, auto-publish, signIn/signOut, session
storage under the supabase-js key.

## Item 2 — entering stream credentials the easy way

A ⚡ smart-paste box above the destinations: paste ANYTHING — a bare
stream key, a full rtmp(s)://server/app/key URL, a URL with no key, or
even text copied from a platform dashboard — and StreamKit.smartParse
works out platform + server + key (keyword-guessed platform, unknown
servers → Custom). Per-platform key-shape heuristics warn about
wrong-looking keys (YouTube xxxx-xxxx-xxxx-xxxx, short Facebook/TikTok
keys) without blocking. A 💾 Save settings button saves AND cloud-syncs
in one press. Every relay call still times out; preflight, watchdog,
auto-reconnect and presets from round 11 stand.

## Item 3 — the bell leads somewhere (V48)

Root cause: the dropdown navigates via the notification's url column —
but no writer ever set it. V48: tc_message_send notifications now carry
url='messages.html'; the CBT-submission trigger writes url (alongside the
legacy link column); legacy rows are backfilled so OLD notifications
become clickable too. Client-side, every item resolves a destination via
url → link → title-derived map (message/cbt/invoice/booking/homework/
complaint/birthday), shows a red unread dot and a "tap to open 💬" hint.
Proven on PostgreSQL: message → messages.html, CBT → its results page
with exam id, backfill verified.

## Item 4 — the WhatsApp replica

messages-center.js rewritten as a WhatsApp Web replica on the same v44
RPCs: green app band, wallpaper chat area with doodle pattern, chat list
with avatars + green unread pills + working search, bubbles with tails
(outgoing #d9fdd3 / incoming white) with the timestamp INSIDE the bubble
and ✓ sent / ✓✓ blue read ticks, TODAY/YESTERDAY date separators,
composer with rounded field + emoji quick bar + round green send button
(Enter sends, Shift+Enter newlines), quiet 30-s live refresh while not
typing, scroll-to-bottom pill, and a phone layout where the chat slides
over the list with a back arrow. Runtime-proven in a DOM sandbox: list,
bubbles, ticks, separators, Enter-send, Shift+Enter, search.

## Item 5 — complete-schema proven self-contained

v48 merged; a mechanical containment check now runs in the battery: every
function and table created by every migration file v44–v48 must exist in
complete-schema.sql, which must end with the PostgREST reload and the V48
status line. PostgreSQL harness: 7/7 scenarios clean (fresh, legacy
shapes, re-run, migrations-standalone, V46/V47/V48 behavioral).

## Item 6 — every file, both repos

Portal V48 (pages ?v=48, shell cache tc-shell-v17-20261008):
notifications.js, messages-center.js (rewrite), messages.html,
database/v48-notification-links.sql (new) + complete-schema.sql,
tools/v48_behavior.sql (new) + harness. ClassDeck v14.3.0 (pages ?v=51,
sw hmg-classdeck-v14.3.0-cloudsync-smartpaste-notiflinks): config.js
(baked endpoint), cloud-creds.js (endpoint priority, auto-publish, 404
diagnosis, signIn/signOut), auth.js (login auto-link), stream-kit.js
(smartParse, key shapes), teach.js + teach.html (cloud card, smart paste,
save button), join.html, version.json, sw.js.

## Round-12 QA tally (per repo, both repos green)

    21 suites — 739/739 per repo × 2 repos
    (+31 cloud/stream robustness, +42 bell/chat/schema-containment,
     plus pin updates; includes runtime DOM/VM tests and a PostgreSQL
     harness with 7 scenarios, two of them behavioral as the
     authenticated role)

---

# ROUND 13 AUDIT (2026-10-08)

Every binding item from the round-13 brief, traced to the exact files that
implement it and the exact test that proves it. Battery: 22 suites,
829/829 per repo × 2 repos; PostgreSQL harness 8/8.

## Item 1 — stream/TURN token visible on a new device + Restore button

| Piece | Where | Verified by |
|---|---|---|
| Auto-restore on login, visible confirmation | classdeck/js/auth.js (signIn→pull→toast) | test_r13_portal §classdeck |
| ☁️ Restore from cloud (Tablet Live) | classdeck/teach.html #tlRestore + teach.js restoreCredsFromCloud | test_r13_portal §classdeck |
| ☁️ Restore TURN key (relay card) | classdeck/teach.html #btnRestoreCreds | test_r13_portal §classdeck |

## Item 2 — stream.html (Tablet Live) unambiguous

Field-by-field table with examples (gateway URL/WHIP pattern, secret,
stream name, format, fps, platform/key/server, smart paste, save/restore,
remember, start/stop/check) + 5-step quick start + dry-run warning +
downloadable field checklist: classdeck/stream.html §2. Verified:
test_r13_portal (11 field checks + examples).

## Item 3 — admin-data "–" stat cards

Root cause: cards only filled after a manual scan. Fix: autoHeadCount()
on load (head-count only), "x / total" semantics, skipped tables named,
TABLES list grown (lms_lessons, reading_*, user_settings,
push_subscriptions, stream_posts, gallery). Verified: test_r13_portal
§admin-data (4 checks).

## Item 4 — expert audit of stream + documents etc.

stream.html: governance copy-paste replaced (intro, who, why, how, roles),
staff-only posting gate, scheduled posts hidden from families, empty-state
copy. documents.html: roles now state family read access. 18 further pages
carrying the same governance boilerplate rewritten page-accurately
(announcements, birthdays, broadcasts, complaints, directory, forum,
gallery, helpdesk, inbox, leave, notifications, parent-meetings, polls,
profile, rooms, substitutions, surveys, voting). Verified: test_r13_portal
§stream/documents + grep sweeps.

## Item 5 — classwork tutor UX

KPI chips, filter toolbar, kind icons, due-date colours, skills chips,
points badges, Export CSV (filtered) / Export PDF, staff-only posting card
with family note, collapsible intro. classwork.html (rewritten around
RecordActions). Verified: test_r13_portal §classwork (5 checks).

## Items 6–9 — shelves: "unlinked" fixed + student visibility + GOSA parity

DB (v49): is_tutor() NULL-status fix (the Unlinked root cause);
tc_family_reads_engagement(); eresources/library family read widened,
lms_lessons/resources family read created (published-only for LMS);
tc_my_work() v2 returns library/eresources/resources/lms. UI: crud.js
honest ref labels + ⚠ banner + form keep-value + refresh()/importCSV();
schema labels "Class / group / cohort (who sees it)"; GOSA toolbar +
collapsible intro on all four pages. Verified: harness scenario 8
(asserts 1–15, 24–29) + test_r13_portal §crud §workboard §GOSA (29 checks).

## Item 10 — notifications clearable + auto-popup

DB (v49): own-delete policy (recipient/created_by/user_id), notif_clear()
RPC (delete-own / hide-shared), cleared_by column. UI: per-item ✕,
Clear all in dropdown + page, fetchRecent filters cleared rows, bell
auto-OPENS on first-seen notification, push re-subscribe on init.
Verified: harness scenario 8 (asserts 16–23) + test_r13_portal
§notifications (12 checks).

## Item 11 — reading links visible + tickable

DB (v49): reading_items/reading_progress family read; learner own-write
progress. UI: reading.html renders items as Open ↗ links with ✓ I read
this (upsert reading_progress), staff-only setter card, collapsible intro.
Verified: harness scenario 8 (asserts 8–9, 14–15) + test_r13_portal
§reading (4 checks).

## Item 12 — every file, both repos

Portal V49 (pages ?v=49, shell tc-shell-v18-20261008): crud.js,
notifications.js, app.js, classwork/reading/stream/documents + 4 shelf
pages + admin-data.html + 18 intro rewrites, database/v49 (new) +
complete-schema.sql, tools/v49_behavior.sql (new) + harness scenario 8.
ClassDeck v14.4.0 (pages ?v=52, sw
hmg-classdeck-v14.4.0-restore-family-library-gosa): teach.js, teach.html,
auth.js, stream.html, version.json, sw.js. Twin synced (generator mirror +
identity re-bake + SEO); suites re-whitelisted for the new versions;
test_v27/v28 rot repaired to test intent. ZIPs rebuilt.

## Round-13 QA tally (per repo, both repos green)

    22 suites — 829/829 per repo × 2 repos
    (+94 round-13 portal checks, plus pin updates; includes runtime
     DOM/VM tests and a PostgreSQL harness with 8 scenarios, one of them
     a 29-assertion behavioral run as the authenticated role)

# ROUND 14 AUDIT (2026-10-08)

The user's eight-item field report against the deployed round-13 build, and
what each one turned out to be.

## Item 1 — TURN key must pre-fill on any device (+ Restore button)

The settings-open handler filled the TURN Token ID / API token boxes from
LOCAL storage only — a new device always showed them empty, and the teacher
reasonably assumed the key had to be bought/pasted again. Fix (14.5.0):
`settingsCloudPrefill()` runs on every Settings open — when this device has
no saved key and the account is linked, the key is pulled from the cloud and
the boxes + relay box fill themselves; a **☁️ Restore key from cloud**
button now sits inside the TURN-key card next to ⚡ Generate (always
refreshes the boxes, with an honest "nothing saved in your account yet"
message), alongside the r13 relay-card restore. Auto-pull never overwrites
values typed into the boxes but not yet saved.

## Items 4–7 — "linked · name unavailable" on all four shelves (ROOT CAUSE)

`profiles.status` DEFAULTS TO 'pending' — not NULL. Round 13's
`coalesce(status,'approved')` therefore matched nothing: the owner's
profile sat at the untouched signup default, `is_tutor()`/`tc_is_manager()`
returned false, and the engagements READ policy (is_tutor + family joins
only — no `is_admin()`) silently returned zero rows. RLS does not error
there; the CRUD link map came back empty and every linked row rendered
"linked · name unavailable" — on E-resources, Mini LMS, Digital library
and Resource library alike — while writes (which DO accept `is_admin()`)
kept working. V50 (`database/v50-staff-access-truth.sql`):

- `is_tutor()` v2 — manager roles (owner, admin, director, super_admin,
  lead_tutor) are NEVER status-gated (there is no one above an owner to
  approve them — gating them is a deadlock); operational roles (tutor,
  staff, teacher, instructor) pass on NULL/blank/approved/active, while
  'pending'/'suspended' still require approval — the workflow stays real.
- `tc_is_manager()` v2 — same never-gate for manager roles.
- `engagements_read` now also accepts `is_admin()`.
- NEW `tc_ref_labels(p_table)` — a security-definer RPC returning
  id→label maps for engagements/subjects/tutors/learners/parents to
  approved staff (learners get {}). crud.js calls it automatically
  whenever a ref table reads back empty, so link names can never go dark
  again even if a future policy regresses; a retry banner covers the rest.

## Item 5 — new LMS lessons never reached students

Two traps stacked: the table default and the form's first option were both
'draft', and drafts are (correctly) invisible to families — so every "new
resource" was born hidden. V50 sets the table default to 'published', the
form order/default follows, the list renders 🟢 published / 🟡 draft·hidden
badges, and every row gets **🚀 Publish / 🐢 Unpublish** one-click actions
(rowActions gained a `when(row)` predicate so only the relevant button
shows). Explicit drafts stay hidden — asserted in the behavior harness.

## Item 3 — admin-data "Tables readable / Rows in total: –"

Same root cause (a pending-status owner failed every staff gate, so every
count query starved), plus a UX that could fail silently. v50 fixes the
data path; `autoHeadCount` was also hardened: a signed-out state ("sign
in"), live counting progress, a clickable card to recount, an automatic
2.5s retry, and a zero-readable diagnosis that names the cause and the
migration file to run.

## Items 4–6 enhancements (GOSA re-understudy)

Fetched GOSA lms.html + digital_library.html: their pattern (collapsible
intro + staff-gated toolbar + CRUD list) was already ported in round 13;
this round adds the substance on top of it — scoped/shared KPI cards
("Scoped to a class: N · Shared to everyone: M"), colored status badges
with student-visibility tooltips, example-bearing field help on all four
shelf schemas (titles, links, kinds — "so new users make no errors"),
lms.html publish-workflow copy, and the empty-ref-map retry banner.

## Item 2 — stream.html depth

Rebuilt around the new user: a "3 things you need" orientation card, a
6-step quick start with a mandatory 60-second dry run, the field guide
gained a **new-user mistake column** (✅ right / ❌ wrong per field), a
platform cheat-sheet with exact click-paths (YouTube Studio → Go Live →
Streaming software; Facebook Live Producer; TikTok Live Center + 1,000-
follower eligibility; Instagram professional-account + per-session keys;
Twitch dashboard), a 10-row symptom→cause→fix troubleshooting table, a
**first-run checklist that persists** (localStorage), and a downloadable
plan that now includes where-every-key-lives + troubleshooting.

## Item 8 — every file, both repos

Portal V50 (pages ?v=50, shell tc-shell-v19-20261008): crud.js, the four
shelf pages + lms copy, admin-data.html, database/v50 (new) +
complete-schema.sql, tools/v50_behavior.sql (new) + harness scenario 9.
ClassDeck v14.5.0 build 19 (pages ?v=53, sw
hmg-classdeck-v14.5.0-staff-truth-publish-turn-roam): teach.js,
teach.html, stream.html, version.json, sw.js. Twin synced byte-identical
(AC→TC site files; TC keeps the generator tooling); suites re-whitelisted
for the new versions; test_r14_portal.js (88 checks) added and registered.

## Round-14 QA tally (per repo, both repos green)

    23 suites — 921/921 per repo × 2 repos
    (+88 round-14 portal checks; PG harness now 9 scenarios — V50's is a
     13-assertion behavioral run including the pending-OWNER engagement
     read, the pending-tutor block, tc_ref_labels staff-only, and
     publish-by-default vs explicit-draft visibility)

# ROUND 15 AUDIT (2026-10-09)

The user's eleven-item report, and what each turned out to be.

## Items 2–5 — "linked · name unavailable" ON THE STUDENT PORTAL

Round 14 fixed the staff side; the student side still broke because the
link-name lookup reads the engagements TABLE through RLS, and for these
family accounts that read came back empty while the shelf rows themselves
stayed visible through the family policy. V50's tc_ref_labels() fallback
returned {} for non-staff, so it could not rescue them. **V51 makes
tc_ref_labels() role-aware**: a learner receives the id→name map of
exactly the engagements they are a member of (the same predicate that
lets them see the shelf rows at all — proven in the harness as the
learner resolving their own class name while NOT receiving other
classes'), and a parent gets their children's. Name resolution no longer
depends on the engagements table's SELECT policy. On top of the fix, all
four shelf pages are now ROLE-AWARE: learners and parents get
**shelf-student.js** — a studying view (search, subject/kind filters,
Open buttons that normalise Drive links, due chips, lesson numbering,
honest empty states) instead of the staff database table.

## Item 8 — Digital library, GOSA deep-study implemented

Studied GOSA's digital_library.html in full (authoring card, five
question types, tolerant marking, attempt limits, linked CBT, points
accumulation, report-card push). Implemented for ADEWALE CLASSROOM:
library_items gains instructions / due date / max score / attempt limit
/ questions JSONB / has_quiz / linked-CBT code; a new
**library_quiz_attempts** table records each learner's auto-marked
attempt (own-insert, own+children read, staff read all — RLS-refused
foreign inserts asserted in the harness); **library-quiz.js** carries
the engine — quiz modal with mcq / multiple-response / true-false /
short-answer / keyword questions, GOSA-tolerant marking (an answer typed
as a LETTER or POSITION marks correctly), attempt limiting, best-attempt
aggregation; library.html gains the teacher authoring card with the
question builder + edit picker, and the **🏅 points workbench** (best
attempt per learner per reading, linked-CBT best attempts merged,
Σ totals, 🚀 push into the scoresheet as continuous-assessment
evidence with source 'library_points').

## Item 10 — Assignments, GOSA deep-study implemented

Studied GOSA's assignments.html (CBT-assignment auto-fill V12.11, the
student points explainer, the points workbench). Implemented:
**assignment-points.js** — ✍️ Score class on any homework row scores
the whole class in one modal, AUTO-FILLED from each learner's best CBT
attempt scaled to the assignment's maximum (raw 15/20 → 7.5/10 at max
10) for CBT assignments, manual for physical; per-learner rows are
written so the class-wide row is never overwritten. The **term score
sheet** renders every assignment as a column and every learner as a row
with totals and %; Σ Totals is the condensed view; 🚀 pushes cumulative
homework points into the scoresheet (source 'homework_points'); CSV
export included. The page gains the CBT-homework guide with the
unambiguous badge table (🟢 CBT homework many-per-term cumulative · 🔵
graded quiz once-per-term → scoresheet · 🟣 practice never graded) and
the student explainer "🏆 Why your homework earns points" with a live
my-points panel fed by tc_my_work.

## Item 1 — "Last backup: never"

The timestamp lived in localStorage — PER DEVICE — and the cloud-side
Drive timestamp was never read by the card. Backups taken on the tablet
read as "never" on the laptop. practice_settings gains **last_backup_at**
(the studio record): every backup path stamps it (local download and
Google Drive), and the card shows the newest of local / studio / Drive
with source and staleness ("35 days ago — take a fresh one"). A true
"never" now explains exactly what to do.

## Item 7 — the TURN key never reached the cloud (root cause found)

The Settings save handler NEVER read the two TURN boxes — they were
persisted only when ⚡ Generate ran, so a hand-typed key+token lived in
the input boxes alone: never in Store, never pushed, and every other
device correctly said "nothing saved there yet". And "last sync = login
time" was pull() stamping lastSync on every read — including reads of an
empty account. Fixes: Save now persists the boxes and pushes cd-turn
immediately (a deliberate clear pushes the tombstone); pull() only
counts as a sync when data actually moved; the sync card shows WHAT the
account holds ("🔑 TURN key ✓/nothing yet · 📡 stream setup ✓/nothing
yet"); the empty-account restore message names the exact remedy.

## Item 6 — Tablet Live modal, field by field

The modal's bare labels are gone: a 3-things orientation line, then
every field (① gateway URL ② destinations, gateway secret, stream name,
format, frame rate, save/restore/remember, start/stop/check) carries a
description with a copy-paste example and explicit ✅ right / ❌ wrong
guidance, cross-linked to the Social centre's full guide, click-paths
and troubleshooting table.

## Item 9 — complete-schema.sql proven self-contained

New tools/audit_selfcontained.py walks EVERY database/*.sql file,
extracts each created object (tables, functions, policies, indexes,
triggers, columns) and verifies it exists in complete-schema.sql —
currently 884 objects, SELF-CONTAINED ✅, and the check runs inside
test_r15_portal so a future migration that forgets the splice fails the
battery. (The audit also caught this round's one real splice regression
within minutes: a bad tail-splice had silently dropped the V50 section —
rebuilt and re-proven.)

## Item 11 — every file, both repos

Portal V51 (pages ?v=51, shell tc-shell-v20-20261009): crud.js,
shelf-student.js (new), library-quiz.js (new), assignment-points.js
(new), drive-sync.js, the 4 shelf pages + library.html + assignments.html
+ admin-data.html, database/v51 (new) + complete-schema.sql,
tools/v51_behavior.sql + audit_selfcontained.py (new) + harness scenario
10. ClassDeck v14.6.0 build 20 (pages ?v=54, sw
hmg-classdeck-v14.6.0-family-labels-quiz-points-turnsave): teach.js,
cloud-creds.js, teach.html, version.json, sw.js. Twin synced
byte-identical including tools/.

## Round-15 QA tally (per repo, both repos green)

    24 suites — 1007/1007 per repo × 2 repos
    (+85 round-15 portal checks; PG harness now 10 scenarios — V51's is a
     10-assertion behavioral run incl. the learner's own-class name
     resolution, the parent path, foreign-attempt RLS refusal, and the
     owner-settable last_backup_at)

# ROUND 16 AUDIT (2026-10-10)

The user's eleven-item report, and what each turned out to be.

## Item 1 — Timezone desk: BOTH times, everywhere, forever

The blueprint is now **tz.js**, the timezone truth engine, plus **V52**
(tc_my_tz): the database answers, in one security-definer call, the
studio's home zone (practice_settings.timezone → the is_default desk
entry → Africa/Lagos) and the signed-in viewer's OWN zone (their desk
entry → their role-table timezone column → null, and the client then
falls back to the browser zone — pre-V52 databases degrade gracefully
to "correct for the viewer", never broken). Every schedule-ish page —
dashboard, sessions, bookings, the LMS/library/resources/e-resources/
homework tables — renders datetimes through TZ.dualHtml(): 🏠 studio
time · 👤 viewer time (+/−Nh badge), and ONLY when the two zones
actually differ, so a Lagos–Lagos pair sees exactly what it always saw.
The dashboard's Next-class card and the homework CBT opens/closes show
the same dual line, primed BEFORE first paint. timezones.html gains the
**meeting planner** (enter a time in ANY zone — it can be the
student's — and read that moment in every studio zone at once, with
🟢/🔴 working-hours flags, blackout notes, DST-correct in both
directions via a drift loop), a **copy dual-time-line** button for
pasting "4:00 PM Lagos = 9:00 AM Toronto" into a message, and **live
1-second world clocks** — all of which re-prime themselves whenever a
desk entry is edited above them (MutationObserver → TZ.refresh()).

## Items 2–6 — the banner/cells family, root-caused and closed

The Edit-button clue was decisive: Edit fixed the names because
openForm does a FRESH table read, so the bug was never RLS — it was
**crud.js's _refCache caching the EMPTY engagements map forever**. The
first read ran before supabase-js finished restoring the session, RLS
as anon returns 0 rows — not an error — so V13.1's error path never
fired and the empty map was cached as truth. The r16 fix: renderList
waits for auth.getSession() before the first read; an empty result now
consults tc_ref_labels() before giving up, is marked __empty and kept
separately (_refEmpty — NEVER cached), and _scheduleRefRetry()
repaints every mounted list 2.5s later; onAuthStateChange purges all
caches, so the anon→user transition can never leave stale empties.
The student-portal half was a second race: App.currentRole arrived
AFTER the pages' 4-second role-wait loop, the learner fell through to
the staff crud table and saw the very banners the split prevents. The
five pages now decide with **App.detectRole()** (10s wait →
tc_current_role RPC tiebreak → cached-profile fallback) — truth, not
timing. Family cells are viewer-aware: read-only viewers see "🎓 your
class" for engagements and "linked ✓" for other refs, never "linked ·
name unavailable", never ⚠, and both ref banners are suppressed for
them entirely. The student shelf also gained a class filter (GOSA's
class scoping, better — labels come from the role-aware RPC).

## Item 7 — complete-schema.sql is all-inclusive

V52 spliced at the tail with its own banner; tools/audit_selfcontained.py
now proves **887 objects** (V52's tc_my_tz + tc_last_backup included),
check_schema_order stays green, and the PG harness gained scenario 11
(tcv_v52): an 8-assertion behavioral run — the learner's home+mine in
one call, the owner's null mine, the desk entry outranking the
role-table column, the anonymous home, and tc_last_backup answering
for ANY authenticated member — on top of the 10 legacy scenarios, all
clean on FRESH, LEGACY and RE-RUN databases.

## Items 8+9 — ClassDeck cloud credentials, the silent-failure autopsy

Device B honestly said "nothing saved yet" because **the account never
received the key**: push() built its row with state.uid BEFORE any
request ran, and the uid was only resolved lazily inside the request
helpers — so the FIRST push of a session uploaded user_id NULL, the
owner-only RLS policy refused it with 403, and push() returned false
into the void. The key looked saved on device A while the cloud stayed
empty. push() now resolves the token+uid FIRST (with a JWT-sub
fallback for session shapes without user.id), and no TURN-key push is
silent anymore: Generate AWAITS its push and toasts failures with the
remedy, typed-key Save does the same. pull() matched rows to channels
by exact key name only — any row saved under a different label was
ignored; channels now resolve **by name OR data shape** (a value with
cf_key/cf_token/relay_servers IS the cd-turn channel whatever the row
is called). And "Sync now" only pulled — after generating credentials
it reported "synced" while the new key never left the device and
"last sync" stayed "not yet". **syncNow()** is a real two-way sync:
channels this device holds that the cloud lacks — or holds differently
(diffed against the exact cloud payload pull kept) — are pushed first,
then pull brings back what THIS device lacks; a successful push now
stamps the sync clock and the Account-holds line the moment it lands.

## Item 10 — "Last backup: never", the anon race one page later

The r15 reader ran ONCE at page load, usually before the session was
restored: the practice_settings select ran as anon, RLS returned NULL
(not an error), and the card froze at "never" on every device except
the one that took the backup. The card is now a named, reusable
**renderLastBackup()**: session-gated, served by the new
security-definer **tc_last_backup()** RPC (any authenticated member
reads the studio-wide truth regardless of practice_settings RLS — with
the direct select kept as a pre-V52 fallback), re-rendered on every
auth change (INITIAL_SESSION/SIGNED_IN/TOKEN_REFRESHED) and after
EVERY backup path, merging local + studio + Drive timestamps (newest
wins, tooltip names the source). Every backup path also stamps
**backup_path** (V52 column) — "device: tutoring-connect-backup-….json"
or "drive: school-connect-backup-….json" — so the card can say not
just WHEN but WHERE the newest archive lives.

## Round-16 QA tally (per repo, both repos green)

    25 suites — 1110/1110 per repo × 2 repos
    (+103 round-16 portal checks; PG harness now 11 scenarios — V52's
     is an 8-assertion behavioral run incl. the learner home+mine
     resolution, desk-entry precedence, the anonymous home, and
     tc_last_backup for any authenticated member)

## Round-16 versions

Portal ?v=52 / sw tc-shell-v21-20261010; deck ?v=55 /
hmg-classdeck-v14.7.0-turnsync-truth / version.json 14.7.0 build 21.
Twins synced byte-identical including tools/ (TC keeps only its
generator fixtures-csv extra, which never flows back to AC).


---

# ROUND 17 AUDIT (2026-10-10)

Scope: the user's seven items — (1) deck device B cannot restore a TURN
key saved on device A; (2) "sync now" claims synced while "last sync"
never moves, then Save fails "the cloud copy failed: unknown"; (3)
admin-data "Last Backup" stuck on "never"; (4) teacher isolation +
admin 360° monitors for tutors, students and parents; (5) audit every
r16-and-prior feature; (6) expert re-understudy of every page and
process; (7) every file in both repos updated.

## Item 1 — device B "nothing saved yet": root cause chain

The r16 fix made push() resolve uid first and await its callers — but
three failure classes survived:

- **Write path (the big one).** The REST upsert to `user_settings`
  failed for reasons the client swallowed whole: RLS/permission errors,
  a pre-V53 database without the table, a shape mismatch. The client
  surfaced "the cloud copy failed: unknown" and — worse — pull()
  compared cloud vs local with raw `JSON.stringify`, so **jsonb key
  order** alone could report "credentials current" while the account
  held nothing device B could restore.
- **Read path.** pull() only recognised rows by legacy key names; a
  shape change meant "Your account has nothing saved yet" even when the
  row existed.

**Fix (server + client, self-contained):** V53 adds security-definer
`tc_set_user_setting`/`tc_get_user_settings` (owner-scoped,
authenticated-only). `cloud-creds.js` writes and reads RPC-first (REST
table-GET fallback for pre-V53 databases), reads and surfaces the real
PostgREST error body (`message` + `hint` — "unknown" is gone),
canonicalises (deep key-sort) before any comparison, and stamps the
sync clock + "Account holds" the moment a push lands. teach.js re-renders
the sync card after every Generate/Save outcome and states plainly when
the device has no portal account linked. Verified by PG harness
scenario 12: RPC round-trip, cross-account isolation (learner cannot
read tutor's key and vice versa), pre-V53 fallback path.

## Item 2 — "synced - credentials current" + "last sync not yet"

Both symptoms were one bug: syncNow's diff was order-sensitive string
comparison, and a successful push never touched `state.lastSync` (only
pull did). With canon() comparison + stampSync() on push success, the
card's "last sync" updates on every successful write and the label
cannot claim currency it does not have. Save failures now carry the
actual server message plus the remedy (press sync now / check link).

## Item 3 — admin-data "Last Backup: never"

The r16 reader was honest, but the WRITER never ran: the download path
called `stampBackup()` only on a code path that also assumed a plain
`update()` — and both toolbar buttons ("Full backup" / "Restore")
referenced `window.DataTools`, **which was never defined** — silent
ReferenceError, no backup, no stamp, "never" forever. Fixed: `DataTools`
is defined and wired to the real sealed-download and restore readers;
the stamp is RPC-first via V53 `tc_stamp_backup` (manager-guarded,
upserts practice_settings including the insert case) with an UPDATE
fallback; a failed stamp prints its reason instead of vanishing. The
Drive path stamps through the same RPC. A new auditor
(`tools/audit_handlers.py`) now sweeps every page of both trees for
dangling inline handlers so this class of bug cannot ship again — run
it, it is green.

## Item 4 — tutor isolation + the admin 360° monitors

Server (V53): tutor-scoped read policies on `library_items`,
`eresources`, `resources`, `lms_lessons` (own rows + taught engagements
+ the shared shelf; family reads preserved); manager-only
`tc_tutor_monitor(uuid)` and `tc_parent_monitor(uuid)` aggregates.
Tutor coverage: profile, subjects taught, students taught, sessions
taken, recent + upcoming sessions, bookings completed / ongoing /
earnings, topics covered, CBTs created, assignments set, library items
authored, **salary payment history**. Parent coverage: children with
classes and tutors, invoices, payment history, upcoming sessions.
Client: `assets/js/staff-monitor.js` — a 📊 Monitor row action on
Tutors and Parents opens a drawer with tiles per section, honest empty
states ("No records yet — nothing of this kind exists"), and visible
error cards if the RPC refuses. Learners/parents/tutors cannot call the
monitor RPCs (server-refused, verified in scenario 12). Teachers
continue to see only their own + assigned rows (r14 scoping kept).

## Items 5+6 — the self-audit: real bugs found and fixed

- **tz.js workStatus mixed clocks.** `m >= fm && p.minutes <= tm`
  compared the wrapped minute against the raw one — 08:00 counted as
  INSIDE 09:00–17:00, and 01:00 counted outside a 22:00–02:00 window.
  Fixed to one clock (`m >= fm && m <= tm`); unit-proven 10/10 in the
  r17 suite including past-midnight and non-working days.
- **crud.js 3-arg _cell.** openRecord and printList dropped the new
  viewerCanWrite argument, so staff saw family-safe labels ("🎓 your
  class") in the edit drawer and printouts. Both now pass `can`
  (printList takes it as a parameter; renderList supplies it).
- **DataTools undefined** (item 3 above — found by the new handler
  auditor, then fixed).
- r16 features re-audited and kept sound: detectRole role-race wait
  loop, renderLastBackup auth re-render, the empty-ref retry + auth
  purge in crud.js, sessions dual-clock banner, the r16 deck truth
  toasts. The r16 QA suite (104 checks) still passes unmodified apart
  from whitelist widening.

## Item 7 + QA tally

Every file updated in both repos (twin sync verified by the r8 twin
check + `diff -rq`); versions: portal `?v=53` / sw
`tc-shell-v22-20261010`; deck `?v=56` /
`hmg-classdeck-v14.8.0-turnsync-rpc` / version.json 14.8.0 build 22
(feature tags `v14.8-*`). New QA suite `test_r17_portal.js` (70
checks: V53 migration shape, RPC-first client patterns, monitor UI,
the r16-fix pins with the TZ engine actually executed, version
truth). Battery: 26 suites, **1181/1181 per repo, both repos, run
twice**. PG harness: **12/12 scenarios clean**. Workspace budget
checked and under the cap.


---

# ROUND 18 AUDIT (2026-10-10)

Scope: the user's seven items — (1) sync-now toast lies + "last sync
not yet" + Save "cloud copy failed: unknown"; (2) device B restore
"nothing saved yet"; (3) Google Drive backup progress before
completion; (4) the TURN-key issue as a whole; (5) audit every enhanced
pre-existing + new feature; (6) expert re-understudy of every page and
process; (7) every file across all repos.

## Items 1, 2 and 4 — the TURN key: the full autopsy

The reported trio (toast "synced — credentials current" while the card
said "not yet", Save failing "unknown", device B "nothing saved yet")
was reproduced against the round-16 code and root-caused on THREE
levels:

1. **DELIVERY (why fixes looked unfixed):** the deck service worker
   served the CACHED page on every visit (stale-while-revalidate for
   HTML, returning `cached` immediately). The visit right after a
   redeploy still ran the PREVIOUS build — so the r17 fixes could
   genuinely ship while the user's next session ran r16 and reproduced
   the r16 bugs. The handler also fetched every cached resource twice.
   **Fix:** pages are network-first (cache only when offline), the
   double-fetch is gone, `cloud-creds.js` joined the precache shell,
   and the sync card prints its module build (`v54-r18-verified-sync`)
   so a stale browser is identifiable at a glance.
2. **REPORTING (the r16 "unknown"):** r16's push() swallowed exceptions
   (`catch (e) { return false; }`) and left `state.reason` empty on any
   non-404 HTTP error — a 42501 RLS refusal surfaced as "unknown".
   **Fix:** every failure path funnels through `fail(stage, message)`
   with the HTTP status and the server's error body (`message`, `hint`,
   `details`, `error_description`); "unknown" is structurally dead.
3. **TRUTH (the deepest fix):** no code path ever CONFIRMED the account
   held what a write claimed. **Fix — the verified-sync engine:** every
   write is followed by an immediate read-back and canonical
   comparison; a push only reports success when the account verifiably
   holds the snapshot. "Saved" now means "saved and verified".

Additional structural fixes found during the autopsy: Save fires TWO
pushes of the same channel (relay push + key push) — now serialized
through a per-channel queue; concurrent token refreshes can trip
Supabase's refresh-token rotation-reuse detection and revoke the whole
session (portal logout!) — the refresh is now single-flight; the sync
clock lived only in memory so a reload reset "last sync" to "not yet" —
the verified stamp is persisted (`cd-creds-sync-stamp`) and seeds the
next load; syncNow diffed against a possibly-stale in-memory copy — it
now reads the account FIRST and pushes only real differences.

**🔍 Diagnose** (new): a button on the sync card that walks the exact
chain a real sync uses — session → endpoint → token → database read →
verified write — stops at the first broken link, and prints the exact
remedy (including which SQL pack to run). With real local credentials
the write step is a genuine verified re-push: the healing action.

**Behavioral proof:** the round-18 QA suite runs the engine against a
fake PostgREST — verified write, server-ack-but-dropped (correctly
FAILS with a read-back reason), 42501 with the RLS message + hint
surfaced, single-flight (two racing pushes → ONE refresh), syncNow
fresh-read diff, pre-V53 fallback still verifying, diagnose paths,
persisted-stamp seeding, signOut clearing the claim. The round-11 suite
was upgraded to a read-write mock (a real database shows writes to
subsequent reads) and its tombstone/refresh checks now pass through the
verified path.

## Item 3 — Drive backup progress

`fetch()` cannot report upload progress — the teacher watched a
motionless "Uploading…" line. The upload is now XHR with
`upload.onprogress`: a staged panel on admin-data (Authorise → Collect
"table i of n" → Upload with live MB counters and a percentage →
Record), the button locks while running, and the completion line
carries rows + size + duration. The AUTOMATIC background sync (no
button pressed) shows the same truth as a floating pill, and
restore/recovery report per-table import progress. `collectFull` and
`importArchive` grew optional per-table callbacks
(backward-compatible).

## Items 5+6 — the self-audit (completed in full)

- `audit_handlers.py` was EXTENDED, not just re-run, because the static
  HTML scan cannot see two members of the DataTools bug class:
  1. **JS-generated handlers** — pages build table rows/cards with
     `onclick="GD.restore(...)"` inside STRING literals; a typo there
     was invisible. Every .js file is now scanned for handler
     attributes inside strings and resolved against every name defined
     in the tree.
  2. **Broken references** — every `src=`/`href=` of every page (portal
     root AND classdeck/) must point at a file that exists; a renamed
     asset 404s quietly behind the service worker and looks like "the
     button does nothing".
  The extension immediately caught a REAL pre-existing bug:
  **assignments.html linked to `cbt-manage.html`, a page that does not
  exist** (the CBT builder is `cbt-multi.html`) — the "How to use this
  page" instruction sent teachers to a 404. Fixed to point at the real
  builder. All three sweeps green on both trees.
- **The portal service worker was re-understudied for the deck's
  stale-page trap and is PROVEN clean**: navigations are already
  network-first (4s race, cache only as the offline fallback) — pinned
  in the r18 suite so it cannot regress. The delivery trap was
  deck-only.
- The renewal path (`maybeRenewCloudflareRelay`) pushes through the
  verified queue — renewed credentials roam verified too.
- A successful read now persists the FRESH account-holds (a credential
  cleared on device B stops showing ✓ on device A after a reload —
  found and fixed during this audit).
- Integrity sweep of every touched surface: `escapeHtml` resolves
  (common.js loads before teach.js), the GD button selector matches the
  markup, no secrets are ever logged (no plain console.* of
  tokens/keys), no duplicate element ids, and every script/asset
  reference on the 9 highest-traffic pages resolves on disk.
- The r16/r17 QA suites were re-run and re-pinned where the r18
  architecture legitimately changed the shape (queue wrapper,
  `sameCanon` helper, pull-first syncNow); the r11 mock was upgraded to
  database-real read-write behavior.
- PG harness unchanged: 12/12 (no DB change this round — V53 remains
  the server truth).

## Items 5+6 completion, part 2 — the alias-shadow defect (found by
re-understudying my OWN r18 engine)

Re-auditing the verified-sync engine line by line found a real defect
in what this round had just shipped: when an account holds BOTH the
canonical row ("cd-turn") AND a legacy alias row (exactly what the r16
shape-restore reads), `verifyChannel` and `pull()` let the LAST
matching row decide — and `order by key` puts a stale alias last — so
every verified write would false-fail FOREVER on such an account while
the database was actually correct. **Fix (V54.1):** the channel's
truth is the NEWEST row by `updated_at` (exact key wins ties), shared
by `pull()` and `verifyChannel()`; the merge now applies rows
newest-first so a stale alias cannot pre-fill an empty field. Proven
by three new behavioral scenarios (stale alias + fresh canonical,
alias-only account, genuinely-newer alias), all pinned in the r18
suite. Version bumped to deck 15.0.1 build 24 with a new
service-worker cache tag so the fixed engine cannot be trapped in a
stale cache on any browser that already fetched the intermediate
build. The Google Drive guide (docs/GOOGLE-DRIVE-SYNC-GUIDE.md Parts
3+4) now documents the progress behavior too — item 3's user-facing
documentation.

# ROUND 19 AUDIT (2026-10-10)

## The report

The user reported the TURN key sync was STILL persisting after the
round-18 fix — and pasted the diagnosis run from the empty device:
every visible step ✅, "0 setting row(s) readable", the write-path
step SKIPPED, and the verdict "fully working". A diagnosis that skips
the only test that matters and then declares success is worse than no
diagnosis at all. Everything below was verified against the LIVE
production system before a single line was changed.

## LIVE verification of the production system

After the user reported the sync "still not solved" with a clean
diagnosis (all steps ✅, but "0 setting row(s) readable" and step 5
SKIPPED), the production system itself was verified — not simulated:

- **Live deck** (adewaleclassroom.vercel.app/classdeck): runs the r18
  build (cloud-creds `v54-r18-verified-sync`, ?v=57, sw v15.0.0) —
  the deployed code IS the verified-sync engine.
- **Live database** (yqwzbttehegvnvkrmxjz.supabase.co): both V53 RPCs
  exist and are correctly anon-revoked (42501 permission denied for
  anon); the `user_settings` table is RLS-hidden from anon ([]).
- **The account** (the owner, authenticated): **0 user_settings rows**
  — the diagnosis was accurate; the account genuinely holds nothing.
- **The write path, end to end with the real account**:
  `tc_set_user_setting('cd-diag', …)` → `true`; read back via
  `tc_get_user_settings` → the row is there; `DELETE
  /user_settings?key=eq.cd-diag` → 204; read back → 0 rows.

**Conclusion (proven, not assumed):** server healthy, new code healthy,
account empty. The TURN key was saved under the OLD code whose upload
silently failed; it still exists only in that device's browser storage,
and nothing can retroactively upload it except that device. The product
defects left were: diagnose skipping the write test while claiming
"fully working"; the boot self-heal (which fills exactly such an
account) being invisible; and the empty-account messages sending the
user in circles instead of naming the two-device remedy. All three
fixed in V54.2 (safe write probe; self-heal toasts at boot and sign-in
plus an 📤 card hint; two-device truth in every empty-account message).

## The three defects — and how V54.2 fixes them

1. **Diagnose skipped the write test on exactly the broken device.**
   Old logic: no credentials locally → "nothing to write" → step 5
   SKIPPED → "fully working". New: `probeWrite()` writes a `cd-diag`
   row through the exact path Save uses (`rpcSet` first, REST
   `on_conflict` fallback — a 404 there now names the remedy: run
   `complete-schema.sql`), reads it back, deletes it via the new
   `restDelete('/user_settings?key=eq.…')`, and confirms it is gone.
   The probe row matches no sync channel, so it is invisible to sync
   and safe on any device at any time. Step 5 NEVER skips now; the
   verdict text distinguishes probe-clean from cleanup-failed.
2. **The self-heal was invisible.** `pull()` records
   `state.selfHeal = {pushed, failed}` (exposed as
   `CloudCreds.selfHeal()`). teach.js toasts at boot — success names
   every channel uploaded ("☁️ Uploaded this device's cd-turn — the
   account did not have them yet"); failure states the real reason
   and the remedy path. auth.js surfaces the same at deck sign-in.
   The ☁️ sync card shows an explicit 📤 hint while this device holds
   credentials the account lacks.
3. **Empty-account messages sent the user in circles.** The diagnosis
   summary states the account truth plainly ("no device has uploaded
   credentials to it yet") with the two-device remedy; the restore
   messages and the TURN-box restore text tell the same truth: open
   the deck on the device that has the key — it uploads automatically
   the moment it opens (watch for the ☁️ confirmation) — or re-enter
   once on any device.

## Round-19 QA tally

- Engine test — graduated from a /tmp scratch harness into the battery
  as `test_r18_engine.js` (honors CD_REPO, runs against both repos);
  54 scenarios incl. 16–18 (probe, self-heal success/failure):
  **54/54 against both repos**.
- `test_r18_portal.js`: extended 99 → **114 checks** (new §2c, 12
  static + 6 behavioral — empty-device diagnose runs all 5 steps,
  probe pass + cleanup, selfHeal push; version pins re-anchored to
  cloud-creds v54.2 / `?v=59` / 15.0.2 build 25 / sw `v15.0.2`).
- The whitelists of the 7 older suites (r8/r10/r11/r14/r15/r16/r17)
  future-proofed from exact version lists to range regexes — no more
  per-bump edits. Each re-run green.
- **Full battery, both repos, run TWICE: 28 suites × 1349 checks —
  PASS 1349, FAIL 0, every run, every repo.** (The engine suite was
  added to the battery this round; the battery itself was then re-run
  twice end-to-end after the addition.)
- PG harness `tools/verify_schema_pg.sh`: **12/12 scenarios clean**
  (incl. V47 credentials + V53 credential-truth behavior).
- Handler audit: every inline and JS-generated handler resolves, every
  asset reference exists. Twin sync: `diff -rq` → 0 differences.
- Zips rebuilt: `adewaleclassroom_patched.zip` (434 files),
  `tutoringconnect_patched.zip` (464),
  `deliverables/tutoring-connect-suite.zip` (978). Workspace 69 MB —
  under the cap.
- Versions shipped: deck `?v=59` / sw
  `hmg-classdeck-v15.0.2-r18-write-probe` / version.json **15.0.2
  build 25** (+ `v15.0.2-diagnose-write-probe`,
  `v15.0.2-self-heal-visibility`, `v15.0.2-empty-account-honesty`);
  portal unchanged (`?v=54` / `tc-shell-v23-20261010`).
- **Live site pending the user's redeploy** — it runs `?v=57` /
  15.0.0 build 23, two bumps behind. After redeploy: hard-refresh,
  expect the ☁️ card footer to read 15.0.2 build 25, then run 🔍
  Diagnose on the empty device — all 5 steps, including the write
  probe, must pass.

# ROUND 20 AUDIT (2026-10-10)

## The report

The user redeployed V54.2 and pasted a NEW diagnosis: every step ✅,
including the safe write probe ("probe written, read back and confirmed,
then deleted ✓") — but "0 setting row(s) readable" and "It is not
working". The diagnosis itself was finally honest and correct. What
failed next was the REMEDY CHAIN — the path the user is told to walk to
fill the account.

## Live verification (again, before touching anything)

- Deployed build confirmed by fetching the live assets: `?v=59`,
  cloud-creds `v54.2-r18-write-probe`, sw `v15.0.2-r18-write-probe`,
  version.json 15.0.2 build 25. The redeploy happened.
- Signed in to the live database as the owner (the credentials in
  classdeck/js/config.js are the deployment's own): **0 user_settings
  rows, 0 rows via tc_get_user_settings** — the account is genuinely
  empty; the report is accurate.
- Therefore: on the device where the diagnosis ran, V54.2 IS running
  with a valid session — and it holds NO local credentials (else the
  boot self-heal or Sync now would have uploaded them, with toasts).
  The key lives elsewhere, and the remedy ("open the deck on the device
  that has your key") was failing there.

## The collated defect list — every reason this could keep persisting

| # | Defect | Class |
|---|---|---|
| 1 | Engine booted ONLY on teach.html; PWA start_url is index.html — "open the deck" never ran the self-heal | BUG (the mechanism) |
| 2 | First open after redeploy still ran the OLD build (SW handover); remedy promised "the moment it opens" | BUG |
| 3 | Long-lived PWA/tab never learned an update existed (no update() poke, no controllerchange UI) | LAPSE |
| 4 | Unlinked device holding credentials: silent branch, no pull, no hint | LAPSE |
| 5 | isEmpty()/📤 hint looked only at cf_key — manual relay JSON counted as nothing | BUG |
| 6 | Self-heal toast didn't name the account — wrong-account upload invisible | WEAKNESS |
| 7 | Diagnose had no local inventory — "wrong device" indistinguishable from "silent failure" | LAPSE |
| 8 | syncNow pushed against a stale in-memory copy when the fresh read failed — could overwrite newer account data | LATENT BUG |
| 9 | SW page fetch didn't bypass the HTTP cache | POTENTIAL |
| 10 | Remedy texts lacked the reload-once caveat and the exact re-enter path (⚙ Settings → Cloudflare TURN key + token → Save) | WEAKNESS |
| 11 | Key possibly in another browser/profile on the same device — only an honest inventory + re-enter path can end that loop | POTENTIAL (design) |
| 12 | QA whitelists would false-fail at ?v=60 (r8/r10/r11/r14/r15/r16/r17 narrow ranges) | MAINTENANCE |
| 13 | vercel.json sets no long Cache-Control for HTML (Vercel default max-age=0, must-revalidate) — verified NON-issue | ruled out |

## The fixes (V55 · ?v=60 · sw v15.0.3-r20-cloudboot · 15.0.3 build 26)

1. **`js/cloud-sync-boot.js` (new)** — one boot on every teacher-facing
   page: Store shim (hmgcd_) for pages without common.js, mini-toast
   fallback, signed-in pull with the VISIBLE self-heal (success names
   the account; failure names the reason), the once-a-day unlinked
   hint, and the service-worker update messenger (banner with Reload /
   Later, `controllerchange` guarded by wasControlled so first installs
   stay quiet, `registration.update()` on visibility change + every 6h).
2. **cloud-creds.js V55** — `holdsLocal()` (relay-only counts) replaces
   every cf_key-only check; diagnose step 2 = the local inventory (6
   steps total) with the different-browser/profile truth; syncNow
   refuses to push on a failed read and says why.
3. **teach.js** — boot slims to the onApply hook (the pull lives in
   cloud-sync-boot.js now); 📤 hint and the diagnosis verdict follow
   holdsLocal() with three honest branches; build-guard line says v55;
   restore texts carry the reload-once caveat + exact re-enter path.
4. **auth.js** — the sign-in self-heal toast names the account.
5. **sw.js** — v15.0.3-r20-cloudboot; page fetch `cache: "no-cache"`;
   cloud-sync-boot.js precached.
6. **Pages** — engine+boot on index/admin/stream/classroom/community/
   generate (+teach.html after teach.js); all 11 deck pages `?v=60`.
7. **version.json** — 15.0.3 build 26, features: cloud-sync-on-every-
   page, diagnose-device-inventory, update-banner, relay-only-truth,
   sync-stale-read-guard.

## Round-20 QA tally

- New suite `test_r20_portal.js`: **57/57** both repos (inclusion map,
  boot internals, sw delivery, engine truth, teach texts, versions, +
  behavioral: Store shim, unlinked hint + daily gate, pull + self-heal
  toast naming the account, first-install banner guard, old-worker
  banner with Reload/Later).
- Engine suite extended to **67/67** both repos (scenarios 19–21:
  relay-only self-heal, sync stale-read guard, key-device inventory).
- r18 suite re-pinned + re-anchored: **117/117** both repos.
- Whitelists future-proofed to `([5-9]\d)` across r8/r10/r11/r14/
  r15/r16/r17; r15 remedy check re-anchored to the r20 two-device
  truth. All individually green.
- **Full battery, both repos: 29 suites × 1422 checks — PASS 1422,
  FAIL 0, every run, every repo.** (Run twice on the final code at
  1418/1418 FAIL 0; after the last doc edits the complete final state
  was re-verified twice more at 1422/1422 — per-suite output identical
  between consecutive runs. The +4 is an environment-conditional check
  count in one mock-network suite, not a code change; FAIL was 0 in
  every run.)
- PG harness (real PostgreSQL): **12/12 scenarios clean** (SQL
  unchanged this round). Handler audit + self-contained schema audit:
  clean. Twin sync `diff -rq`: 0 differences.
- **Live site pending the user's redeploy again** — it runs V54.2
  (?v=59 / 15.0.2 b25); the r20 fixes need ?v=60 / 15.0.3 b26. After
  redeploying, the acceptance walk: on the key device open ANY deck
  page (the landing page counts) → if nothing shows the first time,
  reload once (or accept the 🔄 banner) → expect the ☁️ upload toast
  naming the account; on any device, 🔍 Diagnose now shows 6 steps with
  step 2 = the local inventory; if NO device's step 2 shows 🔑, the key
  exists only in a browser no device can see — re-enter once (⚙
  Settings → Cloudflare TURN key + token → Save).

## Item 7 + QA tally

Every file updated in both repos (twin sync verified by the r8 twin
check + `diff -rq`). Versions: deck `?v=58` / sw
`hmg-classdeck-v15.0.1-verified-sync-alias-truth` / version.json
15.0.1 build 24 (features `v15.0-*` + `v15.0.1-alias-row-truth`);
portal admin-data assets `?v=54`
/ sw `tc-shell-v23-20261010`. New suite `test_r18_portal.js` (99
checks incl. the behavioral engine test with the alias scenarios).
Battery: 27 suites, 1280 checks per repo, both repos, run twice.
Workspace budget checked and under the cap.

---

# ROUND 21 AUDIT (2026-10-10)

## The report — seven items

1. *"During class I wanted to show them on another app or screen; currently
   I must stop recording/live and switch broadcast mode — not wholesome.
   Is there a way to switch without stopping?"*
2. *"Student's system: some CBT texts weren't showing clearly; typing
   student names not visible; exam code not visible; some questions not
   visible — fix so on every system CBT text is clearly shown without
   ambiguity."*
3. *"Recording played in laptop VLC: clicking different timestamps stops
   playback — fix so recordings play seamlessly/robustly on laptop
   players."*
4. *"Add Co-Tutor just like assisted tutor, but Co-Tutor must have ALL the
   same access/permission/privilege as the Tutor."*
5. *"Student screen share appears small at my end, had to zoom out — when
   students or tutors share screen or whiteboard it must be high quality
   and clearly visible."*
6. *"Teacher decides if a student's screen/whiteboard share is shown to
   teacher alone or the whole class (student presenting to class /
   solving in front of class)."*
7. *"Update every file accordingly across all repos."*

## Item 1 — the stop-everything switch (FIXED, seamless)

The old switch path re-called every student with a new media stream: a
visible reconnect blink for the whole class, and the safety rails required
stopping the recording/live first. The fix swaps the video source INSIDE
the live RTP streams:

- `rtc.js updateStageVideo(newTrack)`: `RTCRtpSender.replaceTrack()` on
  every live stage sender — no re-negotiation, no blink, recording never
  touches it. In relay mode the captains re-serve the SAME received track
  down their trees, so one replaceTrack propagates to every student
  behind every captain. Failure of any single replaceTrack falls back to
  a re-call for THAT student only (never a dead stage).
- `teach.js switchBroadcastMode(mode)`: gets the screen (1080p ideal,
  `contentHint "detail"`), mirrors it in a hidden video element, then
  `updateStageVideo(track)` — the class follows instantly. Mic audio is
  untouched, so nobody misses a word.
- **The recording follows with zero restarts**: `drawRecordingFrame()`
  paints the ACTIVE source — in screen mode it draws the shared screen
  contain-fit (never cropped) inside the branded frame; in composite mode
  the workspace canvas. The recorder's canvas track is continuous, so
  nothing restarts.
- Toolbar chip `#btnBcastMode` (🖥 Screen / 🧩 Composite) after End Live;
  the settings-page broadcast select ALSO switches live on save. Screen
  share ending (user stops sharing in the OS) auto-returns to composite
  with "Nothing was interrupted." Every switch is audited
  (`broadcast-switch`).

## Item 3 — VLC seek stops (FIXED, root cause)

MediaRecorder WebM has **no Cues (seek index) and an unknown Segment
size** — the exact combination that makes VLC/Windows Media Player stop
at every timestamp click. (The earlier MP4-first attempt was abandoned:
Chrome's fragmented MP4 has no moov atom and cannot seek at all.)

- `classdeck/js/webm-cues.js` (new, vendored, dependency-free): parses
  the EBML cluster layout and APPENDS a real Cues element + writes the
  true Segment size. Idempotent and best-effort — returns the input
  unchanged when the file already has Cues or cannot be parsed.
- `teach.js repairWebmForPlayers()`: at stop time the recording goes
  through the vendored EBML duration fix first (when present), then the
  Cues index. The recovered (crash-safe) recordings in enhancements.js
  go through the same repair.
- The extension now TELLS THE TRUTH: WebM bytes are saved as `.webm`
  (the old code saved WebM under a hardcoded `.mp4` name — a container
  lie that is itself a seek-stopper). Genuine MP4 muxing (Safari) keeps
  `.mp4`.

## Item 4 — Co-Tutor (ADDED, full tutor toolkit)

`rtc.js setCoTutor()` promotes a student to Co-Tutor: co-host powers ON,
kept distinct from an independent assistant-tutor role (`coHostKeep`) so
demotion restores exactly what was there before. Attendance logs
`cotutor-on/off`. The PRIVILEGED roster (peerIds + flags) is pushed only
to promoted staff (`_privilegedRoster`/`_pushPrivileged`).

The Co-Tutor console (join.js, supersedes the assistant panel) carries
the full classroom toolkit: waiting-room admit/deny, per-student
mic/camera/screen/class-screen control, kick, mute all, lower all hands,
lock, spotlight, announcements, polls. Every action is authorised on the
TEACHER'S room object — rtc.js honours `cohostAction` only from promoted
peers, so the UI can never grant itself anything. Structural exceptions
that stay Tutor-only by design (the Tutor owns the room): ending the
class, promoting/demoting Co-Tutors, and the device-bound broadcast/
recording settings.

## Item 5 — screen/whiteboard quality (FIXED)

- Sender side: student screen shares request 1920×1080 ideal at 12–15
  fps with `contentHint "detail"` (tells the encoder to protect text
  resolution). Teacher screen switch asks the same.
- Receiver side: screen tiles are `object-fit: contain` in a 16:10 well
  (letterboxed, never cropped), focus tiles get 16:9 + 42vh, and every
  tile has a ⤢ theater button (`#cdTheater` full-viewport overlay).
  Zooming out to read a student's screen is never needed again.

## Item 6 — teacher-chosen audience (ADDED)

- `requestStudentScreen(peerId, on, audience)`: the teacher's roster
  screen button opens an audience chooser — *just me* or *the whole
  class* — changeable while the share is live.
- Class audience: `broadcastStudentScreen()` relays the student's stream
  to every other student (`stuscreen-bcast` + `stuscreen-bcast-meta`
  with the student's name); join.js shows it as a floating, fullscreenable
  pane that removes itself when the meta goes off.
- Consent, not ambush: the student's share dialog says WHO will see it
  ("your teacher and the WHOLE CLASS" vs "only your teacher").
- Whiteboards: `presentStudentBoard()` puts a student board on the class
  stage; while presenting, `drawComposite()` paints the board contain-fit
  under a "🎨 … is showing their board to the class" header — so the
  presentation rides the broadcast AND the recording. `renderBoardsGrid()`
  shows per-board present states with a stop banner.

## Item 2 — CBT text clarity on every system (FIXED, root causes)

Diagnosis (confirmed in the CSS): `.form-input`/`.card` hardcoded
`background: white` while the dark theme flips `--gray-900` — white text
on white fields (typing names invisible); no `color-scheme` — Chrome/UA
autofill painted its own background over the text; the per-page brand
override `:root{--primary:#0506ae}` is near-black indigo, invisible on
dark surfaces (the exam code); no forced-colors handling; no font-size
floors. Fixes in `assets/css/style.css`:

- Theme-aware tokens `--field-bg/--field-fg/--field-placeholder/--card-bg`
  wired into `.form-input`, `.form-textarea`, `.form-select`, `.card`,
  with explicit `caret-color` and placeholder color.
- `-webkit-autofill` handled: 1000px inset box-shadow of `--field-bg` +
  `-webkit-text-fill-color: var(--field-fg)` + background transition
  freeze — autofill can no longer repaint over the text in either theme.
- `color-scheme: light` on `:root`, `color-scheme: dark` on
  `[data-theme="dark"]`; the CBT pages also carry
  `<meta name="color-scheme" content="light dark">` for correct
  pre-CSS paint.
- Dark theme REMAPS THE BRAND ACCENTS (`html[data-theme="dark"]`
  outranks the per-page `:root` override): `--primary: #93a5ff`,
  `--accent: #67e8f9` — the exam code and every primary control are
  clearly visible on dark. theme-engine.js sets data-theme on
  documentElement (verified), so the remap always wins.
- `@media (forced-colors: active)`: fields keep their borders under
  Windows High Contrast.
- CBT readability floors: `.cbt-q p` 1.02rem/1.6, labels .98rem/1.55,
  blockquotes and muted text floored.
- **A− / A+ text-size stepper** on cbt-exam.html and cbt-multi.html:
  scales the whole page container 80%–150%, persisted per browser
  (`tc-text-scale`) — every eyesight, every screen.
- Changed stylesheet cache-busted `?v=55` on all five CBT pages; portal
  sw bumped `tc-shell-v24-20261010` so every device pulls fresh CSS.

## Item 7 — every file, both repos

Twin-synced (diff-verified identical, TC-only `tools/` aside):
classdeck/js/{rtc,teach,join,webm-cues,enhancements}.js,
classdeck/{teach.html, join.html}, classdeck/css/style.css,
classdeck/{sw.js, version.json}, assets/css/style.css,
{cbt-exam,cbt-multi,cbt-review,cbt-results,cbt-prompts}.html, sw.js.

## Versions

Deck `15.1.0` build 27, sw `hmg-classdeck-v15.1.0-r21-classflex`
(webm-cues.js precached), all deck assets `?v=61` (70 refs swept),
seven feature tags in version.json. Portal sw `tc-shell-v24-20261010`.

## QA tally (round 21)

New suites: `test_r21_classflex.js` (70 checks across all six items +
version/syntax pins — includes inline-script parse checks of every
patched HTML page) and `test_r21_webm_cues.js` (13 EBML unit checks:
cluster parse, Cue-point math, idempotency, garbage tolerance).
Battery: **31 suites × 1501 checks per repo, both repos, run twice —
0 failures, deterministic.** PostgreSQL 17 harness: complete-schema.sql
applies cleanly with the Supabase stubs (auth + storage) — 403 public
objects — and drive-sync.sql, keep-alive.sql, my-work-board.sql all OK,
on both repos. The battery's VM harness caught and fixed one real
defect pre-ship (an undeclared `coRosterData`/`coTutorPanelEl` implicit
global in join.js — declared properly now). Zips rebuilt
(436 + 466 files).
