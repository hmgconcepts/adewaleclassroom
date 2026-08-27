/* ============================================================
   HMG ClassDeck — Student view controller
   Full-screen stage video (the teacher's split-screen),
   draggable teacher-cam PiP, hand raise, chat, polls,
   camera/mic sharing under teacher control.
   ============================================================ */
"use strict";

let sRoom = null;
let handUp = false;
let myCamOn = false, myMicOn = false, micAllowed = false;
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
setTimeout(() => { try { $("#inName").focus(); } catch {} }, 300);

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
  if (inApp) issues.push("Open this link in Chrome, Edge or Safari — it is currently inside " + inApp + ", which often blocks classroom joining.");
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

  $("#btnJoin").disabled = true;
  $("#joinStatus").textContent = "Connecting to class…";

  sRoom = new StudentRoom(code, name, { onEvent: onEvent, pin: $("#inPin").value.trim(), tok: qs.get("tok") || "" });
  try {
    const result = await sRoom.join();
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
let lobbyTimer = null, lobbyOn = false;
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
function startLobby(code, name, why) {
  lobbyOn = true;
  clearTimeout(lobbyTimer);
  closeModal("#mWaiting");
  $("#joinGate").classList.remove("hide");
  $("#joinStatus").textContent = "🕐 You're in the lobby. " +
    (why && /PIN|secure invite|rejected/i.test(why) ? why :
    "The class hasn't started yet — this page will join you automatically the moment your teacher goes live. Keep it open.");
  $("#btnJoin").textContent = "✕ Stop waiting";
  $("#btnJoin").disabled = false;
  window._wantWake = true; keepAwake(true);
  // A successful transport handshake that reports "waiting" is a real
  // waiting room, not a reason to keep opening new PeerJS connections.
  lobbyTimer = setTimeout(async function tick() {
    if (!lobbyOn) return;
    const candidate = new StudentRoom(code, name, { onEvent: onEvent, pin: $("#inPin").value.trim(), tok: qs.get("tok") || "" });
    sRoom = candidate;
    try {
      const result = await candidate.join();
      if (!lobbyOn) { candidate.leave(); return; }
      if (result && result.state === "waiting") {
        showWaitingState(code, name);
        return;
      }
      lobbyOn = false;
      restoreJoinButton();
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
      lobbyTimer = setTimeout(tick, 8000);   // retry every 8 s
    }
  }, 4000);
}
function stopLobby() {
  lobbyOn = false;
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
      restoreJoinButton();
      Store.set("joined_" + (sRoom ? sRoom.code : normaliseRoomCode($("#inRoom").value)), true);
      closeModal("#mWaiting");
      enterStage();
      $("#roomNameChip").textContent = p.roomName || "";
      $("#countChip").textContent = "👥 " + (p.count || 1);
      toast(p.rejoined ? "Reconnected — waiting for the teacher's screen…" : "Joined! Waiting for the teacher's screen…", "ok");
      break;
    case "roster":
      $("#countChip").textContent = "👥 " + (p.count || 0);
      break;
    case "media":
      if (p.kind === "stage") { enterStage(); attachStage(p.stream); }
      else if (p.kind === "teachercam") attachTeacherCam(p.stream);
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
    case "spotlight":                                 // v4
      toast("🌟 " + p.name + ", it's your turn!", "ok", 6000);
      break;
    case "camRequest": handleCamRequest(p.on); break;
    case "screenRequest":                              /* v5 */
      if (p.on && !myScreenOn) {
        if (confirm("Your teacher asks you to SHARE YOUR SCREEN (e.g. to show your work). Allow?")) toggleMyScreen();
      } else if (!p.on && myScreenOn) { toggleMyScreen(); }
      break;
    case "screenEnded":
      myScreenOn = false;
      $("#sBtnScreen").classList.remove("active");
      break;
    case "micAllow":
      micAllowed = p.on;
      $("#sBtnMic").disabled = !p.on;
      toast(p.on ? "🎙 Teacher allowed your mic — tap the mic button to speak" : "Mic permission removed", p.on ? "ok" : "", 5000);
      if (!p.on && myMicOn) toggleMyMic();
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
  _lastChatTs = now;
  inp.value = "";
  const priv = $("#sChatPriv").checked;       /* v5: private chat */
  sRoom.send({ t: "chat", text, private: priv });
  addMsg(priv ? "You → teacher (private)" : "You", text, true);
}
$("#sChatSend").addEventListener("click", sendChat);
$("#sChatInput").addEventListener("keydown", (e) => { if (e.key === "Enter") sendChat(); });


function showCaption(p) {
  const el = $("#sCaptionBanner");
  if (!el) return;
  const text = String((p && p.text) || "").trim();
  if (!text) return;
  el.textContent = text;
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
      await sRoom.shareCamera(true);
      myCamOn = true;
      $("#sBtnCam").classList.add("active");
      toast("📷 Your camera is on — the teacher can see you", "ok");
    } else {
      await sRoom.shareCamera(false);
      myCamOn = false;
      $("#sBtnCam").classList.remove("active");
      toast("Camera off");
    }
  } catch { toast("Camera blocked. Allow camera in browser settings.", "err"); }
}

function handleCamRequest(on) {
  if (on && !myCamOn) {
    if (confirm("Your teacher is asking you to turn your camera ON. Allow?")) toggleMyCam();
  } else if (!on && myCamOn) {
    toggleMyCam();
    toast("Teacher turned your camera off");
  }
}

/* v5 (issue 1): student screen sharing — show your work to the teacher */
let myScreenOn = false;
$("#sBtnScreen").addEventListener("click", toggleMyScreen);
async function toggleMyScreen() {
  try {
    if (!myScreenOn) {
      await sRoom.shareScreen(true);
      myScreenOn = true;
      $("#sBtnScreen").classList.add("active");
      toast("🖥 You are sharing your screen with the teacher", "ok", 5000);
    } else {
      await sRoom.shareScreen(false);
      myScreenOn = false;
      $("#sBtnScreen").classList.remove("active");
      toast("Screen sharing stopped");
    }
  } catch (e) {
    toast(e.message || "Screen share blocked. On phones use Chrome/Edge; some browsers don't allow it.", "err", 6000);
  }
}

$("#sBtnMic").addEventListener("click", toggleMyMic);
async function toggleMyMic() {
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
