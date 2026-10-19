/* ============================================================
   ADEWALE CLASSROOM DECK — Student view controller
   Full-screen stage video (the teacher's split-screen),
   draggable teacher-cam PiP, hand raise, chat, polls,
   camera/mic sharing under teacher control.
   ============================================================ */
"use strict";

let sRoom = null;
let handUp = false;
let myCamOn = false, myMicOn = false, micAllowed = false;
/* r22 completion: live class policy mirrored from the teacher */
let chatMode = "class";            /* 'off' | 'host' | 'class' */
let allowSelfUnmute = true;        /* false = my mic button is locked */
let _brTimerId = null;             /* breakout countdown interval */
let coQaData = { open: true, questions: [] };   /* Co-Tutor console: the live Q&A list */
let stageEntered = false;

const qs = new URLSearchParams(location.search);
function normaliseRoomCode(value) { return String(value || "").trim().toUpperCase(); }
const invitedRoom = normaliseRoomCode(qs.get("room"));
if (invitedRoom) {
  /* v6 (issue 1): class links take students STRAIGHT to the studio —
     the room is pre-filled and hidden; they only type their name and join.
     Admission then depends on the teacher's approval (waiting room). */
  $("#inRoom").value = invitedRoom;
  const wrap = $("#roomFieldWrap");
  if (wrap) wrap.classList.add("hide");
  const chip = $("#roomChip");
  if (chip) { chip.textContent = "Class: " + invitedRoom; chip.classList.remove("hide"); }
}
$("#inName").value = Store.get("stuname", "");
setTimeout(() => {
  try {
    /* v9: if a class link + remembered name are both present, one tap is all
       that is needed — focus the Join button so Enter joins instantly. */
    if (invitedRoom && Store.get("stuname", "")) $("#btnJoin").focus();
    else $("#inName").focus();
  } catch {}
}, 300);

