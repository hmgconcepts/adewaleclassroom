# Tutoring Connect — Feature System Guide

**Scope.** This is the authoritative, operator-facing explanation of every feature
in the system, how the pieces connect, and how to take a studio live. It is kept
true to the shipped code — the module table below is generated from the live
module catalog (`assets/js/catalog.js`), not written from memory.

**Two rules drive everything (and are non-negotiable):**
1. **No paid AI API.** Every "insight" is a readable formula, every question bank
   prompt is copy-paste for any free external tool, and the Studio Assistant is a
   rules-based index of the pages. Nothing calls a billed model.
2. **No file uploads into free Supabase.** Materials, photos and recordings are
   Drive / YouTube / https *links* so the 500 MB database and 1 GB storage quotas
   are never exhausted. The one exception is the logo, stored as a small file.

---

## 1. What the two repositories are and how they relate

| | `tutoringconnect` (Generator) | `adewaleclassroom` (Client studio) |
|---|---|---|
| Role | The HMG **factory** that stamps out branded studios | A **generated** parent-facing portal |
| Has `builder.html` + `generator.js` + `wizard.js` | ✅ (the build tool) | ❌ (excluded from client ZIPs) |
| `config.js` | Neutral, unbranded generator defaults | Real studio identity + live Supabase URL + anon key |
| Who opens it | HMG staff | Parents, tutors & learners |

**The architectural fact that makes every bug expensive:** `tutoringconnect` ships
its own runtime as the *template*. Every new studio is `builder.html` → wizard
→ in-browser `Generator.go()` → client ZIP. So a defect in
`tutoringconnect/assets/js/generator.js` is not one bug — it is **one bug per
studio ever generated**, re-emitted until the factory is fixed. This is why
runtime fixes are applied in BOTH repos, and why the generator itself is the most
carefully audited file.

---

## 2. Security model — three doors, RLS as the real boundary

- **Door 1 · Portal session.** `auth-guard.js` loads synchronously in `<head>`,
  classifies each page against an allow-list and `location.replace()`s **before**
  protected markup is parsed (a 6-second failsafe prevents a blank screen). It is
  honestly a *navigation* gate, not access control.
- **Door 2 · Code-gated CBT.** `cbt-exam`/`cbt-multi`/`cbt-review` are reachable
  without an account via the anon-granted RPC `tc_cbt_get_exam(code, student_no)`.
- **Door 3 · Public forms.** `apply`, `free-register`, `class-register`,
  `exam-register`, `public-book` post through a tight 7-function allow-list.
- **RLS is the real boundary.** 13+ `SECURITY DEFINER` predicate helpers
  (`tc_is_admin`, `tc_is_tutor`, `tc_is_self_learner`, `tc_is_parent_of`,
  `tc_is_manager`, `tc_my_tutor_id`, `tc_teaches_*`, `tc_family_*`, …) resolve
  from `auth.uid()`. Every table has row-level security. **V42** (see §7)
  re-asserts the function grants deterministically so privilege never depends on
  which historical "sweep" ran last.

---

## 3. The module catalogue (123 modules)

Every module below maps to a live page. Module selection in the wizard controls
**what appears in the navigation**, not what exists on disk — the build is
all-inclusive, so a client is never missing a page a menu link points at.

### 3.1 Core people
| Module | Page | What it does |
|---|---|---|
| Engagements (1:1 & Groups) | engagements.html | The atomic unit. Each one-on-one student or group is a fully independent teaching engagement with its own curriculum, hours, goals, fees and analytics. Nothing leaks between engagements. |
| Learners | learners.html | Learner records: identity, timezone, exam board, learning style, accommodations, guardian, Drive photo. A learner may sit in one or many engagements independently. |
| Groups | groups.html | Named group engagements (2–12 learners). Shared sessions, individual mastery and scores. Group insights never overwrite personal insight. |
| Parents & Families | parents.html | Parent registry and parent–learner mapping. A parent only ever sees their own children. Siblings remain independent engagements. |
| Tutors & Assistants | tutors.html | Solo or multi-tutor practice. Availability, subjects, hourly cost, timezone, specialisms. |
| Subjects & Exam Boards | subjects.html | Maths, English, Physics, SAT, WAEC, IGCSE, IELTS… Each subject can carry a board, level and default methodology. |

