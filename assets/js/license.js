/* ====================================================================
   license.js — Tutoring Connect lifetime vs subscription
   Same honesty as School Connect: client JS is not 100% tamper-proof.
   Sources (priority): HMG registry URL → site_license table → PRACTICE.license
   ==================================================================== */
(function () {
  const License = {
    _state: null,

    evaluate(lic) {
      lic = lic || (window.PRACTICE && window.PRACTICE.license) || { model: 'lifetime', status: 'active' };
      if (!lic || lic.model === 'lifetime' || lic.model === 'one_time' || !lic.expires_on) {
        return { state: 'ok', model: lic.model || 'lifetime' };
      }
      if (String(lic.status || '').toLowerCase() === 'suspended') {
        return { state: 'locked', daysLeft: -999, model: 'subscription', reason: 'suspended' };
      }
      const exp = new Date(lic.expires_on);
      const grace = Number(lic.grace_days || 7);
      const now = new Date();
      const left = Math.ceil((exp - now) / 86400000);
      if (left >= 0) return { state: left <= 30 ? 'remind' : 'ok', daysLeft: left, model: 'subscription', exp };
      if (Math.abs(left) <= grace) return { state: 'grace', daysLeft: left, model: 'subscription', exp };
      return { state: 'locked', daysLeft: left, model: 'subscription', exp };
    },

    async loadRemote() {
      const p = window.PRACTICE || {};
      const lic = Object.assign({}, p.license || {});
      try {
        if (window.sb) {
          const { data } = await window.sb.from('site_license').select('*').eq('id', 1).maybeSingle();
          if (data) Object.assign(lic, data);
        }
      } catch (_) {}
      try {
        const url = lic.registry_url || (p.license && p.license.registryUrl);
        if (url) {
          const r = await fetch(url, { cache: 'no-store' });
          if (r.ok) {
            const j = await r.json();
            const row = (j.sites && (j.sites[p.shortName] || j.sites[p.name])) || j;
            if (row && (row.model || row.expires_on)) Object.assign(lic, row);
          }
        }
      } catch (_) {}
      return lic;
    },

    paint(r) {
      if (!r || r.state === 'ok') return;
      let bar = document.getElementById('tc-license-bar');
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'tc-license-bar';
        bar.style.cssText = 'position:sticky;top:0;z-index:90;padding:8px 12px;background:#fde68a;color:#78350f;font-weight:700;text-align:center';
        document.body.prepend(bar);
      }
      const renew = (window.PRACTICE && PRACTICE.license && PRACTICE.license.renew_url) || 'https://wa.me/2348100866322?text=Renew%20Tutoring%20Connect';
      if (r.state === 'locked') {
        bar.style.background = '#fecaca';
        bar.innerHTML = 'Subscription expired. Data is safe. <a href="'+renew+'" target="_blank" rel="noopener">Renew with HMG</a>';
        if (!document.getElementById('tc-license-lock')) {
          const lock = document.createElement('div');
          lock.id = 'tc-license-lock';
          lock.className = 'modal-backdrop show';
          lock.innerHTML = '<div class="modal"><div class="modal-body"><h2>Renewal required</h2><p>The portal is locked after expiry + grace. Your data is untouched. Contact HMG to extend the term.</p><p><a class="btn btn-primary" href="'+renew+'" target="_blank" rel="noopener">WhatsApp HMG</a></p></div></div>';
          document.body.appendChild(lock);
        }
      } else if (r.state === 'grace') {
        bar.textContent = 'Grace period: subscription expired ' + Math.abs(r.daysLeft) + ' day(s) ago. Renew before lock.';
      } else {
        bar.textContent = 'Subscription reminder: ' + r.daysLeft + ' day(s) remaining.';
      }
    },

    async apply() {
      const lic = await this.loadRemote();
      const r = this.evaluate(lic);
      this._state = r;
      this.paint(r);
      return r;
    }
  };

  window.License = License;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => License.apply());
  else License.apply();
  setInterval(() => License.apply(), 15 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) License.apply(); });
})();
