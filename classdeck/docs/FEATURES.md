# 🧰 HMG ACADEMY CLASS DECK — Complete Feature Reference

Every feature in the system, explained in detail. All features work with **free tools only — no AI APIs, no paid servers, no database**.

---

## A. CORE TEACHING WORKSPACE

### A1. Split-screen workspace
Two resizable panes sit side-by-side; drag the divider to change the split, double-tap it to reset to 50/50. Each pane hosts any of 10 apps (whiteboard, PDF, browser, notes, image, graph, video, toolkit, flashcards, timer). Layout cycles: split → left-only → right-only (button `◫`); swap panes with `⇄`. This is what lets a tablet look like a laptop share.

### A2. Whiteboard engine
Canvas-based, vector-stroke whiteboard with 11 tools (pen, highlighter, eraser, laser pointer, line, arrow, rect, ellipse, triangle, diamond, star), a text tool, and image stamps. Multi-page decks with autosave to localStorage, undo/redo, 7 backgrounds (plain, grid, ruled, nursery handwriting lines, 4-line letter practice, fine graph paper, dark board), two-finger pinch zoom/pan per board, pen-only mode for palm rejection, and export to PNG / whole-deck PDF / JSON.

### A3. PDF reader + annotation
Open local PDFs (file picker or drag-drop; nothing uploads). Page navigation, zoom in/out, fit-width, go-to page, and a whiteboard annotation layer that keeps your notes glued to each page. The broadcast shows exactly the visible region (zoom + scroll).

### A4. Embedded browser + Reader Cast
Navigate any URL in-pane with back/reload/pop-out and a 40+ site education quick-link library (StoryWeaver → WAEC). **Reader Cast** fetches a page through free reader/CORS proxies, renders it as a clean magazine-style canvas, and streams it to every student — because Android tablets can't run `getDisplayMedia`. Four reading themes, font controls, and (on desktops) a true live tab-capture button.

### A5. Notes pane
Rich textarea with debounced autosave, .txt export, and live rendering into the broadcast.

### A6. Image viewer
Open/drag images; two-finger pinch zoom is exported so the broadcast mirrors the teacher's zoom level.

### A7. Graph plotter
Offline Desmos-style plotter: `x^2-3x+2`, `sin(x)`, `sqrt(x)` etc., multiple curves, pan/zoom, 4 backgrounds, and presets.

### A8. Video/audio player
Local media playback with 0.25×–3× speed, drag-drop, broadcast into the lesson.

### A9. Flashcards
Front/back cards, shuffle, and a text editor (`front | back` per line), autosaved on device.

### A10. Stopwatch / countdown
Big classroom timer with laps and countdown mode (sends "Time is up" announcements to the class).

---

## B. LIVE CLASSROOM (WebRTC — free PeerJS cloud + STUN/TURN)

### B1. Rooms, codes and links
Every teacher/device gets its own isolated room. Room codes are 6-char auto-generated **or teacher-custom** (Settings → Custom room code, letters+numbers 4–10) or via deep link `teach.html?room=MYCODE`. Students join with the invite link, QR, or code. Class PIN optional; secure invite tokens optional.

### B2. Go Live / End
`▶ Go Live` starts the room and broadcasts the composite canvas + mic to students; `⏹ End` stops everything, exports the attendance/leaderboard data and releases hardware. Both are hardened so a failed start can never leave the buttons stuck.

### B3. Student experience
Students join with just a name (no account). They see the full split-screen stream, a draggable teacher-camera PiP, live captions banner, announcements, polls, quizzes, reactions, group banners, and their own personal whiteboard. Auto-reconnect keeps them attached for up to ~10 minutes if the teacher's app refreshes or crashes.

### B4. Roster & moderation
Live roster with per-student camera/screen/mic controls, hand-raise queue, mute-all, spotlight (double-click a name), kick, room lock, waiting room (admit/deny/all), and attendance CSV.

### B5. Chat & announcements
Class chat with private (student↔teacher) mode, full-screen announcements, and **rate limiting** (20 msgs/10 s per peer) to stop spam.

### B6. Polls
Instant multiple-choice polls with live animated bars, end-and-show-results.

### B7. Quizzes & leaderboard
Text or CSV question entry, per-question timer, speed bonus scoring (100→50), instant feedback with explanations, live tally, class podium, saved question banks, score CSV export.

### B8. Activities (Mentimeter/Peardeck-style)
Open questions, live word clouds, sticky-note boards, exit tickets (rating + learned + confusing) with shareable results.

