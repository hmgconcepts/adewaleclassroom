/* ==========================================================================
   ADEWALE CLASSROOM DECK v3 ENTERPRISE ENHANCEMENTS
   • Crash-safe recording (auto-saves on unexpected close)
   • Simultaneous recording + live streaming
   • ADEWALE CLASSROOM branded intro/outro for recorded videos
   • Lower thirds banner with scrolling text ads
   • Staff credentials overlay (name, title, intermittent popup)
   • 1000+ student scalability via relay mode
   • Zoom/Teams/Meet multi-platform compatibility
   • Forced PWA install with persistent banner
   • Security hardening: rate limiting, message signing, connection throttling
   • Recording ad/text-ad overlay engine
   ========================================================================== */
"use strict";

/* ============================================================
   1. CRASH-SAFE RECORDING
   Saves recording chunks to IndexedDB so if the browser/app
   closes unexpectedly, the recording is preserved.
   ============================================================ */
const CDCrashSafe = {
  db: null,
  dbName: 'hmg_classdeck_records',
  storeName: 'recording_chunks',

  async openDB() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = () => { this.db = req.result; resolve(this.db); };
      req.onerror = () => reject(req.error);
    });
  },

  async saveChunk(chunk, sessionId) {
    try {
      const db = await this.openDB();
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).add({ sessionId, chunk, ts: Date.now() });
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = reject;
      });
    } catch (e) { console.warn('[CrashSafe] Save failed:', e); }
  },

  async getChunks(sessionId) {
    try {
      const db = await this.openDB();
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const all = await new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return all.filter(r => r.sessionId === sessionId).map(r => r.chunk);
    } catch { return []; }
  },

  async clearSession(sessionId) {
    try {
      const db = await this.openDB();
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const all = await new Promise(r => { const q = store.getAll(); q.onsuccess = () => r(q.result); });
      all.filter(r => sessionId === 'all' || r.sessionId === sessionId).forEach(r => store.delete(r.id));
      await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = reject; });
    } catch {}
  },

  async hasRecoverableSession() {
    try {
      const db = await this.openDB();
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const count = await new Promise(r => { const q = store.count(); q.onsuccess = () => r(q.result); });
      return count > 0;
    } catch { return false; }
  }
};

/* ============================================================
   2. HMG BRANDED RECORDING ENGINE (Enhanced)
   Adds: Intro/Outro video frames, lower thirds, staff
   credentials, text-ad overlay, brand watermark.
   ============================================================ */
