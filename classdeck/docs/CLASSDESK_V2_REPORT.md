# ClassDesk v2 — Expert Diagnosis, Enhancements and Deployment Guide

Date: 2026-06-18  
Brand: HMG ACADEMY / HMG Concepts  
Founder: Adewale Samson Adeagbo — AI-Augmented Solutions Developer · Data Scientist · STEM Educator · Lagos, Nigeria

## 1. What ClassDesk v2 adds

ClassDesk v2 keeps the existing HMG Academy ClassDeck UI/UX and pre-existing features, then adds the requested direct tablet broadcasting capabilities:

1. **Direct ClassDeck screen/workspace sharing** without Google Meet or Zoom.
2. **Best-effort full tablet screen sharing** where the tablet browser supports `getDisplayMedia`.
3. **No-OBS tablet social live streaming** through an included WebRTC-to-RTMP relay.
4. **Tablet Social Live Centre** at `stream.html`.
5. **SEO/search engine improvements** — canonical tags, sitemap, robots file, JSON-LD structured data and brand metadata.
6. **HMG persona and brand embedding** across page metadata and visible ecosystem links.
7. Existing features retained: whiteboard, PDF, Reader Cast, live classroom, student whiteboards, chat, polls, quizzes, behaviour points, group maker, captions, noise meter, local recording, PWA/offline shell and teacher access gate.

## 2. Important technical truth: full Android screen capture

A normal static web app cannot force Android to share the whole device screen if the browser does not expose that permission. Many Android browsers either do not support `navigator.mediaDevices.getDisplayMedia()` or limit it. For this reason ClassDesk v2 implements both:

- **Try full tablet screen** — uses `getDisplayMedia` when supported.
- **ClassDeck workspace capture** — reliable fallback using ClassDeck's own composite teaching canvas. This means students and social viewers still see the teaching workspace: whiteboard, PDF, web cast, notes, toolkit, camera, captions and overlays.

This avoids promising an impossible browser permission while still delivering the practical teaching result from the tablet.

## 3. Important technical truth: direct social live without OBS

YouTube, Facebook, Instagram and TikTok commonly use RTMP/RTMPS for external live ingest. A browser cannot open raw RTMP/RTMPS publishing connections directly. Therefore, true no-OBS tablet streaming requires a relay:

```text
ClassDeck tablet browser → WebRTC/WHIP → relay server → RTMP/RTMPS → social platforms
```

ClassDesk v2 includes that relay in:

```text
relay/no-obs-social-relay/
```

The teacher does not use OBS. The relay does the protocol conversion.

## 4. Similar platform research and feature mapping

| Platform type | Useful features found | ClassDesk v2 response |
|---|---|---|
| BigBlueButton/open classroom | WebRTC classroom, screen share, whiteboard, chat, shared notes, polls, breakout rooms, recordings, LMS integrations. | ClassDeck already had WebRTC classroom, whiteboard, chat, polls and recording. v2 strengthens direct screen/workspace sharing and no-OBS social relay. |
| ClassIn | Breakout rooms, scheduling, file sharing, class management, performance dashboards and cloud recording. | ClassDeck keeps group maker, attendance, reports, recordings and adds social live workflow. Future enhancement can add persistent timetable backend using free Supabase. |
| Nearpod/Pear Deck | Interactive lessons, drawing, quizzes, polls, reports, student-paced/live modes. | Existing polls, quizzes, activities and student boards retained; reporting improved. |
| Whiteboard.fi | Every student has a private whiteboard visible to the teacher; teacher can push board to all. | Already implemented and retained. |
| ClassDojo | Behaviour points, random picker/group maker, timer/noise meter. | Behaviour points and group maker retained; noise meter implemented. |
| StreamYard/Restream/browser studios | Browser-based multistreaming, guests, branding, comments, no software download. | ClassDesk v2 adds a no-OBS tablet social live workflow and browser-studio fallback links, while keeping stream keys outside GitHub. |
| Zoom/Teams webinars | Q&A, polls, registration, captions, reports, controlled attendee experience, social livestreaming. | ClassDeck has waiting room, polls, captions, attendance/report exports; social streaming now added through relay. |

## 5. New feature details

### 5.1 Direct screen/workspace sharing

Location:

```text
teach.html → ⚙ Settings → 🖥 Try full tablet screen
```

Behaviour:

- If browser supports screen capture, teacher selects screen/window/tab.
- If live, the selected screen becomes the student stage stream.
- If not live, ClassDeck saves screen-share mode and tells the teacher to tap Go Live.
- If unsupported/cancelled, ClassDeck uses composite workspace mode.

### 5.2 Tablet Social Live — no OBS

Location:

```text
teach.html → ⚙ Settings → 📡 Tablet Live
```

Fields:

