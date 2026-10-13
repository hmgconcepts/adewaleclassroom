# R23 — The two field reports, fixed at the root (build 29)

**Date:** 2026-10-12 · **Build:** 29 (`version.json`), assets `?v=66`,
service worker `hmg-classdeck-v15.1.0-r22-platform-5`

## The field reports

After build 28 the teacher reported, on an OLD recording:

1. The repair tool worked, the file played and seeked — but clicking
   **"🎬 Also make a universal MP4"** failed with:
   *"The MP4 conversion failed: Could not read this recording as
   WebM/Matroska. The repaired WEBM file is safe and already saved — it
   plays in VLC and Chrome."*
2. Playing the repaired video from any timestamp works, the tutor's audio
   is audible — **but the video shows only a blank coloured screen.**

## How the diagnosis was actually made (no guessing)

Synthetic fixtures could never have found either bug — they were built
from ffmpeg's WebM muxer, which writes tidy finite-size elements. So the
reproduction used the **real thing**: headless Debian Chromium 154
(`--use-fake-device-for-media-stream`) recording an animated canvas plus
an oscillator — four variants: clean, SIGKILLed mid-recording ("crashed"),
draw-loop frozen after 1 s ("frozen" — exactly a backgrounded tab), and
audio-track-first. Every finding below was confirmed against those real
recordings, with **ffprobe/ffmpeg as the independent judge**.

## Root causes found (six)

