# Deployment guide — Tutoring Connect (V19)

Follow these steps **in order**. Nothing here costs money: Supabase free tier,
Vercel or Netlify free tier, GitHub free tier. No AI API is used anywhere in the
product, so there is no per-call cost to budget for.

Estimated time end to end: **45–60 minutes**.

---

## Before you start — what you need

| Thing | Where | Cost |
| --- | --- | --- |
| A GitHub account | github.com | free |
| A Supabase account | supabase.com | free tier |
| A Vercel **or** Netlify account | vercel.com / netlify.com | free tier |
| A Google account | for Drive links + the keep-alive script | free |

You do **not** need a domain, a credit card, a server, or a payment gateway.

---

## STEP 1 — Create the database (10 minutes)

1. Go to **https://supabase.com** and sign in.
2. Click **New project**.
3. Fill in:
   - **Name**: something you will recognise, e.g. `adewale-classroom`
   - **Database Password**: click *Generate a password* and **save it in your
     password manager now**. You cannot see it again.
   - **Region**: choose the one closest to your families. For Nigeria that is
     usually `West EU (London)` or `East US (North Virginia)`.
4. Click **Create new project** and wait ~2 minutes for it to finish building.

> **Why a region matters.** Every page load makes a round trip to this database.
> A region on the wrong continent adds 200–400 ms to every single action.

---

## STEP 2 — Install the schema (5 minutes)

1. In your Supabase project, click **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open `database/complete-schema.sql` from your download, select **all** of it
   (Ctrl+A) and copy it.
4. Paste it into the SQL editor.
5. Click **Run** (or press Ctrl+Enter).
6. Wait. It is a large file and takes 20–60 seconds.
7. You should see a final green result reading:

   ```
   Tutoring Connect V19 — revenue automation + enterprise security installed ✅
   ```

**This one file installs everything.** You do not need to run the individual
`v2-…`, `v16-…`, `v19-…` files; they are included in order inside it and are
shipped separately only so you can read them.

**It is safe to run more than once.** Every statement is idempotent — it uses
`if not exists`, `create or replace`, or `drop … if exists` first. When a new
version of Tutoring Connect is released, you re-run this same file to upgrade.

### Verify it worked

Still in the SQL editor, run:

```sql
select public.tc_schema_info();
```

You want `"version": "V19"` and `"up_to_date": true`. If `version` is lower,
the script did not finish — scroll up in the editor for the first red error.

---

## STEP 3 — Get your two connection keys (2 minutes)

1. Click the **gear icon (Project Settings)** → **API**.
2. Copy these two values:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon public** key — a long string starting `eyJ…`

> **Is the anon key a secret?** No. It is *designed* to be public and it will be
> visible in your page source. Your data is protected by **row-level security**
> inside the database, not by hiding this key. What you must **never** publish is
> the `service_role` key on the same screen. Tutoring Connect never uses it.

---

## STEP 4 — Configure the studio (3 minutes)

Open `assets/js/config.js` in your download and edit the top block:

```js
const CONFIG = {
  supabaseUrl : 'https://abcdefgh.supabase.co',   // from Step 3
  supabaseKey : 'eyJhbGciOi…',                    // the anon public key
  name        : 'ADEWALE CLASSROOM',
  shortName   : 'ADC',
  siteUrl     : 'https://adewaleclassroom.vercel.app',  // fill after Step 5
  currency    : '₦',
  timezone    : 'Africa/Lagos',
  phone       : '2348100866322',
  email       : 'hello@example.com'
};
```

`siteUrl` matters more than it looks: `tools/build_seo.py` uses it to write
`robots.txt` and `sitemap.xml`. Get it wrong and search engines are pointed at
the wrong domain.

---

## STEP 5 — Publish the site (10 minutes)

### Option A — Vercel (recommended)

1. Create a **new repository** on GitHub, e.g. `adewaleclassroom`. Keep it public
   or private; both work.
2. Upload every file from your download to that repository
   (**Add file → Upload files**, drag the whole folder in, **Commit**).
3. Go to **https://vercel.com** → **Add New… → Project**.
4. **Import** the GitHub repository you just created.
5. Framework preset: **Other**. Build command: **leave empty**. Output
   directory: **leave empty**. This is a static site; there is nothing to build.
6. Click **Deploy**. It takes about 40 seconds.
7. Copy the URL Vercel gives you and paste it into `siteUrl` in
   `assets/js/config.js`, then commit that change. Vercel redeploys itself.

### Option B — Netlify

1. Go to **https://app.netlify.com/drop**.
2. Drag your whole project folder onto the page.
3. It deploys immediately. Rename the site under **Site settings → Change site name**.

### Option C — GitHub Pages

1. In your repository: **Settings → Pages**.
2. Source: **Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
3. Your site appears at `https://<username>.github.io/<repo>/` in a few minutes.

---

## STEP 6 — Regenerate SEO for your domain (1 minute)

Once you know your real URL:

```bash
python3 tools/build_seo.py .
```

This rewrites `robots.txt` and `sitemap.xml` for **your** domain, marks all 116+
private portal pages `noindex,nofollow`, and lists only genuinely public pages.
Commit the result.

> **Why this step exists.** Earlier versions shipped the generator's sitemap to
> every client site, pointing Google at the wrong domain. This step is what
> prevents that.

