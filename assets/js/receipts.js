/* ============================================================================
   receipts.js — Tutoring Connect V14 · printable e-receipts (item 26)
   ----------------------------------------------------------------------------
   School Connect can print a receipt for a payment; Tutoring Connect could
   record payments but never issue proof of one. For a tutoring studio that is
   not cosmetic — a parent paying school fees in cash or by transfer expects a
   receipt, and Nigerian families often need one for reimbursement or records.

   This produces a clean, self-contained A5 receipt with:
     * the studio's branding (name, logo, contact, motto) pulled from PRACTICE
     * a stable receipt number derived from the payment id, so reprinting the
       same payment always yields the SAME number (never a duplicate series)
     * amount in figures AND in words — the single most requested feature on a
       hand-written Nigerian receipt, and what makes it hard to alter
     * what it was for, the method, the reference and the balance remaining
     * a verification line so a parent can check it against the portal

   It opens in a print window: no library, no server, no PDF dependency —
   "Save as PDF" in the browser print dialogue produces the file.
   ========================================================================== */
(function (w, d) {
  'use strict';

  var Receipts = {
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    },

    /* ---- amount in words (needed on any real receipt) ---- */
    ONES: ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
           'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
           'eighteen', 'nineteen'],
    TENS: ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'],

    _under1000: function (n) {
      var out = [];
      if (n >= 100) { out.push(this.ONES[Math.floor(n / 100)], 'hundred'); n %= 100; if (n) out.push('and'); }
      if (n >= 20) { out.push(this.TENS[Math.floor(n / 10)]); n %= 10; if (n) out.push(this.ONES[n]); }
      else if (n > 0) out.push(this.ONES[n]);
      return out.join(' ');
    },

    inWords: function (amount) {
      var n = Math.floor(Math.abs(Number(amount) || 0));
      var kobo = Math.round((Math.abs(Number(amount) || 0) - n) * 100);
      if (n === 0 && !kobo) return 'zero';
      var scales = [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']];
      var parts = [], self = this;
      scales.forEach(function (s) {
        if (n >= s[0]) { parts.push(self._under1000(Math.floor(n / s[0])), s[1]); n %= s[0]; }
      });
      if (n > 0) { if (parts.length) parts.push('and'); parts.push(this._under1000(n)); }
      var words = parts.join(' ').replace(/\s+/g, ' ').trim();
      if (kobo) words += ' point ' + String(kobo).padStart(2, '0');
      return words.charAt(0).toUpperCase() + words.slice(1);
    },

    /* A stable, human-readable number derived from the payment id, so the same
       payment always reprints as the same receipt. */
    receiptNo: function (payment) {
      var p = w.PRACTICE || {};
      var prefix = (p.shortName || p.name || 'TC').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'TCS';
      var id = String(payment.id || '');
      var hash = 0;
      for (var i = 0; i < id.length; i++) { hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0; }
      var num = Math.abs(hash) % 1000000;
      var yr = new Date(payment.paid_on || payment.created_at || Date.now()).getFullYear();
      return prefix + '/' + yr + '/' + String(num).padStart(6, '0');
    },

    money: function (v) {
      var p = w.PRACTICE || {};
      var cur = p.currency || '₦';
      return cur + Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    /**
     * @param payment {amount, method, reference, paid_on, id}
     * @param ctx     {payer, learner, description, invoiceTotal, paidToDate, engagement}
     */
    html: function (payment, ctx) {
      ctx = ctx || {};
      var p = w.PRACTICE || {};
      var e = this.esc.bind(this);
      var amount = Number(payment.amount || 0);
      var balance = (ctx.invoiceTotal != null)
        ? Math.max(0, Number(ctx.invoiceTotal) - Number(ctx.paidToDate != null ? ctx.paidToDate : amount))
        : null;
      var no = this.receiptNo(payment);
      var when = payment.paid_on || payment.created_at || new Date().toISOString();

      return '<!doctype html><html><head><meta charset="utf-8">' +
        '<title>Receipt ' + e(no) + '</title>' +
        '<style>' +
        '@page{size:A5;margin:12mm}' +
        'body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a;margin:0;padding:18px}' +
        '.hd{display:flex;gap:12px;align-items:center;border-bottom:3px solid #0506ae;padding-bottom:10px}' +
        '.hd img{width:52px;height:52px;object-fit:contain}' +
        '.hd h1{margin:0;font-size:1.25rem;color:#0506ae;letter-spacing:.01em}' +
        '.hd .m{font-size:.76rem;color:#566276}' +
        '.tag{display:inline-block;background:#0506ae;color:#fff;padding:4px 12px;border-radius:99px;' +
        'font-size:.72rem;font-weight:800;letter-spacing:.08em}' +
        'table{width:100%;border-collapse:collapse;margin-top:12px;font-size:.86rem}' +
        'td{padding:6px 4px;vertical-align:top}' +
        'td.k{color:#566276;width:38%}' +
        '.amt{margin:14px 0;padding:12px;border:2px dashed #0506ae;border-radius:10px;text-align:center}' +
        '.amt .v{font-size:1.7rem;font-weight:800;color:#0506ae}' +
        '.amt .w{font-size:.8rem;color:#334155;font-style:italic;margin-top:4px}' +
        '.ft{margin-top:16px;border-top:1px solid #e2e8f0;padding-top:8px;font-size:.7rem;color:#566276}' +
        '.sig{display:flex;justify-content:space-between;margin-top:26px;font-size:.76rem}' +
        '.sig div{border-top:1px solid #94a3b8;padding-top:4px;width:44%;text-align:center;color:#566276}' +
        '.paid{position:absolute;top:120px;right:34px;transform:rotate(-16deg);border:4px solid #047857;' +
        'color:#047857;padding:4px 14px;border-radius:8px;font-weight:900;font-size:1.3rem;opacity:.75}' +
        '@media print{.noprint{display:none}}' +
        '</style></head><body>' +

        '<div class="hd">' +
          (p.logoUrl ? '<img src="' + e(p.logoUrl) + '" alt="">' : '') +
          '<div style="flex:1"><h1>' + e(p.name || 'Tutoring Studio') + '</h1>' +
          '<div class="m">' + e(p.motto || '') + '</div>' +
          '<div class="m">' + e([p.address, p.phone, p.email].filter(Boolean).join(' · ')) + '</div></div>' +
          '<span class="tag">RECEIPT</span>' +
        '</div>' +

        '<div class="paid">PAID</div>' +

        '<table>' +
        '<tr><td class="k">Receipt number</td><td><b>' + e(no) + '</b></td></tr>' +
        '<tr><td class="k">Date</td><td>' + e(new Date(when).toLocaleDateString()) + '</td></tr>' +
        '<tr><td class="k">Received from</td><td><b>' + e(ctx.payer || 'Parent / Guardian') + '</b></td></tr>' +
        (ctx.learner ? '<tr><td class="k">On behalf of</td><td>' + e(ctx.learner) + '</td></tr>' : '') +
        (ctx.engagement ? '<tr><td class="k">Engagement</td><td>' + e(ctx.engagement) + '</td></tr>' : '') +
        '<tr><td class="k">Being payment for</td><td>' + e(ctx.description || 'Tutoring fees') + '</td></tr>' +
        '<tr><td class="k">Method</td><td>' + e(payment.method || 'Not stated') + '</td></tr>' +
        (payment.reference ? '<tr><td class="k">Reference</td><td>' + e(payment.reference) + '</td></tr>' : '') +
        '</table>' +

        '<div class="amt"><div class="v">' + this.money(amount) + '</div>' +
        '<div class="w">' + e(this.inWords(amount)) + ' ' +
        e((p.currency === '₦' || !p.currency) ? 'naira only' : 'only') + '</div></div>' +

        (balance != null
          ? '<table><tr><td class="k">Invoice total</td><td>' + this.money(ctx.invoiceTotal) + '</td></tr>' +
            '<tr><td class="k">Balance remaining</td><td><b>' + this.money(balance) + '</b>' +
            (balance === 0 ? ' — fully settled' : '') + '</td></tr></table>'
          : '') +

        '<div class="sig"><div>Received by (studio)</div><div>Payer signature</div></div>' +

        '<div class="ft">' +
          'This is a computer-generated receipt from ' + e(p.name || 'the studio') +
          '. Verify it by signing in to the parent portal and opening Payment history — the receipt ' +
          'number above appears against this payment.<br>' +
          'Issued ' + e(new Date().toLocaleString()) + ' · Built with Tutoring Connect (HMG Technologies).' +
        '</div>' +

        '<p class="noprint" style="text-align:center;margin-top:18px">' +
        '<button onclick="window.print()" style="background:#0506ae;color:#fff;border:none;padding:10px 22px;' +
        'border-radius:10px;font-weight:700;cursor:pointer">🖨 Print / Save as PDF</button></p>' +
        '</body></html>';
    },

    /** Open the receipt in a print window. */
    print: function (payment, ctx) {
      var html = this.html(payment, ctx);
      var win = w.open('', '_blank', 'width=620,height=820');
      if (!win) {
        if (w.toast) w.toast('Allow pop-ups for this site to print the receipt.', 'warning', 7000);
        return null;
      }
      win.document.write(html);
      win.document.close();
      return win;
    },

    /** Convenience: add a "Receipt" button to every row of a payments table. */
    attachTo: function (root, getPayment, getCtx) {
      root = root || d;
      root.querySelectorAll('[data-receipt]').forEach(function (b) {
        b.onclick = function () {
          var id = b.dataset.receipt;
          Receipts.print(getPayment(id), getCtx ? getCtx(id) : {});
        };
      });
    }
  };

  w.Receipts = Receipts;
})(window, document);
