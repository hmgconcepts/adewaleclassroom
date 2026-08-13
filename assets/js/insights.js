/* Insights Lab — graphs and rule-based methodologies. No AI API. */
const Insights = {
  color(i) {
    const c = ['#134e4a','#d97706','#1d4ed8','#047857','#7c3aed','#b45309'];
    return c[i % c.length];
  },
  svgLine(el, points, color) {
    if (!el) return;
    const w = el.clientWidth || 480, h = 200, p = 24;
    const nums = points.map(Number).filter(n => !isNaN(n));
    if (!nums.length) { el.innerHTML = '<p class="muted">Not enough scores yet.</p>'; return; }
    const min = Math.min(...nums, 0), max = Math.max(...nums, 100);
    const xs = nums.map((_, i) => p + i * ((w - 2 * p) / Math.max(nums.length - 1, 1)));
    const ys = nums.map(n => h - p - ((n - min) / (max - min || 1)) * (h - 2 * p));
    const d = xs.map((x, i) => (i ? 'L' : 'M') + x + ' ' + ys[i]).join(' ');
    el.innerHTML = `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <line x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}" stroke="#e4ddd2"/>
      <path d="${d}" fill="none" stroke="${color || this.color(0)}" stroke-width="3"/>
      ${xs.map((x,i)=>`<circle cx="${x}" cy="${ys[i]}" r="4" fill="${color || this.color(0)}"><title>${nums[i]}%</title></circle>`).join('')}
    </svg>`;
  },
  svgBars(el, labels, values) {
    if (!el) return;
    const w = el.clientWidth || 480, h = 200, p = 28;
    const max = Math.max(...values, 1);
    const bw = (w - 2 * p) / values.length * 0.7;
    el.innerHTML = `<svg class="chart" viewBox="0 0 ${w} ${h}">${values.map((v,i)=>{
      const x = p + i * ((w-2*p)/values.length);
      const bh = (v/max)*(h-2*p);
      return `<rect x="${x}" y="${h-p-bh}" width="${bw}" height="${bh}" rx="4" fill="${this.color(i)}"/><text x="${x}" y="${h-8}" font-size="10">${(labels[i]||'').slice(0,8)}</text>`;
    }).join('')}</svg>`;
  },
  heatmap(el, topics) {
    if (!el) return;
    el.innerHTML = topics.map(t => {
      const s = Number(t.score || 0);
      const bg = s >= 80 ? '#047857' : s >= 60 ? '#ca8a04' : s >= 40 ? '#d97706' : '#b42318';
      return `<div class="card" style="padding:10px"><div style="display:flex;justify-content:space-between"><b>${TC.esc(t.topic)}</b><span>${s}%</span></div>
        <div class="mastery-cell" style="background:${bg};width:${Math.max(s,4)}%;margin-top:6px"></div></div>`;
    }).join('') || '<p class="muted">Add mastery topics to see the heatmap.</p>';
  },
  /* Transparent linear projection: last N scores → exam date. */
  predict(scores, examOn) {
    const nums = (scores || []).map(Number).filter(n => !isNaN(n));
    if (nums.length < 2) return { pred: null, slope: 0, note: 'Need at least two scores.' };
    const n = nums.length;
    const meanX = (n - 1) / 2;
    const meanY = nums.reduce((a,b)=>a+b,0) / n;
    let num = 0, den = 0;
    nums.forEach((y, x) => { num += (x - meanX) * (y - meanY); den += (x - meanX) ** 2; });
    const slope = den ? num / den : 0;
    const days = examOn ? Math.max(0, (new Date(examOn) - new Date()) / 86400000) : 28;
    const steps = Math.max(1, Math.round(days / 14));
    let pred = nums[n - 1] + slope * steps;
    pred = Math.max(0, Math.min(100, pred));
    return { pred: Math.round(pred * 10) / 10, slope: Math.round(slope * 100) / 100, note: `Each fortnight changes the score by ${slope.toFixed(2)} points. Formula is ordinary least squares on the last ${n} scores.` };
  },
  valueAdded(baseline, current) {
    if (baseline == null || current == null) return null;
    return Math.round((Number(current) - Number(baseline)) * 10) / 10;
  },
  /* Rule-based at-risk. Every flag is explainable. */
  flags(ctx) {
    const out = [];
    if (ctx.attendancePct != null && ctx.attendancePct < 80) out.push({ code: 'attendance', level: 'warn', text: `Attendance ${ctx.attendancePct}% is below 80%.` });
    if (ctx.idleDays != null && ctx.idleDays >= 14) out.push({ code: 'idle', level: 'bad', text: `No session in ${ctx.idleDays} days.` });
    if (ctx.hoursLeft != null && ctx.hoursLeft < 2) out.push({ code: 'hours', level: 'warn', text: `Hour bank has ${ctx.hoursLeft} hours left.` });
    if (ctx.hwPct != null && ctx.hwPct < 60) out.push({ code: 'homework', level: 'warn', text: `Homework completion ${ctx.hwPct}% is below 60%.` });
    const s = ctx.scores || [];
    if (s.length >= 3 && s[s.length-1] < s[s.length-2] && s[s.length-2] < s[s.length-3]) {
      out.push({ code: 'slope', level: 'bad', text: 'Last three scores are declining.' });
    }
    if (ctx.masteryLowPct != null && ctx.masteryLowPct > 40) out.push({ code: 'mastery', level: 'warn', text: `${ctx.masteryLowPct}% of topics are below 50% mastery.` });
    return out;
  },
  methodologyFor(flags) {
    const map = {
      attendance: 'Re-contract the slot. Offer a standing reminder 24h before via WhatsApp. Consider a make-up bank instead of chasing absences.',
      idle: 'Send a parent conference invite this week. Pause billing only after a written pause request.',
      hours: 'Issue a package renewal invoice now so teaching does not stop mid-topic.',
      homework: 'Switch to shorter, daily retrieval (5 cards) instead of long weekly sets. Log completion in front of the parent.',
      slope: 'Stop introducing new topics. Two sessions of worked-example → faded example → independent item on the failing skill.',
      mastery: 'Rebuild the curriculum around the red heatmap cells. Do not sit a mock until red cells are amber.'
    };
    return flags.map(f => ({ code: f.code, advice: map[f.code] || 'Review the engagement plan.' }));
  },
  async loadLearnerContext(sb, learnerId) {
    if (!sb) return this.demoContext();
    const [engMem, scores, att, hw, mastery, learner] = await Promise.all([
      sb.from('engagement_members').select('engagement_id').eq('learner_id', learnerId),
      sb.from('assessments').select('score,taken_on').eq('learner_id', learnerId).order('taken_on'),
      sb.from('session_attendance').select('status').eq('learner_id', learnerId),
      sb.from('assignments').select('status').eq('learner_id', learnerId),
      sb.from('mastery_topics').select('topic,score').eq('learner_id', learnerId),
      sb.from('learners').select('*').eq('id', learnerId).maybeSingle()
    ]);
    const attRows = att.data || [];
    const present = attRows.filter(a => ['present','late'].includes(a.status)).length;
    const hwRows = hw.data || [];
    const done = hwRows.filter(a => ['submitted','marked'].includes(a.status)).length;
    const master = mastery.data || [];
    const low = master.filter(m => Number(m.score) < 50).length;
    return {
      learner: learner.data,
      engagementIds: (engMem.data || []).map(x => x.engagement_id),
      scores: (scores.data || []).map(s => Number(s.score)),
      scoreRows: scores.data || [],
      attendancePct: attRows.length ? Math.round(present / attRows.length * 100) : null,
      hwPct: hwRows.length ? Math.round(done / hwRows.length * 100) : null,
      mastery: master,
      masteryLowPct: master.length ? Math.round(low / master.length * 100) : null
    };
  },
  demoContext() {
    return {
      learner: { full_name: 'Sample learner (preview)' },
      scores: [42, 48, 51, 55, 53, 61],
      attendancePct: 86,
      hwPct: 70,
      idleDays: 5,
      hoursLeft: 4,
      mastery: [
        { topic: 'Algebra — linear', score: 78 },
        { topic: 'Algebra — quadratics', score: 44 },
        { topic: 'Geometry — circle theorems', score: 38 },
        { topic: 'Statistics — histograms', score: 66 },
        { topic: 'Exam technique', score: 52 }
      ],
      masteryLowPct: 40
    };
  }
};
window.Insights = Insights;
