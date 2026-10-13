/* =====================================================================
   webm-cues.js — ADEWALE CLASSROOM DECK · r22 (round 22, item 1)
   =====================================================================
   THE BUG THIS FILE FIXES (and why the r21 attempt was not enough):

   MediaRecorder writes Matroska WebM the way a LIVE stream is written:
     · the Segment size is UNKNOWN (0x01FFFFFFFFFFFFFF),
     · there is no Duration in Info (it cannot know yet),
     · there is no Cues seek index,
     · and therefore no SeekHead either.
   Symptom in the field: "I clicked on different timestamps in VLC and
   the video stopped or crashed." A player that is told nothing about
   duration treats the file as a live stream — its seek bar is fiction,
   and every seek lands in unmuxed territory. The r21 repair appended a
   Cues element and made the Segment size finite, but left Duration
   empty (the bundled duration tool can silently no-op) and wrote no
   SeekHead — so players still had no reliable path to the index.

   THE COMPLETE FIX (this file, zero dependencies, pure Uint8Array):
   a full metadata remux, the same four things ffmpeg's
   `-c copy -cues_to_front 1` writes, in the order players expect:
     1. Info with a real Duration (computed by scanning every cluster
        timecode AND every block timestamp inside every cluster).
     2. A SeekHead at the FRONT of the segment pointing at Info,
        Tracks and Cues (fixed 8-byte positions, so the layout is
        stable regardless of file size).
     3. All clusters byte-for-byte untouched, then a Cues element with
        one CuePoint per cluster (MediaRecorder opens clusters on
        keyframes, so every cue lands on a random-access point).
     4. A finite Segment size (also the Android ExoPlayer fix).

   Usage:
     const r = WebMCues.repair(uint8array);
       // r === null            -> unrepairable; keep the original bytes
       // r.alreadyFixed === true -> r.bytes is the input, nothing to do
       // otherwise r.bytes is the repaired file, r.durationMs the real
       //   duration, r.cuePoints the number of seek points.
     WebMCues.addCues(uint8array)  // r21 compat: returns bytes either way.

   Safe to run on already-fixed files, on garbage, on real MP4 (returns
     null — detected by the missing EBML header). Best-effort, never
     destructive: on ANY doubt the original bytes are returned untouched.

   r22-repair-6 (field-report round): real Chromium writes CLUSTERS with
   unknown size too (verified on a real Chromium 154 recording) — the walker
   now bounds them at the next segment-level element. extract() additionally
   reads finite Segment sizes (what repair() itself writes — the r22-repair-5
   build could ONLY read unknown-size Segments, so it rejected every repaired
   file it was handed: the "Could not read this recording as WebM/Matroska"
   field report), splits Xiph/fixed/EBML lacing (Chrome packs many Opus
   packets into one block), reads BlockGroups (Firefox), accepts tracks in
   any order, and throws descriptive errors instead of returning nulls.
   ===================================================================== */
