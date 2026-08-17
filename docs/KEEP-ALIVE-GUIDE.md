# Keep-alive guide — stopping Supabase from pausing your studio

**The problem in one sentence:** Supabase pauses a **free** project after **7
consecutive days without database activity**, and a project left paused is
eventually **deleted (~90 days)**.

This guide explains exactly what counts as activity, what this platform does
about it automatically, the one 5-minute setup you should still do by hand, and
how to recover if it ever happens.

---

## 1. What actually counts as "activity"

This is where most people get caught. **Only real database activity resets the
timer.**

| Does it reset the 7-day timer? | |
|---|---|
| A REST/RPC call that reads or writes Postgres | ✅ **Yes** |
| An Edge Function that queries the database | ✅ **Yes** |
| Opening the Supabase dashboard | ❌ No |
| Visiting your deployed website | ❌ No — unless it queries the DB |
| An API route that returns a cached/static response | ❌ No |
| Having users who never trigger a query | ❌ No |

> Your site can have traffic and still be paused, if that traffic never reaches
> Postgres.

This is why every keep-alive layer in this platform calls the
`tc_keep_alive()` RPC, which performs a genuine `INSERT`/`UPDATE`. A ping that
merely returns `200 OK` from a static endpoint is worthless.

### Why `pg_cron` alone cannot save you

The obvious idea — schedule a job inside Postgres — is a **circular dependency**:
`pg_cron` runs *inside* the database, so when the project pauses the scheduler
pauses with it and can never wake it up. We do install a `pg_cron` job, but only
as a bonus layer while the project is already awake. **Never rely on it.**

---

## 2. The layers this platform ships

| # | Layer | Trigger | Reliability | Setup |
|---|---|---|---|---|
| 1 | Page-visit heartbeat | Any signed-in page load (throttled 1×/6h per device) | Only if someone visits | Automatic |
| 2 | Tab-focus heartbeat | Returning to the tab | Only if someone visits | Automatic |
| 3 | Interval heartbeat | Every 6h while a tab is open | Only if a tab is open | Automatic |
| 4 | **Browser self-heal** | Any owner visit when state is stale | Repairs on sight | Automatic |
| 5 | **GitHub Action** *Keep Supabase Alive* | **Every 2 days**, 3 retries | High | 2 min (secrets) |
| 6 | **GitHub Action** *Keep-Alive Watchdog* | **Daily** read-only check + self-heal + alert | High | Same secrets |
| 7 | Vercel cron → `/api/keepalive` | Daily (Hobby max) | Medium | Env vars |
| 8 | Supabase Edge Function `/functions/v1/ping` | Whenever called | Depends on caller | 2 min deploy |
| 9 | **External scheduler** (cron-job.org) | Daily, independent of GitHub | **Highest** | 5 min ⭐ |
| 10 | Uptime monitor (UptimeRobot) | Every 5 min | High | 5 min |
| 11 | `pg_cron` internal job | Every 2 days *while awake* | Bonus only | Automatic |
| 12 | **Google Apps Script** (`tools/keepalive.gs`) | Daily, on Google's servers | High — independent of GitHub *and* Vercel | 5 min ⭐ |
| 13 | **Auto-restore watchdog** | Daily — actually **un-pauses** a paused project via the Supabase Management API | Recovery | 3 min |
| 14 | Sealed Drive/local backups | Weekly | Recovery, not prevention | See Drive guide |

### Honest reliability note

**GitHub Actions cron is not guaranteed.** GitHub states scheduled workflows may
be delayed, and under heavy load they can be **skipped entirely**. That is why:

* the schedule is **every 2 days**, not weekly — three consecutive runs must fail
  before the 7-day window closes;
* a **separate daily watchdog** checks health and self-heals;
* and you are strongly advised to add **layer 9**, which does not depend on
  GitHub at all.

**Vercel Hobby cron** runs at most **once per day**, with ~±59 minutes of
precision, and Vercel does not guarantee timely execution. Fine as redundancy;
not sufficient alone.

---

## 3. Setup — do these three things

### 3.1 GitHub secrets (2 minutes) — required

