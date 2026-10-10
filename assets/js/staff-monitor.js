/* ═══════════════════════════════════════════════════════════════════════
   ADEWALE CLASSROOM — staff-monitor.js: the admin's 360 monitors (V53 / round 17)
   ═══════════════════════════════════════════════════════════════════════
   THE BLUEPRINT (from the studio): an administrator must be able to
   audit any tutor completely — salary payment history, classes taken,
   bookings completed and ongoing, topics covered, subjects taught,
   students taught, CBTs created, everything assigned — and every parent
   (children, their classes, the money). Tutors themselves get NOTHING
   here: the database RPCs are manager-only, so even a hand-crafted call
   from a tutor's browser is refused server-side.

   How this works:
     · CRUD tables for tutors/parents grow a 📊 Monitor row action
       (crud.js SCHEMA) that calls StaffMonitor.tutor(row) / .parent(row).
     · One security-definer RPC per monitor (V53):
         tc_tutor_monitor(p_tutor_id) → profile, engagements, students,
           subjects, sessions (taken/completed/upcoming/hours/recent),
           bookings (completed/ongoing/missed/cancelled/earnings/recent),
           topics covered, SOW topics taught, CBTs created + recent,
           assignments set, library items authored, payroll history.
         tc_parent_monitor(p_parent_id) → profile, children with their
           engagements + tutors, invoices, payments, upcoming sessions.
     · The drawer renders each section with honest empty states — an
       admin should always be able to tell "no records exist" from
       "records exist and here they are".
   ═══════════════════════════════════════════════════════════════════════ */
