/* ============================================================
   ADEWALE CLASSROOM DECK — Service Worker v11.1.1
   Cache-first for the app shell so the studio opens instantly
   and works offline (live class still needs internet, but the
   whiteboard/PDF/notes work fully offline).
   
   NEW: Forces PWA install by returning index.html for navigation
   requests, making the site feel native on repeat visits.
   Bump CACHE_VERSION whenever you deploy changes.
   ============================================================ */
const CACHE_VERSION = "hmg-classdeck-v15.1.0-r22-platform-9";  /* bumped: r27 — FIELD-BUG ROUND (all three verified by clicking in real Chromium): the ANNOTATE button was never wired (r25 shipped toggleBroadcastAnnot but no click handler — the A shortcut clicked a dead button) and the overlay could not draw inside pointer-events:none hosts (the Whiteboard now opts its transparent canvas back in) — annotate now works over ANY workspace content (whiteboard, PDF, slides) straight into the broadcast + recording; the [data-close] delegation in common.js fixes the dead "Done" (Audio) and "Cancel" (Share) buttons on every modal, both decks; the share chooser offers an explicit ONE APP WINDOW option (any open app, file, or folder window) with windowAudio "window" (that app's own sound only, Chrome 141+, echo-safe); Meet-parity DEVICE PICKERS (mic + speakers on the teacher Audio panel with live switching, mic in the join green room, speakers in the student volume popup — setSinkId); a green-room CONNECTION CHECK (active STUN probe + permission state + honest advice). */  /* bumped: r26 — RECEIVE-SIDE AUTO-LEVEL (the robustness half of the sound fix): every incoming voice now runs through a levelling chain on arrival (95Hz highpass -> compressor -50dB/4:1 + knee 10 -> +10dB makeup -> -3dB limiter) on BOTH decks, so the class is loud & clear even when only ONE side has the new build (old app, cached client, far-from-mic laptop); per-student volume is REMEMBERED per student name; mic doctor auto-calibration (3-second raw measurement -> the right boost preset) on the teacher audio panel and in the join green room; Alt+Up/Down hearing volume on both decks. E2E-verified over a real WebRTC connection. */  /* bumped: r25 — STUDIO SOUND: every mic (teacher AND students) runs through a verified Web Audio chain (85Hz highpass -> compressor -28dB/4:1 -> makeup gain 1.6x/2.2x/2.8x -> -3dB limiter) before the PeerConnection, fixing the "not loudly audible BOTH directions" field report at the root; master hearing volume 0-200% + per-student volume (Zoom parity) + live mic level bar + speaker/mic tests; SCREEN SHARE 2.0: tab-first picker (displaySurface browser + selfBrowserSurface exclude + surfaceSwitching include — verified MDN/W3C/Chrome), tab/system audio mixed under the voice via updateStageAudio replaceTrack, pause share, sharp/motion quality presets, honest what-am-I-sharing toast; JOIN ROBUSTNESS: Meet-style green room preflight (mic meter + speaker chime), student-side connection bars (tping/tpong RTT), signalling-layer auto-reconnect (peer.reconnect same id), online/visibility instant rejoin; PARITY: video spotlight (student camera big on the broadcast), annotate-over-broadcast (transparent whiteboard stamped into the composite+recording), Zoom focus mode, push-to-talk (hold SPACE), mirror self-view, portrait touch-up, keyboard shortcuts (with the v3.6 board-shortcut conflict resolved and that handler hardened against non-element targets) */  /* bumped: r24 — EXAM REPLICA PROMPT PACKS (verified structures, no guessing: IGCSE component tables, digital SAT modules/domains/SPR, Enhanced ACT 2025 counts, JAMB 60+40x3/180/2h CBT, WAEC papers 1/2/3 with the English 80-item/450-word anatomy, NECO NERDC + 2026 CBT transition, NCEE two-paper/four-part architecture, Olympiad school/bridge/elite formats) + essay-master and grand-mix question packs with full rubrics + the dangling differentiated pack implemented; CLASSDECK: teacher pointer + laser VISIBLE in composite broadcasts (the cursor field report), real PDF annotation kit (pen/highlighter/arrow/text/eraser/undo/colours, per-page, broadcast+recorded), engagement kit (random picker wheel, dice, confetti) drawn into the live composite, duplicate btnMuteAll button split into btnRevokeAll (the revoke button was dead — both ids shared one handler); deep audit swept every page of both repos (ids/scripts/links/handlers) */  /* bumped: r23 field-report round — BOTH field bugs fixed at the root: (1) "The MP4 conversion failed: Could not read this recording as WebM/Matroska" — webm-cues.js r22-repair-6 reads real-Chromium files (unknown-size Segment AND clusters, BlockGroups, laced Opus, unflagged VP9 keyframes detected from the bitstream; the old parser returned null on EVERY modern-Chromium recording and rejected every repaired file); extract() throws descriptive reasons that the 🎬 conversion surfaces verbatim; (2) "blank coloured screen but I can hear the tutor" — the recorder keeps drawing when the tab is backgrounded (rAF-starvation watchdog), and the repair tool SHOWS the truth (per-track diagnostics + the first decoded frame) because a backgrounded-tab recording has no video after the freeze point — no repair can re-create picture that was never captured; MP4 candidates restricted to true H.264+AAC (avc1,opus silently produced Opus-in-MP4 that Windows rejects); mp4-kit r22-universal-mp4-2: real-dimension first-frame probe, real timestamp-delta durations, honest analysis exports */  /* bumped: r22 — the complete WebM seek repair (Duration + SeekHead + Cues + finite Segment, self-contained in webm-cues.js) with a Settings tool that rescues OLD recordings; CueTime is now the KEYFRAME's own pts (cluster TC made ffmpeg skip the keyframe and decode mid-GOP — the laptop timestamp-click bug); the repair TOOL now shows a real progress report and always ends with a NEW REPAIRED-<date-time>.webm file plus a direct Save button (silent-download killers fixed: object URL held 60s, anchor attached, multi-download block explained); UNIVERSAL MP4: new recordings are MP4/H.264+AAC where the browser supports it (finished with real durations for every player - Windows players never open WebM, error 0xc00d3e8c), and the repair tool can convert old WebM recordings to universal MP4 via hardware-accelerated WebCodecs (js/mp4-kit.js); platform features: breakout rooms (auto/manual, moves, broadcasts, ask-for-help, 60s-close, TIMER with auto-close, ROOM-SCOPED CHAT, rooms-from-poll), Q&A, chat modes (everyone/teacher-only/off), allow-self-unmute gate, rename student, enter/exit chime, chat .txt export, reactions + nonverbal feedback, the teacher-controlled class gallery, teacher-permitted student-to-student DMs, suspend-activities, audio processing settings; Co-Tutor gets the same powers; privileged roster carries real peerIds */   /* bumped: V55 round 20 — the cloud sync boots on EVERY teacher-facing deck page (js/cloud-sync-boot.js: pull + visible self-heal + not-linked hint), a service-worker update banner ends the first-open-after-redeploy handover gap, diagnose gains the local-device inventory step, and relay-only devices count as holding credentials */  /* bumped: V53 round 17 — credential writes go through the tc_set_user_setting RPC (the REST upsert class of silent failures is gone), sync card re-renders on push, honest not-linked warning on save */  /* bumped: V52 round 16 — cloud credential sync truth: push resolves uid BEFORE upload (the silent NULL-user 403 that left "nothing saved yet" on other devices), shape-based channel restore, real two-way Sync now, last-sync stamps on push */  /* bumped: v14.1 MicDoctor (laptop mic failures: constraint ladder, silence watchdog, recovery banner), CBT console + Archive Recovery Center on Quizzes, role-aware Homework page, V46 assignment automation */  /* bumped: v14 adds assistant tutors (co-hosts), mute-all/lower-hands/attendance CSV, scrollable zoomable whiteboard pages and PDF anchored zoom with visible scrollbars */