function browserLabel() {
  const ua = navigator.userAgent || "";
  if (/Edg\//.test(ua)) return "Microsoft Edge";
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return "Google Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
  return "Browser";
}
function inAppBrowserName() {
  const ua = (navigator.userAgent || "").toLowerCase();
  if (ua.includes("wv")) return "Android in-app browser/WebView";
  if (ua.includes("instagram")) return "Instagram in-app browser";
  if (ua.includes("fbav") || ua.includes("fban")) return "Facebook in-app browser";
  if (ua.includes("tiktok")) return "TikTok in-app browser";
  if (ua.includes("telegram")) return "Telegram in-app browser";
  return "";
}
function updateJoinDiagnostics() {
  const box = $("#joinDiag");
  if (!box) return;
  const issues = [];
  const good = [];
  good.push((location.protocol === "https:" ? "✅" : "⚠️") + " Site: " + location.protocol.replace(":", "").toUpperCase());
  good.push((window.RTCPeerConnection ? "✅" : "❌") + " WebRTC: " + (window.RTCPeerConnection ? "supported" : "not supported"));
  good.push((window.Peer ? "✅" : "❌") + " Join engine: " + (window.Peer ? "loaded" : "missing"));
  good.push("ℹ️ Browser: " + browserLabel());
  const inApp = inAppBrowserName();
  if (inApp) {
    issues.push("Open this link in Chrome, Edge or Safari — it is currently inside " + inApp + ", which often blocks classroom joining.");
    /* v9: one-tap escape hatch out of the in-app browser */
    const ob = $("#btnOpenBrowser");
    if (ob) {
      ob.classList.remove("hide");
      ob.onclick = () => {
        const url = location.href;
        if (/android/i.test(navigator.userAgent)) {
          location.href = url.replace(/^https?:\/\//, "intent://") + "#Intent;scheme=https;package=com.android.chrome;end";
        } else {
          toast("Tap the ⋯ / Share menu and choose “Open in Safari”, then reopen the class link.", "", 9000);
          try { if (navigator.share) navigator.share({ title: "My class link", url }); } catch {}
        }
      };
    }
  }
  if (location.protocol !== "https:" && location.hostname !== "localhost") issues.push("Use the deployed HTTPS website. Camera, microphone and WebRTC are unreliable on non-HTTPS pages.");
  if (!window.RTCPeerConnection) issues.push("This browser does not support WebRTC classrooms. Try Chrome, Edge or Safari.");
  if (!navigator.onLine) issues.push("This device appears offline right now.");
  box.innerHTML = "<b>Quick device check</b><br/>" +
    good.map((x) => "<div>" + escapeHtml(x) + "</div>").join("") +
    (issues.length ? '<div style="margin-top:6px;color:var(--warn)"><b>Fix if joining fails:</b><br/>' + issues.map((x) => "• " + escapeHtml(x)).join("<br/>") + "</div>" : '<div style="margin-top:6px;color:var(--ok)">This device looks ready to join.</div>');
}
updateJoinDiagnostics();
["#inRoom", "#inName", "#inPin"].forEach((sel) => $(sel) && $(sel).addEventListener("input", updateJoinDiagnostics));

/* ---------- join flow ---------- */
/* v13.1 TRANSPORT MEMORY (boot): if this device ever needed the TCP/TLS
   route to get into a class (Wi-Fi hotspot with no mobile data of its
   own), it starts with that route already preferred. The student's FIRST
   attempt then succeeds instead of burning a UDP-first failure + retry
   every single class. Cleared automatically if the network changes and a
   plain join ever succeeds first-try again (rememberTransport stores
   "udp" on any clean non-TCP success). */
try { if (Store.get("ice_pref", "") === "tcp") window.__cdPreferTcp = true; } catch (e) {}

/* v13.1: record which transport actually worked, so this device never
   repeats the one that failed. Only CLEAR signals are stored:
     • a clean success while UDP-first was in effect      → "udp"
     • a TCP-first success that followed a TRANSPORT-class
       failure ("Could not reach", "closed before
       admission", signalling errors)                      → "tcp"
   A success after "class not live" failures stores NOTHING — that says
   nothing about the network, and a wrong "tcp" would route a healthy
   student through the relay unnecessarily. */
function isTransportFailure(msg) {
  return /Could not reach|closed before admission|Could not connect|signalling|classroom service/i.test(String(msg || ""));
}
function rememberTransport(lastFailure) {
  try {
    /* the preference IN EFFECT for the attempt that just succeeded —
       stored memory counts even when the runtime flag was never flipped
       (rtc.js orders the ICE list from either source) */
    const eff = !!(window.__cdPreferTcp || Store.get("ice_pref", "") === "tcp");
    if (!eff) { Store.set("ice_pref", "udp"); return; }
    if (isTransportFailure(lastFailure)) Store.set("ice_pref", "tcp");
  } catch (e) {}
}

$("#btnJoin").addEventListener("click", () => { lobbyOn ? stopLobby() : join(); });
$("#inName").addEventListener("keydown", (e) => { if (e.key === "Enter" && !lobbyOn) join(); });

async function join() {
  const code = normaliseRoomCode($("#inRoom").value);
  const name = $("#inName").value.trim();
  if (!/^[A-Z0-9]{4,10}$/.test(code)) {
    $("#joinStatus").textContent = "Enter the 4–10 character room code your teacher shared.";
    return;
  }
  if (!name) { $("#joinStatus").textContent = "Please enter your name."; return; }
  Store.set("stuname", name);
  rejoinTries = 0;
  hideRejoinBanner();
  clearTimeout(lobbyTimer);
  lobbyOn = false;
  lobbyGen++;               /* v10: invalidate any in-flight lobby tick */

  $("#btnJoin").disabled = true;
  $("#joinStatus").textContent = "Connecting to class…";

  sRoom = new StudentRoom(code, name, { onEvent: onEvent, pin: $("#inPin").value.trim(), tok: qs.get("tok") || "" });
  try {
    const result = await sRoom.join();
    rememberTransport(null);   /* v13.1: a clean first-try success = this network does UDP fine */
    if (result && result.state === "waiting") {
      showWaitingState(code, name);
    } else {
      $("#joinStatus").textContent = "Connected — waiting for the teacher's screen…";
    }
  } catch (e) {
    /* A missing room is retryable; a wrong PIN/token is a deterministic error
       and must not send the student into an endless retry loop. */
    try { sRoom && sRoom.leave(); } catch {}
    sRoom = null;
    if (e && e.retryable === false) {
      restoreJoinButton();
      $("#joinStatus").textContent = e.message || "The teacher rejected this join request.";
      return;
    }
    startLobby(code, name, e && e.message);
  }
}

/* ---------- v5: lobby (auto-join when teacher goes live) ---------- */
let lobbyTimer = null, lobbyOn = false, lobbyAttempt = 0, lobbyGen = 0;
function showWaitingState(code, name) {
  lobbyOn = true;
  clearTimeout(lobbyTimer);
  $("#joinStatus").textContent = "You're in the waiting room — the teacher will admit you shortly.";
  $("#btnJoin").textContent = "✕ Leave waiting room";
  $("#btnJoin").disabled = false;
  window._wantWake = true; keepAwake(true);
  // The modal is also opened by the room event; this keeps UI state correct if
  // the transport resolves before the event loop paints it.
  $("#joinGate").classList.add("hide");
  openModal("#mWaiting");
}
/* v11: every retryable failure used to be reported as "The class hasn't
   started yet" — which is actively UNTRUE when the class is live and the
   student's network simply cannot reach the teacher's device (the exact
   "stuck in the lobby" complaint). Classify the real cause instead. */
function lobbyReasonText(why, code) {
  const w = String(why || "");
  if (/class is full/i.test(w))
    return "The class is full right now — a place frees up the moment someone leaves. This page keeps checking automatically every 30 seconds; keep it open.";
  if (/Class not found|not be live|peer-unavailable/i.test(w))
    return "The class room " + code + " is not live right now (or the code is wrong). If your teacher has started, check the code with them. This page keeps retrying automatically.";
  if (/Could not reach|closed before admission|Could not connect|signalling|classroom service/i.test(w))
    return "Your network could not reach the teacher's device directly — this usually happens on Wi-Fi hotspots that block the direct path (mobile data almost always works). If you are inside WhatsApp/Facebook/Instagram, tap the “Open in browser” button below and reload. This page keeps retrying automatically, and once a route works this device remembers it for every future class. If it keeps failing, ask your teacher to switch on the free Cloudflare relay (⚙ Settings → Relay — two minutes, one time): that route passes hotspot blocks.";
  return "The class hasn't started yet — this page will join you automatically the moment your teacher goes live. Keep it open.";
}
function lobbyStatusLine(code) {
  const inApp = inAppBrowserName();
  return "🕐 Waiting for class " + code + " · attempt " + (lobbyAttempt + 1) +
    (lobbyAttempt >= 1 ? " · 🔁 now trying TCP/TLS paths for Wi-Fi hotspots"
      : window.__cdPreferTcp ? " · 🔁 using the TCP/TLS route that worked here before" : "") +
    (inApp ? " · ⚠️ you are inside " + inApp + " — tap “Open in browser” for a reliable join" : "");
}
function startLobby(code, name, why) {
  lobbyOn = true;
  lobbyAttempt = 0;
  lobbyGen++;               /* v10: a fresh wait session — its tick owns this generation */
  const gen = lobbyGen;
  clearTimeout(lobbyTimer);
  closeModal("#mWaiting");
  $("#joinGate").classList.remove("hide");
  $("#joinStatus").innerHTML = escapeHtml(lobbyReasonText(why, code)) + "<br><span style=\"opacity:.75;font-size:.92em\">" + escapeHtml(lobbyStatusLine(code)) + "</span>";
  $("#btnJoin").textContent = "✕ Stop waiting";
  $("#btnJoin").disabled = false;
  window._wantWake = true; keepAwake(true);
  // A successful transport handshake that reports "waiting" is a real
  // waiting room, not a reason to keep opening new PeerJS connections.
  let lastFail = why;   /* v13.1: feeds rememberTransport on success */
  lobbyTimer = setTimeout(async function tick() {
    if (!lobbyOn || gen !== lobbyGen) return;
    /* v13: first attempt = normal UDP-first; every retry flips the ICE list
       to TCP/TLS-relay-first (window.__cdPreferTcp) so students stuck on a
       UDP-blocking Wi-Fi hotspot get through on the next try. */
    window.__cdPreferTcp = lobbyAttempt >= 1;
    const candidate = new StudentRoom(code, name, { onEvent: onEvent, pin: $("#inPin").value.trim(), tok: qs.get("tok") || "" });
    sRoom = candidate;
    try {
      const result = await candidate.join();
      /* v10 FIX: the "welcome" event fires SYNCHRONOUSLY before this
         continuation and legitimately sets lobbyOn=false — the old guard
         read that as "user stopped waiting" and EVICTED the freshly
         admitted student (the stuck-in-lobby bug). Abandon the candidate
         ONLY if this wait session was really abandoned (generation moved
         on, e.g. Stop waiting / manual re-join). */
      if (gen !== lobbyGen) { try { candidate.leave(); } catch {} return; }
      rememberTransport(lastFail);   /* v13.1: persist the route that finally worked */
      if (result && result.state === "waiting") {
        showWaitingState(code, name);
        return;
      }
      lobbyOn = false;
      restoreJoinButton();
      $("#joinStatus").textContent = "Connected — waiting for the teacher's screen…";
      toast("🎉 Your teacher is live — joining now!", "ok");
      // The welcome event normally enters the stage; this is a safe fallback.
      enterStage();
    } catch (e) {
      try { candidate.leave(); } catch {}
      if (!lobbyOn) return;
      if (e && e.retryable === false) {
        lobbyOn = false;
        restoreJoinButton();
        closeModal("#mWaiting");
        $("#joinGate").classList.remove("hide");
        $("#joinStatus").textContent = e.message || "The teacher rejected this join request.";
        return;
      }
      if (gen !== lobbyGen) return;   /* v10: wait session abandoned */
      lobbyAttempt++;
      lastFail = e && e.message;   /* v13.1: classify the failure for transport memory */
      /* v11: tell the student the REAL reason every time, and after two
         failures run the connection doctor once — the lobby must never
         silently repeat a false "class hasn't started". */
      $("#joinStatus").innerHTML = escapeHtml(lobbyReasonText(e && e.message, code)) + "<br><span style=\"opacity:.75;font-size:.92em\">" + escapeHtml(lobbyStatusLine(code)) + "</span>";
      if (lobbyAttempt >= 2 && !window._doctorRan) { window._doctorRan = true; runConnectionDoctor(); }
      /* v12: class-full → slow 30s polling; everything else → capped backoff
         WITH jitter. When 200 students all retry in lockstep after a teacher
         start, a fixed interval is a thundering herd against the signalling
         server — ±15% jitter spreads them out. */
      const isFull = /class is full/i.test(String(e && e.message || ""));
      const base = isFull ? 30000 : Math.min(12000, 4000 + lobbyAttempt * 2000);
      lobbyTimer = setTimeout(tick, Math.round(base * (0.85 + Math.random() * 0.3)));
    }
    /* v13.1: 2s (was 4s) — a student whose first attempt failed on a
       hotspot gets the TCP/TLS-first retry twice as fast. Later attempts
       keep the jittered backoff above. */
  }, 2000);
}
function stopLobby() {
  lobbyOn = false;
  lobbyGen++;               /* v10: any in-flight tick join must abandon itself */
  clearTimeout(lobbyTimer);
  lobbyTimer = null;
  const oldRoom = sRoom;
  sRoom = null;
  try { oldRoom && oldRoom.leave(); } catch {}
  closeModal("#mWaiting");
  $("#joinGate").classList.remove("hide");
  restoreJoinButton();
  $("#joinStatus").textContent = "Stopped waiting. Tap Join class to try again.";
  window._wantWake = false; keepAwake(false);
}
function restoreJoinButton() {
  $("#btnJoin").textContent = "Join class ➜";
  $("#btnJoin").disabled = false;
}
$("#btnLeaveWaiting")?.addEventListener("click", stopLobby);

/* ---------- v14 (round 8): assistant-tutor panel ----------
   Shown ONLY while the teacher has promoted this device (👑). The panel
   talks to the teacher through StudentRoom.coHostAction() — the teacher's
   TeacherRoom verifies the promotion before honouring anything, so a
   non-promoted student sending these messages is simply ignored. */
let coHostOn = false, coLockOn = false, coHostPanelEl = null;
function handleCoHost(d) {
  coHostOn = !!d.on;
  if (!coHostOn) {
    if (coHostPanelEl) { try { coHostPanelEl.remove(); } catch (e) {} coHostPanelEl = null; }
    if (d.on === false) toast("You are no longer an assistant tutor.");
    return;
  }
  if (coHostPanelEl) return;
  const panel = document.createElement("div");
  panel.id = "cohostPanel";
  panel.style.cssText = "position:fixed;left:12px;bottom:calc(70px + env(safe-area-inset-bottom,0px));z-index:6000;background:rgba(15,18,40,.93);border:1px solid #4f6ef7;border-radius:14px;padding:10px 12px;display:flex;gap:8px;flex-wrap:wrap;max-width:86vw";
  const title = document.createElement("b");
  title.style.cssText = "color:#ffd166;font-size:12px;width:100%";
  title.textContent = "👑 Assistant tutor";
  panel.appendChild(title);
  const mk = (label, titleText, fn) => {
    const b = document.createElement("button");
    b.className = "btn small"; b.textContent = label; b.title = titleText;
    b.addEventListener("click", fn);
    panel.appendChild(b);
  };
  mk("🚪 Admit all", "Admit everyone waiting in the waiting room", () => { if (sRoom) sRoom.coHostAction("admitAll"); });
  mk("🔇 Mute all", "Mute every student microphone", () => { if (sRoom) sRoom.coHostAction("muteAll"); });
  mk("✋ Lower hands", "Lower all raised hands", () => { if (sRoom) sRoom.coHostAction("lowerHands"); });
  mk("🔒 Lock / unlock", "Lock the class against new joins (or unlock)", () => {
    if (!sRoom) return;
    coLockOn = !coLockOn;
    sRoom.coHostAction("lock", null, { on: coLockOn });
    toast(coLockOn ? "Class locked — no new students can join" : "Class unlocked");
  });
  document.body.appendChild(panel);
  coHostPanelEl = panel;
  toast("👑 You are now an assistant tutor — you can admit, mute, lower hands and lock the class.", "ok", 6000);
}

/* ---------- v11: connection doctor ----------
   After repeated join failures, prove (not guess) whether this device's
   network can do WebRTC at all: gather ICE candidates with the same
   server list the classroom uses and report what was found. */
function runConnectionDoctor() {
  const box = $("#joinDiag");
  if (!box || typeof RTCPeerConnection === "undefined") return;
  const report = document.createElement("div");
  report.style.cssText = "margin-top:8px;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.06);border:1px dashed rgba(255,255,255,.25)";
  report.innerHTML = "<b>🔎 Connection doctor</b><br><span style=\"opacity:.75;font-size:.92em\">Testing whether this network allows classroom connections…</span>";
  box.appendChild(report);
  try {
    const pc = new RTCPeerConnection(peerConfig().config);
    const found = { host: 0, srflx: 0, relay: 0 };
    pc.createDataChannel("doctor");
    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      const t = e.candidate.type || "";
      if (t === "host") found.host++;
      else if (t === "srflx") found.srflx++;
      else if (t === "relay") found.relay++;
    };
    pc.createOffer().then((o) => pc.setLocalDescription(o)).catch(() => {});
    setTimeout(() => {
      try { pc.close(); } catch {}
      let verdict, color = "var(--ok)";
      if (!found.host && !found.srflx && !found.relay) {
        verdict = "❌ This network blocks WebRTC completely (no candidates at all). Switch to mobile data or another Wi-Fi network, or open the link in Chrome/Safari instead of an in-app browser.";
        color = "var(--warn)";
      } else if (found.srflx === 0 && found.relay === 0) {
        verdict = "⚠️ Only local candidates found — this network is very restrictive and direct classroom connections will usually fail. Use mobile data, or ask your teacher to switch on the free Cloudflare relay (Settings → Relay — two minutes, one time; the studio renews it automatically afterwards).";
        color = "var(--warn)";
      } else if (found.relay === 0) {
        verdict = "ℹ️ Your network can connect directly (" + found.srflx + " public candidate(s) found). If joining still fails, the block is on the teacher's network — ask them to switch on the free Cloudflare relay (Settings → Relay).";
      } else {
        verdict = "✅ Your network supports classroom connections, including the relay (" + found.relay + " relay candidate(s)). If joining still fails, ask your teacher to check their connection or share a fresh link.";
      }
      report.innerHTML = "<b>🔎 Connection doctor</b><br><span style=\"color:" + color + "\"><div style=\"margin-top:4px\">" + escapeHtml(verdict) + "</div></span>" +
        "<div class=\"muted\" style=\"margin-top:4px\">Candidates found — local: " + found.host + ", public: " + found.srflx + ", relay: " + found.relay + "</div>";
    }, 6500);
  } catch (e) {
    report.innerHTML = "<b>🔎 Connection doctor</b><br><span style=\"color:var(--warn)\">Could not run: " + escapeHtml(e.message || e) + "</span>";
  }
}

/* ═══════════════════════════════════════════════════════════════════
   r25 (items 1+3) — STUDIO SOUND on the student side + the GREEN ROOM.
   Hearing: the 🔊 button sets how loud the teacher sounds, 0-200%
   (persisted). Above 100% runs a clean Web Audio gain (an element's own
   .volume physically stops at 1.0); below it, plain element volume.
   Speaking: shareMic already runs the boost/compressor/limiter chain
   (rtc.js MicKit) — the teacher hears you loud too.
   Preflight: Meet-style mic + speaker tests BEFORE joining.
   ═══════════════════════════════════════════════════════════════════ */
var spkBoostGain = null, spkBoostCtx = null, spkBoostEl = null;
/* r26: AUTO-LEVEL — the receive-side sound system on the student deck.
   The teacher's voice is lifted into a comfortable band as it arrives
   (low-threshold compressor + +10 dB makeup, −3 dB limiter cap), so the
   class is loud & clear EVEN IF the teacher's app is an older build
   without the sender-side studio chain. */
var spkChain = null;   /* {src, hp, comp, mk, lim} on spkBoostCtx */
function autoLevelIn() { return String(Store.get("autolevel_in", 1)) === "1"; }
function spkVolume() { const v = Number(Store.get("spk_volume", 100)); return Number.isFinite(v) ? Math.max(0, Math.min(200, v)) : 100; }
function applySpkVolume() {
  const v = spkVolume();
  const els = [document.getElementById("stageVideo"), document.getElementById("teacherVideo")].filter(Boolean);
  const on = autoLevelIn();
  if (!on && v <= 100) {
    /* plain element volume — the exact pre-r26 path */
    if (spkChain) { try { spkChain.src.disconnect(); } catch (e) {} try { spkChain.src.connect(spkBoostGain); } catch (e) {} }
    try { if (spkBoostGain) spkBoostGain.gain.value = 1; } catch (e) {}
    els.forEach((el) => { try { el.volume = v / 100; } catch (e) {} });
    return;
  }
  const main = els[0];
  if (!main) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { els.forEach((el) => { try { el.volume = Math.min(1, v / 100); } catch (e) {} }); return; }
  try {
    if (!spkBoostCtx || spkBoostEl !== main) {
      spkBoostCtx = new AC();
      const src = spkBoostCtx.createMediaElementSource(main);   /* one per element, kept forever */
      spkBoostGain = spkBoostCtx.createGain();
      const c = { src: src, hp: spkBoostCtx.createBiquadFilter(), comp: spkBoostCtx.createDynamicsCompressor(), mk: spkBoostCtx.createGain(), lim: spkBoostCtx.createDynamicsCompressor() };
      c.hp.type = "highpass"; c.hp.frequency.value = 95;
      c.comp.threshold.value = -50; c.comp.knee.value = 10; c.comp.ratio.value = 4; c.comp.attack.value = 0.008; c.comp.release.value = 0.25;
      c.mk.gain.value = 3.2;                            /* +10 dB makeup — lifts a quiet teacher */
      c.lim.threshold.value = -3; c.lim.knee.value = 1; c.lim.ratio.value = 20; c.lim.attack.value = 0.001; c.lim.release.value = 0.1;
      src.connect(c.hp); c.hp.connect(c.comp); c.comp.connect(c.mk); c.mk.connect(c.lim); c.lim.connect(spkBoostGain); spkBoostGain.connect(spkBoostCtx.destination);
      spkChain = c;
      spkBoostEl = main;
    }
    if (spkBoostCtx.state === "suspended") spkBoostCtx.resume().catch(() => {});
    els.forEach((el) => { try { el.volume = 1; } catch (e) {} });
    try { spkChain.src.disconnect(); } catch (e) {}
    try { spkChain.src.connect(on ? spkChain.hp : spkBoostGain); } catch (e) {}
    spkBoostGain.gain.value = v / 100;
  } catch (e) {
    els.forEach((el) => { try { el.volume = Math.min(1, v / 100); } catch (e2) {} });
  }
}
/* r26: Alt+↑/↓ nudges the teacher's hearing volume ±10% — works even
   while typing is NOT focused; yields to inputs and OS combos. */
(function initVolKeys() {
  if (typeof document === "undefined" || !document.addEventListener) return;
  document.addEventListener("keydown", (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    const cur = spkVolume();
    const nv = Math.max(0, Math.min(200, cur + (e.key === "ArrowUp" ? 10 : -10)));
    Store.set("spk_volume", nv);
    applySpkVolume();
    toast("🔊 Teacher volume " + nv + "%", "", 1600);
    e.preventDefault();
  });
})();
(function initVolBtn() {
  const btn = document.getElementById("sVolBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    let pop = document.getElementById("sVolPop");
    if (pop) { pop.remove(); return; }
    pop = document.createElement("div");
    pop.id = "sVolPop";
    pop.style.cssText = "position:fixed;right:12px;bottom:74px;z-index:80;background:#fff;color:#111;border:1px solid #d7dced;border-radius:14px;box-shadow:0 10px 30px rgba(16,20,43,.22);padding:12px 14px;font-size:13px;min-width:220px";
    const cur = spkVolume();
    pop.innerHTML = "<b>🔊 Teacher volume</b><div style='display:flex;gap:8px;align-items:center;margin-top:8px'><input type='range' min='0' max='200' step='10' value='" + cur + "' style='flex:1'><b style='min-width:42px;text-align:right'>" + cur + "%</b></div><label style='display:flex;gap:7px;align-items:center;margin-top:9px;font-weight:500'><input type='checkbox' id='sAutoLevel'" + (autoLevelIn() ? " checked" : "") + ">🎚 Auto-level the teacher's voice</label><div style='font-size:11px;opacity:.7;margin-top:6px'>Above 100% is a clean boost. Auto-level lifts a quiet teacher into a comfortable band — even from an older app version.</div>";
    const rng = pop.querySelector("input[type=range]"), lab = pop.querySelector("div b b, b:last-of-type");
    const al = pop.querySelector("#sAutoLevel");
    if (al) al.addEventListener("change", () => { Store.set("autolevel_in", al.checked ? 1 : 0); applySpkVolume(); toast(al.checked ? "🎚 Auto-level ON — the teacher's voice is lifted as it arrives." : "Auto-level OFF.", "", 3000); });
    const label = pop.querySelectorAll("b")[2];
    rng.addEventListener("input", () => {
      if (label) label.textContent = rng.value + "%";
      Store.set("spk_volume", Number(rng.value));
      applySpkVolume();
    });
    document.body.appendChild(pop);
    setTimeout(() => {
      const close = (ev) => { if (!pop.contains(ev.target) && ev.target !== btn) { pop.remove(); document.removeEventListener("click", close); } };
      document.addEventListener("click", close);
    }, 30);
  });
})();

