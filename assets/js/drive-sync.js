/* Google Drive backup & sync — same free GIS + drive.file model as School Connect. */
const DriveSync = {
  SCOPE: 'https://www.googleapis.com/auth/drive.file',
  LS_KEY: 'tc-drive-sync',
  MAX_KEEP: 15,
  token: null, tokenExp: 0, _tokenClient: null,
  cfg: { clientId: '', enabled: false, days: 7, folderId: '', lastBackup: null },
  sb() { return window.sb || null; },
  state() { try { return JSON.parse(localStorage.getItem(this.LS_KEY) || '{}'); } catch (_) { return {}; } },
  setState(p) { try { localStorage.setItem(this.LS_KEY, JSON.stringify(Object.assign(this.state(), p))); } catch (_) {} },
  folderName() { return 'Tutoring Connect Backups — ' + ((window.PRACTICE && window.PRACTICE.name) || 'Studio'); },

  async loadCfg() {
    if (!this.sb()) return this.cfg;
    try {
      const { data } = await this.sb().from('practice_settings')
        .select('drive_client_id,drive_sync_enabled,drive_sync_days,drive_folder_id,drive_last_backup').eq('id', 1).maybeSingle();
      if (data) this.cfg = {
        clientId: data.drive_client_id || '',
        enabled: !!data.drive_sync_enabled,
        days: Math.max(1, Number(data.drive_sync_days) || 7),
        folderId: data.drive_folder_id || '',
        lastBackup: data.drive_last_backup || null
      };
    } catch (e) { console.warn('[DriveSync]', e.message || e); }
    return this.cfg;
  },
  async saveCfg(patch) {
    Object.assign(this.cfg, patch || {});
    const row = { id: 1, drive_client_id: this.cfg.clientId, drive_sync_enabled: this.cfg.enabled,
      drive_sync_days: this.cfg.days, drive_folder_id: this.cfg.folderId };
    if (patch && 'lastBackup' in patch) row.drive_last_backup = this.cfg.lastBackup;
    if (patch && 'lastStatus' in patch) row.drive_last_status = String(patch.lastStatus || '').slice(0, 80);
    if (patch && 'lastRows'   in patch) row.drive_last_rows  = Number(patch.lastRows) || 0;
    if (patch && 'lastBytes'  in patch) row.drive_last_bytes = Number(patch.lastBytes) || 0;
    const { error } = await this.sb().from('practice_settings').upsert(row, { onConflict: 'id' });
    if (error) throw new Error('Could not save Drive settings: ' + error.message);
  },
  loadGIS() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = res; s.onerror = () => rej(new Error('Could not load Google sign-in'));
      document.head.appendChild(s);
    });
  },
  async getToken(interactive) {
    if (this.token && Date.now() < this.tokenExp - 60000) return this.token;
    if (!this.cfg.clientId) throw new Error('Paste the OAuth Client ID in Admin Data → Google Drive.');
    await this.loadGIS();
    return new Promise((resolve, reject) => {
      let settled = false;
      const done = (fn, v) => { if (!settled) { settled = true; fn(v); } };
      this._tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: this.cfg.clientId, scope: this.SCOPE,
        callback: (resp) => {
          if (resp && resp.access_token) {
            this.token = resp.access_token;
            this.tokenExp = Date.now() + Number(resp.expires_in || 3600) * 1000;
            done(resolve, this.token);
          } else done(reject, new Error((resp && resp.error_description) || 'Google auth failed'));
        },
        error_callback: (err) => done(reject, new Error(err && err.message || 'Google auth failed'))
      });
      this._tokenClient.requestAccessToken({ prompt: interactive ? 'consent' : '' });
      if (!interactive) setTimeout(() => done(reject, new Error('Silent Google auth timed out')), 12000);
    });
  },
  async api(path, opts) {
    const t = await this.getToken(opts && opts._interactive !== false);
    const r = await fetch('https://www.googleapis.com' + path, Object.assign({}, opts, {
      headers: Object.assign({ Authorization: 'Bearer ' + t }, (opts && opts.headers) || {})
    }));
    if (r.status === 401) { this.token = null; throw new Error('Google session expired — click Back up now.'); }
    if (!r.ok) throw new Error('Drive HTTP ' + r.status);
    return r;
  },
  async ensureFolder(interactive) {
    if (this.cfg.folderId) {
      try { await this.api('/drive/v3/files/' + this.cfg.folderId + '?fields=id', { _interactive: interactive }); return this.cfg.folderId; }
      catch (_) { this.cfg.folderId = ''; }
    }
    const q = encodeURIComponent("name='" + this.folderName().replace(/'/g, "\\'") + "' and mimeType='application/vnd.google-apps.folder' and trashed=false");
    const found = await (await this.api('/drive/v3/files?q=' + q + '&fields=files(id)', { _interactive: interactive })).json();
    let id = found.files && found.files[0] && found.files[0].id;
    if (!id) {
      const created = await (await this.api('/drive/v3/files?fields=id', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, _interactive: interactive,
        body: JSON.stringify({ name: this.folderName(), mimeType: 'application/vnd.google-apps.folder' })
      })).json();
      id = created.id;
    }
    try { await this.saveCfg({ folderId: id }); } catch (_) { this.cfg.folderId = id; }
    return id;
  },
  async backupNow(opts) {
    opts = opts || {};
    if (!window.DataPortability) throw new Error('Data portability engine not loaded.');
    DataPortability.init(this.sb());
    const folderId = await this.ensureFolder(opts.interactive !== false);
    const env = await DataPortability.collectFull();
    const json = JSON.stringify(env);
    const name = 'tutoring-connect-backup-' + new Date().toISOString().replace(/[:]/g,'-').slice(0,19) + '.json';
    const boundary = 'tcb' + Date.now();
    const body = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify({ name, parents: [folderId], mimeType: 'application/json' }) +
      '\r\n--' + boundary + '\r\nContent-Type: application/json\r\n\r\n' + json + '\r\n--' + boundary + '--';
    const up = await (await this.api('/upload/drive/v3/files?uploadType=multipart&fields=id,name,size', {
      method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body, _interactive: opts.interactive !== false
    })).json();
    this.cfg.lastBackup = new Date().toISOString();
    try {
      await this.saveCfg({
        lastBackup: this.cfg.lastBackup,
        lastStatus: 'ok', lastRows: env.meta.row_count, lastBytes: json.length
      });
    } catch (_) {}
    this.trimOld(folderId).catch(() => {});
    return { file: up, rows: env.meta.row_count, bytes: json.length };
  },
  async trimOld(folderId) {
    const list = await this.listBackups(folderId);
    for (const f of list.slice(this.MAX_KEEP)) {
      try { await this.api('/drive/v3/files/' + f.id, { method: 'DELETE', _interactive: false }); } catch (_) { break; }
    }
  },
  async listBackups(folderId) {
    folderId = folderId || await this.ensureFolder(true);
    const q = encodeURIComponent("'" + folderId + "' in parents and trashed=false and mimeType='application/json'");
    const r = await (await this.api('/drive/v3/files?q=' + q + '&orderBy=createdTime desc&pageSize=100&fields=files(id,name,size,createdTime)')).json();
    return r.files || [];
  },
  async restoreFrom(fileId) {
    DataPortability.init(this.sb());
    const r = await this.api('/drive/v3/files/' + fileId + '?alt=media');
    const env = JSON.parse(await r.text());
    return DataPortability.importArchive(env, 'upsert');
  },

  /* ==========================================================================
     renderPanel(el) — THE GOOGLE DRIVE CONTROL PANEL
     --------------------------------------------------------------------------
     V9 BUG FIX. admin-data.html has always called
         if (window.DriveSync && DriveSync.renderPanel) DriveSync.renderPanel(...)
     but renderPanel was NEVER DEFINED. The guard meant it failed silently, so
     the #drive-root card rendered EMPTY and there was no way anywhere in the
     product to paste an OAuth Client ID, enable sync, run a backup, list
     backups or restore one. The whole Drive feature was unreachable — the
     engine existed but had no controls attached to it.

     This is that missing panel. Everything it does uses the free Google
     Identity Services flow and the drive.file scope, which grants access ONLY
     to files this app itself creates — it can never read the rest of a
     person's Drive.
     ========================================================================== */
  fmtBytes(n) {
    n = Number(n || 0);
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  },
  fmtWhen(v) {
    if (!v) return 'never';
    const d = new Date(v);
    if (isNaN(d)) return String(v);
    const mins = Math.round((Date.now() - d.getTime()) / 60000);
    const rel = mins < 60 ? mins + ' min ago'
      : mins < 1440 ? Math.round(mins / 60) + ' h ago'
      : Math.round(mins / 1440) + ' day(s) ago';
    return d.toLocaleString() + ' (' + rel + ')';
  },
  esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  },

  async renderPanel(el) {
    if (!el) return;
    if (!this.isPrivileged()) {
      el.innerHTML = '<h3>☁️ Google Drive backup</h3>' +
        '<p class="muted">Only an owner or admin can configure Drive backups.</p>';
      return;
    }
    el.innerHTML = '<h3>☁️ Google Drive backup</h3><p class="muted">Loading settings…</p>';
    try { await this.loadCfg(); } catch (_) {}

    const c = this.cfg;
    const configured = !!c.clientId;
    const statusPill = configured
      ? (c.enabled ? '<span style="background:#065f46;color:#fff;padding:2px 9px;border-radius:99px;font-size:.74rem;font-weight:700">AUTOMATIC</span>'
                   : '<span style="background:#92400e;color:#fff;padding:2px 9px;border-radius:99px;font-size:.74rem;font-weight:700">MANUAL ONLY</span>')
      : '<span style="background:#b42318;color:#fff;padding:2px 9px;border-radius:99px;font-size:.74rem;font-weight:700">NOT SET UP</span>';

    el.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
        '<h3 style="margin:0">☁️ Google Drive backup</h3>' + statusPill +
      '</div>' +
      '<p class="muted" style="margin:6px 0 14px">' +
        'Sealed SHA-256 JSON backups of the whole studio, written to <b>your own</b> Google Drive. ' +
        'Free forever. Uses the <code>drive.file</code> scope, so this app can only ever see files ' +
        'it created itself — never the rest of your Drive.' +
      '</p>' +

      (configured ? '' :
        '<div class="card" style="background:#fffbeb;border-left:4px solid #d97706;margin-bottom:14px">' +
          '<b>First-time setup (about 5 minutes)</b>' +
          '<ol style="margin:8px 0 0 18px;line-height:1.75">' +
            '<li>Open <a href="https://console.cloud.google.com/" target="_blank" rel="noopener">Google Cloud Console</a> and create a free project.</li>' +
            '<li><b>APIs &amp; Services → Library</b> → enable <b>Google Drive API</b>.</li>' +
            '<li><b>OAuth consent screen</b> → External → add yourself as a <b>Test user</b>.</li>' +
            '<li><b>Credentials → Create credentials → OAuth client ID → Web application</b>.</li>' +
            '<li>Under <b>Authorised JavaScript origins</b> add exactly:<br>' +
              '<code>' + this.esc(location.origin) + '</code></li>' +
            '<li>Copy the <b>Client ID</b> and paste it below.</li>' +
          '</ol>' +
          '<p style="margin:8px 0 0"><a href="docs/GOOGLE-DRIVE-SYNC-GUIDE.md" target="_blank">Full illustrated guide →</a></p>' +
        '</div>') +

      '<div class="grid grid-2" style="gap:12px">' +
        '<div class="form-group" style="grid-column:1/-1">' +
          '<label for="ds-client">Google OAuth Client ID</label>' +
          '<input id="ds-client" class="form-input" placeholder="1234567890-abc123.apps.googleusercontent.com" value="' + this.esc(c.clientId) + '">' +
          '<div class="form-help">Ends in <code>.apps.googleusercontent.com</code>. Safe to store — it is a public identifier, not a secret.</div>' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="ds-days">Automatic backup every</label>' +
          '<select id="ds-days" class="form-input">' +
            [1, 2, 3, 7, 14, 30].map(d =>
              '<option value="' + d + '"' + (Number(c.days) === d ? ' selected' : '') + '>' +
              (d === 1 ? 'day' : d + ' days') + '</option>').join('') +
          '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="ds-enabled">Automatic backups</label>' +
          '<select id="ds-enabled" class="form-input">' +
            '<option value="0"' + (!c.enabled ? ' selected' : '') + '>Off — manual only</option>' +
            '<option value="1"' + (c.enabled ? ' selected' : '') + '>On — back up automatically</option>' +
          '</select>' +
        '</div>' +
      '</div>' +

      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">' +
        '<button class="btn btn-primary" type="button" id="ds-save">💾 Save settings</button>' +
        '<button class="btn btn-accent" type="button" id="ds-backup">☁️ Back up now</button>' +
        '<button class="btn btn-outline" type="button" id="ds-list">📂 List backups</button>' +
        '<button class="btn btn-ghost" type="button" id="ds-open">↗ Open Drive folder</button>' +
        '<button class="btn btn-ghost" type="button" id="ds-test">🔌 Test connection</button>' +
      '</div>' +

      '<div id="ds-status" style="margin-top:12px;font-size:.9rem"></div>' +

      '<div class="card" style="margin-top:12px;background:var(--surface-soft,#f8fafc)">' +
        '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
          '<span><b>Last backup:</b> ' + this.esc(this.fmtWhen(c.lastBackup)) + '</span>' +
          '<span><b>Keeps:</b> newest ' + this.MAX_KEEP + ' backups</span>' +
        '</div>' +
      '</div>' +

      '<div id="ds-files" style="margin-top:12px"></div>';

    const $ = id => document.getElementById(id);
    const say = (html, kind) => {
      const colors = { ok: '#065f46', err: '#b42318', busy: '#334155' };
      $('ds-status').innerHTML =
        '<div style="padding:10px 12px;border-radius:10px;background:#fff;border-left:4px solid ' +
        (colors[kind] || '#334155') + '">' + html + '</div>';
    };

    $('ds-save').onclick = async () => {
      try {
        const id = $('ds-client').value.trim();
        if (id && !/\.apps\.googleusercontent\.com$/.test(id)) {
          say('⚠️ That does not look like a Client ID. It should end in <code>.apps.googleusercontent.com</code>.', 'err');
          return;
        }
        say('Saving…', 'busy');
        await this.saveCfg({
          clientId: id,
          enabled: $('ds-enabled').value === '1',
          days: Number($('ds-days').value) || 7
        });
        say('✅ Settings saved.', 'ok');
        setTimeout(() => this.renderPanel(el), 900);
      } catch (e) { say('❌ ' + this.esc(e.message || e), 'err'); }
    };

    $('ds-test').onclick = async () => {
      try {
        say('Opening Google sign-in…', 'busy');
        await this.getToken(true);
        const id = await this.ensureFolder(true);
        say('✅ Connected. Backup folder ready (<code>' + this.esc(id) + '</code>).', 'ok');
      } catch (e) { say('❌ ' + this.esc(e.message || e), 'err'); }
    };

    $('ds-backup').onclick = async () => {
      try {
        say('☁️ Backing up… this can take a few seconds.', 'busy');
        const r = await this.backupNow({ interactive: true });
        say('✅ Backed up <b>' + r.rows + '</b> rows (' + this.fmtBytes(r.bytes) + ') as <code>' +
            this.esc(r.file && r.file.name) + '</code>.', 'ok');
        this.renderFiles(document.getElementById('ds-files'));
      } catch (e) { say('❌ ' + this.esc(e.message || e), 'err'); }
    };

    $('ds-list').onclick = () => this.renderFiles(document.getElementById('ds-files'));

    $('ds-open').onclick = async () => {
      try {
        const id = this.cfg.folderId || await this.ensureFolder(true);
        window.open('https://drive.google.com/drive/folders/' + id, '_blank', 'noopener');
      } catch (e) { say('❌ ' + this.esc(e.message || e), 'err'); }
    };

    if (configured && c.lastBackup) this.renderFiles(document.getElementById('ds-files'));
  },

  async renderFiles(box) {
    if (!box) return;
    box.innerHTML = '<p class="muted">Loading backups from Drive…</p>';
    try {
      const files = await this.listBackups();
      if (!files.length) {
        box.innerHTML = '<p class="muted">No backups in Drive yet. Press <b>Back up now</b>.</p>';
        return;
      }
      box.innerHTML =
        '<h4 style="margin:0 0 8px">Backups in Drive (' + files.length + ')</h4>' +
        '<div class="table-wrap"><table style="width:100%;font-size:.88rem">' +
        '<thead><tr><th align="left">File</th><th align="left">Created</th><th align="right">Size</th><th></th></tr></thead><tbody>' +
        files.map(f =>
          '<tr>' +
            '<td><code>' + this.esc(f.name) + '</code></td>' +
            '<td>' + this.esc(new Date(f.createdTime).toLocaleString()) + '</td>' +
            '<td align="right">' + this.fmtBytes(f.size) + '</td>' +
            '<td align="right">' +
              '<button class="btn btn-sm btn-outline" type="button" data-ds-restore="' + this.esc(f.id) + '">Restore</button>' +
            '</td>' +
          '</tr>').join('') +
        '</tbody></table></div>' +
        '<p class="muted" style="margin-top:8px">Restore merges the archive into the current database ' +
        '(upsert by id). Existing rows with the same id are overwritten; nothing is deleted.</p>';

      box.querySelectorAll('[data-ds-restore]').forEach(btn => {
        btn.onclick = async () => {
          const id = btn.dataset.dsRestore;
          if (!confirm('Restore this backup into the CURRENT database?\n\nRows with matching ids will be overwritten. This cannot be undone.\n\nContinue?')) return;
          btn.disabled = true; btn.textContent = 'Restoring…';
          try {
            const r = await this.restoreFrom(id);
            alert('✅ Restore complete.\n' + JSON.stringify(r, null, 2).slice(0, 500));
          } catch (e) {
            alert('❌ Restore failed: ' + (e.message || e));
          } finally { btn.disabled = false; btn.textContent = 'Restore'; }
        };
      });
    } catch (e) {
      box.innerHTML = '<p style="color:#b42318">Could not list backups: ' + this.esc(e.message || e) + '</p>';
    }
  },


  /* ==========================================================================
     overdueBanner() — School Connect parity + more (V10).
     SC shows an admin banner when a Drive backup is overdue. Ours adds:
       * a "never backed up" state (the most dangerous one, and the most common);
       * a one-press "Back up now" action inside the banner;
       * surfacing of the last failure reason (e.g. needs-consent), so a silently
         failing automatic backup becomes visible instead of rotting;
       * a 12-hour snooze so it informs rather than nags.
     Only owners/admins ever see it.
     ========================================================================== */
  LS_BANNER: 'tc-drive-banner-dismissed',

  overdueBanner() {
    try {
      if (!this.isPrivileged()) return;
      if (document.getElementById('tc-drive-banner')) return;
      var snoozed = Number(localStorage.getItem(this.LS_BANNER) || 0);
      if (Date.now() - snoozed < 12 * 3600 * 1000) return;

      var c = this.cfg;
      var never = !c.lastBackup;
      var failed = c.lastStatus && String(c.lastStatus).indexOf('needs-consent') === 0;
      // Nothing to say if Drive is not set up at all, or a recent backup exists.
      if (!c.clientId && !never) return;
      if (!never && !failed && !this.due()) return;
      if (!c.clientId) {
        // Configured nothing yet — nudge once, gently.
        if (localStorage.getItem('tc-drive-nudged') === '1') return;
        localStorage.setItem('tc-drive-nudged', '1');
      }

      var ageDays = c.lastBackup
        ? Math.floor((Date.now() - Date.parse(c.lastBackup)) / 86400000) : null;

      var msg = never
        ? '<b>This studio has never been backed up.</b> The Supabase free tier provides no downloadable backups — if the project is deleted, the data is gone.'
        : failed
          ? '<b>Automatic Drive backup needs your permission again.</b> The last silent attempt could not refresh its Google token.'
          : '<b>Drive backup is overdue</b> — last one was ' + ageDays + ' day(s) ago.';

      var el = document.createElement('div');
      el.id = 'tc-drive-banner';
      el.setAttribute('role', 'status');
      el.style.cssText =
        'position:fixed;left:0;right:0;bottom:0;z-index:9995;padding:11px 16px;' +
        'font:600 14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;color:#fff;' +
        'display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap;' +
        'background:' + (never ? '#b42318' : '#b45309') + ';box-shadow:0 -3px 14px rgba(0,0,0,.25)';
      el.innerHTML =
        '<span>☁️ ' + msg + '</span>' +
        '<button type="button" id="tc-drive-go" style="background:#fff;color:#0f172a;border:none;' +
        'padding:6px 14px;border-radius:8px;font-weight:800;cursor:pointer">Back up now</button>' +
        '<a href="admin-data.html" style="color:#fff;text-decoration:underline">Open Admin data</a>' +
        '<button type="button" id="tc-drive-x" aria-label="Dismiss" style="background:none;border:none;' +
        'color:#fff;font-size:18px;cursor:pointer">×</button>';
      (document.body || document.documentElement).appendChild(el);

      var self = this;
      document.getElementById('tc-drive-go').onclick = async function () {
        this.textContent = 'Backing up…';
        try {
          var r = await self.backupNow({ interactive: true });
          this.textContent = '✅ ' + r.rows + ' rows';
          setTimeout(function () { el.remove(); }, 1600);
        } catch (e) {
          this.textContent = '❌ failed';
          if (typeof toast === 'function') toast('Drive backup failed: ' + (e.message || e), 'error', 8000);
        }
      };
      document.getElementById('tc-drive-x').onclick = function () {
        try { localStorage.setItem(self.LS_BANNER, String(Date.now())); } catch (_) {}
        el.remove();
      };
    } catch (e) {}
  },

  isPrivileged() {
    const r = (window.App && App.role) || '';
    return ['admin','owner','director','lead_tutor','super_admin'].includes(r);
  },
  due() {
    if (!this.cfg.enabled) return false;
    const last = this.cfg.lastBackup ? Date.parse(this.cfg.lastBackup) : 0;
    return (Date.now() - last) >= this.cfg.days * 86400000;
  },
  async autoSyncCheck() {
    try {
      if (!this.sb() || !window.DataPortability) return;
      if (!this.isPrivileged()) return;
      await this.loadCfg();
      this.overdueBanner();
      if (!this.cfg.clientId || !this.due()) return;
      const st = this.state();
      if (st.lastAttempt && Date.now() - st.lastAttempt < 30 * 60000) return;
      this.setState({ lastAttempt: Date.now() });
      try {
        const r = await this.backupNow({ interactive: false });
        if (typeof toast === 'function') toast('☁️ Automatic Drive backup — ' + r.rows + ' rows.', 'success');
      } catch (silentErr) {
        // A silent (non-interactive) refresh failed — Google needs consent.
        try { await this.saveCfg({ lastStatus: 'needs-consent: ' + (silentErr.message || silentErr) }); } catch (_) {}
        if (!document.hidden) {
          const r2 = await this.backupNow({ interactive: true });
          if (typeof toast === 'function') toast('☁️ Drive backup completed — ' + r2.rows + ' rows.', 'success');
        }
      }
    } catch (e) { console.warn('[DriveSync] auto', e.message || e); }
  }
};
window.DriveSync = DriveSync;
(function () {
  let tries = 0;
  const tick = () => {
    tries++;
    if (window.App && window.DataPortability) DriveSync.autoSyncCheck();
    else if (tries < 20) setTimeout(tick, 1500);
  };
  document.addEventListener('DOMContentLoaded', () => setTimeout(tick, 3000));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(() => DriveSync.autoSyncCheck(), 2000); });
  setInterval(() => { if (!document.hidden) DriveSync.autoSyncCheck(); }, 30 * 60000);
})();
