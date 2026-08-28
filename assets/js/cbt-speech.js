/* ============================================================================
   cbt-speech.js — V39 · read-aloud for CBT candidates
   ----------------------------------------------------------------------------
   REQUIREMENT
   "The platform must be able to read questions and options to students during
    a CBT, if they desire. Only free-based tools."

   WHY Web Speech API
   speechSynthesis ships inside every modern browser (Chrome, Edge, Safari,
   Firefox, Android WebView, iOS WKWebView). It uses the voices already on the
   device, needs no key, no account, no network on most platforms, and costs
   nothing per character. That is the only option consistent with this
   platform's zero-cost design law. There is no paid TTS fallback and no CDN.

   WHAT IT READS
   Never the raw cell — always CBTRich.plain(), so "\frac{3x+6}{9}" is spoken
   as "the fraction 3x plus 6, over 9". A candidate who cannot see the screen
   well still receives the same question a sighted candidate reads.

   EXAM INTEGRITY
   - Speech is candidate-initiated and per-question; nothing autoplays.
   - Reading is cancelled on question change, on submit, and on tab blur, so
     audio can never leak from a question the candidate has left.
   - The utterance is built from question + options only. Explanations and
     correct answers are never queued during a live exam; they are only
     available on the review page after grading.

   ACCESSIBILITY
   The toggle is a real <button> with aria-pressed, keyboard shortcut is
   Alt+R (read) / Alt+S (stop), and the current sentence is mirrored into an
   aria-live region for screen readers that prefer their own voice.

   API
     CBTSpeech.available()             -> boolean
     CBTSpeech.mount(container, opts)  -> inject the control bar
     CBTSpeech.readQuestion(q)         -> speak a normalized question object
     CBTSpeech.speak(text)             -> speak arbitrary text
     CBTSpeech.stop()                  -> cancel everything
     CBTSpeech.setEnabled(bool)        -> master switch (exam setting)
     CBTSpeech.prefs                   -> {rate, pitch, voiceURI, enabled}
   ========================================================================== */
