# Tutoring Connect — deployment (clear, unambiguous)

A product of **HMG Technologies**, a subsidiary of **HMG Concepts** (*His Marvellous Grace*). Founder: **Adewale Samson Adeagbo**. WhatsApp [+234 810 086 6322](https://wa.me/2348100866322).

This guide deploys a **generated client studio** (ADEWALE CLASSROOM or any studio the builder stamps). It does **not** deploy the generator as a parent-facing site.

## What you are deploying

| Piece | What it is | Cost |
|---|---|---|
| Static PWA | HTML / CSS / JS. Host on Vercel, Netlify, GitHub Pages or Cloudflare Pages | Free |
| One Supabase project | Postgres + Auth + RLS. **One project per studio** | Free tier |
| Messaging | `wa.me` / `mailto:` / `sms:` | Free |
| Media | Google Drive / YouTube / https **links** | Free (your Drive) |
| AI | None. Prompt packs are copy-paste into a chat **you** already use | ₦0 |

There is **no** paid AI API and **no** file upload into the 500 MB database.

## Release zips

`tutoring-connect.zip` contains **only**:

1. `tutoring-connect-generator.zip` — HMG staff open `index.html` → `builder.html`.
2. `adewale-classroom.zip` — the generated client. **No builder.** Parents see “Sign in to portal”.
3. `README-RELEASE.txt`

Rebuild after source changes: `bash tutoring-connect/tools/pack-release.sh`.

---

## A. Deploy ADEWALE CLASSROOM (or any generated studio)

### 1. Unzip the **client** package

Unzip `adewale-classroom.zip`. You should see `index.html` titled **ADEWALE CLASSROOM — official tutoring portal**. There must be **no** `builder.html`.

### 2. Create a free Supabase project

1. Go to [https://supabase.com](https://supabase.com) and create a project (region: close to Lagos if offered).
2. Wait until the project is healthy.
3. Open **SQL Editor**.
4. Paste **the entire** `database/complete-schema.sql` (it already includes v2 bookings/SOW/quizzes, v3 stream/exams, v4 notifications/audit/library, v5 makeup credits/study log, keep-alive and Drive columns).
5. Run it. You should see the success notices.
6. If this studio was installed **before** v5, also run `database/v4-enterprise-parity.sql` then `database/v5-ops-parity.sql`.

### 3. Turn on Auth

1. Authentication → Providers → **Email** on.
2. Confirm email: leave on (free). Parents click the confirm link, then wait for **Approvals**.
3. Optional: Authentication → URL configuration → add your live origin (`https://yourstudio.vercel.app`) and `http://localhost:5500` for local preview.

### 4. Paste keys

Open `assets/js/config.js`. Replace:

```js
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

with Project Settings → API → **Project URL** and **anon public** key.

Never put the **service_role** key in the website.

### 5. Host the folder

Any static host. Bind to the public internet (not `127.0.0.1` only).

**Vercel:** `vercel` in the folder, or drag-drop. `vercel.json` already pings `/api/keepalive` daily.

**Netlify:** drag the folder. `_headers` is included.

**GitHub Pages:** push the folder, enable Pages. Add `.nojekyll` (already in the zip).

**Cloudflare Pages:** upload the folder.

### 6. Create the first admin

1. Open `/login.html` → Request access as **Studio admin**.
2. Confirm the email.
3. In Supabase → Table Editor → `profiles` → set that row `role = admin` and `status = approved`.
4. Sign in. You should land on `dashboard.html`.

### 7. First-day studio checklist

1. **Settings** — name, motto, timezone `Africa/Lagos`, currency `₦`, logo **URL**.
2. **Subjects** — WAEC / IGCSE / SAT / IELTS as you teach them.
3. **Tutors** + **Availability**.
4. **Learners** (student IDs auto-issue `TC-0001`…) and **Parents**, then link them.
5. **Engagements** — one row per 1:1 or named group. Seat members. Never share a sibling’s contract.
6. **Scheme of work** for the term.
7. **Cycle bookings** — 4 × 7 days. 2×/cycle = 8 classes.
8. **Platform Health** — press 💓 heartbeat. Confirm it writes.
9. **Admin Data** — follow `docs/GOOGLE-DRIVE-SYNC-GUIDE.md` (GIS + `drive.file`).
10. **Approvals** — only people you recognise.

### 8. Keep-alive (do not skip)

Free Supabase **pauses** after ~7 days idle. The product ships **10 layers**. Minimum viable:

| Layer | What you do |
|---|---|
| 1 Site visit | Automatic. Every visitor calls `tc_keep_alive('site-visit')` once/day. |
| 2 GitHub Action | Push the repo; the workflow already calls the RPC Mon/Thu. Add secrets `SUPABASE_URL` + `SUPABASE_ANON_KEY`. |
| 3 Edge ping | Deploy `supabase/functions/ping`. Point UptimeRobot at it; keyword `heartbeat written`. |
| 4 pg_cron | Installed by the SQL if the extension exists. |
| 5 Health page | Owner presses 💓 before a long holiday. |
| 6 cron-job.org | Daily GET of the edge ping or `/api/keepalive`. |
| 7 Vercel Cron | Already in `vercel.json` → `/api/keepalive`. |
| 8 Apps Script | Optional time-driven URL fetch. |
| 9 Self-commit | Optional; see `SUPABASE_FREE_TIER_PROTECTION.md`. |
| 10 Auto-restore | Optional GitHub Action with `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF`. |

Full detail: `SUPABASE_FREE_TIER_PROTECTION.md`.

### 9. Google Drive backup

Admin Data → Drive card. Client ID from Google Cloud (GIS, scopes `drive.file` only). Archives are SHA-256 sealed. Guide: `docs/GOOGLE-DRIVE-SYNC-GUIDE.md`.

---

## B. Use the generator (HMG staff only)

1. Unzip `tutoring-connect-generator.zip`.
2. Serve the folder (any static server). Open `index.html` — you should see **Open Authorized Builder**, not “Sign in to portal”.
3. `builder.html` → 6 steps: studio name, logo **URL**, theme, font, layout, modules, optional keys.
4. Generate. The downloaded ZIP is a **client** site (`site-index.html` becomes `index.html`). It does **not** contain the builder.
5. Hand that ZIP to the studio and follow section A.

Quote (HMG internal): base **₦35,000** + **₦4,500**/module + optional add-ons. WhatsApp the estimate from the last step.

---

## C. Roles and family safety

| Role | Sees |
|---|---|
| Admin / owner / director / lead tutor | Everything, including Access Manager on the dashboard |
| Tutor / staff | Teaching modules; not payroll/finance/safeguarding unless granted |
| Parent | Only mapped children: classes, scores, invoices, inbox |
| Learner / student | Only themselves. Sit quizzes with **student ID** `TC-0001` |

Siblings and groups **do not** share scores. Group forum exists only on **group** engagements.

---

## D. What “done” looks like

- Parent opens the live URL and sees **ADEWALE CLASSROOM** (or their studio name) and **Sign in to portal**.
- After sign-in they see next classes with **date, time, duration** from the 4-cycle booking.
- A graded quiz sat with `TC-0001` appears on the scoresheet without anyone typing a name.
- Platform Health heartbeat increments.
- Footer and JSON-LD point at the **client site and** hmgconcepts / hmgtechnologies / cssadewale.

If any of those fail, do not call the studio “live”.