---

## STEP 7 — Create the first administrator (5 minutes)

1. Open your live site and click **Sign in** → **Apply / Register**, or use
   Supabase **Authentication → Users → Add user** to create your own account.
2. In Supabase **SQL Editor**, promote yourself:

   ```sql
   update public.profiles
      set role = 'admin'
    where email = 'you@example.com';
   ```

3. Sign out and back in. You should now see the full admin navigation.

> Until at least one admin exists, most pages will correctly show you nothing.
> That is row-level security doing its job, not a bug.

---

## STEP 8 — Seed your licence (1 minute)

If you generated this studio with the builder, run the file it produced:

```
database/00-licence-seed.sql
```

Otherwise open **License** in the studio and set the model (one-time or
subscription), tier, seats and enforcement mode by hand. Enforcement is applied
by a database trigger, so the choice has real effect.

---

## STEP 9 — Turn on the keep-alive (10 minutes) — IMPORTANT

**Supabase pauses a free project after 7 days with no database activity.**
Visitors browsing your site do **not** count; only database queries do. A paused
project is deleted after about 90 days.

Set up **at least two** of these:

1. **GitHub Actions** — `.github/workflows/keepalive.yml` ships with the
   download. Push it and enable Actions on the repository. Scheduled runs are
   *not guaranteed* by GitHub, which is why the schedule is every 2 days rather
   than daily.
2. **Google Apps Script** — copy `tools/keepalive.gs` into
   **script.google.com**, paste your URL and anon key, and add a **time-driven
   trigger** to run daily. This is the most reliable free option.
3. **UptimeRobot** (free) — monitor a URL every 5 minutes.

Full detail and all 14 layers: `docs/KEEP-ALIVE-GUIDE.md`.

---

## STEP 10 — Verify security yourself (3 minutes)

Do not take anyone's word for it, including mine.

```bash
python3 tools/audit_live.py
```

You want to see:

```
[OK] No table returns rows to an anonymous visitor. RLS is holding.
[OK] No unexpected function is reachable by an anonymous visitor.
```

And inside the studio, open **Security & compliance → Run security scan**.
Confirm **Tables without row-level security** is empty.

---

## STEP 11 — Install it as an app (2 minutes)

Tutoring Connect is a Progressive Web App. It installs on everything:

| Device | How |
| --- | --- |
| **Android (Chrome)** | Open the site → menu ⋮ → **Install app** / **Add to Home screen** |
| **iPhone / iPad (Safari)** | Open the site → Share ⬆ → **Add to Home Screen** |
| **Windows (Chrome/Edge)** | Open the site → the ⊕ install icon in the address bar → **Install** |
| **macOS (Chrome/Edge)** | Same install icon in the address bar |
| **Chromebook** | Menu ⋮ → **Install** |

Once installed it opens without browser chrome, keeps working offline for pages
already visited, and appears in the app switcher like any native app.

The in-app **Install** page walks a parent through this with pictures.

---

## STEP 12 — First-run configuration (10 minutes)

In this order:

1. **Settings** — studio name, logo URL, currency, timezone, cancellation hours,
   sibling discount bands, wallet threshold.
2. **Subjects** — what you teach.
3. **Tutors** — who teaches, and their pay rates.
4. **Learners** and **Parents** — or import via CSV.
5. **Family links** — connect each parent to their children. *Until you do this,
   parent dashboards are empty and it will look broken.*
6. **Engagements** — the 1:1 or group arrangements, with rates.
7. **License** — confirm model and enforcement.

---

## Upgrading later

1. Download the new release.
2. Copy your `assets/js/config.js` across (it holds your keys).
3. Re-run `database/complete-schema.sql`. It is idempotent and safe.
4. Run `python3 tools/build_seo.py .`
5. Commit and push. Vercel/Netlify redeploy automatically.
6. Run `python3 tools/audit_live.py` to confirm nothing regressed.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Every page is empty after sign-in | No admin exists yet | Step 7 |
| Parent dashboards are blank | No parent↔learner links | **Family links** page |
| `invalid input syntax for type numeric: ""` | Old build | Upgrade; fixed in V13 |
| `function … does not exist` | Schema older than the code | Re-run `complete-schema.sql` |
| Site works, then dies after a week | Supabase paused | Step 9 |
| Google shows the wrong domain | Stale sitemap | Step 6, then resubmit in Search Console |
| Wallet/plans pages say "Not installed yet" | Schema below V19 | Re-run `complete-schema.sql` |
| Cannot save anything, banner says expired | Subscription licence enforcing | **License** page → Renew |

---

## Free-tier limits, honestly

| Resource | Free allowance | What Tutoring Connect does about it |
| --- | --- | --- |
| Database | 500 MB | LZ4 compression on 15 JSONB columns; `tc_prune_logs()`; `tc_db_report()` warns early |
| Storage | 1 GB | **Never used.** Media is links only (Drive/YouTube/https) |
| Pausing | 7 days idle | 14 keep-alive layers |
| Bandwidth | 5 GB/month | Static site + service-worker caching |
| Vercel | 100 GB/month | Far beyond a studio's needs |

A studio with 200 learners, 5 tutors and three years of history sits at roughly
**60–90 MB** — well inside the free tier.
