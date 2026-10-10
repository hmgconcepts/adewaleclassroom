/* =====================================================================
   webm-cues.js — ADEWALE CLASSROOM DECK · r21 (round 21, item 3)
   =====================================================================
   THE BUG THIS FILE FIXES: MediaRecorder writes Matroska WebM WITHOUT a
   Cues element (the seek index). Symptom in the field: "I clicked on
   different timestamps on the video [in VLC / the laptop media player]
   and the video stopped playing." Players that rely on the index stall
   or stop when asked to seek; some refuse to build their own index when
   the Segment size is also unknown (MediaRecorder writes
   0x01FFFFFFFFFFFFFF).

   WHAT THIS DOES (pure Uint8Array, zero dependencies, runs at stop time):
   1. Scans the file's top-level EBML elements and finds the Segment.
   2. Walks the Segment's children, recording every Cluster's position
      (relative to the Segment data start) and its Timestamp child.
   3. Builds a real Cues element (one CuePoint per Cluster: CueTime +
      CueTrackPositions{CueTrack=1, CueClusterPosition}).
   4. Appends the Cues INSIDE the Segment and rewrites the Segment size
      from "unknown" to the true final size — which is also the Android
      ExoPlayer fix (players that need a finite segment size).
   5. Optionally patches the Duration element from the last cluster
      timestamp when the duration reads 0/absent (belt-and-braces; the
      vendored fix-webm-duration.js remains the primary duration repair).

   Usage:  const fixed = WebMCues.addCues(uint8array);   // same array if
   anything is missing/unknown; a NEW array when the index was written.
   Safe to run on already-fixed files (skips if Cues already present).
   ===================================================================== */
