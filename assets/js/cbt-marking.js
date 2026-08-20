/* ============================================================================
   cbt-marking.js — the tutor's marking desk          (reported item 7)
   ----------------------------------------------------------------------------
   "For CBT, there are some question types that will require the oversight of
    the tutor in order for students to get the appropriate scores. Enable this
    feature so that the tutor is able to audit the scores for such question
    types and award the right marks."

   WHAT WAS ACTUALLY HAPPENING BEFORE

   The grader already knew which questions it must not mark — CBT.gradeOne()
   returns { pending: true } for essays, case studies, oral prompts, peer
   review, citations and code. But nothing consumed that flag. The submission
   was written with a score that counted ONLY the auto-marked questions, and
   the paper's total still counted every question. So a twenty-question paper
   with five essays reported, say, 11/20 when the candidate had actually been
   assessed on fifteen questions and no human had looked at the other five.
   Nobody was told. The mark went to the scoresheet, and from there into the
   progress report, as though it were final.

   WHAT THIS FILE DOES

     * lists every submission still awaiting a human, oldest first;
     * shows the question, the candidate's answer, the mark available, any
       machine-computed hints (keyword hits, word count) and — where the paper
       supplied one — the model answer, side by side;
     * lets the tutor award a mark and write a comment per question;
     * recomputes the total IN THE DATABASE from auto marks plus awarded marks,
       so a typed total can never disagree with its parts;
     * holds the result back from the family until marking is finished, then
       releases it in one deliberate act;
     * records who marked it and when.

   Marking is deliberately NOT anonymous and deliberately NOT reversible in
   silence: tc_cbt_award_marks() stamps marked_by and marked_at every time.
   ========================================================================== */