const SHELL = [
  "./",
  "./index.html",
  "./teach.html",
  "./admin.html",
  "./join.html",
  "./stream.html",
  "./cbt.html",
  "./classroom.html",
  "./community.html",
  "./parent.html",
  "./generate.html",
  "./404.html",
  "./css/style.css",
  "./js/common.js",
  "./js/whiteboard.js",
  "./js/webcast.js",
  "./js/rtc.js",
  "./js/teach.js",
  "./js/toolkit.js",
  "./js/toolkit-data.js",
  "./js/toolkit-data2.js",
  "./js/toolkit-data3.js",
  "./js/toolkit-ext.js",
  "./js/security-config.js",
  "./js/auth.js",
  "./js/cloud-creds.js",
  "./js/cloud-sync-boot.js",
  "./js/webm-cues.js",
  "./js/join.js",
  "./js/portal-bridge.js",
  "./js/enhancements.js",
  "./js/generator.js",
  "./js/config.js",
  "./js/license.js",
  "./js/ecosystem-branding.js",
  "./js/enterprise-enhanced.js",
  "./vendor/peerjs.min.js",
  "./vendor/pdf.min.js",
  "./vendor/pdf.worker.min.js",
  "./vendor/qrcode.min.js",
  "./assets/icon-96.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/apple-touch-icon.png",
  "./assets/hmg-academy-logo.png",
  "./assets/founder-photo.jpg",
  "./assets/icon-master.png",
  "./manifest.json",
  "./manifest.webmanifest",
  "./version.json",
  "./robots.txt",
  "./sitemap.xml"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(async (c) => {
      /* addAll is atomic — one missing optional entry (e.g. generate.html
         inside a generated client deck that ships without the generator at
         root) would otherwise fail the whole install. Use allSettled so the
         available shell assets are still cached and the SW activates. */
      const results = await Promise.allSettled(SHELL.map((url) => c.add(url)));
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed) console.warn("[SW] Skipped", failed, "optional precache resource(s)");
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Never intercept WebRTC signalling, relay calls, or cross-origin calls.
  if (url.origin !== location.origin) return;
  if (e.request.method !== "GET") return;

  /* v15 (round 18) — NETWORK-FIRST FOR PAGES. The old handler was
     stale-while-revalidate for EVERYTHING, HTML included: it served the
     CACHED page on every visit and refreshed only in the background.
     That is precisely why fixed bugs "persisted" for users — the visit
     right after a redeploy still ran the PREVIOUS build's teach.html
     (and with it the previous JS), and the fix only arrived on the
     visit after that. Documents now go to the NETWORK first and fall
     back to the cache only when offline; versioned assets (?v=NN are
     immutable by construction) stay cache-first. The old handler also
     fetched every served-from-cache resource TWICE (once for
     fetchPromise, once inside the cached branch) — fixed. */
  const isPage = e.request.mode === "navigate" ||
    (e.request.destination || "") === "document" ||
    (/\.html?$/.test(url.pathname) && url.search.indexOf("v=") === -1);

  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);

      if (isPage) {
        try {
          /* v15.0.3: bypass the HTTP cache for pages — network-first must
             mean the NETWORK, not a stale intermediate copy. */
          const res = await fetch(e.request, { cache: "no-cache" });
          if (res && res.ok) cache.put(e.request, res.clone());
          return res;
        } catch (err) {
          /* offline (or the server is down): the cached page still opens */
          const same = await cache.match(e.request) || await cache.match(url.pathname);
          const fallback = same || await cache.match("./index.html");
          if (fallback) return fallback;
          return Response.error();
        }
      }

      /* v10: exact match — a new ?v= query is a cache MISS, so updated JS
         reaches students on their very next load. (ignoreSearch served the
         stale precached copy forever and defeated every version bump.) */
      const cached = await cache.match(e.request) || (url.search === "" ? await cache.match(url.pathname) : null);

      // Stale-while-revalidate (assets only): serve cached instantly, refresh once in background
      if (cached) {
        fetch(e.request).then(res => {
          if (res && res.ok) cache.put(e.request, res);
        }).catch(() => {});
        return cached;
      }

      try {
        const res = await fetch(e.request);
        if (res && res.ok) cache.put(e.request, res.clone());
        return res;
      } catch (err) {
        return Response.error();
      }
    })()
  );
});