/* ============================================================
   ADEWALE CLASSROOM DECK — Live classroom engine (PeerJS / WebRTC)
   100% free: uses the public PeerJS cloud broker + Google STUN.
   No backend server. Teacher is the "hub"; students connect
   directly to the teacher (mesh-star topology).

   Channels:
     • DataConnection  : chat, roster, hand-raise, polls, control
     • MediaConnection : teacher → student  (stage broadcast + teacher cam)
                         student → teacher  (student cam / mic when allowed)
   ============================================================ */
"use strict";

const RTC_PREFIX = "hmg-classdeck-v1-";
const RTC_HANDSHAKE_TIMEOUT = 20000;   /* v13: hotspot ICE is slow — 15s cut off
                                          some phones whose candidates only arrive
                                          after a STUN/TURN timeout round. */

function safeBoardStrokes(raw, maxStrokes = 40) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(-maxStrokes).map((stroke) => {
    if (!stroke || !Array.isArray(stroke.p)) return null;
    const points = stroke.p.slice(0, 1200).map((point) => {
      if (!Array.isArray(point) || point.length < 2) return null;
      const x = Number(point[0]), y = Number(point[1]);
      return Number.isFinite(x) && Number.isFinite(y)
        ? [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))]
        : null;
    }).filter(Boolean);
    if (!points.length) return null;
    const color = /^#[0-9a-f]{3,8}$/i.test(String(stroke.c || "")) ? String(stroke.c) : "#111111";
    const width = Number(stroke.w);
    return { c: color, w: Number.isFinite(width) ? Math.max(1, Math.min(24, width)) : 3, p: points };
  }).filter(Boolean);
}

/* ---------------------------------------------------------------
   ICE / relay configuration (v11 — "students stuck in the lobby" fix)
   ----------------------------------------------------------------
   WHY THIS EXISTS: the classroom is peer-to-peer. When the teacher is
   on a phone/tablet hotspot, devices ON THAT SAME HOTSPOT join via
   local network candidates and always work — but students on the
   internet must cross the carrier's NAT, and on many mobile networks a
   direct path simply does not exist. Without a working TURN relay
   those students retry forever and are told "the class hasn't
   started", which is not true.

   The server list is now assembled at CONNECT TIME, in priority order:
     1. a relay the TEACHER pasted into Settings → Relay (Store key
        "relay_servers") — use this for a Cloudflare/metered.ca TURN
        account (both have free tiers);
     2. a relay baked into this deployment via window.CD_RELAY in
        js/config.js;
     3. the built-in free STUN (Google + Cloudflare) and TURN
        (OpenRelay) fallbacks.
   ---------------------------------------------------------------- */
/* v12: ONE normaliser for every ICE-server shape the real world produces.
   Accepted for a single entry: "urls" or legacy "url", as a STRING or an
   ARRAY of strings. This is what broke the v11 Settings → Relay box: the
   user pasted exactly what their provider gave them —
     • metered.ca "Instructions" JSON  → { "urls": ["turn:…","turns:…"], username, credential }
     • Cloudflare generated credentials → { "iceServers": [ { "urls": ["turn:…"], username, credential } ] }
   and both were refused because v11 only accepted urls as a plain string
   inside a bare array. Never again: parse what the teacher HAS, not what
   we wish they had. */
function cdNormalizeIceEntry(e) {
  if (!e || typeof e !== "object") return null;
  let raw = e.urls !== undefined ? e.urls : (e.url !== undefined ? e.url : null);
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw)) raw = [raw];
  const urls = [];
  for (const u of raw) {
    const s = String(u || "").trim();
    if (!s) continue;
    // tolerate entries pasted without the stun:/turn: scheme by people
    // copying just "host:port" — turn: is the safe assumption for relays
    const withScheme = /^stun:|^turn:|^turns:/i.test(s) ? s : (/^[a-z0-9.-]+:[0-9]+/i.test(s) ? "turn:" + s : null);
    /* v13.2: port-53 alternates (Cloudflare includes them) are REFUSED by
       browsers — Cloudflare's own docs say to filter them. Each one cost
       every student a TURN-gathering timeout. */
    if (withScheme && /:53(\?|$)/.test(withScheme)) continue;
    if (withScheme) urls.push(withScheme);
  }
  if (!urls.length) return null;
  const out = { urls };
  const username = e.username || e.user || "";
  /* v13.2: `credentialType` is a TYPE DESCRIPTOR (e.g. "password" or
     {type:"password"}) — never a secret. Treating it as one produced
     "[object Object]" / "password" as the TURN password and 401s. */
  const credential = e.credential || e.password || "";
  if (username) out.username = String(username);
  if (credential) out.credential = String(credential);
  return out;
}

/* v13.2: strip port-53 TURN/STUN alternates from ANY list. Cloudflare's
   generate-ice-servers response includes them and CLOUDFLARE'S OWN DOCS
   say browsers refuse port 53 — every student paid a gathering timeout
   per :53 URL. Used by the generator, the parser output and the
   collector, so no path can store or run one. */
function cdStripPort53(list) {
  const arr = Array.isArray(list) ? list : [list];
  return arr
    .map((e) => {
      if (typeof e === "string")
        return /:53(\?|$)/.test(e) ? null : e;    /* bare "turn:host:53" strings */
      if (!e || typeof e !== "object") return e;
      const raw = e.urls !== undefined ? e.urls : (e.url !== undefined ? e.url : null);
      if (raw === null || raw === undefined) return e;
      const keep = (Array.isArray(raw) ? raw : [raw]).filter((u) => !/:53(\?|$)/.test(String(u || "")));
      const out2 = {};
      for (const k of Object.keys(e)) out2[k] = e[k];
      out2.urls = keep;
      return out2;
    })
    .filter((e) => e === null ? false : (typeof e === "string" ? e.length > 0 : (e && typeof e === "object" && (e.urls === undefined || (Array.isArray(e.urls) ? e.urls.length > 0 : String(e.urls).length > 0)))));
}

/* v12: parse ANYTHING a teacher might paste into Settings → Relay.
   Returns { ok, servers[], warnings[], detected, note, json, summary }.
   Shapes understood (all verified against real provider output):
     1. [ {urls:"turn:…", username, credential}, … ]                 (classic array)
     2. { urls:["turn:…",…], username, credential }                  (metered.ca single object)
     3. { iceServers: [ … ] }                                        (Cloudflare response / config.js CD_RELAY)
     4. { result: { iceServers: [ … ] } }                            (Cloudflare API raw response)
     5. [ {url:"turn:…"} ]                                           (legacy "url" key)
     6. plain text:  turn:host:port|user|pass  (one per line, or comma separated;
                       username/password optional)
     7. A Cloudflare TURN KEY {tokenId/token/id, apiToken/secret,…} — detected
        and EXPLAINED (it is not a credential; use the generator in Settings).
*/
function cdParseRelayInput(raw) {
  const out = { ok: false, servers: [], warnings: [], detected: "", note: "", json: "", summary: "" };
  const text = String(raw == null ? "" : raw).trim();
  if (!text) { out.note = "Nothing to save — paste credentials from Cloudflare or metered.ca, or leave empty to use the built-in free servers."; return out; }

  const addEntry = (e, origin) => {
    const n = cdNormalizeIceEntry(e);
    if (!n) return false;
    n._origin = origin || "";
    out.servers.push(n);
    return true;
  };
  const finish = () => {
    if (!out.servers.length) {
      out.ok = false;
      if (!out.note) out.note = "No usable stun:/turn:/turns: server found in what you pasted.";
      return out;
    }
    const turn = out.servers.filter((s) => s.urls.some((u) => /^turn/i.test(u)));
    const stun = out.servers.length - turn.length;
    if (!turn.length) out.warnings.push("Only STUN servers found. STUN helps most networks, but a TURN relay (with username + credential) is what gets students through strict mobile networks.");
    for (const t of turn) {
      if (!t.username || !t.credential) {
        out.warnings.push("A turn: server has no username/credential — most TURN providers reject that. OpenRelay-style open servers are the exception.");
        break;
      }
    }
    // canonical stored form: array of {urls:[…], username?, credential?}
    out.json = JSON.stringify(out.servers.map((s) => {
      const o = { urls: s.urls };
      if (s.username) o.username = s.username;
      if (s.credential) o.credential = s.credential;
      return o;
    }));
    out.ok = true;
    out.summary = turn.length + " TURN + " + stun + " STUN server" + (out.servers.length > 1 ? "s" : "") + (out.detected ? " (" + out.detected + ")" : "");
    return out;
  };

  let data = null;
  try { data = JSON.parse(text); } catch (e) { data = null; }

  if (data !== null && data !== undefined) {
    let node = data;
    if (!Array.isArray(node) && typeof node === "object") {
      if (node.result && (Array.isArray(node.result.iceServers) || node.result.urls)) { node = node.result; out.detected = "Cloudflare API response"; }
      else if (Array.isArray(node.iceServers)) { node = node.iceServers; out.detected = out.detected || "iceServers wrapper"; }
      else if (Array.isArray(node.servers)) { node = node.servers; out.detected = out.detected || "servers wrapper"; }
    }
    if (Array.isArray(node)) {
      out.detected = out.detected || "JSON array";
      for (const e of node) addEntry(e, "pasted");
      if (!out.servers.length && node.length && typeof node[0] === "object") {
        // maybe a bare single entry pasted inside brackets? try the object itself
        addEntry(node, "pasted");
      }
    } else if (node && typeof node === "object") {
      if (addEntry(node, "pasted")) out.detected = "single object (metered.ca style)";
      else {
        const id = node.tokenId || node.token_id || node.keyId || node.key_id || node.id;
        const tok = node.apiToken || node.api_token || node.token || node.secret;
        if (id && tok) {
          out.detected = "Cloudflare TURN KEY";
          out.note = "You pasted a Cloudflare TURN KEY (Token ID + API token). That key is NOT a username/password — Cloudflare refuses it as a credential. Use the “⚡ Generate from Cloudflare key” box in Settings → Relay: it converts the key into real TURN credentials for you.";
          return out;
        }
      }
    }
    return finish();
  }

  /* plain-text:  turn:host:port|user|pass   or  turn:host:port user pass
     or  turn:host:port,user,pass  — one per line or comma-separated.
     A scheme-less  host:port  is treated as turn: (nobody pastes a bare
     STUN host by accident; relays are what people are pasting). */
  const chunks = text.split(/[\n,]+/).map((l) => l.trim()).filter(Boolean);
  let matched = 0;
  for (const line of chunks) {
    const m = line.match(/^(?:(stun|turn|turns):)?([a-z0-9][a-z0-9.-]*:[0-9]{2,5}(?:[^\s|,]*))(?:[\s|,]+([^\s|,]+)(?:[\s|,]+([^\s|,]+))?)?$/i);
    if (!m) continue;
    matched++;
    const e = { urls: (m[1] || "turn").toLowerCase() + ":" + m[2] };
    if (m[3]) e.username = m[3];
    if (m[4]) e.credential = m[4];
    addEntry(e, "plain-text");
  }
  if (matched) { out.detected = "plain text"; return finish(); }
  out.note = "That is neither JSON nor a server list. Paste the credentials exactly as your provider shows them — see the examples under the box, or open the setup guide (docs/JOIN_TROUBLESHOOTING_GUIDE.md).";
  return out;
}

