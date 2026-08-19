# V24 — the lockout, dashboard access, real read-only, nav order, tutor scoping

**1,171 assertions, 0 failures** (was 1,069).

---

## Item 7 — I locked everyone out. This was my bug.

The worst regression in this project so far, and the cause was one line.

`App.currentRole` is initialised to **`'guest'`** and stays that way until the
session resolves. My V23 matrix ended with:

```js
// Unknown or guest role: only the public set above.
return 'none';
```

So while a session was resolving — and on any page where it never fully
resolved — the matrix confidently answered **"none"** for every page, and the
guard replaced the content with *"Your account is a guest account."* Admins and
tutors were locked out of their own studio.

`'super_admin'` made it worse: `normRole()` never mapped it, so it fell through
the same branch.

Three fixes:

1. **An unknown role now fails OPEN**, returning `write` and deferring to
   row-level security — which is the real boundary anyway. An access-control
   layer that is *unsure* must never be the thing that locks out a legitimate
   user.
2. **`apply()` does nothing unless the role is one of the four it understands.**
   `guest`, `pending`, `demo` and empty are explicitly not roles.
3. **`normRole()` now covers** `super_admin`, `superadmin`, `owner`,
   `administrator`, `proprietor`, `director`, `teacher`, `instructor`,
   `learner`, `pupil`, `guardian`.

Plus `RBAC.unlock()`: if a page went read-only while the role was still
resolving and the resolved role turns out to be staff, the page repairs itself
instead of needing a reload.

Tested against 8 unresolved/odd role values — none can now block a page.

---

## Items 2 & 6 — No dashboard for parents and students

**Two separate causes, both fixed.**

`dashboard` was **in none of my lists**, so deny-by-default blocked a parent or
learner from their own home page the instant they signed in.

**Cause 2:** the Dashboard *link* was in the nav markup, but buried far down
among the platform pages, below eleven section headings. For a parent or a
learner — who can reach only a handful of pages — it was effectively invisible.
Home is now **pinned to the very top**, above the first section heading, and
`ESSENTIAL_NAV` guarantees one exists even if a build ships without it.

**Cause 1:** added a SHELL set every signed-in user reaches whatever their role —
`dashboard`, `profile`, `change-password`, `notifications`, `inbox`, `messages`,
`about`, `install`, `feature-guide`, `contact`, `helpdesk`, plus `my-children`
for parents. The admin check now runs *before* the shell check, so an admin
keeps **write** on their dashboard rather than dropping to read.

---

## Items 3 & 5 — Read-only was not actually enforced

You were right that this was not fixed. My sweep only disabled controls inside
`.app-content form` plus a short CRUD list. But the pages you named —
**cycle bookings, reading assignments, classwork, class stream, study log** —
contain **no `<form>` at all**; they build their buttons in JavaScript. So a
parent still had working Save and Delete on exactly the reported pages.

The posture is now **inverted to an allow-list**: every `button`, `input`,
`select` and `textarea` in the content area is disabled or hidden *unless* it
is demonstrably a reading tool (search, filter, sort, paging, print, export,
View, Audit, close, navigation).

Getting an allow-list slightly wrong makes a page less convenient. Getting a
deny-list wrong lets a parent edit the attendance register.

Proved on markup with no form at all: bespoke `Save` hidden, bespoke input
disabled, CSV and search still working, banner shown, and `unlock()` reversing
all of it.

---

## Item 4 — The scattered navigation

`normalizeNavOrder()` ended with:

```js
remaining.sort(...).forEach(a => nav.appendChild(a));
```

`appendChild` **moves** a node. Appending all 130 links to the nav tore every
one out of its section and stacked them at the bottom, leaving *◈ Core*,
*🗓️ Sessions* and *🧾 Finance* orphaned together at the top with nothing under
them. That is the "scattered, unordered" pane.

Ordering now happens **within** each section: headings stay put, their links
stay beneath them, and `NAV_ORDER` still decides the sequence inside a section.
Verified on the real dashboard markup — structure identical before and after,
**0 orphaned headings**.

---

## Item 1 — Tutors now see only their own work

Almost every policy in the schema read `using (public.is_tutor())`, and
`is_tutor()` is true for *all* staff. Any tutor could read and edit **every**
learner, engagement, session, note and result in the studio.

New helpers — `tc_my_tutor_id()`, `tc_is_manager()`, `tc_teaches_engagement()`,
`tc_teaches_learner()`, `tc_teaches_session()` — and rewritten policies on
engagements, learners, memberships, sessions, attendance, notes, 16
learner-keyed tables, 11 engagement-keyed tables, and CBT papers and results.

| Decision | Why |
| --- | --- |
| A **manager short-circuits every check** | Admin keeps unrestricted access, as you asked |
| A covering tutor sees the session **they taught** | Substitution is normal and must not blind them |
| **Fail safe, not fail open** | A tutor with no assignments sees nothing, not everything |
| Candidates can always **submit** a paper | Scoping must never break an exam in progress |
| Papers are **stamped with their author** | So "my papers" works from the moment one is saved |

`tc_my_scope()` lets any page show a tutor their own learners, classes and
subjects without re-implementing the joins.

---

## Item 8 — Files updated

**New:** `database/v24-tutor-scoping.sql`
**Changed:** `assets/js/rbac.js` (lockout, shell pages, allow-list read-only,
unlock), `assets/js/app.js` (section-aware nav ordering),
`database/complete-schema.sql` (→ V24), `tools/test_runtime.js` (+100).

Both repos and both suite copies. Zip: **572 entries**.

| Check | Result |
| --- | --- |
| Runtime (generator / client) | **1,171 pass, 0 fail** / all pass |
| Generator build | **all pass** — 218 files, 0 broken links |
| Integrity / schema / parity | **0 / 0 blockers / 0 behind** |

---

## Re-run `database/complete-schema.sql`

Item 1 is entirely row-level security. **Until you run it, every tutor still
sees the whole studio** — the UI changes alone do not scope anything, and were
never intended to.

### A note on rollout

Tutor scoping depends on two links being correct:

1. each tutor's `tutors.user_id` pointing at their login, and
2. `engagements.tutor_id` naming the tutor who teaches it.

Where either is blank, that tutor will see **less** than expected rather than
more — deliberately, because failing safe is the right direction. Check the
Tutors and Engagements pages after installing, and use
`select public.tc_my_scope();` signed in as a tutor to see exactly what they
can reach.
