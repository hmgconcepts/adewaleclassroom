/* ============================================================================
   cbt-types.js — advanced question-type renderers and graders
   ----------------------------------------------------------------------------
   Modelled on HMG Academy CBT Pro (cbtsystem-hmgacademy.vercel.app), whose
   student portal renders each question type with a purpose-built control
   rather than forcing everything into radio buttons. Tutoring Connect already
   declared 17+ types but rendered most of them as a plain text box, so a
   matching question looked identical to a short-answer question.

   This file supplies a real control per type, and a matching grader, and is
   PURELY ADDITIVE: CBT.renderQuestion falls back to its original behaviour for
   anything not handled here, so no existing paper changes behaviour.

   The seventeen families, and what the learner actually sees:

     mcq / image_mcq / case_study / assertion_reason / scenario_mcq
                        — tappable option cards, with a passage or image or
                          assertion/reason block above where relevant
     multi_select (mrq) — tappable cards with checkboxes and a "pick N" hint
     true_false         — two large cards
     short_answer       — single line with an accepted-answers hint
     numeric            — number input with unit and tolerance shown
     multi_numeric      — one labelled input per sub-part, partial credit
     cloze / fill_blank — the sentence itself, with inputs inline at each ___
     matching           — left column fixed, right column a dropdown per row,
                          the right-hand pool shuffled once and remembered
     ordering           — a drag-and-drop list, with ↑ ↓ buttons as the
                          keyboard- and touch-accessible equivalent
     categorization     — one row per item, a category dropdown per row
     matrix             — one row per statement, shared options across rows
     hot_text           — the passage broken into tappable chips
     essay              — textarea with a live word count against the minimum
     code               — monospace textarea with the expected language shown

   Scoring is rule-based and transparent. No AI API is used anywhere: partial
   credit is arithmetic, and essay/code marking is keyword and word-count
   matching that a tutor can see and override.
   ========================================================================== */
