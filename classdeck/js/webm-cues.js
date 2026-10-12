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
    const map = new Map();              /* trackNumber -> isVideo */
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
        let num = null, type = null;
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
          }
          q = dd + s2.value;
        }
        if (num != null) map.set(num, type === 1);
      }
      p = dStart + s.value;
    }
    return map;
  }

  /* ---- parse one element's block-scan: max relative block timestamp + keyframe state ---- */
  function scanClusterBlocks(buf, dataStart, dataEnd, clusterTC, trackMap) {
    /* returns { maxEnd, firstVideoKey, firstVideoKeyRel }:
       maxEnd = the max block END (timecode-scale units) inside the cluster;
       firstVideoKey = whether the FIRST video block carries the keyframe
       flag (null when the cluster has no video blocks);
       firstVideoKeyRel = that block's relative timecode (used for CueTime).
       ffmpeg's matroska_read_seek sets skip_to_timecode = CueTime and then
       DISCARDS every block with pts < skip_to_timecode, so CueTime MUST be
       the keyframe's own pts (clusterTC + rel), never the cluster Timecode:
       one ms too high skips the keyframe itself and the VP9 decoder is fed
       mid-GOP frames ("Not all references are available"). */
    let maxEnd = clusterTC;
    let firstVideoKey = null;
    let firstVideoKeyRel = null;
    let p = dataStart;
    let guard = 0;
    while (p < dataEnd - 1 && guard++ < 500000) {
      const t = readId(buf, p);
      if (!t) break;
      const s = readVintSize(buf, p + t.length);
      if (!s) break;
      const dStart = p + t.length + s.length;
      if (s.value === -1) break;                        /* unknown-size block: stop */
      const dEnd = Math.min(dStart + s.value, dataEnd);
      if ((t.id === ID_SIMPLEBLOCK || t.id === ID_BLOCK) && s.value >= 3) {
        const tl = vintDataLen(buf[dStart]);
        if (dStart + tl + 2 <= dEnd) {
          let rel = (buf[dStart + tl] << 8) | buf[dStart + tl + 1];
          if (rel & 0x8000) rel -= 0x10000;
          const end = clusterTC + rel;
          if (end > maxEnd) maxEnd = end;
          if (firstVideoKey === null) {
            const flags = buf[dStart + tl + 2];
            const isVideo = trackMap ? trackMap.get(tl === 1 ? (buf[dStart] & 0x7F) : ((buf[dStart] & 0x3F) * 256 + buf[dStart + 1])) : true;
            if (isVideo === undefined) { /* unknown track number: treat as video so the flag is honoured */ }
            if (isVideo !== false) { firstVideoKey = !!(flags & 0x80); firstVideoKeyRel = rel; }
          }
        }
      }
      p = dStart + s.value;
    }
    return { maxEnd, firstVideoKey, firstVideoKeyRel };
  }

  /* ---- the full repair ---- */
  function repair(buf) {
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
          /* unknown-size child: its content runs until the next plausible
             sibling — descend (r21 tolerance; MediaRecorder emits finite
             children, this only guards exotic files) */
          pos = s.value === -1 ? dataStart : dataStart + s.value;
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
      const hasVideoTracks = trackMap.size === 0 || Array.from(trackMap.values()).some((v) => v);
      let maxEndUnits = 0;
      let lastTC = 0;
      const allClusters = [];
      for (const c of clusters) {
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
                            keyTC: scan.firstVideoKeyRel != null ? Math.max(0, tc + scan.firstVideoKeyRel) : null });
      }
      let cueClusters = allClusters.filter((c) => c.firstVideoKey === true);
      if (!cueClusters.length) {
        /* no keyframe-aligned cluster found (audio-only file, or an exotic
           muxer): fall back to every cluster so seeks still have an index */
        cueClusters = allClusters.filter((c) => c.firstVideoKey !== false);
        if (!cueClusters.length) cueClusters = allClusters;
      }
      void hasVideoTracks;

      const alreadyFixed = !!oldCues && !!oldSeekHead && segment.size >= 0 &&
                           existingDuration != null && existingDuration > 0;
      if (alreadyFixed) {
        return { bytes: buf, alreadyFixed: true, durationMs: Math.round(existingDuration * timecodeScale / 1e6),
                 cuePoints: cueClusters.length, seekHead: true };
      }
      if (cueClusters.length === 0) return null;        /* nothing to index */

      const durationUnits = maxEndUnits > 0 ? maxEndUnits : (lastTC + 1000);
      const durationMs = Math.round(durationUnits * timecodeScale / 1e6);

      /* ============ build the new metadata ============ */
      /* Info: original children (minus Duration) + the real Duration */
      const newInfo = el([0x15, 0x49, 0xA9, 0x66],
        concat(infoParts.concat([el([0x44, 0x89], float64Payload(durationUnits))])));

      /* cluster span: from the first cluster to the first non-cluster child
         after the clusters (an old appended Cues is excluded), else segment end */
      const firstClusterStart = cueClusters[0].start;
      let spanEnd = segDataEnd;
      for (const c of children) {
        if (c.id !== ID_CLUSTER && c.start >= firstClusterStart) { spanEnd = Math.min(spanEnd, c.start); }
      }
      const clusterSpan = buf.slice(firstClusterStart, spanEnd);
      const others = children.filter((c) =>
        c.id !== ID_INFO && c.id !== ID_TRACKS && c.id !== ID_SEEKHEAD &&
        c.id !== ID_CUES && c.id !== ID_CLUSTER && c.end > c.start);

      /* Cues (positions relative to segment data start — filled once the
         layout is known; the span is byte-identical so a cluster's new
         position = spanPos + (its old offset inside the span)) */
      function buildCues(spanPos) {
        const parts = [];
        for (const c of cueClusters) {
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

      return { bytes: result, alreadyFixed: false, durationMs: durationMs,
               cuePoints: cueClusters.length, seekHead: true };
    } catch (e) {
      return null;    /* repair is best-effort: the recording still plays */
    }
  }

  /* r21 compatibility shim: bytes in, bytes out */
  function addCues(buf) {
    const r = repair(buf);
    if (!r) return buf;
    return r.bytes;
  }

  window.WebMCues = {
    repair: repair,
    addCues: addCues,
    version: "r22-repair-3"   /* +2: keyframe-gated cue points (ffprobe-validated) */
  };
})();
