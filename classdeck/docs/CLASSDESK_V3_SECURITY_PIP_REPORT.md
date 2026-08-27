# ClassDesk v3 — Security, Subscription Protection and Picture-in-Picture Report

Date: 2026-06-18  
Brand: HMG ACADEMY CLASS DECK / HMG Concepts  
Founder: Adewale Samson Adeagbo — AI-Augmented Solutions Developer · Data Scientist · STEM Educator · Lagos, Nigeria

## 1. Executive summary

ClassDesk v3 builds on ClassDesk v2 without removing existing features or changing the UI/UX layout direction. The major additions are:

1. Stronger subscription protection with an optional Cloudflare Worker license gateway.
2. Login rate limiting and stronger password policy.
3. Secure invite-link token option for classes.
4. Forensic broadcast watermark to discourage piracy/reselling.
5. Security audit log export.
6. Picture-in-Picture continuity preview for live/background teaching.
7. Stronger HTTP security headers.
8. Continued no-OBS tablet social live relay workflow.

## 2. Security reality for static apps

A pure static JavaScript app cannot be made impossible to bypass if someone downloads the source code, edits out the auth checks and hosts a clone. Real subscription enforcement needs a server-side authority.

Therefore ClassDesk v3 provides two layers:

- **Client-side hardening**: local gate, heartbeat, device binding, revocation list, rate limit, watermark, audit log.
- **Server-side optional strict mode**: Cloudflare Worker license gateway in `security/license-gateway-worker/`.

For the strongest protection, deploy the Worker and set `licenseMode: "strict"` in `js/security-config.js`.

## 3. New security features

### 3.1 Cloudflare Worker license gateway

Folder:

```text
security/license-gateway-worker/
```

Purpose:

- Validate subscriptions server-side.
- Start trials on the server clock, not the teacher's local clock.
- Enforce device limits.
- Block/suspend emails centrally.
- Issue short-lived entitlement leases.
- Provide admin endpoints to add licenses and block accounts.

Files:

```text
worker.js
wrangler.toml.example
README.md
```

### 3.2 Security config

File:

```text
js/security-config.js
```

Set your Worker URL here:

```js
window.HMG_SECURITY = {
  licenseGateway: "https://your-worker.workers.dev",
  licenseMode: "strict",
  leaseMinutes: 30,
  heartbeatMinutes: 5
};
```

Modes:

- `hybrid`: Worker is used when online; local license fallback remains.
- `strict`: Worker is required. Best for preventing subscription bypass on the official hosted platform.

### 3.3 Login rate limiting

After repeated wrong passwords, login is temporarily locked. This reduces brute-force attempts on teacher accounts on the same device.

### 3.4 Stronger password policy

New accounts now require at least 8 characters and both letters and numbers.

### 3.5 Secure invite link token

Location:

```text
teach.html → ⚙ Settings → Security & anti-piracy controls
```

When enabled, ClassDeck adds a secret token to the student invite link. Students who manually enter only the room code without the secure token are rejected.

This helps reduce accidental room sharing and unwanted joins.

### 3.6 Forensic watermark

When enabled, the live broadcast/recording is stamped with a faint repeated watermark containing teacher/account and room information.

Purpose:

- Discourage unauthorized recording/reselling.
- Make leaked screenshots/videos traceable.

### 3.7 Security audit CSV

Location:

```text
teach.html → 👥 Students drawer → 🛡 Audit CSV
```

Exports local security events such as:

- Studio opened.
- Class started/ended.
- Student joined/left.
- Waiting room events.
- Student media events.
- PiP started/stopped.

### 3.8 HTTP header hardening

Updated `_headers` with:

- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security`
- `Cross-Origin-Resource-Policy`
- `Permissions-Policy`
- Admin page `noindex` and `no-store`

## 4. Picture-in-Picture continuity feature

Button:

```text
▣ PiP
```

Location:

```text
Teacher Studio top toolbar, beside recording controls
```

What it does:

- Creates a live video preview from the ClassDeck composite teaching canvas.
- Opens it in browser Picture-in-Picture mode where supported.
- Keeps a small floating preview visible when the teacher switches apps/minimises.
- Starts a background composite pump to reduce canvas freezing while PiP is active.
- Adds Media Session metadata for HMG ClassDeck.

Important limitation:

Browsers require PiP to start from a user gesture. A website cannot automatically force PiP when minimized. Teachers should tap `▣ PiP` before switching away.

## 5. Similar platform research mapped to v3

| Platform feature found | Source category | ClassDesk v3 implementation |
|---|---|---|
| Waiting room, passcodes, lock meeting, restrict screen share, watermark, authentication | Zoom-style security | Already had waiting room/PIN/lock; v3 adds secure invite token, forensic watermark, gateway entitlement and audit export. |
| Lock viewer webcam/mic/chat, guest policy and protected recordings | BigBlueButton-style classroom controls | Existing mute/waiting controls retained; v3 adds stricter invite gate and watermark. |
| Role-based access, audit trails, encrypted access controls | Enterprise LMS/security platforms | v3 adds license gateway, local audit CSV, stricter headers and device-bound entitlement leases. |
| Picture-in-Picture and keep controls while app is backgrounded | Modern video/streaming apps | v3 adds PiP button using browser PiP API and canvas capture stream. |

## 6. Deployment summary

Static app:

1. Upload the contents of `classdesk v3/` to the GitHub repo root.
2. Ensure `js/security-config.js`, `security/`, `relay/`, `sitemap.xml` and `robots.txt` are included.
3. Deploy with GitHub Pages/Cloudflare Pages/Netlify.
4. Hard refresh/clear site data once.

License gateway:

1. Go to `security/license-gateway-worker/`.
2. Deploy using Wrangler.
3. Create KV namespace.
4. Set `ADMIN_SECRET`.
5. Add licenses through the admin endpoint.
6. Paste the Worker URL into `js/security-config.js`.
7. Set `licenseMode: "strict"` for best protection.

## 7. What was not removed

No existing feature was removed:

- Whiteboard.
- PDF reader.
- Browser/Reader Cast.
- Live classroom.
- Student whiteboards.
- Chat/polls/quizzes.
- Behaviour points.
- Group maker.
- Captions.
- Noise meter.
- Recording.
- Tablet social live relay.
- PWA/offline shell.

## 8. No paid AI API

No AI API was added. The security gateway uses Cloudflare Workers and KV free-tier style architecture. The no-OBS live relay uses open-source SRS/FFmpeg/Caddy/Node components.
