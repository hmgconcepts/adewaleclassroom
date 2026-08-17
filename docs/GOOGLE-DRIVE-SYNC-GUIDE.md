# Google Drive sync — complete setup guide

Sealed, timestamped backups of your entire studio, written to **your own** Google
Drive. Free forever. No third-party service ever holds your data.

**Why this matters:** Supabase's free tier provides **no downloadable backups**,
and a project left paused is eventually deleted. This is your safety net.

---

## What you get

* One-click **Back up now**, and optional **automatic** backups every N days.
* Backups are **sealed JSON** with a SHA-256 checksum, so tampering is detectable.
* Stored in a folder in your own Drive: *Tutoring Connect Backups — <Studio>*.
* The newest **15** backups are kept; older ones are pruned automatically.
* **One-click restore** from any backup in the list.

### The security model (read this — it is the reassuring part)

The app requests only the **`drive.file`** scope. That scope grants access
**exclusively to files this application itself created**. It is technically
incapable of reading your photos, documents or anything else in your Drive.
Google shows you this on the consent screen.

Nothing is stored on any HMG server. Your OAuth Client ID is a **public
identifier**, not a secret, so it is safe in `practice_settings`.

---

## Part 1 · Create the Google credentials (about 5 minutes, once)

You need a free Google Cloud project. No billing, no card.

### Step 1 — Create a project
1. Open <https://console.cloud.google.com/>.
2. Top bar → project dropdown → **New Project**.
3. Name it e.g. `Adewale Classroom Backups` → **Create**.
4. Make sure it is **selected** in the top bar before continuing.

### Step 2 — Enable the Drive API
1. Left menu → **APIs & Services** → **Library**.
2. Search **Google Drive API** → open it → **Enable**.

**Confirm:** the button now reads *Manage*.

### Step 3 — Configure the consent screen
1. **APIs & Services** → **OAuth consent screen**.
2. User type: **External** → **Create**.
3. Fill only the required fields:
   * App name: your studio name
   * User support email: your email
   * Developer contact: your email
4. **Save and continue** through *Scopes* (add nothing) and *Test users*.
5. On **Test users** → **Add users** → add **your own Google address**
   (the account whose Drive will hold the backups) → **Save and continue**.

> **Important:** while the app is in *Testing*, only the addresses listed as test
> users can authorise it. That is fine — one studio needs one account. You do
> **not** need Google verification, and you should not request it.

### Step 4 — Create the OAuth Client ID
1. **APIs & Services** → **Credentials** → **Create credentials** →
   **OAuth client ID**.
2. Application type: **Web application**.
3. Name: `Tutoring Connect`.
4. Under **Authorised JavaScript origins** → **Add URI**, add your studio's
   address **exactly**, with no trailing slash:

   ```
   https://adewaleclassroom.vercel.app
   ```

   Add a second entry if you also test locally:

   ```
   http://localhost:8080
   ```

5. **Create**. Copy the **Client ID** — it ends in
   `.apps.googleusercontent.com`.

> ⚠️ **The single most common failure.** The origin must match the browser
> address bar character-for-character: correct scheme (`https`), correct host,
> **no path**, **no trailing slash**. `https://x.vercel.app/` (trailing slash) or
> `https://x.vercel.app/admin-data.html` (path) will both fail with
> `redirect_uri_mismatch` / `origin mismatch`.

---

## Part 2 · Connect it in the studio (2 minutes)

1. Sign in to your studio as **owner/admin**.
2. Go to **Admin data** (`admin-data.html`).
3. Scroll to the **☁️ Google Drive backup** panel.
4. Paste the **Client ID**.
5. Choose a frequency (7 days suits most studios).
6. Set **Automatic backups** to *On*.
7. **💾 Save settings**.
8. **🔌 Test connection** → a Google window opens → choose your account →
   **Allow**.

**Confirm:** the panel shows `✅ Connected. Backup folder ready.`

