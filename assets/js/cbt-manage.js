/* ============================================================================
   cbt-manage.js — full lifecycle control beside every saved quiz
   ----------------------------------------------------------------------------
   THE REQUEST (report item 22)

   "Just like School Connect's full editing of each CBT, these features (close,
    share, results, preview, edit, questions, archive, etc) should be
    implemented in Tutoring Connect. I should be able to close and open an
    existing CBT. This should be beside each CBT in the Quizzes page."

   WHAT WAS THERE

   practice.html already offered Sit, Edit, ＋CSV, Duplicate and Delete. Five
   things were missing, and one of them mattered a great deal:

     CLOSE / OPEN   There was no way to stop a paper accepting sittings. The
                    only way to end a quiz was to DELETE it — which also
                    destroyed the paper behind every result already recorded.
                    Tutors were deleting papers to close them.
     PREVIEW        No way to see the paper as a candidate sees it without
                    starting a real attempt and polluting the results.
     QUESTIONS      No way to look at, reorder or remove a single question
                    without re-importing the whole CSV.
     RESULTS        No direct route from the paper to its marks.
     SHARE          No shareable link, so codes were being pasted into
                    WhatsApp by hand and mistyped.
     ARCHIVE        No way to retire an old paper without deleting it, so the
                    list grew until it was unusable.

   HOW CLOSING IS ENFORCED

   Not in this file. A browser-side check is a suggestion. tc_cbt_set_state()
   writes the state and a BEFORE INSERT trigger on cbt_results refuses a
   sitting for a paper that is closed, archived, not yet open or past its
   closing time. This file is the control panel; the database is the lock.
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

  var CBTManage = {

    /* State badge for the list. A paper's state has to be legible at a glance
       or the tutor will not trust it. */
    badge: function (x) {
      var s, col;
      if (x.is_archived)      { s = 'Archived';  col = '#64748b'; }
      else if (x.is_open === false) { s = 'Closed'; col = '#b45309'; }
      else if (x.opens_at && new Date(x.opens_at) > new Date())  { s = 'Scheduled'; col = '#0369a1'; }
      else if (x.closes_at && new Date(x.closes_at) < new Date()) { s = 'Expired';  col = '#b45309'; }
      else                    { s = 'Open';      col = '#059669'; }
      return '<span style="display:inline-block;padding:1px 8px;border-radius:999px;font-size:.7rem;' +
             'font-weight:800;color:#fff;background:' + col + '">' + s + '</span>';
    },

    /* The button strip. Rendered beside every paper in the Saved quizzes list. */
    buttons: function (x) {
      var closed = x.is_open === false || x.is_archived;
      var b = [];
      b.push('<a class="btn btn-sm btn-ghost" href="cbt-exam.html?code=' +
             encodeURIComponent(x.code || '') + '" title="Sit this paper for real">▶️ Sit</a>');
      b.push('<button class="btn btn-sm btn-outline" type="button" data-cbtm="preview" data-id="' +
             esc(x.id) + '" title="See it exactly as a candidate does, without recording a sitting">👁 Preview</button>');
      b.push('<button class="btn btn-sm btn-outline" type="button" data-cbtm="questions" data-id="' +
             esc(x.id) + '" title="List, reorder and remove individual questions">❓ Questions</button>');
      b.push('<button class="btn btn-sm btn-outline" type="button" data-edit="' + esc(x.id) +
             '" title="Load the whole paper back into the form above">✏️ Edit</button>');
      b.push('<button class="btn btn-sm btn-outline" type="button" data-cbtm="results" data-id="' +
             esc(x.id) + '" title="Marks, item analysis and audit">📊 Results</button>');
      b.push('<button class="btn btn-sm btn-outline" type="button" data-cbtm="share" data-id="' +
             esc(x.id) + '" title="Copy a link candidates can open directly">🔗 Share</button>');
      b.push('<button class="btn btn-sm ' + (closed ? 'btn-primary' : 'btn-outline') +
             '" type="button" data-cbtm="' + (x.is_open === false ? 'open' : 'close') + '" data-id="' + esc(x.id) +
             '" title="' + (x.is_open === false
                ? 'Let candidates sit it again'
                : 'Stop new sittings. Existing results are kept.') + '">' +
             (x.is_open === false ? '🔓 Open' : '🔒 Close') + '</button>');
      b.push('<button class="btn btn-sm btn-ghost" type="button" data-cbtm="' +
             (x.is_archived ? 'unarchive' : 'archive') + '" data-id="' + esc(x.id) +
             '" title="' + (x.is_archived ? 'Bring it back into the working list'
                                          : 'Retire it without deleting it or its results') + '">' +
             (x.is_archived ? '📤 Unarchive' : '📦 Archive') + '</button>');
      b.push('<button class="btn btn-sm btn-outline" type="button" data-dup="' + esc(x.id) +
             '" title="Copy it into the form as a new paper">⧉ Duplicate</button>');
      b.push('<button class="btn btn-sm btn-outline" type="button" data-append="' + esc(x.id) +
             '" title="Append more questions from a CSV">＋CSV</button>');
      b.push('<button class="btn btn-sm btn-ghost" type="button" data-del="' + esc(x.id) +
             '" style="color:#b42318" title="Delete the paper. Results are kept.">🗑 Delete</button>');
      return '<div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">' + b.join('') + '</div>';
    },

    /* Bind everything with data-cbtm. Called after the list is painted. */
    wire: function (getExam, reload) {
      var self = this;
      d.querySelectorAll('[data-cbtm]').forEach(function (b) {
        if (b._cbtmWired) return;
        b._cbtmWired = true;
        b.addEventListener('click', function () {
          var x = getExam(b.getAttribute('data-id'));
          if (!x) return;
          var a = b.getAttribute('data-cbtm');
          if (a === 'preview')   return self.preview(x);
          if (a === 'questions') return self.questions(x, reload);
          if (a === 'results')   return self.results(x);
          if (a === 'share')     return self.share(x, reload);
          return self.setState(x, a, reload);
        });
      });
    },

    /* ---------------------------------------------------------------------
       Lifecycle. One RPC, so the rules live in the database and cannot drift
       between this page and the builder.
       --------------------------------------------------------------------- */
    async setState(x, action, reload) {
      var s = sb();
      if (!s) return toast('Not connected to the database.', 'warning');

      var confirmText = {
        close: 'Close "' + (x.title || '') + '"?\n\nNo new sittings will be accepted. ' +
               'Everything already submitted is KEPT, and you can re-open it at any time.',
        open:  'Re-open "' + (x.title || '') + '"?\n\nCandidates will be able to sit it again.',
        archive: 'Archive "' + (x.title || '') + '"?\n\nIt leaves the working list and stops ' +
                 'accepting sittings, but nothing is deleted — the paper and every result stay.',
        unarchive: 'Bring "' + (x.title || '') + '" back into the working list?'
      }[action];
      if (confirmText && !w.confirm(confirmText)) return;

      try {
        var r = await s.rpc('tc_cbt_set_state', { p_exam: x.id, p_action: action });
        if (r.error) throw r.error;
        var v = r.data || {};
        if (v.ok === false) return toast(v.error || 'That did not work.', 'danger', 8000);
        toast({
          close: 'Closed. No further sittings will be accepted.',
          open: 'Re-opened. Candidates can sit it again.',
          archive: 'Archived. Nothing was deleted.',
          unarchive: 'Back in the working list.'
        }[action] || 'Done.', 'success');
        if (reload) reload();
      } catch (err) {
        var m = String(err.message || err);
        if (/function .*tc_cbt_set_state.* does not exist|schema cache/i.test(m)) {
          toast('Your database does not have the quiz lifecycle functions yet. ' +
                'Run database/complete-schema.sql (V25 or later) in the Supabase SQL editor, then reload.',
                'danger', 12000);
        } else {
          toast(m, 'danger', 9000);
        }
      }
    },

    async share(x, reload) {
      var s = sb();
      if (!s) return;
      var token = x.share_token;
      if (!token || x.share_active === false) {
        var r = await s.rpc('tc_cbt_set_state', { p_exam: x.id, p_action: 'share' });
        if (r.error) return toast(r.error.message, 'danger', 9000);
        token = (r.data || {}).share_token;
        if (reload) reload();
      }
      var base = w.location.href.replace(/[^/]*$/, '');
      var url = base + 'cbt-exam.html?code=' + encodeURIComponent(x.code || '') +
                (token ? '&t=' + encodeURIComponent(token) : '');
      this._modal('🔗 Share “' + esc(x.title || '') + '”',
        '<p class="muted">Send this link to candidates. It opens the paper directly, so nobody has to ' +
        'type a code — which is where most "the code does not work" messages come from.</p>' +
        '<div style="display:flex;gap:6px;margin:10px 0">' +
          '<input class="form-input" id="cbtm-url" value="' + esc(url) + '" readonly style="flex:1">' +
          '<button class="btn btn-primary" type="button" id="cbtm-copy">Copy</button></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="https://wa.me/?text=' +
            encodeURIComponent('Your quiz: ' + (x.title || '') + '\n' + url) + '">Send on WhatsApp</a>' +
          '<a class="btn btn-outline btn-sm" href="mailto:?subject=' +
            encodeURIComponent('Quiz: ' + (x.title || '')) + '&body=' + encodeURIComponent(url) + '">Email it</a>' +
          '<button class="btn btn-ghost btn-sm" type="button" id="cbtm-unshare">Turn the link off</button>' +
        '</div>' +
        '<p class="muted" style="margin-top:10px;font-size:.82rem">Turning the link off does not close the ' +
        'paper — a candidate who already has the code can still sit it. Use <b>🔒 Close</b> for that.</p>',
        function (body) {
          body.querySelector('#cbtm-copy').addEventListener('click', function () {
            var i = body.querySelector('#cbtm-url');
            i.select();
            try { d.execCommand('copy'); } catch (e) {}
            if (w.navigator.clipboard) w.navigator.clipboard.writeText(i.value);
            toast('Link copied.', 'success');
          });
          body.querySelector('#cbtm-unshare').addEventListener('click', async function () {
            var r2 = await sb().rpc('tc_cbt_set_state', { p_exam: x.id, p_action: 'unshare' });
            if (r2.error) return toast(r2.error.message, 'danger');
            toast('Share link turned off.', 'success');
            if (reload) reload();
          });
        });
    },

    results: function (x) {
      w.location.href = 'cbt-results.html?exam=' + encodeURIComponent(x.id);
    },

    /* ---------------------------------------------------------------------
       Preview — the paper as a candidate sees it, with the answers shown to
       the tutor and NOTHING written to cbt_results.
       --------------------------------------------------------------------- */
    preview: function (x) {
      var qs = Array.isArray(x.questions) ? x.questions : [];
      if (!qs.length) {
        return toast('That paper has no questions in it yet.', 'warning');
      }
      var html =
        '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">' +
          '<span class="muted"><b>' + qs.length + '</b> question(s)</span>' +
          '<span class="muted">· ' + esc(x.duration_min || '?') + ' min</span>' +
          '<span class="muted">· ' + esc(x.quiz_kind || 'graded') + '</span>' +
          '<span class="muted">· ' + (x.is_open === false ? 'CLOSED' : 'open') + '</span>' +
        '</div>' +
        '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 10px;' +
          'font-size:.84rem;margin-bottom:12px">This is a <b>preview</b>. Answers are shown, the timer ' +
          'does not run, and nothing is recorded against you or anyone else.</div>' +
        '<div style="max-height:60vh;overflow:auto">' +
        qs.map(function (q, i) {
          var opts = [];
          ['a', 'b', 'c', 'd', 'e'].forEach(function (k) {
            var v = q[k] != null ? q[k] : (q['option_' + k]);
            if (v != null && String(v).trim() !== '') {
              var right = String(q.answer || '').trim().toLowerCase() === k;
              opts.push('<li style="' + (right ? 'font-weight:700;color:#059669' : '') + '">' +
                        k.toUpperCase() + '. ' + esc(v) + (right ? ' ✓' : '') + '</li>');
            }
          });
          return '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin-bottom:8px">' +
            '<div><b>Q' + (i + 1) + '.</b> ' + esc(q.question || q.text || '') + '</div>' +
            (q.passage ? '<div class="muted" style="font-size:.82rem;margin-top:4px">Passage: ' +
              esc(String(q.passage).slice(0, 200)) + '…</div>' : '') +
            (opts.length ? '<ul style="margin:6px 0 0 18px">' + opts.join('') + '</ul>'
                         : '<div class="muted" style="margin-top:4px">Answer: <b>' +
                           esc(q.answer == null ? '(none set)' : q.answer) + '</b></div>') +
            (q.explanation ? '<div class="muted" style="font-size:.82rem;margin-top:5px">💡 ' +
              esc(q.explanation) + '</div>' : '') +
            (q.answer == null || q.answer === ''
              ? '<div style="color:#b91c1c;font-size:.82rem;margin-top:5px">⚠ No answer key — this ' +
                'question cannot be marked, and every candidate will score zero on it.</div>' : '') +
            '</div>';
        }).join('') + '</div>';

      var missing = qs.filter(function (q) { return q.answer == null || q.answer === ''; }).length;
      if (missing) {
        html = '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px;' +
               'margin-bottom:10px;color:#991b1b"><b>⚠ ' + missing + ' question(s) have no answer key.</b> ' +
               'Fix them before anyone sits this paper — an unkeyed question marks every candidate wrong.</div>' + html;
      }
      this._modal('👁 Preview — ' + esc(x.title || ''), html);
    },

    /* ---------------------------------------------------------------------
       Question manager — look at, reorder and remove single questions without
       re-importing the whole CSV.
       --------------------------------------------------------------------- */
    questions: function (x, reload) {
      var self = this;
      var qs = (Array.isArray(x.questions) ? x.questions : []).slice();

      var draw = function (body) {
        body.querySelector('#cbtm-qlist').innerHTML = qs.length
          ? qs.map(function (q, i) {
              return '<div style="display:flex;gap:8px;align-items:flex-start;border-bottom:1px solid #e2e8f0;' +
                'padding:7px 0"><div style="flex:1;min-width:0">' +
                '<b>Q' + (i + 1) + '.</b> ' + esc(String(q.question || q.text || '').slice(0, 140)) +
                '<div class="muted" style="font-size:.78rem">answer: ' +
                  esc(q.answer == null || q.answer === '' ? '⚠ none' : q.answer) +
                  (q.subject ? ' · ' + esc(q.subject) : '') +
                  (q.mark ? ' · ' + esc(q.mark) + ' mark(s)' : '') + '</div></div>' +
                '<button class="btn btn-sm btn-ghost" type="button" data-q-up="' + i + '" title="Move up">▲</button>' +
                '<button class="btn btn-sm btn-ghost" type="button" data-q-dn="' + i + '" title="Move down">▼</button>' +
                '<button class="btn btn-sm btn-ghost" type="button" data-q-rm="' + i + '" ' +
                  'style="color:#b42318" title="Remove this question">✕</button></div>';
            }).join('')
          : '<p class="muted">This paper has no questions yet.</p>';

        body.querySelectorAll('[data-q-up]').forEach(function (b) {
          b.onclick = function () {
            var i = +b.dataset.qUp;
            if (i > 0) { var t = qs[i - 1]; qs[i - 1] = qs[i]; qs[i] = t; draw(body); }
          };
        });
        body.querySelectorAll('[data-q-dn]').forEach(function (b) {
          b.onclick = function () {
            var i = +b.dataset.qDn;
            if (i < qs.length - 1) { var t = qs[i + 1]; qs[i + 1] = qs[i]; qs[i] = t; draw(body); }
          };
        });
        body.querySelectorAll('[data-q-rm]').forEach(function (b) {
          b.onclick = function () {
            var i = +b.dataset.qRm;
            if (w.confirm('Remove question ' + (i + 1) + ' from this paper?')) { qs.splice(i, 1); draw(body); }
          };
        });
      };

      this._modal('❓ Questions — ' + esc(x.title || ''),
        '<p class="muted">Reorder with ▲▼, remove with ✕, then save. Results already recorded are not ' +
        'touched — but be careful: removing a question after people have sat the paper changes what the ' +
        'old marks were out of.</p>' +
        '<div id="cbtm-qlist" style="max-height:55vh;overflow:auto;margin:10px 0"></div>' +
        '<button class="btn btn-primary" type="button" id="cbtm-qsave">💾 Save the question order</button>',
        function (body) {
          draw(body);
          body.querySelector('#cbtm-qsave').addEventListener('click', async function () {
            var s = sb();
            if (!s) return toast('Not connected.', 'warning');
            var r = await s.from('cbt_exams').update({ questions: qs }).eq('id', x.id);
            if (r.error) return toast(r.error.message, 'danger', 9000);
            toast('Saved — ' + qs.length + ' question(s).', 'success');
            self._closeModal();
            if (reload) reload();
          });
        });
    },

    /* ---- a self-contained modal, so this file does not depend on the page - */
    _modal: function (title, html, after) {
      this._closeModal();
      var back = d.createElement('div');
      back.id = 'cbtm-modal';
      back.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:10050;' +
        'display:flex;align-items:center;justify-content:center;padding:20px';
      back.innerHTML = '<div style="background:var(--white,#fff);color:inherit;border-radius:16px;' +
        'max-width:820px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;' +
          'padding:14px 18px;border-bottom:1px solid var(--gray-200,#e2e8f0)">' +
          '<h3 style="margin:0;font-size:1.05rem">' + title + '</h3>' +
          '<button class="btn btn-sm btn-ghost" type="button" id="cbtm-x">✕</button></div>' +
        '<div style="padding:18px" id="cbtm-body">' + html + '</div></div>';
      d.body.appendChild(back);
      var self = this;
      back.querySelector('#cbtm-x').addEventListener('click', function () { self._closeModal(); });
      back.addEventListener('click', function (e) { if (e.target === back) self._closeModal(); });
      d.addEventListener('keydown', this._escHandler = function (e) {
        if (e.key === 'Escape') self._closeModal();
      });
      if (after) after(back.querySelector('#cbtm-body'));
    },

    _closeModal: function () {
      var m = d.getElementById('cbtm-modal');
      if (m) m.remove();
      if (this._escHandler) { d.removeEventListener('keydown', this._escHandler); this._escHandler = null; }
    }
  };

  w.CBTManage = CBTManage;
  if (w.TC) w.TC.CBTManage = CBTManage;
})(window);