function cdCollectIceServers() {
  const servers = [];
  const seen = new Set();
  const pushAll = (list, origin) => {
    const arr = Array.isArray(list) ? list : [list];
    for (const e of arr) {
      const s = cdNormalizeIceEntry(e);
      if (!s) continue;
      const key = s.urls.join("|") + "::" + (s.username || "");
      if (seen.has(key)) continue;
      seen.add(key);
      const entry = { urls: s.urls };
      if (s.username) entry.username = s.username;
      if (s.credential) entry.credential = s.credential;
      servers.push(entry);
    }
  };
  /* teacher-entered relay — parsed with the SAME tolerant parser the Settings
     box uses, so what validated at save time is exactly what runs at connect
     time (v12 fix: urls-as-array used to be silently dropped HERE too). */
  const teacherRaw = Store.get("relay_servers", "");
  if (teacherRaw && teacherRaw.trim()) {
    /* v13.2: Cloudflare TURN credentials EXPIRE (the ttl chosen when they
       were generated). An expired set 401s every student that needs the
       relay — worse than no relay at all, because it sits at the FRONT of
       the list and burns TURN-handshake time before failing. The teach.js
       generator stores the expiry alongside; honour it: expired → skip the
       teacher relay entirely and fall back to the free built-ins below. */
    const exp = Number(Store.get("relay_expiry", 0)) || 0;
    const stillFresh = !exp || Date.now() < exp - 5 * 60 * 1000;   /* 5-min safety margin */
    if (stillFresh) {
      const parsed = cdParseRelayInput(teacherRaw);
      if (parsed.ok) pushAll(parsed.servers, "teacher");
    }
  }
  if (window.CD_RELAY) {
    if (Array.isArray(window.CD_RELAY.iceServers)) pushAll(window.CD_RELAY.iceServers, "config");
    else pushAll(window.CD_RELAY, "config");
  }
  pushAll([
    { urls: ["stun:stun.l.google.com:19302"] },
    { urls: ["stun:stun.cloudflare.com:3478"] },
    { urls: ["stun:stun.relay.metered.ca:80"] }
  ], "builtin");
  /* v13.2: the OpenRelay public TURN entries (openrelayproject /
     openrelayproject @ openrelay.metered.ca) were REMOVED. OpenRelay now
     requires an account + API key; the old shared credentials answer 401,
     and five dead relays cost every join seconds of ICE-gathering
     timeouts — the exact "hotspot student stuck without relay setup"
     symptom. Zero-signup public TURN no longer exists in 2026 (Cloudflare
     TURN needs generated credentials; metered.ca needs an account).
     The honest self-contained stack is therefore:
       • built-in free STUN above (direct paths, works on mobile data),
       • the teacher's ONE-TIME Cloudflare relay (⚙ Settings → Relay) —
         now AUTO-RENEWED by teach.js before it can ever expire — whose
         tcp:80 / turns:443 entries pass hotspot and DPI blocks,
       • transport memory (v13.1) so hotspot devices lead with the
         TCP/TLS route of whatever relay IS present. */
  /* v13 ADAPTIVE TRANSPORT: the student join loop sets window.__cdPreferTcp
     once the first attempt fails — every retry then puts TCP/TLS relays at
     the TOP of the list, so a UDP-blocking hotspot gets a TCP path on the
     very next try instead of repeating the same failure. ICE still tries
     every server; only the gathering/priority order changes.
     v13.1 TRANSPORT MEMORY: a device that ever needed the TCP/TLS route
     (Wi-Fi hotspot, no mobile data of its own) remembers it in Store
     ("ice_pref" = "tcp") and starts with it already preferred — the doomed
     UDP-first attempt is skipped entirely on every future class. */
  const preferTcp = (typeof window !== "undefined" && window.__cdPreferTcp) ||
                    (Store.get("ice_pref", "") === "tcp");
  if (preferTcp) {
    const isTcpish = (s) => s.urls.some((u) => /^turns:/i.test(u) || /transport=tcp/i.test(u));
    const tcp = servers.filter(isTcpish), rest = servers.filter((s) => !isTcpish(s));
    return tcp.concat(rest);
  }
  return servers;
}
function peerConfig() {
  return {
    debug: 1,
    config: { iceCandidatePoolSize: 6, iceServers: cdCollectIceServers() }
  };
}
/* Back-compat alias: older code (and the WHIP relay publisher) still
   reads PEER_CONFIG.config. */
const PEER_CONFIG = { get config() { return peerConfig().config; } };

/* ============================================================
   TEACHER SIDE
   ============================================================ */
class TeacherRoom {
  constructor(roomCode, opts = {}) {
    this.code = roomCode;
    this.massUrl = opts.massUrl || null;
    this.onEvent = opts.onEvent || (() => {});       // (type, payload)
    this.stageStream = null;                          // composed canvas + mic
    this.camStream = null;                            // teacher camera
    this.students = new Map();                        // peerId -> {conn, name, joinedAt, hand, mediaCalls:[]}
    this.attendance = [];                             // {name, event, time}
    this.activePoll = null;
    this.peer = null;
    this.locked = false;
    this.waitingRoom = false;                         // v4: Zoom-style waiting room
    this.autoAdmitRejoin = false;                    // enterprise: let previously admitted students re-enter after teacher resume
    this.pending = new Map();                         // v4: peers awaiting admission
    this.pin = "";                                    // v3: optional room PIN
    this.inviteToken = "";                            // v3 security: optional signed invite-token gate
    this.boardsOn = false;                            // v8: student whiteboards
    this.activity = null;                             // v8: open/cloud/exit activity
    this.groups = null;                               // v8: group assignments
    this.activeQuiz = null;                           // v3: quiz engine
    this.stageCalls = new Map();                      // enterprise fix: close old teacher→student stage calls when switching source
    this._permMem = new Map();                        // v9: permission memory by student name — survives reconnects
    this.camCalls = new Map();                        // enterprise fix: close old teacher camera calls cleanly
    this.stats = { start: 0, peak: 0, joins: 0, chats: 0, polls: [], quizzes: [], reactions: 0, hands: 0, captions: 0 }; // analytics
    this._reconnectTimer = null;
    this._startTimer = null;
    this._ended = false;
    /* v12 SCALE PACK ("hundreds of students"):
       • maxStudents — hard cap with an honest "class full" message (the
         browser itself struggles far beyond ~300 peer connections);
       • relayMode + captains — instead of the teacher uploading one video
         stream per student (impossible for 100+ on any uplink), a few
         well-connected students ("class captains") re-serve the stage to
         small groups. Teacher uplink stays constant no matter the class
         size; data (chat/polls/boards) still flows teacher↔student direct,
         which is cheap;
       • staggered rtt pings — power the 📶 badges the teacher sees and pick
         the best-connected captains. */
    this.maxStudents = 300;
    this.relayMode = false;
    this.captains = new Map();       // teacherPeerId -> {id, stu, capacity, children:Set}
    this._capSeq = 0;
    this.captainCapacity = 8;        /* streams each captain re-serves (~1.2 Mbps) */
    this._pingTimer = null;
    this._pingCursor = 0;
    this._rosterTimer = null;        // v12: debounce roster broadcasts during mass joins
  }