### B9. Student whiteboards (Whiteboard.fi-style)
Teacher starts boards → each student gets a canvas only the teacher sees; strokes stream live; teacher can push their own board as background.

### B10. Behaviour points (ClassDojo-style)
Award ⭐/🤝/💡/⚠ per student, live toasts, CSV export.

### B11. Group maker
Randomly assigns students to N groups and tells each student their group number via banner.

### B12. Reactions
Emoji reactions (👍❤️😂🎉😮👏) fly across screens.

### B13. Captions (free, no AI)
Browser Web Speech API converts the teacher's voice to a live caption banner on every student device; full transcript export.

### B14. Scalability to 1000+
1–50 students: direct WebRTC. 50–200: optimized composite broadcast (monitor tells you automatically). 200+: banner recommends streaming the same canvas to **YouTube Live** (unlimited viewers) and sharing that link — free, no congestion.

---

## C. RECORDING (branded, crash-safe, all-inclusive)

### C1. Classic branded recorder
Records the split panes with subject/topic/class header, teacher brand, logo upload, teacher camera PiP and optional student tiles; saves MP4 (where supported) or WebM.

### C2. Enhanced HMG Recording Studio (`⏺ Rec`)
Opens a full dialog: subject, topic, class, brand, **staff name + title** (default "Adewale Adeagbo · Virtual Tutor | Data Scientist | AI-Augmented Solutions Developer", editable), **lower-thirds scrolling banner** (default "If you want to book virtual classes… 08100866322, 08094481488", editable), **text-ad field** + ad interval, staff popup interval, footer credit, custom logo, include-student-cameras.

### C3. Automatic branded intro (6 s)
Every recording starts with: gradient header, logo, brand name, motto, tutor name + title, subject — topic, class, HMG ecosystem line, "✦ Recording in progress ✦".

### C4. Automatic branded outro (4 s)
"Thank you for watching", brand, motto, contact ("Contact Adewale for your virtual classes · 08100866322 · 08094481488"), ecosystem line, follow CTA. Rendered before the file is saved.

### C5. Intermittent overlays during the lesson
- **Lower-thirds:** text scrolls at the bottom of every frame.
- **Staff credentials popup:** name+title card appears for ~5 s every configured interval.
- **Text ad:** red banner with your ad text appears for 5 s every configured interval.

### C6. Crash-safe recording (auto-save on unexpected close)
Every recording chunk is mirrored in real time to **IndexedDB** (`window.CDCrashSafe`). If the app/browser closes mid-class, the chunks survive; on next load you get a "previous recording saved — Recover" prompt. When you stop normally, the mirrored chunks are cleared.

### C7. Recording + live streaming simultaneously
One composite canvas feeds the MediaRecorder and the WebRTC broadcast at the same time — record while live, no conflicts.

### C8. Promo overlays on the LIVE broadcast (optional)
Settings → "Show promotion overlays on the live broadcast" paints the lower-thirds, staff popup and text-ad onto what students see live — the class itself promotes the brand.

---

## D. NO-OBS SOCIAL LIVE

### D1. Tablet Social Live (WebRTC → RTMP relay)
From Settings → Tablet Live: paste a relay gateway URL + RTMP/RTMPS destination URLs (YouTube, Facebook, Instagram, TikTok, custom). The app publishes the ClassDeck canvas via WHIP to the relay, which converts to RTMP. Landscape 16:9 or vertical 9:16. Full `relay/no-obs-social-relay/` (Docker + SRS + Caddy) is included for free self-hosting.

### D2. Social centre
`stream.html` — step-by-step no-OBS workflows, platform notes, browser-studio fallbacks (YouTube Studio, Facebook Live Producer, TikTok Live Center, StreamYard, Restream).

---

## E. COMPANION MODE (Meet / Zoom / Teams / FreeConference / Skype)

Append to teach.html:
- `?meet=1` → Google Meet
- `?companion=zoom#zoom` → Zoom
- `?companion=teams#teams` → Microsoft Teams
- `?companion=freeconf#freeconf` → FreeConference
- `?companion=skype` / `?platform=…` → also supported

Companion mode hides live-class controls, shows a green platform badge, keeps the screen awake, and auto-enters focus mode so what you share in your conferencing app is a clean full-screen workspace.

---

## F. ACCOUNTS, LICENSING & SECURITY

