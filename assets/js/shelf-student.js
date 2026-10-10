/* ═══════════════════════════════════════════════════════════════════════
   ADEWALE CLASSROOM — Shelf, learner view (V51 / round 15, items 2–5)
   ═══════════════════════════════════════════════════════════════════════
   THE BUG THIS FILE CLOSES: on the student portal the four shelf pages
   (Mini LMS, Digital library, Resource library, E-resources) rendered the
   STAFF table — including the "Class / group / cohort" column whose link
   names depend on a table the learner often cannot read, so every row
   said "linked · name unavailable" under a "names not loading" banner.
   V51 fixed the name resolution server-side (tc_ref_labels is
   role-aware now); THIS file gives learners and parents the view they
   should have had all along — a reading shelf, not a database table:

     · cards arranged for studying, with Open buttons that work
     · the class name on each card (resolved through tc_ref_labels,
       never through the engagements table)
     · search + subject + kind filters
     · for the Mini LMS: lesson order and numbering
     · for the Digital library: quiz state — attempts used, best score,
       and a 📝 Take quiz button (engine in library-quiz.js)
     · honest empty states
   Staff keep the full CRUD workbench; nothing is taken away.
   ═══════════════════════════════════════════════════════════════════════ */
window.ShelfStudent = (function () {
  'use strict';

  var CFG = {
    lms:        { icon: '📚', table: 'lms_lessons',   order: 'order_no',  what: 'lesson' },
    library:    { icon: '📖', table: 'library_items',  order: 'created_at', what: 'reading' },
    resources:  { icon: '🗂️', table: 'resources',      order: 'created_at', what: 'resource' },
    eresources: { icon: '📝', table: 'eresources',     order: 'created_at', what: 'note' }
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function normUrl(u) {
    u = String(u || '').trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    return 'https://' + u.replace(/^\/+/, '');
  }
  function driveView(u) {
    var m = String(u || '').match(/drive\.google\.com\/file\/d\/([^/]+)/);
    return m ? ('https://drive.google.com/file/d/' + m[1] + '/view') : u;
  }
  function kindIcon(k) {
    k = String(k || '').toLowerCase();
    if (k.indexOf('video') > -1) return '🎬';
    if (k === 'pdf') return '📄';
    if (k.indexOf('worksheet') > -1) return '✏️';
    if (k === 'book') return '📕';
    if (k === 'paper') return '📃';
    return '🔗';
  }
  function dueChip(d) {
    if (!d) return '';
    var dt = new Date(String(d).slice(0, 10) + 'T00:00:00');
    if (isNaN(dt)) return '';
    var days = Math.round((dt - new Date(new Date().toDateString())) / 86400000);
    var cls = days < 0 ? 'background:#fee2e2;color:#991b1b' : days <= 2 ? 'background:#fef3c7;color:#92400e' : 'background:#f1f5f9;color:#475569';
    var label = days < 0 ? Math.abs(days) + 'd overdue' : days === 0 ? 'due today' : days === 1 ? 'due tomorrow' : 'due ' + dt.toLocaleDateString([], { day: 'numeric', month: 'short' });
    return '<span class="badge" style="' + cls + '">' + label + '</span>';
  }

  /* state */
  var S = { items: [], attempts: [], labels: {}, q: '', subject: '', kind: '', cls: '' };

  async function load(mod) {
    var cfg = CFG[mod];
    var q = window.sb.from(cfg.table).select('*').limit(300);
    if (mod === 'lms') q = q.eq('status', 'published');
    var res = await q;
    if (res.error) throw new Error(res.error.message);
    S.items = res.data || [];
    /* class names — through the ROLE-AWARE RPC, never the engagements
       table: this is the V51 fix for "linked · name unavailable". */
    S.labels = {};
    try {
      var r = await window.sb.rpc('tc_ref_labels', { p_table: 'engagements' });
      if (r.data && typeof r.data === 'object') S.labels = r.data;
    } catch (e) { /* pre-V51 database: names stay generic but nothing breaks */ }
    /* own quiz attempts (library only) */
    S.attempts = [];
    if (mod === 'library' && S.items.length) {
      try {
        var a = await window.sb.from('library_quiz_attempts').select('item_id,score,max_score,created_at').limit(500);
        if (!a.error) S.attempts = a.data || [];
      } catch (e) {}
    }
  }

  function attemptsFor(itemId) {
    return S.attempts.filter(function (a) { return String(a.item_id) === String(itemId); });
  }
  function bestFor(itemId) {
    var list = attemptsFor(itemId);
    if (!list.length) return null;
    return list.reduce(function (b, x) {
      return (Number(x.score) || 0) > (Number(b.score) || 0) ? x : b;
    }, list[0]);
  }

  function renderCard(mod, it, idx) {
    var cfg = CFG[mod];
    var url = driveView(normUrl(it.url));
    var cls = it.engagement_id ? (S.labels[it.engagement_id] || '') : '';
    var clsBadge = it.engagement_id
      ? (cls
          ? '<span class="badge" style="background:#eef2ff;color:#3730a3" title="This ' + esc(cfg.what) + ' is for your class">🎓 ' + esc(cls) + '</span>'
          : '<span class="badge" style="background:#f1f5f9;color:#475569">🎓 your class</span>')
      : '<span class="badge" style="background:#ecfdf5;color:#065f46" title="Visible to every student of this studio">🌐 for everyone</span>';
    var sub = [];
    if (it.subject) sub.push(esc(it.subject));
    if (it.author) sub.push(esc(it.author));
    if (it.notes) sub.push(esc(String(it.notes).slice(0, 90)) + (String(it.notes).length > 90 ? '…' : ''));
    if (it.instructions) sub.push(esc(String(it.instructions).slice(0, 110)) + (String(it.instructions).length > 110 ? '…' : ''));

    var chips = clsBadge + ' ' + dueChip(it.due_date);
    var actions = '';
    if (mod === 'lms' && it.order_no) chips = '<span class="badge" style="background:#f1f5f9;color:#475569">Lesson ' + esc(it.order_no) + '</span> ' + chips;
    if (mod !== 'lms') chips = '<span class="badge" style="background:#f1f5f9;color:#475569">' + kindIcon(it.kind) + ' ' + esc(it.kind || 'link') + '</span> ' + chips;

    if (mod === 'library' && it.has_quiz && (it.questions || []).length) {
      var used = attemptsFor(it.id).length;
      var allowed = Number(it.attempts_allowed == null ? 1 : it.attempts_allowed);
      var best = bestFor(it.id);
      var pct = best && Number(best.max_score) ? Math.round(Number(best.score) / Number(best.max_score) * 100) : null;
      chips += ' <span class="badge" style="background:#f5f3ff;color:#6d28d9">📝 ' + (it.questions || []).length + ' question' + ((it.questions || []).length > 1 ? 's' : '') + '</span>';
      if (best) chips += ' <span class="badge" style="background:#dcfce7;color:#166534" title="Your best score on this reading\'s quiz">best ' + esc(best.score) + '/' + esc(best.max_score) + (pct != null ? ' · ' + pct + '%' : '') + '</span>';
      var canTake = !(allowed > 0 && used >= allowed);
      actions += (canTake
        ? '<button type="button" class="btn btn-outline btn-sm" data-quiz="' + esc(it.id) + '" title="' + (used ? 'Attempt ' + (used + 1) + ' of ' + (allowed || '∞') : 'Take the comprehension quiz') + '">📝 Take quiz</button>'
        : '<span class="badge" style="background:#f1f5f9;color:#64748b" title="You have used your ' + used + ' attempt(s) — your best effort is recorded">attempts used</span>');
    }
    if (it.cbt_code) {
      actions += '<a class="btn btn-outline btn-sm" style="border-color:#7c3aed;color:#7c3aed" href="cbt-exam.html?code=' + encodeURIComponent(it.cbt_code) + '" title="The full CBT exam linked to this reading — timed, anti-cheat, server-graded">🧪 Take CBT</a>';
    }
    if (url) actions += '<a class="btn btn-primary btn-sm" href="' + esc(url) + '" target="_blank" rel="noopener">' + (mod === 'lms' ? 'Open lesson ➜' : mod === 'library' ? '📖 Read ➜' : 'Open ➜') + '</a>';

    return '<div style="border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;margin-bottom:10px;background:#fff;box-shadow:0 2px 8px rgba(15,23,42,.04)">' +
      '<div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap">' +
      '<div style="flex:1;min-width:220px"><b style="font-size:.95rem">' + (mod === 'lms' ? '' : kindIcon(it.kind) + ' ') + esc(it.title) + '</b>' +
      (sub.length ? '<div class="muted" style="font-size:.82rem;margin-top:2px">' + sub.join(' · ') + '</div>' : '') +
      '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">' + chips + '</div></div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' + actions + '</div>' +
      '</div></div>';
  }

  function render(rootId, mod) {
    var root = document.getElementById(rootId);
    if (!root) return;
    var cfg = CFG[mod];
    load(mod).then(function () {
      var items = S.items.filter(function (it) {
        if (S.q) {
          var blob = JSON.stringify(it).toLowerCase();
          if (blob.indexOf(S.q.toLowerCase()) === -1) return false;
        }
        if (S.subject && String(it.subject || '') !== S.subject) return false;
        if (S.kind && String(it.kind || '') !== S.kind) return false;
        /* V52 (round 16): class filter — a student in many classes can
           narrow the shelf to ONE class (GOSA's class scoping, better). */
        if (S.cls) {
          var lbl = it.engagement_id ? (S.labels[it.engagement_id] || '🎓 your class') : '🌐 for everyone';
          if (lbl !== S.cls) return false;
        }
        return true;
      });
      if (mod === 'lms') items.sort(function (a, b) { return (Number(a.order_no) || 0) - (Number(b.order_no) || 0); });

      var subjects = []; S.items.forEach(function (it) { if (it.subject && subjects.indexOf(it.subject) === -1) subjects.push(it.subject); });
      var kinds = []; S.items.forEach(function (it) { if (it.kind && kinds.indexOf(it.kind) === -1) kinds.push(it.kind); });
      var classes = []; S.items.forEach(function (it) {
        var lbl = it.engagement_id ? (S.labels[it.engagement_id] || '🎓 your class') : '🌐 for everyone';
        if (classes.indexOf(lbl) === -1) classes.push(lbl);
      });

      root.innerHTML =
        '<div class="card" style="margin-bottom:14px;background:linear-gradient(135deg,#eef2ff,#faf5ff);border-color:#c7d2fe">' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
        '<input id="shelf-q" class="form-input" placeholder="Search your ' + esc(cfg.what) + 's…" style="max-width:230px" value="' + esc(S.q) + '">' +
        (subjects.length > 1 ? '<select id="shelf-subject" class="form-select" style="max-width:170px"><option value="">All subjects</option>' +
          subjects.map(function (s) { return '<option' + (S.subject === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select>' : '') +
        (kinds.length > 1 && mod !== 'lms' ? '<select id="shelf-kind" class="form-select" style="max-width:140px"><option value="">All kinds</option>' +
          kinds.map(function (k) { return '<option' + (S.kind === k ? ' selected' : '') + '>' + esc(k) + '</option>'; }).join('') + '</select>' : '') +
        (classes.length > 1 ? '<select id="shelf-cls" class="form-select" style="max-width:180px" title="Show only one class"><option value="">All my classes</option>' +
          classes.map(function (c) { return '<option' + (S.cls === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' : '') +
        '<span class="muted" style="font-size:.82rem;margin-left:auto">' + items.length + ' ' + esc(cfg.what) + (items.length === 1 ? '' : 's') + ' for you</span>' +
        '</div></div>' +
        (items.length
          ? items.map(function (it, i) { return renderCard(mod, it, i); }).join('')
          : '<div class="card"><h3 style="margin-top:0">Nothing here yet</h3><p class="muted">' +
            (S.items.length ? 'No ' + esc(cfg.what) + ' matches your filters.' :
              'Your studio has not added any ' + esc(cfg.what) + 's for your classes yet. When they do, the ' + esc(cfg.what) + 's appear here automatically — check the 📚 work board on your dashboard too.') + '</p></div>');

      var qi = document.getElementById('shelf-q');
      if (qi) qi.oninput = function () { S.q = qi.value; render(rootId, mod); };
      var se = document.getElementById('shelf-subject');
      if (se) se.onchange = function () { S.subject = se.value; render(rootId, mod); };
      var ke = document.getElementById('shelf-kind');
      if (ke) ke.onchange = function () { S.kind = ke.value; render(rootId, mod); };
      var ce = document.getElementById('shelf-cls');
      if (ce) ce.onchange = function () { S.cls = ce.value; render(rootId, mod); };

      root.querySelectorAll('[data-quiz]').forEach(function (b) {
        b.onclick = function () {
          var it = S.items.filter(function (x) { return String(x.id) === b.dataset.quiz; })[0];
          if (it && window.LibraryQuiz) LibraryQuiz.take(it);
        };
      });
    }).catch(function (e) {
      root.innerHTML = '<div class="card" style="background:#fef2f2;border-color:#fca5a5;color:#991b1b">' + esc(e.message || e) + '</div>';
    });
  }

  return { render: render, CFG: CFG };
})();