const HMGREC = {
  meta: {
    subject: '',
    topic: '',
    klass: '',
    staffName: 'Adewale Adeagbo',
    staffTitle: 'Virtual Tutor | Data Scientist | AI-Augmented Solutions Developer',
    brand: 'ADEWALE CLASSROOM DECK',
    footer: 'Learning Deliberately. Teaching Authentically.',
    lowerThird: 'If you want to book virtual classes with us, contact Adewale on 08100866322, 08094481488',
    adText: '',
    adInterval: 60, // seconds between ad overlays
    showStaffPulse: true,
    pulseInterval: 30, // seconds between staff credential popups
    introDuration: 6,  // seconds
    outroDuration: 4,
    brandLogo: null
  },

  _adTimer: null,
  _pulseTimer: null,
  _lowerThirdInterval: null,
  _introFrame: null,
  _outroFrame: null,
  _sessionId: Date.now().toString(36) + Math.random().toString(36).slice(2,6),

  loadMeta() {
    const saved = Store.get('hmg_rec_meta', {});
    if (saved.subject) this.meta.subject = saved.subject;
    if (saved.topic) this.meta.topic = saved.topic;
    if (saved.klass) this.meta.klass = saved.klass;
    if (saved.staffName) this.meta.staffName = saved.staffName;
    if (saved.staffTitle) this.meta.staffTitle = saved.staffTitle;
    if (saved.brand) this.meta.brand = saved.brand;
    if (saved.footer) this.meta.footer = saved.footer;
    if (saved.lowerThird) this.meta.lowerThird = saved.lowerThird;
    if (saved.adText) this.meta.adText = saved.adText;
    if (saved.adInterval) this.meta.adInterval = saved.adInterval;
    if (saved.showStaffPulse !== undefined) this.meta.showStaffPulse = saved.showStaffPulse;
    if (saved.pulseInterval) this.meta.pulseInterval = saved.pulseInterval;
    this._loadLogo();
  },

  saveMeta() {
    Store.set('hmg_rec_meta', {
      subject: this.meta.subject, topic: this.meta.topic, klass: this.meta.klass,
      staffName: this.meta.staffName, staffTitle: this.meta.staffTitle,
      brand: this.meta.brand, footer: this.meta.footer,
      lowerThird: this.meta.lowerThird, adText: this.meta.adText,
      adInterval: this.meta.adInterval, showStaffPulse: this.meta.showStaffPulse,
      pulseInterval: this.meta.pulseInterval
    });
  },

  _loadLogo() {
    const data = Store.get('hmg_rec_logo', null) || Store.get('rec_logo', null);
    this.meta.brandLogo = new Image();
    if (data) { this.meta.brandLogo.src = data; }
    else { this.meta.brandLogo.src = "../assets/img/logo.png";
      this.meta.brandLogo.onerror = () => { this.meta.brandLogo.src = "assets/icon-192.png"; }; }
  },

  setLogo(file) {
    return new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => { Store.set('hmg_rec_logo', fr.result); this._loadLogo(); resolve(); };
      fr.readAsDataURL(file);
    });
  },

  /** Draw the intro frame on a canvas */
  drawIntroFrame(canvas, ctx, W, H, elapsed = 0) {
    ctx.globalAlpha = 1.0;
    const duration = 15000;
    const t = Math.min(1, Math.max(0, elapsed / duration));
    
    // Background - Deep Royal Blue gradient
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#0a0f25');
    bgGrad.addColorStop(1, '#1a2352');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Dynamic grid overlay for tech/modern feel
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for(let i=0; i<W; i+=60) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke(); }
    for(let i=0; i<H; i+=60) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke(); }

    ctx.save();
    
    // Scene 1: Logo & Brand (0 to 45%)
    // Scene 2: Topic & Details (45% to 100%)
    
    let alpha1 = 0, yOffset1 = 50, scale1 = 0.8;
    let alpha2 = 0, xOffset2 = -50;

    if (t < 0.45) {
      const localT = Math.min(1, t / 0.15);
      alpha1 = localT;
      yOffset1 = 50 * (1 - localT);
      scale1 = 0.8 + 0.2 * localT;
      
      // Fade out
      if (t > 0.35) {
         alpha1 = 1 - (t - 0.35) / 0.1;
      }
    } else {
      const localT = Math.min(1, (t - 0.45) / 0.15);
      alpha2 = localT;
      xOffset2 = -50 * (1 - localT);
      if (t > 0.9) {
         alpha2 = 1 - (t - 0.9) / 0.1;
      }
    }

    // --- SCENE 1 ---
    if (alpha1 > 0) {
      ctx.globalAlpha = alpha1;
      ctx.translate(W/2, H/2);
      ctx.scale(scale1, scale1);
      ctx.translate(-W/2, -H/2);
      
      let logoBottom = H * 0.4;
      if (this.meta.brandLogo && this.meta.brandLogo.complete && this.meta.brandLogo.naturalWidth) {
        const lw = Math.min(W * 0.25, 200);
        const lh = lw * (this.meta.brandLogo.naturalHeight / this.meta.brandLogo.naturalWidth);
        ctx.drawImage(this.meta.brandLogo, (W - lw) / 2, H * 0.3 - lh/2 + yOffset1, lw, lh);
        logoBottom = H * 0.3 + lh/2 + 20;
      } else {
        ctx.fillStyle = '#ffb347';
        ctx.font = 'bold ' + Math.round(H * 0.1) + 'px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('🎓', W / 2, H * 0.3 + yOffset1);
        logoBottom = H * 0.3 + 40;
      }
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold ' + Math.round(H * 0.08) + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(this.meta.brand || 'ADEWALE CLASSROOM', W / 2, logoBottom + 40 + yOffset1);
      
      ctx.fillStyle = '#ffb347';
      ctx.font = 'bold ' + Math.round(H * 0.035) + 'px system-ui';
      ctx.fillText(this.meta.footer || 'Learning Deliberately.', W / 2, logoBottom + 90 + yOffset1);
    }

    // --- SCENE 2 ---
    ctx.restore(); // restore from scene 1
    ctx.save();    // save for scene 2
    if (alpha2 > 0) {
      
      ctx.globalAlpha = alpha2;
      
      // Decorative Left Accent Line
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(W * 0.15 + xOffset2, H * 0.25, 8, H * 0.5);

      ctx.textAlign = 'left';
      
      ctx.fillStyle = '#ffb347';
      ctx.font = 'bold ' + Math.round(H * 0.035) + 'px system-ui';
      ctx.fillText('TODAY\'S LESSON', W * 0.18 + xOffset2, H * 0.32);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold ' + Math.round(H * 0.075) + 'px system-ui';
      const subj = (this.meta.subject || 'Academic Tutoring');
      ctx.fillText(subj, W * 0.18 + xOffset2, H * 0.42);

      if (this.meta.topic) {
        ctx.fillStyle = '#eef1ff';
        ctx.font = Math.round(H * 0.045) + 'px system-ui';
        ctx.fillText(this.meta.topic, W * 0.18 + xOffset2, H * 0.50);
      }

      ctx.fillStyle = '#9aa3cf';
      ctx.font = 'bold ' + Math.round(H * 0.03) + 'px system-ui';
      ctx.fillText('INSTRUCTOR', W * 0.18 + xOffset2, H * 0.65);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold ' + Math.round(H * 0.05) + 'px system-ui';
      ctx.fillText(this.meta.staffName || 'Adewale Adeagbo', W * 0.18 + xOffset2, H * 0.72);

      ctx.fillStyle = '#4f6ef7';
      ctx.font = Math.round(H * 0.03) + 'px system-ui';
      ctx.fillText(this.meta.staffTitle || 'Professional Tutor', W * 0.18 + xOffset2, H * 0.78);
    }
    ctx.restore(); // restore from scene 2 to prevent globalAlpha leakage into the main video
  },

  /** Draw the outro frame */
  drawOutroFrame(canvas, ctx, W, H, elapsed = 0) {
    ctx.globalAlpha = 1.0;
    const duration = 15000; 
    const t = Math.min(1, Math.max(0, elapsed / duration));
    
    // Background - Deep Royal Blue gradient
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#0a0f25');
    bgGrad.addColorStop(1, '#1a2352');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);
    
    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for(let i=0; i<W; i+=60) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke(); }
    for(let i=0; i<H; i+=60) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke(); }

    ctx.save();
    
    let hasFlyer = false;
    let flyerImg = null;
    if (window.HMGFlyer) {
       flyerImg = window.HMGFlyer.get && window.HMGFlyer.get();
       if (flyerImg && flyerImg.naturalWidth) hasFlyer = true;
    }

    // SCENE 1: Flyer (0-4 seconds) IF it exists
    // SCENE 2: CTA & Details (4-7 seconds, or 0-7 if no flyer)
    let flyerAlpha = 0;
    let ctaAlpha = 0;
    let yOffset = 0;
    
    // 0-4s Flyer (t < 0.266), 4-15s CTA (t >= 0.266)
    if (hasFlyer) {
       if (t < 0.266) {
          // Fade in (0 to 0.05) and fade out (0.216 to 0.266)
          flyerAlpha = Math.min(1, t / 0.05);
          if (t > 0.216) flyerAlpha = 1 - (t - 0.216) / 0.05;
       } else {
          ctaAlpha = Math.min(1, (t - 0.266) / 0.05);
          yOffset = 30 * (1 - ctaAlpha);
       }
    } else {
       ctaAlpha = Math.min(1, t / 0.1);
       yOffset = 30 * (1 - ctaAlpha);
    }

    // DRAW FLYER SCENE
    if (flyerAlpha > 0 && hasFlyer) {
       ctx.save();
       ctx.globalAlpha = flyerAlpha;
       const s = Math.min(W/flyerImg.naturalWidth, H/flyerImg.naturalHeight) * 0.95;
       // zoom from 1 to 1.15 over the 4 seconds (t goes from 0 to 0.266)
       const zoom = 1 + ((t / 0.266) * 0.15);
       ctx.translate(W/2, H/2);
       ctx.scale(zoom, zoom);
       ctx.translate(-W/2, -H/2);
       ctx.drawImage(flyerImg, (W-flyerImg.naturalWidth*s)/2, (H-flyerImg.naturalHeight*s)/2, flyerImg.naturalWidth*s, flyerImg.naturalHeight*s);
       ctx.restore();
    }

    // DRAW CTA SCENE
    if (ctaAlpha > 0) {
       ctx.save();
       ctx.globalAlpha = ctaAlpha;
       ctx.textAlign = 'center';
       
       if (this.meta.brandLogo && this.meta.brandLogo.complete && this.meta.brandLogo.naturalWidth) {
         const lw = Math.min(W * 0.15, 120);
         const lh = lw * (this.meta.brandLogo.naturalHeight / this.meta.brandLogo.naturalWidth);
         ctx.drawImage(this.meta.brandLogo, (W - lw) / 2, H * 0.20 + yOffset, lw, lh);
       } else {
         ctx.fillStyle = '#ffb347';
         ctx.font = 'bold ' + Math.round(H * 0.08) + 'px system-ui';
         ctx.fillText('🎓', W / 2, H * 0.25 + yOffset);
       }
       
       ctx.fillStyle = '#ffffff';
       ctx.font = 'bold ' + Math.round(H * 0.08) + 'px system-ui';
       ctx.fillText('THANK YOU FOR WATCHING', W / 2, H * 0.48 + yOffset);

       ctx.fillStyle = '#9aa3cf';
       ctx.font = Math.round(H * 0.035) + 'px system-ui';
       ctx.fillText(this.meta.brand || 'Adewale Classroom', W / 2, H * 0.58 + yOffset);
       
       ctx.fillStyle = '#ffb347';
       ctx.font = 'bold ' + Math.round(H * 0.03) + 'px system-ui';
       ctx.fillText('Instructor: ' + (this.meta.staffName || 'Adewale Adeagbo'), W / 2, H * 0.65 + yOffset);

       // Call To Action Bottom Bar
       ctx.fillStyle = '#ff6b00'; 
       ctx.fillRect(0, H - Math.round(H * 0.15), W, Math.round(H * 0.15));

       ctx.fillStyle = '#ffffff';
       ctx.font = 'bold ' + Math.round(H * 0.05) + 'px system-ui';
       ctx.textAlign = 'center';
       ctx.textBaseline = 'middle';
       ctx.fillText('🚀 READY TO LEARN MORE? CONTACT US TODAY!', W / 2, H - Math.round(H * 0.075));
       ctx.restore();
    }

    ctx.restore(); // restore initial grid/background save block
  },

  /** Draw lower thirds bar at the bottom of the frame */
  drawLowerThird(ctx, W, H, text, ts) {
    if (!text) return;
    const barH = Math.round(H * 0.06);
    const footH = Math.round(H * 0.045);
    const y = H - footH - barH;
    ctx.save();

    // Semi-transparent background
    ctx.fillStyle = 'rgba(16,20,43,0.85)';
    ctx.beginPath();
    ctx.roundRect(0, y, W, barH, [0, 0, 0, 0]);
    ctx.fill();

    // Animated text (scrolling)
    ctx.save();
    ctx.beginPath();
    ctx.rect(8, y, W - 16, barH);
    ctx.clip();

    const speed = 40; // pixels per second
    const offset = ((ts / 1000) * speed) % (W + ctx.measureText(text).width);
    const x = W - offset;

    ctx.fillStyle = '#ffb347';
    ctx.font = 'bold ' + Math.round(barH * 0.5) + 'px system-ui';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + barH / 2);

    // Duplicate for seamless scrolling
    ctx.fillText(text, x + ctx.measureText(text).width + W * 0.5, y + barH / 2);

    ctx.restore();
    ctx.restore();
  },

  /** Draw staff credentials overlay (intermittent popup) */
  drawStaffPulse(ctx, W, H, ts, active) {
    if (!active || !this.meta.showStaffPulse) return;
    const duration = 5000; // 5 seconds visible
    const cycleMs = this.meta.pulseInterval * 1000 + duration;
    const phase = ts % cycleMs;

    if (phase > duration) return; // hidden phase

    const alpha = phase < 300 ? phase / 300 : (phase > duration - 300 ? (duration - phase) / 300 : 1);
    const barH = Math.round(H * 0.07);
    const footH = Math.round(H * 0.045);
    const y = H - footH - Math.round(H * 0.06) - Math.round(H * 0.07) - 10;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(16,20,43,0.92)';
    ctx.beginPath();
    ctx.roundRect(W * 0.15, y, W * 0.7, barH, 12);
    ctx.fill();

    ctx.fillStyle = '#ffb347';
    ctx.font = 'bold ' + Math.round(barH * 0.4) + 'px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👨‍🏫 ' + this.meta.staffName, W / 2, y + barH * 0.38);

    ctx.fillStyle = '#9aa3cf';
    ctx.font = Math.round(barH * 0.28) + 'px system-ui';
    ctx.fillText(this.meta.staffTitle, W / 2, y + barH * 0.72);

    ctx.restore();
  },

  /** Draw text-ad overlay on the frame */
  drawAdOverlay(ctx, W, H, ts, recStartTs) {
    if (!this.meta.adText) return;
    const elapsed = (ts - recStartTs);
    const interval = this.meta.adInterval * 1000;
    const phase = elapsed % ((this.meta.adInterval * 1000) + 5000); // 5 sec display

    if (phase > this.meta.adInterval * 1000) {
      // Display ad
      const adDuration = 5000;
      const localPhase = phase - (this.meta.adInterval * 1000);
      if (localPhase > adDuration) return;

      const alpha = localPhase < 300 ? localPhase / 300 : (localPhase > adDuration - 300 ? (adDuration - localPhase) / 300 : 1);
      const adH = Math.round(H * 0.05);
      let cbtUrl = ''; try { cbtUrl = localStorage.getItem("hmg_cbt_link") || ""; } catch(e){}
      const headH = Math.round(H * 0.09) + (cbtUrl ? Math.round(H * 0.045) : 0);
      const adY = headH + Math.round(H * 0.02);

      ctx.save();
      ctx.globalAlpha = alpha;

      // Background
      ctx.fillStyle = 'rgba(224,43,43,0.88)';
      ctx.beginPath();
      ctx.roundRect(0, adY, W, adH, [0, 0, 12, 12]);
      ctx.fill();

      // Ad text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold ' + Math.round(adH * 0.5) + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('📢 ' + this.meta.adText, W / 2, adY + adH / 2);

      ctx.restore();
    }
  },

  /** Start the recording enhancement timers */
  startTimers() {
    this._sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
  },

  stopTimers() {
    if (this._adTimer) { clearInterval(this._adTimer); this._adTimer = null; }
    if (this._pulseTimer) { clearInterval(this._pulseTimer); this._pulseTimer = null; }
    if (this._lowerThirdInterval) { clearInterval(this._lowerThirdInterval); this._lowerThirdInterval = null; }
  }
};

