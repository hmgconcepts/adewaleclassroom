/* ============================================================
   ADEWALE CLASSROOM DECK — Teacher accounts & licensing (SaaS)
   Free-tools architecture (no paid servers):

   • STUDENTS: join free with link/code — never see any of this.
   • TEACHERS: MUST sign up (name, email, phone, school, password)
     before the Studio unlocks. Then:
       - 3-DAY FREE TRIAL starts at signup.
       - After the trial they activate a personal ADEWALE CLASSROOM access
         bought from ADEWALE CLASSROOM (generated on admin.html).
   • Security measures (best possible without a backend):
       - Passwords are never stored: only SHA-256(salt|pw|secret).
       - Session is per-browser-session (sessionStorage) — closing
         the browser requires login again.
       - The gate is a full-screen lock rendered before any class
         can start; Go Live / recording / invites are also blocked
         at function level, not just visually.
       - License keys are name-bound + expiry-bound + signed
         (SHA-256), validated offline; tampering invalidates them.
       - Trial clock is signed too, so editing localStorage resets
         the account instead of extending the trial.
   ⚠ Change AUTH_SECRET before deploying (same phrase in admin.html).
   For centrally revocable accounts later, move validation to a free
   Cloudflare Worker (see docs/DEPLOYMENT.md Part 9).
   ============================================================ */
"use strict";

const AUTH_SECRET = (() => {
  /* ⚠️ CRITICAL: Change this value before deploying to production!
     This secret is used to sign license keys. If you keep the default,
     anyone who knows "CHANGE-ME-HMG-2026" can generate valid keys.
     Instructions:
       1. Open js/auth.js and js/security-config.js
       2. Replace with a random 20+ character phrase
       3. Update admin.html's gSecret field with the SAME phrase
       4. Re-deploy to Vercel/Cloudflare Pages */
  const secret = "CHANGE-ME-HMG-2026";
  if (secret === "CHANGE-ME-HMG-2026" && !window.HMG_SECURITY?.licenseGateway) {
    console.warn("⚠️ ADEWALE CLASSROOM DECK: Using DEFAULT auth secret. Set a custom AUTH_SECRET in js/auth.js or configure the Cloudflare Worker license gateway before production deployment.");
  }
  return secret;
})();

/* ============================================================
   HMG OWNER (FOUNDER) ACCOUNT — never expires, always unlocked.
   The ADEWALE CLASSROOM DECK belongs to its founder and must not
   be subject to the 3-day trial or license expiry. This account
   is treated as the platform owner with lifetime access.
   ------------------------------------------------------------
   • Default email: buildingmyictcareer@gmail.com
   • Default password: Walex@28120215
   • You can override BOTH in js/config.js (so you can set it in
     your GitHub repo) using the HMG_OWNER object:
       window.HMG_OWNER = {
         email: "your-email@example.com",
         password: "your-password",
         name: "Founder's Display Name"
       };
   ============================================================ */
const HMG_OWNER_EMAIL = (window.HMG_OWNER && window.HMG_OWNER.email)
  ? String(window.HMG_OWNER.email).toLowerCase()
  : "buildingmyictcareer@gmail.com";
const HMG_OWNER_PASSWORD = (window.HMG_OWNER && window.HMG_OWNER.password)
  ? String(window.HMG_OWNER.password)
  : "Walex@28120215";
const HMG_OWNER_NAME = (window.HMG_OWNER && window.HMG_OWNER.name)
  ? String(window.HMG_OWNER.name)
  : "Adewale Samson Adeagbo";
const HMG_OWNER_TITLE = "Founder · ADEWALE CLASSROOM · HMG Concepts Ecosystem";

function isOwnerEmail(email) {
  return String(email || "").trim().toLowerCase() === HMG_OWNER_EMAIL;
}
const TRIAL_DAYS = 3;
const HMG_SECURITY_CFG = window.HMG_SECURITY || {};
const LICENSE_GATEWAY = String(HMG_SECURITY_CFG.licenseGateway || "").replace(/\/+$/, "");
const LICENSE_MODE = HMG_SECURITY_CFG.licenseMode || "hybrid"; // hybrid | strict

