# HMG ACADEMY CLASS DECK — Deep Analysis, Diagnosis and Fix Report

**Audit date:** 25 August 2026  
**Live target:** <https://hmgacademyclassdeck.vercel.app/>  
**Repository:** <https://github.com/hmgacademyhub/hmgacademyclassdeck>  
**Local baseline commit:** `49ed0ee3da6b6f70737f227cadb0a19bde00dc6f` (`Add files via upload`, 22 June 2026)  
**Fixed package version:** `11.1.1-classdesk-v3`, build 6

> The repository was cloned and audited locally. The fixed package has **not** been pushed to GitHub or redeployed to Vercel because no repository or hosting credentials were supplied. The live URL therefore remains the original deployment until the fixed package is uploaded and deployed.

---

## 1. Evidence and baseline verification

The following checks were performed before changing the working copy:

- The live landing page, Teacher Studio, student join page and Social Live page returned HTTP 200.
- The live `teach.html`, `join.html`, `stream.html`, `sw.js` and `manifest.webmanifest` bodies matched the cloned repository byte-for-byte at audit time.
- The repository contains 67 source/assets/document files before the fixes and is a static site with no root `package.json` or build step.
- The original working tree was copied before modification and packaged as `hmgacademyclassdeck-original.zip` (67 files; SHA-256 `f8ed762fa2fe49e0a8293ff58a7f851e86fbcc5abf1cf4fd7541d9f394694a20`).
- The stale `manifest.json` referenced `assets/screenshot1.png`, but that asset returned HTTP 404 on the live site. This was a real deployment defect.
- The repository's existing `scripts/validate.sh` passed its original JavaScript, JSON and HTML-reference checks, but it did not check the legacy manifest, service-worker shell, inline scripts, or runtime classroom behavior. Those checks were expanded in the fixed package.

The original archive contains the original source tree and excludes only Git's internal `.git` metadata; it does not alter the original application files.

---

## 2. What the product is actually for

HMG ACADEMY CLASS DECK is a **tablet-first teaching studio and lightweight virtual classroom**. Its main product insight is that a teacher should not need to run a whiteboard app, a PDF app and Google Meet in Android split-screen at the same time.

Instead, the teacher opens one web/PWA application containing:

1. A whiteboard and lesson-material workspace displayed side-by-side.
2. A local classroom broadcast that sends the composed workspace to students.
3. Interactive teaching controls such as cameras, chat, polls, quizzes, attendance and student work boards.
4. Offline-first local teaching tools that do not require an AI API or paid database.

The product has two distinct teaching modes:

- **Meet/Zoom Companion mode** — the teacher shares the ClassDeck tab or device screen through an existing conferencing platform. ClassDeck is the teaching workspace; Meet/Zoom supplies the call.
- **Built-in ClassDeck classroom** — the teacher starts a PeerJS/WebRTC classroom. Students join with a link or room code and view the teacher's broadcast directly.

Students do not need an account. Teachers use a local account gate for the three-day trial and optional license flow.

---

## 3. Architecture and how it works

### 3.1 Hosting and application model

- Plain HTML, CSS and JavaScript.
- No bundler, framework, database or application server for the core site.
- `/vendor` contains PeerJS, PDF.js, the PDF worker and QRCode.js locally.
- `/assets` contains HMG branding and PWA icons.
- `manifest.webmanifest` and `sw.js` make the core experience installable and cacheable.
- `localStorage` is wrapped by `Store` in `js/common.js` using the `hmgcd_` prefix.
- PDFs, images, notes, whiteboards and recordings are intended to remain on the teacher's device unless the teacher deliberately shares them through WebRTC or downloads them.

### 3.2 Classroom signalling and media

The built-in class uses a **teacher-hub/star topology**:

```text
Student browser  ─┐
Student browser  ─┼── PeerJS signalling + direct WebRTC media ── Teacher browser
Student browser  ─┘
```

