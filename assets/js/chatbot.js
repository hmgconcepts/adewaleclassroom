/* ====================================================================
   chatbot.js — Tutoring Connect studio assistant
   Page-aware, process-aware, rules only. NO AI API.
   ==================================================================== */
const Chatbot = {
  open: false,
  history: [],
  _init: false,

  init() {
    if (this._init) return;
    this._init = true;
    if (!window.TC || !TC.ASSISTANT) {
      const s = document.createElement('script');
      s.src = 'assets/js/assistant-kb.js';
      s.onload = () => { try { this.paintSuggest(); } catch (_) {} };
      document.head.appendChild(s);
    }
    this.ensureUi();
    this.bindUI();
    const name = (window.PRACTICE && PRACTICE.name) || 'this studio';
    const page = (window.TC && TC.ASSISTANT && TC.ASSISTANT.getPage().title) || 'this page';
    this.history.push({
      from: 'bot',
      msg: 'Hello — I am the **' + name + '** studio assistant (rules only, no AI API).\n\nYou are on **' + page + '**. Ask **“what is this page?”** for a full briefing (who / why / how / next), or ask how bookings, quizzes, applications, hour banks, privacy or deployment work.'
    });
  },

  ensureUi() {
    if (document.getElementById('chatbot-window')) return;
    if (!document.querySelector('[data-chatbot="open"]') && !document.getElementById('tc-chat-fab')) {
      const fab = document.createElement('button');
      fab.type = 'button';
      fab.className = 'tc-chat-fab';
      fab.setAttribute('data-chatbot', 'open');
      fab.setAttribute('aria-label', 'Open studio assistant');
      fab.textContent = '💬';
      fab.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:9997;width:52px;height:52px;border-radius:50%;border:0;background:linear-gradient(135deg,#134e4a,#0f766e);color:#fff;font-size:1.4rem;cursor:pointer;box-shadow:0 8px 20px rgba(19,78,74,.35)';
      document.body.appendChild(fab);
    }
    const win = document.createElement('div');
    win.id = 'chatbot-window';
    win.style.cssText = 'display:none;position:fixed;right:20px;bottom:80px;z-index:9998;width:min(420px,calc(100vw - 24px));height:min(560px,calc(100vh - 110px));background:#fff;border-radius:18px;box-shadow:0 20px 50px rgba(15,23,42,.25);flex-direction:column;overflow:hidden;border:1px solid #e2e8f0';
    win.innerHTML = '<div style="padding:12px 14px;background:linear-gradient(135deg,#134e4a,#0f766e);color:#fff;display:flex;justify-content:space-between;align-items:center;gap:8px">' +
      '<div><strong>Studio Assistant</strong><div style="font-size:.72rem;opacity:.85">Every page &amp; process · no AI API</div></div>' +
      '<button type="button" data-chatbot="close" style="border:0;background:transparent;color:#fff;font-size:1.2rem;cursor:pointer" aria-label="Close">×</button></div>' +
      '<div id="chatbot-suggest" style="display:flex;flex-wrap:wrap;gap:6px;padding:8px 10px;border-bottom:1px solid #e2e8f0;background:#f8fafc"></div>' +
      '<div id="chatbot-messages" style="flex:1;overflow:auto;padding:12px;background:#f8fafc"></div>' +
      '<div style="display:flex;gap:6px;padding:10px;border-top:1px solid #e2e8f0"><input id="chatbot-input" placeholder="Ask: what is this page?" style="flex:1;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px"><button type="button" class="btn btn-primary btn-sm" data-chatbot="send">Send</button></div>';
    document.body.appendChild(win);
    this.paintSuggest();
  },

  paintSuggest() {
    const host = document.getElementById('chatbot-suggest');
    if (!host) return;
    const chips = (window.TC && TC.ASSISTANT && TC.ASSISTANT.suggestFor()) || [
      'What is this page?', 'How do bookings work?', 'How do quizzes work?', 'How do I deploy?'
    ];
    host.innerHTML = chips.map(c => '<button type="button" data-chatbot="suggest" class="btn btn-outline btn-sm" style="font-size:.72rem">' + this.esc(c) + '</button>').join('');
  },

  bindUI() {
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-chatbot]');
      if (!t) return;
      const a = t.dataset.chatbot;
      if (a === 'open') this.toggle(true);
      if (a === 'close') this.toggle(false);
      if (a === 'send') this.handleSend();
      if (a === 'suggest') {
        const inp = document.getElementById('chatbot-input');
        if (inp) { inp.value = t.textContent.trim(); this.handleSend(); }
      }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.id === 'chatbot-input') {
        e.preventDefault();
        this.handleSend();
      }
    });
  },

  toggle(force) {
    this.ensureUi();
    const w = document.getElementById('chatbot-window');
    if (!w) return;
    this.open = force !== undefined ? force : !this.open;
    w.style.display = this.open ? 'flex' : 'none';
    if (this.open) {
      this.paintSuggest();
      this.render();
      const inp = document.getElementById('chatbot-input');
      if (inp) inp.focus();
    }
  },

  handleSend() {
    const inp = document.getElementById('chatbot-input');
    if (!inp) return;
    const msg = inp.value.trim();
    if (!msg) return;
    this.history.push({ from: 'user', msg });
    inp.value = '';
    this.render();
    setTimeout(() => {
      this.history.push({ from: 'bot', msg: this.respond(msg) });
      this.render();
    }, 220);
  },

  esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  respond(msg) {
    const q = String(msg || '').toLowerCase().trim();
    const A = window.TC && TC.ASSISTANT;

    if (/thank/.test(q)) return 'You are welcome. Ask **what is this page?** any time, or open the Feature Guide.';
    if (/^(hi|hello|hey)\b/.test(q)) {
      return 'Hi. I explain every page and process in this studio — no AI API.\n\nTry: **what is this page?**, **how do bookings work?**, **how do quizzes work?**, **how do I deploy?**';
    }
    if (/bye|goodbye/.test(q)) return 'Goodbye. WhatsApp HMG on +234 810 086 6322 if a human should take over.';

    // Current page briefing
    if (A && (/what is this page|explain this page|this page|where am i|what does this page|how does this page|page help|explain here/.test(q) || q === 'help' || q === '?')) {
      return A.formatPage(A.pageId());
    }

    // "what is X" against page titles
    if (A) {
      let best = null, bestS = 0;
      Object.keys(A.PAGES).forEach(id => {
        const g = A.PAGES[id];
        const keys = [id, (g.title || '').toLowerCase()].concat((g.title || '').toLowerCase().split(/\s+/));
        const s = A.score(q, keys);
        if (s > bestS) { bestS = s; best = id; }
      });
      if (best && bestS >= 5 && /what is|what's|explain|tell me about|how .* work|open /.test(q)) {
        return A.formatPage(best);
      }

      let proc = null, ps = 0;
      A.PROCESSES.forEach(p => {
        const s = A.score(q, p.m.concat([p.title, p.id]));
        if (s > ps) { ps = s; proc = p; }
      });
      if (proc && ps >= 3) return '**' + proc.title + '**\n\n' + proc.r;
    }

    // Legacy short KB
    const kb = (window.TC && TC.CHATBOT_KB) || [];
    let hit = null, hs = 0;
    kb.forEach(entry => {
      const keys = entry.match || entry.m || [];
      const s = A ? A.score(q, keys) : (keys.some(k => q.includes(k)) ? 2 : 0);
      if (s > hs) { hs = s; hit = entry; }
    });
    if (hit && hs >= 2) {
      const reply = hit.reply || hit.r || '';
      const page = hit.p || hit.page;
      return reply + (page ? '\n\nOpen: ' + page : '');
    }

    // Catalogue module name
    const mods = (window.TC && TC.MODULES) || [];
    const mod = mods.find(m => q.includes(String(m.name || '').toLowerCase()) || q.includes(String(m.id || '').replace(/_/g, ' ')));
    if (mod) {
      if (A) return A.formatPage((mod.file || '').replace('.html', '')) + '\n\n' + mod.desc;
      return '**' + mod.name + '** — ' + mod.desc + ' Open ' + mod.file;
    }

    if (A) return A.formatPage(A.pageId()) + '\n\nI did not find a closer match. Ask **how do bookings / quizzes / apply / deploy work?** or name a module. Human help: WhatsApp +234 810 086 6322.';
    return 'Try: **what is this page?**, **bookings**, **quizzes**, **deploy**, **Feature Guide**. WhatsApp +234 810 086 6322.';
  },

  render() {
    const list = document.getElementById('chatbot-messages');
    if (!list) return;
    const esc = this.esc.bind(this);
    list.innerHTML = this.history.map(m => {
      const html = esc(m.msg)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
      const bg = m.from === 'bot' ? '#fff' : '#134e4a';
      const color = m.from === 'bot' ? '#0f172a' : '#fff';
      const align = m.from === 'bot' ? 'flex-start' : 'flex-end';
      return '<div style="display:flex;justify-content:' + align + ';margin:6px 0"><div style="max-width:92%;background:' + bg + ';color:' + color + ';border:1px solid #e2e8f0;border-radius:14px;padding:10px 12px;font-size:.88rem;line-height:1.5">' + html + '</div></div>';
    }).join('');
    list.scrollTop = list.scrollHeight;
  }
};

window.Chatbot = Chatbot;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => Chatbot.init());
else Chatbot.init();
