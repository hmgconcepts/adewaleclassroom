/* ═══════════════════════════════════════════════════════════════════════
   ADEWALE CLASSROOM — Homework, learner view (V46 / round 10, item 3)
   The Homework page is role-aware: staff keep the marking workbench; a
   learner or parent gets THIS page — one place where homework and every
   CBT set for the class live together, arranged the way a student needs
   to see them, not the way a database stores them.

   Arrangement (the expert-tutor decision):
     1. DUE NEXT — everything with a date, soonest first. CBT papers set
        for the class are homework too, so they appear HERE in the same
        list (a graded mock due tomorrow must never hide under a menu).
        CBT rows carry a CBT chip + a direct Start link.
     2. 🧪 CBT PAPERS BY NATURE — the same papers arranged by what they
        ARE: Live now (window open), Upcoming, Closed, and Practice
        (never graded). This answers "where do the different kinds of
        CBT appear and how are they arranged" in one glance.
     3. DONE & MARKED — work that came back, with scores.
   Data: tc_my_work(p_learner_id?) — security-definer RPC (parents are
   verified database-side; attempts matched by learner id or student no).
   ═══════════════════════════════════════════════════════════════════════ */
window.HomeworkStudent = (function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function dueLabel(d) {
    if (!d) return '';
    var dt = new Date(String(d).slice(0, 10) + 'T00:00:00');
    if (isNaN(dt)) return '';
    var days = Math.round((dt - new Date(new Date().toDateString())) / 86400000);
    if (days < -1) return Math.abs(days) + ' days overdue';
    if (days === -1) return 'yesterday';
    if (days === 0) return 'today';
    if (days === 1) return 'tomorrow';
    if (days <= 7) return 'in ' + days + ' days';
    return dt.toLocaleDateString([], { day: 'numeric', month: 'short' });
  }

  function card(icon, title, sub, chips, action) {
    return '<div style="display:flex;gap:10px;align-items:center;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin-bottom:8px;background:#fff;flex-wrap:wrap">' +
      '<div style="flex:1;min-width:200px"><b>' + icon + ' ' + esc(title) + '</b>' +
      (sub ? '<div class="muted" style="font-size:.82rem">' + sub + '</div>' : '') + '</div>' +
      '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' + (chips || '') + '</div>' +
      (action || '') + '</div>';
  }

  function examState(x, now) {
    var opens = x.opens ? new Date(x.opens) : null;
    var closes = x.closes ? new Date(x.closes) : null;
    if (closes && closes <= now) return 'closed';
    if (opens && opens > now) return 'upcoming';
    return 'live';
  }

  function examCard(x, now) {
    var state = examState(x, now);
    var graded = String(x.kind || 'graded') === 'graded';
    var sub = esc(x.subject || (x.multi ? 'multi-subject' : 'quiz')) + ' · ' + (x.minutes || 40) + ' min' +
      (x.multi ? ' · 🎯 UTME-style multi-subject' : '') +
      (graded && Number(x.negative_mark) > 0 ? ' · ⚠️ negative marking' : '');
    /* V52 (round 16, item 1): an international student must never have to
       do timezone arithmetic to know when a paper opens or closes — the
       studio's home time and the student's own time show side by side. */
    var dual = '';
    if (state === 'upcoming' && x.opens) dual = (window.TZ && TZ.dualHtml) ? TZ.dualHtml(x.opens, 'opens', null) : '';
    else if (state === 'live' && x.closes) dual = (window.TZ && TZ.dualHtml) ? TZ.dualHtml(x.closes, 'closes_at', null) : '';
    if (dual) sub += dual;
    var chips = '';
    if (state === 'live') chips = '<span class="badge" style="background:#dcfce7;color:#166534">🟢 Live now</span>';
    if (state === 'upcoming') {
      var h = Math.ceil((new Date(x.opens) - now) / 3600000);
      chips = '<span class="badge" style="background:#dbeafe;color:#1e40af">opens ' + (h > 48 ? new Date(x.opens).toLocaleDateString([], { day: 'numeric', month: 'short' }) : 'in ' + h + 'h') + '</span>';
    }
    if (state === 'closed') chips = '<span class="badge" style="background:#f1f5f9;color:#64748b">closed</span>';
    if (!graded) chips += ' <span class="badge" style="background:#fef3c7;color:#92400e">' + (String(x.kind) === 'review' ? 'review' : 'practice') + '</span>';
    var action = state === 'closed'
      ? '<a class="btn btn-outline btn-sm" href="cbt-exam.html?code=' + encodeURIComponent(x.code || '') + '">Review ➜</a>'
      : '<a class="btn btn-primary btn-sm" href="cbt-exam.html?code=' + encodeURIComponent(x.code || '') + '">' + (state === 'upcoming' ? 'Open ➜' : 'Start ➜') + '</a>';
    return card(state === 'live' && graded ? '📝' : '🧪', x.title, sub, chips, action);
  }

  async function rpc(fn, args) {
    if (!window.sb || !window.sb.rpc) throw new Error('Sign in to see your homework.');
    var r = await window.sb.rpc(fn, args || {});
    if (r.error) throw new Error(r.error.message);
    return r.data;
  }

  async function render(rootId) {
    var root = document.getElementById(rootId || 'homework-student-root');
    if (!root) return;
    var params = new URLSearchParams(location.search);
    var learnerId = params.get('learner') || '';

    var data;
    try {
      data = await rpc('tc_my_work', learnerId ? { p_learner_id: learnerId } : {});
    } catch (e) {
      root.innerHTML = '<div class="card" style="background:#fef2f2;border-color:#fca5a5;color:#991b1b">' + esc(e.message || e) + '</div>';
      return;
    }
    if (!data || data.ok === false) {
      root.innerHTML = '<div class="card"><h3 style="margin-top:0">No homework yet</h3><p class="muted">' +
        (data && data.reason === 'not_your_child'
          ? 'You can only view homework for learners linked to your account.'
          : 'No learner record is linked to this account yet — ask the studio admin to link it on the Learners page, then reload.') +
        '</p></div>';
      return;
    }

    var now = new Date();
    /* V52: prime the timezone engine before cards render, so the dual-time
       lines on CBT papers are on the first paint. */
    if (window.TZ && TZ.init) { try { await TZ.init(); } catch (eTz) {} }
    var hw = (data.homework || []);
    var exams = (data.exams || []);
    var todo = hw.filter(function (x) { return String(x.status || 'set') !== 'marked' && x.score == null; });
    var done = hw.filter(function (x) { return String(x.status || '') === 'marked' || x.score != null; });

    /* CBT papers set for the class, by nature */
    var live = exams.filter(function (x) { return examState(x, now) === 'live' && String(x.kind || 'graded') === 'graded'; });
    var upcoming = exams.filter(function (x) { return examState(x, now) === 'upcoming'; });
    var closed = exams.filter(function (x) { return examState(x, now) === 'closed'; });
    var practice = exams.filter(function (x) { return String(x.kind || 'graded') !== 'graded'; });

    /* DUE NEXT: everything with a date, soonest first — homework and CBT
       papers in ONE list, because to a student they are all "work due". */
    var dueNext = todo.slice().sort(function (a, b) {
      var da = a.due ? new Date(a.due).getTime() : 8640000000000000;
      var db = b.due ? new Date(b.due).getTime() : 8640000000000000;
      return da - db;
    }).map(function (x) {
      if (String(x.kind || 'homework') === 'cbt') {
        return card('🧪', x.title,
          esc(x.engagement || '') + (x.due ? ' · due ' + esc(dueLabel(x.due)) : '') + ' · computer-based test',
          '<span class="badge" style="background:#e0e7ff;color:#3730a3">CBT</span>',
          '<a class="btn btn-primary btn-sm" href="cbt-exam.html?code=' + encodeURIComponent(x.code || '') + '">Start ➜</a>');
      }
      return card('📝', x.title,
        esc(x.engagement || '') + (x.due ? ' · due ' + esc(dueLabel(x.due)) : '') + (x.group ? ' · whole class' : ' · set for you'),
        x.due && new Date(String(x.due).slice(0, 10)) < new Date(new Date().toDateString())
          ? '<span class="badge" style="background:#fee2e2;color:#991b1b">overdue</span>' : '',
        '');
    }).join('');

    root.innerHTML =
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">' +
      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px 14px"><div style="font-size:.7rem;text-transform:uppercase;font-weight:800;color:#64748b">To do</div><div style="font-size:1.4rem;font-weight:900">' + todo.length + '</div></div>' +
      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px 14px"><div style="font-size:.7rem;text-transform:uppercase;font-weight:800;color:#64748b">CBT live now</div><div style="font-size:1.4rem;font-weight:900;color:#166534">' + live.length + '</div></div>' +
      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px 14px"><div style="font-size:.7rem;text-transform:uppercase;font-weight:800;color:#64748b">Upcoming</div><div style="font-size:1.4rem;font-weight:900">' + upcoming.length + '</div></div>' +
      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px 14px"><div style="font-size:.7rem;text-transform:uppercase;font-weight:800;color:#64748b">Marked</div><div style="font-size:1.4rem;font-weight:900">' + done.length + '</div></div>' +
      (learnerId ? '<div style="margin-left:auto;align-self:center" class="muted">Homework for <b>' + esc((data.learner && data.learner.name) || 'this learner') + '</b> · <a href="my-children.html">← switch child</a></div>' : '') +
      '</div>' +

      '<section class="card" style="margin-bottom:14px"><h3 style="margin-top:0">📅 Due next — homework and CBT papers together</h3>' +
      (dueNext || '<p class="muted">Nothing due right now. New homework, reading and CBT papers appear here the moment your tutor sets them. 🎉</p>') +
      '</section>' +

      '<section class="card" style="margin-bottom:14px"><h3 style="margin-top:0">🧪 CBT papers — by nature</h3>' +
      (exams.length ? (
        (live.length ? '<div style="font-weight:700;margin:8px 0 6px">🟢 Live now</div>' + live.map(function (x) { return examCard(x, now); }).join('') : '') +
        (upcoming.length ? '<div style="font-weight:700;margin:12px 0 6px">🕓 Upcoming</div>' + upcoming.map(function (x) { return examCard(x, now); }).join('') : '') +
        (practice.length ? '<div style="font-weight:700;margin:12px 0 6px">🧪 Practice — never graded, sit as often as you like</div>' + practice.map(function (x) { return examCard(x, now); }).join('') : '') +
        (closed.length ? '<details style="margin-top:10px"><summary style="cursor:pointer;font-weight:700">🔒 Closed papers (' + closed.length + ')</summary>' + closed.map(function (x) { return examCard(x, now); }).join('') + '</details>' : '')
      ) : '<p class="muted">No CBT papers are set for your classes right now.</p>') +
      '</section>' +

      '<section class="card"><h3 style="margin-top:0">✅ Done &amp; marked</h3>' +
      (done.length ? done.map(function (x) {
        return card('✅', x.title,
          esc(x.engagement || '') + (x.due ? ' · was due ' + esc(String(x.due).slice(0, 10)) : ''),
          x.score != null ? '<span class="badge" style="background:#dcfce7;color:#166534">' + esc(x.score) + (x.max ? '/' + esc(x.max) : '') + '</span>' : '',
          '<a class="btn btn-outline btn-sm" href="scoresheet.html">Scoresheet</a>');
      }).join('') : '<p class="muted">Marked work lands here with its score.</p>') +
      '</section>' +

      '<p class="muted" style="font-size:.8rem;margin-top:12px">Every CBT here also appears on <a href="my-quizzes.html' + (learnerId ? '?learner=' + encodeURIComponent(learnerId) : '') + '">My quizzes</a> with your attempts and best scores, and graded scores file to your <a href="scoresheet.html">scoresheet</a> automatically.</p>';
  }

  return { render: render };
})();
