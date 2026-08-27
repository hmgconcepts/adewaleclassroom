# 🚀 HMG ACADEMY CLASS DECK (v9) — Deployment Guide (step by step, free tools only)

> v9 note: deployment is identical to earlier versions — it is still a pure static site
> with no build step. If you already deployed an earlier version, just push
> these files over the old ones (CACHE_VERSION in `sw.js` is already bumped to
> v9.0.0 so installed apps auto-update). Suggested repo: `hmgacademyclassdeck`
> (same repo, new commit) or `hmg-classdeck-v9` to keep versions side-by-side.

This guide assumes **zero prior DevOps experience**. Follow it top-to-bottom once;
future updates take under a minute.

> **Golden rule:** the platform MUST be served over **HTTPS**.
> Camera, microphone, screen wake-lock, clipboard and the service worker are
> blocked by browsers on plain `http://`. Every option below provides free HTTPS
> automatically — do not try to host it on a plain-HTTP server.

---

## Part 0 — What you need

| Item | Cost |
|------|------|
| The `classdesk/` folder (this enhanced project) | free |
| A GitHub account → <https://github.com/signup> | free |
| (Option A) A Cloudflare account → <https://dash.cloudflare.com/sign-up> | free |
| Git installed on a PC, **or** just a browser (upload method below needs no Git) | free |

---

## Part 1 — Put the code on GitHub

### Method 1A: Browser only (no Git installed — easiest from a tablet/PC)

1. Log in to GitHub → click the **+** (top-right) → **New repository**.
2. Repository name: `hmg-classdeck` (any name works). Visibility: **Public**
   (required for free GitHub Pages; Cloudflare Pages works with private too).
3. Click **Create repository**.
4. On the new repo page click **uploading an existing file**.
5. Drag **the CONTENTS of the `classdesk` folder** (`index.html`, `teach.html`,
   `join.html`, `stream.html`, `sw.js`, `manifest.webmanifest`, and the `css/`, `js/`, `vendor/`, `assets/`,
   `docs/` folders) into the upload box.
   ⚠ Upload the *contents*, not the folder itself, so `index.html` sits at the
   repository root. (If you upload the folder itself, see “Subfolder note” below.)
6. Scroll down → commit message: `HMG ClassDeck v9.0` → **Commit changes**.

### Method 1B: With Git (PC / Termux)

```bash
cd classdesk
git init
git add .
git commit -m "HMG ClassDeck v9.0"
git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/hmg-classdeck.git
git push -u origin main
```
When asked for a password, use a **Personal Access Token**
(GitHub → Settings → Developer settings → Personal access tokens → Generate new
token → tick `repo`), not your account password.

---

## Part 2 (Option A, recommended) — Deploy on **Cloudflare Pages**

Why recommended: you already use `*.pages.dev` for your brand sites, it is fast
in Nigeria/Africa, unlimited bandwidth on the free plan, and gives instant HTTPS.

1. Go to <https://dash.cloudflare.com> → log in.
2. Left sidebar: **Workers & Pages** → **Create** → **Pages** tab →
   **Connect to Git**.
3. Click **Connect GitHub**, authorize Cloudflare, pick the `hmg-classdeck` repo.
4. Configure the build:
   - **Project name:** `hmgclassdeck` → your URL becomes `https://hmgclassdeck.pages.dev`.
   - **Production branch:** `main`
   - **Framework preset:** `None`
   - **Build command:** *(leave completely empty)*
   - **Build output directory:** `/`
     - **Subfolder note:** if your repo contains the `classdesk` folder rather
       than its contents, set Build output directory to `classdesk` instead.
5. Click **Save and Deploy**. Wait ~30–60 seconds.
6. Open `https://hmgclassdeck.pages.dev` — you should see the landing page.

**Updates from now on:** just push/upload changed files to GitHub →
Cloudflare auto-redeploys in under a minute. Remember to bump `CACHE_VERSION`
in `sw.js` whenever you change code so installed apps pick up the update.

**Custom domain (optional, still free if you own a domain):**
Pages project → **Custom domains** → **Set up a custom domain** → e.g.
`class.hmgacademy.com` → follow the DNS instructions.

---

## Part 3 (Option B) — Deploy on **GitHub Pages**

1. Open your repo on GitHub → **Settings** (top tab) → **Pages** (left sidebar).
2. Under **Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: **main**, folder **/(root)** → **Save**.
   - **Subfolder note:** GitHub Pages can only serve `/root` or `/docs`. If your
     repo has a `classdesk/` subfolder, either move the files to the root, or
     rename the folder to `docs` and select `/docs`.