  start() {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(this._startTimer);
        this._startTimer = null;
        fn(value);
      };
      const fail = (message) => finish(reject, new Error(message));
      this._ended = false;
      this._startTimer = setTimeout(() => {
        fail("The classroom signalling service did not respond. Check your internet connection and try again.");
      }, RTC_HANDSHAKE_TIMEOUT);
      try {
        this.peer = new Peer(RTC_PREFIX + this.code + "-host", PEER_CONFIG);
      } catch (e) {
        fail((e && e.message) || "Could not start the classroom engine.");
        return;
      }
      this.peer.on("open", () => {
        if (settled || this._ended) return;
        try {
          this.stats.start = Date.now();
          this._wire();
          this._startPingSweep();
          finish(resolve);
        } catch (e) {
          fail((e && e.message) || "Could not initialise the classroom engine.");
        }
      });
      this.peer.on("error", (err) => {
        if (err && err.type === "peer-unavailable") return; // a student may have left
        if (!settled) {
          this.onEvent("error", err);
          if (err && err.type === "unavailable-id") fail("Room code already in use — generate a new one.");
          else fail((err && err.message) || "The classroom signalling service returned an error.");
        } else this.onEvent("error", err);
      });
      this.peer.on("disconnected", () => {
        if (this._ended) return;
        this.onEvent("signal", { state: "reconnecting" });
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = setTimeout(() => {
          if (!this._ended) { try { this.peer.reconnect(); } catch {} }
        }, 1500);
      });
    });
  }

  _wire() {
    // Students open a data connection first.
    this.peer.on("connection", (conn) => {
      /* v11 join-failure visibility: PeerJS fires "connection" the moment
         the offer arrives, but the data channel only opens once the
         direct/relay path is established. If it NEVER opens, the student
         is sitting on the join page being told "the class hasn't
         started" — which is false — and the teacher previously saw
         nothing at all. Watch every incoming connection and report the
         ones that die before opening. */
      const attemptName = String((conn.metadata && conn.metadata.name) || "Someone").slice(0, 40);
      let opened = false;
      const reportBlocked = (why) => {
        if (opened || this._ended || this.locked || this._blockedSeen && this._blockedSeen.has(conn.peer)) return;
        if (!this._blockedSeen) this._blockedSeen = new Set();
        this._blockedSeen.add(conn.peer);
        this.attendance.push({ name: attemptName, event: "join-blocked", time: nowStamp() });
        this.onEvent("join-blocked", { name: attemptName, reason: why });
      };
      const watch = setTimeout(() => {
        if (!opened) reportBlocked("The direct connection to this student's device was never established (20s) — most likely a network/NAT restriction.");
      }, 20000);
      conn.on("open", () => {
        opened = true;
        clearTimeout(watch);
        /* v12: an honest, retryable "class full" answer — never a silent
           drop, and never counted as a join-block. */
        if (this.maxStudents && this.students.size >= this.maxStudents) {
          try { conn.send({ t: "classfull", max: this.maxStudents }); } catch {}
          setTimeout(() => { try { conn.close(); } catch {} }, 600);
          this.attendance.push({ name: attemptName, event: "class-full", time: nowStamp() });
          this.onEvent("class-full", { name: attemptName, max: this.maxStudents });
          return;
        }
        if (this.locked) {
          conn.send({ t: "rejected", reason: "Room is locked by the teacher." });
          setTimeout(() => conn.close(), 400);
          return;
        }
        const meta = conn.metadata || {};
        if (this.pin && String(meta.pin || "") !== this.pin) {   // v3: PIN gate
          conn.send({ t: "rejected", reason: "Wrong class PIN. Ask your teacher for the correct PIN." });
          setTimeout(() => conn.close(), 400);
          return;
        }
        if (this.inviteToken && String(meta.tok || "") !== this.inviteToken) { // v3: secure invite links
          conn.send({ t: "rejected", reason: "This class requires the secure invite link from your teacher." });
          setTimeout(() => conn.close(), 400);
          return;
        }
        const name = (meta.name || "Student").slice(0, 40);
        const isRejoin = !!meta.rejoin;
        /* Enterprise resume fix: when the teacher accidentally leaves and resumes the SAME room,
           students that were already inside auto-reconnect instead of being trapped in the lobby. */
        if (this.waitingRoom && !(this.autoAdmitRejoin && isRejoin)) {
          this.pending.set(conn.peer, { conn, name });
          conn.send({ t: "waiting" });
          this.onEvent("waiting", { peerId: conn.peer, name });
          return;
        }
        this._admit(conn, name);
      });
      conn.on("data", (d) => this._onData(conn, d));
      conn.on("close", () => {
        if (!opened) reportBlocked("The connection to this student's device closed before it could open (network restriction).");
        opened = true; clearTimeout(watch);
        this.pending.delete(conn.peer); this._dropStudent(conn.peer);
      });
      conn.on("error", () => {
        if (!opened) reportBlocked("The connection to this student's device failed before it could open (network restriction).");
        opened = true; clearTimeout(watch);
        this.pending.delete(conn.peer); this._dropStudent(conn.peer);
      });
    });

    // Students may call us back with their camera / mic.
    this.peer.on("call", (call) => {
      const kind = (call.metadata && call.metadata.kind) || "stucam";
      const stu = this.students.get(call.peer);
      // Do not accept media from a peer that has not been admitted.
      if (!stu) { try { call.close(); } catch {} return; }
      // Mic permission is enforced on the teacher side; UI-only checks are not enough.
      if (kind === "stumic" && !stu.micAllowed) { try { call.close(); } catch {} return; }
      call._hmgKind = kind;
      call.answer(); // receive-only
      call.on("stream", (stream) => {
        this.onEvent("student-media", { peerId: call.peer, name: stu.name, kind, stream });
      });
      call.on("close", () => this.onEvent("student-media-end", { peerId: call.peer, kind }));
      stu.mediaCalls.push(call);
    });
  }

  /* v4: admit a student (directly, or from the waiting room) */
  _admit(conn, name) {
    const stu = { conn, name, joinedAt: Date.now(), hand: false, micAllowed: false, mediaCalls: [], score: 0 };
    /* v9: if this student had mic permission before a network blip / reload,
       re-apply it automatically so the teacher never has to re-click. */
    const permKey = String(name || "").trim().toLowerCase();
    const mem = this._permMem.get(permKey);
    if (mem && mem.micAllowed) stu.micAllowed = true;
    this.students.set(conn.peer, stu);
    this.attendance.push({ name, event: "joined", time: nowStamp() });
    this.stats.joins++;
    this.stats.peak = Math.max(this.stats.peak, this.students.size);
    conn.send({ t: "welcome", roomName: this.roomName || this.code, count: this.students.size, rejoined: !!(conn.metadata && conn.metadata.rejoin) });
    if (stu.micAllowed) { try { conn.send({ t: "micAllow", on: true }); } catch {} }
    this._broadcastRoster();
    this.onEvent("student-joined", { peerId: conn.peer, name });
    
    // Mass Broadcast URL - push embedded iframe string if provided
    if (this.massUrl) {
      conn.send({ t: "mass_broadcast", url: this.massUrl });
      return; // Skip sending heavy WebRTC Media Streams!
    }

    /* v12: media routing. With relayMode ON the newcomer is handed to a
       class captain (their device re-serves the stage to a small group) —
       unless the captain pool is full, in which case this student either
       BECOMES a captain or falls back to a direct call. Fail-open: any
       captain error degrades to direct, never to "no video". */
    if (this.relayMode && (this.stageStream || this.camStream) && !this.captains.has(conn.peer)) {
      const assigned = this._assignChild(conn.peer);
      if (assigned) {
        if (this.activePoll)  conn.send({ t: "poll", poll: this.activePoll.def });
        if (this.activeQuiz)  conn.send({ t: "quiz", quiz: this._quizPublicDef() });
        return;                      // media comes from the captain, not from us
      }
      if (this.captains.size < this.maxCaptains && this.students.size > 1) {
        this._promoteCaptain(conn.peer);   // new captain → gets direct calls below
      }
      // captains or fallback: fall through and call directly
    }
    // push current stage + cam to the newcomer
    if (this.stageStream) this._callStudent(conn.peer, this.stageStream, "stage");
    if (this.camStream)   this._callStudent(conn.peer, this.camStream, "teachercam");
    if (this.activePoll)  conn.send({ t: "poll", poll: this.activePoll.def });
    if (this.activeQuiz)  conn.send({ t: "quiz", quiz: this._quizPublicDef() });
  }

  /* v4: waiting-room controls */
  setWaitingRoom(v) {
    const wasOn = this.waitingRoom;
    this.waitingRoom = !!v;
    // Turning the lobby off must not strand people who are already waiting.
    if (wasOn && !this.waitingRoom) this.admitAll();
  }
  admit(peerId) {
    const p = this.pending.get(peerId);
    if (!p) return;
    this.pending.delete(peerId);
    p.conn.send({ t: "admitted" });
    this._admit(p.conn, p.name);
  }
  admitAll() { for (const pid of [...this.pending.keys()]) this.admit(pid); }
  deny(peerId) {
    const p = this.pending.get(peerId);
    if (!p) return;
    this.pending.delete(peerId);
    try { p.conn.send({ t: "rejected", reason: "The teacher did not admit you." }); } catch {}
    setTimeout(() => { try { p.conn.close(); } catch {} }, 300);
  }

  /* v4: Zoom/Meet-style extras */
  muteAllStudents() {
    for (const [, stu] of this.students) {
      stu.micAllowed = false;
      const permKey = String(stu.name || "").trim().toLowerCase();
      if (permKey) this._permMem.set(permKey, { micAllowed: false }); // v9 keep memory in sync
      for (const call of stu.mediaCalls.filter((c) => c._hmgKind === "stumic")) {
        try { call.close(); } catch {}
      }
      try { stu.conn.send({ t: "micAllow", on: false }); } catch {}
    }
  }
  spotlight(peerId, name) {     // tell everyone whose turn it is (shows banner)
    this.broadcast({ t: "spotlight", name });
  }

  _onData(conn, d) {
    const stu = this.students.get(conn.peer);
    if (!stu || !d || typeof d !== "object") return;
    switch (d.t) {
      case "chat": {
        this.stats.chats++;                                      // v3: analytics
        const text = String(d.text).slice(0, 1000);
        /* v5: private chat — student → teacher only (not relayed to class) */
        if (d.private) {
          this.onEvent("chat", { from: stu.name, text, private: true, peerId: conn.peer });
        } else {
          this.onEvent("chat", { from: stu.name, text });
          this.broadcast({ t: "chat", from: stu.name, text }, conn.peer);
        }
        break;
      }
      case "quizAnswer": {                                       // v3: quiz engine
        const q = this.activeQuiz;
        if (!q || q.answered.has(conn.peer)) break;
        const qi = q.index;
        const answer = Number(d.answer);
        if (Number(d.qIndex) !== qi || !Number.isInteger(answer) || answer < 0 || answer >= q.def.questions[qi].options.length) break;
        q.answered.add(conn.peer);
        const correct = answer === q.def.questions[qi].correct;
        if (correct) {
          // speed bonus: full 100 if instant, decays to 50 over the time limit
          const elapsed = (Date.now() - q.askedAt) / 1000;
          const frac = Math.min(1, elapsed / (q.def.secondsPerQ || 30));
          const pts = Math.round(100 - 50 * frac);
          stu.score = (stu.score || 0) + pts;
          q.scores.set(conn.peer, (q.scores.get(conn.peer) || 0) + pts);
        }
        q.tally[qi][answer] = (q.tally[qi][answer] || 0) + 1;
        conn.send({ t: "quizFeedback", correct, correctIndex: q.def.questions[qi].correct,
                    explanation: q.def.questions[qi].explanation || "" });   /* v6 */
        this.onEvent("quiz-progress", this.quizProgress());
        break;
      }
      case "hand":
        stu.hand = !!d.up;
        if (stu.hand) this.stats.hands++;
        this.onEvent("hand", { peerId: conn.peer, name: stu.name, up: stu.hand });
        this._broadcastRoster();
        break;
      case "reaction": {  // v4: emoji reactions (👍 ❤ 😂 🎉 😮 👏)
        const emo = String(d.emoji).slice(0, 4);
        this.stats.reactions++;
        this.onEvent("reaction", { name: stu.name, emoji: emo });
        this.broadcast({ t: "reaction", name: stu.name, emoji: emo }, conn.peer);
        break;
      }
      case "pollAnswer":
        if (this.activePoll && !this.activePoll.voted.has(conn.peer)) {
          const i = Number(d.index);
          if (i >= 0 && i < this.activePoll.counts.length) {
            this.activePoll.counts[i]++;
            this.activePoll.voted.add(conn.peer);
            this.onEvent("poll-update", this.pollResults());
          }
        }
        break;
      case "ping":
        conn.send({ t: "pong", time: Date.now() });
        break;
      case "tpong": {   /* v12: rtt for 📶 badges + captain selection */
        const rtt = Date.now() - Number(d.t0);
        if (Number.isFinite(rtt) && rtt >= 0) stu.rtt = Math.round(rtt);
        break;
      }
      case "relayDown": {   /* v12: my captain vanished — reroute me */
        if (this.relayMode) this._reassignChild(conn.peer);
        break;
      }
      case "screenNack":   /* v9: student device cannot capture its screen */
        this.onEvent("screen-nack", { name: stu.name, reason: String(d.reason || "").slice(0, 120) });
        break;
      case "permQuery":    /* v9: rejoined student re-syncs mic permission */
        try { stu.conn.send({ t: "micAllow", on: !!stu.micAllowed }); } catch {}
        break;
      case "boardStrokes": {   /* v8: student whiteboard sync */
        if (!this.boardsOn) break;
        const strokes = safeBoardStrokes(d.strokes);
        this.onEvent("board-strokes", { peerId: conn.peer, name: stu.name,
          strokes, full: !!d.full });
        break;
      }
      case "activityResp": {   /* v8: activity answer */
        if (!this.activity) break;
        let resp = d.resp;
        if (typeof resp === "string") resp = resp.slice(0, 280);
        else if (resp && typeof resp === "object") resp = {
          rating: Math.max(1, Math.min(5, Number(resp.rating) || 3)),
          learned: String(resp.learned || "").slice(0, 280),
          confusing: String(resp.confusing || "").slice(0, 280)
        };
        else resp = String(resp || "").slice(0, 280);
        this.activity.responses.set(conn.peer, { name: stu.name, resp, at: Date.now() });
        this.onEvent("activity-resp", { name: stu.name, resp, count: this.activity.responses.size });
        break;
      }
    }
  }

  /* v12: a captain left — its children must be re-homed instantly. */
  _reassignChild(peerId) {
    const stu = this.students.get(peerId);
    if (!stu) return;
    for (const c of this.captains.values()) c.children.delete(peerId);
    stu.captain = null;
    if (!this.relayMode) return;
    if (this.captains.size < this.maxCaptains && this.students.size > 1) {
      /* no captain has a slot → this student may become one themselves */
      const assigned = this._assignChild(peerId);
      if (!assigned) this._promoteCaptain(peerId);
    } else if (!this._assignChild(peerId)) {
      try { stu.conn.send({ t: "relay-direct" }); } catch {}
      if (this.stageStream) this._callStudent(peerId, this.stageStream, "stage");
      if (this.camStream)   this._callStudent(peerId, this.camStream, "teachercam");
    }
  }

  _dropStudent(peerId) {
    // During an intentional end keep the final roster/leaderboard available
    // for exports until the page is reloaded.
    if (this._ended) return;
    const stu = this.students.get(peerId);
    if (!stu) return;
    /* v12: if this student was a captain, rescue its children FIRST */
    const cap = this.captains.get(peerId);
    if (cap) {
      this.captains.delete(peerId);
      for (const childPid of [...cap.children]) {
        const child = this.students.get(childPid);
        if (!child) continue;
        cap.children.delete(childPid);
        try { child.conn.send({ t: "relay-down-nudge" }); } catch {}
        this._reassignChild(childPid);
      }
    } else if (stu.captain) {
      for (const c of this.captains.values()) c.children.delete(peerId);
    }
    /* v5 bug-fix: close lingering media calls (was a memory/connection leak) */
    for (const call of stu.mediaCalls) { try { call.close(); } catch {} }
    try { const c = this.stageCalls.get(peerId); if (c) c.close(); } catch {}
    try { const c = this.camCalls.get(peerId); if (c) c.close(); } catch {}
    this.stageCalls.delete(peerId); this.camCalls.delete(peerId);
    this.attendance.push({ name: stu.name, event: "left", time: nowStamp() });
    this.students.delete(peerId);
    this._broadcastRoster();
    this.onEvent("student-left", { peerId, name: stu.name });
  }

  _callStudent(peerId, stream, kind) {
    if (!stream) return null;
    const map = kind === "stage" ? this.stageCalls : (kind === "teachercam" ? this.camCalls : null);
    if (map && map.get(peerId)) { try { map.get(peerId).close(); } catch {} map.delete(peerId); }
    try {
      const call = this.peer.call(peerId, stream, { metadata: { kind } });
      const stu = this.students.get(peerId);
      if (stu) stu.mediaCalls.push(call);
      if (map) {
        map.set(peerId, call);
        const clear = () => { if (map.get(peerId) === call) map.delete(peerId); };
        call.on("close", clear); call.on("error", clear);
      }
      return call;
    } catch (e) { console.warn("call failed", e); return null; }
  }

  /* ------------------------------------------------------------
     v12 CLASS CAPTAINS (large-class relay tree)
     ------------------------------------------------------------ */
  captainPeerId(n) { return RTC_PREFIX + this.code + "-cap-" + n; }
  /* v12: the captain pool must SCALE WITH THE CLASS. A fixed cap (the first
     draft used 12 → 96 covered) silently overflows hundreds of students back
     onto direct teacher calls — the exact uplink killer captains exist to
     prevent. ceil(n/8)+2 captains, hard ceiling 60 (480 capacity — beyond
     any single teacher device anyway). */
  get maxCaptains() {
    return Math.min(60, Math.max(12, Math.ceil(this.students.size / this.captainCapacity) + 2));
  }

  /* pick the least-loaded captain with a free slot */
  _assignChild(peerId) {
    let best = null;
    for (const c of this.captains.values()) {
      if (c.children.has(peerId)) return c;                 // already assigned
      if (c.children.size < c.capacity && (!best || c.children.size < best.children.size)) best = c;
    }
    if (!best) return false;
    best.children.add(peerId);
    const stu = this.students.get(peerId);
    if (stu) stu.captain = best.id;
    try { stu.conn.send({ t: "relay-parent", id: best.id }); } catch {}
    /* the teacher must stop feeding this student directly (uplink!) */
    this._closeDirectMedia(peerId);
    this.onEvent("captain-assign", { peerId, captainId: best.id, captainName: best.stu ? best.stu.name : "?" });
    return true;
  }
  _closeDirectMedia(peerId) {
    try { const c = this.stageCalls.get(peerId); if (c) c.close(); } catch {}
    try { const c = this.camCalls.get(peerId); if (c) c.close(); } catch {}
    this.stageCalls.delete(peerId); this.camCalls.delete(peerId);
  }
  _promoteCaptain(peerId) {
    if (this.captains.has(peerId)) return null;
    const stu = this.students.get(peerId);
    if (!stu) return null;
    const id = ++this._capSeq;
    const cap = { id, stu, capacity: this.captainCapacity, children: new Set() };
    this.captains.set(peerId, cap);
    stu.captain = id;
    try { stu.conn.send({ t: "relay-promote", id }); } catch {}
    /* a captain needs the stage itself — make sure the direct call exists */
    if (this.stageStream) this._callStudent(peerId, this.stageStream, "stage");
    if (this.camStream) this._callStudent(peerId, this.camStream, "teachercam");
    this.onEvent("captain-promoted", { peerId, name: stu.name, captainId: id });
    return cap;
  }
  /* v12: choose captains by measured connection quality (rtt), fall back to
     join order — an early, well-connected student is the best relay. */
  _bestCaptainCandidates(n) {
    const arr = [...this.students.values()].filter((s) => !this.captains.has(this._peerIdOf(s)));
    const withRtt = arr.filter((s) => typeof s.rtt === "number");
    withRtt.sort((a, b) => a.rtt - b.rtt);
    const ordered = withRtt.concat(arr.filter((s) => typeof s.rtt !== "number"));
    return ordered.slice(0, n);
  }
  _peerIdOf(stu) { for (const [pid, s] of this.students) if (s === stu) return pid; return null; }
  _promoteCaptainsAsNeeded() {
    const wanted = Math.min(this.maxCaptains, Math.max(1, Math.ceil(this.students.size / this.captainCapacity)));
    let guard = 0;
    while (this.captains.size < wanted && guard++ < 50) {
      const cand = this._bestCaptainCandidates(1)[0];
      if (!cand) break;
      const pid = this._peerIdOf(cand);
      if (!pid || !this._promoteCaptain(pid)) break;
    }
  }
  _demoteAllCaptains() {
    for (const [pid] of [...this.captains]) {
      const stu = this.students.get(pid);
      if (stu) { stu.captain = null; try { stu.conn.send({ t: "relayMode", on: false }); } catch {} }
      this.captains.delete(pid);
    }
  }
  setRelayMode(on) {
    this.relayMode = !!on;
    if (this.relayMode) {
      this._promoteCaptainsAsNeeded();
      /* route EXISTING students: keep direct calls only to captains */
      for (const pid of [...this.students.keys()]) {
        if (this.captains.has(pid)) continue;
        this._assignChild(pid);
      }
    } else {
      this._demoteAllCaptains();
      this.broadcast({ t: "relayMode", on: false });
      for (const pid of this.students.keys()) {
        if (this.stageStream) this._callStudent(pid, this.stageStream, "stage");
        if (this.camStream)   this._callStudent(pid, this.camStream, "teachercam");
      }
    }
    this.onEvent("relay-mode", { on: this.relayMode, captains: this.captains.size });
    return this.captains.size;
  }
  captainInfo() {
    return {
      on: this.relayMode,
      captains: this.captains.size,
      capacity: this.captains.size * 8,
      maxCaptains: this.maxCaptains,
      students: this.students.size,
      maxStudents: this.maxStudents
    };
  }

  /* v12: staggered health pings — ≤25 students per sweep so a 300-student
     room is covered in ~2.5 min without ever bursting. */
  _startPingSweep() {
    clearInterval(this._pingTimer);
    this._pingTimer = setInterval(() => {
      if (this._ended) return;
      const pids = [...this.students.keys()];
      const slice = pids.slice(this._pingCursor, this._pingCursor + 25);
      this._pingCursor = this._pingCursor + 25 >= pids.length ? 0 : this._pingCursor + 25;
      for (const pid of slice) {
        const stu = this.students.get(pid);
        if (stu) { try { stu.conn.send({ t: "tping", t0: Date.now() }); } catch {} }
      }
    }, 8000);
  }

  /* ----- broadcast helpers ----- */
  broadcast(msg, exceptPeer) {
    for (const [pid, stu] of this.students) {
      if (pid === exceptPeer) continue;
      try { stu.conn.send(msg); } catch {}
    }
  }
  _broadcastRoster() {
    const roster = Array.from(this.students.values()).map((s) => ({ name: s.name, hand: s.hand }));
    this.onEvent("roster", roster);           // local UI immediately…
    /* v12: …but throttle the NETWORK broadcast. With 200 students joining
       in two minutes the old per-join broadcast was O(n²) messages and
       self-DOSed the teacher's uplink. 400ms trailing debounce is
       imperceptible to humans and collapses join storms. */
    clearTimeout(this._rosterTimer);
    this._rosterTimer = setTimeout(() => {
      if (this._ended) return;
      this.broadcast({ t: "roster", roster, count: roster.length });
    }, 400);
  }

  /* ----- stage / camera ----- */
  setStageStream(stream) {
    this.stageStream = stream;
    if (!stream) {
      for (const c of this.stageCalls.values()) { try { c.close(); } catch {} }
      this.stageCalls.clear();
      return;
    }
    /* v12: in relay mode the teacher only feeds captains; captains push the
       new stream to their groups on their own "media" event. Direct calls
       go to captains + anyone not covered by a captain. */
    if (this.relayMode) {
      this._promoteCaptainsAsNeeded();
      for (const pid of this.captains.keys()) this._callStudent(pid, stream, "stage");
      for (const pid of this.students.keys()) {
        if (this.captains.has(pid)) continue;
        const covered = [...this.captains.values()].some((c) => c.children.has(pid));
        if (!covered) this._callStudent(pid, stream, "stage");
      }
      this.broadcast({ t: "relay-refresh" });
      return;
    }
    for (const pid of this.students.keys()) this._callStudent(pid, stream, "stage");
  }
  setCamStream(stream) {
    this.camStream = stream;
    if (stream) {
      if (this.relayMode) {
        for (const pid of this.captains.keys()) this._callStudent(pid, stream, "teachercam");
        for (const pid of this.students.keys()) {
          if (this.captains.has(pid)) continue;
          const covered = [...this.captains.values()].some((c) => c.children.has(pid));
          if (!covered) this._callStudent(pid, stream, "teachercam");
        }
        this.broadcast({ t: "relay-refresh" });
        return;
      }
      for (const pid of this.students.keys()) this._callStudent(pid, stream, "teachercam");
    } else {
      for (const c of this.camCalls.values()) { try { c.close(); } catch {} }
      this.camCalls.clear();
      this.broadcast({ t: "teachercam-off" });
    }
  }

  /* ----- classroom controls ----- */
  setLocked(v) { this.locked = v; }
  kick(peerId) {
    const stu = this.students.get(peerId);
    if (!stu) return;
    try { stu.conn.send({ t: "kicked" }); } catch {}
    setTimeout(() => { try { stu.conn.close(); } catch {} }, 300);
  }
  requestStudentCam(peerId, on) {
    const stu = this.students.get(peerId);
    if (stu) try { stu.conn.send({ t: "camRequest", on }); } catch {}
  }
  requestStudentScreen(peerId, on) {   // v5: ask a student to share their screen
    const stu = this.students.get(peerId);
    if (stu) try { stu.conn.send({ t: "screenRequest", on }); } catch {}
  }
  allowMic(peerId, on) {
    const stu = this.students.get(peerId);
    if (!stu) return;
    stu.micAllowed = !!on;
    const permKey = String(stu.name || "").trim().toLowerCase();
    if (permKey) this._permMem.set(permKey, { micAllowed: !!on });   // v9 memory
    if (!stu.micAllowed) {
      for (const call of stu.mediaCalls.filter((c) => c._hmgKind === "stumic")) {
        try { call.close(); } catch {}
      }
    }
    try { stu.conn.send({ t: "micAllow", on: !!on }); } catch {}
  }
  sendAnnouncement(text) {
    const clean = String(text || "").trim().slice(0, 500);
    if (clean) this.broadcast({ t: "announce", text: clean });
  }
  sendCaption(text, final) {
    const clean = String(text || "").slice(0, 500);
    if (!clean) return;
    this.stats.captions++;
    this.broadcast({ t: "caption", text: clean, final: !!final, time: nowStamp() });
  }
  sendChat(text) {
    const clean = String(text || "").slice(0, 1000);
    if (clean) this.broadcast({ t: "chat", from: "Teacher", text: clean });
  }
  sendChatTo(peerId, text) {   /* v5: private teacher → one student */
    const stu = this.students.get(peerId);
    const clean = String(text || "").slice(0, 1000);
    if (stu && clean) try { stu.conn.send({ t: "chat", from: "Teacher (private)", text: clean, private: true }); } catch {}
  }

  /* ----- polls ----- */
  startPoll(question, options) {
    const cleanOptions = Array.isArray(options) ? options.map((x) => String(x).trim().slice(0, 200)).filter(Boolean).slice(0, 6) : [];
    const cleanQuestion = String(question || "").trim().slice(0, 500);
    if (!cleanQuestion || cleanOptions.length < 2) return false;
    this.activePoll = {
      def: { question: cleanQuestion, options: cleanOptions },
      counts: cleanOptions.map(() => 0),
      voted: new Set()
    };
    this.broadcast({ t: "poll", poll: this.activePoll.def });
    this.onEvent("poll-update", this.pollResults());
    return true;
  }
  endPoll() {
    if (!this.activePoll) return null;
    const res = this.pollResults();
    this.broadcast({ t: "pollEnd", results: res });
    this.stats.polls.push({ question: res.question, counts: res.counts.slice(), time: nowStamp() });
    this.activePoll = null;
    return res;
  }
  pollResults() {
    if (!this.activePoll) return null;
    return { question: this.activePoll.def.question, options: this.activePoll.def.options, counts: this.activePoll.counts.slice() };
  }

  /* ----- v8: individual student whiteboards (Whiteboard.fi style) ----- */
  startBoards(bgDataUrl) {
    this.boardsOn = true;
    this.broadcast({ t: "boards", on: true, bg: bgDataUrl || null });
  }
  pushBoardBg(bgDataUrl) {
    if (this.boardsOn) this.broadcast({ t: "boardsBg", bg: bgDataUrl });
  }
  clearBoards() {   /* v12: teacher reset — every student board back to blank */
    if (this.boardsOn) this.broadcast({ t: "boardsClear" });
  }
  stopBoards() {
    this.boardsOn = false;
    this.broadcast({ t: "boards", on: false });
  }

  /* ----- v8: activities (open question / word cloud / exit ticket) ----- */
  startActivity(def) {
    // def = { kind: "open"|"cloud"|"board"|"exit", prompt }
    const allowed = ["open", "cloud", "board", "exit"];
    const clean = { kind: allowed.includes(def && def.kind) ? def.kind : "open", prompt: String(def && def.prompt || "").trim().slice(0, 500) };
    if (!clean.prompt) return false;
    this.activity = { def: clean, responses: new Map() };
    this.broadcast({ t: "activity", def: clean });
    return true;
  }
  endActivity(showResults) {
    if (!this.activity) return null;
    const out = [...this.activity.responses.values()];
    if (showResults) this.broadcast({ t: "activityResults", kind: this.activity.def.kind,
      prompt: this.activity.def.prompt, items: out.map((r) => r.resp).slice(0, 80) });
    this.broadcast({ t: "activityEnd" });
    const a = this.activity; this.activity = null;
    return a;
  }

  /* ----- v8: behaviour points (ClassDojo style) ----- */
  awardPoint(peerId, category, delta, emoji) {
    const stu = this.students.get(peerId);
    if (!stu) return;
    if (!stu.behavior) stu.behavior = {};
    stu.behavior[category] = (stu.behavior[category] || 0) + delta;
    stu.behaviorTotal = (stu.behaviorTotal || 0) + delta;
    this.broadcast({ t: "award", name: stu.name, category, delta, emoji });
    this.onEvent("award", { peerId, name: stu.name, category, delta, total: stu.behaviorTotal });
  }
  behaviorCSV() {
    const cats = new Set();
    for (const s of this.students.values()) if (s.behavior) Object.keys(s.behavior).forEach((c) => cats.add(c));
    const cl = [...cats];
    const rows = [["Student", ...cl, "Total"]];
    for (const s of this.students.values()) {
      rows.push([s.name, ...cl.map((c) => (s.behavior && s.behavior[c]) || 0), s.behaviorTotal || 0]);
    }
    return rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(",")).join("\n");
  }

  /* ----- v8: group maker ----- */
  makeGroups(n) {
    const ids = [...this.students.keys()];
    n = Math.max(1, Math.min(ids.length || 1, Math.floor(Number(n) || 1)));
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const groups = Array.from({ length: n }, () => []);
    ids.forEach((pid, i) => groups[i % n].push(pid));
    this.groups = groups.map((g, gi) => g.map((pid) => {
      const stu = this.students.get(pid);
      try { stu.conn.send({ t: "group", num: gi + 1, of: n }); } catch {}
      return stu.name;
    }));
    return this.groups;
  }

  /* ----- v3: quiz engine (auto-scored, with leaderboard) ----- */
  _quizPublicDef() {
    const q = this.activeQuiz;
    if (!q) return null;
    const cur = q.def.questions[q.index];
    return {
      title: q.def.title, index: q.index, total: q.def.questions.length,
      question: cur.q, options: cur.options, seconds: q.def.secondsPerQ || 30
    };
  }
  startQuiz(def) {
    // def = { title, secondsPerQ, questions: [{q, options[], correct}] }
    if (!def || !Array.isArray(def.questions) || !def.questions.length || def.questions.length > 100) return false;
    const questions = def.questions.map((q) => ({
      q: String(q && q.q || "").slice(0, 500),
      options: Array.isArray(q && q.options) ? q.options.map((o) => String(o).slice(0, 200)).slice(0, 6) : [],
      correct: Number(q && q.correct), explanation: String(q && q.explanation || "").slice(0, 500)
    })).filter((q) => q.q && q.options.length >= 2 && Number.isInteger(q.correct) && q.correct >= 0 && q.correct < q.options.length);
    if (!questions.length) return false;
    const cleanDef = { title: String(def.title || "Quick quiz").slice(0, 120), secondsPerQ: Math.max(5, Math.min(600, Number(def.secondsPerQ) || 30)), questions };
    this.activeQuiz = {
      def: cleanDef, index: 0, askedAt: Date.now(),
      answered: new Set(), scores: new Map(),
      tally: questions.map(() => ({}))
    };
    this.broadcast({ t: "quiz", quiz: this._quizPublicDef() });
    this.onEvent("quiz-progress", this.quizProgress());
    return true;
  }
  nextQuizQuestion() {
    const q = this.activeQuiz;
    if (!q) return false;
    if (q.index + 1 >= q.def.questions.length) return false;
    q.index++; q.askedAt = Date.now(); q.answered = new Set();
    this.broadcast({ t: "quiz", quiz: this._quizPublicDef() });
    this.onEvent("quiz-progress", this.quizProgress());
    return true;
  }
  endQuiz() {
    const q = this.activeQuiz;
    if (!q) return null;
    const board = this.leaderboard();
    this.broadcast({ t: "quizEnd", leaderboard: board.slice(0, 10) });
    this.stats.quizzes.push({ title: q.def.title, questions: q.def.questions.length, time: nowStamp(), top: board[0] ? board[0].name : "-" });
    this.activeQuiz = null;
    return board;
  }
  quizProgress() {
    const q = this.activeQuiz;
    if (!q) return null;
    return {
      title: q.def.title, index: q.index, total: q.def.questions.length,
      answered: q.answered.size, students: this.students.size,
      tally: q.tally[q.index], options: q.def.questions[q.index].options,
      correct: q.def.questions[q.index].correct
    };
  }
  leaderboard() {
    const rows = [];
    for (const [pid, stu] of this.students) rows.push({ name: stu.name, score: stu.score || 0 });
    rows.sort((a, b) => b.score - a.score);
    return rows;
  }
  resetScores() { for (const stu of this.students.values()) stu.score = 0; }

  /* ----- attendance ----- */
  attendanceCSV() {
    const rows = [["Name", "Event", "Time"], ...this.attendance.map((a) => [a.name, a.event, a.time])];
    return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  }

  end() {
    if (this._ended) return;
    this._ended = true;
    for (const stu of this.students.values()) this.attendance.push({ name: stu.name, event: "left", time: nowStamp() });
    clearTimeout(this._reconnectTimer);
    clearTimeout(this._startTimer);
    clearTimeout(this._rosterTimer);
    clearInterval(this._pingTimer);
    this._reconnectTimer = null;
    this._startTimer = null;
    this._rosterTimer = null;
    this._pingTimer = null;
    this.broadcast({ t: "classEnded" });
    for (const [, p] of this.pending) {
      try { p.conn.send({ t: "classEnded" }); } catch {}
      try { p.conn.close(); } catch {}
    }
    this.pending.clear();
    for (const c of this.stageCalls.values()) { try { c.close(); } catch {} }
    for (const c of this.camCalls.values()) { try { c.close(); } catch {} }
    this.stageCalls.clear(); this.camCalls.clear();
    for (const stu of this.students.values()) {
      for (const call of stu.mediaCalls) { try { call.close(); } catch {} }
      try { stu.conn.close(); } catch {}
    }
    setTimeout(() => { try { this.peer.destroy(); } catch {} }, 600);
  }
}

