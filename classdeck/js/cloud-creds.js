/* =====================================================================
   cloud-creds.js — ADEWALE CLASSROOM DECK · V47 round 11 → V54 round 18
   =====================================================================
   THE BUG THIS FILE FIXES (round 11, item 1):
   ClassDeck stored the Cloudflare TURN key, the generated relay
   credentials and the streaming destinations in localStorage — PER
   DEVICE. Sign in on a new laptop and every one of them was gone: the
   teacher had to fetch and re-paste each credential, and meanwhile
   hotspot students were unreachable because the TURN relay was empty.

   THE FIX:
   The deck ships INSIDE the portal (same origin). When the teacher is
   signed in to ADEWALE CLASSROOM, the portal session token is in
   localStorage. This module uses it to sync credentials through the
   portal database's per-account user_settings table (owner-only at the
   policy level — v47), with the v53 security-definer RPCs preferred:

     sign in on any device → pull() → credentials are back.

   What roams (channels):
     cd-turn    — Cloudflare TURN Token ID + API token + the generated
                  ICE credentials + their expiry (so auto-renewal works
                  everywhere too)
     cd-stream  — streaming gateway, relay secret, stream name, format,
                  destinations and their keys
     anything else that adopts CloudCreds.set(key, value)

   Merge policy — deliberately conservative:
     · PULL only fills what is EMPTY locally, or replaces what this
       device itself last pushed (a pure echo). A device that has local
       credentials the cloud has not seen WINS and pushes them up — so a
       working setup is never silently overwritten by a stale one.
     · PUSH is last-write-wins per channel.

   V52 (round 16) — the "saved on A, empty on B" autopsy: push() built
   its row with state.uid before any request ran (uid resolved lazily →
   user_id NULL → RLS refused silently); pull() matched rows by exact
   key name only; a push never counted as a sync.

   V53 (round 17) — the write went RPC-first (tc_set_user_setting) and
   the PostgREST error BODY started being read, so most "unknown"
   failures became specific.

   V54 (round 18) — THE VERIFIED-SYNC ENGINE. The persisting field
   reports ("last sync not yet" after "synced", "the cloud copy failed:
   unknown", "nothing saved yet" on device B) shared one shape: the
   module REPORTED success it had not verified and failure it had not
   explained. Five structural fixes:
     1. PUSH IS SERIALIZED AND COALESCED. Save used to fire two
        concurrent pushes of the same channel (the relay push + the key
        push); both refreshed the portal token at once, and Supabase's
        refresh-token rotation can treat the second refresh as reuse and
        revoke the session — the portal then signs the teacher out and
        every later call fails as "refused". Pushes now run through a
        per-channel queue (a rapid double-save uploads the final state
        once), and the token refresh is SINGLE-FLIGHT (one shared
        in-flight refresh, no matter how many callers race).
     2. A WRITE ONLY COUNTS WHEN THE ACCOUNT VERIFIABLY HOLDS IT.
        Every successful write is followed by an immediate read-back of
        the account (same RPC/table path the next device will use) and a
        canonical comparison. "Saved" now means "saved and verified" —
        the entire "looked saved on A while B saw nothing" class is
        structurally impossible, whatever the server did.
     3. state.reason CAN NEVER BE EMPTY ON FAILURE. Every failure path
        goes through fail(stage, message) with the HTTP status and the
        server's own error body; the toasts keep `|| "unknown"` only as
        a belt-and-braces default that no longer fires.
     4. THE SYNC CLOCK IS PERSISTED. stampSync writes
        cd-creds-sync-stamp (last verified sync, per-channel holds,
        account email) to localStorage, and a fresh page load seeds the
        card from it — "last sync" survives the reload instead of
        resetting to "not yet".
     5. SYNC NOW DIFFS AGAINST A FRESH READ. The button pulls FIRST
        (the account's actual current state), then pushes every channel
        that really differs, so "credentials current" is a statement
        about the account, not about a stale in-memory copy.
     Plus diagnose() — a step-by-step probe (session → endpoint →
     token → RPC read → table read → verified write) that names the
     first failing stage and its exact remedy, surfaced as a 🔍 button
     on the sync card.
   Sensitive values are never logged.
   ===================================================================== */
"use strict";

