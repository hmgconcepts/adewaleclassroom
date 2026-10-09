/* ═══════════════════════════════════════════════════════════════════════
   ADEWALE CLASSROOM — Digital-library quiz engine + points workbench
   (V51 / round 15, item 8 — GOSA deep-study implementation)
   ═══════════════════════════════════════════════════════════════════════
   GOSA's digital library, studied in full, does four things this engine
   now does for ADEWALE CLASSROOM — with the Tutoring Connect data model
   (engagements instead of class arms, scoresheet instead of report
   columns, links only, free tier protected):

   1. AUTHOR — a teacher sets a reading: title / author / subject /
      class / read link / instructions / due date / max score / attempt
      limit, plus comprehension questions in FIVE types:
      mcq · multiple response · true/false · short answer · keyword.
   2. TAKE — a student reads the linked material and takes the quiz
      in-page (attempt-limited; answers never leave the learner's own
      record). Auto-marked instantly, GOSA-tolerant: an answer set as a
      LETTER (C) or POSITION (3) marks correctly instead of failing.
   3. ACCUMULATE — every attempt is recorded (library_quiz_attempts);
      the points workbench aggregates the BEST attempt per learner per
      reading, per class + subject.
   4. PUSH — the workbench writes each learner's cumulative points into
      the studio scoresheet (source 'library_points') so continuous-
      assessment evidence flows to the same place graded CBT marks do,
      and exports the table as CSV for any report card.
   ═══════════════════════════════════════════════════════════════════════ */
