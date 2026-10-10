/* =====================================================================
   cloud-creds.js — ADEWALE CLASSROOM DECK · V47 round 11
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
   policy level — v47):

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

   V52 (round 16, items 8+9) — the "saved on A, empty on B" autopsy:
     · push() built its row with state.uid BEFORE any request ran, and
       the uid was only resolved lazily inside the request helpers — so
       the FIRST push of a session uploaded user_id NULL, RLS refused
       it, and the failure was SILENT. The key looked saved on device A
       while the account never received it; device B's Restore then
       honestly said "nothing saved yet". push() now resolves the token
       and uid FIRST, and never fails silently (state.reason is set and
       callers can toast it).
     · pull() matched rows to channels by exact key name only; any row
       saved under a different label was ignored. Channels now resolve
       by NAME OR DATA SHAPE (a value with cf_key/cf_token/relay_servers
       IS the TURN channel whatever its row is called).
     · push() never counted as a sync, and "Sync now" only pulled — so
       right after generating credentials the card said "synced" while
       "last sync" stayed "not yet" and "Account holds" stayed empty.
       A successful push now stamps the sync clock, and syncNow() (the
       Sync-now button) pushes this device's differences BEFORE pulling.
   Sensitive values are never logged.
   ===================================================================== */
"use strict";