(function (w, d) {
  'use strict';

  var esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /* Parse a field that may arrive as JSON text, an array, or a pipe list. */
  function parseList(v) {
    if (v == null || v === '') return [];
    if (Array.isArray(v)) return v;
    if (typeof v === 'object') return Object.values(v);
    var s = String(v).trim();
    if (s.charAt(0) === '[' || s.charAt(0) === '{') {
      try {
        var p = JSON.parse(s);
        return Array.isArray(p) ? p : [p];
      } catch (e) { /* fall through to delimiter parsing */ }
    }
    return s.split(/\s*[|;]\s*/).filter(Boolean);
  }

  function parseObj(v) {
    if (!v) return {};
    if (typeof v === 'object' && !Array.isArray(v)) return v;
    try { var p = JSON.parse(String(v)); return (p && typeof p === 'object') ? p : {}; }
    catch (e) { return {}; }
  }

  /* A deterministic shuffle seeded by the question id, so the right-hand pool
     of a matching question is the same every time the learner returns to it.
     A fresh Math.random() shuffle on each repaint would move the options
     under the learner's finger. */
  function seededShuffle(arr, seed) {
    var a = arr.slice(), s = 0, i, j, t;
    String(seed || '').split('').forEach(function (c) { s = (s * 31 + c.charCodeAt(0)) & 0x7fffffff; });
    var rnd = function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    for (i = a.length - 1; i > 0; i--) { j = Math.floor(rnd() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  var TYPES = {

    /* ---------------- option-card families ---------------- */
    _optionCards: function (q, name, multi) {
      var opts = q.options || [];
      if (!opts.length) return '<p class="tcq-warn">⚠️ This question has no options defined.</p>';
      var hint = multi
        ? '<div class="tcq-hint">Select <b>all</b> that apply' +
          (q.max_choices ? ' — up to ' + q.max_choices : '') + '.</div>'
        : '';
      return hint + '<div class="tcq-opts">' + opts.map(function (o, i) {
        var letter = String.fromCharCode(65 + i);
        return '<label class="tcq-opt">' +
          '<input type="' + (multi ? 'checkbox' : 'radio') + '" name="' + esc(name) + '" ' +
            'value="' + esc(o) + '">' +
          '<span class="tcq-letter">' + letter + '</span>' +
          '<span class="tcq-optext">' + esc(o) + '</span>' +
        '</label>';
      }).join('') + '</div>';
    },

    mcq: function (q, name) { return TYPES._optionCards(q, name, false); },
    multi_select: function (q, name) { return TYPES._optionCards(q, name, true); },

    true_false: function (q, name) {
      return '<div class="tcq-opts tcq-tf">' + ['True', 'False'].map(function (o, i) {
        return '<label class="tcq-opt tcq-tf-opt">' +
          '<input type="radio" name="' + esc(name) + '" value="' + o + '">' +
          '<span class="tcq-letter">' + (i ? '✗' : '✓') + '</span>' +
          '<span class="tcq-optext">' + o + '</span></label>';
      }).join('') + '</div>';
    },

    /* An assertion/reason pair, then the five standard options. */
    assertion_reason: function (q, name) {
      var it = parseObj(q.items || q.pairs);
      var a = it.assertion || (q.options || [])[0] || '';
      var r = it.reason || (q.options || [])[1] || '';
      var std = [
        'Both Assertion and Reason are true, and the Reason correctly explains the Assertion',
        'Both are true, but the Reason does NOT correctly explain the Assertion',
        'The Assertion is true, the Reason is false',
        'The Assertion is false, the Reason is true',
        'Both the Assertion and the Reason are false'
      ];
      var opts = (q.options && q.options.length >= 3) ? q.options : std;
      return (a || r ? '<div class="tcq-ar">' +
          (a ? '<div class="tcq-ar-row"><span class="tcq-ar-tag">Assertion</span><span>' + esc(a) + '</span></div>' : '') +
          (r ? '<div class="tcq-ar-row"><span class="tcq-ar-tag tcq-ar-reason">Reason</span><span>' + esc(r) + '</span></div>' : '') +
        '</div>' : '') +
        TYPES._optionCards({ options: opts }, name, false);
    },

    /* A passage or scenario, then a normal choice question. */
    case_study: function (q, name) {
      var it = parseObj(q.items);
      var passage = q.passage || it.passage || it.text || '';
      return (passage ? '<div class="tcq-passage"><div class="tcq-passage-tag">Read this first</div>' +
        esc(passage).replace(/\n/g, '<br>') + '</div>' : '') +
        TYPES._optionCards(q, name, false);
    },

    /* A diagram, then a normal choice question. Links only — never uploads. */
    image_based: function (q, name) {
      var it = parseObj(q.items);
      var src = q.media_url || q.image || it.image || q.accept || '';
      return (src ? '<div class="tcq-figure"><img src="' + esc(src) + '" alt="Question figure" ' +
        'loading="lazy" onerror="this.closest(\'.tcq-figure\').innerHTML=' +
        '&quot;<p class=\'tcq-warn\'>⚠️ The figure for this question could not load. ' +
        'Answer from the text below.</p>&quot;"></div>' : '') +
        TYPES._optionCards(q, name, false);
    },

    /* ---------------- typed families ---------------- */
    short_answer: function (q, name) {
      var acc = parseList(q.accepted_answers || q.accept);
      return '<input class="tcq-input" type="text" name="' + esc(name) + '" autocomplete="off" ' +
        'placeholder="Type your answer">' +
        (acc.length > 1 ? '<div class="tcq-hint">Spelling variations are accepted.</div>' : '');
    },

    numeric: function (q, name) {
      var unit = q.unit || '';
      var tol = q.tolerance;
      return '<div class="tcq-numwrap">' +
        '<input class="tcq-input tcq-num" type="text" inputmode="decimal" name="' + esc(name) + '" ' +
          'placeholder="Enter a number">' +
        (unit ? '<span class="tcq-unit">' + esc(unit) + '</span>' : '') +
      '</div>' +
      (tol ? '<div class="tcq-hint">Answers within ±' + esc(tol) + ' are accepted.</div>'
           : '<div class="tcq-hint">Give the number only — no words.</div>');
    },

    multi_numeric: function (q, name) {
      var parts = parseList(q.items);
      if (!parts.length) return TYPES.numeric(q, name);
      return '<div class="tcq-hint">Answer <b>each</b> part. Marks are given part by part.</div>' +
        '<div class="tcq-parts">' + parts.map(function (p, i) {
          var label = (typeof p === 'object' ? (p.label || p.name) : p) || ('Part ' + (i + 1));
          var unit = (typeof p === 'object' && p.unit) ? p.unit : '';
          return '<div class="tcq-part">' +
            '<label class="tcq-part-label">' + esc(label) + '</label>' +
            '<input class="tcq-input tcq-num" type="text" inputmode="decimal" ' +
              'name="' + esc(name) + '__' + i + '" placeholder="Answer">' +
            (unit ? '<span class="tcq-unit">' + esc(unit) + '</span>' : '') +
          '</div>';
        }).join('') + '</div>';
    },

    /* The sentence with real inputs sitting where each ___ appeared. */
    cloze: function (q, name) {
      var text = String(q.question || '');
      var blanks = (text.match(/_{2,}/g) || []).length;
      var answers = parseList(q.items || q.accepted_answers);
      if (!blanks) blanks = Math.max(answers.length, 1);
      var i = 0;
      var withInputs = text.replace(/_{2,}/g, function () {
        var box = '<input class="tcq-input tcq-blank" type="text" autocomplete="off" ' +
          'name="' + esc(name) + '__' + i + '" placeholder="' + (i + 1) + '">';
        i++;
        return box;
      });
      if (i === 0) {
        withInputs += '<div class="tcq-parts">' + Array.apply(null, Array(blanks)).map(function (_, k) {
          return '<div class="tcq-part"><label class="tcq-part-label">Blank ' + (k + 1) + '</label>' +
            '<input class="tcq-input" type="text" name="' + esc(name) + '__' + k + '"></div>';
        }).join('') + '</div>';
      }
      return '<div class="tcq-cloze">' + withInputs + '</div>' +
        '<div class="tcq-hint">Fill every blank. Capitalisation does not matter.</div>';
    },

    essay: function (q, name) {
      var cfg = parseObj(q.items);
      var min = cfg.min_words || q.min_words || 0;
      return '<textarea class="tcq-textarea" name="' + esc(name) + '" rows="8" ' +
        'placeholder="Write your answer in full sentences."></textarea>' +
        '<div class="tcq-hint"><span data-wordcount="' + esc(name) + '">0 words</span>' +
        (min ? ' · at least <b>' + min + '</b> expected' : '') +
        ' · marked on the points you make, then reviewed by your tutor.</div>';
    },

    code: function (q, name) {
      var cfg = parseObj(q.items);
      var lang = cfg.language || q.unit || 'code';
      return '<div class="tcq-hint">Write your answer in <b>' + esc(lang) + '</b>. ' +
        'Indentation is preserved.</div>' +
        '<textarea class="tcq-textarea tcq-code" name="' + esc(name) + '" rows="10" spellcheck="false" ' +
        'placeholder="// your ' + esc(lang) + ' here"></textarea>';
    },

    /* ---------------- structured families ---------------- */
    matching: function (q, name) {
      var pairs = parseList(q.pairs || q.items).map(function (p) {
        return (typeof p === 'object') ? p : { left: p, right: '' };
      }).filter(function (p) { return p.left; });
      if (!pairs.length) return '<p class="tcq-warn">⚠️ No matching pairs defined for this question.</p>';
      var rights = pairs.map(function (p) { return p.right; }).filter(Boolean);
      parseList(q.distractors || q.accept).forEach(function (dx) { rights.push(dx); });
      var pool = seededShuffle(rights, q.id || name);
      return '<div class="tcq-hint">Choose the item on the right that belongs with each item on the left.</div>' +
        '<table class="tcq-match">' + pairs.map(function (p, i) {
          return '<tr>' +
            '<td class="tcq-match-left">' + esc(p.left) + '</td>' +
            '<td class="tcq-match-arrow">→</td>' +
            '<td><select class="tcq-select" name="' + esc(name) + '__' + i + '">' +
              '<option value="">— choose —</option>' +
              pool.map(function (r) { return '<option value="' + esc(r) + '">' + esc(r) + '</option>'; }).join('') +
            '</select></td></tr>';
        }).join('') + '</table>';
    },

    ordering: function (q, name) {
      var items = parseList(q.items || q.options);
      if (!items.length) return '<p class="tcq-warn">⚠️ No items defined for this ordering question.</p>';
      var shown = seededShuffle(items, q.id || name);
      return '<div class="tcq-hint">Drag into the correct order, or use the ↑ ↓ buttons. ' +
        'You get a mark for every item in the right place.</div>' +
        '<ul class="tcq-order" data-order="' + esc(name) + '">' + shown.map(function (it) {
          return '<li class="tcq-order-item" draggable="true" data-val="' + esc(it) + '">' +
            '<span class="tcq-order-handle" aria-hidden="true">⠿</span>' +
            '<span class="tcq-order-num"></span>' +
            '<span class="tcq-order-text">' + esc(it) + '</span>' +
            '<span class="tcq-order-btns">' +
              '<button type="button" class="tcq-mini" data-up aria-label="Move up">↑</button>' +
              '<button type="button" class="tcq-mini" data-down aria-label="Move down">↓</button>' +
            '</span></li>';
        }).join('') + '</ul>' +
        '<input type="hidden" name="' + esc(name) + '">';
    },

    categorization: function (q, name) {
      var rows = parseList(q.items);
      if (!rows.length) return '<p class="tcq-warn">⚠️ No items defined for this question.</p>';
      var cats = [];
      rows.forEach(function (r) {
        var c = (typeof r === 'object') ? r.category : null;
        if (c && cats.indexOf(c) === -1) cats.push(c);
      });
      parseList(q.accept).forEach(function (c) { if (cats.indexOf(c) === -1) cats.push(c); });
      cats.sort();
      return '<div class="tcq-hint">Put each item into the category it belongs to.</div>' +
        '<table class="tcq-match">' + rows.map(function (r, i) {
          var item = (typeof r === 'object') ? (r.item || r.label) : r;
          return '<tr><td class="tcq-match-left">' + esc(item) + '</td>' +
            '<td class="tcq-match-arrow">→</td>' +
            '<td><select class="tcq-select" name="' + esc(name) + '__' + i + '">' +
              '<option value="">— choose a category —</option>' +
              cats.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('') +
            '</select></td></tr>';
        }).join('') + '</table>';
    },

    matrix: function (q, name) {
      var rows = parseList(q.items);
      if (!rows.length) return '<p class="tcq-warn">⚠️ No rows defined for this question.</p>';
      var opts = parseList(q.accept);
      if (!opts.length) opts = ['True', 'False'];
      return '<div class="tcq-hint">Answer every row.</div>' +
        '<table class="tcq-match tcq-matrix"><thead><tr><th>Statement</th>' +
        opts.map(function (o) { return '<th>' + esc(o) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        rows.map(function (r, i) {
          var st = (typeof r === 'object') ? (r.statement || r.item || r.label) : r;
          return '<tr><td class="tcq-match-left">' + esc(st) + '</td>' +
            opts.map(function (o) {
              return '<td class="tcq-matrix-cell"><label><input type="radio" ' +
                'name="' + esc(name) + '__' + i + '" value="' + esc(o) + '">' +
                '<span class="tcq-sr">' + esc(o) + '</span></label></td>';
            }).join('') + '</tr>';
        }).join('') + '</tbody></table>';
    },

    hot_text: function (q, name) {
      var chunks = parseList(q.items);
      if (!chunks.length) return '<p class="tcq-warn">⚠️ No selectable text defined for this question.</p>';
      return '<div class="tcq-hint">Tap every part that is correct. Tap again to unselect.</div>' +
        '<div class="tcq-hot" data-hot="' + esc(name) + '">' + chunks.map(function (c, i) {
          var t = (typeof c === 'object') ? (c.text || c.item) : c;
          return '<button type="button" class="tcq-chip" data-val="' + esc(t) + '">' + esc(t) + '</button>';
        }).join('') + '</div><input type="hidden" name="' + esc(name) + '">';
    }
  };

  /* Aliases so a paper authored for HMG CBT Pro or School Connect renders
     without being rewritten. */
  var ALIAS = {
    mrq: 'multi_select', tf: 'true_false', short: 'short_answer',
    fill_blank: 'cloze', image_mcq: 'image_based', scenario_mcq: 'mcq',
    comprehension: 'case_study', data_interpretation: 'case_study',
    math_equation: 'short_answer', oral_prompt: 'essay', peer_review: 'essay',
    true_false_justify: 'true_false', classification: 'categorization',
    likert: 'matrix', drag_drop: 'ordering', timeline: 'ordering',
    error_spotting: 'hot_text', map_label: 'image_based',
    graph_read: 'case_study', citation: 'short_answer',
    audio_based: 'image_based', video_based: 'image_based',
    code_output: 'code', hotspot: 'image_based'
  };

  /* -------------------------------------------------------------------------
     ITEM 4 — ON-SCREEN GUIDANCE FOR THE UNFAMILIAR TYPES.

     A learner who has only ever met multiple choice will hesitate at a
     matching table or a drag-to-order list, and hesitation in a timed exam
     costs marks that have nothing to do with what they know. Each type
     therefore carries a one-line "how to answer this" note, shown inline
     above the control, plus a full legend the candidate can open at any time
     from the exam toolbar.

     Phrased for a nervous fifteen-year-old, not for a developer.
     ------------------------------------------------------------------------- */
  var HOWTO = {
    mcq: 'Tap the ONE option you think is right. Tap a different one to change your mind.',
    multi_select: 'More than one option is correct. Tap EVERY option that applies — you get credit for each right one.',
    true_false: 'Decide whether the statement is true or false, then tap that card.',
    short_answer: 'Type your answer in the box. Spelling variations are usually accepted, so answer in your own words.',
    numeric: 'Type the NUMBER only — no words and no unit unless the box asks for one.',
    multi_numeric: 'This question has several parts. Answer each box separately: you earn a mark for every part you get right, even if another part is wrong.',
    cloze: 'Fill in each gap in the sentence. Every gap is worth a mark on its own.',
    matching: 'For each item on the LEFT, choose the matching item from the dropdown on the RIGHT. Some right-hand options may not be used at all.',
    ordering: 'Put the items into the correct order. Drag them, or use the ↑ and ↓ buttons. You earn a mark for every item that ends up in the right place.',
    categorization: 'Decide which category each item belongs to and pick it from the dropdown beside it.',
    matrix: 'Answer every row. All rows share the same set of choices across the top.',
    hot_text: 'Tap every part that is correct. Tap it again to unselect. Wrong picks cost you, so choose carefully.',
    essay: 'Write in full sentences. You are marked on the points you make, and your tutor reads it afterwards.',
    code: 'Write your code in the box. Indentation is kept exactly as you type it.',
    assertion_reason: 'Read the Assertion and the Reason. Decide whether each is true, and whether the Reason actually EXPLAINS the Assertion. Then pick the option that describes both.',
    case_study: 'Read the passage at the top first, then answer the question underneath it.',
    image_based: 'Study the figure, then answer the question underneath it.'
  };

  /* ITEM 2 FIX — the legend listed only the 17 base families, so a learner
     meeting a `likert`, `drag_drop`, `timeline`, `error_spotting` or
     `map_label` question found nothing about it. It now covers EVERY type the
     platform declares (32 of them), by resolving each alias to the family
     that actually renders it and naming the alias explicitly. */
  var ALIAS_NOTE = {
    mrq: 'Behaves like Multiple response — tap every option that applies.',
    tf: 'Behaves like True / False.',
    short: 'Behaves like Short answer.',
    fill_blank: 'Behaves like Fill the gaps.',
    image_mcq: 'Behaves like a Figure question.',
    scenario_mcq: 'A short scenario, then a normal multiple-choice question.',
    comprehension: 'A passage to read, then questions on it.',
    data_interpretation: 'A table, chart or set of data to read, then questions on it.',
    graph_read: 'Read values off a graph or chart, then answer.',
    math_equation: 'Type the expression or value. The maths keyboard has the symbols you need.',
    oral_prompt: 'Speak your answer and submit a recording LINK (Drive or YouTube). Never a file upload.',
    peer_review: 'Write a short, constructive comment on the work shown.',
    true_false_justify: 'Choose True or False, then justify it in the box.',
    classification: 'Behaves like Sort into groups.',
    likert: 'Choose the point on the scale that best matches your view. There is no wrong answer.',
    drag_drop: 'Drag the items into place, or use the ↑ ↓ buttons.',
    timeline: 'Put the events into the order they happened.',
    error_spotting: 'Tap the parts that contain the mistake.',
    map_label: 'Study the map or diagram, then answer.',
    citation: 'Give the source or reference in the box.',
    audio_based: 'Listen to the clip, then answer.',
    video_based: 'Watch the clip, then answer.',
    code_output: 'Say what the code prints, or write the code asked for.',
    hotspot: 'Study the figure and answer the question about the marked area.'
  };

  /* The full legend, for the "How do I answer these?" button. */
  function legendHTML() {
    var order = ['mcq','multi_select','true_false','short_answer','numeric','multi_numeric',
                 'cloze','matching','ordering','categorization','matrix','hot_text',
                 'assertion_reason','case_study','image_based','essay','code'];
    var LABEL = {
      mcq: 'Multiple choice', multi_select: 'Multiple response', true_false: 'True / False',
      short_answer: 'Short answer', numeric: 'Numeric', multi_numeric: 'Multi-part numeric',
      cloze: 'Fill the gaps', matching: 'Matching', ordering: 'Put in order',
      categorization: 'Sort into groups', matrix: 'Grid', hot_text: 'Tap the right parts',
      assertion_reason: 'Assertion & Reason', case_study: 'Passage question',
      image_based: 'Figure question', essay: 'Written answer', code: 'Code'
    };
    return '<div class="tcq-legend">' +
      '<p class="tcq-legend-intro">This paper may use several question styles. Here is how each one ' +
      'works. You can reopen this at any time — it does not use up your exam time.</p>' +
      order.map(function (t) {
        return '<div class="tcq-legend-row"><b>' + (LABEL[t] || t) + '</b><span>' + HOWTO[t] + '</span></div>';
      }).join('') +
      // Every remaining named type, so nothing a paper can contain is unexplained.
      '<h4 class="tcq-legend-more">Other styles you may meet</h4>' +
      Object.keys(ALIAS_NOTE).map(function (t) {
        var pretty = t.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
        return '<div class="tcq-legend-row"><b>' + pretty + '</b><span>' + ALIAS_NOTE[t] + '</span></div>';
      }).join('') +
      '<p class="tcq-legend-foot">Partial credit is normal: on matching, ordering, grids, gap-fills ' +
      'and multi-part questions you earn marks for the parts you get right, so always attempt them. ' +
      'An unanswered question always scores zero, so a sensible attempt is never worse than a blank.</p>' +
      '</div>';
  }

  var CBTTypes = {
    TYPES: TYPES,
    ALIAS: ALIAS,
    HOWTO: HOWTO,
    legendHTML: legendHTML,

    supports: function (type) {
      var t = ALIAS[type] || type;
      return typeof TYPES[t] === 'function' && t.charAt(0) !== '_';
    },

    /** Render the control for one question. Returns '' if unsupported. */
    render: function (q, name) {
      var t = ALIAS[q.type] || q.type;
      if (!this.supports(q.type)) return '';
      try {
        var body = TYPES[t](q, name);
        /* ITEM 4 — a one-line "how to answer this" above every control, so a
           learner meeting a matching table for the first time is not left
           guessing. Plain choice questions get no note: it would be noise. */
        var tip = HOWTO[t];
        var obvious = (t === 'mcq' || t === 'true_false');
        return (tip && !obvious ? '<div class="tcq-howto"><span aria-hidden="true">💡</span> ' +
                 esc(tip) + '</div>' : '') + body;
      }
      catch (e) { return '<p class="tcq-warn">⚠️ This question could not be displayed (' + esc(e.message) + ').</p>'; }
    },

    /** Wire behaviour that needs JavaScript: drag ordering, chips, word count. */
    activate: function (root) {
      root = root || d;

      // Ordering — drag plus keyboard/touch buttons, kept in a hidden input.
      root.querySelectorAll('[data-order]').forEach(function (list) {
        if (list._wired) return; list._wired = true;
        var nm = list.getAttribute('data-order');
        var hidden = root.querySelector('input[type="hidden"][name="' + nm + '"]');
        var sync = function () {
          var vals = [].map.call(list.querySelectorAll('.tcq-order-item'), function (li, i) {
            var n = li.querySelector('.tcq-order-num'); if (n) n.textContent = i + 1;
            return li.getAttribute('data-val');
          });
          if (hidden) hidden.value = JSON.stringify(vals);
          hidden && hidden.dispatchEvent(new Event('change', { bubbles: true }));
        };
        var dragging = null;
        list.addEventListener('dragstart', function (e) {
          dragging = e.target.closest('.tcq-order-item');
          if (dragging) dragging.classList.add('is-dragging');
        });
        list.addEventListener('dragend', function () {
          if (dragging) dragging.classList.remove('is-dragging');
          dragging = null; sync();
        });
        list.addEventListener('dragover', function (e) {
          e.preventDefault();
          var over = e.target.closest('.tcq-order-item');
          if (!over || !dragging || over === dragging) return;
          var rect = over.getBoundingClientRect();
          var after = (e.clientY - rect.top) > rect.height / 2;
          list.insertBefore(dragging, after ? over.nextSibling : over);
        });
        list.addEventListener('click', function (e) {
          var li = e.target.closest('.tcq-order-item'); if (!li) return;
          if (e.target.hasAttribute('data-up') && li.previousElementSibling) {
            list.insertBefore(li, li.previousElementSibling); sync();
          } else if (e.target.hasAttribute('data-down') && li.nextElementSibling) {
            list.insertBefore(li.nextElementSibling, li); sync();
          }
        });
        sync();
      });

      // Hot text — tappable chips.
      root.querySelectorAll('[data-hot]').forEach(function (box) {
        if (box._wired) return; box._wired = true;
        var nm = box.getAttribute('data-hot');
        var hidden = root.querySelector('input[type="hidden"][name="' + nm + '"]');
        box.addEventListener('click', function (e) {
          var b = e.target.closest('.tcq-chip'); if (!b) return;
          b.classList.toggle('is-on');
          var picked = [].map.call(box.querySelectorAll('.tcq-chip.is-on'), function (x) { return x.getAttribute('data-val'); });
          if (hidden) { hidden.value = JSON.stringify(picked); hidden.dispatchEvent(new Event('change', { bubbles: true })); }
        });
      });

      // Essay word counter.
      root.querySelectorAll('textarea[name]').forEach(function (ta) {
        var out = root.querySelector('[data-wordcount="' + ta.name + '"]');
        if (!out || ta._wc) return; ta._wc = true;
        var upd = function () {
          var n = (ta.value.trim().match(/\S+/g) || []).length;
          out.textContent = n + (n === 1 ? ' word' : ' words');
        };
        ta.addEventListener('input', upd); upd();
      });

      // Multi-select cap.
      root.querySelectorAll('.tcq-opts').forEach(function (grp) {
        var boxes = grp.querySelectorAll('input[type="checkbox"]');
        if (!boxes.length) return;
        boxes.forEach(function (b) {
          b.addEventListener('change', function () {
            b.closest('.tcq-opt').classList.toggle('is-picked', b.checked);
          });
        });
      });
      root.querySelectorAll('.tcq-opt input[type="radio"]').forEach(function (r) {
        r.addEventListener('change', function () {
          var grp = r.closest('.tcq-opts');
          if (grp) grp.querySelectorAll('.tcq-opt').forEach(function (o) { o.classList.remove('is-picked'); });
          r.closest('.tcq-opt').classList.add('is-picked');
        });
      });
    },

    /** Collect one question's answer out of the DOM. */
    collect: function (q, name, root) {
      root = root || d;
      var t = ALIAS[q.type] || q.type;
      var one = function (sel) { var e = root.querySelector(sel); return e ? e.value : ''; };

      if (t === 'multi_select' || t === 'hot_text') {
        if (t === 'hot_text') { try { return JSON.parse(one('input[type=hidden][name="' + name + '"]') || '[]'); } catch (e) { return []; } }
        return [].map.call(root.querySelectorAll('input[name="' + name + '"]:checked'), function (i) { return i.value; });
      }
      if (t === 'ordering') {
        try { return JSON.parse(one('input[type=hidden][name="' + name + '"]') || '[]'); } catch (e) { return []; }
      }
      if (t === 'matching' || t === 'categorization' || t === 'matrix' ||
          t === 'multi_numeric' || t === 'cloze') {
        var out = [];
        root.querySelectorAll('[name^="' + name + '__"]').forEach(function (el) {
          if (el.type === 'radio' && !el.checked) return;
          var idx = Number(el.name.split('__').pop());
          out[idx] = el.value;
        });
        return out;
      }
      var el = root.querySelector('[name="' + name + '"]:checked') || root.querySelector('[name="' + name + '"]');
      return el ? el.value : '';
    },

    /** Is a response genuinely blank? Arrays and objects need a length check;
        `[] !== ''` is true, which is what made an untouched paper report
        "3 of 20 answered". */
    isBlank: function (v) {
      if (v == null) return true;
      if (typeof v === 'string') return v.trim() === '';
      if (Array.isArray(v)) {
        return v.length === 0 || v.every(function (x) {
          return x == null || String(x).trim() === '';
        });
      }
      if (typeof v === 'object') return Object.keys(v).length === 0;
      return false;
    },

    /** Does this question have a usable answer key at all? */
    hasKey: function (q) {
      var t = ALIAS[q.type] || q.type;
      if (t === 'essay' || t === 'code') return true;            // marked by rubric
      if (t === 'matching' || t === 'categorization' || t === 'matrix' ||
          t === 'multi_numeric' || t === 'cloze' || t === 'ordering' || t === 'hot_text') {
        var rows = parseList(q.items || q.pairs);
        if (!rows.length && (t === 'cloze' || t === 'ordering')) rows = parseList(q.answer);
        return rows.length > 0;
      }
      var a = q.answer;
      if (Array.isArray(a)) return a.filter(function (x) { return String(x).trim() !== ''; }).length > 0;
      return a != null && String(a).trim() !== '';
    },

    /* -------------------------------------------------------------------
       BUG FIX (reported): "I attempted a CBT as a guest, answered nothing,
       and the system awarded me marks. The review then claimed I had picked
       some answers correctly."

       Reproduced exactly. The final fallback of this function was:

           return res(norm(given) === norm(ans) ? max : 0);

       With no answer given, norm(given) is ''. With a question whose key is
       missing or blank — which is what a CSV with an empty CorrectAnswer
       column produces — norm(ans) is ALSO ''. So '' === '' was true and the
       question scored full marks. A blank paper of twenty questions scored
       3/20 in testing purely from questions with no key.

       Two guards now, in this order:

         1. A BLANK RESPONSE ALWAYS SCORES ZERO. No exceptions, no type. If
            the candidate did not answer, they cannot be right. This alone
            fixes the reported bug.
         2. A QUESTION WITH NO KEY IS NEVER MARKED CORRECT. It is returned
            as `unmarkable` with zero earned, and surfaces in the tutor's
            item analysis so the paper can be repaired — silently awarding
            or silently failing are both wrong.
       ------------------------------------------------------------------- */
    /** Mark one question. Returns { earned, max, correct, detail }. */
    grade: function (q, given) {
      var t = ALIAS[q.type] || q.type;
      var max = Number(q.mark || 1) || 1;
      var norm = function (v) { return String(v == null ? '' : v).trim().toLowerCase(); };
      var res = function (earned, detail) {
        earned = Math.max(0, Math.min(max, earned));
        return { earned: earned, max: max, correct: earned >= max - 1e-9, detail: detail || '' };
      };

      // GUARD 1 — nothing answered, nothing earned.
      if (this.isBlank(given)) {
        return { earned: 0, max: max, correct: false, blank: true,
                 detail: 'no answer given' };
      }

      // GUARD 2 — a question with no key cannot be marked either way.
      if (!this.hasKey(q)) {
        return { earned: 0, max: max, correct: false, pending: true, unmarkable: true,
                 detail: 'this question has no answer key — it needs repairing before it can be marked' };
      }

      // MULTI-SELECT — partial credit unless all-or-nothing is set.
      if (t === 'multi_select') {
        var want = (Array.isArray(q.answer) ? q.answer : parseList(q.answer)).map(norm);
        var got = (Array.isArray(given) ? given : parseList(given)).map(norm);
        if (!want.length) return res(0, 'no answer key');
        var hit = got.filter(function (g) { return want.indexOf(g) > -1; }).length;
        var wrong = got.filter(function (g) { return want.indexOf(g) === -1; }).length;
        if (q.all_or_nothing || q.mrq_aon) {
          return res((hit === want.length && !wrong) ? max : 0);
        }
        return res(max * Math.max(0, (hit - wrong)) / want.length,
                   hit + ' of ' + want.length + ' correct' + (wrong ? ', ' + wrong + ' wrong' : ''));
      }

      // ORDERING — one mark share per item in the right place.
      if (t === 'ordering') {
        var order = parseList(q.answer);
        if (!order.length) order = parseList(q.items);
        var mine = Array.isArray(given) ? given : parseList(given);
        if (!order.length) return res(0, 'no answer key');
        var ok = 0;
        order.forEach(function (v, i) { if (norm(mine[i]) === norm(v)) ok++; });
        return res(max * ok / order.length, ok + ' of ' + order.length + ' in place');
      }

      // MATCHING / CATEGORIZATION / MATRIX / MULTI-NUMERIC / CLOZE — per row.
      if (t === 'matching' || t === 'categorization' || t === 'matrix' ||
          t === 'multi_numeric' || t === 'cloze') {
        var rows = parseList(q.items || q.pairs);
        if (t === 'cloze' && !rows.length) rows = parseList(q.answer || q.accepted_answers);
        var mineArr = Array.isArray(given) ? given : parseList(given);
        if (!rows.length) return res(0, 'no answer key');
        var good = 0;
        rows.forEach(function (r, i) {
          var expect;
          if (t === 'matching')            expect = (typeof r === 'object') ? r.right : r;
          else if (t === 'categorization') expect = (typeof r === 'object') ? r.category : r;
          else if (t === 'matrix')         expect = (typeof r === 'object') ? (r.answer || r.correct) : r;
          else if (t === 'multi_numeric')  expect = (typeof r === 'object') ? r.answer : r;
          else                             expect = r;
          var mine2 = mineArr[i];
          if (t === 'multi_numeric') {
            var tol = ((typeof r === 'object' && r.tolerance != null) ? Number(r.tolerance) : Number(q.tolerance || 0)) || 0;
            if (mine2 !== '' && mine2 != null && Math.abs(Number(mine2) - Number(expect)) <= tol + 1e-9) good++;
          } else {
            // A cloze blank may list alternatives: "mass|m"
            var alts = String(expect == null ? '' : expect).split('|').map(norm).filter(Boolean);
            if (alts.length && alts.indexOf(norm(mine2)) > -1) good++;
          }
        });
        return res(max * good / rows.length, good + ' of ' + rows.length + ' correct');
      }

      // HOT TEXT — credit correct chips, penalise wrong ones.
      if (t === 'hot_text') {
        var chunks = parseList(q.items);
        var right = chunks.filter(function (c) { return c && c.correct; })
                          .map(function (c) { return norm(c.text || c.item); });
        var picked = (Array.isArray(given) ? given : parseList(given)).map(norm);
        if (!right.length) return res(0, 'no answer key');
        var h = picked.filter(function (p) { return right.indexOf(p) > -1; }).length;
        var bad = picked.length - h;
        return res(max * Math.max(0, h - bad) / right.length, h + ' of ' + right.length + ' found');
      }

      // NUMERIC — tolerance-aware.
      if (t === 'numeric') {
        var tol2 = Number(q.tolerance || 0) || 0;
        var v = Number(String(given).replace(/[^0-9eE+\-.]/g, ''));
        var want2 = Number(q.answer);
        if (!isFinite(v) || !isFinite(want2)) return res(0);
        return res(Math.abs(v - want2) <= tol2 + 1e-9 ? max : 0);
      }

      // ESSAY / CODE — transparent keyword and length marking, no AI.
      if (t === 'essay' || t === 'code') {
        var cfg = parseObj(q.items);
        var keys = parseList(cfg.keywords || q.accepted_answers || q.accept).map(norm);
        var minw = Number(cfg.min_words || q.min_words || 0) || 0;
        var text = norm(given);
        var words = (String(given || '').trim().match(/\S+/g) || []).length;
        if (!keys.length && !minw) {
          return { earned: 0, max: max, correct: false, detail: 'awaiting tutor review', pending: true };
        }
        var found = keys.filter(function (k) { return k && text.indexOf(k) > -1; }).length;
        var kScore = keys.length ? (found / keys.length) : 1;
        var wScore = minw ? Math.min(1, words / minw) : 1;
        return {
          earned: Math.round(max * kScore * wScore * 100) / 100,
          max: max, correct: false, pending: true,
          detail: found + ' of ' + keys.length + ' key points' +
                  (minw ? ', ' + words + '/' + minw + ' words' : '') + ' — tutor review recommended'
        };
      }

      // SHORT ANSWER — accepted alternatives.
      if (t === 'short_answer') {
        var accepted = [q.answer].concat(parseList(q.accepted_answers || q.accept)).map(norm).filter(Boolean);
        return res(accepted.indexOf(norm(given)) > -1 ? max : 0);
      }

      // Everything else: single choice.
      var ans = Array.isArray(q.answer) ? q.answer[0] : q.answer;
      return res(norm(given) === norm(ans) ? max : 0);
    }
  };

  w.CBTTypes = CBTTypes;
  if (w.TC) w.TC.CBTTypes = CBTTypes;
})(window, document);
