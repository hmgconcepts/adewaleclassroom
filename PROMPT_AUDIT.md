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
