# 🚀 HMG ACADEMY CLASS DECK — Complete Deployment Guide (Final)

**Goal:** get the fixed, complete platform live on a free host, and understand exactly how to deploy client decks from the generator.

> ⚠️ **Before you begin:** your live site + GitHub are still serving the OLD buggy files.
> This guide uses the **final** files. **Delete/replace old files, do not merge**, otherwise the
> broken `teach.html` (missing `-->` comment) and missing `js/config.js` will come back.

---

## PART A — Deploy YOUR HMG ACADEMY CLASS DECK (your own platform)

### A1. Get the final files
Use the `CLASS_DECK_PACKAGE/HMG-ACADEMY-CLASSDECK/` folder (or `classdeck-two-folder-package.zip`, extract the `HMG-ACADEMY-CLASSDECK/` folder). It contains everything: HTML, css/, js/ (incl. `config.js`, `license.js`, `enhancements.js`, `generator.js`), vendor/, assets/, sw.js, manifests, vercel.json, `_headers`, docs.

### A2. Push to GitHub
1. https://github.com/new → create a repo (e.g. `hmgacademyclassdeck`).
2. **Delete all existing files in the repo first** (the web UI lets you delete; or `git rm -r .` then commit).
3. Upload **every** file/folder from `HMG-ACADEMY-CLASSDECK/` preserving the structure (keep `js/config.js`!).
4. Commit to `main`.

### A3. Deploy — pick ONE (all free)
**Vercel (recommended)**
1. https://vercel.com → sign in with GitHub → **Add New → Project** → import your repo.
2. Framework Preset: **Other** · Root Directory: **./** · Build Command: *(none)* · Output: **./**
3. Deploy. Live at `https://<project>.vercel.app`.

**Netlify** — https://app.netlify.com/drop → drag the `HMG-ACADEMY-CLASSDECK` folder → live.
**Cloudflare Pages** — Dashboard → Pages → Connect to Git → Framework: **None** → Deploy.
**GitHub Pages** — Repo → Settings → Pages → Source: **Deploy from branch** → `main` → `/ (root)` → Save.

### A4. Sign in as the founder
Open `teach.html` on your live site → **Create account**:
- Full name: anything (e.g. Adewale Samson Adeagbo)
- Email: `buildingmyictcareer@gmail.com`
- Password: `Walex@28120215`
- Phone: your number

You'll see the 👑 **lifetime** badge — the platform never expires for you. To use different credentials, edit `js/config.js` → `window.HMG_OWNER` and redeploy (committed to GitHub).

### A5. Post-deploy checklist
- [ ] `teach.html` shows the auth gate; owner sign-up unlocks the studio.
- [ ] All top-bar buttons work: 🔗 Invite, ▶ Go Live/⏹ End, 📷, 🎙, ⏺ Rec, ▣ PiP, 👥, 💬, 📊, 🏆, 🎨, 🧩, 🧮, ⏱, ◫, ⇄, 🎯, 📚, ⛶, ⚙.
- [ ] Settings → set a **Custom room code** → the Room label, invite link and QR update immediately.
- [ ] `teach.html?room=MYCODE` and `teach.html?rec=1` deep links work.
- [ ] ⏺ Rec opens the **HMG Recording Studio**; recordings begin with the branded intro and end with the outro.
- [ ] Students open the invite link on a phone and join.
- [ ] Install banner appears on index/teach/join and PWA installs.
- [ ] Companion modes: `?meet=1`, `?companion=zoom#zoom`, `?companion=teams#teams`, `?companion=freeconf#freeconf`.

---

## PART B — Deploy the CLASSDECK GENERATOR (your internal tool)

1. Push the `CLASS_DECK_PACKAGE/CLASSDECK-GENERATOR/` folder to its own repo (or keep it on the same site under `/generator/`).
2. Deploy the same way as Part A (Vercel/Netlify/Cloudflare/GitHub Pages, static).
3. Open `generate.html`:
   - Step 1 Brand → Step 2 Design + **💰 Billing model** → Step 3 Contact/Social → Step 4 Features → Step 5 Generate.
   - Download the ZIP: it contains **two folders** — `<CLIENT>-CLASSDECK/` and `CLASSDECK-GENERATOR/`.

---

## PART C — Deploy a CLIENT ClassDeck (built by the generator)

1. Extract the `<CLIENT>-CLASSDECK/` folder.
2. Push to a **new** GitHub repo (delete any old files first).
3. Deploy (Vercel/Netlify/Cloudflare/GitHub Pages — same static steps as A3).
4. Open it: the client's brand/logo/colors/socials are baked in. The license engine (`js/license.js`) enforces the billing model chosen at build:
   - **Lifetime** → never locks.
   - **Subscription** → 30-day renewal reminder → grace banner → lock screen with renewal link until renewed.
5. The generated client deck **cannot** use the HMG founder account (owner is disabled on client builds) — clients use the normal trial → license-key flow.

---

## PART D — 1000-student / recording / streaming quick answers

| Need | How (free) |
|---|---|
| Live class 200+ students | Stream the same canvas to **YouTube Live**; share the YouTube link (unlimited viewers). The Students drawer shows this banner automatically at 200+. |
| Recording + live at the same time | Press ▶ Go Live and ⏺ Rec together — one composite canvas feeds both. |
| Recording interrupted by crash | Chunks are mirrored to IndexedDB; on reload you get a **Recover recording** prompt. |
| Stream to TikTok/Instagram/FB/YT from a tablet | Settings → 📡 Tablet Live → relay URL + RTMP destinations (see `stream.html` and `relay/no-obs-social-relay/`). |
| Teach on Zoom/Teams/FreeConference | Use the companion URLs in Part A5. |

---

## PART E — Security & maintenance

- **Change license secret for a production deployment:** edit `js/auth.js` `AUTH_SECRET` (and the matching secret on `admin.html`) — or deploy the Cloudflare Worker gateway (`security/license-gateway-worker/`) and set it in `js/security-config.js`.
- **Revoke leaked keys:** add them to `revoked.json` and push — every install blocks them within minutes.
- **Back up teacher data:** Settings → Backup everything (one JSON); restore from the same screen.

---

## PART F — Final checklist before launch
- [ ] HMG deck deployed and founder login works
- [ ] Generator deployed and builds a client ZIP with two folders + billing
- [ ] All top-bar buttons functional (verified by automated 21-step test)
- [ ] Branded recording intro/outro/lower-thirds/ads render
- [ ] Crash-safe recovery prompt appears after a forced close during recording
- [ ] PWA install banner on all three key pages
- [ ] Companion modes for Meet/Zoom/Teams/FreeConference
- [ ] Custom room code + `?room=` + QR + PIN all reflect the same code

*HMG ACADEMY CLASS DECK — Learning Deliberately. Teaching Authentically.*  
*Part of the HMG Concepts Ecosystem: Academy · Technologies · Media · Gospel.*  
*No AI APIs · No paid servers · Free tools only.*
