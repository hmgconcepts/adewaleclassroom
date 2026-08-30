/* ============================================================================
   free-classes.js — free / outreach class cohorts  (report item 8)
   ----------------------------------------------------------------------------
   THE REQUEST

   "Sometimes I offer free tutoring classes to students. I take these students
    live classes on YouTube, Zoom, Google Meet, Free Conference, etc. I have a
    WhatsApp/Telegram group for these students where we interact and share
    information. Ensure I am able to use the Tutoring Connect platform for
    them. Ensure that I am able to create a link for them to register on the
    platform so that I can track their performance and evaluate them. I prepare
    these students towards national and international examinations also."

   WHY THIS COULD NOT JUST REUSE THE LEARNER RECORD

   A free student is not a client. Putting them in `learners` would put them
   into the fee ledger, the invoice run, the payroll calculation, the hour bank
   and the family billing statement — all of which assume a paying engagement.
   The first invoice run would either bill them or, worse, quietly produce a
   zero-value invoice for every one of them.

   They still need everything else: a register, results, attendance and an
   honest evaluation at the end. So they get their own three tables, and a
   deliberate one-way door — CONVERT — that promotes a strong free student into
   a real learner while keeping their whole free-class history attached.

   WHAT THIS FILE DOES

     * create and edit a cohort: exam board, subjects, level, schedule, and the
       platform it runs on (YouTube / Zoom / Meet / Free Conference / Teams);
     * hold the meeting link, the replay link and the WhatsApp or Telegram
       group link — all LINKS, never uploads, which is what keeps the studio
       inside the 1 GB storage and 500 MB database quotas;
     * mint one or more shareable registration links per cohort, each with its
         own label, expiry and usage cap, so the studio can see whether
         Instagram or WhatsApp actually brought the students;
     * work the roll: approve, record attendance and quiz results, evaluate,
       and convert the strongest into paying learners.
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
  function toast(m, k, ms) { if (w.toast) return w.toast(m, k || 'info', ms || 4500); console.log(m); }

  function token() {
    var A = 'abcdefghijkmnpqrstuvwxyz23456789', s = '';
    for (var i = 0; i < 14; i++) s += A[Math.floor(Math.random() * A.length)];
    return s;
  }

  var PLATFORMS = [
    ['youtube',        'YouTube Live / playlist'],
    ['zoom',           'Zoom'],
    ['meet',           'Google Meet'],
    ['freeconference', 'FreeConference / FCC'],
    ['teams',          'Microsoft Teams'],
    ['whatsapp',       'WhatsApp video'],
    ['telegram',       'Telegram'],
    ['other',          'Somewhere else']
  ];

  var BOARDS = ['WAEC', 'NECO', 'JAMB (UTME)', 'NABTEB', 'BECE', 'Common Entrance',
                'IGCSE (Cambridge)', 'IGCSE (Edexcel)', 'GCSE', 'A-Level', 'IB',
                'SAT', 'ACT', 'IELTS', 'TOEFL', 'Duolingo English Test', 'Other'];

  var STATUSES = ['draft', 'open', 'running', 'closed', 'completed', 'archived'];

  var FreeClasses = {

    state: { cohorts: [], links: [], regs: [], selected: null, tutors: [] },

    async mount(rootId) {
      this.host = d.getElementById(rootId || 'free-root');
      if (!this.host) return;
      this.host.innerHTML = '<div class="card"><p class="muted">Loading free class cohorts…</p></div>';
      await this.load();
      this.paint();
    },

    async load() {
      var s = sb();
      if (!s || !s.from) { this.state.cohorts = []; return; }
      try {
        var r = await Promise.all([
          s.from('tc_free_cohorts').select('*').order('created_at', { ascending: false }),
          s.from('tc_free_links').select('*').order('created_at', { ascending: false }),
          s.from('tc_free_registrations').select('*').order('created_at', { ascending: false }).limit(2000),
          s.from('tutors').select('id,full_name').order('full_name')
        ]);
        this.state.cohorts = (r[0] && r[0].data) || [];
        this.state.links   = (r[1] && r[1].data) || [];
        this.state.regs    = (r[2] && r[2].data) || [];
        this.state.tutors  = (r[3] && r[3].data) || [];
        this._err = (r[0] && r[0].error) ? r[0].error.message : null;
      } catch (e) { this._err = String(e.message || e); }
    },

    paint() {
      var self = this;
      var c = this.state.cohorts;
      var regs = this.state.regs;

      var banner = '';
      if (this._err && /does not exist|schema cache/i.test(this._err)) {
        banner = '<div class="card" style="border-left:4px solid #f59e0b;background:#fffbeb">' +
          '<b>The free-class tables are not in your database yet.</b> Open the Supabase SQL editor and ' +
          'run <b>database/complete-schema.sql</b> (V25 or later), then reload this page. Everything ' +
          'below is ready the moment the tables exist.</div>';
      }

      this.host.innerHTML = banner +

        /* ---- summary ---- */
        '<div class="grid grid-4" style="gap:10px;margin-bottom:14px">' +
          '<div class="stat-card"><div class="stat-value">' + c.length + '</div><div class="stat-label">Cohorts</div></div>' +
          '<div class="stat-card"><div class="stat-value">' +
            c.filter(function (x) { return x.status === 'open' || x.status === 'running'; }).length +
            '</div><div class="stat-label">Taking registrations</div></div>' +
          '<div class="stat-card"><div class="stat-value">' + regs.length + '</div><div class="stat-label">Free students</div></div>' +
          '<div class="stat-card"><div class="stat-value" style="color:#059669">' +
            regs.filter(function (r) { return r.status === 'converted'; }).length +
            '</div><div class="stat-label">Converted to paying</div></div>' +
        '</div>' +

        /* ---- create / edit ---- */
        '<section class="card">' +
          '<h2 style="margin:0 0 4px">🎁 <span id="fc-form-title">Create a free class cohort</span></h2>' +
          '<p class="muted" style="margin:0 0 12px">Everything here is a <b>link</b> — the meeting room, ' +
            'the replay and the group chat. Nothing is uploaded, which is what keeps the studio inside ' +
            'the free storage quota.</p>' +
          '<div id="fc-error" style="display:none;margin-bottom:10px;padding:10px 12px;border-radius:10px;' +
            'background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:.88rem"></div>' +
          '<div class="grid grid-2">' +
            '<div class="form-group"><label for="fc-name">Name of the class *</label>' +
              '<input class="form-input" id="fc-name" placeholder="Free JAMB Physics Bootcamp 2026"></div>' +
            '<div class="form-group"><label for="fc-code">Short code *</label>' +
              '<input class="form-input" id="fc-code" placeholder="JAMB-PHY-26">' +
              '<div class="form-help">Used to build each student\u2019s registration number.</div></div>' +
            '<div class="form-group" style="grid-column:1/-1"><label for="fc-desc">What the class covers</label>' +
              '<textarea class="form-textarea" id="fc-desc" rows="2"></textarea></div>' +
            '<div class="form-group"><label for="fc-board">Exam being prepared for</label>' +
              '<select class="form-select" id="fc-board"><option value="">— choose —</option>' +
                BOARDS.map(function (b) { return '<option>' + esc(b) + '</option>'; }).join('') + '</select></div>' +
            '<div class="form-group"><label for="fc-series">Sitting</label>' +
              '<input class="form-input" id="fc-series" placeholder="May/June 2026"></div>' +
            '<div class="form-group"><label for="fc-subjects">Subjects</label>' +
              '<input class="form-input" id="fc-subjects" placeholder="Physics, Chemistry, Maths">' +
              '<div class="form-help">Comma separated.</div></div>' +
            '<div class="form-group"><label for="fc-level">Level</label>' +
              '<input class="form-input" id="fc-level" placeholder="SS3 / Year 11"></div>' +

            '<div class="form-group"><label for="fc-platform">Where the class happens</label>' +
              '<select class="form-select" id="fc-platform">' +
                PLATFORMS.map(function (p) { return '<option value="' + p[0] + '">' + esc(p[1]) + '</option>'; }).join('') +
              '</select></div>' +
            '<div class="form-group"><label for="fc-tutor">Tutor</label>' +
              '<select class="form-select" id="fc-tutor"><option value="">— choose —</option>' +
                this.state.tutors.map(function (t) {
                  return '<option value="' + esc(t.id) + '">' + esc(t.full_name) + '</option>'; }).join('') +
              '</select></div>' +
            '<div class="form-group"><label for="fc-meet">Meeting link</label>' +
              '<input class="form-input" type="url" id="fc-meet" placeholder="https://zoom.us/j/…"></div>' +
            '<div class="form-group"><label for="fc-yt">YouTube live / playlist link</label>' +
              '<input class="form-input" type="url" id="fc-yt" placeholder="https://youtube.com/…"></div>' +
            '<div class="form-group"><label for="fc-replay">Replay / recordings link</label>' +
              '<input class="form-input" type="url" id="fc-replay"></div>' +
            
            '<div class="form-group" style="grid-column:1/-1;margin-top:16px"><h4 style="margin:0 0 4px">Social Media Subscriptions</h4><p class="muted" style="margin:0 0 12px;font-size:0.85rem">Registrants must click these to unlock the form. Leave blank to skip.</p></div>' +
            '<div class="form-group"><label for="fc-soc-yt">YouTube Channel</label><input class="form-input" type="url" id="fc-soc-yt" placeholder="https://youtube.com/..."></div>' +
            '<div class="form-group"><label for="fc-soc-fb">Facebook Page</label><input class="form-input" type="url" id="fc-soc-fb" placeholder="https://facebook.com/..."></div>' +
            '<div class="form-group"><label for="fc-soc-x">X (Twitter) Profile</label><input class="form-input" type="url" id="fc-soc-x" placeholder="https://x.com/..."></div>' +
            '<div class="form-group"><label for="fc-soc-tt">TikTok Profile</label><input class="form-input" type="url" id="fc-soc-tt" placeholder="https://tiktok.com/..."></div>' +
            '<div class="form-group" style="grid-column:1/-1"><hr style="border:0;border-top:1px solid #e2e8f0;margin:0"></div>' +

            '<div class="form-group"><label for="fc-wa">WhatsApp group link</label>' +
              '<input class="form-input" type="url" id="fc-wa" placeholder="https://chat.whatsapp.com/…"></div>' +
            '<div class="form-group"><label for="fc-tg">Telegram group link</label>' +
              '<input class="form-input" type="url" id="fc-tg" placeholder="https://t.me/…"></div>' +
            '<div class="form-group"><label for="fc-mid">Meeting ID / passcode</label>' +
              '<input class="form-input" id="fc-mid" placeholder="871 2345 6789 · 4472"></div>' +

            '<div class="form-group"><label for="fc-sched">Schedule, in words</label>' +
              '<input class="form-input" id="fc-sched" placeholder="Saturdays &amp; Sundays, 5–7pm WAT"></div>' +
            '<div class="form-group"><label for="fc-tz">Time zone</label>' +
              '<input class="form-input" id="fc-tz" value="Africa/Lagos"></div>' +
            '<div class="form-group"><label for="fc-start">Starts</label>' +
              '<input class="form-input" type="date" id="fc-start"></div>' +
            '<div class="form-group"><label for="fc-end">Ends</label>' +
              '<input class="form-input" type="date" id="fc-end"></div>' +
            '<div class="form-group"><label for="fc-cap">Capacity</label>' +
              '<input class="form-input" type="number" id="fc-cap" value="0">' +
              '<div class="form-help">0 means no limit.</div></div>' +
            '<div class="form-group"><label for="fc-status">Status</label>' +
              '<select class="form-select" id="fc-status">' +
                STATUSES.map(function (s) { return '<option>' + s + '</option>'; }).join('') +
              '</select>' +
              '<div class="form-help">Only <b>open</b> and <b>running</b> accept registrations.</div></div>' +
            '<div class="form-group" style="grid-column:1/-1">' +
              '<label style="display:flex;gap:8px;align-items:center;font-weight:400">' +
                '<input type="checkbox" id="fc-consent" checked> Require a parent or guardian to consent (recommended for minors)</label>' +
              '<label style="display:flex;gap:8px;align-items:center;font-weight:400">' +
                '<input type="checkbox" id="fc-auto" checked> Approve registrations automatically</label>' +
              '<label style="display:flex;gap:8px;align-items:center;font-weight:400">' +
                '<input type="checkbox" id="fc-track" checked> Track attendance and results for this cohort</label>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">' +
            '<button class="btn btn-primary" type="button" id="fc-save">💾 Save cohort</button>' +
            '<button class="btn btn-ghost" type="button" id="fc-clear">↺ Clear</button>' +
          '</div>' +
        '</section>' +

        /* ---- cohort list ---- */
        '<section class="card" style="margin-top:14px">' +
          '<h3 style="margin:0 0 10px">Cohorts</h3>' +
          '<div id="fc-list"></div>' +
        '</section>' +

        /* ---- roll ---- */
        '<section class="card" style="margin-top:14px" id="fc-roll-card">' +
          '<h3 style="margin:0 0 4px">Register</h3>' +
          '<p class="muted" style="margin:0 0 10px" id="fc-roll-lead">Choose a cohort above to see who has signed up.</p>' +
          '<div id="fc-roll"></div>' +
        '</section>';

      this._wire();
      this._paintCohorts();
      if (this.state.selected) this._paintRoll();
    },

    _wire() {
      var self = this;
      d.getElementById('fc-save').addEventListener('click', function () { self.save(); });
      d.getElementById('fc-clear').addEventListener('click', function () {
        self.editing = null; self.paint();
      });
    },

    _read() {
      var v = function (id) { var e = d.getElementById(id); return e ? e.value.trim() : ''; };
      var ck = function (id) { var e = d.getElementById(id); return !!(e && e.checked); };
      return {
        name: v('fc-name'), code: v('fc-code').toUpperCase(), description: v('fc-desc'),
        exam_board: v('fc-board') || null, exam_series: v('fc-series') || null,
        subjects: v('fc-subjects') ? v('fc-subjects').split(',').map(function (x) { return x.trim(); }).filter(Boolean) : [],
        level: v('fc-level') || null,
        platform: v('fc-platform'), tutor_id: v('fc-tutor') || null,
        meeting_url: v('fc-meet') || null, youtube_url: v('fc-yt') || null,
        replay_url: v('fc-replay') || null, whatsapp_url: v('fc-wa') || null,
        telegram_url: v('fc-tg') || null, meeting_id: v('fc-mid') || null,
        schedule_text: v('fc-sched') || null, tz: v('fc-tz') || 'Africa/Lagos',
        starts_on: v('fc-start') || null, ends_on: v('fc-end') || null,
        capacity: parseInt(v('fc-cap') || '0', 10) || 0,
        status: v('fc-status') || 'open',
        social_links: { yt: v('fc-soc-yt'), fb: v('fc-soc-fb'), x: v('fc-soc-x'), tt: v('fc-soc-tt') },
        requires_parent_consent: ck('fc-consent'),
        auto_approve: ck('fc-auto'),
        track_attendance: ck('fc-track'),
        track_results: ck('fc-track')
      };
    },

    async save() {
      var err = d.getElementById('fc-error');
      var show = function (m) { err.innerHTML = m; err.style.display = ''; };
      err.style.display = 'none';

      var row = this._read();
      if (!row.name) return show('Give the class a name.');
      if (!row.code) return show('Give the class a short code — it becomes part of every student\u2019s registration number.');
      if (!/^[A-Z0-9-]{2,20}$/.test(row.code)) {
        return show('The short code should be letters, numbers and hyphens only, e.g. <b>JAMB-PHY-26</b>.');
      }
      if (row.status === 'open' && !row.meeting_url && !row.youtube_url) {
        return show('A class that is open for registration needs somewhere to happen. Add a meeting link or a YouTube link.');
      }

      var s = sb();
      if (!s) return show('Not connected to the database.');
      try {
        var res = this.editing
          ? await s.from('tc_free_cohorts').update(row).eq('id', this.editing).select()
          : await s.from('tc_free_cohorts').insert(row).select();
        if (res.error) throw res.error;
        toast(this.editing ? 'Cohort updated.' : 'Cohort created. Now generate a registration link for it.', 'success', 6000);
        this.editing = null;
        await this.load();
        this.paint();
      } catch (e) {
        var m = String(e.message || e);
        if (/duplicate key|unique/i.test(m)) show('That short code is already in use by another cohort. Pick a different one.');
        else if (/row-level security/i.test(m)) show('The database refused this. Only a tutor or an administrator can create a cohort.');
        else show('Could not save: ' + esc(m));
      }
    },

    _paintCohorts() {
      var self = this;
      var box = d.getElementById('fc-list');
      if (!this.state.cohorts.length) {
        box.innerHTML = '<p class="muted">No free classes yet. Create one above, then generate a ' +
          'registration link and share it.</p>';
        return;
      }
      box.innerHTML = this.state.cohorts.map(function (c) {
        var links = self.state.links.filter(function (l) { return l.cohort_id === c.id; });
        var regs = self.state.regs.filter(function (r) { return r.cohort_id === c.id; });
        var col = { open: '#059669', running: '#059669', draft: '#64748b',
                    closed: '#b45309', completed: '#0369a1', archived: '#94a3b8' }[c.status] || '#64748b';
        return '<div style="border:1px solid var(--gray-200,#e2e8f0);border-radius:12px;padding:12px;margin-bottom:10px">' +
          '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start">' +
            '<div style="flex:1;min-width:220px">' +
              '<b>' + esc(c.name) + '</b> <code>' + esc(c.code || '') + '</code> ' +
              '<span style="display:inline-block;padding:1px 8px;border-radius:999px;font-size:.7rem;' +
                'font-weight:800;color:#fff;background:' + col + '">' + esc(c.status) + '</span>' +
              '<div class="muted" style="font-size:.83rem;margin-top:3px">' +
                esc(c.exam_board || '') + (c.exam_series ? ' · ' + esc(c.exam_series) : '') +
                (c.schedule_text ? ' · ' + esc(c.schedule_text) : '') +
                ' · ' + regs.length + ' registered' +
                (c.capacity ? ' of ' + c.capacity : '') + '</div>' +
              '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">' +
                (c.meeting_url ? '<a class="btn btn-sm btn-ghost" target="_blank" rel="noopener" href="' + esc(c.meeting_url) + '">🎥 Meeting</a>' : '') +
                (c.youtube_url ? '<a class="btn btn-sm btn-ghost" target="_blank" rel="noopener" href="' + esc(c.youtube_url) + '">▶️ YouTube</a>' : '') +
                (c.replay_url ? '<a class="btn btn-sm btn-ghost" target="_blank" rel="noopener" href="' + esc(c.replay_url) + '">⏪ Replay</a>' : '') +
                (c.whatsapp_url ? '<a class="btn btn-sm btn-ghost" target="_blank" rel="noopener" href="' + esc(c.whatsapp_url) + '">💬 WhatsApp</a>' : '') +
                (c.telegram_url ? '<a class="btn btn-sm btn-ghost" target="_blank" rel="noopener" href="' + esc(c.telegram_url) + '">✈️ Telegram</a>' : '') +
              '</div>' +
            '</div>' +
            '<div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">' +
              '<button class="btn btn-sm btn-primary" type="button" data-fc="link" data-id="' + esc(c.id) + '">🔗 Registration link</button>' +
              '<button class="btn btn-sm btn-outline" type="button" data-fc="roll" data-id="' + esc(c.id) + '">👥 Register (' + regs.length + ')</button>' +
              '<button class="btn btn-sm btn-outline" type="button" data-fc="edit" data-id="' + esc(c.id) + '">✏️ Edit</button>' +
              '<button class="btn btn-sm btn-ghost" type="button" data-fc="del" data-id="' + esc(c.id) + '" style="color:#b42318">🗑</button>' +
            '</div></div>' +
          (links.length
            ? '<div style="margin-top:8px;border-top:1px dashed var(--gray-200,#e2e8f0);padding-top:7px">' +
              links.map(function (l) {
                var url = w.location.href.replace(/[^/]*$/, '') + 'free-register.html?t=' + encodeURIComponent(l.token);
                return '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:.82rem;margin-bottom:4px">' +
                  '<b>' + esc(l.label || 'Link') + '</b>' +
                  '<input class="form-input" readonly value="' + esc(url) + '" style="flex:1;min-width:220px;padding:4px 8px;font-size:.78rem">' +
                  '<button class="btn btn-sm btn-ghost" type="button" data-fc="copy" data-url="' + esc(url) + '">Copy</button>' +
                  '<a class="btn btn-sm btn-ghost" target="_blank" rel="noopener" href="https://wa.me/?text=' +
                    encodeURIComponent('Free class: ' + c.name + '\n' + url) + '">WhatsApp</a>' +
                  '<span class="muted">' + (l.uses || 0) + ' used' +
                    (l.max_uses ? ' of ' + l.max_uses : '') +
                    (l.active ? '' : ' · off') + '</span>' +
                  '<button class="btn btn-sm btn-ghost" type="button" data-fc="linkoff" data-id="' + esc(l.id) +
                    '" style="color:#b45309">' + (l.active ? 'Turn off' : 'Turn on') + '</button>' +
                  '</div>';
              }).join('') + '</div>'
            : '') +
        '</div>';
      }).join('');

      box.querySelectorAll('[data-fc]').forEach(function (b) {
        b.addEventListener('click', function () { self._action(b); });
      });
    },

    async _action(b) {
      var a = b.getAttribute('data-fc');
      var id = b.getAttribute('data-id');
      var s = sb();

      if (a === 'copy') {
        var u = b.getAttribute('data-url');
        if (w.navigator.clipboard) w.navigator.clipboard.writeText(u);
        return toast('Link copied.', 'success');
      }

      if (a === 'link') {
        var label = w.prompt('Label this link so you can tell where registrations came from.\n\n' +
                             'e.g. "Instagram", "WhatsApp status", "Ikeja Grammar School"', 'General');
        if (label === null) return;
        var cap = w.prompt('Maximum number of registrations through THIS link?\n\n0 = no limit', '0');
        if (cap === null) return;
        var res = await s.from('tc_free_links').insert({
          cohort_id: id, token: token(), label: label,
          max_uses: parseInt(cap, 10) || 0, active: true
        }).select();
        if (res.error) return toast(res.error.message, 'danger', 9000);
        toast('Registration link created. Copy it and share it.', 'success', 6000);
        await this.load(); this.paint();
        return;
      }

      if (a === 'linkoff') {
        var l = this.state.links.filter(function (x) { return String(x.id) === id; })[0];
        var r = await s.from('tc_free_links').update({ active: !l.active }).eq('id', id);
        if (r.error) return toast(r.error.message, 'danger');
        await this.load(); this.paint();
        return;
      }

      if (a === 'roll') {
        this.state.selected = id;
        this._paintRoll();
        d.getElementById('fc-roll-card').scrollIntoView({ behavior: 'smooth' });
        return;
      }

      if (a === 'edit') {
        var c = this.state.cohorts.filter(function (x) { return String(x.id) === id; })[0];
        if (!c) return;
        this.editing = id;
        var set = function (fid, v) { var e = d.getElementById(fid); if (e) e.value = v == null ? '' : v; };
        var ck = function (fid, v) { var e = d.getElementById(fid); if (e) e.checked = !!v; };
        set('fc-name', c.name); set('fc-code', c.code); set('fc-desc', c.description);
        set('fc-board', c.exam_board); set('fc-series', c.exam_series);
        set('fc-subjects', (c.subjects || []).join(', ')); set('fc-level', c.level);
        set('fc-platform', c.platform); set('fc-tutor', c.tutor_id);
        set('fc-meet', c.meeting_url); set('fc-yt', c.youtube_url); set('fc-replay', c.replay_url);
        set('fc-wa', c.whatsapp_url); set('fc-tg', c.telegram_url); set('fc-mid', c.meeting_id);
        set('fc-sched', c.schedule_text); set('fc-tz', c.tz);
        set('fc-start', c.starts_on); set('fc-end', c.ends_on);
        set('fc-cap', c.capacity); set('fc-status', c.status);
        var sl = c.social_links || {}; set('fc-soc-yt', sl.yt); set('fc-soc-fb', sl.fb); set('fc-soc-x', sl.x); set('fc-soc-tt', sl.tt);
        ck('fc-consent', c.requires_parent_consent); ck('fc-auto', c.auto_approve);
        ck('fc-track', c.track_attendance);
        d.getElementById('fc-form-title').textContent = 'Editing “' + c.name + '”';
        w.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      if (a === 'del') {
        if (!w.confirm('Delete this cohort?\n\nEvery registration on it is deleted too. ' +
                       'If you only want to stop new sign-ups, set the status to "closed" instead.')) return;
        var dr = await s.from('tc_free_cohorts').delete().eq('id', id);
        if (dr.error) return toast(dr.error.message, 'danger', 9000);
        toast('Cohort deleted.', 'success');
        await this.load(); this.paint();
      }
    },

    _paintRoll() {
      var self = this;
      var id = this.state.selected;
      var c = this.state.cohorts.filter(function (x) { return String(x.id) === String(id); })[0];
      var rows = this.state.regs.filter(function (r) { return String(r.cohort_id) === String(id); });
      var lead = d.getElementById('fc-roll-lead');
      var box = d.getElementById('fc-roll');
      if (!c) return;

      lead.innerHTML = '<b>' + esc(c.name) + '</b> — ' + rows.length + ' registered. ' +
        'Record attendance and results here, and convert the strongest into paying learners.';

      if (!rows.length) {
        box.innerHTML = '<p class="muted">Nobody has registered yet. Share the registration link.</p>';
        return;
      }

      box.innerHTML =
        '<div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">' +
          '<input id="fc-roll-q" class="form-input" type="search" placeholder="🔎 Filter the register…" style="width:220px;padding:6px 10px">' +
          '<button class="btn btn-sm btn-outline" type="button" id="fc-roll-csv">⬇ CSV</button>' +
        '</div>' +
        '<div class="table-wrap" style="max-height:520px;overflow:auto">' +
        '<table style="width:100%;font-size:.85rem"><thead><tr>' +
          '<th>Reg no.</th><th>Name</th><th>Contact</th><th>Where</th><th>Status</th>' +
          '<th>Attended</th><th>Avg %</th><th style="text-align:right">Actions</th>' +
        '</tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr data-reg="' + esc(r.id) + '">' +
            '<td><code>' + esc(r.reg_no || '') + '</code></td>' +
            '<td><b>' + esc(r.full_name) + '</b>' + (r.level ? '<br><small>' + esc(r.level) + '</small>' : '') + '</td>' +
            '<td><small>' + esc(r.phone || r.whatsapp || r.email || '—') + '</small></td>' +
            '<td><small>' + esc([r.city, r.country].filter(Boolean).join(', ') || '—') + '</small></td>' +
            '<td>' + esc(r.status) + '</td>' +
            '<td><input class="form-input" type="number" data-r="att" value="' + esc(r.sessions_attended || 0) +
              '" style="width:56px;padding:3px 5px"> / <input class="form-input" type="number" data-r="tot" value="' +
              esc(r.sessions_total || 0) + '" style="width:56px;padding:3px 5px"></td>' +
            '<td><input class="form-input" type="number" step="any" data-r="avg" value="' +
              esc(r.avg_score == null ? '' : r.avg_score) + '" style="width:66px;padding:3px 5px"></td>' +
            '<td style="text-align:right;white-space:nowrap">' +
              '<button class="btn btn-sm btn-outline" type="button" data-reg-save="' + esc(r.id) + '">💾</button>' +
              (r.status === 'converted'
                ? '<span class="muted" style="font-size:.75rem">converted</span>'
                : '<button class="btn btn-sm btn-primary" type="button" data-reg-conv="' + esc(r.id) +
                  '" title="Create a real learner record from this free student">⤴ Convert</button>') +
              '<button class="btn btn-sm btn-ghost" type="button" data-reg-del="' + esc(r.id) +
                '" style="color:#b42318">🗑</button>' +
            '</td></tr>';
        }).join('') + '</tbody></table></div>';

      var q = d.getElementById('fc-roll-q');
      if (q) q.addEventListener('input', function () {
        var t = q.value.toLowerCase();
        box.querySelectorAll('tbody tr').forEach(function (tr) {
          tr.style.display = tr.textContent.toLowerCase().indexOf(t) > -1 ? '' : 'none';
        });
      });

      d.getElementById('fc-roll-csv').addEventListener('click', function () {
        var head = 'Reg no,Name,Email,Phone,Country,City,School,Level,Board,Status,Attended,Total,Attendance %,Avg score,How Heard,Goal,Registered On';
        var body = rows.map(function (r) {
          return [r.reg_no, r.full_name, r.email, r.phone, r.country, r.city, r.school,
                  r.level, r.exam_board, r.status, r.sessions_attended, r.sessions_total, r.attendance_pct, r.avg_score, r.how_heard, r.goal, r.created_at]
            .map(function (v) {
              v = v == null ? '' : String(v);
              return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
            }).join(',');
        }).join('\n');
        var blob = new Blob([head + '\n' + body], { type: 'text/csv;charset=utf-8' });
        var a = d.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (c.code || 'free-class') + '-register.csv';
        a.click();
      });

      box.querySelectorAll('[data-reg-save]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var tr = b.closest('tr');
          var payload = {
            sessions_attended: parseInt(tr.querySelector('[data-r=att]').value || '0', 10),
            sessions_total: parseInt(tr.querySelector('[data-r=tot]').value || '0', 10),
            avg_score: tr.querySelector('[data-r=avg]').value === ''
              ? null : parseFloat(tr.querySelector('[data-r=avg]').value),
            last_active_on: new Date().toISOString().slice(0, 10)
          };
          var r = await sb().from('tc_free_registrations').update(payload).eq('id', b.dataset.regSave);
          if (r.error) return toast(r.error.message, 'danger', 8000);
          toast('Saved. The attendance percentage is recalculated by the database.', 'success');
          await self.load(); self._paintRoll();
        });
      });

      box.querySelectorAll('[data-reg-conv]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!w.confirm('Create a real learner record from this free student?\n\n' +
                         'Their free-class history stays attached. They can then be given an ' +
                         'engagement, a fee and everything else a paying learner has.')) return;
          var r = await sb().rpc('tc_free_convert', { p_reg: b.dataset.regConv });
          if (r.error) return toast(r.error.message, 'danger', 9000);
          toast('Converted. Open the Learners page to complete their record.', 'success', 7000);
          await self.load(); self._paintRoll(); self._paintCohorts();
        });
      });

      box.querySelectorAll('[data-reg-del]').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!w.confirm('Remove this registration?')) return;
          var r = await sb().from('tc_free_registrations').delete().eq('id', b.dataset.regDel);
          if (r.error) return toast(r.error.message, 'danger');
          await self.load(); self._paintRoll(); self._paintCohorts();
        });
      });
    },

    /* ======================================================================
       THE PUBLIC SIGN-UP PAGE (free-register.html)

       Runs for someone with no account. Everything it does goes through two
       SECURITY DEFINER functions, so the anon role never touches a table
       directly and cannot set a status, a learner_id or anyone else's data.
       ====================================================================== */
    async mountPublic(rootId) {
      var host = d.getElementById(rootId || 'free-reg-root');
      if (!host) return;
      var tok = new URLSearchParams(w.location.search).get('t') || '';
      var s = sb();

      if (!tok) {
        host.innerHTML = '<div class="card"><h2>No registration link</h2>' +
          '<p class="muted">This page needs a registration link from the studio. Ask for one on ' +
          'WhatsApp, or use the <a href="contact.html">Contact page</a>.</p></div>';
        return;
      }
      if (!s) {
        host.innerHTML = '<div class="card"><p class="muted">Connecting…</p></div>';
        return;
      }

      host.innerHTML = '<div class="card"><p class="muted">Loading the class details…</p></div>';
      var info;
      try {
        var r = await s.rpc('tc_free_cohort_public', { p_token: tok });
        info = r.data;
        if (r.error) throw r.error;
      } catch (e) {
        host.innerHTML = '<div class="card"><h2>We could not load that class</h2>' +
          '<p class="muted">' + esc(e.message || e) + '</p></div>';
        return;
      }
      if (!info) {
        host.innerHTML = '<div class="card"><h2>That link is not valid</h2>' +
          '<p class="muted">It may have been mistyped, turned off, or it has expired. ' +
          'Ask the studio for a fresh link.</p></div>';
        return;
      }

      var subs = Array.isArray(info.subjects) ? info.subjects : [];
      host.innerHTML =
        '<section class="card" style="background:linear-gradient(135deg,#0506ae,#964eec) !important; color:#fff !important;">' +
          '<div style="font-size:.78rem;letter-spacing:2px;opacity:.85;color:#fff">FREE CLASS</div>' +
          '<h1 style="margin:4px 0 6px;font-size:1.6rem;color:#fff">' + esc(info.name) + '</h1>' +
          '<p style="margin:0;opacity:.95;color:#fff">' + esc(info.description || '') + '</p>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;font-size:.85rem">' +
            (info.exam_board ? '<span style="background:rgba(255,255,255,.18);padding:3px 10px;border-radius:999px">🎯 ' + esc(info.exam_board) + '</span>' : '') +
            (info.level ? '<span style="background:rgba(255,255,255,.18);padding:3px 10px;border-radius:999px">🎓 ' + esc(info.level) + '</span>' : '') +
            (info.schedule ? '<span style="background:rgba(255,255,255,.18);padding:3px 10px;border-radius:999px">🗓️ ' + esc(info.schedule) + '</span>' : '') +
            (info.platform ? '<span style="background:rgba(255,255,255,.18);padding:3px 10px;border-radius:999px">📺 ' + esc(info.platform) + '</span>' : '') +
            (subs.length ? '<span style="background:rgba(255,255,255,.18);padding:3px 10px;border-radius:999px">📚 ' + esc(subs.join(', ')) + '</span>' : '') +
          '</div>' +
        '</section>' +

        (info.open === false
          ? '<div class="card" style="margin-top:14px;border-left:4px solid #b45309">' +
            '<b>Registration for this class is closed.</b><br>' +
            '<span class="muted">Ask the studio when the next one starts — the ' +
            '<a href="contact.html">Contact page</a> has the WhatsApp number.</span></div>'
          : '<section class="card" style="margin-top:14px" id="fr-form">' +
            '<h2 style="margin:0 0 4px">Register — it is free</h2>' +
            '<p class="muted" style="margin:0 0 12px">You do not need an account. Fill this in and you will ' +
              'get a registration number and the joining links straight away.</p>' +
            '<div id="fr-error" style="display:none;margin-bottom:10px;padding:10px 12px;border-radius:10px;' +
              'background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:.88rem"></div>' +
            '<div class="grid grid-2">' +
              '<div class="form-group"><label for="fr-name">Your full name *</label><input class="form-input" id="fr-name"></div>' +
              '<div class="form-group"><label for="fr-phone">Phone / WhatsApp *</label><input class="form-input" id="fr-phone"></div>' +
              '<div class="form-group"><label for="fr-email">Email</label><input class="form-input" type="email" id="fr-email"></div>' +
              
              '<div class="form-group"><label for="fr-country">Country</label><input class="form-input" id="fr-country"></div>' +
              '<div class="form-group"><label for="fr-state">State / Region</label><input class="form-input" id="fr-state"></div>' +
              '<div class="form-group"><label for="fr-city">City</label><input class="form-input" id="fr-city"></div>' +
              '<div class="form-group"><label for="fr-gender">Gender</label><select class="form-select" id="fr-gender"><option value=""></option><option value="Male">Male</option><option value="Female">Female</option></select></div>' +
              '<div class="form-group"><label for="fr-age">Age</label><input class="form-input" type="number" id="fr-age"></div>'
   +
              '<div class="form-group"><label for="fr-school">School</label><input class="form-input" id="fr-school"></div>' +
              '<div class="form-group"><label for="fr-level">Class / year</label><input class="form-input" id="fr-level" value="' + esc(info.level || '') + '"></div>' +
              '<div class="form-group"><label for="fr-subjects">Subjects you want</label><input class="form-input" id="fr-subjects" value="' + esc(subs.join(', ')) + '"></div>' +
              '<div class="form-group" style="grid-column:1/-1"><label for="fr-goal">What do you want out of this class?</label>' +
                '<textarea class="form-textarea" id="fr-goal" rows="2" placeholder="e.g. I need to move from a C to an A in Physics before May."></textarea></div>' +
              '<div class="form-group"><label for="fr-heard">How did you hear about it?</label>' +
                '<select class="form-select" id="fr-heard"><option value=""></option>' +
                  ['WhatsApp', 'Telegram', 'Instagram', 'Facebook', 'YouTube', 'A friend',
                   'My school', 'A teacher', 'Somewhere else'].map(function (x) {
                    return '<option>' + x + '</option>'; }).join('') + '</select></div>' +
            '</div>' +
            (info.requires_parent_consent
              ? '<div class="card" style="background:var(--surface-soft,#f8fafc);margin:10px 0">' +
                '<b>Parent or guardian</b>' +
                '<div class="grid grid-2" style="margin-top:8px">' +
                  '<div class="form-group"><label for="fr-pname">Parent / guardian name *</label><input class="form-input" id="fr-pname"></div>' +
                  '<div class="form-group"><label for="fr-pphone">Parent / guardian phone *</label><input class="form-input" id="fr-pphone"></div>' +
                '</div>' +
                '<label style="display:flex;gap:8px;align-items:flex-start;font-weight:400">' +
                  '<input type="checkbox" id="fr-consent"> <span>My parent or guardian knows about this class and ' +
                  'agrees that I may attend, and that the studio may record my attendance and results.</span></label></div>'
              : '') +
            '<div id="fr-soc-placeholder"></div><button class="btn btn-primary" type="button" id="fr-go" style="margin-top:10px">Register for this free class</button>' +
          '</section>');

            var sl = info.social_links || {};
            var reqClicks = 0;
            if ((sl.yt || sl.fb || sl.x || sl.tt) && info.open !== false) {
              if(sl.yt) reqClicks++; if(sl.fb) reqClicks++; if(sl.x) reqClicks++; if(sl.tt) reqClicks++;
              var socialHtml = '<div class="card" style="background:#fffbeb;border:1px solid #fcd34d;margin:10px 0" id="fr-soc-box">' +
                '<b style="color:#92400e">Follow us to register</b>' +
                '<p class="muted" style="margin:6px 0 10px;font-size:.85rem">Please follow/subscribe to our official channels below. The registration button will unlock automatically once you click them.</p>' +
                '<div style="display:flex;gap:8px;flex-wrap:wrap">';
              if (sl.yt) socialHtml += '<a class="btn btn-outline fr-soc-link" target="_blank" rel="noopener" href="'+esc(sl.yt)+'">📺 Subscribe on YouTube</a>';
              if (sl.fb) socialHtml += '<a class="btn btn-outline fr-soc-link" target="_blank" rel="noopener" href="'+esc(sl.fb)+'">📘 Follow on Facebook</a>';
              if (sl.x)  socialHtml += '<a class="btn btn-outline fr-soc-link" target="_blank" rel="noopener" href="'+esc(sl.x)+'">🐦 Follow on X/Twitter</a>';
              if (sl.tt) socialHtml += '<a class="btn btn-outline fr-soc-link" target="_blank" rel="noopener" href="'+esc(sl.tt)+'">🎵 Follow on TikTok</a>';
              socialHtml += '</div></div>';
              var ph = document.getElementById('fr-soc-placeholder');
              if(ph) ph.outerHTML = socialHtml;
            }

            if (reqClicks > 0 && info.open !== false) {
              document.getElementById('fr-go').disabled = true;
              document.getElementById('fr-go').title = 'Click social links above to unlock';
              var clicks = 0;
              var links = document.querySelectorAll('.fr-soc-link');
              links.forEach(function(l) {
                l.addEventListener('click', function() {
                  if (this.dataset.clicked) return;
                  this.dataset.clicked = "1";
                  this.innerHTML += ' ✅';
                  clicks++;
                  if (clicks >= reqClicks) {
                     document.getElementById('fr-go').disabled = false;
                     document.getElementById('fr-go').title = '';
                     var box = document.getElementById('fr-soc-box');
                     if(box) box.style.borderColor = '#10b981';
                  }
                });
              });
            }

      if (info.open === false) return;

      var self = this;
      d.getElementById('fr-go').addEventListener('click', async function () {
        var err = d.getElementById('fr-error');
        var show = function (m) { err.innerHTML = m; err.style.display = ''; err.scrollIntoView({ block: 'center' }); };
        err.style.display = 'none';
        var v = function (id) { var e = d.getElementById(id); return e ? e.value.trim() : ''; };

        if (!v('fr-name')) return show('Please enter your full name.');
        if (!v('fr-phone')) return show('Please enter a phone or WhatsApp number — it is how the studio reaches you.');
        if (info.requires_parent_consent) {
          if (!v('fr-pname') || !v('fr-pphone')) return show('Please enter your parent or guardian\u2019s name and phone number.');
          var cb = d.getElementById('fr-consent');
          if (!cb || !cb.checked) return show('Please tick the consent box — the studio cannot register a minor without it.');
        }

        var btn = d.getElementById('fr-go');
        btn.disabled = true;
        btn.textContent = 'Registering…';

        try {
          var r = await sb().rpc('tc_free_register', {
            p_token: tok,
            p_name: v('fr-name'),
            p_email: v('fr-email') || null,
            p_phone: v('fr-phone'),
            p_country: v('fr-country') || null, p_state: v('fr-state') || null,
            p_city: v('fr-city') || null, p_gender: v('fr-gender') || null, p_age: parseInt(v('fr-age'), 10) || null,
            p_school: v('fr-school') || null,
            p_level: v('fr-level') || null,
            p_board: info.exam_board || null,
            p_subjects: v('fr-subjects') ? v('fr-subjects').split(',').map(function (x) { return x.trim(); }).filter(Boolean) : [],
            p_parent_name: v('fr-pname') || null,
            p_parent_phone: v('fr-pphone') || null,
            p_consent: !!(d.getElementById('fr-consent') && d.getElementById('fr-consent').checked),
            p_how_heard: v('fr-heard') || null,
            p_goal: v('fr-goal') || null
          });
          if (r.error) throw r.error;
          var out = r.data || {};
          if (!out.ok) { btn.disabled = false; btn.textContent = 'Register for this free class'; return show(esc(out.error || 'That did not work.')); }

          d.getElementById('fr-form').outerHTML =
            '<section class="card" style="margin-top:14px;border-left:5px solid #059669">' +
              '<h2 style="margin:0 0 6px">✅ You are registered</h2>' +
              '<p style="margin:0 0 4px">Your registration number is <b style="font-size:1.1rem">' +
                esc(out.reg_no) + '</b> — write it down or screenshot this page.</p>' +
              '<p class="muted" style="margin:0 0 12px">Status: ' + esc(out.status) + '</p>' +
              '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
                (out.whatsapp_url ? '<a class="btn btn-primary" target="_blank" rel="noopener" href="' + esc(out.whatsapp_url) + '">💬 Join the WhatsApp group</a>' : '') +
                (out.telegram_url ? '<a class="btn btn-outline" target="_blank" rel="noopener" href="' + esc(out.telegram_url) + '">✈️ Join the Telegram group</a>' : '') +
                (out.meeting_url ? '<a class="btn btn-outline" target="_blank" rel="noopener" href="' + esc(out.meeting_url) + '">🎥 Class meeting link</a>' : '') +
                (out.youtube_url ? '<a class="btn btn-outline" target="_blank" rel="noopener" href="' + esc(out.youtube_url) + '">▶️ YouTube channel</a>' : '') +
              '</div>' +
              (out.schedule ? '<p class="muted" style="margin-top:12px">🗓️ ' + esc(out.schedule) + '</p>' : '') +
              '<p class="muted" style="margin-top:12px;font-size:.85rem">Join the group now — that is where ' +
                'the class links, the materials and the reminders are posted.</p>' +
            '</section>';
        } catch (e) {
          btn.disabled = false;
          btn.textContent = 'Register for this free class';
          show('Could not register: ' + esc(e.message || e));
        }
      });
    }
  };

  w.FreeClasses = FreeClasses;
  if (w.TC) w.TC.FreeClasses = FreeClasses;
})(window);