### 3.2 Growth / CRM
| Module | Page | What it does |
|---|---|---|
| Inquiries / CRM | inquiries.html | Parent-requested tutoring pipeline: new → contacted → trial booked → converted / lost. Source, subject, preferred mode. |
| Waitlist | waitlist.html | Hold demand when a slot or group is full. Promote into an engagement with one click. |
| Trial Lessons | trials.html | Free or paid diagnostic trial. Captures baseline score and fit notes before a package is sold. |
| Onboarding Checklists | onboarding.html | Consent, goals interview, diagnostic, first package, first session — tracked per engagement. |
| Public Inquiry Form | apply.html | Public page parents use to request tutoring. Also opens shareable application links (?code=). |
| Class Registration Links | class-links.html | Shareable social-media links for paid and free classes — WhatsApp, Facebook, X, Telegram, email, QR. Tracks usage and registrations. |
| Application Links | application-links.html | Generate robust, expiring, limited-use application URLs for a subject, 1:1 or group. Each code has its own form copy and use counter. |

### 3.3 Sessions & delivery
| Module | Page | What it does |
|---|---|---|
| Calendar | calendar.html | Timezone-aware calendar for 1:1 and group sessions. Conflict detection on tutor and learner. |
| Sessions | sessions.html | Every lesson: start/end, mode (online/in-person/hybrid), meeting link, whiteboard, attendance, hours deducted. |
| Availability | availability.html | Weekly tutor availability in the tutor’s timezone. Used by self-booking and conflict checks. |
| Self-Booking | bookings.html | Parents book from open slots inside cancellation-policy rules. No Calendly fee. |
| Cycle Bookings | bookings.html | A full booking is 4 cycles of 7 days. Times per cycle × 4 = total classes. Hourly rate × duration × classes = invoice. Visible to tutor, parent and learner. |
| Attendance | attendance.html | Present / late / absent / excused per learner, even inside a group. Feeds at-risk rules. |
| Make-up Sessions | makeups.html | Policy-aware make-ups. Hours can be restored or consumed depending on who cancelled. |
| Cancellations | cancellations.html | Who cancelled, notice hours, fee applied, hours returned. Transparent for parents. |
| Session Notes | session-notes.html | Per-session, optionally per-learner notes. Shareable to the parent portal. Drive recording link. |
| Complete a class | session-complete.html | Tutor marks a class done, writes what was taught, ticks SOW topics. Feedback lands on parent and learner dashboards and feeds insights. |
| Scheme of Work | sow.html | At the start of a term enter every subject topic. Follow coverage, evaluate each learner on each topic, push scores into the scoresheet. |
| ADEWALE CLASSROOM DECK | class-deck.html | Integrated HMG ADEWALE CLASSROOM DECK: split-screen teach, live classroom, Meet companion, student join, toolkit. No AI API. |
| Meeting Links | meetings.html | Jitsi (free), Google Meet or Zoom links stored per session or as a standing room. No paid classroom required. |
| Whiteboard Rooms | whiteboard.html | Free Excalidraw / Google Jamboard / FigJam links per engagement. Opens in a new tab. |
| Rooms / Locations | rooms.html | In-person rooms or virtual standing rooms. Conflict check. |
| Timezone Desk | timezones.html | International tutoring: convert a slot across learner, parent and tutor zones. |
| Tutor leave | leave.html | Tutors request leave. Only an administrator can approve or reject. |
| Makeup credit bank | makeup-credits.html | When the studio cancels, the family earns a credit on that engagement. Spent on a makeup. Never smeared across siblings. |
| Public self-booking | public-book.html | Parents pick an open slot from tutor availability. No Calendly fee. Lands as an inquiry you confirm into a 4-cycle booking. |