> If Google warns *"Google hasn't verified this app"*, that is expected for a
> Testing-mode app. Click **Advanced** → **Go to … (unsafe)**. It is your own
> app, authorised by you, with access only to files it creates.

---

## Part 3 · Run and verify your first backup

1. Press **☁️ Back up now**.
2. Wait a few seconds. You should see:
   `✅ Backed up 1,432 rows (612 KB) as tutoring-connect-backup-2026-08-16T20-31-05.json`
3. Press **📂 List backups** — the file appears with size and timestamp.
4. Press **↗ Open Drive folder** — confirm it in Google Drive.

**You are done.** With automatic backups on, any admin visit that finds a backup
overdue will run one quietly in the background.

---

## Part 4 · Restoring

1. **Admin data** → **📂 List backups**.
2. Find the backup you want → **Restore**.
3. Confirm the warning.

Restore is an **upsert by id**: rows with matching ids are overwritten, new rows
are inserted, and **nothing is deleted**. To rebuild into a brand-new Supabase
project, run `database/complete-schema.sql` there first, point `config.js` at it,
then restore.

> Always take a fresh backup **before** restoring an old one.

---

## The overdue banner

Owners and admins see a banner at the bottom of the screen when:

* the studio has **never** been backed up (red — the most dangerous state);
* a backup is **overdue** against your chosen interval (amber);
* the last automatic attempt **needed consent again** and silently failed (amber).

It carries a one-press **Back up now** button, a link to Admin data, and a 12-hour
snooze. Parents and tutors never see it. This exists because a backup system that
fails quietly is worse than none at all — you believe you are protected when you
are not.

## How the automatic backup behaves

* Only **owner/admin** sessions can trigger it — parents and tutors never do.
* It runs when a backup is older than your chosen interval.
* It first tries **silently**. If Google needs consent again it will ask the next
  time an admin is actively looking at the page, and records
  `needs-consent` as the last status so the failure is visible rather than silent.
* Attempts are throttled to once per 30 minutes per device.

---

## Troubleshooting

| Message | Meaning | Fix |
|---|---|---|
| *Paste the OAuth Client ID…* | No Client ID saved | Part 2, step 4 |
| `origin mismatch` / `redirect_uri_mismatch` | Origin not authorised | Add the exact origin (no slash, no path) in Step 4 |
| *Google hasn't verified this app* | App is in Testing mode | **Advanced → Go to … (unsafe)**. Normal and safe here |
| `access_denied` | Your account is not a Test user | Add it under OAuth consent screen → Test users |
| *Silent Google auth timed out* | Consent expired | Press **Back up now** and approve interactively |
| *Google session expired* | Token aged out | Press **Back up now** again |
| `Drive HTTP 403` | Drive API not enabled | Step 2 |
| `Drive HTTP 404` on restore | Backup deleted from Drive | Pick another; the newest 15 are retained |
| Panel is empty | Pre-V9 build | Update to V9 — `renderPanel` was missing entirely before it |
| Not an owner | Panel hidden by design | Sign in as owner/admin |

---

## Good practice

* **Test a restore once**, into a scratch Supabase project. An untested backup is
  a hope, not a backup.
* **Also keep a local copy.** *Admin data → Download sealed backup* before any
  risky change.
* **Back up before restoring.**
* **Keep Drive itself backed up** — the backup folder is only as safe as the
  account holding it. Enable 2FA on that Google account.
* **Never paste a `service_role` key** anywhere in the studio. Backups use your
  signed-in session and the anon key, which RLS constrains.

---

## What is inside a backup

A single JSON envelope:

```json
{
  "meta": { "generated_at": "…", "row_count": 1432, "sha256": "…", "studio": "…" },
  "tables": { "learners": [ … ], "engagements": [ … ], "scoresheet": [ … ] }
}
```

It contains the **data**, not the schema. To rebuild from nothing:
`complete-schema.sql` first, then restore. Files referenced as Google Drive or
YouTube links are *links*, so they are not duplicated inside the archive — which
is exactly why a whole studio fits in a few hundred KB.
