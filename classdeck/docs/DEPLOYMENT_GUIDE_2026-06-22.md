# ClassDesk Deployment Guide (Clear, Step-by-Step)

This guide assumes you want the updated `classdesk/` package deployed to GitHub and then to Vercel / Cloudflare Pages / GitHub Pages.

---

## A. Before deployment

### 1. Use the packaged folder
Deploy the contents of the `classdesk/` folder, not the old working copy.

### 2. Optional but strongly recommended security step
Open:
- `js/auth.js`

Change:
- `const AUTH_SECRET = "CHANGE-ME-HMG-2026";`

to your own long private phrase if you will still rely on local fallback licensing.

Example:
```js
const AUTH_SECRET = "HMG-ACADEMY-CLASSDESK-PRIVATE-2026-USE-A-LONG-UNGUESSABLE-PHRASE";
```

### 3. If using the optional Cloudflare Worker license gateway
Open:
- `js/security-config.js`

Set:
- `licenseGateway`
- `licenseMode`

Example:
```js
window.HMG_SECURITY = {
  licenseGateway: "https://classdeck-license.yourname.workers.dev",
  licenseMode: "strict",
  leaseMinutes: 30,
  heartbeatMinutes: 5,
  appName: "HMG ACADEMY CLASS DECK",
  supportWhatsApp: "https://wa.me/2348100866322"
};
```

If you are not ready for the worker yet, leave it empty and the app will still work in hybrid/local mode.

---

## B. Validate locally before uploading

From the project root run:

```bash
bash scripts/validate.sh
```

You should see:

```bash
ALL CHECKS PASSED ✔
```

---

## C. Upload to GitHub

### Option 1 — create a new repo from the packaged folder

```bash
cd classdesk
rm -rf .git
git init
git add .
git commit -m "ClassDesk hardening release 2026-06-22"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

### Option 2 — update your existing repository

If you already have the target repo:

1. Back up the current repo.
2. Replace its contents with the files from `classdesk/`.
3. Commit and push.

```bash
git add .
git commit -m "Fix lobby issue, add diagnostics, security hardening, collaborate board"
git push
```

---

## D. Deploy to Vercel

### Method 1 — import from GitHub
1. Go to **vercel.com**
2. Log in
3. Click **Add New Project**
4. Import your GitHub repository
5. Framework preset: **Other** / static
6. Build command: leave empty
7. Output directory: leave empty or `/`
8. Deploy

### Method 2 — Vercel CLI

```bash
npm i -g vercel
cd classdesk
vercel
```

When asked:
- link to existing project? choose appropriately
- output directory: `.`

After first deploy:

```bash
vercel --prod
```

---

## E. Deploy to Cloudflare Pages

1. Go to **Cloudflare Dashboard**
2. Open **Workers & Pages**
3. Click **Create application**
4. Choose **Pages**
5. Connect your GitHub repo
6. Build settings:
   - Framework preset: **None**
   - Build command: leave blank
   - Build output directory: `/`
7. Click **Save and Deploy**

### Optional headers support
Your repo already includes `_headers`, which Cloudflare Pages can use for security/caching rules.

---

## F. Deploy to GitHub Pages

1. Push the repo to GitHub
2. Open the repo on GitHub
3. Go to **Settings → Pages**
4. Under **Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: `main`
   - Folder: `/ (root)`
5. Save
6. Wait for the published URL

---

## G. Post-deployment classroom test

Do these tests immediately after deployment.

### 1. Teacher test
- Open `teach.html`
- Verify room code shows
- Verify waiting-room button clearly shows ON/OFF state
- Click **Go Live**
- Open **Invite**
- Confirm the modal says whether students join directly or stay in the waiting room

### 2. Student join test
Test with at least three devices:
- Android Chrome
- iPhone Safari
- Laptop Chrome/Edge

Use the invite link.

Check:
- diagnostics box appears;
- student can join;
- if waiting room is ON, teacher sees the pending badge and can admit;
- if waiting room is OFF, student joins directly.

### 3. Security test
- Turn on **Secure invite**
- Copy normal join link without token and verify it fails
- Copy secure invite link and verify it works
- End class, start again, and verify a fresh secure session token is used

### 4. Captions test
- Start live captions on teacher side
- Confirm the caption banner appears on the student side

### 5. Collaborate board test
- Open **Activities**
- Choose **Collaborate board**
- Send a prompt
- Submit from student devices
- Confirm sticky-note style responses render

---

## H. If students still cannot join

Use this exact checklist:

### Teacher side
- Did you click **▶ Go Live**?
- Is the invite modal showing **Waiting room ON**?
  - If yes, open **👥 Students** and admit them.
- Is your site the deployed **https://** URL, not a local file?
- Did you set a PIN? If yes, did the students type it correctly?
- Is **Secure invite** enabled? If yes, did they use the full secure link?

### Student side
- Are they opening the link inside WhatsApp/Instagram/Facebook/TikTok in-app browser?
  - Tell them to open it in Chrome, Edge or Safari.
- Are they online?
- Does the diagnostics box show WebRTC support?

### Network side
- Try mobile data if school Wi-Fi is strict.
- Restrictive firewalls can block WebRTC.

---

## I. Updating later

Whenever you change files:

1. Update code
2. Bump version metadata if needed:
   - `version.json`
   - `sw.js` cache version if shell files changed
3. Run:

```bash
bash scripts/validate.sh
```

4. Commit and push
5. Hosting platform redeploys automatically

---

## J. Recommended production stack for your use case

### Minimum free-tier stack
- GitHub repo
- Vercel or Cloudflare Pages
- Public PeerJS cloud broker
- OpenRelay TURN

### Better protected free-tier stack
- GitHub repo
- Cloudflare Pages
- Cloudflare Worker license gateway
- Optional self-hosted PeerJS broker later if needed

---

## K. Final note

This package is designed to remain:
- static-site friendly;
- low-cost/free-tier compatible;
- installable as a PWA;
- non-AI-API dependent;
- suitable for SaaS-style teacher licensing with optional free Cloudflare hardening.
