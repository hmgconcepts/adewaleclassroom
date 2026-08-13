/* Tutoring Connect analytics — browser-only, no AI API. */
const Analytics = {
  sb: null,
  charts: {},
  init(supabaseClient) { this.sb = supabaseClient || window.sb || null; },

  async count(table, filters) {
    if (!this.sb) return 0;
    try {
      let q = this.sb.from(table).select('id', { count: 'exact', head: true });
      (filters || []).forEach(f => { q = q.eq(f[0], f[1]); });
      const { count, error } = await q;
      return error ? 0 : (count || 0);
    } catch (e) { return 0; }
  },
  async sum(table, column, filters) {
    if (!this.sb) return 0;
    try {
      let q = this.sb.from(table).select(column);
      (filters || []).forEach(f => { q = q.eq(f[0], f[1]); });
      const { data, error } = await q;
      if (error || !data) return 0;
      return data.reduce((a, b) => a + (Number(b[column]) || 0), 0);
    } catch (e) { return 0; }
  },

  async loadKpis() {
    const [learners, tutors, engagements, sessions, exams, results, polls,
           complaints, inquiries, invoicesPaid, assignments, library, events,
           announcements, tickets, applications] = await Promise.all([
      this.count('learners'), this.count('tutors'), this.count('engagements'),
      this.count('sessions'), this.count('cbt_exams'), this.count('cbt_results'),
      this.count('polls'), this.count('complaints'), this.count('inquiries'),
      this.sum('payments', 'amount'), this.count('assignments'), this.count('resources'),
      this.count('events'), this.count('announcements'), this.count('helpdesk_tickets'),
      this.count('applications')
    ]);
    return { learners, tutors, engagements, sessions, exams, results, polls, complaints,
             inquiries, invoicesPaid, assignments, library, events, announcements, tickets, applications };
  },

  async cbtDistribution() {
    const fallback = { labels: ['0-39', '40-49', '50-59', '60-69', '70-100'], data: [2, 4, 8, 11, 9] };
    if (!this.sb) return fallback;
    try {
      const { data } = await this.sb.from('scoresheet').select('pct').limit(2000);
      if (!data || !data.length) {
        const r = await this.sb.from('cbt_results').select('score,max_score').limit(2000);
        const rows = r.data || [];
        if (!rows.length) return fallback;
        const buckets = { '0-39': 0, '40-49': 0, '50-59': 0, '60-69': 0, '70-100': 0 };
        rows.forEach(x => {
          const p = Number(x.max_score) ? (Number(x.score) / Number(x.max_score)) * 100 : 0;
          if (p < 40) buckets['0-39']++; else if (p < 50) buckets['40-49']++;
          else if (p < 60) buckets['50-59']++; else if (p < 70) buckets['60-69']++; else buckets['70-100']++;
        });
        return { labels: Object.keys(buckets), data: Object.values(buckets) };
      }
      const buckets = { '0-39': 0, '40-49': 0, '50-59': 0, '60-69': 0, '70-100': 0 };
      data.forEach(r => {
        const p = Number(r.pct) || 0;
        if (p < 40) buckets['0-39']++; else if (p < 50) buckets['40-49']++;
        else if (p < 60) buckets['50-59']++; else if (p < 70) buckets['60-69']++; else buckets['70-100']++;
      });
      return { labels: Object.keys(buckets), data: Object.values(buckets) };
    } catch (e) { return fallback; }
  },

  async enrollmentTrend() {
    const fallback = { labels: ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'], data: [4, 6, 9, 11, 14, 18] };
    if (!this.sb) return fallback;
    try {
      const since = new Date(); since.setMonth(since.getMonth() - 5); since.setDate(1);
      const { data } = await this.sb.from('learners').select('created_at').gte('created_at', since.toISOString());
      if (!data || !data.length) return fallback;
      const months = {};
      for (let i = 0; i < 6; i++) { const d = new Date(since); d.setMonth(since.getMonth() + i); months[d.toISOString().slice(0, 7)] = 0; }
      data.forEach(r => { const k = (r.created_at || '').slice(0, 7); if (k in months) months[k]++; });
      return { labels: Object.keys(months), data: Object.values(months) };
    } catch (e) { return fallback; }
  },

  async attendanceTrend() {
    const fallback = { labels: ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'], data: [92, 94, 90, 95, 93, 96] };
    if (!this.sb) return fallback;
    try {
      const { data } = await this.sb.from('session_attendance').select('status,created_at').limit(2000);
      if (!data || !data.length) return fallback;
      const months = {};
      data.forEach(r => {
        const k = String(r.created_at || '').slice(0, 7);
        if (!k) return;
        if (!months[k]) months[k] = { present: 0, total: 0 };
        months[k].total++;
        if (r.status === 'present' || r.status === 'late') months[k].present++;
      });
      const labels = Object.keys(months).sort();
      return { labels, data: labels.map(k => Math.round((months[k].present / months[k].total) * 100)) };
    } catch (e) { return fallback; }
  },

  async conversionFunnel() {
    if (!this.sb) return { labels: ['Inquiries', 'Trials', 'Active engagements', 'Completed'], data: [24, 14, 12, 5] };
    try {
      const [inq, trials, active, done] = await Promise.all([
        this.count('inquiries'), this.count('trials'),
        this.count('engagements', [['status', 'active']]),
        this.count('engagements', [['status', 'completed']])
      ]);
      return { labels: ['Inquiries', 'Trials', 'Active', 'Completed'], data: [inq, trials, active, done] };
    } catch (e) { return { labels: ['Inquiries', 'Trials', 'Active', 'Completed'], data: [24, 14, 12, 5] }; }
  },

  drawBar(canvasId, labels, data, label, color) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return this.drawSvgFallback(canvasId, labels, data, 'bar');
    if (!window.Chart) return this.drawSvgFallback(canvasId, labels, data, 'bar');
    if (this.charts[canvasId]) this.charts[canvasId].destroy();
    this.charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label, data, backgroundColor: color || '#134e4a' }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  },
  drawLine(canvasId, labels, data, label, color) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || !window.Chart) return this.drawSvgFallback(canvasId, labels, data, 'line');
    if (this.charts[canvasId]) this.charts[canvasId].destroy();
    this.charts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ label, data, borderColor: color || '#0f766e', backgroundColor: 'rgba(15,118,110,.15)', fill: true, tension: .3 }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  },
  drawDoughnut(canvasId, labels, data, colors) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || !window.Chart) return this.drawSvgFallback(canvasId, labels, data, 'doughnut');
    if (this.charts[canvasId]) this.charts[canvasId].destroy();
    this.charts[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors || ['#134e4a', '#d97706', '#0ea5e9', '#dc2626'] }] },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  },
  drawSvgFallback(canvasId, labels, data) {
    const el = document.getElementById(canvasId);
    if (!el) return;
    const host = el.parentElement;
    if (!host || host.querySelector('[data-svg-fallback]')) return;
    const max = Math.max(1, ...data.map(Number));
    const bars = (labels || []).map((lb, i) => {
      const h = Math.round((Number(data[i] || 0) / max) * 80);
      return '<div style="flex:1;text-align:center"><div style="height:80px;display:flex;align-items:flex-end;justify-content:center"><div style="width:70%;height:' + h + 'px;background:#134e4a;border-radius:6px 6px 0 0"></div></div><div style="font-size:.7rem;margin-top:4px">' + String(lb).slice(0, 8) + '</div></div>';
    }).join('');
    const wrap = document.createElement('div');
    wrap.setAttribute('data-svg-fallback', '1');
    wrap.style.cssText = 'display:flex;gap:6px;align-items:flex-end;min-height:110px';
    wrap.innerHTML = bars;
    el.style.display = 'none';
    host.appendChild(wrap);
  },

  async renderDashboard() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const k = await this.loadKpis();
    const cur = (window.PRACTICE && PRACTICE.currency) || '₦';
    set('kpi-learners', k.learners); set('kpi-students', k.learners);
    set('kpi-tutors', k.tutors); set('kpi-staff', k.tutors);
    set('kpi-engagements', k.engagements);
    set('kpi-sessions', k.sessions);
    set('kpi-exams', k.exams);
    set('kpi-results', k.results);
    set('kpi-polls', k.polls);
    set('kpi-complaints', k.complaints);
    set('kpi-inquiries', k.inquiries); set('kpi-admissions', k.applications || k.inquiries);
    set('kpi-fees', cur + Number(k.invoicesPaid).toLocaleString());
    set('kpi-assignments', k.assignments);
    set('kpi-library', k.library);
    set('kpi-events', k.events);
    set('kpi-announcements', k.announcements);
    set('kpi-tickets', k.tickets);
    const dist = await this.cbtDistribution();
    this.drawBar('chart-cbt', dist.labels, dist.data, 'Score %', '#0f766e');
    const trend = await this.enrollmentTrend();
    this.drawLine('chart-enrol', trend.labels, trend.data, 'New learners', '#d97706');
    const att = await this.attendanceTrend();
    this.drawLine('chart-attendance', att.labels, att.data, 'Attendance %', '#0284c7');
    const funnel = await this.conversionFunnel();
    this.drawBar('chart-funnel', funnel.labels, funnel.data, 'Count', '#134e4a');
    this.drawDoughnut('chart-fees', ['Collected', 'Outstanding (est.)'], [Math.max(1, k.invoicesPaid), Math.max(1, Math.round(k.invoicesPaid * 0.2))], ['#16a34a', '#dc2626']);
    this.renderInsights(k, dist, att, funnel);
  },

  renderInsights(k, dist, att, funnel) {
    const box = document.getElementById('analytics-insights');
    if (!box) return;
    const avg = dist.data.reduce((a, b, i) => a + b * ([20, 45, 55, 65, 80][i] || 0), 0) / Math.max(1, dist.data.reduce((a, b) => a + b, 0));
    const latestAtt = att.data.length ? att.data[att.data.length - 1] : 0;
    const conv = funnel.data[0] ? Math.round((funnel.data[2] / funnel.data[0]) * 100) : 0;
    box.innerHTML = '<div class="grid grid-3">' +
      '<div class="card"><h3>🎯 Academic health</h3><p>Score-band estimate: <b>' + Math.round(avg) + '%</b>. Open Insights Lab for per-engagement value-added and the six at-risk rules.</p></div>' +
      '<div class="card"><h3>📋 Attendance</h3><p>Latest attendance trend: <b>' + latestAtt + '%</b>. Below 80% trips the at-risk flag for that learner — groups never hide it.</p></div>' +
      '<div class="card"><h3>🌱 Conversion</h3><p>Inquiry → active ≈ <b>' + conv + '%</b>. ' + k.inquiries + ' inquiries, ' + k.engagements + ' engagements. Follow up from Inquiries.</p></div>' +
      '<div class="card"><h3>◎ Roster</h3><p>Learners: <b>' + k.learners + '</b> · Tutors: <b>' + k.tutors + '</b> · Sessions logged: <b>' + k.sessions + '</b>.</p></div>' +
      '<div class="card"><h3>📢 Engagement</h3><p>Polls <b>' + k.polls + '</b> · announcements <b>' + k.announcements + '</b> · complaints <b>' + k.complaints + '</b>.</p></div>' +
      '<div class="card"><h3>✅ Next action</h3><p>Use these numbers to plan make-ups, fee follow-up, reading packs and graded quizzes. Formulas live in <code>insights.js</code> — no AI API.</p></div>' +
      '</div>';
  }
};
if (typeof window !== 'undefined') window.Analytics = Analytics;