/* ============================================================
   STUDENT SIDE
   ============================================================ */
class StudentRoom {
  constructor(roomCode, name, opts = {}) {
    this.code = roomCode.toUpperCase().trim();
    this.name = name;
    this.pin = opts.pin || "";                       // v3: room PIN
    this.tok = opts.tok || "";                       // v3: secure invite token
    this.onEvent = opts.onEvent || (() => {});
    this.peer = null;
    this.conn = null;
    this.camCall = null;
    this.micCall = null;
    this._closedByUs = false;
    this._joinSettled = false;
    this._joinResolve = null;
    this._joinReject = null;
    this._joinTimer = null;
    /* v12 camera flip: remember which way the active camera faces so
       "switch camera" can invert it. */
    this._facing = "user";
    /* v12 relay node: when the teacher promotes this student to CLASS
       CAPTAIN, relayPeer serves the stage to a small group so the
       teacher's uplink stays constant for classes of hundreds. */
    this.relayPeer = null;
    this.relayId = null;
    this.relayChildren = new Map();   // childPeerId -> {conn, calls:[]}
    this.relayConn = null;            // (child side) data conn to my captain
    this._inStage = null;             // incoming stage/teachercam streams (captain side)
    this._inTeachercam = null;
  }

  _settleJoin(state) {
    if (this._joinSettled) return;
    this._joinSettled = true;
    clearTimeout(this._joinTimer);
    this._joinTimer = null;
    const resolve = this._joinResolve;
    this._joinResolve = null;
    this._joinReject = null;
    if (resolve) resolve({ state });
  }
  _failJoin(message, retryable = true) {
    if (this._joinSettled) return;
    this._joinSettled = true;
    clearTimeout(this._joinTimer);
    this._joinTimer = null;
    const err = new Error(message);
    err.retryable = retryable;
    const reject = this._joinReject;
    this._joinResolve = null;
    this._joinReject = null;
    if (reject) reject(err);
  }

