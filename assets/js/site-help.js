/* Tutoring Connect — Page Help (rules-based, no AI API)
   ---------------------------------------------------------------------------
   V31: formatting rewrite.
   V30 made text VISIBLE but left three presentation bugs:
     1. Markdown **bold** was never converted — a double-escaped regex meant
        literal "**Dashboard**" and asterisks showed in the popup.
     2. Newlines from assistant-kb formatPage() were not turned into breaks
        for the same reason, so walls of text appeared.
     3. CSS `.tc-popup-body * { color:… !important }` plus pinning every
        descendant made the whole card feel "all bold" / unformatted.
   This file now:
     • Converts markdown to HTML with a real formatter (bold, paragraphs,
       lists, inline code) BEFORE insertion.
     • Keeps curated blurbs, PAGE_GUIDE rich HTML, and assistant text in
       clearly separated, well-typed sections.
     • Uses normal font-weight for body copy; only <strong> is bold.
     • Still pins a light card + dark ink so the invisible-text bug cannot
       return.
   ========================================================================= */
const SiteHelp = {
  descriptions: {
    'health': "🏥 **Health & Medical** — Track medical conditions, allergies, emergency contacts, and sick-bay incidents.",
    'inventory': "📦 **Inventory & Assets** — Manage physical assets like textbooks, tablets, and stationary.",
    'alumni': "🎓 **Alumni Network** — Keep in touch with graduated students and manage success stories.",
    'transport': "🚌 **Transport & Pickup** — Log authorized pickup persons and manage daily departures.",
    'about': "🏢 **About** — School and studio information. View your establishment's vision, mission, and core administrative details.",
    'accommodations': "🦽 **Accommodations** — Manage special educational needs (SEN). Track learning accommodations, IEPs, and adjustments required for specific learners.",
    'admission-apply': "ℹ️ **Admission Apply** — Comprehensive management for admission apply. Use this module to effectively track, configure, and maintain all admission apply processes seamlessly. Fully integrated with your analytics and activity logs.",
    'admission-links': "ℹ️ **Admission Links** — Comprehensive management for admission links. Use this module to effectively track, configure, and maintain all admission links processes seamlessly. Fully integrated with your analytics and activity logs.",
    'announcements': "📢 **Announcements** — Broadcast urgent notices and updates to all staff, learners, and parents. Pin important items to the dashboard.",
    'assignments': "📝 **Assignments** — Create, distribute, and grade homework. Track submissions in real-time and provide detailed feedback to learners.",
    'availability': "ℹ️ **Availability** — Comprehensive management for availability. Use this module to effectively track, configure, and maintain all availability processes seamlessly. Fully integrated with your analytics and activity logs.",
    'birthdays': "ℹ️ **Birthdays** — Comprehensive management for birthdays. Use this module to effectively track, configure, and maintain all birthdays processes seamlessly. Fully integrated with your analytics and activity logs.",
    'broadcasts': "ℹ️ **Broadcasts** — Comprehensive management for broadcasts. Use this module to effectively track, configure, and maintain all broadcasts processes seamlessly. Fully integrated with your analytics and activity logs.",
    'calendar': "📅 **Calendar** — Central schedule for all classes, meetings, and term dates. Integrates automatically with learner and staff views.",
    'cancellations': "ℹ️ **Cancellations** — Comprehensive management for cancellations. Use this module to effectively track, configure, and maintain all cancellations processes seamlessly. Fully integrated with your analytics and activity logs.",
    'certificates': "📜 **Certificates** — Auto-generate graduation, completion, and participation certificates. Branded instantly with your studio's logo.",
    'change-password': "ℹ️ **Change Password** — Comprehensive management for change password. Use this module to effectively track, configure, and maintain all change password processes seamlessly. Fully integrated with your analytics and activity logs.",
    'complaints': "📨 **Complaints** — Dedicated grievance tracking. Manage tickets from open to resolved with full audit trails.",
    'compliance': "ℹ️ **Compliance** — Comprehensive management for compliance. Use this module to effectively track, configure, and maintain all compliance processes seamlessly. Fully integrated with your analytics and activity logs.",
    'contact': "ℹ️ **Contact** — Comprehensive management for contact. Use this module to effectively track, configure, and maintain all contact processes seamlessly. Fully integrated with your analytics and activity logs.",
    'contracts': "ℹ️ **Contracts** — Comprehensive management for contracts. Use this module to effectively track, configure, and maintain all contracts processes seamlessly. Fully integrated with your analytics and activity logs.",
    'curriculum': "ℹ️ **Curriculum** — Comprehensive management for curriculum. Use this module to effectively track, configure, and maintain all curriculum processes seamlessly. Fully integrated with your analytics and activity logs.",
    'developer': "👨‍💻 **Developer** — Information about the HMG platform ecosystem, licensing details, and product philosophy.",
    'diagnostics': "ℹ️ **Diagnostics** — Comprehensive management for diagnostics. Use this module to effectively track, configure, and maintain all diagnostics processes seamlessly. Fully integrated with your analytics and activity logs.",
    'eresources': "📚 **E-Resources** — A unified digital library. Distribute PDFs, links, and study materials securely to authorized classes.",
    'events': "ℹ️ **Events** — Comprehensive management for events. Use this module to effectively track, configure, and maintain all events processes seamlessly. Fully integrated with your analytics and activity logs.",
    'exam-targets': "ℹ️ **Exam Targets** — Comprehensive management for exam targets. Use this module to effectively track, configure, and maintain all exam targets processes seamlessly. Fully integrated with your analytics and activity logs.",
    'family-links': "ℹ️ **Family Links** — Comprehensive management for family links. Use this module to effectively track, configure, and maintain all family links processes seamlessly. Fully integrated with your analytics and activity logs.",
    'fees': "ℹ️ **Fees** — Comprehensive management for fees. Use this module to effectively track, configure, and maintain all fees processes seamlessly. Fully integrated with your analytics and activity logs.",
    'finance': "💰 **Finance** — Complete financial dashboard. Track income, expenses, pending invoices, and overall studio revenue.",
    'flashcards': "ℹ️ **Flashcards** — Comprehensive management for flashcards. Use this module to effectively track, configure, and maintain all flashcards processes seamlessly. Fully integrated with your analytics and activity logs.",
    'flyer': "ℹ️ **Flyer** — Comprehensive management for flyer. Use this module to effectively track, configure, and maintain all flyer processes seamlessly. Fully integrated with your analytics and activity logs.",
    'forgot-password': "ℹ️ **Forgot Password** — Comprehensive management for forgot password. Use this module to effectively track, configure, and maintain all forgot password processes seamlessly. Fully integrated with your analytics and activity logs.",
    'gallery': "ℹ️ **Gallery** — Comprehensive management for gallery. Use this module to effectively track, configure, and maintain all gallery processes seamlessly. Fully integrated with your analytics and activity logs.",
    'gamification': "ℹ️ **Gamification** — Comprehensive management for gamification. Use this module to effectively track, configure, and maintain all gamification processes seamlessly. Fully integrated with your analytics and activity logs.",
    'goals': "ℹ️ **Goals** — Comprehensive management for goals. Use this module to effectively track, configure, and maintain all goals processes seamlessly. Fully integrated with your analytics and activity logs.",
    'group-insights': "ℹ️ **Group Insights** — Comprehensive management for group insights. Use this module to effectively track, configure, and maintain all group insights processes seamlessly. Fully integrated with your analytics and activity logs.",
    'helpdesk': "🛠️ **Help Desk** — Internal IT and maintenance ticketing. Ensure technical and physical issues are tracked and resolved.",
    'hmg-products': "ℹ️ **Hmg Products** — Comprehensive management for hmg products. Use this module to effectively track, configure, and maintain all hmg products processes seamlessly. Fully integrated with your analytics and activity logs.",
    'idcards': "🪪 **ID Cards** — Generate and print professional ID cards with QR codes for fast scanning and attendance tracking.",
    'install': "ℹ️ **Install** — Comprehensive management for install. Use this module to effectively track, configure, and maintain all install processes seamlessly. Fully integrated with your analytics and activity logs.",
    'learning-styles': "ℹ️ **Learning Styles** — Comprehensive management for learning styles. Use this module to effectively track, configure, and maintain all learning styles processes seamlessly. Fully integrated with your analytics and activity logs.",
    'leave': "🏖️ **Leave** — Staff leave requests and approvals. Maintain schedules and ensure classes are covered during absences.",
    'lesson-plans': "📋 **Lesson Plans** — Tutor curriculum mapping. Store objectives, activities, and outcomes for every session.",
    'license': "ℹ️ **License** — Comprehensive management for license. Use this module to effectively track, configure, and maintain all license processes seamlessly. Fully integrated with your analytics and activity logs.",
    'makeup-credits': "ℹ️ **Makeup Credits** — Comprehensive management for makeup credits. Use this module to effectively track, configure, and maintain all makeup credits processes seamlessly. Fully integrated with your analytics and activity logs.",
    'makeups': "ℹ️ **Makeups** — Comprehensive management for makeups. Use this module to effectively track, configure, and maintain all makeups processes seamlessly. Fully integrated with your analytics and activity logs.",
    'mastery': "ℹ️ **Mastery** — Comprehensive management for mastery. Use this module to effectively track, configure, and maintain all mastery processes seamlessly. Fully integrated with your analytics and activity logs.",
    'meetings': "ℹ️ **Meetings** — Comprehensive management for meetings. Use this module to effectively track, configure, and maintain all meetings processes seamlessly. Fully integrated with your analytics and activity logs.",
    'methodologies': "ℹ️ **Methodologies** — Comprehensive management for methodologies. Use this module to effectively track, configure, and maintain all methodologies processes seamlessly. Fully integrated with your analytics and activity logs.",
    'my-children': "ℹ️ **My Children** — Comprehensive management for my children. Use this module to effectively track, configure, and maintain all my children processes seamlessly. Fully integrated with your analytics and activity logs.",
    'onboarding': "ℹ️ **Onboarding** — Comprehensive management for onboarding. Use this module to effectively track, configure, and maintain all onboarding processes seamlessly. Fully integrated with your analytics and activity logs.",
    'parent-meetings': "ℹ️ **Parent Meetings** — Comprehensive management for parent meetings. Use this module to effectively track, configure, and maintain all parent meetings processes seamlessly. Fully integrated with your analytics and activity logs.",
    'payment-history': "ℹ️ **Payment History** — Comprehensive management for payment history. Use this module to effectively track, configure, and maintain all payment history processes seamlessly. Fully integrated with your analytics and activity logs.",
    'payment-plans': "ℹ️ **Payment Plans** — Comprehensive management for payment plans. Use this module to effectively track, configure, and maintain all payment plans processes seamlessly. Fully integrated with your analytics and activity logs.",
    'payment-required': "ℹ️ **Payment Required** — Comprehensive management for payment required. Use this module to effectively track, configure, and maintain all payment required processes seamlessly. Fully integrated with your analytics and activity logs.",
    'payroll': "ℹ️ **Payroll** — Comprehensive management for payroll. Use this module to effectively track, configure, and maintain all payroll processes seamlessly. Fully integrated with your analytics and activity logs.",
    'policies': "ℹ️ **Policies** — Comprehensive management for policies. Use this module to effectively track, configure, and maintain all policies processes seamlessly. Fully integrated with your analytics and activity logs.",
    'polls': "ℹ️ **Polls** — Comprehensive management for polls. Use this module to effectively track, configure, and maintain all polls processes seamlessly. Fully integrated with your analytics and activity logs.",
    'portfolio': "ℹ️ **Portfolio** — Comprehensive management for portfolio. Use this module to effectively track, configure, and maintain all portfolio processes seamlessly. Fully integrated with your analytics and activity logs.",
    'products': "ℹ️ **Products** — Comprehensive management for products. Use this module to effectively track, configure, and maintain all products processes seamlessly. Fully integrated with your analytics and activity logs.",
    'progress-reports': "📈 **Progress Reports** — Granular reporting on learner mastery. Generate comprehensive reports for parents in one click.",
    'referrals': "ℹ️ **Referrals** — Comprehensive management for referrals. Use this module to effectively track, configure, and maintain all referrals processes seamlessly. Fully integrated with your analytics and activity logs.",
    'reminders': "ℹ️ **Reminders** — Comprehensive management for reminders. Use this module to effectively track, configure, and maintain all reminders processes seamlessly. Fully integrated with your analytics and activity logs.",
    'resources': "ℹ️ **Resources** — Comprehensive management for resources. Use this module to effectively track, configure, and maintain all resources processes seamlessly. Fully integrated with your analytics and activity logs.",
    'reviews': "ℹ️ **Reviews** — Comprehensive management for reviews. Use this module to effectively track, configure, and maintain all reviews processes seamlessly. Fully integrated with your analytics and activity logs.",
    'rooms': "ℹ️ **Rooms** — Comprehensive management for rooms. Use this module to effectively track, configure, and maintain all rooms processes seamlessly. Fully integrated with your analytics and activity logs.",
    'rubrics': "ℹ️ **Rubrics** — Comprehensive management for rubrics. Use this module to effectively track, configure, and maintain all rubrics processes seamlessly. Fully integrated with your analytics and activity logs.",
    'scholarships': "ℹ️ **Scholarships** — Comprehensive management for scholarships. Use this module to effectively track, configure, and maintain all scholarships processes seamlessly. Fully integrated with your analytics and activity logs.",
    'security-centre': "🛡️ **Security Centre** — Robust access control. Configure IP whitelists, idle lockouts, MFA requirements, and role-based policies.",
    'session-notes': "ℹ️ **Session Notes** — Comprehensive management for session notes. Use this module to effectively track, configure, and maintain all session notes processes seamlessly. Fully integrated with your analytics and activity logs.",
    'status-manager': "ℹ️ **Status Manager** — Comprehensive management for status manager. Use this module to effectively track, configure, and maintain all status manager processes seamlessly. Fully integrated with your analytics and activity logs.",
    'study-log': "ℹ️ **Study Log** — Comprehensive management for study log. Use this module to effectively track, configure, and maintain all study log processes seamlessly. Fully integrated with your analytics and activity logs.",
    'substitutions': "ℹ️ **Substitutions** — Comprehensive management for substitutions. Use this module to effectively track, configure, and maintain all substitutions processes seamlessly. Fully integrated with your analytics and activity logs.",
    'timezones': "ℹ️ **Timezones** — Comprehensive management for timezones. Use this module to effectively track, configure, and maintain all timezones processes seamlessly. Fully integrated with your analytics and activity logs.",
    'transcripts': "📄 **Transcripts** — Official academic records. Compile multi-term results into formal exportable transcripts.",
    'wallet': "ℹ️ **Wallet** — Comprehensive management for wallet. Use this module to effectively track, configure, and maintain all wallet processes seamlessly. Fully integrated with your analytics and activity logs.",
    'whiteboard': "🖍️ **Whiteboard** — Live interactive digital whiteboard for virtual sessions. Draw, type, and diagram in real-time.",
    'dashboard': 'The role-aware studio hub. Admins and tutors see practice KPIs, an action digest and the live feed. Parents see only linked children — next classes, scores and invoices. Learners see only themselves. 1:1 and group engagements never smear data across each other.',
    'engagements': 'The atomic unit of the studio. A 1:1 or a named group is an independent contract with its own curriculum, hour bank, goals, fees and analytics. Create one engagement per teaching relationship. Siblings always get separate engagements.',
    'learners': 'Identity register: student ID (auto TC-0001 style), timezone, year group, day school, learning notes, accommodations, Drive photo link. A learner may sit in many engagements independently.',
    'groups': 'Named group engagements (typically 2–12). Shared sessions, individual mastery and scores. Group insights never hide a child who is falling behind.',
    'parents': 'Parent registry plus parent–learner mapping. Linking is what makes the family portal work — a parent then sees ONLY their own children.',
    'tutors': 'Solo or multi-tutor studio. Availability, specialisms, pay rate, timezone.',
    'subjects': 'Subjects and exam boards — Maths, English, SAT, WAEC, IGCSE, IELTS and more. Board, level, default methodology.',
    'inquiries': 'Pipeline: new → contacted → trial booked → converted / lost. Public apply.html and application links land here.',
    'waitlist': 'Hold demand when a slot or group is full. Promote into an engagement when ready.',
    'trials': 'Diagnostic trial. Captures baseline score (locks value-added) and fit notes before a package is sold.',
    'bookings': 'Cycle bookings. A full booking is 4 cycles × 7 days. Times per cycle × 4 = classes. Amount = hourly rate × (minutes/60) × classes. Visible to tutor, parent and learner.',
    'session-complete': 'Tutor marks the class done, writes feedback, ticks SOW topics. Feedback lands on parent and learner dashboards and feeds insights.',
    'sessions': 'Every lesson: start/end, mode, meeting URL, whiteboard, hours deducted when status = done.',
    'attendance': 'Present / late / absent / excused per learner, even inside a group. Feeds the 80% at-risk rule.',
    'sow': 'Scheme of Work. At term start enter every topic. Follow coverage, evaluate each learner, push scores into the scoresheet.',
    'practice': 'Quizzes — three kinds. Self = private practice (off scoresheet). Review = after class. Graded = official, auto-pushes to the scoresheet. 17+ question types. No AI API.',
    'cbt-exam': 'Take a quiz with student ID (e.g. TC-0001), not a typed name. Timer, anti-cheat, then review (your answer / correct / explanation) and Save PDF.',
    'cbt-review': 'Load your attempt with quiz code + student ID/name. See answer vs key vs explanation, diagrams, filters, calculator, maths keyboard, and print a study PDF.',
    'cbt-multi': 'Multi-subject CBT builder — one sitting, subject tabs (UTME-style). Shared timer, per-subject breakdown, full anti-cheat.',
    'cbt-prompts': 'Build CSV prompts for free chats — including multi-line maths (fractions/matrices) and diagram items via https/Drive links. No AI API.',
    'cbt-prompts-dup': 'Copy-paste question-bank prompts into any free external chat. The platform never calls a paid AI.',
    'cbt-results': 'Who sat each paper, scores, item analysis, integrity flags, CSV export, tutor open-response marking.',
    'scoresheet': 'Single ledger of graded quizzes, SOW evaluations and homework. Visible to the linked parent and the learner.',
    'reading': 'Reading assignments — article / video / PDF / playlist links tied to the next SOW topic. Loop: read → Self-Quiz → class. Never upload files into free Supabase.',
    'forum': 'Group forum — threads scoped to a group engagement only. 1:1 contracts have no forum.',
    'stream': 'Class stream — Google Classroom-style feed: announcements, questions, materials, scheduled posts. Link previews only.',
    'classwork': 'Work by topic. Assignments, quizzes, materials, comment-only return, skills tags.',
    'insights': 'Insights Lab — formulas you can read. Value-added = current − baseline. Prediction = OLS on recent scores. Six at-risk rules. No AI.',
    'learner-360': 'One page: identity, engagements, hours, scores, mastery, flags, notes, invoices. Family-safe.',
    'at-risk': 'Rules: attendance under 80%, idle ≥ 14 days, hours under 2, homework under 60%, last 3 declining, over 40% topics under 50%.',
    'predictions': 'Predicted grades — transparent linear projection. Formula is shown to parents.',
    'value-added': 'Current average minus diagnostic baseline. The number parents actually buy.',
    'analytics': 'Practice analytics — utilisation, conversion, revenue, value-added distribution, retention. Chart.js + SVG fallback.',
    'packages': 'Hour banks — prepaid hours on the engagement. Completing a session deducts automatically.',
    'invoices': 'From cycle bookings or packages. Multi-currency. Printable.',
    'payments': 'Record bank / cash / Paystack / Flutterwave / Stripe links. No forced processor.',
    'inbox': 'Private tutor ↔ parent ↔ learner threads. Also fires the notification bell.',
    'messages': 'Free wa.me / mailto: / sms: compose. No Twilio bill.',
    'notifications': 'In-app bell + browser push after PWA install + email/WA/SMS compose.',
    'voting': 'Anonymous or named polls. Live tally. Multi-channel notify when a poll opens.',
    'surveys': 'After-trial and termly parent pulse. Feeds retention insight.',
    'library': 'Digital library — catalogued reading / past-paper links. Optional comprehension score.',
    'lms': 'Mini LMS — courses and lessons scoped to an engagement. Completion ticks. Links only.',
    'apply': 'Public inquiry / application. Parents request tutoring. Also opens ?code= application links.',
    'application-links': 'Expiring, limited-use codes for a subject, 1:1 or group. Share on WhatsApp/social with QR.',
    'class-links': 'One shareable link per paid or free class. Social composers, QR, registration funnel.',
    'class-register': 'Public class register — parent lands from a share link, registers in under a minute, gets a registration number.',
    'free-classes': 'Free / outreach class cohorts with tokenised public sign-up.',
    'free-register': 'Public free-class sign-up opened from a token. No portal account required.',
    'blog': 'Public writing space. Search and filter by topic. Indexed for discovery.',
    'blog-manage': 'Write, edit, publish, unpublish and archive posts; manage categories.',
    'blog-post': 'Single public post reader (?slug=).',
    'documents': 'Branded letters, certificates, hall tickets. Tokenised body, live preview, print/PDF.',
    'exam-links': 'Exam registration links — WAEC through GRE. Passport is a Drive link, never an upload.',
    'exam-register': 'Public exam candidate form opened by an exam link.',
    'admin-data': 'Local backup/restore, sealed archives, Google Drive sync, table browser. No uploads into the 500 MB database.',
    'platform-health': 'Keep-alive heartbeat, DB size vs 500 MB, Drive backup, license, idle lock, lockdown, login audit.',
    'settings': 'Brand, logo URL, signatures, timezone (Africa/Lagos), currency ₦, cancellation hours, accessibility, 2FA email OTP.',
    'storage': 'Guardian of the free 500 MB. Archive then purge old logs.',
    'activity-log': 'Who created, edited, deleted, signed in.',
    'approvals': 'New accounts start pending. Approve only people you recognise.',
    'safeguarding': 'Confidential incidents. Admin/tutor only. Never in the parent nav.',
    'profile': 'Your name, phone, timezone, photo (Drive link), password change.',
    'hmg-ecosystem': 'HMG Concepts ecosystem — Concepts, Technologies, Academy, Media, Gospel. Founder Adewale Samson Adeagbo.',
    'feature-guide': 'Every module explained: why it exists, who uses it, how it connects.',
    'class-deck': 'ADEWALE CLASSROOM DECK — teach live with split-screen whiteboard, Meet companion, student join links and toolkit. No AI API.',
    'directory': 'Searchable directory of learners, parents, tutors and staff with portal-link status, WhatsApp and CSV export.',
    'default': 'Every page has (1) this Page Help, (2) the feature card at the top, (3) the studio assistant. New here? Start at the Dashboard. Admins: confirm Platform Health is green.'
  },

  /* -------- markdown → safe, readable HTML -------------------------------- */
  md(src) {
    var s = String(src == null ? '' : src);
    // If it already looks like structured HTML from fromGuide, keep tags but
    // still normalise weight and strip scripts.
    var looksHtml = /<\/?(p|h[1-6]|ul|ol|li|div|section|table|br|hr|strong|em|a)\b/i.test(s);
    if (looksHtml) {
      return s
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/\son\w+="[^"]*"/gi, '')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    }
    // Escape first so user/content asterisks and angles cannot inject markup.
    s = s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    // Inline code
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold **text** (non-greedy, no cross-paragraph)
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    // Italic *text* (after bold so we do not eat **)
    s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    // Split into blocks on blank lines
    var blocks = s.split(/\n{2,}/);
    var html = blocks.map(function (block) {
      var b = block.trim();
      if (!b) return '';
      // unordered list
      if (/^[-•]\s/m.test(b) && b.split('\n').every(function (ln) {
        return !ln.trim() || /^[-•]\s/.test(ln.trim());
      })) {
        var items = b.split('\n').map(function (ln) {
          return ln.trim().replace(/^[-•]\s+/, '');
        }).filter(Boolean);
        return '<ul class="tc-help-ul">' + items.map(function (i) {
          return '<li>' + i.replace(/\n/g, ' ') + '</li>';
        }).join('') + '</ul>';
      }
      // numbered list (1. 2. or 1) )
      if (/^\d+[\.\)]\s/m.test(b)) {
        var nitems = b.split('\n').map(function (ln) {
          return ln.trim().replace(/^\d+[\.\)]\s+/, '');
        }).filter(Boolean);
        return '<ol class="tc-help-ol">' + nitems.map(function (i) {
          return '<li>' + i + '</li>';
        }).join('') + '</ol>';
      }
      // single line "Title — rest" lead
      return '<p class="tc-help-p">' + b.replace(/\n/g, '<br>') + '</p>';
    }).filter(Boolean).join('');
    return html || '<p class="tc-help-p"></p>';
  },

  init() {
    var page = (location.pathname.split('/').pop() || 'dashboard')
      .replace(/\.html?$/i, '').split('?')[0].split('#')[0];
    this.currentPage = page;
    this.attachHelpButton();
  },

  attachHelpButton() {
    var existing = document.getElementById('page-help-btn');
    if (existing) existing.remove();
    var btn = document.createElement('button');
    btn.id = 'page-help-btn';
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.textContent = '❓ Page Help';
    btn.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:9998;' +
      'background:linear-gradient(135deg,#0506ae,#964eec);color:#ffffff;border:none;' +
      'border-radius:50px;padding:12px 20px;font-size:14px;font-weight:700;' +
      'cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.28);font-family:inherit';
    var self = this;
    btn.addEventListener('click', function () { self.showHelp(); });
    document.body.appendChild(btn);
  },

  fromGuide(page) {
    try {
      var g = (window.TC && window.TC.PAGE_GUIDE) || window.PAGE_GUIDE || {};
      var e = g[page];
      if (!e) return null;
      var badgeMap = {
        public: 'Public page',
        'code-gated': 'Opened with a quiz code',
        family: 'Family view',
        staff: 'Staff only',
        owner: 'Owner / admin only'
      };
      var badge = badgeMap[e.access] || '';
      var h = '';
      h += '<header class="tc-help-head">';
      h += '<h2 class="tc-help-title">' + this._esc(e.title || page) + '</h2>';
      if (badge) h += '<div class="tc-help-badge">' + this._esc(badge) + '</div>';
      h += '</header>';
      if (e.detail || e.purpose || e.what) {
        h += '<p class="tc-help-p">' + this._esc(e.detail || e.purpose || e.what) + '</p>';
      }
      if (e.audience || e.who) {
        h += '<p class="tc-help-p"><strong>Who it is for.</strong> ' +
          this._esc(e.audience || e.who) + '</p>';
      }
      if (e.why) {
        h += '<p class="tc-help-p"><strong>Why it matters.</strong> ' + this._esc(e.why) + '</p>';
      }
      var how = e.how || [];
      if (how.length) {
        h += '<p class="tc-help-label">How to use it</p><ol class="tc-help-ol">';
        how.forEach(function (step) {
          h += '<li>' + SiteHelp._esc(step) + '</li>';
        });
        h += '</ol>';
      }
      if (e.connects) {
        h += '<p class="tc-help-p"><strong>How it connects.</strong> ' + this._esc(e.connects) + '</p>';
      }
      if (e.related && e.related.length) {
        h += '<p class="tc-help-p"><strong>Related pages:</strong> ';
        h += e.related.map(function (r) {
          var id = String(r).replace(/\.html$/i, '');
          return '<a class="tc-help-a" href="' + id + '.html">' +
            SiteHelp._esc(id.replace(/-/g, ' ')) + '</a>';
        }).join(' · ');
        h += '</p>';
      }
      // Sections summary (first 8) so help is complete without dumping a wall
      if (e.sections && e.sections.length) {
        h += '<p class="tc-help-label">What is on this page</p><ul class="tc-help-ul">';
        e.sections.slice(0, 8).forEach(function (sec) {
          var name = sec.name || sec.title || '';
          var what = sec.what || sec.detail || '';
          h += '<li><strong>' + SiteHelp._esc(name) + '</strong>' +
            (what ? ' — ' + SiteHelp._esc(what) : '') + '</li>';
        });
        h += '</ul>';
      }
      return h;
    } catch (_) { return null; }
  },

  _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  showHelp() {
    var old = document.getElementById('page-help-modal');
    if (old) old.remove();

    var page = this.currentPage;
    var curated = this.descriptions[page] || this.descriptions['default'];
    var rich = this.fromGuide(page);
    var assistant = '';
    try {
      if (window.TC && TC.ASSISTANT && TC.ASSISTANT.formatPage) {
        assistant = TC.ASSISTANT.formatPage(page) || '';
      }
    } catch (_) {}

    // Theme-aware constants (tests + future dark card option).
    // Page Help always uses the LIGHT readable card so text cannot bleach.
    const dark = false; // Page Help always uses the light readable card
    const bg = dark ? '#111827' : '#ffffff';
    const ink = dark ? '#f1f5f9' : '#0f172a';
    const mut = dark ? '#94a3b8' : '#475569';
    const line = dark ? '#334155' : '#e2e8f0';
    const link = dark ? '#a5b4fc' : '#0506ae';
    const chip = dark ? '#1e293b' : '#e2e8f0';

    var bodyHtml = '';
    // 1) Short curated summary (markdown → HTML)
    if (curated) {
      bodyHtml += '<section class="tc-help-section">' + this.md(curated) + '</section>';
    }
    // 2) Structured guide (already HTML, escaped fields)
    if (rich) {
      bodyHtml += '<hr class="tc-help-hr">';
      bodyHtml += '<section class="tc-help-section">' + rich + '</section>';
    }
    // 3) Assistant long-form only if it adds something new (markdown → HTML)
    if (assistant && (!curated || assistant.length > (curated.length + 40))) {
      bodyHtml += '<hr class="tc-help-hr">';
      bodyHtml += '<section class="tc-help-section tc-help-extra">';
      bodyHtml += '<p class="tc-help-label">More detail</p>';
      bodyHtml += this.md(assistant);
      bodyHtml += '</section>';
    }
    if (!bodyHtml) {
      bodyHtml = '<section class="tc-help-section">' + this.md(this.descriptions['default']) + '</section>';
    }

    var modal = document.createElement('div');
    modal.id = 'page-help-modal';
    modal.className = 'tc-popup-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Page help');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.62);z-index:10060;' +
      'display:flex;align-items:center;justify-content:center;padding:20px';

    // class="tc-popup" required by runtime tests + CSS hooks
    modal.innerHTML =
      '<div class="tc-popup" style="background:' + bg + ';color:' + ink + ';border-radius:16px;' +
        'max-width:680px;width:100%;max-height:82vh;overflow-y:auto;padding:28px 28px 22px;position:relative;' +
        'box-shadow:0 24px 60px rgba(15,23,42,.35);border:1px solid ' + line + ';' +
        'font-family:inherit;font-weight:400;font-size:1rem;line-height:1.65">' +
        '<button type="button" data-help-close style="position:absolute;top:12px;right:12px;' +
          'background:' + chip + ';border:none;border-radius:50%;width:34px;height:34px;font-size:20px;' +
          'cursor:pointer;color:' + ink + ';line-height:1;font-weight:400" aria-label="Close">×</button>' +
        '<div class="tc-popup-body" style="color:' + ink + ';font-weight:400">' + bodyHtml + '</div>' +
        '<div class="tc-popup-foot" style="margin-top:18px;padding-top:14px;border-top:1px solid ' + line +
          ';font-size:.85rem;color:' + mut + ';font-weight:400">Need more? Open the ' +
          '<a class="tc-popup-a" href="feature-guide.html" style="color:' + link + ';font-weight:600">Feature Guide</a> ' +
          'or WhatsApp HMG on <a class="tc-popup-a" href="https://wa.me/2348100866322" target="_blank" rel="noopener" style="color:' +
          link + ';font-weight:600">+234 810 086 6322</a>.</div>' +
      '</div>';

    document.body.appendChild(modal);

    // Soft pin: card surface + body ink only — do NOT force every descendant
    // to the same weight/colour (that made everything look bold).
    var card = modal.querySelector('.tc-popup');
    var body = modal.querySelector('.tc-popup-body');
    try {
      if (card) {
        card.style.setProperty('background', bg, 'important');
        card.style.setProperty('color', ink, 'important');
        card.style.setProperty('font-weight', '400', 'important');
      }
      if (body) {
        body.style.setProperty('color', ink, 'important');
        body.style.setProperty('font-weight', '400', 'important');
      }
      modal.querySelectorAll('.tc-help-p, .tc-help-ul, .tc-help-ol, .tc-help-ul li, .tc-help-ol li, .tc-popup-body p, .tc-popup-body li').forEach(function (el) {
        el.style.setProperty('font-weight', '400', 'important');
        el.style.setProperty('color', ink, 'important');
      });
      modal.querySelectorAll('strong, b, .tc-help-title, .tc-help-label').forEach(function (el) {
        el.style.setProperty('font-weight', '700', 'important');
        el.style.setProperty('color', ink, 'important');
      });
      modal.querySelectorAll('a').forEach(function (a) {
        a.style.setProperty('color', link, 'important');
        a.style.setProperty('font-weight', '600', 'important');
      });
      modal.querySelectorAll('.tc-popup-foot, .tc-help-badge, .muted').forEach(function (el) {
        el.style.setProperty('color', mut, 'important');
        el.style.setProperty('font-weight', '400', 'important');
      });
    } catch (_) {}

    var dismiss = function () { try { modal.remove(); } catch (_) {} };
    modal.querySelector('[data-help-close]').addEventListener('click', dismiss);
    modal.addEventListener('click', function (e) { if (e.target === modal) dismiss(); });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { dismiss(); document.removeEventListener('keydown', onKey); }
    });
  },

  explainPage() { this.showHelp(); }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () { SiteHelp.init(); });
} else {
  SiteHelp.init();
}
window.SiteHelp = SiteHelp;