| # | Cause | Effect |
|---|-------|--------|
| 1 | `extract()` could ONLY walk a Segment of **unknown** size — but `repair()` itself writes a **finite** Segment size | `extract()` rejected every repaired file it was handed → report 1's exact error |
| 2 | The EBML walker descended **into** unknown-size clusters instead of bounding them at the next segment-level element | `repair()` returned **NULL on every current-Chromium recording** — real Chromium writes unknown-size Segment AND clusters (both confirmed in the hex of all four recordings) |
| 3 | No **lacing** parser; `BlockGroup` (0xA0→0xA1) blocks skipped; tracks assumed ordered | Audio packets miscounted (Chrome packs many Opus packets per laced block; its video frames sit in BlockGroups), wrong track attribution |
| 4 | Cue points were gated on the Matroska **keyframe flag** — but **Chromium does not set it** on video blocks (verified: the t=0 keyframe carries flags 0x00 while its payload is a true VP9 keyframe `82 49 83 42`) | Cues pointed at DELTA frames → seeks near the tail decoded mid-GOP ("Not all references are available") |
| 5 | The recorder drew its canvas from `requestAnimationFrame` — which **stops firing when the tab is backgrounded/occluded** | The video track froze (blank colour = the canvas's background) while the microphone kept working → report 2. Reproduced: the "frozen" recording has 30 video frames against 5.2 s of continuous audio |
| 6 | The MP4-first candidate list included `avc1,opus` and bare `video/mp4` | On devices without AAC (verified on Debian Chromium 154: `avc1,opus` reports supported, AAC does not) recordings silently became Opus-in-MP4 — the half-universal format Windows' built-in players reject |

Two further defects were caught by the judge during the fix itself:
patching cluster sizes with the **element** length instead of the
**content** length (every cluster swallowed the next one's header), and
muxing MP4 durations from the encoder's default 33.3 ms instead of the
**real timestamp deltas** (a variable-frame-rate recording — exactly what
the watchdog produces — would have been compressed to a fraction of its
length).

## The fixes

**`js/webm-cues.js` → r22-repair-6**
- The walker bounds unknown-size children at the next SEGMENT-LEVEL
  element (`resolveUnknownChildEnd`) — real-Chromium files repair again.
- `extract()` reads finite AND unknown Segments, descends BlockGroups,
  splits Xiph/fixed/EBML lacing (Opus 20 ms packet cadence), identifies
  tracks by TrackType/CodecID (never order), and **throws descriptive
  errors** the conversion button surfaces verbatim — the anonymous
  "Could not read…" dead-end is gone.
- **Keyframes are detected from the VP8/VP9 bitstream** (VP9: marker +
  profile + `frame_type` + sync `49 83 42`; VP8: key bit + `9D 01 2A`)
  when the container flag is absent. Cue points are the TRUE keyframes at
  their own pts; the repaired file's clusters get their real finite size
  written into their own 8-byte size fields (no unknown-size child inside
  a finite parent — ffmpeg flagged that inconsistency and it broke tail
  seeks). The span starts at the FIRST cluster (opening keyframes are
  never dropped).
- Verified against the judge on all four real recordings: frame counts,
  **laced audio packet counts**, and keyframe positions match ffprobe
  EXACTLY; 8-point seek batteries pass clean.

**`js/mp4-kit.js` → r22-universal-mp4-2**
- Demux errors pass through with the real reason; a video track with no
  frames gets the honest explanation (see the diagnostics below).
- The first TRUE keyframe is decoded before anything else — decodability
  proof + the file's REAL dimensions for the encoder (the old build
  hardcoded 1280×720). Leading deltas (crash-recovered files) are skipped
  with a note.
- MP4 sample durations come from the real timestamp deltas
  (variable-frame-rate safe).
- New exports: `analyzeWebm()` (per-track frames/keyframes/spans +
  verdict incl. the background-tab freeze detection: audio outliving
  video by > 2 s or a > 3 s frame gap) and `firstFramePreview()` (the
  recording's first decoded frame as a JPEG + a flat-colour test).

**`js/teach.js`**
- **The blank-video fix for NEW recordings:** a watchdog keeps drawing
  the recording canvas whenever rAF starves (> 500 ms), so a backgrounded
  tab records a slow-but-alive picture instead of a permanent blank.
  Started/stopped on every recorder path (start, onstop, catch,
  stopRecording). Verified live in Chromium: with rAF frozen, the video
  track keeps producing frames for the whole recording.
- MP4 candidates are now strictly H.264+AAC (`avc1.42E01E,mp4a.40.2`,
  `avc1,mp4a.40.2`) then WebM — no more half-universal recordings.
- The repair panel now shows **honest per-track diagnostics** (video
  frames/keyframes, audio packets) and **the first decoded frame as a
  picture** — if the recording itself froze (backgrounded tab), the
  teacher SEES that ("video stops at 0:25 while the audio runs 48:12 —
  recorded with the tab in the background; no repair can re-create
  picture that was never captured"), instead of wondering whether the
  repair broke it. The 🎬 conversion result shows the same honesty
  (`videoNote`).

## Proof (all against REAL Chromium 154 recordings)

- `test_r22_realchrome.js` (48 checks, new): the committed fixtures in
  `classdeck-qa/fixtures/` are real Chromium output; frame counts,
  laced-packet counts and keyframe positions are compared against
  ffprobe; repaired files decode/seek cleanly; lacing, BlockGroup,
  audio-first and finite-Segment parsing are pinned deterministically.
- In-browser end-to-end (puppeteer + the real files): in-page
  `repairAsync` → `extract` → **150/150 WebCodecs video decodes** →
  first-frame preview → `transcodeToMp4` produced a real H.264 MP4 that
  ffprobe validates (streams, dimensions, duration, seeks, real motion
  content). The watchdog was exercised live with rAF frozen.
- Battery: **34 suites × 1837 checks × both repos × run twice — 0
  failures** (webm 47, platform 208, mp4-kit 33, realchrome 48).

## What this means for the teacher

- **New recordings:** MP4 (H.264+AAC) wherever the browser truly supports
  it; WebM otherwise — and that WebM now repairs/converts correctly. The
  picture no longer freezes when the ClassDeck tab is in the background.
- **Old recordings:** repair fixes seeking and duration for real; the
  conversion button converts real-Chromium files (this exact combination
  failed before); and if a recording's video was blank from the start,
  the tool says so plainly and shows the frame it does have.