  join() {
    this._closedByUs = false;
    this._joinSettled = false;
    return new Promise((resolve, reject) => {
      this._joinResolve = resolve;
      this._joinReject = reject;
      this._joinTimer = setTimeout(() => {
        this._failJoin("Could not reach the class. Check the room code and that the teacher is live.", true);
      }, RTC_HANDSHAKE_TIMEOUT);
      try { this.peer = new Peer(PEER_CONFIG); }
      catch (e) { this._failJoin((e && e.message) || "Could not start the classroom engine.", true); return; }
      this.peer.on("open", () => {
        if (this._closedByUs) return;
        try {
          this.conn = this.peer.connect(RTC_PREFIX + this.code + "-host", {
            reliable: true,
            serialization: "json",
            metadata: { name: this.name, pin: this.pin, tok: this.tok, rejoin: Store.get("joined_" + this.code, false) }
          });
        } catch (e) {
          this._failJoin((e && e.message) || "Could not connect to the teacher.", true);
          return;
        }
        this.conn.on("open", () => {}); // admission/welcome is the real handshake
        this.conn.on("data", (d) => this._onData(d));
        this.conn.on("error", (err) => {
          if (!this._joinSettled) this._failJoin((err && err.message) || "Could not connect to the teacher.", true);
        });
        this.conn.on("close", () => {
          if (this._closedByUs) return;
          if (!this._joinSettled) this._failJoin("The connection to the teacher closed before admission.", true);
          else this.onEvent("disconnected");
        });
      });
      this.peer.on("error", (err) => {
        if (this._closedByUs) return;
        if (err && err.type === "peer-unavailable") this._failJoin("Class not found. The teacher may not be live yet.", true);
        else if (!this._joinSettled) this._failJoin((err && err.message) || "Could not connect to the classroom service.", true);
      });
      // teacher (or a class captain) calls us with stage / teacher cam
      this.peer.on("call", (call) => {
        const kind = (call.metadata && call.metadata.kind) || "stage";
        call.answer();
        call.on("stream", (stream) => {
          /* v12: keep the freshest stream for re-serving when we are a
             captain, and push it to our group the moment it changes. */
          if (kind === "stage") this._inStage = stream;
          if (kind === "teachercam") this._inTeachercam = stream;
          if (this.relayPeer) this._serveAllChildren();
          this.onEvent("media", { kind, stream });
        });
        call.on("close", () => this.onEvent("media-end", { kind }));
      });
    });
  }

