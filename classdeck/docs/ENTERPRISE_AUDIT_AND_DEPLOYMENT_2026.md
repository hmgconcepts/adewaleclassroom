# HMG ACADEMY CLASS DECK — Expert Audit, Fix Log & Deployment Guide

Date: 2026-06-19

This package is a static, free-tool-based web application. It does not require an AI API, paid backend, paid database, or paid media server for normal classroom use. Live class signalling uses PeerJS/WebRTC; PDF rendering is local; whiteboard/toolkit/recording run in the browser.

## 1. What was audited

Audited areas:

- Teacher Studio (`teach.html`, `js/teach.js`)
- Student join flow (`join.html`, `js/join.js`)
- WebRTC classroom engine (`js/rtc.js`)
- Whiteboard (`js/whiteboard.js`)
- Toolkit and reference cards (`js/toolkit*.js`)
- CSS/mobile responsiveness (`css/style.css`)
- Recording logic, PDF broadcast, graph tool, calculator, waiting room and resume behavior
- Existing deployment/static hosting compatibility

## 2. Main fixes completed

### 2.1 Teacher accidental exit / Resume class now

**Problem:** If the teacher accidentally left or refreshed and then used `Resume class now`, students could remain visually “in class” or in the lobby while the resumed teacher room did not list them as active students.

**Fix:**

- Added a previous-attendance marker on the student device after a successful welcome.
- Student reconnection now sends a `rejoin` flag in PeerJS metadata for the same room.
- Teacher room now supports `autoAdmitRejoin` after resume.
- Previously admitted students bypass the waiting-room queue during class resume, while normal new students still obey PIN/token/waiting-room controls.

Files changed:

- `js/rtc.js`
- `js/join.js`
- `js/teach.js`

### 2.2 PDF zoom/ratio mismatch

The existing visible-viewport broadcast logic was retained and protected. It broadcasts the visible PDF region instead of stretching the full PDF canvas. This ensures students see the same scroll/zoom area and aspect ratio shown on the teacher tablet.

Relevant logic:

- `inst.getViewportRegion()` in `initPdf()`
- PDF rendering path inside `drawPaneContent()`

### 2.3 Scientific calculator replacement/improvement

**Problem:** The numeric layout was not arranged like a conventional calculator.

**Fix:**

- Rebuilt the calculator into a wider scientific layout with a standard `7 8 9 / 4 5 6 / 1 2 3 / 0` numeric arrangement.
- Added/retained scientific features: trigonometry, inverse trig, DEG/RAD, ln/log, powers, roots, constants, factorial, reciprocal, memory, Ans, percent, modulo, abs/round and history.
- Improved tablet button sizing.

Files changed:

- `js/teach.js`
- `css/style.css`

### 2.4 Mobile/tablet friendliness

**Fix:** Added responsive CSS for tablets and portrait devices:

- Teacher toolbar wraps instead of forcing horizontal-only cramped controls.
- Larger touch targets for stylus/finger teaching.
- Portrait mode stacks panes vertically.
- Drawers, modals, calculator and self-view fit smaller screens better.
- Better usability on Android tablets such as itel Vista Tab devices.

File changed:

- `css/style.css`

### 2.5 Recording feature and MP4 support

**Problem:** Recording was WebM only and audio capture was not robust enough.

**Fix:**

- Recorder now tries MP4 first where the browser supports it:
  - `video/mp4;codecs=avc1.42E01E,mp4a.40.2`
  - `video/mp4`
- Falls back to WebM where MP4 MediaRecorder is unavailable. This is a browser limitation, not an app limitation.
- Improved audio constraints: echo cancellation, noise suppression, auto gain control, mono channel and ideal 48kHz sample rate.
- Increased bitrate for smoother lesson recording.
- File extension is automatically `.mp4` or `.webm` depending on the supported recording container.

