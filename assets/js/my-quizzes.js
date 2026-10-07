/* ═══════════════════════════════════════════════════════════════════════
   ADEWALE CLASSROOM — My quizzes engine (V45 / round 9, item 5)
   The dedicated learner/parent page for every CBT set for a class,
   organised BY NATURE:
     • Graded (incl. UTME-style multi-subject sittings) — windows, attempts,
       best / last score, negative-marking warnings, direct Start links.
     • Practice & review — sit as often as you like, never graded.
   Data: tc_my_quizzes(p_learner?) — the security-definer RPC that walks
   the learner's engagements and files attempts by learner id OR student
   number. Parents pass ?learner=<id> (verified by the database, not here).
   ═══════════════════════════════════════════════════════════════════════ */
window.MyQuizzes = (function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtWhen(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' ' +
           d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function windowBadge(x, now) {
    if (!x.opens && !x.closes) return '';
    if (x.opens && new Date(x.opens) > now) {
      var h = Math.ceil((new Date(x.opens) - now) / 3600000);
      return '<span class="badge" style="background:#dbeafe;color:#1e40af">opens ' + (h > 48 ? fmtWhen(x.opens) : 'in ' + h + 'h') + '</span>';
    }
    if (x.closes && new Date(x.closes) > now) {
      var h2 = Math.ceil((new Date(x.closes) - now) / 3600000);
      return '<span class="badge" style="background:#fef3c7;color:#92400e">closes ' + (h2 > 48 ? fmtWhen(x.closes) : 'in ' + h2 + 'h') + '</span>';
    }
    if (x.closes) return '<span class="badge" style="background:#f1f5f9;color:#64748b">closed</span>';
    return '';
  }

  function card(x, graded, now) {
    var subs = Array.isArray(x.subjects) && x.subjects.length
      ? x.subjects.join(' · ')
      : (x.subject || (x.multi ? 'multi-subject' : 'quiz'));
    var attempts = Number(x.attempts) || 0;
    var right = '';
    if (graded) {
      if (attempts > 0) {
        right = '<div style="text-align:right;font-size:.82rem;line-height:1.5">' +
          '<span class="badge" style="background:#dcfce7;color:#166534">best ' + esc(x.best == null ? '—' : Math.round(x.best) + '%') + '</span> ' +
          '<span class="badge" style="background:#e0e7ff;color:#3730a3">last ' + esc(x.last_score == null ? '—' : Math.round(x.last_score) + '%') + '</span>' +
          '<br><span class="muted">' + attempts + ' attempt' + (attempts === 1 ? '' : 's') + '</span></div>';
      } else {
        right = '<span class="badge" style="background:#fef3c7;color:#92400e">not attempted</span>';
      }
    } else if (attempts > 0) {
      right = '<span class="badge" style="background:#f1f5f9;color:#64748b">' + attempts + ' practice run' + (attempts === 1 ? '' : 's') + '</span>';
    }
    var neg = (graded && Number(x.negative_mark) > 0)
      ? ' <span class="badge" style="background:#fee2e2;color:#991b1b" title="Each wrong answer deducts ' + esc(x.negative_mark) + ' mark(s)">⚠️ negative marking</span>'
      : '';
    var closed = x.closes && new Date(x.closes) <= now;
    var action = closed
      ? '<span class="badge">closed</span>'
      : '<a class="btn btn-primary btn-sm" href="cbt-exam.html?code=' + encodeURIComponent(x.code || '') + '">' + (attempts > 0 && graded ? 'Retake ➜' : 'Start ➜') + '</a>';
    return '<div style="display:flex;gap:10px;align-items:center;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin-bottom:8px;background:#fff;flex-wrap:wrap">' +
      '<div style="flex:1;min-width:200px"><b>' + (x.multi ? '🎯 ' : (graded ? '📝 ' : '🧪 ')) + esc(x.title) + '</b>' +
      '<div class="muted" style="font-size:.82rem">' + esc(subs) + ' · ' + esc(x.engagement || 'class') + ' · ' + (x.minutes || 40) + ' min' +
      (x.multi ? ' · UTME-style multi-subject' : '') + '</div></div>' +
      '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' + windowBadge(x, now) + neg + '</div>' +
      right + action + '</div>';
  }

  async function rpc(fn, args) {
    if (!window.sb || !window.sb.rpc) throw new Error('Sign in to see your papers.');
    var r = await window.sb.rpc(fn, args || {});
    if (r.error) throw new Error(r.error.message);
    return r.data;
  }

  async function render(rootId) {
    var root = document.getElementById(rootId || 'myquizzes-root');
    if (!root) return;
    var params = new URLSearchParams(location.search);
    var learnerId = params.get('learner') || '';
    var data;
    try {
      data = await rpc('tc_my_quizzes', learnerId ? { p_learner_id: learnerId } : {});
    } catch (e) {
      root.innerHTML = '<div class="card" style="background:#fef2f2;border-color:#fca5a5;color:#991b1b">' + esc(e.message || e) + '</div>';
      return;
    }
    if (!data || data.ok === false) {
      root.innerHTML = '<div class="card"><h3 style="margin-top:0">No papers yet</h3><p class="muted">' +
        (data && data.reason === 'not_your_child'
          ? 'You can only view quizzes for learners linked to your account.'
          : 'No learner record is linked to this account yet — ask the studio admin to link it on the Learners page, then reload.') +
        '</p></div>';
      return;
    }
    var now = new Date();
    var graded = (data.graded || []);
    var practice = (data.practice || []);
    var open = graded.filter(function (x) { return !(x.closes && new Date(x.closes) <= now); });
    var done = graded.length - open.length;

    root.innerHTML =
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">' +
      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px 14px"><div style="font-size:.7rem;text-transform:uppercase;font-weight:800;color:#64748b">Graded papers</div><div style="font-size:1.4rem;font-weight:900">' + graded.length + '</div></div>' +
      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px 14px"><div style="font-size:.7rem;text-transform:uppercase;font-weight:800;color:#64748b">Open now</div><div style="font-size:1.4rem;font-weight:900">' + open.length + '</div></div>' +
      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px 14px"><div style="font-size:.7rem;text-transform:uppercase;font-weight:800;color:#64748b">Practice papers</div><div style="font-size:1.4rem;font-weight:900">' + practice.length + '</div></div>' +
      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px 14px"><div style="font-size:.7rem;text-transform:uppercase;font-weight:800;color:#64748b">Attempted</div><div style="font-size:1.4rem;font-weight:900">' + graded.filter(function (x) { return Number(x.attempts) > 0; }).length + '</div></div>' +
      (learnerId ? '<div style="margin-left:auto;align-self:center" class="muted">Papers for <b>' + esc((data.learner && data.learner.name) || 'this learner') + '</b> · <a href="my-children.html">← switch child</a></div>' : '') +
      '</div>' +

      '<section class="card" style="margin-bottom:14px"><h3 style="margin-top:0">📝 Graded papers — these count</h3>' +
      (graded.length
        ? graded.map(function (x) { return card(x, true, now); }).join('')
        : '<p class="muted">No graded papers are open for your classes right now. When your tutor publishes one, it appears here AND on your work board automatically.</p>') +
      '</section>' +

      '<section class="card"><h3 style="margin-top:0">🧪 Practice &amp; review — never graded</h3>' +
      (practice.length
        ? practice.map(function (x) { return card(x, false, now); }).join('')
        : '<p class="muted">No practice papers yet. Practice quizzes can be sat as often as you like — your scoresheet is never touched.</p>') +
      '</section>' +

      '<p class="muted" style="font-size:.8rem;margin-top:12px">Scores from graded papers are filed to your <a href="scoresheet.html">scoresheet</a> automatically — including one row per subject on multi-subject papers — and collated into your <a href="progress-reports.html">report card</a>.</p>';
  }

  return { render: render };
})();