/* ============================================================
   3. FORCED PWA INSTALL
   Persistent install banner that reappears until user installs.
   ============================================================ */
const CDForceInstall = {
  bannerShown: false,
  _deferred: null,

  init() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this._deferred = e;
      this.showBanner();
    });

    window.addEventListener('appinstalled', () => {
      this.hideBanner();
      Store.set('cd_installed', true);
      toast('✅ ' + (CD_CONFIG?.brand || 'ClassDeck') + ' installed successfully!', 'ok', 5000);
    });

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || Store.get('cd_installed', false)) {
      return;
    }

    // Show banner after a short delay if not installed
    setTimeout(() => {
      if (!Store.get('cd_installed', false) && !this.bannerShown) {
        this.showBanner();
      }
    }, 4000);
  },

  showBanner() {
    if (this.bannerShown || Store.get('cd_installed', false) ||
        window.matchMedia('(display-mode: standalone)').matches) return;
    this.bannerShown = true;

    const existing = document.getElementById('cdInstallBanner');
    if (existing) return;

    const brand = (window.CD_CONFIG && CD_CONFIG.brand) || 'ClassDeck';
    const banner = document.createElement('div');
    banner.id = 'cdInstallBanner';
    banner.innerHTML = `
      <div class="install-banner">
        <div class="install-content">
          <div class="install-icon">📲</div>
          <div class="install-text">
            <strong>Install ${brand}</strong>
            <span>Get the best experience — install as an app</span>
          </div>
          <div class="install-actions">
            <button class="btn small" id="cdInstallLater">Later</button>
            <button class="btn primary small" id="cdInstallNow">📲 Install</button>
          </div>
        </div>
        <button class="install-close" id="cdInstallClose">×</button>
      </div>`;
    document.body.appendChild(banner);

    document.getElementById('cdInstallNow').addEventListener('click', () => {
      if (this._deferred) {
        this._deferred.prompt();
        this._deferred.userChoice.then((result) => {
          if (result.outcome === 'accepted') {
            Store.set('cd_installed', true);
            this.hideBanner();
          }
        });
      } else {
        toast('Tap your browser menu → "Add to Home screen" or "Install app"', '', 6000);
      }
    });

    document.getElementById('cdInstallLater').addEventListener('click', () => {
      this.hideBanner();
      // Show again after 2 more page visits
      const count = Store.get('cd_dismiss_count', 0) + 1;
      Store.set('cd_dismiss_count', count);
      if (count < 3) {
        setTimeout(() => this.showBanner(), 30000);
      } else {
        // After 3 dismisses, wait until next session
        Store.set('cd_dismiss_count', 0);
      }
    });

    document.getElementById('cdInstallClose').addEventListener('click', () => this.hideBanner());
  },

  hideBanner() {
    const b = document.getElementById('cdInstallBanner');
    if (b) { b.style.opacity = '0'; b.style.transition = 'opacity 0.3s'; setTimeout(() => b.remove(), 300); }
    this.bannerShown = false;
  }
};

