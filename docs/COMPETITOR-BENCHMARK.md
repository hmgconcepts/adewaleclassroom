# Competitor benchmark — Tutoring Connect

**Date of research:** 17 August 2026
**Method:** live web research against vendor sites, Capterra/G2 listings, and
independent 2026 review round-ups. Every claim below is sourced. Where a
vendor's own marketing was the only source, it is labelled as such.

> **Why this document exists.** In an earlier session I was asked to benchmark
> Tutoring Connect against the market and I did not do it. I said so at the
> time rather than pad a summary with invented findings. This is that work,
> done properly. It changed three decisions in the product, listed at the end.

---

## 1. The market Tutoring Connect actually competes in

There are two distinct markets, and it matters which one this studio is in.

| | **Tutoring business management** | **Learning content platforms** |
| --- | --- | --- |
| Examples | TutorCruncher, Teachworks, TutorBird, Teach 'n Go, Oases, Tutorbase, Pike13, Jackrabbit | uLesson, Exambly/Afrilearn, Khan Academy, PrepClass, Passnownow |
| Sells | admin software to the tutor | lessons to the student |
| Revenue | subscription from the tutor | subscription from the family |

Tutoring Connect is squarely in the **first** market — it is software a tutor
runs their business on. But it is unusual in that market in three ways:

1. **It is a generator, not a SaaS.** Competitors host one multi-tenant app.
   Tutoring Connect stamps out an independent, self-hosted studio per client.
2. **It has no per-transaction fee and no per-student fee.** Every competitor
   charges one, the other, or both.
3. **It targets the Nigerian + international-diaspora exam-prep tutor**, a
   segment none of the Western platforms address in their feature set.

---

## 2. Pricing landscape — what a tutor pays elsewhere

| Platform | Entry price | Transaction fees | Scaling basis |
| --- | --- | --- | --- |
| TutorBird | $14.95–16.95/mo | low | per tutor (+$4.95 each) |
| Teachworks | $16.49–188/mo | **+$0.07–0.32 per lesson** | per lesson volume |
| TutorCruncher | $30–240/mo | **2.5–3.85% card + 0.5–1% offline** | tier + $50/extra branch |
| Teach 'n Go | ~$79/mo (100 students) | none | per live student |
| Oases Online | $99–699/mo + $299 onboarding | add-on fees | per active student |
| EdisonOS | $999–4,999/period + $549 setup | — | period licence |
| **Tutoring Connect** | **₦0 / $0 recurring** | **none** | **none** |