- PeerJS brokers connection setup; the media path is WebRTC peer-to-peer.
- The teacher's predictable room identity is `hmg-classdeck-v1-ROOMCODE-host`.
- A reliable JSON data channel carries roster events, chat, controls, polls, quizzes, activities and student-board strokes.
- Media connections carry the teacher stage, teacher camera, student camera, student microphone and voluntary student screen share.
- The teacher compositor paints the two panes onto an internal canvas, normally 1280×720 at 8 fps, then uses `canvas.captureStream()` as the stage video.
- Public STUN/TURN entries are included to improve NAT traversal, but they are not a substitute for a controlled production TURN service.

### 3.3 Social Live architecture

Tablet Social Live is not hosted by the Vercel static site. It requires the optional relay in `relay/no-obs-social-relay/`:

```text
ClassDeck canvas + mic
        │ WebRTC/WHIP
        ▼
SRS relay
        │ internal RTMP
        ▼
FFmpeg controller ── RTMP/RTMPS ── YouTube/Facebook/Instagram/TikTok/custom destination
```

The relay requires a VM/VPS, Docker, HTTPS, a domain and social-platform RTMP eligibility. No OBS is required on the tablet, but the relay is still a server-side component.

### 3.4 Licensing architecture

The default client flow is local:

- Teacher account data is stored on the device.
- New passwords use PBKDF2; legacy account records can still use the old salted hash.
- Account integrity is signed using a client-side secret.
- A three-day local trial is calculated from the signed creation time.
- Optional local license keys are name-bound and month-of-expiry-bound.
- `revoked.json` is a static kill-switch list.

For real subscription enforcement, `security/license-gateway-worker/` provides an optional Cloudflare Worker and KV-backed gateway. The fixed Worker now requires the exact license key; an email address alone cannot activate a license record.

---

## 4. Feature inventory

### 4.1 Public entry page — `index.html`

The landing page presents three task-oriented doors:

- **I'm a Teacher** → `teach.html`
- **I'm a Student** → `join.html`
- **Teaching on Meet / Zoom?** → `teach.html?meet=1`

It also explains the split-screen workspace, built-in live classroom, teaching tools, quizzes, recording, social streaming, whiteboard, classroom controls, student boards, activities, Reader Cast and offline/PWA behavior. HMG Academy branding and the founder card are embedded locally.

### 4.2 Teacher Studio — `teach.html`

The Studio has two independently switchable panes. Each pane can host these ten apps:

1. **Whiteboard** — pen, highlighter, eraser, line, arrow, rectangle, ellipse, triangle, diamond, star, text, laser, fill mode, colours, size control, page decks, backgrounds, image stamps, PNG/PDF export, undo/redo, pinch zoom and stylus/palm mode.
2. **PDF reader** — local PDF open/drop, page navigation, fit, zoom, go-to-page and per-page annotation overlay using bundled PDF.js.
3. **Browser** — URL bar, back, reload, quick education links and raw iframe browsing.
4. **Reader Cast** — fetches readable page content through reader/CORS proxies, converts it to a broadcastable canvas and provides reading themes, font scale, progress and momentum scrolling.
5. **Notes** — local auto-saving lesson notes, exportable as text and composited into the broadcast.
6. **Image viewer** — local image open/drop, fit and per-pane zoom.
7. **Graph** — offline function plotting with multiple curves, pan, zoom and light/cream/dark/green-board themes.
8. **Video/audio** — local media playback with speed controls; video frames can be composited into the broadcast.
9. **Educational Toolkit** — canvas-rendered interactive teaching tools and curriculum cards.
10. **Flashcards and Timer** — local flashcard deck editing/flipping/shuffling plus stopwatch/countdown display.

The Studio also provides:

- Resizable split divider, split/left/right layouts and pane swapping.
- Focus/fullscreen mode with a small floating toolbar.
- Meet Companion mode.
- Local teacher camera preview and broadcast camera.
- Local recording with optional subject, topic, class, brand, footer and teacher logo.
- Local backup/restore of settings and lesson data.
- Keyboard shortcuts for common whiteboard tools.

