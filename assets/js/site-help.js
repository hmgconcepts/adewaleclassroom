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
    'cbt-review': 'Re-open a sitting with the quiz code + student ID. See your answer, the key, the explanation, and save a PDF.',
    'cbt-multi': 'Multi-subject CBT builder — one sitting, subject tabs (UTME-style). Shared timer, per-subject breakdown, full anti-cheat.',
    'cbt-prompts': 'Copy-paste question-bank prompts into any free external chat. The platform never calls a paid AI.',
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