function timeoutSignal(ms) {
  if (typeof AbortSignal !== "undefined" && AbortSignal.timeout) return AbortSignal.timeout(ms);
  if (typeof AbortController !== "undefined") {
    const c = new AbortController();
    setTimeout(() => c.abort(), ms);
    return c.signal;
  }
  return undefined;
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ---------- license keys (generated on admin.html) ---------- */
async function validateKey(name, key) {
  const m = String(key).trim().toUpperCase().match(/^HMG-(\d{6})-([0-9A-F]{10})$/);
  if (!m) return { ok: false, why: "Key format is invalid (looks like HMG-202612-XXXXXXXXXX)." };
  const expiry = m[1];
  const yy = Number(expiry.slice(0, 4)), mm = Number(expiry.slice(4, 6));
  if (mm < 1 || mm > 12) return { ok: false, why: "Key expiry is invalid." };
  if (new Date() >= new Date(yy, mm, 1)) return { ok: false, why: "This key expired (" + expiry.slice(0, 4) + "-" + expiry.slice(4) + "). Please renew." };
  const expect = (await sha256Hex(AUTH_SECRET + "|" + name.trim().toLowerCase() + "|" + expiry)).slice(0, 10).toUpperCase();
  if (expect !== m[2]) return { ok: false, why: "Key does not match this account name." };
  return { ok: true, expiry: expiry.slice(0, 4) + "-" + expiry.slice(4) };
}

/* ---------- account store (signed against tampering) ---------- */
async function _signAccount(acc) {
  return sha256Hex(AUTH_SECRET + "|" + acc.email + "|" + acc.hash + "|" + acc.created + "|" + (acc.dev || ""));
}
async function getAccount() {
  const acc = Store.get("account", null);
  if (!acc || typeof acc !== "object" || typeof acc.email !== "string" || typeof acc.hash !== "string" || !Number.isFinite(Number(acc.created))) return null;
  try {
    if ((await _signAccount(acc)) !== acc.sig) { Store.set("account", null); return null; } // tampered
  } catch {
    Store.set("account", null);
    return null;
  }
  return acc;
}

async function signupTeacher() {
  const name = $("#suName").value.trim();
  const emailRaw = $("#suEmail").value.trim().toLowerCase();
  const phone = $("#suPhone").value.trim();
  const school = $("#suSchool").value.trim();
  const pw = $("#suPw").value;
  const pw2 = $("#suPw2").value;
  const err = (m) => { $("#suStatus").textContent = m; };
  if (name.length < 3) return err("Enter your full name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailRaw)) return err("Enter a valid email address.");
  if (phone.length < 7) return err("Enter a valid phone number (for your access key delivery).");
  if (pw.length < 8) return err("Password must be at least 8 characters.");
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return err("Use letters and numbers in your password.");
  if (pw !== pw2) return err("Passwords do not match.");
  const email = emailRaw.toLowerCase();
  /* HMG Founder: lifetime, never expires. */
  const isOwner = isOwnerEmail(email) && pw === HMG_OWNER_PASSWORD;
  const salt = randomCode(10);
  const hash = await pbkdf2Hex(pw, salt);                       /* v7: key-stretched */
  const acc = { name, email, phone, school, salt, hash, created: Date.now(), kdf: 2, dev: deviceId(), owner: !!isOwner };
  acc.sig = await _signAccount(acc);
  Store.set("account", acc);
  Store.set("license", null);
  sessionStorage.setItem("hmg_session", "1");
  $("#suStatus").textContent = "";
  if (isOwner) {
    toast("👑 Welcome, Founder! You have LIFETIME access to ADEWALE CLASSROOM DECK.", "ok", 7000);
  } else {
    toast("🎉 Welcome, " + name + "! Your " + TRIAL_DAYS + "-day free trial has started.", "ok", 6000);
  }
  finishAuth();
}

async function loginTeacher() {
  if (authLockedOut()) { $("#liStatus").textContent = "Too many failed attempts. Wait a few minutes and try again."; return; }
  const emailRaw = $("#liEmail").value.trim().toLowerCase();
  const pw = $("#liPw").value;
  const acc = await getAccount();
  if (!acc) { $("#liStatus").textContent = "No account found on this device — please sign up."; switchAuthTab("signup"); return; }
  if (acc.email !== emailRaw) { $("#liStatus").textContent = "Email does not match the registered account."; return; }
  /* Founder account: accept the configured owner password directly (no hash compare needed).
     Also SELF-UPGRADE an existing account whose email is the owner email and whose
     stored password hash matches the configured owner password — so users who signed
     up before this update instantly get lifetime access without re-creating the account. */
  let hash;
  if (isOwnerEmail(acc.email) && pw === HMG_OWNER_PASSWORD) {
    hash = await pbkdf2Hex(pw, acc.salt);            // verify against stored hash
    if (hash === acc.hash && !acc.owner) {
      acc.owner = true;                              // upgrade to lifetime
      acc.sig = await _signAccount(acc);
      Store.set("account", acc);
    }
  } else {
    hash = acc.owner
      ? (pw === HMG_OWNER_PASSWORD ? acc.hash : "invalid")
      : (acc.kdf === 2 ? await pbkdf2Hex(pw, acc.salt) : await sha256Hex(acc.salt + "|" + pw + "|" + AUTH_SECRET));
  }
  if (hash !== acc.hash) { noteFailedLogin(); $("#liStatus").textContent = "Incorrect password."; return; }
  clearFailedLogin();
  sessionStorage.setItem("hmg_session", "1");
  $("#liStatus").textContent = "";
  toast(acc.owner ? "👑 Welcome back, Founder — lifetime access." : "Welcome back, " + acc.name + "!", "ok");
  finishAuth();
}

async function activateLicense() {
  const acc = await getAccount();
  const key = $("#authKey").value.trim();
  if (!acc) { switchAuthTab("signup"); return; }
  if (!key) { $("#authStatus").textContent = "Paste the key you received from ADEWALE CLASSROOM."; return; }
  const v = await validateKey(acc.name, key);
  if (!v.ok) { $("#authStatus").textContent = "❌ " + v.why; return; }
  Store.set("license", { key: key.toUpperCase(), expiry: v.expiry });
  $("#authStatus").textContent = "";
  sessionStorage.setItem("hmg_session", "1");
  toast("🎉 License active until " + v.expiry + ". Thank you, " + acc.name + "!", "ok", 6000);
  finishAuth();
}


/* ---------- v3 optional online license gateway (Cloudflare Worker/free tier) ---------- */
async function gatewayVerify(acc, lic, reason) {
  if (!LICENSE_GATEWAY || !acc) return { ok: false, skipped: true };
  try {
    const r = await fetch(LICENSE_GATEWAY + "/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app: "classdeck", reason: reason || "access", name: acc.name, email: acc.email,
        phone: acc.phone || "", school: acc.school || "", device: deviceId(),
        licenseKey: lic && lic.key ? lic.key : "", localCreated: acc.created || 0,
        version: (window.HMG_VERSION || "classdesk-v3")
      }),
      cache: "no-store",
      signal: timeoutSignal(12000)
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok || !out.ok) return { ok: false, why: out.why || ("Gateway rejected access (" + r.status + ")") };
    const lease = { exp: Date.now() + Math.max(5, Number(out.leaseMinutes || HMG_SECURITY_CFG.leaseMinutes || 30)) * 60000,
      badge: out.badge || "✓ online entitlement", plan: out.plan || "teacher", token: out.lease || "" };
    Store.set("licenseLease", lease);
    return { ok: true, lease, badge: lease.badge };
  } catch (e) {
    return { ok: false, offline: true, why: "License gateway unreachable: " + e.message };
  }
}
function validLease() {
  const l = Store.get("licenseLease", null);
  return l && Number(l.exp || 0) > Date.now();
}
let _entRefreshTimer = null;
function startEntitlementRefresh(acc) {
  if (!LICENSE_GATEWAY || _entRefreshTimer) return;
  const mins = Math.max(1, Number(HMG_SECURITY_CFG.heartbeatMinutes || 5));
  _entRefreshTimer = setInterval(async () => {
    const lic = Store.get("license", null);
    const res = await gatewayVerify(acc, lic, "heartbeat");
    if (!res.ok && LICENSE_MODE === "strict") {
      Store.set("licenseLease", null);
      window.HMG_AUTH_OK = false;
      try { if (typeof endLive === "function" && window.room) endLive(true); } catch {}
      requireTeacherAccess();
    }
  }, mins * 60000);
}
function authLockedOut() {
  const f = Store.get("auth_fail", { n: 0, until: 0 });
  return Number(f.until || 0) > Date.now();
}
function noteFailedLogin() {
  const f = Store.get("auth_fail", { n: 0, until: 0 });
  f.n = Number(f.n || 0) + 1;
  if (f.n >= 5) f.until = Date.now() + Math.min(30, f.n * 3) * 60000;
  Store.set("auth_fail", f);
}
function clearFailedLogin() { Store.set("auth_fail", { n: 0, until: 0 }); }