1. Your repo → **Settings** → **Secrets and variables** → **Actions**.
2. **New repository secret**, twice:
   * `SUPABASE_URL` → `https://xxxxxxxx.supabase.co`
   * `SUPABASE_ANON_KEY` → your **anon/public** key (never `service_role`)
3. **Actions** tab → enable workflows if prompted.
4. Open **Keep Supabase Alive** → **Run workflow** to test immediately.

**Confirm:** the run is green and the log prints `✅ Heartbeat written.` followed
by `✅ Verified.`

### 3.2 External scheduler (5 minutes) — strongly recommended ⭐

This is the layer that does not depend on GitHub, Vercel or anyone visiting your
site. **cron-job.org** is free, supports custom headers, and emails you on failure.

1. Create a free account at <https://cron-job.org>.
2. **Create cronjob**.
3. **Title:** `Supabase keep-alive — <your studio>`
4. **URL:** `https://xxxxxxxx.supabase.co/rest/v1/rpc/tc_keep_alive`
5. **Schedule:** every day (any time).
6. **Advanced → Request method:** `POST`
7. **Advanced → Headers**, add three:
   ```
   apikey: <your anon key>
   Authorization: Bearer <your anon key>
   Content-Type: application/json
   ```
8. **Advanced → Request body:** `{"src":"cron-job.org"}`
9. Enable **notifications on failure**.
10. Press **TEST RUN** — you must see **200 OK**.

**Alternative without headers:** deploy the Edge Function (§3.3) and point the
job at `https://xxxxxxxx.supabase.co/functions/v1/ping` with a plain `GET`. No
headers needed, which suits monitors that cannot send them.

### 3.3 Edge Function (2 minutes) — optional but useful

```bash
supabase functions deploy ping --no-verify-jwt
```

`--no-verify-jwt` is what makes it callable with **no headers at all**, so any
free monitor can hit it. It exposes nothing sensitive — it writes a heartbeat and
returns counters.

Test it:

```bash
curl https://xxxxxxxx.supabase.co/functions/v1/ping
```

Expected:

```json
{ "status": "alive", "state": "healthy", "days_until_pause_risk": 6.99, ... }
```

It returns **503** if the database write fails, so uptime monitors correctly
report a failure instead of staying green.

### 3.4 Google Apps Script — layer 12 (5 minutes) ⭐

Runs on **Google's** servers using only the studio's Gmail. Independent of
GitHub and Vercel, so a problem with either account cannot silence it. It also
**emails you** when the heartbeat fails or the state turns critical — and stays
silent when healthy.

1. Open <https://script.google.com> → **New project**.
2. Paste the whole of `tools/keepalive.gs`.
3. Edit the three CONFIG values at the top (URL, anon key, alert email).
4. **Run ▸ pingSupabase** once and authorise it
   (*Advanced → Go to project (unsafe)* — it is your own script).
5. **⏰ Triggers → Add Trigger** → `pingSupabase` → Time-driven → **Day timer**.

**Confirm:** the execution log shows `✅ heartbeat written`.

### 3.5 Auto-restore — layer 13 (3 minutes)

The only layer that can rescue a project that has **already** paused. It calls
the Supabase Management API's restore endpoint — the same action as pressing
*Restore project* in the dashboard.

1. <https://supabase.com/dashboard/account/tokens> → **Generate new token**
   (name it `auto-restore`). It starts `sbp_`.
2. GitHub → Settings → Secrets and variables → Actions → add:
   * `SUPABASE_ACCESS_TOKEN` → the `sbp_…` token
   * `SUPABASE_PROJECT_REF` → the 20-character ref from your dashboard URL
3. `supabase-auto-restore.yml` now checks daily and un-pauses automatically.

> Treat `SUPABASE_ACCESS_TOKEN` as a password — it can administer your projects.
> It lives only in GitHub Secrets and never in the site.

### 3.6 UptimeRobot (optional, 5 minutes)

Free plan: 50 monitors, 5-minute interval. Create an **HTTP(s)** monitor pointing
at your `/functions/v1/ping` URL. You get pinging *and* downtime email alerts.

---

