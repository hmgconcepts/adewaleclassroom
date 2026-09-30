# 🚑 ClassDeck — "Students stuck in the lobby" troubleshooting guide (v11)

## The symptom

Students open your class link and are held in the lobby with
**"The class hasn't started yet"** — while your teacher screen says you are
LIVE and your own laptop/phone (on the same Wi-Fi/hotspot) join fine.

## Why it happens (verified diagnosis)

The classroom is **peer-to-peer (WebRTC)**. There is no server in the middle.

| Who joins | Path used | Result |
|---|---|---|
| Your own devices **on the same hotspot** as the teacher tablet | direct local-network connection | ✅ always works |
| Students **on the internet** | must cross the mobile carrier's NAT | ⚠️ needs a working STUN/TURN path |

Phone/tablet hotspots (MTN, Airtel, Glo, 9mobile) sit behind carrier-grade
NAT. When a direct path does not exist, the student's join attempt times out
and the join page used to report it as *"the class hasn't started"* — which
was **untrue**. **v11 fixes the reporting and adds a configurable relay.**

## What v11 changed

1. **Honest lobby messages.** The join page now shows the REAL reason
   (room not live / wrong code vs. *network could not reach the teacher*) plus
   an attempt counter.
2. **🔎 Connection doctor.** After two failed attempts the student's device
   tests its own network (gathers ICE candidates) and says whether the block
   is on their side, and what to do (leave WhatsApp's in-app browser, switch
   to mobile data, …).
3. **Teacher-side alerts.** When a student's connection dies before it opens,
   the teacher sees a toast and a **📶 blocked** counter — stranded students
   are never silent again.
4. **Configurable TURN relay.** ⚙ Settings → **Relay servers**.

## Fixing it for real — add a free TURN relay (10 minutes, once)

TURN is the WebRTC "relay taxi": when no direct path exists, both sides
connect to the relay instead. Free options:

**Option A — Cloudflare TURN (free, no credit card)**
1. Create a free account at <https://dash.cloudflare.com>.
2. Go to **Realtime / TURN** and create a TURN app ("one-click").
3. Copy the generated `url`, `username` and `credential`
   (time-limited credentials regenerate — create fresh ones when they expire,
   or use the static-credentials option).
4. In ClassDeck: **teach.html → ⚙ Settings → Relay servers**, paste:

```json
[ { "urls": "turn:turn.cloudflare.com:443?transport=tcp", "username": "PASTE", "credential": "PASTE" } ]
```

5. Save → start your class → have a student on another network join.

**Option B — metered.ca (free plan)**
1. Sign up at <https://www.metered.ca> (free tier includes TURN bandwidth).
2. Tools → TURN credentials → copy the RTCConfiguration JSON.
3. Paste the `iceServers` array into Settings → Relay servers.

The relay is used by **you and every student** on their next connection —
no redeploy needed. (Deployments can also bake one into `js/config.js` via
`window.CD_RELAY`.)

## Quick checklist when a student cannot join

1. **Are they inside WhatsApp/Facebook/Instagram?** Those in-app browsers
   break WebRTC. The join page detects this and shows an **Open in browser**
   button — they must use Chrome (Android) or Safari (iPhone).
2. **Wrong room code / class not actually live?** The lobby now says so
   explicitly — the message is truthful, trust it.
3. **School/office network?** Many block WebRTC entirely. Mobile data is the
   fastest test.
4. **Your network?** If your own second device joins only while on your
   hotspot, your hotspot is the restricting side → add the TURN relay above.
5. Still failing? Ask the student to read out the **🔎 Connection doctor**
   verdict — it names the blocked side precisely.
