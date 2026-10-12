/* =====================================================================
   mp4-kit.js — ADEWALE CLASSROOM DECK · r22-universal-mp4
   =====================================================================
   THE PROBLEM THIS FILE SOLVES: Windows' built-in players (Windows Media
   Player, Movies & TV) DO NOT PLAY WEBM/VP9/OPUS AT ALL — error
   0xc00d3e8c "Can't play because the item's file format isn't supported".
   VLC and Chrome play WebM; Microsoft's players never will, no matter how
   valid the file is. Every major recording platform solved this by
   delivering MP4/H.264/AAC — the one container/codec pair that opens and
   seeks in EVERY player (Windows Media Player, Movies & TV, QuickTime,
   iOS, Android, WhatsApp…).

   This file makes ClassDeck recordings universal, fully in-browser:
     1. patchMp4Durations(buf) — the "finisher" for NEW recordings.
        Chrome 126+/Safari can record native MP4 via MediaRecorder, but the
        output is fragmented MP4 whose mvhd/tkhd/mdhd durations are often
        0 — some players then show no duration and seek badly. The finisher
        walks the moof/trun fragments, computes the real per-track end, and
        patches the durations IN PLACE (fixed 32-bit fields — no byte
        shifts). Also validates the box structure and reports truncation.
     2. Muxer — a from-scratch PROGRESSIVE MP4 writer (ftyp + moov + mdat,
        one chunk per track, full stbl tables). No B-frame complications
        (baseline H.264), no fragmentation: the layout every player since
        2005 opens, including legacy Windows Media Player.
     3. transcodeToMp4(buf, onProgress) — WebCodecs pipeline that converts
        an OLD WebM recording (VP8/VP9 + Opus) into H.264 + AAC MP4 using
        the device's HARDWARE encoders where available. Runs entirely on
        the teacher's laptop; nothing is uploaded anywhere.

   Self-contained: zero dependencies, no wasm, no network. Works in the
   browser (window.MP4Kit) and in Node for the QA battery (globalThis).
   ===================================================================== */