/* r25: the GREEN ROOM tests (join gate). */
(function initGreenRoom() {
  const micBtn = document.getElementById("btnGreenMic");
  const spkBtn = document.getElementById("btnGreenSpk");
  if (micBtn) micBtn.addEventListener("click", async () => {
    const wrap = document.getElementById("greenMicMeter");
    const bar = document.getElementById("greenMicBar");
    const tip = document.getElementById("greenMicTip");
    if (!window.MicKit || !MicKit.available()) {
      if (tip) tip.textContent = "Mic test unavailable in this browser";
      if (wrap) wrap.classList.remove("hide");
      return;
    }
    if (micBtn.dataset.on === "1") {   /* toggle off */
      micBtn.dataset.on = "0";
      micBtn.classList.remove("active");
      if (greenMicStop) { greenMicStop(); greenMicStop = null; }
      return;
    }
    micBtn.dataset.on = "1";
    micBtn.classList.add("active");
    if (wrap) wrap.classList.remove("hide");
    try {
      const acq = await MicKit.acquire({ boost: "standard" });
      const meter = MicKit.meter(acq.stream, (lv) => {
        if (bar) { bar.style.width = Math.min(100, lv) + "%"; bar.style.background = lv >= 90 ? "#dc2626" : (lv >= 30 ? "#16a34a" : "#84cc16"); }
        if (tip) tip.textContent = lv < 8 ? "…silence — check the OS mic switch" : (lv >= 90 ? "very loud — a boost preset is enough" : "good level 👍");
      });
      greenMicStop = () => {
        try { meter.stop(); } catch (e) {}
        try { acq.stream.getTracks().forEach((t) => t.stop()); } catch (e) {}
        try { acq._rawHandle && acq._rawHandle.getTracks().forEach((t) => t.stop()); } catch (e) {}
        try { acq.chain && acq.chain.stop(); } catch (e) {}
        if (bar) bar.style.width = "0%";
      };
    } catch (e) {
      const c = window.MicKit ? MicKit.classify(e) : { title: "Microphone error", body: "" };
      if (tip) tip.textContent = c.title;
      micBtn.dataset.on = "0";
      micBtn.classList.remove("active");
    }
  });
  if (spkBtn) spkBtn.addEventListener("click", () => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { toast("Speaker test unavailable in this browser.", "err"); return; }
      const ctx = spkBoostCtx && spkBoostCtx.state !== "closed" ? spkBoostCtx : new AC();
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      [523, 659, 784].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine"; o.frequency.value = f;
        o.connect(g); g.connect(ctx.destination);
        const t0 = ctx.currentTime + i * 0.22;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.28, t0 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
        o.start(t0); o.stop(t0 + 0.22);
      });
      toast("🔔 Did you hear the chime? If not, turn the device volume up before joining.", "ok", 6000);
    } catch (e) { toast("Could not play the test tone.", "err"); }
  });
  /* r26: the mic doctor — auto-calibration in the green room. Listens
     3 seconds, measures the RAW mic, picks the right boost for THIS
     device, and stores it (cd-audio-boost) so the live class starts
     loud & clear with zero fiddling. */
  const tuneBtn = document.getElementById("btnGreenTune");
  if (tuneBtn) tuneBtn.addEventListener("click", async () => {
    if (!window.MicKit || !MicKit.available()) { toast("Mic calibration is unavailable in this browser.", "err"); return; }
    const tip = document.getElementById("greenMicTip");
    const wrap = document.getElementById("greenMicMeter");
    const bar = document.getElementById("greenMicBar");
    if (wrap) wrap.classList.remove("hide");
    tuneBtn.disabled = true;
    const oldTxt = tuneBtn.textContent;
    tuneBtn.textContent = "🩺 Listening…";
    let acq = null, meter = null;
    try {
      acq = await MicKit.acquire({ boost: "off" });
      const raw = acq._rawHandle || acq.stream;
      const avg = await new Promise((res) => {
        let sum = 0, n = 0;
        meter = MicKit.meter(raw, (lv) => { sum += lv; n++; if (bar) { bar.style.width = Math.min(100, lv) + "%"; bar.style.background = lv >= 90 ? "#dc2626" : (lv >= 30 ? "#16a34a" : "#84cc16"); } });
        setTimeout(() => { try { meter.stop(); } catch (e) {} res(n ? sum / n : 0); }, 3000);
      });
      const pick = micDoctorPick(avg);
      try { localStorage.setItem("cd-audio-boost", pick); } catch (e2) {}
      if (tip) tip.textContent = pick === "off" ? "already loud — boost OFF" : "boost set: " + pick.toUpperCase();
      toast("🩺 Mic doctor: raw level " + Math.round(avg) + "/100 → boost " + (pick === "off" ? "OFF (already loud)" : pick.toUpperCase()) + ". You are ready to be heard.", "ok", 8000);
    } catch (e) {
      const c = window.MicKit ? MicKit.classify(e) : { title: "Microphone error", body: "" };
      if (tip) tip.textContent = c.title;
      toast("Mic doctor could not read your mic — check the OS mic switch.", "err", 6000);
    } finally {
      if (meter) { try { meter.stop(); } catch (e) {} }
      if (acq) { try { acq.stream.getTracks().forEach((t) => t.stop()); } catch (e) {} try { acq._rawHandle && acq._rawHandle.getTracks().forEach((t) => t.stop()); } catch (e) {} }
      tuneBtn.disabled = false;
      tuneBtn.textContent = oldTxt;
    }
  });
})();
var greenMicStop = null;
/* r26: the calibration ladder (kept pure — the QA suite exercises it):
   raw 0-100 meter scale → the honest preset. Never over-drives a mic
   that is already loud, never leaves a whisper at "standard". */
function micDoctorPick(rawAvg) {
  if (!Number.isFinite(rawAvg)) return "standard";
  if (rawAvg < 5) return "max";
  if (rawAvg < 10) return "strong";
  if (rawAvg < 18) return "standard";
  return "off";
}

/* r25: connection bars (Meet/Zoom-style 📶 for the student). */
function updateNetBars(rtt) {
  const el = document.getElementById("sNet");
  if (!el) return;
  const bars = el.querySelectorAll("i");
  let n = 1, color = "#dc2626", label = rtt + "ms";
  if (rtt <= 180) { n = 4; color = "#16a34a"; label = "excellent (" + rtt + "ms)"; }
  else if (rtt <= 450) { n = 3; color = "#16a34a"; label = "good (" + rtt + "ms)"; }
  else if (rtt <= 900) { n = 2; color = "#f59e0b"; label = "fair (" + rtt + "ms)"; }
  bars.forEach((b, i) => { b.style.background = i < n ? color : "#9ca3af"; });
  el.title = "Connection to your teacher: " + label;
}

/* r25: captions — student toggle + text size. */
var ccOff = false;
(function initCC() {
  const b = document.getElementById("sCCBtn");
  if (b) b.addEventListener("click", () => {
    ccOff = !ccOff;
    b.classList.toggle("active", !ccOff);
    const el = document.getElementById("sCaptionBanner");
    if (ccOff && el) el.classList.add("hide");
    toast(ccOff ? "Captions hidden (the teacher's captions keep running — CC shows them again)" : "Captions will show when the teacher speaks", "ok", 5000);
  });
  const sz = document.getElementById("sCapSize");
  if (sz) sz.addEventListener("click", (e) => {
    e.stopPropagation();
    const sizes = ["clamp(15px,2.5vw,22px)", "clamp(18px,3vw,28px)", "clamp(22px,3.8vw,36px)"];
    const cur = Number(Store.get("cap_size_idx", 0)) || 0;
    const next = (cur + 1) % sizes.length;
    Store.set("cap_size_idx", next);
    document.documentElement.style.setProperty("--cap-size", sizes[next]);
    try { e.stopPropagation(); } catch (err) {}
  });
  try { const sizes2 = ["clamp(15px,2.5vw,22px)", "clamp(18px,3vw,28px)", "clamp(22px,3.8vw,36px)"]; document.documentElement.style.setProperty("--cap-size", sizes2[Number(Store.get("cap_size_idx", 0)) || 0]); } catch (e) {}
})();

/* r25 (item 3): instant recovery hooks — the moment the browser regains
   the network (or the student returns to the tab), a dead connection is
   rejoined IMMEDIATELY instead of waiting for the next retry tick. */
/* feature-detected: bare VM test sandboxes may not implement these */
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("online", () => {
    if (stageEntered && !lobbyOn && rejoinBanner) attemptRejoin();
  });
}
if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && stageEntered && !lobbyOn) {
      const alive = sRoom && sRoom.conn && sRoom.conn.open;
      if (!alive) attemptRejoin();
    }
  });
}

function enterStage() {
  if (stageEntered) return;
  stageEntered = true;
  $("#joinGate").classList.add("hide");
  $("#stageWrap").classList.remove("hide");
  $("#stageStatus").classList.remove("hide");
  $("#stuControls").classList.remove("hidden");
  window._wantWake = true; keepAwake(true);
  scheduleControlsHide();
  // try fullscreen for the "laptop look"
  setTimeout(() => {
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  }, 400);
}

/* ---------- room events ---------- */
function onEvent(type, p) {
  switch (type) {
    case "welcome":
      lobbyOn = false;
      clearTimeout(lobbyTimer);
      lobbyTimer = null;
      rejoinTries = 0;
      lobbyAttempt = 0;
      try { sRoom && sRoom.requestPermSync(); } catch {}   /* v9: teacher re-applies mic permission if it was granted */
      try { sRoom && sRoom.startQualityMonitor(); } catch {}   /* r25: 📶 connection bars */
      applySpkVolume();                                        /* r25: saved hearing volume from the first second */
      restoreJoinButton();
      Store.set("joined_" + (sRoom ? sRoom.code : normaliseRoomCode($("#inRoom").value)), true);
      closeModal("#mWaiting");
      enterStage();
      $("#roomNameChip").textContent = p.roomName || "";
      $("#countChip").textContent = "👥 " + (p.count || 1);
      toast(p.rejoined ? "Reconnected — waiting for the teacher's screen…" : "Joined! Waiting for the teacher's screen…", "ok");
      break;
    case "cohost": handleCoHost(p); break;                      /* v14: assistant tutor */
    case "cotutor": handleCoTutor(p); break;                    /* r21: Co-Tutor (full tutor powers) */
    case "coRoster": handleCoRoster(p); break;                  /* r21: privileged roster for the console */
    case "stuscreenBcast": handleClassScreenMeta(p); break;     /* r21: a classmate's screen is on the class stage */
    case "micSilent":                                            /* v14.1: dead-mic detection */
      toast(p && p.reason === "system-muted"
        ? "🎙️ The system has muted your microphone — unmute it (mic-mute key / system settings), then tap the mic button twice (off and on) to retry."
        : "🎙️ Your mic is open but silent — check the mic-mute key, system input volume, or another app holding the mic. Tap the mic button twice (off and on) to retry.",
        "err", 10000);
      break;
    case "handSync":
      if (!p.up) { handUp = false; const hb = $("#sBtnHand"); if (hb) hb.classList.remove("active"); }
      break;
    case "roster":
      $("#countChip").textContent = "👥 " + (p.count || 0);
      break;
    case "mass_broadcast":
      enterStage();
      // Replace stage video with the embed iframe
      $("#stageVideo").style.display = "none";
      let iframe = $("#massBroadcastIframe");
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "massBroadcastIframe";
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "none";
        iframe.allowFullscreen = true;
        iframe.allow = "autoplay; encrypted-media";
        $("#stageVideo").parentNode.insertBefore(iframe, $("#stageVideo").nextSibling);
      }
      iframe.src = p.url;
      toast("Joined mass broadcast livestream.", "ok");
      break;
    case "media":
      if (p.kind === "stage") { enterStage(); attachStage(p.stream); }
      else if (p.kind === "teachercam") attachTeacherCam(p.stream);
      else if (p.kind === "stuscreen-bcast") attachClassScreen(p.stream, p.name);
      break;
    case "media-end":
      if (p.kind === "teachercam") $("#teacherPip").classList.remove("show");
      break;
    case "chat":
      addMsg(p.from, p.text, p.from === Store.get("stuname", ""));
      break;
    case "caption":
      showCaption(p);
      break;
    case "announce":
      $("#announceText").textContent = p.text;
      openModal("#mAnnounce");
      break;
    case "poll": showPoll(p); break;
    case "pollEnd": showPollResults(p); break;
    case "quiz": showQuiz(p); break;                 // v3
    case "quizFeedback": showQuizFeedback(p); break; // v3
    case "quizEnd": showQuizLeaderboard(p); break;   // v3
    case "waiting":                                   // v4: waiting room
      showWaitingState($("#inRoom").value.trim().toUpperCase(), Store.get("stuname", "Student"));
      break;
    case "admitted":                                  // v4
      lobbyOn = false;
      clearTimeout(lobbyTimer);
      lobbyTimer = null;
      restoreJoinButton();
      closeModal("#mWaiting");
      enterStage();
      toast("✅ Admitted — welcome to class!", "ok");
      break;
    case "reaction":                                  // v4
      sFlyEmoji(p.emoji, p.name);
      break;
    case "spotlight":                                 // v4 → r25: real video spotlight rides the teacher's broadcast
      if (p && p.peerId) toast("🌟 " + p.name + " is in the spotlight!", "ok", 6000);
      else if (p && p.name) toast("🌟 " + p.name + ", it's your turn!", "ok", 6000);
      break;
    case "quality":                                   /* r25: 📶 bars */
      if (p && typeof p.rtt === "number") updateNetBars(p.rtt);
      break;
    case "signal-reconnecting":                       /* r25: signalling drop — transparent auto-reconnect */
      toast("📡 Reconnecting to the classroom service…", "", 4000);
      break;
    case "signal-back":
      toast("✅ Back on the classroom service.", "ok", 3000);
      break;
    case "camRequest": handleCamRequest(p.on); break;
    case "screenRequest":                              /* v5 → r21 chooser + audience */
      if (p.on && !myScreenOn) { pendingScreenAudience = (p.audience === "class" ? "class" : "me"); openScreenAsk(); }
      else if (!p.on && myScreenOn) { stopMyScreenShare(); }
      break;
    case "screenEnded":
      myScreenOn = false;
      $("#sBtnScreen").classList.remove("active");
      break;
    case "micAllow":
      micAllowed = p.on;
      $("#sBtnMic").disabled = !p.on;
      if (p.on) {
        if (myMicOn) toast("🎙 Your mic is already on", "ok", 3000);
        else {
          openModal("#mMicAsk");   /* v9: ONE tap to speak — the old flow made
                                      students hunt for the mic button, so the
                                      teacher heard silence. */
          toast("🎙 Teacher allowed your mic", "ok", 4000);
        }
      } else {
        toast("Mic permission removed", "", 4000);
        if (myMicOn) toggleMyMic();
      }
      break;
    case "micEnded":                                   /* v9: call closed remotely */
      myMicOn = false; micAllowed = false;
      $("#sBtnMic").classList.remove("active");
      $("#sBtnMic").disabled = true;
      toast("🎙 Mic stopped", "", 4000);
      break;
    case "camEnded":                                   /* v9: call closed remotely */
      myCamOn = false;
      $("#sBtnCam").classList.remove("active");
      break;
    case "kicked":
      cleanupAndGate("You were removed from the class by the teacher.");
      break;
    case "rejected":
      lobbyOn = false;
      clearTimeout(lobbyTimer);
      cleanupAndGate((p && p.reason) || "The room is locked.");
      break;
    case "classEnded":
      Store.set("joined_" + (sRoom ? sRoom.code : normaliseRoomCode($("#inRoom").value)), false);
      cleanupAndGate("Class has ended. Thanks for attending! 🎓");
      break;
    case "disconnected":
      if (lobbyOn) {
        /* v9: waiting (pre-live lobby OR teacher's waiting room). A blip must
           never strand the student on a dead gate — auto-restart the lobby so
           they still get in the moment the teacher is ready. */
        toast("Connection blip — still waiting for the class…", "", 3000);
        const wr = sRoom ? sRoom.code : normaliseRoomCode($("#inRoom").value);
        startLobby(wr, Store.get("stuname", "Student"), "");
        break;
      }
      if (!stageEntered) { cleanupAndGate("Connection to the teacher was lost. Tap Join class to try again."); break; }
      toast("Connection lost — trying to rejoin…", "err", 5000);
      attemptRejoin();
      break;
  }
}