window.LibraryQuiz = (function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

  /* ── marking (GOSA V8.6 root-cause logic, kept verbatim in spirit) ── */
  function answerMatches(picked, q) {
    var ans = norm(q.answer);
    if (!ans) return false;
    if (norm(picked) === ans) return true;
    var opts = (q.options || []).filter(Boolean);
    var idx = -1;
    if (/^[a-j]$/.test(ans)) idx = ans.charCodeAt(0) - 97;                        // 'c' → 2
    else if (/^(10|[1-9])$/.test(ans) && !opts.some(function (o) { return norm(o) === ans; }))
      idx = parseInt(ans, 10) - 1;                                                // '3' → 2
    return idx >= 0 && idx < opts.length && norm(opts[idx]) === norm(picked);
  }
  function mark(qs, getVal) {
    var correct = 0;
    qs.forEach(function (q, j) {
      var t = q.type || 'mcq';
      var v = getVal(t, j);
      if (t === 'mcq') { if (v && answerMatches(v, q)) correct++; }
      else if (t === 'tf') { if (v && norm(v) === norm(q.answer)) correct++; }
      else if (t === 'multi') {
        var picked = (v || []).map(norm).sort();
        var want = (q.answers || []).map(norm).sort();
        if (picked.length && picked.length === want.length && picked.every(function (x, k) { return x === want[k]; })) correct++;
      }
      else if (t === 'short') { if (v && norm(v) === norm(q.answer)) correct++; }
      else if (t === 'keyword') {
        var txt = norm(v);
        var kws = String(q.keywords || '').split(',').map(norm).filter(Boolean);
        if (txt && kws.some(function (k) { return txt.indexOf(k) > -1; })) correct++;
      }
    });
    return correct;
  }
  function parseQs(raw) {
    var qs = raw;
    if (typeof qs === 'string') { try { qs = JSON.parse(qs); } catch (e) { qs = []; } }
    if (!Array.isArray(qs)) qs = [];
    return qs.filter(function (q) { return q && String(q.q || '').trim(); });
  }

  /* ── student: take the quiz ─────────────────────────────────────── */
  async function take(item) {
    var qs = parseQs(item.questions);
    if (!qs.length) { if (window.toast) toast('This reading has no questions yet.', 'warning'); return; }

    var allowed = Number(item.attempts_allowed == null ? 1 : item.attempts_allowed);
    if (allowed > 0 && window.sb) {
      var prev = await window.sb.from('library_quiz_attempts').select('id').eq('item_id', item.id).limit(200);
      var used = (prev.data || []).length;
      if (used >= allowed) {
        if (window.toast) toast('You have used your ' + allowed + ' attempt' + (allowed > 1 ? 's' : '') + ' on this quiz. Your best effort is already recorded — ask your teacher if you need another try.', 'warning', 9000);
        return;
      }
      if (used > 0 && window.toast) toast('Attempt ' + (used + 1) + ' of ' + allowed + '.', 'info', 5000);
    }

    var html = qs.map(function (q, j) {
      var t = q.type || 'mcq', inner = '';
      if (t === 'mcq') inner = (q.options || []).filter(Boolean).map(function (o) {
        return '<label style="display:block;margin:3px 0"><input type="radio" name="lq' + j + '" value="' + esc(o) + '"> ' + esc(o) + '</label>';
      }).join('');
      else if (t === 'multi') inner = (q.options || []).filter(Boolean).map(function (o) {
        return '<label style="display:block;margin:3px 0"><input type="checkbox" name="lq' + j + '" value="' + esc(o) + '"> ' + esc(o) + '</label>';
      }).join('') + '<small class="muted">Tick ALL the correct options.</small>';
      else if (t === 'tf') inner = '<label style="display:block"><input type="radio" name="lq' + j + '" value="True"> True</label><label style="display:block"><input type="radio" name="lq' + j + '" value="False"> False</label>';
      else inner = '<input class="form-input" name="lq' + j + '" placeholder="' + (t === 'keyword' ? 'Answer in your own words…' : 'Type the answer…') + '">';
      return '<div class="form-group" style="margin:10px 0"><label style="font-weight:700">Q' + (j + 1) + '. ' + esc(q.q) + '</label>' + inner + '</div>';
    }).join('');

    openModal('📝 Quiz: ' + item.title,
      '<div style="max-height:60vh;overflow:auto">' + html + '</div>' +
      '<p class="muted" style="font-size:.8rem;margin:8px 0 0">' + qs.length + ' question(s) · marked instantly · your best attempt counts.</p>',
      '<button class="btn btn-outline" type="button" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-primary" type="button" id="lq-submit">Submit</button>');
    var sb = document.getElementById('lq-submit');
    if (sb) sb.onclick = function () { submit(item, qs); };
  }

  async function submit(item, qs) {
    var correct = mark(qs, function (t, j) {
      if (t === 'multi') {
        return [].slice.call(document.querySelectorAll('input[name="lq' + j + '"]:checked')).map(function (x) { return x.value; });
      }
      var el = document.querySelector('input[name="lq' + j + '"]:checked') || document.querySelector('input[name="lq' + j + '"]');
      return el ? el.value : '';
    });
    var max = Number(item.max_score || qs.length) || qs.length;
    var score = Math.round((correct / qs.length) * max * 10) / 10;

    if (window.sb) {
      /* answers keyed by question index — stored for the teacher's review */
      var answers = {};
      qs.forEach(function (q, j) {
        var el = document.querySelector('input[name="lq' + j + '"]:checked') || document.querySelector('input[name="lq' + j + '"]');
        answers[j] = el ? el.value : '';
      });
      var r = await window.sb.from('library_quiz_attempts')
        .insert({ item_id: item.id, score: score, max_score: max, answers: answers });
      if (r.error) { if (window.toast) toast('Could not record the attempt: ' + r.error.message, 'danger', 8000); return; }
    }
    closeModal();
    if (window.toast) toast('You scored ' + score + ' / ' + max + ' — recorded ✓', 'success', 7000);
    if (window.ShelfStudent) ShelfStudent.render('shelf-student-root', 'library');
  }

  /* ── staff: the question builder ────────────────────────────────── */
  var B = { qs: [], editing: null };
  function builderAdd(type) {
    type = type || 'mcq';
    var base = { type: type, q: '' };
    if (type === 'mcq') Object.assign(base, { options: ['', '', '', ''], answer: '' });
    else if (type === 'multi') Object.assign(base, { options: ['', '', '', ''], answers: [] });
    else if (type === 'tf') Object.assign(base, { answer: 'True' });
    else if (type === 'short') Object.assign(base, { answer: '' });
    else if (type === 'keyword') Object.assign(base, { keywords: '' });
    B.qs.push(base);
    builderRender();
  }
  function builderRender() {
    var box = document.getElementById('lq-builder');
    if (!box) return;
    var names = { mcq: 'Multiple choice', multi: 'Multiple response', tf: 'True / False', short: 'Short answer', keyword: 'Keyword' };
    box.innerHTML = B.qs.map(function (q, i) {
      var t = q.type || 'mcq';
      var head = '<div style="border:1px solid #e2e8f0;border-radius:12px;padding:10px;margin:8px 0;background:#f8fafc">' +
        '<div style="display:flex;justify-content:space-between;align-items:center"><b>Q' + (i + 1) + ' · ' + names[t] + '</b>' +
        '<button type="button" class="btn btn-sm btn-outline" data-delq="' + i + '">Remove</button></div>' +
        '<div class="form-group" style="margin:8px 0 0"><label>Question</label><input class="form-input" value="' + esc(q.q) + '" data-qf="' + i + '.q"></div>';
      var body = '';
      if (t === 'mcq') body = '<div class="grid grid-2">' + q.options.map(function (o, j) {
        return '<input class="form-input" placeholder="Option ' + (j + 1) + '" value="' + esc(o) + '" data-qf="' + i + '.options.' + j + '">';
      }).join('') + '</div><div class="form-group"><label>Correct answer — the exact option text, its LETTER (A–D) or its NUMBER (1–4)</label><input class="form-input" value="' + esc(q.answer || '') + '" data-qf="' + i + '.answer"></div>';
      else if (t === 'multi') body = '<div class="grid grid-2">' + q.options.map(function (o, j) {
        return '<input class="form-input" placeholder="Option ' + (j + 1) + '" value="' + esc(o) + '" data-qf="' + i + '.options.' + j + '">';
      }).join('') + '</div><div class="form-group"><label>Correct answers (exact option texts, one per line — ALL must be ticked)</label><textarea class="form-input" rows="2" data-qf="' + i + '.answers">' + esc((q.answers || []).join('\n')) + '</textarea></div>';
      else if (t === 'tf') body = '<div class="form-group"><label>Correct answer</label><select class="form-select" data-qf="' + i + '.answer"><option' + (q.answer === 'True' ? ' selected' : '') + '>True</option><option' + (q.answer === 'False' ? ' selected' : '') + '>False</option></select></div>';
      else if (t === 'short') body = '<div class="form-group"><label>Correct answer (case-insensitive; extra spaces ignored)</label><input class="form-input" value="' + esc(q.answer || '') + '" data-qf="' + i + '.answer"></div>';
      else if (t === 'keyword') body = '<div class="form-group"><label>Accepted keywords (comma-separated — ANY one appearing in the student\'s answer scores)</label><input class="form-input" value="' + esc(q.keywords || '') + '" placeholder="photosynthesis, chlorophyll, sunlight" data-qf="' + i + '.keywords"></div>';
      return head + body + '</div>';
    }).join('') || '<p class="muted" style="margin:6px 0">No questions yet — add the first one above. A reading without questions is still a valid reading.</p>';
    box.querySelectorAll('[data-qf]').forEach(function (el) {
      el.oninput = function () {
        var path = el.dataset.qf.split('.');
        var v = el.value;
        if (path[1] === 'options') B.qs[Number(path[0])].options[Number(path[2])] = v;
        else if (path[1] === 'answers') B.qs[Number(path[0])].answers = v.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
        else B.qs[Number(path[0])][path[1]] = v;
      };
    });
    box.querySelectorAll('[data-delq]').forEach(function (b) {
      b.onclick = function () { B.qs.splice(Number(b.dataset.delq), 1); builderRender(); };
    });
  }
  function builderLoad(item) {
    B.qs = item ? parseQs(item.questions).map(function (q) { return JSON.parse(JSON.stringify(q)); }) : [];
    B.editing = item || null;
    builderRender();
  }

  /* ── staff: points workbench ────────────────────────────────────── */
  async function points() {
    var cls = (document.getElementById('lqp-class') || {}).value || '';
    var sub = (document.getElementById('lqp-subject') || {}).value || '';
    var box = document.getElementById('lqp-out');
    if (!box) return;
    if (!cls) { box.innerHTML = '<p class="muted">Pick the class first.</p>'; return; }

    var r = await window.sb.from('library_items').select('id,title,subject,engagement_id,cbt_code,max_score').eq('engagement_id', cls).limit(300);
    if (r.error) { box.innerHTML = '<p style="color:#b91c1c">' + esc(r.error.message) + '</p>'; return; }
    var items = r.data || [];
    if (sub) items = items.filter(function (x) { return String(x.subject || '') === sub; });
    if (!items.length) { box.innerHTML = '<p class="muted">No readings for this class' + (sub ? ' + subject' : '') + ' yet.</p>'; return; }

    var a = await window.sb.from('library_quiz_attempts').select('item_id,learner_id,score,max_score').limit(5000);
    if (a.error) { box.innerHTML = '<p style="color:#b91c1c">' + esc(a.error.message) + '</p>'; return; }

    /* best attempt per learner per item */
    var best = {};
    (a.data || []).forEach(function (x) {
      var k = x.item_id + '|' + x.learner_id;
      if (!best[k] || Number(x.score) > Number(best[k].score)) best[k] = x;
    });

    /* learners of the class (for names) */
    var lnames = {};
    try {
      var em = await window.sb.from('engagement_members').select('learner_id,learners(full_name)').eq('engagement_id', cls).limit(500);
      (em.data || []).forEach(function (m) {
        if (m.learners && m.learners.full_name) lnames[m.learner_id] = m.learners.full_name;
      });
    } catch (e) {}

    /* linked-CBT results merged in (best attempt per learner per exam) */
    var cbtCount = 0;
    try {
      var codes = [];
      items.forEach(function (x) { if (x.cbt_code) codes.push(String(x.cbt_code).toUpperCase()); });
      codes = codes.filter(function (c, i) { return c && codes.indexOf(c) === i; });
      if (codes.length) {
        var ex = await window.sb.from('cbt_exams').select('id,code').in('code', codes).limit(100);
        var ids = (ex.data || []).map(function (e) { return e.id; });
        if (ids.length) {
          var rr = await window.sb.from('cbt_results').select('exam_id,learner_id,score,max_score').in('exam_id', ids).limit(5000);
          var cbest = {};
          (rr.data || []).forEach(function (x) {
            var k = x.exam_id + '|' + x.learner_id;
            var pct = Number(x.max_score) ? Number(x.score) / Number(x.max_score) : 0;
            if (!cbest[k] || pct > cbest[k].pct) cbest[k] = { pct: pct, x: x };
          });
          Object.keys(cbest).forEach(function (k) {
            var lid = k.split('|')[1];
            var key = 'CBT|' + k.split('|')[0] + '|' + lid;
            best[key] = { learner_id: lid, score: cbest[k].x.score, max_score: cbest[k].x.max_score };
            cbtCount++;
          });
        }
      }
    } catch (e) {}

    var by = {};
    Object.keys(best).forEach(function (k) {
      var lid = best[k].learner_id;
      if (!by[lid]) by[lid] = { lid: lid, name: lnames[lid] || 'Learner', got: 0, max: 0, n: 0 };
      by[lid].got += Number(best[k].score) || 0;
      by[lid].max += Number(best[k].max_score) || 0;
      by[lid].n++;
    });
    var list = Object.keys(by).map(function (k) { return by[k]; })
      .sort(function (x, y) { return (y.got / (y.max || 1)) - (x.got / (x.max || 1)); });
    LQ._totals = { list: list, cls: cls, sub: sub };

    box.innerHTML = list.length
      ? '<div class="table-wrap"><table><thead><tr><th>Learner</th><th>Scored items</th><th>Points</th><th>%</th></tr></thead><tbody>' +
        list.map(function (t) {
          return '<tr><td><b>' + esc(t.name) + '</b></td><td>' + t.n + '</td><td>' + t.got + ' / ' + t.max + '</td><td><b>' + (t.max ? Math.round(t.got / t.max * 1000) / 10 : 0) + '%</b></td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="muted" style="font-size:.8rem;margin:6px 0 0">Best attempt per learner per reading' + (cbtCount ? ' · includes ' + cbtCount + ' linked-CBT best attempt(s)' : '') + '. Push writes one scoresheet row per learner (source <code>library_points</code>).</p>'
      : '<p class="muted">No quiz attempts yet for this class. Students take quizzes from their Digital library shelf.</p>';
  }

  async function push() {
    var t = LQ._totals;
    if (!t || !t.list.length) { if (window.toast) toast('Click Σ Show totals first.', 'warning'); return; }
    if (!confirm('Push ' + t.list.length + ' learner total(s) into the scoresheet as continuous-assessment evidence (source "library_points")?')) return;
    var saved = 0, failed = 0;
    for (var i = 0; i < t.list.length; i++) {
      var x = t.list[i];
      var pct = x.max ? Math.round(x.got / x.max * 1000) / 10 : 0;
      var row = {
        learner_id: x.lid, engagement_id: t.cls, source: 'library_points',
        title: 'Digital library points' + (t.sub ? ' — ' + t.sub : ''),
        subject: t.sub || 'Reading', score: x.got, max_score: x.max, pct: pct
      };
      var r = await window.sb.from('scoresheet').insert(row);
      if (r.error) failed++; else saved++;
    }
    if (window.toast) toast('🚀 Pushed ' + saved + ' total(s) into the scoresheet' + (failed ? ' · ' + failed + ' failed (missing learner link?)' : '') + '.', failed ? 'warning' : 'success', 9000);
  }

  var LQ = {
    take: take, submit: submit,
    builderAdd: builderAdd, builderRender: builderRender, builderLoad: builderLoad,
    builderState: function () { return { qs: B.qs, editing: B.editing }; },
    points: points, push: push,
    mark: mark, parseQs: parseQs
  };
  return LQ;
})();
