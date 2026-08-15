# Tutoring Connect

**Generator + generated studio** for independent virtual tutors. Sister product of [School Connect](https://hmgschoolconnect.vercel.app/).

A product of **HMG Technologies**, subsidiary of **HMG Concepts** (*His Marvellous Grace*). Founder **Adewale Samson Adeagbo**.

> Recurring payments should not keep your schools from having online presences.

## Two packages, never mixed

| Zip | Who opens it | Homepage |
|---|---|---|
| `tutoring-connect-generator.zip` | HMG staff | Generator landing → **Open Authorized Builder** |
| `adewale-classroom.zip` | Parents / tutors / learners | **ADEWALE CLASSROOM — official tutoring portal** → Sign in |

Parent archive `tutoring-connect.zip` contains **only** those two zips + `README-RELEASE.txt`. Rebuild: `bash tools/pack-release.sh`.

## Product law

1. An **engagement** is atomic: `one_on_one` or `group`. Own curriculum, hour bank, goals, fees, analytics.
2. Siblings and groups **do not** smear data.
3. Full booking = **4 cycles × 7 days**. Times/cycle × 4 = classes. Amount = hourly rate × (minutes/60) × classes.
4. Quizzes: **Self** / **Review** / **Graded**. Sit with student ID `TC-0001`. Graded auto-pushes the scoresheet.
5. **No AI API.** Prompts are copy-paste. Insights are readable formulas.
6. **No file upload** into free Supabase. Images / video / materials = https / Drive / YouTube links.
7. Messaging = `wa.me` / `mailto:` / `sms:`.
8. Default timezone `Africa/Lagos`, currency `₦`.

## Stack

Static PWA + **one Supabase project per studio**. RLS on every table. 10-layer keep-alive. Drive sealed backups.

## Quick start

Client studio: see **[DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md)** section A.

Generator: open `index.html` → `builder.html` → generate a client ZIP.

## Promote the first admin (run after deploying)

After running `database/complete-schema.sql`, the first person who clicks **Request access** on `login.html` is created with `role = 'parent'` and `status = 'pending'`. To make that account the studio owner, open the Supabase **SQL Editor** and run:

```sql
-- 1. Find the account you just registered (by the email you used)
select id, email, full_name, role, status from public.profiles order by created_at desc;

-- 2. Promote it to owner/admin (paste the id from step 1)
update public.profiles
   set role   = 'admin',      -- or 'owner'
       status = 'approved'
 where id = 'THE-USER-UUID-FROM-STEP-1';

-- 3. Create the single studio-settings row if it does not exist yet.
insert into public.practice_settings(id, name, motto, timezone, currency)
values (1, 'ADEWALE CLASSROOM',
        'Independent progress. Visible to parents.',
        'Africa/Lagos', '₦')
on conflict (id) do nothing;
```

Then sign out and back in. The promoted account now sees every module, the Access Manager, Platform Health and the Admin Data pages. Valid roles are `admin`, `owner`, `director`, `lead_tutor`, `super_admin`, `tutor`, `staff`, `parent`, `student`/`learner`; valid statuses are `pending` and `approved`.

## Modules (high level)

People · Growth (apply + coded links) · Sessions (calendar, 4-cycle bookings, complete-a-class) · Learning (SOW, reading, 17+15 CBT, stream, classwork, LMS, library) · Insights (360, value-added, OLS, 6 at-risk rules) · Finance (hour banks, invoices) · Comms (inbox, bell, voting, forum on groups only) · Exam registration (WAEC → GRE) · Platform (health, Drive, license, access manager).

Full catalogue: `feature-guide.html` and `FEATURE-CATALOG.md`.

## License

Lifetime (default) or subscription lock — same idea as School Connect. Client owns the data; export is always available.
