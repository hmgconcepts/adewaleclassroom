/* ═══════════════════════════════════════════════════════════════════════
   ADEWALE CLASSROOM — Assignment points workbench (V51 / round 15,
   item 10 — GOSA deep-study implementation)
   ═══════════════════════════════════════════════════════════════════════
   GOSA's Assignments page, studied in full, is built on one blueprint:
   assignments are given MORE THAN ONCE per term and accumulate — physical
   work scored by hand, CBT work scored automatically — and the cumulative
   total is what lands in the report card. This engine ports that to the
   Tutoring Connect data model:

   ✍️ Score class — open any assignment row and score the whole class in
      one modal. For a CBT assignment the scores AUTO-FILL from the best
      cbt_results attempt of every learner, scaled to the assignment's
      max (raw 15/20 → 7.5/10 when max is 10); the teacher can still
      adjust before saving. For physical work the modal starts empty.
      Saving writes one per-learner row (same title/kind/engagement,
      status "marked") so nothing overwrites the class-wide row.

   📋 Term score sheet — every assignment as a column, every learner as a
      row: physical 📄 and CBT 🖥️ side by side, with Total got / Total
      max and % per learner (the cumulative collation).

   Σ Totals only — the condensed per-learner view.

   🚀 Push → scoresheet — writes each learner's cumulative points into
      the studio scoresheet (source "homework_points"), the same place
      graded CBT marks already flow, so end-of-term evidence is one
      story, not two. CSV export included.
   ═══════════════════════════════════════════════════════════════════════ */