### 3.4 Learning
| Module | Page | What it does |
|---|---|---|
| Diagnostics | diagnostics.html | Baseline tests at the start of an engagement. Locks the value-added starting point. |
| Goals & Learning Plans | goals.html | SMART goals and a living plan per engagement and per learner. Review dates, owners, status. |
| Topic Mastery | mastery.html | Topic-by-topic heatmap (0–100) per learner. Independent even when the learner sits in a group. |
| Methodologies | methodologies.html | Your teaching methods library (spaced retrieval, worked examples, CRA, exam-technique drills…). Attach one to each engagement. |
| Curriculum Maps | curriculum.html | Independent scheme of work per engagement — not a shared school class list. Tick coverage weekly. |
| Lesson Plans | lesson-plans.html | Objectives, resources, checks for understanding. Linked to a session and a methodology. |
| Homework | assignments.html | Set, collect (Drive link), mark, and score. Completion rate feeds insights. |
| Resource Library | resources.html | Drive / YouTube / PDF links scoped to an engagement or shared. No file uploads into the free database. |
| Spaced Practice | flashcards.html | SM-2 spaced repetition (classic free algorithm). Cards belong to a learner, not a group. |
| Certificates | certificates.html | Printable milestone certificates with a verification code. |
| Learner Portfolio | portfolio.html | Best work, recordings, marked scripts — Drive links curated for applications. |
| Reading assignments | reading.html | Pre-class reading and video links tied to the next SOW topic. Learners tick items as they finish. |
| E-resources / notes | eresources.html | Study materials as Drive or web links, organised by subject and engagement. |
| Mini LMS | lms.html | Courses, lessons, completion — scoped to an engagement. |
| Learning Styles | learning-styles.html | Observed notes (visual, verbal, worked-example first…). Not a quiz religion — a working memory for the tutor. |
| Accommodations / SEN | accommodations.html | Extra time, reader, rest breaks, large print. Printed onto practice tests and reports. |

### 3.5 CBT & assessments (no AI API)
| Module | Page | What it does |
|---|---|---|
| Practice Tests / CBT | practice.html | Timed practice with 12+ question types. Server-side scoring via SQL. No AI API. Maps into mastery and reports. |
| Take Practice Test | cbt-exam.html | Learner runtime: code entry, timer, navigator. Open or rostered. |
| Question Bank Prompts | cbt-prompts.html | Copy-paste prompts for any free external chat to emit CSV questions. The platform never calls a paid AI. |
| Multi-subject CBT | cbt-multi.html | One sitting, subject tabs (UTME-style). Shared timer, per-subject breakdown, same anti-cheat. |
| Quiz review + PDF | cbt-review.html | After a quiz the learner sees every item, their answer, the key and the explanation, then saves a study PDF. |
| Scoresheet | scoresheet.html | Single ledger of graded quizzes, SOW evaluations and homework. Visible to the linked parent and the learner. |
| Quizzes (Self / Review / Graded) | practice.html | Three quiz kinds. Self = iterative practice. Review = diagnose after class. Graded = exhaustive paper that auto-pushes to the scoresheet. |

The CBT engine supports the international families (MCQ, multi-select, true/false,
fill-blank, short answer, essay, numeric, matching, ordering, drag-drop,
comprehension, case-study, image/audio/video, math equation, cloze/dropdown
gap-fill, hotspot/tap-the-region, assertion–reason, error-spotting,
data-interpretation, classification, likert, timeline, citation, graph-read,
scenario MCQ, code output, oral prompt, peer review, map label). The
`structured_visual` prompt generator pack emits the interactive auto-graded
types; items are rendered, collected and graded by `cbt-types.js` + `cbt.js`.

### 3.6 Insights (rule-based, not AI)
| Module | Page | What it does |
|---|---|---|
| Insights Lab | insights.html | The differentiator. Graphs and methodologies for one learner, one group, or the whole practice. Rule-based, not AI. |
| Learner 360 | learner-360.html | One page: identity, engagements, hours, scores over time, mastery heatmap, at-risk flags, notes, invoices. |
| Group Insights | group-insights.html | Shared-session analytics plus a fairness view: who is being left behind inside the group. |
| At-Risk Board | at-risk.html | Rule engine: falling scores, low attendance, missing homework, idle 14+ days, hours < 2. No AI. |
| Exam Targets | exam-targets.html | Target exam, date, board, predicted vs target grade. Countdown on the learner dashboard. |
| Predicted Grades | predictions.html | Transparent linear projection from the last N scores toward the exam date. Formula is shown to parents. |
| Value-Added | value-added.html | Current average minus diagnostic baseline. The number parents actually buy. |
| Progress Reports | progress-reports.html | Parent-ready branded reports: hours, attendance, mastery, value-added, next steps, methodology used. |
| Practice Analytics | analytics.html | Studio-wide KPIs: utilisation, revenue, conversion, value-added distribution, retention. |