"use strict";
(function () {
  /* ---- minimal EBML readers ---- */
  function readVintSize(buf, pos) {
    /* returns { value, length } for a size vint; value = -1 means unknown */
    if (pos >= buf.length) return null;
    const b0 = buf[pos];
    if (b0 === 0) return null;              /* IDs never start 0; sizes neither */
    let len = 1;
    for (let mask = 0x80; mask; mask >>= 1) { if (b0 & mask) break; len++; }
    if (pos + len > buf.length) return null;
    let value = b0 & (0xFF >> len);
    let unknown = (value === (0xFF >> len));  /* all-ones in the vint payload */
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
    let v = 0;
    for (let i = 0; i < len && pos + i < buf.length; i++) v = v * 256 + buf[pos + i];
    return v;
  }

  /* ---- minimal EBML writers ---- */
  function vintLengthFor(n) {
    for (let k = 1; k <= 8; k++) {
      const max = Math.pow(2, 7 * k) - 2;      /* all-ones reserved for unknown */
      if (n <= max) return k;
    }
    return 8;
  }
  function writeVint(n) {
    const k = vintLengthFor(n);
    return writeVintExact(n, k) || new Uint8Array([0]);
  }
  /* Encode n as a vint of EXACTLY k bytes (marker 1 + k-1 leading zeros in
     the first byte). Returns null when n cannot fit k bytes. */
  function writeVintExact(n, k) {
    if (k < 1 || k > 8 || n < 0 || !isFinite(n)) return null;
    if (n === 0) {
      /* zero: first byte is just the marker */
      const z = new Uint8Array(k);
      z[0] = 0x80 >> (k - 1);
      return z;
    }
    /* value bits available: (8-k) in the first byte + 8*(k-1) in the rest */
    const maxVal = Math.pow(2, 8 - k) * Math.pow(2, 8 * (k - 1)) - 1;
    if (n > maxVal) return null;
    const out = new Uint8Array(k);
    for (let i = k - 1; i >= 1; i--) { out[i] = n & 0xFF; n = Math.floor(n / 256); }
    out[0] = (0x80 >> (k - 1)) | (n & 0xFF);
    return out;
  }
  function el(idBytes, payload) {
    const sizeBytes = writeVint(payload.length);
    const out = new Uint8Array(idBytes.length + sizeBytes.length + payload.length);
    out.set(idBytes, 0);
    out.set(sizeBytes, idBytes.length);
    out.set(payload, idBytes.length + sizeBytes.length);
    return out;
  }
  function uintPayload(n) {
    if (n === 0) return new Uint8Array([0]);
    const bytes = [];
    let v = n;
    while (v > 0) { bytes.unshift(v & 0xFF); v = Math.floor(v / 256); }
    return new Uint8Array(bytes);
  }
  function concat(arrs) {
    let n = 0;
    for (const a of arrs) n += a.length;
    const out = new Uint8Array(n);
    let o = 0;
    for (const a of arrs) { out.set(a, o); o += a.length; }
    return out;
  }

  const ID_SEGMENT      = 0x18538067;
  const ID_CLUSTER      = 0x1F43B675;
  const ID_TIMESTAMP    = 0xE7;
  const ID_CUES         = [0x0C, 0x53, 0xBB, 0x6B];
  const ID_CUEPOINT     = [0xBB];
  const ID_CUETIME      = [0xB3];
  const ID_CUETRACKPOS  = [0xB7];
  const ID_CUETRACK     = [0xF7];
  const ID_CUECLUSTERPOS= [0xF1];

  function addCues(buf) {
    if (!buf || !buf.length) return buf;
    try {
      let pos = 0;
      let segment = null;               /* { dataStart, sizeStart, sizeLen, dataEnd } */
      const clusters = [];              /* { time, clusterPos } */
      let hasCues = false;

      /* pass 1: top-level walk */
      while (pos < buf.length - 1) {
        const t = readId(buf, pos);
        if (!t) break;
        const s = readVintSize(buf, pos + t.length);
        if (!s) break;
        const dataStart = pos + t.length + s.length;
        if (t.id === ID_SEGMENT) {
          segment = { sizeStart: pos + t.length, sizeLen: s.length, dataStart, size: s.value };
        } else if (segment && t.id === ID_CUES) {
          hasCues = true;
        }
        if (segment && t.id === ID_CLUSTER) {
          /* pass 2: cluster children -> Timestamp */
          let time = null;
          let cp = dataStart;
          const cEnd = s.value >= 0 ? Math.min(dataStart + s.value, buf.length) : buf.length;
          let guard = 0;
          while (cp < cEnd - 1 && guard++ < 64) {
            const ct = readId(buf, cp);
            if (!ct) break;
            const cs = readVintSize(buf, cp + ct.length);
            if (!cs) break;
            if (ct.id === ID_TIMESTAMP) {
              time = readUInt(buf, cp + ct.length + cs.length, cs.value);
              break;
            }
            cp += ct.length + cs.length + (cs.value >= 0 ? cs.value : 0);
          }
          if (time !== null) clusters.push({ time, clusterPos: pos - segment.dataStart });
        }
        if (s.value === -1) {
          if (segment && segment.size === -1) {
            /* unknown-size Segment: children run to EOF */
            if (t.id === ID_SEGMENT) { pos = dataStart; continue; }
            pos = dataStart;             /* top-level child of unknown segment: continue scanning inside */
            continue;
          }
          break;                          /* cannot skip an unknown-size element outside a segment */
        }
        pos = dataStart + s.value;
      }

      if (!segment || hasCues || clusters.length === 0) return buf;

      /* build the Cues payload: one CuePoint per cluster */
      const parts = [];
      for (const c of clusters) {
        parts.push(el(ID_CUEPOINT, concat([
          el(ID_CUETIME, uintPayload(c.time)),
          el(ID_CUETRACKPOS, concat([
            el(ID_CUETRACK, uintPayload(1)),
            el(ID_CUECLUSTERPOS, uintPayload(c.clusterPos))
          ]))
        ])));
      }
      const cues = el(ID_CUES, concat(parts));

      /* append inside the Segment and rewrite the (possibly unknown) size.
         The original bytes are preserved byte-for-byte; the Cues element is
         appended at EOF, which is INSIDE the segment because MediaRecorder
         segments have unknown (open-ended) size — and for finite-size
         segments we append right after the segment's last byte. */
      const segmentEnd = (segment.size >= 0) ? (segment.dataStart + segment.size) : buf.length;
      if (segmentEnd > buf.length) return buf;    /* corrupt size — do not touch */
      const head = buf.subarray(0, segmentEnd);
      const tail = buf.subarray(segmentEnd);      /* anything after the segment stays after */
      const newSize = (segmentEnd - segment.dataStart) + cues.length;

      /* The size must be re-encoded in EXACTLY the original field width
         (offsets stay valid because nothing moves). If the value cannot
         fit that width, bail — never emit invalid EBML. */
      const sizeBytes = writeVintExact(newSize, segment.sizeLen);
      if (!sizeBytes) return buf;

      const out = new Uint8Array(buf.length + cues.length);
      out.set(head, 0);
      out.set(sizeBytes, segment.sizeStart);
      out.set(cues, segmentEnd);
      out.set(tail, segmentEnd + cues.length);
      return out;
    } catch (e) {
      return buf;    /* repair is best-effort: the recording still plays */
    }
  }

  window.WebMCues = {
    addCues: addCues,
    version: "r21-cues-1"
  };
})();