/* ---------- stage / video ---------- */
let pendingStream = null;
function attachStage(stream) {
  const v = $("#stageVideo");
  v.srcObject = stream;
  applySpkVolume();   /* r25: the saved 0-200% hearing volume, on every stage attach */
  v.play().catch(() => {
    pendingStream = stream;
    openModal("#mUnmute");
  });
}
$("#btnUnmute").addEventListener("click", () => {
  closeModal("#mUnmute");
  const v = $("#stageVideo");
  if (pendingStream) v.srcObject = pendingStream;
  v.muted = false;
  applySpkVolume();   /* r25: keep the chosen hearing volume after the unmute gate */
  v.play().catch(() => {});
  $("#teacherVideo").play().catch(() => {});
});

function attachTeacherCam(stream) {
  const pip = $("#teacherPip");
  $("#teacherVideo").srcObject = stream;
  pip.classList.add("show");
}

/* draggable PiP */
(function makeDraggable() {
  const pip = $("#teacherPip");
  let sx = 0, sy = 0, ox = 0, oy = 0, drag = false;
  pip.addEventListener("pointerdown", (e) => {
    drag = true; pip.setPointerCapture(e.pointerId);
    sx = e.clientX; sy = e.clientY;
    const r = pip.getBoundingClientRect(); ox = r.left; oy = r.top;
  });
  pip.addEventListener("pointermove", (e) => {
    if (!drag) return;
    pip.style.left = Math.max(4, Math.min(window.innerWidth - pip.offsetWidth - 4, ox + e.clientX - sx)) + "px";
    pip.style.top  = Math.max(4, Math.min(window.innerHeight - pip.offsetHeight - 4, oy + e.clientY - sy)) + "px";
    pip.style.right = "auto";
  });
  pip.addEventListener("pointerup", () => { drag = false; });
})();

/* ---------- auto-hiding controls ---------- */
let hideT = null;
function scheduleControlsHide() {
  clearTimeout(hideT);
  $("#stuControls").classList.remove("hidden");
  hideT = setTimeout(() => $("#stuControls").classList.add("hidden"), 5000);
}
["pointerdown", "pointermove", "touchstart"].forEach((ev) =>
  document.addEventListener(ev, () => { if (sRoom) scheduleControlsHide(); }, { passive: true }));

/* ---------- controls ---------- */
$("#sBtnHand").addEventListener("click", () => {
  handUp = !handUp;
  sRoom.raiseHand(handUp);
  $("#sBtnHand").classList.toggle("active", handUp);
  toast(handUp ? "✋ Hand raised — the teacher can see it" : "Hand lowered");
});

/* v4: emoji reactions */
$("#sBtnReact").addEventListener("click", () => $("#reactBar").classList.toggle("hide"));
$$(".react-emo").forEach((b) => b.addEventListener("click", () => {
  sRoom.sendReaction(b.textContent.trim());
  sFlyEmoji(b.textContent.trim(), "You");
  $("#reactBar").classList.add("hide");
}));
/* r22: nonverbal feedback (Zoom parity) — 👍/👎/🐢/🐇 shown as a badge
   beside the student's name on the teacher's roster for 12 seconds. */
$$(".nv-emo").forEach((b) => b.addEventListener("click", () => {
  if (!sRoom) return;
  sRoom.sendNv(b.dataset.kind);
  const label = b.dataset.kind === "yes" ? "YES 👍 sent" : (b.dataset.kind === "no" ? "NO 👎 sent" : (b.dataset.kind === "slower" ? "SLOWER 🐢 sent" : "FASTER 🐇 sent"));
  toast(label + " — your teacher can see it", "ok", 3000);
  $("#reactBar").classList.add("hide");
}));

function sFlyEmoji(emoji, name) {
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;z-index:9998;font-size:34px;pointer-events:none;left:" +
    (12 + Math.random() * 70) + "%;bottom:90px;transition:all 2.6s ease-out;opacity:1";
  const symbol = document.createElement("span");
  symbol.textContent = String(emoji || "").slice(0, 8);
  el.appendChild(symbol);
  if (name) {
    const label = document.createElement("div");
    label.style.cssText = "font-size:11px;text-align:center;color:#fff;text-shadow:0 1px 3px #000";
    label.textContent = String(name).slice(0, 40);
    el.appendChild(label);
  }
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.bottom = "75%"; el.style.opacity = "0"; });
  setTimeout(() => el.remove(), 2700);
}

$("#sBtnChat").addEventListener("click", () => $("#sDrawerChat").classList.toggle("open"));
$("#sChatClose").addEventListener("click", () => $("#sDrawerChat").classList.remove("open"));
/* Chat rate limiting: max 1 message per 800ms to prevent spam */
let _lastChatTs = 0;
function sendChat() {
  const now = Date.now();
  if (now - _lastChatTs < 800) { toast("Please wait a moment before sending another message.", "", 2000); return; }
  const inp = $("#sChatInput");
  const text = inp.value.trim();
  if (!text) return;
  const toSel = $("#sChatTo");
  const toPeer = (toSel && toSel.style.display !== "none" && toSel.value) ? toSel.value : "";
  if (toPeer) {
    /* r22 (item 3): permitted student-to-student DM — routed through the
       teacher's device, who decided this pair may message. */
    _lastChatTs = now;
    inp.value = "";
    sRoom.sendDm(toPeer, text);
    const label = toSel.options[toSel.selectedIndex] ? toSel.options[toSel.selectedIndex].textContent : "classmate";
    addMsg("You → " + label + " (private)", text, true);
    return;
  }
  /* r22 completion: chat modes — the teacher's room object is the real
     gate (it never relays what it must not); this keeps the student's
     feedback honest instead of silently dropping messages. */
  if (chatMode === "off") { toast("The teacher has turned chat off.", "err", 5000); return; }
  _lastChatTs = now;
  inp.value = "";
  const priv = $("#sChatPriv").checked;       /* v5: private chat */
  sRoom.send({ t: "chat", text, private: priv });
  if (chatMode === "host" && !priv) addMsg("You → teacher (chat is teacher-only right now)", text, true);
  else addMsg(priv ? "You → teacher (private)" : "You", text, true);
}
$("#sChatSend").addEventListener("click", sendChat);
$("#sChatInput").addEventListener("keydown", (e) => { if (e.key === "Enter") sendChat(); });

/* ── r22 completion: room-scoped chat (inside a breakout room) — goes ONLY
   to the room-mates the teacher put me with; the teacher keeps the log. ── */
function sendBrChat() {
  const inp = $("#brChatInp");
  if (!inp) return;
  const text = inp.value.trim();
  if (!text) return;
  if (!sRoom) { toast("You are not in a room yet."); return; }
  inp.value = "";
  sRoom.sendBrChat(text);
}
$("#brChatSend") && $("#brChatSend").addEventListener("click", sendBrChat);
$("#brChatInp") && $("#brChatInp").addEventListener("keydown", (e) => { if (e.key === "Enter") sendBrChat(); });

/* ── r22 completion: Q&A ask (Google Meet / Zoho style) ── */
$("#sBtnQa") && $("#sBtnQa").addEventListener("click", () => {
  const q = prompt("Your question for the teacher:");
  if (q == null) return;
  const clean = String(q).trim();
  if (!clean) return;
  if (!sRoom) { toast("Join the class first.", "err"); return; }
  sRoom.qaAsk(clean);
  addMsg("🙋 You asked (Q&A)", clean, true);
});


function showCaption(p) {
  if (ccOff) return;   /* r25: the student chose to hide captions */
  const el = $("#sCaptionBanner");
  const txt = $("#sCaptionText");
  if (!el || !txt) return;
  const text = String((p && p.text) || "").trim();
  if (!text) return;
  txt.textContent = text;
  el.classList.remove("hide");
  clearTimeout(showCaption._t);
  showCaption._t = setTimeout(() => el.classList.add("hide"), p && p.final ? 7000 : 3500);
}

function addMsg(who, text, me) {
  const list = $("#sChatList");
  const div = document.createElement("div");
  div.className = "chat-msg" + (me ? " me" : "");
  div.innerHTML = `<div class="who">${escapeHtml(who)}</div>${escapeHtml(text)}`;
  list.appendChild(div);
  list.scrollTop = list.scrollHeight;
  if (!me && !$("#sDrawerChat").classList.contains("open"))
    toast("💬 " + who + ": " + text.slice(0, 60), "", 4000);
}

$("#sBtnCam").addEventListener("click", toggleMyCam);
async function toggleMyCam() {
  try {
    if (!myCamOn) {
      const stream = await sRoom.shareCamera(true);
      myCamOn = true;
      myScreenIsCamView = false;
      $("#sBtnCam").classList.add("active");
      showSelfView(stream, sRoom && sRoom._facing === "environment");
      toast("📷 Your camera is on — the teacher can see you", "ok");
    } else {
      await sRoom.shareCamera(false);
      myCamOn = false;
      $("#sBtnCam").classList.remove("active");
      hideSelfView();
      toast("Camera off");
    }
    refreshFlipButton();
  } catch { toast("Camera blocked. Allow camera in browser settings.", "err"); }
}

/* ---------- v12: front/back camera switch + self view ---------- */
let myScreenIsCamView = false;    /* true when “show my work” uses the camera */
function refreshFlipButton() {
  const btn = $("#sBtnFlip");
  if (!btn) return;
  const canFlip = (myCamOn && sRoom && sRoom._camStream) || (myScreenOn && myScreenIsCamView);
  btn.classList.toggle("hide", !canFlip);
  if (canFlip && sRoom) {
    btn.title = sRoom._facing === "environment" ? "Switch to FRONT camera" : "Switch to BACK camera";
    btn.textContent = sRoom._facing === "environment" ? "🤳" : "📷";
  }
}
async function flipMyCamera() {
  try {
    const r = await sRoom.flipCamera();
    showSelfView(r.stream, r.facing === "environment");
    refreshFlipButton();
    toast(r.facing === "environment" ? "🔄 Back camera — point it at your work" : "🔄 Front camera", "ok");
  } catch (e) {
    toast(e.message || "Could not switch camera on this device", "err", 6000);
  }
}
$("#sBtnFlip") && $("#sBtnFlip").addEventListener("click", flipMyCamera);
function showSelfView(stream, isBack) {
  const pip = $("#sSelfView"), v = $("#sSelfViewVideo");
  if (!pip || !v) return;
  try { v.srcObject = stream || null; v.pause && v.pause(); v.play && v.play().catch(() => {}); } catch {}
  v.style.transform = isBack ? "none" : "scaleX(-1)";   /* mirror the front camera like every camera app */
  pip.classList.remove("hide");
}
function hideSelfView() {
  const pip = $("#sSelfView"), v = $("#sSelfViewVideo");
  if (!pip) return;
  try { if (v) v.srcObject = null; } catch {}
  pip.classList.add("hide");
}

function handleCamRequest(on) {
  if (on && !myCamOn) {
    if (confirm("Your teacher is asking you to turn your camera ON. Allow?")) toggleMyCam();
  } else if (!on && myCamOn) {
    toggleMyCam();
    toast("Teacher turned your camera off");
  }
}

/* ── r21 (item 6): A CLASSMATE'S SCREEN ON THE CLASS STAGE ──────────────
   The teacher relays a student's screen (or presents their board); it
   arrives as a normal media call and renders in a never-cropped floating
   pane that can go fullscreen — the same quality rules as the teacher's own
   view (item 5). */