3. Wait 1–2 minutes; refresh the Pages settings page — it shows:
   `Your site is live at https://<username>.github.io/hmg-classdeck/`
4. Test the link. HTTPS is automatic.

---

## Part 4 — Other free options (alternatives)

| Host | How |
|------|-----|
| **Netlify** | <https://app.netlify.com/drop> → drag the `classdesk` folder into the page → done (no Git needed at all). Free subdomain + HTTPS. |
| **Vercel** | vercel.com → New Project → import the GitHub repo → Framework: Other → Deploy. |
| **Render (static site)** | render.com → New → Static Site → connect repo → publish directory `/`. |

All behave identically because ClassDeck is a pure static site (no build step,
no server code, no database).

---

## Part 5 — Install it on your itel Vista Tab 30s (PWA)

1. Open your deployed URL in **Chrome** on the tablet.
2. Chrome menu (⋮) → **Add to Home screen** → **Install**.
   (If you see an “Install app” banner or the ⬇ Install button on the landing
   page, use that instead.)
3. Launch **ClassDeck** from the home screen — it opens full-screen, standalone,
   with no browser bars. The app shell now also works offline.
4. Tell students they can do the same with the join link, but installing is
   optional for them — the link works in any browser.

---

## Part 5b — Google Meet Companion setup (v2, do this once)

1. Install ClassDeck as a PWA (Part 5).
2. Long-press the ClassDeck home-screen icon → you should see the shortcut
   **“Teach on Google Meet”**. (If shortcuts don't appear on your launcher,
   just open ClassDeck → tap the green **Teach on Google Meet** card.)
3. Dry-run before a real class:
   - ☐ Start a Meet meeting with yourself (second device or a friend).
   - ☐ In Meet: **Share screen → Share entire screen** → Start.
   - ☐ Press the recent-apps/home button, open **ClassDeck (Meet Companion)**.
   - ☐ Confirm on the second device that the whiteboard + PDF are visible.
   - ☐ Tap **🎯 Focus** — confirm toolbars disappear and the floating ☰ + mini
        capsule work; write something; flip a board page from the capsule.
   - ☐ Write for 5+ minutes and scroll the PDF — confirm Meet keeps sharing
        and never logs you out (it will: only one app is on screen now).
4. Tips for smooth Meet sharing on the itel Vista Tab 30s:
   - Close other apps before class (recent-apps → clear all except Meet + Chrome/ClassDeck).
   - Keep the tablet plugged in; screen sharing + wake-lock uses battery.
   - In Meet, turn **off** your camera while sharing if the network is weak —
     the screen share gets the bandwidth.

---

## Part 6 — First-class checklist (built-in classroom mode)

1. ☐ Open **Teacher Studio** on the tablet; confirm whiteboard writes smoothly.
2. ☐ Open a PDF in the right pane; drag the divider; tap ◫ and ⇄.
3. ☐ Tap **▶ Go Live** → **allow microphone** when Chrome asks.
4. ☐ Tap **🔗 Invite** → open the link on a second device (a phone) → join as
   “Test Student”. Confirm the student sees your full split screen and hears you.
5. ☐ Tap **📷 Cam** → confirm the student sees your face in the corner PiP.
6. ☐ On the phone: raise hand ✋, send a chat 💬, share camera 📷 → confirm they
   appear in your 👥 Students drawer.
7. ☐ Run a test **📊 poll** and a **⏱ 1-min timer**.
8. ☐ Tap **⏺ Rec** for 30 s, stop, and check the `.webm` plays.
9. ☐ Tap **⏹ End** and download the 📋 attendance CSV.

If anything fails on step 3–5, check: HTTPS URL? Camera/mic permissions
(Android Settings → Apps → Chrome → Permissions)? Both devices online?

---

## Part 7 — Updating the platform later

1. Edit the files (locally or directly on GitHub with the ✏ pencil icon).
2. **Open `sw.js` and bump the version**, e.g.
   `const CACHE_VERSION = "hmg-classdeck-v9.0.1";`
   This forces installed apps to fetch the new files.
3. Commit/push (or “Commit changes” in the GitHub editor).
4. Cloudflare/GitHub Pages redeploys automatically. Users get the update the
   next time they open/refresh the app.

---

## Part 8 — Optional hardening (still free)

