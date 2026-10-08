/* =====================================================================
   stream-kit.js — ADEWALE CLASSROOM DECK · V47 round 11 (item 3)
   =====================================================================
   Enterprise streaming toolkit for multi-platform live classes
   (YouTube · Facebook · TikTok · Instagram · Twitch · Kick · custom).
   Pure, dependency-free and unit-tested — teach.js renders through it,
   so every rule below is enforced on every stream start:

     · PLATFORM PRESETS — pick a platform, paste ONLY the key; the
       correct RTMP/RTMPS server is filled in (Facebook needs rtmps on
       443, YouTube rtmp on live2, …). Kills the #1 stream failure:
       a wrong or hand-typed server URL.
     · KEY HYGIENE — pasting a full rtmp:// URL into the key box is
       detected and explained; keys are trimmed and masked in the UI;
       keys are never logged.
     · PREFLIGHT — validates destinations before a single byte goes
       out: empty keys, duplicate platforms, an http gateway on an
       https page (browsers block it), TikTok-landscape warnings.
     · FETCH TIMEOUTS — every relay call carries an AbortController so
       a dead gateway can never hang the UI.
     · RECONNECT POLICY — exponential backoff (1s → 2s → 4s … capped
       30s) for the WHIP watchdog; escalation hints per attempt.
     · BITRATE/FPS GUIDANCE — honest numbers for mobile uploads.
   ===================================================================== */
"use strict";

