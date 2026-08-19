/* ============================================================================
   desk-kit.js — the data-entry engine behind the analytics and reporting pages
   ----------------------------------------------------------------------------
   WHAT WAS WRONG

   Nine pages shipped as read-only stubs. Their entire <main> was a description
   card followed by one sentence:

       "Use the related links and the ❓ Page Help button."

   There was no form, no list, no table behind them, and nothing a tutor or an
   administrator could type. The pages were:

       At-risk board        Practice analytics    Value-added
       Predicted grades     Group insights        Insights Lab
       Scoresheet           Progress reports      Timezone desk

   The original intent was that every figure would be DERIVED. That is right
   for the arithmetic and wrong for the judgement. A tutor has to record why a
   learner is at risk, what was agreed with the parent, which grade is being
   predicted and on what basis, and what the baseline was before the studio
   ever saw the child. None of that is derivable from session rows.

   WHAT THIS FILE IS

   One engine, nine configurations. Each page calls:

       Desk.mount('at_risk')

   and gets a complete working desk:

       * an entry form built from the field spec, with every dropdown
         AUTO-FILLED from the database — learners, engagements, tutors and
         subjects are never typed, which is the standing instruction that
         anything selectable must be selected, not typed;
       * inline validation with plain-language messages;
       * a live list of existing rows with EDIT and DELETE on every one,
         because anything created must be editable and deletable afterwards;
       * filters, sorting, CSV export and a print view;
       * a computed summary strip above the list, so the page still does the
         analysis it was always supposed to do;
       * role awareness — a tutor sees and writes only their own learners
         (enforced for real by row-level security; this is the interface half),
         a family sees the published rows read-only.

   WHY ONE ENGINE AND NOT NINE PAGES OF BESPOKE CODE

   Nine hand-written forms is nine places for the same bug. It is also nine
   places to forget the empty state, the error message, the delete
   confirmation, the ARIA label or the read-only mode. The desks differ only
   in their columns, so only the columns are configured.
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
  function toast(msg, kind, ms) {
    if (w.toast) return w.toast(msg, kind || 'info', ms || 4000);
    if (w.App && w.App.toast) return w.App.toast(msg, kind);
    console.log('[' + (kind || 'info') + '] ' + msg);
  }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }
  function pct(a, b) { return b ? Math.round((a / b) * 1000) / 10 : null; }

  /* ==========================================================================
     LOOKUPS — every dropdown in every desk is filled from here.

     Loaded once per page, cached, and shared by all field specs. The cache
     matters: eight dropdowns on the progress-report desk would otherwise be
     eight round trips to Supabase on a free tier that we are trying not to
     exhaust.
     ========================================================================== */
  var Lookups = {
    _cache: {},
    _inflight: {},

    async get(name) {
      if (this._cache[name]) return this._cache[name];
      if (this._inflight[name]) return this._inflight[name];
      var self = this;
      this._inflight[name] = (async function () {
        var rows = await self._fetch(name);
        self._cache[name] = rows;
        delete self._inflight[name];
        return rows;
      })();
      return this._inflight[name];
    },

    async _fetch(name) {
      var s = sb();
      if (!s || !s.from) return [];
      try {
        if (name === 'learners') {
          var l = await s.from('learners')
            .select('id,full_name,year_group,status')
            .order('full_name').limit(1000);
          return (l.data || []).map(function (r) {
            return { v: r.id, t: r.full_name + (r.year_group ? ' · ' + r.year_group : '') };
          });
        }
        if (name === 'engagements') {
          var e = await s.from('engagements').select('id,name').order('name').limit(500);
          return (e.data || []).map(function (r) { return { v: r.id, t: r.name }; });
        }
        if (name === 'tutors') {
          var t = await s.from('tutors').select('id,full_name').order('full_name').limit(500);
          return (t.data || []).map(function (r) { return { v: r.id, t: r.full_name }; });
        }
        if (name === 'subjects') {
          var sj = await s.from('subjects').select('id,name').order('name').limit(500);
          return (sj.data || []).map(function (r) { return { v: r.name, t: r.name }; });
        }
        if (name === 'cohorts') {
          var c = await s.from('tc_free_cohorts').select('id,name').order('name').limit(200);
          return (c.data || []).map(function (r) { return { v: r.id, t: r.name }; });
        }
      } catch (err) { /* offline or table missing — the field degrades to text */ }
      return [];
    },

    /* Force a refresh — used after a desk creates something a dropdown lists. */
    bust(name) { delete this._cache[name]; }
  };

  /* Static option lists. Typing "WAEC" by hand in four different spellings is
     how a dataset stops being reportable. */
  var OPTS = {
    risk:       ['watch', 'concern', 'urgent', 'cleared'],
    origin:     ['manual', 'auto'],
    confidence: ['low', 'medium', 'high'],
    effort:     ['excellent', 'good', 'fair', 'needs work'],
    boards:     ['WAEC', 'NECO', 'JAMB (UTME)', 'NABTEB', 'Common Entrance',
                 'IGCSE (Cambridge)', 'IGCSE (Edexcel)', 'GCSE', 'A-Level',
                 'IB', 'SAT', 'ACT', 'IELTS', 'TOEFL', 'Duolingo English Test',
                 'Checkpoint', 'BECE', 'Other'],
    scales:     ['A1–F9 (WAEC/NECO)', '9–1 (GCSE)', 'A*–E (A-Level)',
                 '1–7 (IB)', '400–1600 (SAT)', '0–9 bands (IELTS)',
                 '0–120 (TOEFL)', 'Percentage', 'Other'],
    practice:   ['platform', 'past_paper', 'worksheet', 'external', 'homework'],
    difficulty: ['foundation', 'core', 'stretch', 'exam'],
    noteKind:   ['observation', 'hypothesis', 'experiment', 'finding', 'risk'],
    noteStatus: ['open', 'testing', 'confirmed', 'rejected', 'closed'],
    noteScope:  ['learner', 'group', 'subject', 'studio'],
    reportState:['draft', 'published', 'archived'],
    party:      ['tutor', 'learner', 'parent', 'studio', 'exam_board'],
    days:       ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    assessment: ['manual', 'mock', 'homework', 'classwork', 'graded_quiz', 'sow'],
    // A short, honest list. The browser knows the rest; these are the ones the
    // studio actually teaches across.
    tz:         ['Africa/Lagos', 'Africa/Accra', 'Africa/Nairobi', 'Africa/Johannesburg',
                 'Africa/Cairo', 'Europe/London', 'Europe/Dublin', 'Europe/Paris',
                 'Europe/Berlin', 'Europe/Istanbul', 'Asia/Dubai', 'Asia/Riyadh',
                 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Shanghai',
                 'Asia/Tokyo', 'Australia/Sydney', 'America/Toronto', 'America/New_York',
                 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
                 'America/Sao_Paulo', 'UTC']
  };

  function list(arr) { return arr.map(function (x) { return { v: x, t: x }; }); }

  /* ==========================================================================
     THE DESK DEFINITIONS

     field: { k: column, l: label, t: type, req, opts, lookup, help, width,
              calc: fn(row) -> derived display value, hide: true }

     types: text | textarea | number | date | time | select | multiselect |
            checkbox | url | tags | subjects
     ========================================================================== */
  var DESKS = {

    /* ---- item 12 ---------------------------------------------------- */
    at_risk: {
      table: 'tc_at_risk_reviews',
      title: 'At-risk review',
      icon: '⚠️',
      lead: 'The rule engine spots the pattern. This desk records what a human decided to do about it — which is the part a parent will one day ask you to produce.',
      order: 'reviewed_on',
      staffOnly: true,
      fields: [
        { k: 'learner_id',    l: 'Learner',            t: 'select', lookup: 'learners', req: true },
        { k: 'engagement_id', l: 'Engagement / group', t: 'select', lookup: 'engagements' },
        { k: 'subject',       l: 'Subject',            t: 'select', lookup: 'subjects', free: true },
        { k: 'reviewed_on',   l: 'Reviewed on',        t: 'date',   req: true, def: 'today' },
        { k: 'origin',        l: 'Raised by',          t: 'select', opts: OPTS.origin, def: 'manual',
          help: 'auto = the rule engine flagged it and you confirmed. manual = you saw it yourself.' },
        { k: 'risk_level',    l: 'Risk level',         t: 'select', opts: OPTS.risk, req: true, def: 'watch' },
        { k: 'triggers',      l: 'What triggered it',  t: 'tags',
          help: 'e.g. falling scores, attendance below 80%, missing homework, idle 14 days' },
        { k: 'evidence',      l: 'Evidence',           t: 'textarea', req: true,
          help: 'Be specific and dated. "3 of the last 4 quizzes below 45%; absent 4 and 11 March."' },
        { k: 'action_agreed', l: 'Action agreed',      t: 'textarea', req: true,
          help: 'What will actually change. A flag with no action is a complaint waiting to happen.' },
        { k: 'owner_tutor',   l: 'Owned by',           t: 'select', lookup: 'tutors' },
        { k: 'parent_told',   l: 'Parent informed',    t: 'checkbox' },
        { k: 'parent_told_on',l: 'Parent informed on', t: 'date' },
        { k: 'review_due',    l: 'Review again on',    t: 'date',
          help: 'Leave blank only if the concern is cleared.' },
        { k: 'resolved',      l: 'Resolved',           t: 'checkbox' },
        { k: 'resolved_on',   l: 'Resolved on',        t: 'date' },
        { k: 'outcome',       l: 'Outcome',            t: 'textarea' },
        { k: 'note',          l: 'Internal note',      t: 'textarea' }
      ],
      columns: ['learner_id', 'subject', 'reviewed_on', 'risk_level', 'action_agreed', 'review_due', 'resolved'],
      summary: function (rows) {
        var open = rows.filter(function (r) { return !r.resolved; });
        var overdue = open.filter(function (r) {
          return r.review_due && r.review_due < new Date().toISOString().slice(0, 10);
        });
        return [
          { v: rows.length, l: 'Reviews logged' },
          { v: open.length, l: 'Still open' },
          { v: open.filter(function (r) { return r.risk_level === 'urgent'; }).length, l: 'Urgent', tone: 'bad' },
          { v: overdue.length, l: 'Review overdue', tone: overdue.length ? 'bad' : 'ok' },
          { v: open.filter(function (r) { return !r.parent_told; }).length, l: 'Parent not told yet', tone: 'warn' }
        ];
      }
    },

    /* ---- item 13 ---------------------------------------------------- */
    practice_analytics: {
      table: 'tc_practice_analytics',
      title: 'Practice record',
      icon: '📈',
      lead: 'Quizzes sat on the platform are counted automatically. This desk captures the practice that happens OFF it — past papers, worksheets, weekend problem sets — which for an exam-prep studio is most of the practice there is.',
      order: 'period_start',
      staffOnly: true,
      fields: [
        { k: 'learner_id',    l: 'Learner',        t: 'select', lookup: 'learners', req: true },
        { k: 'engagement_id', l: 'Engagement',     t: 'select', lookup: 'engagements' },
        { k: 'subject',       l: 'Subject',        t: 'select', lookup: 'subjects', free: true, req: true },
        { k: 'topic',         l: 'Topic',          t: 'text' },
        { k: 'source',        l: 'Where',          t: 'select', opts: OPTS.practice, def: 'past_paper' },
        { k: 'difficulty',    l: 'Level',          t: 'select', opts: OPTS.difficulty, def: 'core' },
        { k: 'period_start',  l: 'From',           t: 'date', req: true, def: 'today' },
        { k: 'period_end',    l: 'To',             t: 'date' },
        { k: 'attempts',      l: 'Attempts',       t: 'number', def: 1 },
        { k: 'questions',     l: 'Questions set',  t: 'number', req: true },
        { k: 'correct',       l: 'Correct',        t: 'number', req: true },
        { k: 'minutes',       l: 'Minutes spent',  t: 'number' },
        { k: 'note',          l: 'Note',           t: 'textarea' }
      ],
      // accuracy is a generated column in PostgreSQL — never typed, never wrong.
      derived: [{ k: 'accuracy', l: 'Accuracy %' }],
      columns: ['learner_id', 'subject', 'topic', 'source', 'period_start', 'questions', 'correct', 'accuracy', 'minutes'],
      validate: function (row) {
        if (row.correct != null && row.questions != null && Number(row.correct) > Number(row.questions)) {
          return 'Correct answers (' + row.correct + ') cannot exceed the number of questions set (' + row.questions + ').';
        }
        return null;
      },
      summary: function (rows) {
        var q = rows.reduce(function (a, r) { return a + (r.questions || 0); }, 0);
        var c = rows.reduce(function (a, r) { return a + (r.correct || 0); }, 0);
        var m = rows.reduce(function (a, r) { return a + (r.minutes || 0); }, 0);
        return [
          { v: rows.length, l: 'Practice records' },
          { v: q, l: 'Questions attempted' },
          { v: (pct(c, q) == null ? '—' : pct(c, q) + '%'), l: 'Overall accuracy',
            tone: pct(c, q) >= 70 ? 'ok' : pct(c, q) >= 50 ? 'warn' : 'bad' },
          { v: Math.round(m / 60 * 10) / 10 + ' h', l: 'Time on practice' },
          { v: new Set(rows.map(function (r) { return r.learner_id; })).size, l: 'Learners covered' }
        ];
      }
    },

    /* ---- item 14 ---------------------------------------------------- */
    value_added: {
      table: 'tc_value_added',
      title: 'Value-added entry',
      icon: '📐',
      lead: 'Value-added is the studio\u2019s central claim: the child arrived at 42% and is now at 68%, and here is the arithmetic. It needs a baseline, and a baseline predates the platform — a school report, a mock, a week-one diagnostic — so it can only be entered by hand.',
      order: 'period_start',
      staffOnly: true,
      fields: [
        { k: 'learner_id',     l: 'Learner',            t: 'select', lookup: 'learners', req: true },
        { k: 'engagement_id',  l: 'Engagement',         t: 'select', lookup: 'engagements' },
        { k: 'subject',        l: 'Subject',            t: 'select', lookup: 'subjects', free: true, req: true },
        { k: 'period_label',   l: 'Period',             t: 'text', req: true, help: 'e.g. "Cycle 3 · Feb–Mar 2026"' },
        { k: 'period_start',   l: 'From',               t: 'date' },
        { k: 'period_end',     l: 'To',                 t: 'date' },
        { k: 'baseline_score', l: 'Baseline score',     t: 'number', req: true, help: 'Where they were before the studio started.' },
        { k: 'baseline_source',l: 'Baseline came from', t: 'text', req: true, help: 'e.g. "School report, Dec 2025" — an unsourced baseline is not evidence.' },
        { k: 'current_score',  l: 'Current score',      t: 'number', req: true },
        { k: 'expected_score', l: 'Expected score',     t: 'number', help: 'What a typical learner would have reached in the same time. Leave blank to measure against the baseline instead.' },
        { k: 'target_score',   l: 'Target score',       t: 'number' },
        { k: 'hours_taught',   l: 'Hours taught',       t: 'number' },
        { k: 'confidence',     l: 'Confidence',         t: 'select', opts: OPTS.confidence, def: 'medium' },
        { k: 'method',         l: 'How it was measured', t: 'textarea' },
        { k: 'published',      l: 'Visible to the family', t: 'checkbox' },
        { k: 'note',           l: 'Note',               t: 'textarea' }
      ],
      derived: [{ k: 'value_added', l: 'Value added' }],
      columns: ['learner_id', 'subject', 'period_label', 'baseline_score', 'current_score', 'expected_score', 'value_added', 'published'],
      validate: function (row) {
        if (row.period_start && row.period_end && row.period_end < row.period_start) {
          return 'The period ends before it starts. Check the two dates.';
        }
        return null;
      },
      summary: function (rows) {
        var va = rows.map(function (r) { return num(r.value_added); }).filter(function (x) { return x != null; });
        var mean = va.length ? Math.round(va.reduce(function (a, b) { return a + b; }, 0) / va.length * 10) / 10 : null;
        var hours = rows.reduce(function (a, r) { return a + (num(r.hours_taught) || 0); }, 0);
        return [
          { v: rows.length, l: 'Entries' },
          { v: mean == null ? '—' : (mean > 0 ? '+' : '') + mean, l: 'Mean value added',
            tone: mean > 0 ? 'ok' : mean < 0 ? 'bad' : 'warn' },
          { v: va.filter(function (x) { return x > 0; }).length, l: 'Improved', tone: 'ok' },
          { v: va.filter(function (x) { return x < 0; }).length, l: 'Declined', tone: 'bad' },
          { v: hours ? Math.round(hours) + ' h' : '—', l: 'Hours taught' },
          { v: rows.filter(function (r) { return r.published; }).length, l: 'Shared with families' }
        ];
      }
    },

    /* ---- item 15 ---------------------------------------------------- */
    predictions: {
      table: 'tc_predicted_grades',
      title: 'Predicted grade',
      icon: '🔮',
      lead: 'A predicted grade is a professional judgement on a named scale — WAEC A1, IGCSE 9 and SAT 1450 are different objects and none of them is a percentage. The board, the scale and the basis are all recorded, because a prediction you cannot justify is worthless in a parent conference.',
      order: 'predicted_on',
      staffOnly: true,
      fields: [
        { k: 'learner_id',    l: 'Learner',          t: 'select', lookup: 'learners', req: true },
        { k: 'engagement_id', l: 'Engagement',       t: 'select', lookup: 'engagements' },
        { k: 'subject',       l: 'Subject',          t: 'select', lookup: 'subjects', free: true, req: true },
        { k: 'exam_board',    l: 'Exam board',       t: 'select', opts: OPTS.boards, req: true },
        { k: 'exam_series',   l: 'Series / sitting', t: 'text', help: 'e.g. "May/June 2026"' },
        { k: 'scale',         l: 'Grading scale',    t: 'select', opts: OPTS.scales, req: true },
        { k: 'current_grade', l: 'Grade now',        t: 'text' },
        { k: 'predicted',     l: 'Predicted grade',  t: 'text', req: true },
        { k: 'target_grade',  l: 'Target grade',     t: 'text' },
        { k: 'evidence_pct',  l: 'Mean mark behind it (%)', t: 'number' },
        { k: 'confidence',    l: 'Confidence',       t: 'select', opts: OPTS.confidence, def: 'medium' },
        { k: 'basis',         l: 'Basis for the prediction', t: 'textarea', req: true,
          help: 'e.g. "Mean 72% over 6 graded papers, upward trend, full attendance."' },
        { k: 'risk',          l: 'What would change it', t: 'textarea',
          help: 'e.g. "Misses the target if attendance stays below 80%."' },
        { k: 'predicted_on',  l: 'Predicted on',     t: 'date', def: 'today' },
        { k: 'published',     l: 'Visible to the family', t: 'checkbox' },
        { k: 'note',          l: 'Note',             t: 'textarea' }
      ],
      columns: ['learner_id', 'subject', 'exam_board', 'exam_series', 'current_grade', 'predicted', 'target_grade', 'confidence', 'published'],
      summary: function (rows) {
        var onTarget = rows.filter(function (r) {
          return r.target_grade && r.predicted &&
                 String(r.predicted).trim().toLowerCase() === String(r.target_grade).trim().toLowerCase();
        });
        return [
          { v: rows.length, l: 'Predictions' },
          { v: new Set(rows.map(function (r) { return r.learner_id; })).size, l: 'Learners' },
          { v: new Set(rows.map(function (r) { return r.exam_board; })).size, l: 'Exam boards' },
          { v: onTarget.length, l: 'Predicted to hit target', tone: 'ok' },
          { v: rows.filter(function (r) { return r.confidence === 'low'; }).length, l: 'Low confidence', tone: 'warn' },
          { v: rows.filter(function (r) { return r.published; }).length, l: 'Shared with families' }
        ];
      }
    },

    /* ---- item 16 ---------------------------------------------------- */
    group_insights: {
      table: 'tc_group_insights',
      title: 'Group insight',
      icon: '👨‍👩‍👧‍👦',
      lead: 'Some observations belong to the whole set, not to any one child: "nobody has met simultaneous equations yet", "the 7pm slot loses a third of the room". Recorded against a learner they would simply be wrong.',
      order: 'period_start',
      staffOnly: true,
      fields: [
        { k: 'engagement_id',  l: 'Group / engagement', t: 'select', lookup: 'engagements', req: true },
        { k: 'subject',        l: 'Subject',            t: 'select', lookup: 'subjects', free: true },
        { k: 'period_label',   l: 'Period',             t: 'text', help: 'e.g. "Cycle 2"' },
        { k: 'period_start',   l: 'From',               t: 'date', def: 'today' },
        { k: 'period_end',     l: 'To',                 t: 'date' },
        { k: 'headcount',      l: 'Learners in the group', t: 'number' },
        { k: 'avg_score',      l: 'Average score %',    t: 'number' },
        { k: 'attendance_pct', l: 'Attendance %',       t: 'number' },
        { k: 'homework_pct',   l: 'Homework completion %', t: 'number' },
        { k: 'strongest_topic',l: 'Strongest topic',    t: 'text' },
        { k: 'weakest_topic',  l: 'Weakest topic',      t: 'text' },
        { k: 'observation',    l: 'Observation',        t: 'textarea', req: true },
        { k: 'action',         l: 'Action for next cycle', t: 'textarea', req: true },
        { k: 'next_review',    l: 'Review on',          t: 'date' },
        { k: 'published',      l: 'Share with the group\u2019s families', t: 'checkbox' },
        { k: 'note',           l: 'Note',               t: 'textarea' }
      ],
      columns: ['engagement_id', 'subject', 'period_label', 'headcount', 'avg_score', 'attendance_pct', 'weakest_topic', 'next_review'],
      validate: function (row) {
        var bad = ['avg_score', 'attendance_pct', 'homework_pct'].filter(function (k) {
          var v = num(row[k]); return v != null && (v < 0 || v > 100);
        });
        return bad.length ? 'A percentage must be between 0 and 100. Check: ' + bad.join(', ') + '.' : null;
      },
      summary: function (rows) {
        var avg = function (k) {
          var v = rows.map(function (r) { return num(r[k]); }).filter(function (x) { return x != null; });
          return v.length ? Math.round(v.reduce(function (a, b) { return a + b; }, 0) / v.length) : null;
        };
        return [
          { v: rows.length, l: 'Insights logged' },
          { v: new Set(rows.map(function (r) { return r.engagement_id; })).size, l: 'Groups covered' },
          { v: avg('avg_score') == null ? '—' : avg('avg_score') + '%', l: 'Mean group score' },
          { v: avg('attendance_pct') == null ? '—' : avg('attendance_pct') + '%', l: 'Mean attendance',
            tone: avg('attendance_pct') >= 85 ? 'ok' : 'warn' },
          { v: avg('homework_pct') == null ? '—' : avg('homework_pct') + '%', l: 'Mean homework' }
        ];
      }
    },

    /* ---- item 17 ---------------------------------------------------- */
    insights: {
      table: 'tc_insight_notes',
      title: 'Insight note',
      icon: '🔬',
      lead: 'The lab is where a hypothesis is written down BEFORE it is acted on — "the Tuesday cohort underperforms because the slot follows their school games afternoon" — together with the evidence, the action and, when it is known, what actually happened. The last column is what turns an opinion into practice.',
      order: 'created_at',
      staffOnly: true,
      fields: [
        { k: 'title',         l: 'Title',            t: 'text', req: true },
        { k: 'scope',         l: 'This is about',    t: 'select', opts: OPTS.noteScope, def: 'learner', req: true },
        { k: 'learner_id',    l: 'Learner',          t: 'select', lookup: 'learners',
          help: 'Only when the scope is a learner.' },
        { k: 'engagement_id', l: 'Group',            t: 'select', lookup: 'engagements',
          help: 'Only when the scope is a group.' },
        { k: 'subject',       l: 'Subject',          t: 'select', lookup: 'subjects', free: true },
        { k: 'category',      l: 'Kind of note',     t: 'select', opts: OPTS.noteKind, def: 'observation' },
        { k: 'observation',   l: 'Observation',      t: 'textarea', req: true },
        { k: 'evidence',      l: 'Evidence',         t: 'textarea',
          help: 'Numbers and dates. Without them this is an opinion.' },
        { k: 'action',        l: 'Proposed action',  t: 'textarea' },
        { k: 'measured_by',   l: 'How we will know it worked', t: 'textarea', req: true,
          help: 'e.g. "Mean quiz score for the Tuesday set rises above 60% within four weeks."' },
        { k: 'status',        l: 'Status',           t: 'select', opts: OPTS.noteStatus, def: 'open' },
        { k: 'outcome',       l: 'What happened',    t: 'textarea' },
        { k: 'review_on',     l: 'Review on',        t: 'date' },
        { k: 'tags',          l: 'Tags',             t: 'tags' },
        { k: 'note',          l: 'Extra note',       t: 'textarea' }
      ],
      columns: ['title', 'scope', 'category', 'status', 'learner_id', 'engagement_id', 'review_on'],
      validate: function (row) {
        if (row.scope === 'learner' && !row.learner_id) return 'This note is scoped to a learner, so please choose the learner.';
        if (row.scope === 'group' && !row.engagement_id) return 'This note is scoped to a group, so please choose the group.';
        return null;
      },
      summary: function (rows) {
        return [
          { v: rows.length, l: 'Notes' },
          { v: rows.filter(function (r) { return r.status === 'open'; }).length, l: 'Open' },
          { v: rows.filter(function (r) { return r.status === 'testing'; }).length, l: 'Being tested' },
          { v: rows.filter(function (r) { return r.status === 'confirmed'; }).length, l: 'Confirmed', tone: 'ok' },
          { v: rows.filter(function (r) { return r.status === 'rejected'; }).length, l: 'Rejected' },
          { v: rows.filter(function (r) {
              return r.review_on && r.review_on < new Date().toISOString().slice(0, 10) && r.status === 'open';
            }).length, l: 'Review overdue', tone: 'warn' }
        ];
      }
    },

    /* ---- item 18 ---------------------------------------------------- */
    scoresheet: {
      table: 'scoresheet',
      title: 'Scoresheet entry',
      icon: '🧾',
      lead: 'Graded quizzes land here on their own. Everything else a tutor marks — a mock, a homework set, a piece of classwork, a paper marked on paper — has to be entered, or the scoresheet is only ever a partial picture. The percentage is computed by the database from the score and the total, so a hand-entered row can never contradict itself.',
      order: 'taken_on',
      staffOnly: true,
      fields: [
        { k: 'learner_id',      l: 'Learner',        t: 'select', lookup: 'learners', req: true },
        { k: 'engagement_id',   l: 'Engagement',     t: 'select', lookup: 'engagements' },
        { k: 'tutor_id',        l: 'Marked by',      t: 'select', lookup: 'tutors' },
        { k: 'subject',         l: 'Subject',        t: 'select', lookup: 'subjects', free: true, req: true },
        { k: 'title',           l: 'What it was',    t: 'text', req: true, help: 'e.g. "Mock paper 2 — Algebra"' },
        { k: 'assessment_type', l: 'Type',           t: 'select', opts: OPTS.assessment, def: 'manual' },
        { k: 'term',            l: 'Term / cycle',   t: 'text' },
        { k: 'score',           l: 'Score',          t: 'number', req: true },
        { k: 'max_score',       l: 'Out of',         t: 'number', req: true, def: 100 },
        { k: 'weight',          l: 'Weight',         t: 'number', def: 1,
          help: 'How much this counts towards a term average. 1 is normal; 2 counts double.' },
        { k: 'grade',           l: 'Grade',          t: 'text' },
        { k: 'taken_on',        l: 'Taken on',       t: 'date', req: true, def: 'today' },
        { k: 'comment',         l: 'Comment for the family', t: 'textarea' },
        { k: 'published',       l: 'Visible to the family', t: 'checkbox', def: true },
        { k: 'source',          l: 'Source',         t: 'text', def: 'manual', hide: true }
      ],
      derived: [{ k: 'pct', l: '%' }],
      columns: ['learner_id', 'subject', 'title', 'assessment_type', 'score', 'max_score', 'pct', 'grade', 'taken_on', 'published'],
      validate: function (row) {
        if (num(row.max_score) != null && num(row.max_score) <= 0) return 'The total must be greater than zero.';
        if (num(row.score) != null && num(row.max_score) != null && num(row.score) > num(row.max_score)) {
          return 'The score (' + row.score + ') is higher than the total (' + row.max_score + ').';
        }
        if (num(row.score) != null && num(row.score) < 0) return 'A score cannot be negative.';
        return null;
      },
      summary: function (rows) {
        var p = rows.map(function (r) { return num(r.pct); }).filter(function (x) { return x != null; });
        var mean = p.length ? Math.round(p.reduce(function (a, b) { return a + b; }, 0) / p.length) : null;
        return [
          { v: rows.length, l: 'Entries' },
          { v: new Set(rows.map(function (r) { return r.learner_id; })).size, l: 'Learners' },
          { v: mean == null ? '—' : mean + '%', l: 'Mean score',
            tone: mean >= 70 ? 'ok' : mean >= 50 ? 'warn' : 'bad' },
          { v: p.filter(function (x) { return x >= 70; }).length, l: 'At or above 70%', tone: 'ok' },
          { v: p.filter(function (x) { return x < 40; }).length, l: 'Below 40%', tone: 'bad' },
          { v: rows.filter(function (r) { return r.published === false; }).length, l: 'Held back from families' }
        ];
      }
    },

    /* ---- item 20 ---------------------------------------------------- */
    progress_reports: {
      table: 'tc_progress_reports',
      title: 'Progress report',
      icon: '📄',
      lead: 'The report a parent actually reads. It stays a DRAFT until you publish it, because a half-written comment must never reach a family. Subject rows are added one at a time and each carries its own mark, grade, effort and comment.',
      order: 'period_start',
      staffOnly: true,
      subjectsField: 'subjects',
      fields: [
        { k: 'learner_id',       l: 'Learner',       t: 'select', lookup: 'learners', req: true },
        { k: 'engagement_id',    l: 'Engagement',    t: 'select', lookup: 'engagements' },
        { k: 'tutor_id',         l: 'Reporting tutor', t: 'select', lookup: 'tutors' },
        { k: 'period_label',     l: 'Period',        t: 'text', req: true, help: 'e.g. "Cycle 3 · March 2026"' },
        { k: 'period_start',     l: 'From',          t: 'date' },
        { k: 'period_end',       l: 'To',            t: 'date' },
        { k: 'subjects',         l: 'Subject rows',  t: 'subjects' },
        { k: 'attendance_pct',   l: 'Attendance %',  t: 'number' },
        { k: 'punctuality',      l: 'Punctuality',   t: 'text' },
        { k: 'homework_pct',     l: 'Homework completed %', t: 'number' },
        { k: 'hours_taught',     l: 'Hours taught',  t: 'number' },
        { k: 'effort',           l: 'Effort',        t: 'select', opts: OPTS.effort, def: 'good' },
        { k: 'behaviour',        l: 'Conduct in class', t: 'text' },
        { k: 'strengths',        l: 'Strengths',     t: 'textarea', req: true },
        { k: 'areas_to_improve', l: 'Areas to improve', t: 'textarea', req: true },
        { k: 'tutor_comment',    l: 'Tutor comment', t: 'textarea', req: true },
        { k: 'admin_comment',    l: 'Studio comment', t: 'textarea' },
        { k: 'next_steps',       l: 'Next steps',    t: 'textarea' },
        { k: 'status',           l: 'Status',        t: 'select', opts: OPTS.reportState, def: 'draft',
          help: 'Only "published" is visible to the family.' },
        { k: 'note',             l: 'Internal note', t: 'textarea' }
      ],
      columns: ['learner_id', 'period_label', 'attendance_pct', 'homework_pct', 'effort', 'status'],
      rowActions: function (row) {
        return [{ label: '🖨 Print', act: 'print-report' }];
      },
      summary: function (rows) {
        return [
          { v: rows.length, l: 'Reports' },
          { v: rows.filter(function (r) { return r.status === 'draft'; }).length, l: 'Draft', tone: 'warn' },
          { v: rows.filter(function (r) { return r.status === 'published'; }).length, l: 'Published', tone: 'ok' },
          { v: rows.filter(function (r) { return r.parent_ack; }).length, l: 'Acknowledged by a parent' },
          { v: new Set(rows.map(function (r) { return r.learner_id; })).size, l: 'Learners covered' }
        ];
      }
    },

    /* ---- item 9 ----------------------------------------------------- */
    timezones: {
      table: 'tc_timezone_desk',
      title: 'Timezone entry',
      icon: '🌐',
      lead: 'The converter could always turn 6pm Lagos into 12pm Toronto. What it could not do was remember that this tutor will not teach before 07:00, that this family observes daylight saving, or that this board publishes in UTC. Those are facts about people, and they have to be recorded.',
      order: 'party_type',
      staffOnly: true,
      fields: [
        { k: 'party_type',   l: 'This entry is for', t: 'select', opts: OPTS.party, def: 'tutor', req: true },
        { k: 'tutor_id',     l: 'Tutor',      t: 'select', lookup: 'tutors',   help: 'When the entry is for a tutor.' },
        { k: 'learner_id',   l: 'Learner',    t: 'select', lookup: 'learners', help: 'When the entry is for a learner.' },
        { k: 'label',        l: 'Label',      t: 'text', help: 'For a studio or exam-board entry, e.g. "Cambridge results release".' },
        { k: 'city',         l: 'City',       t: 'text' },
        { k: 'country',      l: 'Country',    t: 'text' },
        { k: 'tz',           l: 'Time zone',  t: 'select', opts: OPTS.tz, req: true, free: true,
          help: 'IANA name. The list covers where the studio actually teaches; type any other.' },
        { k: 'utc_offset',   l: 'UTC offset', t: 'text', help: 'Filled in for you when you pick a time zone.' },
        { k: 'observes_dst', l: 'Observes daylight saving', t: 'checkbox' },
        { k: 'work_from',    l: 'Available from', t: 'time', help: 'In this person\u2019s OWN local time.' },
        { k: 'work_to',      l: 'Available until', t: 'time' },
        { k: 'work_days',    l: 'Days available', t: 'multiselect', opts: OPTS.days,
          def: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
        { k: 'blackout',     l: 'Never schedule', t: 'textarea',
          help: 'e.g. "No classes Friday 12:00–14:00", "Nothing during exam week".' },
        { k: 'preferred_contact', l: 'Best way to reach them', t: 'text' },
        { k: 'is_default',   l: 'This is the studio clock', t: 'checkbox' },
        { k: 'active',       l: 'Active',     t: 'checkbox', def: true },
        { k: 'note',         l: 'Note',       t: 'textarea' }
      ],
      columns: ['party_type', 'label', 'city', 'country', 'tz', 'utc_offset', 'work_from', 'work_to', 'active'],
      validate: function (row) {
        if (row.party_type === 'tutor' && !row.tutor_id && !row.label) {
          return 'Choose the tutor this entry belongs to, or give it a label.';
        }
        if (row.party_type === 'learner' && !row.learner_id && !row.label) {
          return 'Choose the learner this entry belongs to, or give it a label.';
        }
        return null;
      },
      // Live clocks are more useful than a stored offset, so the desk shows both.
      extra: function (rows, host) {
        var box = d.createElement('div');
        box.className = 'card';
        box.style.marginTop = '12px';
        var tick = function () {
          box.innerHTML = '<h3 style="margin-top:0">🕒 Live clocks</h3>' +
            '<div class="grid grid-4" style="gap:10px">' +
            rows.filter(function (r) { return r.active !== false; }).slice(0, 24).map(function (r) {
              var t = '—', off = '';
              try {
                t = new Intl.DateTimeFormat(undefined, {
                  timeZone: r.tz, hour: '2-digit', minute: '2-digit', weekday: 'short'
                }).format(new Date());
                off = new Intl.DateTimeFormat('en', {
                  timeZone: r.tz, timeZoneName: 'shortOffset'
                }).formatToParts(new Date()).filter(function (p) { return p.type === 'timeZoneName'; })
                  .map(function (p) { return p.value; }).join('');
              } catch (e) { t = 'unknown zone'; }
              return '<div class="stat-card" style="text-align:left">' +
                '<div class="stat-value" style="font-size:1.15rem">' + esc(t) + '</div>' +
                '<div class="stat-label">' + esc(r.label || r.city || r.tz) +
                (off ? ' · ' + esc(off) : '') + '</div></div>';
            }).join('') + '</div>' +
            '<p class="muted" style="margin:8px 0 0;font-size:.8rem">Clocks refresh every 30 seconds and use your browser\u2019s own time-zone database, so daylight saving is always correct without anyone maintaining a table.</p>';
        };
        tick();
        if (host._clockTimer) clearInterval(host._clockTimer);
        host._clockTimer = setInterval(tick, 30000);
        return box;
      },
      summary: function (rows) {
        return [
          { v: rows.length, l: 'Entries' },
          { v: new Set(rows.map(function (r) { return r.tz; })).size, l: 'Distinct time zones' },
          { v: rows.filter(function (r) { return r.party_type === 'tutor'; }).length, l: 'Tutors' },
          { v: rows.filter(function (r) { return r.party_type === 'learner'; }).length, l: 'Learners' },
          { v: rows.filter(function (r) { return r.observes_dst; }).length, l: 'Observe daylight saving', tone: 'warn' }
        ];
      }
    }
  };

  /* ==========================================================================
     THE ENGINE
     ========================================================================== */
  var Desk = {

    DESKS: DESKS,
    Lookups: Lookups,

    async mount(key, opts) {
      opts = opts || {};
      var cfg = DESKS[key];
      if (!cfg) { console.warn('Desk: no such desk "' + key + '"'); return; }

      var host = d.getElementById(opts.into || 'desk-root');
      if (!host) {
        // The page did not provide a mount point. Add one rather than failing
        // silently, which is what a stub page would otherwise do.
        host = d.createElement('div');
        host.id = 'desk-root';
        var main = d.querySelector('.app-content') || d.querySelector('main');
        if (!main) return;
        main.appendChild(host);
      }

      var state = {
        key: key, cfg: cfg, host: host,
        rows: [], editing: null, filter: '', page: 0, size: 25,
        sortKey: cfg.order, sortDir: 'desc'
      };
      host._deskState = state;
      this._states = this._states || {};
      this._states[key] = state;

      host.innerHTML = '<div class="card"><p class="muted">Loading the ' +
        esc(cfg.title.toLowerCase()) + ' desk…</p></div>';

      // Warm the lookups the form needs, in parallel.
      var need = {};
      cfg.fields.forEach(function (f) { if (f.lookup) need[f.lookup] = 1; });
      await Promise.all(Object.keys(need).map(function (n) { return Lookups.get(n); }));

      await this.reload(key);
    },

    async reload(key) {
      var st = this._states[key];
      if (!st) return;
      var s = sb();
      if (!s || !s.from) {
        st.rows = [];
        this._paint(st, 'Connect Supabase to load and save entries. The form below still shows exactly what will be recorded.');
        return;
      }
      try {
        var q = s.from(st.cfg.table).select('*').limit(1000);
        if (st.cfg.order) q = q.order(st.cfg.order, { ascending: false });
        var res = await q;
        if (res.error) throw res.error;
        st.rows = res.data || [];
        this._paint(st, null);
      } catch (err) {
        var msg = String(err.message || err);
        // The single most likely error on first use, answered precisely.
        if (/relation .* does not exist|schema cache|Could not find the table/i.test(msg)) {
          this._paint(st, 'The table <code>' + esc(st.cfg.table) + '</code> is not in your database yet. ' +
            'Open the Supabase SQL editor and run <b>database/complete-schema.sql</b> (V25 or later), then reload this page. ' +
            'Nothing is lost — the form below is ready as soon as the table exists.');
        } else {
          this._paint(st, 'Could not load entries: ' + esc(msg));
        }
      }
    },

    /* ---- Rendering ----------------------------------------------------- */
    _paint(st, banner) {
      var cfg = st.cfg;
      var self = this;
      var role = (w.TCNav && w.TCNav.role && w.TCNav.role()) ||
                 String((w.App && w.App.currentRole) || '').toLowerCase();
      var canWrite = !(role === 'parent' || role === 'student');

      var html = [];

      if (banner) {
        html.push('<div class="card" style="border-left:4px solid #f59e0b;background:#fffbeb">' +
          '<b>Heads up.</b> ' + banner + '</div>');
      }

      /* --- summary strip: the analysis the page always promised --------- */
      var stats = cfg.summary ? cfg.summary(st.rows) : [];
      if (stats.length) {
        html.push('<div class="grid grid-4" style="gap:10px;margin-bottom:14px">' +
          stats.map(function (x) {
            var col = x.tone === 'ok' ? '#059669' : x.tone === 'bad' ? '#b91c1c'
                    : x.tone === 'warn' ? '#b45309' : 'inherit';
            return '<div class="stat-card"><div class="stat-value" style="color:' + col + '">' +
              esc(x.v) + '</div><div class="stat-label">' + esc(x.l) + '</div></div>';
          }).join('') + '</div>');
      }

      /* --- the entry form ---------------------------------------------- */
      if (canWrite) {
        html.push(
          '<section class="card" id="desk-form-card">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">' +
              '<div><h2 style="margin:0 0 4px">' + cfg.icon + ' ' +
                '<span id="desk-form-title">Add a ' + esc(cfg.title.toLowerCase()) + '</span></h2>' +
                '<p class="muted" style="margin:0;max-width:900px">' + cfg.lead + '</p></div>' +
              '<button class="btn btn-ghost btn-sm" type="button" data-desk="reset">↺ Clear form</button>' +
            '</div>' +
            '<div id="desk-error" style="display:none;margin-top:12px;padding:10px 12px;border-radius:10px;' +
              'background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:.88rem"></div>' +
            '<div class="grid grid-2" style="margin-top:14px">' +
              cfg.fields.filter(function (f) { return !f.hide; })
                        .map(function (f) { return self._field(f); }).join('') +
            '</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">' +
              '<button class="btn btn-primary" type="button" data-desk="save">💾 Save entry</button>' +
              '<button class="btn btn-outline" type="button" data-desk="save-new">💾 Save &amp; add another</button>' +
              '<button class="btn btn-ghost" type="button" data-desk="cancel" style="display:none">Cancel edit</button>' +
            '</div>' +
          '</section>');
      } else {
        html.push('<div class="card" style="border-left:4px solid var(--primary,#0506ae)">' +
          '<b>👁 View only.</b> These entries are recorded by the studio. ' +
          'If something looks wrong, use <a href="complaints.html">Raise a concern</a>.</div>');
      }

      /* --- the list ----------------------------------------------------- */
      html.push('<section class="card" style="margin-top:14px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">' +
          '<h3 style="margin:0">' + esc(cfg.title) + ' records <span class="muted">(' + st.rows.length + ')</span></h3>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
            '<input id="desk-q" type="search" class="form-input" placeholder="🔎 Filter…" ' +
              'style="width:190px;padding:6px 10px" value="' + esc(st.filter) + '">' +
            '<button class="btn btn-sm btn-outline" type="button" data-desk="csv">⬇ CSV</button>' +
            '<button class="btn btn-sm btn-outline" type="button" data-desk="print">🖨 Print</button>' +
            '<button class="btn btn-sm btn-ghost" type="button" data-desk="refresh">↻</button>' +
          '</div></div>' +
        '<div id="desk-list" style="margin-top:12px">' + this._table(st, canWrite) + '</div>' +
      '</section>');

      st.host.innerHTML = html.join('');

      /* --- optional per-desk extra panel -------------------------------- */
      if (cfg.extra) {
        try {
          var el = cfg.extra(st.rows, st);
          if (el) st.host.appendChild(el);
        } catch (e) {}
      }

      this._wire(st, canWrite);
      if (st.editing) this._fill(st, st.editing);
    },

    _field(f) {
      var id = 'df-' + f.k;
      var lab = '<label for="' + id + '">' + esc(f.l) +
        (f.req ? ' <span style="color:#b91c1c" title="Required">*</span>' : '') + '</label>';
      var help = f.help ? '<div class="form-help">' + f.help + '</div>' : '';
      var span = (f.t === 'textarea' || f.t === 'subjects' || f.t === 'multiselect')
        ? ' style="grid-column:1/-1"' : '';
      var ctl;

      if (f.t === 'textarea') {
        ctl = '<textarea class="form-textarea" id="' + id + '" rows="2"></textarea>';

      } else if (f.t === 'select') {
        var o = ['<option value="">— choose —</option>'];
        if (f.opts) o = o.concat(f.opts.map(function (x) {
          return '<option value="' + esc(x) + '">' + esc(x) + '</option>';
        }));
        ctl = '<select class="form-select" id="' + id + '" ' +
              (f.lookup ? 'data-lookup="' + f.lookup + '"' : '') + '>' + o.join('') + '</select>';
        if (f.free) {
          // "free" means: pick from the list, or type something the list does
          // not have yet. Both, not one or the other.
          ctl += '<input class="form-input" id="' + id + '-free" placeholder="…or type a new one" ' +
                 'style="margin-top:6px;font-size:.85rem">';
        }

      } else if (f.t === 'multiselect') {
        ctl = '<div id="' + id + '" class="desk-multi" style="display:flex;gap:12px;flex-wrap:wrap">' +
          (f.opts || []).map(function (x) {
            return '<label style="display:flex;gap:5px;align-items:center;font-weight:400">' +
              '<input type="checkbox" value="' + esc(x) + '"> ' + esc(x) + '</label>';
          }).join('') + '</div>';

      } else if (f.t === 'checkbox') {
        return '<div class="form-group"><label style="display:flex;gap:8px;align-items:center;font-weight:400">' +
          '<input type="checkbox" id="' + id + '"> ' + esc(f.l) + '</label>' + help + '</div>';

      } else if (f.t === 'tags') {
        ctl = '<input class="form-input" id="' + id + '" placeholder="comma, separated, values">';

      } else if (f.t === 'subjects') {
        // A repeating sub-form. Progress reports need one row per subject.
        ctl = '<div id="' + id + '" class="desk-subjects">' +
          '<div class="desk-subject-rows"></div>' +
          '<button class="btn btn-sm btn-outline" type="button" data-desk="add-subject" ' +
            'style="margin-top:8px">＋ Add a subject row</button></div>';

      } else {
        var t = f.t === 'number' ? 'number' : f.t === 'date' ? 'date'
              : f.t === 'time' ? 'time' : f.t === 'url' ? 'url' : 'text';
        ctl = '<input class="form-input" type="' + t + '" id="' + id + '"' +
              (f.t === 'number' ? ' step="any"' : '') + '>';
      }

      return '<div class="form-group"' + span + '>' + lab + ctl + help + '</div>';
    },

    _table(st, canWrite) {
      var cfg = st.cfg;
      var self = this;
      var cols = cfg.columns.concat((cfg.derived || []).map(function (x) { return x.k; }))
        .filter(function (v, i, a) { return a.indexOf(v) === i; });

      var rows = st.rows;
      if (st.filter) {
        var q = st.filter.toLowerCase();
        rows = rows.filter(function (r) {
          return Object.keys(r).some(function (k) {
            return String(r[k] == null ? '' : r[k]).toLowerCase().indexOf(q) > -1;
          }) || cols.some(function (c) {
            return String(self._display(r, c, cfg)).toLowerCase().indexOf(q) > -1;
          });
        });
      }

      if (!rows.length) {
        return '<div style="text-align:center;padding:30px 12px;color:var(--gray-500,#64748b)">' +
          '<div style="font-size:2rem">' + cfg.icon + '</div>' +
          '<p style="margin:8px 0 2px"><b>No ' + esc(cfg.title.toLowerCase()) + ' recorded yet.</b></p>' +
          '<p style="margin:0;font-size:.88rem">' +
          (st.filter ? 'Nothing matches that filter — clear it to see everything.'
                     : 'Fill the form above and press <b>Save entry</b>. Every entry can be edited or deleted afterwards.') +
          '</p></div>';
      }

      var head = cols.map(function (c) {
        var f = cfg.fields.filter(function (x) { return x.k === c; })[0];
        var dv = (cfg.derived || []).filter(function (x) { return x.k === c; })[0];
        return '<th data-desk-sort="' + esc(c) + '" style="cursor:pointer;white-space:nowrap">' +
          esc(f ? f.l : dv ? dv.l : c) +
          (st.sortKey === c ? (st.sortDir === 'asc' ? ' ▲' : ' ▼') : '') + '</th>';
      }).join('');

      var sorted = rows.slice().sort(function (a, b) {
        var x = a[st.sortKey], y = b[st.sortKey];
        if (x == null) return 1;
        if (y == null) return -1;
        var r = (x > y) - (x < y);
        return st.sortDir === 'asc' ? r : -r;
      });

      var body = sorted.map(function (r) {
        var extra = cfg.rowActions ? cfg.rowActions(r) : [];
        return '<tr>' + cols.map(function (c) {
          return '<td>' + self._display(r, c, cfg) + '</td>';
        }).join('') +
        '<td style="white-space:nowrap;text-align:right">' +
          extra.map(function (a) {
            return '<button class="btn btn-sm btn-ghost" type="button" data-desk-act="' +
              esc(a.act) + '" data-id="' + esc(r.id) + '">' + esc(a.label) + '</button>';
          }).join('') +
          (canWrite
            ? '<button class="btn btn-sm btn-outline" type="button" data-desk-edit="' + esc(r.id) + '">✏️ Edit</button>' +
              '<button class="btn btn-sm btn-outline" type="button" data-desk-dup="' + esc(r.id) + '">⧉ Copy</button>' +
              '<button class="btn btn-sm btn-ghost" type="button" data-desk-del="' + esc(r.id) + '" ' +
                'style="color:#b42318">🗑 Delete</button>'
            : '') +
        '</td></tr>';
      }).join('');

      return '<div class="table-wrap"><table style="width:100%;font-size:.88rem">' +
        '<thead><tr>' + head + '<th style="text-align:right">Actions</th></tr></thead>' +
        '<tbody>' + body + '</tbody></table></div>';
    },

    /* Turn a stored value into something a person can read. A raw uuid in a
       "Learner" column is the fastest way to make a page feel broken. */
    _display(row, col, cfg) {
      var v = row[col];
      var f = (cfg.fields || []).filter(function (x) { return x.k === col; })[0];

      if (f && f.lookup) {
        var opts = Lookups._cache[f.lookup] || [];
        var hit = opts.filter(function (o) { return String(o.v) === String(v); })[0];
        return hit ? esc(hit.t) : (v ? '<span class="muted">' + esc(String(v).slice(0, 8)) + '…</span>' : '—');
      }
      if (v === true) return '✅';
      if (v === false) return '—';
      if (v == null || v === '') return '—';
      if (Array.isArray(v)) return v.length ? esc(v.join(', ')) : '—';
      if (typeof v === 'object') return esc(JSON.stringify(v).slice(0, 60));

      // Risk / status colouring, so the board reads at a glance.
      if (col === 'risk_level' || col === 'status') {
        var tone = { urgent: '#b91c1c', concern: '#b45309', watch: '#0369a1',
                     cleared: '#059669', draft: '#b45309', published: '#059669',
                     archived: '#64748b', open: '#0369a1', confirmed: '#059669',
                     rejected: '#b91c1c' }[String(v).toLowerCase()];
        if (tone) return '<span style="color:' + tone + ';font-weight:700">' + esc(v) + '</span>';
      }
      return esc(v);
    },

    /* ---- Events -------------------------------------------------------- */
    _wire(st, canWrite) {
      var self = this;
      var host = st.host;

      host.querySelectorAll('[data-desk]').forEach(function (b) {
        b.addEventListener('click', function () {
          var a = b.getAttribute('data-desk');
          if (a === 'save')       self._save(st, false);
          if (a === 'save-new')   self._save(st, true);
          if (a === 'reset')      { st.editing = null; self._paint(st, null); }
          if (a === 'cancel')     { st.editing = null; self._paint(st, null); }
          if (a === 'refresh')    self.reload(st.key);
          if (a === 'csv')        self._csv(st);
          if (a === 'print')      self._print(st);
          if (a === 'add-subject') self._addSubjectRow(st);
        });
      });

      var q = host.querySelector('#desk-q');
      if (q) q.addEventListener('input', function () {
        st.filter = q.value;
        var list = host.querySelector('#desk-list');
        if (list) list.innerHTML = self._table(st, canWrite);
        self._wireRows(st, canWrite);
      });

      // Picking a time zone fills in the offset, rather than asking for it.
      var tzSel = host.querySelector('#df-tz');
      var offIn = host.querySelector('#df-utc_offset');
      if (tzSel && offIn) {
        tzSel.addEventListener('change', function () {
          try {
            var parts = new Intl.DateTimeFormat('en', {
              timeZone: tzSel.value, timeZoneName: 'longOffset'
            }).formatToParts(new Date());
            var nm = parts.filter(function (p) { return p.type === 'timeZoneName'; })[0];
            offIn.value = nm ? nm.value.replace('GMT', '') || '+00:00' : '';
          } catch (e) { offIn.value = ''; }
        });
      }

      // Defaults, then lookups.
      st.cfg.fields.forEach(function (f) {
        var el = host.querySelector('#df-' + f.k);
        if (!el) return;
        if (f.def === 'today' && !el.value) el.value = new Date().toISOString().slice(0, 10);
        else if (f.t === 'checkbox' && f.def === true) el.checked = true;
        else if (f.def != null && f.def !== 'today' && !Array.isArray(f.def) && f.t !== 'checkbox' && !el.value) {
          el.value = f.def;
        }
        if (f.t === 'multiselect' && Array.isArray(f.def)) {
          el.querySelectorAll('input[type=checkbox]').forEach(function (c) {
            c.checked = f.def.indexOf(c.value) > -1;
          });
        }
        if (f.lookup) {
          var opts = Lookups._cache[f.lookup] || [];
          el.innerHTML = '<option value="">— choose —</option>' +
            opts.map(function (o) {
              return '<option value="' + esc(o.v) + '">' + esc(o.t) + '</option>';
            }).join('');
          if (!opts.length) {
            el.innerHTML = '<option value="">— nothing to choose yet —</option>';
            el.disabled = true;
            var hint = d.createElement('div');
            hint.className = 'form-help';
            hint.innerHTML = 'No ' + esc(f.lookup) + ' exist yet. Add one on the <a href="' +
              esc(f.lookup) + '.html">' + esc(f.lookup) + '</a> page and this list fills itself.';
            el.parentNode.appendChild(hint);
          }
        }
      });

      // Pre-select the learner when the page was opened with ?learner=…
      try {
        var qs = new URLSearchParams(w.location.search);
        ['learner', 'learner_id'].forEach(function (p) {
          var v = qs.get(p);
          var el = host.querySelector('#df-learner_id');
          if (v && el) el.value = v;
        });
        var eng = qs.get('engagement') || qs.get('group');
        var eel = host.querySelector('#df-engagement_id');
        if (eng && eel) eel.value = eng;
      } catch (e) {}

      this._wireRows(st, canWrite);
    },

    _wireRows(st, canWrite) {
      var self = this;
      var host = st.host;

      host.querySelectorAll('[data-desk-sort]').forEach(function (th) {
        th.addEventListener('click', function () {
          var k = th.getAttribute('data-desk-sort');
          if (st.sortKey === k) st.sortDir = st.sortDir === 'asc' ? 'desc' : 'asc';
          else { st.sortKey = k; st.sortDir = 'asc'; }
          host.querySelector('#desk-list').innerHTML = self._table(st, canWrite);
          self._wireRows(st, canWrite);
        });
      });

      host.querySelectorAll('[data-desk-edit]').forEach(function (b) {
        b.addEventListener('click', function () {
          var row = st.rows.filter(function (r) { return String(r.id) === b.getAttribute('data-desk-edit'); })[0];
          if (!row) return;
          st.editing = row;
          self._paint(st, null);
          var t = host.querySelector('#desk-form-title');
          if (t) t.textContent = 'Editing this ' + st.cfg.title.toLowerCase();
          var c = host.querySelector('[data-desk="cancel"]');
          if (c) c.style.display = '';
          var s = host.querySelector('[data-desk="save"]');
          if (s) s.textContent = '💾 Update entry';
          host.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });

      host.querySelectorAll('[data-desk-dup]').forEach(function (b) {
        b.addEventListener('click', function () {
          var row = st.rows.filter(function (r) { return String(r.id) === b.getAttribute('data-desk-dup'); })[0];
          if (!row) return;
          var copy = JSON.parse(JSON.stringify(row));
          delete copy.id; delete copy.created_at; delete copy.updated_at;
          st.editing = null;
          self._paint(st, null);
          self._fill(st, copy);
          toast('Copied into the form. Change what differs, then save it as a new entry.', 'info', 6000);
          host.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });

      host.querySelectorAll('[data-desk-del]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var id = b.getAttribute('data-desk-del');
          if (!w.confirm('Delete this ' + st.cfg.title.toLowerCase() + ' permanently?\n\nThis cannot be undone.')) return;
          var s = sb();
          if (!s) return toast('Not connected to the database.', 'warning');
          var res = await s.from(st.cfg.table).delete().eq('id', id);
          if (res.error) toast(res.error.message, 'danger', 8000);
          else { toast('Deleted.', 'success'); self.reload(st.key); }
        });
      });

      host.querySelectorAll('[data-desk-act="print-report"]').forEach(function (b) {
        b.addEventListener('click', function () {
          var row = st.rows.filter(function (r) { return String(r.id) === b.getAttribute('data-id'); })[0];
          if (row) self._printReport(st, row);
        });
      });
    },

    /* ---- Form <-> row -------------------------------------------------- */
    _fill(st, row) {
      var host = st.host;
      st.cfg.fields.forEach(function (f) {
        var el = host.querySelector('#df-' + f.k);
        if (!el) return;
        var v = row[f.k];
        if (f.t === 'checkbox') el.checked = !!v;
        else if (f.t === 'multiselect') {
          var arr = Array.isArray(v) ? v : [];
          el.querySelectorAll('input[type=checkbox]').forEach(function (c) {
            c.checked = arr.indexOf(c.value) > -1;
          });
        } else if (f.t === 'tags') {
          el.value = Array.isArray(v) ? v.join(', ') : (v || '');
        } else if (f.t === 'subjects') {
          var box = el.querySelector('.desk-subject-rows');
          box.innerHTML = '';
          (Array.isArray(v) ? v : []).forEach(function (s) { Desk._subjectRow(box, s); });
        } else if (f.t === 'select' && f.free) {
          var has = [].slice.call(el.options).some(function (o) { return o.value === String(v || ''); });
          if (has) el.value = v == null ? '' : v;
          else {
            var fr = host.querySelector('#df-' + f.k + '-free');
            if (fr) fr.value = v == null ? '' : v;
          }
        } else {
          el.value = v == null ? '' : v;
        }
      });
    },

    _read(st) {
      var host = st.host, out = {};
      st.cfg.fields.forEach(function (f) {
        var el = host.querySelector('#df-' + f.k);
        if (!el) {
          if (f.hide && f.def != null) out[f.k] = f.def;
          return;
        }
        if (f.t === 'checkbox') out[f.k] = !!el.checked;
        else if (f.t === 'multiselect') {
          out[f.k] = [].slice.call(el.querySelectorAll('input:checked')).map(function (c) { return c.value; });
        } else if (f.t === 'tags') {
          out[f.k] = String(el.value || '').split(',').map(function (x) { return x.trim(); })
                       .filter(Boolean);
        } else if (f.t === 'subjects') {
          out[f.k] = [].slice.call(el.querySelectorAll('.desk-subject-row')).map(function (r) {
            return {
              subject: r.querySelector('[data-s=subject]').value,
              score:   r.querySelector('[data-s=score]').value,
              grade:   r.querySelector('[data-s=grade]').value,
              effort:  r.querySelector('[data-s=effort]').value,
              comment: r.querySelector('[data-s=comment]').value
            };
          }).filter(function (r) { return r.subject; });
        } else if (f.t === 'number') {
          out[f.k] = el.value === '' ? null : num(el.value);
        } else if (f.t === 'select' && f.free) {
          var fr = host.querySelector('#df-' + f.k + '-free');
          out[f.k] = (fr && fr.value.trim()) ? fr.value.trim() : (el.value || null);
        } else {
          // An empty date or time must be NULL, not ''. Sending '' is what
          // produced the reported error: invalid input syntax for type numeric: ""
          out[f.k] = el.value === '' ? null : el.value;
        }
      });
      return out;
    },

    async _save(st, again) {
      var self = this;
      var host = st.host;
      var errBox = host.querySelector('#desk-error');
      var show = function (m) {
        if (!errBox) return toast(m, 'danger', 8000);
        errBox.innerHTML = m;
        errBox.style.display = '';
        errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
      if (errBox) errBox.style.display = 'none';

      var row = this._read(st);

      /* Required fields, named in plain language. "Field required" tells a
         tutor nothing when the form has seventeen fields. */
      var missing = st.cfg.fields.filter(function (f) {
        if (!f.req) return false;
        var v = row[f.k];
        return v == null || v === '' || (Array.isArray(v) && !v.length);
      });
      if (missing.length) {
        return show('Please complete: <b>' +
          missing.map(function (f) { return esc(f.l); }).join('</b>, <b>') + '</b>.');
      }

      if (st.cfg.validate) {
        var msg = st.cfg.validate(row);
        if (msg) return show(esc(msg));
      }

      var s = sb();
      if (!s || !s.from) {
        return show('Not connected to the database, so this cannot be saved yet. ' +
          'Check <a href="settings.html">Settings</a> for your Supabase URL and key.');
      }

      // Never send a generated column back to PostgreSQL — it rejects the write.
      (st.cfg.derived || []).forEach(function (dcol) { delete row[dcol.k]; });
      delete row.created_at; delete row.updated_at;

      try {
        var res;
        if (st.editing && st.editing.id) {
          res = await s.from(st.cfg.table).update(row).eq('id', st.editing.id).select();
        } else {
          res = await s.from(st.cfg.table).insert(row).select();
        }
        if (res.error) throw res.error;

        toast(st.editing ? 'Entry updated.' : 'Entry saved.', 'success');
        st.editing = again ? null : null;
        await this.reload(st.key);

        if (again) {
          // Keep the learner and the dates: the next entry is usually for the
          // same session. Re-typing them is the fastest way to lose a tutor.
          var keep = ['learner_id', 'engagement_id', 'subject', 'tutor_id',
                      'reviewed_on', 'period_start', 'period_end', 'taken_on',
                      'predicted_on', 'period_label', 'exam_board', 'scale'];
          var carry = {};
          keep.forEach(function (k) { if (row[k] != null) carry[k] = row[k]; });
          self._fill(st, carry);
          var first = host.querySelector('#desk-form-card .form-input, #desk-form-card .form-select');
          if (first) first.focus();
        }
      } catch (err) {
        var m = String(err.message || err);
        if (/row-level security|permission denied/i.test(m)) {
          show('The database refused this write. That usually means the learner or group ' +
               'is not assigned to you — a tutor may only record entries for their own ' +
               'learners. Ask an administrator to assign the engagement, or sign in as an administrator.');
        } else if (/schema cache|does not exist/i.test(m)) {
          show('A column this desk needs is missing from your database. Run ' +
               '<b>database/complete-schema.sql</b> (V25 or later) in the Supabase SQL editor, then reload. ' +
               '<br><small>' + esc(m) + '</small>');
        } else {
          show('Could not save: ' + esc(m));
        }
      }
    },

    /* ---- Repeating subject rows (progress reports) ---------------------- */
    _addSubjectRow(st) {
      var box = st.host.querySelector('.desk-subject-rows');
      if (box) this._subjectRow(box, {});
    },
    _subjectRow(box, v) {
      v = v || {};
      var subs = Lookups._cache['subjects'] || [];
      var row = d.createElement('div');
      row.className = 'desk-subject-row';
      row.style.cssText = 'display:grid;grid-template-columns:1.4fr .6fr .6fr .8fr 2fr auto;' +
                          'gap:6px;margin-bottom:6px;align-items:center';
      row.innerHTML =
        '<input class="form-input" data-s="subject" list="desk-subject-list" placeholder="Subject" value="' + esc(v.subject || '') + '">' +
        '<input class="form-input" data-s="score" type="number" step="any" placeholder="%" value="' + esc(v.score || '') + '">' +
        '<input class="form-input" data-s="grade" placeholder="Grade" value="' + esc(v.grade || '') + '">' +
        '<select class="form-select" data-s="effort">' +
          ['', 'excellent', 'good', 'fair', 'needs work'].map(function (o) {
            return '<option' + (o === (v.effort || '') ? ' selected' : '') + '>' + o + '</option>';
          }).join('') + '</select>' +
        '<input class="form-input" data-s="comment" placeholder="Comment" value="' + esc(v.comment || '') + '">' +
        '<button class="btn btn-sm btn-ghost" type="button" style="color:#b42318" title="Remove this subject">✕</button>';
      row.querySelector('button').addEventListener('click', function () { row.remove(); });
      box.appendChild(row);

      if (!d.getElementById('desk-subject-list')) {
        var dl = d.createElement('datalist');
        dl.id = 'desk-subject-list';
        dl.innerHTML = subs.map(function (s) { return '<option value="' + esc(s.t) + '">'; }).join('');
        d.body.appendChild(dl);
      }
    },

    /* ---- Export and print ----------------------------------------------- */
    _csv(st) {
      var cfg = st.cfg;
      var cols = cfg.columns.concat((cfg.derived || []).map(function (x) { return x.k; }));
      var q = function (v) {
        v = v == null ? '' : String(v);
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      };
      var head = cols.map(function (c) {
        var f = cfg.fields.filter(function (x) { return x.k === c; })[0];
        return q(f ? f.l : c);
      }).join(',');
      var body = st.rows.map(function (r) {
        return cols.map(function (c) {
          var f = cfg.fields.filter(function (x) { return x.k === c; })[0];
          if (f && f.lookup) {
            var hit = (Lookups._cache[f.lookup] || []).filter(function (o) {
              return String(o.v) === String(r[c]);
            })[0];
            return q(hit ? hit.t : r[c]);
          }
          return q(Array.isArray(r[c]) ? r[c].join('; ') : r[c]);
        }).join(',');
      }).join('\n');

      var blob = new Blob([head + '\n' + body], { type: 'text/csv;charset=utf-8' });
      var a = d.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = st.key + '-' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      toast('Exported ' + st.rows.length + ' row(s).', 'success');
    },

    _print(st) {
      var wnd = w.open('', '_blank');
      if (!wnd) return toast('Your browser blocked the print window.', 'warning');
      var studio = (w.PRACTICE && w.PRACTICE.name) || 'Tutoring studio';
      wnd.document.write('<html><head><title>' + esc(st.cfg.title) + '</title>' +
        '<style>body{font-family:system-ui,sans-serif;padding:24px;color:#111}' +
        'h1{margin:0 0 2px;font-size:1.3rem}table{width:100%;border-collapse:collapse;font-size:.8rem;margin-top:14px}' +
        'th,td{border:1px solid #cbd5e1;padding:5px 7px;text-align:left}th{background:#f1f5f9}' +
        '.muted{color:#64748b;font-size:.8rem}</style></head><body>' +
        '<h1>' + esc(studio) + ' — ' + esc(st.cfg.title) + '</h1>' +
        '<div class="muted">' + st.rows.length + ' record(s) · printed ' +
        new Date().toLocaleString() + '</div>' +
        this._table(st, false).replace(/<button[^>]*>.*?<\/button>/g, '') +
        '</body></html>');
      wnd.document.close();
      wnd.focus();
      setTimeout(function () { wnd.print(); }, 350);
    },

    /* A real, printable progress report — not a table row. */
    _printReport(st, row) {
      var learner = (Lookups._cache['learners'] || []).filter(function (o) {
        return String(o.v) === String(row.learner_id);
      })[0];
      var studio = (w.PRACTICE && w.PRACTICE.name) || 'Tutoring studio';
      var subs = Array.isArray(row.subjects) ? row.subjects : [];
      var wnd = w.open('', '_blank');
      if (!wnd) return toast('Your browser blocked the print window.', 'warning');
      wnd.document.write(
        '<html><head><title>Progress report — ' + esc(learner ? learner.t : '') + '</title>' +
        '<style>body{font-family:Georgia,serif;padding:32px;color:#111;max-width:820px;margin:auto}' +
        'h1{margin:0;font-size:1.5rem;color:#0506ae}h2{font-size:1rem;margin:20px 0 6px;' +
        'border-bottom:2px solid #964eec;padding-bottom:3px}table{width:100%;border-collapse:collapse;font-size:.85rem}' +
        'th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}th{background:#f1f5f9}' +
        '.meta{color:#475569;font-size:.85rem}.box{border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin:6px 0}' +
        '.draft{position:fixed;top:40%;left:12%;font-size:6rem;color:rgba(180,35,24,.12);transform:rotate(-25deg)}' +
        '</style></head><body>' +
        (row.status !== 'published' ? '<div class="draft">DRAFT</div>' : '') +
        '<h1>' + esc(studio) + '</h1>' +
        '<div class="meta">Progress report · ' + esc(row.period_label || '') + '</div>' +
        '<h2>Learner</h2><div class="box"><b>' + esc(learner ? learner.t : '—') + '</b><br>' +
        '<span class="meta">Period: ' + esc(row.period_start || '—') + ' to ' + esc(row.period_end || '—') +
        ' · Attendance: ' + esc(row.attendance_pct == null ? '—' : row.attendance_pct + '%') +
        ' · Homework: ' + esc(row.homework_pct == null ? '—' : row.homework_pct + '%') +
        ' · Effort: ' + esc(row.effort || '—') + '</span></div>' +
        (subs.length
          ? '<h2>Subjects</h2><table><thead><tr><th>Subject</th><th>Score</th><th>Grade</th>' +
            '<th>Effort</th><th>Comment</th></tr></thead><tbody>' +
            subs.map(function (s) {
              return '<tr><td>' + esc(s.subject) + '</td><td>' + esc(s.score) + '</td><td>' +
                esc(s.grade) + '</td><td>' + esc(s.effort) + '</td><td>' + esc(s.comment) + '</td></tr>';
            }).join('') + '</tbody></table>'
          : '') +
        '<h2>Strengths</h2><div class="box">' + esc(row.strengths || '—') + '</div>' +
        '<h2>Areas to improve</h2><div class="box">' + esc(row.areas_to_improve || '—') + '</div>' +
        '<h2>Tutor comment</h2><div class="box">' + esc(row.tutor_comment || '—') + '</div>' +
        (row.admin_comment ? '<h2>Studio comment</h2><div class="box">' + esc(row.admin_comment) + '</div>' : '') +
        (row.next_steps ? '<h2>Next steps</h2><div class="box">' + esc(row.next_steps) + '</div>' : '') +
        '<p class="meta" style="margin-top:28px">Issued ' +
        esc(row.published_on ? new Date(row.published_on).toLocaleDateString() : new Date().toLocaleDateString()) +
        ' · ' + esc(studio) + '</p>' +
        '</body></html>');
      wnd.document.close();
      wnd.focus();
      setTimeout(function () { wnd.print(); }, 400);
    }
  };

  w.Desk = Desk;
  if (w.TC) w.TC.Desk = Desk;
})(window);
