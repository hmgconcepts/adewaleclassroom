# HMG ACADEMY CLASS DECK — ClassDesk v3 (v11.1.1) 🧑‍🏫📡🛡

**ClassDesk v3** builds on the existing HMG Academy ClassDeck without removing previous features or changing the UI/layout philosophy. It adds stronger subscription/security protection, optional Cloudflare Worker license gateway, forensic watermarking, secure invite links, security audit export, and Picture-in-Picture continuity — while keeping the direct tablet screen/workspace broadcast and no-OBS tablet social live relay workflow from ClassDesk v2.

**By Adewale Samson Adeagbo** — AI-Augmented Solutions Developer · Data Scientist · STEM Educator (Lagos, Nigeria).
Founder of HMG ACADEMY and the HMG family of brands:
[cssadewale.pages.dev](https://cssadewale.pages.dev) · [hmgacademy.pages.dev](https://hmgacademy.pages.dev) ·
[hmgconcepts.pages.dev](https://hmgconcepts.pages.dev) · [hmgtechnologies.pages.dev](https://hmgtechnologies.pages.dev) ·
[hmgmedia.pages.dev](https://hmgmedia.pages.dev) · [hmggospel.pages.dev](https://hmggospel.pages.dev)
*The official HMG ACADEMY logo and founder photo are embedded on the landing page (assets/).*

A **free, lightweight, installable (PWA) teaching platform** built for teachers who
teach from a tablet (e.g. itel Vista Tab 30s) and were being thrown out of
Google Meet every time they split-screened a whiteboard and their learning materials.

ClassDeck removes the need for split-screening two separate apps at all:

> **The whiteboard, PDF reader, browser, notes and image viewer all live INSIDE
> one app, side by side.** Share your screen on Google Meet and teach from
> here (Meet Companion mode, new in v2), or use the built-in live classroom —
> either way it looks like a laptop to your students.

Students need no account. Teachers create a local on-device account for the 3-day trial. No paid server or AI API is required for the core classroom.

---

## 🆕 What's new in ClassDesk v3 — security, subscription protection and PiP

| Feature | Detailed explanation |
|---|---|
| **🛡 Optional online license gateway** | Deploy `security/license-gateway-worker/` on Cloudflare Workers free tier and set `js/security-config.js` to `licenseMode: "strict"`. Trials, subscriptions, device limits and account blocks are checked server-side instead of relying only on localStorage. |
| **🔐 Secure invite links** | A new Settings option can require a secret invite token. Students who only know the room code cannot join unless they use the teacher's current secure invite link. |
| **🚫 Anti-piracy forensic watermark** | Broadcasts and recordings can include a faint repeated watermark with teacher/room details to discourage unauthorised resale or recording. |
| **🛡 Security audit CSV** | The Students drawer exports a local audit log: studio open, class start/end, waiting room, student joins/leaves, media events and PiP activity. |
| **▣ Picture-in-Picture continuity** | A top-bar PiP button opens a small live preview of the ClassDeck teaching canvas. Teachers can keep it visible while switching/minimising where the browser supports PiP. |
| **🖥 Direct tablet screen/workspace sharing** | Teachers can tap **⚙ Settings → 🖥 Try full tablet screen**. If the tablet browser supports full system capture, ClassDeck shares the selected screen/window directly to students. If Android/browser blocks full-system capture, ClassDeck automatically falls back to its reliable tablet-safe workspace capture — students still see the whole ClassDeck teaching screen without Google Meet/Zoom. |
| **📡 Tablet Social Live — no OBS** | Teacher Studio now has **⚙ Settings → 📡 Tablet Live**. The tablet sends the ClassDeck teaching workspace through WebRTC/WHIP to the included open-source relay (`relay/no-obs-social-relay/`), and the relay publishes to YouTube, Facebook, TikTok, Instagram or custom RTMP/RTMPS destinations. No OBS is needed on the tablet. |
| **CC Live captions + transcript** | The Chat drawer now includes **CC Live captions**. Where the browser supports Web Speech API, the teacher's speech is captioned for students in a bottom banner. Final lines can be downloaded as a transcript. No AI API is used. |
| **🔊 Noise meter now implemented** | The Students drawer includes a local microphone noise meter with threshold control. When active, it is drawn into the broadcast/recording overlay so students can self-regulate. Nothing is recorded or uploaded. |
| **WebRTC stability fixes** | Teacher stage/camera calls are now closed when replaced, reducing duplicate media calls and long-class connection leaks. Ending a class now clears the room state and stops stage video tracks more cleanly. |
| **Better reports** | Class reports now include hands raised, reactions and caption-line counts in addition to existing attendance, chat, poll, quiz and leaderboard information. |

See `docs/CLASSDESK_V3_SECURITY_PIP_REPORT.md`, `docs/CLASSDESK_V2_REPORT.md` and `docs/ENHANCEMENT_REPORT_V9.md` for full diagnosis and implementation notes.

---

## ⭐ THE MAIN v2 WORKFLOW — teaching over Google Meet

This is the exact flow you asked for:

1. **Start your class on Google Meet** as usual (Meet free tier).
2. In Meet, tap **Share screen → Share entire screen**.
3. Open **ClassDeck → “Teach on Google Meet”** (this opens `teach.html?meet=1`,
   the **Meet Companion mode**).
4. Your whiteboard and learning materials are now **side by side in ONE app**,
   filling your screen exactly like your screenshot — and because it is a
   single app, **Android never kills the split-screen and Meet never logs you
   out**. Meet simply streams whatever is on your screen.
5. Tap **🎯 Focus mode** — every toolbar disappears; students see pure content.
   A translucent ☰ handle (top-left) and a floating mini-toolbar
   (pen / highlighter / eraser / laser / undo / page / layout) stay available.
6. Teach: write, annotate the PDF, scroll, flip pages. Meet keeps sharing; the
   screen wake-lock keeps the tablet awake.

**Why this can't crash like before:** the old crash happened because Android's
split-screen ran *two heavy apps + Meet's capture* and killed Meet to reclaim
memory. In v2 there is only **one Chrome tab** on screen. Nothing to split,
nothing for Android to kill.

> Bonus: the built-in live classroom from v1 is still fully present
> (`teach.html` without `?meet=1`). Use it when you want student-camera
> monitoring, hand-raise/mic control, polls and attendance — things Meet on a
> tablet cannot do — or as a backup if Meet misbehaves. You can even run both:
> teach over Meet while a few students join the ClassDeck room for cameras.

---

## Live pages

| Page | Who | What |
|------|-----|------|
| `index.html` | everyone | Landing page, feature list, install button |
| `teach.html?meet=1` | teacher | **Meet Companion** — workspace for Google Meet screen sharing (v2) |
| `teach.html` | teacher | The Studio: split-screen workspace + built-in live class controls |
| `teach.html?solo=1` | teacher | Same workspace without live-class chrome (prep / in-person / OBS clean output) |
| `join.html` | students | Full-screen class view for the built-in classroom (room code / link / QR) |
| `stream.html` | teacher/media team | Tablet Social Live Centre: no-OBS WebRTC relay workflow, platform notes, search-friendly HMG brand page and browser-studio fallbacks |

---

# 🆕 What's new in v8 — the competitive-parity release

Built after deep market research into the leading classroom platforms — **Whiteboard.fi (Kahoot)**, **ClassIn**, **Nearpod**, **Pear Deck**, **ClassDojo**, **Mentimeter/Socrative** and **Kahoot/Blooket/Gimkit**. The signature features they charge for are now built into CLASS DECK, free:

| # | Feature (inspired by) | Detailed explanation |
|---|----------------------|----------------------|
| 1 | **🎨 Individual student whiteboards** *(Whiteboard.fi's flagship — their paid tier)* | Tap **🎨 → ▶ Start boards** and **every student instantly gets a personal whiteboard** on their device (colour pens, undo, clear) that **only you can see** — students never see each other's boards. Their strokes stream live into a grid in your 🎨 drawer; tap any tile to enlarge and watch one student work in real time. **📤 Push my board** sends your current whiteboard page (e.g. the question you just wrote) onto every student board as a background — "everyone, solve this now". Students can flip between their board and the lesson view (📺 Lesson / 🎨 reopen buttons). This is THE formative-assessment feature teachers love Whiteboard.fi for — here it's integrated with your live class, not a separate site. |
| 2 | **🧩 Activities: open question, live word cloud, exit ticket** *(Pear Deck / Nearpod / Mentimeter)* | The new 🧩 drawer launches three interaction types to every student device: **💬 Open question** — students type free-text answers; responses stream into your drawer with names. **☁ Word cloud** — students send ONE word; ending the activity renders a real word cloud on every student's screen (words sized by frequency, coloured) — magical for "describe today's topic in one word". **🎟 Exit ticket** — the classic end-of-lesson check: a 1–5 star understanding rating + "one thing you learned" + "one thing still confusing", collected per student so you know exactly what to reteach tomorrow. You choose whether to share results with the class or end quietly. |
| 3 | **⭐ Behaviour points** *(ClassDojo's core loop)* | Every roster row now has four award buttons: **⭐ Participation +1, 🤝 Teamwork +1, 💡 Great answer +2, ⚠ Off-task −1**. Awards fly up everyone's screens with the student's name (positive reinforcement in front of peers!), the receiving student gets a personal toast, totals accumulate per category, and **⭐ Points CSV** exports the full behaviour register for parents' meetings — the heart of ClassDojo without the subscription. |
| 4 | **👥 Random group maker** *(ClassDojo toolkit / ClassIn breakouts)* | One tap asks "how many groups?", shuffles all connected students fairly, shows you the full list, and **tells every student their group number** with a green banner on their screen — instant think-pair-share or project teams with zero admin. |
| 5 | **🔊 Noise meter** *(ClassDojo toolkit)* | A new Toolkit mode: a live class-volume gauge using the device microphone (green→amber→red arc, smoothed level, peak memory). Set a threshold (tap left/right) — the screen flashes red with "TOO LOUD!" when the class crosses it. Broadcastable like every toolkit tool, so the class self-regulates by watching the gauge. Nothing is recorded or transmitted. |

*(Already at parity from earlier versions: Kahoot-style gamified quizzes with speed bonuses & podium (v3), CSV question import (v6), waiting room & PIN (v4/v6), reactions & spotlight (v4), attendance & analytics exports (v3/v5), per-teacher branded recording (v7) — see below.)*

---

# What was new in v7

| # | Feature | Detailed explanation |
|---|---------|----------------------|
| 1 | **📚 Curated education library (40+ vetted links, Nursery → SS3)** | The browser pane now opens with a grouped **“📚 Education library…”** dropdown beside the quick buttons, hand-picked for reader-friendliness and teaching value: **Nursery/Early years** (StoryWeaver free picture books, Storyberries, Wikijunior, Monkey Pen free children's books, Super Simple Songs), **Primary** (Simple English Wikipedia, Nat Geo Kids, CoolMath4Kids, Ducksters, Funbrain, NASA Kids Club), **Mathematics** (Desmos, GeoGebra, Maths Is Fun, Transum starters, NRICH problems, Open Middle), **Science** (PhET simulations, Ptable live periodic table, BBC Bitesize, CK-12 textbooks, NASA Solar System, Biology Corner), **English & Literature** (Project Gutenberg, Wiktionary, Poetry Foundation, Open Library, Grammarly handbook), **Social Studies & ICT** (Britannica, Worldometers live data, Code.org, Scratch), and **Nigerian exams & open courses** (WAEC e-Learning, JAMB, Myschool past questions, Khan Academy, OpenStax, Internet Archive). Picking an entry navigates the pane AND feeds Reader Cast automatically. |
| 2 | **📖 Reader Cast 2.0 — magazine-quality rendering** | The cast renderer was rebuilt to look professional on tablets: an **article card layout** with a centred reading column at a comfortable measure, real **typography** (Georgia serif body, bold sans headings with accent underline, larger lead paragraph), styled **blockquotes** with accent bars, bullet/numbered lists, **rounded images with italic captions** and graceful skeleton loaders, junk-line cleanup (menus, cookie banners, “skip to content” are stripped) and soft-wrap merging so paragraphs read naturally. Four **reading themes** — Light / Sepia / Dark / Green-board — with matched palettes (remembered between sessions), a top **reading-progress bar**, an estimated **“~N min read”** chip, smooth momentum scrolling plus **tap-bottom = page-down, tap-top = page-up** for one-handed tablet use. Font size (A−/A＋) is also remembered. |
| 3 | **🛡 Revenue protection (security v2)** | Five new layers on top of v6: **(a) PBKDF2 key-stretching** (120,000 iterations) for new account passwords — brute-forcing a leaked record becomes ~120,000× harder; old accounts still log in. **(b) Central revocation** — the app fetches `revoked.json` from YOUR deployment on every studio start (cached offline): add a leaked/refunded key or a blocked email to that file, push to GitHub, and every installed app blocks it within minutes — a free kill-switch with no servers. **(c) Device binding** — accounts are bound to a per-device ID; copying localStorage to another tablet invalidates the account instead of cloning the trial. **(d) Runtime heartbeat** — the broadcaster re-checks authentication every ~5 seconds of streaming; deleting the auth overlay or flipping the flag in DevTools kills the live class automatically. **(e) Modern security headers** (`_headers`): X-Frame-Options, nosniff, strict referrer policy, camera/mic permissions policy, and admin.html marked noindex. |
| 4 | **🎬 Per-teacher recording brands** | Recordings now carry **the recording teacher's own brand, not HMG's**: the setup dialog asks for *Brand name* (prefills from their account), *Footer credit* (their YouTube/WhatsApp line) and an optional **logo upload** (auto-downscaled and stored on their device). The video header shows their logo — or a clean coloured initial badge if none — with their brand on both sides; the footer carries their credit line (defaulting to a subtle “Recorded with HMG ACADEMY CLASS DECK”); the filename starts with their brand (`Funkes-Tutorials_Maths_…webm`). Every teacher-client gets YouTube-ready videos under their own identity — a real selling point for your subscriptions. |
| 5 | **🏗 Modern platform engineering** | Brought the repo in line with modern static-app practice: **`_headers`** (security + immutable caching for assets/vendor on Cloudflare Pages/Netlify), **`robots.txt`** (admin page hidden from search), **`version.json`** (single source of truth for version/build), **Open Graph + Twitter meta** for rich link previews when you share the platform on WhatsApp/X, long-cache immutable headers for static assets, and **`scripts/validate.sh`** — a one-command CI-style pre-deploy check (JS syntax, JSON validity, broken-asset scan) you can run before every push. |

---

# What was new in v6.1 (still here)

| # | Feature | Detailed explanation |
|---|---------|----------------------|
| 1 | **🎓 Direct student studio + teacher approval** | Class links (`join.html?room=CODE`) now take students **straight to the student studio**: the room code is pre-filled and hidden behind a clean "Class: CODE" chip — they only type their name and tap Join. Admission is **teacher-controlled**: the waiting room is OFF by default for direct joining; turn it ON deliberately (👥 → 🚪) when you want to admit learners, so every student appears in your "Waiting to be admitted" list with ✔ Admit / ✕ Deny / Admit-all buttons. Your preference is remembered between classes. |
| 2 | **🔐 Mandatory teacher signup/login (3-day trial)** | Opening the Teacher Studio now presents a **full-screen account gate** with three tabs: **Create account** (full name, email, WhatsApp number, school, password — so HMG ACADEMY captures every lead), **Log in** (per-session: closing the browser requires logging in again) and **Activate key**. The free trial is **3 days** from signup. Security hardening: passwords are never stored (PBKDF2 for new accounts, with legacy salted hashing still supported); the account record is integrity-signed so editing localStorage invalidates it instead of extending the trial; and Go Live, Invite and Recording are **blocked at function level** — deleting the overlay in DevTools still leaves the studio unusable. License keys remain name-bound, expiry-bound and SHA-256-signed, generated on your private `admin.html`. *Honest note: with zero servers this is strong deterrence, not bank-grade security — the README's Cloudflare-Worker upgrade path (free tier) adds central revocation when you're ready.* |
| 3 | **📡 Browser visible to students — Reader Cast (v6.2, works on tablets!)** | Two-layer fix. **Reader Cast (every device, including the itel Vista Tab 30s):** Android Chrome/Edge have *no screen-capture API*, so the old "Cast" could never work on tablets — and browsers forbid drawing iframe pixels onto a canvas. Reader Cast solves it: tapping **📡 Cast** fetches the page's content through free key-less reader proxies (r.jina.ai primary, with retry + allorigins fallback), renders headings, paragraphs, lists and images onto a **canvas** (canvases ARE broadcastable), and streams it. Students see the page in the live broadcast; the teacher drag-scrolls with momentum, A−/A＋ adjusts text size, navigation reloads the reader, and a footer shows the source URL. Images load CORS-direct first, then via the free weserv proxy. **🎥 Live (desktop browsers only):** where getDisplayMedia exists, a separate Live button still offers true tab capture. Needs internet for the proxy fetch; if a site blocks readers, the app suggests saving it as PDF |
| 4 | **🧰 Toolkit grown to 200+ tool modes (Nursery → SS3)** | Added a **second library volume** with ~70 new reference cards: **Nursery/Early Years** (A–Z phonics chart, counting 1–20, shapes, colours, body parts, days/months, animal sounds & babies, fruits & vegetables, family & home, magic words & manners, opposites, transport & road safety, weather, community helpers), **Primary Maths** (addition/subtraction strategies, number bonds, skip counting, Naira & kobo money, telling time & calendar, even/odd, word-problem keywords RUCSAC, rounding & estimation, pictograms & tally), **Primary Science/Health** (MRS GREN living things, parts of a plant, hygiene checklist, balanced diet food groups, five-senses experiments, home & school safety), **Senior Maths** (surds, 2×2 matrices, differentiation, integration, trig identities & sine/cosine rules, permutation/combination/binomial, variation, circle theorems), **Senior Science** (organic chemistry families, mole concept, electrolysis, radioactivity, projectiles & circular motion, ecology, hormones, blood groups & genotype), **English/Literature** (concord, active/passive, reported speech, phrases & clauses, registers, oral English, literary/drama/poetry terms), **Social/Business Studies** (arms & tiers of government, human rights, drug-abuse awareness, bookkeeping, commerce, office terms) and **ICT/Skills** (word processing, spreadsheets with formulas, email etiquette, AI literacy) plus classroom extras (debate format, national pledge, icebreakers, exam revision planner). Total: **181 reference cards + 21 interactive tool modes = 202 tool modes**, all searchable and broadcastable. |
| 5 | **🃏⏱ Two new pane apps** | **Flashcards** — create card decks ("front | back" lines, saved on device), tap to flip with colour-coded front/answer, shuffle, prev/next; rendered into the broadcast so the class drills together. **Timer/Stopwatch** — a giant full-pane classroom timer: stopwatch with laps, or countdown with minutes/seconds; goes red in the final 10 s, announces "Time is up!" to students, and shows in the broadcast. The pane line-up is now: Whiteboard · PDF · Browser · Notes · Image · Graph · Video · Toolkit · Cards · Timer. |
| 6 | **💎 Professional UI/UX pass** | The landing page was rebuilt around the customer journey: clear hero promise, three task-based doors (Teacher / Student / Meet-Zoom Companion), an honest 8-point "Why teachers choose CLASS DECK" grid, the founder card, and nothing else — version-history jargon, internal feature codes and technical caveats were removed from end-user surfaces (they live in this README instead). The auth gate is a polished card with tabs, friendly errors and a trust line. Buttons, spacing and copy were tightened throughout ("Start teaching ➜", "Join my class ➜"). |

---

# What was new in v6.0 (still here)

| # | Feature | Detailed explanation |
|---|---------|----------------------|
| 1 | **🧰 200+ tool-mode Educational Toolkit** | The toolkit grows from 7 to **200+ tool modes** in two layers. **(a) 21 interactive tool modes** organised by subject in the toolkit dropdown: 📐 Geometry construction · ✖ Multiplication table · 📏 Number line (settable range/step, tap to place jump-hops that label differences) · 🍕 Fraction visualizer (two fractions side-by-side as circles or bars with automatic <,>,= comparison, decimal & percent) · 🧮 Place-value abacus (millions→units, tap to add/remove beads, live number read-out) · 🔢 Hundred square (skip-counting highlights + tap-to-mark) · ⚖ Algebra balance scales (set x, addend, coefficient → visual equation, tap to reveal the step-by-step solution) · 🕐 Teaching clock (drag hour/minute hands, digital + "quarter past" word forms) · 🔁 Unit converter · 📏 Units cards · ⚛ Periodic table · 🧪 Lab equipment · 🌿/🐾 Cells · 🌡 Interactive thermometer (tap to set −20…120 °C, °F/K conversion, key temperatures labelled) · 🎲 Randomisers (1–3 dice with pips, coin flip, animated 8-segment spinner, student name picker) · 📊 Tally chart builder (tap to count, gate-style tally strokes + live bar chart) · 🏅 Team scoreboard (2–4 named teams, giant scores) · 🅰 Letter & number formation (handwriting guide lines + traceable outlines A–Z, 0–9). **(b) An 181-card reference library** (📇 mode): curriculum reference cards across **Mathematics** (25: squares/cubes/roots, primes, divisibility, BODMAS, angles, triangles, quadrilaterals, circle, perimeter/area, volume, Pythagoras & trig, identities, quadratics, indices, logs, sets, Roman numerals, place value, number types, coordinate geometry, statistics, probability, interest, ratio, sequences), **Science** (30: SI units, motion, Newton's laws, energy, electricity, circuit symbols, magnetism, waves, light, matter, separation, acids/pH, reactions, formulas, valencies, reactivity series, body systems, digestion, heart, lungs, skeleton, senses, photosynthesis, food chains, classification, genetics, solar system, moon phases, water cycle, rocks, weather, machines, lab safety, first aid), **English** (12: phonics, parts of speech, punctuation, tenses, irregular verbs, affixes, figures of speech, letter/essay formats, comprehension, spelling, synonyms, sight words), **Social Studies** (8: continents, Nigeria facts, national symbols, ECOWAS, compass/maps, time zones, civic values, currencies), **ICT** (8: computer parts, shortcuts, binary, logic gates, flowcharts, internet safety, storage units, programming) and **Classroom** (5: class rules, Bloom's question stems, WAEC grading, study skills, phonics chart). Filter by category, **search across all cards**, tap left/right to flip. Everything is canvas-drawn → broadcastable, offline, crisp at any size. |
| 2 | **📐 Geometry construction simulator** | Mathematics teachers can now **simulate constructions live**: a grid "paper" with seven tools — **Ruler** (drag to draw segments; length displayed in grid units), **Compass** (press the centre, drag to the radius, release → full arc/circle), **Protractor** (drag from a vertex; a live protractor overlay measures the angle in degrees as you drag), **⊥ Perpendicular bisector** (drag a segment → red dashed bisector with equal-half tick marks), **∠ Angle bisector** (draw two segments from one vertex, then drag from it → green dashed bisector), **Point**, and **Eraser**. Endpoints **snap together** like real constructions (bisect a line, construct 60°, drop a perpendicular — exactly the WAEC/BECE construction syllabus). Undo and clear included; a hint bar explains every tool as you switch. |
| 3 | **🎨 Graph plotter backgrounds** | The grapher now has four selectable themes — **⬜ White**, **🟨 Cream** (low-glare), **⬛ Dark**, **🟩 Green board** (chalkboard look) — each with matched grid, axis and **high-contrast curve palettes** so plots remain readable on every background. The choice is remembered and is included in the broadcast. |
| 4 | **🤏 Zoom ratio sync fixed** | Diagnosed and fixed: the whiteboard canvas was being **stretched** to fill its broadcast pane, so students saw a different zoom ratio than the teacher (distorted horizontally vs vertically). The broadcaster now **letterbox-fits the board preserving its aspect ratio** — students see the identical view and identical zoom ratio. The image pane's pinch-zoom (which previously used a CSS transform invisible to the broadcast) is now also mirrored into the stream, centre-cropped exactly as the teacher sees it. (PDF zoom/scroll sync was fixed in v5; together all panes are now ratio-true.) |
| 5 | **🎬 YouTube-ready branded recording** | ⏺ now opens a setup dialog: enter **Subject, Topic, Class** and tick whether to include student cameras. The recording uses a dedicated 1280×720 canvas that composes: a **branded header** with the real **HMG ACADEMY logo** + "Subject — Topic" + class line, the **two split panes**, your **camera in a bottom-right PiP** (mirrored, amber border) whenever it is on, optionally up to **3 student camera tiles** stacked on the left edge, and a **footer** with "▶ HMG CONCEPTS on YouTube" + date/time, plus a REC dot. Saved as `HMG_Subject_Topic_Class_DATE.webm` at 1.2 Mbps — upload directly to the HMG CONCEPTS channel. Still uses the private pipeline (zero conflict with Meet/Zoom screen share). |
| 6 | **🧮 Calculator visible to students** | When the floating scientific calculator is open, a live calculator panel is rendered into the **top-right of the broadcast**: current expression/result in large monospace plus the last three history lines, with the DEG/RAD mode shown. Students watch every keystroke of the working. Close the calculator and it leaves the stream. |
| 7 | **📤 CSV quiz import** | In the 🏆 Quiz drawer: **Choose CSV file** with the exact format `Question, A, B, C, D, Correct option, Explanation/working`. A proper RFC-4180 parser handles quoted fields with commas; the header row is auto-detected; the correct option accepts A–D or 1–4; rows with problems are skipped and counted. Imported questions appear in the editable text box for review (explanations as `# …` lines) before you start. **Explanations are sent to each student** right after they answer (💡 under the ✅/❌ feedback) — instant corrective teaching. A **⬇ Sample CSV** button downloads a ready template. |
| 8 | **💼 Teacher licensing (SaaS revenue for HMG ACADEMY)** | Students always join free — nothing changes for them. **Teachers** now pass a license gate on the Studio: a **3-day free trial** starts automatically on first use (badge shows days left); after it expires the studio locks until they activate a personal **HMG ACCESS KEY** (name-bound, month-of-expiry encoded, SHA-256 signed — validated fully offline, no server). You generate keys on the private **admin.html** page using your secret phrase: teacher pays the small fee (Paystack/Flutterwave link or bank transfer — your choice), you type their name + expiry, send the key via WhatsApp. Renewals = a new key. ⚠ Before deploying, change `AUTH_SECRET` in `js/auth.js` and use the same phrase on admin.html. (For bank-grade licensing later, the README notes how to move validation to a free Cloudflare Worker.) |
| 9 | **📥 Analyst extras & fixes** | **Gradebook CSV export** (rank, student, score, room, date) from the quiz drawer for records and parent reports. `roundRect` **polyfill** added for older Android WebViews (keeps dice/recording graphics working on budget tablets). Service-worker shell updated (all core toolkit data, auxiliary pages, auth, admin page) and bumped to **v11.1.1** for clean auto-update. |

---

# 🆕 What was new in v5 (still here)

| # | Feature | Detailed explanation |
|---|---------|----------------------|
| 1 | **🖥 Student screen sharing** | Students get a 🖥 button: one tap shares their screen with you (show their working, their homework document, their error message). You can also *request* it from the roster (🖥 next to each name — they must consent). The shared screen appears **enlarged** in your 👥 drawer's media grid and the drawer opens automatically. Sharing stops from either side; if the student stops from the browser's own UI it is detected and cleaned up. |
| 2 | **🕐 Student lobby (join before the teacher)** | Students no longer get "class not found" if they're early. The join page puts them in a **lobby**: it quietly retries every 8 seconds and **auto-joins them the instant you go live** — with a wake-lock so their phone doesn't sleep. They can cancel waiting any time. Combine with the v4 waiting room if you also want manual admission. |
| 3 | **⚡ Professional reconnection (no more lost classes)** | Two halves: **(a) Teacher auto-resume** — if your studio reloads mid-class (crash, refresh, tablet restart), a green bar appears: "Your class was interrupted — ▶ Resume class now". One tap restarts the same room code. **(b) Student auto-reconnect** — students no longer drop to the join screen; they keep the stage with a "reconnecting" banner and silently retry with backoff for **up to 10 minutes**, snapping back the moment you're live again. Net effect: teacher leaves & re-enters → the class reassembles itself; nobody manually rejoins. |
| 4 | **🧰 Educational toolkit pane** | A new pane app (🧰 tab) packed with instructional materials, all **drawn locally on canvas** so they are crisp at any size, work offline, and are **included in the live broadcast and Meet/Zoom screen shares**: • **⚛ Periodic table** — all 118 elements, colour-coded by category with legend; tap any element for a detail card (name, atomic number, mass, category). • **🧪 Laboratory equipment** — 12 standard apparatus line diagrams (beaker, conical flask, burette, pipette, Bunsen burner, tripod & gauze…); tap one for an enlarged view with its use. • **🌿 Plant cell / 🐾 Animal cell** — labelled diagrams (nucleus, mitochondria, vacuole, chloroplasts, ribosomes, Golgi body, wall/membrane). • **📏 Units of measurement** — six reference cards (SI base units, metric prefixes, length, mass & volume, time & speed, common formulas); tap to flip. • **🔁 Unit converter** — Length, Mass, Time, Area, Volume, Speed, Temperature with live result rendered large for the class. • **✖ Multiplication table** — interactive up to 20×20; tap a cell and the row/column highlight with the product displayed huge. |
| 5 | **🔭 PDF zoom/scroll now syncs to students** | Bug fixed: the broadcast used to send the whole PDF page regardless of your zoom. Now the composite streams **exactly the visible region** — your zoom level and scroll position — so when you zoom into a diagram, students zoom with you (annotations included, correctly cropped). |
| 6 | **👩‍🏫 Multi-teacher, simultaneous classes** | The platform was already multi-tenant by design — every browser/device generates its **own room code**, giving each teacher an isolated star network on the same free deployment (PeerJS IDs never collide; bandwidth is per-teacher, not shared). v5 makes this explicit: an **↺ button beside the room code** instantly issues a fresh room (two teachers sharing one tablet, or a teacher running morning/evening groups), and the docs explain the model. Unlimited teachers can use one deployed URL at the same time, free. |
| 7 | **🔒 Private chat (Zoom feature)** | Students can tick "send privately to teacher only" — the message reaches you alone, marked 🔒. You can tick "reply privately" to answer just that student. Great for shy students or personal matters. |
| 8 | **🏷 Brand-embedded launch page** | The landing page now opens with the **official HMG ACADEMY logo** and a founder card — your photo, name, title ("AI-Augmented Solutions Developer · Data Scientist · STEM Educator — Lagos, Nigeria") and clickable links to all six HMG sites — so every user (and their parents) sees the brand and can become a customer. Both images were downloaded from your live sites into `assets/`. |
| 9 | **🐞 Bug fixes from deep diagnosis** | • **PIN race fixed** — the v4 PIN was applied via a 1.2 s `setTimeout` after Go Live; a fast student could join PIN-free. Now set atomically before the room opens, and Settings changes apply live. • **Media-call leak fixed** — when a student left, their camera/screen `MediaConnection`s were never closed (slow memory/socket leak across a long class). Now closed on drop. • **Composite-loop hardening** — pane draw errors can no longer kill the broadcast frame. • **Service-worker shell updated** — new files (toolkit.js, brand images) pre-cached; version bumped to v5.0.0 for clean auto-update. • **Lobby/cleanup paths** — student-side teardown now consistently releases wake-locks and PeerJS objects. |

---

# 🆕🆕🆕 What was new in v4 (still here)

v4 directly answers ten field-tested issues. Feature-by-feature:

| # | Feature | Detailed explanation |
|---|---------|----------------------|
| 1 | **🤏 Per-pane pinch zoom** | Every content pane now zooms **independently** with a two-finger pinch — zooming the PDF never touches the whiteboard beside it, and vice-versa. • **PDF:** two fingers pinch re-renders the page sharply at the new scale (0.3×–5×); one finger still scrolls. • **Whiteboard:** two fingers pinch-zooms (1×–6×) and pans the board view; ink thickness scales correctly; a live % label shows the zoom and **1:1** resets it; exports/broadcast always use the un-zoomed board. • **Image & Graph panes:** same two-finger gesture. |
| 2 | **🖥 Focus mode hides the browser bars too** | Tapping **🎯 Focus** now ALSO requests browser fullscreen, which removes Chrome's address bar and title bar — the two panes occupy the **entire physical screen**. Exiting (☰, Esc, or Android Back) restores everything. Best of all: when installed as a PWA from the home screen there is no address bar to begin with. |
| 3 | **🖥 ⛶ Fullscreen hides the platform menu too** | The ⛶ button is now "fullscreen = focus": one tap hides the platform's own top menu, the pane tabs, all toolbars AND the browser chrome together. The floating ☰ handle and mini tool capsule remain so you keep teaching. |
| 4 | **🔧 Join troubleshooting + visible PIN setting** | The Invite dialog now shows a **red warning when you are not yet LIVE** (the #1 reason students "can't join" — you must tap ▶ Go Live *before* they use the link), shows where the **Class PIN** lives (⚙ Settings → Class PIN) and displays the current PIN. It also warns if you're running from a `file://` path instead of your deployed https:// site (the second most common cause). The student join page explains the teacher must be live. Cameras both ways were already built in: students tap 📷 to share theirs (grid in your 👥 drawer), you tap 📷 Cam so they see you. See the **Troubleshooting** section below for the full checklist. |
| 5 | **🧮 Full scientific calculator** | Upgraded to a complete scientific calculator: trig (sin/cos/tan) with **inverse functions via 2nd**, **DEG/RAD** toggle, ln, log₁₀, eˣ, 10ˣ, xʸ, x², x³, √, ∛, n! (factorial), 1/x, ± , EXP (×10ⁿ), π, e, **Ans** (last answer), memory **M+ / M− / MR / MC**, and a **history tape** of recent calculations. Still draggable and visible inside broadcasts/screen shares. |
| 6 | **🤝 Zoom/Meet feature parity + app-agnostic companion** | New classroom features modeled on Zoom/Meet: **🚪 Waiting room** (students are held until you Admit/Deny — Admit-all button), **😀 emoji reactions** (👍 ❤ 😂 🎉 😮 👏 float up everyone's screens with the sender's name), **🔇 Mute all**, **🌟 Spotlight** (double-tap a name in the roster — every student sees "🌟 Name, it's your turn!"). And the companion mode is **app-agnostic**: the platform never cares which conferencing app shares the screen — Google Meet, Zoom, MS Teams, Jitsi or WhatsApp video all work identically (start call → share screen → switch to Class Deck). |
| 7 | **📈🎬 Two new pane apps** | Beyond whiteboard/PDF/browser/notes/image: • **📈 Graph plotter** — an offline Desmos-style function grapher: type `x^2-3*x+2`, `sin(x)`, `sqrt(x)`… plot **multiple coloured curves**, drag to pan, pinch or ± to zoom, automatic grid and axis labels; fully included in the composite broadcast (great for mathematics!). • **🎬 Video/audio player** — open local video or audio files (experiment clips, pronunciation recordings) with **0.25×–3× playback speed**; the picture is composited into the broadcast. |
| 8 | **🎥 Conflict-free recording** | The ⏺ recorder was re-architected: it now records from a **private composite-canvas stream + your microphone only**, and **never calls the screen-capture API**. Android only allows ONE screen capture at a time — that one now always belongs to Meet/Zoom. Result: you can screen-share on Meet/Zoom and record the lesson in Class Deck **simultaneously with zero conflict**. |
| 9 | **📷 Cameras in companion mode** | The **📷 Cam** button now stays available in companion mode. Toggling it shows your face in a **draggable, tap-to-resize** floating window (3 sizes) — and since Meet/Zoom is sharing your whole screen, **students automatically see you** through the share. For seeing *their* cameras, the new **📺 See students** button explains three free options: ① Meet/Zoom picture-in-picture floating over Class Deck (tap Home during the call), ② a second phone as a dedicated monitor, ③ the hybrid trick — students also open your Class Deck room and share cameras there (👥 grid) while Meet carries the audio. |
| 10 | **✏ Whiteboard power-up** | Already had pen/highlighter/eraser/line/arrow/rect/ellipse/text/laser, 6 colours, sizes, multi-page, undo/redo, grid/ruled/dark papers, autosave, PNG/PDF export, image stamps. v4 adds: **△ triangle, ◇ diamond, ☆ star** shapes, **🪣 filled-or-outlined** toggle for all shapes, **pinch zoom & pan**, and **✍ pen-only mode (palm rejection)** — by default writing **with your finger works perfectly** (finger = ink); flip on ✍ when you use your stylus so your resting palm/fingers pan instead of scribbling. |

### 🔧 Troubleshooting: "my student cannot join" (issue 4 checklist)
1. **Are you LIVE?** Students can only connect AFTER you tap **▶ Go Live** (the invite dialog warns you now). Order: Go Live → send link → they join.
2. **Are you on the deployed site?** The link must point to your `https://…pages.dev` address. If you open the app from a local file, the link you copy is useless to students.
3. **Same room code?** The link auto-fills it; if typing manually, note the code has no 0/O/1/I letters.
4. **PIN mismatch?** If you set a PIN (⚙ Settings → Class PIN), students must type exactly that PIN on the join screen. The invite dialog now displays the active PIN.
5. **Both online?** The first connection brokered via the free PeerJS cloud needs internet on both sides; afterwards media is direct peer-to-peer.
6. **Strict school/corporate Wi-Fi?** Rarely, a firewall blocks WebRTC. The built-in free TURN relay usually solves it; switching the student to mobile data confirms the diagnosis.

---

# 🆕🆕 What was new in v3 (still here)

| Feature | Detailed explanation |
|---|---|
| **🏆 Quiz engine with auto-scoring & leaderboard** | Open the 🏆 drawer, type questions in plain text (one block per question, `*` marks the correct option), set seconds-per-question, **Start quiz**. Students get a tap-to-answer card with a countdown; answers are scored automatically — 100 pts for an instant correct answer decaying to 50 pts at the time limit (speed bonus). You see a **live tally per option** (correct one highlighted green) and how many have answered; tap **Next question ➜** to advance, **End quiz** to publish the **top-10 leaderboard** to all students (gold/silver/bronze styling). Scores accumulate across quizzes in the same class; reset any time. **💾 Save bank** stores question sets on the device for reuse — write them once at home, load them in class. Late joiners automatically receive the current question. |
| **🧾 Whiteboard → PDF export** | The 🧾 button on the board toolbar renders **every page of the deck** into a single PDF using a built-in, zero-dependency PDF writer (no library, no upload, works offline). Perfect for sending "today's boards" to the class WhatsApp group after the lesson. |
| **🖼 Insert images onto the whiteboard** | The 🖼 board button stamps any photo/diagram onto the current page (auto-downscaled & JPEG-compressed so autosave stays light). Annotate around it with pen/highlighter; it undoes/redoes/exports like any stroke and is included in the live broadcast and PDF export. |
| **🔑 Class PIN (room security)** | Settings → set an optional PIN. Students must enter it on the join screen; wrong/missing PIN connections are rejected before they enter. Combine with 🔒 room-lock for the strictest setup: PIN to get in, lock once everyone has arrived. |
| **📈 Class analytics report** | 👥 drawer → **📈 Class report**: class duration, total joins, peak concurrent attendance, student chat-message count, quizzes run (with each winner), the current leaderboard and the full timestamped attendance log — previewed in-app and downloadable as a `.txt` file for your records or parents. |
| **💾 One-file backup & restore** | Settings → **Backup everything** downloads a single `.json` containing all ClassDeck data on the device (lessons, quiz banks, notes, boards, settings, branding). **Restore from file** imports it on a new/repaired tablet in seconds. Move devices without losing a single board. |
| **🎨 White-label branding** | Settings → set your **academy name** (replaces the broadcast watermark, e.g. "HMG Academy") and pick an **accent colour** — rebrand without touching code. Useful when other teachers/franchises use your deployment. |
| **🧮 Floating calculator** | Toolbar 🧮 opens a draggable calculator (÷ × − + ( ) % √ x² π). It floats above both panes — and because it is part of the app, it appears in the composite broadcast and in Meet screen shares, so students see the working. |
| **⌨ Keyboard shortcuts** | With a USB/Bluetooth keyboard: `P` pen, `H` highlighter, `E` eraser, `L` laser, `R` rectangle, `O` ellipse, `A` arrow, `T` text, `Ctrl+Z`/`Ctrl+Y` undo/redo, `PageUp`/`PageDown` board pages, `F9` toggle focus mode, `Esc` exit focus. |

---

# 🆕 What was new in v2 (still here)

| Feature | What it does |
|---|---|
| **🟢 Meet Companion mode** (`?meet=1`) | Hides all built-in live-class buttons (Meet handles the call), shows a green MEET COMPANION badge, switches wake-lock on immediately, and remembers focus mode across refreshes. Launchable from the landing page, an app-icon shortcut (long-press the installed icon), or the URL. |
| **🎯 Focus mode** | One tap hides the top bar, pane tabs and every toolbar — the workspace fills 100% of the screen (the “full display” in your screenshot). Exit via the translucent ☰ handle, `Esc`, or toggle with `F9`. |
| **🛟 Floating mini-toolbar** | In focus mode a small translucent capsule keeps pen / highlighter / eraser / laser, undo, board page ‹ › ＋ and layout-cycle within reach, without occupying screen space (it fades to 55% opacity until touched). |
| **✏ PDF annotation overlay** | Tap **✏ Annotate** in the PDF pane and draw directly on the page (red pen by default — underline, circle, solve on top of the example). Annotations are kept **per PDF page**: flip to page 7 and back, your page-3 markings are still there. 🧹 clears the current page. Annotations are also included in the v1 composite broadcast. |
| **🔴 Laser pointer** | A whiteboard tool that leaves a bright red trail which fades away in ~1.4 s and is never saved — perfect for “look HERE”. |
| **📚 Lesson manager** | Save the entire whiteboard deck (all pages) under a lesson name; reload any deck in one tap; prepare boards before class; export/import decks as `.json` files to move between devices or share with colleagues. |
| **🌑 Dark board** | New chalkboard-style background (white/colour ink on dark) alongside plain/grid/ruled. |
| **↔ Divider double-tap** | Double-tap the split divider to snap back to 50/50. |
| **📱 Mobile/system-friendly polish** | Tighter toolbars below 520 px width, slimmer chrome in low-height landscape (tablets/phones held sideways), brand label auto-hides on small screens, all controls touch-sized, wake-lock + exit-guard retained. The whole app is still ~2.7 MB and runs offline. |

---

# 📚 Full feature guide (what every feature does and how to use it)

## 1. The split-screen workspace (teacher)

### 1.1 Two panes, five apps each
Each pane (Left / Right) has tabs: **✏ Whiteboard · 📄 PDF · 🌐 Browser · 🗒 Notes · 🖼 Image**.
Tap a tab to switch what that pane shows. Your choice is remembered between sessions.
Typical setups:
- *Whiteboard + PDF* — solve questions next to the textbook.
- *Whiteboard + Browser* — derive a formula next to Desmos/GeoGebra/Wikipedia.
- *PDF + Notes* — read material while building a summary.

### 1.2 Resizable divider, layout cycling, swap
- **Drag the centre divider** to resize panes (20%–80%), with touch support.
- **◫ Layout button** cycles: Split → Left-only → Right-only → Split. Use a single
  full-width whiteboard when you need writing space, then return to split.
- **⇄ Swap button** exchanges the two panes instantly.
- **⛶ Fullscreen** hides the Android status bar for maximum teaching area.

### 1.3 Whiteboard (✏)
- **Tools:** pen, highlighter (semi-transparent), eraser, straight line, arrow,
  rectangle, ellipse, text stamps, and the new **🔴 laser pointer** (v2).
- **6 colours + stroke-size slider.**
- **Smooth ink:** strokes use coalesced pointer events + quadratic smoothing, so
  handwriting looks natural even on budget tablets.
- **Multi-page:** ‹ › navigate, ＋ adds a page, ✕ deletes. The page counter floats
  at the bottom.
- **Paper styles:** plain, grid, ruled, or **dark chalkboard** (v2) background.
- **Undo / Redo / Clear page.**
- **Autosave:** every stroke is saved to the device (localStorage). Close the
  app, reopen tomorrow — your boards are still there.
- **⬇ Export:** save the current page as a PNG (share to WhatsApp/Telegram after class).
- Strokes are stored as *vectors* (relative coordinates), so resizing the pane
  or rotating the tablet never blurs or crops your writing.

### 1.4 PDF reader (📄)
- Powered by Mozilla **PDF.js** (bundled locally — works offline).
- **Open PDF** button or drag-and-drop. The file is read locally; *nothing is uploaded anywhere.*
- Page ‹ ›, jump-to-page box, zoom −/＋, and **Fit** (fit-to-width).
- **✏ Annotate (v2):** draw straight onto the PDF page; markings are stored per
  page and survive page flips. 🧹 clears the current page's markings.
- The rendered page (plus annotations) is included in the live broadcast automatically.

### 1.5 Browser (🌐)
- An embedded browser pane with URL bar, reload, back, and quick links
  (Wikipedia, OpenStreetMap, Desmos, GeoGebra, Archive.org — all embed-friendly).
- **Honest limitation (browser security, not a bug):** sites like Google and
  YouTube refuse to load inside iframes, and browsers forbid *capturing* iframe
  pixels into the broadcast. So in the default **Composite broadcast mode**
  students see a placeholder card for the raw iframe. Reader Cast is the normal workaround: it renders readable page content into a broadcastable canvas. For arbitrary live pages, use Share screen or a PDF/Image:
  1. Use the **embed-friendly quick links** (Desmos/GeoGebra render fine for you locally).
  2. Switch Settings → Broadcast mode → **Share screen** (on devices/browsers
     that support `getDisplayMedia`) — then students see *everything*, browser included.
  3. Save the web page as PDF/screenshot and open it in the PDF/Image pane (fully broadcastable).

### 1.6 Notes (🗒)
- A big legal-pad style text area. Auto-saves on the device as you type.
- Its text **is rendered into the broadcast** (with word-wrap), so you can type
  live notes that students see.
- Export as `.txt` with one tap.

### 1.7 Image viewer (🖼)
- Open or drop any image (diagrams, past-question photos, charts).
- Scales to fit and is included in the broadcast.

---

## 2. The live classroom

### 2.1 How it works (free architecture)
- Built on **WebRTC** via **PeerJS** with the free public PeerJS cloud broker
  for signalling, Google **STUN** and the free **OpenRelay TURN** servers for
  NAT traversal. Audio/video flows **peer-to-peer, DTLS-encrypted** — there is
  no media server and no bill.
- The teacher is the hub (star topology). Recommended class size on a tablet
  over mobile data: **up to ~10–15 students** receiving the stage stream
  (each student costs upload bandwidth). On Wi-Fi with a decent connection,
  20+ is feasible at the default 720p/8fps.

### 2.2 Go Live + invite
1. Tap **▶ Go Live**. Allow the microphone when asked (so students hear you).
2. Tap **🔗 Invite**. Share the link (one tap copies it) or let students scan
   the **QR code**. The room code (e.g. `K7M2QX`) is stable across sessions
   unless you ask for a new one in Settings.
3. Students open the link on **any** phone/tablet/laptop browser — no install,
   no account — type their name, and they're in.

### 2.3 The broadcast ("full display / laptop look")
- **Composite mode (default, perfect for tablets):** the app continuously paints
  *both panes* onto an internal 1280×720 canvas — pane titles, split divider,
  whiteboard ink, PDF page, notes text, images, plus a small clock watermark —
  and streams that canvas. Students' screens show one clean 16:9 video that
  fills their display (`join.html` even auto-requests fullscreen), exactly like
  a laptop share. Because this is canvas-based, **Android split-screen, app
  switching or memory pressure can never kill it** — there is no second app.
- **Share-screen mode (Settings):** uses `getDisplayMedia` where supported
  (laptops, some Android Chrome versions) to stream the real screen including
  the browser pane.
- **Quality presets:** 720p@8fps (default, great on 3G/4G), 720p@15fps,
  1080p@10fps. Lower fps = much lower data usage; handwriting still looks live.

### 2.4 Teacher camera (students see you) 📷
- Tap **📷 Cam**: your front camera streams to all students and appears for them
  as a **movable picture-in-picture** window over the stage (they can drag it).
  Tap again to turn it off any time. A mirrored self-view shows in your corner.

### 2.5 Student camera monitoring (the Meet-on-tablet fix) 👥
- Open the **👥 Students drawer**:
  - **Roster** with live join/leave and ✋ hand-raised indicators.
  - Per-student buttons: **📷 ask camera on/off**, **🎙 grant/revoke mic**, **✕ remove**.
  - **📷 Ask all cams** requests every student's camera at once.
  - Incoming student cameras appear in the **camera grid**; tap a tile to
    enlarge it. Student cams stream at 480p/12fps to stay light.
- Students are always asked to consent before their camera turns on.

### 2.6 Hand raise & speaking control ✋🎙
- Students tap ✋; you get a toast and the roster shows it.
- Mics are **off by default for students**. You grant the mic per-student
  (🎙 in the roster); their audio then plays on your device and they can ask
  their question. Revoke with the same button. No more talking over each other.

### 2.7 Class chat & announcements 💬📢
- Two-way chat drawer (teacher ↔ all students). Messages are HTML-escaped (safe).
- **📢 Announcement** pushes a full-screen modal onto every student device —
  impossible to miss ("Submit exercise 3 now").

### 2.8 Instant polls 📊
- Open **📊**, type a question + options (2–6), **Start poll**.
- Students get a tap-to-answer modal; you watch **live result bars**; ending the
  poll publishes the percentages to students. One vote per student enforced.

### 2.9 Attendance register 📋
- Every join and leave is logged with a timestamp.
- **📋 Attendance CSV** downloads the register (opens in Excel/Sheets) — useful
  for records, parents, or paid-class verification.

### 2.10 Lesson recording ⏺
- **⏺ Rec** records the broadcast (video + your mic) locally with MediaRecorder
  at up to about 2.5 Mbps depending on browser settings. Stop to save a `.webm` (or `.mp4` where MediaRecorder supports it) to your downloads. Share it on
  WhatsApp/Telegram or upload to YouTube later. No cloud cost.

### 2.11 Security / order controls 🔒
- **Lock room:** once everyone has arrived, lock it; new connections are rejected.
- **Remove student:** kicks a participant immediately.
- **Random room codes** (unambiguous alphabet, no 0/O/1/I), regenerate any time.
- WebRTC media is end-to-end DTLS-SRTP encrypted between you and each student.

### 2.12 Timers & clock ⏱
- The top-bar chip shows elapsed class time once live.
- **⏱ Countdown timer** (1/2/5/10 min or custom) for exercises; students are
  notified when it starts and when time is up.

### 2.13 Resilience (the anti-logout features)
- **Screen Wake Lock** keeps the tablet awake during class (toggle in Settings).
- **Auto-reconnect:** if the signalling connection drops (network blip), the
  teacher side silently reconnects; students keep the stage and retry joining with backoff for up to about 10 minutes, then return to the join screen if the teacher is still unavailable.
- **Exit guard:** the browser warns you before accidentally closing the tab
  while students are connected.
- **Late joiners** automatically receive the current stage + teacher cam + any
  running poll the moment they connect.

---

## 3. Platform / "enterprise-grade on free tools" features

- **Installable PWA:** manifest + service worker → "Add to Home screen" on
  Android, runs full-screen standalone like a native app, with app shortcuts
  ("Start a class", "Join a class", "Solo workspace").
- **Offline-first shell:** all core code, the PDF engine, toolkit data, auxiliary pages and icons are cached;
  whiteboard/PDF/notes work with zero internet (live class obviously needs it).
- **No build step:** plain HTML/CSS/JS. Edit any file, refresh, done. Easy for
  HMG Technologies to maintain and brand.
- **Self-contained vendor libs:** PeerJS, PDF.js (+worker) and QRCode.js are
  bundled in `/vendor` — no CDN dependency at class time.
- **Privacy by design:** PDFs, images, notes, whiteboards and recordings never
  leave the device; only live WebRTC streams go out, peer-to-peer.
- **State persistence:** whiteboard pages, notes, pane layout, split position,
  settings and room code all survive restarts (localStorage).
- **Branding-ready:** colours in `css/style.css` `:root` variables; icons in
  `/assets`; footer links to the whole HMG family of sites.

---

## 4. Repository layout

```
platform/
├── index.html              Landing page
├── teach.html              Teacher Studio
├── join.html               Student view
├── manifest.webmanifest    PWA manifest (name, icons, shortcuts)
├── sw.js                   Service worker (offline cache)
├── css/style.css           All styling (CSS variables for branding)
├── js/
│   ├── common.js           Toasts, modals, storage, wake-lock, PWA install
│   ├── whiteboard.js       Vector whiteboard engine
│   ├── rtc.js              TeacherRoom / StudentRoom (PeerJS WebRTC)
│   ├── teach.js            Studio controller + composite broadcaster
│   └── join.js             Student controller
├── vendor/                 peerjs / pdf.js / pdf worker / qrcode (bundled)
├── assets/                 App icons (96/192/512/apple-touch)
└── docs/
    ├── DEPLOYMENT.md       Step-by-step deployment (GitHub & Cloudflare Pages)
    └── USER_GUIDE.md       Printable quick guide for you and your students
```

---

## 5. Deployment (summary — full detail in `docs/DEPLOYMENT.md`)

> ⚠ **HTTPS is mandatory** — camera, microphone, wake-lock and service workers
> only work on `https://` (or `localhost`). Both options below give free HTTPS.

### Option A — Cloudflare Pages (recommended; matches your `*.pages.dev` brand)
1. Push this folder to a GitHub repository (steps below).
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
3. Select the repo. Framework preset: **None**. Build command: *(empty)*.
   Build output directory: **`/`** (or `platform` if the repo root contains the folder).
4. **Save and Deploy** → you get `https://hmgclassdeck.pages.dev`.

### Option B — GitHub Pages
1. Push to GitHub → repo **Settings → Pages** → Source: `main` branch, `/ (root)`.
2. Wait ~1 minute → `https://<username>.github.io/<repo>/`.

### Pushing to GitHub (first time)
```bash
cd platform
git init
git add .
git commit -m "HMG ClassDeck v1.0"
git branch -M main
git remote add origin https://github.com/<your-username>/hmg-classdeck.git
git push -u origin main
```

### Updating later
Edit files → bump `CACHE_VERSION` in `sw.js` → commit & push → hosting redeploys
automatically; users get the update on next refresh.

---

## 6. Quick classroom workflows (cheat sheets)

### A) Teaching over Google Meet (your main flow)
1. Install ClassDeck on your tablet (browser menu → *Add to Home screen*).
2. Prepare: long-press the ClassDeck icon → **Teach on Google Meet** (or open it
   and tap the green card) → load your PDF in the right pane, optionally open a
   saved lesson deck (📚).
3. Start your **Google Meet** class as normal → **Share screen → entire screen**.
4. Switch to ClassDeck (recent-apps button). Meet keeps sharing in the background.
5. Tap **🎯 Focus** — toolbars vanish, students see the clean split workspace.
6. Teach. Use the floating capsule for pen/eraser/laser/pages; ☰ brings the full
   toolbars back whenever needed.
7. When done, return to Meet and stop sharing/end the call.

### B) Built-in live classroom (no Meet)
1. Open **Teacher Studio** → left pane Whiteboard, right pane PDF → open your material.
2. **▶ Go Live** → allow mic → **🔗 Invite** → send link to your class WhatsApp group.
3. Optional: **📷 Cam** so students see you; **⏺ Rec** to record.
4. Teach: write, scroll the PDF, drag the divider — students see everything live.
5. Use 👥 to monitor cameras, ✋/🎙 to let students speak, 📊 for checks, ⏱ for exercises.
6. **⏹ End** → download 📋 attendance → recording is already in your downloads.

---

## 7. Known limitations (and the honest reasons)

- **Raw browser iframe isn't in the composite broadcast** — web security forbids
  reading iframe pixels. Use Share-screen mode or PDF/Image instead.
- **Class size** is bounded by *your* upload bandwidth (star topology).
  Lower the quality preset for big classes on mobile data.
- **Free PeerJS cloud** brokers connections on a best-effort basis. If it is
  ever down, you can self-host `peerjs-server` free on Render/Railway and
  change `PEER_CONFIG` in `js/rtc.js` (documented inside the file).
- iOS Safari students must tap the “Start class view” button once (autoplay policy) — the app shows it automatically.

---

Built with ❤ for **HMG Academy** · [cssadewale.pages.dev](https://cssadewale.pages.dev) ·
[hmgconcepts.pages.dev](https://hmgconcepts.pages.dev) · [hmgacademy.pages.dev](https://hmgacademy.pages.dev) ·
[hmgtechnologies.pages.dev](https://hmgtechnologies.pages.dev) · [hmgmedia.pages.dev](https://hmgmedia.pages.dev) ·
[hmggospel.pages.dev](https://hmggospel.pages.dev)

License: MIT (see `LICENSE`).