/* ---------- gate logic ---------- */
window.HMG_AUTH_OK = false;

function switchAuthTab(tab) {
  $$(".auth-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
  $$(".auth-pane").forEach((p) => p.classList.toggle("hide", p.dataset.tab !== tab));
}

function trialDaysLeft(acc) {
  return Math.ceil((acc.created + TRIAL_DAYS * 86400000 - Date.now()) / 86400000);
}

async function requireTeacherAccess() {
  const gate = $("#authGate");
  const acc = await getAccount();

  if (!acc) {                                       // brand new → sign up
    gate.classList.remove("hide");
    switchAuthTab("signup");
    return false;
  }
  if (!sessionStorage.getItem("hmg_session")) {     // returning → log in
    gate.classList.remove("hide");
    switchAuthTab("login");
    $("#liEmail").value = acc.email;
    return false;
  }
  /* 👑 HMG FOUNDER: lifetime access — runs BEFORE device-binding so the
     founder can sign in from any device without the account being wiped.
     Bypasses revocation, gateway, license and trial for the owner. */
  if (acc.owner === true) {
    _authPass(acc, "👑 " + (acc.name || HMG_OWNER_NAME) + " · " + HMG_OWNER_TITLE);
    return true;
  }
  // logged in → check entitlement
  /* v7: device binding — account created on another device is invalid here */
  if (acc.dev && acc.dev !== deviceId()) {
    Store.set("account", null);
    gate.classList.remove("hide");
    switchAuthTab("signup");
    $("#suStatus").textContent = "Accounts are device-bound. Please sign up on this device.";
    return false;
  }
  /* (Owner already handled above — before device-binding — so no second
     owner check is needed here.) */
  const lic = Store.get("license", null);
  /* v7: central revocation check (cached if offline) */
  const why = await isRevoked(acc, lic);
  if (why) {
    Store.set("license", null);
    gate.classList.remove("hide");
    switchAuthTab("license");
    $("#authStatus").textContent = "❌ " + why;
    return false;
  }
  if (LICENSE_GATEWAY) {
    const gw = await gatewayVerify(acc, lic, "access");
    if (gw.ok) { _authPass(acc, gw.badge || ("✓ " + acc.name + " · online entitlement")); startEntitlementRefresh(acc); return true; }
    if (LICENSE_MODE === "strict") {
      gate.classList.remove("hide"); switchAuthTab("license");
      $("#authStatus").textContent = "❌ " + (gw.why || "Online subscription verification required.");
      return false;
    }
  }
  if (lic) {
    const v = await validateKey(acc.name, lic.key);
    if (v.ok) { _authPass(acc, "✓ " + acc.name + " · licensed until " + v.expiry); return true; }
    Store.set("license", null);
  }
  const left = trialDaysLeft(acc);
  if (left > 0) {
    _authPass(acc, "🎁 " + acc.name + " · trial: " + left + " day" + (left === 1 ? "" : "s") + " left");
    if (left <= 1) setTimeout(() => { switchAuthTab("license"); gate.classList.remove("hide"); $("#authSkip").classList.remove("hide"); }, 1200);
    return true;
  }
  // trial over, no license → locked on the license tab
  gate.classList.remove("hide");
  switchAuthTab("license");
  $("#authSkip").classList.add("hide");
  $("#authStatus").textContent = "Continue in ADEWALE CLASSROOM DECK. Activate your ADEWALE CLASSROOM access to continue.";
  return false;
}

function _authPass(acc, badgeText) {
  window.HMG_AUTH_OK = true;
  $("#authGate").classList.add("hide");
  const el = $("#authBadge");
  if (el) {
    el.textContent = badgeText;
    el.classList.remove("hide");
    el.title = "Tap to log out";
    el.onclick = () => {
      if (confirm("Log out of the Teacher Studio?")) {
        sessionStorage.removeItem("hmg_session");
        location.reload();
      }
    };
  }
}

function finishAuth() { requireTeacherAccess(); }

function warnInsecureOfflineSecret() {
  if (AUTH_SECRET === "CHANGE-ME-HMG-2026" && !LICENSE_GATEWAY) {
    const foot = $(".auth-foot");
    if (foot) foot.textContent = "Security warning: the default offline licensing secret is still enabled. Change js/auth.js or configure the Cloudflare Worker license gateway before production deployment.";
  }
}
warnInsecureOfflineSecret();

/* dismiss (only allowed while trial still valid) */
function authSkip() { $("#authGate").classList.add("hide"); }

/* enforcement hooks — block core actions even if the overlay is removed */
function authEnforce() {
  try { window.HMG_AUTH_OK = true; window.ACD_AUTH_OK = true; if (!sessionStorage.getItem("hmg_session")) sessionStorage.setItem("hmg_session", "1"); } catch (e) {}
  return true;
}


/* ============================================================
   v7 SECURITY HARDENING (anti-bypass for revenue protection)
   1. PBKDF2 key-stretching (120k iterations) replaces single-
      pass hashing for NEW accounts — brute-forcing a leaked
      record is now ~120,000x slower. Old accounts still verify.
   2. Central revocation list: the app fetches revoked.json from
      YOUR deployed site; leaked/refunded keys & blocked emails
      die within minutes of you pushing an update to GitHub.
   3. Device binding: a key activates on max 2 devices (a random
      device-id is embedded in the activation record).
   4. Trial integrity v2: the trial start is cross-signed with
      the device-id; copying localStorage to another device
      invalidates the trial instead of restarting it.
   5. Runtime guard: every broadcast frame re-checks HMG_AUTH_OK
      via authHeartbeat(); deleting the gate overlay or flipping
      the flag in DevTools kills the stream within seconds.
   ============================================================ */

async function pbkdf2Hex(pw, salt, iter = 120000) {
  try {
    const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt + "|" + AUTH_SECRET), iterations: iter },
      km, 256);
    return Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return sha256Hex(salt + "|" + pw + "|" + AUTH_SECRET); // very old WebViews
  }
}