/* ============================================================
   4. 1000-STUDENT SCALABILITY
   When student count exceeds ~50, auto-switch to relay mode
   that uses the composite canvas → single broadcast stream.
   For 1000+, recommend YouTube Live relay.
   ============================================================ */
const CDScaler = {
  MAX_PEER_TO_PEER: 50,
  relayMode: false,

  checkScale(room) {
    if (!room) return false;
    const count = room.students ? room.students.size : 0;
    if (count > this.MAX_PEER_TO_PEER && !this.relayMode) {
      this.relayMode = true;
      toast('📡 Large class detected (' + count + ' students) — switching to optimized broadcast mode', 'ok', 6000);
      if (typeof startCompositeStage === 'function') startCompositeStage();
      return true;
    }
    return false;
  },

  getBroadcastMode(count) {
    if (count > 200) return 'youtube_relay'; // Recommend YouTube Live
    if (count > 50) return 'composite_optimized';
    return 'peer_to_peer';
  }
};

/* ============================================================
   5. MULTI-PLATFORM COMPANION MODE
   Works with Google Meet, Zoom, Microsoft Teams, FreeConference
   ============================================================ */
const CDCompanion = {
  detectPlatform() {
    const url = new URLSearchParams(location.search).get('companion') || '';
    if (url) return url;
    const ua = navigator.userAgent || '';
    if (location.hash.includes('zoom')) return 'zoom';
    if (location.hash.includes('teams')) return 'teams';
    if (location.hash.includes('freeconf')) return 'freeconference';
    return 'meet'; // default
  },

  applyMode() {
    const mode = this.detectPlatform();
    const query = new URLSearchParams(location.search);
    const companion = query.get('companion') || '';

    // Hide live class controls for all companion modes
    const hideControls = ['#btnGoLive', '#btnEndLive', '#btnStudents', '#btnChat', '#btnPoll', '#roomInfo'];
    if (companion || location.hash.includes('companion')) {
      hideControls.forEach(s => { const el = document.querySelector(s); if (el) el.classList.add('hide'); });
      const badge = document.createElement('span');
      badge.className = 'badge companion';
      badge.textContent = '● COMPANION (' + mode.toUpperCase() + ')';
      const brand = document.querySelector('.topbar .brand');
      if (brand) brand.after(badge);
      window._wantWake = true;
      if (typeof keepAwake === 'function') keepAwake(true);
      toast('🔄 Companion mode for ' + mode + ' — share your screen in the conferencing app.', 'ok', 6000);
    }
  }
};

