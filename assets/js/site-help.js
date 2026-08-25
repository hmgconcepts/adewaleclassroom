/* Tutoring Connect page help — rules-based, no AI API. */
const SiteHelp = {
  descriptions: {
    'dashboard': '🏠 **Dashboard** — Role-aware studio hub. Admin/tutor: whole practice KPIs, action digest, live feed. Parent: only linked children with next classes, scores and invoices. Learner: only you. 1:1 and group engagements never smear data.',
    'engagements': '◈ **Engagements** — The atomic unit. A 1:1 or a named group is an independent contract: its own curriculum, hour bank, goals, fees and analytics. Create one engagement per teaching relationship. Siblings get separate engagements.',
    'learners': '◎ **Learners** — Identity, student ID (TC-0001 auto), timezone, year group, day school, learning notes, accommodations, Drive photo. A learner may sit in many engagements independently.',
    'groups': '👥 **Groups** — Named group engagements (2–12). Shared sessions, individual mastery and scores. Group insights never overwrite a child who is falling behind.',
    'parents': '👪 **Parents** — Registry plus parent–learner mapping. Linking is what makes the family portal work: a parent then sees ONLY their own children.',
    'tutors': '👨‍🏫 **Tutors** — Solo or multi-tutor studio. Availability, specialisms, pay rate, timezone.',
    'subjects': '📖 **Subjects** — Maths, English, SAT, WAEC, IGCSE, IELTS… Board, level, default methodology.',
    'inquiries': '✉ **Inquiries** — Pipeline: new → contacted → trial booked → converted / lost. Public apply.html and application links land here.',
    'waitlist': '⏳ **Waitlist** — Hold demand when a slot or group is full. Promote into an engagement.',
    'trials': '🧪 **Trials** — Diagnostic trial. Captures baseline score (locks value-added) and fit notes before a package is sold.',
    'bookings': '📅 **Cycle bookings** — A full booking is **4 cycles × 7 days**. Times per cycle × 4 = classes (2× = 8, 1× = 4). Amount = hourly rate × (minutes/60) × classes. The trigger expands the timetable. Visible to tutor, parent and learner.',
    'session-complete': '✅ **Complete a class** — Tutor marks the class done, writes feedback, ticks SOW topics. Feedback lands on parent and learner dashboards and feeds insights.',
    'sessions': '🗓️ **Sessions** — Every lesson: start/end, mode, meeting URL, whiteboard, hours deducted when status = done.',
    'attendance': '📋 **Attendance** — Present / late / absent / excused per learner, even inside a group. Feeds the 80% at-risk rule.',
    'sow': '📑 **Scheme of Work** — At term start enter every topic. Follow coverage, evaluate each learner, push scores into the scoresheet.',
    'practice': '📝 **Quizzes** — Three kinds. **Self** = private practice (off scoresheet). **Review** = after class. **Graded** = official, auto-pushes via `tc_push_cbt_to_scoresheet`. 17 + 15 question types. No AI API.',
    'cbt-exam': '🖊 **Take quiz** — Sit with student ID (TC-0001), not a typed name. Timer, anti-cheat, then review (your answer / correct / explanation) and Save PDF.',
    'cbt-prompts': '📋 **Question prompts** — Copy-paste packs (Simple / Intermediate / Advanced / Enterprise / Self / Review / Graded / Reading article / Reading video / Reading pack) into any free chat. The platform never calls a paid AI.',
    'scoresheet': '📒 **Scoresheet** — Single ledger of graded quizzes, SOW evaluations and homework. Visible to the linked parent and the learner.',
    'reading': '📚 **Reading assignments** — Article / video / PDF / playlist **links** tied to the next SOW topic. Loop: read → Self-Quiz → class. Never upload files.',
    'forum': '💬 **Group forum** — Threads scoped to a **group** engagement only. 1:1 contracts have no forum.',
    'stream': '📡 **Class stream** — Google Classroom-style feed: announcements, questions, materials, scheduled posts. Link previews only.',
    'classwork': '📂 **Classwork** — Work by topic. Assignments, quizzes, materials, comment-only return, skills tags. No Gemini.',
    'insights': '▣ **Insights Lab** — Formulas you can read. Value-added = current − baseline. Prediction = OLS on last N scores × fortnights to exam. Six at-risk rules. No AI.',
    'learner-360': '◎ **Learner 360** — One page: identity, engagements, hours, scores, mastery, flags, notes, invoices. Family-safe.',
    'at-risk': '🚩 **At-risk** — Rules: attendance < 80%, idle ≥ 14 days, hours < 2, homework < 60%, last 3 declining, > 40% topics < 50%.',
    'predictions': '📈 **Predicted grades** — Transparent linear projection. Formula is shown to parents.',
    'value-added': '➕ **Value-added** — Current average minus diagnostic baseline. The number parents actually buy.',
    'analytics': '📊 **Practice analytics** — Studio KPIs: utilisation, conversion, revenue, value-added distribution, retention. Chart.js + SVG fallback.',
    'packages': '◷ **Hour banks** — Prepaid hours on the engagement. Completing a session deducts via `consume_session_hours`.',
    'invoices': '🧾 **Invoices** — From cycle bookings or packages. Multi-currency. Printable.',
    'payments': '💳 **Payments** — Record bank / cash / Paystack / Flutterwave / Stripe **links**. No forced processor.',
    'inbox': '📥 **Inbox** — Private tutor ↔ parent ↔ learner threads. Also fires the notification bell.',
    'messages': '💬 **Messaging** — Free `wa.me` / `mailto:` / `sms:`. No Twilio bill.',
    'notifications': '🔔 **Notifications** — In-app bell + browser push after PWA install + email/WA/SMS compose. Realtime when Supabase is connected.',
    'voting': '🗳️ **Voting** — Anonymous or named. Live tally. Multi-channel notify when a poll opens. Free, no AI.',
    'surveys': '📋 **Surveys** — After-trial and termly parent pulse. Feeds retention insight.',
    'library': '📖 **Digital library** — Catalogued reading / past-paper **links**. Optional comprehension score.',
    'lms': '🎓 **Mini LMS** — Courses and lessons scoped to an engagement. Completion ticks. Links only.',
    'apply': '📝 **Public inquiry / application** — Parents request tutoring. Also opens `?code=` application links via `tc_submit_application`.',
    'application-links': '🔗 **Application links** — Expiring, limited-use codes for a subject, 1:1 or group.',
    'exam-links': '🎫 **Exam registration links** — WAEC, NECO, GCE, NABTEB, BECE, UTME/JAMB, IGCSE, IELTS, TOEFL, SAT, GRE, GMAT, JUPEB. Passport = Drive link + preview.',
    'exam-register': '📝 **Public exam form** — Candidate form opened by an exam link. Local + international boards.',
    'admin-data': '🗃️ **Admin data** — Local backup/restore, portable sealed archives, Google Drive sync, table browser. SHA-256 sealed. No uploads into the 500 MB database.',
    'platform-health': '🛡️ **Platform health** — Keep-alive heartbeat, DB size vs 500 MB, Drive backup, license, idle lock, emergency lockdown, login audit.',
    'settings': '⚙️ **Settings** — Brand, logo URL (not upload), signatures, timezone (Africa/Lagos default), currency ₦, cancellation hours, accessibility, 2FA via email OTP.',
    'storage': '🗄️ **Storage** — Guardian of the free 500 MB. Archive then purge old logs.',
    'activity-log': '🧮 **Activity log** — Who created, edited, deleted, signed in.',
    'approvals': '✅ **Approvals** — New accounts start pending. Approve only people you recognise.',
    'safeguarding': '🛡️ **Safeguarding** — Confidential incidents. Admin/tutor only. Never in the parent nav.',
    'profile': '👤 **Profile** — Your name, phone, timezone, photo (Drive link), password change.',
    'hmg-ecosystem': '🌐 **HMG Concepts Ecosystem** — HMG Concepts (His Marvellous Grace), HMG Technologies, HMG Academy, HMG Media, HMG Gospel. Founder Adewale Samson Adeagbo.',
    'feature-guide': '📘 **Feature guide** — Every module explained: why it exists, who uses it, how it connects.',
    'default': 'ℹ️ **Help** — Every page has ① this ❓ Page Help, ② the feature card at the top, ③ the 💬 studio assistant. New here? Start at the **Dashboard**. Admins: confirm **Platform Health** is green (heartbeat, Drive, license).'
  },
  init() {
    const page = (location.pathname.split('/').pop() || 'dashboard').replace('.html', '');
    this.currentPage = page;
    this.attachHelpButton();
  },
  attachHelpButton() {
    const existing = document.getElementById('page-help-btn');
    if (existing) existing.remove();
    const btn = document.createElement('button');
    btn.id = 'page-help-btn';
    btn.type = 'button';
    btn.innerHTML = '❓ Page Help';
    btn.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:9998;background:var(--gradient,linear-gradient(135deg,#4f46e5,#06b6d4));color:white;border:none;border-radius:50px;padding:12px 20px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.28)';
    btn.onclick = () => this.showHelp();
    document.body.appendChild(btn);
  },
  /* V8: 60 pages had a curated blurb; the other 68 fell back to generic text.
     Now anything without a curated entry is rendered in full from PAGE_GUIDE,
     so every one of the 128 pages has real, specific help. */
  fromGuide(page) {
    try {
      const g = (window.TC && window.TC.PAGE_GUIDE) || window.PAGE_GUIDE || {};
      const e = g[page];
      if (!e) return null;
      const badge = { public: '🌍 Public page', 'code-gated': '🔑 Opened with a quiz code',
        family: '👨‍👩‍👧 Family view', staff: '🎓 Staff only', owner: '🛡️ Owner / admin only' }[e.access] || '';
      let h = '<h3 style="margin:0 0 6px">' + e.title + '</h3>';
      if (badge) h += '<div style="font-size:.78rem;font-weight:700;color:var(--primary,#4f46e5);margin-bottom:10px">' + badge + '</div>';
      h += '<p>' + e.detail + '</p>';
      h += '<p><strong>Who it is for.</strong> ' + e.audience + '</p>';
      h += '<p><strong>Why it matters.</strong> ' + e.why + '</p>';
      h += '<p><strong>How to use it</strong></p><ol style="padding-left:20px">' +
           (e.how || []).map(function (x) { return '<li style="margin:.3em 0">' + x + '</li>'; }).join('') + '</ol>';
      h += '<p><strong>How it connects.</strong> ' + e.connects + '</p>';
      if (e.related && e.related.length) {
        h += '<p><strong>Related pages:</strong> ' + e.related.map(function (r) {
          return '<a href="' + r + '.html">' + r.replace(/-/g, ' ') + '</a>';
        }).join(' · ') + '</p>';
      }
      return h;
    } catch (_) { return null; }
  },
  /* V27 — the popup must pick its OWN colours from the theme actually in
     force. The app writes `document.body.dataset.theme` (see app.js /
     theme-engine.js); inline styles beat stylesheets, so the surface sets
     both background AND text inline, matched to the current theme. This is
     the definitive fix for "the Page Help text is invisible until I select
     it" — that symptom is text the same colour as its background, which
     happens exactly when a surface sets one and not the other. */
  _themeDark() {
    const b = document.body;
    const t = (b.dataset && (b.dataset.theme || b.dataset.mode || '')) ||
              (b.className || '');
    return /dark/.test(String(t));
  },
  showHelp() {
    let desc = this.descriptions[this.currentPage];
    const rich = this.fromGuide(this.currentPage);
    if (!desc && rich) desc = rich;
    else if (desc && rich) desc = desc + '<hr style="margin:14px 0;border:none;border-top:1px solid #e2e8f0">' + rich;
    if (!desc) desc = this.descriptions['default'];
    const dark = this._themeDark();
    const bg = dark ? '#111827' : '#ffffff';
    const ink = dark ? '#f1f5f9' : '#0f172a';
    const mut = dark ? '#94a3b8' : '#475569';
    const line = dark ? '#334155' : '#e2e8f0';
    const link = dark ? '#a5b4fc' : '#0506ae';
    const chip = dark ? '#1e293b' : '#e2e8f0';
    try {
      if (window.TC && TC.ASSISTANT && TC.ASSISTANT.formatPage) {
        const a = TC.ASSISTANT.formatPage(this.currentPage);
        if (a) desc = a + '<hr style="margin:14px 0;border:none;border-top:1px solid #e2e8f0">' + desc;
      }
    } catch (_) {}
    /* -------------------------------------------------------------------
       ITEM 4 FIX (reported): "whenever a popup shows up on any page the
       text is not legible."

       THIS is the popup that appears on every page — ❓ Page Help. The
       previous fix added rules for `.modal`, but this element has no
       class at all: it is built from inline styles, and inline styles beat
       any stylesheet. It set `background:white` and NEVER set a text
       colour, so the contents inherited `color` from the app shell. On
       the dark-capable themes, and in dark mode, that inherited colour is
       a near-white intended for a dark surface: white text on a white
       card.

       Fixed at source. The surface now carries the class `tc-popup` AND
       explicit inline colours, so it is legible whether or not the
       stylesheet loads. Contrast: #0f172a on #ffffff = 17.4:1.
       ------------------------------------------------------------------- */
    const modal = document.createElement('div');
    modal.className = 'tc-popup-backdrop';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.62);z-index:10000;' +
      'display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = '<div class="tc-popup" style="background:' + bg + ';color:' + ink + ';border-radius:16px;' +
        'max-width:640px;width:100%;max-height:80vh;overflow-y:auto;padding:26px;position:relative;' +
        'box-shadow:0 24px 60px rgba(15,23,42,.35);border:1px solid ' + line + '">' +
      '<button type="button" data-help-close style="position:absolute;top:12px;right:12px;' +
        'background:' + chip + ';border:none;border-radius:50%;width:34px;height:34px;font-size:20px;' +
        'cursor:pointer;color:' + ink + ';line-height:1" aria-label="Close">×</button>' +
      '<div style="font-size:1.05rem;line-height:1.7;color:' + ink + '">' +
        desc.replace(/\n/g, '<br>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') + '</div>' +
      '<div style="margin-top:20px;padding-top:16px;border-top:1px solid ' + line + ';font-size:.85rem;' +
        'color:' + mut + '">Need more? Open the <a href="feature-guide.html" style="color:' + link + '">Feature Guide</a> ' +
        'or WhatsApp HMG on <a href="https://wa.me/2348100866322" target="_blank" rel="noopener" ' +
        'style="color:' + link + '">+234 810 086 6322</a>.</div></div>';
    modal.querySelector('[data-help-close]').addEventListener('click', () => modal.remove());
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
  },
  explainPage() { this.showHelp(); }
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => SiteHelp.init());
else SiteHelp.init();
window.SiteHelp = SiteHelp;