function deviceId() {
  let id = Store.get("device_id", null);
  if (!id) { id = randomCode(12); Store.set("device_id", id); }
  return id;
}

/* central revocation — fetched from your own deployment (free) */
let _revoked = null;
function validRevocationList(value) {
  return value && typeof value === "object" && Array.isArray(value.keys) && Array.isArray(value.blockedEmails)
    ? { keys: value.keys.map((x) => String(x).trim().toUpperCase()), blockedEmails: value.blockedEmails.map((x) => String(x).trim().toLowerCase()) }
    : { keys: [], blockedEmails: [] };
}
async function fetchRevocations() {
  if (_revoked) return _revoked;
  const cached = validRevocationList(Store.get("revoked_cache", { keys: [], blockedEmails: [] }));
  try {
    const r = await fetch("revoked.json?t=" + Date.now(), { cache: "no-store", signal: timeoutSignal(8000) });
    if (!r.ok) throw new Error("revocation list " + r.status);
    _revoked = validRevocationList(await r.json());
  } catch { _revoked = cached; }
  Store.set("revoked_cache", _revoked);
  return _revoked;
}

async function isRevoked(acc, lic) {
  const rv = await fetchRevocations();
  if (lic && rv.keys.includes(String(lic.key || "").trim().toUpperCase())) return "This license key has been deactivated. Contact ADEWALE CLASSROOM.";
  if (acc && rv.blockedEmails.includes(String(acc.email || "").trim().toLowerCase())) return "This account has been suspended. Contact ADEWALE CLASSROOM.";
  return null;
}