- Relay gateway URL.
- Relay secret/token.
- Stream name.
- Output format: landscape 16:9 or vertical 9:16.
- Destination publish URLs: YouTube, Facebook, Instagram, TikTok, custom RTMP/RTMPS.

Flow:

1. ClassDeck captures the teaching workspace canvas.
2. Microphone audio is added.
3. If vertical mode is selected, ClassDeck creates a branded 9:16 layout with HMG identity.
4. ClassDeck publishes the stream to the relay using WHIP/WebRTC.
5. The relay starts FFmpeg outputs to social platforms.

### 5.3 Included relay

Folder:

```text
relay/no-obs-social-relay/
```

Included files:

- `docker-compose.yml`
- `srs.conf`
- `Caddyfile`
- `.env.example`
- `controller/server.js`
- `controller/Dockerfile`
- `controller/package.json`
- `README.md`

What it does:

- SRS receives WebRTC/WHIP from the tablet.
- SRS exposes the stream internally as RTMP.
- Node controller starts/stops FFmpeg outputs.
- Caddy provides HTTPS.

### 5.4 SEO/search engine improvements

Added/updated:

- `sitemap.xml`
- `robots.txt` with sitemap reference.
- Canonical tags.
- Meta keywords/description/author.
- Open Graph tags.
- JSON-LD for Person, Organization and SoftwareApplication.
- HMG brand links visible on the landing page and Social Live Centre.

### 5.5 HMG brand embedding

Embedded details:

- Adewale Samson Adeagbo.
- AI-Augmented Solutions Developer.
- Data Scientist.
- STEM Educator.
- Founder/Visioner of HMG ecosystem.
- HMG Academy, HMG Concepts, HMG Technologies, HMG Media, HMG Gospel.
- Lagos, Nigeria.
- Cost discipline: no paid AI API.
- HMG values: deliberate learning, authentic teaching, Nigerian context, values-driven technology.

## 6. Deployment — static ClassDeck app

### GitHub Pages

1. Unzip `classdesk v2.zip`.
2. Open the `classdesk v2/` folder.
3. Upload the **contents** of the folder to your GitHub repository root.
4. Ensure these are at root:

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

5. Commit changes.
6. Go to GitHub repository → Settings → Pages.
7. Select `Deploy from branch`, branch `main`, folder `/root`.
8. Save and wait for deployment.
9. Visit your GitHub Pages URL.
10. Hard refresh or clear site data once because service-worker cache has changed.

### Cloudflare Pages

1. Push/upload the same root files to GitHub.
2. Cloudflare Pages → Create Project → Connect Git.
3. Build command: leave empty.
4. Build output directory: `/`.
5. Deploy.

## 7. Deployment — no-OBS social relay

The relay cannot run on GitHub Pages because it requires Docker, SRS and FFmpeg.

### Recommended free/low-cost deployment

Use a Linux VM/free-tier server.

1. Point DNS:

```text
live.yourdomain.com → YOUR_SERVER_IP
```

2. SSH into the server.

3. Clone or upload the repo.

4. Go to relay folder:

```bash
cd relay/no-obs-social-relay
cp .env.example .env
nano .env
```

5. Set:

```text
DOMAIN=live.yourdomain.com
RELAY_SECRET=your-long-private-secret
PUBLIC_IP=your-server-public-ip
```

6. Start services:

```bash
docker compose up -d --build
```

7. Test:

```bash
curl https://live.yourdomain.com/health
```

8. On the tablet open ClassDeck:

```text
teach.html → ⚙ Settings → 📡 Tablet Live
```

9. Enter:

```text
Gateway URL: https://live.yourdomain.com
Relay secret: your-long-private-secret
Stream name: classdeck
```

10. Paste full RTMP/RTMPS URLs from your social platforms.

11. Start tablet social live.

## 8. Safeguarding and stream-key rules

- Do not publish stream keys in GitHub.
- Use HTTPS for relay.
- Use a relay secret.
- For minors, obtain parent/school consent before public social livestreaming.
- Consider streaming unlisted/private first for tests.
- TikTok and Instagram may require account eligibility or professional/creator account setup.

## 9. Files changed in ClassDesk v2

- `teach.html` — added Tablet Live modal and full tablet screen attempt control.
- `js/teach.js` — added WHIP publisher, relay control, vertical social layout and full-screen attempt.
- `stream.html` — rebuilt as no-OBS tablet live centre.
- `index.html` — SEO and HMG brand structured data.
- `robots.txt` — sitemap reference and crawl rules.
- `sitemap.xml` — search engine discovery.
- `manifest.webmanifest` — updated social live wording.
- `sw.js` — cache version bumped.
- `version.json` — v10/classdesk-v2 version.
- `relay/no-obs-social-relay/` — no-OBS relay stack.

## 10. What remains intentionally not done

- No paid AI APIs.
- No forced native Android app requirement.
- No UI/UX redesign.
- No removal of existing features.
- No storage of stream keys in repository.