let classScreenEl = null;
function attachClassScreen(stream, name) {
  if (!classScreenEl) {
    classScreenEl = document.createElement("div");
    classScreenEl.id = "cdClassScreen";
    classScreenEl.innerHTML = "<video autoplay playsinline></video>" +
      '<div class="bar"><span class="t"></span><button class="fs" title="Fullscreen">\u26F6</button><button class="x" title="Hide">\u2715</button></div>';
    document.body.appendChild(classScreenEl);
    classScreenEl.querySelector(".x").addEventListener("click", () => {
      classScreenEl.classList.add("hide");
      toast("Hidden. It comes back if the teacher shows another screen.", "", 4000);
    });
    classScreenEl.querySelector(".fs").addEventListener("click", () => {
      try { if (document.fullscreenElement) document.exitFullscreen(); else classScreenEl.requestFullscreen(); } catch (e) {}
    });
  }
  classScreenEl.classList.remove("hide");
  classScreenEl.querySelector("video").srcObject = stream;
  classScreenEl.querySelector(".t").textContent = "\u{1F5A5} " + (name || "A classmate") + " — shown by the teacher";
  toast("\u{1F5A5} " + (name || "A classmate") + " is showing their screen to the class", "ok", 6000);
}
function handleClassScreenMeta(d) {
  if (d && d.on === false && classScreenEl) {
    classScreenEl.remove();
    classScreenEl = null;
    toast("The class screen share ended.", "", 4000);
  }
}

/* ── r21 (item 4): THE CO-TUTOR CONSOLE ─────────────────────────────────
   A Co-Tutor has the FULL tutor toolkit from the student side: waiting-room
   admit/deny, per-student mic/camera/screen control, kick, mute all, lower
   hands, lock, spotlight, announcements, polls, and promoting assistant
   tutors. Every action is authorised on the TEACHER'S room object (rtc.js
   honours cohostAction only from promoted peers) — this UI only sends
   requests; it can never grant itself anything. The privileged roster
   (names + peerIds) arrives via "coRoster" and is shown to nobody else. */
var coTutorOn = false, coTutorPanelEl = null;   /* r21: Co-Tutor console state */
function handleCoTutor(d) {
  coTutorOn = !!d.on;
  if (!coTutorOn) {
    if (coTutorPanelEl) { try { coTutorPanelEl.remove(); } catch (e) {} coTutorPanelEl = null; }
    if (coHostPanelEl) { try { coHostPanelEl.remove(); } catch (e) {} coHostPanelEl = null; coHostOn = false; }
    if (d && d.on === false) toast("You are no longer a Co-Tutor.", "", 5000);
    return;
  }
  if (coTutorPanelEl) return;
  /* the Co-Tutor console supersedes the plain assistant-tutor panel */
  if (coHostPanelEl) { try { coHostPanelEl.remove(); } catch (e) {} coHostPanelEl = null; }
  const panel = document.createElement("div");
  panel.id = "coTutorPanel";
  const mk = (label, title, fn) => {
    const b = document.createElement("button");
    b.textContent = label; b.title = title;
    b.addEventListener("click", fn);
    return b;
  };
  const act = (a, target, extra) => { try { sRoom.coHostAction(a, target, extra); } catch (e) {} };
  const H = document.createElement("h4");
  H.textContent = "\u{1F393} Co-Tutor console";
  panel.appendChild(H);
  const row1 = document.createElement("div");
  row1.className = "ct-row";
  row1.appendChild(mk("\u{1F6AA} Admit all", "Admit everyone waiting", () => { act("admitAll"); toast("Admitted everyone waiting.", "ok"); }));
  row1.appendChild(mk("\u{1F507} Mute all", "Mute every student mic", () => { act("muteAll"); toast("Muted all student mics.", "ok"); }));
  row1.appendChild(mk("\u{270B} Lower hands", "Lower all raised hands", () => { act("lowerHands"); }));
  panel.appendChild(row1);
  const row2 = document.createElement("div");
  row2.className = "ct-row";
  row2.appendChild(mk("\u{1F512} Lock / unlock", "Lock the class against new joins (or unlock)", () => {
    coLockOn = !coLockOn;
    act("lock", null, { on: coLockOn });
    toast(coLockOn ? "Class locked — no new students can join" : "Class unlocked");
  }));
  row2.appendChild(mk("\u{1F4E3} Announce", "Send an announcement to the whole class", () => {
    const t = prompt("Announcement to the class (max 500 chars):");
    if (t && t.trim()) act("announce", null, { text: t.trim() });
  }));
  row2.appendChild(mk("\u{1F4CA} Poll", "Start a quick poll", () => {
    const q = prompt("Poll question:");
    if (!q || !q.trim()) return;
    const os = prompt("Options, separated by commas (2 to 6):");
    if (!os) return;
    const opts = os.split(",").map((x) => x.trim()).filter(Boolean);
    if (opts.length >= 2) act("poll", null, { def: { question: q.trim(), options: opts } });
    else toast("A poll needs at least 2 options.", "err");
  }));
  panel.appendChild(row2);
  /* r22 (items 2+3): the Co-Tutor gets the SAME new platform powers —
     class gallery, breakout room broadcast/close, reactions, suspend. */
  const row3 = document.createElement("div");
  row3.className = "ct-row";
  let ctGalleryOn = false;
  row3.appendChild(mk("\u{1F465} Gallery", "Let students see & hear each other (the teacher can also mark individuals)", () => {
    ctGalleryOn = !ctGalleryOn;
    act("seeEach", null, { on: ctGalleryOn });
    toast(ctGalleryOn ? "\u{1F465} Class gallery ON" : "\u{1F6AB} Class gallery OFF", "ok");
  }));
  row3.appendChild(mk("\u{1F4E2} To rooms", "Broadcast a message to every breakout room", () => {
    const t = prompt("Message to ALL breakout rooms:");
    if (t && t.trim()) { act("brBroadcast", null, { text: t.trim() }); toast("\u{1F4E2} Sent to all rooms", "ok"); }
  }));
  row3.appendChild(mk("\u{23F9} Close rooms", "Close all breakout rooms — everyone returns to the main class", () => {
    if (confirm("Close all breakout rooms now?")) { act("brEnd"); toast("\u{1F6AA} Rooms closed", "ok"); }
  }));
  row3.appendChild(mk("\u{1F44D} React", "Send a reaction to the class", () => {
    const e = prompt("Reaction emoji (e.g. \u{1F44D}, \u{1F389}, \u{1F44F}):");
    if (e && e.trim()) act("reaction", null, { emoji: e.trim().slice(0, 8) });
  }));
  row3.appendChild(mk("\u{1F6E1} Suspend", "Mute all, lower hands, stop shares, gallery off, close rooms, lock — like Zoom's Suspend Activities", () => {
    if (confirm("\u{1F6E1} Suspend ALL activities?")) { act("suspend"); toast("\u{1F6E1} Activities suspended", "ok"); }
  }));
  /* r22 (item 2, parity completion): the Co-Tutor can also CREATE breakout
     rooms - the same power as the Tutor's Rooms modal, prompt-driven for
     the compact console. Moving students is the per-row link button. */
  row3.appendChild(mk("\u{1F6AA} Rooms", "Create breakout rooms (choose count + auto/manual) - the same power as the Tutor", () => {
    const nStr = prompt("How many breakout rooms? (2 to 10)");
    if (!nStr) return;
    const n = parseInt(nStr, 10);
    if (!(n >= 2 && n <= 10)) { toast("Enter a number from 2 to 10.", "err"); return; }
    const auto = confirm("Assignment:\n\nOK = AUTOMATIC (students spread evenly)\nCancel = MANUAL (you move students in afterwards)");
    const defs = [];
    for (let i = 0; i < n; i++) defs.push({ name: "Breakout " + (i + 1) });
    act("brCreate", null, { defs, mode: auto ? "auto" : "manual" });
    toast("\u{1F6AA} " + n + " breakout rooms created" + (auto ? " - students auto-assigned evenly" : " - now move students with the \u{1F517} button on each student row"), "ok", 8000);
  }));
  /* ── r22 completion: Co-Tutor parity for the new matrix features ── */
  row3.appendChild(mk("\u{1F4CA} Poll rooms", "Create breakout rooms from the last poll - one room per option, everyone who answered lands with their answer (Zoom-style)", () => {
    act("brPollRooms");
    toast("\u{1F4CA} Creating rooms from the last poll - students land with their own answer.", "ok", 8000);
  }));
  row3.appendChild(mk("\u{23F1} Room timer", "Start (or cancel) the breakout-room countdown - students see it, rooms close automatically at zero", () => {
    const mStr = prompt("Minutes until the rooms close (1-240). Leave EMPTY to cancel a running timer:", "10");
    if (mStr === null) return;
    if (String(mStr).trim() === "") { act("brTimer", null, { cancel: true }); toast("\u{23F1} Room timer cancelled.", "ok", 6000); return; }
    const mins = parseInt(mStr, 10);
    if (!(mins >= 1 && mins <= 240)) { toast("Enter 1 to 240 minutes.", "err"); return; }
    act("brTimer", null, { minutes: mins });
    toast("\u{23F1} Rooms close automatically in " + mins + " minute(s).", "ok", 8000);
  }));
  row3.appendChild(mk("\u{1F4AC} Chat mode", "Who students may chat with: everyone / teacher only / no one (Zoom-style)", () => {
    const pick = prompt("Student chat mode:\n\n1 = Everyone\n2 = Teacher & Co-Tutors only\n3 = No one (off)\n\nType 1, 2 or 3:", "1");
    if (!pick) return;
    const mode = { "1": "class", "2": "host", "3": "off" }[String(pick).trim()];
    if (!mode) { toast("Type 1, 2 or 3.", "err"); return; }
    act("chatMode", null, { mode });
    toast(mode === "off" ? "\u{1F6AB} Student chat OFF" : mode === "host" ? "\u{1F464} Students chat with teacher only" : "\u{1F4AC} Students chat with everyone", "ok", 6000);
  }));
  row3.appendChild(mk("\u{1F399} Self-unmute", "Allow or block students unmuting themselves (blocking also mutes everyone, Zoom-style)", () => {
    const on = confirm("Allow students to unmute themselves?\n\nOK = allow\nCancel = block (mutes everyone and locks their mic buttons)");
    act("selfUnmute", null, { on });
    toast(on ? "\u{1F399} Students may unmute themselves." : "\u{1F399} Self-unmute blocked - everyone muted, hands still work.", "ok", 7000);
  }));
  row3.appendChild(mk("\u{1F64B} Q&A", "Open/close the Q&A, answer or clear questions (Google Meet / Zoho style)", () => {
    const open = (coQaData.open !== false);
    const pick = prompt("Q&A controls:\n\n1 = " + (open ? "close" : "open") + " questions\n2 = answer a question\n3 = clear all questions\n\nType 1, 2 or 3:", "1");
    if (!pick) return;
    const c = String(pick).trim();
    if (c === "1") { act("qaMode", null, { open: !open }); toast(open ? "\u{26D4} Q&A closed." : "\u{2705} Q&A open.", "ok", 5000); }
    else if (c === "2") {
      const pending = (coQaData.questions || []).filter((q) => !q.answered);
      if (!pending.length) { toast("No unanswered questions right now.", ""); return; }
      const list = pending.map((q, i) => (i + 1) + ". " + q.from + ": " + q.text.slice(0, 60)).join("\n");
      const num = prompt("Answer which question?\n\n" + list + "\n\nType the number:", "1");
      const idx = parseInt(num, 10) - 1;
      if (!(idx >= 0 && idx < pending.length)) { toast("Type a number from the list.", "err"); return; }
      const ans = prompt("Your answer (everyone in the class will see it):");
      if (ans == null || !String(ans).trim()) return;
      act("qaAnswer", null, { id: pending[idx].id, text: String(ans).trim() });
      toast("\u{2705} Answer sent to the whole class.", "ok", 6000);
    }
    else if (c === "3") { if (confirm("Remove every question?")) { act("qaClear"); toast("\u{1F9F9} Q&A cleared.", "ok", 5000); } }
    else toast("Type 1, 2 or 3.", "err");
  }));
  panel.appendChild(row3);
  const rosterBox = document.createElement("div");
  rosterBox.className = "ct-roster";
  panel.appendChild(rosterBox);
  document.body.appendChild(panel);
  coTutorPanelEl = panel;
  try { sRoom.coHostAction("syncRoster"); } catch (e) {}
  toast("\u{1F393} You are now a CO-TUTOR — the full tutor toolkit. Manage the class from the Co-Tutor console.", "ok", 9000);
}
function handleCoRoster(d) {
  var coRosterData = { students: (d && d.students) || [], pending: (d && d.pending) || [] };
  const box = coTutorPanelEl && coTutorPanelEl.querySelector(".ct-roster");
  if (!box) return;
  box.innerHTML = "";
  if (coRosterData.pending.length) {
    const ph = document.createElement("div");
    ph.className = "ct-pending";
    ph.innerHTML = "<b>\u23F3 Waiting room</b>";
    coRosterData.pending.forEach((st) => {
      const r = document.createElement("div");
      r.className = "ct-stu";
      const nm = document.createElement("span");
      nm.textContent = st.name;
      r.appendChild(nm);
      const b1 = document.createElement("button"); b1.textContent = "Admit";
      b1.addEventListener("click", () => { try { sRoom.coHostAction("admit", st.peerId); } catch (e) {} });
      const b2 = document.createElement("button"); b2.textContent = "Deny";
      b2.addEventListener("click", () => { try { sRoom.coHostAction("deny", st.peerId); } catch (e) {} });
      r.appendChild(b1); r.appendChild(b2);
      ph.appendChild(r);
    });
    box.appendChild(ph);
  }
  if (!coRosterData.students.length) {
    box.innerHTML = "<p style='opacity:.7'>No students yet.</p>";
    return;
  }
  const sh = document.createElement("b");
  sh.textContent = "Students (" + coRosterData.students.length + ")";
  box.appendChild(sh);
  coRosterData.students.forEach((st) => {
    const r = document.createElement("div");
    r.className = "ct-stu";
    const nm = document.createElement("span");
    nm.textContent = (st.hand ? "\u270B " : "") + st.name + (st.coTutor ? " \u{1F393}" : st.coHost ? " \u{1F451}" : "");
    r.appendChild(nm);
    const mk2 = (label, title, fn) => {
      const b = document.createElement("button");
      b.textContent = label; b.title = title;
      b.addEventListener("click", fn);
      r.appendChild(b);
    };
    mk2("\u{1F3A4}", "Spotlight " + st.name, () => { try { sRoom.coHostAction("spotlight", null, { name: st.name }); } catch (e) {} });
    /* r22 (item 3): the Co-Tutor also controls class-gallery visibility and
       student-to-student DM permissions for this student. */
    mk2("\u{1F517}", st.breakout ? "Move " + st.name + " to another breakout room (or back to the main class)" : "Send " + st.name + " into a breakout room", () => {
      const rooms = coRosterData.students.map((x) => x.breakout).filter((b, i, a) => b && a.indexOf(b) === i);
      const opts = ["MAIN (the main class)"].concat(rooms || []);
      const pick = prompt("Move " + st.name + " where?\n\n" + opts.join("\n") + "\n\nType MAIN for the main class, or the exact room name (rooms must already be open).");
      if (!pick) return;
      const p = pick.trim().toUpperCase();
      if (p === "MAIN") { act("brMove", st.peerId, { roomId: "" }); toast(st.name + " returned to the main class", "ok"); return; }
      const target = (coRosterData.students.find((x) => x.breakout && x.breakout.toUpperCase() === p) || {}).breakout;
      if (!target) { toast("No breakout room named \"" + pick + "\" is open. Open rooms first (\u{1F6AA} Rooms).", "err", 8000); return; }
      act("brMove", st.peerId, { roomId: target });
      toast("\u{1F500} " + st.name + " moved to " + target, "ok", 6000);
    });
    mk2("\u{1F441}", st.visibleToClass ? "Hide " + st.name + " from the class gallery" : "Show " + st.name + " to the class gallery (students see & hear them)", () => {
      try { sRoom.coHostAction("visible", st.peerId, { on: !st.visibleToClass }); } catch (e) {}
      toast(st.visibleToClass ? st.name + " hidden from the gallery" : "\u{1F441} " + st.name + " visible to the class", "ok");
    });
    mk2("\u{1F4AC}", "Who may " + st.name + " message? (student-to-student DMs)", () => {
      const others = coRosterData.students.filter((x) => x.peerId !== st.peerId);
      if (!others.length) { toast("No other students yet.", ""); return; }
      let msg = "Type the NAMES this student may message, separated by commas.\nLeave empty to allow nobody.\n\nStudents in the class:\n" + others.map((x) => x.name).join(", ");
      const allowedNames = (st.dmAllowed || []).map((pid) => { const o = others.find((x) => x.peerId === pid); return o ? o.name : null; }).filter(Boolean);
      const inp = prompt(msg, allowedNames.join(", "));
      if (inp === null) return;
      const wantNames = inp.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
      for (const o of others) {
        const was = (st.dmAllowed || []).indexOf(o.peerId) > -1;
        const want = wantNames.indexOf(o.name.toLowerCase()) > -1;
        if (was !== want) { try { sRoom.coHostAction("dm", st.peerId, { to: o.peerId, on: want }); } catch (e) {} }
      }
      toast("\u{1F4AC} DM permissions updated for " + st.name, "ok");
    });
    mk2("\u{1F3A7}", st.micAllowed ? "Revoke mic" : "Allow mic", () => { try { sRoom.coHostAction("allowMic", st.peerId, { on: !st.micAllowed }); } catch (e) {} });
    /* r22 completion: Zoom "Rename" — the Co-Tutor renames a student too */
    mk2("\u{270F}\u{FE0F}", "Rename " + st.name + " (everyone's roster switches to the new name)", () => {
      const nn = prompt("Rename " + st.name + " to:", st.name);
      if (nn == null) return;
      const clean = String(nn).trim();
      if (!clean) { toast("The name cannot be empty.", "err"); return; }
      act("rename", st.peerId, { name: clean });
    });
    mk2("\u{1F4F7}", "Ask camera", () => { try { sRoom.coHostAction("requestCam", st.peerId, { on: true }); } catch (e) {} });
    /* r21 (item 4 × item 6): a Co-Tutor has the SAME audience choice as the
       Tutor — "teacher only" or "the whole class" — instead of a hardcoded
       one. The chooser is honest about who sees what: a teacher-only share
       goes to the Tutor's host pipe; a class share is relayed to everyone
       (this Co-Tutor included). */
    mk2("\u{1F5A5}", "Ask " + st.name + "'s screen — choose who sees it", () => {
      let ch = r.nextElementSibling;
      if (ch && ch.classList && ch.classList.contains("ct-scr-aud")) { ch.remove(); return; }
      document.querySelectorAll(".ct-scr-aud").forEach((n) => { try { n.remove(); } catch (e) {} });
      ch = document.createElement("div");
      ch.className = "ct-scr-aud";
      ch.style.cssText = "display:flex;flex-direction:column;gap:4px;margin:4px 0 6px;padding:6px;border:1px solid rgba(148,163,184,.4);border-radius:8px";
      const opt = (label, fn) => {
        const b = document.createElement("button");
        b.textContent = label;
        b.addEventListener("click", () => { try { fn(); } catch (e) {} try { ch.remove(); } catch (e) {} });
        ch.appendChild(b);
      };
      opt("\u{1F464} Teacher only", () => sRoom.coHostAction("requestScr", st.peerId, { on: true, audience: "me" }));
      opt("\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467} The WHOLE CLASS (you included)", () => sRoom.coHostAction("requestScr", st.peerId, { on: true, audience: "class" }));
      opt("\u23F9 Stop " + st.name + "'s screen", () => sRoom.coHostAction("requestScr", st.peerId, { on: false }));
      r.insertAdjacentElement("afterend", ch);
    });
    mk2("\u2715", "Remove " + st.name + " from the class", () => {
      if (confirm("Remove " + st.name + " from the class?")) { try { sRoom.coHostAction("kick", st.peerId); } catch (e) {} }
    });
    box.appendChild(r);
  });
}