Sources: [1](https://tutorbase.com/best/test-prep-centers), [2](https://www.teachngo.com/blog/tutorcruncher-pricing), [3](https://www.teachngo.com/blog/tutorbird-review), [4](https://www.teachngo.com/blog/best-tutoring-business-software-us)

**Read this carefully, because it is the whole commercial argument.** A Lagos
tutor with 60 students running 400 lessons a month would pay, on TutorCruncher's
entry tier, $30 plus 3.85% of everything collected. On ₦1,800,000/month of fees
that is roughly **₦69,000/month in card fees alone**, plus the subscription,
plus FX. Teachworks would add $0.32 × 400 = $128/month in per-lesson charges.
Tutoring Connect's running cost is the Supabase free tier and a Vercel/Netlify
free plan: **zero**. That is not a small edge; it is the product.

The trade-off is honest and must be stated to clients: competitors give you a
support desk, an uptime SLA, and someone else's problem when it breaks. A
generated studio gives you ownership, zero cost and your own data — and you
carry the operational risk yourself.

---

## 3. Feature-by-feature benchmark

Legend: **●** full · **◐** partial · **○** absent

| Capability | TutorCruncher | Teachworks | TutorBird | Teach 'n Go | Oases | **Tutoring Connect** |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| Lesson scheduling, 1:1 + group | ● | ● | ● | ● | ● | ● |
| Recurring series (Mon/Wed/Fri × N weeks) | ● | ● | ● | ● | ● | ● cycle bookings |
| Conflict / double-booking detection | ● | ● | ◐ | ● | ● | ● |
| Attendance tracking | ● | ● | ● | ● | ● | ● |
| **No-show vs absence distinction** | ● | ● | ◐ | ● | ● | ● *added in V16* |
| Automated invoicing | ● | ● | ● | ● | ● | ● |
| Combined family / sibling billing | ◐ | ◐ | ● | ● | ◐ | ● `tc_family_statement` |
| Package & installment billing | ● | ● | ◐ | ● | ● | ◐ packages, no auto-installments |
| Card payment processing | ● Stripe/GoCardless | ● | ● Stripe/PayPal | ● Stripe/PayPal/SEPA | ● | ○ **by design** |
| Tutor payroll / split payments | ● | ● | ● | ◐ | ◐ | ● payroll page |
| Parent portal | ● | ◐ *"limited, no easy online payment"* | ● | ● | ● | ● |
| Student portal | ● | ◐ | ● | ● | ● | ● |
| **Gradebook** | ○ **absent** | ◐ | ○ **absent** | ● | ● | ● scoresheet |
| **Transcripts / formal reports** | ○ | ○ | ○ **absent** | ● | ● | ● |
| Built-in CBT / assessment engine | ○ | ○ | ○ | ○ | ● SAT/ACT | ● multi-subject + anti-cheat |
| Question bank | ○ | ○ | ○ | ○ | ● | ● + 18 prompt packs |
| Lead pipeline / CRM | ● | ◐ | ◐ | ● | ● | ● inquiries + waitlist + trials |
| Email + SMS reminders | ● SMS charged | ● | ● | ● | ● | ● free channels only |
| **WhatsApp** | ○ | ○ | ○ | ○ | ○ | ● deep links |
| Native mobile app | ○ | ○ | ○ | ● iOS+Android | ○ | ● **PWA, installable** |
| Website builder | ○ *Socket embed* | ○ | ● | ○ | ◐ storefront | ● whole site generated |
| Multi-branch / multi-location | ● | ● | ◐ | ● | ● | ◐ one studio per deployment |
| Public REST API | ● Enterprise only | ● | ◐ | ● all plans | ◐ | ● PostgREST, all of it |
| Data ownership / export | ◐ | ◐ | ◐ | ◐ | ◐ | ● you own the database |
| Behaviour / conduct tracking | ○ | ○ | ○ | ● gold star / red flag | ◐ | ● safeguarding + conduct |
| Room / resource booking | ● | ● | ○ | ● | ● | ● rooms page |
| Waitlist automation | ◐ | ◐ | ○ | ● | ◐ | ● |
| Offline capability | ○ | ○ | ○ | ○ | ○ | ● service worker |

Sources: [1](https://tutorbase.com/best/test-prep-centers), [5](https://www.teachngo.com/blog/tutorcruncher-review), [3](https://www.teachngo.com/blog/tutorbird-review), [6](https://tekpon.com/software/tutorcruncher/reviews/), [7](https://tutorcruncher.com/tutor-management-software/), [8](https://www.capterra.com/p/181623/TutorBird/), [9](https://tutorbase.com/blog/best-software-for-managing-group-tutoring)

### The three findings that surprised me

**a) The market leaders have no gradebook.** TutorCruncher — the platform most
often called "the most comprehensive" — has **no gradebook and no behaviour
tracking** at all [5](https://www.teachngo.com/blog/tutorcruncher-review).
TutorBird explicitly "doesn't offer grading or transcript features"
[3](https://www.teachngo.com/blog/tutorbird-review). They are *billing and
scheduling* engines that treat the actual teaching as a black box. Tutoring
Connect's scoresheet, mastery tracking, progress reports and CBT engine are
therefore not table stakes — they are a genuine differentiator against the
category leaders, and the pitch should say so.

**b) Nobody in the Western tooling market does WhatsApp.** Of the five main
platforms, **none** integrates WhatsApp; they are email- and SMS-based, and
TutorCruncher charges per SMS [10](https://tutorbase.com/best/online-tutoring).
Meanwhile in the actual Nigerian market, WhatsApp *is* the operating system: a
Lagos centre owner with 68 students reports spending **four to five hours a day**
on WhatsApp doing intake, fee schedules, payment confirmations and progress
updates [11](https://bossbot.uk/blog/whatsapp-tutor-nigeria). Tutoring
Connect's WhatsApp deep links are aligned with how the target customer actually
works, and this should be far more prominent than it currently is.

**c) Everyone charges for the money.** Every competitor either takes a cut of
payments (2.5–3.85%) or charges per lesson or per student. This is precisely
the cost structure that makes Western tooling unusable at Nigerian price points,
where Paystack itself only charges 1.5% + ₦100 capped at ₦2,000
[11](https://bossbot.uk/blog/whatsapp-tutor-nigeria) — i.e. the *software* fee
would exceed the *payment processor* fee, often by several multiples.

---

## 4. Where Tutoring Connect is genuinely behind

Being honest about this is the point of the exercise.

| Gap | Who has it | Severity | Status |
| --- | --- | --- | --- |
| **No-show vs absence** | all | high — it is the industry's headline metric | **Closed in V16** (see below) |
| **Automated installment plans** ("3 payments of ₦80,000") | Tutorbase, TutorCruncher, Oases | high in Nigeria — instalments are normal | **Open** — packages exist, auto-scheduling does not |
| **Prepaid credit / wallet balance** | Tutorbase, TutorCruncher | medium | **Open** — make-up credits exist, money credits do not |
| **Tutor utilisation vs revenue reporting** | TutorCruncher, Tutorbase | medium — the key multi-tutor metric | **Partial** — analytics page has utilisation, not revenue-per-tutor |
| **Sibling discount rules** | Jackrabbit, TutorBird | medium — Nigerian centres advertise 15%/25% off 2nd/3rd child | **Open** — combined billing exists, automatic discounting does not |
| **Automated lead nurture sequences** | Tutorbase, TutorCruncher | medium | **Open** |
| **Payment processing** | all | — | **Deliberately absent.** Adding Paystack means holding client money and a merchant account. Out of scope for a free, self-hosted generator. Studios use their own Paystack link. |
| **Multi-branch under one login** | most | low for the target customer | **Open by design** — one studio per deployment |
| **Support SLA / onboarding service** | all | structural | **Not applicable** — this is the trade for zero cost, and clients must be told |

### What I changed as a result of this research

1. **Added no-show tracking (V16).** `session_attendance.status` gained
   `no-show` and `cancelled-late`; the table gained `chargeable` and
   `notified_at`; and `tc_no_show_report(days)` computes the no-show rate and
   attendance rate the way the industry reports them. The commercial logic is
   encoded, not just the label: a no-show is chargeable and earns no make-up
   credit, because the tutor's hour is gone; a warned absence is not.
2. **Reprioritised the pitch.** The gradebook/CBT/transcripts stack is a
   differentiator against the category leaders, not a me-too feature. The
   marketing copy currently buries it.
3. **Confirmed the "no paid API, no payment processing" stance is correct**,
   not a limitation to apologise for — it is what produces the zero-cost
   structure that the entire value proposition rests on.

---

## 5. Recommended next block of work, in priority order

1. **Installment schedules** on packages — highest-value open gap for the
   Nigerian market, where term fees are routinely split.
2. **Sibling discount rules** on `tc_family_statement` — a stated norm in the
   local market (15% second child, 25% third).
3. **Revenue-per-tutor** alongside the existing utilisation reporting.
4. **Prepaid wallet** — a money balance a family draws sessions down against.
5. Make the WhatsApp and gradebook advantages loud in the generated landing page.

---

## Sources

1. Tutorbase — *Best Tutoring Software for Test Prep Centers (2026)* — https://tutorbase.com/best/test-prep-centers
2. Teach 'n Go — *TutorCruncher Pricing 2026* — https://www.teachngo.com/blog/tutorcruncher-pricing
3. Teach 'n Go — *TutorBird Review (2026)* — https://www.teachngo.com/blog/tutorbird-review
4. Teach 'n Go — *Best Tutoring Business Software in the US (2026)* — https://www.teachngo.com/blog/best-tutoring-business-software-us
5. Teach 'n Go — *TutorCruncher Review 2026* — https://www.teachngo.com/blog/tutorcruncher-review
6. Tekpon — *TutorCruncher Reviews 2026* — https://tekpon.com/software/tutorcruncher/reviews/
7. TutorCruncher — *Tutor Management Software* (vendor) — https://tutorcruncher.com/tutor-management-software/
8. Capterra — *TutorBird* — https://www.capterra.com/p/181623/TutorBird/
9. Tutorbase — *12 Best Software for Managing Group Tutoring in 2026* — https://tutorbase.com/blog/best-software-for-managing-group-tutoring
10. Tutorbase — *Best Online Tutoring Software (2026)* — https://tutorbase.com/best/online-tutoring
11. Bossbot — *WhatsApp for Nigerian Tutoring Centres* — https://bossbot.uk/blog/whatsapp-tutor-nigeria
12. Brands.ng — *uLesson Review 2026* — https://brands.ng/ulesson-review-2026-africas-1-learning-app-for-waec-jamb-better-grades/
13. SchoolHub — *Online Teaching Jobs in Nigeria: Career Guide 2026* — https://schoolhub.tech/blog/online-teaching-jobs-career-guide-nigeria