### F1. HMG Owner account (never expires)
`js/config.js` → `window.HMG_OWNER` (default email `buildingmyictcareer@gmail.com`, password `Walex@28120215`, editable in the repo). Signed-up owner accounts are flagged `owner:true` → **lifetime access**, bypassing trial, license, revocation, and device-binding (founder can sign in anywhere). Non-owner teachers get a 3-day trial then license keys (`admin.html` → HMG-YYYYMM-XXXXXXXXXX).

### F2. Client subscription billing (generator)
The ClassDeck Generator sets each client's billing model: **one-time (lifetime)** or **Monthly/Quarterly/Yearly subscription** with expiry, grace days, renewal link, contact, lock message. Generated decks ship `js/license.js` that shows a 30-day renewal reminder, then a grace banner, then a lock screen until renewal. 100% browser-based.

### F3. Security layers
PBKDF2 (120k) password hashing; signed localStorage accounts; device binding for non-owners; central `revoked.json` kill-switch; runtime auth heartbeat (kills a bypassed stream in ~5 s); forensic watermark; 500-entry audit log with CSV export; chat rate limiting; input sanitization; security headers (HSTS/CSP/CORP/COOP) in `vercel.json` + `_headers`.

### F4. Optional Cloudflare Worker license gateway
`security/license-gateway-worker/` — free-tier worker for strict/central licensing; set its URL in `js/security-config.js` (`hybrid` or `strict`).

---

## G. APP INSTALL (PWA) — forced, persistent

- `manifest.webmanifest` with `display_override`, icons, shortcuts (`?rec=1` now auto-opens recording).
- Persistent install banner on **index.html**, **teach.html** and **join.html**; reappears until installed; install prompt via `beforeinstallprompt`; works offline after install (service worker).

---

## H. TOOLKIT & LIBRARY (200+ teaching tools)

Periodic table (118, interactive), lab equipment (12 line diagrams), plant & animal cell diagrams, unit converter (7 categories), multiplication table (up to 20), geometry construction (ruler/compass/protractor/perp-bisector/angle-bisector), number line, fraction visualizer, place-value abacus, hundred square, algebra balance, teaching clock, randomisers (dice/coin/spinner/name), tally chart, team scoreboard, letter formation, noise meter (free mic analyser, painted into broadcast), and a 180+ card reference library (Maths, Science, English, Social, ICT).

---

## I. CLASSROOM MANAGEMENT

Attendance CSV, full class report (duration, joins, peak, chats, polls, quizzes, hands, reactions, captions, leaderboard) with .txt + WhatsApp summary, lesson manager (save/load/export/import named decks), settings (name, room name, broadcast mode, quality, wake lock, promo toggle, PIN, branding/accent, secure invites, watermark, PiP reminder, custom room code, backup/restore), keyboard shortcuts, focus mode + fullscreen, floating scientific calculator (with history + broadcast overlay), countdown timers, Picture-in-Picture continuity.

---

## J. STANDALONE PAGES

- **CBT Practice** (`cbt.html`) — JAMB/WAEC/NECO/BECE sample tests, CSV import, badges, history.
- **Classroom Command Centre** (`classroom.html`) — attendance/behaviour/seating/hand-raise demo dashboard.
- **Teacher Community** (`community.html`) — local feed + posting (no backend).
- **Parent Portal** (`parent.html`) — demo report card with code PAR-8K2M (replace with real API for production).
- **License Admin** (`admin.html`) — generates HMG ACCESS KEYS (keep private).
- **404 / robots / sitemap / manifests** — full SEO + PWA wiring.

---

## K. THE CLASSDECK GENERATOR (internal HMG tool)

`generate.html` — 5-step wizard:
1. Brand (name, short name, tagline, motto, logo upload)
2. Design (primary/accent/background colors, build type) + **💰 billing model**
3. Contact & social (address, phone, email, website, 7 social URLs)
4. Features to highlight
5. Review & Generate

Output: a **ZIP with two folders** — `<CLIENT>-CLASSDECK/` (the deployable branded deck, with subscription license engine, PWA, SEO, security headers, README + deployment guide) and `CLASSDECK-GENERATOR/` (the generator itself). Fully in-browser (JSZip); nothing uploaded.

---

## L. DEPLOYMENT (free, unambiguous)

See **`DEPLOYMENT-GUIDE.md`** — GitHub upload → Vercel/Netlify/Cloudflare/GitHub Pages → owner login → checklist. All free tiers; no AI APIs; no database.
