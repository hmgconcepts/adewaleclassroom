/* ============================================================================
   flyer-maker.js — Marketing flyer studio (V27, report item 1)
   ----------------------------------------------------------------------------
   Mounts into #flyer-root on flyer.html. A live, brand-matched A5 flyer built
   from the studio's Settings (name, motto, subjects, exam boards, contact,
   WhatsApp, address). The operator tweaks the copy in the left panel and the
   flyer repaints instantly; print it as a branded PDF or download it as a PNG
   for WhatsApp status. Media are links; the QR code points at apply.html.
   ========================================================================== */
(function (w, d) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var Flyer = {
    mount() {
      var root = d.getElementById('flyer-root');
      if (!root) return;
      var self = this;
      root.innerHTML =
        '<div class="grid" style="grid-template-columns:minmax(280px,380px) 1fr;gap:18px;align-items:start">' +
          '<div class="card" style="padding:16px">' +
            '<h3 style="margin:0 0 12px">✏️ Flyer copy</h3>' +
            '<div class="form-group"><label>Headline</label><input class="form-input" id="fl-head"></div>' +
            '<div class="form-group"><label>Sub-line</label><input class="form-input" id="fl-sub"></div>' +
            '<div class="form-group"><label>Subjects (comma separated)</label><input class="form-input" id="fl-subjects"></div>' +
            '<div class="form-group"><label>Exam boards</label><input class="form-input" id="fl-boards"></div>' +
            '<div class="form-group"><label>Price position</label><input class="form-input" id="fl-price" placeholder="From ₦2,500 / hour"></div>' +
            '<div class="form-group"><label>Phone / WhatsApp</label><input class="form-input" id="fl-phone"></div>' +
            '<div class="form-group"><label>Email</label><input class="form-input" id="fl-email"></div>' +
            '<div class="form-group"><label>Address / area</label><input class="form-input" id="fl-addr"></div>' +
            '<label style="display:flex;gap:8px;align-items:center;margin:6px 0 12px"><input type="checkbox" id="fl-qr" checked> Show QR to the application page</label>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
              '<button class="btn btn-primary" type="button" id="fl-print">🖨 Print / PDF</button>' +
              '<button class="btn btn-outline" type="button" id="fl-png">⬇ Save image (PNG)</button>' +
            '</div>' +
            '<p class="muted" style="font-size:.78rem;margin-top:10px">The flyer is drawn from Settings when a database is connected; you can still override every line here.</p>' +
          '</div>' +
          '<div style="background:#e2e8f0;border-radius:18px;padding:22px;display:flex;justify-content:center" id="fl-stage"></div>' +
        '</div>';

      this._wire('fl-head'); this._wire('fl-sub'); this._wire('fl-subjects');
      this._wire('fl-boards'); this._wire('fl-price'); this._wire('fl-phone');
      this._wire('fl-email'); this._wire('fl-addr');
      var qr = d.getElementById('fl-qr');
      qr.onchange = function () { self._draw(); };
      d.getElementById('fl-print').onclick = function () { self._print(); };
      d.getElementById('fl-png').onclick = function () { self._png(); };
      this._defaults();
    },

    _wire(id) {
      var el = d.getElementById(id);
      var self = this;
      if (el) el.oninput = function () { self._draw(); };
    },

    async _defaults() {
      var v = {
        head: 'ADEWALE CLASSROOM',
        sub: 'Independent 1:1 & group tutoring — progress you can actually see.',
        subjects: 'Mathematics, English, Sciences, ICT, Languages',
        boards: 'WAEC · NECO · UTME/JAMB · IGCSE · SAT · IELTS',
        price: 'From ₦2,500 / hour',
        phone: '+234 810 086 6322',
        email: 'adewaleclassroom@hmgconcepts.com',
        addr: 'Lagos, Nigeria · Online worldwide'
      };
      if (w.sb) {
        try {
          var { data } = await w.sb.from('practice_settings').select('name,motto,phone,email,address,whatsapp_url,advertised_subjects,advertised_boards').eq('id', 1).maybeSingle();
          if (data) {
            if (data.name) v.head = data.name;
            if (data.motto) v.sub = data.motto;
            if (data.advertised_subjects) v.subjects = data.advertised_subjects;
            if (data.advertised_boards) v.boards = data.advertised_boards;
            if (data.phone) v.phone = data.phone;
            if (data.email) v.email = data.email;
            if (data.address) v.addr = data.address;
          }
        } catch (_) {}
      }
      d.getElementById('fl-head').value = v.head;
      d.getElementById('fl-sub').value = v.sub;
      d.getElementById('fl-subjects').value = v.subjects;
      d.getElementById('fl-boards').value = v.boards;
      d.getElementById('fl-price').value = v.price;
      d.getElementById('fl-phone').value = v.phone;
      d.getElementById('fl-email').value = v.email;
      d.getElementById('fl-addr').value = v.addr;
      this._draw();
    },

    _data() {
      return {
        head: d.getElementById('fl-head').value.trim() || 'ADEWALE CLASSROOM',
        sub: d.getElementById('fl-sub').value.trim() || '',
        subjects: d.getElementById('fl-subjects').value.trim() || '',
        boards: d.getElementById('fl-boards').value.trim() || '',
        price: d.getElementById('fl-price').value.trim() || '',
        phone: d.getElementById('fl-phone').value.trim() || '',
        email: d.getElementById('fl-email').value.trim() || '',
        addr: d.getElementById('fl-addr').value.trim() || '',
        qr: d.getElementById('fl-qr').checked
      };
    },

    _html(v) {
      var subjects = v.subjects.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      var boards = v.boards.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      return '<div id="fl-card" style="width:min(420px,92vw);background:linear-gradient(160deg,#0506ae 0%,#3b1db0 55%,#964eec 100%);border-radius:22px;padding:26px;color:#fff;font-family:inherit;box-shadow:0 22px 50px rgba(15,23,42,.35);position:relative;overflow:hidden">' +
        '<div style="font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;font-weight:800;opacity:.85">HMG Concepts EdTech · HMG Technologies</div>' +
        '<h2 style="margin:8px 0 6px;font-size:1.55rem;line-height:1.15">' + esc(v.head) + '</h2>' +
        '<p style="margin:0 0 14px;font-size:.92rem;opacity:.95;line-height:1.5">' + esc(v.sub) + '</p>' +
        '<div style="background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);border-radius:16px;padding:12px 14px;margin-bottom:12px">' +
          '<div style="font-size:.7rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;opacity:.8">Subjects</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">' + subjects.map(function (s) { return '<span style="background:rgba(255,255,255,.16);border-radius:99px;padding:3px 10px;font-size:.76rem;font-weight:700">' + esc(s) + '</span>'; }).join('') + '</div>' +
        '</div>' +
        (boards.length ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">' + boards.map(function (b) { return '<span style="border:1px solid rgba(255,255,255,.4);border-radius:8px;padding:3px 8px;font-size:.7rem;font-weight:700">' + esc(b) + '</span>'; }).join('') + '</div>' : '') +
        (v.price ? '<div style="font-size:1.02rem;font-weight:800;margin-bottom:12px">' + esc(v.price) + '</div>' : '') +
        '<div style="display:flex;gap:10px;align-items:flex-start">' +
          '<div style="flex:1;font-size:.82rem;line-height:1.7">' +
            '<div>📞 ' + esc(v.phone) + '</div>' +
            (v.email ? '<div>✉️ ' + esc(v.email) + '</div>' : '') +
            (v.addr ? '<div>📍 ' + esc(v.addr) + '</div>' : '') +
          '</div>' +
          (v.qr ? '<div style="width:74px;height:74px;background:#fff;border-radius:12px;padding:6px;flex-shrink:0" title="Scan to apply"><svg viewBox="0 0 29 29" style="width:100%;height:100%"><rect width="29" height="29" fill="white"/><rect x="2" y="2" width="9" height="9" fill="#0506ae"/><rect x="18" y="2" width="9" height="9" fill="#0506ae"/><rect x="2" y="18" width="9" height="9" fill="#0506ae"/><rect x="13" y="13" width="4" height="4" fill="#0506ae"/><rect x="19" y="13" width="3" height="3" fill="#0506ae"/><rect x="13" y="19" width="3" height="3" fill="#0506ae"/><rect x="24" y="18" width="3" height="3" fill="#0506ae"/><rect x="18" y="24" width="3" height="3" fill="#0506ae"/><rect x="13" y="24" width="2" height="2" fill="#0506ae"/><rect x="24" y="13" width="2" height="2" fill="#0506ae"/><rect x="7" y="13" width="2" height="2" fill="#0506ae"/><rect x="13" y="7" width="2" height="2" fill="#0506ae"/><rect x="2" y="13" width="2" height="2" fill="#0506ae"/><rect x="18" y="18" width="2" height="2" fill="#0506ae"/></svg></div>' : '') +
        '</div>' +
        '<div style="margin-top:14px;font-size:.66rem;opacity:.75;text-align:center">Scan the QR or visit the studio to request a place · HMG Concepts · Est. 2015</div>' +
      '</div>';
    },

    _draw() {
      var stage = d.getElementById('fl-stage');
      if (!stage) return;
      stage.innerHTML = this._html(this._data());
    },

    _print() {
      var v = this._data();
      var card = this._html(v);
      var win = w.open('', '_blank');
      if (!win) { window.print(); return; }
      win.document.write('<!doctype html><html><head><title>' + esc(v.head) + ' flyer</title>' +
        '<style>body{background:#e2e8f0;display:flex;justify-content:center;padding:24px;font-family:system-ui} @page{size:A5 portrait;margin:0}</style></head><body>' +
        card + '<script>onload=function(){print();}<\/script></body></html>');
      win.document.close();
    },

    _png() {
      var stage = d.getElementById('fl-stage');
      var node = d.getElementById('fl-card') || (stage && stage.querySelector('#fl-card'));
      if (!node) return;
      try {
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="620">' +
          '<foreignObject width="100%" height="100%">' +
          '<div xmlns="http://www.w3.org/1999/xhtml" style="width:420px">' +
          node.outerHTML.replace(/<svg/g, '<svg xmlns="http://www.w3.org/2000/svg"').replace(/<\/svg>/g, '</svg>').replace(/<img/g, '<img crossorigin="anonymous"') +
          '</div></foreignObject></svg>';
        var blob = new Blob([svg], { type: 'image/svg+xml' });
        var url = URL.createObjectURL(blob);
        var img = new Image();
        img.onload = function () {
          var c = d.createElement('canvas');
          c.width = 420; c.height = 620;
          c.getContext('2d').drawImage(img, 0, 0, 420, 620);
          var a = d.createElement('a');
          a.href = c.toDataURL('image/png');
          a.download = 'adewale-classroom-flyer.png';
          d.body.appendChild(a); a.click(); a.remove();
          URL.revokeObjectURL(url);
        };
        img.src = url;
      } catch (e) {
        if (w.toast) toast('Image export unavailable here — use Print / PDF instead.', 'warning');
      }
    }
  };

  w.FlyerMaker = Flyer;
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { Flyer.mount(); });
  else Flyer.mount();
})(window, document);
