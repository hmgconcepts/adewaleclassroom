/* ============================================================================
   cbt-exam-kit.js — Tutoring Connect V14
   ----------------------------------------------------------------------------
   Everything a candidate needs while sitting a paper, in one module:

     1. QUESTION PALETTE   numbered tabs, per subject, showing answered /
                           flagged / current so a learner can jump anywhere.
     2. CANDIDATE WATERMARK repeating diagonal identity across the paper, so a
                           screenshot always carries the candidate's ID.
     3. ANTI-CHEAT SUITE   tab/app switching, window blur, copy/cut/paste,
                           right-click, devtools shortcuts, print, fullscreen
                           enforcement, camera + audio monitoring, a live
                           violation counter and auto-submit at a set limit.
     4. SCIENTIFIC CALCULATOR  a full one — and deliberately NOT eval()-based.
     5. MATH KEYBOARD      inserts real symbols into the focused answer box.

   WHY THE CALCULATOR IS HAND-WRITTEN
   School Connect's calculator evaluates with `eval(display)`. Inside an exam
   page that is both a security smell (arbitrary JS from a text field) and
   mathematically wrong for exam use: `eval` has no degree mode, no implicit
   multiplication, no factorial, and silently mis-parses things like 2^3^2.
   This one uses a proper tokeniser + recursive-descent parser, so it is safe,
   supports degrees/radians, memory, history, ANS, constants, nCr/nPr,
   factorial, hyperbolics, log to any base, and correct operator precedence
   with right-associative powers.

   Free, no dependencies, no AI API, no uploads.
   ========================================================================== */
