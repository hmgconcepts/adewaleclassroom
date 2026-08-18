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
  /* =======================================================================
     promptPack — V22. EVERY PACK IS NOW A DIFFERENT PROMPT.

     The V21 version was wrong, and the user was right to call it out: all
     eighteen packs shared one base prompt with a short paragraph bolted on
     the end. Two packs that should ask for completely different papers were
     98% identical text. A "misconception hunting" pack and a "marking
     scheme" pack are not the same job, and a model given nearly the same
     instructions returns nearly the same paper.

     Each pack now supplies its OWN:
        role      — who the model is being asked to be
        mission   — what this specific paper is FOR
        mix       — its own type distribution, scaled to the requested count
        sections  — briefing sections unique to the pack
        quality   — its own quality bar, not a generic one
        checks    — its own final checklist items

     The shared machinery is only the CSV OUTPUT CONTRACT and the per-type
     column rules, which must be byte-identical across packs or the files
     stop importing. Sharing those is correct; sharing the thinking was not.
     ======================================================================= */

  /* The column rules, emitted only for the types a pack actually uses, so a
     20-item MCQ pack is not padded with eight pages of irrelevant rules. */
  _typeRules(types) {
    const R = {
      mcq: 'mcq — one correct option\n' +
        '  Col2-5: four plausible options. Col6: the ANSWER TEXT or the letter A/B/C/D.\n  Col8: mcq',
      tf: 'tf — true/false\n' +
        '  Col2: True   Col3: False   Col4-5: blank.  Col6: True or False.  Col8: tf',
      mrq: 'mrq — several correct options\n' +
        '  Col2-5: options. Col6: correct ones separated by | (e.g. Iron|Copper).\n' +
        '  Col12: true for all-or-nothing, false for partial credit.  Col8: mrq',
      short: 'short — typed short answer\n' +
        '  Col6: the primary answer.  Col11: accepted alternatives separated by |.\n  Col8: short',
      numeric: 'numeric — a number\n' +
        '  Col6: the number only.  Col9: tolerance.  Col10: unit.  Col8: numeric',
      multi_numeric: 'multi_numeric — several numeric sub-parts, part marks\n' +
        '  Col14: [{"label":"x","answer":3,"tolerance":0},{"label":"y","answer":2,"tolerance":0}]\n  Col8: multi_numeric',
      matching: 'matching — pair left with right\n' +
        '  Col13: [{"left":"Na","right":"Sodium"},{"left":"K","right":"Potassium"}]\n' +
        '  Col11 may add distractors separated by |.  Col8: matching',
      ordering: 'ordering — arrange in sequence\n' +
        '  Col14: the items IN THE CORRECT ORDER, e.g. ["Mercury","Venus","Earth"]\n  Col8: ordering',
      cloze: 'cloze — fill several blanks\n' +
        '  Col1: the sentence, each blank written as ___ (three underscores).\n' +
        '  Col14: accepted answers per blank in order, alternatives with |,\n' +
        '         e.g. ["mass|m","acceleration|a"]\n  Col8: cloze',
      categorization: 'categorization — sort items into groups\n' +
        '  Col14: [{"item":"Sodium","category":"Metal"},{"item":"Oxygen","category":"Non-metal"}]\n  Col8: categorization',
      matrix: 'matrix — several rows sharing one set of options\n' +
        '  Col11: the shared options separated by |, e.g. True|False\n' +
        '  Col14: [{"statement":"Water boils at 100 C at sea level","answer":"True"}]\n  Col8: matrix',
      hot_text: 'hot_text — tap the correct parts\n' +
        '  Col14: [{"text":"2","correct":true},{"text":"4","correct":false}]\n  Col8: hot_text',
      assertion_reason: 'assertion_reason — WAEC/JAMB/Cambridge logic item\n' +
        '  Col14: {"assertion":"...","reason":"..."}\n' +
        '  Col6: A/B/C/D/E where A = both true and Reason explains Assertion,\n' +
        '        B = both true but Reason does not explain it, C = Assertion true only,\n' +
        '        D = Reason true only, E = both false.  Col8: assertion_reason',
      case_study: 'case_study — passage or scenario, then a question\n' +
        '  Col14: {"passage":"Write the full passage or data here."}\n' +
        '  Col1: the question. Col2-5: options. Col6: the answer.  Col8: case_study',
      image_mcq: 'image_mcq — diagram question\n' +
        '  Col14: {"image":"https://..."} — a public https or Drive LINK only.\n' +
        '  With no real image, describe the diagram fully in Col1.  Col8: image_mcq',
      essay: 'essay — extended response, marked WITHOUT AI\n' +
        '  Col14: {"min_words":40,"keywords":["photosynthesis","chlorophyll"]}\n' +
        '  Col7 must say tutor review is recommended.  Col8: essay',
      code: 'code — code, pseudocode or SQL\n' +
        '  Col14: {"language":"JavaScript","keywords":["function","return"]}\n  Col8: code'
    };
    return types.map(function (t) { return R[t]; }).filter(Boolean).join('\n\n');
  },

  /* Scale a pack's reference mix to the requested count. The remainder is
     pushed onto the pack's own dominant type, so the total is always exact. */
  _mix(ref, n, dominant, minOne) {
    const keys = Object.keys(ref);
    const total = keys.reduce(function (a, k) { return a + ref[k]; }, 0);
    const out = {}; let running = 0;

    /* `minOne` guarantees every declared type survives the scaling. Without
       it the enterprise pack — which promises all seventeen types — silently
       dropped image_mcq, essay and code whenever the requested count was
       small, because floor(1 * 20 / 33) is 0. A pack that promises breadth
       must deliver it. */
    keys.forEach(function (k) {
      let v = Math.floor(ref[k] * n / total);
      if (minOne && v < 1) v = 1;
      if (v > 0) { out[k] = v; running += v; }
    });

    const d = dominant || keys[0];
    if (running > n) {
      // Over-allocated by the minimums: shave the dominant type back down.
      out[d] = Math.max(minOne ? 1 : 0, (out[d] || 0) - (running - n));
      running = keys.reduce(function (a, k) { return a + (out[k] || 0); }, 0);
      // Still over? Trim the largest buckets one at a time, never below 1.
      let guard = 0;
      while (running > n && guard++ < 500) {
        const biggest = keys.filter(function (k) { return (out[k] || 0) > 1; })
          .sort(function (a, b) { return out[b] - out[a]; })[0];
        if (!biggest) break;
        out[biggest] -= 1; running -= 1;
      }
    } else {
      out[d] = (out[d] || 0) + Math.max(0, n - running);
    }
    return out;
  },

  PACKS: {
    simple: {
      label: 'Simple recall',
      role: 'a patient classroom teacher who writes clear, confidence-building questions for learners who are still finding their feet',
      mission: 'Build fluency and confidence. This paper should reward a learner who has done the reading, and should never punish them for misreading a convoluted stem.',
      ref: { mcq: 12, tf: 6, short: 2 }, dominant: 'mcq',
      sections: [
        ['LANGUAGE', 'Use the shortest sentence that asks the question. No subordinate clauses.\nNo negatives ("which is NOT..."). No double negatives ever. A learner\nreading at two years below the nominal level should still understand the task.'],
        ['SCOPE', 'One idea per question. Never combine two skills in one item — if a\nlearner gets it wrong you must be able to say exactly which idea they missed.']
      ],
      quality: [
        'Every stem is under 25 words.',
        'Options are similar in length; the longest option is not always the answer.',
        'Explanations restate the rule in one plain sentence.',
        'No trick questions. This paper builds confidence.'
      ]
    },

    intermediate: {
      label: 'Recall + application',
      role: 'an experienced subject teacher balancing recall against application',
      mission: 'Check that knowledge has become usable. Roughly half the paper should ask the learner to APPLY a rule to a situation they have not seen before.',
      ref: { mcq: 8, tf: 2, short: 3, numeric: 4, mrq: 2, matching: 1 }, dominant: 'mcq',
      sections: [
        ['SPLIT', 'About 40% straight recall, 60% application to an unfamiliar context.\nMark the recall items "easy" and the application items "moderate" in Col15.'],
        ['CONTEXTS', 'Application items must use realistic Nigerian and international contexts —\nmarket prices, transport, rainfall, phone data plans, exam timetables — not\nabstract "object A and object B".']
      ],
      quality: [
        'Every application item names a concrete situation.',
        'Numeric answers use realistic magnitudes a learner can sanity-check.',
        'At least one item per sub-topic.'
      ]
    },

    advanced: {
      label: 'Multi-step reasoning',
      role: 'a chief examiner who sets the discriminating questions at the top end of a paper',
      mission: 'Separate the strong candidates from the merely competent. Almost every item should need two or more linked steps.',
      ref: { multi_numeric: 4, assertion_reason: 4, case_study: 4, matrix: 3, mcq: 3, ordering: 2 }, dominant: 'multi_numeric',
      sections: [
        ['DEPTH', 'A candidate who knows the definitions but cannot reason should score poorly.\nEvery item must require synthesis, inference or a chain of at least two steps.'],
        ['PART MARKS', 'Prefer multi_numeric and matrix over single mcq, because they award part\nmarks and show WHERE the reasoning broke down.']
      ],
      quality: [
        'No item is answerable by recognition alone.',
        'Each assertion_reason item is genuinely subtle — the B case (both true, no causal link) must appear at least once.',
        'Explanations set out the reasoning chain step by step.'
      ]
    },

    enterprise: {
      label: 'Full showcase — all 17 types',
      role: 'an assessment architect building a reference paper that demonstrates every question format the platform supports',
      mission: 'Exercise the FULL range of seventeen types. This paper is used to train tutors and to show families what the studio can do, so breadth matters more than balance.',
      ref: { mcq: 3, tf: 2, mrq: 2, short: 2, numeric: 2, matching: 2, ordering: 2, cloze: 2,
             categorization: 2, multi_numeric: 2, matrix: 2, hot_text: 2, assertion_reason: 2,
             case_study: 2, image_mcq: 1, essay: 1, code: 1 },
      dominant: 'mcq',
      minOne: true,            // every one of the 17 types must appear
      sections: [
        ['COVERAGE', 'Every one of the seventeen types must appear at least once, even if that\nmeans an unusual fit for the topic. Breadth is the point of this pack.'],
        ['SELF-DOCUMENTING', 'Because tutors read this paper to learn the formats, each Explanation should\nalso note in one clause why that TYPE suited that question.']
      ],
      quality: [
        'All seventeen types present.',
        'Each structured type has valid, complete JSON in Col13/Col14.',
        'The paper still reads as a coherent assessment, not a format catalogue.'
      ]
    },

    self: {
      label: 'Self-quiz (practice)',
      role: 'a supportive tutor writing practice a learner will work through alone, with nobody to ask',
      mission: 'This is PRACTICE, not assessment. Nobody sees the score but the learner. The Explanation is the most important column in the file.',
      ref: { mcq: 10, tf: 4, short: 3, numeric: 3 }, dominant: 'mcq',
      sections: [
        ['EXPLANATIONS ARE THE PRODUCT', 'The learner meets the Explanation immediately after answering, alone. Each\none must teach the idea from first principles in 2-4 sentences — not merely\nassert which letter was right. Assume nobody is there to ask.'],
        ['SEQUENCE', 'Order the items so they build: the easiest first, each one leaning on the\nidea before it. A learner should feel progress by item ten.']
      ],
      quality: [
        'Every Explanation would make sense to a learner who got the item wrong.',
        'Explanations name the misconception behind the tempting wrong option.',
        'No item depends on having seen an earlier item\'s answer.'
      ]
    },

    review: {
      label: 'Review quiz (find the gaps)',
      role: 'a diagnostician mapping exactly what a class did and did not absorb in the lesson just taught',
      mission: 'This is sat straight after teaching. Its job is to locate gaps precisely, not to produce a grade.',
      ref: { mcq: 8, tf: 3, short: 3, matching: 2, cloze: 2, numeric: 2 }, dominant: 'mcq',
      sections: [
        ['EVEN COVERAGE', 'Spread the items EVENLY across every sub-topic taught. Two items per\nsub-topic minimum, so one careless slip does not look like a knowledge gap.'],
        ['DIAGNOSTIC TAGGING', 'Col16 (Tags) must name the specific sub-skill each item tests, e.g.\n"balancing-equations" or "unit-conversion". The tutor filters by that tag to\ndecide what to reteach.'],
        ['NO CURVEBALLS', 'Nothing beyond what was actually taught in the lesson. An item testing\nunseen material tells the tutor nothing useful.']
      ],
      quality: [
        'Every sub-topic has at least two items.',
        'Col16 carries a specific, machine-filterable tag on every row.',
        'Each Explanation says which part of the lesson to revisit.'
      ]
    },

    graded: {
      label: 'Graded assessment (counts)',
      role: 'a chief examiner producing a paper whose marks will be defended to a parent',
      mission: 'This counts and is pushed to the scoresheet. Every key must survive a challenge.',
      ref: { mcq: 10, mrq: 3, numeric: 3, short: 2, multi_numeric: 2, case_study: 2, essay: 1 }, dominant: 'mcq',
      sections: [
        ['DEFENSIBILITY', 'Assume a parent will query a mark. Every item must have exactly one\ndefensible answer, and Col11 (Accept) must list every legitimate alternative\nwording so a correct answer is never marked wrong on a technicality.'],
        ['WEIGHTING', 'Marks must reflect effort: a one-step recall item is 1 mark, a multi-step\ncalculation is 3-5. State the mark clearly and consistently.'],
        ['NO AMBIGUITY', 'Reject any item where two options could both be argued correct. If in doubt,\nrewrite the item rather than the explanation.']
      ],
      quality: [
        'No item has an arguable second answer.',
        'Col11 is populated for every short and numeric item.',
        'Mark values are proportional to the work required.',
        'Explanations read as a marking rationale.'
      ]
    },

    reading_article: {
      label: 'Reading — article / text',
      role: 'a comprehension examiner who sets papers on unseen texts',
      mission: 'Test whether the learner actually READ and UNDERSTOOD the specific material, not whether they already knew the topic.',
      ref: { case_study: 6, short: 5, mcq: 4, cloze: 3, hot_text: 2 }, dominant: 'case_study',
      sections: [
        ['SOURCE', 'Base EVERY item on this material: {{SOURCE}}\nA learner who has not read it must not be able to answer from general knowledge.'],
        ['SKILL MIX', 'Cover the four comprehension skills: literal retrieval, inference,\nvocabulary-in-context, and author purpose or tone. Name which skill each\nitem tests in Col16.'],
        ['QUOTE ANCHORING', 'Where an answer turns on a specific line, quote that line in the Explanation\nso the tutor can point at it.']
      ],
      quality: [
        'No item is answerable without the source.',
        'At least one inference item and one vocabulary-in-context item.',
        'Col16 names the comprehension skill on every row.'
      ]
    },

    reading_video: {
      label: 'Reading — video source',
      role: 'a media-literacy examiner setting questions on a specific recording',
      mission: 'Confirm the learner watched attentively and can reason about what they saw and heard.',
      ref: { case_study: 5, mcq: 6, short: 4, ordering: 3, tf: 2 }, dominant: 'mcq',
      sections: [
        ['SOURCE', 'Base EVERY item on this video: {{SOURCE}}\nQuestions must be answerable ONLY by someone who watched it.'],
        ['TIMESTAMPS', 'Where a specific moment matters, cite the timestamp in the Explanation\n(e.g. "see 04:12"). This lets the tutor replay the exact clip.'],
        ['SEQUENCE ITEMS', 'Include ordering items that ask for the sequence of steps or events as shown.\nThat tests attention in a way multiple choice cannot.']
      ],
      quality: [
        'Every item cites what was shown or said, not general knowledge.',
        'At least two items carry a timestamp in the Explanation.',
        'No item depends on video quality or on reading small on-screen text.'
      ]
    },

    reading_pack: {
      label: 'Reading — full comprehension set',
      role: 'an examiner building a complete comprehension section around one shared passage',
      mission: 'Produce a coherent comprehension SET, not scattered questions: one shared stimulus, then a graded ladder of questions on it.',
      ref: { case_study: 10, short: 5, cloze: 3, hot_text: 2 }, dominant: 'case_study',
      sections: [
        ['SOURCE', 'Shared stimulus: {{SOURCE}}\nRepeat the SAME passage in Col14 of every case_study row so each question\nstands alone if shuffled.'],
        ['LADDER', 'Order from literal retrieval, through inference, to evaluation. The last\nthree items should be the most demanding in the set.']
      ],
      quality: [
        'Every case_study row carries the full passage in Col14.',
        'The difficulty ladder is visible in Col15.',
        'Vocabulary items quote the sentence the word appears in.'
      ]
    },

    mcq_only: {
      label: 'MCQ only (strict)',
      role: 'a multiple-choice specialist who writes items for standardised, machine-marked papers',
      mission: 'Produce a clean, uniform four-option multiple-choice paper. Nothing else.',
      ref: { mcq: 20 }, dominant: 'mcq',
      sections: [
        ['STRICT FORMAT', 'EVERY item is type "mcq" with EXACTLY four options in Col2-Col5.\nDo not emit any other type under any circumstances, for any reason.'],
        ['DISTRACTOR DISCIPLINE', 'Each of the three wrong options must correspond to a specific, nameable\nerror — a sign slip, a unit confusion, an off-by-one, a common misreading.\nState which error in the Explanation.'],
        ['KEY BALANCE', 'Spread the correct answers roughly evenly across A, B, C and D. Do not let\nany letter carry more than a third of the keys.']
      ],
      quality: [
        'Exactly four options on every row; Col6 is a single letter or the exact option text.',
        'No "all of the above" or "none of the above".',
        'Options are grammatically parallel and similar in length.',
        'Key distribution across A-D is roughly even.'
      ]
    },

    exam_board: {
      label: 'Exam-board house style',
      role: 'a former {{BOARD}} question setter who knows the board\'s house style intimately',
      mission: 'Produce items indistinguishable from real {{BOARD}} questions in register, command words and mark weighting.',
      ref: { mcq: 10, short: 3, numeric: 3, case_study: 2, assertion_reason: 2 }, dominant: 'mcq',
      sections: [
        ['HOUSE STYLE — {{BOARD}}', 'Mirror the board precisely: its command words (state, define, explain,\ndescribe, calculate, justify), its stem length, its option phrasing, its\nordering from accessible to demanding, and its mark allocations.'],
        ['SYLLABUS ANCHORING', 'Every item must map to a stated syllabus objective for {{BOARD}}. Put the\nobjective reference in Col16 where you can identify it.'],
        ['AUTHENTICITY TEST', 'A candidate should not be able to tell these apart from past questions.\nIf an item reads like a textbook exercise rather than an exam question,\nrewrite it.']
      ],
      quality: [
        'Command words match {{BOARD}} conventions exactly.',
        'Mark values match how {{BOARD}} weights that kind of task.',
        'Col16 carries a syllabus reference wherever one can be identified.'
      ]
    },

    differentiated: {
      label: 'Differentiated (three tiers)',
      role: 'an inclusion lead building one paper that works for a mixed-ability group',
      mission: 'One paper, three visible tiers, so every learner in the room meets questions at the edge of their ability.',
      ref: { mcq: 8, short: 3, numeric: 3, multi_numeric: 2, case_study: 2, tf: 2 }, dominant: 'mcq',
      sections: [
        ['THREE TIERS', 'Exactly one third foundation, one third core, one third stretch.\nCol15 must read "easy", "moderate" or "demanding" — the tutor filters on it.'],
        ['SAME CONTENT, DIFFERENT DEMAND', 'The tiers must test the SAME sub-topics at different depths, so a foundation\nlearner and a stretch learner can discuss the same lesson afterwards.'],
        ['SCAFFOLDING', 'Foundation items may include a hint inside the stem (a formula, a worked\nfirst step). Stretch items must not.']
      ],
      quality: [
        'The three tiers are exactly equal in number.',
        'Each sub-topic appears at all three tiers.',
        'Col15 is populated on every single row.'
      ]
    },

    misconception: {
      label: 'Misconception hunting',
      role: 'a researcher in learner error patterns who designs items to expose specific wrong models',
      mission: 'This paper exists to DIAGNOSE, not to score. Every wrong option is a hypothesis about how the learner is thinking.',
      ref: { mcq: 12, mrq: 3, matrix: 2, short: 2, assertion_reason: 1 }, dominant: 'mcq',
      sections: [
        ['EVERY DISTRACTOR IS A DIAGNOSIS', 'Each wrong option must be the answer a learner reaches by a SPECIFIC faulty\nmethod. Never filler. If you cannot name the error a distractor represents,\nreplace it.'],
        ['NAME THE ERROR', 'The Explanation must name the misconception explicitly, e.g. "chose B by\nadding the indices instead of multiplying" or "chose C by treating weight and\nmass as the same quantity."'],
        ['TAG IT', 'Col16 must carry a short slug for the misconception, e.g. "index-addition",\nso the tutor can count how often each error appears across the class.']
      ],
      quality: [
        'Every distractor maps to a named, plausible error.',
        'Every Explanation names the error behind the most tempting wrong option.',
        'Col16 carries a misconception slug on every row.',
        'No distractor is absurd — an obviously silly option diagnoses nothing.'
      ]
    },

    multi_subject: {
      label: 'Multi-subject paper',
      role: 'an examinations officer assembling a combined paper across several subjects',
      mission: 'Build one sitting that covers several subjects cleanly, with the subject tabs the candidate sees driven correctly by the data.',
      ref: { mcq: 12, short: 3, numeric: 3, tf: 2 }, dominant: 'mcq',
      sections: [
        ['SUBJECTS', 'Cover these subjects: {{SUBJECTS}}\nDivide the items as evenly as possible between them.'],
        ['SECTION COLUMN IS CRITICAL', 'Col17 (Section) must contain the SUBJECT NAME for that row, spelled\nidentically every time. This column drives the subject tabs in the exam\nplayer — an inconsistent spelling creates a phantom extra tab.'],
        ['NO CROSS-CONTAMINATION', 'A Mathematics item must not require Biology knowledge, and vice versa.\nEach item belongs to exactly one subject.']
      ],
      quality: [
        'Item counts per subject differ by at most one.',
        'Col17 spellings are identical within each subject, with no stray spaces.',
        'No item requires knowledge from another subject in the set.'
      ]
    },

    past_paper: {
      label: 'Past-paper style',
      role: 'an archivist reconstructing a paper in the authentic style of previous {{BOARD}} sittings',
      mission: 'Recreate the feel of a real past paper, including its structure and its progression.',
      ref: { mcq: 11, short: 3, numeric: 3, case_study: 2, essay: 1 }, dominant: 'mcq',
      sections: [
        ['AUTHENTIC PROGRESSION', 'Real papers ramp. Open with accessible items, build steadily, and place the\nmost demanding items in the final quarter. Col15 should show that curve.'],
        ['PERIOD REGISTER', 'Use the phrasing conventions of {{BOARD}} papers — including their habitual\nstems ("Which of the following...", "Calculate, correct to 2 decimal places...").'],
        ['TOPIC WEIGHTING', 'Weight sub-topics the way the board historically does, not evenly.']
      ],
      quality: [
        'Difficulty rises across the paper rather than jumping about.',
        'Phrasing is idiomatic to the board, not generic.',
        'The topic weighting is defensible against real past papers.'
      ]
    },

    marking_scheme: {
      label: 'With full marking scheme',
      role: 'a chief examiner writing both the paper AND the marking scheme that accompanies it',
      mission: 'Produce a paper a second marker could mark identically without speaking to you.',
      ref: { short: 6, numeric: 4, multi_numeric: 3, essay: 2, mcq: 3, case_study: 2 }, dominant: 'short',
      sections: [
        ['COL7 IS A MARKING SCHEME', 'The Explanation column must read as a marking scheme, not a hint: the\nacceptable answers, where each mark is earned, and what earns no credit.\nUse the convention "M1 — method mark for ...; A1 — accuracy mark for ...".'],
        ['ACCEPT GENEROUSLY', 'Col11 must list every legitimate alternative wording, spelling and form,\nseparated by |. This is what prevents a correct answer being marked wrong.'],
        ['TOLERANCES', 'Every numeric item MUST carry a tolerance in Col9. State in Col7 whether\nfollow-through marks apply after an earlier error.']
      ],
      quality: [
        'Every row\'s Col7 identifies where each mark is earned.',
        'Col11 is populated for every non-objective item.',
        'Every numeric item has an explicit tolerance.',
        'A second marker would award the same marks.'
      ]
    },

    oral_practice: {
      label: 'Oral / spoken practice',
      role: 'a speaking examiner preparing prompts for spoken assessment',
      mission: 'Give the learner things to SAY, and give the tutor a clear basis for judging what they hear.',
      ref: { essay: 8, short: 6, case_study: 4, mcq: 2 }, dominant: 'essay',
      sections: [
        ['SPOKEN, NOT WRITTEN', 'Every prompt must be answerable aloud in 30-120 seconds. Avoid anything\nrequiring notation, diagrams or long calculation.'],
        ['WHAT A STRONG ANSWER CONTAINS', 'For each item, the Explanation must describe what a strong spoken answer\ncontains — the points, the structure, the register — so the tutor can judge\nconsistently. Put the checkable points in Col14 keywords.'],
        ['RECORDINGS ARE LINKS', 'If a learner records themselves, it is submitted as a Drive or YouTube LINK.\nThis platform never accepts uploads. Say so in the Explanation where relevant.']
      ],
      quality: [
        'Every prompt is genuinely speakable in under two minutes.',
        'Col14 keywords are things an assessor can actually listen for.',
        'No prompt requires the learner to read a long text aloud first.'
      ]
    }
  },

  promptPack(level, topic, count, klass, extra) {
    extra = extra || {};
    const studio = (window.PRACTICE && window.PRACTICE.name) || 'this tutoring studio';
    const subject = extra.subject || '[SUBJECT]';
    const examType = extra.examType || extra.board || 'general classwork';
    const board = extra.board || examType;
    const source = extra.source || '[SOURCE LINK]';
    const subjects = extra.subjects || subject;
    const n = Number(count) || 20;
    const fname = (topic || 'questions').toString().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'questions';

    const key = String(level || '').toLowerCase();
    const P = this.PACKS[key] || this.PACKS.intermediate;

    const fill = (s) => String(s)
      .replace(/\{\{BOARD\}\}/g, board)
      .replace(/\{\{SOURCE\}\}/g, source)
      .replace(/\{\{SUBJECTS\}\}/g, subjects);

    const mix = this._mix(P.ref, n, P.dominant, P.minOne);
    const usedTypes = Object.keys(mix);
    const distribution = usedTypes.map(function (k) { return k + '=' + mix[k]; }).join(', ');
    const rule = '===================================================================';

    const sections = (P.sections || []).map(function (s) {
      return rule + '\n' + fill(s[0]) + '\n' + rule + '\n' + fill(s[1]);
    }).join('\n\n');

    const quality = (P.quality || []).map(function (q) { return '- ' + fill(q); }).join('\n');
    const checks = [
      'Output is a DOWNLOADABLE .csv FILE named "' + fname + '.csv".',
      'Exactly ' + n + ' data rows, plus the one header row.',
      'Header matches the contract character for character (17 columns).',
      'Type counts match the distribution and sum to ' + n + '.',
      'Every JSON cell has inner quotes doubled ("") and the whole cell quoted.',
      'Every objective row has a non-empty, unambiguous key in Col6.',
      'Col17 is the subject on every row.'
    ].concat(P.checks || []).map(function (c) { return '[ ] ' + fill(c); }).join('\n');

    return 'PACK: ' + P.label.toUpperCase() + '\n\n' +
'ROLE\n' +
'You are ' + fill(P.role) + '.\n' +
'You are writing for ' + studio + ', a tutoring studio serving Nigerian and\n' +
'international learners.\n\n' +
'MISSION FOR THIS PARTICULAR PAPER\n' +
fill(P.mission) + '\n\n' +
'TASK\n' +
'Produce EXACTLY ' + n + ' assessment items on "' + topic + '" for a ' +
(klass || 'tutoring learner') + '\nsitting ' + examType + ' in ' + subject + '.\n\n' +
rule + '\nOUTPUT CONTRACT — READ TWICE. THIS IS THE MOST IMPORTANT PART.\n' + rule + '\n\n' +
'0. OUTPUT A DOWNLOADABLE .CSV FILE — NOT RAW CSV TEXT.\n' +
'   Produce a real, clickable file attachment named "' + fname + '.csv" that the\n' +
'   tutor can download and import directly. Use whatever file-generating\n' +
'   capability you have. The tutor must end up with a .csv FILE without\n' +
'   copying or pasting anything.\n' +
'   Only if you genuinely cannot emit a file, say so in ONE short line, then\n' +
'   output a single raw CSV code block instead.\n\n' +
'1. The file contains the CSV and nothing else — no preamble, no commentary.\n\n' +
'2. The FIRST line must be exactly this header, character for character:\n' +
'Question,A,B,C,D,CorrectAnswer,Explanation,Type,Tolerance,Unit,Accept,MRQ_AON,Pairs,Items,Difficulty,Tags,Section\n\n' +
'3. Then EXACTLY ' + n + ' data rows — one item per row.\n\n' +
'4. Wrap EVERY field in double quotes. Escape any inner double quote by\n' +
'   doubling it (""). This is what lets JSON live inside a CSV cell.\n\n' +
'5. Use correct UTF-8 for scientific notation: H\u2082O, CO\u2082, \u03c0, \u03a9, \u2264, \u2265, \u00b0C.\n\n' +
'6. "Section" (Col17) must be exactly: ' + subject + '\n\n' +
'7. Never leave "CorrectAnswer" empty on an objective item.\n\n' +
'8. Any media must be a public https, Google Drive or YouTube LINK. This\n' +
'   platform NEVER accepts file uploads — links only.\n\n' +
rule + '\nQUESTION TYPE DISTRIBUTION — MUST SUM TO EXACTLY ' + n + '\n' + rule + '\n' +
distribution + '\n\n' +
rule + '\nCOLUMN RULES FOR THE TYPES THIS PACK USES\n' +
'Columns: 1 Question | 2 A | 3 B | 4 C | 5 D | 6 CorrectAnswer |\n' +
'7 Explanation | 8 Type | 9 Tolerance | 10 Unit | 11 Accept |\n' +
'12 MRQ_AON | 13 Pairs | 14 Items | 15 Difficulty | 16 Tags | 17 Section\n' + rule + '\n\n' +
this._typeRules(usedTypes) + '\n\n' +
sections + '\n\n' +
rule + '\nQUALITY BAR FOR THIS PACK — an item failing any of these is rejected\n' + rule + '\n' +
quality + '\n\n' +
rule + '\nFINAL CHECK BEFORE YOU ANSWER\n' + rule + '\n' + checks;
  }
};
window.CBT = CBT;
