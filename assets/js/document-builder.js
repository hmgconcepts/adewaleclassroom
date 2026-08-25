/* ============================================================================
   document-builder.js — Custom Document Builder (V27, report items 7 & 8)
   ----------------------------------------------------------------------------
   Mounts into #doc-builder-root on documents.html. Mirrors the School Connect
   / GOSA document builder: preset types, tokenised body, official signatory,
   live preview with tokens filled, print/PDF, and full CRUD against the
   `documents` table (doc_type, custom_type, reference, recipient, learner,
   signatory_role, signatory_name, body, status, effective_on, issued_on).

   Tokens understood in the body:
     [NAME] [CLASS] [TERM] [SESSION] [DATE] [REFERENCE] [SCHOOL]
     [SIGNATORY] [TITLE]

   Media are links only. Nothing is uploaded.
   ========================================================================== */
(function (w, d) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var PRESETS = [
    { id: 'bonafide', name: 'Bonafide certificate', body: 'This is to certify that [NAME] of [CLASS] is a bonafide learner of [SCHOOL] for [TERM], [SESSION].\n\n[NAME] has consistently demonstrated commitment to learning and good conduct throughout the period.\n\nThis certificate is issued at the request of [NAME] for academic and official purposes.\n\n[REFERENCE] · [DATE]' },
    { id: 'hall ticket', name: 'Examination hall ticket', body: 'EXAMINATION HALL TICKET\n\nCandidate: [NAME]\nClass: [CLASS]\nSession: [SESSION] · Term: [TERM]\nReference: [REFERENCE]\n\nThis ticket admits [NAME] to the examination hall. It must be presented, together with a valid means of identification, to the invigilator before the examination begins.\n\nIssued: [DATE] · [SCHOOL]' },
    { id: 'recommendation letter', name: 'Recommendation letter', body: 'To whom it may concern,\n\nI write to recommend [NAME], a learner in [CLASS] at [SCHOOL], for the [SESSION] academic session.\n\nDuring the period I have known [NAME], they have shown diligence, intellectual curiosity and sound character. I am confident they will excel in any endeavour they undertake.\n\nShould you require further information, please do not hesitate to contact [SCHOOL].\n\n[REFERENCE] · [DATE]' },
    { id: 'transfer letter', name: 'Transfer letter', body: 'TRANSFER LETTER\n\nThis is to confirm that [NAME] of [CLASS] was a learner of [SCHOOL] and is hereby released to continue their education elsewhere, with effect from [DATE].\n\nAll academic and financial obligations have been settled as at the date of issue.\n\nReference: [REFERENCE] · [SIGNATORY]' },
    { id: 'testimonial', name: 'Testimonial', body: 'TESTIMONIAL\n\n[NAME] of [CLASS] has been a learner of [SCHOOL] during [SESSION].\n\nThroughout this period, [NAME] has shown remarkable progress, discipline and a genuine love for learning. We wish [NAME] every success in the future.\n\n[REFERENCE] · [DATE]' },
    { id: 'invitation letter', name: 'Invitation letter', body: 'INVITATION\n\nDear [NAME],\n\nYou are cordially invited to the [TERM] event of [SCHOOL] holding as scheduled.\n\nWe look forward to welcoming you.\n\nReference: [REFERENCE] · [SIGNATORY] · [DATE]' },
    { id: 'fee clearance', name: 'Fee clearance', body: 'FEE CLEARANCE\n\nThis is to certify that [NAME] of [CLASS] has cleared all financial obligations to [SCHOOL] for [TERM], [SESSION].\n\n[NAME] is therefore cleared of all fee-related holds and may proceed with academic activities.\n\nReference: [REFERENCE] · [DATE] · [SIGNATORY]' },
    { id: 'admission letter', name: 'Admission letter', body: 'ADMISSION LETTER\n\nDear [NAME],\n\nCongratulations! We are pleased to offer you admission into [CLASS] at [SCHOOL] for [SESSION].\n\nPlease complete your enrolment within the stated deadline to confirm your place.\n\nReference: [REFERENCE] · [SIGNATORY] · [DATE]' },
    { id: 'appointment letter', name: 'Appointment letter', body: 'APPOINTMENT LETTER\n\nDear [NAME],\n\nFollowing a successful review, we are pleased to appoint you for the stated role, effective [DATE].\n\nYour letter of appointment is [REFERENCE].\n\n[SCHOOL] · [SIGNATORY]' },
    { id: 'memorandum', name: 'Memorandum', body: 'MEMORANDUM\n\nTo: All concerned\nFrom: [SIGNATORY]\nDate: [DATE]\nReference: [REFERENCE]\nRe: [TITLE]\n\n[NAME]' },
    { id: 'certificate', name: 'Certificate', body: 'CERTIFICATE OF PARTICIPATION\n\nThis is to certify that [NAME] of [CLASS] participated in and satisfactorily completed the programme at [SCHOOL] during [TERM], [SESSION].\n\n[REFERENCE] · [DATE]' },
    { id: 'custom', name: 'Custom document', body: '[SCHOOL]\n\n[REFERENCE] · [DATE]\n\nDear [NAME],\n\nWrite the body of your custom document here. Use [NAME] [CLASS] [TERM] [SESSION] [DATE] [REFERENCE] [SCHOOL] [SIGNATORY] [TITLE] wherever values should be inserted.' }
  ];

  var Builder = {
    mount() {
      var root = d.getElementById('doc-builder-root');
      if (!root) return;
      var self = this;
      root.innerHTML =
        '<div class="card" style="padding:18px;margin-bottom:16px">' +
          '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:space-between;margin-bottom:12px">' +
            '<h3 style="margin:0">🧾 Custom Document Builder</h3>' +
            '<span class="muted" style="font-size:.8rem">Templates are tokenised — [NAME] [CLASS] [TERM] [SESSION] [DATE] [REFERENCE] [SCHOOL] [SIGNATORY] [TITLE] — and print as branded PDFs.</span>' +
          '</div>' +
          '<div class="grid grid-2">' +
            '<div class="form-group"><label>Document title *</label><input class="form-input" id="db-title" placeholder="Fee clearance — Adanna Okafor"></div>' +
            '<div class="form-group"><label>Type preset</label><select class="form-select" id="db-type">' +
              PRESETS.map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + '</option>'; }).join('') +
            '</select></div>' +
            '<div class="form-group"><label>Reference</label><input class="form-input" id="db-ref" placeholder="FC/2026/014"></div>' +
            '<div class="form-group"><label>Recipient / learner</label><input class="form-input" id="db-recipient" placeholder="Adanna Okafor"></div>' +
            '<div class="form-group"><label>Signatory role</label><select class="form-select" id="db-signrole"><option>Principal</option><option>Proprietor</option><option>Examination Officer</option><option>Head Teacher</option><option>Lead Tutor</option><option>Custom</option></select></div>' +
            '<div class="form-group"><label>Signatory name</label><input class="form-input" id="db-signname" placeholder="Adewale Samson Adeagbo"></div>' +
            '<div class="form-group"><label>Status</label><select class="form-select" id="db-status"><option value="draft">Draft</option><option value="reviewed">Reviewed</option><option value="final">Final</option><option value="issued">Issued</option><option value="revoked">Revoked</option></select></div>' +
            '<div class="form-group"><label>Issued on</label><input class="form-input" id="db-issued" type="date"></div>' +
            '<div class="form-group" style="grid-column:1/-1"><label>Body * — tokens fill from the fields above</label>' +
              '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px" id="db-tokens">' +
                ['[NAME]','[CLASS]','[TERM]','[SESSION]','[DATE]','[REFERENCE]','[SCHOOL]','[SIGNATORY]','[TITLE]'].map(function (t) {
                  return '<button type="button" data-tok="' + t + '" style="border:1px solid var(--gray-300,#cbd5e1);background:var(--surface-soft,#f8fafc);border-radius:8px;padding:3px 8px;font-size:.76rem;cursor:pointer">' + t + '</button>';
                }).join('') +
              '</div>' +
              '<textarea class="form-textarea" id="db-body" rows="9"></textarea></div>' +
          '</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
            '<button class="btn btn-primary" type="button" id="db-save">💾 Save document</button>' +
            '<button class="btn btn-outline" type="button" id="db-print">🖨 Print / PDF</button>' +
            '<button class="btn btn-ghost" type="button" id="db-clear">Clear form</button>' +
          '</div>' +
        '</div>' +
        '<div class="card" style="padding:18px;margin-bottom:16px">' +
          '<h3 style="margin:0 0 10px">👁 Live preview</h3>' +
          '<div id="db-preview" style="border:1px dashed var(--gray-300,#cbd5e1);border-radius:14px;padding:22px;background:#fff;min-height:180px;font-size:.95rem;line-height:1.7;color:#0f172a"></div>' +
        '</div>';

      var body = d.getElementById('db-body');
      var typeSel = d.getElementById('db-type');
      var first = true;
      typeSel.onchange = function () {
        var p = PRESETS.filter(function (x) { return x.id === typeSel.value; })[0];
        if (p && (first || !body.value.trim())) { body.value = p.body; first = false; }
        Builder.preview();
      };
      body.oninput = Builder.preview;
      ['db-title', 'db-ref', 'db-recipient', 'db-signrole', 'db-signname'].forEach(function (id) {
        var el = d.getElementById(id);
        if (el) el.oninput = Builder.preview;
      });
      d.querySelectorAll('#db-tokens [data-tok]').forEach(function (b) {
        b.onclick = function () {
          var ta = d.getElementById('db-body');
          var start = ta.selectionStart == null ? ta.value.length : ta.selectionStart;
          var end = ta.selectionEnd == null ? start : ta.selectionEnd;
          ta.value = ta.value.slice(0, start) + b.getAttribute('data-tok') + ta.value.slice(end);
          ta.focus();
          Builder.preview();
        };
      });
      d.getElementById('db-save').onclick = function () { Builder.save(); };
      d.getElementById('db-print').onclick = function () { Builder.print(); };
      d.getElementById('db-clear').onclick = function () {
        d.getElementById('db-title').value = ''; d.getElementById('db-ref').value = '';
        d.getElementById('db-recipient').value = ''; d.getElementById('db-signname').value = '';
        d.getElementById('db-issued').value = '';
        body.value = ''; Builder.preview();
      };
      body.value = PRESETS[0].body;
      this.preview();
    },

    _school() {
      try {
        return (w.Brand && Brand.practiceName) ? Brand.practiceName() : 'ADEWALE CLASSROOM';
      } catch (_) { return 'ADEWALE CLASSROOM'; }
    },

    fill(bodyText) {
      var g = function (id) { var el = d.getElementById(id); return el ? el.value.trim() : ''; };
      var t = String(bodyText || '');
      var today = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
      var map = {
        '[NAME]': g('db-recipient'), '[CLASS]': '', '[TERM]': '', '[SESSION]': '',
        '[DATE]': today, '[REFERENCE]': g('db-ref'), '[SCHOOL]': this._school(),
        '[SIGNATORY]': g('db-signname') || g('db-signrole'), '[TITLE]': g('db-title')
      };
      Object.keys(map).forEach(function (k) { t = t.split(k).join(map[k]); });
      return t;
    },

    preview() {
      var p = d.getElementById('db-preview');
      if (!p) return;
      var body = d.getElementById('db-body').value || '';
      var title = d.getElementById('db-title').value.trim() || 'Untitled document';
      p.innerHTML = '<div style="font-weight:800;font-size:1.05rem;border-bottom:2px solid #0506ae;padding-bottom:8px;margin-bottom:12px">' + esc(title) + '</div>' +
        '<div style="white-space:pre-wrap">' + esc(this.fill(body)) + '</div>';
    },

    print() {
      var p = d.getElementById('db-preview');
      if (!p) return;
      var win = w.open('', '_blank');
      if (!win) { window.print(); return; }
      win.document.write('<!doctype html><html><head><title>' + esc(d.getElementById('db-title').value || 'Document') + '</title>' +
        '<style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;padding:0 24px;color:#111827;line-height:1.7} .doc-head{border-bottom:2px solid #0506ae;padding-bottom:10px;margin-bottom:20px;font-weight:800;font-size:1.15rem} .muted{color:#64748b;font-size:.85rem;margin-top:26px;border-top:1px solid #e2e8f0;padding-top:10px}</style></head><body>' +
        p.innerHTML +
        '<div class="muted">Generated by ' + esc(this._school()) + ' · ' + new Date().toLocaleString() + '</div>' +
        '<script>onload=function(){print();}<\/script></body></html>');
      win.document.close();
    },

    async save() {
      if (!w.sb) { if (w.toast) toast('Connect Supabase to save documents', 'warning'); return; }
      var g = function (id) { var el = d.getElementById(id); return el ? el.value.trim() : ''; };
      var title = g('db-title');
      var body = d.getElementById('db-body').value;
      if (!title || !body.trim()) { if (w.toast) toast('Title and body are required', 'warning'); return; }
      var row = {
        title: title,
        doc_type: g('db-type'),
        reference: g('db-ref') || null,
        recipient_name: g('db-recipient') || null,
        signatory_role: g('db-signrole') || null,
        signatory_name: g('db-signname') || null,
        body: body,
        status: g('db-status') || 'draft',
        issued_on: g('db-issued') || null,
        updated_at: new Date().toISOString()
      };
      try {
        var { error } = await w.sb.from('documents').insert(row);
        if (error) throw error;
        if (w.toast) toast('Document saved', 'success');
        try { if (w.CRUD) CRUD.renderList('documents'); } catch (_) {}
      } catch (e) {
        if (w.toast) toast(e.message || String(e), 'danger');
      }
    }
  };

  w.DocBuilder = Builder;
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { Builder.mount(); });
  else Builder.mount();
})(window, document);
