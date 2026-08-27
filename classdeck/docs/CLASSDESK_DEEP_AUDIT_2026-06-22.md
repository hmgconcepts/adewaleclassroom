# CLASSDESK Deep Audit, Diagnosis, Fix Report and Deployment Guide

Date: 2026-06-22
Target: `https://hmgacademyclassdeck.vercel.app/`
Repo baseline: `hmgacademyhub/hmgacademyclassdeck`
Working package folder: `classdesk/`

---

## 1) Executive summary

This audit focused on four goals:

1. **Find the cause of the student join/lobby problem.**
2. **Fix actual bugs and high-risk logic issues without changing the layout/UI philosophy.**
3. **Improve security, reliability, and SaaS readiness while still using free-tier tools.**
4. **Add competitor-inspired features that fit the platform architecture and do not require paid AI APIs.**

### Main diagnosis

The join problem was caused primarily by a **workflow/UI-state mismatch**, not just a raw WebRTC failure:

- The **waiting room was effectively defaulting to ON**.
- The teacher UI did **not clearly show the current waiting-room state** before students started joining.
- Students could successfully reach the teacher, but then remain in the **lobby/waiting room** until manually admitted.
- On the student side, the app moved into the stage too early (on data-channel open instead of confirmed admission/welcome), which could make the flow feel inconsistent.
- Many student failures in the field are also caused by **in-app browsers** (WhatsApp/Facebook/Instagram/TikTok webviews), so a diagnostics layer was added.

### Result

This release hardens the platform into a more reliable classroom SaaS-style product while preserving the current UI structure.

---

## 2) Root-cause diagnosis of the lobby/join issue

### Root cause A — waiting room default and unclear state

Before this fix:

- `waitroom` could behave as if it was enabled by default.
- The **Students drawer button state** did not clearly reflect whether the waiting room was on.
- A teacher could go live, share the link, and then wonder why students were “stuck in the lobby”.

### Root cause B — student stage entered too early

Before this fix:

- `join.js` called `enterStage()` immediately after the data connection opened.
- That happened **before** the student was truly welcomed/admitted.
- This made the waiting-room flow less deterministic and harder to troubleshoot.

### Root cause C — poor field diagnostics on student devices

Common real-world blockers include:

- opening the join link inside a **WhatsApp/Instagram/Facebook/TikTok in-app browser**;
- non-HTTPS pages;
- browser WebRTC support limitations.

The old join page did not surface enough diagnostics to the student.

---

## 3) Code fixes implemented

### 3.1 Waiting room / lobby fixes

#### Fixed
- Waiting room now defaults to **OFF unless the teacher explicitly enables it**.
- Added a stored preference marker: `waitroom_pref_set`.
- Added `syncWaitingRoomUI()` so the UI always reflects the real waiting-room state.
- Added `refreshPendingBadge()` to show a live **waiting-student badge** in the top bar.
- Invite modal now explicitly states whether:
  - students will **join directly**, or
  - students will be **held for admission**.
- When a student enters the waiting room, the **Students drawer auto-opens** and the teacher sees a clearer toast message.

#### Outcome
A teacher can no longer accidentally leave the class in hidden-lobby mode without seeing it.

---

### 3.2 Student join-flow stabilization

#### Fixed
- The student no longer enters the stage immediately on raw connection open.
- Stage entry now happens on:
  - `welcome`, or
  - `admitted`, or
  - first incoming `stage` media as a fallback.
- `cleanupAndGate()` now resets stage state more completely.

#### Outcome
Admission flow is cleaner, less race-prone, and easier to understand.

---

### 3.3 Student diagnostics / preflight

#### Added
A **device diagnostics panel** on `join.html` that checks and explains:

- HTTPS vs non-HTTPS access;
- WebRTC support;
- whether the classroom engine loaded;
- browser name;
- likely in-app browser/webview usage;
- online/offline status.

#### Outcome
Students now get actionable advice such as:

- “Open this link in Chrome, Edge or Safari”;
- “This browser does not support WebRTC classrooms”;
- “Use the deployed HTTPS site”.

This reduces support friction dramatically.

---

### 3.4 Live captions fix

#### Fixed bug
The student-side app defined `showCaption()` but never routed incoming `caption` events to it.

#### Outcome
Teacher live captions now actually appear on the student device as intended.

---

### 3.5 Secure invite hardening

#### Fixed
- Secure invite tokens are now **rotated per live session**.
- Old secure invite links become less reusable across later sessions.

#### Outcome
Better classroom access control without adding a paid backend.

---

### 3.6 WebRTC / connection hardening