window.ASSIGN_POINTS = (function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var S = { engagement: '', items: [], learners: [], sheet: null };

  async function learnersOf(engagementId) {
    var r = await window.sb.from('engagement_members')
      .select('learner_id,learners(id,full_name)').eq('engagement_id', engagementId).limit(500);
    if (r.error) throw new Error(r.error.message);
    return (r.data || []).filter(function (m) { return m.learner_id && m.learners; })
      .map(function (m) { return { id: m.learner_id, name: m.learners.full_name }; });
  }

  /* ── ✍️ Score class (auto-fill for CBT) ─────────────────────────── */
  async function scoreClass(row) {
    if (!row || !window.sb) return;
    var learners;
    try { learners = await learnersOf(row.engagement_id); }
    catch (e) { toast('Could not load the class list: ' + e.message, 'danger', 8000); return; }
    if (!learners.length) { toast('This class has no active learners yet — add them on the Classes page first.', 'warning', 8000); return; }

    /* existing per-learner scores for this title */
    var ex = await window.sb.from('assignments')
      .select('learner_id,score,max_score').eq('engagement_id', row.engagement_id)
      .eq('title', row.title).not('learner_id', 'is', null).limit(500);
    var byLearner = {};
    ((ex && ex.data) || []).forEach(function (x) { byLearner[x.learner_id] = x; });

    var isCbt = String(row.kind || '') === 'cbt';
    var auto = {};
    if (isCbt && row.cbt_exam_id) {
      var rr = await window.sb.from('cbt_results')
        .select('learner_id,score,max_score').eq('exam_id', row.cbt_exam_id).limit(2000);
      var best = {};
      ((rr && rr.data) || []).forEach(function (x) {
        if (!x.learner_id) return;
        var pct = Number(x.max_score) ? Number(x.score) / Number(x.max_score) : 0;
        if (!best[x.learner_id] || pct > best[x.learner_id].pct) best[x.learner_id] = { pct: pct, score: Number(x.score), max: Number(x.max_score) };
      });
      var aMax = Number(row.max_score) || 0;
      Object.keys(best).forEach(function (lid) {
        /* scale the raw CBT score to the assignment's max (GOSA parity:
           raw 15/20 → 7.5/10 when the assignment max is 10). */
        auto[lid] = aMax && best[lid].max ? Math.round(best[lid].pct * aMax * 10) / 10 : best[lid].score;
      });
    }

    var maxInput = '<div class="form-group"><label>Maximum mark</label><input class="form-input" type="number" id="ap-max" value="' + esc(row.max_score || 10) + '"' + (isCbt ? ' readonly title="Auto-filled from the CBT exam"' : '') + '></div>';
    var kindLine = isCbt
      ? '<p class="muted" style="margin:0 0 8px;font-size:.85rem"><span class="badge" style="background:#dcfce7;color:#166534">🖥️ CBT assignment — auto-marked</span> scores below auto-filled from each learner\'s BEST CBT attempt, scaled to the maximum. Adjust any of them before saving.</p>'
      : '<p class="muted" style="margin:0 0 8px;font-size:.85rem"><span class="badge" style="background:#dbeafe;color:#1e40af">📄 Physical assignment</span> enter each learner\'s score by hand.</p>';

    var rows = learners.map(function (l) {
      var v = '';
      if (auto[l.id] != null) v = auto[l.id];
      else if (byLearner[l.id] && byLearner[l.id].score != null) v = byLearner[l.id].score;
      return '<tr><td><b>' + esc(l.name) + '</b></td><td style="width:130px"><input class="form-input ap-score" data-lid="' + esc(l.id) + '" type="number" step="0.5" min="0" value="' + esc(v) + '" placeholder="—"></td></tr>';
    }).join('');

    openModal('✍️ Score class — ' + row.title,
      kindLine + maxInput +
      '<div class="table-wrap" style="max-height:50vh;overflow:auto"><table><thead><tr><th>Learner</th><th>Score</th></tr></thead><tbody>' + rows + '</tbody></table></div>',
      '<button class="btn btn-outline" type="button" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-primary" type="button" id="ap-save-scores">💾 Save scores</button>');

    document.getElementById('ap-save-scores').onclick = async function () {
      var max = Number(document.getElementById('ap-max').value || 0) || null;
      var inputs = [].slice.call(document.querySelectorAll('.ap-score'));
      var saved = 0, failed = 0;
      for (var i = 0; i < inputs.length; i++) {
        var lid = inputs[i].dataset.lid;
        var rawVal = String(inputs[i].value).trim();
        if (rawVal === '') continue;
        var rec = {
          engagement_id: row.engagement_id, learner_id: lid, title: row.title,
          kind: row.kind || 'homework', mode: row.mode || 'digital',
          max_score: max, score: Number(rawVal), status: 'marked',
          due_on: row.due_on || null
        };
        var r = await window.sb.from('assignments').insert(rec);
        if (r.error) failed++; else saved++;
      }
      closeModal();
      toast('Saved ' + saved + ' score(s)' + (failed ? ' · ' + failed + ' refused' : '') + ' — the per-learner rows now feed the term score sheet.', failed ? 'warning' : 'success', 8000);
      if (window.CRUD) CRUD.refresh('assignments');
      renderSheet();
    };
  }

  /* ── 📋 Term score sheet / Σ totals ─────────────────────────────── */
  async function load(engagementId) {
    var a = await window.sb.from('assignments').select('*').eq('engagement_id', engagementId).limit(1000);
    if (a.error) throw new Error(a.error.message);
    var items = a.data || [];
    /* one column per distinct assignment (by title+kind; the class-wide row
       defines the column, per-learner rows supply the cells) */
    var cols = [];
    var seen = {};
    items.forEach(function (x) {
      var k = (x.title || '') + '|' + (x.kind || '');
      if (!seen[k]) { seen[k] = true; cols.push({ key: k, title: x.title, kind: x.kind || 'homework', max: Number(x.max_score) || 0, cbt_exam_id: x.cbt_exam_id || null }); }
    });
    var learners = await learnersOf(engagementId);

    /* CBT best attempts per exam per learner */
    var cbtBest = {};
    var examIds = cols.filter(function (c) { return c.cbt_exam_id; }).map(function (c) { return c.cbt_exam_id; });
    examIds = examIds.filter(function (x, i) { return examIds.indexOf(x) === i; });
    if (examIds.length) {
      var rr = await window.sb.from('cbt_results').select('exam_id,learner_id,score,max_score').in('exam_id', examIds).limit(5000);
      ((rr && rr.data) || []).forEach(function (x) {
        if (!x.learner_id) return;
        var pct = Number(x.max_score) ? Number(x.score) / Number(x.max_score) : 0;
        var k = x.exam_id + '|' + x.learner_id;
        if (!cbtBest[k] || pct > cbtBest[k].pct) cbtBest[k] = { pct: pct, score: Number(x.score) };
      });
    }

    /* per-learner rows by column key */
    var cell = {};
    items.forEach(function (x) {
      if (!x.learner_id) return;
      var k = (x.title || '') + '|' + (x.kind || '');
      var prev = cell[k + '|' + x.learner_id];
      if (!prev || Number(x.score) > Number(prev.score || 0)) cell[k + '|' + x.learner_id] = x;
    });

    var sheet = learners.map(function (l) {
      var got = 0, max = 0, cells = {};
      cols.forEach(function (c) {
        var v = null;
        var pr = cell[c.key + '|' + l.id];
        if (pr && pr.score != null) v = Number(pr.score);
        else if (c.cbt_exam_id && cbtBest[c.cbt_exam_id + '|' + l.id] && c.max) {
          v = Math.round(cbtBest[c.cbt_exam_id + '|' + l.id].pct * c.max * 10) / 10;
        }
        cells[c.key] = v;
        if (v != null) { got += v; max += c.max; }
      });
      return { id: l.id, name: l.name, cells: cells, got: got, max: max };
    });
    S.engagement = engagementId; S.items = cols; S.sheet = sheet;
    return S;
  }

  async function renderSheet(totalsOnly) {
    var box = document.getElementById('ap-out');
    if (!box) return;
    var eng = (document.getElementById('ap-class') || {}).value;
    if (!eng) { box.innerHTML = '<p class="muted">Pick the class first.</p>'; return; }
    var st;
    try { st = await load(eng); }
    catch (e) { box.innerHTML = '<p style="color:#b91c1c">' + esc(e.message) + '</p>'; return; }

    if (!st.items.length) {
      box.innerHTML = '<p class="muted">No assignments for this class yet — add one above, or publish a graded CBT to the class and it lands here automatically.</p>';
      return;
    }
    if (totalsOnly) {
      box.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Learner</th><th>Assignments scored</th><th>Points</th><th>%</th></tr></thead><tbody>' +
        st.sheet.map(function (r) {
          var n = Object.keys(r.cells).filter(function (k) { return r.cells[k] != null; }).length;
          return '<tr><td><b>' + esc(r.name) + '</b></td><td>' + n + '</td><td>' + r.got + ' / ' + r.max + '</td><td><b>' + (r.max ? Math.round(r.got / r.max * 1000) / 10 : 0) + '%</b></td></tr>';
        }).join('') + '</tbody></table></div>';
      return;
    }
    box.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Learner</th>' +
      st.items.map(function (c) {
        return '<th title="' + esc(c.title) + '">' + (c.kind === 'cbt' ? '🖥️' : '📄') + ' ' + esc(String(c.title).slice(0, 22)) + (c.max ? '<br><small>/' + c.max + '</small>' : '') + '</th>';
      }).join('') + '<th>Total</th><th>%</th></tr></thead><tbody>' +
      st.sheet.map(function (r) {
        return '<tr><td><b>' + esc(r.name) + '</b></td>' +
          st.items.map(function (c) {
            var v = r.cells[c.key];
            return '<td>' + (v == null ? '<span class="muted">—</span>' : v) + '</td>';
          }).join('') +
          '<td><b>' + r.got + ' / ' + r.max + '</b></td><td>' + (r.max ? Math.round(r.got / r.max * 1000) / 10 : 0) + '%</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="muted" style="font-size:.8rem;margin:6px 0 0">🖥️ CBT columns auto-fill from each learner\'s best CBT attempt (scaled to the column max). 📄 physical columns come from ✍️ Score class. Blank = not scored yet.</p>';
  }

  async function push() {
    var eng = (document.getElementById('ap-class') || {}).value;
    if (!eng || !S.sheet) { toast('Build the score sheet first (📋 Term score sheet).', 'warning'); return; }
    var withScores = S.sheet.filter(function (r) { return r.max > 0; });
    if (!withScores.length) { toast('No scored work to push yet.', 'warning'); return; }
    if (!confirm('Push cumulative homework points for ' + withScores.length + ' learner(s) into the scoresheet (source "homework_points")?')) return;
    var saved = 0, failed = 0;
    for (var i = 0; i < withScores.length; i++) {
      var r = withScores[i];
      var pct = r.max ? Math.round(r.got / r.max * 1000) / 10 : 0;
      var res = await window.sb.from('scoresheet').insert({
        learner_id: r.id, engagement_id: eng, source: 'homework_points',
        title: 'Homework points (cumulative)', score: r.got, max_score: r.max, pct: pct
      });
      if (res.error) failed++; else saved++;
    }
    toast('🚀 Pushed ' + saved + ' homework total(s) into the scoresheet' + (failed ? ' · ' + failed + ' failed' : '') + '.', failed ? 'warning' : 'success', 9000);
  }

  function csv() {
    if (!S.sheet) { toast('Build the score sheet first.', 'warning'); return; }
    var head = ['Learner'].concat(S.items.map(function (c) { return (c.kind === 'cbt' ? 'CBT: ' : 'Physical: ') + c.title + (c.max ? ' (/' + c.max + ')' : ''); })).concat(['Total got', 'Total max', 'Percent']);
    var lines = [head.map(function (h) { return '"' + String(h).replace(/"/g, '""') + '"'; }).join(',')];
    S.sheet.forEach(function (r) {
      var row = [r.name].concat(S.items.map(function (c) { return r.cells[c.key] == null ? '' : r.cells[c.key]; })).concat([r.got, r.max, r.max ? Math.round(r.got / r.max * 1000) / 10 : 0]);
      lines.push(row.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','));
    });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = 'homework-term-score-sheet.csv';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
  }

  async function fillClasses() {
    var sel = document.getElementById('ap-class');
    if (!sel || !window.sb) return;
    var maps = {};
    try {
      var r = await window.sb.rpc('tc_ref_labels', { p_table: 'engagements' });
      if (r.data && typeof r.data === 'object') maps = r.data;
    } catch (e) {}
    Object.keys(maps).sort(function (a, b) { return String(maps[a]).localeCompare(String(maps[b])); })
      .forEach(function (id) {
        var o = document.createElement('option');
        o.value = id; o.textContent = maps[id];
        sel.appendChild(o);
      });
  }

  return { scoreClass: scoreClass, renderSheet: renderSheet, push: push, csv: csv, fillClasses: fillClasses };
})();