window.StreamKit = (function () {
  const PLATFORMS = {
    youtube:   { label: "YouTube Live",     server: "rtmp://a.rtmp.youtube.com/live2",
                 keyHint: "YouTube → Go Live → Stream key",
                 note: "YouTube keys go stale after a few uses — copy a fresh one from Go Live if the stream is refused." },
    facebook:  { label: "Facebook Live",    server: "rtmps://live-api-s.facebook.com:443/rtmp/",
                 keyHint: "Facebook Live Producer → Use stream key",
                 note: "Facebook requires RTMPS (TLS, port 443) — the preset uses it automatically." },
    tiktok:    { label: "TikTok Live",      server: "rtmp://push.tiktokcdn.com/live",
                 keyHint: "TikTok Live Center → Server URL + Stream key",
                 note: "TikTok Live needs account access; stream VERTICAL for the full screen. TikTok also limits live length — prefer shorter classes." },
    instagram: { label: "Instagram Live",   server: "rtmps://live-upload.instagram.com:443/rtmp",
                 keyHint: "Instagram Live Producer → Stream key",
                 note: "Instagram Live Producer access is required (professional accounts)." },
    twitch:    { label: "Twitch",           server: "rtmp://live.twitch.tv/app",
                 keyHint: "Twitch Dashboard → Settings → Stream → Primary Stream key",
                 note: "No account-eligibility hoops — keys are long-lived." },
    kick:      { label: "Kick",             server: "rtmps://fa723fc1b171.global-contribute.live.kick.com:443/live",
                 keyHint: "Kick Dashboard → Streaming → Stream key",
                 note: "Kick uses RTMPS; the preset is current — if Kick rotates it, use Custom." },
    custom:    { label: "Custom RTMP",      server: "",
                 keyHint: "Full server URL from your provider",
                 note: "Paste the server URL exactly as the platform shows it, plus the key." }
  };

  const MASK = "••••••••";

  function trimKey(k) { return String(k == null ? "" : k).trim(); }

  /* Build the full publish URL for a destination row. Understands the
     classic mistake — pasting a whole rtmp URL where the key belongs. */
  function buildUrl(platform, key, customServer) {
    var p = PLATFORMS[platform] || PLATFORMS.custom;
    var k = trimKey(key);
    if (!k) return "";
    if (/^rtmps?:\/\//i.test(k)) return k;                 /* full URL pasted as key — accept it verbatim */
    var server = String(platform === "custom" ? (customServer || "") : (customServer || p.server)).trim();
    if (!server) return "";
    k = k.replace(/\s+/g, "");   /* keys never contain whitespace; strip pasted wraps.
                                    NOT encodeURIComponent: platforms match keys
                                    verbatim and keys may legally contain '=' */
    return server.replace(/\/+$/, "") + "/" + k;
  }

  /* Reverse of buildUrl: recognise a saved/legacy full URL back into
     {platform, server, key} so nothing a teacher already saved is lost. */
  function parseUrl(url) {
    var u = String(url == null ? "" : url).trim();
    /* The SERVER is everything up to the LAST slash (it may include an
       app path like YouTube's /live2); the KEY is the segment after it. */
    if (!/^rtmps?:\/\//i.test(u)) return null;
    if (u.lastIndexOf("/") <= u.indexOf("/", u.indexOf("://") + 3)) return null;
    var cut = u.lastIndexOf("/");
    var server = u.slice(0, cut), key = u.slice(cut + 1);
    if (!server || !key) return null;
    var platform = "custom";
    Object.keys(PLATFORMS).forEach(function (id) {
      if (id === "custom") return;
      if (PLATFORMS[id].server && PLATFORMS[id].server.replace(/\/+$/, "") === server) platform = id;
    });
    var plain = key;
    try { plain = decodeURIComponent(key); } catch (e) {}
    return { platform: platform, server: server, key: plain };
  }

  function maskKey(k) {
    var v = trimKey(k);
    if (!v) return "";
    if (v.length <= 6) return MASK;
    return MASK + v.slice(-4);
  }

  /* Preflight validation. Returns [{level:'error'|'warn', platform, msg}] */
  function validateDestinations(dests, opts) {
    var out = [];
    var o = opts || {};
    var pageSecure = o.pageSecure !== false;   /* https:// page by default */
    var format = o.format || "landscape";
    var seen = {};
    (dests || []).forEach(function (d) {
      var p = d.platform || "custom";
      if (!trimKey(d.key)) {
        out.push({ level: "error", platform: p, msg: (PLATFORMS[p] || PLATFORMS.custom).label + ": paste a stream key." });
        return;
      }
      if (/^rtmps?:\/\//i.test(trimKey(d.key)) && p !== "custom") {
        out.push({ level: "warn", platform: p, msg: (PLATFORMS[p] || PLATFORMS.custom).label + ": that looks like a full URL in the KEY box — paste only the key." });
      }
      if (p === "custom" && !String(d.server || "").trim()) {
        out.push({ level: "error", platform: p, msg: "Custom destination: paste the full server URL." });
      }
      if (seen[p]) out.push({ level: "warn", platform: p, msg: (PLATFORMS[p] || {}).label + " is added twice — the relay will publish to the first URL only." });
      seen[p] = true;
    });
    if (p_isTikTok(dests) && format === "landscape") {
      out.push({ level: "warn", platform: "tiktok", msg: "TikTok fills only the middle of a landscape frame — choose the Vertical format for TikTok." });
    }
    if (pageSecure && o.gateway && /^http:\/\//i.test(String(o.gateway))) {
      out.push({ level: "error", platform: "relay", msg: "The relay gateway URL is http:// but this page is https:// — the browser will block the call. Use an https:// gateway." });
    }
    return out;
  }
  function p_isTikTok(dests) { return (dests || []).some(function (d) { return d.platform === "tiktok"; }); }

  /* fetch that can never hang */
  function fetchWithTimeout(url, opts, ms) {
    var ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, ms || 12000) : null;
    var o = Object.assign({}, opts || {});
    if (ctrl) o.signal = ctrl.signal;
    return fetch(url, o).finally(function () { if (t) clearTimeout(t); });
  }

  /* Relay health probe — GET {gateway}/health with the shared secret. */
  async function probeHealth(gateway, secret, ms) {
    try {
      var res = await fetchWithTimeout(String(gateway || "").replace(/\/+$/, "") + "/health",
        { headers: { "x-relay-secret": secret || "" } }, ms || 8000);
      var text = await res.text();
      return { ok: res.ok, status: res.status, text: text.slice(0, 200) };
    } catch (e) {
      return { ok: false, status: 0, text: (e && e.name === "AbortError") ? "timed out" : (e.message || "unreachable") };
    }
  }

  /* Reconnect backoff: attempt 0 → 1000ms, then ×2, capped at 30000. */
  function reconnectDelay(attempt) {
    var a = Math.max(0, Number(attempt) || 0);
    return Math.min(1000 * Math.pow(2, a), 30000);
  }

  /* Honest encoder guidance for mobile/tablet uploads. */
  function bitrateHint(format, fps) {
    var f = Number(fps) || 15;
    if (format === "vertical") return f >= 24 ? "≈ 2.5–4 Mbps upload recommended (720×1280 @ " + f + " fps)" : "≈ 1.5–2.5 Mbps upload recommended (720×1280 @ " + f + " fps)";
    return f >= 24 ? "≈ 4–6 Mbps upload recommended (1280×720 @ " + f + " fps)" : "≈ 2.5–4 Mbps upload recommended (1280×720 @ " + f + " fps)";
  }

  /* Live clock helper: mm:ss / h:mm:ss from a start timestamp. */
  function elapsed(sinceMs, nowMs) {
    var s = Math.max(0, Math.floor(((nowMs || Date.now()) - sinceMs) / 1000));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    var mm = (m < 10 ? "0" : "") + m, ss = (sec < 10 ? "0" : "") + sec;
    return h > 0 ? h + ":" + mm + ":" + ss : mm + ":" + ss;
  }

  return {
    PLATFORMS: PLATFORMS, buildUrl: buildUrl, parseUrl: parseUrl,
    maskKey: maskKey, validateDestinations: validateDestinations,
    fetchWithTimeout: fetchWithTimeout, probeHealth: probeHealth,
    reconnectDelay: reconnectDelay, bitrateHint: bitrateHint, elapsed: elapsed
  };
})();