#### Improved
- Expanded ICE server configuration with extra STUN/TURN variants.
- Added JSON serialization for the student connection.
- Added better connection-error handling.
- Student `leave()` now closes camera, mic and screen-sharing streams more aggressively.
- Teacher `end()` now also closes **pending waiting-room connections**, not only admitted students.

#### Outcome
Cleaner class shutdowns and better reliability on restrictive networks.

---

### 3.7 Licensing / security compatibility hardening

#### Improved
- Added timeout helper for environments without `AbortSignal.timeout`.
- Added network timeout handling to gateway verification.
- Added production warning when the default offline auth secret is still being used without a gateway.

#### Outcome
Fewer silent hangs and better deployment hygiene.

---

## 4) New competitor-inspired features added in this release

These were selected because they are practical, free-tier compatible, and fit the existing architecture.

### 4.1 Collaborate Board (Nearpod-style)

Added as a new activity type:

- `🧱 Collaborate board — sticky-note wall for ideas / examples / questions`

#### What it does
- Teacher launches a prompt.
- Students submit short responses like digital sticky notes.
- Teacher sees them appear in a note-wall style layout.
- When the teacher ends and shares results, students see the note wall too.

#### Good uses
- brainstorming;
- “Give one example…”;
- “Post one question you still have”;
- vocabulary activation;
- revision warm-up.

#### Why it matters
This fills a real feature gap versus interactive lesson platforms without changing the UI structure.

---

## 5) Security and SaaS audit summary

### What is already good in the platform
- no paid AI dependency;
- local-first content handling;
- bundled vendor files (better classroom resilience);
- optional license gateway path;
- security headers file present;
- classroom pin, room lock, secure invite, waiting room, audit export;
- forensic watermarking;
- PWA support and offline shell.

### Remaining architecture truths
Because the core app is intentionally free-tier and mostly static:

- **perfect anti-piracy is impossible** without a real backend;
- very large classes are limited by teacher upload bandwidth because the architecture is still teacher-hub WebRTC;
- social live to RTMP platforms still realistically needs the included relay or external browser studio/OBS-style workflow.

### Recommended production security posture
Use these together:

1. Deploy the app over **HTTPS only**.
2. Turn on **secure invite links**.
3. Use a **Class PIN** for important classes.
4. Use **waiting room** only when deliberately needed.
5. Enable **forensic watermark**.
6. Deploy the **Cloudflare Worker license gateway** on free tier.
7. Change the placeholder secret in `js/auth.js` if you still use local fallback logic.

---

## 6) Files touched in this hardening release

### Core logic
- `js/teach.js`
- `js/join.js`
- `js/rtc.js`
- `js/auth.js`

### UI / markup
- `teach.html`
- `join.html`

### Release metadata
- `version.json`
- `sw.js`

---

## 7) Manual test checklist after deployment

### Teacher-side
- Open `teach.html`
- Confirm waiting-room button visibly shows **ON** or **OFF**
- Go live
- Open Invite modal and confirm it states the correct join mode
- If waiting room is ON, verify pending badge appears when a student arrives
- Admit a student and confirm they leave the lobby immediately

### Student-side
- Open `join.html?room=...`
- Confirm diagnostics box renders
- Confirm captions show when teacher starts live captions
- Test from:
  - Chrome on Android
  - Edge on Android
  - Safari on iPhone
  - laptop Chrome/Edge
- Also test from a WhatsApp link and verify the diagnostics tell the student to open in a real browser if needed

### Security-side
- Turn on secure invites and verify:
  - plain room link fails without token;
  - secure invite link works;
  - a new live session rotates the token.

### Shutdown / cleanup
- End class while a student is in the waiting room
- Confirm the waiting student is released cleanly instead of hanging forever

---

## 8) Suggested next free-tier roadmap (post-release)

If you want to keep improving the product without paid AI APIs, the next best additions are:

1. **Pin-on-image activity** (Mentimeter / Pear Deck style)
2. **Moderated student Q&A with upvoting**
3. **Teacher templates library for common lesson starters / exit tickets**
4. **Parent-share message builder** (attendance + quiz + behaviour summary into WhatsApp-ready text)
5. **Optional self-hosted PeerJS broker fallback** on free Render/Railway if you outgrow the public broker

---

## 9) Final conclusion

This release fixes the biggest real-world classroom issue you reported:

> students getting stuck in the lobby because the waiting-room state was too easy to miss.

It also improves compatibility, security, connection cleanup, and feature competitiveness while staying aligned with your constraints:

- no paid AI API;
- free-tier tools;
- no layout redesign;
- keep existing features and enhance them.