"use strict";
(function () {
  /* ---------------- tiny byte writers ---------------- */
  function u8(n) { return [n & 0xFF]; }
  function u16(n) { return [(n >> 8) & 0xFF, n & 0xFF]; }
  function u24(n) { return [(n >> 16) & 0xFF, (n >> 8) & 0xFF, n & 0xFF]; }
  function u32(n) { return [(n >>> 24) & 0xFF, (n >>> 16) & 0xFF, (n >>> 8) & 0xFF, n & 0xFF]; }
  function fourcc(s) { return [s.charCodeAt(0), s.charCodeAt(1), s.charCodeAt(2), s.charCodeAt(3)]; }
  function box(type, payload) {                       /* payload: array of arrays/numbers/Uint8Array */
    const body = flatten(payload);
    const out = new Uint8Array(8 + body.length);
    out.set(u32y(8 + body.length), 0);
    out.set(fourcc(type), 4);
    out.set(body, 8);
    return out;
  }
  function fullbox(type, version, flags, payload) {
    return box(type, [[version & 0xFF].concat(u24(flags))].concat([payload]));
  }
  function flatten(parts) {
    const arrs = [];
    let n = 0;
    const push = (p) => {
      if (p == null) return;
      if (typeof p === "number") { arrs.push(new Uint8Array([p & 0xFF])); n += 1; return; }
      if (Array.isArray(p)) { const f = flatten(p); arrs.push(f); n += f.length; return; }
      if (p.subarray || p.constructor === Uint8Array) { arrs.push(p); n += p.length; return; }
      if (typeof p === "string") { const b = new Uint8Array(p.length); for (let i = 0; i < p.length; i++) b[i] = p.charCodeAt(i); arrs.push(b); n += b.length; return; }
    };
    for (const p of parts) push(p);
    const out = new Uint8Array(n);
    let o = 0;
    for (const a of arrs) { out.set(a, o); o += a.length; }
    return out;
  }
  function u32y(n) { return new Uint8Array(u32(n)); }

  /* ---------------- box READER (for the finisher) ---------------- */
  function rd32(b, p) { return ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0; }
  function rd16(b, p) { return (b[p] << 8) | b[p + 1]; }
  function walkBoxes(buf, start, end, cb) {
    let p = start;
    while (p + 8 <= end) {
      let size = rd32(buf, p);
      const type = String.fromCharCode(buf[p + 4], buf[p + 5], buf[p + 6], buf[p + 7]);
      let hdr = 8;
      if (size === 1) { /* 64-bit size */
        if (p + 16 > end) break;
        const hi = rd32(buf, p + 8), lo = rd32(buf, p + 12);
        size = hi * 4294967296 + lo;
        hdr = 16;
      } else if (size === 0) { size = end - p; }
      if (size < hdr || p + size > end) { cb({ type, start: p, size: -1, hdr, bodyStart: p + hdr }); break; }
      cb({ type, start: p, size, hdr, bodyStart: p + hdr });
      p += size;
    }
  }

  /* ---------------- 1. THE FINISHER (fMP4 durations + validation) -------- */
  function patchMp4Durations(buf) {
    if (!buf || buf.length < 12) return { ok: false, error: "too small" };
    /* sanity: must start with ftyp */
    if (!(buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70))
      return { ok: false, error: "not an MP4 file (no ftyp)" };
    let moov = null, moovEnd = 0, truncated = false;
    const trackEnds = new Map();          /* trackId -> max end (track timescale units) */
    const trackScales = new Map();        /* trackId -> mdhd timescale */
    let movieTimescale = 1000, mvhdDurAt = -1, mvhdVersion = 0;
    walkBoxes(buf, 0, buf.length, (b) => {
      if (b.size === -1) { truncated = true; return; }
      if (b.type === "moov") { moov = b; moovEnd = b.start + b.size; }
    });
    if (truncated) return { ok: false, error: "the MP4 structure is incomplete (truncated recording)" };
    if (!moov) return { ok: false, error: "no moov box (unplayable MP4)" };
    /* read mvhd + per-track tkhd/mdhd; find duration field offsets */
    walkBoxes(buf, moov.bodyStart, moovEnd, (b) => {
      if (b.type === "mvhd") {
        mvhdVersion = buf[b.bodyStart];
        movieTimescale = rd32(buf, b.bodyStart + (mvhdVersion === 1 ? 20 : 12));
        mvhdDurAt = b.bodyStart + (mvhdVersion === 1 ? 24 : 16);
      }
      if (b.type === "trak") {
        let trackId = 0, tkhdDurAt = -1, tkhdVersion = 0, mdhdScale = 0, mdhdDurAt = -1, mdhdVersion = 0;
        walkBoxes(buf, b.bodyStart, b.start + b.size, (t) => {
          if (t.type === "tkhd") {
            tkhdVersion = buf[t.bodyStart];
            trackId = rd32(buf, t.bodyStart + (tkhdVersion === 1 ? 20 : 12));
            tkhdDurAt = t.bodyStart + (tkhdVersion === 1 ? 28 : 20);
          }
          if (t.type === "mdia") {
            walkBoxes(buf, t.bodyStart, t.start + t.size, (m) => {
              if (m.type === "mdhd") {
                mdhdVersion = buf[m.bodyStart];
                mdhdScale = rd32(buf, m.bodyStart + (mdhdVersion === 1 ? 20 : 12));
                mdhdDurAt = m.bodyStart + (mdhdVersion === 1 ? 24 : 16);
              }
            });
          }
        });
        if (trackId && mdhdDurAt > -1) {
          trackScales.set(trackId, { scale: mdhdScale || 1000, mdhdDurAt, mdhdVersion, tkhdDurAt, tkhdVersion });
        }
      }
    });
    /* walk movie fragments: accumulate real per-track end times */
    walkBoxes(buf, 0, buf.length, (b) => {
      if (b.type !== "moof") return;
      let trackId = 0, base = 0, defDur = 0;
      const trafs = [];
      walkBoxes(buf, b.bodyStart, b.start + b.size, (m) => { if (m.type === "traf") trafs.push(m); });
      for (const traf of trafs) {
        trackId = 0; base = 0; defDur = 0;
        let dataOffsetPresent = false, defaultDurPresent = false;
        walkBoxes(buf, traf.bodyStart, traf.start + traf.size, (t) => {
          if (t.type === "tfhd") {
            /* fullbox: version(1)+flags(3); then track_ID(4), baseMediaDecodeTime(4, ALWAYS),
               then flag-gated: 0x01 base-data-offset(8), 0x02 sample-desc-index(4),
               0x08 default-duration(4), 0x10 default-size(4), 0x20 default-flags(4) */
            const flags = (buf[t.bodyStart] << 16) | (buf[t.bodyStart + 1] << 8) | buf[t.bodyStart + 2];
            let q = t.bodyStart + 4;
            trackId = rd32(buf, q); q += 4;
            base = rd32(buf, q); q += 4;                                     /* baseMediaDecodeTime: always present */
            if (flags & 0x01) q += 8;                                        /* base-data-offset */
            if (flags & 0x02) q += 4;                                        /* sample-description-index */
            if (flags & 0x08) { defDur = rd32(buf, q); q += 4; }             /* default-sample-duration */
            if (flags & 0x10) q += 4;                                        /* default-sample-size */
            if (flags & 0x20) q += 4;                                        /* default-sample-flags */
          }
          if (t.type === "trun") {
            const flags = (buf[t.bodyStart] << 16) | (buf[t.bodyStart + 1] << 8) | buf[t.bodyStart + 2];
            const count = rd32(buf, t.bodyStart + 4);
            let q = t.bodyStart + 8;
            if (flags & 0x01) q += 4;                                       /* data_offset */
            if (flags & 0x04) q += 4;                                       /* first_sample_flags */
            const durP = !!(flags & 0x100), sizeP = !!(flags & 0x200), flagsP = !!(flags & 0x400), ctsP = !!(flags & 0x800);
            let end = base;
            for (let i = 0; i < count; i++) {
              const d = durP ? rd32(buf, q) : defDur;
              if (durP) q += 4;
              if (sizeP) q += 4;
              if (flagsP) q += 4;
              if (ctsP) q += 4;
              end += d;
            }
            if (trackId) {
              const prev = trackEnds.get(trackId) || 0;
              if (end > prev) trackEnds.set(trackId, end);
            }
          }
        });
      }
    });
    /* if the file is NOT fragmented, compute from stts instead */
    if (!trackEnds.size) {
      walkBoxes(buf, 0, buf.length, (b) => {
        if (b.type !== "trak") return;
        let trackId = 0, total = 0, scale = 1000;
        walkBoxes(buf, b.bodyStart, b.start + b.size, (t) => {
          if (t.type === "tkhd") { trackId = rd32(buf, t.bodyStart + (buf[t.bodyStart] === 1 ? 20 : 12)); }
          if (t.type === "mdia") {
            walkBoxes(buf, t.bodyStart, t.start + t.size, (m) => {
              if (m.type === "mdhd") scale = rd32(buf, m.bodyStart + (buf[m.bodyStart] === 1 ? 20 : 12)) || 1000;
              if (m.type === "minf") {
                walkBoxes(buf, m.bodyStart, m.start + m.size, (x) => {
                  if (x.type === "stbl") {
                    walkBoxes(buf, x.bodyStart, x.start + x.size, (y) => {
                      if (y.type === "stts") {
                        const n = rd32(buf, y.bodyStart + 4);
                        for (let i = 0; i < n; i++) total += rd32(buf, y.bodyStart + 8 + i * 8) * rd32(buf, y.bodyStart + 8 + i * 8 + 4);
                      }
                    });
                  }
                });
              }
            });
          }
        });
        if (trackId) trackEnds.set(trackId, total);
        void scale;
      });
    }
    if (!trackEnds.size) return { ok: false, error: "no track duration information found" };
    /* patch: mdhd (track units) → tkhd (movie units) → mvhd (movie units) */
    const out = buf.slice ? Uint8Array.from(buf) : new Uint8Array(buf);
    let maxMovieEnd = 0, patched = 0;
    for (const [trackId, endUnits] of trackEnds) {
      const meta = trackScales.get(trackId);
      if (!meta) continue;
      const movieEnd = Math.round(endUnits * movieTimescale / (meta.scale || 1000));
      if (movieEnd > maxMovieEnd) maxMovieEnd = movieEnd;
      if (meta.mdhdDurAt > -1) { out.set(u32y(Math.min(0xFFFFFFFF, endUnits)), meta.mdhdDurAt + (meta.mdhdVersion === 1 ? 4 : 0)); patched++; }
      if (meta.tkhdDurAt > -1) { out.set(u32y(Math.min(0xFFFFFFFF, movieEnd)), meta.tkhdDurAt + (meta.tkhdVersion === 1 ? 4 : 0)); patched++; }
    }
    if (mvhdDurAt > -1) { out.set(u32y(Math.min(0xFFFFFFFF, maxMovieEnd)), mvhdDurAt + (mvhdVersion === 1 ? 4 : 0)); patched++; }
    return { ok: true, bytes: out, patched: patched, durationSec: maxMovieEnd / (movieTimescale || 1000) };
  }

  /* ---------------- 2. PROGRESSIVE MP4 MUXER (H.264 + AAC) ---------------- */
  function Muxer() {
    const V_TS = 90000, A_TS = 48000;
    const video = { avcC: null, width: 0, height: 0, samples: [], base: Infinity };
    const audio = { asc: null, channels: 2, sampleRate: 48000, samples: [], base: Infinity };
    let done = false;

    function setVideo(avcC, width, height) { video.avcC = avcC; video.width = width; video.height = height; }
    function setAudio(asc, channels, sampleRate) { audio.asc = asc; audio.channels = channels || 2; audio.sampleRate = sampleRate || 48000; }
    function addVideoSample(data, durationUnits, key, tsUnits) {
      video.samples.push({ d: data, dur: Math.max(1, durationUnits | 0), key: !!key });
      if (tsUnits != null && tsUnits < video.base) video.base = tsUnits;
    }
    function addAudioSample(data, durationUnits, tsUnits) {
      audio.samples.push({ d: data, dur: Math.max(1, durationUnits | 0), key: true });
      if (tsUnits != null && tsUnits < audio.base) audio.base = tsUnits;
    }
    function esdsBox(asc) {
      /* ES_Descriptor(0x03) > DecoderConfigDescriptor(0x04) > DecoderSpecificInfo(0x05, ASC) + SLConfigDescriptor(0x06) */
      const dsi = [0x05, asc.length].concat(Array.from(asc));
      const sl = [0x06, 0x01, 0x02];
      const dcd = [0x04, (13 + dsi.length)].concat(
        [0x40, 0x15], u24(0), u32(256000), u32(128000), dsi);
      const es = [0x03, (3 + dcd.length + sl.length)].concat(u16(1), [0x00], dcd, sl);
      return fullbox("esds", 0, 0, es);
    }
    function stbl(track, sampleEntry) {
      const n = track.samples.length;
      /* stts: run-length of equal durations */
      const sttsRuns = [];
      for (let i = 0; i < n; i++) {
        const d = track.samples[i].dur;
        const last = sttsRuns[sttsRuns.length - 1];
        if (last && last[0] === d) last[1]++;
        else sttsRuns.push([d, 1]);
      }
      /* stts entries are (sample_count, sample_delta) — count FIRST */
      const stts = fullbox("stts", 0, 0, [u32(sttsRuns.length)].concat(sttsRuns.map((r) => u32(r[1]).concat(u32(r[0])))));
      /* stss: 1-based keyframe indices (video only) */
      let stss = null;
      if (sampleEntry === "avc1") {
        const keys = [];
        for (let i = 0; i < n; i++) if (track.samples[i].key) keys.push(i + 1);
        if (keys.length && keys.length < n) stss = fullbox("stss", 0, 0, [u32(keys.length)].concat(keys.map((k) => u32(k))));
      }
      /* one chunk = all samples */
      const stsc = fullbox("stsc", 0, 0, [u32(1), u32(1), u32(n), u32(1)]);
      const stsz = fullbox("stsz", 0, 0, [u32(0), u32(n)].concat(track.samples.map((s) => u32(s.d.length))));
      return { stts: stts, stss: stss, stsc: stsc, stsz: stsz };
    }
    function finalize() {
      if (done) throw new Error("finalize() called twice");
      done = true;
      if (!video.samples.length) throw new Error("no video samples");
      if (!video.avcC) throw new Error("no avcC config (encoder metadata missing)");
      const hasAudio = audio.samples.length > 0 && audio.asc;
      const vidBytes = video.samples.reduce((a, s) => a + s.d.length, 0);
      const audBytes = hasAudio ? audio.samples.reduce((a, s) => a + s.d.length, 0) : 0;
      if (vidBytes + audBytes + 65536 > 4294967295) throw new Error("recording too large for a 32-bit MP4 (over 4 GB)");
      const vidDur = video.samples.reduce((a, s) => a + s.dur, 0);
      const audDur = hasAudio ? audio.samples.reduce((a, s) => a + s.dur, 0) : 0;
      const movieTS = 1000;
      const movieDur = Math.max(Math.round(vidDur * movieTS / V_TS), Math.round(audDur * movieTS / A_TS));

      /* placeholders — chunk offsets depend on final moov size, so compute sizes first */
      const vidStbl = stbl(video, "avc1");
      const audStbl = hasAudio ? stbl(audio, "mp4a") : null;

      function videoTrak(vidChunkOff, audChunkOff) {
        void audChunkOff;
        /* tkhd v0: creation(4) modification(4) trackID(4) reserved(4) duration(4)
           reserved(8) layer(2) altgroup(2) volume(2) reserved(2) matrix(36) width(4) height(4) */
        const tkhd = fullbox("tkhd", 0, 7, u32(0).concat(
          u32(0), u32(1), u32(0), u32(movieDur),
          [0, 0, 0, 0, 0, 0, 0, 0],
          u16(0), u16(1), u16(0), u16(0),
          u32(0x00010000), u32(0), u32(0),
          u32(0), u32(0x40000000), u32(0),
          u32(0), u32(0), u32(0x00010000),
          u32(video.width << 16), u32(video.height << 16)));
        /* mdhd v0: creation(4) modification(4) timescale(4) duration(4) language(2) pre_defined(2) */
        const mdhd = fullbox("mdhd", 0, 0, u32(0).concat(u32(0), u32(V_TS), u32(vidDur), u16(0x55C4), u16(0)));
        const hdlr = fullbox("hdlr", 0, 0, u32(0).concat(fourcc("vide"), u32(0).concat(u32(0), u32(0), "VideoHandler\0".split(""))));
        /* avc1: reserved(6) data_ref_index(2) pre_defined+reserved(16) width(2) height(2)
           horizres(4) vertres(4) reserved(4) frame_count(2) compressorname(32) depth(2) pre_defined(2) avcC */
        const avc1 = box("avc1", [0, 0, 0, 0, 0, 0, 0, 1].concat(
          new Uint8Array(16),
          u16(video.width), u16(video.height),
          u32(0x00480000), u32(0x00480000), u32(0), u16(1),
          new Uint8Array(32), u16(0x0018), u16(0xFFFF),
          [box("avcC", video.avcC)]));
        const stco = fullbox("stco", 0, 0, [u32(1), u32(vidChunkOff)]);
        const stsd = fullbox("stsd", 0, 0, [u32(1), avc1]);
        const stblB = box("stbl", [stsd, vidStbl.stts, vidStbl.stss || [], vidStbl.stsc, vidStbl.stsz, stco]);
        const minf = box("minf", [fullbox("vmhd", 0, 1, [0, 0, 0, 0, 0, 0, 0, 0]),
          box("dinf", [fullbox("dref", 0, 0, [u32(1), fullbox("url ", 0, 1, [])])]), stblB]);
        return box("trak", [tkhd, box("mdia", [mdhd, hdlr, minf])]);
      }
      function audioTrak(audChunkOff) {
        const tkhd = fullbox("tkhd", 0, 7, u32(0).concat(
          u32(0), u32(2), u32(0), u32(movieDur),
          [0, 0, 0, 0, 0, 0, 0, 0],
          u16(0), u16(1), u16(0x0100), u16(0),
          u32(0x00010000), u32(0), u32(0),
          u32(0), u32(0x40000000), u32(0),
          u32(0), u32(0), u32(0x00010000),
          u32(0), u32(0)));
        const mdhd = fullbox("mdhd", 0, 0, u32(0).concat(u32(0), u32(A_TS), u32(audDur), u16(0x55C4), u16(0)));
        const hdlr = fullbox("hdlr", 0, 0, u32(0).concat(fourcc("soun"), u32(0).concat(u32(0), u32(0), "SoundHandler\0".split(""))));
        /* mp4a: reserved(6) data_ref_index(2) reserved(8) channelcount(2) samplesize(2)
           pre_defined(2) reserved(2) samplerate(16.16) esds */
        const mp4a = box("mp4a", [0, 0, 0, 0, 0, 0, 0, 1].concat(
          new Uint8Array(8),
          u16(audio.channels), u16(16), u16(0), u16(0),
          u32(audio.sampleRate << 16), [esdsBox(audio.asc)]));
        const stco = fullbox("stco", 0, 0, [u32(1), u32(audChunkOff)]);
        const stsd = fullbox("stsd", 0, 0, [u32(1), mp4a]);
        const stblB = box("stbl", [stsd, audStbl.stts, audStbl.stss || [], audStbl.stsc, audStbl.stsz, stco]);
        const minf = box("minf", [fullbox("smhd", 0, 0, [0, 0]),
          box("dinf", [fullbox("dref", 0, 0, [u32(1), fullbox("url ", 0, 1, [])])]), stblB]);
        return box("trak", [tkhd, box("mdia", [mdhd, hdlr, minf])]);
      }

      /* two-pass: build with offset 0 to learn moov size, then rebuild with real offsets */
      let vTrak = videoTrak(0, 0);
      let aTrak = hasAudio ? audioTrak(0) : null;
      const ftyp = box("ftyp", [fourcc("isom"), u32(512)].concat([fourcc("isom"), fourcc("iso2"), fourcc("avc1"), fourcc("mp41")]));
      const free = box("free", []);
      function moovOf(v, a) {
        const mvhd = fullbox("mvhd", 0, 0, u32(0).concat(
          u32(0), u32(movieTS), u32(movieDur),
          [0x00, 0x01, 0x00, 0x00],
          [0x01, 0x00, 0x00, 0x00],
          [0, 0, 0, 0, 0, 0, 0, 0],
          u32(0x00010000), u32(0), u32(0),
          u32(0), u32(0x40000000), u32(0),
          u32(0), u32(0), u32(0x00010000),
          new Uint8Array(24),
          u32(hasAudio ? 3 : 2)));
        return box("moov", [mvhd, v].concat(a ? [a] : []));
      }
      let moov = moovOf(vTrak, aTrak);
      /* real offsets: [ftyp][free][moov][mdat header][video chunk][audio chunk] */
      const mdatHdr = 8;
      const vidOff = ftyp.length + free.length + moov.length + mdatHdr;
      const audOff = vidOff + vidBytes;
      vTrak = videoTrak(vidOff, 0);
      aTrak = hasAudio ? audioTrak(audOff) : null;
      moov = moovOf(vTrak, aTrak);
      const mdat = box("mdat", video.samples.map((s) => s.d).concat(hasAudio ? audio.samples.map((s) => s.d) : []));
      const parts = [ftyp, free, moov, mdat];
      let total = 0;
      for (const p of parts) total += p.length;
      const out = new Uint8Array(total);
      let o = 0;
      for (const p of parts) { out.set(p, o); o += p.length; }
      return { bytes: out, durationSec: movieDur / movieTS, videoSamples: video.samples.length, audioSamples: hasAudio ? audio.samples.length : 0 };
    }
    return { setVideo: setVideo, setAudio: setAudio, addVideoSample: addVideoSample, addAudioSample: addAudioSample, finalize: finalize };
  }

  /* ---------------- 3. WEBCODECS TRANSCODE (WebM -> universal MP4) -------- */
  function canTranscode() {
    const g = (typeof window !== "undefined") ? window : globalThis;
    if (!g.VideoDecoder || !g.VideoEncoder) return { ok: false, reason: "This browser cannot convert videos (WebCodecs missing). Use Chrome or Edge on your laptop." };
    if (!(typeof window !== "undefined" && window.WebMCues && window.WebMCues.extract)) return { ok: false, reason: "The demuxer is not loaded on this page - reload and try again." };
    return { ok: true };
  }

  async function transcodeToMp4(buf, onProgress) {
    const tell = (stage, frac) => { if (typeof onProgress === "function") { try { onProgress({ stage: stage, frac: frac }); } catch (e) {} } };
    const cap = canTranscode();
    if (!cap.ok) throw new Error(cap.reason);
    const sleep0 = () => new Promise((r) => setTimeout(r, 0));

    tell("demux", 0.02);
    const demux = window.WebMCues.extract(buf);
    if (!demux) throw new Error("Could not read this recording as WebM/Matroska.");
    const vTrack = demux.tracks.find((t) => t.type === 1);
    const aTrack = demux.tracks.find((t) => t.type === 2);
    if (!vTrack) throw new Error("This recording has no video track.");
    const vSamples = demux.samples.get(vTrack.trackNumber) || [];
    if (!vSamples.length) throw new Error("This recording has no video frames.");
    const vCodec = vTrack.codec === "V_VP8" ? "vp8" : "vp09.00.10.08";
    const scale2us = demux.timecodeScale / 1000;      /* timecode units -> microseconds */

    /* pick an H.264 encode profile the device actually supports */
    tell("config", 0.05);
    const probeW = 1280, probeH = 720;
    let encCodec = null;
    for (const c of ["avc1.42E01E", "avc1.4D401F", "avc1.640028"]) {
      try {
        const s = await window.VideoEncoder.isConfigSupported({ codec: c, width: probeW, height: probeH, bitrate: 2_500_000, framerate: 30 });
        if (s && s.supported) { encCodec = c; break; }
      } catch (e) {}
    }
    if (!encCodec) throw new Error("This device has no H.264 encoder available to the browser (needed for universal MP4). The repaired WebM still plays in VLC and Chrome.");

    /* ---- video pipeline ---- */
    const vChunks = [];
    let avcC = null, vDecoded = 0, vDone = false;
    let firstW = 0, firstH = 0;
    const dec = new window.VideoDecoder({
      output: (frame) => {
        if (!firstW) { firstW = frame.displayWidth || frame.codedWidth; firstH = frame.displayHeight || frame.codedHeight; }
        try { enc.encode(frame, { keyFrame: frame._key }); } catch (e) {}
        frame.close();
        vDecoded++;
        if (vDecoded % 30 === 0) tell("video", 0.08 + 0.62 * (vDecoded / vSamples.length));
      },
      error: (e) => { vErr = e; }
    });
    let vErr = null;
    const enc = new window.VideoEncoder({
      output: (chunk, meta) => {
        if (!avcC && meta && meta.decoderConfig && meta.decoderConfig.description) avcC = new Uint8Array(meta.decoderConfig.description.slice ? meta.decoderConfig.description.slice(0) : meta.decoderConfig.description);
        const d = new Uint8Array(chunk.byteLength);
        chunk.copyTo(d);
        vChunks.push({ data: d, ts: chunk.timestamp, dur: chunk.duration || 0, key: chunk.type === "key" });
      },
      error: (e) => { vErr = e; }
    });
    dec.configure({ codec: vCodec });
    enc.configure({ codec: encCodec, width: 1280, height: 720, bitrate: 2_500_000, framerate: 30, latencyMode: "quality" });

    let lastKeyUs = -Infinity;
    for (let i = 0; i < vSamples.length; i++) {
      if (vErr) throw new Error("Video decode failed: " + (vErr.message || vErr));
      const s = vSamples[i];
      const tsUs = Math.round(s.ts * scale2us);
      const frame = new window.EncodedVideoChunk({
        type: s.key ? "key" : "delta",
        timestamp: tsUs,
        data: s.data
      });
      frame._key = s.key || (tsUs - lastKeyUs >= 2000000);    /* force a keyframe at least every 2 s */
      if (frame._key) lastKeyUs = tsUs;
      dec.decode(frame);
      while (enc.encodeQueueSize > 16 || dec.decodeQueueSize > 24) await sleep0();
    }
    await dec.flush();
    dec.close();
    await enc.flush();
    enc.close();
    vDone = true;
    void vDone;
    if (vErr) throw new Error("Video encode failed: " + (vErr.message || vErr));
    if (!vChunks.length) throw new Error("The video encoder produced no frames.");
    tell("video", 0.70);

    /* ---- audio pipeline (best effort: AAC re-encode; honest failure) ---- */
    let aChunks = [], aAsc = null, aChannels = 2, aRate = 48000, audioNote = "";
    if (aTrack && window.AudioDecoder && window.AudioEncoder) {
      tell("audio", 0.72);
      const aSamples = demux.samples.get(aTrack.trackNumber) || [];
      if (aSamples.length && aTrack.codecPrivate && aTrack.codecPrivate.length >= 10) {
        aChannels = aTrack.codecPrivate[9] || 1;
        let aErr = null;
        const aDec = new window.AudioDecoder({
          output: (adata) => { try { aEnc.encode(adata); } catch (e) {} adata.close(); },
          error: (e) => { aErr = e; }
        });
        const aEnc = new window.AudioEncoder({
          output: (chunk, meta) => {
            if (!aAsc && meta && meta.decoderConfig && meta.decoderConfig.description) aAsc = new Uint8Array(meta.decoderConfig.description.slice ? meta.decoderConfig.description.slice(0) : meta.decoderConfig.description);
            const d = new Uint8Array(chunk.byteLength);
            chunk.copyTo(d);
            aChunks.push({ data: d, ts: chunk.timestamp, dur: chunk.duration || 21000 });
          },
          error: (e) => { aErr = e; }
        });
        try {
          const aacOk = await window.AudioEncoder.isConfigSupported({ codec: "mp4a.40.2", sampleRate: 48000, numberOfChannels: aChannels, bitrate: 96000 });
          if (aacOk && aacOk.supported) {
            aDec.configure({ codec: "opus", sampleRate: 48000, numberOfChannels: aChannels, description: aTrack.codecPrivate });
            aEnc.configure({ codec: "mp4a.40.2", sampleRate: 48000, numberOfChannels: aChannels, bitrate: 96000 });
            let ai = 0;
            for (const s of aSamples) {
              if (aErr) break;
              aDec.decode(new window.EncodedAudioChunk({ type: "key", timestamp: Math.round(s.ts * scale2us), data: s.data }));
              if ((++ai & 255) === 0) tell("audio", 0.72 + 0.15 * (ai / aSamples.length));
              while (aEnc.encodeQueueSize > 32 || aDec.decodeQueueSize > 64) await sleep0();
            }
            await aDec.flush(); aDec.close();
            await aEnc.flush(); aEnc.close();
          } else {
            audioNote = "This browser cannot re-encode audio to AAC here; the MP4 was written without an audio track.";
          }
        } catch (e) {
          audioNote = "Audio could not be converted (" + (e && e.message ? e.message : "unknown") + "); the MP4 was written without an audio track.";
        }
      }
    } else if (aTrack) {
      audioNote = "This browser cannot convert audio; the MP4 was written without an audio track.";
    }

    /* ---- mux ---- */
    tell("mux", 0.90);
    const mux = Muxer();
    if (!avcC) throw new Error("The encoder did not report its H.264 configuration.");
    mux.setVideo(avcC, firstW || 1280, firstH || 720);
    const vBase = vChunks.length ? vChunks[0].ts : 0;
    const V_US = 90000 / 1000000;                        /* microseconds -> 90kHz units */
    for (const c of vChunks) mux.addVideoSample(c.data, Math.max(1, Math.round((c.dur || 33333) * V_US)), c.key, Math.round((c.ts - vBase) * V_US));
    if (aAsc && aChunks.length) {
      mux.setAudio(aAsc, aChannels, 48000);
      const aBase = aChunks[0].ts;
      const A_US = 48000 / 1000000;                      /* microseconds -> 48kHz units */
      for (const c of aChunks) mux.addAudioSample(c.data, Math.max(1, Math.round((c.dur || 21000) * A_US)), Math.round((c.ts - aBase) * A_US));
    }
    const out = mux.finalize();
    tell("done", 1);
    return { bytes: out.bytes, durationSec: out.durationSec, videoSamples: out.videoSamples, audioSamples: out.audioSamples, audioNote: audioNote || "" };
  }

  /* ---------------- export ---------------- */
  const g = (typeof window !== "undefined") ? window : globalThis;
  g.MP4Kit = {
    patchMp4Durations: patchMp4Durations,
    Muxer: Muxer,
    transcodeToMp4: transcodeToMp4,
    canTranscode: canTranscode,
    version: "r22-universal-mp4-1"
  };
})();