- **Self-hosted signalling:** if the public PeerJS cloud is ever unreliable,
  deploy `peerjs-server` free on Render: render.com → New → Web Service →
  repo `https://github.com/peers/peerjs-server` → start command
  `peerjs --port $PORT --path /myapp`. Then in `js/rtc.js` create peers with
  `new Peer(id, { host: "your-app.onrender.com", secure: true, path: "/myapp", config: PEER_CONFIG.config })`.
- **Better TURN:** create a free account at <https://www.metered.ca/tools/openrelay/>
  for dedicated free TURN credentials and replace the `openrelay` entries in
  `PEER_CONFIG` (`js/rtc.js`).
- **Analytics (privacy-friendly, free):** Cloudflare Web Analytics — Pages
  project → Metrics → enable. No cookies, no cost.

---

*Maintained for HMG Academy / HMG Technologies. Questions → see README.md.*

---

## Part 9 — v6: Setting up teacher licensing (SaaS)

1. **Before deploying**, open `js/auth.js` and change
   `const AUTH_SECRET = "CHANGE-ME-HMG-2026";` to your own private phrase.
   Never share it. (Anyone who knows it could mint keys.)
2. Deploy as usual. Bookmark `https://YOUR-SITE/admin.html` privately —
   it is unlisted (robots-noindex) and useless without your secret phrase.
3. Revenue flow:
   - Teacher gets a 3-day free trial automatically (no signup friction).
   - To continue, they pay your fee via Paystack/Flutterwave payment link,
     bank transfer or POS (put the details on hmgacademy.pages.dev).
   - On admin.html: type your secret + their full name + expiry month →
     generate the key → send it on WhatsApp.
   - Teacher enters name + key once in the Studio → licensed until expiry.
4. Renewal = generate a new key with a later expiry month.
5. Students NEVER pay and never see the license system.
6. Optional upgrade path (still free): move key validation into a
   Cloudflare Worker (free tier 100k req/day) so keys can be revoked
   centrally; the current offline scheme requires no servers at all.

## Part 10 — v6: CSV quiz format

Create in Excel/Google Sheets and export as CSV:

| Question | A | B | C | D | Correct option | Explanation/working |
|---|---|---|---|---|---|---|
| What is 54 ÷ 6? | 9 | 8 | 7 | 6 | A | 54 ÷ 6 = 9 because 6 × 9 = 54 |

- Correct option: A/B/C/D or 1/2/3/4.
- The explanation appears to each student immediately after they answer.
- Download a ready template with the “⬇ Sample CSV” button in the Quiz drawer.

---

## Part 11 — v7: Revoking keys & blocking accounts (free kill-switch)

1. Open `revoked.json` in your repo (GitHub web editor works).
2. Add the leaked/refunded key or email:
   `{ "keys": ["HMG-202612-ABCDE12345"], "blockedEmails": ["bad@user.com"] }`
3. Commit → your host redeploys → every installed app blocks that key/email
   the next time the Teacher Studio opens (it checks on every start; the
   result is cached for offline use).

## Part 12 — v7: Pre-deploy validation

Before every push, run:  `bash scripts/validate.sh`
It checks JS syntax, JSON validity and broken local references in one command.

## Part 13 — v7: Teachers' own recording brands

Each teacher sets their brand once in the ⏺ Record dialog (brand name, footer
credit, optional logo upload). It is stored on THEIR device and appears on all
their videos. No action needed from you as the platform owner.

---

## Part 8 — Verify the new v9 features after deployment

1. Open `https://<your-domain>/teach.html`.
2. Open **Settings → Broadcast mode**:
   - Choose **Composite** for tablet-safe teaching, or
   - Choose **Share screen** to share your full screen/window directly to ClassDeck students.
3. Tap **📡 Open centre** in Settings, or visit `https://<your-domain>/stream.html`:
   - Use **Test screen capture** to confirm your browser can capture the ClassDeck window.
   - Download **OBS setup notes** and configure OBS with your social platform stream key.
4. Start a test class:
   - Teacher: `teach.html` → **Go Live**.
   - Student: `join.html` with the room code.
5. Test captions:
   - Teacher opens 💬 Chat → **CC Live captions**.
   - Student should see caption text near the bottom of the class screen.
6. Test the noise meter:
   - Teacher opens 👥 Students → **🔊 Noise meter** → **Start meter**.
   - The meter should move and appear in the broadcast overlay.