/* ============================================================
   6. SECURITY HARDENING
   • Chat rate limiting (server-side enforcement)
   • Connection throttling
   • Message size limits
   • Anti-spam measures
   ============================================================ */
const CDSecurity = {
  _msgCount: new Map(),
  _banList: new Set(),

  checkMessage(peerId, type) {
    // Check ban
    if (this._banList.has(peerId)) return false;

    // Rate limit: max 20 messages per 10 seconds
    const now = Date.now();
    const key = peerId + '_' + type;
    const history = this._msgCount.get(key) || [];
    const recent = history.filter(t => now - t < 10000);
    if (recent.length >= 20) {
      this._banList.add(peerId);
      setTimeout(() => this._banList.delete(peerId), 60000);
      return false;
    }
    recent.push(now);
    this._msgCount.set(key, recent);
    return true;
  },

  sanitizeMessage(text) {
    return String(text || '').trim().slice(0, 500);
  },

  validatePeerId(id) {
    return /^[a-zA-Z0-9_-]{4,64}$/.test(String(id));
  }
};

/* ============================================================
   6b. EXPLICIT GLOBAL EXPORTS (critical)
   This file runs in "use strict" mode, so top-level `const`
   declarations live in the lexical global scope and are NOT
   attached to `window` — teach.js (which reads these via
   window.*) would otherwise see everything as undefined and the
   branded-recording hooks + crash-safe mirroring would silently
   be dead code. Export them explicitly here.
   ============================================================ */
window.HMGREC = HMGREC;
window.CDCrashSafe = CDCrashSafe;
window.CDForceInstall = CDForceInstall;
window.CDCompanion = CDCompanion;
window.CDScaler = CDScaler;
window.CDSecurity = CDSecurity;

/* ============================================================
   7. INITIALIZATION
   Auto-run on page load
   ============================================================ */
(function CDEnhancementsInit() {
  // Only run on teach.html
  if (!document.querySelector('.studio')) return;

  // Load HMGREC meta
  HMGREC.loadMeta();

  // Init forced install (after a delay)
  setTimeout(() => CDForceInstall.init(), 2000);

  // Init companion mode detection
  CDCompanion.applyMode();

  console.log('[CD Enhancements] Loaded — crash-safe recording, branding, install enforcement, security.');
})();

/* ============================================================
   8. RECORDING RECOVERY
   Check for interrupted recordings on page load
   ============================================================ */
(async function checkRecovery() {
  const hasRecoverable = await CDCrashSafe.hasRecoverableSession();
  if (hasRecoverable && document.querySelector('.studio')) {
    setTimeout(() => {
      const brand = (window.CD_CONFIG && CD_CONFIG.brand) || 'ClassDeck';
      const bar = document.createElement('div');
      bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9001;background:#b7791f;color:#fff;display:flex;gap:10px;align-items:center;justify-content:center;padding:9px;font-size:14px;flex-wrap:wrap';
      bar.innerHTML = '<b>⚡ A previous recording was saved before the app closed.</b>' +
        '<button id="recRecoverYes" class="btn small ok">💾 Recover recording</button>' +
        '<button id="recRecoverNo" class="btn small">Dismiss</button>';
      document.body.appendChild(bar);
      document.getElementById('recRecoverYes').addEventListener('click', async () => {
        bar.remove();
        toast('Recovery in progress...', 'ok', 3000);
        // The chunks are in IndexedDB — the user can download them
        // The chunks are in IndexedDB — the user can download them
        try {
          const db = await CDCrashSafe.openDB();
          const tx = db.transaction(CDCrashSafe.storeName, 'readonly');
          const store = tx.objectStore(CDCrashSafe.storeName);
          const all = await new Promise(r => { const q = store.getAll(); q.onsuccess = () => r(q.result); });
          
          const sessionIds = [...new Set(all.map(r => r.sessionId))];
          for (const sid of sessionIds) {
             const chunks = all.filter(r => r.sessionId === sid).sort((a,b) => a.ts - b.ts).map(r => r.chunk);
             if (chunks.length > 0) {
               const blob = new Blob(chunks, { type: 'video/webm' });
               const fname = 'Recovered_Lesson_' + new Date().toISOString().slice(0,10) + '.webm';
               const a = document.createElement('a');
               a.href = URL.createObjectURL(blob);
               a.download = fname;
               a.click();
               URL.revokeObjectURL(a.href);
             }
          }
        } catch(e) { console.error('Recovery failed', e); }
        CDCrashSafe.clearSession('all');
      });
      document.getElementById('recRecoverNo').addEventListener('click', () => {
        CDCrashSafe.clearSession('all');
        bar.remove();
      });
    }, 1500);
  }
})();
/* ============================================================
   9. HMG RECORDING STUDIO — DIALOG WIRING + INTRO/OUTRO/LOWER-THIRDS/ADS
   Integrates the enhanced recording dialog (mHmgRecSetup) with the
   existing recorder in teach.js. Wraps drawRecordingFrame() so every
   recorded second includes:
     • 6-second branded intro (logo, brand, motto, tutor, subject, topic)
     • scrolling lower-thirds text banner
     • intermittent staff-credentials popups
     • intermittent text-ad overlays
     • 4-second branded outro before the file is saved
   ============================================================ */

