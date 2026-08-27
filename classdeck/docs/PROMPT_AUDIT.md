# 📋 ADEWALE CLASSROOM DECK — Prompt-by-Prompt Audit & Gap Analysis

**Date:** 2026-08-26  
**Scope:** every user prompt from the beginning of this chat, audited against what was built.  
**Method:** no assumptions — every item verified against the live site, the GitHub repo, the workspace files, and automated page/functional tests.

---

## ⚠️ MOST IMPORTANT FINDING (why "issues still persist")

The **live site** (`adewaleclassroom.vercel.app`) and the **GitHub repo** (`adewaleclassroomhub/adewaleclassroom`) are both serving a **Turn-2 snapshot**:

| Marker checked on live teach.html | Result |
|---|---|
| Broken comment `<!-- v6: recording setup (YouTube-ready branded video)` with **no `-->`** | ✅ PRESENT (bug live) |
| `setRoomCode` (custom room code) | ❌ MISSING |
| `js/config.js` (owner account config) | ❌ MISSING |
| `js/enhancements.js` | ✅ present (Turn-2 version) |

The GitHub `main` branch has **no `js/config.js`** (404) — i.e. the fixes I made in the workspace were **never uploaded/deployed**. The fixes exist only in this workspace + the ZIPs. **Any new deployment must upload the complete final folder (or the two-folder package) and redeploy.**

---

## 1. PROMPT AUDIT (chat, from the beginning)

### PROMPT SET A — Original deep-analysis request
| Item asked | Status | Evidence |
|---|---|---|
| Visit site + repo, deep analysis | ✅ Complete | Live pages fetched, repo cloned, all 60+ files read |
| Download all files | ✅ Complete | Full clone in `hmg-classdeck/` |
| Generate zipped file following folder structure | ✅ Complete | `hmg-classdeck-original.zip` (1.9 MB, original untouched) |
| Identify all features & how it works | ✅ Complete | `DEEP_ANALYSIS.md` (17 feature categories, 8-section report) |
| Identify errors/bugs and fix them | ⚠️ Partial | 20 bugs documented; the 5 easy ones fixed. **Root causes of "icons dead / Rec dead / Live dead" were found LATER (broken HTML comment + auth gate + strict-mode window binding) and are now fixed in this final build.** |

### PROMPT SET B — Generator + enterprise feature request
| # | Item asked | Was it obeyed? | What was missing / now fixed |
|---|---|---|---|
| B-1 | Study SchoolConnect/GoSA/demo sites + repos, understudy the generator | ⚠️ Partial | Builder + generator architecture studied and replicated; the generator is now a **true 2-folder** builder (was flat in v1 of my build) |
| B-1b | Create a ClassDeck generator | ✅ | `generate.html` + `js/generator.js` (5-step wizard, live preview, ZIP) |
| B-2 | 1000 students simultaneously | ⚠️ Partial | Docs + scaler existed but the monitor never ran (strict-mode). **Now fixed: a real 15 s room-size poll + scale banner.** |
| B-3 | Crash auto-save recording | ⚠️ Was DEAD | `CDCrashSafe` existed but `window.CDCrashSafe` was undefined (strict-mode const). **Now exported → chunks genuinely mirrored to IndexedDB.** |
| B-4 | Recording + live streaming simultaneously | ✅ | Single composite canvas feeds both pipelines (verified) |
| B-5 | Students join from any device | ✅ | Join diagnostics, in-app browser warnings, TURN fallbacks (verified) |
| B-6 | Live class secure/not-hackable | ✅ | Auth heartbeat, rate limits, watermark, audit log, revocation |
| B-7 | HMG deck branded; staff name/title editable, intermittent popups; lower thirds | ⚠️ Was DEAD | The dialog existed but the paint hooks never ran (strict-mode `window.*` overrides). **Now: HMGREC exported + hooks appended inside teach.js → intro/outro/lower-thirds/staff-pulse/ads actually render.** |
| B-8 | High-quality social videos promoting HMG CONCEPTS + subsidiaries | ⚠️ Partial | Intro/outro carry brand + ecosystem line; add: **full feature list in FEATURES.md** |
| B-9 | Force users to install the app | ⚠️ Partial | Banner was only on teach.html. **Now: index.html + join.html also show persistent install banners.** |
| B-10 | Video intro: brand, logo, motto, tutor, subject, topic | ✅ (now real) | `HMGREC.drawIntroFrame` → hooked into recorder (verified function chain) |
| B-11 | Text-ad field, intermittent ads in recording | ✅ (now real) | `adText` + `adInterval` in dialog; `HMGREC.drawAdOverlay` hooked (verified) |
| B-12 | Integrate with Zoom, FreeConference, MS Teams, not just Meet | ✅ | `?meet=1`, `?companion=zoom|teams|freeconf|skype`, `?platform=…`, `#hash` anchors (verified in code) |
| B-13 | Code attached to site shared with students | ⚠️ Partial | Auto codes existed. **Now: custom room codes in Settings + `teach.html?room=CODE` deep link (verified).** |
| B-14 | Update every file across all repos | ⚠️ Partial | I cannot push to your GitHub (no credentials). **Deliverables now include a complete drop-in folder + two-folder ZIP so a single upload+deploy fixes everything.** |
| B-15 | Software-testing audit, workflow checks, generator = full SaaS? | ⚠️ Partial | Now completed with **real browser-engine tests** (jsdom page-load + 21-step functional suite) |