(function (w, d) {
  'use strict';

  if (w.CBTSpeech) return;

  var SS  = w.speechSynthesis;
  var SSU = w.SpeechSynthesisUtterance;
  var KEY = 'tc_cbt_speech_prefs';

  var prefs = { rate: 0.95, pitch: 1, volume: 1, voiceURI: '', enabled: true };
  try {
    var saved = JSON.parse(w.localStorage.getItem(KEY) || '{}');
    Object.keys(saved).forEach(function (k) { if (k in prefs) prefs[k] = saved[k]; });
  } catch (e) { /* private mode — defaults are fine */ }

  function save() {
    try { w.localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) {}
  }

  function available() { return !!(SS && SSU); }

  /* ------------------------------------------------------------------ *
   * Voice list. Chrome populates voices asynchronously, so we cache and *
   * refresh on the voiceschanged event rather than reading once.        *
   * ------------------------------------------------------------------ */
  var voices = [];
  function loadVoices() {
    if (!available()) return;
    try { voices = SS.getVoices() || []; } catch (e) { voices = []; }
  }
  if (available()) {
    loadVoices();
    if (typeof SS.addEventListener === 'function') SS.addEventListener('voiceschanged', function () {
      loadVoices(); refreshVoiceSelect();
    });
    else SS.onvoiceschanged = function () { loadVoices(); refreshVoiceSelect(); };
  }

  /* Prefer an English voice; prefer a local (offline) one so a candidate on a
     weak Lagos connection is not waiting on a network round trip mid-exam. */
  function pickVoice() {
    if (!voices.length) loadVoices();
    if (!voices.length) return null;
    if (prefs.voiceURI) {
      for (var i = 0; i < voices.length; i++) if (voices[i].voiceURI === prefs.voiceURI) return voices[i];
    }
    var en = voices.filter(function (v) { return /^en(-|_|$)/i.test(v.lang || ''); });
    var pool = en.length ? en : voices;
    var local = pool.filter(function (v) { return v.localService; });
    return (local[0] || pool[0]);
  }

  /* ------------------------------------------------------------------ *
   * Queue. Long questions are split at sentence boundaries: several     *
   * engines truncate or stall on utterances over ~200 characters, and a *
   * chunked queue also makes stop() instant.                            *
   * ------------------------------------------------------------------ */
  var queue = [], speaking = false, liveEl = null;

  function chunk(text, max) {
    max = max || 180;
    /* Sentence split WITHOUT lookbehind: Safari below 16.4 throws a syntax
       error on (?<=...) at parse time, which would kill this whole file. */
    function splitAfter(str, chars) {
      var res = [], cur = '';
      for (var i = 0; i < str.length; i++) {
        var ch = str.charAt(i);
        cur += ch;
        if (chars.indexOf(ch) > -1 && /\s/.test(str.charAt(i + 1) || ' ')) {
          res.push(cur); cur = '';
        }
      }
      if (cur) res.push(cur);
      return res.map(function (x) { return x.trim(); }).filter(Boolean);
    }
    var parts = splitAfter(String(text), '.;:?!'), out = [], buf = '';
    if (parts.length === 1 && text.length > max) parts = splitAfter(String(text), ',');
    parts.forEach(function (p) {
      if (!p) return;
      if ((buf + ' ' + p).trim().length > max && buf) { out.push(buf.trim()); buf = p; }
      else buf = (buf ? buf + ' ' : '') + p;
    });
    if (buf.trim()) out.push(buf.trim());
    /* hard-split anything still oversized */
    var final = [];
    out.forEach(function (p) {
      while (p.length > max * 2) { final.push(p.slice(0, max * 2)); p = p.slice(max * 2); }
      final.push(p);
    });
    return final.filter(Boolean);
  }

  function next() {
    if (!queue.length) { speaking = false; setBtnState(false); return; }
    var text = queue.shift();
    var u = new SSU(text);
    var v = pickVoice();
    if (v) { u.voice = v; u.lang = v.lang || 'en-US'; } else { u.lang = 'en-US'; }
    u.rate = Math.min(2, Math.max(0.5, Number(prefs.rate) || 0.95));
    u.pitch = Math.min(2, Math.max(0, Number(prefs.pitch) || 1));
    u.volume = Math.min(1, Math.max(0, Number(prefs.volume) == null ? 1 : Number(prefs.volume)));
    if (liveEl) liveEl.textContent = text;
    u.onend = function () { next(); };
    u.onerror = function () { next(); };   /* never let one bad chunk hang the queue */
    try { SS.speak(u); } catch (e) { next(); }
  }

  function speak(text) {
    if (!available() || !prefs.enabled) return false;
    var t = String(text || '').trim();
    if (!t) return false;
    stop();
    queue = chunk(t);
    speaking = true;
    setBtnState(true);
    /* Chrome bug: speechSynthesis can be left in a paused state by a prior
       cancel(). resume() is a no-op when it is not paused. */
    try { SS.resume(); } catch (e) {}
    next();
    return true;
  }

  function stop() {
    queue = [];
    speaking = false;
    setBtnState(false);
    if (!available()) return;
    try { SS.cancel(); } catch (e) {}
    if (liveEl) liveEl.textContent = '';
  }

  function toggle(text) {
    if (speaking) { stop(); return false; }
    return speak(text);
  }

  /* ------------------------------------------------------------------ *
   * Building the spoken script for a normalized question object.        *
   * ------------------------------------------------------------------ */
  var LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  function plain(x) {
    return (w.CBTRich && w.CBTRich.plain) ? w.CBTRich.plain(x)
         : String(x == null ? '' : x).replace(/\\n/g, '. ');
  }

  function scriptFor(q, opts) {
    opts = opts || {};
    var out = [];
    if (q.passage && opts.includePassage !== false) {
      out.push('Read the following passage.');
      out.push(plain(q.passage));
      out.push('Now the question.');
    }
    if (q.question) out.push(plain(q.question));

    var o = q.options || q.choices || [];
    if (o.length) {
      out.push('The options are.');
      o.forEach(function (op, i) {
        var txt = (op && typeof op === 'object') ? (op.text != null ? op.text : op.label) : op;
        out.push('Option ' + (LETTERS[i] || (i + 1)) + '. ' + plain(txt) + '.');
      });
    }
    if (q.type === 'numeric' || q.type === 'multi_numeric') {
      if (q.unit) out.push('Give your answer in ' + plain(q.unit) + '.');
      if (q.tolerance) out.push('A tolerance of ' + q.tolerance + ' is allowed.');
    }
    if (q.media_url && !o.length) out.push('This question has an accompanying image or diagram on screen.');
    return out.join(' ');
  }

  function readQuestion(q, opts) { return speak(scriptFor(q, opts)); }

  /* ------------------------------------------------------------------ *
   * UI                                                                  *
   * ------------------------------------------------------------------ */
  var btn = null, panel = null, sel = null;

  function setBtnState(on) {
    if (!btn) return;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.classList.toggle('is-speaking', !!on);
    btn.querySelector('.tcs-label').textContent = on ? 'Stop reading' : 'Read aloud';
    btn.querySelector('.tcs-ico').textContent = on ? '⏹' : '🔊';
  }

  function refreshVoiceSelect() {
    if (!sel) return;
    var cur = prefs.voiceURI;
    sel.innerHTML = '<option value="">Device default</option>' +
      voices.map(function (v) {
        return '<option value="' + String(v.voiceURI).replace(/"/g, '&quot;') + '">' +
               String(v.name).replace(/</g, '&lt;') + ' (' + (v.lang || '') + ')' +
               (v.localService ? ' · offline' : '') + '</option>';
      }).join('');
    sel.value = cur || '';
  }

  var CSS = [
    '.tcs-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0}',
    '.tcs-btn{display:inline-flex;align-items:center;gap:7px;padding:8px 14px;border-radius:999px;',
      'border:1.5px solid var(--line,#cbd5e1);background:var(--card,#fff);color:inherit;',
      'font:inherit;font-size:.92rem;cursor:pointer;transition:.15s}',
    '.tcs-btn:hover{border-color:var(--brand,#2563eb)}',
    '.tcs-btn.is-speaking{background:var(--brand,#2563eb);color:#fff;border-color:transparent}',
    '.tcs-btn .tcs-ico{font-size:1.05em;line-height:1}',
    '.tcs-cog{border:none;background:none;cursor:pointer;font-size:1.05rem;opacity:.65;padding:4px}',
    '.tcs-cog:hover{opacity:1}',
    '.tcs-panel{display:none;gap:10px;align-items:center;flex-wrap:wrap;width:100%;',
      'padding:10px 12px;border:1px dashed var(--line,#cbd5e1);border-radius:10px;font-size:.85rem}',
    '.tcs-panel.open{display:flex}',
    '.tcs-panel label{display:flex;align-items:center;gap:6px}',
    '.tcs-panel select,.tcs-panel input[type=range]{font:inherit;font-size:.85rem;max-width:210px}',
    '.tcs-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '.tcs-none{font-size:.85rem;opacity:.7}'
  ].join('');

  function injectCSS() {
    if (d.getElementById('tcs-style')) return;
    var st = d.createElement('style');
    st.id = 'tcs-style';
    st.textContent = CSS;
    (d.head || d.documentElement).appendChild(st);
  }

  /* mount(container, {getQuestion: fn}) — getQuestion returns the question
     object currently on screen, so the bar always reads the right card. */
  function mount(container, opts) {
    opts = opts || {};
    if (!container) return null;
    injectCSS();
    if (container.querySelector('.tcs-bar')) return container.querySelector('.tcs-bar');

    var bar = d.createElement('div');
    bar.className = 'tcs-bar';

    if (!available()) {
      bar.innerHTML = '<span class="tcs-none">🔇 Read-aloud is not supported by this browser. ' +
                      'Try Chrome, Edge or Safari.</span>';
      container.appendChild(bar);
      return bar;
    }

    bar.innerHTML =
      '<button type="button" class="tcs-btn" aria-pressed="false" ' +
        'title="Read this question aloud (Alt+R)">' +
        '<span class="tcs-ico" aria-hidden="true">🔊</span>' +
        '<span class="tcs-label">Read aloud</span></button>' +
      '<button type="button" class="tcs-cog" title="Voice settings" aria-label="Voice settings">⚙</button>' +
      '<div class="tcs-panel">' +
        '<label>Voice <select class="tcs-voice"></select></label>' +
        '<label>Speed <input class="tcs-rate" type="range" min="0.6" max="1.6" step="0.05"></label>' +
        '<span class="tcs-rateval"></span>' +
        '<button type="button" class="tcs-btn tcs-test">Test voice</button>' +
      '</div>' +
      '<span class="tcs-live" aria-live="polite" role="status"></span>';

    container.appendChild(bar);

    btn    = bar.querySelector('.tcs-btn');
    panel  = bar.querySelector('.tcs-panel');
    sel    = bar.querySelector('.tcs-voice');
    liveEl = bar.querySelector('.tcs-live');
    var rate = bar.querySelector('.tcs-rate');
    var rval = bar.querySelector('.tcs-rateval');

    rate.value = prefs.rate;
    rval.textContent = Number(prefs.rate).toFixed(2) + '×';
    refreshVoiceSelect();

    btn.addEventListener('click', function () {
      if (speaking) { stop(); return; }
      var q = opts.getQuestion ? opts.getQuestion() : null;
      if (q) readQuestion(q, opts);
      else if (opts.getText) speak(opts.getText());
    });
    bar.querySelector('.tcs-cog').addEventListener('click', function () {
      panel.classList.toggle('open');
    });
    sel.addEventListener('change', function () { prefs.voiceURI = sel.value; save(); });
    rate.addEventListener('input', function () {
      prefs.rate = Number(rate.value);
      rval.textContent = prefs.rate.toFixed(2) + '×';
      save();
    });
    bar.querySelector('.tcs-test').addEventListener('click', function () {
      speak('This is how the questions will be read to you. Option A. The fraction 3 x plus 6, over 9.');
    });

    return bar;
  }

  /* Keyboard shortcuts — Alt+R read, Alt+S stop. Never plain keys: the
     candidate is typing answers. */
  d.addEventListener('keydown', function (e) {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    var k = String(e.key || '').toLowerCase();
    if (k === 'r' && btn) { e.preventDefault(); btn.click(); }
    if (k === 's') { e.preventDefault(); stop(); }
  });

  /* Integrity: never let audio outlive the question or the exam. */
  d.addEventListener('visibilitychange', function () { if (d.hidden) stop(); });
  w.addEventListener('pagehide', stop);
  w.addEventListener('beforeunload', stop);

  w.CBTSpeech = {
    available: available,
    mount: mount,
    speak: speak,
    stop: stop,
    toggle: toggle,
    readQuestion: readQuestion,
    scriptFor: scriptFor,
    isSpeaking: function () { return speaking; },
    setEnabled: function (b) { prefs.enabled = !!b; if (!b) stop(); save(); },
    voices: function () { return voices.slice(); },
    prefs: prefs
  };

})(window, document);