/* v5 (issue 1): student screen sharing — show your work to the teacher */
let myScreenOn = false;
$("#sBtnScreen").addEventListener("click", toggleMyScreen);
async function toggleMyScreen() {
  try {
    if (!myScreenOn) {
      await sRoom.shareScreen(true);
      myScreenOn = true;
      myScreenIsCamView = false;
      $("#sBtnScreen").classList.add("active");
      toast(pendingScreenAudience === "class"
        ? "\u{1F5A5} Your screen is being shown to the WHOLE CLASS"
        : "\u{1F5A5} You are sharing your screen with the teacher", "ok", 6000);
    } else {
      stopMyScreenShare();
    }
  } catch (e) {
    if (e && e.noDisplayMedia) {
      /* v9: phone browsers have no screen-capture API — offer the camera
         fallback and tell the teacher why, instead of the misleading
         "join the class" error. */
      try { sRoom && sRoom.sendScreenNack("device_cannot_capture_screen"); } catch {}
      openScreenAsk();
    } else if (e && (e.name === "NotAllowedError" || e.name === "PermissionDeniedError")) {
      toast("Screen share was blocked. Allow it in the browser prompt, then tap the 🖥 button again.", "err", 6000);
    } else {
      toast(e.message || "Screen share blocked. On phones use Chrome/Edge; some browsers don't allow it.", "err", 6000);
    }
  }
}
function stopMyScreenShare() {
  /* Stops BOTH real screen shares and camera-view fallbacks. */
  myScreenOn = false;
  myScreenIsCamView = false;
  $("#sBtnScreen").classList.remove("active");
  try { sRoom && sRoom.shareScreen(false); } catch {}
  hideSelfView();
  refreshFlipButton();
  toast("Sharing stopped");
}
async function startCameraView() {
  try {
    const stream = await sRoom.shareCameraView();
    myScreenOn = true;
    myScreenIsCamView = true;
    $("#sBtnScreen").classList.add("active");
    showSelfView(stream, true);
    refreshFlipButton();
    closeModal("#mScreenAsk");
    toast("📷 Showing your work — point your camera at your book. Tap 🔄 to switch front/back camera.", "ok", 7000);
  } catch (e) {
    toast(e.message || "Camera unavailable. Allow camera access and try again.", "err", 6000);
  }
}
/* v9 chooser: real screen share on desktop, camera fallback on phones. */
let pendingScreenAudience = "me";
function openScreenAsk() {
  /* r21 (item 6): the student is told WHO will see the share before they
     choose — informed consent, no surprises. */
  try {
    const note = document.getElementById("scrAudNote");
    if (note) note.textContent = pendingScreenAudience === "class"
      ? "Your teacher wants to show your screen to the WHOLE CLASS."
      : "Only your teacher will see it.";
  } catch (e) {}
  openModal("#mScreenAsk");
}

$("#sBtnMic").addEventListener("click", toggleMyMic);

/* v9: one-tap mic / screen chooser modal buttons */
document.addEventListener("click", (ev) => {
  const t = ev.target.closest ? ev.target.closest("button") : null;
  if (!t) return;
  if (t.id === "btnMicYes")   { closeModal("#mMicAsk"); if (!myMicOn) toggleMyMic(); }
  if (t.id === "btnMicLater") { closeModal("#mMicAsk"); toast("Mic button is ready whenever you are.", "", 4000); }
  if (t.id === "btnScrShare") { closeModal("#mScreenAsk"); if (!myScreenOn) toggleMyScreen(); }
  if (t.id === "btnCamView")  { startCameraView(); }
  if (t.id === "btnScrNo")    {
    closeModal("#mScreenAsk");
    try { sRoom && sRoom.sendScreenNack("student_declined"); } catch {}
  }
});
async function toggleMyMic() {
  if (!allowSelfUnmute) { toast("The teacher has locked student mics — raise your hand (✋) and the teacher can unmute you.", "err", 6000); return; }
  if (!micAllowed && !myMicOn) { toast("Raise your hand — the teacher must allow your mic first."); return; }
  try {
    if (!myMicOn) { await sRoom.shareMic(true); myMicOn = true; $("#sBtnMic").classList.add("active"); toast("🎙 You are speaking", "ok"); }
    else { await sRoom.shareMic(false); myMicOn = false; $("#sBtnMic").classList.remove("active"); toast("Mic off"); }
  } catch { toast("Mic blocked. Allow microphone in browser settings.", "err"); }
}

$("#sBtnFull").addEventListener("click", toggleFullscreen);
$("#sBtnLeave").addEventListener("click", () => {
  if (confirm("Leave the class?")) { Store.set("joined_" + (sRoom ? sRoom.code : normaliseRoomCode($("#inRoom").value)), false); if (sRoom) sRoom.leave(); cleanupAndGate("You left the class."); }
});

/* ---------- polls ---------- */
function showPoll(poll) {
  $("#sPollQ").textContent = poll.question;
  const box = $("#sPollOpts");
  box.innerHTML = "";
  poll.options.forEach((o, i) => {
    const b = document.createElement("button");
    b.className = "btn";
    b.style.justifyContent = "flex-start";
    b.textContent = (i + 1) + ". " + o;
    b.addEventListener("click", () => {
      sRoom.answerPoll(i);
      closeModal("#mPoll");
      toast("Answer sent ✔", "ok");
    });
    box.appendChild(b);
  });
  openModal("#mPoll");
}
function showPollResults(res) {
  if (!res) return;
  const total = res.counts.reduce((a, b) => a + b, 0) || 1;
  $("#sPollQ").textContent = res.question + " — results";
  $("#sPollOpts").innerHTML = res.options.map((o, i) => `
    <div class="poll-opt"><div class="poll-bar">
      <i style="width:${Math.round((res.counts[i] / total) * 100)}%"></i>
      <b>${escapeHtml(o)} — ${res.counts[i]} (${Math.round((res.counts[i] / total) * 100)}%)</b>
    </div></div>`).join("");
  openModal("#mPoll");
  setTimeout(() => closeModal("#mPoll"), 7000);
}

/* ---------- v3: quizzes ---------- */
let quizTimerInt = null, quizAnsweredThis = false;
function showQuiz(q) {
  if (!q) return;
  quizAnsweredThis = false;
  $("#sQuizTitle").textContent = "🏆 " + (q.title || "Quiz");
  $("#sQuizPos").textContent = (q.index + 1) + " / " + q.total;
  $("#sQuizQ").textContent = q.question;
  $("#sQuizFb").classList.add("hide");
  const box = $("#sQuizOpts");
  box.innerHTML = "";
  q.options.forEach((o, i) => {
    const b = document.createElement("button");
    b.className = "btn";
    b.style.justifyContent = "flex-start";
    b.textContent = String.fromCharCode(65 + i) + ". " + o;
    b.addEventListener("click", () => {
      if (quizAnsweredThis) return;
      quizAnsweredThis = true;
      sRoom.answerQuiz(q.index, i);
      $$("#sQuizOpts .btn").forEach((x) => (x.disabled = true));
      b.classList.add("active");
    });
    box.appendChild(b);
  });
  // countdown display
  clearInterval(quizTimerInt);
  let left = q.seconds || 30;
  $("#sQuizTimer").textContent = "⏱ " + left + "s";
  quizTimerInt = setInterval(() => {
    left--;
    $("#sQuizTimer").textContent = left > 0 ? "⏱ " + left + "s" : "⏱ time!";
    if (left <= 0) { clearInterval(quizTimerInt); $$("#sQuizOpts .btn").forEach((x) => (x.disabled = true)); }
  }, 1000);
  openModal("#mQuiz");
}
function showQuizFeedback(d) {
  const fb = $("#sQuizFb");
  fb.classList.remove("hide");
  let html;
  if (d.correct) { html = "✅ Correct! Points added."; fb.style.color = "var(--ok)"; }
  else {
    const letter = String.fromCharCode(65 + Number(d.correctIndex));
    html = "❌ Not quite — the answer was " + letter + ".";
    fb.style.color = "var(--danger)";
  }
  fb.innerHTML = escapeHtml(html) +
    (d.explanation ? '<div style="font-weight:400;font-size:13px;color:var(--text-dim);margin-top:6px">💡 ' + escapeHtml(d.explanation) + "</div>" : "");
}
function showQuizLeaderboard(rows) {
  clearInterval(quizTimerInt);
  $("#sQuizTitle").textContent = "🏆 Quiz results";
  $("#sQuizTimer").textContent = "";
  $("#sQuizQ").textContent = "Top scores:";
  $("#sQuizFb").classList.add("hide");
  $("#sQuizOpts").innerHTML = (rows || []).map((r, i) =>
    `<div class="chat-msg"><b>${i + 1}.</b> ${escapeHtml(r.name)} — <b>${r.score} pts</b></div>`).join("") ||
    "<p>No scores.</p>";
  openModal("#mQuiz");
  setTimeout(() => closeModal("#mQuiz"), 9000);
}

