# Round 22 — DEPLOY & VERIFY (read this before checking the live site)

**Date: 2026-10-12. Verdict of the live-site audit: the live site is still
running the OLD build (27, the round-21 release). None of the round-22 work
is deployed yet — that is why you do not see the fixes.**

Everything below is verified, committed and tested in this repository
(build 28). The one remaining step — uploading it to your GitHub/Vercel —
can only be done by you (the workspace has no push access to your GitHub).

---

## 1. What the live site runs RIGHT NOW (evidence, fetched 2026-10-12)

| Check | Live site (adewaleclassroom.vercel.app) | This repo (ready to deploy) |
|---|---|---|
| `classdeck/version.json` | **build 27**, released 2026-10-11, feature list ends at the r21 tags | **build 28**, released 2026-10-12, **112 tags** incl. all r22 tags |
| `classdeck/js/webm-cues.js` | The **r21 shim**: appends Cues at end-of-file, **no SeekHead**, and **CueTime = the cluster Timecode** — the exact defect that makes laptop players crash on timestamp clicks | **r22-repair-3 complete remuxer**: Duration + SeekHead + keyframe-gated Cues + finite Segment, **CueTime = the keyframe's own pts** (the root cause, fixed) |
| Breakout rooms, Q&A, chat modes, rename, timer, room chat, poll→rooms, self-unmute gate, chime, chat export | **Absent** (no tags, no code) | Implemented + tested (see FEATURES.md section M) |
| Class gallery / student DM permissions / reactions / suspend | Absent | Implemented in r22 main |

The live `webm-cues.js` header literally says "r21 (round 21, item 3)". The
seek bug you keep hitting on your laptop is that file's behaviour:
CueTime one millisecond above the keyframe's presentation timestamp makes
ffmpeg-family players (VLC, Windows Media Player, Chrome) SKIP the keyframe
and try to decode mid-GOP frames — the video stops/errors on seek.

## 2. Deploy (your Vercel flow, ~5 minutes)

The 22 files changed since your deployed build are listed in §5. Two ways:

**A. Replace everything (safest):** download `adewaleclassroom_patched.zip`
from the workspace, unzip, and upload/replace the whole `classdeck/` folder
(+ root files) into your GitHub repository (**Add file → Upload files**,
drag in, **Commit**). Vercel redeploys automatically in ~40 seconds.

**B. Replace just the changed files:** the 22 files in §5.

After the commit, watch the Vercel dashboard until the deployment turns
**Ready**.

## 3. Verify the deploy (2 minutes, do these in order)

1. **`https://adewaleclassroom.vercel.app/classdeck/version.json`** — must
   show `"build": 28`, `"released": "2026-10-12"`, and tags including
   `15.1.0-webm-cuetime-keyframe-pts`, `15.1.0-breakout-rooms`,
   `15.1.0-qa-questions-answers`, `15.1.0-chat-modes` …
2. **`https://adewaleclassroom.vercel.app/classdeck/js/webm-cues.js`** —
   the header must say **r22-repair-3** (not r21).
3. **Open the teacher console and HARD-REFRESH first** (Ctrl+Shift+R). The
   service worker also shows an "update available — Reload" banner on the
   first visit after a deploy; accept it. (Skipping this can show you the
   CACHED old UI and make a good deploy look failed.)
4. UI checks in the teacher console:
   - Toolbar: **🙋 Q&A** button next to 📊 Poll.
   - Students drawer: **🎙 Allow self-unmute** and **🔔 Chime** buttons.
   - Chat drawer: **chat-mode dropdown** (Everyone / Teacher-only / No one)
     and **💾 Save chat**.
   - Roster row: **✏️ rename** button; **💬 DM permissions**; **👁 gallery**.
   - Breakout modal: **📊 Rooms from last poll** and **⏱ Room timer**.
5. Student side (join a room from another device/window): the chat drawer
   has **🙋 Ask the teacher a question**; inside a breakout room the room
   bar has the **room chat input** and the **⏱ countdown** when a timer runs.

## 4. The seek fix — how to confirm it on your laptop

- **NEW recordings** (made after deploying build 28): the repair runs
  automatically the moment you stop recording. Download one, open it in
  VLC/Windows Media Player, and click timestamps at 10s, 1min, mid-video —
  it must jump cleanly. (Verified here with ffmpeg 7.1.5 on real
  MediaRecorder-style files: 22/22 seek points clean, bit-identical decode.)
- **OLD recordings** (saved with build 27 or earlier): they were written by
  the old pipeline and stay broken **as files** — repair them once with the
  built-in tool: teacher console → **⚙ Settings → "🛠 Repair a recording
  (fixes 'click a timestamp and it stops' in VLC / Windows Media Player)"**
  → choose the file → the seekable copy downloads. Real MP4s are detected
  and left alone, with an explanation.

## 5. The 22 files changed since the deployed build 27

```
PROMPT_AUDIT.md
classdeck/404.html            classdeck/js/enhancements.js
classdeck/admin.html          classdeck/js/fix-webm-duration.js
classdeck/cbt.html            classdeck/js/join.js
classdeck/classroom.html      classdeck/js/rtc.js
classdeck/community.html      classdeck/js/teach.js
classdeck/css/style.css       classdeck/js/webm-cues.js
classdeck/docs/FEATURES.md    classdeck/parent.html
classdeck/generate.html       classdeck/stream.html
classdeck/index.html          classdeck/sw.js
classdeck/join.html           classdeck/teach.html
classdeck/version.json
```

(The HTML pages change only because every asset reference moved to
`?v=63` so no browser serves you a stale cached script after the deploy.)

## 6. Quality record (what stands behind build 28)

32 test suites × 1699 checks × both repositories × 2 runs — 0 failures
(with live PostgreSQL). The seek repair was validated by an independent
third party (ffprobe/ffmpeg 7.1.5): correct duration, bit-identical
sequential decode, and a clean seek at every keyframe interval. Two real
engine bugs were found and fixed beyond the feature work: the CueTime
root cause above, and an unterminated comment in `rtc.js` that had
silently disabled eight student-side message handlers (mic permission,
kick/reject/admission notices) since the first r22 commit.