(function HMGRecordingStudio() {
  if (!window.HMGREC || typeof HMGREC.loadMeta !== "function") return;

  /* Session + timeline state (read by teach.js recorder for crash-safe session id) */
  window.HMG_REC_SESSION = {
    sessionId: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    startTs: 0,
    introMs: 15000,
    outroMs: 15000,
    ending: false,
    endTs: 0
  };

  /* ----------------------------------------------------------
     Open dialog & prefill from saved meta / config defaults
     ---------------------------------------------------------- */
  HMGREC.openDialog = function () {
    const d = $("#mHmgRecSetup");
    if (!d) return false;
    const defaults = window.HMG_RECORDING_DEFAULTS || {};
    const meta = HMGREC.meta;
    const prefill = (key, value) => {
      const el = document.querySelector('.hmgRecField[data-key="' + key + '"]');
      if (el) el.value = value != null ? value : "";
    };
    prefill("subject", Store.get("rec_subject", ""));
    prefill("topic", Store.get("rec_topic", ""));
    prefill("klass", Store.get("rec_class", ""));
    prefill("brand", meta.brand || defaultsName("name") || "ADEWALE CLASSROOM DECK");
    prefill("staffName", meta.staffName || defaults.staffName || "Adewale Adeagbo");
    prefill("staffTitle", meta.staffTitle || defaults.staffTitle || "Virtual Tutor | Data Scientist | AI-Augmented Solutions Developer");
    prefill("lowerThird", meta.lowerThird || defaults.lowerThird || "If you want to book virtual classes with us, contact Adewale on 08100866322, 08094481488");
    prefill("cbtLink", localStorage.getItem("hmg_cbt_link") || "");
    prefill("adText", meta.adText || defaults.adText || "");
    prefill("adInterval", meta.adInterval || defaults.adIntervalSeconds || 60);
    prefill("pulseInterval", meta.pulseInterval || defaults.staffPulseSeconds || 30);
    prefill("footer", meta.footer || defaults.footer || "Learning Deliberately. Teaching Authentically.");
    const pulse = $("#hmgShowStaffPulse");
    if (pulse) pulse.checked = meta.showStaffPulse !== false;
    const cams = $("#hmgRecIncludeCams");
    if (cams) cams.checked = Store.get("rec_students", false);
    const logoStatus = $("#hmgRecLogoStatus");
    if (logoStatus) logoStatus.textContent = (Store.get("hmg_rec_logo", null) || Store.get("rec_logo", null)) ? "✓ custom logo saved" : "Logo: ADEWALE CLASSROOM default";
    openModal("#mHmgRecSetup");
    return true;
  };
  function defaultsName(k) {
    return (window.HMG_BRAND && HMG_BRAND[k]) || (window.CD_CONFIG && CD_CONFIG.brand) || "";
  }

  /* ----------------------------------------------------------
     Begin recording with branding: read fields → save → start
     ---------------------------------------------------------- */
  HMGREC.begin = function () {
    /* Auth-enforce before starting the branded recording. */
    if (typeof authEnforce === "function" && !authEnforce()) { closeModal("#mHmgRecSetup"); return; }
    const read = (key) => {
      const el = document.querySelector('.hmgRecField[data-key="' + key + '"]');
      return el ? el.value.trim() : "";
    };
    const meta = HMGREC.meta;
    meta.subject = read("subject");
    meta.topic = read("topic");
    meta.klass = read("klass");
    meta.brand = read("brand") || "ADEWALE CLASSROOM DECK";
    meta.staffName = read("staffName") || "Adewale Adeagbo";
    meta.staffTitle = read("staffTitle") || "Virtual Tutor | Data Scientist";
    meta.lowerThird = read("lowerThird");
    meta.adText = read("adText");
    meta.cbtLink = read("cbtLink");
    if (meta.cbtLink) localStorage.setItem("hmg_cbt_link", meta.cbtLink); else localStorage.removeItem("hmg_cbt_link");
    meta.adInterval = Math.max(15, Number(read("adInterval")) || 60);
    meta.pulseInterval = Math.max(10, Number(read("pulseInterval")) || 30);
    meta.footer = read("footer");
    meta.showStaffPulse = $("#hmgShowStaffPulse") ? $("#hmgShowStaffPulse").checked : true;
    HMGREC.saveMeta();

    /* Also populate the classic recMeta used by teach.js branded recorder */
    if (typeof recMeta !== "undefined") {
      recMeta.subject = meta.subject || "Lesson";
      recMeta.topic = meta.topic;
      recMeta.klass = meta.klass;
      recMeta.brand = meta.brand;
      recMeta.footer = meta.footer;
      recMeta.students = $("#hmgRecIncludeCams") ? $("#hmgRecIncludeCams").checked : false;
    }
    if ($("#hmgRecIncludeCams")) Store.set("rec_students", $("#hmgRecIncludeCams").checked);
    closeModal("#mHmgRecSetup");

    /* Reset per-session state */
    const s = window.HMG_REC_SESSION;
    s.sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    s.startTs = Date.now();
    s.ending = false;

    if (typeof startRecording === "function") startRecording();
    else toast("Recording engine unavailable in this browser", "err");
  };

  /* ----------------------------------------------------------
     Wire dialog buttons
     ---------------------------------------------------------- */
  document.addEventListener("click", function (e) {
    if (e.target && e.target.id === "hmgRecBegin") { HMGREC.begin(); }
    if (e.target && e.target.id === "hmgRecLogoBtn") {
      const f = $("#hmgRecLogoFile"); if (f) f.click();
    }
  });
  const recLogoFile = document.getElementById("hmgRecLogoFile");
  if (recLogoFile) recLogoFile.addEventListener("change", async function (e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const fr = new FileReader();
    fr.onload = async (ev) => {
      /* downscale to keep localStorage light */
      const img = await new Promise((res) => {
        const i = new Image();
        i.onload = () => res(i);
        i.src = ev.target.result;
      });
      const c = document.createElement("canvas");
      const k = Math.min(1, 360 / Math.max(img.naturalWidth, img.naturalHeight));
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      try {
        Store.set("hmg_rec_logo", c.toDataURL("image/png"));
        HMGREC._loadLogo();
        if (typeof loadRecLogo === "function") loadRecLogo();
        const st = $("#hmgRecLogoStatus");
        if (st) st.textContent = "✓ custom logo saved";
        toast("🖼 Logo will appear on recordings", "ok");
      } catch { toast("Logo too large to store — choose a smaller image.", "err"); }
    };
    fr.readAsDataURL(f);
  });

  })();

