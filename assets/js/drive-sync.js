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
    try { await this.saveCfg({ lastBackup: new Date().toISOString() }); } catch (_) {}
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
      if (!this.cfg.clientId || !this.due()) return;
      const st = this.state();
      if (st.lastAttempt && Date.now() - st.lastAttempt < 30 * 60000) return;
      this.setState({ lastAttempt: Date.now() });
      try {
        const r = await this.backupNow({ interactive: false });
        if (typeof toast === 'function') toast('☁️ Automatic Drive backup — ' + r.rows + ' rows.', 'success');
      } catch (_) {
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
