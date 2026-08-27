# HMG ACADEMY CLASS DECK v9 — Diagnosis, Fixes and Enterprise Enhancements

Date: 2026-06-18  
Prepared for: HMG ACADEMY CLASS DECK repository

## 1. Executive summary

I reviewed the deployed GitHub Pages site and the repository structure, then enhanced the existing static/PWA architecture without removing existing features, without introducing paid AI APIs, and without converting the app into a server-based product.

The delivered `classdesk/` folder is a ready-to-upload static site. It keeps the original UI/UX and layout style, while adding:

1. Built-in full-screen/device screen sharing workflow inside ClassDeck.
2. Social media live streaming workflow through free OBS/RTMP tools.
3. A new `stream.html` Social Live Centre.
4. Free browser-based live captions and transcript export.
5. Noise meter implementation to match the already documented feature.
6. WebRTC/media-call leak fixes and cleaner class ending.
7. Better analytics fields in the class report.
8. PWA/service-worker cache update to v9.

## 2. Diagnosis of the existing platform

### Strengths already present

- Static GitHub Pages-compatible architecture: no build step, no backend bill.
- Strong tablet-focused split workspace: whiteboard + PDF/browser/notes/image/toolkit side by side.
- PeerJS/WebRTC live classroom: student join links, room code, video/audio calls, chat, polls, quizzes, student whiteboards and attendance.
- Local recording with branding and logo support.
- PWA/offline shell for whiteboard and toolkit.
- Good free-tool discipline: no AI API dependency.

### Bugs, errors and potential errors found

| Area | Finding | Risk | Fix applied |
|---|---|---|---|
| WebRTC stage switching | Repeated `setStageStream()`/camera calls could leave old MediaConnections open when changing screen/composite source. | Memory/network leak, duplicate student media calls, degraded live class quality. | Added `stageCalls` and `camCalls` maps in `js/rtc.js`; old teacher→student calls are closed before new ones are created. |
| Ending class | `endLive()` did not clear `room`, did not stop the stage video track, and could leave UI counts stale. | Starting again could be confusing; screen-share permission indicator might remain active. | `endLive()` now stops stage video tracks, cancels composite RAF, clears count, sets `room = null`, and keeps attendance until reload. |
| Screen share audio | Full screen sharing requested video only. | If teacher shares a video/tab with audio, students may not hear it. | Screen share now requests `audio: true`; browsers that support tab/system audio will include it, while the microphone is still attached separately. |
| Documentation mismatch | README described a noise meter, but the app had no reachable noise-meter control. | User expectation bug; feature appeared to exist but did not. | Added a working local microphone noise meter and broadcast overlay. |
| Social live request | Browser/static apps cannot push RTMP directly to YouTube/Facebook/TikTok/Instagram. | Users may paste stream keys into an unsafe place or expect impossible direct browser RTMP. | Added a safe OBS/RTMP centre and setup-note generator. Stream keys stay outside ClassDeck. |
| Accessibility | No live captioning/transcript tool. | Reduced accessibility for students with hearing/noise constraints. | Added Web Speech API captions and transcript download; no AI API or paid backend. |
| PWA cache | Service-worker version stayed at v8 and did not include the new social-live page. | Installed app may not update or cache the new page. | Bumped cache to `hmg-classdeck-v9.0.0` and added `stream.html`. |

## 3. New/enhanced features delivered

### 3.1 Built-in full screen sharing inside ClassDeck

Where: `teach.html → Settings → Broadcast mode`

Teachers can now select **Share screen** and then tap **Go Live**. Students join from the normal ClassDeck student link and see the shared device/window through the built-in WebRTC classroom. This is independent of Google Meet/Zoom.

Details:

- Uses `navigator.mediaDevices.getDisplayMedia()` where available.
- Requests video and optional tab/system audio.
- Falls back to composite mode if screen share is unavailable.
- Microphone audio is still attached for teacher narration.
- Existing composite mode remains the default/recommended tablet mode.

### 3.2 Social Live Centre for YouTube/Facebook/TikTok/Instagram

Where: `stream.html` and `teach.html → Settings → Social Live / OBS broadcast centre`

Because a static GitHub Pages browser app cannot push RTMP directly, the platform now includes a safe free workflow:

- Open Teacher Studio.
- Open a clean OBS output window.
- Test screen capture in the browser.
- Generate/download OBS setup notes.
- Plan target platforms and privacy checklist.
- Export a calendar `.ics` file for a scheduled live class.