(function (w) {
  'use strict';

  var d = w.document;
  function sb() { return w.sb || (w.App && w.App.sb) || null; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(m, k, ms) { if (w.toast) return w.toast(m, k || 'info', ms || 4500); console.log(m); }

  function showAnswer(v) {
    if (v == null || v === '') return '<i class="muted">(left blank)</i>';
    if (Array.isArray(v)) {
      var clean = v.filter(function (x) { return x != null && String(x).trim() !== ''; });
      return clean.length ? esc(clean.join('  →  ')) : '<i class="muted">(left blank)</i>';
    }
    if (typeof v === 'object') return '<pre style="white-space:pre-wrap;margin:0">' + esc(JSON.stringify(v, null, 1)) + '</pre>';
    return '<div style="white-space:pre-wrap">' + esc(v) + '</div>';
  }

  function words(v) {
    return String(v == null ? '' : v).trim().split(/\s+/).filter(Boolean).length;
  }

  var Marking = {

    state: { queue: [], open: null, rows: [] },

    async mount(rootId, examId) {
      this.host = d.getElementById(rootId || 'marking-root');
      if (!this.host) return;
      this.examId = examId || null;
      this.host.innerHTML = '<div class="card"><p class="muted">Loading the marking queue…</p></div>';
      await this.load();
      this.paint();
    },

    async load() {
      var s = sb();
      this._err = null;
      if (!s || !s.rpc) { this.state.queue = []; return; }
      try {
        var r = await s.rpc('tc_cbt_marking_queue', { p_exam: this.examId || null });
        if (r.error) throw r.error;
        this.state.queue = r.data || [];
      } catch (e) {
        this._err = String(e.message || e);
        this.state.queue = [];
      }
    },

    paint() {
      var self = this;
      var q = this.state.queue;

      if (this._err && /does not exist|schema cache|Could not find the function/i.test(this._err)) {
        this.host.innerHTML =
          '<div class="card" style="border-left:4px solid #f59e0b;background:#fffbeb">' +
          '<b>The marking queue is not installed in your database yet.</b><br>' +
          '<span style="font-size:.9rem">Open the Supabase SQL editor, run ' +
          '<b>database/complete-schema.sql</b>, then run this one line:<br>' +
          '<code>notify pgrst, \'reload schema\';</code><br>' +
          'Check it worked with <code>select public.tc_schema_ok();</code></span></div>';
        return;
      }

      var head =
        '<section class="card">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">' +
            '<div><h2 style="margin:0 0 4px">✍️ Marking queue</h2>' +
            '<p class="muted" style="margin:0;max-width:820px">Essays, case studies, oral prompts and code ' +
            'cannot be marked fairly by a machine, so they are held here until you mark them. Until you do, ' +
            'the candidate\u2019s result is <b>not</b> released to them or to their parent, and it does not ' +
            'reach the scoresheet — a provisional mark should never be shown as though it were final.</p></div>' +
            '<button class="btn btn-ghost btn-sm" type="button" id="mk-refresh">↻ Refresh</button>' +
          '</div>' +
        '</section>';

      if (!q.length) {
        this.host.innerHTML = head +
          '<div class="card" style="margin-top:12px;text-align:center;padding:28px">' +
          '<div style="font-size:2rem">✅</div><p style="margin:8px 0 2px"><b>Nothing is waiting to be marked.</b></p>' +
          '<p class="muted" style="margin:0;font-size:.9rem">Every submission on your papers has been marked ' +
          'and released.</p></div>';
        var rb0 = d.getElementById('mk-refresh');
        if (rb0) rb0.onclick = function () { self.mount(self.host.id, self.examId); };
        return;
      }

      this.host.innerHTML = head +
        '<section class="card" style="margin-top:12px">' +
          '<div class="table-wrap"><table style="width:100%;font-size:.88rem">' +
          '<thead><tr><th>Candidate</th><th>Paper</th><th>Submitted</th>' +
          '<th style="text-align:right">Auto</th><th style="text-align:right">To mark</th>' +
          '<th style="text-align:right">Action</th></tr></thead><tbody>' +
          q.map(function (r) {
            return '<tr><td><b>' + esc(r.candidate) + '</b></td>' +
              '<td>' + esc(r.exam_title || '') + '<br><code style="font-size:.75rem">' + esc(r.exam_code || '') + '</code></td>' +
              '<td>' + esc(r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—') + '</td>' +
              '<td style="text-align:right">' + esc(r.auto_score == null ? '—' : r.auto_score) +
                ' / ' + esc(r.max_score == null ? '—' : r.max_score) + '</td>' +
              '<td style="text-align:right"><b style="color:#b45309">' + esc(r.pending_count) + '</b></td>' +
              '<td style="text-align:right"><button class="btn btn-sm btn-primary" type="button" ' +
                'data-mk-open="' + esc(r.result_id) + '">✍️ Mark</button></td></tr>';
          }).join('') +
          '</tbody></table></div></section>' +
        '<div id="mk-sheet" style="margin-top:12px"></div>';

      var rb = d.getElementById('mk-refresh');
      if (rb) rb.onclick = function () { self.mount(self.host.id, self.examId); };
      this.host.querySelectorAll('[data-mk-open]').forEach(function (b) {
        b.onclick = function () { self.openSheet(b.getAttribute('data-mk-open')); };
      });
    },

    async openSheet(resultId) {
      var self = this;
      var box = d.getElementById('mk-sheet');
      box.innerHTML = '<div class="card"><p class="muted">Loading the paper…</p></div>';

      var s = sb();
      var res, exam;
      try {
        var r = await s.from('cbt_results').select('*').eq('id', resultId).maybeSingle();
        if (r.error) throw r.error;
        res = r.data;
        if (!res) throw new Error('That submission could not be loaded.');
        var e = await s.from('cbt_exams').select('id,title,code,questions').eq('id', res.exam_id).maybeSingle();
        exam = (e && e.data) || {};
      } catch (err) {
        box.innerHTML = '<div class="card" style="color:#b91c1c">' + esc(err.message || err) + '</div>';
        return;
      }

      var rows = Array.isArray(res.per_question) && res.per_question.length
        ? res.per_question
        : (Array.isArray(res.review) ? res.review : []);

      if (!rows.length) {
        box.innerHTML = '<div class="card" style="border-left:4px solid #f59e0b;background:#fffbeb">' +
          '<b>This submission has no per-question breakdown stored.</b><br>' +
          '<span style="font-size:.9rem">It was sat before per-question marking existed, so there is nothing ' +
          'to mark question by question. Either ask the candidate to re-sit the paper, or set an overall mark ' +
          'directly on the result record in <a href="admin-data.html">Admin data</a>. Nothing has been ' +
          'silently guessed.</span></div>';
        return;
      }

      this.state.open = res;
      this.state.rows = rows;
      var questions = Array.isArray(exam.questions) ? exam.questions : [];

      var autoTotal = rows.reduce(function (a, x) {
        return a + (x.pending ? 0 : Number(x.mark || 0)); }, 0);
      var maxTotal = rows.reduce(function (a, x) { return a + Number(x.max || 0); }, 0);

      box.innerHTML =
        '<section class="card">' +
          '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start">' +
            '<div><h3 style="margin:0 0 3px">✍️ ' + esc(res.candidate_name || 'Candidate') + '</h3>' +
              '<div class="muted" style="font-size:.85rem">' + esc(exam.title || '') +
              ' · submitted ' + esc(res.submitted_at ? new Date(res.submitted_at).toLocaleString() : '—') +
              (res.student_no ? ' · ' + esc(res.student_no) : '') + '</div></div>' +
            '<div style="text-align:right">' +
              '<div style="font-size:1.4rem;font-weight:800" id="mk-total">' +
                autoTotal + ' / ' + maxTotal + '</div>' +
              '<div class="muted" style="font-size:.78rem">auto marks so far</div></div>' +
          '</div>' +

          '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:9px 11px;' +
            'margin:12px 0;font-size:.85rem;color:#1e3a8a">' +
            'Only the questions below need you. Everything else on this paper was marked automatically and ' +
            'is already counted in the total. Awarding a mark of 0 is a decision and is recorded as one — it ' +
            'is not the same as leaving a question unmarked.</div>' +

          '<div id="mk-questions">' +
          rows.map(function (row, i) {
            if (!row.pending) return '';
            var q = questions[i] || {};
            var maxm = Number(row.max || q.mark || 1);
            var hint = row.detail ? '<div class="muted" style="font-size:.8rem;margin-top:4px">' +
              '🤖 Machine notes: ' + esc(row.detail) + '</div>' : '';
            var model = (q.explanation || row.explanation || '');
            var wc = words(row.given);
            return '<article class="card" style="margin-top:10px;border-left:4px solid #1e40af" ' +
              'data-mk-q="' + i + '">' +
              '<div class="muted" style="font-size:.74rem;text-transform:uppercase">Question ' + (i + 1) +
                ' · ' + esc(row.type || q.type || '') + ' · ' + maxm + ' mark(s)' +
                (wc ? ' · ' + wc + ' words' : '') + '</div>' +
              '<p style="font-weight:700;margin:6px 0">' + esc(row.question || q.question || '') + '</p>' +
              (q.passage ? '<blockquote style="border-left:3px solid #cbd5e1;padding-left:10px;margin:6px 0;' +
                'font-size:.86rem" class="muted">' + esc(String(q.passage).slice(0, 400)) + '</blockquote>' : '') +
              '<div style="background:var(--surface-soft,#f8fafc);border:1px solid #e2e8f0;border-radius:8px;' +
                'padding:9px 11px;margin:6px 0"><b style="font-size:.8rem">Candidate\u2019s answer</b>' +
                '<div style="margin-top:4px">' + showAnswer(row.given) + '</div>' + hint + '</div>' +
              (model ? '<details style="margin:6px 0"><summary style="cursor:pointer;font-size:.85rem">' +
                'Model answer / marking guidance</summary><div class="muted" style="font-size:.87rem;' +
                'margin-top:5px;white-space:pre-wrap">' + esc(model) + '</div></details>' : '') +
              '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px">' +
                '<label style="font-size:.85rem;font-weight:700">Mark</label>' +
                '<input class="form-input" type="number" step="0.5" min="0" max="' + maxm + '" ' +
                  'data-mk-mark="' + i + '" style="width:90px" placeholder="0">' +
                '<span class="muted" style="font-size:.85rem">out of ' + maxm + '</span>' +
                [0, 0.5, 1].map(function (f) {
                  var v = Math.round(maxm * f * 2) / 2;
                  return '<button class="btn btn-sm btn-outline" type="button" data-mk-quick="' + i +
                    '" data-v="' + v + '">' + (f === 0 ? '0' : f === 1 ? 'Full ' + v : 'Half ' + v) + '</button>';
                }).join('') +
              '</div>' +
              '<input class="form-input" data-mk-comment="' + i + '" style="margin-top:7px" ' +
                'placeholder="Comment for the candidate (optional but recommended)">' +
              '</article>';
          }).join('') +
          '</div>' +

          '<div class="form-group" style="margin-top:12px"><label for="mk-overall">Overall comment</label>' +
            '<textarea class="form-textarea" id="mk-overall" rows="2">' + esc(res.tutor_comment || '') + '</textarea></div>' +

          '<div id="mk-error" style="display:none;margin:8px 0;padding:9px 11px;border-radius:8px;' +
            'background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:.88rem"></div>' +

          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' +
            '<button class="btn btn-primary" type="button" id="mk-save">💾 Award marks &amp; release</button>' +
            '<button class="btn btn-outline" type="button" id="mk-hold">💾 Save without releasing</button>' +
            '<button class="btn btn-ghost" type="button" id="mk-close">Close</button>' +
          '</div>' +
        '</section>';

      box.scrollIntoView({ behavior: 'smooth', block: 'start' });

      box.querySelectorAll('[data-mk-quick]').forEach(function (b) {
        b.onclick = function () {
          var i = b.getAttribute('data-mk-quick');
          var f = box.querySelector('[data-mk-mark="' + i + '"]');
          if (f) { f.value = b.getAttribute('data-v'); self._retotal(box, autoTotal, maxTotal); }
        };
      });
      box.querySelectorAll('[data-mk-mark]').forEach(function (f) {
        f.addEventListener('input', function () { self._retotal(box, autoTotal, maxTotal); });
      });
      d.getElementById('mk-close').onclick = function () { box.innerHTML = ''; };
      d.getElementById('mk-save').onclick = function () { self._save(box, resultId, true); };
      d.getElementById('mk-hold').onclick = function () { self._save(box, resultId, false); };
    },

    /* Live running total, so the tutor sees the effect of each mark as they
       award it rather than after saving. */
    _retotal(box, autoTotal, maxTotal) {
      var extra = 0;
      box.querySelectorAll('[data-mk-mark]').forEach(function (f) {
        var v = parseFloat(f.value);
        if (isFinite(v)) extra += v;
      });
      var el = d.getElementById('mk-total');
      if (el) {
        var t = Math.round((autoTotal + extra) * 100) / 100;
        el.textContent = t + ' / ' + maxTotal;
        el.style.color = maxTotal && (t / maxTotal) >= 0.5 ? '#059669' : '#b45309';
      }
    },

    async _save(box, resultId, release) {
      var err = d.getElementById('mk-error');
      var show = function (m) { err.innerHTML = m; err.style.display = ''; };
      err.style.display = 'none';

      var marks = [];
      var missing = [];
      box.querySelectorAll('[data-mk-mark]').forEach(function (f) {
        var i = Number(f.getAttribute('data-mk-mark'));
        var v = parseFloat(f.value);
        var c = box.querySelector('[data-mk-comment="' + i + '"]');
        if (!isFinite(v)) { missing.push(i + 1); return; }
        marks.push({ i: i, mark: v, comment: c ? c.value : '' });
      });

      if (release && missing.length) {
        return show('Question ' + missing.join(', ') + ' still ' +
          (missing.length === 1 ? 'has' : 'have') + ' no mark. ' +
          'Award a mark for every question — including a deliberate <b>0</b> — before releasing, ' +
          'or use <b>Save without releasing</b> to come back to it.');
      }
      if (!marks.length) return show('Nothing to save yet.');

      var s = sb();
      if (!s) return show('Not connected to the database.');

      try {
        var r = await s.rpc('tc_cbt_award_marks', {
          p_result: resultId,
          p_marks: marks,
          p_comment: (d.getElementById('mk-overall') || {}).value || null,
          p_release: !!release
        });
        if (r.error) throw r.error;
        var out = r.data || {};
        if (out.ok === false) return show(esc(out.error || 'That did not work.'));

        toast('Marked: ' + out.score + ' / ' + out.max +
              (out.pct != null ? ' (' + out.pct + '%)' : '') +
              (out.still_pending ? ' — ' + out.still_pending + ' question(s) still to mark'
                                 : out.released ? ' — released to the candidate'
                                                : ' — saved, not yet released'),
              'success', 8000);
        box.innerHTML = '';
        await this.load();
        this.paint();
      } catch (e2) {
        var m = String(e2.message || e2);
        if (/does not exist|schema cache|Could not find the function/i.test(m)) {
          show('Your database does not have <code>tc_cbt_award_marks</code> yet. Run ' +
               '<b>database/complete-schema.sql</b>, then <code>notify pgrst, \'reload schema\';</code>');
        } else if (/not assigned to you/i.test(m)) {
          show('This paper is not assigned to you, so you may not mark it. Ask an administrator.');
        } else {
          show('Could not save the marks: ' + esc(m));
        }
      }
    }
  };

  w.CBTMarking = Marking;
  if (w.TC) w.TC.CBTMarking = Marking;
})(window);
