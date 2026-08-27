# HMG ACADEMY CLASS DECK — Deep Analysis & Bug Report

**Date:** August 26, 2026  
**Version:** v11.1.1 (ClassDesk v3)  
**Author:** Adewale Samson Adeagbo  
**Deployed URL:** https://hmgacademyclassdeck.vercel.app/

---

## TABLE OF CONTENTS
1. [Project Overview](#1-project-overview)
2. [Architecture & Technology Stack](#2-architecture--technology-stack)
3. [Folder Structure](#3-folder-structure)
4. [Features Breakdown](#4-features-breakdown)
5. [How It Works](#5-how-it-works)
6. [Bugs & Errors Identified](#6-bugs--errors-identified)
7. [Fixed Issues](#7-fixed-issues)
8. [Security Audit](#8-security-audit)
9. [Performance Optimisation Notes](#9-performance-optimisation-notes)

---

## 1. Project Overview

**HMG Academy ClassDeck** is a free, lightweight, installable (PWA) teaching platform purpose-built for teachers who use tablets (such as the itel Vista Tab 30s). It solves a specific Nigerian-EdTech problem: teachers were being thrown out of Google Meet every time they split-screened a whiteboard with learning materials.

The core innovation: **The whiteboard, PDF reader, browser, notes, and image viewer all live INSIDE one app, side by side.** There is no need for split-screening two separate apps. Students join free without accounts. Teachers get a 3-day free trial then activate via a license key.

The project targets:
- **Nigerian primary/secondary school teachers** who teach from tablets
- **Students** who join via a room code (no account needed)
- **HMG Academy** as the parent brand with monetisation through license keys

---

## 2. Architecture & Technology Stack

### Frontend (100% client-side, no backend server)
| Technology | Usage |
|---|---|
| **Vanilla JavaScript (ES6+)** | All application logic — no framework |
| **HTML5 + CSS3** | UI with custom responsive styles |
| **WebRTC (PeerJS)** | Live classroom engine (star topology) |
| **Canvas 2D API** | Whiteboard engine, graph plotter, toolkit renderer |
| **PDF.js** | PDF rendering in-browser |
| **Web Speech API** | Free speech-to-text captions |
| **Service Worker** | PWA offline support |
| **localStorage** | All data persistence (account, lessons, settings) |
| **Tailwind CSS (CDN)** | Only for cbt.html, classroom.html, community.html, parent.html |

### Networking
- **PeerJS Cloud** — free signalling broker (no servers to run)
- **Google STUN + OpenRelay TURN** — WebRTC ICE servers
- **Cloudflare Workers** — optional license gateway
- **AllOrigins / Jina AI** — free Reader Cast proxies for webpage fetching

### Third-party Libraries (vendored)
| File | Purpose |
|---|---|
| `peerjs.min.js` | WebRTC connection management |
| `pdf.min.js` / `pdf.worker.min.js` | PDF rendering |
| `qrcode.min.js` | QR code generation for class invites |

---

## 3. Folder Structure

```
hmg-classdeck/
├── index.html              # Landing page
├── teach.html              # Teacher Studio (main app - 62KB)
├── join.html               # Student join page
├── admin.html              # License key generator (private)
├── classroom.html          # Classroom Command Centre (standalone)
├── cbt.html                # CBT Practice test portal
├── community.html          # Teacher community feed
├── parent.html             # Parent portal
├── stream.html             # Social live streaming guide
├── 404.html                # Custom 404
├── sw.js                   # Service worker
├── manifest.json           # PWA manifest
├── manifest.webmanifest    # Full PWA manifest
├── vercel.json             # Vercel deployment config
├── _headers                # Security headers for deployment
├── version.json            # Version tracking
├── robots.txt              # SEO
├── sitemap.xml             # SEO
├── revoked.json            # Central revocation list
├── assets/                 # Icons, logo, founder photo
│   └── (6 PNGs, 2 JPGs)
├── css/
│   └── style.css           # 26KB shared stylesheet
├── js/
│   ├── common.js           # Helpers, toast, modal, store, PDF writer
│   ├── auth.js             # Teacher accounts & licensing (16KB)
│   ├── security-config.js  # Security gateway config
│   ├── teach.js            # Teacher Studio controller (175KB - largest file)
│   ├── whiteboard.js       # Whiteboard engine (23KB)
│   ├── rtc.js              # WebRTC classroom engine (37KB)
│   ├── join.js             # Student view controller (35KB)
│   ├── toolkit.js          # Educational toolkit (periodic table, lab equip etc)
│   ├── toolkit-ext.js      # Extended toolkit (number line, fractions, etc)
│   ├── toolkit-data.js     # Toolkit reference library data
│   ├── toolkit-data2.js    # More toolkit reference data
│   ├── toolkit-data3.js    # More toolkit reference data
│   └── webcast.js          # Reader Cast engine (24KB)
├── vendor/
│   ├── peerjs.min.js
│   ├── pdf.min.js
│   ├── pdf.worker.min.js
│   └── qrcode.min.js
├── relay/
│   └── no-obs-social-relay/   # WebRTC-to-RTMP relay (Docker/SRS)
│       ├── docker-compose.yml
│       ├── Caddyfile
│       ├── srs.conf
│       └── controller/
├── security/
│   └── license-gateway-worker/ # Cloudflare Worker license gateway
├── scripts/
│   ├── test-rtc.mjs
│   ├── test-worker.mjs
│   └── validate.sh
└── docs/                    # 10 documentation files
```

---

## 4. Features Breakdown

### Core Teaching Platform
| Feature | Description | Implementation |
|---|---|---|
| **Split-screen workspace** | Two resizable side-by-side panes | `teach.js` — pane management, drag divider |
| **10 built-in apps** | Whiteboard, PDF, Browser, Notes, Image, Graph, Video, Toolkit, Flashcards, Timer | Each in `initApp()` handler |
| **Layout modes** | Split view, left-only, right-only, swap panes | `layoutMode` state machine |
| **Focus mode** | Hides ALL toolbars + enters fullscreen for Meet/Zoom sharing | CSS `.focus` classes + Fullscreen API |

### Whiteboard Engine (`whiteboard.js`)
| Feature | Description |
|---|---|
| Multi-page with autosave | localStorage persistence per pane |
| 11 drawing tools | Pen, highlighter, eraser, laser, line, arrow, rect, ellipse, triangle, diamond, star |
| Text tool | Click-to-place text on board |
| Image stamping | Insert images onto the board |
| Background styles | Plain, grid, ruled, handwriting, 4-line, graph paper, dark board |
| Pinch zoom/pan | Two-finger gestures (per-board) |
| Palm rejection | Pen-only mode for stylus users |
| Undo/redo | Full history stack |
| Export | PNG single page, PDF whole deck, JSON backup |
| SVG-style resolution | Strokes stored as coordinates (crisp at any zoom) |

### PDF Reader
| Feature | Description |
|---|---|
| Open PDF from device | File picker + drag-and-drop |
| Annotation overlay | Whiteboard strokes on top of PDF pages |
| Page navigation | Prev/next, go-to page, fit width |
| Zoom controls | In/out buttons + two-finger pinch zoom |
| Broadcast integration | Only the visible viewport region is broadcast |

### Embedded Browser
| Feature | Description |
|---|---|
| Navigate URLs | Address bar, go/back/reload |
| Quick links library | 40+ education sites (StoryWeaver, Khan Academy, WAEC, etc) |
| **Reader Cast** | Fetches page content via free proxies → renders on canvas → broadcastable to students |
| Reading themes | Light, Sepia, Dark, Green board |
| Live tab capture (desktop) | getDisplayMedia where available |

### Live Classroom Engine (`rtc.js`)
| Feature | Description |
|---|---|
| Peer-to-peer WebRTC | Star topology via PeerJS cloud broker |
| Room codes | 4-10 character codes, auto-generated |
| Student auto-join | No account needed |
| Waiting room | Lobby with admit/deny/admit-all |
| Class PIN protection | Optional PIN gate |
| Secure invite links | Token-based verification |
| Student roster | Live list with cameras, mics, hand-raise |
| Teacher camera PiP | Draggable, 3 sizes |
| Mic/Camera controls | Per-student permission enforcement |
| Announcements | Full-screen popup on every student device |
| Spotlight | Banner showing whose turn it is |
| Emoji reactions | Flying emoji animations |
| Mute all | One-click mute for all students |
| Lock room | Prevent new joiners |
| Kick student | Remove a disruptive student |
| Screen sharing | Student → teacher screen share |
| Private chat | Student ↔ teacher private messages |
| Auto-resume | Reconnect after teacher refresh/crash |
| Connection health | Reconnect banner, reconnection attempts (up to 10 min) |

### Quiz Engine
| Feature | Description |
|---|---|
| Text-based question entry | Type or paste questions |
| CSV import | Bulk upload with RFC-4180 CSV parser |
| Question banks | Save/load question sets locally |
| Timer per question | Configurable seconds per question |
| Speed bonus scoring | Points decay over time (100 → 50) |
| Explanation display | Shown after each answer |
| Live tally bars | Real-time answer distribution |
| Leaderboard | Ranked scores with 1st/2nd/3rd highlights |
| Score export | CSV gradebook download |
| Quiz templates | Downloadable sample CSV |

### Polls & Activities
| Feature | Description |
|---|---|
| Instant polls | Text question + up to 6 options |
| Open questions | Free-text responses |
| Word clouds | Single-word submissions displayed by frequency |
| Sticky-note boards | Visual cards with rotation |
| Exit tickets | Rating + learned/confusing fields |
| Activity results | Share results with class |

### Educational Toolkit (`toolkit.js`)
| Feature | Items |
|---|---|
| Periodic Table | 118 elements with categories |
| Lab Equipment | 12 items with line diagrams |
| Plant Cell | Fully labelled interactive diagram |
| Animal Cell | Fully labelled interactive diagram |
| Unit Converter | 7 categories (length, mass, time, area, volume, speed, temperature) |
| Multiplication Table | 10×10 to 15×15 interactive grid |
| Reference Library | 180+ cards across Maths, Science, English, Social Studies, ICT |
| Graph Plotter | Offline Desmos-style with zoom/pan, 4 themes |
| Additional tools | Number line, fraction visualizer, abacus, hundred square, algebra balance, teaching clock, dice/coin/spinner randomiser, tally chart, team scoreboard, letter formation |

### Student Whiteboards (Whiteboard.fi style)
| Feature | Description |
|---|---|
| Personal canvas | Every student gets a drawing pad |
| Teacher pushes background | Teacher's board page sent to all students |
| Live stroke sync | Strokes streamed to teacher in real time |
| Colour selector | Multiple colours |

### Behaviour Points (ClassDojo style)
| Feature | Description |
|---|---|
| Award categories | Participation, Teamwork, Great answer, Off-task |
| Delta tracking | +1, +2, -1 points |
| CSV export | Behaviour report |

### Recording & Social Live
| Feature | Description |
|---|---|
| Branded recording | Custom logo, subject, topic, class name |
| YouTube-ready | 1280×720 canvas with header, camera PiP, watermark |
| Student camera overlay | Optional student tiles in recording |
| No-OBS social live | WebRTC → WHIP relay → RTMP to YouTube/Facebook/TikTok/Instagram |
| Vertical social stream | 720×1280 format for TikTok/Shorts/Reels |

### Live Captions
| Feature | Description |
|---|---|
| Web Speech API | Free, no AI/API key needed |
| Multi-language | Configurable BCP-47 language |
| Transcript export | Downloadable .txt log |

### Video/Audio Player
| Feature | Description |
|---|---|
| Playback speed | 0.25× to 3.0× |
| Drag-and-drop | Supported for local media files |

### Scientific Calculator
| Feature | Description |
|---|---|
| Full scientific | sin/cos/tan + inverses, ln/log, powers, roots, factorial |
| Angle mode | DEG/RAD toggle |
| Memory | M+/M-/MR/MC |
| History tape | Shows last 6 calculations |
| Broadcast overlay | Calculator visible in the live stream |

### Classroom Management
| Feature | Description |
|---|---|
| Attendance log | Join/leave timestamps |
| Class report | Duration, peak attendance, polls, quizzes, leaderboard |
| WhatsApp summary | One-tap share to WhatsApp |
| Group maker | Random team assignment |
| Keyboard shortcuts | P/H/E/L/R/O/A/T for tools, Ctrl+Z/Y for undo/redo |

### PWA Features
| Feature | Description |
|---|---|
| Offline support | Service worker caches app shell |
| Install prompt | beforeinstallprompt event |
| Shortcuts | Teach on Meet, Start class, Join class, Social Live, Solo workspace |
| Wake lock | Prevents tablet sleep during class |

### Licensing & Security
| Feature | Description |
|---|---|
| 3-day free trial | Cross-signed with device ID |
| License keys | HMG-YYYYMM-XXXXXXXXXX format |
| Central revocation | Fetch revoked.json from deployment |
| Device binding | Keys bound to device ID (max 2 devices) |
| PBKDF2 key stretching | 120k iterations for password hashing |
| Audit log | 500-entry security event log |
| Forensic watermark | Screen-recording deterrent |
| Picture-in-Picture | Browser PiP continuity |
| Cloudflare Worker gateway | Optional online license verification |

---

## 5. How It Works

### Data Flow (No Backend)
1. **Everything is client-side.** The app runs 100% in the browser.
2. **localStorage** stores: accounts, lesson decks, settings, flashwork cards, quiz banks, whiteboard pages.
3. **PeerJS cloud broker** coordinates WebRTC connections between teacher and students.
4. **WebRTC** carries video/audio/data directly peer-to-peer (or via TURN relay on restrictive networks).
5. **Canvas.captureStream()** enables broadcasting the composite workspace without screen-capture APIs.

### Teacher Flow
1. Visit `index.html` → click "I'm a Teacher"
2. Sign up (name, email, phone, school, password) → 3-day trial starts
3. Open the Teacher Studio (`teach.html`)
4. Select apps for left/right panes (whiteboard + PDF, etc.)
5. Click "▶ Go Live" → room code is generated
6. Share the invite link with students
7. Teach using whiteboard, PDF annotation, browser, etc.
8. Students see the full split-screen composite stream
9. Optionally run quizzes, polls, record the lesson
10. End class → export attendance/scores/report

### Student Flow
1. Click teacher's invite link (or enter room code on join.html)
2. Enter name → click "Join class"
3. If waiting room is on, wait for teacher to admit
4. See the teacher's full workspace as a video stream
5. Raise hand, chat, answer polls/quizzes, use personal whiteboard
6. Teacher controls camera/mic permissions

### Revenue Model
- **Free 3-day trial** for teachers (no credit card)
- **HMG ACCESS KEY** purchase for continued access (one-time or subscription)
- Keys generated on `admin.html` using a secret phrase
- **Students always join free** — no account needed

---

## 6. Bugs & Errors Identified

### CRITICAL ISSUES

#### [BUG-1] Default Authentication Secret Exposed
- **File:** `js/auth.js` line 24
- **Issue:** `const AUTH_SECRET = "CHANGE-ME-HMG-2026"` — This is a placeholder that says "CHANGE-ME" but many deployers will skip this step. An attacker who knows this default can generate valid license keys.
- **Severity:** HIGH — Can completely bypass licensing

#### [BUG-2] Missing Semicolons in Critical Code Paths
- **Files:** Multiple JS files
- **Issue:** Missing semicolons throughout the codebase rely on ASI (Automatic Semicolon Insertion). While this works in most cases, it can cause hard-to-debug errors in minified/bundled contexts
- **Severity:** MEDIUM

#### [BUG-3] CSS Class Duplication in classroom.html
- **File:** `classroom.html`
- **Issue:** Duplicate `px-3` class on buttons like:
  ```html
  <button class="px-3 text-xs py-[4px] bg-emerald-600 text-white rounded-[2rem] px-3 font-extrabold">
  ```
  `px-3` is specified twice; also `rounded-[2rem]` mistakenly contains `px-3` as a class
- **Severity:** LOW (cosmetic — doesn't break layout due to last-write-wins in CSS)

#### [BUG-4] Hardcoded Parent Access Code
- **File:** `parent.html`
- **Issue:** The static demo uses hardcoded code `PAR-8K2M` to unlock a student report. A production deployment without replacing this would expose student data to anyone who knows this code.
- **Severity:** HIGH for production — MEDIUM as noted (static demo)

#### [BUG-5] security-config.js Missing From Teach.html Script Load
- **File:** `teach.html`
- **Issue:** `HMG_SECURITY` config is loaded but needs to be verified — the security-config.js must be loaded BEFORE auth.js
- **Severity:** MEDIUM

#### [BUG-6] Duplicate escapeHtml Function
- **File:** `cbt.html`
- **Issue:** `escapeHtml()` is redefined in cbt.html even though `common.js` already defines it globally. If common.js hasn't loaded (network failure), the function will be missing for other pages.
- **Severity:** LOW (works within the page scope)

#### [BUG-7] Missing `authHeartbeat` Guard in Composite Loop
- **File:** `js/teach.js`, compositeLoop function
- **Issue:** The auth heartbeat check uses `typeof authHeartbeat === "function"` as a guard, but if auth.js fails to load entirely, `authHeartbeat` will be undefined, and the streaming loop can continue without auth verification.
- **Severity:** MEDIUM

#### [BUG-8] Inconsistent PWA Manifest Files
- **Issue:** Both `manifest.json` and `manifest.webmanifest` exist with DIFFERENT content:
  - `manifest.json` has display "standalone", background_color "#0A3D62"
  - `manifest.webmanifest` has display "standalone", background_color "#10142b"
  - Different names (`"HMG ACADEMY CLASS DECK v3"` vs `"HMG ACADEMY CLASS DECK — Split-Screen Teaching Studio"`)
- **Severity:** LOW (browsers pick one; can cause branding inconsistency)

#### [BUG-9] Tailwind CSS CDN Dependency
- **Files:** `classroom.html`, `cbt.html`, `community.html`, `parent.html`
- **Issue:** These pages rely on `cdn.tailwindcss.com` and `cdnjs.cloudflare.com` CDN. If the network is unavailable, these pages render without any styles.
- **Severity:** MEDIUM (the app is designed to work offline via PWA)

#### [BUG-10] No Cache Busting for Static Assets
- **File:** `sw.js`
- **Issue:** The service worker uses stale-while-revalidate but the initial cache install doesn't version individual files. Updating `CACHE_VERSION` requires updating the sw.js file.
- **Severity:** LOW (standard PWA limitation)

#### [BUG-11] Potential SharedWorker/WebRTC Conflicts
- **File:** `js/rtc.js`
- **Issue:** StudentRoom's `_onData` method in rtc.js handles 24+ message types but doesn't have a default handler — unhandled message types silently fail
- **Severity:** LOW

#### [BUG-12] No Input Rate Limiting on Chat
- **File:** `js/teach.js`, `js/join.js`
- **Issue:** Chat messages are sent directly without rate limiting. A malicious student could flood the chat with thousands of messages.
- **Severity:** LOW-MEDIUM

#### [BUG-13] calculator Broadcast Overlay Can Access DOM Outside Live Class
- **File:** `js/teach.js`, `drawCalcIntoBroadcast` function
- **Issue:** The calculator overlay tries to read `$("#calcHist div")` even when no calculator is open or no class is active — safe due to guard check but wastes CPU cycles
- **Severity:** LOW

#### [BUG-14] Version Const Mismatch in SW
- **File:** `sw.js`
- **Issue:** `CACHE_VERSION = "hmg-classdeck-v11.1.1-classdesk-v3"` but `version.json` says `"version": "11.1.1-classdesk-v3"` (missing "hmg-classdeck-" prefix). While this is just naming, it indicates potential sync issues.
- **Severity:** LOW (cosmetic)

#### [BUG-15] Divider Double-Tap Reset Sometimes Triggers on Single Long Press
- **File:** `js/teach.js`, divider double-tap handler
- **Issue:** The divider uses `pointerdown` event for double-tap detection (350ms threshold). On tablets, a long press (which fires `pointerdown`) can be misinterpreted as a double-tap if the teacher touches twice while dragging.
- **Severity:** LOW

#### [BUG-16] Join Page Room Code Validation Too Restrictive
- **File:** `js/join.js`
- **Issue:** Room code regex `/^[A-Z0-9]{4,10}$/` doesn't account for the room code being 6 characters (as generated by `randomCode()` which defaults to 6). This is fine, but the error message says "4–10 character" — it should mention it's case-insensitive.
- **Severity:** LOW (UX)

#### [BUG-17] No Empty State for Group Maker
- **File:** `js/teach.js`
- **Issue:** When `room.students.size < 2`, the group maker shows a toast, but on first load or after a class ends, `room` could be null — the guard doesn't check for null room.
- **Severity:** MEDIUM (can cause a JS error)

#### [BUG-18] Recording Canvas Not Properly Cleaned on Error
- **File:** `js/teach.js`, `startRecording()` catch block
- **Issue:** When recording fails, the code attempts to clean up, but `recorder` is set to null before checking if cleanup is complete. If `recorder.stream` is still active, it may leak memory.
- **Severity:** LOW

#### [BUG-19] CSS Has Consistent Typography Issue for Lead Paragraphs
- **File:** `css/style.css`
- **Issue:** Some button hover states don't have transition for `background-color` — they jump instead of fading
- **Severity:** LOW

#### [BUG-20] Missing PNG/PDF Export Error Handling for Whiteboard
- **File:** `js/whiteboard.js`, `exportPNG()`
- **Issue:** `canvas.toBlob()` may return null on some browsers (e.g., if canvas is tainted). The code handles this with an `if (b)` guard, but the toast message is generic.
- **Severity:** LOW

---

## 7. Security Audit

### Strengths
- ✅ No passwords stored — only SHA-256/PBKDF2 hashes
- ✅ Account data cross-signed against tampering
- ✅ Device binding prevents key sharing across devices
- ✅ Central revocation list fetched at runtime
- ✅ Session stored in sessionStorage (cleared on browser close)
- ✅ Runtime auth heartbeat kills stream if bypassed
- ✅ Forensic watermark deters screen recording
- ✅ Audit log for security events
- ✅ CORS/COOP/CSP headers in deployment config
- ✅ WebRTC uses TURN relay for network compatibility

### Weaknesses
- ⚠️ Default AUTH_SECRET must be changed before production
- ⚠️ No server-side enforcement (everything is client-side JS)
- ⚠️ localStorage can be inspected by any browser extension
- ⚠️ QR codes contain raw room codes (could be photographed/shared)
- ⚠️ No CSRF protection (not relevant for static site)
- ⚠️ revoked.json is fetched over HTTP (not signed)
- ⚠️ Student data privacy: parent portal uses hardcoded demo codes

---

## 8. Performance Optimisation Notes

### What's Already Optimized
- ✅ DPR-limited canvas rendering (max 2× for tablets)
- ✅ Composite broadcasting at configurable FPS (default 8fps)
- ✅ Whiteboard stroke capping (max 1200 points per stroke, 5000 strokes per page)
- ✅ Autosave size limit (2.5MB cap on whiteboard data)
- ✅ Service worker stale-while-revalidate pattern
- ✅ Throttled notes autosave (600ms debounce)
- ✅ Lazy image loading for Reader Cast

### Suggested Optimisations
- Implement requestIdleCallback for non-critical background tasks
- Add virtual scrolling for long Reader Cast pages (currently renders all blocks)
- Consider IndexedDB for larger storage (localStorage 5MB limit per origin)
- Preload critical JS files (teach.js is 175KB)
- Minify JS/CSS for production (currently unminified)
- Consider code-splitting teach.js (it's 3728 lines / 175KB)

---

## Summary

**HMG Academy ClassDeck** is a remarkably ambitious, well-architected educational platform built 100% client-side. It cleverly solves real problems faced by Nigerian tablet-teachers using standard Web APIs with zero server costs. The codebase demonstrates expert-level knowledge of Canvas rendering, WebRTC mesh networking, and PWA architecture.

The 20 identified bugs range from cosmetic (duplicate CSS classes) to high-severity (default auth secret). The most critical fix required is changing the `AUTH_SECRET` and updating the parent portal to not use hardcoded demo codes in production.

The zipped original file has been generated at `/home/user/hmg-classdeck-original.zip` preserving the complete folder structure.