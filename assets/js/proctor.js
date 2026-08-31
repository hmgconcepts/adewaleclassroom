/* Free-stack CBT proctor: tab blur, copy block, optional camera/audio. */
const Proctor = {
  SNAP_EVERY_MS: 60000,
  AUDIO_THRESHOLD: 0.22,
  AUDIO_SUSTAIN_MS: 2500,
  _stream: null, _video: null, _timer: null, _audioCtx: null,
  _loudSince: 0, active: false, violations: [],
  _onEvent: null,
  _listeners: [],

  startGuards(cfg, onEvent) {
    cfg = cfg || {};
    this._onEvent = onEvent || function () {};
    this.violations = [];
    this.active = true;
    const log = (type, detail) => {
      if (!this.active) return;
      this.violations.push({ type, detail, at: new Date().toISOString() });
      this._onEvent(type, detail);
    };
    
    this._listeners = [];
    const bind = (target, event, handler) => {
      target.addEventListener(event, handler);
      this._listeners.push({ target, event, handler });
    };

    if (cfg.block_copy !== false) {
      bind(document, 'copy', e => { if(!this.active) return; e.preventDefault(); log('copy', 'Copy blocked'); });
      bind(document, 'cut', e => { if(!this.active) return; e.preventDefault(); log('cut', 'Cut blocked'); });
      bind(document, 'contextmenu', e => { if(!this.active) return; e.preventDefault(); log('contextmenu', 'Right-click blocked'); });
    }
    if (cfg.tab_focus !== false) {
      bind(document, 'visibilitychange', () => {
        if (!this.active) return;
        if (document.hidden) log('tab_blur', 'Left the exam tab');
      });
      bind(window, 'blur', () => { if(!this.active) return; log('window_blur', 'Window lost focus'); });
    }
    if (cfg.fullscreen) {
      const el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen().catch(() => { if(this.active) log('fullscreen_denied', 'Fullscreen not granted'); });
      bind(document, 'fullscreenchange', () => {
        if (!this.active) return;
        if (!document.fullscreenElement) log('fullscreen_exit', 'Left fullscreen');
      });
    }
    return this.violations;
  },

  async startMedia(cfg, examCode, studentNo, onEvent) {
    cfg = cfg || {};
    this._onEvent = onEvent || this._onEvent || function () {};
    if (!cfg.camera && !cfg.audio_monitor) return { camera: false, audio: false };
    var got = { camera: false, audio: false };
    var audioError, videoError;

    if (cfg.audio_monitor) {
      try {
        var aStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this._stream = aStream; got.audio = true;
      } catch (e) { audioError = (e && e.message) || 'audio not available'; }
    }
    if (cfg.camera) {
      try {
        var vStream = await navigator.mediaDevices.getUserMedia({ video: true });
        this._videoStream = vStream;
        if (!this._stream) this._stream = vStream;
        else this._audioCtx = this._stream;
        got.camera = true;
      } catch (e) { videoError = (e && e.message) || 'camera not available'; }
    }
    if (!got.camera && !got.audio) {
      this._onEvent('proctor_declined', audioError || videoError || 'permission denied');
      return { camera: false, audio: false, declined: true };
    }
    this.active = true;
    if (got.camera && this._videoStream) {
      this._video = document.createElement('video');
      this._video.muted = true; this._video.playsInline = true;
      this._video.srcObject = this._stream || this._videoStream;
      try { await this._video.play(); } catch (_) {}
      this._scheduleSnap();
    }
    if (got.audio && this._stream) this._watchAudio();
    if (videoError) this._onEvent('proctor_camera_off', videoError);
    if (audioError) this._onEvent('proctor_audio_off', audioError);
    this._onEvent('proctor_started', (got.camera ? 'camera ' : '') + (got.audio ? 'audio' : '') +
      (videoError || audioError ? ' (partial)' : ''));
    return { camera: got.camera, audio: got.audio,  declined: videoError || audioError };
  },

  _scheduleSnap() {
    if (!this.active) return;
    this._timer = setTimeout(async () => {
      await this.snap();
      this._scheduleSnap();
    }, this.SNAP_EVERY_MS + Math.random() * 15000);
  },

  async snap() {
    if (!this._video || !this.active) return;
    try {
      const c = document.createElement('canvas');
      c.width = 160; c.height = 90;
      const ctx = c.getContext('2d');
      ctx.drawImage(this._video, 0, 0, c.width, c.height);
      const px = ctx.getImageData(0, 0, c.width, c.height).data;
      let sum = 0;
      for (let i = 0; i < px.length; i += 4) sum += (px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722);
      const mean = sum / (px.length / 4);
      
      let msg = mean < 12 ? 'Camera appears covered or dark' : 'Frame captured (not stored)';
      let faces = -1;
      
      if (window.FaceDetector) {
         try {
           const fd = new FaceDetector({ fastMode: true });
           const detected = await fd.detect(c);
           faces = detected.length;
           if (faces === 0 && mean >= 12) msg = 'No face detected in frame';
           else if (faces > 1) msg = 'Multiple faces detected in frame';
         } catch(e) {}
      }

      this.violations.push({
        type: 'camera_frame',
        detail: msg,
        luminance: Math.round(mean),
        faces: faces,
        at: new Date().toISOString()
      });
    } catch (_) {}
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
    if (this._listeners && this._listeners.length) {
      this._listeners.forEach(l => l.target.removeEventListener(l.event, l.handler));
      this._listeners = [];
    }
    if (this._stream) this._stream.getTracks().forEach(t => t.stop());
    if (this._videoStream && this._videoStream !== this._stream) this._videoStream.getTracks().forEach(t => t.stop());
    if (this._audioCtx) try { this._audioCtx.close(); } catch (_) {}
  }
};
window.Proctor = Proctor;
