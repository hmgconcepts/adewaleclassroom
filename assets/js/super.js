/* Chatbot, command palette, PWA helpers, free-channel fan-out. No AI. */
const Super = {
  init(sb, practice) {
    this.sb = sb; this.practice = practice || window.PRACTICE || {};
    this.chatbot.mount();
    this.palette.mount();
  },
  chatbot: {
    mount() {
      /* Single assistant: Chatbot.js + assistant-kb.js. Do not mount a second fab. */
      try { if (window.Chatbot) Chatbot.init(); } catch (_) {}
    },
    toggle(force) { try { if (window.Chatbot) Chatbot.toggle(force); } catch (_) {} },
    ask(q) {
      try {
        if (!window.Chatbot) return;
        const inp = document.getElementById('chatbot-input');
        if (inp) inp.value = q || '';
        Chatbot.toggle(true);
        Chatbot.handleSend();
      } catch (_) {}
    }
  },
  palette: {
    mount() {
      if (document.getElementById('tc-pal')) return;
      const wrap = document.createElement('div');
      wrap.id = 'tc-pal'; wrap.className = 'modal-backdrop';
      wrap.innerHTML = `<div class="modal" style="max-width:560px"><div class="modal-body">
        <input class="form-input" id="tc-pal-q" placeholder="Jump to a module… (Ctrl/Cmd+K)">
        <div id="tc-pal-list" style="margin-top:10px;max-height:320px;overflow:auto"></div></div></div>`;
      document.body.appendChild(wrap);
      document.getElementById('tc-pal-q').oninput = () => this.render();
    },
    toggle() {
      const el = document.getElementById('tc-pal');
      if (!el) return;
      el.classList.toggle('show');
      if (el.classList.contains('show')) { this.render(); document.getElementById('tc-pal-q').focus(); }
    },
    render() {
      const q = (document.getElementById('tc-pal-q').value || '').toLowerCase();
      const mods = (window.TC && TC.MODULES) || [];
      document.getElementById('tc-pal-list').innerHTML = mods.filter(m => !q || (m.name + m.desc).toLowerCase().includes(q)).slice(0, 20)
        .map(m => `<a class="card" style="display:block;margin-bottom:8px;padding:10px" href="${m.file}"><b>${m.name}</b><div class="muted">${m.desc.slice(0,110)}…</div></a>`).join('');
    }
  },
  notifyFree({ title, body, phones, emails }) {
    const text = encodeURIComponent(`${title || ''}\n${body || ''}`);
    const acts = [];
    if (window.TC_CONFIRM_FREE_WA && phones && phones[0]) acts.push(`https://wa.me/${String(phones[0]).replace(/\D/g,'')}?text=${text}`);
    if (window.TC_CONFIRM_FREE_EMAIL && emails && emails[0]) acts.push(`mailto:${emails.join(',')}?subject=${encodeURIComponent(title||'Update')}&body=${text}`);
    if (window.TC_CONFIRM_FREE_SMS && phones && phones[0]) acts.push(`sms:${phones[0]}?body=${text}`);
    return acts;
  }
};
window.Super = Super;
/* PWAInstall lives in pwa-install.js — do not overwrite it here. */