### 3.7 Finance
| Module | Page | What it does |
|---|---|---|
| Hour Banks / Packages | packages.html | Prepaid hours or lesson packs (TutorCruncher/Tutorbase parity). Each engagement has its own bank. |
| Invoices | invoices.html | Generate from sessions or from packages. Printable. Multi-currency. |
| Payments | payments.html | Record bank transfer / cash / Paystack / Flutterwave / Stripe checkout links. No forced processor fee to us. |
| Payment History | payment-history.html | Family-safe history and printable receipts. |
| Fee Catalogue | fees.html | Rate cards: 1:1 vs group, subject premiums, weekend rates, trial fees. |
| Scholarships & Discounts | scholarships.html | Sibling discount, hardship, referral credit — applied per engagement. |
| Books & Materials | products.html | Past papers, workbooks, kits sold alongside tutoring. |
| Tutor Payroll | payroll.html | Hours × rate, bonuses, deductions. Solo tutors can ignore this. |
| Practice Finance | finance.html | Income / expense ledger and simple P&L. Free-tier safe. |
| Referrals | referrals.html | Track who referred whom and the credit granted. |

### 3.8 Communication
| Module | Page | What it does |
|---|---|---|
| Announcements | announcements.html | Practice-wide or engagement-scoped notices. |
| Messaging (WA / Email / SMS) | messages.html | Free device-native WhatsApp, email BCC and SMS links. No Twilio bill. |
| In-App Inbox | inbox.html | Private tutor ↔ parent ↔ learner threads with read state. |
| Complaints | complaints.html | Submit → route → resolve. Evidence as Drive links. |
| Surveys & CSAT | surveys.html | After-trial and termly parent pulse. Feeds retention insight. |
| Parent Conferences | parent-meetings.html | Book a review slot, attach the latest 360 and report. |
| Reviews & Testimonials | reviews.html | Collect and optionally publish reviews on the public site (SEO). |
| Notification Centre | notifications.html | In-app bell + browser push after PWA install. |
| Result Broadcasts | broadcasts.html | One-click share of a score or report via free channels. |
| Reminders + .ics calendar | reminders.html | WhatsApp/email/SMS class reminders and a standard .ics download for Google, Outlook and Apple Calendar. No paid Calendar API. |
| Group forum | forum.html | Discussion threads scoped to a group engagement. Tutor or learner can open a thread; everyone in that group can reply. |
| Polls | polls.html | Schedule votes, topic votes, anonymous parent polls. |
| Voting | voting.html | Anonymous or named studio polls with live tally. Multi-channel notify when a poll opens. Free, no AI. |
| Blog | blog.html | Public blog: exam tips, subject guides and studio news. Every post has its own shareable link. |
| Blog manager | blog-manage.html | Write, edit, publish, archive and delete blog posts, and manage topic categories. |

### 3.9 Media & operations
| Module | Page | What it does |
|---|---|---|
| Gallery | gallery.html | Drive photos and YouTube recaps. No base64 in the database. |
| Birthdays | birthdays.html | Upcoming learner and tutor birthdays. |
| Directory | directory.html | Searchable people directory, role-filtered. |
| Help Desk | helpdesk.html | IT / scheduling / billing tickets. |
| Contracts & Consent | documents.html | Service agreement, safeguarding consent, recording consent — Drive links + status. |
| Contracts & Consent | contracts.html | Register of service agreements and consents with a draft → sent → signed lifecycle. |
| Policies | policies.html | Cancellation, refund, safeguarding, late policy. Shown on parent portal. |
| Learner Cards | idcards.html | Printable branded cards with QR for in-person check-in. |
| Marketing Flyer | flyer.html | Printable admissions flyer. Free lead-gen. |
| Workshops & Events | events.html | One-off workshops, bootcamps, exam clinics. Optional public RSVP. |
| Digital Library | library.html | Catalogued reading / past-paper links with optional comprehension score. |
| Streaks & Badges | gamification.html | Homework streaks, mastery badges. Transparent point log. |
| Rubrics | rubrics.html | Criteria and scale for essays and projects. |
| Transcripts | transcripts.html | Cumulative record across independent engagements. |
| Safeguarding Log | safeguarding.html | Confidential incidents. Admin/tutor only. Never in the parent nav. |
| Compliance | compliance.html | DBS/background checks, insurance, data-protection tasks. |
| Cover Tutors | substitutions.html | Assign cover when a tutor is away. Hours still belong to the engagement. |
| Study log / timer | study-log.html | Learner start/stop timer per subject. Minutes on task, not just class time. TutorBird study-log parity. |
| Exam registration links | exam-links.html | Shareable links for WAEC, NECO, UTME, IGCSE, IELTS, SAT and more. Passport as Drive link only. |
| Public exam form | exam-register.html | Candidate form opened by an exam link. Local and international boards. |
| Class stream | stream.html | Google Classroom-style feed: announcements, questions, materials. Link previews only. |
| Classwork | classwork.html | Work organised by topic. Assignments, quizzes, materials, comment-only return, skills tags. |
| HMG Ecosystem | hmg-ecosystem.html | HMG Concepts, Technologies, Academy, Media, Gospel. Visible on every generated studio. |
| HMG Digital Products | hmg-products.html | Product catalogue and contact paths for the ecosystem. |

