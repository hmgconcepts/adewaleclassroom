/* BUGFIX (idempotency guard): this file can be pulled in twice - once by the
   page's own <script> tag and once by app.js's lazy loader. A second
   execution used to re-declare the top-level `const DataPortability` and throw a
   SyntaxError that aborted the entire page. Re-running is now a no-op. */
if (!window.DataPortability) (function () {
/* SHA-256 sealed JSON backup / restore. Shared by Admin Data and DriveSync. */
const DataPortability = {
  VERSION: 'tc-portable-v2',
  VAULT_BUCKET: 'archives',
  TABLES: [
    'practice_settings','profiles','tutors','parents','learners','parent_learner','subjects','methodologies',
    'engagements','engagement_members','inquiries','waitlist','trials','availability','sessions','session_attendance',
    'session_notes','goals','mastery_topics','curriculum_items','lesson_plans','assignments','assessments',
    'cbt_exams','cbt_results','packages','hour_ledger','invoices','payments','finance_entries','announcements',
    'messages','notifications','complaints','polls','poll_votes','resources','flashcards','exam_targets',
    'documents','reviews','referrals','events','gallery','helpdesk_tickets','safeguarding_log','activity_log',
    'site_license','booking_blocks','booking_classes','sow_terms','sow_topics','sow_evaluations',
    'application_links','applications','scoresheet','reading_assignments','reading_items','reading_progress',
    'forum_threads','forum_posts','exam_reg_links','exam_registrations','stream_posts','classwork_items'
  ],
  RECOVERY_SKIP: ['profiles'],
  RECOVERY_STRIP: ['created_by','user_id','sender','completed_by'],
  sb: null,
  init(client) { this.sb = client || window.sb || null; },

  async hash(str) {
    try {
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join('');
    } catch (_) { return null; }
  },
  async seal(env) {
    const h = await this.hash(JSON.stringify(env.tables));
    if (h) env.integrity = { algo: 'SHA-256', hash: h, sealed_at: new Date().toISOString() };
    return env;
  },
  async verifySeal(env) {
    if (!env || !env.integrity || !env.integrity.hash) return { ok: true, sealed: false };
    const h = await this.hash(JSON.stringify(env.tables));
    return { ok: h === env.integrity.hash, sealed: true };
  },
  envelope(tables, meta) {
    return { format: this.VERSION, created_at: new Date().toISOString(), practice: (window.PRACTICE && window.PRACTICE.name) || '', meta, tables };
  },
  async fetchAll(table) {
    if (!this.sb) throw Error('Database not configured');
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const r = await this.sb.from(table).select('*').range(from, from + 999);
      if (r.error) throw r.error;
      rows.push(...(r.data || []));
      if (!r.data || r.data.length < 1000) break;
    }
    return rows;
  },
  /* V54 (round 18, item 3): onTable(i, n, table) — the live progress
     callback the Drive backup panel renders ("Collecting X — table 3 of
     32…"). Optional and backward-compatible. */
  async collectFull(selected, onTable) {
    const names = selected && selected.length ? selected : this.TABLES;
    const tables = {}, errors = {};
    for (let ti = 0; ti < names.length; ti++) {
      const t = names[ti];
      if (onTable) { try { onTable(ti + 1, names.length, t); } catch (_) {} }
      try { tables[t] = await this.fetchAll(t); }
      catch (e) { errors[t] = e.message || String(e); tables[t] = []; }
    }
    const count = Object.values(tables).reduce((a, r) => a + r.length, 0);
    return this.seal(this.envelope(tables, { kind: 'full', table_count: names.length, row_count: count, errors }));
  },
  download(name, content, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: type || 'application/json' }));
    a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  async exportFull() {
    const env = await this.collectFull();
    this.download('tutoring-connect-backup-' + new Date().toISOString().slice(0,10) + '.json', JSON.stringify(env, null, 2));
    return env;
  },
  async exportCSV(table) {
    const rows = await this.fetchAll(table);
    if (!rows.length) throw Error('Nothing to export');
    const keys = [...new Set(rows.flatMap(Object.keys))];
    const esc = v => '"' + String(v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : v).replace(/"/g,'""') + '"';
    const csv = [keys.map(esc).join(',')].concat(rows.map(r => keys.map(k => esc(r[k])).join(','))).join('\n');
    this.download(table + '-' + new Date().toISOString().slice(0,10) + '.csv', csv, 'text/csv');
    return rows.length;
  },
  sanitize(table, row, mode) {
    const out = { ...row };
    if (mode === 'recovery') this.RECOVERY_STRIP.forEach(k => { if (k in out) out[k] = null; });
    return out;
  },
  /* V54 (round 18, item 3): onTable(i, n, table, saved) — live restore
     progress for the Drive restore panel. Optional. */
  async importArchive(env, mode, onTable) {
    const seal = await this.verifySeal(env);
    if (seal.sealed && !seal.ok) throw Error('Archive seal mismatch — file may be corrupted.');
    const report = [];
    const todo = this.TABLES.filter(t => (env.tables && env.tables[t] && env.tables[t].length) ||
      !(mode === 'recovery' && this.RECOVERY_SKIP.includes(t)));
    let ti = 0;
    for (const table of this.TABLES) {
      if (mode === 'recovery' && this.RECOVERY_SKIP.includes(table)) { report.push({ table, saved: 0, note: 'skipped in recovery' }); continue; }
      const rows = (env.tables && env.tables[table]) || [];
      if (!rows.length) continue;
      const clean = rows.map(r => this.sanitize(table, r, mode));
      let saved = 0, failed = 0;
      for (let i = 0; i < clean.length; i += 200) {
        const chunk = clean.slice(i, i + 200);
        const r = await this.sb.from(table).upsert(chunk);
        if (r.error) failed += chunk.length; else saved += chunk.length;
      }
      report.push({ table, saved, failed });
      ti++;
      if (onTable) { try { onTable(ti, todo.length, table, saved); } catch (_) {} }
    }
    return report;
  },
  /* V11 — the platform rule is LINKS, NOT UPLOADS, so that a studio never eats
     its free Supabase storage. The two supported backup destinations are:
       1. a sealed download to the operator's own device  (default), and
       2. the studio's OWN Google Drive via DriveSync      (recommended).
     This Storage vault remains available for operators who deliberately want a
     copy inside Supabase, but it is now OPT-IN, it refuses to run unless the
     caller passes {confirm:true}, and it states the quota cost up front. */
  /* ---------- V11 ARCHIVE VAULT (File Storage offload) ----------
     Moves old rows OUT of the 500 MB database INTO the separate 1 GB
     File Storage as restorable JSON. Workflow on Storage Manager:
     archive → verify in list → purge the same table/days → restore
     any archive back into the database whenever it is needed. */
  async exportTable(table) {
    this.init(window.sb);
    const rows = await this.fetchAll(table);
    this.download('export-' + table + '-' + new Date().toISOString().slice(0, 10) + '.json',
      JSON.stringify({ table, exported_at: new Date().toISOString(), rows }, null, 2),
      'application/json');
    if (typeof toast === 'function') toast('📥 Exported ' + rows.length + ' row(s) from ' + table + '.', 'success');
    return rows.length;
  },
  async archiveToVault(table, days) {
    this.init(window.sb);
    if (!this.sb) throw Error('Database not connected.');
    const cut = new Date(Date.now() - Math.max(1, days || 180) * 86400000).toISOString();
    const r = await this.sb.from(table).select('*').lt('created_at', cut).order('created_at').limit(50000);
    if (r.error) throw Error(r.error.message);
    const rows = r.data || [];
    if (!rows.length) { if (typeof toast === 'function') toast('Nothing older than ' + days + ' days in ' + table + '.', 'info'); return { rows: 0, path: null }; }
    const path = 'archives/' + table + '/' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
    const body = JSON.stringify({ table, archived_at: new Date().toISOString(), cutoff: cut, days: days, rows }, null, 2);
    const up = await this.sb.storage.from(this.VAULT_BUCKET).upload(path, new Blob([body], { type: 'application/json' }));
    if (up.error) throw Error(up.error.message + ' — run database/storage-offload.sql (archives bucket)');
    return { rows: rows.length, path };
  },
  async listVault() {
    this.init(window.sb);
    if (!this.sb) throw Error('Database not connected.');
    const out = [];
    const top = await this.sb.storage.from(this.VAULT_BUCKET).list('archives', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
    if (top.error) throw Error(top.error.message);
    for (const d of (top.data || [])) {
      if (!d.id) continue; // folders
      out.push({ path: 'archives/' + d.name, size: d.metadata ? d.metadata.size : 0, created: d.created_at });
    }
    return out;
  },
  async _vaultRead(path) {
    const dl = await this.sb.storage.from(this.VAULT_BUCKET).download(path);
    if (dl.error) throw Error(dl.error.message);
    return JSON.parse(await dl.text());
  },
  async restoreFromVault(path) {
    this.init(window.sb);
    if (!this.sb) throw Error('Database not connected.');
    const pack = await this._vaultRead(path);
    if (!pack || !Array.isArray(pack.rows)) throw Error('Archive is not a valid row archive.');
    const report = await this.importArchive({ tables: { [pack.table]: pack.rows }, meta: { restored_from: path } }, 'upsert');
    return report;
  },
  async downloadVault(path) {
    this.init(window.sb);
    const pack = await this._vaultRead(path);
    this.download(path.split('/').pop(), JSON.stringify(pack, null, 2), 'application/json');
  },
  async deleteVault(path) {
    this.init(window.sb);
    const del = await this.sb.storage.from(this.VAULT_BUCKET).remove([path]);
    if (del.error) throw Error(del.error.message);
    return true;
  },
  async vaultUpload(env, opts) {
    opts = opts || {};
    if (!opts.confirm) {
      throw new Error(
        'Supabase Storage backup is opt-in. This platform prefers links over uploads so your ' +
        'free 1 GB storage stays empty. Use "Download sealed backup", or Google Drive sync ' +
        '(Admin data → Google Drive backup). To override, call vaultUpload(env, { confirm: true }).');
    }
    const body = JSON.stringify(env);
    const kb = Math.round(body.length / 1024);
    const path = 'vault/' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
    const up = await this.sb.storage.from(this.VAULT_BUCKET)
      .upload(path, new Blob([body], { type: 'application/json' }));
    if (up.error) throw Error(up.error.message + ' — run database/storage-offload.sql');
    if (typeof toast === 'function') {
      toast('Stored ' + kb + ' KB in Supabase Storage. Drive backups cost you nothing — consider switching.', 'warning', 8000);
    }
    return path;
  }
};
window.DataPortability = DataPortability;

})();