### 4.3 Live classroom controls

The Teacher Studio's live room includes:

- Room code and QR/link invitation.
- Composite broadcast or browser-supported full-screen capture.
- Teacher stage stream and optional teacher camera.
- Student roster with join/leave and hand indicators.
- Waiting room with admit, admit-all and deny.
- Room lock.
- Class PIN.
- Optional secure invite token.
- Per-student camera request.
- Per-student screen-share request.
- Per-student microphone permission.
- Server-side enforcement of student microphone permission.
- Mute-all.
- Chat, private student-to-teacher messages and private replies.
- Full-screen student announcements.
- Emoji reactions.
- Spotlight/call-on-student behavior.
- Polls with one vote per student and result bars.
- Quizzes with typed or CSV questions, answer explanations, speed-based scoring and a top-ten leaderboard.
- Student personal whiteboards visible to the teacher, with teacher board-background push.
- Open questions, word clouds, collaborate/sticky-note boards and exit tickets.
- Behaviour points and CSV export.
- Random group maker.
- Local microphone noise meter and broadcast overlay.
- Attendance CSV.
- Class report and WhatsApp summary.
- Local security audit CSV.
- Optional Picture-in-Picture preview.

### 4.4 Student view — `join.html`

Students can:

- Join with a room code or a teacher link.
- Enter a name and optional class PIN.
- See a quick HTTPS/WebRTC/browser/join-engine diagnostic.
- Wait for a teacher who has not gone live yet.
- Wait for manual admission when the waiting room is enabled.
- View the teacher's full composed stage.
- Tap once to satisfy autoplay/audio policy.
- Raise a hand.
- Send public or private chat.
- Send emoji reactions.
- Share camera voluntarily.
- Share screen with the teacher after consent.
- Speak only after teacher microphone permission.
- Complete polls, quizzes, activities and exit tickets.
- Use an individual whiteboard that the teacher can inspect.
- Receive group assignments, awards, captions and announcements.
- Reconnect automatically after a temporary teacher/network interruption.

### 4.5 Toolkit inventory

The fixed source was counted rather than trusting the older documentation:

- **181 curriculum/reference cards** across Mathematics, Science, English, Social Studies, ICT, Classroom, Nursery, Primary, JSS, SS, Literature, Business Studies, Study Skills and Teacher Tools.
- **21 interactive toolkit modes**, including periodic table, lab equipment, plant cell, animal cell, units, converter, multiplication table, geometry construction, clock, number line, abacus, fraction visualizer, randomisers, tally chart, team scoreboard, thermometer, algebra balance, hundred square, letter formation, noise meter and reference cards.
- That is **202 tool modes** when the reference-card library and interactive modes are counted together.

### 4.6 Supporting pages

| Page | Actual role | Audit status |
|---|---|---|
| `admin.html` | Local HMG key generator | Validation and output XSS fixed; still not secure against a determined user because the static secret is shipped to the browser. |
| `cbt.html` | Standalone sample CBT practice page | Timer mappings, CSV parsing, repeat-submit behavior and output escaping fixed. The question sets remain small demo sets. |
| `classroom.html` | Static classroom command-centre mockup | User-post XSS fixed; it is still a presentation/demo page, not wired to the live WebRTC room. |
| `community.html` | Static teacher community mockup | Post form now validates and saves a local browser-only post; it is not a shared community backend. |
| `parent.html` | Static parent report mockup | It now clearly identifies the demo and only opens the sample report for `PAR-8K2M`; real parent authentication/API is absent. |
| `stream.html` | Social Live explanation and relay instructions | Functional links and download plan retained; it does not itself provide an RTMP server. |

---

## 5. Defects found and fixes implemented

### P0/P1 reliability and classroom-flow issues

#### Student handshake resolved too early

