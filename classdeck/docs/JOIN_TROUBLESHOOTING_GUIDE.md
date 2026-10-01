# ClassDeck — Join Troubleshooting & Relay Setup Guide (v13.1)

**Who this is for:** the teacher. Everything here is free. No servers to rent,
no credit card, no command line required (one optional command is included for
completeness).

---

## 1. Why a student can be stuck while you are LIVE

ClassDeck is **peer-to-peer**: every student's device connects directly to
yours. Two devices on the *same Wi-Fi/hotspot* always find each other (that is
why your own tests worked). A student on **mobile data or another network**
must cross their carrier's NAT — and some mobile networks simply have no
direct path. The fix is a **TURN relay**: a neutral server both sides can
reach, which passes the class through.

Since v11 the student's screen tells the **truth** ("your network could not
reach the teacher's device…") instead of the false "class hasn't started", and
you get a "📶 n blocked" badge + toast on the teacher screen. Since v12 you can
also **test the relay before class** (section 5) and **generate Cloudflare
credentials inside the app** (section 3).

> Even with **no relay at all**, most students join fine: ClassDeck tries four
> free STUN servers + three OpenRelay TURN ports, retries automatically with
> jittered timing, and the connection doctor runs after two failed attempts.
> A relay is the *guarantee* for the strictest networks, not a requirement.

### What changed in v13 — hotspot Wi-Fi students

Round-5 field reports showed the exact split: students on **mobile data**
joined fine, but students on a **phone-hotspot Wi-Fi with no data of their
own** failed. Those networks block UDP outright (some also inspect and
throttle packets). v13 ships three fixes, all automatic, all free:

1. **TCP and TLS relay entries are now built in** — OpenRelay TURN over
   port 80 TCP, port 443, and TURN-over-TLS on 443 (`turns:`). These ports
   look like ordinary web traffic, so hotspot firewalls and DPI let them
   through. Nobody has to configure anything.
2. **Adaptive retry** — if the first join attempt fails, the student's page
   automatically retries with **TCP/TLS tried first** (`window.__cdPreferTcp`)
   and says so on screen ("retrying over web-friendly ports…"). The teacher
   does nothing; the student just presses Join again if even told to.
3. **20-second handshake window + bigger candidate pool** — hotspot NATs are
   slow to open; the join no longer gives up before they finish.

In short: **mobile data and hotspot Wi-Fi both work without setting up a
relay server.** Sections 2–5 below remain for teachers who want the
 belt-and-braces guarantee of their own relay on the strictest networks.

### v13.1 — the device now remembers the route that worked

The student's phone stores which transport finally got them into class
(`ice_pref`). A student whose first class needed the TCP/TLS route starts
every later class on it automatically — no failed first attempt, no
waiting: the join simply works first-try. The memory is written only from
clear evidence (a real network block followed by a TCP-first success), so
a healthy network is never pushed onto the relay, and any clean first-try
join heals a stale entry. Mid-class auto-reconnect uses the same memory
and escalates to TCP-first after one failed attempt. Nothing to configure;
nothing to renew.

---

## 2. The 60-second setup (recommended: Cloudflare)

Cloudflare's TURN free tier is **1,000 GB per month** — enough for months of
teaching, because only the students whose networks block the direct path use
it. STUN is unlimited and free.

1. **Create the key (one time, ~2 minutes).**
   - Go to <https://dash.cloudflare.com> and log in (create a free account if needed).
   - In the left rail open **Realtime** (or *Calls* → *TURN*; the dashboard
     renames it occasionally — search "TURN" in the dashboard search box).
   - Open **TURN** → **Create TURN key**. Name it `classdeck`.
   - You now see a **TURN Token ID** (long hex) and an **API token**.
     *That pair is a KEY — it is NOT a username/password and pasting it will
     not work.* This is exactly the trap in the old guide; v12 handles it:
2. **Generate credentials inside ClassDeck (no command line).**
   - Teacher screen → **⚙ Settings → Relay servers** → open
     **“⚡ Have a Cloudflare TURN key?”**.
   - Paste the **TURN Token ID** and the **API token**, pick a validity
     (24 hours is the sweet spot), press **⚡ Generate & fill**.
   - ClassDeck calls Cloudflare from your browser (the endpoint allows
     browser calls — verified) and fills the relay box with real
     credentials. Press **Save**.
3. **Prove it works:** press **🧪 Test relay** (section 5). Green means
   students on the strictest networks can get through.
4. **Expiry:** the credentials die after the validity you chose. When joins
   start failing again after a day/week, reopen Settings and press
   **Generate & fill → Save** again. Keep the API token secret.

**Manual fallback** (if your network blocks the generator): run this once and
paste the whole response into the relay box — it is already in a format
ClassDeck understands:

```bash
curl https://rtc.live.cloudflare.com/v1/turn/keys/PASTE_TOKEN_ID_HERE/credentials/generate-ice-servers \
  --header "Authorization: Bearer PASTE_API_TOKEN_HERE" \
  --header "Content-Type: application/json" \
  --data '{"ttl": 86400}'
```