"use strict";
(function () {
  /* ---- minimal EBML readers ---- */
  function readVintSize(buf, pos) {
    /* returns { value, length } for a size vint; value = -1 means unknown */
    if (pos >= buf.length) return null;
    const b0 = buf[pos];
    if (b0 === 0) return null;
    let len = 1;
    for (let mask = 0x80; mask; mask >>= 1) { if (b0 & mask) break; len++; }
    if (pos + len > buf.length) return null;
    let value = b0 & (0xFF >> len);
    let unknown = (value === (0xFF >> len));
    for (let i = 1; i < len; i++) {
      const b = buf[pos + i];
      if (b === undefined) return null;
      value = value * 256 + b;
      if (b !== 0xFF) unknown = false;
    }
    return { value: unknown ? -1 : value, length: len };
  }
  function readId(buf, pos) {
    if (pos >= buf.length) return null;
    const b0 = buf[pos];
    if (b0 === 0) return null;
    let len = 1;
    for (let mask = 0x80; mask; mask >>= 1) { if (b0 & mask) break; len++; }
    if (pos + len > buf.length) return null;
    let id = 0;
    for (let i = 0; i < len; i++) id = id * 256 + buf[pos + i];
    return { id, length: len };
  }
  function readUInt(buf, pos, len) {
    if (len <= 0 || pos + len > buf.length) return null;
    let v = 0;
    for (let i = 0; i < len; i++) v = v * 256 + buf[pos + i];
    return v;
  }
  function readFloat(buf, pos, len) {
    try {
      if (len === 4) {
        const b = buf.slice(pos, pos + 4);
        const dv = new DataView(b.buffer, b.byteOffset, 4);
        return dv.getFloat32(0, false);
      }
      if (len === 8) {
        const b = buf.slice(pos, pos + 8);
        const dv = new DataView(b.buffer, b.byteOffset, 8);
        return dv.getFloat64(0, false);
      }
    } catch (e) {}
    return null;
  }
  function vintDataLen(b0) {          /* payload length of a data vint */
    if (!b0) return 1;
    let len = 1;
    for (let mask = 0x80; mask; mask >>= 1) { if (b0 & mask) break; len++; }
    return len;
  }

  /* ---- r22-repair-6: BITSTREAM keyframe detection ----------------------
     Chromium's MediaRecorder does NOT set the Matroska keyframe flag on
     video blocks — verified on a real Chromium 154 VP9 recording: the t=0
     keyframe's block flags are 0x00 while its payload is a genuine VP9
     keyframe (and its deltas are flagged 0x00 too). ffmpeg detects
     keyframes from the bitstream, which is why the files play — but a
     repair tool that trusts only the container flag builds a seek index
     pointing at DELTA frames, and every seek past the first cluster then
     decodes mid-GOP ("Not all references are available" — verified live
     with -ss near the tail). So we read the codecs' own frame headers,
     exactly per spec:
       VP9 uncompressed header (RFC 8436 / VP9 spec): frame_marker "10",
       profile 0-2 (profile 3 inserts an extra reserved bit and is never
       produced by MediaRecorder), show_existing_frame 0, frame_type 0
       (KEY_FRAME), then the 24-bit sync code 49 83 42 — byte-aligned for
       profiles 0-2. A real Chrome keyframe starts 82 49 83 42; a delta
       starts 86 ....
       VP8 frame tag: bit0 of byte0 == 0 means keyframe, and the 3-byte
       start code 9D 01 2A sits at bytes 3-5. */
  function isVp9Keyframe(d) {
    return !!(d && d.length >= 4 &&
      (d[0] & 0xC0) === 0x80 &&            /* frame marker "10" */
      ((d[0] >> 4) & 0x03) !== 0x03 &&     /* profile 0-2 (3 shifts the header) */
      (d[0] & 0x08) === 0 &&               /* show_existing_frame == 0 */
      (d[0] & 0x04) === 0 &&               /* frame_type == 0 (KEY_FRAME) */
      d[1] === 0x49 && d[2] === 0x83 && d[3] === 0x42);   /* sync code */
  }
  function isVp8Keyframe(d) {
    return !!(d && d.length >= 6 &&
      (d[0] & 0x01) === 0 &&               /* key_frame bit: 0 = keyframe */
      d[3] === 0x9D && d[4] === 0x01 && d[5] === 0x2A);   /* start code */
  }
  function isVideoKeyframe(codec, containerFlag, data) {
    if (containerFlag) return true;        /* flag set: trust it */
    if (codec === "V_VP9") return isVp9Keyframe(data);
    if (codec === "V_VP8") return isVp8Keyframe(data);
    return false;
  }

  /* ---- element IDs ---- */
  const ID_EBML       = 0x1A45DFA3;
  const ID_SEGMENT    = 0x18538067;   /* r22 suite caught a 0x40 typo here — real Matroska is 18 53 80 67 */
  const ID_SEEKHEAD   = 0x114D9B74;
  const ID_SEEK       = 0x4DBB;
  const ID_SEEKID     = 0x53AB;
  const ID_SEEKPOS    = 0x53AC;
  const ID_INFO       = 0x1549A966;
  const ID_TSCALE     = 0x2AD7B1;
  const ID_DURATION   = 0x4489;
  const ID_TRACKS     = 0x1654AE6B;
  const ID_CLUSTER    = 0x1F43B675;
  const ID_TIMESTAMP  = 0xE7;
  const ID_SIMPLEBLOCK= 0xA3;
  const ID_BLOCK      = 0xA1;
  const ID_CUES       = 0x1C53BB6B;
  const ID_CUEPOINT   = 0xBB;
  const ID_CUETIME    = 0xB3;
  const ID_CUETRACKPOS= 0xB7;
  const ID_CUETRACK   = 0xF7;
  const ID_CUECLUSTERPOS = 0xF1;

  /* ---- writers ---- */
  function bytesOf(n) {              /* number -> big-endian byte array, minimal */
    const out = [];
    do { out.unshift(n & 0xFF); n = Math.floor(n / 256); } while (n > 0);
    return out;
  }
  function vintSizeBytes(value, len) {  /* encode a size vint of EXACT length */
    if (len < 1 || len > 8) return null;
    const max = Math.pow(2, 8 * len - 1) - 1;      /* vint reserves the marker bit */
    if (value < 0 || value > max) return null;
    const out = new Array(len).fill(0);
    let v = value;
    for (let i = len - 1; i >= 1; i--) { out[i] = v & 0xFF; v = Math.floor(v / 256); }
    out[0] = v | (0x80 >>> (len - 1));              /* marker: L-1 leading zeros then 1 */
    return out;
  }
  function el(idBytes, payload) {       /* idBytes: array; payload: Uint8Array|array */
    const size = vintSizeBytes(payload.length, minimalVintLen(payload.length));
    const head = idBytes.concat(size);
    const out = new Uint8Array(head.length + payload.length);
    out.set(head, 0);
    out.set(payload, head.length);
    return out;
  }
  function minimalVintLen(n) {
    for (let len = 1; len <= 8; len++) if (n <= Math.pow(2, 8 * len - 1) - 1) return len;
    return 8;
  }
  function uintPayload(n) { return new Uint8Array(bytesOf(n)); }
  function float64Payload(x) {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setFloat64(0, x, false);
    return b;
  }
  function concat(parts) {
    let n = 0;
    for (const p of parts) n += p.length;
    const out = new Uint8Array(n);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }

  /* ---- Tracks: map trackNumber -> isVideo (TrackType 1) ----
     Needed for the r22 keyframe rule: cues may only point at clusters
     whose FIRST VIDEO block is flagged keyframe — pointing into a
     mid-GOP cluster (some muxers split clusters on a timer regardless
     of keyframes) makes players start decode on a frame whose
     references are missing: glitchy video after a seek. */
  function parseTrackMap(buf, el) {
    const map = new Map();              /* trackNumber -> { video, codec } */
    if (!el) return map;
    let p = el.dataStart;
    let guard = 0;
    while (p < el.end - 1 && guard++ < 512) {
      const t = readId(buf, p);
      if (!t) break;
      const s = readVintSize(buf, p + t.length);
      if (!s) break;
      const dStart = p + t.length + s.length;
      if (s.value === -1) break;
      if (t.id === 0xAE) {              /* TrackEntry */
        let num = null, type = null, codec = "";
        let q = dStart;
        let g2 = 0;
        const dEnd = Math.min(dStart + s.value, el.end);
        while (q < dEnd - 1 && g2++ < 64) {
          const t2 = readId(buf, q);
          if (!t2) break;
          const s2 = readVintSize(buf, q + t2.length);
          if (!s2) break;
          const dd = q + t2.length + s2.length;
          if (s2.value === -1) break;
          if (t2.id === 0xD7 && s2.value >= 1 && s2.value <= 8) {  /* TrackNumber: PLAIN uint payload (no vint marker) — decoding it with vint logic collapses every track to number 0 */
            num = readUInt(buf, dd, s2.value);
          } else if (t2.id === 0x83 && s2.value >= 1) {  /* TrackType */
            type = readUInt(buf, dd, s2.value);
          } else if (t2.id === 0x86 && s2.value >= 1) {  /* CodecID */
            let c2 = "";
            for (let i = dd; i < Math.min(dd + s2.value, dEnd); i++) c2 += String.fromCharCode(buf[i]);
            codec = c2;
          }
          q = dd + s2.value;
        }
        if (num != null) map.set(num, { video: type === 1, codec: codec });
      }
      p = dStart + s.value;
    }
    return map;
  }

  /* ---- parse one element's block-scan: max relative block timestamp + keyframe state ---- */
  function scanClusterBlocks(buf, dataStart, dataEnd, clusterTC, trackMap) {
    /* r22-repair-6: descends into BlockGroup (0xA0) elements for the Block
       (0xA1) inside them (Firefox writes Opus that way; a bare Block directly
       under a cluster is nonstandard but tolerated).
       returns { maxEnd, firstVideoKey, firstVideoKeyRel, keyPts }:
       maxEnd = the max block END (timecode-scale units) inside the cluster;
       firstVideoKey = whether the FIRST video block is a TRUE keyframe
       (container flag OR VP8/VP9 bitstream — Chromium sets no flag);
       firstVideoKeyRel = that block's relative timecode;
       keyPts = the pts of EVERY true keyframe in this cluster.
       ffmpeg's matroska_read_seek sets skip_to_timecode = CueTime and then
       DISCARDS every block with pts < skip_to_timecode, so CueTime MUST be
       the keyframe's own pts (clusterTC + rel), never the cluster Timecode:
       one ms too high skips the keyframe itself and the VP9 decoder is fed
       mid-GOP frames ("Not all references are available"). */
    let maxEnd = clusterTC;
    let firstVideoKey = null;
    let firstVideoKeyRel = null;
    const keyPts = [];
    const noteBlock = function (bStart, bEnd) {
      if (bEnd - bStart < 3) return;
      const tl = vintDataLen(buf[bStart]);
      if (bStart + tl + 2 > bEnd) return;
      let rel = (buf[bStart + tl] << 8) | buf[bStart + tl + 1];
      if (rel & 0x8000) rel -= 0x10000;
      const end = clusterTC + rel;
      if (end > maxEnd) maxEnd = end;
      const flags = buf[bStart + tl + 2];
      let tn = buf[bStart] & (0xFF >> tl);
      for (let i = 1; i < tl; i++) tn = tn * 256 + buf[bStart + i];
      const tv = trackMap ? trackMap.get(tn) : undefined;
      const isVideo = trackMap ? (tv ? tv.video : undefined) : true;
      if (isVideo === undefined) { /* unknown track number: treat as video so the flag is honoured */ }
      if (isVideo !== false) {
        /* r22-repair-6: only a KNOWN video track contributes cue keyframes —
           audio blocks carry the keyframe bit too, and counting them put cue
           points at audio timestamps (caught by the synthetic-fixture suite).
           Unknown-track files (no readable Tracks) still fall back to the
           per-cluster cue logic below. */
        const key = isVideoKeyframe(tv ? tv.codec : "", !!(flags & 0x80), buf.subarray(bStart + tl + 3, bEnd));
        if (key && tv && tv.video) keyPts.push(clusterTC + rel);
        if (firstVideoKey === null) { firstVideoKey = key; firstVideoKeyRel = rel; }
      }
    };
    let p = dataStart;
    let guard = 0;
    while (p < dataEnd - 1 && guard++ < 500000) {
      const t = readId(buf, p);
      if (!t) break;
      const s = readVintSize(buf, p + t.length);
      if (!s) break;
      const dStart = p + t.length + s.length;
      if (s.value === -1) break;                        /* unknown-size element: stop */
      const dEnd = Math.min(dStart + s.value, dataEnd);
      if ((t.id === ID_SIMPLEBLOCK || t.id === ID_BLOCK) && s.value >= 3) {
        noteBlock(dStart, dEnd);
      } else if (t.id === 0xA0 && s.value >= 3) {     /* BlockGroup -> Block inside */
        let q = dStart;
        let g2 = 0;
        while (q < dEnd - 1 && g2++ < 4096) {
          const t2 = readId(buf, q);
          if (!t2) break;
          const s2 = readVintSize(buf, q + t2.length);
          if (!s2) break;
          const dd = q + t2.length + s2.length;
          if (s2.value === -1) break;
          const de = Math.min(dd + s2.value, dEnd);
          if (t2.id === ID_BLOCK && s2.value >= 3) noteBlock(dd, de);
          q = de;
        }
      }
      p = dStart + s.value;
    }
    return { maxEnd, firstVideoKey, firstVideoKeyRel, keyPts: keyPts };
  }
  /* ---- r22-repair-6: unknown-size segment children (real Chromium clusters) ----
     Chromium (verified on 154) writes not just the Segment but every CLUSTER
     with unknown size — a live-stream file. Such a child ends where the next
     SEGMENT-LEVEL element begins. We find that boundary by walking the
     child's own (finite) children; block payloads can never be misread as a
     boundary because every hop consumes a full element header+size. This is
     how libmatroska and ffmpeg bound these clusters. */
  const SEGMENT_LEVEL_IDS = {};
  [0x18538067, 0x1549A966, 0x1654AE6B, 0x1F43B675, 0x1C53BB6B, 0x114D9B74,
   0x1941A469, 0x1043A770, 0x1254C367].forEach(function (x) { SEGMENT_LEVEL_IDS[x] = 1; });
  function resolveUnknownChildEnd(buf, dataStart, limit) {
    let p = dataStart;
    let guard = 0;
    while (p < limit - 1 && guard++ < 5000000) {
      const t = readId(buf, p);
      if (!t) return Math.min(p, limit);
      const s = readVintSize(buf, p + t.length);
      if (!s) return Math.min(p, limit);
      if (p > dataStart && SEGMENT_LEVEL_IDS[t.id]) return p;      /* sibling boundary */
      if (s.value === -1) { p = resolveUnknownChildEnd(buf, p + t.length + s.length, limit); continue; }
      p = p + t.length + s.length + s.value;
      if (p > limit) return limit;
    }
    return Math.min(p, limit);
  }

  /* ---- the full repair ----
     r22-repair-4: the core is a GENERATOR that yields progress objects
     ({stage, frac}) at every heavy milestone. repair() runs it to completion
     synchronously (identical to every earlier build); repairAsync() runs the
     SAME core cooperatively, yielding to the UI between chunks so a real
     progress bar can paint while a multi-hundred-MB class recording is
     scanned (the sync version froze the tab with no feedback). */
  function* repairGen(buf) {
    if (!buf || !buf.length) return null;
    try {
      /* ============ pass 1: top-level walk ============ */
      let pos = 0;
      let header = null;                 /* { start, end } of the EBML header */
      let segment = null;                /* { sizeStart, sizeLen, dataStart, size } */
      const children = [];               /* segment children, in order */
      while (pos < buf.length - 1) {
        const t = readId(buf, pos);
        if (!t) break;
        const s = readVintSize(buf, pos + t.length);
        if (!s) break;
        const dataStart = pos + t.length + s.length;
        if (t.id === ID_EBML && !header && !segment) {
          const end = s.value >= 0 ? dataStart + s.value : buf.length;
          header = { start: pos, end: Math.min(end, buf.length) };
          pos = s.value === -1 ? dataStart : dataStart + s.value;
          continue;
        }
        if (t.id === ID_SEGMENT && !segment) {
          segment = { sizeStart: pos + t.length, sizeLen: s.length, dataStart, size: s.value };
          pos = dataStart;               /* ALWAYS scan inside — finite or unknown */
          continue;
        }
        if (segment) {
          if (segment.size >= 0 && dataStart > segment.dataStart + segment.size) break;  /* past the segment */
          children.push({ id: t.id, start: pos, dataStart, size: s.value, hdrLen: t.length + s.length });
          /* r22-repair-6: an unknown-size child ends at the next segment-level
             element — resolve that boundary and continue the walk there. The
             old code descended INTO the child, which pushed intra-cluster
             Timecodes/SimpleBlocks into this list as fake segment children;
             every cluster then "ended" a few bytes in, no Timecode was ever
             found, and repair() returned NULL on every current-Chromium
             recording (their bytes were fine — our walk was wrong). */
          pos = s.value === -1
            ? resolveUnknownChildEnd(buf, dataStart, segment.size >= 0 ? Math.min(segment.dataStart + segment.size, buf.length) : buf.length)
            : dataStart + s.value;
          continue;
        }
        pos = s.value === -1 ? dataStart : dataStart + s.value;
      }
      if (!segment) return null;                        /* not EBML/matroska (e.g. MP4) */
      const segDataEnd = segment.size >= 0 ? Math.min(segment.dataStart + segment.size, buf.length) : buf.length;

      /* give every child a definite end (unknown-size child ends at the
         next sibling; the last one at the segment end) */
      for (let i = 0; i < children.length; i++) {
        const c = children[i];
        c.end = c.size >= 0 ? Math.min(c.dataStart + c.size, segDataEnd)
                            : (i + 1 < children.length ? children[i + 1].start : segDataEnd);
        if (c.end > segDataEnd) c.end = segDataEnd;
        if (c.end < c.start) return null;               /* corrupt */
      }

      const info = children.find((c) => c.id === ID_INFO) || null;
      const tracks = children.find((c) => c.id === ID_TRACKS) || null;
      const oldCues = children.find((c) => c.id === ID_CUES) || null;
      const oldSeekHead = children.find((c) => c.id === ID_SEEKHEAD) || null;
      const clusters = children.filter((c) => c.id === ID_CLUSTER);
      if (!info) return null;

      yield { stage: "parse", frac: 0.05 };             /* structure walked */

      /* ============ pass 2: Info — timecode scale + existing duration ============ */
      let timecodeScale = 1000000;
      let existingDuration = null;
      const infoParts = [];               /* byte ranges of Info children (minus Duration) */
      {
        let p = info.dataStart;
        let guard = 0;
        while (p < info.end - 1 && guard++ < 4096) {
          const t = readId(buf, p);
          if (!t) break;
          const s = readVintSize(buf, p + t.length);
          if (!s) break;
          const dStart = p + t.length + s.length;
          const dEnd = s.value >= 0 ? Math.min(dStart + s.value, info.end) : info.end;
          if (t.id === ID_TSCALE) {
            const v = readUInt(buf, dStart, s.value);
            if (v > 0) timecodeScale = v;
          } else if (t.id === ID_DURATION) {
            const v = readFloat(buf, dStart, s.value);
            if (v != null && v > 0) existingDuration = v;
            /* dropped — re-added below with the real value */
          } else {
            infoParts.push(buf.slice(p, dEnd));
          }
          if (s.value === -1) break;
          p = dStart + s.value;
        }
      }

      /* ============ pass 3: clusters — timecodes, block ends, cue points ============
         Duration comes from ALL clusters. CUE POINTS are keyframe-gated:
         only clusters whose first video block is a keyframe become seek
         targets (Matroska spec guidance; a cue into a mid-GOP cluster
         makes players decode from a frame with missing references). */
      const trackMap = parseTrackMap(buf, tracks);
      const hasVideoTracks = trackMap.size === 0 || Array.from(trackMap.values()).some((v) => v && v.video);
      let maxEndUnits = 0;
      let lastTC = 0;
      const allClusters = [];
      let _seen = 0;
      for (const c of clusters) {
        if ((++_seen & 63) === 0)                       /* every 64 clusters: report + breathe */
          yield { stage: "scan", frac: 0.05 + 0.85 * Math.min(1, c.start / buf.length) };
        let tc = null;
        {
          let p = c.dataStart;
          let guard = 0;
          while (p < c.end - 1 && guard++ < 64) {
            const t = readId(buf, p);
            if (!t) break;
            const s = readVintSize(buf, p + t.length);
            if (!s) break;
            if (t.id === ID_TIMESTAMP) {
              tc = readUInt(buf, p + t.length + s.length, s.value);
              break;
            }
            if (s.value === -1) break;
            p += t.length + s.length + s.value;
          }
        }
        if (tc === null) continue;                      /* not a real cluster */
        lastTC = Math.max(lastTC, tc);
        const scan = scanClusterBlocks(buf, c.dataStart, c.end, tc, trackMap);
        maxEndUnits = Math.max(maxEndUnits, scan.maxEnd);
        allClusters.push({ tc, start: c.start, firstVideoKey: scan.firstVideoKey,
                            keyTC: scan.firstVideoKeyRel != null ? Math.max(0, tc + scan.firstVideoKeyRel) : null,
                            keyPts: scan.keyPts });
      }
      /* r22-repair-6: CUE POINTS ARE THE TRUE KEYFRAMES — one cue per
         keyframe, at the keyframe's own pts, positioned at its cluster.
         Chromium does not set the container keyframe flag (see
         isVideoKeyframe above), so the old flag-only gating built cues
         pointing at delta frames and seeks decoded mid-GOP. Keyframes are
         detected from the VP8/VP9 bitstream when the flag is absent.
         A seek between cues lands on the earlier keyframe and decodes
         forward — the one behavior every player implements correctly. */
      let cueList = [];
      for (const c of allClusters) {
        if (c.keyPts && c.keyPts.length) {
          for (const pts of c.keyPts) cueList.push({ keyTC: pts, start: c.start, tc: c.tc });
        }
      }
      if (!cueList.length) {
        /* no keyframe found at all (audio-only file, or an unknown codec):
           fall back to one cue per cluster so seeks still have an index */
        let cueClusters = allClusters.filter((c) => c.firstVideoKey === true);
        if (!cueClusters.length) cueClusters = allClusters.filter((c) => c.firstVideoKey !== false);
        if (!cueClusters.length) cueClusters = allClusters;
        cueList = cueClusters.map((c) => ({ keyTC: c.keyTC != null ? c.keyTC : c.tc, start: c.start, tc: c.tc }));
      }
      void hasVideoTracks;

      const alreadyFixed = !!oldCues && !!oldSeekHead && segment.size >= 0 &&
                           existingDuration != null && existingDuration > 0;
      if (alreadyFixed) {
        return { bytes: buf, alreadyFixed: true, durationMs: Math.round(existingDuration * timecodeScale / 1e6),
                 cuePoints: cueList.length, seekHead: true };
      }
      if (cueList.length === 0) return null;           /* nothing to index */

      const durationUnits = maxEndUnits > 0 ? maxEndUnits : (lastTC + 1000);
      const durationMs = Math.round(durationUnits * timecodeScale / 1e6);

      /* ============ build the new metadata ============ */
      /* Info: original children (minus Duration) + the real Duration */
      const newInfo = el([0x15, 0x49, 0xA9, 0x66],
        concat(infoParts.concat([el([0x44, 0x89], float64Payload(durationUnits))])));

      /* cluster span: from the FIRST cluster child (r22-repair-6: never from
         the first cue-worthy cluster — the old code silently DELETED leading
         clusters that failed the keyframe gate, i.e. the recording's opening
         keyframes) to the first non-cluster child after the clusters (an old
         appended Cues is excluded), else segment end */
      const clusterChildren = children.filter(function (c) { return c.id === ID_CLUSTER; });
      const firstClusterStart = clusterChildren.length ? clusterChildren[0].start
                        : (cueList[0] ? cueList[0].start : segDataEnd);
      let spanEnd = segDataEnd;
      for (const c of children) {
        if (c.id !== ID_CLUSTER && c.start >= firstClusterStart) { spanEnd = Math.min(spanEnd, c.start); }
      }
      const clusterSpan = buf.slice(firstClusterStart, spanEnd);
      /* r22-repair-6: real-Chromium clusters carry UNKNOWN size inside the
         span (1F 43 B6 75 | 01 FF FF FF FF FF FF FF). The rewritten Segment
         is finite, and an unknown-size child inside a finite parent is an
         inconsistency ffmpeg explicitly flags ("Unknown-sized element inside
         parent with finite size") — and on seeks near the tail it derailed
         the demuxer into mid-GOP decoding ("Not all references available",
         verified live). Each cluster's boundary was resolved during the walk,
         so write the REAL size into the cluster's own 8-byte size field:
         same field width, zero byte shift, byte-identical block data. */
      for (const c of children) {
        if (c.id !== ID_CLUSTER || c.size !== -1) continue;
        const rel = c.start - firstClusterStart;
        if (rel < 0 || rel + 12 > clusterSpan.length) continue;
        if (clusterSpan[rel + 4] !== 0x01) continue;       /* only a genuine 8-byte unknown-size field */
        let allFF = true;
        for (let i = 5; i < 12; i++) if (clusterSpan[rel + i] !== 0xFF) { allFF = false; break; }
        if (!allFF) continue;
        const cEndSpan = Math.min(c.end !== undefined ? c.end : spanEnd, spanEnd);
        const len = cEndSpan - c.dataStart;      /* the size field holds the CONTENT length (after the 12-byte header) */
        if (len < 0 || len >= Math.pow(2, 55)) continue;
        const field = vintSizeBytes(len, 8);
        if (field && field.length === 8) for (let i = 0; i < 8; i++) clusterSpan[rel + 4 + i] = field[i];
      }
      const others = children.filter((c) =>
        c.id !== ID_INFO && c.id !== ID_TRACKS && c.id !== ID_SEEKHEAD &&
        c.id !== ID_CUES && c.id !== ID_CLUSTER && c.end > c.start);

      /* Cues (positions relative to segment data start — filled once the
         layout is known; the span is byte-identical so a cluster's new
         position = spanPos + (its old offset inside the span)) */
      function buildCues(spanPos) {
        const parts = [];
        for (const c of cueList) {
          /* CueTime = the keyframe's pts (cluster TC + block rel-ts). Writing
             the cluster Timecode instead makes players skip the keyframe and
             decode mid-GOP frames (the laptop timestamp-click bug). */
          parts.push(el([0xBB], concat([
            el([0xB3], uintPayload(c.keyTC != null ? c.keyTC : c.tc)),
            el([0xB7], concat([
              el([0xF7], uintPayload(1)),
              el([0xF1], uintPayload(spanPos + (c.start - firstClusterStart)))
            ]))
          ])));
        }
        return el([0x1C, 0x53, 0xBB, 0x6B], concat(parts));
      }
      /* SeekHead entries with FIXED 8-byte positions (constant size, so the
         layout can be computed before the positions are known) */
      function seekEntry(idBytes, position) {
        const posBytes = new Uint8Array(8);
        let v = position;
        for (let i = 7; i >= 0; i--) { posBytes[i] = v & 0xFF; v = Math.floor(v / 256); }
        return el([0x4D, 0xBB], concat([
          el([0x53, 0xAB], new Uint8Array(idBytes)),
          el([0x53, 0xAC], posBytes)
        ]));
      }
      function seekHeadOf(infoPos, tracksPos, cuesPos) {
        const entries = [seekEntry([0x15, 0x49, 0xA9, 0x66], infoPos)];
        if (tracksPos != null) entries.push(seekEntry([0x16, 0x54, 0xAE, 0x6B], tracksPos));
        entries.push(seekEntry([0x1C, 0x53, 0xBB, 0x6B], cuesPos));
        return el([0x11, 0x4D, 0x9B, 0x74], concat(entries));
      }

      yield { stage: "build", frac: 0.92 };             /* cues chosen, writing output */

      /* layout: sizes first (SeekHead size is position-independent) */
      const seekHeadLen = seekHeadOf(0, 0, 0).length;
      const tracksLen = tracks ? (tracks.end - tracks.start) : 0;
      const othersLen = others.reduce((a, c) => a + (c.end - c.start), 0);
      const infoPos = seekHeadLen;
      const tracksPos = tracks ? (seekHeadLen + newInfo.length) : null;
      const spanPos = seekHeadLen + newInfo.length + tracksLen + othersLen;
      const seekHead = seekHeadOf(infoPos, tracksPos, spanPos + clusterSpan.length);
      const cues = buildCues(spanPos);
      const segDataSize = seekHead.length + newInfo.length + tracksLen + othersLen + clusterSpan.length + cues.length;

      /* the segment size field: 8-byte vint (room for any real file) */
      const segSize = vintSizeBytes(segDataSize, 8);
      if (!segSize) return null;

      const headerBytes = header ? buf.slice(header.start, header.end) : new Uint8Array(0);
      const SEG_ID = new Uint8Array([0x18, 0x53, 0x80, 0x67]);   /* real Matroska Segment ID — the 0x40 typo wrote files no player could open */
      const parts = [headerBytes, SEG_ID, new Uint8Array(segSize), seekHead, newInfo];
      if (tracks) parts.push(buf.slice(tracks.start, tracks.end));
      for (const c of others) parts.push(buf.slice(c.start, c.end));
      parts.push(clusterSpan);
      parts.push(cues);
      const result = concat(parts);

      yield { stage: "finalize", frac: 0.98 };

      return { bytes: result, alreadyFixed: false, durationMs: durationMs,
               cuePoints: cueList.length, seekHead: true };
    } catch (e) {
      return null;    /* repair is best-effort: the recording still plays */
    }
  }

  /* sync wrapper — the exact behaviour every earlier build had */
  function repair(buf) {
    try {
      const g = repairGen(buf);
      let r = g.next();
      while (!r.done) r = g.next();
      return r.value;
    } catch (e) { return null; }
  }

  /* r22-repair-4: cooperative version with a live progress report.
     onProgress receives {stage, frac} ('start'/'parse'/'scan'/'build'/
     'finalize'/'done'; frac 0..1). A throwing onProgress can never break
     the repair itself. */
  async function repairAsync(buf, onProgress) {
    const tell = (p) => { if (typeof onProgress === "function") { try { onProgress(p); } catch (e) {} } };
    tell({ stage: "start", frac: 0 });
    const g = repairGen(buf);
    let r = g.next();
    while (!r.done) {
      tell(r.value);
      await new Promise((res) => setTimeout(res, 0));   /* let the UI paint */
      r = g.next();
    }
    tell({ stage: "done", frac: 1 });
    return r.value;
  }

  /* ---- r22-repair-5: full SAMPLE-LEVEL demux (feeds the MP4 transcoder) ----
     Returns { timecodeScale, tracks:[{trackNumber,type,codec,codecPrivate}],
               samples: Map(trackNumber -> [{ts, dur, key, data}]) } where ts/dur
     are in timecode-scale units and data is a subarray view (no copy). */
  /* ---- r22-repair-6: sample-level demux for the universal-MP4 transcoder ----
     The field report that drove this rewrite: "The MP4 conversion failed:
     Could not read this recording as WebM/Matroska" — on a file VLC and
     Chrome play fine. r22-repair-5 could ONLY walk a Segment of UNKNOWN
     size, but repair() itself writes a FINITE Segment size, so extract()
     rejected every repaired file it was handed. It also could not read
     current-Chromium recordings (unknown-size CLUSTERS — verified on
     Chromium 154), did not split laced Opus packets (Chrome packs many
     packets into one block — one-packet-per-sample corrupts the count and
     the AAC re-encode), and misparsed BlockGroups as blocks. This version
     parses all of it, identifies tracks by TrackType/CodecID (never order —
     Chrome may write the audio track first) and throws DESCRIPTIVE errors
     that the transcoder surfaces verbatim. No more anonymous nulls. */
  function extract(buf) {
    if (!buf || !buf.length) throw new Error("The recording is empty.");

    /* pass 1 — EBML header, then the Segment (finite OR unknown size) */
    let pos = 0;
    let segment = null;
    let segDataEnd = buf.length;
    const children = [];
    while (pos < buf.length - 1) {
      const t = readId(buf, pos);
      if (!t) break;
      const s = readVintSize(buf, pos + t.length);
      if (!s) break;
      const dataStart = pos + t.length + s.length;
      const elStart = pos;
      if (t.id === ID_SEGMENT && !segment) {
        segment = { dataStart: dataStart, size: s.value };
        segDataEnd = s.value >= 0 ? Math.min(dataStart + s.value, buf.length) : buf.length;
        pos = dataStart;                    /* descend — finite or unknown */
        continue;
      }
      if (segment) {
        if (dataStart > segDataEnd) break;  /* past the segment */
        let end;
        if (s.value === -1) { end = resolveUnknownChildEnd(buf, dataStart, segDataEnd); pos = end; }
        else { end = Math.min(dataStart + s.value, segDataEnd); pos = dataStart + s.value; }
        children.push({ id: t.id, start: elStart, dataStart: dataStart, size: s.value, end: end });
        continue;
      }
      pos = s.value === -1 ? dataStart : dataStart + s.value;
    }
    if (!segment) throw new Error("no Matroska Segment element — this is not a WebM/Matroska recording");

    const info = children.find(function (c) { return c.id === ID_INFO; });
    if (!info) throw new Error("the recording header (Info element) is missing");
    let timecodeScale = 1000000;
    {
      const iEnd = info.size >= 0 ? Math.min(info.dataStart + info.size, segDataEnd) : segDataEnd;
      let p = info.dataStart;
      let guard = 0;
      while (p < iEnd - 1 && guard++ < 4096) {
        const t = readId(buf, p); if (!t) break;
        const s = readVintSize(buf, p + t.length); if (!s) break;
        if (t.id === ID_TSCALE && s.value >= 1) {
          const v = readUInt(buf, p + t.length + s.length, s.value);
          if (v > 0) timecodeScale = v;
        }
        if (s.value === -1) break;
        p += t.length + s.length + s.value;
      }
    }

    /* pass 2 — tracks, identified by TrackType/CodecID (order irrelevant) */
    const tracks = [];
    const trackByNum = {};
    const tracksEl = children.find(function (c) { return c.id === ID_TRACKS; });
    if (tracksEl) {
      const tEnd = tracksEl.size >= 0 ? Math.min(tracksEl.dataStart + tracksEl.size, segDataEnd) : segDataEnd;
      let p = tracksEl.dataStart;
      let guard = 0;
      while (p < tEnd - 1 && guard++ < 4096) {
        const t = readId(buf, p); if (!t) break;
        const s = readVintSize(buf, p + t.length); if (!s) break;
        const dEnd = s.value >= 0 ? Math.min(p + t.length + s.length + s.value, tEnd) : tEnd;
        if (t.id === 0xAE) {                          /* TrackEntry */
          let tn = null, type = null, codec = null, priv = null;
          let q = p + t.length + s.length;
          let g2 = 0;
          while (q < dEnd - 1 && g2++ < 512) {
            const tt = readId(buf, q); if (!tt) break;
            const ss = readVintSize(buf, q + tt.length); if (!ss) break;
            const dd = q + tt.length + ss.length;
            const de = ss.value >= 0 ? Math.min(dd + ss.value, dEnd) : dEnd;
            if (tt.id === 0xD7 && ss.value >= 1 && ss.value <= 8) tn = readUInt(buf, dd, ss.value);
            else if (tt.id === 0x83 && ss.value >= 1) type = readUInt(buf, dd, ss.value);
            else if (tt.id === 0x86) { let c2 = ""; for (let i = dd; i < de; i++) c2 += String.fromCharCode(buf[i]); codec = c2; }
            else if (tt.id === 0x63A2) priv = buf.slice(dd, de);
            if (ss.value === -1) break;
            q = de;
          }
          if (tn != null && tn > 0) {
            const tr = { trackNumber: tn, type: type, codec: codec || "", codecPrivate: priv || null };
            tracks.push(tr); trackByNum[tn] = tr;
          }
        }
        if (s.value === -1) break;
        p += t.length + s.length + s.value;
      }
    }
    if (!tracks.length) throw new Error("no tracks found in the recording header");

    /* pass 3 — clusters → blocks → (laced) samples */
    const samples = new Map();
    for (const tr of tracks) samples.set(tr.trackNumber, []);
    const msPerUnit = timecodeScale / 1e6;
    function opusPacketDurMs(d) {
      /* Opus TOC: single-frame configs 0-11 -> [2.5,5,10,20,40,60] ms; Chrome
         records 20 ms packets. Multi-frame configs never occur in MediaRecorder
         output; 20 ms is the safe fallback there. */
      if (!d || !d.length) return 20;
      const cfg = d[0] >> 3;
      if (cfg < 12) return [2.5, 5, 10, 20, 40, 60][cfg % 6];
      return 20;
    }
    function laceFrames(d0, d1, lace) {
      /* splits a block payload [d0,d1) into per-frame [start,end] ranges */
      if (d1 <= d0) return [];
      if (!lace) return [[d0, d1]];
      const count = (buf[d0] + 1) & 0xFF;               /* lace count byte = frames-1 */
      let p = d0 + 1;
      const sizes = [];
      if (lace === 1) {                                  /* Xiph: N-1 sizes, 0x00-terminated byte runs */
        for (let i = 0; i < count - 1 && p < d1; i++) {
          let sz = 0, g = 0;
          while (p < d1 && g++ < 10) { const b = buf[p++]; sz += b; if (b === 0) break; }
          sizes.push(sz);
        }
      } else if (lace === 2) {                           /* fixed: payload split evenly */
        const sz = Math.floor((d1 - p) / count);
        for (let i = 0; i < count - 1; i++) sizes.push(sz);
      } else {                                           /* EBML: first size vint, then SIGNED vint deltas */
        const readLaceVint = function (q) {
          const b0 = buf[q];
          if (b0 === undefined || b0 === 0) return null;
          let len = 1;
          for (let mask = 0x80; mask; mask >>= 1) { if (b0 & mask) break; len++; }
          if (q + len > d1) return null;
          let v = b0 & (0xFF >> len);
          for (let i = 1; i < len; i++) v = v * 256 + buf[q + i];
          const bits = 7 * len;
          const half = Math.pow(2, bits - 1);
          return { value: v, len: len, signed: v >= half ? v - Math.pow(2, bits) : v };
        };
        let r = readLaceVint(p);
        if (r) { sizes.push(r.value); p += r.len; }
        let prev = sizes.length ? sizes[0] : 0;
        for (let i = 1; i < count - 1 && p < d1; i++) {
          r = readLaceVint(p);
          if (!r) break;
          prev = prev + r.signed;
          sizes.push(prev);
          p += r.len;
        }
      }
      const out = [];
      let q2 = p;
      for (let i = 0; i < count - 1; i++) {
        if (q2 >= d1 || q2 + sizes[i] > d1) return [[d0 + 1, d1]];  /* corrupt lace: keep payload whole */
        out.push([q2, q2 + sizes[i]]);
        q2 += sizes[i];
      }
      if (q2 <= d1) out.push([q2, d1]);
      if (out.length < 2) return [[d0 + 1, d1]];         /* corrupt: whole payload */
      return out;
    }
    const noteBlock = function (bStart, bEnd, clusterTC) {
      if (bEnd - bStart < 4) return;
      const tl = vintDataLen(buf[bStart]);
      if (tl < 1 || tl > 4 || bStart + tl + 3 > bEnd) return;
      let trackNum = buf[bStart] & (0xFF >> tl);
      for (let i = 1; i < tl; i++) trackNum = trackNum * 256 + buf[bStart + i];
      const arr = samples.get(trackNum);
      if (!arr) return;
      const trk = trackByNum[trackNum];
      let rel = (buf[bStart + tl] << 8) | buf[bStart + tl + 1];
      if (rel & 0x8000) rel -= 0x10000;
      const flags = buf[bStart + tl + 2];
      const lace = (flags >> 1) & 0x03;
      const baseTs = clusterTC + rel;
      const frames = laceFrames(bStart + tl + 3, bEnd, lace);
      let cumMs = 0;
      let keyFlag = !!(flags & 0x80);
      /* r22-repair-6: Chromium does not set the container keyframe flag on
         video blocks — ask the bitstream (VP8/VP9 frame headers) so the
         transcoder feeds WebCodecs the correct chunk type and diagnostics
         report real keyframe counts. */
      if (!keyFlag && trk && trk.type === 1 && frames.length && frames[0][1] > frames[0][0]) {
        keyFlag = isVideoKeyframe(trk.codec, false, buf.subarray(frames[0][0], frames[0][1]));
      }
      for (let i = 0; i < frames.length; i++) {
        const data = buf.subarray(frames[i][0], frames[i][1]);
        const ts = i === 0 ? baseTs : baseTs + Math.round(cumMs / msPerUnit);
        arr.push({ ts: ts, key: keyFlag, data: data });
        if (trk && trk.type === 2 && trk.codec === "A_OPUS") cumMs += opusPacketDurMs(data);
      }
    };
    for (const c of children) {
      if (c.id !== ID_CLUSTER) continue;
      const cEnd = (c.end !== undefined) ? c.end
                 : (c.size >= 0 ? Math.min(c.dataStart + c.size, segDataEnd) : segDataEnd);
      let tc = null;
      const blocks = [];
      let p = c.dataStart;
      let guard = 0;
      while (p < cEnd - 1 && guard++ < 3000000) {
        const t = readId(buf, p); if (!t) break;
        const s = readVintSize(buf, p + t.length); if (!s) break;
        const dStart = p + t.length + s.length;
        const dEnd = s.value >= 0 ? Math.min(dStart + s.value, cEnd) : cEnd;
        if (t.id === ID_TIMESTAMP && s.value >= 1 && tc === null) {
          tc = readUInt(buf, dStart, s.value);
        } else if (t.id === ID_SIMPLEBLOCK && s.value >= 3) {
          blocks.push([dStart, dEnd]);
        } else if (t.id === 0xA0 && s.value >= 3) {      /* BlockGroup → Block (0xA1) inside */
          let q = dStart, g2 = 0;
          while (q < dEnd - 1 && g2++ < 4096) {
            const t2 = readId(buf, q); if (!t2) break;
            const s2 = readVintSize(buf, q + t2.length); if (!s2) break;
            const dd = q + t2.length + s2.length;
            const de = s2.value >= 0 ? Math.min(dd + s2.value, dEnd) : dEnd;
            if (t2.id === ID_BLOCK && s2.value >= 3) blocks.push([dd, de]);
            if (s2.value === -1) break;
            q = de;
          }
        }
        if (s.value === -1) break;
        p = dEnd;
      }
      if (tc === null) continue;
      for (let i = 0; i < blocks.length; i++) noteBlock(blocks[i][0], blocks[i][1], tc);
    }
    /* durations: delta to the next sample of the same track */
    for (const tr of tracks) {
      const arr = samples.get(tr.trackNumber);
      arr.sort(function (a, b) { return a.ts - b.ts; });
      const fallback = Math.max(1, Math.round((tr.type === 1 ? 33 : 20) / msPerUnit));
      for (let i = 0; i < arr.length; i++) {
        const next = arr[i + 1];
        arr[i].dur = next ? Math.max(1, next.ts - arr[i].ts) : (i > 0 ? arr[i - 1].dur : fallback);
      }
    }
    return { timecodeScale: timecodeScale, tracks: tracks, samples: samples };
  }

  /* r21 compatibility shim: bytes in, bytes out */
  function addCues(buf) {
    const r = repair(buf);
    if (!r) return buf;
    return r.bytes;
  }

  window.WebMCues = {
    repair: repair,
    repairAsync: repairAsync,
    addCues: addCues,
    extract: extract,
    version: "r22-repair-6"   /* +5: real-Chromium files (unknown-size clusters, laced Opus, BlockGroup, any track order); extract() reads repaired finite-Segment files and throws descriptive errors; repair() never drops a cluster */
  };
})();