**Before:** `StudentRoom.join()` resolved as soon as the PeerJS data connection opened. That happened before the teacher had sent `welcome`, `waiting`, `admitted` or `rejected`. A student could see a stage before admission, wrong-PIN joins could enter the retry loop, and a successful transport did not prove successful classroom admission.

**Fixed:** The join promise now resolves only after the classroom handshake reports `welcome`, `admitted` or `waiting`. Rejections carry a `retryable` flag. Missing rooms/network failures retry; wrong PIN, wrong secure token and teacher rejection return directly to the join UI.

#### Waiting room was not cancellable and could strand students

**Before:** A student held in the waiting room had no visible way to leave. Turning the waiting room off could also leave already-pending students in `pending` forever.

**Fixed:** Added a **Leave waiting room** action. Turning the waiting room off automatically admits queued students. The UI distinguishes an early lobby from an actual teacher-controlled waiting room.

#### PeerJS errors could hang forever

**Before:** Generic teacher or student PeerJS errors were often logged but did not reject the pending start/join promise.

**Fixed:** Added bounded startup/handshake timeouts, generic error rejection and safe teardown.

#### Reconnect races and stale student controls

**Before:** Multiple close events could start simultaneous rejoin chains. After leave/kick/end, camera, mic, screen-share and hand flags could remain active, causing the next join to toggle the wrong state.

**Fixed:** Added a single rejoin-in-flight guard, iterative backoff, state resets, media element cleanup and control-class reset.

#### Ended-class exports disappeared

**Before:** `endLive()` set `room = null`, so the advertised attendance/report exports immediately lost access to the final room data.

**Fixed:** The last ended room is retained in memory for the current page session, final attendance leaves are recorded, and roster/report/attendance/score/behaviour exports remain available until reload.

#### Media was not fully released

**Before:** Stage, screen-capture, teacher mic/camera, student audio elements and some recording/composite loops could continue after end/stop.

**Fixed:** Added explicit track shutdown, student-audio removal, capture-source replacement cleanup, recording cleanup, Picture-in-Picture disposal, standalone loop cleanup and microphone release when no feature still needs it.

### P1 security and data-integrity issues

#### Student microphone permission was UI-only

**Before:** A modified student client could initiate a `stumic` WebRTC call even without the teacher allowing the microphone; the teacher accepted all incoming calls.

**Fixed:** The teacher room now tracks `micAllowed`, rejects unapproved mic calls and closes existing student mic calls when permission is revoked or mute-all is used. Calls from non-admitted peers are also rejected.

#### Worker email-only license bypass

**Before:** The optional license gateway's fallback lookup could select a license by email even when the request supplied no valid license key.

**Fixed:** The gateway now matches only the exact supplied key. Invalid/missing keys cannot activate a license by email alone. Expiry parsing also treats a date-only expiry as valid through the end of that date and rejects malformed expiry values.

#### Untrusted HTML insertion in auxiliary pages and reactions

**Before:** CBT imported question data, CBT attempt data, admin teacher names, classroom wall posts and reaction emoji were inserted into `innerHTML` without consistently escaping.

**Fixed:** User-controlled fields now use `textContent` or escaped output. Reactions use DOM nodes rather than raw HTML. Auxiliary forms were also made honest about local/demo behavior.

#### Arbitrary backup keys could be restored

**Before:** The restore flow accepted any key in an imported JSON object's `data` object, allowing unrelated localStorage keys to be overwritten.

**Fixed:** Restore accepts only `hmgcd_` keys with bounded string values.

### P1/P2 product and deployment issues

#### Offline shell missed a required toolkit file

**Before:** `js/toolkit-data3.js` was required by `teach.html` but was not in the service-worker precache list. Some auxiliary pages were not cached either. A failed fetch returned `index.html` for any resource type, masking missing scripts/images.

**Fixed:** Added all core and auxiliary local pages, `toolkit-data3.js`, both manifests and version metadata to the shell. Navigation fallback is now limited to navigation requests; missing scripts/images return an error instead of HTML.

