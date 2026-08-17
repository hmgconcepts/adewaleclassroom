/* ============================================================================
   record-actions.js — Tutoring Connect V14
   ----------------------------------------------------------------------------
   Reported (items 24, 25 and the general case in 29): several hand-built pages
   could CREATE records but never edit or delete them. Reading assignments and
   Classwork were the clearest examples — a typo in a title, a wrong due date or
   a dead link was permanent.

   The 74 CRUD-driven pages already get edit/delete from crud.js. This gives the
   same capability to any hand-built list with three lines of wiring:

       RecordActions.attach(document.getElementById('list'), {
         table : 'reading_assignments',
         rows  : data,
         title : r => r.title,
         fields: [ {key:'title', label:'Title'},
                   {key:'due_on', label:'Due', type:'date'},
                   {key:'status', label:'Status', type:'select',
                    options:['draft','published','archived']} ],
         onSaved: boot
       });

   It renders each row with Edit / Duplicate / Delete, opens a modal built from
   the field list, and writes back with the SAME blank-to-NULL coercion that
   crud.js uses — so a cleared number or date never produces
   `invalid input syntax for type numeric: ""`.
   ========================================================================== */
(function (w, d) {
  'use strict';

  var RA = {
    BLANK_IS_NULL: ['number', 'date', 'datetime-local', 'ref', 'time', 'month'],

    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    },
    sb: function () { return w.sb || (w.App && w.App.sb) || null; },

    /** Render a list with per-row actions. */
    attach: function (host, opts) {
      if (!host) return;
      opts = opts || {};
      var rows = opts.rows || [];
      var self = this;
      if (!rows.length) {
        host.innerHTML = '<p class="muted">' + (opts.empty || 'Nothing here yet.') + '</p>';
        return;
      }
      host.innerHTML = rows.map(function (r, i) {
        var body = opts.render ? opts.render(r) :
          '<b>' + self.esc(opts.title ? opts.title(r) : (r.title || r.name || r.id)) + '</b>';
        return '<div class="card ra-row" style="margin-bottom:8px;display:flex;gap:10px;align-items:flex-start">' +
          '<div style="flex:1;min-width:0">' + body + '</div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;white-space:nowrap">' +
            '<button class="btn btn-sm btn-outline" type="button" data-ra-edit="' + i + '">Edit</button>' +
            (opts.duplicate === false ? '' :
              '<button class="btn btn-sm btn-ghost" type="button" data-ra-dup="' + i + '">Duplicate</button>') +
            '<button class="btn btn-sm btn-ghost" type="button" data-ra-del="' + i + '" style="color:#b42318">Delete</button>' +
          '</div></div>';
      }).join('');

      host.querySelectorAll('[data-ra-edit]').forEach(function (b) {
        b.onclick = function () { self.openEditor(rows[+b.dataset.raEdit], opts, false); };
      });
      host.querySelectorAll('[data-ra-dup]').forEach(function (b) {
        b.onclick = function () { self.openEditor(rows[+b.dataset.raDup], opts, true); };
      });
      host.querySelectorAll('[data-ra-del]').forEach(function (b) {
        b.onclick = function () { self.remove(rows[+b.dataset.raDel], opts); };
      });
    },

    openEditor: function (row, opts, asCopy) {
      var self = this;
      var fields = opts.fields || Object.keys(row)
        .filter(function (k) { return ['id', 'created_at', 'updated_at'].indexOf(k) === -1; })
        .map(function (k) { return { key: k, label: k.replace(/_/g, ' ') }; });

      var body = '<div class="grid grid-2" style="gap:10px">' + fields.map(function (f) {
        var v = row[f.key] == null ? '' : row[f.key];
        var ctl;
        if (f.type === 'select') {
          ctl = '<select class="form-select" data-f="' + f.key + '">' +
            (f.options || []).map(function (o) {
              return '<option value="' + self.esc(o) + '"' + (String(v) === String(o) ? ' selected' : '') + '>' + self.esc(o) + '</option>';
            }).join('') + '</select>';
        } else if (f.type === 'textarea') {
          ctl = '<textarea class="form-textarea" rows="3" data-f="' + f.key + '">' + self.esc(v) + '</textarea>';
        } else {
          ctl = '<input class="form-input" type="' + (f.type || 'text') + '" data-f="' + f.key +
                '" value="' + self.esc(v) + '">';
        }
        return '<div class="form-group"' + (f.wide ? ' style="grid-column:1/-1"' : '') + '>' +
               '<label>' + self.esc(f.label || f.key) + '</label>' + ctl + '</div>';
      }).join('') + '</div>';

      var footer = '<button class="btn btn-outline" type="button" onclick="closeModal()">Cancel</button>' +
                   '<button class="btn btn-primary" type="button" id="ra-save">' +
                   (asCopy ? 'Create copy' : 'Save changes') + '</button>';

      if (typeof w.openModal !== 'function') { alert('This page cannot open the editor.'); return; }
      w.openModal((asCopy ? 'Duplicate: ' : 'Edit: ') +
                  (opts.title ? opts.title(row) : (row.title || row.name || 'record')), body, footer);

      setTimeout(function () {
        var btn = d.getElementById('ra-save');
        if (!btn) return;
        btn.onclick = async function () {
          var patch = {};
          d.querySelectorAll('[data-f]').forEach(function (el) {
            var f = fields.filter(function (x) { return x.key === el.dataset.f; })[0] || {};
            var v = el.value;
            if (typeof v === 'string') v = v.trim();
            if (v === '') { patch[el.dataset.f] = self.BLANK_IS_NULL.indexOf(f.type) !== -1 ? null : null; return; }
            patch[el.dataset.f] = (f.type === 'number') ? (isFinite(Number(v)) ? Number(v) : null) : v;
          });
          var sb = self.sb();
          if (!sb) { if (w.toast) w.toast('Connect Supabase to save.', 'warning'); return; }
          btn.disabled = true; btn.textContent = 'Saving…';
          var res;
          if (asCopy) {
            var copy = Object.assign({}, row, patch);
            delete copy.id; delete copy.created_at; delete copy.updated_at;
            res = await sb.from(opts.table).insert(copy);
          } else {
            res = await sb.from(opts.table).update(patch).eq('id', row.id);
          }
          btn.disabled = false; btn.textContent = asCopy ? 'Create copy' : 'Save changes';
          if (res.error) { if (w.toast) w.toast(res.error.message, 'danger'); return; }
          if (w.toast) w.toast(asCopy ? 'Copy created.' : 'Saved.', 'success');
          if (typeof w.closeModal === 'function') w.closeModal();
          if (opts.onSaved) opts.onSaved();
        };
      }, 40);
    },

    remove: async function (row, opts) {
      var label = opts.title ? opts.title(row) : (row.title || row.name || 'this record');
      if (!w.confirm('Delete "' + label + '" permanently?\n\nThis cannot be undone.')) return;
      var sb = this.sb();
      if (!sb) { if (w.toast) w.toast('Connect Supabase to delete.', 'warning'); return; }
      var res = await sb.from(opts.table).delete().eq('id', row.id);
      if (res.error) { if (w.toast) w.toast(res.error.message, 'danger'); return; }
      if (w.toast) w.toast('Deleted.', 'success');
      if (opts.onSaved) opts.onSaved();
    }
  };

  w.RecordActions = RA;
})(window, document);