window.StaffMonitor = (function () {
  'use strict';

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function when(v, opts) {
    if (!v) return '—';
    var d = new Date(v);
    if (isNaN(d)) return esc(v);
    return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) +
      (opts && opts.time ? ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
  }
  function money(v) {
    var n = Number(v);
    if (v == null || isNaN(n)) return '—';
    return '₦' + n.toLocaleString();
  }
  function num(v) { var n = Number(v); return (v == null || isNaN(n)) ? 0 : n; }

  function tile(label, value, tone, title) {
    return '<div style="border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;background:#fff;min-width:110px;flex:1">' +
      '<div style="font-size:1.3rem;font-weight:800;color:' + (tone || '#0f172a') + '">' + value + '</div>' +
      '<div class="muted" style="font-size:.74rem"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + esc(label) + '</div></div>';
  }
  function section(icon, title, inner, hint) {
    return '<div class="card" style="margin:12px 0">' +
      '<h3 style="margin:0 0 8px">' + icon + ' ' + esc(title) + '</h3>' +
      (hint ? '<p class="muted" style="margin:0 0 8px;font-size:.8rem">' + hint + '</p>' : '') +
      inner + '</div>';
  }
  function table(headers, rows) {
    if (!rows.length) return '<p class="muted" style="font-size:.84rem;margin:0">No records yet — nothing of this kind exists for this person.</p>';
    return '<div class="table-wrap" style="max-height:280px;overflow:auto"><table style="width:100%;font-size:.82rem">' +
      '<thead><tr>' + headers.map(h => '<th style="text-align:left">' + esc(h) + '</th>').join('') + '</tr></thead>' +
      '<tbody>' + rows.join('') + '</tbody></table></div>';
  }
  function statusBadge(s) {
    var v = String(s || '').toLowerCase();
    var tone = /done|complete|paid|active|present|published/.test(v) ? ['#dcfce7', '#166534']
      : /missed|cancel|fail|inactive/.test(v) ? ['#fee2e2', '#991b1b']
      : /schedul|draft|pend/.test(v) ? ['#dbeafe', '#1e40af']
      : ['#f1f5f9', '#475569'];
    return '<span class="badge" style="background:' + tone[0] + ';color:' + tone[1] + '">' + esc(s || '—') + '</span>';
  }

  function drawer(title, inner, footNote) {
    var host = document.getElementById('staff-monitor-root');
    if (!host) {
      host = document.createElement('div');
      host.id = 'staff-monitor-root';
      host.className = 'modal-backdrop';
      document.body.appendChild(host);
    }
    host.innerHTML = '<div class="modal" style="max-width:860px">' +
      '<div class="modal-header"><h2>' + title + '</h2>' +
      '<button type="button" onclick="closeModal(\'staff-monitor-root\')">×</button></div>' +
      '<div class="modal-body" id="staff-monitor-body">' + inner + '</div>' +
      '<div class="modal-footer"><span class="muted" style="font-size:.78rem;margin-right:auto">' + (footNote || '') + '</span>' +
      '<button class="btn btn-ghost" type="button" onclick="closeModal(\'staff-monitor-root\')">Close</button></div></div>';
    host.classList.add('show');
    return host;
  }
  function fail(title, msg) {
    drawer(title, '<div class="card" style="background:#fef2f2;border-color:#fca5a5;color:#991b1b">' + esc(msg || 'The monitor is unavailable right now.') + '</div>');
  }
  function loading(title) {
    drawer(title, '<p class="muted"><span class="pulse">Collecting every record this studio holds…</span></p>');
  }

  async function rpc(fn, args) {
    if (!window.sb || !window.sb.rpc) throw new Error('Sign in as an administrator to use the monitors.');
    var r = await window.sb.rpc(fn, args || {});
    if (r.error) throw new Error(r.error.message);
    var d = r.data;
    if (Array.isArray(d)) d = d[0];
    if (!d || d.ok === false) throw new Error((d && d.reason) || 'The monitor refused this request.');
    return d;
  }

  /* ── THE TUTOR MONITOR ─────────────────────────────────────────────── */
  async function tutor(row) {
    var title = '📊 Tutor monitor — ' + (row && (row.full_name || row.email)) || 'tutor';
    loading(title);
    var d;
    try { d = await rpc('tc_tutor_monitor', { p_tutor_id: row.id }); }
    catch (e) { fail(title, e.message || e); return; }

    var p = d.profile || {};
    var s = d.sessions || {}, b = d.bookings || {}, c = d.cbts || {};

    var head =
      '<div class="card" style="background:linear-gradient(135deg,#eef2ff,#faf5ff);border-color:#c7d2fe">' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">' +
      '<div style="flex:1;min-width:220px"><b style="font-size:1.05rem">' + esc(p.full_name || '—') + '</b>' +
      '<div class="muted" style="font-size:.82rem">' + esc(p.email || 'no email') + (p.phone ? ' · ' + esc(p.phone) : '') +
      (p.timezone ? ' · 🕐 ' + esc(p.timezone) : '') + '</div>' +
      '<div class="muted" style="font-size:.82rem">' + (p.specialisms ? 'Specialisms: ' + esc(p.specialisms) : 'No specialisms recorded') +
      (p.hourly_cost != null ? ' · pay rate ' + money(p.hourly_cost) : '') + '</div></div>' +
      statusBadge(p.status) +
      (p.portal_email ? '<span class="badge" style="background:#ecfdf5;color:#065f46" title="The portal login this tutor record is linked to">🔗 ' + esc(p.portal_email) + (p.portal_role ? ' · ' + esc(p.portal_role) : '') + '</span>' : '<span class="badge" style="background:#fef3c7;color:#92400e">not linked to a portal login</span>') +
      '</div></div>';

    var tiles =
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">' +
      tile('Students taught', num((d.students || []).length), '#3730a3') +
      tile('Classes (engagements)', num((d.engagements || []).length), '#3730a3') +
      tile('Sessions taken', num(s.total), '#0f766e') +
      tile('Sessions completed', num(s.completed), '#166534') +
      tile('Upcoming sessions', num(s.upcoming), '#1e40af') +
      tile('Teaching hours', num(s.hours), '#0f766e') +
      tile('Bookings completed', num(b.completed), '#166534') +
      tile('Bookings ongoing', num(b.ongoing), '#1e40af') +
      tile('Bookings missed', num(b.missed), '#991b1b') +
      tile('CBTs created', num(c.count), '#6d28d9') +
      tile('Assignments set', num(d.assignments_set), '#92400e') +
      tile('Booking earnings', money(b.computed_earnings), '#166534', 'Sum of computed_amount on active booking blocks for this tutor\'s engagements') +
      '</div>';

    var subjects = (d.subjects || []).map(x => '<span class="badge" style="background:#eef2ff;color:#3730a3;margin:2px">' + esc(x) + '</span>').join('') ||
      '<p class="muted" style="font-size:.84rem;margin:0">No subjects recorded on this tutor\'s engagements.</p>';
    var topics = (d.topics_covered || []).concat(d.sow_taught || [])
      .filter((v, i, a) => v && a.indexOf(v) === i)
      .map(x => '<span class="badge" style="background:#f5f3ff;color:#6d28d9;margin:2px" title="Recorded on a completed booking class">' + esc(x) + '</span>').join('') ||
      '<p class="muted" style="font-size:.84rem;margin:0">No topics recorded yet — topics appear when completed booking classes carry their topics_covered note.</p>';

    var body = head + tiles +
      section('🏫', 'Classes (engagements)',
        table(['Class', 'Kind', 'Subject', 'Status', 'Rate', 'Hours prepaid/used'],
          (d.engagements || []).map(e => '<tr><td><b>' + esc(e.name) + '</b></td><td>' + esc(e.kind) + '</td><td>' + esc(e.subject || '—') + '</td><td>' + statusBadge(e.status) + '</td><td>' + money(e.hourly_rate) + '</td><td>' + esc(e.hours_prepaid || 0) + ' / ' + esc(e.hours_used || 0) + '</td></tr>')),
        'Every engagement assigned to this tutor. A tutor only ever sees their own — this is the admin\'s complete list.') +
      section('🎓', 'Students taught',
        table(['Student', 'Student no.'],
          (d.students || []).map(l => '<tr><td><b>' + esc(l.full_name) + '</b></td><td>' + esc(l.student_no || '—') + '</td></tr>')),
        'Distinct learners across this tutor\'s engagements.') +
      section('🗓', 'Recent & upcoming sessions',
        table(['When', 'Class', 'Mode', 'Status'],
          (s.recent || []).map(x => '<tr><td>' + when(x.starts_at, { time: true }) + '</td><td>' + esc(x.engagement || '—') + '</td><td>' + esc(x.mode || '—') + '</td><td>' + statusBadge(x.status) + '</td></tr>'))) +
      section('📚', 'Bookings',
        table(['When', 'Class', 'Minutes', 'Status', 'Topics covered', 'Completed'],
          (b.recent || []).map(x => '<tr><td>' + when(x.scheduled_at, { time: true }) + '</td><td>' + esc(x.engagement || '—') + '</td><td>' + esc(x.duration_minutes || '—') + '</td><td>' + statusBadge(x.status) + '</td><td>' + esc(x.topics_covered || '—') + '</td><td>' + when(x.completed_at) + '</td></tr>')),
        'Completed = status "done" · Ongoing = scheduled and still ahead · earnings tile sums the active booking blocks.') +
      section('🧪', 'CBTs created',
        table(['Title', 'Code', 'Status', 'Created'],
          (c.recent || []).map(x => '<tr><td><b>' + esc(x.title) + '</b></td><td>' + esc(x.code || '—') + '</td><td>' + statusBadge(x.status) + '</td><td>' + when(x.created_at) + '</td></tr>'))) +
      section('💵', 'Salary payment history',
        table(['Period', 'Hours', 'Rate', 'Gross', 'Status', 'Recorded'],
          (d.payroll_history || []).map(pr => '<tr><td><b>' + esc(pr.period || '—') + '</b></td><td>' + esc(pr.hours || '—') + '</td><td>' + money(pr.rate) + '</td><td><b>' + money(pr.gross) + '</b></td><td>' + statusBadge(pr.status) + '</td><td>' + when(pr.created_at) + '</td></tr>')),
        'Payroll rows are matched by tutor name. Record payments on the Payroll page; they appear here immediately.') +
      section('🏷', 'Subjects taught', subjects) +
      section('📖', 'Topics covered', topics);

    drawer('📊 Tutor monitor — ' + esc(p.full_name || 'tutor'), body,
      'Tutors cannot open this view — the database refuses non-manager calls to tc_tutor_monitor().');
  }

  /* ── THE PARENT MONITOR ────────────────────────────────────────────── */
  async function parent(row) {
    var title = '📊 Family monitor — ' + (row && (row.full_name || row.email)) || 'parent';
    loading(title);
    var d;
    try { d = await rpc('tc_parent_monitor', { p_parent_id: row.id }); }
    catch (e) { fail(title, e.message || e); return; }

    var p = d.profile || {};
    var head =
      '<div class="card" style="background:linear-gradient(135deg,#ecfdf5,#fff7ed);border-color:#a7f3d0">' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">' +
      '<div style="flex:1;min-width:220px"><b style="font-size:1.05rem">' + esc(p.full_name || '—') + '</b>' +
      '<div class="muted" style="font-size:.82rem">' + esc(p.email || 'no email') + (p.phone ? ' · ' + esc(p.phone) : '') +
      (p.billing_name ? ' · bills as ' + esc(p.billing_name) : '') + '</div></div>' +
      statusBadge(p.status) +
      (p.portal_email ? '<span class="badge" style="background:#ecfdf5;color:#065f46">🔗 ' + esc(p.portal_email) + '</span>' : '<span class="badge" style="background:#fef3c7;color:#92400e">not linked to a portal login</span>') +
      '</div></div>';

    var kids = (d.children || []);
    var paid = (d.payments || []).reduce((a, x) => a + num(x.amount), 0);
    var tiles =
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">' +
      tile('Children', kids.length, '#3730a3') +
      tile('Active classes', kids.reduce((a, k) => a + (k.engagements || []).filter(e => String(e.status || '') === 'active').length, 0), '#0f766e') +
      tile('Invoices', (d.invoices || []).length, '#1e40af') +
      tile('Paid to date', money(paid), '#166534') +
      '</div>';

    var body = head + tiles +
      section('👨‍👩‍👧', 'Children and their classes',
        table(['Child', 'Student no.', 'Class', 'Subject', 'Tutor', 'Status'],
          kids.flatMap(k => (k.engagements || []).length
            ? (k.engagements || []).map(e => '<tr><td><b>' + esc(k.full_name) + '</b></td><td>' + esc(k.student_no || '—') + '</td><td>' + esc(e.name) + '</td><td>' + esc(e.subject || '—') + '</td><td>' + esc(e.tutor || '—') + '</td><td>' + statusBadge(e.status) + '</td></tr>')
            : ['<tr><td><b>' + esc(k.full_name) + '</b></td><td>' + esc(k.student_no || '—') + '</td><td colspan="4" class="muted">No classes yet</td></tr>'])),
        'Every learner linked to this parent, with every engagement, subject and tutor.') +
      section('🧾', 'Invoices',
        table(['Created', 'Amount', 'Status', 'Due', 'Paid'],
          (d.invoices || []).map(i => '<tr><td>' + when(i.created_at) + '</td><td><b>' + money(i.amount) + '</b></td><td>' + statusBadge(i.status) + '</td><td>' + when(i.due_on) + '</td><td>' + money(i.paid) + '</td></tr>'))) +
      section('💳', 'Payment history',
        table(['Paid on', 'Amount', 'Method', 'Reference', 'Invoice amount'],
          (d.payments || []).map(x => '<tr><td>' + when(x.paid_on) + '</td><td><b>' + money(x.amount) + '</b></td><td>' + esc(x.method || '—') + '</td><td>' + esc(x.reference || '—') + '</td><td>' + money(x.invoice_amount) + '</td></tr>'))) +
      section('🗓', 'Upcoming sessions (the family\'s children)',
        table(['When', 'Class', 'Learner', 'Mode'],
          (d.upcoming_sessions || []).map(x => '<tr><td>' + when(x.starts_at, { time: true }) + '</td><td>' + esc(x.engagement || '—') + '</td><td>' + esc(x.learner || '—') + '</td><td>' + esc(x.mode || '—') + '</td></tr>')));

    drawer('📊 Family monitor — ' + esc(p.full_name || 'parent'), body,
      'Parents cannot open this view — the database refuses non-manager calls to tc_parent_monitor().');
  }

  return { tutor: tutor, parent: parent };
})();
