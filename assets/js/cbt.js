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
    let type = String(pick('type','question_type','questionType') || 'mcq').toLowerCase().replace(/[\s/\-]+/g,'_');
    if (['tf','boolean','truefalse','true_or_false','yes_no','yesno'].includes(type)) type = 'true_false';
    if (['multiplechoice','multiple_choice','single_choice','objective'].includes(type)) type = 'mcq';
    if (['mrq','multiple_response','multiselect','checkbox'].includes(type)) type = 'multi_select';
    if (['number','integer','decimal','calculation'].includes(type)) type = 'numeric';
    if (['short','text','free_text'].includes(type)) type = 'short_answer';
    if (['math','equation','latex'].includes(type)) type = 'math_equation';
    let options = pick('options','choices','alternatives') || [];
    if (typeof options === 'string') {
      try { const p = JSON.parse(options); if (Array.isArray(p)) options = p; }
      catch (_) { options = options.split(/[|;]/).map(s => s.trim()).filter(Boolean); }
    }
    if (!Array.isArray(options)) options = [];
    if (!options.length) {
      ['a','b','c','d','e'].forEach((letter, i) => {
        const v = pick(letter, 'option_'+letter, 'option'+(i+1));
        if (v) options.push(String(v));
      });
    }
    if (type === 'true_false') options = ['True','False'];
    let answer = pick('answer','correct','correct_answer','correctAnswer','key','correct_option');
    if (type === 'multi_select' && typeof answer === 'string') answer = answer.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
    return {
      id: pick('id') || ('q'+(idx+1)),
      _orig_index: idx,
      type,
      subject: pick('subject','section','exam_subject') || '',
      question: pick('question','prompt','text','question_text') || '',
      passage: pick('passage','context','case_text') || '',
      options,
      answer, correct: answer,
      mark: Number(pick('mark','marks','score','points') || 1) || 1,
      explanation: pick('explanation','reason','solution') || '',
      media_url: pick('media_url','image','audio_url','video_url','image_url') || '',
      tolerance: pick('tolerance') || '',
      pairs: pick('pairs','matches') || null
    };
  },

  parseCSV(text) {
    const lines = String(text||'').replace(/^\uFEFF/,'').trim().split(/\r?\n/);
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
  _splitCsv(line) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = !q;
      else if (ch === ',' && !q) { out.push(cur); cur = ''; }
      else cur += ch;
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

  promptPack(level, topic, count, klass, extra) {
    extra = extra || {};
    const types17 = this.QUESTION_TYPES_17.join(', ');
    const typesAll = this.allTypes().join(', ');
    const head = `You are an expert examination setter for a Nigerian/international tutoring studio (ADEWALE CLASSROOM / Tutoring Connect).
Return ONLY a CSV with headers:
question,type,subject,a,b,c,d,answer,mark,explanation,passage,media_url,tolerance
Do not wrap in markdown. Use exactly ${count} rows. Topic: "${topic}". Level: ${klass || 'tutoring learner'}.
media_url must be a public https or Google Drive / YouTube link — never a file upload.`;
    const packs = {
      simple: `${head}
Use ONLY these SIMPLE types: mcq (4 options) and true_false.
answer is the exact option text or True/False.`,
      intermediate: `${head}
Mix INTERMEDIATE types: mcq, true_false, numeric, short_answer, multi_select, fill_blank.
For numeric set tolerance. For multi_select join keys with |.`,
      advanced: `${head}
ADVANCED mix for [CLASS/LEVEL]=${klass || '[CLASS/LEVEL]'}: mcq, multi_select, numeric, matching, ordering, comprehension, case_study, assertion_reason, error_spotting, cloze.
Put long stems in passage. Every objective row needs a key.`,
      enterprise: `${head}
ENTERPRISE CBT Pro pack — use as many of these 17 core types as the topic allows: ${types17}.
Plus these studio extras where useful: ${this.QUESTION_TYPES_PLUS.join(', ')}.
Matching answer: left=right|left=right. Ordering answer: a|b|c.
Comprehension/case_study: passage column. Image/audio/video: Drive or YouTube URL in media_url.`,
      self: `${head}
SELF-QUIZ (practice, not graded). Start easy and climb. Include 1 worked-example short_answer.
Types: mcq, true_false, numeric, fill_blank, short_answer.`,
      review: `${head}
REVIEW-QUIZ after a taught lesson on "${topic}". Include 2 misconception traps.
Types: mcq, true_false, short_answer, numeric, comprehension, assertion_reason.`,
      graded: `${head}
GRADED-QUIZ — exhaustive, official, will be pushed to the scoresheet.
Use at least 8 different types from: ${typesAll}.
Every objective item MUST have a correct key. Essays may leave answer blank.`,
      reading_article: `${head}
The learner just READ this material (link, do not invent a paywall):
${extra.source || '[PASTE ARTICLE OR DRIVE LINK]'}
Write questions that can ONLY be answered by someone who actually read it.
Use: comprehension, short_answer, mcq, assertion_reason, citation, cloze.
Put the source URL in media_url on every row.`,
      reading_video: `${head}
The learner just WATCHED this video:
${extra.source || '[PASTE YOUTUBE OR DRIVE VIDEO LINK]'}
Ask about timestamps, claims, worked examples on screen, and what to try next.
Use: video_based, short_answer, mcq, true_false, scenario_mcq.
Put the video URL in media_url. Mention a timestamp in the question where useful.`,
      reading_pack: `${head}
The learner completed a READING ASSIGNMENT pack titled "${topic}" with these links:
${extra.source || '[LIST THE ARTICLE + VIDEO LINKS]'}
Write a mixed Self-Quiz that checks they did the reading AND are ready for the next live class.
Use: comprehension, video_based, short_answer, mcq, fill_blank.
media_url should rotate across the pack links.`
    };
    return packs[level] || packs.enterprise;
  }
};
window.CBT = CBT;