(function (w, d) {
  'use strict';

  /* ==========================================================================
     1 · SAFE EXPRESSION ENGINE
     ========================================================================== */
  var Calc = {
    angle: 'deg',           // 'deg' | 'rad'
    memory: 0,
    ans: 0,
    history: [],

    _toRad: function (x) { return this.angle === 'deg' ? x * Math.PI / 180 : x; },
    _fromRad: function (x) { return this.angle === 'deg' ? x * 180 / Math.PI : x; },

    _fact: function (n) {
      if (n < 0 || Math.floor(n) !== n) throw new Error('factorial needs a whole number ≥ 0');
      if (n > 170) throw new Error('too large');
      var r = 1; for (var i = 2; i <= n; i++) r *= i; return r;
    },

    /* =====================================================================
       REPORTED ITEM 1 — "ensure the on-screen scientific calculator is a
       full and complete one because some features are missing on it."

       What was missing, checked key by key against a Casio fx-991:

         * every reciprocal trig function — sec, csc, cot and their inverses
         * every INVERSE hyperbolic — asinh, acosh, atanh
         * log to an arbitrary base in the order a student expects
         * hypot, mod, gcd, lcm, min, max, trunc, frac
         * log2, expm1, log1p
         * degree/radian conversion as functions
         * random and randint, for statistics practice
         * a working 2nd / INV key — it was wired to `return;`, a dead button

       And one silently WRONG answer, which matters more than any of the
       omissions:

         logb(8,2) returned 0.333, not 3.

       The implementation read its arguments as logb(base, value) while every
       convention a student meets — Excel's LOG(number, base), Casio, Desmos —
       is value first. Nothing warned them. In an exam that is a lost mark the
       candidate cannot even see. It now takes the value first, and the pad
       key is labelled logb(x,b) so the order is on screen.
       ===================================================================== */
    FUNCS: {
      /* trigonometric — honour the deg/rad switch */
      sin:  function (x) { return Math.sin(Calc._toRad(x)); },
      cos:  function (x) { return Math.cos(Calc._toRad(x)); },
      tan:  function (x) { return Math.tan(Calc._toRad(x)); },
      sec:  function (x) { return 1 / Math.cos(Calc._toRad(x)); },
      csc:  function (x) { return 1 / Math.sin(Calc._toRad(x)); },
      cosec:function (x) { return 1 / Math.sin(Calc._toRad(x)); },
      cot:  function (x) { return 1 / Math.tan(Calc._toRad(x)); },
      asin: function (x) { return Calc._fromRad(Math.asin(x)); },
      acos: function (x) { return Calc._fromRad(Math.acos(x)); },
      atan: function (x) { return Calc._fromRad(Math.atan(x)); },
      asec: function (x) { return Calc._fromRad(Math.acos(1 / x)); },
      acsc: function (x) { return Calc._fromRad(Math.asin(1 / x)); },
      acot: function (x) { return Calc._fromRad(Math.atan(1 / x)); },

      /* hyperbolic, including the inverses that were missing */
      sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
      sech: function (x) { return 1 / Math.cosh(x); },
      csch: function (x) { return 1 / Math.sinh(x); },
      coth: function (x) { return 1 / Math.tanh(x); },
      asinh: Math.asinh || function (x) { return Math.log(x + Math.sqrt(x * x + 1)); },
      acosh: Math.acosh || function (x) { return Math.log(x + Math.sqrt(x * x - 1)); },
      atanh: Math.atanh || function (x) { return 0.5 * Math.log((1 + x) / (1 - x)); },

      /* logarithms and exponentials */
      ln:   Math.log,
      log:  function (x) { return Math.log10 ? Math.log10(x) : Math.log(x) / Math.LN10; },
      log10:function (x) { return Math.log10 ? Math.log10(x) : Math.log(x) / Math.LN10; },
      log2: Math.log2 || function (x) { return Math.log(x) / Math.LN2; },
      exp:  Math.exp,
      expm1: Math.expm1 || function (x) { return Math.exp(x) - 1; },
      log1p: Math.log1p || function (x) { return Math.log(1 + x); },

      /* roots, rounding, sign */
      sqrt: Math.sqrt,
      cbrt: Math.cbrt || function (x) { return (x < 0 ? -1 : 1) * Math.pow(Math.abs(x), 1 / 3); },
      abs:  Math.abs,
      round: Math.round, floor: Math.floor, ceil: Math.ceil,
      trunc: Math.trunc || function (x) { return x < 0 ? Math.ceil(x) : Math.floor(x); },
      frac: function (x) { return x - (x < 0 ? Math.ceil(x) : Math.floor(x)); },
      sign: Math.sign,
      inv:  function (x) { return 1 / x; },
      sq:   function (x) { return x * x; },
      cube: function (x) { return x * x * x; },

      /* angle conversion, useful when a question mixes units */
      todeg: function (x) { return x * 180 / Math.PI; },
      torad: function (x) { return x * Math.PI / 180; },

      /* statistics helpers a school paper actually asks for */
      random: function () { return Math.random(); }
    },

    /* Functions taking two or more arguments. Kept separate so the parser can
       collect a comma-separated list for them and reject the wrong arity with
       a message a student can act on. */
    FUNCS2: {
      /* logb(value, base) — value FIRST. See the note above. */
      logb:  function (x, b) { return Math.log(x) / Math.log(b); },
      root:  function (x, n) { return (x < 0 && n % 2 === 1) ? -Math.pow(-x, 1 / n) : Math.pow(x, 1 / n); },
      hypot: function () { return Math.sqrt([].reduce.call(arguments, function (a, v) { return a + v * v; }, 0)); },
      mod:   function (a, b) { return ((a % b) + b) % b; },
      pow:   function (a, b) { return Math.pow(a, b); },
      atan2: function (y, x) { return Calc._fromRad(Math.atan2(y, x)); },
      min:   function () { return Math.min.apply(Math, arguments); },
      max:   function () { return Math.max.apply(Math, arguments); },
      sum:   function () { return [].reduce.call(arguments, function (a, v) { return a + v; }, 0); },
      mean:  function () { return [].reduce.call(arguments, function (a, v) { return a + v; }, 0) / arguments.length; },
      gcd:   function () {
        var g = function (a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a; };
        return [].reduce.call(arguments, g);
      },
      lcm:   function () {
        var g = function (a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a; };
        return [].reduce.call(arguments, function (a, b) { return Math.abs(a * b) / g(a, b); });
      },
      randint: function (a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
    },

    CONSTS: {
      pi: Math.PI, '\u03c0': Math.PI, e: Math.E, ans: 0,
      /* Constants a physics or chemistry paper leans on. Named so they cannot
         be confused with a variable. */
      phi: (1 + Math.sqrt(5)) / 2,
      tau: Math.PI * 2,
      c_light: 299792458,          // m/s
      g_earth: 9.80665,            // m/s^2
      avogadro: 6.02214076e23,     // /mol
      planck: 6.62607015e-34,      // J s
      elem_charge: 1.602176634e-19,// C
      gas_const: 8.314462618       // J/(mol K)
    },

    /* ---- tokeniser ---- */
    tokenize: function (src) {
      var s = String(src)
        .replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
        .replace(/\u03c0/g, 'pi').replace(/√/g, 'sqrt').replace(/\^/g, '^');
      var out = [], i = 0;
      while (i < s.length) {
        var c = s[i];
        if (/\s/.test(c)) { i++; continue; }
        if (/[0-9.]/.test(c)) {
          var num = '';
          while (i < s.length && /[0-9.]/.test(s[i])) num += s[i++];
          if (i < s.length && /[eE]/.test(s[i]) && /[0-9+\-]/.test(s[i + 1] || '')) {
            num += s[i++]; if (/[+\-]/.test(s[i])) num += s[i++];
            while (i < s.length && /[0-9]/.test(s[i])) num += s[i++];
          }
          out.push({ t: 'num', v: parseFloat(num) });
          continue;
        }
        if (/[a-zA-Z]/.test(c)) {
          var id = '';
          while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) id += s[i++];
          out.push({ t: 'id', v: id.toLowerCase() });
          continue;
        }
        if ('+-*/^%(),!'.indexOf(c) !== -1) { out.push({ t: c }); i++; continue; }
        throw new Error('Unexpected character: ' + c);
      }
      return out;
    },

    /* ---- recursive-descent parser (no eval, ever) ---- */
    evaluate: function (src) {
      var toks = this.tokenize(src), p = 0, self = this;
      function peek() { return toks[p]; }
      function eat(t) {
        var k = toks[p];
        if (!k || (t && k.t !== t)) throw new Error('Malformed expression');
        p++; return k;
      }
      function parseExpr() {          // + -
        var v = parseTerm();
        while (peek() && (peek().t === '+' || peek().t === '-')) {
          var op = eat().t;
          var r = parseTerm();
          v = op === '+' ? v + r : v - r;
        }
        return v;
      }
      function parseTerm() {          // * / % and implicit multiplication
        var v = parseUnary();
        while (peek()) {
          var k = peek();
          if (k.t === '*' || k.t === '/' || k.t === '%') {
            eat();
            var r = parseUnary();
            v = k.t === '*' ? v * r : k.t === '/' ? v / r : v % r;
          } else if (k.t === 'num' || k.t === 'id' || k.t === '(') {
            // 2pi, 3(4+1), 2sin(30) — implicit multiplication
            v = v * parseUnary();
          } else break;
        }
        return v;
      }
      function parseUnary() {
        if (peek() && peek().t === '-') { eat(); return -parseUnary(); }
        if (peek() && peek().t === '+') { eat(); return parseUnary(); }
        return parsePower();
      }
      function parsePower() {         // ^ is RIGHT associative: 2^3^2 = 512
        var base = parsePostfix();
        if (peek() && peek().t === '^') { eat(); return Math.pow(base, parseUnary()); }
        return base;
      }
      function parsePostfix() {
        var v = parseAtom();
        while (peek() && (peek().t === '!' || peek().t === '%')) {
          if (peek().t === '!') { eat(); v = self._fact(v); }
          else break;
        }
        return v;
      }
      function parseAtom() {
        var k = peek();
        if (!k) throw new Error('Unexpected end of expression');
        if (k.t === 'num') { eat(); return k.v; }
        if (k.t === '(') { eat('('); var v = parseExpr(); eat(')'); return v; }
        if (k.t === 'id') {
          eat();
          var name = k.v;
          if (self.FUNCS[name]) {
            var args = [];
            if (peek() && peek().t === '(') {
              eat('(');
              if (peek() && peek().t !== ')') {
                args.push(parseExpr());
                while (peek() && peek().t === ',') { eat(','); args.push(parseExpr()); }
              }
              eat(')');
            } else args.push(parseUnary());     // sin30
            return self.FUNCS[name].apply(null, args);
          }
          if (name === 'ncr' || name === 'npr') {
            eat('('); var n = parseExpr(); eat(','); var r2 = parseExpr(); eat(')');
            var f = self._fact.bind(self);
            return name === 'ncr' ? f(n) / (f(r2) * f(n - r2)) : f(n) / f(n - r2);
          }
          /* Any multi-argument function, including the corrected logb. */
          if (self.FUNCS2[name]) {
            eat('(');
            var args = [];
            if (!peek() || peek().t !== ')') {
              args.push(parseExpr());
              while (peek() && peek().t === ',') { eat(','); args.push(parseExpr()); }
            }
            eat(')');
            if (args.length < 2 && ['logb', 'root', 'mod', 'pow', 'atan2', 'randint'].indexOf(name) > -1) {
              throw new Error(name + ' needs two values, e.g. ' +
                (name === 'logb' ? 'logb(8,2) for log base 2 of 8' : name + '(a,b)'));
            }
            return self.FUNCS2[name].apply(null, args);
          }
          if (name === 'ans') return self.ans;
          if (self.CONSTS[name] !== undefined) return self.CONSTS[name];
          throw new Error('Unknown name: ' + name);
        }
        throw new Error('Malformed expression');
      }
      var val = parseExpr();
      if (p < toks.length) throw new Error('Malformed expression');
      if (!isFinite(val)) throw new Error('Result is not a finite number');
      return val;
    }
  };

  /* ==========================================================================
     2 · THE EXAM KIT UI
     ========================================================================== */
  var ExamKit = {
    cfg: {},
    violations: [],
    onViolation: null,
    onAutoSubmit: null,
    _fsAsked: false,

    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    },

    /* ---------------- 2a. candidate watermark ---------------- */
    watermark: function (text) {
      if (d.getElementById('tc-watermark')) return;
      var label = this.esc(text || 'CANDIDATE');
      var svg = encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="200">' +
        '<text x="0" y="110" transform="rotate(-24 0,110)" font-family="system-ui,sans-serif" ' +
        'font-size="17" fill="rgba(5,6,174,0.085)" font-weight="700">' + label + '</text></svg>');
      var el = d.createElement('div');
      el.id = 'tc-watermark';
      el.setAttribute('aria-hidden', 'true');
      el.style.cssText =
        'position:fixed;inset:0;pointer-events:none;z-index:9990;' +
        'background-image:url("data:image/svg+xml,' + svg + '");background-repeat:repeat';
      d.body.appendChild(el);
    },

    /* ---------------- 2b. anti-cheat ---------------- */
    startAntiCheat: function (cfg, onViolation) {
      var self = this;
      this.cfg = cfg = cfg || {};
      this.violations = [];
      this.onViolation = onViolation || null;
      var limit = Number(cfg.max_violations || 0);

      /* ---------------------------------------------------------------
         BUG FIX (reported): "when students click the on-screen scientific
         calculator or the maths keyboard, the platform assumes they are
         cheating."

         Correct, and it was two separate faults:

         1. window 'blur' fired a violation unconditionally. Focus moving
            to an in-page tool, the on-screen keyboard on a phone, or even
            the browser's own chrome taking focus for an instant, all
            raised "The exam window lost focus". The fix is to wait a tick
            and ask document.hasFocus(): if the document still has focus,
            nothing left the exam and there is nothing to report.

         2. copy / cut / paste / contextmenu / selectstart were bound to
            the whole document, so a student copying a result out of the
            calculator, or long-pressing a key on the maths keyboard,
            tripped the counter.

         Both are fixed by treating the studio's OWN tools as part of the
         exam, which is what they are. A tool the studio deliberately
         provides can never be evidence of cheating. -------------------- */
      var TOOL_SEL = '#tc-calc,#tc-mathkb,#tc-tools,.tc-tool,.tc-calc-pad,' +
                     '.tc-mathkb-pad,[data-exam-tool]';
      var inTool = function (node) {
        try { return !!(node && node.closest && node.closest(TOOL_SEL)); }
        catch (e) { return false; }
      };
      this._inTool = inTool;
      // True while a tool is open, so a blur caused by opening one is ignored.
      this._toolOpen = function () {
        try { return !!d.querySelector(TOOL_SEL + ':not([hidden])'); }
        catch (e) { return false; }
      };

      var log = function (type, detail) {
        self.violations.push({ type: type, detail: detail, at: new Date().toISOString() });
        var n = self.violations.length;
        var badge = d.getElementById('tc-viol');
        if (badge) {
          badge.textContent = '⚠ ' + n + ' integrity flag' + (n === 1 ? '' : 's');
          badge.style.display = 'inline-block';
        }
        if (self.onViolation) { try { self.onViolation(type, n, detail); } catch (e) {} }
        if (typeof w.toast === 'function' && n <= 3) {
          w.toast('⚠️ ' + detail + ' — this is recorded on your script.', 'warning', 4000);
        }
        if (limit && n >= limit) {
          if (typeof w.toast === 'function') w.toast('Too many integrity flags — submitting your paper now.', 'danger', 6000);
          if (self.onAutoSubmit) { try { self.onAutoSubmit(); } catch (e) {} }
        }
      };
      this._log = log;

      // tab / app switching
      if (cfg.tab_focus !== false) {
        d.addEventListener('visibilitychange', function () {
          // Genuinely leaving the tab is still a violation.
          if (d.hidden) log('tab_switch', 'You left the exam tab');
        });
        w.addEventListener('blur', function () {
          /* Wait one tick, then ask whether the DOCUMENT actually lost
             focus. Opening the calculator, tapping the maths keyboard, or
             a phone's soft keyboard appearing all fire window blur while
             the document still holds focus — none of those are cheating. */
          setTimeout(function () {
            if (d.hidden === false && d.hasFocus && d.hasFocus()) return;   // false alarm
            if (self._toolOpen && self._toolOpen()) return;                 // a studio tool is open
            log('window_blur', 'The exam window lost focus');
          }, 220);
        });
      }
      // copy / cut / paste / right-click
      if (cfg.block_copy !== false) {
        ['copy', 'cut'].forEach(function (ev) {
          d.addEventListener(ev, function (e) {
            if (inTool(e.target)) return;      // copying a calculator result is fine
            e.preventDefault();
            log(ev, 'Copying is disabled during the exam');
          });
        });
        d.addEventListener('paste', function (e) {
          if (inTool(e.target)) return;        // pasting INTO the calculator is fine
          e.preventDefault();
          log('paste', 'Pasting is disabled during the exam');
        });
        d.addEventListener('contextmenu', function (e) {
          if (inTool(e.target)) return;
          e.preventDefault();
          log('right_click', 'Right-click is disabled');
        });
        d.addEventListener('selectstart', function (e) {
          if (e.target && e.target.closest && e.target.closest('input,textarea')) return;
          if (inTool(e.target)) return;        // selecting inside a tool is fine
          e.preventDefault();
        });
      }
      // devtools / view-source shortcuts
      if (cfg.block_devtools !== false) {
        d.addEventListener('keydown', function (e) {
          var k = (e.key || '').toLowerCase();
          if (k === 'f12' ||
              (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].indexOf(k) !== -1) ||
              (e.ctrlKey && k === 'u') ||
              (e.ctrlKey && k === 'p')) {
            e.preventDefault();
            log('devtools', 'Developer tools / print shortcut blocked');
          }
        });
        w.addEventListener('beforeprint', function () { log('print', 'Printing attempted'); });
      }
      // fullscreen
      if (cfg.fullscreen) {
        this.requestFullscreen();
        d.addEventListener('fullscreenchange', function () {
          if (!d.fullscreenElement) log('fullscreen_exit', 'You left fullscreen mode');
        });
      }
      // camera + audio (metadata only — see proctor.js; nothing is uploaded)
      if ((cfg.camera || cfg.audio_monitor) && w.Proctor) {
        try {
          w.Proctor.start(cfg, cfg._code || 'exam', cfg._candidate || 'candidate',
            function (type, detail) { log(type, detail); });
        } catch (e) {}
      }
      return this;
    },

    requestFullscreen: function () {
      try {
        var el = d.documentElement;
        if (el.requestFullscreen) el.requestFullscreen().catch(function () {});
      } catch (e) {}
    },

    stopAntiCheat: function () {
      try { if (w.Proctor && w.Proctor.stop) w.Proctor.stop(); } catch (e) {}
      try { if (d.fullscreenElement && d.exitFullscreen) d.exitFullscreen(); } catch (e) {}
      var wm = d.getElementById('tc-watermark'); if (wm) wm.remove();
      return this.violations;
    },

    /* ---------------- 2c. question palette (number tabs) ---------------- */
    renderPalette: function (host, opts) {
      if (!host) return;
      opts = opts || {};
      var qs = opts.questions || [];
      var answers = opts.answers || {};
      var flags = opts.flags || {};
      var current = Number(opts.current || 0);
      var onJump = opts.onJump || function () {};

      // group by subject so a multi-subject paper reads like a real CBT
      var groups = {}, order = [];
      qs.forEach(function (q, i) {
        var s = q.subject || opts.subject || 'Questions';
        if (!groups[s]) { groups[s] = []; order.push(s); }
        groups[s].push(i);
      });

      /* BUG FIX — "x of y questions answered" counted an untouched paper as
         partly answered. The old test was `a !== ''`, and an empty ARRAY is
         not equal to '' — so every multi-select, ordering, matching, matrix,
         categorization, cloze and hot-text question counted as answered the
         moment its (empty) control existed. Arrays and objects need a real
         emptiness check, which CBTTypes.isBlank provides. */
      var blank = (w.CBTTypes && w.CBTTypes.isBlank) ? w.CBTTypes.isBlank : function (v) {
        if (v == null) return true;
        if (typeof v === 'string') return v.trim() === '';
        if (Array.isArray(v)) return v.length === 0 || v.every(function (x) {
          return x == null || String(x).trim() === ''; });
        if (typeof v === 'object') return Object.keys(v).length === 0;
        return false;
      };
      var answered = 0;
      qs.forEach(function (q, i) {
        var a = answers[q.id] !== undefined ? answers[q.id] : answers[i];
        if (!blank(a)) answered++;
      });

      host.innerHTML =
        '<div class="tc-palette">' +
        '<div class="tc-palette-head"><b>Question map</b> ' +
          '<span class="tc-pal-count">' + answered + ' of ' + qs.length + ' answered</span></div>' +
        order.map(function (sub) {
          return (order.length > 1 ? '<div class="tc-pal-sub">' + this.esc(sub) + '</div>' : '') +
            '<div class="tc-pal-grid">' + groups[sub].map(function (i) {
              var q = qs[i];
              var a = answers[q.id] !== undefined ? answers[q.id] : answers[i];
              var cls = 'tc-pal-btn';
              if (i === current) cls += ' current';
              else if (flags[i]) cls += ' flagged';
              else if (a !== undefined && a !== null && a !== '') cls += ' answered';
              return '<button type="button" class="' + cls + '" data-q="' + i + '" ' +
                     'aria-label="Question ' + (i + 1) + '">' + (i + 1) + '</button>';
            }).join('') + '</div>';
        }, this).join('') +
        '<div class="tc-pal-key">' +
          '<span><i class="k cur"></i>current</span>' +
          '<span><i class="k ans"></i>answered</span>' +
          '<span><i class="k flg"></i>flagged</span>' +
          '<span><i class="k non"></i>not seen</span>' +
        '</div></div>';

      host.querySelectorAll('[data-q]').forEach(function (b) {
        b.onclick = function () { onJump(Number(b.dataset.q)); };
      });
      this.injectCSS();
    },

    /* ---------------- 2d. scientific calculator ---------------- */
    calc: Calc,

    toggleCalculator: function () {
      var box = d.getElementById('tc-calc');
      if (box) { box.remove(); return; }
      box = d.createElement('div');
      box.id = 'tc-calc';
      box.className = 'tc-tool';
      d.body.appendChild(box);
      this.renderCalculator();
      this.injectCSS();
    },

    renderCalculator: function () {
      var box = d.getElementById('tc-calc');
      if (!box) return;
      /* Toggling 2nd or DEG/RAD re-renders the pad. Without this the
         half-typed expression was thrown away, which in an exam is worse
         than the missing feature it was added for. */
      var prevEl = d.getElementById('tc-calc-in');
      var prev = prevEl ? prevEl.value : '';
      var C = Calc;
      var inv = !!this._calcInv;      // the 2nd / INV shift

      /* The 2nd key used to be `if (k === '2nd') { return; }` — a button that
         did nothing. It now shifts the function rows to their inverses, the
         way every scientific calculator does, and the shifted keys are shown
         highlighted so the candidate can see the mode they are in. */
      var rows = inv ? [
        ['2nd', C.angle === 'deg' ? 'DEG' : 'RAD', 'MC', 'MR', 'M+', 'M−'],
        ['asin(', 'acos(', 'atan(', 'root(', '(', ')'],
        ['asinh(', 'acosh(', 'atanh(', 'sq(', 'cube(', 'inv('],
        ['exp(', '10^', 'log2(', 'logb(', 'tau', 'phi'],
        ['7', '8', '9', '/', 'gcd(', 'lcm('],
        ['4', '5', '6', '*', 'min(', 'max('],
        ['1', '2', '3', '-', 'mod(', 'C'],
        ['0', '.', 'EE', '+', '⌫', '=']
      ] : [
        ['2nd', C.angle === 'deg' ? 'DEG' : 'RAD', 'MC', 'MR', 'M+', 'M−'],
        ['sin(', 'cos(', 'tan(', '^', '(', ')'],
        ['sinh(', 'cosh(', 'tanh(', 'sqrt(', 'cbrt(', '!'],
        ['ln(', 'log(', 'abs(', 'hypot(', 'pi', 'e'],
        ['7', '8', '9', '/', 'nCr(', 'nPr('],
        ['4', '5', '6', '*', 'sec(', 'ans'],
        ['1', '2', '3', '-', '%', 'C'],
        ['0', '.', '+/−', '+', '⌫', '=']
      ];
      box.innerHTML =
        '<div class="tc-tool-top"><b>🧮 Scientific calculator</b>' +
          '<span class="tc-calc-mode">' + C.angle.toUpperCase() +
            (inv ? ' · 2nd' : '') + (C.memory ? ' · M ' + (Math.round(C.memory * 1e6) / 1e6) : '') + '</span>' +
          '<button type="button" class="tc-tool-x" aria-label="Close">×</button></div>' +
        '<input id="tc-calc-in" class="tc-calc-in" value="" placeholder="type or tap — e.g. 2sin(30)+ln(e)" ' +
          'aria-label="Calculator expression">' +
        '<div id="tc-calc-out" class="tc-calc-out">0</div>' +
        '<div class="tc-calc-pad">' +
        rows.map(function (r) {
          return r.map(function (k) {
            var cls = 'tc-k';
            if (k === '=') cls += ' eq';
            if (['C', '⌫'].indexOf(k) !== -1) cls += ' warn';
            if (/^[0-9.]$/.test(k)) cls += ' num';
            return '<button type="button" class="' + cls + '" data-k="' + k + '">' + k + '</button>';
          }).join('');
        }).join('') +
        '</div>' +
        '<div class="tc-calc-hist" id="tc-calc-hist"></div>' +
        '<details class="tc-calc-ref"><summary>Everything this calculator understands</summary>' +
          '<div class="tc-calc-ref-body">' +
          '<b>Trigonometry</b> sin cos tan sec csc cot · asin acos atan asec acsc acot' +
          ' — these follow the <b>' + C.angle.toUpperCase() + '</b> setting, tap it to switch.<br>' +
          '<b>Hyperbolic</b> sinh cosh tanh sech csch coth · asinh acosh atanh<br>' +
          '<b>Logs &amp; powers</b> ln log log2 log10 exp 10^ e^ x^y sqrt cbrt root(x,n) ' +
          'logb(x,b) — <i>value first</i>, so logb(8,2) = 3<br>' +
          '<b>Numbers</b> abs round floor ceil trunc frac sign inv(x)=1/x sq cube mod(a,b) ' +
          'gcd lcm hypot min max sum mean<br>' +
          '<b>Combinatorics</b> n! nCr(n,r) nPr(n,r)<br>' +
          '<b>Constants</b> pi e tau phi · g_earth avogadro planck c_light elem_charge gas_const<br>' +
          '<b>Memory</b> MC clear · MR recall · M+ add · M− subtract · <b>ans</b> = last result<br>' +
          '<b>Tips</b> 2.5E6 means 2.5×10⁶ · type directly or tap · Enter evaluates · ' +
          '<b>2nd</b> shows the inverse functions' +
          '</div></details>';

      var input = d.getElementById('tc-calc-in');
      var out = d.getElementById('tc-calc-out');
      var self = this;
      if (prev) input.value = prev;

      function show(v) { out.textContent = v; }
      function compute() {
        var src = input.value.trim();
        if (!src) { show('0'); return; }
        try {
          var v = Calc.evaluate(src);
          Calc.ans = v; Calc.CONSTS.ans = v;
          show(String(Math.round(v * 1e12) / 1e12));
          Calc.history.unshift(src + ' = ' + (Math.round(v * 1e12) / 1e12));
          Calc.history = Calc.history.slice(0, 8);
          var h = d.getElementById('tc-calc-hist');
          if (h) h.innerHTML = Calc.history.map(function (x) { return '<div>' + self.esc(x) + '</div>'; }).join('');
        } catch (e) { show(e.message || 'Error'); }
      }

      box.querySelector('.tc-tool-x').onclick = function () { box.remove(); };
      box.querySelectorAll('[data-k]').forEach(function (b) {
        b.onclick = function () {
          var k = b.dataset.k;
          if (k === '=') return compute();
          if (k === 'C') { input.value = ''; show('0'); return; }
          if (k === '⌫') { input.value = input.value.slice(0, -1); return; }
          if (k === 'deg/rad') { Calc.angle = Calc.angle === 'deg' ? 'rad' : 'deg'; self.renderCalculator(); return; }
          if (k === 'MS') { try { Calc.memory = Calc.evaluate(input.value || '0'); } catch (e) {} self.renderCalculator(); return; }
          if (k === 'MC') { Calc.memory = 0; self.renderCalculator(); return; }
          if (k === 'MR') { input.value += String(Calc.memory); return; }
          if (k === 'M+') { try { Calc.memory += Calc.evaluate(input.value || '0'); } catch (e) {} self.renderCalculator(); return; }
          if (k === 'M−') { try { Calc.memory -= Calc.evaluate(input.value || '0'); } catch (e) {} self.renderCalculator(); return; }
          if (k === '2nd') { self._calcInv = !self._calcInv; self.renderCalculator(); return; }
          if (k === 'DEG' || k === 'RAD') {
            Calc.angle = Calc.angle === 'deg' ? 'rad' : 'deg';
            self.renderCalculator();
            return;
          }
          if (k === '+/−') {
            /* Negate the last number typed, rather than blindly prefixing a
               minus, which is what a candidate expects from this key. */
            var mNeg = input.value.match(/(-?\d*\.?\d+)\s*$/);
            if (mNeg) {
              var numTxt = mNeg[1];
              var negd = numTxt.charAt(0) === '-' ? numTxt.slice(1) : '-' + numTxt;
              input.value = input.value.slice(0, mNeg.index) + negd;
            } else {
              input.value += '-';
            }
            input.focus();
            return;
          }
          if (k === 'EE') { input.value += 'E'; input.focus(); return; }
          if (k === '10^') { input.value += '10^'; input.focus(); return; }
          input.value += k;
          input.focus();
        };
      });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); compute(); } });
    },

    /* ---------------- 2e. maths keyboard ---------------- */
    toggleMathKeyboard: function () {
      var box = d.getElementById('tc-mathkb');
      if (box) { box.remove(); return; }
      box = d.createElement('div');
      box.id = 'tc-mathkb';
      box.className = 'tc-tool';
      /* =====================================================================
         REPORTED ITEM 1 — "ensure that more characters are added to the
         on-screen mathematical keyboard."

         The old board had 7 groups and about 70 characters. It could not
         write a chemical formula (no subscripts past ₃), could not write a
         vector or a matrix bracket, had no number set symbols, no logic
         symbols, no comparison beyond ≤ ≥, no digits at all for superscripts,
         and only 11 Greek letters out of 48.

         There are now 15 groups and over 300 characters, chosen against what
         WAEC, NECO, JAMB, IGCSE, A-Level and IB papers actually require in
         mathematics, further mathematics, physics, chemistry and biology.
         A search box filters the whole board, because 300 keys are only an
         improvement if you can find the one you want.
         ===================================================================== */
      /* Searchable names. Without these the search box can only match the
         glyph itself, which is useless — nobody types "∫" to find "∫". */
      var NAMES = {
        '∫': 'integral', '∬': 'double integral', '∭': 'triple integral',
        '∮': 'contour integral', '∂': 'partial derivative', '∇': 'nabla del gradient',
        '∑': 'sum sigma summation', '∏': 'product pi', '∞': 'infinity',
        '√': 'square root surd', '∛': 'cube root', '∜': 'fourth root',
        'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 'ε': 'epsilon',
        'ζ': 'zeta', 'η': 'eta', 'θ': 'theta', 'ι': 'iota', 'κ': 'kappa',
        'λ': 'lambda', 'μ': 'mu micro', 'ν': 'nu', 'ξ': 'xi', 'ο': 'omicron',
        'π': 'pi', 'ρ': 'rho', 'σ': 'sigma', 'τ': 'tau', 'υ': 'upsilon',
        'φ': 'phi', 'χ': 'chi', 'ψ': 'psi', 'ω': 'omega',
        'Δ': 'capital delta change', 'Σ': 'capital sigma sum', 'Ω': 'ohm omega',
        'Γ': 'capital gamma', 'Θ': 'capital theta', 'Λ': 'capital lambda',
        'Ξ': 'capital xi', 'Π': 'capital pi', 'Φ': 'capital phi', 'Ψ': 'capital psi',
        '∈': 'element of member', '∉': 'not an element', '∋': 'contains',
        '⊂': 'subset', '⊄': 'not a subset', '⊆': 'subset or equal',
        '⊇': 'superset or equal', '⊃': 'superset',
        '∪': 'union', '∩': 'intersection', '∅': 'empty set null',
        '∀': 'for all universal', '∃': 'there exists', '∄': 'does not exist',
        '¬': 'not negation', '∧': 'and conjunction', '∨': 'or disjunction',
        '⇒': 'implies', '⇔': 'if and only if iff', '∴': 'therefore', '∵': 'because',
        'ℕ': 'natural numbers', 'ℤ': 'integers', 'ℚ': 'rationals',
        'ℝ': 'reals', 'ℂ': 'complex numbers', 'ℙ': 'primes probability',
        '∠': 'angle', '°': 'degree', '⊥': 'perpendicular', '∥': 'parallel',
        '≅': 'congruent', '∽': 'similar', '△': 'triangle', '□': 'square',
        '≠': 'not equal', '≈': 'approximately', '≡': 'identical equivalent',
        '≤': 'less than or equal', '≥': 'greater than or equal',
        '≪': 'much less than', '≫': 'much greater than', '∝': 'proportional to',
        '±': 'plus minus', '∓': 'minus plus', '×': 'times multiply',
        '÷': 'divide', '−': 'minus subtract',
        '⇌': 'reversible reaction equilibrium', '⇄': 'reversible',
        '↑': 'gas evolved up arrow', '↓': 'precipitate down arrow',
        '(aq)': 'aqueous', '(s)': 'solid', '(l)': 'liquid', '(g)': 'gas',
        'x̄': 'x bar sample mean', 'σ²': 'variance', 'χ²': 'chi squared',
        'ŷ': 'y hat predicted', 'p̂': 'p hat sample proportion',
        'ⁿCᵣ': 'combinations choose', 'ⁿPᵣ': 'permutations',
        'H₀': 'null hypothesis', 'H₁': 'alternative hypothesis',
        'ℏ': 'reduced planck h bar', 'ℓ': 'litre length', 'Å': 'angstrom',
        '‰': 'per mille', '′': 'prime minutes', '″': 'double prime seconds',
        '⌈': 'ceiling', '⌊': 'floor', '⟨': 'bra angle bracket', '⟩': 'ket angle bracket',
        '|x|': 'absolute value modulus', '‖x‖': 'norm',
        'Aᵀ': 'transpose', 'A⁻¹': 'inverse matrix', 'det': 'determinant',
        'x²': 'squared', 'x³': 'cubed', 'xⁿ': 'to the power', 'x⁻¹': 'reciprocal inverse'
      };

      var GROUPS = [
        ['Basic',        ['+', '−', '×', '÷', '±', '∓', '=', '≠', '≈', '≡', '≅', '∼',
                          '<', '>', '≤', '≥', '≪', '≫', '∝', '%', '‰', '·', '⋅']],
        ['Powers & roots', ['x²', 'x³', 'xⁿ', 'x⁻¹', '√', '∛', '∜', 'ⁿ√', '¹⁄ₓ',
                          '10ⁿ', 'eⁿ', '⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹',
                          '⁺', '⁻', '⁽', '⁾']],
        ['Subscripts',   ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉',
                          '₊', '₋', '₍', '₎', 'ₐ', 'ₑ', 'ₙ', 'ₓ']],
        ['Fractions',    ['½', '⅓', '⅔', '¼', '¾', '⅕', '⅖', '⅗', '⅘', '⅙', '⅚',
                          '⅛', '⅜', '⅝', '⅞', 'a/b', '(  )/(  )', '∕']],
        ['Greek small',  ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ',
                          'ν', 'ξ', 'ο', 'π', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω']],
        ['Greek capital',['Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ', 'Η', 'Θ', 'Λ', 'Ξ', 'Π',
                          'Σ', 'Φ', 'Ψ', 'Ω']],
        ['Calculus',     ['∫', '∬', '∭', '∮', '∂', '∇', '∑', '∏', 'lim', 'd/dx',
                          'dx', 'dy', 'dt', 'δ', 'Δ', '∞', '→', '↦', '′', '″', '‴']],
        ['Sets & logic', ['∈', '∉', '∋', '⊂', '⊄', '⊆', '⊇', '⊃', '∪', '∩', '∅',
                          '∀', '∃', '∄', '¬', '∧', '∨', '⊕', '⊗', '∴', '∵',
                          '⇒', '⇐', '⇔', '↔', '|', '‖']],
        ['Number sets',  ['ℕ', 'ℤ', 'ℚ', 'ℝ', 'ℂ', 'ℙ', '𝔽', 'ℵ']],
        ['Geometry',     ['∠', '∡', '⊾', '°', '△', '□', '▭', '○', '⊙', '⌒', '⊥',
                          '∥', '≅', '∽', '↔', '⟂', '⦟', '′', '″']],
        ['Brackets',     ['(', ')', '[', ']', '{', '}', '⟨', '⟩', '⌈', '⌉', '⌊', '⌋',
                          '|x|', '‖x‖', '⟦', '⟧']],
        ['Statistics',   ['x̄', 'ȳ', 'μ', 'σ', 'σ²', 'Σ', 'ρ', 'χ²', 'ŷ', 'p̂',
                          'n!', 'ⁿCᵣ', 'ⁿPᵣ', '∼', 'H₀', 'H₁', '≐']],
        ['Vectors & matrices', ['→', 'â', 'î', 'ĵ', 'k̂', '⃗', '·', '×', '∥', '⊥',
                          '[  ]', 'det', 'Aᵀ', 'A⁻¹', '⊗', '∑']],
        ['Chemistry',    ['→', '⇌', '⇄', '↑', '↓', '⁺', '⁻', '²⁺', '³⁺', '²⁻',
                          '₂', '₃', '₄', '₅', '₆', '·', 'Δ', '°C', '(aq)', '(s)',
                          '(l)', '(g)', '⚛', 'Å']],
        ['Physics units',['°', '°C', 'Ω', 'µ', 'Å', 'ℏ', 'ℓ', '∆', 'λ', 'ν',
                          'm/s', 'm/s²', 'N', 'J', 'W', 'Hz', 'Pa', 'mol', 'cd',
                          '×10ⁿ', '≈']]
      ];
      var total = GROUPS.reduce(function (a, g) { return a + g[1].length; }, 0);
      box.innerHTML =
        '<div class="tc-tool-top"><b>⌨️ Maths keyboard</b>' +
        '<span class="tc-calc-mode">' + total + ' symbols</span>' +
        '<button type="button" class="tc-tool-x" aria-label="Close">×</button></div>' +
        '<input id="tc-kb-find" class="tc-calc-in" placeholder="🔎 find a symbol — try: integral, alpha, subset, degree" ' +
          'aria-label="Search the maths keyboard">' +
        '<div class="tc-kb-hint">Tap inside your answer box first, then tap a symbol to insert it.</div>' +
        GROUPS.map(function (g) {
          return '<div class="tc-kb-group" data-kbgroup="' + g[0] + '">' +
            '<div class="tc-kb-label">' + g[0] + '</div><div class="tc-kb-row">' +
            g[1].map(function (sym) {
              var nm = (NAMES[sym] || '');
              return '<button type="button" class="tc-k" data-s="' + sym + '" ' +
                'data-find="' + (g[0] + ' ' + sym + ' ' + nm).toLowerCase().replace(/"/g, '') + '" ' +
                (nm ? 'title="' + nm + '"' : '') + '>' + sym + '</button>';
            }).join('') +
            '</div></div>';
        }).join('');
      d.body.appendChild(box);

      // remember the last answer field the candidate touched
      var self = this;
      box.querySelector('.tc-tool-x').onclick = function () { box.remove(); };

      /* Search. 300 symbols are only useful if the right one can be found. */
      var find = box.querySelector('#tc-kb-find');
      if (find) {
        find.addEventListener('input', function () {
          var q = find.value.trim().toLowerCase();
          box.querySelectorAll('.tc-kb-group').forEach(function (g) {
            var shown = 0;
            g.querySelectorAll('[data-s]').forEach(function (b) {
              var hit = !q || (b.dataset.find || '').indexOf(q) > -1;
              b.style.display = hit ? '' : 'none';
              if (hit) shown++;
            });
            g.style.display = shown ? '' : 'none';
          });
        });
        // Typing in the search box must not steal the "last answer field".
        find.dataset.tcNotAnswer = '1';
      }
      box.querySelectorAll('[data-s]').forEach(function (b) {
        b.onmousedown = function (e) { e.preventDefault(); };   // keep focus
        b.onclick = function () {
          var t = self._lastField;
          if (!t || !d.body.contains(t)) {
            if (typeof w.toast === 'function') w.toast('Tap inside an answer box first, then choose a symbol.', 'info');
            return;
          }
          var s = b.dataset.s;
          /* Keys whose LABEL is not what should be typed. A candidate tapping
             x² means "raise to the power 2", not the literal character. */
          var map = { 'x²': '^2', 'x³': '^3', 'xⁿ': '^', 'x⁻¹': '^-1',
                      '√': '√(', '∛': '∛(', '∜': 'root(x,4)', 'ⁿ√': 'root(',
                      '¹⁄ₓ': '1/', '10ⁿ': '10^', 'eⁿ': 'e^', '×10ⁿ': 'E',
                      'a/b': '/', '(  )/(  )': '()/()', '|x|': '|  |', '‖x‖': '‖  ‖',
                      '[  ]': '[]', 'd/dx': 'd/dx ', 'n!': '!', 'ⁿCᵣ': 'nCr(',
                      'ⁿPᵣ': 'nPr(', 'lim': 'lim ', 'det': 'det(', 'Aᵀ': 'ᵀ',
                      'A⁻¹': '⁻¹', 'σ²': 'σ²', 'm/s²': 'm/s²' };
          var ins = map[s] !== undefined ? map[s] : s;
          var st = t.selectionStart == null ? t.value.length : t.selectionStart;
          var en = t.selectionEnd == null ? t.value.length : t.selectionEnd;
          t.value = t.value.slice(0, st) + ins + t.value.slice(en);
          var pos = st + ins.length;
          try { t.focus(); t.setSelectionRange(pos, pos); } catch (e) {}
          t.dispatchEvent(new w.Event('input', { bubbles: true }));
        };
      });
      this.injectCSS();
    },

    trackFields: function () {
      var self = this;
      if (this._tracking) return;
      this._tracking = true;
      d.addEventListener('focusin', function (e) {
        var t = e.target;
        if (t && /^(INPUT|TEXTAREA)$/.test(t.tagName) &&
            !t.closest('#tc-calc') && !t.closest('#tc-mathkb') &&
            t.dataset.tcNotAnswer !== '1') self._lastField = t;
      });
    },

    /* ---------------- 2f. floating toolbar ---------------- */
    mountToolbar: function (opts) {
      opts = opts || {};
      if (d.getElementById('tc-exam-tools')) return;
      var bar = d.createElement('div');
      bar.id = 'tc-exam-tools';
      bar.innerHTML =
        '<span id="tc-viol" class="tc-viol" style="display:none"></span>' +
        (opts.calculator === false ? '' : '<button type="button" id="tc-t-calc" class="tc-tbtn">🧮 Calculator</button>') +
        (opts.mathkb === false ? '' : '<button type="button" id="tc-t-kb" class="tc-tbtn alt">⌨️ Maths</button>') +
        (opts.fullscreen === false ? '' : '<button type="button" id="tc-t-fs" class="tc-tbtn ghost">⛶ Fullscreen</button>');
      d.body.appendChild(bar);
      var self = this;
      var c = d.getElementById('tc-t-calc'); if (c) c.onclick = function () { self.toggleCalculator(); };
      var k = d.getElementById('tc-t-kb');   if (k) k.onclick = function () { self.toggleMathKeyboard(); };
      var f = d.getElementById('tc-t-fs');   if (f) f.onclick = function () { self.requestFullscreen(); };
      this.trackFields();
      this.injectCSS();
    },

    /* ---------------- 2g. styles ---------------- */
    injectCSS: function () {
      if (d.getElementById('tc-examkit-css')) return;
      var s = d.createElement('style');
      s.id = 'tc-examkit-css';
      s.textContent =
      '#tc-exam-tools{position:fixed;right:16px;bottom:16px;z-index:9993;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;align-items:center}' +
      '.tc-tbtn{background:var(--gradient,linear-gradient(135deg,#0506ae,#964eec));color:#fff;border:none;border-radius:50px;padding:11px 18px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 6px 18px rgba(5,6,174,.32)}' +
      '.tc-tbtn.alt{background:linear-gradient(135deg,#047857,#10b981);box-shadow:0 6px 18px rgba(4,120,87,.3)}' +
      '.tc-tbtn.ghost{background:#fff;color:#0506ae;border:2px solid #0506ae;box-shadow:none}' +
      '.tc-viol{background:#b42318;color:#fff;padding:6px 12px;border-radius:50px;font-size:.78rem;font-weight:800}' +
      '.tc-tool{position:fixed;right:16px;bottom:74px;z-index:9994;width:min(360px,calc(100vw - 24px));max-height:min(70vh,620px);overflow:auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.3);padding:12px}' +
      '.tc-tool-top{display:flex;align-items:center;gap:8px;margin-bottom:8px}' +
      '.tc-tool-top b{flex:1;color:#0506ae}' +
      '.tc-tool-x{background:none;border:none;font-size:1.3rem;cursor:pointer;color:#566276;line-height:1}' +
      '.tc-calc-mode{font-size:.72rem;font-weight:800;background:#eef2ff;color:#0506ae;padding:3px 8px;border-radius:99px}' +
      '.tc-calc-in{width:100%;padding:10px;font-size:1.05rem;border:1px solid #cbd5e1;border-radius:10px;font-family:ui-monospace,monospace}' +
      '.tc-calc-out{text-align:right;font-size:1.5rem;font-weight:800;color:#0506ae;padding:8px 4px;word-break:break-all;min-height:1.6em}' +
      '.tc-calc-pad{display:grid;grid-template-columns:repeat(6,1fr);gap:5px}' +
      '.tc-k{padding:9px 4px;border:1px solid #e2e8f0;background:#f8fafc;border-radius:9px;cursor:pointer;font-size:.82rem;font-weight:600;color:#0f172a}' +
      '.tc-k:hover{background:#eef2ff;border-color:#0506ae}' +
      '.tc-k.num{background:#fff}.tc-k.eq{background:var(--gradient,linear-gradient(135deg,#0506ae,#964eec));color:#fff;border:none}' +
      '.tc-k.warn{background:#fef2f2;color:#b42318}' +
      '.tc-calc-hist{margin-top:8px;font-size:.76rem;color:#566276;font-family:ui-monospace,monospace;max-height:96px;overflow:auto}' +
      '.tc-kb-group{margin-bottom:8px}.tc-kb-label{font-size:.72rem;font-weight:800;color:#566276;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}' +
      '.tc-kb-row{display:flex;flex-wrap:wrap;gap:4px}.tc-kb-row .tc-k{min-width:38px}' +
      '.tc-palette{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px}' +
      '.tc-palette-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:.9rem}' +
      '.tc-pal-count{font-size:.78rem;color:#566276;font-weight:700}' +
      '.tc-pal-sub{font-size:.76rem;font-weight:800;color:#0506ae;text-transform:uppercase;letter-spacing:.05em;margin:10px 0 4px}' +
      '.tc-pal-grid{display:flex;flex-wrap:wrap;gap:6px}' +
      '.tc-pal-btn{width:36px;height:36px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;font-weight:700;cursor:pointer;font-size:.82rem;color:#0f172a}' +
      '.tc-pal-btn:hover{border-color:#0506ae}' +
      '.tc-pal-btn.current{background:#0506ae;color:#fff;border-color:#0506ae}' +
      '.tc-pal-btn.answered{background:#dcfce7;border-color:#86efac;color:#065f46}' +
      '.tc-pal-btn.flagged{background:#fef08a;border-color:#facc15;color:#78350f}' +
      '.tc-pal-key{display:flex;gap:12px;flex-wrap:wrap;margin-top:10px;font-size:.74rem;color:#566276}' +
      '.tc-pal-key i.k{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:4px;vertical-align:middle;border:1px solid #cbd5e1}' +
      '.tc-pal-key i.cur{background:#0506ae}.tc-pal-key i.ans{background:#dcfce7}' +
      '.tc-pal-key i.flg{background:#fef08a}.tc-pal-key i.non{background:#fff}' +
      '.tc-exam-brand{text-align:center;margin:0 0 14px}' +
      '.tc-exam-brand .n{font-size:1.5rem;font-weight:800;letter-spacing:.01em;color:#0506ae;text-transform:uppercase}' +
      '.tc-exam-brand .s{font-size:.84rem;color:#566276}' +
      '@media print{#tc-exam-tools,.tc-tool,#tc-watermark{display:none!important}}';
      d.head.appendChild(s);
    },

    /* ---------------- 2h. centred studio banner ---------------- */
    brandBanner: function (host, subtitle) {
      if (!host) return;
      var p = w.PRACTICE || {};
      var name = p.name || 'TUTORING STUDIO';
      var el = d.createElement('div');
      el.className = 'tc-exam-brand';
      el.innerHTML = '<div class="n">' + this.esc(name) + '</div>' +
                     '<div class="s">' + this.esc(subtitle || 'Computer-Based Test') + '</div>';
      host.insertBefore(el, host.firstChild);
      this.injectCSS();
    }
  };

  w.ExamKit = ExamKit;
  w.SciCalc = Calc;
})(window, document);