window.CloudCreds = (function () {
  const ENDPOINT_CACHE = "cd-portal-endpoint";   // {url, anon}
  const SESSION_RE = /^sb-.*-auth-token$/;
  const SYNCED_AT = "cd-creds-cloud-at";          // per-channel last sync ms
  const STAMP_KEY = "cd-creds-sync-stamp";        // V54: persisted verified-sync truth
  const BUILD = "v55-r20-cloudboot-everywhere";

  const state = {
    ready: false, uid: null, url: null, anon: null,
    reason: "",                                    // why sync is off (UI) — never empty on failure
    _endpointPromise: null, _listeners: [],
    _refreshInFlight: null,                        // V54: single-flight token refresh
    _pushTail: {}                                  // V54: per-channel push queue
  };

  /* V54: seed the sync clock + account-holds from the persisted stamp so
     the card is honest across page reloads (a verified sync from the
     previous visit is still a verified sync). Overwritten by the first
     successful read of this visit. */
  (function seed() {
    var p = lsJSON(STAMP_KEY, null);
    if (!p) return;
    state.lastSync = Number(p.lastSync) || 0;
    state.cloud = {};
    Object.keys(p.cloudHolds || {}).forEach(function (k) { state.cloud[k] = true; });
    state.lastChecked = state.lastSync;
  })();

  function lsGet(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsJSON(k, d) { try { return JSON.parse(localStorage.getItem(k) || "null") || d; } catch (e) { return d; } }
  function storeGet(k, d) { try { return window.Store ? (Store.get(k, d) !== undefined ? Store.get(k, d) : d) : d; } catch (e) { return d; } }
  function storeSet(k, v) { try { if (window.Store) Store.set(k, v); } catch (e) {} }

  /* V54: the one failure gate. state.reason is ALWAYS set to a non-empty,
     human-readable message that names the stage and the server's answer. */
  function fail(stage, msg) {
    var m = String(msg == null ? "" : msg).trim() ||
      ("the " + stage + " failed without an error message — check the browser console and the studio database");
    state.reason = m;
    return false;
  }
  /* V54: read a PostgREST/GoTrue error body into a precise message. */
  async function bodyReason(res, fallback) {
    var msg = String(fallback || ("portal answered " + res.status));
    try {
      var err = await res.json();
      if (err && (err.message || err.hint || err.details || err.error_description)) {
        msg = (err.message || err.error_description || "") +
          (err.hint ? " — " + err.hint : "") +
          (err.details ? " (" + err.details + ")" : "");
      }
    } catch (e) {}
    return msg;
  }

  /* ── portal session (same origin) ───────────────────────────────────
     The portal stores its session under sb-<ref>-auth-token. We never
     parse the project ref — we scan for the pattern, so regeneration or
     a different project still works. */
  function readSession() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && SESSION_RE.test(k)) {
          var s = JSON.parse(localStorage.getItem(k));
          if (s && (s.access_token || s.refresh_token)) {
            s._lsKey = k;
            return s;
          }
        }
      }
    } catch (e) {}
    return null;
  }

  /* ── portal endpoint. Priority (round 12):
     1. window.CLASSDECK.SUPABASE — baked into js/config.js when the deck
        was generated (works even when the deck is deployed standalone,
        where the old ../assets/js/config.js fetch 404'd and silently
        disabled roaming — the persisting report);
     2. the cached discovery from a previous run;
     3. reading (not executing) ../assets/js/config.js on the same origin.
     Regexing instead of <script>-loading keeps the deck's own config
     (PRACTICE/branding) untouched while staying regeneration-safe. */
  async function endpoint() {
    try {
      var baked = (window.CLASSDECK && window.CLASSDECK.SUPABASE) || {};
      if (/^https:\/\//.test(String(baked.url || "")) && baked.anon &&
          String(baked.url).indexOf("YOUR_") < 0 && String(baked.anon).indexOf("YOUR_") < 0) {
        return { url: String(baked.url).replace(/\/+$/, ""), anon: String(baked.anon) };
      }
    } catch (e) {}
    var cached = lsJSON(ENDPOINT_CACHE, null);
    if (cached && cached.url && cached.anon) return cached;
    if (state._endpointPromise) return state._endpointPromise;
    state._endpointPromise = (async () => {
      try {
        var res = await fetch("../assets/js/config.js", { cache: "no-store" });
        if (!res.ok) throw new Error("config " + res.status);
        var txt = await res.text();
        var u = txt.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
        var a = txt.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/);
        if (!u || !a || !/^https:\/\//.test(u[1])) throw new Error("no endpoint in portal config");
        var out = { url: u[1].replace(/\/+$/, ""), anon: a[1] };
        lsSet(ENDPOINT_CACHE, JSON.stringify(out));
        return out;
      } finally { state._endpointPromise = null; }
    })();
    return state._endpointPromise;
  }

  /* ── session storage. The key matches what supabase-js uses on the
     portal (sb-<project-ref>-auth-token): when deck and portal share an
     origin they literally share ONE session, and when they don't, the
     deck keeps its own — both stay alive through the refresh token. */
  function sessionKey(ep) {
    try {
      var ref = String((ep || {}).url || "").replace(/^https:\/\//, "").split(".")[0];
      return "sb-" + ref + "-auth-token";
    } catch (e) { return "sb-classdeck-auth-token"; }
  }

  /* ── sign in to the portal from the deck (round 12, item 1).
     Called with the teacher's Adewale Classroom email + password — from
     the deck login (same credentials, fire-and-forget) or from the
     Settings link card. Stores the session so pull()/push() work. */
  async function signIn(email, password) {
    try {
      var ep = await endpoint();
      var res = await fetch(ep.url + "/auth/v1/token?grant_type=password", {
        method: "POST",
        headers: { apikey: ep.anon, "Content-Type": "application/json" },
        body: JSON.stringify({ email: String(email || "").trim(), password: String(password || "") })
      });
      if (!res.ok) return false;
      var data = await res.json();
      if (!data || !data.access_token) return false;
      try { localStorage.setItem(sessionKey(ep), JSON.stringify(data)); } catch (e) {}
      state.reason = "";
      return true;
    } catch (e) { return false; }
  }

  function signOut() {
    try {
      [readSession()].forEach(function (s) { if (s && s._lsKey) localStorage.removeItem(s._lsKey); });
    } catch (e) {}
    var ep = lsJSON(ENDPOINT_CACHE, null);
    try { if (ep) localStorage.removeItem(sessionKey(ep)); } catch (e) {}
    try { localStorage.removeItem(STAMP_KEY); } catch (e) {}   /* V54: unlinked — stop claiming a verified sync */
    state.lastSync = 0; state.cloud = {}; state.cloudRows = {}; state.reason = "";
  }

  function sessionEmail() {
    var s = readSession();
    return (s && s.user && s.user.email) || "";
  }

  /* ── token: refresh it ourselves if expired (supabase-js is not
     loaded in the deck, so the portal cannot do it for us) ─────────── */
  /* V52: uid extraction is belt-and-braces — the session normally has
     user.id, but the JWT "sub" claim is the same truth and survives
     session shapes that omit the embedded user object. */
  function uidFromToken(token) {
    try {
      var parts = String(token || "").split(".");
      if (parts.length < 2) return null;
      var payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      return payload && payload.sub ? payload.sub : null;
    } catch (e) { return null; }
  }
  function uidFromSession(sess, token) {
    return (sess.user && sess.user.id) || sess.user_id || uidFromToken(token) || null;
  }

  /* V54: the actual refresh exchange, isolated so ensureToken can make
     it single-flight. Writes the refreshed session back under the SAME
     localStorage key — one session, kept alive from either side. */
  async function doRefresh(sess) {
    var ep = await endpoint();
    var res = await fetch(ep.url + "/auth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ep.anon },
      body: JSON.stringify({ grant_type: "refresh_token", refresh_token: sess.refresh_token })
    });
    if (!res.ok) throw new Error("refresh " + res.status + (res.status === 400 ? " — the saved login was revoked (two devices refreshed at once); sign in to the portal once" : ""));
    var data = await res.json();
    if (!data || !data.access_token) throw new Error("no token in refresh response");
    var next = Object.assign({}, sess, data);
    try { localStorage.setItem(sess._lsKey, JSON.stringify(next)); } catch (e) {}
    state.uid = uidFromSession(data, data.access_token);
    if (!state.uid) throw new Error("portal session has no user — sign in again");
    return data.access_token;
  }

  async function ensureToken() {
    var sess = readSession();
    if (!sess) return fail("session", "not signed in to the portal on this device");
    var fresh = sess.access_token && sess.expires_at && (sess.expires_at * 1000) > Date.now() + 60000;
    if (fresh) {
      state.uid = uidFromSession(sess, sess.access_token);
      if (!state.uid) return fail("session", "portal session has no user — sign in again");
      return sess.access_token;
    }
    if (!sess.refresh_token) return fail("session", "portal session expired — sign in to the portal once");
    /* V54: SINGLE-FLIGHT REFRESH. Save/Generate/Sync fire several cloud
       calls at once; two parallel refreshes with the same refresh token
       are exactly what Supabase's rotation-reuse detection revokes the
       whole session for — the teacher then finds the portal itself
       signed out. One shared in-flight promise now serves every racer. */
    if (!state._refreshInFlight) {
      state._refreshInFlight = doRefresh(sess).finally(function () { state._refreshInFlight = null; });
    }
    try {
      return await state._refreshInFlight;
    } catch (e) {
      return fail("session", "portal session expired — sign in to the portal once (" + (e && e.message ? e.message : "network") + ")");
    }
  }

  /* ── REST helpers ────────────────────────────────────────────────── */
  async function authedHeaders(extra) {
    var token = await ensureToken();
    if (!token) return null;
    var ep = await endpoint();
    var h = { apikey: ep.anon, Authorization: "Bearer " + token, "Content-Type": "application/json" };
    Object.keys(extra || {}).forEach(function (k) { h[k] = extra[k]; });
    return h;
  }
  async function get(path) {
    var h = await authedHeaders();
    if (!h) return null;
    var ep = await endpoint();
    var res = await fetch(ep.url + "/rest/v1" + path, { method: "GET", headers: h });
    if (res.status === 401 || res.status === 403) { state.reason = "the portal refused the sync (signed in?)"; return null; }
    if (res.status === 404) {
      /* PostgREST 404 here means the user_settings TABLE is missing —
         the database has not had the V47 update yet. Say so, precisely,
         instead of a vague "unreachable" (round-12 fix). */
      state.reason = "database update needed — run database/v47-cloud-credentials.sql";
      state.missing = true;
      return null;
    }
    if (!res.ok) throw new Error("portal sync " + res.status);
    return res;
  }
  async function post(path, body, extraHeaders) {
    var h = await authedHeaders(extraHeaders || {});
    if (!h) return null;
    var ep = await endpoint();
    var res = await fetch(ep.url + "/rest/v1" + path, { method: "POST", headers: h, body: JSON.stringify(body) });
    if (res.status === 401 || res.status === 403) { state.reason = "the portal refused the sync (signed in?)"; return null; }
    return res;
  }

  /* ── channel snapshots ↔ deck Store ─────────────────────────────── */
  const CHANNELS = {
    "cd-turn": {
      snapshot: function () {
        return {
          cf_key: storeGet("cf_key", ""),
          cf_token: storeGet("cf_token", ""),
          relay_servers: storeGet("relay_servers", ""),
          relay_expiry: Number(storeGet("relay_expiry", 0)) || 0,
          cf_generated_raw: storeGet("cf_generated_raw", "")
        };
      },
      apply: function (cloud) {
        if (!cloud || typeof cloud !== "object") return false;
        var changed = false;
        var map = {
          cf_key: "cf_key", cf_token: "cf_token", relay_servers: "relay_servers",
          relay_expiry: "relay_expiry", cf_generated_raw: "cf_generated_raw"
        };
        Object.keys(map).forEach(function (ck) {
          var v = cloud[ck];
          if (v === undefined || v === null || v === "") return;
          var local = String(storeGet(map[ck], "") || "");
          /* fill empties; never clobber a local value the cloud has not
             seen (merge policy documented at the top of this file) */
          if (local === "") { storeSet(map[ck], v); changed = true; }
        });
        return changed;
      },
      /* V55: relay-only devices count too. isEmpty looked ONLY at
         cf_key, so a teacher who pasted a manual TURN/relay JSON (the
         documented metered.ca fallback) was told they had "nothing" —
         no self-heal upload, no 📤 hint, "nothing saved yet". */
      isEmpty: function () { return !(String(storeGet("cf_key", "") || "") || String(storeGet("relay_servers", "") || "")); }
    },
    "cd-stream": {
      snapshot: function () {
        var s = storeGet("tablet_live", {}) || {};
        return { gateway: s.gateway || "", secret: s.secret || "", stream: s.stream || "",
                 format: s.format || "landscape", destinations: s.destinations || {} };
      },
      apply: function (cloud) {
        if (!cloud || typeof cloud !== "object") return false;
        var local = storeGet("tablet_live", {}) || {};
        var next = Object.assign({}, local);
        var changed = false;
        ["gateway", "secret", "stream", "format"].forEach(function (f) {
          if (cloud[f] && !local[f]) { next[f] = cloud[f]; changed = true; }
        });
        if (cloud.destinations && Object.keys(cloud.destinations).length && !Object.keys(local.destinations || {}).length) {
          next.destinations = cloud.destinations; changed = true;
        }
        if (changed) storeSet("tablet_live", next);
        return changed;
      },
      isEmpty: function () { var s = storeGet("tablet_live", {}) || {}; return !s.gateway; }
    }
  };

  /* V52 — canonical channel resolution.
     The account's user_settings rows should be keyed "cd-turn"/"cd-stream",
     but any device that ever saved under a different label (an older build,
     a hand-run SQL insert, a renamed channel) produced rows that pull()
     silently ignored — device B then reported "nothing saved yet" although
     device A had saved. Resolution is now by NAME *or by DATA SHAPE*:
     a row whose key mentions turn/relay, or whose value looks like
     {cf_key, cf_token, relay_servers…}, IS the cd-turn channel regardless
     of what it is called. The cloud truth is applied, never skipped. */
  function channelForKey(key, value) {
    if (CHANNELS[key]) return key;
    var k = String(key || "").toLowerCase();
    if (k.indexOf("turn") > -1 || k.indexOf("relay") > -1 ||
        k === "cf" || k === "cf-creds" || k === "cfcreds") return "cd-turn";
    if (k.indexOf("stream") > -1 || k.indexOf("tablet") > -1 || k.indexOf("live") > -1) return "cd-stream";
    if (value && typeof value === "object" && !Array.isArray(value)) {
      var ks = Object.keys(value);
      if (ks.indexOf("cf_key") > -1 || ks.indexOf("cf_token") > -1 || ks.indexOf("relay_servers") > -1) return "cd-turn";
      if (ks.indexOf("gateway") > -1 || ks.indexOf("destinations") > -1) return "cd-stream";
    }
    return null;
  }
  function channelHasData(value) {
    return !!(value && typeof value === "object" &&
      Object.keys(value).some(function (k) { return String(value[k] || "") !== ""; }));
  }

  /* V54.1 (round 18 completion): when an account holds BOTH the canonical
     row ("cd-turn") AND a legacy alias row (an older build, a hand-run
     insert — exactly what the r16 shape-restore reads), the channel's
     truth is the NEWEST row (updated_at), exact key winning ties. The
     naive last-match-wins let a stale alias shadow a freshly verified
     canonical write FOREVER: verification read the alias back, saw stale
     data, and every Save reported failure while the account was actually
     fine. Shared by pull() and verifyChannel() so they can never
     disagree. */
  function rowTs(r) {
    var t = Date.parse(String(r && r.updated_at || ""));
    return isNaN(t) ? 0 : t;
  }
  function pickChannelRow(rows, key) {
    var best = null;
    rows.forEach(function (r) {
      if (!r || !r.key || channelForKey(r.key, r.value) !== key) return;
      var ts = rowTs(r), exact = r.key === key;
      if (!best) { best = r; return; }
      var bts = rowTs(best), bexact = best.key === key;
      if (ts > bts || (ts === bts && exact && !bexact)) best = r;
    });
    return best;
  }

  /* V52→V53: canonical comparison — jsonb re-orders keys, so a raw
     JSON.stringify(local) !== JSON.stringify(cloud) fired even when the
     data was identical. Keys are sorted (deeply) before comparing. */
  function canon(v) {
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(canon);
    var out = {};
    Object.keys(v).sort().forEach(function (k) { out[k] = canon(v[k]); });
    return out;
  }
  function sameCanon(a, b) {
    return JSON.stringify(canon(a)) === JSON.stringify(canon(b));
  }

  /* ── the account read, shared by pull() and the V54 verification ──── */
  async function readRows() {
    var h = await authedHeaders();
    if (h) {
      var ep = await endpoint();
      try {
        var rres = await fetch(ep.url + "/rest/v1/rpc/tc_get_user_settings", {
          method: "POST", headers: h, body: "{}"
        });
        if (rres.ok) {
          var rows = await rres.json();
          if (Array.isArray(rows)) { state.missing = false; return rows; }
        } else if (rres.status === 401 || rres.status === 403) {
          state.reason = "the portal refused the sync (signed in?)";
          return null;
        }
        /* 404 = pre-V53 database → fall through to the table GET */
      } catch (eRpc) {}
    }
    var res = await get("/user_settings?select=key,value,updated_at");
    if (!res) return null;
    try {
      var rows2 = await res.json();
      return Array.isArray(rows2) ? rows2 : null;
    } catch (e) { return null; }
  }

  /* ── public API ──────────────────────────────────────────────────── */

  /* V53: the write goes through the security-definer RPC
     tc_set_user_setting(p_key, p_value): the database upserts against
     its own primary key, and the deck reads and surfaces the exact
     error when anything goes wrong. The old REST upsert remains as a
     pre-V53 fallback. */
  async function rpcSet(key, value) {
    var h = await authedHeaders({ "Content-Type": "application/json" });
    if (!h) return { ok: false, reason: state.reason || "not signed in to the portal on this device" };
    var ep = await endpoint();
    var res = await fetch(ep.url + "/rest/v1/rpc/tc_set_user_setting", {
      method: "POST", headers: h,
      body: JSON.stringify({ p_key: key, p_value: value })
    });
    if (res.status === 404) return { ok: false, missing: true };   /* pre-V53 database */
    if (!res.ok) return { ok: false, reason: await bodyReason(res, "portal answered " + res.status + " for the credential upload") };
    return { ok: true };
  }

  /* V54: THE VERIFICATION READ-BACK. A write that the server ACKNOWLEDGED
     is not yet a write the NEXT DEVICE will see — RLS edges, partial
     migrations and silent rollbacks all live in that gap, and it is
     exactly where "saved on A, empty on B" was born. After every write
     the account is read back through the same path the next device
     uses, and the channel's row must canonically match what we sent. */
  async function verifyChannel(key, snap) {
    try {
      var rows = await readRows();
      if (rows === null) {
        return fail("verify " + key, "the credential was sent, but the read-back could not confirm it (" +
          (state.reason || "the account could not be read") + "). Press ☁️ Sync now — if it persists, run database/complete-schema.sql on the studio database");
      }
      /* V54.1: the truth is the NEWEST row for the channel (exact key
         winning ties) — a stale legacy alias must never shadow the row
         this device just wrote. */
      var truth = pickChannelRow(rows, key);
      var hit = truth ? truth.value : null, hitKey = truth ? truth.key : null;
      if (hit !== null && sameCanon(hit, snap)) return true;
      return fail("verify " + key, hit
        ? "the portal accepted the write but the account reads back different data (row “" + hitKey + "”) — press ☁️ Sync now again; if it persists the database is mid-migration, run database/complete-schema.sql"
        : "the portal accepted the write but the account reads back NOTHING for this device — the database is refusing to store it. Run database/complete-schema.sql (or v47-cloud-credentials.sql then v53-credential-truth-staff-monitor.sql) on the studio database, then press ☁️ Sync now");
    } catch (e) {
      return fail("verify " + key, "the verification read failed (" + (e && e.message ? e.message : "network") + ")");
    }
  }

  async function pull() {
    try {
      var rows = await readRows();
      if (rows === null) return false;
      var applied = [];
      var cloudKeys = {};
      state.cloud = {};     /* WHAT the account holds, by canonical channel */
      state.cloudRows = {}; /* the exact cloud payload per channel — what
                               syncNow() diffs against */
      /* V54.1: group every row that maps to a channel, NEWEST FIRST, so
         (a) the merge applies the newest data before stale aliases can
         fill an empty field, and (b) the diff/verify truth is the newest
         row, not whichever alias sorts last. */
      var byChannel = {};
      rows.forEach(function (r) {
        if (!r || !r.key) return;
        var canonical = channelForKey(r.key, r.value);
        if (!canonical) return;
        cloudKeys[canonical] = true;
        (byChannel[canonical] = byChannel[canonical] || []).push(r);
      });
      Object.keys(byChannel).forEach(function (canonical) {
        var group = byChannel[canonical].sort(function (a, b) {
          var d = rowTs(b) - rowTs(a);
          if (d) return d;
          return (b.key === canonical ? 1 : 0) - (a.key === canonical ? 1 : 0);
        });
        var truth = pickChannelRow(rows, canonical);
        if (truth && channelHasData(truth.value)) {
          state.cloud[canonical] = true;
          state.cloudRows[canonical] = truth.value;
        } else if (truth) {
          state.cloudRows[canonical] = truth.value;   /* tombstone */
        }
        var ch = CHANNELS[canonical];
        group.forEach(function (r) {
          if (ch && ch.apply(r.value) && applied.indexOf(canonical) < 0) applied.push(canonical);
        });
        lsSet(SYNCED_AT + ":" + canonical, String(Date.now()));
      });
      /* round-12: a device that has credentials the cloud has NOT seen
         (saved before the V47 update ran, or created offline) publishes
         them now — the working setup wins, so the NEXT device is covered.
         This is also the self-healing path: the first deck boot after the
         V53 update pushes whatever this device holds, so an account that
         previous silent failures left empty fills itself without the
         teacher doing anything. */
      var pushes = [];
      Object.keys(CHANNELS).forEach(function (k) {
        if (cloudKeys[k]) return;
        var ch = CHANNELS[k];
        if (ch && !ch.isEmpty()) pushes.push(k);
      });
      var pushResults = await Promise.all(pushes.map(function (k) { return push(k); }));
      /* V54.2: record the self-heal outcome so the boot UI can TELL the
         teacher what happened — "this device's credentials were just
         uploaded because the account was empty" (or exactly why the
         upload failed). Until now this healing push was completely
         invisible, which is why an account left empty by the old
         silent-failure bug looked "still broken" after the fix. */
      state.selfHeal = {
        pushed: pushes.filter(function (k, i) { return pushResults[i]; }),
        failed: pushes.filter(function (k, i) { return !pushResults[i]; })
      };
      state.ready = true;
      state.missing = false;
      state.lastChecked = Date.now();
      /* V51→V54: "last sync" only counts when data actually moved: something
         was applied from the cloud, this device published credentials the
         cloud had not seen, or the account verifiably holds credentials
         (a read that CONFIRMED agreement with a non-empty account is a
         real sync of real data — not a login read of an empty account). */
      if (applied.length || pushResults.some(function (ok) { return ok; }) || Object.keys(state.cloud).length) {
        state.lastSync = Date.now();
      }
      /* V54: the persisted truth always follows a SUCCESSFUL read — even
         when the read says the account now holds nothing (a credential
         cleared on another device must not keep showing ✓ on this one
         after a reload). The clock itself only advances when data moved
         or the account verifiably holds something. */
      persistStamp();
      if (applied.length) notify(applied);
      return true;
    } catch (e) {
      return fail("pull", "portal unreachable (" + (e && e.message ? e.message : "network") + ")");
    }
  }

  /* V52→V54 — "Sync now" is a REAL, VERIFIED two-way sync:
     1. pull() FIRST — the diff must be against the account's ACTUAL
        current state, never a stale in-memory copy (the r16/r17 "synced —
        credentials current" lie while "last sync" said "not yet" was
        exactly a stale-copy diff);
     2. every channel this device holds that the fresh read says the
        cloud lacks — or holds DIFFERENTLY (canonical diff, key order
        can't lie) — is pushed (the local truth wins on a manual sync);
     3. every push is verified by reading the account back, so the sync
        clock only advances on truth. */
  async function syncNow() {
    var out = { ok: false, pushed: [], pushFailed: [], reason: "" };
    try { await ensureToken(); } catch (e) {}
    var pulled = await pull();
    /* V55 (round 20): if the fresh read FAILED, do not push anything.
     The old flow diffed against the stale in-memory copy and pushed
     anyway — a transient read failure could then upload an OUTDATED
     local snapshot over newer account data (e.g. a relay token another
     device had just renewed), silently breaking every other device. */
    if (!pulled) {
      out.reason = "the account could not be read — nothing was pushed (a push without a fresh read could overwrite newer data on the account): " +
        (state.reason || "check the connection and press 🔄 Sync now again");
      return out;
    }
    Object.keys(CHANNELS).forEach(function (k) {
      var ch = CHANNELS[k];
      if (!ch || !ch.snapshot) return;
      if (ch.isEmpty && ch.isEmpty()) return;          /* nothing local to offer */
      var localSnap = ch.snapshot();
      var cloudVal = (state.cloudRows || {})[k];
      var differs = !cloudVal || !sameCanon(cloudVal, localSnap);
      if (differs) out.pushed.push(k);
    });
    var results = [];
    for (var i = 0; i < out.pushed.length; i++) {
      results.push(await push(out.pushed[i]));
    }
    out.pushFailed = out.pushed.filter(function (k, i2) { return !results[i2]; });
    out.ok = pulled || results.some(function (r) { return r; });
    if (results.some(function (r) { return r; }) || Object.keys(state.cloud || {}).length) {
      state.lastSync = Date.now();
      persistStamp();
    }
    out.reason = state.reason || "";
    return out;
  }

  /* V54: pushes are SERIALIZED per channel. Save fires the relay push and
     the key push back-to-back; Generate pushes while Save's push may still
     be in flight. Concurrent pushes meant concurrent token refreshes (the
     rotation-reuse revocation) and last-write races between snapshots of
     the same channel. The queue coalesces them: each queued push snapshots
     FRESH data when it actually runs, so a rapid double-save uploads the
     final state. */
  function push(key, force) {
    var ch = CHANNELS[key];
    if (!ch) return Promise.resolve(false);
    var prev = state._pushTail[key] || Promise.resolve(false);
    var run = prev.catch(function () {}).then(function () { return rawPush(key, force); });
    state._pushTail[key] = run;
    return run;
  }

  async function rawPush(key, force) {
    var ch = CHANNELS[key];
    if (!ch) return false;
    try {
      /* V52 — the token (and with it the uid) is resolved BEFORE the
         payload is built. The original built the row with state.uid
         while it was still null, uploaded user_id NULL, and the RLS
         policy refused it invisibly. */
      var token = await ensureToken();
      if (!token || !state.uid) {
        return fail("write " + key, state.reason || "not signed in to the portal on this device");
      }
      var snap = ch.snapshot();
      /* force=true pushes even an EMPTY snapshot — the deliberate-clear
         tombstone, so removed credentials are not resurrected on the
         next pull from another device. */
      if (!force && ch.isEmpty && ch.isEmpty()) return false;   /* nothing to offer — not a failure */
      /* V53: RPC-first write — the database upserts against its own
         primary key; no client-side on_conflict assumptions.
         V54: the write only counts once the account VERIFIABLY holds
         it (read-back + canonical comparison). */
      var viaRpc = await rpcSet(key, snap);
      if (viaRpc.ok) {
        if (await verifyChannel(key, snap)) {
          lsSet(SYNCED_AT + ":" + key, String(Date.now()));
          stampSync(key, snap);
          return true;
        }
        return false;   /* verifyChannel set the reason */
      }
      if (viaRpc.reason) return fail("write " + key, viaRpc.reason);
      /* pre-V53 database: the old upsert, but with the error body read */
      var res = await post("/user_settings?on_conflict=user_id,key",
        { user_id: state.uid, key: key, value: snap, updated_at: new Date().toISOString() },
        { Prefer: "resolution=merge-duplicates" });   /* upsert, not 409 */
      if (res && res.ok) {
        if (await verifyChannel(key, snap)) {
          lsSet(SYNCED_AT + ":" + key, String(Date.now()));
          stampSync(key, snap);
          return true;
        }
        return false;
      }
      if (res && res.status === 404) {
        state.missing = true;
        return fail("write " + key, "the user_settings table is missing — run database/complete-schema.sql (or v47-cloud-credentials.sql, then v53) on the studio database and press ☁️ Sync now");
      }
      if (res) {
        return fail("write " + key, await bodyReason(res, "portal answered " + res.status + " for the credential upload — run database/complete-schema.sql on the studio database if it persists"));
      }
      return fail("write " + key, state.reason || "the portal refused the credential upload (signed in?)");
    } catch (e) {
      return fail("write " + key, "portal unreachable (" + (e && e.message ? e.message : "network") + ")");
    }
  }

  /* V53→V54: a VERIFIED successful push IS a sync — update the card's
     truth at once, and persist it so a page reload keeps showing it. */
  function stampSync(key, snap) {
    state.lastSync = Date.now();
    state.lastChecked = Date.now();
    state.cloud = state.cloud || {};
    state.cloudRows = state.cloudRows || {};
    if (channelHasData(snap)) {
      state.cloud[key] = true;
      state.cloudRows[key] = snap;
    } else {
      delete state.cloud[key];
      state.cloudRows[key] = snap;
    }
    state.reason = "";
    persistStamp();
  }

  /* V54: persist the verified-sync truth. The card seeds from this on the
     next page load — "last sync" survives reloads (the r17 "not yet after
     a reload" gap), and the account-holds line stays honest because it is
     only ever written after a verified write or a successful read. */
  function persistStamp() {
    try {
      var holds = {};
      Object.keys(state.cloud || {}).forEach(function (k) { holds[k] = state.lastSync; });
      lsSet(STAMP_KEY, JSON.stringify({
        lastSync: state.lastSync || 0, cloudHolds: holds,
        email: sessionEmail(), build: BUILD
      }));
    } catch (e) {}
  }

  /* V54.2: authed REST DELETE (probe cleanup). The V47 "own settings
     deletable" policy scopes it to the caller's rows. */
  async function restDelete(path) {
    var h = await authedHeaders();
    if (!h) return null;
    var ep = await endpoint();
    return fetch(ep.url + "/rest/v1" + path, { method: "DELETE", headers: h });
  }

  /* V54.2 (the live-account lesson): THE SAFE WRITE PROBE. The field
     report that ended round 18: the diagnosis on an empty device SKIPPED
     the write test ("this device holds no credentials yet") and then said
     "everything checked out" — while the one thing the user needed to
     know was whether the WRITE path works. Verified live against the
     production database: write → read back → delete → confirm gone, all
     through the exact paths Save uses. The probe row ("cd-diag") is
     ignored by sync (channelForKey returns null for it) and is deleted
     afterwards, so it can run on ANY device at ANY time harmlessly. */
  async function probeWrite() {
    var key = "cd-diag";
    var val = { probe: "diagnose-" + new Date().toISOString() };
    /* 1 — write through the real path (RPC first, REST fallback) */
    var viaRpc = await rpcSet(key, val);
    if (!viaRpc.ok && !viaRpc.missing) return { ok: false, reason: viaRpc.reason };
    if (!viaRpc.ok) {
      var res = await post("/user_settings?on_conflict=user_id,key",
        { user_id: state.uid, key: key, value: val, updated_at: new Date().toISOString() },
        { Prefer: "resolution=merge-duplicates" });
      if (res && res.status === 404) return { ok: false, reason: "the user_settings table is missing — run database/complete-schema.sql (or v47-cloud-credentials.sql) on the studio database" };
      if (!res || !res.ok) return { ok: false, reason: res ? await bodyReason(res, "portal answered " + res.status + " for the probe write") : (state.reason || "the portal refused the probe write (signed in?)") };
    }
    /* 2 — read back */
    var rows = await readRows();
    if (rows === null) return { ok: false, reason: "the probe was written but the read-back failed (" + (state.reason || "the account could not be read") + ")" };
    var found = rows.some(function (r) { return r && r.key === key && r.value && r.value.probe === val.probe; });
    if (!found) return { ok: false, reason: "the portal accepted the probe write but the account reads back nothing — the user_settings table on the studio database is refusing to store rows for this account. Run database/complete-schema.sql, then press 🔄 Sync now" };
    /* 3 — clean up and confirm gone */
    var cleaned = false;
    try {
      var del = await restDelete("/user_settings?key=eq." + encodeURIComponent(key));
      cleaned = !!(del && del.ok);
    } catch (e) { cleaned = false; }
    return { ok: true, cleaned: cleaned };
  }

  /* V54 — diagnose(): the step-by-step probe behind the 🔍 button.
     Walks the exact chain a real sync uses and stops at the first broken
     link, naming it and its remedy. Read-only unless a real channel with
     real data exists — in that case the final step is a genuine VERIFIED
     re-push (which is also the healing action for a half-migrated
     database). Returns the step list for the UI. */
  async function diagnose() {
    var steps = [];
    function step(name, ok, detail, remedy) {
      steps.push({ name: name, ok: !!ok, detail: String(detail || ""), remedy: String(remedy || "") });
      return !!ok;
    }
    var sess = readSession();
    if (!step("1 · portal session on this device", !!sess,
        sess ? ((sess.user && sess.user.email) || "token present (email unknown)") : "no saved portal login",
        "Sign in to ADEWALE CLASSROOM on this device — or open ⚙ Settings → ☁️ Cloud sync → Link account and use your portal email + password.")) return steps;
    /* V55 (round 20): THE LOCAL INVENTORY. The one fact that decides
       the two-device story is whether THIS browser even holds the
       credentials — until now the report could not distinguish "wrong
       device" from "silent failure", and the user went in circles. */
    var held = holdsLocal();
    var heldBits = [];
    if (held.indexOf("cd-turn") > -1) {
      var ts = CHANNELS["cd-turn"].snapshot();
      heldBits.push("🔑 TURN credentials ✓ (" + (String(ts.cf_key || "") ? "Cloudflare key + token" : "relay servers JSON") + ")");
    }
    if (held.indexOf("cd-stream") > -1) heldBits.push("📡 stream setup ✓");
    step("2 · this device's saved credentials", true,
      heldBits.length ? heldBits.join(" · ") + " — this is the device that can upload them" : "none — THIS browser holds no TURN or stream credentials (if you expected the key here, it lives in a different browser or profile on this device, or was never saved)",
      "");
    var ep = null;
    try { ep = await endpoint(); } catch (e) {}
    if (!step("3 · portal address", !!ep && /^https:\/\//.test(String((ep || {}).url || "")),
        ep ? ep.url : "the deck could not discover the portal address",
        "Redeploy the deck together with the portal (js/config.js must be reachable), or open the deck from inside the portal once so the address is cached.")) return steps;
    state.reason = "";
    var tok = null;
    try { tok = await ensureToken(); } catch (e) {}
    if (!step("4 · account token", !!tok, tok ? "token valid for " + (sess.user && sess.user.email ? sess.user.email : "this account") : (state.reason || "token refresh failed"),
        "Sign out and back in to the portal on this device — the saved login has expired or was revoked.")) return steps;
    var rows = null;
    try { rows = await readRows(); } catch (e) {}
    var hasV53 = false;
    try {
      var h = await authedHeaders();
      if (h) {
        var ep2 = await endpoint();
        var rr = await fetch(ep2.url + "/rest/v1/rpc/tc_get_user_settings", { method: "POST", headers: h, body: "{}" });
        hasV53 = rr.ok;
      }
    } catch (e) {}
    step("5 · database read path" + (hasV53 ? " (V53 RPC ✓" + (rows ? ")" : " — but it returned no rows)") : " (pre-V53 — plain table read)"),
      rows !== null,
      rows === null ? (state.reason || "the account could not be read") : (rows.length + " setting row(s) readable in your account"),
      "Run database/complete-schema.sql on the studio database — the user_settings table or its read policy is missing/refusing this account.");
    if (rows === null) return steps;
    /* 5 — the write path. Only tested with REAL data this device actually
       holds (a genuine, healing re-push with verification). Nothing is
       written when the device holds nothing worth syncing. */
    var chan = null;
    Object.keys(CHANNELS).forEach(function (k) { if (!chan && CHANNELS[k] && !CHANNELS[k].isEmpty()) chan = k; });
    if (!chan) {
      /* V54.2: NEVER skip the write test. A safe probe (write → read
         back → delete → confirm gone) proves the exact path Save uses,
         from any device, with no lasting side effects. */
      var pr = await probeWrite();
      step("6 · database write path (safe probe: write → read back → delete)", pr.ok,
        pr.ok
          ? "probe written, read back and confirmed, then deleted" + (pr.cleaned ? " ✓ — the account can verifiably store credentials" : " — but the probe row could not be deleted (harmless: sync ignores it; delete rights are missing on user_settings)")
          : (pr.reason || "the probe was refused"),
        pr.ok ? "" : "Run database/complete-schema.sql (or v47-cloud-credentials.sql then v53-credential-truth-staff-monitor.sql) on the studio database, then press 🔄 Sync now.");
      return steps;
    }
    var okPush = await push(chan);
    step("6 · database write path (verified re-push of " + chan + ")", okPush,
      okPush ? "written, read back and verified ✓ — your account verifiably holds this device's credentials" : (state.reason || "the write was refused"),
      okPush ? "" : "Run database/complete-schema.sql (or v47-cloud-credentials.sql then v53-credential-truth-staff-monitor.sql) on the studio database, then press 🔄 Sync now.");
    return steps;
  }

  /* V55: which channels hold REAL data on THIS device (uses the
     fixed isEmpty — relay-only counts). The boot UI, the 📤 hint and
     the diagnosis verdict all ask this one question. */
  function holdsLocal() {
    return Object.keys(CHANNELS).filter(function (k) {
      var ch = CHANNELS[k];
      return !!(ch && ch.isEmpty && !ch.isEmpty());
    });
  }

  function notify(applied) {
    state._listeners.forEach(function (fn) { try { fn(applied); } catch (e) {} });
  }

  return {
    /* CloudCreds.pull() — call on deck boot when a portal session exists */
    pull: pull,
    /* "Sync now" — read first, push real differences, verify, stamp */
    syncNow: syncNow,
    /* V54: the step-by-step probe for the 🔍 Diagnose button */
    diagnose: diagnose,
    /* V54.2: the last pull()'s self-heal outcome — { pushed: [...], failed: [...] } —
       so the boot UI can tell the teacher the account was just filled
       (or exactly why the upload failed). */
    selfHeal: function () { return state.selfHeal || { pushed: [], failed: [] }; },
    /* V55: channels with real data on THIS device (relay-only counts) */
    holdsLocal: holdsLocal,
    /* V51: what the account actually holds + when it was last read */
    cloud: function () { return state.cloud || {}; },
    cloudRows: function () { return state.cloudRows || {}; },
    lastChecked: function () { return state.lastChecked || 0; },
    /* CloudCreds.push('cd-turn' | 'cd-stream', force?) — call after
       saving (force=true also pushes a deliberate clear). Serialized +
       verified. */
    push: push,
    /* CloudCreds.onApply(fn) — fn(listOfAppliedChannels) after a pull
       that changed local state (refresh Settings UI etc.) */
    onApply: function (fn) { if (typeof fn === "function") state._listeners.push(fn); },
    /* helpers for call sites */
    channels: Object.keys(CHANNELS),
    turnSnapshot: function () { return CHANNELS["cd-turn"].snapshot(); },
    streamSnapshot: function () { return CHANNELS["cd-stream"].snapshot(); },
    signedIn: function () { return !!readSession(); },
    signIn: signIn,
    signOut: signOut,
    sessionEmail: sessionEmail,
    status: function () {
      return { ready: state.ready, reason: state.reason, uid: state.uid,
               missing: !!state.missing, lastSync: state.lastSync || 0,
               cloud: state.cloud || {}, lastChecked: state.lastChecked || 0,
               build: BUILD };
    }
  };
})();