### 3.10 Platform & enterprise
| Module | Page | What it does |
|---|---|---|
| Practice Analytics | analytics.html | Studio-wide KPIs: utilisation, revenue, conversion, value-added distribution, retention. |
| Admin Data Console | admin-data.html | Backup, restore, CSV export, table browser. SHA-256 sealed JSON archive. |
| Storage Manager | storage.html | Watch the free 500 MB. Archive then purge old logs. |
| Activity Log | activity-log.html | Who created, edited, deleted, signed in. |
| Approvals | approvals.html | Approve parent/learner/tutor self-signups. |
| Settings | settings.html | Brand, signatures, 2FA, language, accessibility, cancellation policy, default timezone/currency. |
| Role & Status | status-manager.html | Change role/status with an audit row. |
| Platform Health | platform-health.html | Keep-alive heartbeat, DB size, Drive backup, license, idle lock. |
| Site License | license.html | Lifetime or subscription lock. Same idea as School Connect, adapted. |
| Feature Guide | feature-guide.html | In-app explanation of every module. |
| My profile | profile.html | Name, phone, timezone, Drive photo, password. Family-safe. |

---

## 4. Free-tier survival (the most distinctive engineering)

The platform is designed to run on a **free Supabase project** (500 MB database,
1 GB storage) with NO paid AI and NO per-message API cost:

- **10 keep-alive layers** (GitHub Actions, Vercel cron, a Supabase Edge `ping`
  function, a `vercel.json` cron route, client `keepalive-monitor.js`, …) so the
  project is never paused for inactivity — see `docs/KEEP-ALIVE-GUIDE.md`.
- **Links, not uploads.** Material, photos, recordings, passports = Drive/YouTube
  https links. `drive-sync.js` maintains a Drive folder; `storage-offload.sql`
  and `quota-guard.js` watch the quota.
- **Google-Drive sealed backups.** `db-backup.yml` snapshots to Drive; the
  Admin Data Console produces a SHA-256 sealed JSON archive for offline restore.
- **Peer-to-peer / serverless media.** Class Deck uses WebRTC; messaging uses
  `wa.me`/`mailto:`/`sms:`; calendars use standard `.ics`. Nothing needs a paid
  SMS, Calendar or media API.

---

## 5. The testing-expert audit (what this pass verified)

A headless jsdom harness loaded the real `cbt-richtext.js`, `cbt-types.js` and
`cbt.js`, parsed the two supplied CSVs and rendered/graded exactly as the browser
does; `tools/lint_schema.py` checked the SQL. Results:

- **CBT import → render → grade:** 0 dead cards, 0 render throws across all 60
  rows of each supplied CSV.
- **Case-study passages:** 30/30 recovered (0 still missing); a standalone
  passage renders exactly once (no duplication).
- **Hot-text:** degrades to a typed box with no "no selectable text" dead card;
  `hasKey` correctly reports it unmarkable for tutor review.
- **Hotspot (new type):** renders markers, collects the tapped region, grades
  `earned:1`; the `structured_visual` prompt pack emits the correct type mix.
- **RPC ↔ schema contract:** every one of the 35 RPCs the JavaScript calls is
  defined in `complete-schema.sql` (0 missing backend functions).
- **Asset/link integrity:** 0 broken internal refs on both repos.
- **Generator output:** the emitted client `index.html` is branded with the
  configured studio name (no `ADEWALE CLASSROOM` leak), the emitted
  `classdeck/js/config.js` parses cleanly (no literal `\n` bug), all deck assets
  are bundled (no broken logo/founder image), the deck `generate` page loads its
  `js/generator.js`, and `config.js` never leaks a `service_role` key.
- **Official test suite:** `npm test` → ALL CHECKS PASSED (55+ assertions).
- **Schema:** `lint_schema.py database/complete-schema.sql` → 0 blockers on both
  repos.

---

## 6. The 18-item V40 fix list — status after this pass