## 4. Verifying it works

### In the app
Sign in as an owner → **Platform health**. The keep-alive widget shows:

* **State** — ✅ Healthy (<3 days), ⚠️ Stale (3–5), 🛑 Critical (>5)
* **Since last heartbeat** and **margin before pause risk**
* **Total heartbeats** and the **source** of the last one
* A **Write heartbeat now** button

If an owner opens any page while the state is stale, the platform **writes a
recovery heartbeat automatically** and shows a banner.

### From a terminal

```bash
curl -X POST "https://xxxxxxxx.supabase.co/rest/v1/rpc/tc_keep_alive_status" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  -H "Content-Type: application/json" -d '{}'
```

```json
{"state":"healthy","days_since":0.4,"days_left":6.6,"ping_count":152, ...}
```

### Weekly habit
Glance at GitHub → **Actions**. Two green workflows = you are safe.
An **open issue labelled `keep-alive`** means something needs attention — the
watchdog opens one automatically and closes it when health returns.

---

## 5. If the project is already paused

Nothing is lost — a paused project is frozen, not deleted.

1. Go to <https://supabase.com/dashboard>.
2. Select the project → **Restore project**.
3. Wait 2–5 minutes for `Active`.
4. Run a quick query to confirm the data is there.
5. GitHub → **Actions** → run **Keep Supabase Alive** manually.
6. Work out *which layer stopped*: expired secrets? Actions disabled? external
   scheduler deleted? Fix that, or it will simply happen again.

> ⏳ **Do not leave it paused.** Free projects that stay paused are eventually
> deleted permanently, and free-tier projects have no downloadable Supabase
> backups. Your protection is the sealed Drive/local backup — see
> `GOOGLE-DRIVE-SYNC-GUIDE.md`.

---

## 6. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Platform health says "run v9 SQL" | `tc_keep_alive_status` missing | Run `database/v9-keepalive-and-drive.sql` |
| Workflow fails: secrets not set | Missing/renamed secrets | Re-add `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| Workflow green but state still stale | Pinging the wrong project | Check the URL matches `config.js` |
| `42501 permission denied for table tc_heartbeat` | Old schema (pre-V9) | Run the V9 SQL — clients read the status RPC now |
| Edge function 404 | Never deployed | `supabase functions deploy ping --no-verify-jwt` |
| Edge function 401 | JWT verification still on | Redeploy with `--no-verify-jwt`, or send the anon key |
| Scheduled workflows stopped after months | GitHub disables cron after 60 days of repo inactivity | Handled automatically by the self-commit step; check it has `contents: write` |
| Everything green, project still paused | Pings never reached Postgres | Ensure you call `tc_keep_alive`, not a static endpoint |

---

## 7. What each file does

| File | Role |
|---|---|
| `database/v9-keepalive-and-drive.sql` | `tc_keep_alive()` (write), `tc_keep_alive_status()` (read), ping log, staff read policies |
| `.github/workflows/keep-supabase-alive.yml` | Every 2 days: write + verify + self-commit + raise issue on failure |
| `.github/workflows/keepalive-watchdog.yml` | Daily: read health, self-heal, alert, auto-close when healthy |
| `.github/workflows/supabase-auto-restore.yml` | Daily reachability probe |
| `api/keepalive.js` | Vercel cron endpoint; verifies the write, returns 503 on failure |
| `supabase/functions/ping/index.ts` | Public health endpoint for header-less monitors |
| `assets/js/keepalive-monitor.js` | In-app status widget, owner banner, browser self-heal |
| `tools/keepalive.gs` | Google Apps Script daily ping + email alerting (layer 12) |
| `.github/workflows/supabase-auto-restore.yml` | Daily status check + automatic un-pause (layer 13) |
| `assets/js/app.js` (`heartbeat()`) | Page-visit / tab-focus / interval pings |

---

## 8. When to stop working around this

If the studio has real paying families, `$25/month` for Supabase Pro removes the
pause entirely and adds daily backups. Everything above exists because the
product's promise is **₦0/month**, and it works — but it is a set of
mitigations, not an SLA. Be honest with a client about that distinction.