#### Legacy manifest referenced a missing screenshot

**Before:** `manifest.json` referenced `assets/screenshot1.png`, which did not exist and returned 404.

**Fixed:** Removed the stale screenshot entry and validated both manifests.

#### SEO pointed to the wrong deployment

**Before:** Canonical, Open Graph, sitemap and robots sitemap URLs pointed at the GitHub Pages address while the requested/live site is Vercel.

**Fixed:** Public SEO URLs now point at `https://hmgacademyclassdeck.vercel.app/` and the sitemap date is updated to the fixed release date.

#### Vercel did not consume `_headers`

**Before:** `_headers` can be used by Cloudflare Pages/Netlify, but Vercel does not use that file as its primary header configuration.

**Fixed:** Added `vercel.json` with `nosniff`, same-origin framing, strict referrer policy, HSTS, CORP, Permissions Policy, COOP, admin no-store/noindex and revoked-list no-store headers. These take effect only after redeployment.

#### Browser documentation and marketing counts were inconsistent

**Before:** Source data contained 181 cards and 21 toolkit modes while older documentation said 161 cards, 16 modes and 177 tools. Other docs claimed no accounts, a 14-day trial, 0.9 Mbps recording or a 150–300 MB/hour class stream.

**Fixed:** Current README and user-facing copy now describe student-free accounts, the three-day teacher trial, 181 cards, 202 tool modes and realistic variable data/recording behavior.

#### Two whiteboard panes shared one persistence key

**Before:** A board in the right pane could overwrite the left pane's `wb_pages` data.

**Fixed:** The left pane retains the legacy key for compatibility; the right pane uses `wb_pages_R`.

#### Mobile divider used horizontal coordinates in vertical layout

**Before:** CSS changed the workspace to a vertical column on small screens, but JavaScript still calculated the divider from `clientX` and workspace width.

**Fixed:** Divider calculations now detect column layout and use `clientY`/workspace height, with pointer-cancel cleanup.

#### Reader Cast was not robust on older browsers or rapid navigation

**Before:** It used `AbortSignal.timeout()` directly and earlier fetches could overwrite a newer URL's content.

**Fixed:** Added abort-controller/timeout fallback, request IDs, cancellation of stale loads, URL validation and validated themes.

#### Recording and social relay edge cases

**Before:** Recording cleanup after a MediaRecorder constructor failure was incomplete. Social Live could start a WHIP stream with no social destinations, orphan the composite loop, fail to close a WHIP peer connection, or mishandle a relative `Location` header. Relay controller health leaked stream names and route matching was brittle with query strings.

**Fixed:** Added capability checks, recorder-scoped chunks, cleanup paths, destination validation, WHIP failure cleanup, absolute resource URLs, TURN-capable ICE configuration, composite ownership tracking, safer relay route parsing, destination limits, public health count-only output and explicit `0.0.0.0` binding.

---

## 6. Files changed in the fixed package

### Core application

- `js/rtc.js`
- `js/join.js`
- `js/teach.js`
- `js/auth.js`
- `js/common.js`
- `js/whiteboard.js`
- `js/webcast.js`
- `js/toolkit-ext.js`
- `js/toolkit-data.js`
- `js/toolkit-data3.js`
- `teach.html`
- `join.html`
- `index.html`
- `sw.js`
- `version.json`
- `manifest.json`
- `manifest.webmanifest`
- `robots.txt`
- `sitemap.xml`
- `vercel.json`

### Supporting pages and relay/security components

- `admin.html`
- `cbt.html`
- `classroom.html`
- `community.html`
- `parent.html`
- `relay/no-obs-social-relay/controller/server.js`
- `security/license-gateway-worker/worker.js`

### Validation and documentation

- `scripts/validate.sh`
- `scripts/test-rtc.mjs`
- `scripts/test-worker.mjs`
- `README.md`
- `docs/USER_GUIDE.md`
- `docs/DEEP_ANALYSIS_AND_FIX_REPORT_2026-08-25.md`