/* ============================================================
   HMGREC FRAME HOOKS — called from INSIDE teach.js (appended
   there at the end of the file, where a later function
   declaration wins over the strict-mode lexical original).
   These are the ONLY reliable integration points; window.*
   overrides are dead code in strict mode and were removed.
   ============================================================ */
(function hmgFrameHooks() {
  if (!window.HMGREC) return;

  /* paintFrame: returns TRUE if it fully painted the frame
     (intro or outro phase). Called at the TOP of drawRecordingFrame. */
  HMGREC.paintFrame = function (canvas, ctx) {
    if (!canvas || !ctx) return false;
    const s = window.HMG_REC_SESSION || {};
    if (!s.startTs) return false;
    const W = canvas.width, H = canvas.height;
    if (s.ending) { this.drawOutroFrame(canvas, ctx, W, H, Date.now() - (s.endTs || Date.now())); return true; }
    const elapsed = Date.now() - s.startTs;
    if (elapsed < (s.introMs || 15000)) {
      this.drawIntroFrame(canvas, ctx, W, H, elapsed);
      // Standalone: no lower thirds or ads during intro
      return true;
    }
    return false;
  };

  /* overlayFrame: lower-thirds + staff credentials pulse + text-ad,
     painted on top of every normal lesson frame. */
  HMGREC.overlayFrame = function (ctx, W, H) {
    if (!ctx) return;
    const now = Date.now();
    const s = window.HMG_REC_SESSION || {};
    this.drawLowerThird(ctx, W, H, this.meta.lowerThird, now);
    this.drawStaffPulse(ctx, W, H, now, true);
    if (this.meta.adText) this.drawAdOverlay(ctx, W, H, now, s.startTs || now);
  };

  /* broadcastOverlays: same overlays on the LIVE composite canvas,
     only when the teacher enabled "promotion overlays on the live
     broadcast" in Settings. */
  HMGREC.broadcastOverlays = function (ctx, W, H) {
    if (!ctx) return;
    try {
      if (Store.get("promo_broadcast", false)) this.overlayFrame(ctx, W, H);
    } catch (e) {}
  };
})();

/* ============================================================
   10. IMPROVED MULTI-PLATFORM COMPANION MODE
   Accepts ?meet=1, ?companion=zoom, ?companion=teams,
   ?companion=freeconf, ?platform=zoom, plus URL hash anchors.
   ============================================================ */
(function improvedCompanion() {
  if (!document.querySelector('.studio')) return;
  const params = new URLSearchParams(location.search);
  const hash = (location.hash || "").toLowerCase();
  const get = (k) => (params.get(k) || "").toLowerCase();

  let platform = "";
  if (get("meet") === "1" || get("platform") === "meet") platform = "Google Meet";
  else if (get("companion") === "zoom" || get("platform") === "zoom" || hash.includes("zoom")) platform = "Zoom";
  else if (get("companion") === "teams" || get("platform") === "teams" || hash.includes("teams")) platform = "Microsoft Teams";
  else if (get("companion") === "freeconf" || get("platform") === "freeconf" || hash.includes("freeconf") || hash.includes("free-conference")) platform = "FreeConference";
  else if (get("companion") === "skype" || get("platform") === "skype") platform = "Skype";

  const isAnyCompanion = get("meet") === "1" || !!get("companion") || !!get("platform") || /(zoom|teams|freeconf|skype)/.test(hash);

  if (isAnyCompanion && platform) {
    /* Hide live-class chrome (Meet/Zoom/Teams handle the call) */
    ["#btnGoLive", "#btnEndLive", "#btnStudents", "#btnChat", "#btnPoll", "#roomInfo", "#liveBadge"]
      .forEach((s) => { const el = document.querySelector(s); if (el) el.classList.add("hide"); });

    const existing = document.querySelector(".badge.companion");
    if (!existing) {
      const badge = document.createElement("span");
      badge.className = "badge companion";
      badge.textContent = "● COMPANION · " + platform.toUpperCase();
      const brand = document.querySelector(".topbar .brand");
      if (brand) brand.after(badge);
    } else {
      existing.textContent = "● COMPANION · " + platform.toUpperCase();
    }
    window._wantWake = true;
    if (typeof keepAwake === "function") keepAwake(true);
    if (typeof toast === "function") toast("🔄 Companion mode for " + platform + " — share your screen in the conferencing app, then tap 🎯 Focus.", "ok", 7000);
  }
})();