  _onData(d) {
    if (!d || typeof d !== "object") return;
    switch (d.t) {
      case "welcome":   this._settleJoin("admitted"); this.onEvent("welcome", d); break;
      case "chat":      this.onEvent("chat", d); break;
      case "caption":   this.onEvent("caption", d); break;       // enterprise accessibility captions
      case "announce":  this.onEvent("announce", d); break;
      case "roster":    this.onEvent("roster", d); break;
      case "poll":      this.onEvent("poll", d.poll); break;
      case "pollEnd":   this.onEvent("pollEnd", d.results); break;
      case "quiz":      this.onEvent("quiz", d.quiz); break;            // v3
      case "quizFeedback": this.onEvent("quizFeedback", d); break;      // v3
      case "quizEnd":   this.onEvent("quizEnd", d.leaderboard); break;  // v3
      case "camRequest":this.onEvent("camRequest", d); break;
      case "screenRequest": this.onEvent("screenRequest", d); break;  // v5
      case "micAllow":  this.onEvent("micAllow", d); break;
      case "teachercam-off": this.onEvent("media-end", { kind: "teachercam" }); break;
      case "kicked":    this.onEvent("kicked"); break;
      case "rejected":  this._failJoin(d.reason || "The teacher rejected this join request.", false); this.onEvent("rejected", d); break;
      case "classEnded":this.onEvent("classEnded"); break;
      case "waiting":   this._settleJoin("waiting"); this.onEvent("waiting"); break;            // v4
      case "admitted":  this._settleJoin("admitted"); this.onEvent("admitted"); break;           // v4
      /* ---- v12 large-class relay ---- */
      case "relay-parent":            // teacher: get your media from this captain
        this.connectRelay(d.id);
        this.onEvent("relay-parent", d);
        break;
      case "relay-promote":           // teacher: you are now a class captain
        this.enableRelayNode(d.id);
        this.onEvent("relay-promote", d);
        break;
      case "relayMode":               // teacher: relay mode toggled
        if (!d.on) { this.disableRelayNode(); this.closeRelayConn(); }
        this.onEvent("relayMode", d);
        break;
      case "relay-direct":            // teacher: captain gone, calling you directly
        this.closeRelayConn();
        this.onEvent("relay-direct", d);
        break;
      case "relay-down-nudge":        // teacher: your captain is going away
        this.closeRelayConn();
        break;
      case "relay-refresh":           // teacher: new stream — captains re-serve groups
        if (this.relayPeer) this._serveAllChildren();
        break;
      case "tping":                   // teacher health ping — echo for rtt
        this.send({ t: "tpong", t0: d.t0 });
        break;
      case "classfull":               // v12: honest, retryable class-full answer
        this._failJoin("The class is full (" + (d.max || "many") + " students). A place frees up when someone leaves — this page keeps checking automatically.", true);
        this.onEvent("classfull", d);
        break;
      case "boardsClear":             // v12: teacher reset student boards
        this.onEvent("boardsClear", d);
        break;
      case "reaction":  this.onEvent("reaction", d); break;        // v4
      case "spotlight": this.onEvent("spotlight", d); break;       // v4
      case "boards":    this.onEvent("boards", d); break;            // v8
      case "boardsBg":  this.onEvent("boardsBg", d); break;          // v8
      case "activity":  this.onEvent("activity", d.def); break;      // v8
      case "activityEnd": this.onEvent("activityEnd"); break;        // v8
      case "activityResults": this.onEvent("activityResults", d); break; // v8
      case "award":     this.onEvent("award", d); break;             // v8
      case "group":     this.onEvent("group", d); break;             // v8
      case "mass_broadcast": this.onEvent("mass_broadcast", d); break;
    }
  }

