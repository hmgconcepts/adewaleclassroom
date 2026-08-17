/* ============================================================================
   theme-engine.js — Tutoring Connect V8
   ----------------------------------------------------------------------------
   WHY THIS FILE EXISTS
   Before V8 the wizard offered 53 themes, 51 fonts and 20 layouts, but:
     * only --primary/--accent were ever re-themed, so --gradient,
       --primary-dark, --primary-light and --ring stayed on the stock
       indigo->cyan values. Every studio therefore looked broadly identical
       no matter which theme the client picked.
     * 19 of the 20 layouts had no CSS at all; picking "Kanban" or
       "Bottom Dock" changed literally nothing.
     * every page hard-links DM Sans in <head>, which overrode the font the
       client chose in the wizard.
   This engine resolves all three. It is loaded on EVERY page, runs before
   first paint where possible, and is the single source of truth for the
   visual identity of a generated studio.
   ========================================================================== */
(function (w, d) {
  'use strict';

  var ThemeEngine = {
    /* ---------------- colour helpers ---------------- */
    hex2rgb: function (h) {
      h = String(h || '').trim().replace('#', '');
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      var n = parseInt(h, 16);
      if (isNaN(n)) return [79, 70, 229];
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    },
    rgb2hex: function (r) {
      return '#' + r.map(function (c) {
        c = Math.max(0, Math.min(255, Math.round(c)));
        return (c < 16 ? '0' : '') + c.toString(16);
      }).join('');
    },
    _hsl: function (h) {
      var c = this.hex2rgb(h).map(function (x) { return x / 255; });
      var mx = Math.max.apply(null, c), mn = Math.min.apply(null, c);
      var l = (mx + mn) / 2, s = 0, hu = 0, dd = mx - mn;
      if (dd) {
        s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
        if (mx === c[0]) hu = ((c[1] - c[2]) / dd) % 6;
        else if (mx === c[1]) hu = (c[2] - c[0]) / dd + 2;
        else hu = (c[0] - c[1]) / dd + 4;
        hu *= 60; if (hu < 0) hu += 360;
      }
      return [hu, s, l];
    },
    _fromHsl: function (hu, s, l) {
      var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((hu / 60) % 2) - 1)), m = l - c / 2;
      var r = [0, 0, 0];
      if (hu < 60) r = [c, x, 0]; else if (hu < 120) r = [x, c, 0];
      else if (hu < 180) r = [0, c, x]; else if (hu < 240) r = [0, x, c];
      else if (hu < 300) r = [x, 0, c]; else r = [c, 0, x];
      return this.rgb2hex([(r[0] + m) * 255, (r[1] + m) * 255, (r[2] + m) * 255]);
    },
    lighten: function (h, f) { var a = this._hsl(h); return this._fromHsl(a[0], a[1], Math.min(1, a[2] + (1 - a[2]) * f)); },
    darken: function (h, f) { var a = this._hsl(h); return this._fromHsl(a[0], a[1], Math.max(0, a[2] * (1 - f))); },
    lum: function (h) {
      return this.hex2rgb(h).map(function (c) {
        c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      }).reduce(function (a, v, i) { return a + v * [0.2126, 0.7152, 0.0722][i]; }, 0);
    },
    /* WCAG contrast ratio — used to guarantee readable text on any theme. */
    contrast: function (a, b) {
      var l1 = this.lum(a), l2 = this.lum(b);
      var hi = Math.max(l1, l2), lo = Math.min(l1, l2);
      return (hi + 0.05) / (lo + 0.05);
    },
    /* Pick black or white text for a background — never let a client's theme
       produce unreadable buttons. */
    readableOn: function (bg) { return this.contrast(bg, '#ffffff') >= 3.6 ? '#ffffff' : '#0f172a'; },

    /* ---------------- theme application ---------------- */
    resolve: function (theme) {
      theme = theme || {};
      var p = theme.primary || '#4f46e5';
      var a = theme.accent || '#06b6d4';
      return {
        primary: p,
        accent: a,
        primaryLight: theme.primaryLight || this.lighten(p, 0.28),
        primaryDark: theme.primaryDark || this.darken(p, 0.30),
        accentLight: theme.accentLight || this.lighten(a, 0.30),
        accentDark: theme.accentDark || this.darken(a, 0.25),
        bg: theme.bg || '#f8fafc',
        ink: theme.ink || '#0f172a',
        ring: theme.ring || 'rgba(' + this.hex2rgb(p).join(',') + ',.22)',
        gradient: theme.gradient || ('linear-gradient(135deg,' + p + ' 0%,' + a + ' 100%)'),
        onPrimary: theme.onPrimary || this.readableOn(p),
        onAccent: this.readableOn(a)
      };
    },

    applyTheme: function (theme) {
      var t = this.resolve(theme);
      var r = d.documentElement.style;
      var set = function (k, v) { try { r.setProperty(k, v); } catch (e) {} };
      // Core tokens
      set('--primary', t.primary);
      set('--primary-dark', t.primaryDark);
      set('--primary-light', t.primaryLight);
      set('--accent', t.accent);
      set('--accent-dark', t.accentDark);
      set('--accent-light', t.accentLight);
      set('--on-primary', t.onPrimary);
      set('--on-accent', t.onAccent);
      set('--ink', t.ink);
      set('--ring', t.ring);
      // THE fix: gradients were previously frozen on the stock palette.
      set('--gradient', t.gradient);
      set('--gradient-dark', 'linear-gradient(135deg,' + t.primaryDark + ' 0%,' + t.accentDark + ' 100%)');
      set('--gradient-soft', 'linear-gradient(135deg,' + t.primaryLight + ' 0%,' + t.accentLight + ' 100%)');
      // Legacy tc-* aliases used throughout the existing stylesheet
      set('--tc-primary', t.primary);
      set('--tc-primary-dark', t.primaryDark);
      set('--tc-primary-light', t.primaryLight);
      set('--tc-primary-soft', this.lighten(t.primary, 0.90));
      set('--tc-accent', t.accent);
      set('--tc-accent-light', t.accentLight);
      set('--tc-violet', t.accent);
      set('--tc-violet-light', t.accentLight);
      set('--tc-indigo', t.primary);
      set('--tc-indigo-deep', t.primaryDark);
      set('--tc-gradient', t.gradient);
      set('--tc-ink', t.ink);
      set('--tc-pale', t.bg);
      set('--tc-ivory', t.bg);
      set('--surface-soft', t.bg);
      // Browser UI colour (address bar on Android, PWA splash)
      var meta = d.querySelector('meta[name="theme-color"]');
      if (!meta) { meta = d.createElement('meta'); meta.name = 'theme-color'; d.head.appendChild(meta); }
      meta.content = t.primary;
      this.current = t;
      return t;
    },

    /* ---------------- font application ---------------- */
    applyFont: function (font) {
      if (!font) return;
      try {
        // Remove the hard-coded DM Sans link that every page ships with,
        // otherwise the client's chosen font never wins.
        Array.prototype.slice.call(d.querySelectorAll('link[href*="fonts.googleapis.com"]'))
          .forEach(function (l) { if (!l.dataset.tcFont) l.parentNode.removeChild(l); });
        if (font.css) {
          var id = 'tc-font-link';
          var link = d.getElementById(id) || d.createElement('link');
          link.id = id; link.rel = 'stylesheet'; link.dataset.tcFont = '1';
          link.href = 'https://fonts.googleapis.com/css2?family=' +
            String(font.css).split('|').join('&family=') + '&display=swap';
          if (!link.parentNode) d.head.appendChild(link);
        }
        var r = d.documentElement.style;
        if (font.family) r.setProperty('--font', "'" + String(font.family).replace(/'/g, '') + "', system-ui, -apple-system, Segoe UI, sans-serif");
        if (font.serif) r.setProperty('--font-serif', "'" + String(font.serif).replace(/'/g, '') + "', Georgia, serif");
      } catch (e) {}
    },

    /* ---------------- layout application ---------------- */
    LAYOUT_IDS: ['sidebar', 'topnav', 'compact', 'dual', 'magazine', 'minimal', 'dock',
      'split', 'command', 'boxed', 'fluid', 'kanban', 'timeline', 'academy', 'executive',
      'classroom', 'sidebarwidetop', 'focuswriter', 'hub', 'legacy'],

    applyLayout: function (layout) {
      var id = String(layout || 'sidebar').toLowerCase();
      if (this.LAYOUT_IDS.indexOf(id) === -1) id = 'sidebar';
      var body = d.body;
      if (!body) return id;
      this.LAYOUT_IDS.forEach(function (l) { body.classList.remove('layout-' + l); });
      body.classList.add('layout-' + id);
      body.dataset.layout = id;
      return id;
    },

    /* Dark mode is a user preference, independent of the studio theme. */
    applyMode: function (mode) {
      var m = mode || localStorage.getItem('tc-theme') || 'light';
      d.body && (d.body.dataset.theme = m);
      d.documentElement.dataset.theme = m;
      return m;
    },
    toggleMode: function () {
      var next = (d.documentElement.dataset.theme === 'dark') ? 'light' : 'dark';
      try { localStorage.setItem('tc-theme', next); } catch (e) {}
      return this.applyMode(next);
    },

    /* Live preview used by the builder wizard. */
    preview: function (themeId, fontId, layoutId) {
      var C = w.TC || {};
      var t = (C.THEMES || []).filter(function (x) { return x.id === themeId; })[0];
      var f = (C.FONTS || []).filter(function (x) { return x.id === fontId; })[0];
      if (t) this.applyTheme(t);
      if (f) this.applyFont(f);
      if (layoutId) this.applyLayout(layoutId);
    },

    init: function () {
      var p = w.PRACTICE || {};
      this.applyTheme(p.theme);
      this.applyFont(p.font);
      this.applyMode();
      var self = this;
      var doLayout = function () { self.applyLayout(p.layout); };
      if (d.body) doLayout(); else d.addEventListener('DOMContentLoaded', doLayout);
    }
  };

  w.ThemeEngine = ThemeEngine;
  ThemeEngine.init();
})(window, document);
