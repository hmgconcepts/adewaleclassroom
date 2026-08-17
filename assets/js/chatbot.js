/* ============================================================================
   chatbot.js — Tutoring Connect V8 · "Studio Assistant"
   ----------------------------------------------------------------------------
   A retrieval assistant over the studio's own documentation. NO AI API, no
   network call, no per-message cost — it searches a local knowledge base
   (page-guide.js, 128 pages) and the module catalogue, and answers with the
   real description of the real page, plus a link that opens it.

   V7's bot knew 10 canned topics and could not describe most of the platform.
   V8 can explain EVERY page, section, role and process, and doubles as a
   navigator: ask "where do I mark attendance" and it takes you there.

   Ranking is a small BM25-ish keyword score over title, purpose, detail,
   group, actions and tabs, with synonym expansion for the words real users
   type ("marks", "grades", "fees", "register", "homework").
   ========================================================================== */
(function (w, d) {
  'use strict';

  var SYNONYMS = {
    mark: ['attendance', 'register', 'present', 'absent'],
    marks: ['score', 'scoresheet', 'result', 'grade', 'assessment'],
    grade: ['score', 'scoresheet', 'result', 'assessment', 'graded'],
    grades: ['score', 'scoresheet', 'result', 'assessment'],
    score: ['scoresheet', 'result', 'assessment', 'grade'],
    fees: ['invoice', 'payment', 'finance', 'billing', 'fee'],
    fee: ['invoice', 'payment', 'finance', 'billing'],
    money: ['invoice', 'payment', 'finance', 'payroll', 'fee'],
    pay: ['payment', 'invoice', 'finance'],
    homework: ['assignment', 'assignments', 'classwork', 'practice'],
    quiz: ['cbt', 'practice', 'exam', 'test', 'assessment'],
    test: ['cbt', 'quiz', 'practice', 'exam', 'assessment'],
    exam: ['cbt', 'exam-register', 'quiz', 'practice', 'targets'],
    book: ['booking', 'bookings', 'calendar', 'schedule', 'session'],
    booking: ['bookings', 'calendar', 'schedule', 'cycle'],
    class: ['session', 'sessions', 'calendar', 'booking'],
    lesson: ['session', 'lesson-plans', 'sow', 'curriculum'],
    parent: ['parents', 'family', 'guardian'],
    child: ['learner', 'learners', 'student'],
    student: ['learner', 'learners'],
    tutor: ['tutors', 'staff', 'teacher'],
    message: ['inbox', 'messages', 'announcements', 'notifications'],
    notify: ['notifications', 'reminders', 'announcements'],
    install: ['pwa', 'app', 'home screen', 'offline'],
    login: ['sign in', 'signin', 'password', 'account'],
    password: ['login', 'forgot-password', 'change-password', 'security'],
    report: ['progress-reports', 'transcripts', 'analytics', 'insights'],
    progress: ['insights', 'progress-reports', 'mastery', 'learner-360'],
    backup: ['storage', 'admin-data', 'drive', 'export'],
    deploy: ['deployment', 'vercel', 'netlify', 'supabase', 'host'],
    privacy: ['rls', 'security', 'family', 'safeguarding'],
    group: ['groups', 'engagement', 'engagements']
  };

  var PROCESS_KB = {
    'booking-cycle': {
      title: 'How bookings work (the 4-cycle model)',
      body: 'A full booking is <b>4 cycles of 7 days</b> (28 days). You choose how many classes fall in each cycle: ' +
            '2 times per cycle gives 2 × 4 = <b>8 classes</b>. Hours are classes × duration, and the amount due is ' +
            '<b>hours × your hourly rate</b>. The whole derivation is printed for the parent line by line on the ' +
            'bookings page, so there is never an argument about the number. Marking attendance is what deducts ' +
            'hours from the hour bank.',
      links: ['bookings', 'calendar', 'sessions', 'packages', 'invoices']
    },
    'quiz-modes': {
      title: 'How quizzes (CBT) work',
      body: 'There are three modes. <b>Self</b> is unmarked practice. <b>Review</b> shows the learner their answer, ' +
            'the correct key, an explanation and a printable PDF. <b>Graded</b> does all that and automatically ' +
            'pushes the result to the scoresheet and the assessment record, per subject. A learner signs in to a ' +
            'quiz with a <b>quiz code plus their student ID</b> (e.g. TC-0001) rather than a portal password, so ' +
            'exams work on a shared or borrowed device.',
      links: ['practice', 'cbt-exam', 'cbt-review', 'scoresheet', 'cbt-prompts']
    },
    'privacy': {
      title: 'How family privacy works',
      body: 'Every engagement is independent. A parent is linked to specific children and can see only those; a ' +
            'learner sees only themselves. This is enforced by <b>PostgreSQL Row Level Security</b> in the database ' +
            'itself, not merely by hiding buttons — if a family member types a URL directly, the database still ' +
            'returns nothing. A sibling\'s scores never leak, and a group average never hides an individual.',
      links: ['engagements', 'learners', 'parents', 'settings']
    },
    'deploy': {
      title: 'How to deploy a studio',
      body: 'Four steps. <b>1.</b> Create a free Supabase project and run <code>database/complete-schema.sql</code> ' +
            'in the SQL editor. <b>2.</b> Paste your project URL and anon key into <code>assets/js/config.js</code>. ' +
            '<b>3.</b> Host the folder on Vercel, Netlify, GitHub Pages or Cloudflare Pages — it is static, so any ' +
            'of them work on the free tier. <b>4.</b> Sign up the first account and promote it to admin in the ' +
            'profiles table. Full detail is in DEPLOYMENT-GUIDE.md.',
      links: ['platform-health', 'settings', 'admin-data']
    },
    'keepalive': {
      title: 'Why the studio never goes to sleep',
      body: 'Supabase pauses a free project after about 7 days of inactivity. This platform runs <b>10 layers</b> of ' +
            'keep-alive: a heartbeat on every page visit (throttled to once per 6 hours per device), a twice-weekly ' +
            'GitHub Action with a watchdog that fails loudly if the write did not land, a Vercel cron, a Supabase ' +
            'edge function, and a self-committing step that stops GitHub disabling the schedule after 60 days. ' +
            'You never have to remember anything.',
      links: ['platform-health', 'storage']
    },
    'cost': {
      title: 'What it costs to run',
      body: '<b>₦0 per month.</b> Supabase free tier for the database and auth, free static hosting, free GitHub ' +
            'Actions. Two rules protect that: media is always a <b>link</b> (Google Drive, YouTube, https) rather ' +
            'than an upload, which preserves the 500 MB quota; and messaging opens <b>your own</b> WhatsApp, email ' +
            'or SMS app instead of a paid gateway. There is deliberately no paid AI API anywhere in the product.',
      links: ['storage', 'license', 'platform-health']
    },
    'roles': {
      title: 'Roles and what each one sees',
      body: '<b>Owner / admin</b> — everything, including money, safeguarding and platform settings. ' +
            '<b>Tutor</b> — their teaching: sessions, attendance, marking, notes, learner analytics. ' +
            '<b>Parent</b> — only their own children: classes, scores, invoices, messages. ' +
            '<b>Learner</b> — only themselves: homework, reading, quizzes, results. ' +
            'A new sign-up is <b>pending</b> until an admin approves it, so nobody self-serves into family data.',
      links: ['approvals', 'status-manager', 'profile', 'settings']
    },
    'install': {
      title: 'Installing the studio as an app',
      body: 'The portal is a full PWA. On Android/desktop Chrome or Edge use the <b>Install</b> button in the header ' +
            'or the banner. On iPhone open it in Safari, tap <b>Share</b> then <b>Add to Home Screen</b>. Once ' +
            'installed you get class reminders and result alerts even with the tab closed, an offline shell, and ' +
            'instant launch from the home screen.',
      links: ['install', 'notifications', 'reminders']
    }
  };

  var Chatbot = {
    open: false,
    guide: function () { return (w.TC && w.TC.PAGE_GUIDE) || w.PAGE_GUIDE || {}; },

    tokenize: function (s) {
      var t = String(s || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);
      var out = t.slice();
      t.forEach(function (word) {
        (SYNONYMS[word] || []).forEach(function (syn) {
          syn.split(' ').forEach(function (p) { if (out.indexOf(p) === -1) out.push(p); });
        });
      });
      return out;
    },

    /* Score one guide entry against the query tokens. */
    score: function (entry, toks) {
      var hay = {
        title: (entry.title || '').toLowerCase(),
        page: (entry.page || '').toLowerCase(),
        group: (entry.group || '').toLowerCase(),
        purpose: (entry.purpose || '').toLowerCase(),
        detail: (entry.detail || '').toLowerCase(),
        extra: ((entry.actions || []).join(' ') + ' ' + (entry.tabs || []).join(' ') + ' ' +
                (entry.tasks || []).join(' ') + ' ' +
                (entry.sections || []).map(function (x) { return x.name; }).join(' ')).toLowerCase()
      };
      var s = 0;
      toks.forEach(function (t) {
        if (!t || t.length < 2) return;
        if (hay.page === t) s += 30;
        if (hay.title === t) s += 26;
        if (hay.page.indexOf(t) !== -1) s += 12;
        if (hay.title.indexOf(t) !== -1) s += 10;
        if (hay.group.indexOf(t) !== -1) s += 4;
        if (hay.purpose.indexOf(t) !== -1) s += 5;
        if (hay.extra.indexOf(t) !== -1) s += 3;
        if (hay.detail.indexOf(t) !== -1) s += 2;
      });
      return s;
    },

    /* Task index: "how do I mark attendance" -> attendance.html.
       Built once from every page's declared tasks. */
    taskIndex: function () {
      if (this._tasks) return this._tasks;
      var g = this.guide(), out = [];
      Object.keys(g).forEach(function (k) {
        (g[k].tasks || []).forEach(function (t) { out.push({ task: t, page: k }); });
      });
      this._tasks = out;
      return out;
    },

    matchTask: function (q) {
      var str = String(q || '').toLowerCase().replace(/[^a-z0-9\s']/g, ' ');
      var toks = str.split(/\s+/).filter(function (t) { return t.length > 2; });
      if (!toks.length) return null;
      var best = null, bestScore = 0;
      this.taskIndex().forEach(function (entry) {
        var t = entry.task.toLowerCase(), sc = 0;
        toks.forEach(function (tok) { if (t.indexOf(tok) !== -1) sc += tok.length; });
        if (sc > bestScore) { bestScore = sc; best = entry; }
      });
      return bestScore >= 6 ? best : null;
    },

    search: function (q, limit) {
      var toks = this.tokenize(q), g = this.guide(), self = this, out = [];
      Object.keys(g).forEach(function (k) {
        var sc = self.score(g[k], toks);
        if (sc > 0) out.push({ key: k, entry: g[k], score: sc });
      });
      out.sort(function (a, b) { return b.score - a.score; });
      return out.slice(0, limit || 5);
    },

    matchProcess: function (q) {
      var s = String(q || '').toLowerCase(), hits = [];
      if (/(cycle|4\s*x\s*7|how.*book|booking work|how many class|hours|rate|amount)/.test(s)) hits.push('booking-cycle');
      if (/(quiz|cbt|exam mode|graded|self test|review mode)/.test(s)) hits.push('quiz-modes');
      if (/(privacy|rls|sibling|leak|who can see|secure|security)/.test(s)) hits.push('privacy');
      if (/(deploy|host|vercel|netlify|supabase setup|install the site|go live|launch)/.test(s)) hits.push('deploy');
      if (/(keep.?alive|sleep|pause|inactiv|heartbeat)/.test(s)) hits.push('keepalive');
      if (/(cost|price|free|charge|monthly|subscription|₦|naira)/.test(s)) hits.push('cost');
      if (/(role|permission|who sees|access|admin|approve)/.test(s)) hits.push('roles');
      if (/(install|home screen|pwa|offline|app)/.test(s)) hits.push('install');
      return hits;
    },

    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    },

    /* Full, detailed answer card for one page. */
    pageCard: function (e) {
      var badge = { public: '🌍 Public', 'code-gated': '🔑 Quiz code', family: '👨‍👩‍👧 Family',
                    staff: '🎓 Staff', owner: '🛡️ Owner/admin' }[e.access] || e.access;
      var html = '<div class="tc-bot-card">' +
        '<div class="tc-bot-h">' + this.esc(e.title) +
        ' <span class="tc-bot-badge">' + badge + '</span></div>' +
        '<p>' + e.detail + '</p>' +
        '<p><b>Who it is for:</b> ' + this.esc(e.audience) + '</p>' +
        '<p><b>Why it matters:</b> ' + this.esc(e.why) + '</p>' +
        '<p><b>How to use it</b></p><ol>' + (e.how || []).map(function (h) { return '<li>' + h + '</li>'; }).join('') + '</ol>' +
        '<p><b>How it connects:</b> ' + e.connects + '</p>';

      if (e.sections && e.sections.length) {
        html += '<p><b>Sections on this page</b></p><ul>' +
          e.sections.map(function (sec) {
            return '<li><b>' + this.esc(sec.name) + '</b> \u2014 ' + this.esc(sec.what) + '</li>';
          }, this).join('') + '</ul>';
      }
      if (e.roleViews) {
        html += '<p><b>What each role sees here</b></p><ul>' +
          ['owner', 'tutor', 'parent', 'learner'].filter(function (r) { return e.roleViews[r]; })
            .map(function (r) {
              return '<li><b>' + r.charAt(0).toUpperCase() + r.slice(1) + ':</b> ' +
                     this.esc(e.roleViews[r]) + '</li>';
            }, this).join('') + '</ul>';
      }
      if (e.tasks && e.tasks.length) {
        html += '<p><b>Common tasks here:</b> ' +
          e.tasks.map(function (t) { return this.esc(t); }, this).join(' \u00b7 ') + '</p>';
      }
      if (e.faqs && e.faqs.length) {
        html += '<p><b>Questions people ask</b></p>' +
          e.faqs.map(function (f) {
            return '<p style="margin:.3em 0"><b>' + this.esc(f.q) + '</b><br>' + this.esc(f.a) + '</p>';
          }, this).join('');
      }
      if (e.related && e.related.length) {
        html += '<p><b>Related pages:</b> ' + e.related.map(function (r) {
          return '<a href="' + r + '.html">' + r.replace(/-/g, ' ') + '</a>';
        }).join(' · ') + '</p>';
      }
      html += '<p><a class="tc-bot-go" href="' + e.file + '">Open ' + this.esc(e.title) + ' →</a></p></div>';
      return html;
    },

    answer: function (q) {
      var query = String(q || '').trim();
      if (!query) return 'Ask me about any page or process — for example “where do I mark attendance”, “how do bookings work”, or “who can see my child’s scores”.';

      // 1. Explicit process questions get the authored explanation first.
      var procs = this.matchProcess(query);
      var out = '';
      if (procs.length) {
        var p = PROCESS_KB[procs[0]];
        out += '<div class="tc-bot-card"><div class="tc-bot-h">' + p.title + '</div><p>' + p.body + '</p>';
        if (p.links && p.links.length) {
          var g = this.guide();
          out += '<p><b>Go to:</b> ' + p.links.filter(function (l) { return g[l]; }).map(function (l) {
            return '<a href="' + l + '.html">' + (g[l].title || l) + '</a>';
          }).join(' · ') + '</p>';
        }
        out += '</div>';
      }

      // 2. Task routing — "how do I mark attendance" should TAKE you there.
      var task = this.matchTask(query);
      if (task) {
        var te = this.guide()[task.page];
        if (te) {
          out += '<div class="tc-bot-card"><div class="tc-bot-h">To ' + this.esc(task.task) + '</div>' +
            '<p>Go to <b>' + this.esc(te.title) + '</b>.</p><ol>' +
            (te.how || []).map(function (h) { return '<li>' + h + '</li>'; }).join('') + '</ol>' +
            '<p><a class="tc-bot-go" href="' + te.file + '">Open ' + this.esc(te.title) + ' \u2192</a></p></div>';
        }
      }

      // 3. Page matches.
      var hits = this.search(query, 4);
      if (hits.length) {
        out += this.pageCard(hits[0].entry);
        if (hits.length > 1) {
          out += '<div class="tc-bot-more"><b>Other pages that might be what you mean:</b><br>' +
            hits.slice(1).map(function (h) {
              return '<a href="' + h.entry.file + '">' + this.esc(h.entry.title) + '</a> — ' +
                     this.esc((h.entry.purpose || '').slice(0, 90)) + '…';
            }, this).join('<br>') + '</div>';
        }
      } else if (!out) {
        out = '<p>I could not find a page matching “' + this.esc(query) + '”.</p>' +
              '<p>Try a word that appears on the page you want — for example <i>attendance</i>, <i>invoice</i>, ' +
              '<i>scoresheet</i>, <i>booking</i>, <i>quiz</i>, <i>reading</i> or <i>safeguarding</i>. ' +
              'You can also open <a href="site-index.html">the full page index</a>.</p>';
      }
      return out;
    },

    /* ---------------- UI ---------------- */
    suggestions: function () {
      return ['What is this page?', 'How do bookings work?', 'How do quizzes work?',
              'Who can see my child\'s scores?', 'How do I install the app?',
              'Where do I mark attendance?', 'How do I back up to Google Drive?',
              'Why would the project pause?', 'How do I deploy?', 'What does it cost?'];
    },

    mount: function () {
      if (d.getElementById('tc-chatbot')) return;
      var wrap = d.createElement('div');
      wrap.id = 'tc-chatbot';
      wrap.innerHTML =
        '<button id="tc-bot-fab" aria-label="Open the Studio Assistant" title="Studio Assistant">💬</button>' +
        '<div id="tc-bot-panel" role="dialog" aria-label="Studio Assistant">' +
          '<div class="tc-bot-top"><div><b>Studio Assistant</b>' +
            '<div class="tc-bot-sub">Every page &amp; process · no AI API</div></div>' +
            '<div class="tc-bot-actions">' +
              '<button id="tc-bot-min" aria-label="Minimise" title="Minimise">–</button>' +
              '<button id="tc-bot-x" aria-label="Close assistant" title="Close">×</button>' +
            '</div></div>' +
          '<div id="tc-bot-log" aria-live="polite"></div>' +
          '<div id="tc-bot-chips"></div>' +
          '<form id="tc-bot-form"><input id="tc-bot-in" autocomplete="off" ' +
            'placeholder="Ask about any page or process…" aria-label="Ask a question">' +
            '<button type="submit">Send</button></form>' +
        '</div>';
      d.body.appendChild(wrap);
      this.injectCSS();

      var self = this;
      var panel = d.getElementById('tc-bot-panel');
      var fab = d.getElementById('tc-bot-fab');

      /* V13 BUG FIX. Visibility used to be driven by the `hidden` attribute,
         but the stylesheet sets `#tc-bot-panel{display:flex}` and an ID
         selector beats the UA rule `[hidden]{display:none}`. The panel was
         therefore ALWAYS on screen: the × appeared to do nothing, the launcher
         appeared to do nothing, it covered the page, and because the panel
         never registered as "opened" the greeting and the suggestion chips
         never rendered. One CSS specificity bug caused four reported faults.
         Visibility is now a class, which cannot be out-specified. */
      this.setOpen = function (v) {
        self.open = !!v;
        panel.classList.toggle('tc-open', self.open);
        panel.classList.remove('tc-min');
        fab.setAttribute('aria-expanded', String(self.open));
        fab.innerHTML = self.open ? '✕' : '💬';
        fab.setAttribute('title', self.open ? 'Close the Studio Assistant' : 'Open the Studio Assistant');
        if (self.open) {
          if (!d.getElementById('tc-bot-log').childNodes.length) self.greet();
          try { d.getElementById('tc-bot-in').focus(); } catch (e) {}
        }
      };

      fab.onclick = function () { self.setOpen(!self.open); };
      d.getElementById('tc-bot-x').onclick = function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        self.setOpen(false);
      };
      /* Minimise collapses to the title bar so the assistant can stay to hand
         without covering the work underneath. */
      d.getElementById('tc-bot-min').onclick = function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        panel.classList.toggle('tc-min');
        this.textContent = panel.classList.contains('tc-min') ? '▢' : '–';
        this.setAttribute('title', panel.classList.contains('tc-min') ? 'Restore' : 'Minimise');
      };
      /* Clicking the collapsed title bar restores it. */
      panel.querySelector('.tc-bot-top').addEventListener('click', function (e) {
        if (e.target.closest('button')) return;
        if (panel.classList.contains('tc-min')) {
          panel.classList.remove('tc-min');
          d.getElementById('tc-bot-min').textContent = '–';
        }
      });

      // Render the greeting + suggestion chips up front so a first-time user
      // always sees what they can ask, even before opening the panel.
      this.greet();
      d.getElementById('tc-bot-form').onsubmit = function (e) {
        e.preventDefault();
        var i = d.getElementById('tc-bot-in');
        var v = i.value.trim();
        if (!v) return;
        self.say(v, 'me');
        i.value = '';
        setTimeout(function () { self.say(self.answer(v), 'bot'); }, 90);
      };
      d.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && self.open) self.setOpen(false);
      });
    },

    greet: function () {
      var cur = this.guide()[this.currentPage()];
      var msg = '<p>Hello 👋 I am the Studio Assistant. I can explain <b>every page, section and process</b> ' +
                'in this platform, and take you straight there.</p>';
      if (cur) {
        msg += '<p>You are currently on <b>' + this.esc(cur.title) + '</b>. ' +
               this.esc((cur.purpose || '').slice(0, 170)) + '</p>' +
               '<p>Ask “what is this page?” for the full explanation.</p>';
      }
      this.say(msg, 'bot');
      this.chips();
    },

    currentPage: function () {
      return (location.pathname.split('/').pop() || 'index.html').replace(/\.html?$/i, '').split('?')[0];
    },

    chips: function () {
      var box = d.getElementById('tc-bot-chips'); if (!box) return;
      var self = this;
      box.innerHTML = '';
      this.suggestions().forEach(function (s) {
        var b = d.createElement('button');
        b.type = 'button'; b.className = 'tc-bot-chip'; b.textContent = s;
        b.onclick = function () {
          self.say(s, 'me');
          setTimeout(function () {
            self.say(s === 'What is this page?' ? self.thisPage() : self.answer(s), 'bot');
          }, 90);
        };
        box.appendChild(b);
      });
    },

    thisPage: function () {
      var e = this.guide()[this.currentPage()];
      return e ? this.pageCard(e) : this.answer(this.currentPage());
    },

    say: function (html, who) {
      var log = d.getElementById('tc-bot-log'); if (!log) return;
      var row = d.createElement('div');
      row.className = 'tc-bot-msg tc-bot-' + (who || 'bot');
      row.innerHTML = who === 'me' ? this.esc(html) : html;
      log.appendChild(row);
      log.scrollTop = log.scrollHeight;
    },

    injectCSS: function () {
      if (d.getElementById('tc-bot-css')) return;
      var s = d.createElement('style');
      s.id = 'tc-bot-css';
      s.textContent =
        '#tc-bot-fab{position:fixed;right:18px;bottom:18px;z-index:9997;width:56px;height:56px;border-radius:50%;' +
        'border:none;cursor:pointer;font-size:1.5rem;color:#fff;background:var(--gradient,linear-gradient(135deg,#4f46e5,#06b6d4));' +
        'box-shadow:0 10px 26px rgba(0,0,0,.28)}' +
        '#tc-bot-fab:hover{transform:translateY(-2px)}' +
        '#tc-bot-panel{position:fixed;right:18px;bottom:84px;z-index:9997;width:min(430px,calc(100vw - 28px));' +
        'max-height:min(640px,calc(100vh - 120px));display:none;flex-direction:column;background:var(--surface,#fff);' +
        'border:1px solid var(--gray-300,#e2e8f0);border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.3);overflow:hidden}' +
        '#tc-bot-panel.tc-open{display:flex}' +
        '#tc-bot-panel.tc-min{max-height:56px}' +
        '#tc-bot-panel.tc-min #tc-bot-log,#tc-bot-panel.tc-min #tc-bot-chips,' +
        '#tc-bot-panel.tc-min #tc-bot-form{display:none}' +
        '#tc-bot-panel.tc-min .tc-bot-top{cursor:pointer}' +
        '.tc-bot-actions{display:flex;gap:4px;align-items:center}' +
        '#tc-bot-min{background:none;border:none;color:#fff;font-size:1.25rem;line-height:1;cursor:pointer;padding:0 6px}' +
        '.tc-bot-top{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;' +
        'background:var(--gradient,linear-gradient(135deg,#4f46e5,#06b6d4));color:#fff}' +
        '.tc-bot-sub{font-size:.74rem;opacity:.9}' +
        '#tc-bot-x{background:none;border:none;color:#fff;font-size:1.3rem;cursor:pointer}' +
        '#tc-bot-log{flex:1;overflow:auto;padding:12px;font-size:.88rem;line-height:1.55;color:var(--ink,#0f172a)}' +
        '.tc-bot-msg{margin-bottom:10px}' +
        '.tc-bot-me{text-align:right;font-weight:600;color:var(--primary,#4f46e5)}' +
        '.tc-bot-card{background:var(--surface-soft,#f8fafc);border:1px solid var(--gray-300,#e2e8f0);' +
        'border-radius:12px;padding:10px 12px}' +
        '.tc-bot-card p{margin:.45em 0}.tc-bot-card ol{margin:.4em 0 .4em 1.1em;padding:0}' +
        '.tc-bot-card li{margin:.22em 0}' +
        '.tc-bot-h{font-weight:800;margin-bottom:4px;color:var(--primary-dark,#3730a3)}' +
        '.tc-bot-badge{font-size:.68rem;font-weight:700;padding:2px 7px;border-radius:99px;' +
        'background:var(--primary,#4f46e5);color:#fff;margin-left:6px;white-space:nowrap}' +
        '.tc-bot-go{display:inline-block;margin-top:4px;font-weight:700;color:var(--primary,#4f46e5)}' +
        '.tc-bot-more{margin-top:8px;font-size:.82rem;color:var(--gray-600,#64748b)}' +
        '#tc-bot-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 8px}' +
        '.tc-bot-chip{font-size:.76rem;padding:5px 10px;border-radius:99px;cursor:pointer;' +
        'border:1px solid var(--gray-300,#e2e8f0);background:var(--surface,#fff);color:var(--ink,#0f172a)}' +
        '.tc-bot-chip:hover{border-color:var(--primary,#4f46e5);color:var(--primary,#4f46e5)}' +
        '#tc-bot-form{display:flex;gap:6px;padding:10px 12px;border-top:1px solid var(--gray-300,#e2e8f0)}' +
        '#tc-bot-in{flex:1;padding:9px 11px;border:1px solid var(--gray-300,#e2e8f0);border-radius:10px;font:inherit}' +
        '#tc-bot-form button{padding:9px 15px;border:none;border-radius:10px;cursor:pointer;font-weight:700;' +
        'background:var(--primary,#4f46e5);color:#fff}' +
        '@media print{#tc-chatbot{display:none}}';
      d.head.appendChild(s);
    },

    init: function () { try { this.mount(); } catch (e) { console.warn('[Chatbot]', e); } }
  };

  w.Chatbot = Chatbot;
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { Chatbot.init(); });
  else Chatbot.init();
})(window, document);