Supported workflow:

- ClassDeck → OBS Window Capture/Browser Source → YouTube/Facebook/TikTok/Instagram/custom RTMP.
- Optional free multistreaming with OBS Multiple RTMP Outputs plugin or a free relay plan.

Security design:

- Stream keys are never entered into ClassDeck.
- Stream keys remain in OBS/platform dashboards only.
- The centre includes privacy/consent reminders for public streaming of classes/minors.

### 3.3 Live captions and transcript export

Where: `teach.html → 💬 Chat drawer → CC Live captions`

This feature uses the browser’s Web Speech API when available, so no paid AI/API service is required.

Teacher-side:

- Start/stop captions.
- Captions are sent to all joined students.
- Final caption lines are saved into a local transcript.
- Transcript can be downloaded as `.txt`.

Student-side:

- Students see a bottom caption banner over the live class view.
- Captions use `aria-live="polite"` for accessibility.

Limitations:

- Best browser support is Chrome/Edge.
- Speech recognition quality depends on microphone and accent/noise conditions.
- Some browsers may not support Web Speech API.

### 3.4 Noise meter

Where: `teach.html → 👥 Students drawer → 🔊 Noise meter`

A working local noise meter was added because it was already listed in the documentation.

Features:

- Uses local microphone analyser only.
- Nothing is recorded or uploaded.
- Teacher can set threshold.
- Meter shows level percentage.
- If the meter is open/active, the gauge is also painted into the live broadcast/recording overlay so students can self-regulate.

### 3.5 Cleaner WebRTC resource management

WebRTC teacher-to-student stage and teacher-camera calls are now tracked and closed cleanly when replaced. This reduces duplicate calls and long-class degradation.

### 3.6 Class report analytics improvements

The text class report now includes:

- Hands raised.
- Reactions sent.
- Caption lines.
- Existing joins, chats, polls, quizzes, leaderboard and attendance remain.

## 4. Similar platform feature research and ClassDeck mapping

| Platform / category | Unique features identified | ClassDeck status after v9 |
|---|---|---|
| BigBlueButton / education web conferencing | Browser-based WebRTC classroom, screen sharing, chat, whiteboard, shared notes, polls, breakout rooms, recordings, LMS integrations. | ClassDeck already has WebRTC classroom, screen/composite sharing, chat, whiteboard, polls, recordings and exports. v9 improves screen sharing and resource cleanup. |
| Nearpod / Pear Deck style engagement | Interactive lessons, polls, quizzes, drawing activities, real-time reports and student-paced/live modes. | Existing quizzes, polls, student whiteboards and activities remain; report analytics improved. |
| Whiteboard.fi | Every student has an individual whiteboard visible to teacher; teacher can push board to students. | Already implemented in v8; preserved. |
| ClassDojo toolkit | Behaviour points, group maker, timer/randomizer/noise meter. | Behaviour points and group maker already existed; v9 adds the missing noise meter. |
| Restream/OBS social streaming workflows | OBS or browser studio connects to multiple social platforms via RTMP/relay; guests, chat and recordings depend on provider. | v9 adds Social Live Centre and OBS setup generator while keeping ClassDeck static/free. |

## 5. Files changed/added

### Added

- `stream.html` — Social Live Centre.
- `docs/ENHANCEMENT_REPORT_V9.md` — this report.

### Modified

- `teach.html` — added Social Live Centre controls, caption controls, noise meter modal/control, better screen-share help text.
- `join.html` — added student caption banner.
- `js/rtc.js` — caption message route, WebRTC media-call cleanup, analytics counters.
- `js/teach.js` — screen-share audio, OBS setup generator, captions, transcript export, noise meter, class-ending cleanup, analytics report additions.
- `js/join.js` — student caption display.
- `sw.js` — cache version bumped and `stream.html` cached.
- `manifest.webmanifest` — Social Live shortcut and updated description.
- `version.json` — bumped to v9.0.0.

## 6. Deployment summary

Upload the contents of the `classdesk/` folder to the root of the GitHub repository, replacing existing files but keeping the same repository name if desired. GitHub Pages will deploy it as a static site.

Important: upload the **contents** of `classdesk/`, not the folder itself, so `index.html`, `teach.html`, `join.html`, `stream.html`, `sw.js`, `css/`, `js/`, `assets/`, and `vendor/` sit at repository root.