---

## 3. Backup option: metered.ca (free 5 GB/month)

Useful as a second relay or if you dislike Cloudflare:

1. Go to <https://metered.ca/stun-turn> → **Get Started** (free account).
2. Dashboard → **“Click here to generate your first credential”**.
3. Click **Instructions** — you get a JSON block like:

```json
{ "urls": ["turn:standard.relay.metered.ca:80", "turn:standard.relay.metered.ca:443"],
  "username": "e8f4…", "credential": "kY9…" }
```

4. Paste that **whole block** into ⚙ Settings → Relay servers → **Save**.
   v12 accepts it exactly as copied — no editing, no reformatting.
5. 5 GB covers roughly 8–10 hours of *relayed* video (only blocked students
   use it), so watch the usage meter on their dashboard in a heavy month.

---

## 4. What you can paste into the relay box (v12 accepts ALL of these)

| You pasted | Accepted? |
|---|---|
| `[ {"urls":"turn:host:443","username":"a","credential":"b"} ]` | ✅ classic array |
| `[ {"urls":["turn:host:443","turns:host:443"],"username":"a","credential":"b"} ]` | ✅ urls as array |
| `{ "urls":["turn:host:443"], "username":"a", "credential":"b" }` | ✅ metered.ca single object |
| `{ "iceServers":[ … ] }` | ✅ Cloudflare response / config.js style |
| `[ {"url":"turn:host:443"} ]` | ✅ legacy `url` key |
| `turn:host:443\|user\|pass` (one per line, or comma-separated) | ✅ plain text |
| `stun:host:3478` alone | ✅ (but STUN alone cannot beat strict NATs) |
| `{"tokenId":"…","apiToken":"…"}` | ⚠ recognised as a **Cloudflare key** — use the generator (section 2) |
| anything else | ❌ refused with an explanation, nothing is saved |

The box gives **live feedback as you type** (server count, provider detected,
warnings), so you know it is right *before* saving.

---

## 5. Test relay — prove it before class

⚙ Settings → Relay servers → **🧪 Test relay**. ClassDeck opens a
relay-only WebRTC connection using **only your pasted servers** and tries to
gather relay candidates for up to 8 seconds:

- **✅ RELAY WORKS — n candidates gathered** → you are covered. Save.
- **❌ NO relay candidates** → wrong/expired credentials, or your current
  network blocks TURN: regenerate (Cloudflare) or re-copy (metered.ca),
  then test again — ideally from the network you actually teach from.

---

## 6. Teaching hundreds of students

A browser-to-browser star grows with every student: past ~12 video students a
phone/tablet uplink starts to strain, and past ~300 connections any browser
struggles. v12 gives you the tools, all free:

1. **🛡 Class relay (captains)** — ⚙ Settings → “Large classes”. ClassDeck
   auto-picks your best-connected students (measured, via health pings 📶)
   as *captains*; each captain's device re-delivers the video to a small
   group. Your upload stays at captain-count streams whether 20 or 200
   students are watching. Chat, polls, boards and hands still flow directly
   from you. Captains see a thank-you badge; if a captain leaves, their
   group is re-homed automatically in seconds.
2. **Maximum students** — an honest cap (default 300). Student 301 sees
   “The class is full — a place frees up when someone leaves”, and their
   page auto-joins the moment a seat opens. No silent failures.
3. **Join jitter** — when a whole class opens the link at once, retries are
   spread ±15% so 200 students never hit the signalling server as one wave.
4. For 300+ cohorts, run two rooms (e.g. `MATH101A` / `MATH101B`) — one
   teacher device per room.

---

## 7. Student-side fixes (what to tell them)

| Student sees | Cause | Fix |
|---|---|---|
| “Your network could not reach the teacher's device…” | in-app browser / strict NAT | Tap **🌐 Open in browser** on that screen; or switch to mobile data / another Wi-Fi |
| “not live right now (or the code is wrong)” | class truly not live / typo | Check the room code with the teacher; page keeps retrying |
| “The class is full” | room at its cap | Keep the page open — auto-joins when a seat frees |
| 🔎 Connection doctor box appears | 2 failed attempts | Read the verdict — it names which side is blocked and the exact fix |
| Joined but no video after a captain left | captain re-homing (takes seconds) | Wait ~10s; the page reconnects automatically |

---

## 8. Quick reference

- Relay priority: **teacher's Settings → Relay** → `window.CD_RELAY`
  (js/config.js) → built-in free servers (Google STUN ×2, Cloudflare STUN,
  metered STUN, OpenRelay TURN ×3).
- Free tiers (as of Sep 2026): Cloudflare TURN **1,000 GB/month** · metered.ca
  **5 GB/month** · OpenRelay best-effort, no account.
- Full feature/fix registry: `docs/PROMPT_AUDIT.md`.