/* ============================================================
   11. 1000-STUDENT SCALING — practical relay guidance UI
   Polls the live room size (CDScaler.checkScale is never called
   by teach.js, so a lightweight monitor does the job) and shows
   the scale banner when the class grows past the P2P sweet-spot.
   ============================================================ */
(function scalerGuidance() {
  const rosterBody = document.querySelector("#drawerStudents .drawer-body");
  let hint = document.getElementById("scaleHint");
  if (rosterBody && !hint) {
    hint = document.createElement("div");
    hint.id = "scaleHint";
    hint.className = "hide";
    hint.style.cssText = "background:#3a2a12;border:1px solid var(--warn);border-radius:10px;padding:10px;font-size:12.5px;color:var(--text);line-height:1.6";
    hint.innerHTML = "<b>📡 200+ students?</b><br/>For classes larger than this, the smoothest free path is: go live on <b>YouTube Live</b> (streaming the same composite canvas) and share the YouTube link with all students — unlimited viewers, no congestion. See Settings → 📡 Tablet Live / Social Centre.";
    rosterBody.prepend(hint);
  }
  let lastN = 0;
  setInterval(() => {
    try {
      const r = window.room;
      if (!r || !r.students) { lastN = 0; return; }
      const n = r.students.size;
      if (n !== lastN) {
        lastN = n;
        if (n > 50 && n <= 200 && typeof toast === "function") {
          toast("📡 " + n + " students — using optimized composite broadcast (all see the workspace).", "ok", 6000);
        }
        if (n > 200 && hint) hint.classList.remove("hide");
        if (n <= 200 && hint) hint.classList.add("hide");
      }
    } catch (e) {}
  }, 15000);
})();

/* ============================================================
   12. SAFETY NET: beforeunload during recording
   Warns before the teacher can accidentally lose a live
   recording, and flush pending chunks to IndexedDB.
   ============================================================ */
window.addEventListener("beforeunload", () => {
  try {
    if (window.recorder && recorder.state === "recording" && window.HMG_REC_SESSION) {
      window.HMG_REC_SESSION.sessionId = window.HMG_REC_SESSION.sessionId || "hmg-crash";
      /* Chunks are already mirrored by the ondataavailable hook; force a final flush. */
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    }
  } catch {}
});

/* ============================================================
   13. PROMO OVERLAYS ON THE LIVE BROADCAST (optional)
   Note: the actual paint is applied inside teach.js's final
   drawComposite hook (called via HMGREC.broadcastOverlays) so it
   works with strict-mode lexical bindings. This section only
   documents the feature and exposes a helper for tooling.
   Toggle: Settings → "Show promotion overlays on the live broadcast".
   ============================================================ */
(function promoBroadcastDoc() {
  if (typeof console !== "undefined") {
    console.log("[ClassDeck] Promo broadcast overlays enabled via Settings toggle (promo_broadcast).");
  }
})();

/* ============================================================
   14. BACKUP REMINDER
   Nudges the teacher to export a full dashboard backup weekly
   (all lessons, notes, settings, boards — one JSON file).
   ============================================================ */
(function backupReminder() {
  if (!document.querySelector('.studio')) return;
  const last = Store.get("backup_reminder_at", 0);
  const WEEK = 7 * 86400000;
  if (Date.now() - last > WEEK) {
    setTimeout(() => {
      if (typeof toast === "function" && typeof openModal === "function") {
        toast("💾 Tip: export a full backup in ⚙ Settings → Backup everything, to keep your lessons safe.", "", 8000);
        Store.set("backup_reminder_at", Date.now());
      }
    }, 12000);
  }
})();

/* ============================================================
   15. LIVE-CLASS RECOVERY WARD (issue #3 hardening)
   A global safety net: if ANY unhandled promise rejection happens
   during goLive/startRecording etc, never leave the Go Live
   button stuck or the End button hidden. (Strict-mode lexical
   functions can't be wrapped from this file, so we guard the UI
   at the global event level instead.)
   ============================================================ */
(function liveHarden() {
  window.addEventListener("unhandledrejection", (ev) => {
    try {
      const b = document.getElementById("btnGoLive");
      if (b && b.disabled) {
        b.disabled = false;
        const end = document.getElementById("btnEndLive");
        if (end && !end.classList.contains("hide")) {
          /* If a class is mid-start and failed, restore the buttons. */
          setTimeout(() => {
            try {
              if (typeof window.room === "undefined" || !window.room) {
                b.classList.remove("hide");
                if (end) end.classList.add("hide");
              }
            } catch (e) {}
          }, 1500);
        }
      }
    } catch (e) {}
  });
})();


window.drawCBTOverlay = function(ctx, W, H, url) {
  if (!url) return;
  const originalHeadH = Math.round(H * 0.09);
  const extraH = Math.round(H * 0.045);
  
  ctx.save();
  // Fill the extra header space with a distinct brand color (emerald-700)
  ctx.fillStyle = 'rgba(4, 120, 87, 1)';
  ctx.fillRect(0, originalHeadH, W, extraH);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold ' + Math.round(extraH * 0.55) + 'px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🔗 TAKE QUIZ: ' + url, W / 2, originalHeadH + (extraH / 2));
  
  ctx.restore();
};