  send(msg) { try { this.conn && this.conn.send(msg); } catch {} }
  sendChat(text)      { this.send({ t: "chat", text }); }
  raiseHand(up)       { this.send({ t: "hand", up }); }
  answerPoll(index)   { this.send({ t: "pollAnswer", index }); }
  answerQuiz(qIndex, answer) { this.send({ t: "quizAnswer", qIndex, answer }); } // v3
  sendReaction(emoji) { this.send({ t: "reaction", emoji }); }                   // v4
  sendScreenNack(reason) { this.send({ t: "screenNack", reason: String(reason || "unsupported").slice(0, 120) }); } // v9
  requestPermSync()     { this.send({ t: "permQuery" }); }                       // v9: re-sync mic permission after reconnect
  sendBoardStrokes(strokes, full) { this.send({ t: "boardStrokes", strokes, full: !!full }); } // v8
  sendActivityResp(resp) { this.send({ t: "activityResp", resp }); }             // v8

  async shareCamera(on) {
    if (!on) {
      if (this.camCall) { try { this.camCall.close(); } catch {} this.camCall = null; }
      if (this._camStream) { this._camStream.getTracks().forEach((t) => t.stop()); this._camStream = null; }
      return null;
    }
    if (!this.peer || !this.conn) throw new Error("You are not connected to the class yet — join first, then share your camera.");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("This browser does not support camera sharing.");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "user" }, width: { ideal: 480 }, frameRate: { ideal: 12 } }, audio: false
    });
    this._camStream = stream;
    this._facing = "user";
    this._screenIsCamView = false;
    this.camCall = this.peer.call(RTC_PREFIX + this.code + "-host", stream, { metadata: { kind: "stucam" } });
    const camCallRef = this.camCall;
    if (camCallRef) camCallRef.on("close", () => {
      if (this.camCall === camCallRef) this.camCall = null;
      try { if (this._camStream) { this._camStream.getTracks().forEach((t) => t.stop()); this._camStream = null; } } catch {}
      this.onEvent("camEnded");
    });
    return stream;
  }

  /* v5 (issue 1): student screen share — sent to the teacher as "stuscreen".
     v9 fix: the old guard mixed "no getDisplayMedia" (every phone browser) with
     "not connected", so connected students on phones were wrongly told to
     "join the class". Errors are now precise and a camera fallback exists. */
  async shareScreen(on) {
    if (!on) {
      if (this.screenCall) { try { this.screenCall.close(); } catch {} this.screenCall = null; }
      if (this._screenStream) { this._screenStream.getTracks().forEach((t) => t.stop()); this._screenStream = null; }
      return null;
    }
    if (!this.peer || !this.conn) throw new Error("You are not connected to the class yet — join first, then share.");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      const e = new Error("This device cannot share its screen — most phone browsers cannot. Use “Show my work with camera” instead.");
      e.noDisplayMedia = true;
      throw e;
    }
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 8 } }, audio: false
    });
    this._screenStream = stream;
    this._screenIsCamView = false;   /* real screen capture — no camera flip */
    stream.getVideoTracks()[0].addEventListener("ended", () => {
      this.shareScreen(false);
      this.onEvent("screenEnded");
    });
    this.screenCall = this.peer.call(RTC_PREFIX + this.code + "-host", stream, { metadata: { kind: "stuscreen" } });
    const scrCallRef = this.screenCall;
    if (scrCallRef) scrCallRef.on("close", () => {
      if (this.screenCall === scrCallRef) this.screenCall = null;
      this.onEvent("screenEnded");
    });
    return stream;
  }

  /* v9: mobile fallback — phone browsers cannot capture the screen, so the
     student points the REAR camera at their notebook/workbook. Delivered to the
     teacher as "stuscreen" so it appears in the same tile with no changes. */
  async shareCameraView() {
    if (!this.peer || !this.conn) throw new Error("You are not connected to the class yet — join first, then share.");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("This browser does not support camera sharing.");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, frameRate: { ideal: 15 } }, audio: false
    });
    try { if (this.screenCall) { this.screenCall.close(); } } catch {}
    try { if (this._screenStream) { this._screenStream.getTracks().forEach((t) => t.stop()); } } catch {}
    this._screenStream = stream;
    this._facing = "environment";
    this._screenIsCamView = true;    /* v12: flipCamera() is allowed on this path */
    this.screenCall = this.peer.call(RTC_PREFIX + this.code + "-host", stream, { metadata: { kind: "stuscreen" } });
    const camViewRef = this.screenCall;
    if (camViewRef) camViewRef.on("close", () => {
      if (this.screenCall === camViewRef) this.screenCall = null;
      try { if (this._screenStream) { this._screenStream.getTracks().forEach((t) => t.stop()); this._screenStream = null; } } catch {}
      this.onEvent("screenEnded");
    });
    stream.getVideoTracks()[0].addEventListener("ended", () => {
      try { if (this.screenCall) { this.screenCall.close(); } } catch {}
      this.screenCall = null; this._screenStream = null;
      this.onEvent("screenEnded");
    });
    return stream;
  }

  /* ------------------------------------------------------------
     v12 CAPTAIN RELAY NODE (student side)
     The teacher promotes us; we run a second Peer whose ONLY job is to
     re-serve the incoming stage/teacher-cam streams to a small group of
     classmates. Chat/polls/boards still flow over each student's own
     direct data connection to the teacher — only heavy media is relayed.
     ------------------------------------------------------------ */
  enableRelayNode(captainId) {
    if (this.relayPeer) return;                     // already serving
    this.relayId = Number(captainId) || captainId;
    try {
      this.relayPeer = new Peer(RTC_PREFIX + this.code + "-cap-" + this.relayId, peerConfig());
    } catch (e) { this.relayPeer = null; return; }
    this.relayPeer.on("open", () => this._serveAllChildren());
    this.relayPeer.on("connection", (conn) => {
      /* only accept group-join handshakes, never random calls */
      if (!conn.metadata || !conn.metadata.relayJoin) { try { conn.close(); } catch {} return; }
      conn.on("open", () => {
        this.relayChildren.set(conn.peer, { conn, calls: [] });
        this._serveChild(conn.peer);
      });
      conn.on("close", () => this._dropRelayChild(conn.peer));
      conn.on("error", () => this._dropRelayChild(conn.peer));
    });
    this.relayPeer.on("disconnected", () => { try { this.relayPeer && this.relayPeer.reconnect(); } catch {} });
    this.relayPeer.on("error", () => {});           // a child id may vanish; ignore
    this._serveAllChildren();
  }
  _serveAllChildren() {
    for (const pid of this.relayChildren.keys()) this._serveChild(pid);
  }
  _serveChild(childPeerId) {
    const entry = this.relayChildren.get(childPeerId);
    if (!entry || !this.relayPeer) return;
    for (const c of entry.calls) { try { c.close(); } catch {} }
    entry.calls = [];
    const serve = (stream, kind) => {
      if (!stream) return;
      try {
        const call = this.relayPeer.call(childPeerId, stream, { metadata: { kind, relay: true } });
        if (call) entry.calls.push(call);
      } catch {}
    };
    serve(this._inStage, "stage");
    serve(this._inTeachercam, "teachercam");
  }
  _dropRelayChild(childPeerId) {
    const entry = this.relayChildren.get(childPeerId);
    if (!entry) return;
    for (const c of entry.calls) { try { c.close(); } catch {} }
    this.relayChildren.delete(childPeerId);
  }
  disableRelayNode() {
    if (!this.relayPeer) return;
    for (const [, entry] of this.relayChildren) {
      for (const c of entry.calls) { try { c.close(); } catch {} }
      try { entry.conn.close(); } catch {} }
    this.relayChildren.clear();
    try { this.relayPeer.destroy(); } catch {}
    this.relayPeer = null;
    this.relayId = null;
  }
  /* (child side) handshake to a captain so they can call us with media */
  connectRelay(captainId) {
    this.closeRelayConn();
    if (!this.peer) return;
    const target = RTC_PREFIX + this.code + "-cap-" + captainId;
    try {
      const c = this.peer.connect(target, { reliable: true, serialization: "json", metadata: { relayJoin: true } });
      this.relayConn = c;
      c.on("open", () => this.onEvent("relay-attached", { captainId }));
      c.on("close", () => { if (this.relayConn === c) { this.relayConn = null; this.send({ t: "relayDown" }); } });
      c.on("error", () => { if (this.relayConn === c) { this.relayConn = null; this.send({ t: "relayDown" }); } });
    } catch { this.send({ t: "relayDown" }); }
  }
  closeRelayConn() {
    const c = this.relayConn;
    this.relayConn = null;
    try { c && c.close(); } catch {}
  }

  /* ------------------------------------------------------------
     v12 CAMERA FLIP — students switch front/back camera while the
     teacher is watching (screen-share "show my work" included).
     Primary path: RTCRtpSender.replaceTrack() on the LIVE call — the
     teacher's tile does not even blink. Fallback: re-call with the new
     stream if the sender is not reachable.
     ------------------------------------------------------------ */
  _activeCamPath() {
    if (this.camCall && this._camStream) return { call: this.camCall, stream: this._camStream, kind: "stucam" };
    if (this.screenCall && this._screenIsCamView && this._screenStream) return { call: this.screenCall, stream: this._screenStream, kind: "stuscreen" };
    return null;
  }
  async flipCamera() {
    const active = this._activeCamPath();
    if (!active) throw new Error("Camera is not on yet — turn on 📷 or “show my work” first.");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("This browser cannot switch cameras.");
    const target = this._facing === "environment" ? "user" : "environment";
    const isWork = active.kind === "stuscreen";
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: target }, width: { ideal: isWork ? 1280 : 480 }, frameRate: { ideal: isWork ? 15 : 12 } },
      audio: false
    });
    const newTrack = stream.getVideoTracks()[0];
    if (!newTrack) { stream.getTracks().forEach((t) => t.stop()); throw new Error("No camera was returned for the other direction."); }
    let replaced = false;
    try {
      const pc = active.call && active.call.peerConnection;
      if (pc && pc.getSenders) {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
        if (sender && sender.replaceTrack) { await sender.replaceTrack(newTrack); replaced = true; }
      }
    } catch {}
    /* stop the old camera either way (it is off-screen now) */
    try { active.stream.getTracks().forEach((t) => t.stop()); } catch {}
    if (isWork) this._screenStream = stream; else this._camStream = stream;
    this._facing = target;
    if (!replaced) {
      /* fallback: re-open the media call with the new stream */
      try { active.call.close(); } catch {}
      if (isWork) {
        this.screenCall = this.peer.call(RTC_PREFIX + this.code + "-host", stream, { metadata: { kind: "stuscreen" } });
        const ref = this.screenCall;
        if (ref) ref.on("close", () => { if (this.screenCall === ref) this.screenCall = null; this.onEvent("screenEnded"); });
      } else {
        this.camCall = this.peer.call(RTC_PREFIX + this.code + "-host", stream, { metadata: { kind: "stucam" } });
        const ref = this.camCall;
        if (ref) ref.on("close", () => {
          if (this.camCall === ref) this.camCall = null;
          try { if (this._camStream) { this._camStream.getTracks().forEach((t) => t.stop()); this._camStream = null; } } catch {}
          this.onEvent("camEnded");
        });
      }
    }
    return { facing: target, replaced, stream };
  }

  async shareMic(on) {
    if (!on) {
      if (this.micCall) { try { this.micCall.close(); } catch {} this.micCall = null; }
      if (this._micStream) { this._micStream.getTracks().forEach((t) => t.stop()); this._micStream = null; }
      return;
    }
    if (!this.peer || !this.conn) throw new Error("You are not connected to the class yet — join first, then speak.");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("This browser does not support microphone sharing.");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this._micStream = stream;
    this.micCall = this.peer.call(RTC_PREFIX + this.code + "-host", stream, { metadata: { kind: "stumic" } });
    const micCallRef = this.micCall;
    if (micCallRef) micCallRef.on("close", () => {
      /* v9: if the teacher (or network) closes the mic call, tell the student UI
         immediately — before, the student kept "speaking" into a dead call. */
      if (this.micCall === micCallRef) this.micCall = null;
      try { if (this._micStream) { this._micStream.getTracks().forEach((t) => t.stop()); this._micStream = null; } } catch {}
      this.onEvent("micEnded");
    });
  }

  leave() {
    this._closedByUs = true;
    this._failJoin("Connection closed.", false);
    clearTimeout(this._joinTimer);
    this._joinTimer = null;
    try { this.disableRelayNode(); } catch {}   /* v12: stop serving the group */
    try { this.closeRelayConn(); } catch {}
    try { this.shareCamera(false); } catch {}
    try { this.shareMic(false); } catch {}
    try { this.shareScreen(false); } catch {}
    try { this.conn && this.conn.close(); } catch {}
    try { this.peer && this.peer.destroy(); } catch {}
  }
}
