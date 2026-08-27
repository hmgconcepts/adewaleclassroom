# V33 — Portal login linking, directory, Class Deck, CBT tools

## Email
ADEWALE CLASSROOM public email is **hmgconcepts@gmail.com** (not hello@adewaleclassroom.com).

## Link portal login (School Connect / GOSA pattern)

Master records (`tutors`, `learners`, `parents`) carry optional `user_id` → `profiles.id`.

### Admin steps (unambiguous)
1. Create the person record with their real email.
2. They open `login.html` → Request access with that email.
3. Admin Approvals → approve and set role (`tutor` / `student` / `parent`).
4. On Tutors / Learners / Parents page, use the **Link portal logins** panel (admin only)
   or Edit → **Portal login account (link)**.
5. User signs out and back in — dashboard resolves to their row.

Tutors **cannot** add/link other tutors (`CRUD.WRITE.tutors = []`, page STAFF_READ, adminOnly field).

## Directory
`directory-desk.js` aggregates all people, tabs, search, link status, WA/email, CSV.

## Class Deck
Full runtime at `/classdeck/` + hub `/class-deck.html`.

## CBT
Review page filters + calculator/keyboard. Keyboard merges extra scientific groups.
Exam kit notes concurrent client-side sittings.