/* ---------- reconnect / cleanup ----------
   v5 (issue 3): PROFESSIONAL RECONNECT. If the teacher's connection drops
   (left the app, network blip, tablet restart), students stay on the stage
   with a "reconnecting" banner and silently retry for up to 10 MINUTES.
   The moment the teacher is back live (same room code), everyone is
   reconnected automatically — nobody has to rejoin manually. */
let rejoinTries = 0;
const REJOIN_MAX_TRIES = 75;            // ~10 min with capped backoff
let rejoinBanner = null;
let rejoinBusy = false;
function showRejoinBanner() {
  if (rejoinBanner) return;
  rejoinBanner = document.createElement("div");
  rejoinBanner.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:9000;background:#b7791f;color:#fff;text-align:center;padding:8px;font-size:14px;font-weight:600";
  rejoinBanner.textContent = "📡 Connection to the teacher lost — reconnecting automatically… stay on this page";
  document.body.appendChild(rejoinBanner);
}
function hideRejoinBanner() { if (rejoinBanner) { rejoinBanner.remove(); rejoinBanner = null; } }

async function attemptRejoin() {
  if (rejoinBusy || !stageEntered || lobbyOn) return;
  rejoinBusy = true;
  showRejoinBanner();
  const code = normaliseRoomCode($("#inRoom").value);
  const name = Store.get("stuname", "Student");
  try {
    let rejoinLastFail = null;   /* v13.1: transport memory for mid-class reconnects */
    while (stageEntered && !lobbyOn && rejoinTries < REJOIN_MAX_TRIES) {
      rejoinTries++;
      await new Promise((r) => setTimeout(r, Math.min(8000, 2000 + rejoinTries * 500)));
      const oldRoom = sRoom;
      try { oldRoom && oldRoom.leave(); } catch {}
      const candidate = new StudentRoom(code, name, { onEvent: onEvent, pin: $("#inPin").value.trim(), tok: qs.get("tok") || "" });
      sRoom = candidate;
      try {
        const result = await candidate.join();
        if (!stageEntered) { candidate.leave(); return; }
        rememberTransport(rejoinLastFail);   /* v13.1: the route that reconnected us is the one to keep */
        rejoinTries = 0;
        hideRejoinBanner();
        if (result && result.state === "waiting") {
          showWaitingState(code, name);
          return;
        }
        toast("✅ Reconnected to the class!", "ok");
        return;
      } catch (e) {
        try { candidate.leave(); } catch {}
        if (e && e.retryable === false) {
          cleanupAndGate(e.message || "The teacher rejected this join request.");
          return;
        }
        rejoinLastFail = e && e.message;   /* v13.1 */
        /* v13.1: same adaptive escalation as the lobby — the SECOND rejoin
           attempt onwards goes TCP/TLS-first, so a hotspot student whose
           connection dropped reconnects on a route that can pass. */
        if (rejoinTries >= 1) window.__cdPreferTcp = true;
      }
    }
    if (stageEntered && rejoinTries >= REJOIN_MAX_TRIES) {
      cleanupAndGate("Could not reconnect after several minutes. Tap Join class to try again.");
    }
  } finally {
    rejoinBusy = false;
  }
}

function cleanupAndGate(message) {
  lobbyOn = false;
  coHostOn = false; coLockOn = false;
  if (coHostPanelEl) { try { coHostPanelEl.remove(); } catch (e) {} coHostPanelEl = null; }
  clearTimeout(lobbyTimer);
  lobbyTimer = null;
  const oldRoom = sRoom;
  sRoom = null;
  try { oldRoom && oldRoom.leave(); } catch {}
  rejoinTries = 0;
  hideRejoinBanner();
  stageEntered = false;
  pendingStream = null;
  handUp = false;
  myCamOn = false; myMicOn = false; myScreenOn = false; micAllowed = false;
  myScreenIsCamView = false;
  hideSelfView();
  refreshFlipButton();
  const capB = $("#sCapBadge"); if (capB) capB.classList.add("hide");
  clearInterval(quizTimerInt);
  quizTimerInt = null;
  $("#stageVideo").pause(); $("#stageVideo").srcObject = null;
  $("#teacherVideo").pause(); $("#teacherVideo").srcObject = null;
  $("#stageWrap").classList.add("hide");
  $("#stageStatus").classList.add("hide");
  $("#stuControls").classList.add("hidden");
  $("#teacherPip").classList.remove("show");
  $("#sDrawerChat").classList.remove("open");
  $("#reactBar").classList.add("hide");
  $("#sBoardWrap").classList.add("hide");
  $("#sbReopen").classList.add("hide");
  $("#sGroupBanner").classList.add("hide");
  ["#sBtnHand", "#sBtnReact", "#sBtnCam", "#sBtnScreen", "#sBtnMic"].forEach((sel) => $(sel).classList.remove("active"));
  $("#sBtnMic").disabled = true;
  closeModal("#mWaiting");
  $("#joinGate").classList.remove("hide");
  restoreJoinButton();
  $("#joinStatus").textContent = message;
  window._wantWake = false; keepAwake(false);
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
}

/* ============================================================
   v8 STUDENT FEATURES
   ============================================================ */

/* ---------- v8.1 personal whiteboard ---------- */
let sbOn = false, sbColor = "#111111", sbStrokes = [], sbCur = null, sbCanvas = null, sbCtx = null;
let sbSendTimer = null;

function sbInit() {
  if (sbCanvas) return;
  sbCanvas = document.createElement("canvas");
  sbCanvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;touch-action:none";
  $("#sBoardStage").appendChild(sbCanvas);
  sbCtx = sbCanvas.getContext("2d");
  new ResizeObserver(sbResize).observe($("#sBoardStage"));
  sbResize();
  sbCanvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    sbCanvas.setPointerCapture(e.pointerId);
    sbCur = { c: sbColor, w: 3, p: [sbPos(e)] };
  });
  sbCanvas.addEventListener("pointermove", (e) => {
    if (!sbCur) return;
    e.preventDefault();
    sbCur.p.push(sbPos(e));
    sbDraw();
  });
  const up = () => {
    if (!sbCur) return;
    sbStrokes.push(sbCur);
    sbCur = null;
    sbDraw();
    sbQueueSend();
  };
  sbCanvas.addEventListener("pointerup", up);
  sbCanvas.addEventListener("pointercancel", up);
  $$(".sb-c").forEach((c) => c.addEventListener("click", () => {
    sbColor = c.dataset.c;
    $$(".sb-c").forEach((x) => x.style.borderColor = "transparent");
    c.style.borderColor = "#fff";
  }));
  $("#sbUndo").addEventListener("click", () => { sbStrokes.pop(); sbDraw(); sbQueueSend(true); });
  $("#sbClear").addEventListener("click", () => { sbStrokes = []; sbDraw(); sbQueueSend(true); });
  $("#sbMin").addEventListener("click", () => {
    $("#sBoardWrap").classList.add("hide");
    $("#sbReopen").classList.remove("hide");
  });
  $("#sbReopen").addEventListener("click", () => {
    $("#sBoardWrap").classList.remove("hide");
    $("#sbReopen").classList.add("hide");
  });
}
function sbPos(e) {
  const r = sbCanvas.getBoundingClientRect();
  const w = Math.max(1, r.width), h = Math.max(1, r.height);
  return [Math.max(0, Math.min(1, (e.clientX - r.left) / w)), Math.max(0, Math.min(1, (e.clientY - r.top) / h))];
}
function sbResize() {
  if (!sbCanvas) return;
  const r = $("#sBoardStage").getBoundingClientRect();
  sbCanvas.width = Math.max(50, r.width);
  sbCanvas.height = Math.max(50, r.height);
  sbDraw();
}
let sbBg = null;
function sbDraw() {
  if (!sbCtx) return;
  const W = sbCanvas.width, H = sbCanvas.height;
  sbCtx.fillStyle = "#fff"; sbCtx.fillRect(0, 0, W, H);
  if (sbBg && sbBg.complete) {
    const s = Math.min(W / sbBg.naturalWidth, H / sbBg.naturalHeight);
    sbCtx.globalAlpha = 0.85;
    sbCtx.drawImage(sbBg, (W - sbBg.naturalWidth * s) / 2, (H - sbBg.naturalHeight * s) / 2,
      sbBg.naturalWidth * s, sbBg.naturalHeight * s);
    sbCtx.globalAlpha = 1;
  }
  sbCtx.lineCap = "round"; sbCtx.lineJoin = "round";
  for (const s of [...sbStrokes, ...(sbCur ? [sbCur] : [])]) {
    sbCtx.strokeStyle = s.c; sbCtx.lineWidth = s.w;
    sbCtx.beginPath();
    s.p.forEach(([x, y], i) => i ? sbCtx.lineTo(x * W, y * H) : sbCtx.moveTo(x * W, y * H));
    sbCtx.stroke();
  }
}
function sbQueueSend(full) {
  clearTimeout(sbSendTimer);
  sbSendTimer = setTimeout(() => {
    if (sRoom) sRoom.sendBoardStrokes(sbStrokes.slice(-40), true);
  }, full ? 100 : 450);
}

/* ---------- v8.2 activities ---------- */
let actKind = null, actRating = 0;
function showActivity(def) {
  actKind = def.kind;
  $("#sActTitle").textContent = ({ open: "💬 ", cloud: "☁ ", board: "🧱 ", exit: "🎟 " })[def.kind] + def.prompt;
  $("#sActOpen").classList.toggle("hide", def.kind === "exit");
  $("#sActExit").classList.toggle("hide", def.kind !== "exit");
  $("#sActText").value = "";
  $("#sActText").placeholder = def.kind === "cloud" ? "One word only…" : def.kind === "board" ? "Write one sticky-note idea…" : "Type your answer…";
  $("#sActText").maxLength = def.kind === "cloud" ? 24 : def.kind === "board" ? 120 : 280;
  $("#sActDone").classList.add("hide");
  $("#sActSend").classList.remove("hide");
  actRating = 0;
  $$("#sActStars span").forEach((s) => s.textContent = "☆");
  openModal("#mActivity");
}
$$("#sActStars span").forEach((s) => s.addEventListener("click", () => {
  actRating = Number(s.dataset.r);
  $$("#sActStars span").forEach((x) => x.textContent = Number(x.dataset.r) <= actRating ? "⭐" : "☆");
}));
$("#sActSend").addEventListener("click", () => {
  let resp;
  if (actKind === "exit") {
    resp = { rating: actRating || 3, learned: $("#sActLearned").value.trim(), confusing: $("#sActConfusing").value.trim() };
  } else {
    resp = $("#sActText").value.trim();
    if (!resp) { toast("Type something first"); return; }
    if (actKind === "cloud") resp = resp.split(/\s+/)[0].slice(0, 24);
  }
  sRoom.sendActivityResp(resp);
  $("#sActSend").classList.add("hide");
  $("#sActDone").classList.remove("hide");
  setTimeout(() => closeModal("#mActivity"), 1500);
});

function showActivityResults(d) {
  $("#sResTitle").textContent = ({ cloud: "☁ ", board: "🧱 ", open: "💬 ", exit: "🎟 " })[d.kind] + d.prompt;
  const body = $("#sResBody");
  const items = Array.isArray(d.items) ? d.items : [];
  if (d.kind === "cloud") {
    /* build a word cloud: count words, size by frequency */
    const counts = {};
    items.forEach((w) => {
      const k = String(w).toLowerCase();
      counts[k] = (counts[k] || 0) + 1;
    });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 40);
    const max = entries.length ? entries[0][1] : 1;
    const colors = ["#4f6ef7", "#e02b2b", "#0a8a3a", "#f59e0b", "#8b5cf6", "#0891b2"];
    body.innerHTML = entries.map(([w, n], i) =>
      '<span style="font-size:' + (15 + (n / max) * 26) + 'px;color:' + colors[i % 6] +
      ';font-weight:700;margin:0 8px;display:inline-block">' + escapeHtml(w) + "</span>").join(" ");
    body.style.textAlign = "center";
  } else if (d.kind === "board") {
    const colors = ["#fff9c4", "#dbeafe", "#dcfce7", "#fde2e7", "#ede9fe"];
    body.style.textAlign = "left";
    body.innerHTML = items.map((t, i) => '<div class="chat-msg" style="display:inline-block;vertical-align:top;min-width:150px;max-width:220px;margin:8px;padding:12px;background:' + colors[i % colors.length] + ';color:#152238;border-left:4px solid var(--accent);transform:rotate(' + (((i % 5) - 2) * 1.5) + 'deg)">' + escapeHtml(String(t)) + '</div>').join("");
  } else if (d.kind === "exit") {
    body.style.textAlign = "left";
    body.innerHTML = items.map((t) => {
      const result = t && typeof t === "object" ? t : { rating: 0, learned: String(t || ""), confusing: "" };
      const rating = Math.max(1, Math.min(5, Number(result.rating) || 1));
      return '<div class="chat-msg"><b>' + "⭐".repeat(rating) + '</b><br/><b>Learned:</b> ' + escapeHtml(result.learned || "—") + '<br/><b>Confusing:</b> ' + escapeHtml(result.confusing || "—") + '</div>';
    }).join("");
  } else {
    body.style.textAlign = "left";
    body.innerHTML = items.map((t) => '<div class="chat-msg">' + escapeHtml(String(t)) + "</div>").join("");
  }
  openModal("#mActResults");
}