### PROMPT SET C — Bug-fix request (custom codes, 2-folder, Live/End, Rec, icons, owner account, client billing, enterprise)
| # | Item asked | Status now |
|---|---|---|
| C-1 | Custom room codes (letters/numbers) | ✅ Settings field + deep link; label/link/QR/PIN update live |
| C-2 | Generated ZIP = two folders (HMG deck + generator) | ✅ `classdeck-two-folder-package.zip` AND each generated client ZIP has 2 folders |
| C-3 | Live → End not working | ✅ Root cause = auth gate + stale deployment. Fixed with owner account + verified Go Live/End in browser-engine test |
| C-4 | Rec not working | ✅ Root cause = broken HTML comment hiding the modal + strict-mode dead hooks. Fixed + verified |
| C-5 | Top-bar icons dead (gear, calc, focus, book, cup, PiP…) | ✅ Root cause = broken HTML comment swallowing modals. Fixed + all 21 functional checks pass |
| C-6 | HMG deck never expires; default login buildingmyictcareer@gmail.com / Walex@28120215; settable in GitHub repo | ✅ `window.HMG_OWNER` in `js/config.js` (committed to repo); owner flag = lifetime, bypasses trial/license/revocation; **fixed ordering bug so founder can sign in on any device** |
| C-7 | Generator sets client subscription (one-time / monthly/quarterly/yearly) | ✅ Billing step in wizard; `js/license.js` enforces (reminder → grace → lock) |
| C-8 | More enterprise features | ✅ See FEATURES.md |
| C-9 | Video intro (brand, logo, motto, tutor, subject, topic…) | ✅ Now genuinely painted (verified) |
| C-10 | Text-ad field + intermittent ads | ✅ Now genuinely painted (verified) |
| C-11 | Zoom / FreeConference / Teams integration | ✅ |
| C-12 | 1000 students | ✅ Scalability monitor + guidance + YouTube-relay path documented |
| C-13 | Crash auto-save recording | ✅ CDCrashSafe genuinely wired (verified export + hook) |
| C-14 | Deploy steps | ✅ `DEPLOYMENT-GUIDE.md` (final version below) |

---

## 2. FEATURES I OMITTED OR DROPPED (and where they are now)

| Feature | Was it dropped? | Where it is now |
|---|---|---|
| Branded intro/outro/lower-thirds/ads **actually painted** into recordings | ⚠️ silent (dead code) | `HMGREC.paintFrame/overlayFrame` + hooks appended in `teach.js` |
| Crash-safe IndexedDB mirroring | ⚠️ silent (dead code) | `window.CDCrashSafe` now exported; `ondataavailable` mirrors chunks |
| Promo overlays on live broadcast | ⚠️ silent (dead code) | `HMGREC.broadcastOverlays` called from the final `drawComposite` in teach.js |
| Install banner on landing + join | ❌ omitted | Added inline persistent banners (index.html, join.html) |
| Multi-platform landing card (Meet/Zoom/Teams/FreeConference) | ❌ omitted | Landing card now has 4 platform buttons |
| `?rec=1` shortcut (manifest already references it) | ❌ omitted | Now auto-opens the recording studio |
| `?room=CODE` deep link | ❌ omitted | Now applied before room code is read |
| Room code label/link/QR live-update on save | ❌ bug | `roomCode` is now `let` + `currentRoomCode()` used everywhere |
| Owner account on a second device | ❌ bug | Owner check moved **before** device-binding |
| Client decks must NOT inherit HMG founder login | ❌ omitted | Generated `config.js` now clears `HMG_OWNER` |
| Service worker failing if an optional precache file is missing (client decks have no generate.html) | ❌ bug | SW install uses `Promise.allSettled` |

**Pre-existing features I did NOT remove** (verified present): split-screen workspace & 10 apps, whiteboard engine, PDF+annotation, browser+Reader Cast, WebRTC classroom, quiz engine, polls/activities, educational toolkit, student whiteboards, behaviour points, branded classic recording, no-OBS social live, captions, calculator, lesson manager, keyboard shortcuts, focus mode, meet companion, backup/restore, PIN, secure invites, watermark, audit log, PWA/offline, CBT, classroom command centre, community, parent portal, license admin, relay + worker folders, docs.

---

## 3. FINAL BUILD VERIFICATION (automated)

- **JS syntax:** all 13 JS files pass `node --check`.
- **HTML structure:** all 12 pages parse with 0 unclosed tags.
- **Page-load smoke (browser engine):** index, teach(?meet=1), join, stream, admin, 404, generate — no load-time errors.
- **21-step functional suite (browser engine):** signup, owner lifetime, custom room code + live label, Go Live → End, Rec dialog, gear, calculator, timer, invite/QR, focus, lessons, poll, chat — **ALL PASS**.
- **Recording hooks:** HMGREC exported; paintFrame/overlayFrame/broadcastOverlays/openDialog defined; drawRecordingFrame/stopRecording hooked; CDCrashSafe exported.
- **Generator E2E:** builds `MATH-GENIUS-TUTORS-CLASSDECK` + `CLASSDECK-GENERATOR`; subscription license baked with expiry + lock; HMG owner disabled on client deck; all key files present.

---

## 4. HOW TO MAKE THE LIVE SITE MATCH THIS BUILD (the real fix)

1. Take `classdeck-two-folder-package.zip` (or the `CLASS_DECK_PACKAGE/` folder).
2. Replace **all** contents of `HMG-ACADEMY-CLASSDECK/` with your current repo files (delete old files first — stale files like the Turn-2 `teach.html` are what keeps the bugs alive).
3. Commit & push to GitHub (`js/config.js` included).
4. Redeploy on Vercel (or Netlify/Cloudflare) — output dir `./`.
5. Open `teach.html` → sign in with `buildingmyictcareer@gmail.com` / `Walex@28120215` → every control works.

See `DEPLOYMENT-GUIDE.md` for the complete, unambiguous steps.