Historical audit documents remain in `docs/` for traceability; this report is the current release assessment.

---

## 7. Validation performed after the fixes

The fixed package passes:

```text
== JS syntax ==
== Inline HTML script syntax ==
ALL INLINE SCRIPTS PASSED ✔
== JSON ==
== Local HTML/service-worker references ==
ALL CHECKS PASSED ✔
== RTC behavior tests ==
RTC handshake, waiting-room, media-permission and payload tests passed ✔
License gateway exact-key and no-email-bypass tests passed ✔
== Toolkit data ==
181 reference cards loaded ✔
ALL CHECKS PASSED ✔
```

Additional checks performed:

- Local HTTP smoke test of all HTML pages, manifests, service worker, assets and required JavaScript returned HTTP 200.
- JSDOM startup smoke tests for Teacher Studio, Student Join, CBT and supporting demo pages completed without application startup errors using browser API stubs.
- Relay controller tests confirmed public health response, unauthorized API rejection, empty-destination rejection and query-string-safe status routing.
- `git diff --check` passed.
- The fixed archive was generated with the repository folder hierarchy intact (71 files). The final archive checksum is included in the delivery note so the report can remain part of the archive without a self-referential hash.

---

## 8. What still requires a real production decision

1. **Static licensing is not bank-grade security.** `AUTH_SECRET` is present in browser-delivered JavaScript, so a determined user can inspect and modify a static clone. Change the placeholder before casual deployment, but use the Cloudflare Worker in `strict` mode for meaningful server-side subscription enforcement.
2. **Parent, community and classroom command-centre pages are demos.** They do not share data with teachers or authenticate parents. A real backend/API and access-control model are required before using them with real children or families.
3. **Teacher-hub WebRTC scales by teacher upload bandwidth.** A 720p stream sent separately to many students can become expensive on mobile data and unreliable for large classes. A media server/SFU is the next scale-up path.
4. **The PeerJS public broker and public TURN credentials are best-effort dependencies.** Production use should consider self-hosted signalling and controlled TURN credentials.
5. **Full device capture depends on browser/OS policy.** Composite workspace capture is the reliable tablet path; `getDisplayMedia()` cannot be forced on browsers that do not expose it.
6. **Reader Cast depends on external reader/CORS proxies and internet access.** It is not an offline arbitrary-web-page reader.
7. **Social live needs the relay VM and platform eligibility.** The static Vercel deployment alone cannot publish RTMP.
8. **A real browser/device matrix is still recommended.** Test Chrome Android, Safari iOS, Firefox desktop, budget Android tablets, restrictive mobile networks, autoplay prompts, camera/mic revocation, class resume, recording, PWA install and relay deployment before declaring production readiness.

---

## 9. Recommended deployment order

1. Keep `hmgacademyclassdeck-original.zip` as the rollback backup.
2. Upload the contents of the fixed `hmgacademyclassdeck` package to the GitHub repository root.
3. Deploy/redeploy the repository as a static Vercel project.
4. Confirm the response headers from `vercel.json` are present.
5. Hard-refresh or clear the old service-worker cache once after deployment.
6. Test one teacher device and two student devices on different networks.
7. If using licensing, deploy the Worker, bind KV, set `ADMIN_SECRET`, add license records, set `licenseMode: "strict"`, then test trial, activation, expiry, device limit and block flows.
8. If using Social Live, deploy the relay separately, keep stream keys out of Git, test `/health`, WHIP publishing and one destination before enabling multiple destinations.

**Conclusion:** the core ClassDeck teaching path is a coherent, unusually ambitious static/PWA classroom product aimed at tablet teaching. The fixed package removes the most important classroom-flow, cleanup, input-safety, offline-shell, manifest, SEO, relay and Worker lookup defects found during this audit. The main remaining risks are architectural rather than simple bugs: static client-side licensing, teacher-hub scaling, browser media policy and the demo-only supporting pages.
