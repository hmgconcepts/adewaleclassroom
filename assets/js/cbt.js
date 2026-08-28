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

  /* Parse an Items / Pairs cell. Delegates to the shared lenient parser in
     cbt-types.js when it is loaded, so import-time and grade-time agree. */
  _structured(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'object') return v;
    if (window.CBTTypes && CBTTypes.lenientJSON) {
      var p = CBTTypes.lenientJSON(String(v));
      if (p != null) return p;
    } else {
      try { return JSON.parse(String(v)); } catch (e) {}
    }
    var parts = String(v).split(/\s*[|;]\s*/).filter(Boolean);
    return parts.length ? parts : null;
  },

  /* Question families whose key lives in Items / Pairs rather than in the
     CorrectAnswer column. */
  STRUCTURED_KEY_TYPES: ['cloze', 'ordering', 'drag_drop', 'timeline', 'matching',
                         'categorization', 'matrix', 'multi_numeric', 'hot_text',
                         'sequence'],

  /* Families a machine must NOT pretend to mark. See item 7: these go to the
     tutor for marking, and are counted as "awaiting marking", never as
     "unkeyed" and never as wrong. */
  TUTOR_MARKED_TYPES: ['essay', 'case_study', 'oral_prompt', 'peer_review',
                       'citation', 'true_false_justify', 'code', 'comprehension',
                       'data_interpretation', 'graph_read', 'error_spotting',
                       'hotspot', 'audio_based', 'video_based'],

  /* Lift the answer key out of items/pairs for the structured families. */
  _keyFromStructure(type, items, pairs, answer) {
    var have = function (v) {
      if (v == null) return false;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'object') return Object.keys(v).length > 0;
      return String(v).trim() !== '';
    };
    if (have(answer)) return answer;                       // explicit wins

    if (type === 'matching') {
      if (have(pairs)) return pairs;
      if (have(items)) return items;
      return answer;
    }
    if (this.STRUCTURED_KEY_TYPES.indexOf(type) > -1) {
      if (have(items)) return items;
      if (have(pairs)) return pairs;
    }
    return answer;
  },

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

    /* Parse the structured columns BEFORE building the record, so the key
       can be derived from them. */
    const _items = this._structured(pick('items', 'rows', 'parts', 'chunks', 'blanks', 'sequence'));
    const _pairs = this._structured(pick('pairs', 'matches'));
    answer = this._keyFromStructure(type, _items, _pairs, answer);

    /* Item 7 — a question a machine cannot fairly mark is flagged here, once,
       so every consumer agrees: the preview does not call it unkeyed, the
       grader parks it as pending instead of scoring it zero, and the tutor's
       marking queue can find it. */
    const _tutorMarked = this.TUTOR_MARKED_TYPES.indexOf(type) > -1;

    /* ---------------------------------------------------------------------
       V39 items 3 & 5 — lift the stimulus out of the structured Items cell.

       The 17-column HMG header has no Passage column and no Media column:
       both live inside Col14 (Items) as JSON, which is exactly what the
       case_study, image and passage-set prompts instruct. Until now only
       cbt-types.js looked inside there, so CBT.normalizeQuestion returned an
       empty q.passage and an empty q.media_url for those rows. That was
       invisible while the passage was only ever rendered by CBTTypes, but the
       new pinned-passage pane groups on q.passage — an empty string would
       have put every comprehension question in its own group and defeated the
       whole feature. Same for q.media_url and the figure pane.

       Flat columns still win where present; this only fills the gaps.
       --------------------------------------------------------------------- */
    let _passage = pick('passage','context','case_text','comprehension') || '';
    let _media   = pick('media_url','image','audio_url','video_url','image_url') || '';
    if (_items && typeof _items === 'object' && !Array.isArray(_items)) {
      if (!_passage) _passage = _items.passage || _items.context || _items.text ||
                                _items.stimulus || _items.case || '';
      if (!_media)   _media   = _items.image || _items.media || _items.media_url ||
                                _items.figure || _items.diagram || '';
    }
    /* A placeholder figure is not a URL — keep it out of the <img src>, but
       keep it visible to the tutor so they know a link is still owed. */
    let _mediaPending = '';
    if (/^\s*\[\[FIGURE:/i.test(String(_media))) { _mediaPending = String(_media); _media = ''; }

    /* The passage-set contract tags a set as  set:P1  in Col16 (Tags).
       Promote it to a first-class id so CBT.passageKey groups on the author's
       explicit intent rather than on a hash of the text — which also lets a
       set survive a one-character typo in one row's passage. */
    const _tags = String(pick('tags','tag','skills') || '');
    const _setM = /(?:^|[,;|\s])set\s*:\s*([A-Za-z0-9_-]+)/i.exec(_tags);
    const _passageId = pick('passage_id','set_id','group_id','stimulus_id') ||
                       (_setM ? _setM[1] : '');

    return {
      id: pick('id') || ('q'+(idx+1)),
      _orig_index: idx,
      type,
      subject: pick('subject','section','subject_section','exam_subject') || '',
      section: pick('section','subject_section','subject','exam_subject') || '',
      question: pick('question','prompt','text','question_text','questionText') || '',
      passage: _passage,
      passage_id: _passageId,
      media_pending: _mediaPending,
      difficulty: pick('difficulty','level') || '',
      accepted_answers: pick('accept','accepted_answers','alternatives','alternates') || '',
      options,
      answer, correct: answer,
      mark: Number(pick('mark','marks','score','points') || 1) || 1,
      explanation: pick('explanation','reason','solution') || '',
      media_url: _media,
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
      /* -----------------------------------------------------------------
         REPORTED ITEM 2 — "N question(s) have no answer key".

         Two distinct causes, both reproduced against the three CSVs
         supplied with the report.

         CAUSE A — the key is not in CorrectAnswer.
         For cloze, ordering, matching, categorization, matrix, multi-part
         numeric and hot-text, the HMG/School Connect template puts the
         answer in the **Items** or **Pairs** column and leaves
         CorrectAnswer empty. That is correct: a cloze with three blanks
         has three answers and cannot fit in one cell. The importer only
         ever read CorrectAnswer, so `answer` stayed '' and the preview
         reported the question as unkeyed. Measured:

             your-new-beginning-in-christ.csv       20 of 100 unkeyed
             Ade your-new-beginning-in-christ.csv   20 of 100 unkeyed
             navigating-tech-space-as-a-newbie.csv  12 of  60 unkeyed

         All of them were cloze, ordering or essay rows that DID carry a
         key — in Items.

         CAUSE B — the cell is Python, not JSON.
         Chat models emit ['a', 'b'] and {'k': [...]} because that is what
         a printed list looks like in their training data. JSON.parse
         rejects it. See lenientJSON() in cbt-types.js.

         Both are handled below. `_keyFromStructure` then lifts the key out
         of items/pairs into `answer`, so downstream code — the preview
         warning, the grader, the review page and the audit — all see a
         question that is properly keyed.
         ----------------------------------------------------------------- */
      pairs: _pairs,
      items: _items,
      /* True when only a human can mark this fairly. */
      tutor_marked: _tutorMarked,
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
    /* Same guard as CBTTypes: a blank response can never be correct, and a
       question with no key must not be silently marked right. This path is
       only reached when CBTTypes does not handle the type, but it had the
       identical '' === '' flaw and would have reintroduced the bug. */
    const _blank = (v) => {
      if (v == null) return true;
      if (typeof v === 'string') return v.trim() === '';
      if (Array.isArray(v)) return v.length === 0 || v.every(x => x == null || String(x).trim() === '');
      if (typeof v === 'object') return Object.keys(v).length === 0;
      return false;
    };
    if (_blank(given)) return { ok: false, mark: 0, pending: false, blank: true };
    if (q.answer == null || String(q.answer).trim() === '') {
      return { ok: false, mark: 0, pending: true, unmarkable: true };
    }

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

  /* ---------------------------------------------------------------------
     V39 — RICH TEXT / MATHS  (reported item 1)

     A CSV cell cannot hold a real newline, so the "Multi-Line maths/STEM"
     prompt writes the two characters backslash+n, and it writes maths as
     LaTeX (\frac{}{}, \sqrt{}, ^{}, matrices). Every one of those used to
     be pushed through TC.esc() and printed to the candidate verbatim:

         Solve:\n2x + 3y = 12        <- shown literally, one line
         Simplify \frac{3x+6}{9}     <- shown literally

     rich() routes display text through assets/js/cbt-richtext.js, which
     turns literal escapes into real line breaks and the LaTeX subset into
     real stacked fractions, surds, indices, matrices and Greek letters —
     with no external library, so the offline PWA shell still works.

     It is used ONLY where text is rendered as content. Anything going into
     an HTML attribute (value=", src=", name=") must stay on TC.esc(),
     because rich() legitimately returns markup.

     If cbt-richtext.js is missing the fallback is the old behaviour plus
     newline handling, so no page can break by loading this file alone.
     --------------------------------------------------------------------- */
  rich(x) {
    if (window.CBTRich) return CBTRich.html(x);
    return TC.esc(String(x == null ? '' : x).replace(/\\n/g, '\n')).replace(/\n/g, '<br>');
  },

  /* Plain-text projection of the same cell, for read-aloud and aria labels. */
  plain(x) {
    if (window.CBTRich) return CBTRich.plain(x);
    return String(x == null ? '' : x).replace(/\\n/g, ' ');
  },

  /* =====================================================================
     V39 — DELIVERY LAYER: randomisation + passage groups
     (reported items 2 and 5)
     ---------------------------------------------------------------------
     WHY THE TWO LIVE TOGETHER
     They constrain each other. You cannot shuffle a comprehension paper
     question-by-question: doing so scatters the five questions that belong
     to Passage A among the five that belong to Passage B, and the pinned
     passage would then have to change on every card. So the shuffler works
     on GROUPS. A group is either a single standalone question or a whole
     passage set, and a passage set is always emitted contiguously and in
     its authored order.

     WHY SEEDED, NOT Math.random()
     cbt-multi.html used Math.random(). That reshuffles on every repaint and
     on browser refresh, so a candidate who reloaded mid-exam got a
     different paper and lost their place, and two candidates disputing a
     result could never be shown the same paper again. seededShuffle is
     deterministic: the same seed always yields the same order. The seed is
     the candidate's identity plus the exam code, so every candidate gets a
     genuinely different paper, but any one candidate gets the SAME paper
     every time it is rebuilt — on refresh, on review, and in a dispute.

     WHY SHUFFLING OPTIONS IS SAFE HERE
     Verified before writing this: CBT.normalizeQuestion resolves the
     CorrectAnswer letter (A–F) to the option TEXT at import time, and both
     graders (CBT.gradeOne and CBTTypes.grade) compare by normalised value,
     never by index. Moving an option therefore cannot change the mark. The
     original letter order is kept on q._orig_options for the review sheet.

     Options are NOT shuffled when any option is positional, because
     "All of the above" / "None of the above" / "Both A and B" stop making
     sense once moved. Those are detected and pinned to the bottom.
     ===================================================================== */

  /* Deterministic shuffle. Same seed in, same order out, forever. */
  seededShuffle(arr, seed) {
    const a = arr.slice();
    let h = 2166136261 >>> 0;
    const str = String(seed == null ? '' : seed);
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    const rnd = () => { h ^= h << 13; h >>>= 0; h ^= h >> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  },

  /* Options whose meaning depends on their position must not move. */
  POSITIONAL: /^\s*(all|none|both|neither|any)\s+(of\s+)?(the\s+)?(above|these|below|others)|^\s*(a\s*(and|&|,)\s*b|b\s*(and|&|,)\s*c|i\s+and\s+ii)/i,

  /* A stable key identifying which passage/stimulus a question hangs off.
     Explicit ids win; otherwise the passage text itself is the identity, so
     a CSV that simply repeats the passage in every row (which is what the
     comprehension prompt instructs) groups correctly with no extra column. */
  passageKey(q) {
    if (!q) return '';
    if (q.passage_id) return 'pid:' + q.passage_id;
    if (q.group_id) return 'gid:' + q.group_id;
    const p = String(q.passage || '').trim();
    if (!p) return '';
    let h = 5381;
    for (let i = 0; i < p.length; i++) h = ((h << 5) + h + p.charCodeAt(i)) | 0;
    return 'ptxt:' + (h >>> 0).toString(36) + ':' + p.length;
  },

  /* Collapse a flat question list into ordered delivery groups. */
  groupPassages(questions) {
    const groups = [];
    const index = {};
    (questions || []).forEach((q) => {
      const key = this.passageKey(q);
      if (!key) { groups.push({ key: '', passage: '', items: [q], standalone: true }); return; }
      if (index[key] == null) {
        index[key] = groups.length;
        groups.push({ key, passage: q.passage || '', section: q.section || '', items: [], standalone: false });
      }
      groups[index[key]].items.push(q);
    });
    return groups;
  },

  /* ---------------------------------------------------------------------
     applyDelivery(questions, opts) -> new ordered array

     opts.shuffleQuestions  shuffle group order            (default false)
     opts.shuffleOptions    shuffle options within an item (default false)
     opts.seed              candidate+exam identity string
     opts.serve             serve only the first N groups' worth of items
     --------------------------------------------------------------------- */
  applyDelivery(questions, opts) {
    const o = opts || {};
    const seed = String(o.seed || 'default');
    let groups = this.groupPassages(questions || []);

    if (o.shuffleQuestions) {
      groups = this.seededShuffle(groups, seed + '|groups');
      /* Inside a standalone-only group there is nothing to reorder, but a
         passage set keeps its authored order: question 3 of a comprehension
         often refers to "the answer to question 2". */
    }

    let out = [];
    groups.forEach((g) => { out = out.concat(g.items); });

    if (o.serve && o.serve > 0 && o.serve < out.length) out = out.slice(0, o.serve);

    if (o.shuffleOptions) {
      out = out.map((q) => {
        const opts2 = q.options;
        if (!Array.isArray(opts2) || opts2.length < 2) return q;
        /* True/False and Yes/No read wrong when reversed. */
        const joined = opts2.map((x) => String(x).trim().toLowerCase()).join('|');
        if (joined === 'true|false' || joined === 'false|true' ||
            joined === 'yes|no' || joined === 'no|yes') return q;

        const movable = [], pinned = [];
        opts2.forEach((x) => { (this.POSITIONAL.test(String(x)) ? pinned : movable).push(x); });
        if (movable.length < 2) return q;

        const q2 = Object.assign({}, q);
        q2._orig_options = opts2.slice();
        q2.options = this.seededShuffle(movable, seed + '|o|' + q.id).concat(pinned);
        return q2;
      });
    }

    /* Re-stamp the display index so the palette and progress read 1..N in
       the order the candidate actually sees, while _orig_index still points
       back at the CSV row for the marking sheet. */
    out.forEach((q, i) => { q._display_index = i; });
    return out;
  },

  /* Build the per-candidate seed. Same candidate + same paper = same order. */
  deliverySeed(exam, candidate) {
    return [
      (exam && (exam.code || exam.id)) || 'exam',
      (candidate && (candidate.student_no || candidate.full_name)) || 'guest'
    ].join('::').toLowerCase();
  },

  renderQuestion(q, i, locked) {
    const name = 'q_' + q.id;
    const wrap = (inner) => `<article class="card cbt-q" data-qid="${q.id}" style="margin-bottom:12px">
      <div class="muted" style="font-size:.75rem;text-transform:uppercase">${i+1} · ${this.TYPE_LABEL[q.type]||q.type}${q.subject?' · '+q.subject:''} · ${q.mark} mark(s)</div>
      ${(q.passage && !q._passage_pinned) ? `<blockquote style="border-left:3px solid var(--accent);padding-left:10px;margin:8px 0">${this.rich(q.passage)}</blockquote>` : ''}
      <p style="font-weight:700;margin:8px 0">${this.rich(q.question)}</p>
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
      return wrap((q.options||[]).map((o,oi) => `<label style="display:block;padding:6px 0"><input type="radio" name="${name}" value="${TC.esc(o)}" ${dis}> ${this.rich(o)}</label>`).join(''));
    }
    if (q.type === 'multi_select') {
      return wrap((q.options||[]).map(o => `<label style="display:block;padding:6px 0"><input type="checkbox" name="${name}" value="${TC.esc(o)}" ${dis}> ${this.rich(o)}</label>`).join(''));
    }
    if (['essay','case_study','comprehension','oral_prompt','peer_review','citation','true_false_justify','cloze','error_spotting','data_interpretation','graph_read'].includes(q.type)) {
      return wrap(`${q.media_url && window.Media ? Media.card(q.media_url, 'Stimulus') : ''}
        <textarea class="form-textarea" name="${name}" ${dis} rows="5" placeholder="Your answer"></textarea>`);
    }
    if (q.type === 'likert') {
      return wrap([1,2,3,4,5].map(n => `<label style="margin-right:10px"><input type="radio" name="${name}" value="${n}" ${dis}> ${n}</label>`).join(''));
    }
    if (q.type === 'assertion_reason' || q.type === 'scenario_mcq' || q.type === 'classification') {
      return wrap((q.options||['A','B','C','D']).map(o => `<label style="display:block;padding:6px 0"><input type="radio" name="${name}" value="${TC.esc(o)}" ${dis}> ${this.rich(o)}</label>`).join(''));
    }
    if (q.type === 'audio_based') {
      return wrap(`${q.media_url?`<audio controls src="${TC.esc(q.media_url)}"></audio>`:''}<input class="form-input" name="${name}" ${dis} placeholder="Your answer">`);
    }
    if (q.type === 'video_based') {
      return wrap(`${q.media_url?`<video controls src="${TC.esc(q.media_url)}" style="max-width:100%"></video>`:''}<input class="form-input" name="${name}" ${dis} placeholder="Your answer">`);
    }
    if (q.type === 'ordering' || q.type === 'drag_drop') {
      return wrap(`<p class="muted">Type the items in the correct order, separated by commas.</p>
        <div class="muted">${(q.options||[]).map(o=>this.rich(o)).join(' · ')}</div>
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
    const mediaBlock = (d) => {
      const u = d && (d.media_url || d.image_url || d.image);
      if (!u) return '';
      const s = String(u);
      if (/\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(s) || /drive\.google|imgur|cloudinary|supabase|ibb\.co/i.test(s)) {
        return `<figure style="margin:10px 0"><img src="${TC.esc(s)}" alt="Question diagram" style="max-width:100%;border-radius:10px;border:1px solid #e2e8f0"><figcaption class="muted" style="font-size:.75rem">Diagram / stimulus</figcaption></figure>`;
      }
      return `<p style="margin:8px 0"><a href="${TC.esc(s)}" target="_blank" rel="noopener">Open diagram / media</a></p>`;
    };
    const rows = (result.detail || []).map((d, i) => {
      const givenRaw = Array.isArray(d.given) ? d.given.join(', ') : d.given;
      const blank = givenRaw == null || givenRaw === '';
      const tone = d.pending ? '#fef3c7' : d.ok ? '#d1fae5' : '#fee2e2';
      const label = d.pending ? 'Awaiting tutor' : d.ok ? 'Correct' : (blank ? 'Blank' : 'Incorrect');
      const state = d.pending ? 'pending' : d.ok ? 'right' : (blank ? 'blank' : 'wrong');
      return `<section class="rv-q" data-state="${state}" style="border:1px solid #e4ddd2;border-radius:12px;padding:12px;margin:10px 0;background:${tone}">
        <div style="font-size:.75rem;text-transform:uppercase;letter-spacing:.04em">${i+1} · ${label} · ${d.mark}/${d.max}${d.subject?' · '+TC.esc(d.subject):''}${d.type?' · '+TC.esc(d.type):''}</div>
        ${d.passage ? `<blockquote style="border-left:3px solid #964eec;padding-left:10px;margin:8px 0;">${CBT.rich(d.passage)}</blockquote>` : ''}
        ${mediaBlock(d)}
        <p style="font-weight:700">${CBT.rich(d.question)}</p>
        <p><b>Your answer:</b> <span>${CBT.rich(givenRaw)}</span></p>
        <p><b>Correct answer:</b> <span>${CBT.rich(Array.isArray(d.correct)?d.correct.join(', '):d.correct)}</span></p>
        ${d.explanation ? `<p><b>Why:</b> <span>${CBT.rich(d.explanation)}</span></p>` : ''}
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


  /* =====================================================================
     V39 item 6 — THE UNIVERSAL EXPLANATION STANDARD

     Reported: "For ALL question types the explanation / correct answer /
     why must be detailed, comprehensive, unambiguous, clear and
     understandable, so students reviewing their CBT can understand their
     errors."

     Before this, each pack carried its own one-line wish about
     explanations ("Explanations show the working") and most packs said
     nothing at all, so a generator would happily emit Col7 = "B is
     correct." A learner reading that on cbt-review.html learns nothing:
     they already know they got it wrong.

     This block is injected into EVERY generated prompt, ahead of the
     pack-specific sections, so it cannot be forgotten by a pack author and
     cannot be diluted by a pack that only cares about its own format. It
     is deliberately written as a fixed four-move structure with a minimum
     word count, because "be detailed" is advice a model ignores, while
     "name the misconception behind each wrong option" is an instruction it
     can be graded against — and the FINAL CHECK list below grades it.
     ===================================================================== */
  EXPLANATION_STANDARD: [
    'Col7 (Explanation) is the single most valuable column in the file. It is',
    'the only teaching the learner receives after the paper closes. Treat it as',
    'a marking-scheme entry written for a learner sitting alone, not as a note',
    'to a colleague.',
    '',
    'EVERY row — every type, including numeric, matching, ordering, essay and',
    'code — must carry an explanation with these FOUR MOVES, in this order:',
    '',
    '  MOVE 1 — VERDICT. State the correct answer in full words, not just a',
    '           letter. Write "The correct answer is 3/4, option C" and never',
    '           "C" or "Option C is correct". The letter may have moved: this',
    '           platform can randomise option order per candidate, so a review',
    '           sheet that only says "B" is meaningless to the learner reading it.',
    '',
    '  MOVE 2 — REASONING. Show HOW the answer is reached, step by numbered',
    '           step. For calculations, every line of working, with the rule or',
    '           formula named at the step where it is used ("multiply both sides',
    '           by the LCM, 6"). For language items, quote the exact words from',
    '           the passage or option that decide it. For factual items, give the',
    '           principle, then apply it to this specific stem. Never write',
    '           "by simple calculation" or "as we know" — that is the exact',
    '           sentence the struggling learner cannot fill in.',
    '',
    '  MOVE 3 — THE DISTRACTOR AUTOPSY. Take each wrong option in turn and name',
    '           the SPECIFIC misconception or slip that produces it: "Option A,',
    '           7/12, comes from adding the numerators and the denominators',
    '           separately." A learner who chose A must be able to find their own',
    '           mistake described in words. This move is what turns a score into',
    '           a diagnosis, and it is mandatory on every option-based item.',
    '',
    '  MOVE 4 — THE TAKEAWAY. One sentence naming the transferable rule or the',
    '           checkpoint that prevents the error next time ("Always convert to',
    '           a common denominator before adding fractions").',
    '',
    'LENGTH AND FORM',
    '  - Minimum 45 words for a one-mark objective item; 80 or more for numeric,',
    '    multi-part, case-study, essay and code items. There is no upper limit',
    '    that matters: a long, clear explanation costs the platform nothing.',
    '  - Number the reasoning steps 1) 2) 3) and put each on its own line using',
    '    the literal two-character sequence \\n. The review screen renders those',
    '    as real line breaks, so a wall of text is never necessary.',
    '  - Encode any maths in the explanation exactly as it is encoded in the',
    '    stem, so the learner sees the same notation twice.',
    '  - Plain language at the learner\'s reading age. Define any technical term',
    '    the moment it is used.',
    '  - Self-contained: never write "see above", "as explained in question 4",',
    '    "refer to your notes" or "the diagram makes this obvious". The learner',
    '    may be reviewing this one row on a phone, out of order, weeks later.',
    '',
    'FOR TYPES WITH NO WRONG OPTIONS TO DISSECT',
    '  - numeric / multi_numeric: show the substitution and the arithmetic, state',
    '    the unit, and name the two most common wrong answers and what causes',
    '    them (usually a unit slip or a rounding slip).',
    '  - matching / ordering / categorization: justify EVERY pair or position,',
    '    not only the difficult ones, and name the pair most often swapped.',
    '  - essay / code: give the full mark-scheme — the points that earn credit,',
    '    the weight of each, a model answer or reference solution, and the two',
    '    most common ways candidates lose marks.',
    '  - fill_blank / short: list every accepted variant spelling or phrasing and',
    '    say plainly why a near-miss is or is not accepted.'
  ].join('\n'),

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

    /* ------------------------------------------------------------------
       V34 — MULTI-LINE MATH / STRUCTURED STEM  (fractions, matrices, …)
       The CSV stores ONE cell per field. Multi-line expressions MUST use
       the platform's plain-text conventions so CBT.esc + white-space:pre-wrap
       and optional $$…$$ / \\frac markers render without confusion.
       ------------------------------------------------------------------ */
    multiline_math: {
      label: 'Multi-line maths / STEM expressions',
      role: 'a senior mathematics examiner who writes board-style items with fractions, matrices, indices, logs, simultaneous equations, calculus and statistics — and knows how to encode them in a single CSV cell',
      mission: 'Produce a paper where EVERY multi-line expression is encoded so Tutoring Connect / ADEWALE CLASSROOM can display it cleanly on phone and desktop. Prefer structured types (multi_numeric, matrix, numeric) over forcing a fraction into a one-line MCQ option.',
      ref: { multi_numeric: 5, matrix: 4, numeric: 4, mcq: 4, short: 2, case_study: 1 },
      dominant: 'multi_numeric',
      sections: [
        ['ENCODING RULES (MANDATORY) — WHAT THE RENDERER ACTUALLY SUPPORTS',
         'These rules are not stylistic advice. assets/js/cbt-richtext.js parses exactly\\n' +
         'this subset and draws it as real typeset maths on the candidate screen — real\\n' +
         'stacked fractions with a horizontal bar, real surds, real raised indices, real\\n' +
         'bracketed matrices. Anything outside the subset is shown as plain text, so\\n' +
         'staying inside it is what separates a professional paper from an unreadable one.\\n' +
         '\\n' +
         '1. LINE BREAKS. A CSV cell cannot hold a real newline safely, so write the\\n' +
         '   literal two-character sequence \\\\n. The renderer converts it to a real line\\n' +
         '   break. Use it freely — one equation per line is always clearer than a\\n' +
         '   semicolon-separated run-on.\\n' +
         '   Example: "Solve the simultaneous equations:\\\\n2x + 3y = 12\\\\nx - y = 1"\\n' +
         '   NOTE: \\\\n is safe next to maths commands. \\\\neq still renders as the not-equal\\n' +
         '   sign, because the renderer matches known commands before escapes.\\n' +
         '\\n' +
         '2. FRACTIONS. Always \\\\frac{NUMERATOR}{DENOMINATOR}. Never "3x+6/9", which is\\n' +
         '   ambiguous, and never an ASCII-art bar made of hyphens.\\n' +
         '   Nested and algebraic fractions are supported: \\\\frac{\\\\frac{1}{x}+2}{x-1}\\n' +
         '\\n' +
         '3. INDICES AND SUBSCRIPTS. x^2, e^{2x}, a_1, \\\\log_{10}. Brace anything longer\\n' +
         '   than one character: x^{n+1}, not x^n+1.\\n' +
         '\\n' +
         '4. ROOTS. \\\\sqrt{18} and \\\\sqrt[3]{27}. The index is drawn in the correct place.\\n' +
         '\\n' +
         '5. MATRICES AND DETERMINANTS. Use a real environment — columns separated by &,\\n' +
         '   rows by \\\\\\\\ :\\n' +
         '     \\\\begin{pmatrix} 2 & -1 \\\\\\\\ 3 & 4 \\\\end{pmatrix}   round brackets\\n' +
         '     \\\\begin{bmatrix} ... \\\\end{bmatrix}                square brackets\\n' +
         '     \\\\begin{vmatrix} ... \\\\end{vmatrix}                determinant bars\\n' +
         '   These are drawn as a properly aligned grid with full-height brackets.\\n' +
         '\\n' +
         '6. PIECEWISE AND SYSTEMS. \\\\begin{cases} x^2 & x>0 \\\\\\\\ -x & x\\\\le 0 \\\\end{cases}\\n' +
         '\\n' +
         '7. OPERATORS AND SYMBOLS, by name, not by lookalike character:\\n' +
         '   \\\\times \\\\div \\\\pm \\\\cdot \\\\le \\\\ge \\\\ne \\\\approx \\\\equiv \\\\propto \\\\infty\\n' +
         '   \\\\therefore \\\\because \\\\angle \\\\perp \\\\parallel \\\\to \\\\Rightarrow \\\\degree\\n' +
         '   \\\\sum \\\\prod \\\\int \\\\partial \\\\nabla \\\\lim \\\\log \\\\ln \\\\sin \\\\cos \\\\tan \\\\det\\n' +
         '   Greek by name: \\\\alpha \\\\beta \\\\theta \\\\pi \\\\lambda \\\\mu \\\\sigma \\\\Delta \\\\Omega\\n' +
         '   Write \\\\theta, never the bare character, and never the letter O for zero.\\n' +
         '\\n' +
         '8. WORDS INSIDE MATHS go in \\\\text{...} so they are not italicised letter by\\n' +
         '   letter: \\\\frac{\\\\text{distance}}{\\\\text{time}}\\n' +
         '\\n' +
         '9. DELIMITERS ARE OPTIONAL. $...$ and $$...$$ are honoured if you use them, and\\n' +
         '   $$...$$ centres the expression on its own line — good for a display equation\\n' +
         '   the candidate must read carefully. Bare commands in running prose also work,\\n' +
         '   so you never have to choose between readable prose and correct notation.\\n' +
         '\\n' +
         '10. NEVER paste an image of maths into Col1. Text only. Genuine diagrams\\n' +
         '    (graphs, geometric figures) go in Col14 as {"image":"https://..."}.\\n' +
         '\\n' +
         '11. THE SAME ENCODING APPLIES TO OPTIONS (Cols 2-5), to CorrectAnswer (Col6)\\n' +
         '    and to Explanation (Col7). An option reading \\\\frac{3}{4} is drawn as a\\n' +
         '    real fraction inside its radio button. Do not flatten options to "3/4"\\n' +
         '    while the stem uses \\\\frac — the candidate must see one consistent notation.'],
        ['READ-ALOUD SAFETY',
         'Candidates may ask the platform to read an item aloud, and it speaks the maths\\n' +
         'in words: \\\\frac{3x+6}{9} is read as "the fraction 3x plus 6, over 9". This only\\n' +
         'works if you use the commands above. A fraction typed as "3x+6/9" is read as\\n' +
         '"3x plus 6 divided by 9", which is a DIFFERENT question and would mark a\\n' +
         'listening candidate wrong through no fault of their own.\\n' +
         'Corollary: never rely on layout alone to carry meaning. If a bracket matters,\\n' +
         'write the bracket.'],
        ['TYPE CHOICE',
         'Choose the type that matches the mathematics, not the type that is easiest to\\n' +
         'write. Forcing a multi-step problem into a four-option MCQ tests guessing.\\n' +
         '- Single value → numeric (Col6 the value, Col9 a tolerance, Col10 the unit).\\n' +
         '- Several related blanks (x = ..., y = ...) → multi_numeric, parts in Col14.\\n' +
         '- The same option set applied to several statements → matrix.\\n' +
         '- A method or ordering that must be sequenced → ordering.\\n' +
         '- A graph or geometric figure is genuinely required → image_mcq with a link\\n' +
         '  in Col14 AND a full text description in Col1.'],
        ['TOPIC COVERAGE',
         'Spread items across: algebraic fractions, indices and surds, logarithms,\\n' +
         'exponential equations, simultaneous equations (2x2 and simple 3x3), matrices\\n' +
         'and determinants, polynomials (factor and remainder theorems), differentiation,\\n' +
         'integration, and statistics (mean, median, standard deviation). Tag the\\n' +
         'sub-skill in Col16 so the studio can see which skill a learner is failing.']
      ],
      quality: [
        'Every fraction uses \\\\frac{}{}. A search of the file for a bare "/" between two',
        '  multi-character expressions returns nothing.',
        'Every matrix uses a pmatrix/bmatrix/vmatrix environment, never ASCII brackets.',
        'Every line break inside a cell is the literal \\\\n. No cell is one long run-on.',
        'Stems, options, keys and explanations all use the SAME notation as each other.',
        'Every numeric item states the required form ("give your answer as a simplified',
        '  improper fraction", "correct to 2 decimal places") and has a defensible',
        '  tolerance in Col9 where rounding is possible.',
        'The paper reads correctly when spoken aloud, not only when seen.'
      ]
    },

    /* ------------------------------------------------------------------
       V39 item 3 — IMAGE / DIAGRAM STIMULUS, hardened.

       The old pack rendered correctly but produced weak papers, because it
       told the model WHERE to put a link and almost nothing about what
       makes a figure-based item valid. It never said the link must survive
       an exam hall, never defined the text fallback well enough to be
       gradeable, never mentioned labelling conventions, accessibility, or
       the single most common failure mode in AI-generated diagram papers:
       inventing a figure that does not exist and asking about it anyway.

       This version is written to international item-writing practice
       (Ofqual / Cambridge / WAEC figure conventions, WCAG 1.1.1 and 1.4.1).
       ------------------------------------------------------------------ */
    image_stimulus: {
      label: 'Image / diagram stimulus questions (link-only media)',
      role: 'a chief examiner and diagram editor who builds figure-based papers to international standards — apparatus, circuits, ray diagrams, maps, graphs, data charts, micrographs and cartoons — using LINK-ONLY media, and who knows that a figure-based item is only as good as its text fallback',
      mission: 'Produce a paper in which every figure genuinely carries assessment weight, loads from a public link on a slow mobile connection, and remains completely answerable if the image never loads at all. A figure that is decoration, or a question that collapses when the image fails, is a defective item.',
      ref: { image_mcq: 8, case_study: 3, mcq: 3, numeric: 2, short: 2, hot_text: 2 },
      dominant: 'image_mcq',
      sections: [
        ['THE HONESTY RULE — READ THIS FIRST',
         'You must NEVER invent a URL. A fabricated or guessed link is the single most\\n' +
         'damaging thing you can put in this file: it imports cleanly, passes every\\n' +
         'automated check, and then fails silently in front of a candidate under timed\\n' +
         'conditions.\\n' +
         '\\n' +
         'You therefore have exactly two lawful options for each figure, and you must\\n' +
         'pick one:\\n' +
         '\\n' +
         '  OPTION A — YOU HAVE A REAL, VERIFIABLE LINK.\\n' +
         '  Use it. It must be a stable, public, hotlinkable https image URL from a\\n' +
         '  source that permits direct embedding (Wikimedia Commons, PhET, NASA, NOAA,\\n' +
         '  Our World in Data, openly licensed textbook figures). Put it in Col14 as\\n' +
         '  {"image":"https://..."}.\\n' +
         '\\n' +
         '  OPTION B — YOU DO NOT HAVE ONE. This is the normal case, and it is fine.\\n' +
         '  Put the placeholder token [[FIGURE: short description]] in Col14 as\\n' +
         '  {"image":"[[FIGURE: series circuit, cell, two resistors labelled R1 and R2,\\n' +
         '  ammeter A]]"} and write the figure out IN FULL in Col1 (see the FIGURE\\n' +
         '  DESCRIPTION CONTRACT below). The tutor then pastes their own Drive link over\\n' +
         '  the placeholder in one pass. The item is fully answerable in the meantime.\\n' +
         '\\n' +
         'What you must never do: emit a plausible-looking URL you have not seen, a\\n' +
         'search-results page, a Google Images thumbnail URL, an expiring CDN link, or a\\n' +
         'page URL where an image URL is required.'],
        ['MEDIA RULES (MANDATORY)',
         'This platform never uploads bytes into the free database. Media is always a link.\\n' +
         '\\n' +
         '1. Col14 carries the figure: {"image":"https://..."}. One primary figure per item.\\n' +
         '2. Google Drive links MUST be in direct-view form and shared "anyone with the\\n' +
         '   link":  https://drive.google.com/uc?export=view&id=FILE_ID\\n' +
         '   A /file/d/.../view link renders a Drive PAGE, not an image, and will show the\\n' +
         '   candidate a broken frame.\\n' +
         '3. No link may require a sign-in, a cookie, a referrer, or a redirect. A\\n' +
         '   candidate mid-exam cannot authenticate to anything.\\n' +
         '4. Prefer figures around 800-1400px wide, light background, high contrast,\\n' +
         '   under about 300 KB. Nigerian candidates are frequently on metered mobile data\\n' +
         '   in a hall with weak signal; a 4 MB PNG is an accessibility failure.\\n' +
         '5. Vector-style line art (SVG or clean PNG) beats a photograph of a whiteboard.\\n' +
         '   Never a photograph of handwriting.\\n' +
         '6. If several items share one figure, repeat the SAME link on each of those\\n' +
         '   rows and give them a shared Section value. Do not chain items to "the figure\\n' +
         '   in question 4" — option order and question order can both be randomised.'],
        ['FIGURE DESCRIPTION CONTRACT — THE FALLBACK IS PART OF THE ITEM',
         'Col1 must always begin with a complete prose description of the figure, written\\n' +
         'so that a candidate who never sees the image can still answer correctly and a\\n' +
         'screen reader can read the whole item. This is not a caption; it is the item.\\n' +
         '\\n' +
         'The description must state, in this order:\\n' +
         '  a) What kind of figure it is: "The diagram shows a series circuit...",\\n' +
         '     "The bar chart shows...", "The map shows...".\\n' +
         '  b) Every LABEL that appears on the figure, verbatim, and what each labels.\\n' +
         '  c) Every quantity that can be read off it: axis names WITH units, the scale,\\n' +
         '     the plotted values or the key data points, component values, angles,\\n' +
          '     dimensions. If the candidate must read a value off the figure to answer,\\n' +
         '     that value must appear in the text.\\n' +
         '  d) The orientation or direction that matters: current flow, north arrow,\\n' +
         '     ray direction, time axis left to right.\\n' +
         'Then the actual question, on a new line using \\\\n.\\n' +
         '\\n' +
         'TEST YOUR OWN ITEM: cover the image and read only Col1. If the item is now\\n' +
         'unanswerable, or has become ambiguous, the description has failed and the item\\n' +
         'must be rewritten before it goes in the file.'],
        ['MAKING THE FIGURE CARRY REAL ASSESSMENT WEIGHT',
         'International boards reject "decorative figure" items — items where the picture\\n' +
         'is pleasant but the question could be asked without it. Each figure item here\\n' +
         'must require at least one of these operations on the figure itself:\\n' +
         '  - READ a value at a stated point (a graph ordinate, a meter reading).\\n' +
         '  - COMPARE two labelled parts (which resistor dissipates more power).\\n' +
         '  - TRACE a path or sequence (the ray after refraction, flow through the organ).\\n' +
         '  - IDENTIFY a named structure from its position, not from its colour.\\n' +
         '  - INTERPOLATE or EXTRAPOLATE from plotted data.\\n' +
         '  - SPOT the error or the anomaly deliberately placed in the setup.\\n' +
         'Tag the operation in Col16 (read, compare, trace, identify, interpolate, spot).\\n' +
         '\\n' +
         'Stems must never say "the diagram below" or "the figure above". On a phone,\\n' +
         'one card at a time, there is no above and no below. Say "the diagram shown".'],
        ['ACCESSIBILITY AND FAIRNESS (WCAG 1.1.1 AND 1.4.1)',
         '1. COLOUR IS NEVER THE ONLY CUE. Roughly 1 in 12 male candidates has a colour\\n' +
         '   vision deficiency. Never "the red curve"; always "curve P (the red one)".\\n' +
         '   Options must refer to letter or number labels: P, Q, R, S or 1, 2, 3, 4.\\n' +
         '2. Never require a candidate to measure the printed figure with a ruler or to\\n' +
         '   judge an angle by eye — screen sizes differ, so the same item would be a\\n' +
         '   different difficulty on a phone and on a laptop. State the dimensions.\\n' +
         '3. Never require the candidate to zoom to read a value. If it must be read, it\\n' +
         '   is also in the text.\\n' +
         '4. Culturally neutral and locally recognisable stimuli where possible: Nigerian\\n' +
         '   rainfall data, a NEPA-style meter, local road signs. Avoid stimuli that\\n' +
         '   assume travel, snow, or unfamiliar branded equipment.\\n' +
         '5. Text baked into the image is invisible to read-aloud. Anything the candidate\\n' +
         '   must read is repeated in Col1.'],
        ['SUBJECT FIT',
         'Physics: circuits, ray and wave diagrams, force and free-body diagrams, graphs\\n' +
         'of motion. Chemistry: apparatus and distillation setups, molecular structures,\\n' +
         'titration curves, the periodic-table block. Biology: labelled specimens,\\n' +
         'micrographs, food webs, dichotomous keys, cycles. Mathematics: coordinate\\n' +
         'graphs, geometric figures with marked angles, transformations, Venn diagrams,\\n' +
         'statistical charts. Geography: contour and relief maps, climate graphs,\\n' +
         'population pyramids, cross-sections. Economics and Business: supply-and-demand\\n' +
         'curves, cost curves, annotated financial charts. Literature and Government:\\n' +
         'political cartoons, campaign posters, photographs of events. ICT: interface\\n' +
         'screenshots, flowcharts, network topologies, ER diagrams.'],
        ['CSV SHAPE FOR THIS PACK',
         'Col1  = full figure description, then \\\\n, then the question.\\n' +
         'Col2-5 = options referring to figure LABELS, in a sensible order.\\n' +
         'Col6  = the key, written in full words, never a bare letter.\\n' +
         'Col7  = the explanation, following the universal EXPLANATION STANDARD above,\\n' +
         '        and naming the exact label on the figure that decides each option.\\n' +
         'Col8  = image_mcq (or image_based / case_study where a figure feeds several\\n' +
         '        questions).\\n' +
         'Col14 = {"image":"https://..."} or the [[FIGURE: ...]] placeholder.\\n' +
         'Col16 = the figure operation tag plus the topic.\\n' +
         'Col17 = the subject.']
      ],
      quality: [
        'Every figure item has EITHER a real verifiable https/Drive-direct link OR an',
        '  explicit [[FIGURE: ...]] placeholder. No invented URLs anywhere in the file.',
        'Every figure item is fully answerable with the image hidden. Verified by reading',
        '  Col1 alone.',
        'Every label mentioned in an option appears in the Col1 description.',
        'No option distinguishes anything by colour alone.',
        'No stem says "below", "above", "opposite" or "on the previous page".',
        'Every figure requires a named operation (read, compare, trace, identify,',
        '  interpolate, spot) — no decorative figures.',
        'Every axis, scale and unit a candidate must use appears in the text.',
        'No link needs a login, and no Drive link is in /file/d/.../view form.',
        'Explanations name the specific labelled part that makes each wrong option wrong.'
      ],
      checks: [
        'Grep the file for "drive.google.com/file/d" — there must be zero matches.',
        'Grep for "google.com/search", "bing.com", "encrypted-tbn" — zero matches.',
        'Every Col14 image value starts with "https://" or with "[[FIGURE:".',
        'Every image row\'s Col1 is at least 40 words before the question begins.'
      ]
    },

    /* ==================================================================
       V39 item 5 — PASSAGE-SET / STIMULUS-SET BLUEPRINT.

       Reported: an UTME/JAMB-style English pack was needed in which the
       comprehension passage STAYS ON SCREEN until every question under it
       is answered — "but it must not be limited to English; make it
       all-inclusive across subjects."

       So this is the generic engine and utme_english below is one dialect
       of it. The same shape serves a Physics experiment description, a
       Government constitutional extract, an Economics data table, a
       History source, a Literature scene or a Biology case.

       HOW THE PINNING ACTUALLY WORKS (why the CSV shape below matters)
       cbt-exam.html groups questions by CBT.passageKey(), which is the
       passage_id if one is given and otherwise a hash of the passage TEXT.
       Every row in a set therefore has to repeat the passage byte for
       byte, or the set silently splits into several one-question sets and
       the passage flickers. Repeating it is not redundancy; it is the join
       key. The runtime then paints the passage ONCE into a sticky pane
       above the card, keeps it there for the whole set, and shows a live
       "3 of 5 answered" counter, so it cannot go away while questions
       under it are outstanding.
       ================================================================== */
    passage_set: {
      label: 'Passage / stimulus set — pinned stimulus, any subject',
      role: 'a chief examiner who builds stimulus-based sets to international standards, where one shared passage, source, data table, experiment description or extract feeds a block of dependent questions',
      mission: 'Produce a paper built from STIMULUS SETS. Each set is one shared stimulus plus a block of questions that all depend on it, encoded so the platform can pin the stimulus on screen for the whole set. This blueprint is subject-neutral: the stimulus may be a prose passage, a data table, an experimental method, a legal or constitutional extract, a historical source, a dialogue, a code listing or a case file.',
      ref: { case_study: 10, mcq: 6, short: 2, hot_text: 2, ordering: 1, essay: 1 },
      dominant: 'case_study',
      minOne: true,
      sections: [
        ['THE SET CONTRACT — HOW A STIMULUS GETS PINNED',
         'A "set" is one stimulus plus every question that depends on it.\\n' +
         '\\n' +
         '1. Give every set a short stable id and put it in Col16 (Tags) as\\n' +
         '   set:SETID — for example  set:P1  or  set:SOURCE-A.\\n' +
         '\\n' +
         '2. Put the FULL stimulus in Col14 as {"passage":"..."} on EVERY row of that\\n' +
         '   set, character for character identical. This is the join key the platform\\n' +
         '   groups on. If row 3 differs from row 1 by even one space, the platform\\n' +
         '   treats it as a second, separate stimulus and the pinned pane will change\\n' +
         '   underneath the candidate. Copy and paste it; do not retype it.\\n' +
         '\\n' +
         '3. Put the same section name in Col17 for the whole set, e.g.\\n' +
         '   "English - Comprehension Passage 1".\\n' +
         '\\n' +
         '4. Keep the rows of a set CONTIGUOUS and in their intended order. The platform\\n' +
         '   shuffles sets as whole blocks and never reorders within a set, so question 3\\n' +
         '   may safely build on question 2.\\n' +
         '\\n' +
         '5. Do NOT also copy the stimulus into Col1. Col1 is the question alone. The\\n' +
         '   stimulus is displayed once, above the card, and repeating it inside every\\n' +
         '   card would make the candidate scroll past the whole passage five times.\\n' +
         '\\n' +
         '6. A stimulus set should carry 4 to 8 questions. Fewer than 3 wastes the\\n' +
         '   candidate\'s reading time; more than 8 turns one topic into the whole paper.'],
        ['WRITING THE STIMULUS',
         'The stimulus must be self-contained, original or safely paraphrased, and long\\n' +
         'enough to sustain its questions but short enough to read on a phone.\\n' +
         '\\n' +
         '  Prose passage: 250-450 words. Three to five paragraphs. Use \\\\n\\\\n between\\n' +
         '  paragraphs so the pinned pane shows real paragraph breaks.\\n' +
         '  Data table or figures: state every unit and the source year.\\n' +
         '  Experimental method: apparatus, procedure, results table, stated conditions.\\n' +
         '  Extract or source: give provenance — who wrote it, when, and for whom, since\\n' +
         '  provenance questions are the whole point of a source-based item.\\n' +
         '  Dialogue or scene: label speakers consistently.\\n' +
         '  Code listing: number the lines, so a question can name line 7.\\n' +
         '\\n' +
         'COPYRIGHT: never reproduce a copyrighted passage. Write an original one on the\\n' +
         'same theme, or use a public-domain or openly licensed text and say so.\\n' +
         '\\n' +
         'CONTEXT: prefer settings a Nigerian and international learner both recognise.\\n' +
         'Never make the answer depend on knowledge outside the stimulus unless the item\\n' +
         'is explicitly testing recall.'],
        ['DESIGNING THE QUESTION BLOCK — A COGNITIVE LADDER',
         'A set must climb, not sit on one rung. Across each set of questions include:\\n' +
         '  1. RETRIEVAL     — locate a stated fact. At most one per set.\\n' +
         '  2. VOCABULARY    — meaning of a word or phrase AS USED in the stimulus.\\n' +
         '                     Always quote the word with its line or paragraph.\\n' +
         '  3. INFERENCE     — what follows but is not stated.\\n' +
         '  4. PURPOSE/TONE  — why the writer did something, or the attitude conveyed.\\n' +
         '  5. STRUCTURE     — the function of a paragraph, a contrast, a transition.\\n' +
         '  6. EVALUATION    — reliability, bias, sufficiency of the evidence.\\n' +
         '  7. SYNTHESIS     — summary, main idea, or a title for the stimulus.\\n' +
         'In science and data sets, substitute: read a value, process the data,\\n' +
         'identify the control variable, evaluate the method, predict, and conclude.\\n' +
         '\\n' +
         'Every question must be answerable from the stimulus alone, and every question\\n' +
         'must genuinely need it. If a question could be answered without reading the\\n' +
         'stimulus, it does not belong in the set — move it out as a standalone item.\\n' +
         '\\n' +
         'Questions must not chain by NUMBER. Never "as in question 2". Sets are\\n' +
         'shuffled as blocks and a candidate may answer in any order; refer to the\\n' +
         'stimulus itself instead ("in the third paragraph").'],
        ['MIXING SETS WITH STANDALONE ITEMS',
         'A realistic paper is part sets, part standalone. Leave Col14 empty and Col16\\n' +
         'without a set: tag on a standalone item; the platform then shows no pinned\\n' +
         'pane for it. Order the file so that each set is contiguous, and put standalone\\n' +
         'items in their own run rather than interleaving them into a set.'],
        ['WORKED SHAPE OF ONE SET (5 rows, abbreviated)',
         'Row 1  Col1: "What is the main idea of the passage?"\\n' +
         '       Col14: {"passage":"<the full 300-word passage>"}   Col16: set:P1\\n' +
         '       Col17: English - Comprehension Passage 1\\n' +
         'Row 2  Col1: "As used in the second paragraph, \\"resilient\\" most nearly means"\\n' +
         '       Col14: {"passage":"<the SAME full passage, byte for byte>"}\\n' +
         '       Col16: set:P1     Col17: English - Comprehension Passage 1\\n' +
         'Rows 3-5 continue identically, climbing the ladder above.']
      ],
      quality: [
        'Every set repeats its stimulus byte for byte in Col14 on every one of its rows.',
        'Every set shares one set:ID tag in Col16 and one Section value in Col17.',
        'Rows of a set are contiguous and in a deliberate order.',
        'No question in a set is answerable without the stimulus.',
        'No question refers to another question by number.',
        'The stimulus never appears in Col1.',
        'Each set spans at least four different cognitive levels, not four retrieval',
        '  questions wearing different clothes.',
        'Every vocabulary item quotes the exact word and its location in the stimulus.',
        'No copyrighted text is reproduced.'
      ],
      checks: [
        'Rows sharing a set: tag have IDENTICAL Col14 passage text — compare them.',
        'Every set has between 4 and 8 rows.',
        'No Col1 in a set is longer than the stimulus it belongs to.'
      ]
    },

    /* ------------------------------------------------------------------
       V39 item 5 — the UTME / JAMB English dialect of passage_set.
       ------------------------------------------------------------------ */
    utme_english: {
      label: 'UTME / JAMB English — full paper (comprehension, summary, lexis, structure)',
      role: 'a JAMB-experienced Chief Examiner in Use of English who has set and moderated UTME papers, and who knows the exact section structure, register and difficulty curve candidates meet on the day',
      mission: 'Produce a complete UTME-style Use of English paper covering Comprehension, Summary, Lexis (synonyms, antonyms, word meaning in context), Structure (grammar and sentence interpretation), and Oral Forms (stress and vowel/consonant sounds). Comprehension and Summary must be built as PINNED PASSAGE SETS so the passage stays on the candidate screen for every question that depends on it.',
      ref: { case_study: 12, mcq: 20, short: 2, hot_text: 2 },
      dominant: 'mcq',
      minOne: true,
      sections: [
        ['UTME PAPER STRUCTURE — BUILD THE SECTIONS IN THIS ORDER',
         'Use Col17 (Section) exactly as named here. The platform renders these as the\\n' +
         'candidate\'s section tabs and uses them to group the pinned passages.\\n' +
         '\\n' +
         '  1. "English - Comprehension Passage 1"   one passage, 5-6 questions\\n' +
         '  2. "English - Comprehension Passage 2"   a second passage, 5-6 questions\\n' +
         '  3. "English - Summary"                   one passage, 4-5 questions\\n' +
         '  4. "English - Lexis"                     synonyms, antonyms, word in context\\n' +
         '  5. "English - Structure"                 grammar, sentence interpretation\\n' +
         '  6. "English - Oral Forms"                stress and sounds\\n' +
         '\\n' +
         'Scale each section proportionally to the number of items requested, but never\\n' +
         'drop Comprehension or Summary: those are the sections the pinned-passage\\n' +
         'behaviour exists for.'],
        ['COMPREHENSION AND SUMMARY — THE PINNED PASSAGE (MANDATORY)',
         'Apply the passage-set contract in full:\\n' +
         '  - The FULL passage goes in Col14 as {"passage":"..."} on EVERY row of that\\n' +
         '    section, identical byte for byte. This is the key the platform groups on,\\n' +
         '    and it is what keeps the passage on screen for the whole block instead of\\n' +
         '    vanishing when the candidate moves to the next question.\\n' +
         '  - Col16 carries set:C1, set:C2, set:S1 for the three sets.\\n' +
         '  - Col1 is the question ALONE. Never paste the passage into Col1.\\n' +
         '  - Keep each set contiguous and in order.\\n' +
         '\\n' +
         'Passage length: comprehension 350-450 words; summary 300-400 words. Write\\n' +
         'ORIGINAL passages in authentic UTME register — expository or argumentative\\n' +
         'prose on education, health, technology, environment, governance, agriculture\\n' +
         'or culture, in a Nigerian or pan-African setting. Paragraphs separated by \\\\n\\\\n.\\n' +
         'Never reproduce a copyrighted passage.\\n' +
         '\\n' +
         'Comprehension questions follow the UTME pattern: main idea, a stated detail,\\n' +
         'an inference, the writer\'s attitude or tone, the function of a paragraph, and\\n' +
         'one "as used in the passage" vocabulary item that quotes the word and names\\n' +
         'its paragraph.\\n' +
         '\\n' +
         'Summary questions follow the JAMB phrasing exactly: "In three sentences, one\\n' +
         'for each, state..." rendered as MCQ options where the candidate selects the\\n' +
         'best summary sentence, plus items asking for the main point of a named\\n' +
         'paragraph. Distractors must be true-but-not-the-point, or too broad, or too\\n' +
         'narrow — the three classic summary traps — and Col7 must name which trap each\\n' +
         'distractor is.'],
        ['LEXIS AND STRUCTURE',
         'LEXIS. Three sub-styles, all four options, one key:\\n' +
         '  - "Choose the option NEAREST IN MEANING to the word or phrase in italics."\\n' +
         '    Put the target word in CAPITALS inside the stem, since CSV cannot italicise.\\n' +
         '  - "Choose the option OPPOSITE IN MEANING..."\\n' +
         '  - Word used in context, where the same word has a different sense elsewhere.\\n' +
         'Distractors must be real words at the same register and roughly the same\\n' +
         'frequency. A distractor no candidate would ever pick is a wasted option and\\n' +
         'turns a 4-option item into a 3-option one.\\n' +
         '\\n' +
         'STRUCTURE. Cover: concord, tense and sequence of tenses, prepositions and\\n' +
         'phrasal verbs, question tags, conditionals, active/passive, reported speech,\\n' +
         'clause and phrase function, and sentence interpretation ("Which of the\\n' +
         'following is nearest in meaning to...?"). Include a small number of Nigerian\\n' +
         'English interference points that UTME reliably tests, and say in Col7 why the\\n' +
         'common local form is not the standard one — that explanation is the most\\n' +
         'useful teaching in the whole section.'],
        ['ORAL FORMS',
         'Oral English is a written test of sound knowledge, so encode it in text:\\n' +
         '  - STRESS: "In the following word, the syllable that bears the primary stress\\n' +
         '    is..." with options as the syllables written out, e.g. PHO-to-graph.\\n' +
         '  - EMPHATIC STRESS: give a sentence with one word in CAPITALS and ask which\\n' +
         '    question it answers.\\n' +
         '  - VOWELS AND CONSONANTS: "Choose the option that has the same vowel sound as\\n' +
         '    the CAPITALISED word." Never rely on a phonetic symbol the candidate\\n' +
         '    device may not render — always give a keyword too, e.g. /i:/ as in SEE.\\n' +
         '  - RHYME: choose the word that rhymes with the capitalised one.\\n' +
         'Col7 must explain the sound, spell out the phonetic value with a keyword, and\\n' +
         'say why each distractor has a different sound. Do not assume the candidate can\\n' +
         'hear anything: this section is read on screen, and may be read aloud by the\\n' +
         'platform, so the item must survive being spoken.'],
        ['DIFFICULTY, KEYS AND FAIRNESS',
         'Difficulty curve across the paper: roughly 30% easy, 50% moderate, 20% hard,\\n' +
         'declared honestly in Col15. Distribute the key across A, B, C and D as evenly\\n' +
         'as the content allows; never let one letter carry more than about a third of\\n' +
         'the keys. Every item has exactly ONE defensible answer — if two options can be\\n' +
         'argued, rewrite the item. Options within an item should be similar in length;\\n' +
         'a conspicuously longest option is a giveaway that rewards test-wiseness rather\\n' +
         'than English.']
      ],
      quality: [
        'Comprehension and Summary sections repeat their full passage in Col14 on every',
        '  one of their rows, byte for byte, so the passage stays pinned for the set.',
        'No passage text appears in Col1.',
        'Each passage set is contiguous, carries one set: tag, and has 4-6 questions.',
        'Every "as used in the passage" item quotes the exact word and names its paragraph.',
        'Summary distractors are the three classic traps and Col7 names which is which.',
        'Lexis distractors are real words of comparable register and frequency.',
        'Oral Forms items always pair a phonetic value with a keyword.',
        'Passages are original, in authentic UTME register, Nigerian or pan-African in',
        '  setting, and free of copyrighted material.',
        'Keys are spread across A-D; no letter dominates.',
        'Every explanation follows the four-move standard and is written to teach, since',
        '  many candidates will use this paper as their only revision feedback.'
      ],
      checks: [
        'Col17 uses only the six section names listed above.',
        'Every Comprehension/Summary row has a non-empty Col14 passage.',
        'Rows within one set have byte-identical Col14 values.',
        'No option letter holds more than 35% of the keys.'
      ]
    },

    stem_combo: {
      label: 'Mixed multi-line + image paper',
      role: 'an assessment architect building a realistic mixed paper for ADEWALE CLASSROOM (WAEC/IGCSE/SAT style) that combines diagram items with multi-line algebra',
      mission: 'Half the paper uses diagrams via media_url links; half uses multi-line mathematical encoding. The CSV must import cleanly into Quizzes and display without confusion on phones.',
      ref: { image_mcq: 5, multi_numeric: 4, matrix: 3, numeric: 3, mcq: 3, case_study: 2 },
      dominant: 'image_mcq',
      sections: [
        ['BLEND', 'Alternate diagram items and multi-line calculation items so a candidate cannot skip a skill area.'],
        ['ENCODING', 'Apply the multiline_math encoding rules AND the image_stimulus media rules together. Never put both a huge matrix and a huge diagram in the same stem without a clear \"Refer to Figure 1\" / \"Refer to the matrix\" split.']
      ],
      quality: [
        'Both media_url items and \\\\frac/matrix items appear.',
        'Mobile-friendly: stems under 40 words excluding the expression block.',
        'CSV validates against the platform headers (question,type,a,b,c,d,answer,mark,explanation,passage,media_url,…).'
      ]
    },

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
        ['SUBJECTS AND THEIR TOPICS', 'Cover these subjects: {{SUBJECTS}}\n{{SUBJECT_TOPICS}}\nDivide the items as evenly as possible between them.'],
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

    /* ITEM 5 — each subject may carry its own topic. Without this every
       subject in a multi-subject paper inherited one shared topic, which is
       nonsensical: "Quadratic equations" is not a topic in English. */
    const st = extra.subjectTopics || {};
    const stLines = Object.keys(st).length
      ? 'Use these topics, one per subject — do NOT apply one topic to all:\n' +
        Object.keys(st).map(function (k) { return '  - ' + k + ': ' + st[k]; }).join('\n')
      : 'No per-subject topic was given, so choose a representative core topic for each subject.';

    const fill = (s) => String(s)
      .replace(/\{\{BOARD\}\}/g, board)
      .replace(/\{\{SOURCE\}\}/g, source)
      .replace(/\{\{SUBJECT_TOPICS\}\}/g, stLines)
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
      'Col17 is the subject on every row.',
      /* V39 item 6 — the explanation standard is only real if it is checked. */
      'EVERY row\'s Col7 contains all four moves: verdict in words, numbered',
      '   reasoning, a named misconception for EACH wrong option, and a takeaway.',
      'No Col7 is under 45 words. No Col7 says only "Option X is correct".',
      'No Col7 refers to another question, to "the above", or to notes the',
      '   learner does not have in front of them.',
      'Col7 names the correct answer in WORDS, never by letter alone, because',
      '   option order can be randomised per candidate.'
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
rule + '\nEXPLANATION STANDARD — APPLIES TO EVERY ROW, EVERY TYPE\n' + rule + '\n' +
this.EXPLANATION_STANDARD + '\n\n' +
sections + '\n\n' +
rule + '\nQUALITY BAR FOR THIS PACK — an item failing any of these is rejected\n' + rule + '\n' +
quality + '\n\n' +
rule + '\nFINAL CHECK BEFORE YOU ANSWER\n' + rule + '\n' + checks;
  }
};
window.CBT = CBT;