7. Hard refresh once after deployment (`Ctrl+F5` on desktop, or clear site data on mobile) if an old PWA cache still shows the previous version.

## Part 9 — Social media streaming with free tools

ClassDeck is static and browser-based, so it does not directly push RTMP. Use this free workflow:

1. Install OBS Studio on a PC/laptop.
2. Open ClassDeck in a browser.
3. In OBS, add **Window Capture** and select the ClassDeck browser window.
4. In OBS Settings → Stream, choose the platform or **Custom RTMP**.
5. Paste the stream URL/key from YouTube/Facebook/TikTok/Instagram Live Producer.
6. For multiple platforms, use either:
   - OBS Multiple RTMP Outputs plugin, or
   - a free relay/multistream service if its free plan fits your needs.
7. Keep stream keys outside ClassDeck. Do not publish stream keys in GitHub.

---

# ClassDesk v2 deployment addendum — direct tablet social live

ClassDesk v2 contains two deployable parts:

1. **Static app** — upload the contents of `classdesk v2/` to GitHub Pages, Cloudflare Pages, Netlify, etc.
2. **Optional no-OBS relay** — deploy `relay/no-obs-social-relay/` to a Linux VM if you want direct tablet-to-social RTMP streaming without OBS.

## A. Static app upload checklist

Upload these to the repository root:

```text
index.html
teach.html
join.html
stream.html
sitemap.xml
robots.txt
sw.js
manifest.webmanifest
css/
js/
assets/
vendor/
docs/
relay/
```

`relay/` can be kept in the same GitHub repo as deployment documentation/source files. GitHub Pages will not run it; it is for a separate VM deployment.

## B. No-OBS relay deployment summary

1. Create/prepare a Linux server or free-tier VM.
2. Point a subdomain to it, for example:

```text
live.yourdomain.com
```

3. SSH to the server and install Docker.
4. Upload or clone the repository.
5. Run:

```bash
cd relay/no-obs-social-relay
cp .env.example .env
nano .env
```

6. Fill:

```text
DOMAIN=live.yourdomain.com
RELAY_SECRET=your-long-private-secret
PUBLIC_IP=your-server-public-ip
```

7. Start:

```bash
docker compose up -d --build
```

8. Test:

```bash
curl https://live.yourdomain.com/health
```

9. On the tablet:

```text
teach.html → ⚙ Settings → 📡 Tablet Live
```

10. Paste the gateway and social RTMP/RTMPS URLs, then start.

## C. SEO verification

After deployment, verify:

```text
https://your-site/sitemap.xml
https://your-site/robots.txt
```

Then submit the sitemap to Google Search Console if you want faster indexing.

---

# ClassDesk v3 deployment addendum — subscription security and PiP

## 1. Static app deployment

Upload the contents of `classdesk v3/` to the repository root. Confirm these new v3 files are included:

```text
js/security-config.js
security/license-gateway-worker/
docs/CLASSDESK_V3_SECURITY_PIP_REPORT.md
```

## 2. Deploy the optional license gateway for strongest subscription protection

A static app can be bypassed by a determined attacker if all subscription logic is only in JavaScript. To protect subscriptions on your official platform, deploy the Cloudflare Worker gateway.

```bash
cd security/license-gateway-worker
npm install -g wrangler
wrangler login
wrangler kv namespace create LICENSE_KV
cp wrangler.toml.example wrangler.toml
# paste the KV id into wrangler.toml
wrangler secret put ADMIN_SECRET
wrangler deploy
```

Copy the Worker URL and edit:

```text
js/security-config.js
```

Set:

```js
window.HMG_SECURITY = {
  licenseGateway: "https://YOUR-WORKER.workers.dev",
  licenseMode: "strict",
  leaseMinutes: 30,
  heartbeatMinutes: 5
};
```

## 3. Add a teacher license

```bash
curl -X POST https://YOUR-WORKER/api/admin/license \
  -H "content-type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d '{"key":"HMG-202612-ABCDEF1234","email":"teacher@example.com","name":"Teacher Name","expires":"2026-12-31","devices":2,"plan":"teacher","status":"active"}'
```

## 4. Block a teacher/account

```bash
curl -X POST https://YOUR-WORKER/api/admin/block \
  -H "content-type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d '{"email":"teacher@example.com","reason":"abuse/refund"}'
```

## 5. Picture-in-Picture use

No special deployment is required. Teachers tap `▣ PiP` before minimising or switching apps. Browser support varies; Chrome/Edge are recommended.