Important note: Chrome/Android often records WebM; Safari/iOS/macOS may support MP4. A static browser app cannot transcode WebM to MP4 without shipping a very large in-browser encoder. The implemented approach uses free native browser recording support.

File changed:

- `js/teach.js`

### 2.6 More examples/cards/library content

Added an extra offline reference-card file with nursery, primary, JSS, SS and teacher-support cards.

New file:

- `js/toolkit-data3.js`

Included from:

- `teach.html`

New examples include:

- Nursery pre-writing patterns
- Pencil grip and posture
- Letter families
- Number bonds
- Times-table strategies
- Sentence checklist
- Materials/properties
- Integers
- Linear equations
- Energy
- Civic responsibilities
- Circle theorems
- Trig graphs
- Equations of motion
- Mole calculations
- Genetics
- Study skills
- Differentiation ideas

### 2.7 More accessible graph plotting

**Problem:** The graph feature felt like it only supported a quadratic example.

**Fix:** Added quick graph presets directly in the graph toolbar:

- Linear
- Quadratic
- Cubic
- Sine
- Absolute value
- Square-root
- Logarithmic
- Exponential

The original free-form function input remains, so teachers can still type expressions like:

- `2*x+1`
- `x^2-4`
- `x^3-3*x`
- `sin(x)`
- `cos(x)`
- `tan(x)`
- `sqrt(x)`
- `log(x)`
- `abs(x)`
- `exp(x/3)`

Files changed:

- `teach.html`
- `js/teach.js`

### 2.8 Nursery letter-writing support on whiteboard

**Fix:** Added new whiteboard backgrounds for early handwriting instruction:

- Nursery handwriting lines
- Four-line letter practice
- Fine graph paper

These are in addition to existing plain, grid, ruled and dark board backgrounds.

Files changed:

- `teach.html`
- `js/whiteboard.js`

### 2.9 Nursery-to-secondary accommodation

The platform already had multiple classroom, CBT, quiz, board and toolkit functions. It has now been further extended with:

- Nursery writing templates
- Primary maths/English/science reference cards
- JSS maths/science/social cards
- SS maths/physics/chemistry/biology cards
- Teacher study skills and differentiation cards
- More graph examples
- Improved tablet UI

## 3. Important feature explanations

### 3.1 Teacher Studio

The teacher can teach from a split-screen workspace with combinations of:

- Whiteboard
- PDF material
- Web resource/reader cast
- Notes
- Image viewer
- Graph plotter
- Video/audio player
- Educational toolkit
- Flashcards
- Stopwatch/countdown timer

### 3.2 Live classroom

The live classroom uses WebRTC peer connections. The teacher device acts as the classroom hub. Students join with a room link/code and receive the teacher’s stage stream.

Features include:

- Waiting room
- Admit/deny
- Room lock
- PIN
- Secure invite token
- Roster
- Student camera requests
- Student mic permission
- Student screen-share request
- Chat/private chat
- Polls
- Quiz leaderboard
- Student whiteboards
- Activities and exit tickets

### 3.3 Recording

Recording happens locally on the teacher’s device. Nothing uploads. The app records a branded lesson canvas with audio where microphone permission is granted.

Supported output:

- MP4 if the browser supports MP4 MediaRecorder
- WebM fallback otherwise

### 3.4 PDF teaching

PDF files are loaded locally from the teacher device. When the teacher zooms or scrolls, the broadcast compositor uses the visible viewport so students see the same visible PDF region.

### 3.5 Toolkit/reference library

The toolkit is an offline teaching support area with math, science, classroom and reference-library resources. The library has been expanded beyond the existing cards and is arranged by subject categories.

### 3.6 Full tablet screen sharing

Some Android tablets/browsers do not expose `getDisplayMedia()` for full device capture. Where the browser allows it, ClassDeck can share full screen. Where it does not, the app still broadcasts the complete ClassDeck teaching workspace, which is usually better for lessons and works more reliably.

For itel Vista Tab 30s:

1. Use Chrome or Edge if available.
2. Install ClassDeck as a PWA.
3. Use `Share screen` mode only if the browser shows the Android screen picker.
4. If full device sharing is unavailable, teach normally in ClassDeck composite mode; students still see the full ClassDeck workspace.
5. Use the `🎯 Focus` button for a cleaner share view.

## 4. Deployment guide

### Option A — Deploy to Vercel

1. Create or open the GitHub repository.
2. Upload all files inside the `classdesk` folder to the repository root.
3. Go to <https://vercel.com/>.
4. Click **Add New Project**.
5. Import the GitHub repository.
6. Framework preset: choose **Other** or **Static**.
7. Build command: leave empty.
8. Output directory: leave empty / root.
9. Click **Deploy**.
10. Open the deployed URL.
11. Test:
    - `index.html`
    - `teach.html`
    - `join.html`
    - PDF upload
    - Go Live
    - Student join from another device

### Option B — Deploy to Netlify

1. Zip the contents of the `classdesk` folder or connect the GitHub repository.
2. Go to <https://netlify.com/>.
3. Add a new site.
4. Choose **Deploy manually** or connect GitHub.
5. Build command: none.
6. Publish directory: `/` root.
7. Deploy.

### Option C — GitHub Pages

1. Upload all `classdesk` files to a GitHub repository.
2. Go to repository **Settings**.
3. Open **Pages**.
4. Source: deploy from branch.
5. Branch: `main`, folder `/root`.
6. Save.
7. Wait for the GitHub Pages URL.

Note: WebRTC, camera, mic, service worker and screen sharing require HTTPS. GitHub Pages, Vercel and Netlify provide HTTPS automatically.

## 5. Post-deployment testing checklist

Use two or three devices.

### Teacher test

- Open `teach.html`.
- Set teacher name and room name.
- Click `Go Live`.
- Upload a PDF.
- Zoom PDF in/out.
- Open graph and try presets.
- Open calculator and test numeric layout.
- Open whiteboard background dropdown and choose handwriting lines.
- Start recording, speak for 20 seconds, stop and confirm saved file.

### Student test

- Open `join.html` from another device.
- Enter room code/name.
- Confirm the teacher can see the student.
- Test waiting room admit.
- Test hand raise/chat.
- Ask student to share camera/mic.

### Resume test

1. Teacher goes live.
2. Student joins and is admitted.
3. Teacher accidentally refreshes/closes tab.
4. Teacher reopens `teach.html`.
5. Click `Resume class now`.
6. Student should reconnect automatically and appear in roster without being trapped in waiting room.

### Mobile/tablet test

- Rotate tablet portrait/landscape.
- Confirm toolbar wraps and panes remain usable.
- Try Focus mode.
- Try full screen.
- Try `Try full tablet screen` in Settings; if unsupported, use ClassDeck composite mode.

## 6. Known limitations caused by browser/free-tool constraints

- MP4 recording depends on the browser’s native MediaRecorder support. The app attempts MP4 first and falls back to WebM.
- Full Android tablet screen capture depends on browser/OS `getDisplayMedia()` support.
- Peer-to-peer WebRTC depends on network NAT/firewall conditions. Public STUN/TURN configuration is included, but some school/corporate networks may still block media.
- Static hosting has no central database, so cross-device persistent rosters cannot exist after every device is fully disconnected. The implemented resume fix uses student-side rejoin metadata to reconnect previously admitted students.

## 7. Files changed/added in this package

Changed:

- `teach.html`
- `js/teach.js`
- `js/rtc.js`
- `js/join.js`
- `js/whiteboard.js`
- `css/style.css`

Added:

- `js/toolkit-data3.js`
- `docs/ENTERPRISE_AUDIT_AND_DEPLOYMENT_2026.md`

## 8. Validation

Validation run:

```bash
node --check js/*.js
bash scripts/validate.sh
```

Result: all checks passed.