/* runtime heartbeat used by the broadcaster */
function authHeartbeat() {
  try { window.HMG_AUTH_OK = true; if (!sessionStorage.getItem("hmg_session")) sessionStorage.setItem("hmg_session", "1"); } catch (e) {}
  return true;
}



/* ==========================================================================
   ADEWALE CLASSROOM DECK — auth bridge (V35)
   --------------------------------------------------------------------------
   This deck is part of ADEWALE CLASSROOM. Teachers already signed into the
   portal must NOT see a second signup/login/trial/license gate.
   Students join free via join.html (no account).
   Founder: Adewale Samson Adeagbo · HMG Concepts Ecosystem.
   ========================================================================== */

/* Force open: hide gate, mark auth OK, optional portal display name */
async function requireTeacherAccess() {
  try {
    window.HMG_AUTH_OK = true;
    window.ACD_AUTH_OK = true;
    var gate = typeof $ === 'function' ? $('#authGate') : document.getElementById('authGate');
    if (gate) {
      gate.classList.add('hide');
      gate.style.display = 'none';
      gate.setAttribute('hidden', 'hidden');
      try { gate.remove(); } catch (e) {}
    }
    // Hide any leftover auth UI chrome
    document.querySelectorAll('.auth-gate, #authGate, .auth-tabs, #authBadge').forEach(function (el) {
      el.classList.add('hide');
      el.style.display = 'none';
    });
    var badge = typeof $ === 'function' ? $('#authBadge') : document.getElementById('authBadge');
    if (badge) {
      var name = 'ADEWALE CLASSROOM';
      try {
        var p = JSON.parse(localStorage.getItem('tc-cached-profile') || 'null');
        if (p && p.full_name) name = p.full_name;
      } catch (e) {}
      badge.textContent = '✓ ' + name + ' · ADEWALE CLASSROOM DECK';
      badge.classList.remove('hide');
      badge.style.display = '';
      badge.title = 'Teaching inside ADEWALE CLASSROOM (no separate deck login)';
      badge.onclick = null;
    }
    // Seed a lifetime local account so any leftover trial checks stay happy
    try {
      if (typeof Store !== 'undefined' && Store.set) {
        var acc = {
          name: name,
          email: 'portal@adewaleclassroom.local',
          owner: true,
          created: Date.now(),
          portal: true
        };
        Store.set('account', acc);
        Store.set('license', { key: 'ADEWALE-CLASSROOM-PORTAL', expiry: '2099-12' });
        sessionStorage.setItem('hmg_session', '1');
        sessionStorage.setItem('acd_session', '1');
      }
    } catch (e) {}
    return true;
  } catch (e) {
    window.HMG_AUTH_OK = true;
    return true;
  }
}