/* ---------- v8 event routing ---------- */
const _v7OnEvent = onEvent;
onEvent = function (type, p) {
  _v7OnEvent(type, p);
  switch (type) {
    case "boards":
      if (p.on) {
        sbInit();
        sbStrokes = [];
        sbBg = null;
        if (p.bg) { sbBg = new Image(); sbBg.src = p.bg; sbBg.onload = sbDraw; }
        $("#sBoardWrap").classList.remove("hide");
        $("#sbReopen").classList.add("hide");
        sbDraw();
        toast("🎨 Your teacher opened personal whiteboards — solve here!", "ok", 5000);
      } else {
        $("#sBoardWrap").classList.add("hide");
        $("#sbReopen").classList.add("hide");
      }
      break;
    case "boardsBg":
      if (p.bg) { sbBg = new Image(); sbBg.src = p.bg; sbBg.onload = sbDraw; toast("📤 Teacher sent a new board background"); }
      break;
    case "boardsClear":    /* v12: teacher reset every student board */
      sbStrokes = [];
      sbBg = null;
      try { sbDraw(); } catch {}
      toast("🧽 Teacher cleared the boards — start fresh", "ok", 5000);
      break;
    case "relay-promote":   /* v12: you are now a class captain */
      {
        const b = $("#sCapBadge");
        if (b) { b.textContent = "🛡 Class captain — your device is helping classmates see the class smoothly. Leave it plugged in if you can."; b.classList.remove("hide"); }
        toast("🛡 You are now a class captain — thank you! Your connection is strong, so a few classmates receive the class through your device. Your data use stays small.", "ok", 10000);
      }
      break;
    case "relayMode":
      if (!p.on) { const b = $("#sCapBadge"); if (b) b.classList.add("hide"); }
      break;
    case "classfull":
      /* handled by StudentRoom as a retryable failure — the lobby shows the
         honest “class is full” text and polls slowly. */
      break;
    case "activity": showActivity(p); break;
    case "activityEnd": closeModal("#mActivity"); break;
    case "activityResults": showActivityResults(p); break;
    case "award":
      sFlyEmoji(p.emoji || "⭐", p.name);
      if (p.name === Store.get("stuname", "")) toast((p.delta > 0 ? "⭐ You earned +" : "⚠ ") + p.delta + " — " + p.category, p.delta > 0 ? "ok" : "", 4000);
      break;
    case "group": {
      const b = $("#sGroupBanner");
      b.textContent = "👥 You are in GROUP " + p.num + " (of " + p.of + ")";
      b.classList.remove("hide");
      setTimeout(() => b.classList.add("hide"), 30000);
      break;
    }
  }
};

/* ══════════════════════════════════════════════════════════════════
   r22 (round 22, items 2+3) — student-side platform features:
   breakout rooms (bar + talk + camera + ask-for-help + room grid),
   the class gallery, permitted student-to-student DMs, and the
   suspended-activities notice.
   ══════════════════════════════════════════════════════════════════ */
const _r22OnEvent = onEvent;
onEvent = function (type, p) {
  _r22OnEvent(type, p);
  switch (type) {
    case "brState":
      if (p && p.on) {
        $("#brRoomName").textContent = p.roomName || "Breakout";
        $("#brPeers").textContent = p.peers && p.peers.length ? ("with " + p.peers.map((x) => x.name).join(", ")) : "you are alone in this room — the teacher can move you";
        $("#brBar").classList.remove("hide");
        $("#brGrid").classList.remove("hide");
        toast("🚪 You are in breakout room " + (p.roomName || "") + " — tap 🎙 Talk to speak with your group", "ok", 7000);
      } else {
        $("#brBar").classList.add("hide");
        $("#brGrid").classList.add("hide");
        $("#brGrid").innerHTML = "";
        try { sRoom && sRoom.brTalk(false); } catch (e) {}
        const tb = $("#sBtnTalk"), cb = $("#sBtnBrCam");
        if (tb) tb.classList.remove("active");
        if (cb) cb.classList.remove("active");
        toast("🚪 Breakout rooms closed — you are back with the whole class.", "ok", 6000);
      }
      break;
    case "brMsg":
      {
        const slot = $("#brMsgSlot");
        if (slot) {
          slot.textContent = "📢 " + (p.text || "");
          setTimeout(() => { slot.textContent = ""; }, 12000);
        }
        toast("📢 Teacher → " + (p.roomName || "your room") + ": " + (p.text || ""), "ok", 8000);
      }
      break;
    case "br-talk":
      {
        const tb = $("#sBtnTalk");
        if (tb) tb.classList.toggle("active", !!(p && p.on));
        if (p && p.on) toast("🎙 You are LIVE in your room — your room-mates hear you. Tap again to stop.", "ok", 6000);
      }
      break;
    case "dm":
      addMsg("✉ " + (p.from || "classmate") + " → you (private)", p.text, false);
      toast("✉ New private message from " + (p.from || "a classmate"), "ok", 5000);
      break;
    /* ── r22 completion: chat modes, self-unmute, rename, Q&A, room chat,
         breakout timer ── */
    case "chatMode":
      chatMode = (["off", "host", "class"].indexOf(p.mode) > -1) ? p.mode : "class";
      {
        const inp = $("#sChatInput"), send = $("#sChatSend"), note = $("#sChatModeNote");
        if (inp && send) {
          inp.disabled = chatMode === "off";
          send.disabled = chatMode === "off";
          inp.placeholder = chatMode === "off" ? "Chat is turned off" : (chatMode === "host" ? "Message goes to the teacher only…" : "Ask a question…");
        }
        if (note) note.textContent = chatMode === "off" ? "🚫 The teacher turned chat off for everyone." :
                                     chatMode === "host" ? "👤 Chat is set to teacher-only — your messages go to the teacher (private messages still work)." : "";
        toast(chatMode === "off" ? "🚫 The teacher turned chat off." :
              chatMode === "host" ? "👤 Chat is now teacher-only." :
              "💬 Chat is open to everyone again.", "", 6000);
      }
      break;
    case "chatDenied":
      toast(p && p.reason ? p.reason : "The teacher has turned chat off.", "err", 6000);
      break;
    case "selfUnmute":
      allowSelfUnmute = !!p.on;
      {
        const b = $("#sBtnMic");
        if (b && allowSelfUnmute === false) b.disabled = true;   /* stays gated by micAllowed when on */
        else if (b) b.disabled = !micAllowed;
        toast(allowSelfUnmute ? "🎙 You may unmute yourself again (when the teacher allows your mic)." :
              "🎙 The teacher locked student mics — raise your hand to speak.", "", 7000);
      }
      break;
    case "renamed":
      {
        const nn = String(p.name || "").trim();
        if (nn) {
          Store.set("stuname", nn);
          toast("✏️ The teacher renamed you to " + nn, "ok", 6000);
        }
      }
      break;
    case "qaAck":
      toast("✅ Question sent to the teacher.", "ok", 5000);
      break;
    case "qaClosed":
      toast("The Q&A is closed right now — no new questions.", "", 6000);
      break;
    case "qaAnswer":
      addMsg("❓ Q&A · " + (p.from || "student") + " asked: " + (p.question || ""), "", false);
      addMsg("✅ " + (p.by || "Teacher") + " answered: " + (p.answer || ""), "", false);
      toast("🙋 The teacher answered a Q&A question — see the chat.", "ok", 7000);
      break;
    case "qaDismiss":
      break;
    case "qaClear":
      break;
    case "qaMode":
      toast(p && p.open ? "🙋 Q&A is open — ask with the 🙋 button in the chat drawer." : "⛔ Q&A is closed for new questions.", "", 6000);
      break;
    case "qaState":
      coQaData = { open: !!(p && p.open), questions: (p && p.questions) || [] };
      break;
    case "brChat":
      addMsg("🎨 " + (p.roomName || "room") + " · " + (p.from || "classmate"), p.text, false);
      break;
    case "brTimer":
      {
        const span = $("#brTimerSpan");
        if (!p || !p.endsAt) {
          if (span) span.textContent = "";
          if (_brTimerId) { clearInterval(_brTimerId); _brTimerId = null; }
          if (p && p.closed) toast("⏹ Time is up — breakout rooms are closed. You are back with the whole class.", "ok", 8000);
        } else {
          const endsAt = p.endsAt;
          const paint = () => {
            const rem = Math.max(0, endsAt - Date.now());
            const m = Math.floor(rem / 60000), sec = Math.floor((rem % 60000) / 1000);
            if (span) span.textContent = "⏱ " + m + ":" + String(sec).padStart(2, "0");
          };
          paint();
          if (!_brTimerId) _brTimerId = setInterval(paint, 1000);
          if (p.warn) toast("⏳ ONE MINUTE left in your breakout room — wrap up!", "err", 8000);
        }
      }
      break;
    case "coErr":
      toast(p && p.error ? p.error : "That co-tutor action failed.", "err", 7000);
      break;
    case "dmDenied":
      toast("🚫 The teacher has not allowed you to message that classmate. Ask the teacher in the public chat.", "err", 8000);
      break;
    case "dmList":
      {
        const sel = $("#sChatTo");
        if (!sel) break;
        const partners = (p && p.partners) || [];
        if (!partners.length) { sel.style.display = "none"; sel.value = ""; break; }
        sel.style.display = "";
        sel.innerHTML = '<option value="">Everyone (public chat)</option>' +
          partners.map((x) => '<option value="' + x.peerId + '">' + x.name + "</option>").join("");
      }
      break;
    case "stuBcast":
      if (p && !p.on) removeBrOrGalleryTile("cdGallery", p.name, p.srcPid);
      break;
    case "suspended":
      toast("🛡 The teacher suspended all activities — mics, hands, shares and rooms are paused. Watch the teacher's stage.", "", 9000);
      break;
    case "media":
      /* r22 media kinds: breakout mesh ("br") + class gallery ("stu-bcast") */
      if (p.kind === "br") addBrOrGalleryTile("brGrid", p.stream, p.name, p.srcPid);
      if (p.kind === "stu-bcast") addBrOrGalleryTile("cdGallery", p.stream, p.name, p.srcPid);
      break;
    case "media-end":
      /* r22: precise teardown — ONE classmate stopping removes ONE tile,
         never the whole gallery */
      if (p.kind === "br") removeBrOrGalleryTile("brGrid", p.name, p.srcPid);
      if (p.kind === "stu-bcast") removeBrOrGalleryTile("cdGallery", p.name, p.srcPid);
      break;
  }
};

/* r22: tiles for the room grid / class gallery. The stream may carry
   audio (room talk) — autoplay with the same policy as the stage. */
function addBrOrGalleryTile(gridId, stream, name, pid) {
  const grid = document.getElementById(gridId);
  if (!grid || !stream) return;
  if (pid) removeBrOrGalleryTile(gridId, null, pid);   /* replace, never duplicate */
  const wrap = document.createElement("div");
  wrap.dataset.tname = String(name || "classmate");
  if (pid) wrap.dataset.tpid = String(pid);
  const v = document.createElement("video");
  v.autoplay = true; v.playsInline = true;
  v.srcObject = stream;
  const label = document.createElement("div");
  label.className = "nv-name";
  label.textContent = String(name || "classmate");
  wrap.appendChild(v); wrap.appendChild(label);
  grid.appendChild(wrap);
  try { v.play().catch(() => {}); } catch (e) {}
}
function removeBrOrGalleryTile(gridId, name, pid) {
  /* pid wins when known (names can repeat); a missing pid+name clears all */
  const grid = document.getElementById(gridId);
  if (!grid) return;
  const tName = String(name || "");
  const tPid = String(pid || "");
  Array.from(grid.children || grid.childNodes || []).forEach((w) => {
    if (tPid) { if (w.dataset.tpid === tPid) w.remove(); }
    else if (tName) { if (w.dataset.tname === tName) w.remove(); }
    else w.remove();
  });
}
function clearGridKind(gridId) {
  const grid = document.getElementById(gridId);
  if (grid) grid.innerHTML = "";
}

/* r22: breakout room controls */
$("#sBtnTalk") && $("#sBtnTalk").addEventListener("click", async () => {
  if (!sRoom) return;
  const btn = $("#sBtnTalk");
  const on = !btn.classList.contains("active");
  const withCam = $("#sBtnBrCam") && $("#sBtnBrCam").classList.contains("active");
  if (on) btn.textContent = "🎙…";
  try {
    await sRoom.brTalk(on, withCam);
    if (on) toast(withCam ? "🎙📷 You are live in the room with mic + camera" : "🎙 You are live in the room — mic on", "ok", 6000);
  } catch (e) {
    btn.classList.remove("active");
    toast("Could not start room audio: " + ((e && e.message) || "microphone unavailable"), "err", 8000);
  }
  if (!on) btn.textContent = "🎙 Talk";
});
$("#sBtnBrCam") && $("#sBtnBrCam").addEventListener("click", async () => {
  if (!sRoom) return;
  const btn = $("#sBtnBrCam");
  const on = !btn.classList.contains("active");
  btn.classList.toggle("active", on);
  const talking = $("#sBtnTalk") && $("#sBtnTalk").classList.contains("active");
  if (talking) {
    /* camera change restarts the room stream so mates get video */
    try { await sRoom.brTalk(false); } catch (e) {}
    try { await sRoom.brTalk(true, on); } catch (e) {}
  }
  toast(on ? "📷 Your camera will show in the room" : "📷 Camera off for the room", "ok", 4000);
});
$("#sBtnBrHelp") && $("#sBtnBrHelp").addEventListener("click", () => {
  if (!sRoom) return;
  sRoom.askBrHelp();
  const b = $("#sBtnBrHelp");
  b.disabled = true;
  toast("🙋 The teacher has been told you need help in this room.", "ok", 6000);
  setTimeout(() => { b.disabled = false; }, 20000);   /* re-ask after 20s */
});