| # | Item | Status |
|---|---|---|
| 1 | Exponents render as true superscripts | ✅ |
| 2 | Randomization is a checkbox in anti-cheat | ✅ |
| 3 | Matrix columns align vertically | ✅ |
| 4 | Case-study passage never missing/duplicated | ✅ |
| 5 | Hot-text + section navigation | ✅ |
| 6 | Research + implement international question types | ✅ |
| 7 | Camera snapshots metadata-only (robust) | ✅ |
| 8 | ADEWALE CLASSROOM logo on every page/file | ✅ |
| 9 | Blog Save/Publish fixed to international standard | ✅ |
| 10 | CBT image questions render once, robust | ✅ |
| 11 | 1000 concurrent CBT | 🟠 infra |
| 12 | Search-engine indexable (Google/Bing/Yahoo) | ✅ |
| 13 | 1000 concurrent live Class Deck | 🟠 infra |
| 14 | Class Deck recording MP4 + crash auto-save | ✅ |
| 15 | Recording date burned in | ✅ |
| 16 | Optional game-ification (Quizizz-style) | ✅ |
| 17 | `complete-schema.sql` all-inclusive (V36+V41+V42) | ✅ |
| 18 | Update every file across all repos | ✅ |

Items 11 & 13 are infrastructure exercises (DB write batching / an SFU or CDN
ingest for broadcast) that a single repo's code cannot fully solve on a free
tier; the index and architecture notes are documented in the implementation
notes.

---

## 7. V42 — enterprise hardening (this pass)

The historical schema applied 159 `GRANT` / 136 `REVOKE` statements in five
catalogue-wide sweeps, so a function's *effective* EXECUTE privilege could depend
on which sweep ran last — the class of non-determinism that caused the historical
RLS recursion bugs. **V42** adds `database/v42-enterprise-hardening.sql`, a
consolidated, **additive-only** block that runs after every pack and re-asserts
the intended end state:

- `grant execute on all functions in schema public to authenticated;` — a
  signed-in user may call any UI RPC; RLS (via the security-definer helpers) is
  still what decides row access.
- A `tc_anon_executable()` allow-list + a loop that re-grants EXECUTE to `anon`
  only on the curated public surface (forms, CBT code gate, blog, free classes,
  exam registration, self-booking, licence, and the RLS predicates anonymous
  reads must evaluate). Nothing is ever revoked, so anonymous access cannot
  regress.
- Bumps the single source of truth `tc_schema_expected()` to **`V42`** and
  registers `v42-enterprise-hardening` in `tc_schema_registry`.

It is idempotent and safe to re-run on a live database.

---

## 8. The generator produces a full-stack SaaS — how

`builder.html` → `Generator.go(cfg)`:

1. **Brands the client** with the wizard's name, theme, font, logo and modules
   (`brandHtml` substitutes the studio name into every page's static SEO tags and
   all `data-practice-name` text; `app.js` hydrates the logo and name at runtime).
2. **Packs every page** (all-inclusive build), all runtime JS/CSS, the full SQL
   schema (`complete-schema.sql`), the licensing seed, `robots.txt`,
   `sitemap.xml`, `manifest.json`, the PWA service worker, `_headers`, and the
   Class Deck (`packClassDeck` brands and bundles the live-teaching app including
   every asset it references).
3. **Writes a rebranded `config.js`** with the client name and the Supabase URL +
   anon key (never `service_role`).
4. **Optionally scaffolds a Next.js 14 wrapper** with the portal already mirrored
   into `modern/public/` (no manual copying).
5. **Emits `BUILD-MANIFEST.json`** recording exactly what the ZIP contains.

The result is a static installable PWA + one Supabase project + optional
serverless routes — a complete, multi-tenant, role-based SaaS delivered as a
single ZIP.

---

## 9. Taking a studio live — the deployment process

See `DEPLOYMENT-GUIDE.md` (in the repository root and in every generated ZIP) for
the full detailed, step-by-step procedure. The short version:

1. Open the generator → `builder.html` → fill the wizard → **Download ZIP**.
2. Create a free Supabase project; run `database/complete-schema.sql` in the SQL
   editor.
3. Copy the Project URL + anon key into `assets/js/config.js`.
4. Host the ZIP contents on Vercel / Netlify / GitHub Pages / Cloudflare Pages.
5. Promote the first admin (register → `update profiles ...`), set the
   `practice_settings` row, and configure keep-alive per
   `SUPABASE_FREE_TIER_PROTECTION.md`.
6. Verify SEO (sitemap, robots, canonical) and install the PWA.