window.CloudCreds = (function () {
  const ENDPOINT_CACHE = "cd-portal-endpoint";   // {url, anon}
  const SESSION_RE = /^sb-.*-auth-token$/;
  const SYNCED_AT = "cd-creds-cloud-at";          // per-channel last sync ms

  const state = {
    ready: false, uid: null, url: null, anon: null,
    reason: "",                                    // why sync is off (UI)
    _endpointPromise: null, _listeners: []
  };

  function lsGet(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsJSON(k, d) { try { return JSON.parse(localStorage.getItem(k) || "null") || d; } catch (e) { return d; } }
  function storeGet(k, d) { try { return window.Store ? (Store.get(k, d) !== undefined ? Store.get(k, d) : d) : d; } catch (e) { return d; } }
  function storeSet(k, v) { try { if (window.Store) Store.set(k, v); } catch (e) {} }

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
  async function ensureToken() {
    var sess = readSession();
    if (!sess) { state.reason = "not signed in to the portal on this device"; return null; }
    var fresh = sess.access_token && sess.expires_at && (sess.expires_at * 1000) > Date.now() + 60000;
    if (fresh) { state.uid = uidFromSession(sess, sess.access_token); if (!state.uid) { state.reason = "portal session has no user — sign in again"; return null; } return sess.access_token; }
    if (!sess.refresh_token) { state.reason = "portal session expired — sign in to the portal once"; return null; }
    try {
      var ep = await endpoint();
      var res = await fetch(ep.url + "/auth/v1/token", {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ep.anon },
        body: JSON.stringify({ grant_type: "refresh_token", refresh_token: sess.refresh_token })
      });
      if (!res.ok) throw new Error("refresh " + res.status);
      var data = await res.json();
      if (!data || !data.access_token) throw new Error("no token in refresh response");
      /* write the refreshed session back under the SAME key, so the
         portal picks it up too — one session, kept alive from either side */
      var next = Object.assign({}, sess, data);
      try { localStorage.setItem(sess._lsKey, JSON.stringify(next)); } catch (e) {}
      state.uid = uidFromSession(data, data.access_token);
      if (!state.uid) { state.reason = "portal session has no user — sign in again"; return null; }
      return data.access_token;
    } catch (e) {
      state.reason = "portal session expired — sign in to the portal once";
      return null;
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
      isEmpty: function () { return !String(storeGet("cf_key", "") || ""); }
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

  /* V52 (round 16, items 8+9) — canonical channel resolution.
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

  /* V52 (round 17): canonical comparison — jsonb re-orders keys, so a raw
     JSON.stringify(local) !== JSON.stringify(cloud) fired even when the
     data was identical. Keys are sorted (deeply) before comparing. */
  function canon(v) {
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(canon);
    var out = {};
    Object.keys(v).sort().forEach(function (k) { out[k] = canon(v[k]); });
    return out;
  }

  /* ── public API ──────────────────────────────────────────────────── */

  /* V53 (round 17, items 1+2) — THE SILENT-FAILURE FIX, server side.
     The deck used to write credentials with a REST upsert
     (`POST /user_settings?on_conflict=user_id,key` + a Prefer header).
     That request is fragile against real databases: any drift between
     what the request assumes and what the live table actually has —
     a different constraint, a missing column, a PostgREST quirk —
     comes back as a bare 4xx whose BODY the deck never read, so the
     push failed with "unknown", the account stayed empty, and every
     other device honestly said "nothing saved yet". The write now goes
     through the V53 security-definer RPC tc_set_user_setting(p_key,
     p_value): the database does the upsert against its own primary
     key, and the deck reads and surfaces the exact error when anything
     still goes wrong. The old upsert remains as a pre-V53 fallback. */
  async function rpcSet(key, value) {
    var h = await authedHeaders({ "Content-Type": "application/json" });
    if (!h) return { ok: false, missing: true };
    var ep = await endpoint();
    var res = await fetch(ep.url + "/rest/v1/rpc/tc_set_user_setting", {
      method: "POST", headers: h,
      body: JSON.stringify({ p_key: key, p_value: value })
    });
    if (res.status === 404) return { ok: false, missing: true };   /* pre-V53 database */
    if (!res.ok) {
      var msg = "portal answered " + res.status;
      try {
        var err = await res.json();
        if (err && (err.message || err.hint || err.details)) {
          msg = (err.message || "") + (err.hint ? " — " + err.hint : "") + (err.details ? " (" + err.details + ")" : "");
        }
      } catch (e2) {}
      return { ok: false, reason: msg };
    }
    return { ok: true };
  }

  async function pull() {
    try {
      /* V53: reads also prefer the RPC (tc_get_user_settings) — same
         security-definer truth, one call, and it keeps working even if
         the table's SELECT policy is ever tightened. Falls back to the
         plain table GET on a pre-V53 database. */
      var rows = null;
      var h = await authedHeaders();
      if (h) {
        var ep = await endpoint();
        try {
          var rres = await fetch(ep.url + "/rest/v1/rpc/tc_get_user_settings", {
            method: "POST", headers: h, body: "{}"
          });
          if (rres.ok) {
            rows = await rres.json();
            if (!Array.isArray(rows)) rows = null;
          } else if (rres.status === 401 || rres.status === 403) {
            state.reason = "the portal refused the sync (signed in?)";
            return false;
          }
          /* 404 = pre-V53 database → fall through to the table GET */
        } catch (eRpc) {}
      }
      if (!rows) {
        var res = await get("/user_settings?select=key,value,updated_at");
        if (!res) return false;
        rows = await res.json();
        if (!Array.isArray(rows)) return false;
      }
      var applied = [];
      var cloudKeys = {};
      state.cloud = {};     /* WHAT the account holds, by canonical channel */
      state.cloudRows = {}; /* the exact cloud payload per channel — what
                               syncNow() diffs against */
      rows.forEach(function (r) {
        if (!r || !r.key) return;
        var canonical = channelForKey(r.key, r.value);
        if (canonical) {
          cloudKeys[canonical] = true;
          if (channelHasData(r.value)) {
            state.cloud[canonical] = true;
            state.cloudRows[canonical] = r.value;
          } else {
            state.cloudRows[canonical] = state.cloudRows[canonical] || r.value;  /* tombstone */
          }
          var ch = CHANNELS[canonical];
          if (ch && ch.apply(r.value)) applied.push(canonical);
          lsSet(SYNCED_AT + ":" + canonical, String(Date.now()));
        }
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
        if (ch && !ch.isEmpty()) pushes.push(push(k));
      });
      var pushResults = await Promise.all(pushes);
      state.ready = true;
      state.missing = false;
      state.lastChecked = Date.now();
      /* V51: "last sync" only counts when data actually moved: something
         was applied from the cloud, this device published credentials the
         cloud had not seen, or the account genuinely holds credentials
         (a read that CONFIRMED agreement with a non-empty account is a
         real sync of real data — not a login read of an empty account). */
      if (applied.length || pushResults.some(function (ok) { return ok; }) || Object.keys(state.cloud).length) {
        state.lastSync = Date.now();
      }
      if (applied.length) notify(applied);
      return true;
    } catch (e) {
      state.reason = "portal unreachable";
      return false;
    }
  }

  /* V52 (round 16, item 9) — "Sync now" is now a REAL two-way sync:
     1. every channel this device holds that the cloud lacks, or holds
        DIFFERENTLY (canonical diff — key order no longer lies), is
        pushed first (the local truth wins on a manual sync — the teacher
        pressed the button on the device that has the working setup);
     2. then pull() brings back anything THIS device lacks.
     V53: the pushes go through the RPC, so they can no longer fail
     silently with "unknown". */
  async function syncNow() {
    var pushed = [];
    try {
      await ensureToken();
    } catch (e) {}
    Object.keys(CHANNELS).forEach(function (k) {
      var ch = CHANNELS[k];
      if (!ch || !ch.snapshot) return;
      if (ch.isEmpty && ch.isEmpty()) return;          /* nothing local to offer */
      var localSnap = ch.snapshot();
      var cloudVal = (state.cloudRows || {})[k];
      var differs = !cloudVal ||
        JSON.stringify(canon(cloudVal)) !== JSON.stringify(canon(localSnap));
      if (differs) pushed.push(k);
    });
    var results = [];
    for (var i = 0; i < pushed.length; i++) {
      results.push(await push(pushed[i]));
    }
    var ok = await pull();
    if (results.some(function (r) { return r; }) || Object.keys(state.cloud || {}).length) {
      state.lastSync = Date.now();
    }
    return { ok: ok, pushed: pushed, pushFailed: pushed.filter(function (k, i2) { return !results[i2]; }) };
  }

  async function push(key, force) {
    var ch = CHANNELS[key];
    if (!ch) return false;
    try {
      /* V52 (round 16, item 8) — the token (and with it the uid) is
         resolved BEFORE the payload is built. The original built the row
         with state.uid while it was still null, uploaded user_id NULL,
         and the RLS policy refused it invisibly. */
      var token = await ensureToken();
      if (!token || !state.uid) {
        state.reason = state.reason || "not signed in to the portal on this device";
        return false;
      }
      var snap = ch.snapshot();
      /* force=true pushes even an EMPTY snapshot — the deliberate-clear
         tombstone, so removed credentials are not resurrected on the
         next pull from another device. */
      if (!force && ch.isEmpty && ch.isEmpty()) return false;
      /* V53 (round 17): RPC-first write — the database upserts against
         its own primary key; no client-side on_conflict assumptions. */
      var viaRpc = await rpcSet(key, snap);
      if (viaRpc.ok) {
        lsSet(SYNCED_AT + ":" + key, String(Date.now()));
        stampSync(key, snap);
        return true;
      }
      if (viaRpc.reason) { state.reason = viaRpc.reason; return false; }
      /* pre-V53 database: the old upsert, but with the error body read */
      var res = await post("/user_settings?on_conflict=user_id,key",
        { user_id: state.uid, key: key, value: snap, updated_at: new Date().toISOString() },
        { Prefer: "resolution=merge-duplicates" });   /* upsert, not 409 */
      if (res && res.ok) {
        lsSet(SYNCED_AT + ":" + key, String(Date.now()));
        stampSync(key, snap);
        return true;
      }
      if (res && res.status === 404) {
        state.reason = "database update needed — run database/v47-cloud-credentials.sql (and V53 for the sync RPCs)";
        state.missing = true;
      } else if (res) {
        state.reason = "portal answered " + res.status + " — run database/complete-schema.sql on the studio database";
        try {
          var err = await res.json();
          if (err && (err.message || err.hint)) {
            state.reason = (err.message || "") + (err.hint ? " — " + err.hint : "");
          }
        } catch (e3) {}
      } else if (!viaRpc.missing) {
        state.reason = state.reason || "the portal refused the sync (signed in?)";
      }
      return false;
    } catch (e) {
      state.reason = "portal unreachable (" + (e && e.message ? e.message : "network") + ")";
      return false;
    }
  }

  /* V53: a successful push IS a sync — update the card's truth at once. */
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
  }

  function notify(applied) {
    state._listeners.forEach(function (fn) { try { fn(applied); } catch (e) {} });
  }

  return {
    /* CloudCreds.pull() — call on deck boot when a portal session exists */
    pull: pull,
    /* V52 (round 16, item 9): the REAL two-way sync behind "Sync now" —
       pushes what this device holds that the cloud lacks (or holds
       differently), then pulls. Returns {ok, pushed, pushFailed}. */
    syncNow: syncNow,
    /* V51: what the account actually holds + when it was last read */
    cloud: function () { return state.cloud || {}; },
    cloudRows: function () { return state.cloudRows || {}; },
    lastChecked: function () { return state.lastChecked || 0; },
    /* CloudCreds.push('cd-turn' | 'cd-stream', force?) — call after
       saving (force=true also pushes a deliberate clear) */
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
               cloud: state.cloud || {}, lastChecked: state.lastChecked || 0 };
    }
  };
})();
