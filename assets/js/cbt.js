/* Tutoring Connect CBT — 17 types, multi-subject, review + PDF, student-ID login. No AI API. */
const CBT = {
  QUESTION_TYPES_17: ['mcq','multi_select','true_false','fill_blank','short_answer','essay','numeric','matching','ordering','drag_drop','hotspot','comprehension','case_study','image_based','audio_based','video_based','math_equation'],
  QUESTION_TYPES_PLUS: ['cloze','assertion_reason','error_spotting','data_interpretation','classification','likert','timeline','citation','graph_read','scenario_mcq','code_output','oral_prompt','peer_review','map_label','true_false_justify'],
  TYPE_LABEL: {
    mcq:'Multiple choice', multi_select:'Multi-select', true_false:'True / False',
    fill_blank:'Fill in the blank', short_answer:'Short answer', essay:'Essay',
    numeric:'Numeric', matching:'Matching', ordering:'Ordering', drag_drop:'Drag & drop',
    hotspot:'Hotspot', comprehension:'Comprehension', case_study:'Case study',
    image_based:'Image', audio_based:'Audio', video_based:'Video', math_equation:'Math equation',
    cloze:'Cloze / gap text', assertion_reason:'Assertion–Reason', error_spotting:'Error spotting',
    data_interpretation:'Data interpretation', classification:'Classification', likert:'Likert / scale',
    timeline:'Timeline', citation:'Citation / source', graph_read:'Graph / chart reading',
    scenario_mcq:'Scenario MCQ', code_output:'Code / output', oral_prompt:'Oral prompt (link a recording)',
    peer_review:'Peer review note', map_label:'Map / diagram label', true_false_justify:'True/False + justify'
  },
  allTypes() { return this.QUESTION_TYPES_17.concat(this.QUESTION_TYPES_PLUS); },
  _sb: null,
  init(sb) { this._sb = sb || window.sb || null; },

  normalizeQuestion(q, idx) {
    q = q || {};
    const canon = k => String(k||'').toLowerCase().replace(/[^a-z0-9]/g,'');
    const keyMap = Object.keys(q).reduce((m,k)=>{ m[canon(k)]=k; return m; }, {});
    const pick = (...names) => { for (const n of names) { const k = keyMap[canon(n)]; if (k != null && q[k] != null) return q[k]; } };
    /* ---------------------------------------------------------------
       BUG FIX 6 (reported): "the CSV we use to set a CBT in School
       Connect should also work in Tutoring Connect."

       The two products had drifted. School Connect's cbt-engine.js
       accepts a wider set of column spellings than Tutoring Connect's
       cbt.js did, so a CSV authored for School Connect imported here with
       blank options or a missing answer — silently, which is worse than
       failing. Every alias School Connect recognises is now recognised
       here as well, and this list is a strict SUPERSET of its own, so a
       file that works in either product works in both.
       --------------------------------------------------------------- */
    let type = String(pick('type','question_type','questionType') || 'mcq').toLowerCase().replace(/[\s/\\-]+/g,'_');
    if (['tf','boolean','truefalse','true_or_false','yes_no','yesno'].includes(type)) type = 'true_false';
    if (['multiplechoice','multiple_choice','single_choice','singlechoice','objective'].includes(type)) type = 'mcq';
    if (['mrq','multiple_response','multiple_responses','multiple_select','multiselect','checkbox','checkboxes'].includes(type)) type = 'multi_select';
    if (['number','integer','decimal','calculation'].includes(type)) type = 'numeric';
    if (['short','text','free_text'].includes(type)) type = 'short_answer';
    if (['math','equation','latex'].includes(type)) type = 'math_equation';
    /* ITEM 2 — HMG Academy CBT Pro type names. Their CSVs use these
       spellings; map each to the Tutoring Connect family that renders it. */
    if (type === 'multi_numeric')    type = 'multi_numeric';
    if (type === 'image_mcq')        type = 'image_based';
    if (type === 'hot_text')         type = 'hot_text';
    if (type === 'matrix')           type = 'matrix';
    if (type === 'categorization')   type = 'categorization';
    if (type === 'assertion_reason') type = 'assertion_reason';
    if (type === 'case_study')       type = 'case_study';
    if (type === 'cloze')            type = 'cloze';
    if (type === 'code')             type = 'code';
    let options = pick('options','choices','alternatives','answers') || [];
    if (typeof options === 'string') {
      try { const p = JSON.parse(options); if (Array.isArray(p)) options = p; }
      catch (_) { options = options.split(/[|;]/).map(s => s.trim()).filter(Boolean); }
    }
    if (!Array.isArray(options)) options = [];
    if (options.length && typeof options[0] === 'object') {
      options = options.map(o => (o && typeof o === 'object')
        ? (o.text != null ? o.text : (o.label != null ? o.label : (o.value != null ? o.value : JSON.stringify(o))))
        : String(o));
    }
    if (!options.length) {
      // Every spelling School Connect accepts, plus the spreadsheet ones.
      [['a','option_a','opt_a','choice_a','option1','optiona'],
       ['b','option_b','opt_b','choice_b','option2','optionb'],
       ['c','option_c','opt_c','choice_c','option3','optionc'],
       ['d','option_d','opt_d','choice_d','option4','optiond'],
       ['e','option_e','opt_e','choice_e','option5','optione'],
       ['f','option_f','opt_f','choice_f','option6','optionf']
      ].forEach(keys => {
        const v = pick.apply(null, keys);
        if (v != null && String(v).trim() !== '') options.push(String(v));
      });
    }
    if (type === 'true_false') options = ['True','False'];
    let answer = pick('answer','correct','correct_answer','correctAnswer','correct answer',
                      'answer_key','answerKey','key','correct_option','correctOption',
                      'correctletter','correct_letter','ans','solution_key');
    /* A CSV may give the answer as a LETTER (A/B/C/D) rather than the text.
       School Connect resolves that at grading time; resolving it here means
       the same file grades identically in both products. */
    if (typeof answer === 'string' && options.length) {
      const letter = answer.trim().toUpperCase();
      if (/^[A-F]$/.test(letter)) {
        const at = letter.charCodeAt(0) - 65;
        if (options[at] != null) answer = String(options[at]);
      }
    }
    if (type === 'multi_select' && typeof answer === 'string') answer = answer.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
    return {
      id: pick('id') || ('q'+(idx+1)),
      _orig_index: idx,
      type,
      subject: pick('subject','section','subject_section','exam_subject') || '',
      section: pick('section','subject_section','subject','exam_subject') || '',
      question: pick('question','prompt','text','question_text','questionText') || '',
      passage: pick('passage','context','case_text','comprehension') || '',
      difficulty: pick('difficulty','level') || '',
      accepted_answers: pick('accept','accepted_answers','alternatives','alternates') || '',
      options,
      answer, correct: answer,
      mark: Number(pick('mark','marks','score','points') || 1) || 1,
      explanation: pick('explanation','reason','solution') || '',
      media_url: pick('media_url','image','audio_url','video_url','image_url') || '',
      tolerance: pick('tolerance','margin') || '',
      /* -----------------------------------------------------------------
         ITEM 2 — the HMG Academy CBT Pro / School Connect column set.
         Their template header is:
           Question,A,B,C,D,CorrectAnswer,Explanation,Type,Tolerance,Unit,
           Accept,MRQ_AON,Pairs,Items,Difficulty,Tags,Section
         Tutoring Connect previously read none of Unit, Accept, MRQ_AON,
         Pairs or Items, so a matching, ordering, cloze, matrix, hot-text,
         categorization, multi-part numeric, assertion-reason, case-study
         or code question imported as an empty shell. They are all read
         now, and JSON in a cell is parsed rather than kept as a string.
         ----------------------------------------------------------------- */
      unit: pick('unit','units','si_unit') || '',
      pairs: (function () {
        var v = pick('pairs', 'matches');
        if (!v) return null;
        if (typeof v === 'object') return v;
        try { return JSON.parse(String(v)); } catch (e) { return String(v).split(/\s*[|;]\s*/).filter(Boolean); }
      })(),
      items: (function () {
        var v = pick('items', 'rows', 'parts', 'chunks', 'blanks', 'sequence');
        if (!v) return null;
        if (typeof v === 'object') return v;
        try { return JSON.parse(String(v)); } catch (e) { return String(v).split(/\s*[|;]\s*/).filter(Boolean); }
      })(),
      all_or_nothing: (function () {
        var v = pick('mrq_aon', 'all_or_nothing', 'aon');
        return String(v == null ? '' : v).toLowerCase() === 'true' || v === true || v === 1;
      })(),
      difficulty2: pick('difficulty','level') || '',
      tags: pick('tags','topic_tags') || '',
      /* NOTE: `pairs` and `items` are parsed above (JSON-aware). The old
         raw-string version that used to sit here was a DUPLICATE KEY and,
         being later in the object literal, silently overwrote the parsed
         value — which is why matching questions imported with their pairs
         still a string. Removed. */
    };
  },

  parseCSV(text) {
    /* Join rows that were split by a newline INSIDE a quoted field — an
       essay prompt or a case-study passage very often contains one. */
    const raw = String(text || '').replace(/^\uFEFF/, '').trim().split(/\r?\n/);
    const lines = [];
    let buf = '';
    raw.forEach(function (ln) {
      buf = buf ? (buf + '\n' + ln) : ln;
      const quotes = (buf.match(/"/g) || []).length;
      if (quotes % 2 === 0) { lines.push(buf); buf = ''; }
    });
    if (buf) lines.push(buf);
    if (lines.length < 2) return [];
    const headers = this._splitCsv(lines[0]).map(h => h.trim().toLowerCase());
    return lines.slice(1).map((line, i) => {
      const cols = this._splitCsv(line);
      const row = {};
      headers.forEach((h, idx) => row[h] = (cols[idx] || '').trim());
      row.options = [row.a, row.b, row.c, row.d, row.e].filter(Boolean);
      return this.normalizeQuestion(row, i);
    });
  },
  /* -----------------------------------------------------------------------
     CSV FIELD SPLITTER — corrected V21.

     The previous version treated ANY "" as an escaped double quote:

         if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; }

     But "" is an escaped quote only INSIDE a quoted field. At the start of
     a field it means the field is EMPTY. So `"a","","b"` decoded its middle
     column as a literal `"` character instead of an empty string.

     That corrupted essentially every real import, because the HMG Academy
     and School Connect templates are fully quoted and most rows leave
     Tolerance, Unit, Accept, MRQ_AON, Pairs and Items blank — every one of
     those arrived as `"`. It is why a numeric question imported with
     unit `"` and tolerance `"`.

     This is the standard RFC 4180 state machine: a doubled quote is an
     escaped quote only while the parser is inside a quoted field.
     ----------------------------------------------------------------------- */
  _splitCsv(line) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') { cur += '"'; i++; }   // escaped quote
        else q = !q;                                          // open or close
      } else if (ch === ',' && !q) {
        out.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur); return out;
  },

  eq(a, b) {
    const na = String(a == null ? '' : a).trim().toLowerCase();
    const nb = String(b == null ? '' : b).trim().toLowerCase();
    return na === nb;
  },
  setEq(a, b) {
    const A = (Array.isArray(a) ? a : String(a||'').split(/[,;|]/)).map(s => String(s).trim().toLowerCase()).filter(Boolean).sort();
    const B = (Array.isArray(b) ? b : String(b||'').split(/[,;|]/)).map(s => String(s).trim().toLowerCase()).filter(Boolean).sort();
    return A.length === B.length && A.every((v,i) => v === B[i]);
  },
  numEq(a, b, tol) {
    const x = Number(a), y = Number(b), t = Number(tol || 0);
    if (isNaN(x) || isNaN(y)) return this.eq(a,b);
    return Math.abs(x - y) <= t;
  },

  gradeOne(q, given) {
    const type = q.type;
    /* V21 — partial credit. CBTTypes.grade knows how to award part marks
       for ordering, matching, matrix, categorization, multi-part numeric,
       cloze and hot-text, and marks essays and code transparently by
       keyword and word count (no AI). It returns a richer object; map it
       onto the shape the rest of this file already expects. */
    if (window.CBTTypes && CBTTypes.supports(type)) {
      try {
        const r = CBTTypes.grade(q, given);
        return { ok: r.pending ? null : r.correct, mark: r.earned,
                 pending: !!r.pending, detail: r.detail, partial: r.earned > 0 && !r.correct };
      } catch (e) { /* fall through to the original grader */ }
    }
    if (['essay','case_study','oral_prompt','peer_review','true_false_justify','citation'].includes(type)) return { ok: null, mark: 0, pending: true };
    let ok = false;
    if (type === 'multi_select') ok = this.setEq(given, q.answer);
    else if (type === 'numeric' || type === 'math_equation') ok = this.numEq(given, q.answer, q.tolerance);
    else if (type === 'matching' || type === 'ordering' || type === 'drag_drop') ok = this.setEq(given, q.answer) || this.eq(given, q.answer);
    else ok = this.eq(given, q.answer);
    return { ok, mark: ok ? q.mark : 0, pending: false };
  },

  grade(questions, answers) {
    let got = 0, max = 0, correct = 0, pending = 0;
    const detail = questions.map((q, i) => {
      max += q.mark;
      const g = answers[q.id] ?? answers[i];
      const r = this.gradeOne(q, g);
      if (r.pending) pending += 1;
      else { got += r.mark; if (r.ok) correct += 1; }
      return { id: q.id, type: q.type, subject: q.subject, question: q.question, given: g, correct: q.answer, explanation: q.explanation, ok: r.ok, mark: r.mark, max: q.mark, pending: r.pending, options: q.options, passage: q.passage, media_url: q.media_url };
    });
    const subjects = {};
    detail.forEach(d => {
      const s = d.subject || 'General';
      subjects[s] = subjects[s] || { score: 0, total: 0, correct: 0 };
      subjects[s].total += d.max;
      subjects[s].score += d.mark;
      if (d.ok) subjects[s].correct += 1;
    });
    return { got, max, pct: max ? Math.round(got / max * 1000) / 10 : 0, correct, pending, detail, subject_scores: subjects };
  },

  renderQuestion(q, i, locked) {
    const name = 'q_' + q.id;
    const wrap = (inner) => `<article class="card cbt-q" data-qid="${q.id}" style="margin-bottom:12px">
      <div class="muted" style="font-size:.75rem;text-transform:uppercase">${i+1} · ${this.TYPE_LABEL[q.type]||q.type}${q.subject?' · '+q.subject:''} · ${q.mark} mark(s)</div>
      ${q.passage ? `<blockquote style="border-left:3px solid var(--accent);padding-left:10px;margin:8px 0">${TC.esc(q.passage)}</blockquote>` : ''}
      <p style="font-weight:700;margin:8px 0">${TC.esc(q.question)}</p>
      ${q.media_url ? this._media(q) : ''}
      ${inner}
    </article>`;
    const dis = locked ? 'disabled' : '';

    /* -------------------------------------------------------------------
       V21 — advanced question-type UI.
       assets/js/cbt-types.js renders a purpose-built control for each of
       the seventeen families (matching tables, drag-to-order lists,
       category and matrix grids, hot-text chips, inline cloze blanks,
       assertion/reason blocks, passages, figures, word-counted essays).
       Before this, most types fell through to a bare textarea, so a
       matching question looked exactly like a short-answer one.

       Delegation is deliberately FIRST and deliberately guarded: if
       cbt-types.js is absent, or does not handle a type, the original
       renderer below still runs, so no existing paper changes behaviour.
       ------------------------------------------------------------------- */
    if (window.CBTTypes && CBTTypes.supports(q.type)) {
      const adv = CBTTypes.render(q, name);
      if (adv) {
        const html = wrap(adv);
        // Controls that need JavaScript are wired after the card is in the DOM.
        setTimeout(function () { try { CBTTypes.activate(document); } catch (e) {} }, 0);
        return locked ? html.replace(/<(input|select|textarea|button)/g, '<$1 disabled') : html;
      }
    }

    if (['mcq','true_false','image_based'].includes(q.type)) {
      return wrap((q.options||[]).map((o,oi) => `<label style="display:block;padding:6px 0"><input type="radio" name="${name}" value="${TC.esc(o)}" ${dis}> ${TC.esc(o)}</label>`).join(''));
    }
    if (q.type === 'multi_select') {
      return wrap((q.options||[]).map(o => `<label style="display:block;padding:6px 0"><input type="checkbox" name="${name}" value="${TC.esc(o)}" ${dis}> ${TC.esc(o)}</label>`).join(''));
    }
    if (['essay','case_study','comprehension','oral_prompt','peer_review','citation','true_false_justify','cloze','error_spotting','data_interpretation','graph_read'].includes(q.type)) {
      return wrap(`${q.media_url && window.Media ? Media.card(q.media_url, 'Stimulus') : ''}
        <textarea class="form-textarea" name="${name}" ${dis} rows="5" placeholder="Your answer"></textarea>`);
    }
    if (q.type === 'likert') {
      return wrap([1,2,3,4,5].map(n => `<label style="margin-right:10px"><input type="radio" name="${name}" value="${n}" ${dis}> ${n}</label>`).join(''));
    }
    if (q.type === 'assertion_reason' || q.type === 'scenario_mcq' || q.type === 'classification') {
      return wrap((q.options||['A','B','C','D']).map(o => `<label style="display:block;padding:6px 0"><input type="radio" name="${name}" value="${TC.esc(o)}" ${dis}> ${TC.esc(o)}</label>`).join(''));
    }
    if (q.type === 'audio_based') {
      return wrap(`${q.media_url?`<audio controls src="${TC.esc(q.media_url)}"></audio>`:''}<input class="form-input" name="${name}" ${dis} placeholder="Your answer">`);
    }
    if (q.type === 'video_based') {
      return wrap(`${q.media_url?`<video controls src="${TC.esc(q.media_url)}" style="max-width:100%"></video>`:''}<input class="form-input" name="${name}" ${dis} placeholder="Your answer">`);
    }
    if (q.type === 'ordering' || q.type === 'drag_drop') {
      return wrap(`<p class="muted">Type the items in the correct order, separated by commas.</p>
        <div class="muted">${(q.options||[]).map(o=>TC.esc(o)).join(' · ')}</div>
        <input class="form-input" name="${name}" ${dis} placeholder="first, second, third">`);
    }
    if (q.type === 'matching') {
      return wrap(`<p class="muted">Write pairs as left=right, separated by commas.</p>
        <input class="form-input" name="${name}" ${dis} placeholder="A=1, B=2">`);
    }
    if (q.type === 'hotspot') {
      return wrap(`<p class="muted">Describe the region / coordinates you select.</p><input class="form-input" name="${name}" ${dis}>`);
    }
    return wrap(`<input class="form-input" name="${name}" ${dis} placeholder="Your answer">`);
  },
  _media(q) {
    const u = q.media_url;
    if (q.type === 'audio_based' || /\.(mp3|wav|ogg)$/i.test(u)) return `<audio controls src="${TC.esc(u)}"></audio>`;
    if (q.type === 'video_based' || /\.(mp4|webm)$/i.test(u)) return `<video controls src="${TC.esc(u)}" style="max-width:100%"></video>`;
    return `<img src="${TC.esc(u)}" alt="" style="max-width:100%;border-radius:8px;margin:8px 0">`;
  },

  collectAnswers(root) {
    const answers = {};
    root.querySelectorAll('.cbt-q').forEach(card => {
      const id = card.dataset.qid;
      /* V21 — the advanced controls store their answer in shapes the old
         reader cannot see: a hidden JSON input for ordering and hot-text,
         and one indexed field per row for matching, categorization,
         matrix, multi-part numeric and cloze. Ask CBTTypes first. */
      if (window.CBTTypes && card._q && CBTTypes.supports(card._q.type)) {
        answers[id] = CBTTypes.collect(card._q, 'q_' + id, card);
        return;
      }
      const idxFields = card.querySelectorAll('[name^="q_' + id + '__"]');
      if (idxFields.length) {
        const out = [];
        idxFields.forEach(el => {
          if (el.type === 'radio' && !el.checked) return;
          out[Number(el.name.split('__').pop())] = el.value;
        });
        answers[id] = out;
        return;
      }
      const hidden = card.querySelector('input[type=hidden][name="q_' + id + '"]');
      if (hidden && hidden.value) {
        try { answers[id] = JSON.parse(hidden.value); return; } catch (e) { /* fall through */ }
      }
      const radios = card.querySelectorAll('input[type=radio]:checked');
      const checks = [...card.querySelectorAll('input[type=checkbox]:checked')].map(c => c.value);
      const ta = card.querySelector('textarea');
      const inp = card.querySelector('input.form-input, input[type=text]');
      if (checks.length) answers[id] = checks;
      else if (radios.length) answers[id] = radios[0].value;
      else if (ta) answers[id] = ta.value;
      else if (inp) answers[id] = inp.value;
      else answers[id] = '';
    });
    return answers;
  },

  reviewHTML(result, meta) {
    meta = meta || {};
    const rows = result.detail.map((d, i) => {
      const tone = d.pending ? '#fef3c7' : d.ok ? '#d1fae5' : '#fee2e2';
      const label = d.pending ? 'Awaiting tutor' : d.ok ? 'Correct' : 'Incorrect';
      return `<section style="border:1px solid #e4ddd2;border-radius:12px;padding:12px;margin:10px 0;background:${tone}">
        <div style="font-size:.75rem;text-transform:uppercase">${i+1} · ${label} · ${d.mark}/${d.max}${d.subject?' · '+TC.esc(d.subject):''}</div>
        <p style="font-weight:700">${TC.esc(d.question)}</p>
        <p><b>Your answer:</b> ${TC.esc(Array.isArray(d.given)?d.given.join(', '):d.given)}</p>
        <p><b>Correct answer:</b> ${TC.esc(Array.isArray(d.correct)?d.correct.join(', '):d.correct)}</p>
        ${d.explanation ? `<p><b>Why:</b> ${TC.esc(d.explanation)}</p>` : ''}
      </section>`;
    }).join('');
    const subj = Object.keys(result.subject_scores||{}).length > 1
      ? '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin:12px 0">' +
        Object.entries(result.subject_scores).map(([n,s]) => `<div class="stat-card"><div class="stat-value">${s.total?Math.round(s.score/s.total*100):0}%</div><div class="stat-label">${TC.esc(n)}</div></div>`).join('') + '</div>'
      : '';
    return `<div id="cbt-review-print">
      <h2>${TC.esc(meta.title || 'Practice review')}</h2>
      <p>${TC.esc(meta.student_no || '')} · ${TC.esc(meta.full_name || '')} · ${TC.esc(meta.quiz_kind || '')}</p>
      <div class="grid grid-4">
        <div class="stat-card"><div class="stat-value">${result.pct}%</div><div class="stat-label">Score</div></div>
        <div class="stat-card"><div class="stat-value">${result.got}/${result.max}</div><div class="stat-label">Marks</div></div>
        <div class="stat-card"><div class="stat-value">${result.correct}</div><div class="stat-label">Correct</div></div>
        <div class="stat-card"><div class="stat-value">${result.pending}</div><div class="stat-label">Pending</div></div>
      </div>
      ${subj}
      ${rows}
      <p class="muted">Saved ${new Date().toLocaleString()}. Print this page to keep a PDF study copy.</p>
    </div>`;
  },

  printReview() {
    const node = document.getElementById('cbt-review-print');
    if (!node) { window.print(); return; }
    const w = window.open('', '_blank');
    w.document.write(`<!doctype html><title>Quiz review</title>
      <style>body{font-family:system-ui;padding:24px;color:#14201f} h2{font-family:Georgia}</style>
      ${node.outerHTML}
      <script>onload=()=>{print();}</script>`);
    w.document.close();
  },

  groupBySubject(questions) {
    const map = {};
    questions.forEach(q => {
      const s = q.subject || 'General';
      (map[s] = map[s] || []).push(q);
    });
    return map;
  },

  async lookupStudent(studentNo) {
    if (!this._sb) return null;
    const { data, error } = await this._sb.rpc('tc_lookup_learner_by_student_no', { p_no: studentNo });
    if (error) throw error;
    return data;
  },


  /* ==========================================================================
     CSV round-tripping (V14) — items 8 & 12.
     parseCSV already existed; these two complete the loop so a tutor can
     DOWNLOAD a template, fill it in a spreadsheet, upload it back, and later
     export an existing paper to edit it offline. The shape is deliberately the
     same one School Connect emits, so CSVs move between the two products
     unchanged.
     ========================================================================== */
  /* ITEM 2 — the template now emits the FULL HMG / School Connect column
     set, so a file downloaded here imports there and vice versa. */
  CSV_HEADERS: ['question','type','subject','a','b','c','d','answer','mark','explanation',
                'passage','media_url','tolerance','unit','accept','mrq_aon','pairs','items',
                'difficulty','tags','section'],
  CSV_HEADERS_HMG: ['Question','A','B','C','D','CorrectAnswer','Explanation','Type','Tolerance',
                    'Unit','Accept','MRQ_AON','Pairs','Items','Difficulty','Tags','Section'],

  _csvCell: function (v) {
    var s = (v == null) ? '' : String(v);
    if (Array.isArray(v)) s = v.join('|');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  },

  /** Export normalised questions back to the canonical CSV. */
  toCSV: function (questions) {
    var self = this;
    var rows = [this.CSV_HEADERS.join(',')];
    (questions || []).forEach(function (q) {
      var o = q.options || [];
      rows.push([
        q.question, q.type, q.subject || '',
        o[0] || '', o[1] || '', o[2] || '', o[3] || '',
        Array.isArray(q.answer) ? q.answer.join('|') : (q.answer == null ? '' : q.answer),
        q.mark == null ? 1 : q.mark,
        q.explanation || '', q.passage || '', q.media_url || '',
        q.tolerance == null ? '' : q.tolerance
      ].map(self._csvCell).join(','));
    });
    return rows.join('\n');
  },

  /** A filled-in example template — one row per common question type, so the
      tutor can see the exact shape rather than guess from headers alone. */
  templateCSV: function () {
    var ex = [
      ['Solve for x: 2x + 5 = 13','mcq','Mathematics','x = 3','x = 4','x = 5','x = 6','x = 4','1','Subtract 5 then divide by 2.','','',''],
      ['Water boils at 100 degrees Celsius at sea level.','true_false','Physics','True','False','','','True','1','At 1 atmosphere.','','',''],
      ['The capital of Nigeria is ______.','fill_blank','Geography','','','','','Abuja','1','Moved from Lagos in 1991.','','',''],
      ['Calculate the area of a circle of radius 7cm. Use pi = 22/7.','numeric','Mathematics','','','','','154','2','A = pi r squared.','','','0.5'],
      ['Select ALL prime numbers.','multi_select','Mathematics','2','9','11','15','2|11','2','1 is not prime.','','',''],
      ['Read the passage, then explain the author\u2019s main argument.','comprehension','English','','','','','','5','Look for the thesis in the opening paragraph.','Paste the passage text in this column.','',''],
      ['Watch the clip and state the reaction observed at 2:14.','video_based','Chemistry','','','','','Effervescence','2','Carbon dioxide is released.','','https://youtu.be/EXAMPLE','']
    ];
    var self = this;
    return [this.CSV_HEADERS.join(',')]
      .concat(ex.map(function (r) { return r.map(self._csvCell).join(','); }))
      .join('\n');
  },

  /* =======================================================================
     promptPack — V21 REWRITE, modelled on HMG Academy CBT Pro's
     PROMPT_TEMPLATE.md.

     What their template does better, now adopted here:
       1. An explicit QUESTION TYPE DISTRIBUTION summing to the requested
          count. Without one, a model returns sixty MCQs and calls it varied.
       2. PER-TYPE COLUMN RULES, by column number, for every type. This is
          the part that makes output importable rather than merely plausible.
       3. The FULL 17-column header, so structured types survive the trip.
       4. Worked JSON shapes for the Pairs and Items columns.
       5. An explicit instruction to escape inner JSON quotes as "".

     Kept from before: the examiner persona, the quality bar, the studio and
     exam context, links-only, and the demand for a DOWNLOADABLE .csv file.
     ======================================================================= */
  promptPack(level, topic, count, klass, extra) {
    extra = extra || {};
    const studio = (window.PRACTICE && window.PRACTICE.name) || 'this tutoring studio';
    const subject = extra.subject || '[SUBJECT]';
    const examType = extra.examType || extra.board || 'general classwork';
    const n = Number(count) || 20;
    const fname = (topic || 'questions').toString().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'questions';

    /* Scale a 60-question reference mix to the requested count, then push the
       rounding remainder onto MCQ. This is why it always sums exactly to n. */
    const base = { mcq: 14, tf: 6, mrq: 6, short: 6, numeric: 6, matching: 4,
                   ordering: 4, cloze: 4, categorization: 2, multi_numeric: 2,
                   essay: 1, assertion_reason: 2, case_study: 2, matrix: 1, hot_text: 1 };
    const baseTotal = Object.keys(base).reduce(function (a, k) { return a + base[k]; }, 0);
    const mix = {}; let running = 0;
    Object.keys(base).forEach(function (k) {
      const v = Math.floor(base[k] * n / baseTotal);
      if (v > 0) { mix[k] = v; running += v; }
    });
    mix.mcq = (mix.mcq || 0) + Math.max(0, n - running);

    /* -------------------------------------------------------------------
       THE 18 PROMPT PACKS — restored and kept.
       `level` doubles as a pack id. The V21 rewrite initially ignored it,
       which silently dropped mcq_only, exam_board, reading_*, multi_subject
       and the rest. They are pre-existing features and must not be lost, so
       each pack now RESHAPES the distribution and APPENDS its own briefing
       on top of the new, richer base contract rather than replacing it.
       ------------------------------------------------------------------- */
    const pack = String(level || '').toLowerCase();
    const only = function (type) {
      Object.keys(mix).forEach(function (k) { delete mix[k]; });
      mix[type] = n;
    };
    let addendum = '';

    if (pack === 'mcq_only') {
      only('mcq');
      addendum = '\n\nMCQ-ONLY PACK — STRICT\n' +
        'Every single one of the ' + n + ' items must be type "mcq" with exactly four\n' +
        'options. Do not emit any other type under any circumstances. Each distractor\n' +
        'must correspond to a specific, nameable error a learner makes.';
    } else if (pack === 'exam_board') {
      addendum = '\n\nEXAM-BOARD PACK — ' + (extra.board || examType) + '\n' +
        'Mirror the house style of ' + (extra.board || examType) + ': its command words, its\n' +
        'mark allocations, its phrasing conventions and its typical stem length. A\n' +
        'candidate should not be able to tell these from real past questions.';
    } else if (pack === 'reading_video') {
      addendum = '\n\nREADING PACK — VIDEO SOURCE\n' +
        'Base every item on this video: ' + (extra.source || '[VIDEO LINK]') + '\n' +
        'Questions must be answerable ONLY by someone who watched it. Where a specific\n' +
        'moment matters, cite the timestamp in the Explanation column.';
    } else if (pack === 'reading_article') {
      addendum = '\n\nREADING PACK — ARTICLE / TEXT SOURCE\n' +
        'Base every item on this material: ' + (extra.source || '[MATERIAL LINK]') + '\n' +
        'Test comprehension, inference and vocabulary in context — not recall of facts\n' +
        'the learner could already know without reading it.';
    } else if (pack === 'reading_pack') {
      addendum = '\n\nREADING PACK — COMPREHENSION SET\n' +
        'Source: ' + (extra.source || '[SOURCE LINK]') + '\n' +
        'Weight the paper towards case_study items that share one passage, then a few\n' +
        'short-answer items on vocabulary in context.';
    } else if (pack === 'multi_subject') {
      addendum = '\n\nMULTI-SUBJECT PACK\n' +
        'Cover these subjects: ' + (extra.subjects || subject) + '\n' +
        'Divide the ' + n + ' items as evenly as possible between them and put the subject\n' +
        'name in Col17 (Section) on every row — that column drives the subject tabs the\n' +
        'candidate sees, so it must be exact and consistent.';
    } else if (pack === 'differentiated') {
      addendum = '\n\nDIFFERENTIATED PACK\n' +
        'Produce three visible tiers: one third foundation, one third core, one third\n' +
        'stretch. Put "easy", "moderate" or "demanding" in Col15 on every row so the\n' +
        'tutor can filter by tier.';
    } else if (pack === 'misconception') {
      addendum = '\n\nMISCONCEPTION-HUNTING PACK\n' +
        'Every distractor must be a REAL misconception, and the Explanation must name it\n' +
        'explicitly ("chose B because they added the indices instead of multiplying").\n' +
        'This paper exists to diagnose, not merely to score.';
    } else if (pack === 'past_paper') {
      addendum = '\n\nPAST-PAPER STYLE PACK\n' +
        'Write in the register of a real ' + (extra.board || examType) + ' paper: same command\n' +
        'words, same mark weighting, same ordering from accessible to demanding.';
    } else if (pack === 'marking_scheme') {
      addendum = '\n\nMARKING-SCHEME PACK\n' +
        'The Explanation column must read as a marking scheme: the acceptable answers,\n' +
        'where each mark is earned, and what earns no credit. Populate Col11 (Accept)\n' +
        'generously so alternative correct wordings are not marked wrong.';
    } else if (pack === 'oral_practice') {
      addendum = '\n\nORAL-PRACTICE PACK\n' +
        'Favour essay and short items that a learner answers aloud, then records. Media\n' +
        'must be a LINK (Drive or YouTube) — never an upload. State in the Explanation\n' +
        'what a strong spoken answer contains.';
    } else if (pack === 'self') {
      addendum = '\n\nSELF-QUIZ PACK\n' +
        'This is practice, not assessment. Explanations must be generous and teach the\n' +
        'idea from first principles, because the learner meets them immediately.';
    } else if (pack === 'review') {
      addendum = '\n\nREVIEW-QUIZ PACK\n' +
        'Sat straight after a lesson to find gaps. Spread items evenly across everything\n' +
        'taught, and make each Explanation say which sub-topic to revisit.';
    } else if (pack === 'graded') {
      addendum = '\n\nGRADED-QUIZ PACK\n' +
        'This counts and is pushed to the scoresheet. Be exhaustive, unambiguous and\n' +
        'defensible: every key must survive a parent querying the mark.';
    } else if (pack === 'simple') {
      addendum = '\n\nSIMPLE PACK\nKeep language plain and stems short. Favour mcq and tf.';
    } else if (pack === 'intermediate') {
      addendum = '\n\nINTERMEDIATE PACK\nMix recall with application. Include some numeric and short items.';
    } else if (pack === 'advanced') {
      addendum = '\n\nADVANCED PACK\n' +
        'Favour multi-step reasoning: multi_numeric, assertion_reason, case_study and\n' +
        'matrix items should dominate.';
    } else if (pack === 'enterprise') {
      addendum = '\n\nENTERPRISE PACK\n' +
        'Use the FULL range of seventeen types, including matching, ordering, cloze,\n' +
        'categorization, matrix, hot_text and code. This is the showcase paper.';
    }

    const distribution = Object.keys(mix).map(function (k) { return k + '=' + mix[k]; }).join(', ');

    return 'ROLE\n' +
'You are a veteran Chief Examiner and question-bank author with 20+ years setting\n' +
examType + ' papers in ' + subject + '. You write for ' + studio + ', a tutoring studio\n' +
'serving Nigerian and international learners.\n\n' +
'TASK\n' +
'Produce EXACTLY ' + n + ' assessment items on "' + topic + '" for a ' +
(klass || level || 'tutoring learner') + '\nsitting ' + examType + ' in ' + subject + '.\n\n' +
'===================================================================\n' +
'OUTPUT CONTRACT - READ THIS TWICE. IT IS THE MOST IMPORTANT PART.\n' +
'===================================================================\n\n' +
'0. OUTPUT A DOWNLOADABLE .CSV FILE - NOT RAW CSV TEXT.\n' +
'   Produce a real, clickable file attachment named "' + fname + '.csv" that the\n' +
'   tutor can download and import directly. Use whatever file-generating\n' +
'   capability you have. The tutor must end up with a .csv FILE, without\n' +
'   copying or pasting anything.\n' +
'   Only if you genuinely cannot emit a file, say so in ONE short line, then\n' +
'   output a single raw CSV code block instead.\n\n' +
'1. The file contains the CSV and nothing else - no preamble, no commentary,\n' +
'   no markdown table, no notes afterwards.\n\n' +
'2. The FIRST line must be exactly this header, character for character:\n' +
'Question,A,B,C,D,CorrectAnswer,Explanation,Type,Tolerance,Unit,Accept,MRQ_AON,Pairs,Items,Difficulty,Tags,Section\n\n' +
'3. Then EXACTLY ' + n + ' data rows - one item per row.\n\n' +
'4. Wrap EVERY field in double quotes. Escape any inner double quote by\n' +
'   doubling it (""). This is what lets JSON live inside a CSV cell and still\n' +
'   open cleanly in Excel, Google Sheets and LibreOffice.\n\n' +
'5. Use correct UTF-8 for scientific notation: H2O as H\u2082O, CO\u2082, \u03c0, \u03a9, \u2264, \u2265, \u00b0C.\n\n' +
'6. "Section" must be exactly: ' + subject + '\n\n' +
'7. Never leave "CorrectAnswer" empty on an objective item.\n\n' +
'8. Any media must be a public https, Google Drive or YouTube LINK. This\n' +
'   platform NEVER accepts file uploads - links only.\n\n' +
'===================================================================\n' +
'QUESTION TYPE DISTRIBUTION - MUST SUM TO EXACTLY ' + n + '\n' +
'===================================================================\n' +
distribution + '\n\n' +
'===================================================================\n' +
'PER-TYPE COLUMN RULES\n' +
'Columns: 1 Question | 2 A | 3 B | 4 C | 5 D | 6 CorrectAnswer |\n' +
'7 Explanation | 8 Type | 9 Tolerance | 10 Unit | 11 Accept |\n' +
'12 MRQ_AON | 13 Pairs | 14 Items | 15 Difficulty | 16 Tags | 17 Section\n' +
'===================================================================\n\n' +
'mcq - one correct option\n' +
'  Col2-5: four plausible options. Col6: the ANSWER TEXT or the letter A/B/C/D.\n' +
'  Col8: mcq\n\n' +
'tf - true/false\n' +
'  Col2: True   Col3: False   Col4-5: blank\n' +
'  Col6: True or False. Col8: tf\n\n' +
'mrq - several correct options\n' +
'  Col2-5: options. Col6: correct options separated by | (e.g. Iron|Copper).\n' +
'  Col12: true for all-or-nothing marking, false for partial credit.\n' +
'  Col8: mrq\n\n' +
'short - typed short answer\n' +
'  Col6: the primary answer.\n' +
'  Col11: accepted alternatives separated by | (e.g. H\u2082O|water|h2o).\n' +
'  Col8: short\n\n' +
'numeric - a number\n' +
'  Col6: the number only. Col9: tolerance (0, 0.05, 0.5). Col10: unit.\n' +
'  Col8: numeric\n\n' +
'multi_numeric - several numeric sub-parts, part marks\n' +
'  Col14: [{"label":"x","answer":3,"tolerance":0},{"label":"y","answer":2,"tolerance":0}]\n' +
'  Col8: multi_numeric\n\n' +
'matching - pair left with right\n' +
'  Col13: [{"left":"Na","right":"Sodium"},{"left":"K","right":"Potassium"}]\n' +
'  Col11 may add distractors separated by | to make it harder.\n' +
'  Col8: matching\n\n' +
'ordering - arrange in sequence\n' +
'  Col14: the items IN THE CORRECT ORDER, e.g. ["Mercury","Venus","Earth"]\n' +
'  Col8: ordering\n\n' +
'cloze - fill several blanks\n' +
'  Col1: the sentence, each blank written as ___ (three underscores).\n' +
'  Col14: accepted answers per blank in order, alternatives with |,\n' +
'         e.g. ["mass|m","acceleration|a"]\n' +
'  Col8: cloze\n\n' +
'categorization - sort items into groups\n' +
'  Col14: [{"item":"Sodium","category":"Metal"},{"item":"Oxygen","category":"Non-metal"}]\n' +
'  Col8: categorization\n\n' +
'matrix - several rows sharing one set of options\n' +
'  Col11: the shared options separated by |, e.g. True|False\n' +
'  Col14: [{"statement":"Water boils at 100 C at sea level","answer":"True"}]\n' +
'  Col8: matrix\n\n' +
'hot_text - tap the correct parts\n' +
'  Col14: [{"text":"2","correct":true},{"text":"4","correct":false},{"text":"5","correct":true}]\n' +
'  Col8: hot_text\n\n' +
'assertion_reason - WAEC/JAMB/Cambridge logic item\n' +
'  Col14: {"assertion":"Metals conduct electricity","reason":"Metals have free electrons"}\n' +
'  Col6: A, B, C, D or E, where\n' +
'        A = both true and the Reason explains the Assertion\n' +
'        B = both true but the Reason does not explain it\n' +
'        C = Assertion true, Reason false\n' +
'        D = Assertion false, Reason true\n' +
'        E = both false\n' +
'  Col8: assertion_reason\n\n' +
'case_study - passage or scenario, then a question\n' +
'  Col14: {"passage":"Write the full passage or data here."}\n' +
'  Col1: the question asked about it. Col2-5: options. Col6: the answer.\n' +
'  Col8: case_study\n\n' +
'image_mcq - diagram question\n' +
'  Col11 or Col14: {"image":"https://..."} - a public https or Drive LINK only.\n' +
'  With no real image, describe the diagram fully in Col1 and leave it blank.\n' +
'  Col8: image_mcq\n\n' +
'essay - extended response, marked WITHOUT AI\n' +
'  Col14: {"min_words":40,"keywords":["photosynthesis","chlorophyll","glucose"]}\n' +
'  Col7 should state that tutor review is recommended.\n' +
'  Col8: essay\n\n' +
'code - code, pseudocode or SQL\n' +
'  Col14: {"language":"JavaScript","keywords":["function","return","Math.max"]}\n' +
'  Col8: code\n\n' +
'===================================================================\n' +
'QUALITY BAR - a paper failing any of these is not acceptable\n' +
'===================================================================\n' +
'- Every stem is self-contained and unambiguous. A competent learner should\n' +
'  never have to guess what is being asked.\n' +
'- Distractors are PLAUSIBLE and DIAGNOSTIC - each wrong option should match a\n' +
'  real misconception. Never "none of the above" or obvious filler.\n' +
'- Explanations TEACH: why the right answer is right, and why the attractive\n' +
'  wrong one is wrong.\n' +
'- Spread the difficulty: about 30% easy, 50% moderate, 20% demanding. Put that\n' +
'  word in Col15.\n' +
'- Numeric items producing decimals MUST carry a tolerance in Col9.\n' +
'- Essay and code keywords must be objectively checkable without AI.\n' +
'- Cover the sub-areas of the topic rather than repeating one idea ' + n + ' times.\n' +
'- Match the command words and mark weightings of ' + examType + '.\n\n' +
'===================================================================\n' +
'FINAL CHECK BEFORE YOU ANSWER\n' +
'===================================================================\n' +
'[ ] Output is a DOWNLOADABLE .csv FILE named "' + fname + '.csv".\n' +
'[ ] Exactly ' + n + ' data rows, plus the one header row.\n' +
'[ ] Header matches the contract character for character (17 columns).\n' +
'[ ] Type counts match the distribution above and sum to ' + n + '.\n' +
'[ ] Every JSON cell has inner quotes doubled ("") and the whole cell quoted.\n' +
'[ ] Every objective row has a non-empty, unambiguous key in Col6.\n' +
'[ ] Col17 is "' + subject + '" on every row.\n' +
'[ ] Nothing in your reply but the file (or, as a fallback, one CSV block).' + addendum;
  }
};
window.CBT = CBT;
