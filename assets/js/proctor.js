/* Free-stack CBT proctor: tab blur, copy block, optional camera/audio. */
const Proctor = {
  SNAP_EVERY_MS: 60000,
  AUDIO_THRESHOLD: 0.22,
  AUDIO_SUSTAIN_MS: 2500,
  _stream: null, _video: null, _timer: null, _audioCtx: null,
  _loudSince: 0, active: false, violations: [],
  _onEvent: null,

  startGuards(cfg, onEvent) {
    cfg = cfg || {};
    this._onEvent = onEvent || function () {};
    this.violations = [];
    const log = (type, detail) => {
      this.violations.push({ type, detail, at: new Date().toISOString() });
      this._onEvent(type, detail);
    };
    if (cfg.block_copy !== false) {
      document.addEventListener('copy', e => { e.preventDefault(); log('copy', 'Copy blocked'); });
      document.addEventListener('cut', e => { e.preventDefault(); log('cut', 'Cut blocked'); });
      document.addEventListener('contextmenu', e => { e.preventDefault(); log('contextmenu', 'Right-click blocked'); });
    }
    if (cfg.tab_focus !== false) {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) log('tab_blur', 'Left the exam tab');
      });
      window.addEventListener('blur', () => log('window_blur', 'Window lost focus'));
    }
    if (cfg.fullscreen) {
      const el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen().catch(() => log('fullscreen_denied', 'Fullscreen not granted'));
      document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) log('fullscreen_exit', 'Left fullscreen');
      });
    }
    return this.violations;
  },

  async startMedia(cfg, examCode, studentNo, onEvent) {
    cfg = cfg || {};
    this._onEvent = onEvent || this._onEvent || function () {};
    if (!cfg.camera && !cfg.audio_monitor) return { camera: false, audio: false };
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({ video: !!cfg.camera, audio: !!cfg.audio_monitor });
    } catch (e) {
      this._onEvent('proctor_declined', e.message || 'permission denied');
      return { camera: false, audio: false, declined: true };
    }
    this.active = true;
    if (cfg.camera) {
      this._video = document.createElement('video');
      this._video.muted = true; this._video.playsInline = true;
      this._video.srcObject = this._stream;
      try { await this._video.play(); } catch (_) {}
      this._scheduleSnap();
    }
    if (cfg.audio_monitor) this._watchAudio();
    this._onEvent('proctor_started', (cfg.camera ? 'camera ' : '') + (cfg.audio_monitor ? 'audio' : ''));
    return { camera: !!cfg.camera, audio: !!cfg.audio_monitor };
  },

  _scheduleSnap() {
    if (!this.active) return;
    this._timer = setTimeout(async () => {
      await this.snap();
      this._scheduleSnap();
    }, this.SNAP_EVERY_MS + Math.random() * 15000);
  },
  async snap() {
    if (!this._video) return;
    const c = document.createElement('canvas');
    c.width = 320; c.height = 180;
    c.getContext('2d').drawImage(this._video, 0, 0, 320, 180);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.6));
    if (!blob || !window.sb) return;
    const path = 'snaps/' + Date.now() + '.jpg';
    try { await window.sb.storage.from('proctor').upload(path, blob, { contentType: 'image/jpeg' }); }
    catch (_) {}
  },
  _watchAudio() {
    try {
      this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = this._audioCtx.createMediaStreamSource(this._stream);
      const analyser = this._audioCtx.createAnalyser();
      src.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const loop = () => {
        if (!this.active) return;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / data.length);
        if (rms > this.AUDIO_THRESHOLD) {
          if (!this._loudSince) this._loudSince = Date.now();
          if (Date.now() - this._loudSince > this.AUDIO_SUSTAIN_MS) {
            this._onEvent('audio_talk', 'Sustained noise / talking');
            this._loudSince = Date.now() + 8000;
          }
        } else this._loudSince = 0;
        requestAnimationFrame(loop);
      };
      loop();
    } catch (_) {}
  },
  stop() {
    this.active = false;
    clearTimeout(this._timer);
    if (this._stream) this._stream.getTracks().forEach(t => t.stop());
    if (this._audioCtx) try { this._audioCtx.close(); } catch (_) {}
  }
};
window.Proctor = Proctor;
