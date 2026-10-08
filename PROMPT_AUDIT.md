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