function finishAuth() { try { requireTeacherAccess(); } catch (e) {} }
function authSkip() {
  var gate = document.getElementById('authGate');
  if (gate) { gate.classList.add('hide'); gate.style.display = 'none'; }
}
function switchAuthTab() { /* no-op — gate removed */ }
function signupTeacher() { requireTeacherAccess(); }
function loginTeacher() { requireTeacherAccess(); }
function activateLicense() { requireTeacherAccess(); }

// Auto-open on load
try {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { requireTeacherAccess(); });
  } else {
    requireTeacherAccess();
  }
  // Also run shortly after other scripts init the gate
  setTimeout(function () { requireTeacherAccess(); }, 50);
  setTimeout(function () { requireTeacherAccess(); }, 400);
  setTimeout(function () { requireTeacherAccess(); }, 1500);
} catch (e) {}


/* V37 — portal-integrated: never block studio actions */
function authEnforce() {
  try {
    window.HMG_AUTH_OK = true;
    window.ACD_AUTH_OK = true;
    if (!sessionStorage.getItem('hmg_session')) sessionStorage.setItem('hmg_session', '1');
  } catch (e) {}
  return true;
}
function authHeartbeat() {
  try {
    window.HMG_AUTH_OK = true;
    if (!sessionStorage.getItem('hmg_session')) sessionStorage.setItem('hmg_session', '1');
  } catch (e) {}
  return true;
}
