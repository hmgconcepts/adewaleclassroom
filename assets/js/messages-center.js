/* ═══════════════════════════════════════════════════════════════════════
   ADEWALE CLASSROOM — Messages Center (v48 / round-12 item 4)

   A faithful WhatsApp replica on top of the same v44 RPCs:
     tc_message_directory() — who I may write to
     tc_message_send()      — validated send (+ bell notification, deep-linked)
     tc_message_threads()   — chat list with unread counts
     tc_message_thread()    — one conversation, marked read on open
     tc_message_unread()    — badge counter (also fed to the nav badge)

   WhatsApp behaviours implemented:
     · green app band + wallpaper chat area with a subtle doodle pattern
     · chat list: avatars, last message, time, green unread pills, search
     · bubbles with tails — outgoing #d9fdd3, incoming white — with the
       timestamp INSIDE the bubble and ✓ sent / ✓✓ read (blue) ticks
     · date separators (TODAY / YESTERDAY / date) between day groups
     · composer: rounded field, emoji quick bar, round green send button,
       Enter sends · Shift+Enter makes a newline
     · live-ish: the open conversation refreshes quietly every 30 s while
       you are not typing
     · phone layout: one pane at a time, with a back arrow in the chat
     The old WhatsApp / Email / SMS quick links survive as per-contact
     actions — they cost nothing and work on every phone.
   ═══════════════════════════════════════════════════════════════════════ */
window.MessagesCenter = (function () {
  "use strict";

  let threads = [], directory = [], active = null, activeName = "", unread = 0;
  let pollTimer = null, threadTimer = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function initials(n) {
    return String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
  }
  function roleLabel(r) {
    return { admin: "Admin", owner: "Owner", director: "Director", lead_tutor: "Lead tutor", super_admin: "Admin", tutor: "Tutor", staff: "Staff", learner: "Learner", parent: "Parent" }[r] || (r || "");
  }
  const AV_COLORS = ["#00a884", "#128c7e", "#34b7f1", "#7f66ff", "#e542a3", "#f2994a", "#2eb872"];
  function avColor(seed) {
    let h = 0; const s = String(seed || "");
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return AV_COLORS[h % AV_COLORS.length];
  }

  async function rpc(fn, args) {
    if (!window.sb || !window.sb.rpc) throw new Error("Sign in to use messages.");
    const { data, error } = await window.sb.rpc(fn, args || {});
    if (error) throw new Error(error.message);
    return data;
  }

  /* ── app shell ─────────────────────────────────────────────────── */
  function render(rootId) {
    const root = document.getElementById(rootId || "messages-root");
    if (!root) return;
    root.innerHTML = `
      <div class="mc-app">
        <div class="mc-band">💬 ADEWALE CLASSROOM · Messages <span class="mc-band-note">end-to-end inside your portal</span></div>
        <div class="mc-shell">
          <aside class="mc-side" id="mc-side">
            <header class="mc-side-head">
              <b>Chats</b>
              <button class="mc-icon-btn" id="mc-new" type="button" title="New chat">✏️</button>
            </header>
            <div class="mc-search"><input id="mc-search" type="search" placeholder="🔍 Search or start a new chat" autocomplete="off"></div>
            <div id="mc-threads" class="mc-list"><p class="mc-pad muted">Loading…</p></div>
          </aside>
          <section class="mc-main" id="mc-main">
            <div class="mc-welcome">
              <div class="mc-welcome-em">💬</div>
              <b>Adewale Classroom Messages</b>
              <p class="muted">Pick a chat on the left, or tap ✏️ to start one. Your tutors and admins reply here — nothing leaves the portal, so it works even without airtime.</p>
            </div>
          </section>
        </div>
      </div>`;
    root.querySelector("#mc-new").addEventListener("click", renderPicker);
    root.querySelector("#mc-search").addEventListener("input", (e) => renderThreads(e.target.value));
    loadAll(rootId);
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => { if (document.visibilityState === "visible") refreshBadges(); }, 45000);
    if (threadTimer) clearInterval(threadTimer);
    threadTimer = setInterval(async () => {
      /* quiet live refresh — only when the tab is visible and the user is
         NOT mid-composition, exactly like WhatsApp Web's background sync */
      if (!active || document.visibilityState !== "visible") return;
      const ta = document.querySelector(".mc-reply");
      if (ta && ta.value.trim()) return;
      await openThread(active, activeName, true);
    }, 30000);
  }

  async function loadAll(rootId) {
    try {
      const [t, d] = await Promise.all([rpc("tc_message_threads"), rpc("tc_message_directory")]);
      threads = Array.isArray(t) ? t : [];
      directory = Array.isArray(d) ? d : [];
      renderThreads("");
      if (active) openThread(active, activeName, true);   /* keep the open conversation fresh */
      refreshBadges();
    } catch (e) {
      const host = document.getElementById("mc-threads");
      if (host) host.innerHTML = '<p class="mc-pad muted">' + esc(e.message) + "</p>";
    }
  }

  /* ── chat list (WhatsApp left pane) ─────────────────────────────── */
  function renderThreads(filterText) {
    const host = document.getElementById("mc-threads");
    if (!host) return;
    const q = String(filterText || "").trim().toLowerCase();
    const list = q ? threads.filter((t) =>
      String(t.other_name || "").toLowerCase().includes(q) ||
      String(t.last_body || "").toLowerCase().includes(q)) : threads;
    if (!list.length) {
      host.innerHTML = q
        ? '<p class="mc-pad muted">No chats matching “' + esc(filterText) + '”.</p>'
        : '<p class="mc-pad muted">No chats yet. Tap <b>✏️</b> to message your tutor or the admin.</p>';
      return;
    }
    host.innerHTML = list.map((t) => {
      const sel = t.other === active ? " sel" : "";
      const n = Number(t.unread) > 0;
      const time = String(t.last_at || "").split(" ")[1] || "";
      return `
      <button type="button" class="mc-row${sel}" data-mc-open="${esc(t.other)}">
        <span class="mc-avatar" style="background:${avColor(t.other)}">${esc(initials(t.other_name))}</span>
        <span class="mc-row-body">
          <span class="mc-row-top"><b>${esc(t.other_name)}</b><i class="mc-row-time">${esc(time)}</i></span>
          <span class="mc-row-sub">${esc((t.last_body || "").slice(0, 64))}</span>
        </span>
        ${n ? '<i class="mc-pill">' + (Number(t.unread) > 99 ? "99+" : Number(t.unread)) + "</i>" : ""}
      </button>`;
    }).join("");
    host.querySelectorAll("[data-mc-open]").forEach((b) =>
      b.addEventListener("click", () => {
        const t = threads.find((x) => x.other === b.getAttribute("data-mc-open")) || {};
        openThread(t.other, t.other_name);
      }));
  }

  /* ── new chat picker ────────────────────────────────────────────── */
  function renderPicker() {
    const main = document.getElementById("mc-main");
    if (!main) return;
    const groups = { staff: [], family: [] };
    for (const p of directory) (["learner", "parent"].includes(p.role) ? groups.family : groups.staff).push(p);
    const row = (p) => `
      <button type="button" class="mc-row" data-mc-to="${esc(p.id)}">
        <span class="mc-avatar" style="background:${avColor(p.id + p.name)}">${esc(initials(p.name))}</span>
        <span class="mc-row-body">
          <span class="mc-row-top"><b>${esc(p.name)}</b></span>
          <span class="mc-row-sub">${esc(roleLabel(p.role))}</span>
        </span>
      </button>`;
    main.innerHTML = `
      <header class="mc-head">
        <button class="mc-icon-btn mc-back" type="button" title="Back">←</button>
        <b>New chat</b>
      </header>
      <div class="mc-list mc-picker">
        <p class="mc-sec">Tutors &amp; admins</p>
        ${groups.staff.length ? groups.staff.map(row).join("") : '<p class="mc-pad muted">No staff found.</p>'}
        ${groups.family.length ? '<p class="mc-sec">Families</p>' + groups.family.map(row).join("") : ""}
      </div>`;
    main.querySelector(".mc-back").addEventListener("click", () => {
      const open = document.querySelector(".mc-row.sel");
      if (open && active) openThread(active, activeName, true); else location.reload();
    });
    main.querySelectorAll("[data-mc-to]").forEach((b) =>
      b.addEventListener("click", () => openComposer(b.getAttribute("data-mc-to"), directory)));
  }

  function openComposer(toId, list) {
    const p = (list || directory).find((x) => x.id === toId);
    const main = document.getElementById("mc-main");
    if (!main || !p) return;
    main.innerHTML = `
      <header class="mc-head">
        <button class="mc-icon-btn mc-back" type="button" title="Back">←</button>
        <span class="mc-avatar mc-head-av" style="background:${avColor(p.id + p.name)}">${esc(initials(p.name))}</span>
        <span class="mc-head-txt"><b>To: ${esc(p.name)}</b><small>${esc(roleLabel(p.role))}</small></span>
      </header>
      <div class="mc-conv mc-conv-new">
        <input class="mc-field mc-subject" maxlength="200" placeholder="Subject (optional — e.g. Question about homework)">
        <textarea class="mc-field mc-body" rows="5" maxlength="5000" placeholder="Write your message…"></textarea>
        <div class="mc-compose-row">
          <button class="mc-round-send" id="mc-send" type="button" title="Send">➤</button>
          <span class="muted mc-hint">Goes straight to their portal inbox — they also get a bell notification that opens this chat.</span>
        </div>
      </div>`;
    main.querySelector(".mc-back").addEventListener("click", renderPicker);
    const send = async () => {
      const body = main.querySelector(".mc-body").value.trim();
      const subject = main.querySelector(".mc-subject").value.trim();
      if (!body) { main.querySelector(".mc-body").focus(); return; }
      const btn = main.querySelector("#mc-send");
      btn.disabled = true;
      try {
        await rpc("tc_message_send", { p_to: p.id, p_subject: subject, p_body: body });
        active = p.id; activeName = p.name;
        await loadAll();
        openThread(p.id, p.name, true);
      } catch (e) {
        btn.disabled = false;
        alert(e.message);
      }
    };
    main.querySelector("#mc-send").addEventListener("click", send);
    main.querySelector(".mc-body").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send();
    });
    main.querySelector(".mc-body").focus();
  }

  /* ── conversation (WhatsApp right pane) ─────────────────────────── */
  function dayLabel(at) {
    /* at = 'YYYY-MM-DD HH24:MI' from tc_message_thread */
    const d = String(at || "").split(" ")[0];
    if (!d) return "";
    const today = new Date(); const pad = (x) => String(x).padStart(2, "0");
    const iso = (x) => x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate());
    if (d === iso(today)) return "TODAY";
    const y = new Date(today); y.setDate(y.getDate() - 1);
    if (d === iso(y)) return "YESTERDAY";
    const p = d.split("-");
    return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : d;
  }

  function bubbleHTML(m) {
    const time = String(m.at || "").split(" ")[1] || "";
    const ticks = m.mine
      ? (m.read ? '<span class="mc-ticks read" title="Read">✓✓</span>' : '<span class="mc-ticks" title="Sent">✓</span>')
      : "";
    return `
      <div class="mc-msg${m.mine ? " mine" : ""}">
        <div class="mc-bubble">
          ${m.subject ? "<b>" + esc(m.subject) + "</b>" : ""}
          <span>${esc(m.body).replace(/\n/g, "<br>")}</span>
          <span class="mc-btime">${esc(time)} ${ticks}</span>
        </div>
      </div>`;
  }

  async function openThread(other, name, silent) {
    const main = document.getElementById("mc-main");
    if (!main) return;
    if (!silent) {
      active = other;
      activeName = name || (threads.find((t) => t.other === other) || {}).other_name || "Conversation";
    }
    main.innerHTML = '<div class="mc-welcome"><p class="muted"><span class="pulse">Loading conversation…</span></p></div>';
    let msgs;
    try { msgs = await rpc("tc_message_thread", { p_other: other }); }
    catch (e) { main.innerHTML = '<div class="mc-welcome"><p class="muted">' + esc(e.message) + "</p></div>"; return; }
    msgs = Array.isArray(msgs) ? msgs : [];

    /* group by day with WhatsApp date separators */
    const parts = [];
    let lastDay = "";
    for (const m of msgs) {
      const d = String(m.at || "").split(" ")[0];
      if (d && d !== lastDay) { parts.push('<div class="mc-day">' + dayLabel(m.at) + "</div>"); lastDay = d; }
      parts.push(bubbleHTML(m));
    }

    main.innerHTML = `
      <header class="mc-head">
        <button class="mc-icon-btn mc-back" type="button" title="Back">←</button>
        <span class="mc-avatar mc-head-av" style="background:${avColor(other)}">${esc(initials(activeName))}</span>
        <span class="mc-head-txt"><b>${esc(activeName)}</b><small>${esc(roleLabel((threads.find((t) => t.other === other) || {}).role)) || "Chat"}</small></span>
        <button class="mc-icon-btn" id="mc-reply-new" type="button" title="New chat">✏️</button>
      </header>
      <div class="mc-msgs" id="mc-msgs">
        ${parts.length ? parts.join("") : '<div class="mc-day">TODAY</div><p class="mc-pad muted">Say hello — this is the start of your conversation. 🔒 Messages stay inside the portal.</p>'}
        <button class="mc-jump" id="mc-jump" type="button" title="Scroll to latest" hidden>▾</button>
      </div>
      <footer class="mc-conv">
        <div class="mc-emoji-bar" id="mc-emoji" hidden>
          ${["😀","😂","😊","🙏","❤️","👍","👏","🎉","🤔","😢","📚","✏️","🕐","✅","❌","💡"].map((e) => `<button type="button" class="mc-emoji" data-em="${e}">${e}</button>`).join("")}
        </div>
        <div class="mc-compose">
          <button class="mc-icon-btn" id="mc-emoji-toggle" type="button" title="Emoji">😀</button>
          <textarea class="mc-field mc-reply" rows="1" maxlength="5000" placeholder="Type a message"></textarea>
          <button class="mc-round-send" id="mc-reply-send" type="button" title="Send">➤</button>
        </div>
      </footer>`;

    const box = main.querySelector("#mc-msgs");
    const jump = main.querySelector("#mc-jump");
    const ta = main.querySelector(".mc-reply");
    if (box) {
      box.scrollTop = box.scrollHeight;
      const nearBottom = () => box.scrollHeight - box.scrollTop - box.clientHeight < 120;
      box.addEventListener("scroll", () => { if (jump) jump.hidden = nearBottom(); });
    }
    if (jump) jump.addEventListener("click", () => { if (box) box.scrollTop = box.scrollHeight; jump.hidden = true; });

    main.querySelector(".mc-back").addEventListener("click", () => {
      document.getElementById("mc-side") && document.getElementById("mc-side").classList.remove("mc-hide-phone");
      const shell = document.querySelector(".mc-shell");
      if (shell) shell.classList.remove("mc-thread-open");
      renderThreads("");
    });
    main.querySelector("#mc-reply-new").addEventListener("click", renderPicker);

    const emojiBar = main.querySelector("#mc-emoji");
    main.querySelector("#mc-emoji-toggle").addEventListener("click", () => { if (emojiBar) emojiBar.hidden = !emojiBar.hidden; });
    if (emojiBar) emojiBar.querySelectorAll(".mc-emoji").forEach((b) =>
      b.addEventListener("click", () => {
        ta.value += b.getAttribute("data-em");
        ta.focus();
      }));

    const sendReply = async () => {
      const val = ta.value.trim();
      if (!val) return;
      const btn = main.querySelector("#mc-reply-send");
      btn.disabled = true;
      try {
        await rpc("tc_message_send", { p_to: other, p_subject: "", p_body: val });
        ta.value = "";
        await loadAll();
        openThread(other, activeName, true);
      } catch (e) { btn.disabled = false; alert(e.message); }
    };
    main.querySelector("#mc-reply-send").addEventListener("click", sendReply);
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); }   /* WhatsApp: Enter sends */
    });
    ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(120, ta.scrollHeight) + "px"; });
    ta.focus();

    renderThreads("");
    refreshBadges();
    const shell = document.querySelector(".mc-shell");
    if (shell) shell.classList.add("mc-thread-open");   /* phone: slide to the chat */
  }

  /* ── unread badge: this page + every nav link to messages.html ──── */
  async function refreshBadges() {
    try { unread = Number(await rpc("tc_message_unread")) || 0; } catch (e) { return; }
    const set = (el) => {
      let b = el.querySelector(".mc-nav-badge");
      if (unread > 0) {
        if (!b) { b = document.createElement("span"); b.className = "mc-nav-badge"; el.appendChild(b); }
        b.textContent = unread > 99 ? "99+" : String(unread);
      } else if (b) b.remove();
    };
    document.querySelectorAll('a[href="messages.html"], [data-nav-messages]').forEach(set);
  }

  return { render, refreshBadges, openThread };
})();

/* Inject the WhatsApp replica styles once (self-contained page). */
(function () {
  if (document.getElementById("mc-styles")) return;
  const st = document.createElement("style");
  st.id = "mc-styles";
  st.textContent = `
.mc-app{border-radius:14px;overflow:hidden;box-shadow:0 10px 34px rgba(15,23,42,.16);background:#dcdcd2}
.mc-band{background:#00a884;color:#fff;padding:14px 18px;font-weight:800;display:flex;align-items:center;gap:10px}
.mc-band-note{font-weight:400;font-size:.75rem;opacity:.85;margin-left:auto}
.mc-shell{display:flex;height:72vh;min-height:480px;background:#fff}
.mc-side{width:330px;flex:0 0 330px;border-right:1px solid #e1e4e6;display:flex;flex-direction:column;background:#fff}
.mc-side-head{display:flex;justify-content:space-between;align-items:center;padding:13px 16px;background:#f0f2f5;border-bottom:1px solid #e1e4e6}
.mc-side-head b{font-size:1.02rem;color:#111b21}
.mc-icon-btn{background:none;border:0;font-size:1.05rem;cursor:pointer;color:#54656f;padding:6px 8px;border-radius:8px}
.mc-icon-btn:hover{background:#e9edef}
.mc-search{padding:8px 10px;background:#f0f2f5}
.mc-search input{width:100%;box-sizing:border-box;border:0;outline:0;background:#fff;border-radius:18px;padding:9px 14px;font:inherit;font-size:.88rem;color:#111b21}
.mc-list{flex:1;overflow:auto;background:#fff}
.mc-pad{padding:14px}
.mc-sec{margin:10px 14px 4px;font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#667781}
.mc-row{display:flex;gap:12px;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid #f0f2f5;padding:11px 14px;cursor:pointer;align-items:center}
.mc-row:hover{background:#f5f6f6}
.mc-row.sel{background:#f0f2f5}
.mc-avatar{width:42px;height:42px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.85rem;flex:0 0 42px}
.mc-row-body{min-width:0;display:flex;flex-direction:column;gap:2px;flex:1}
.mc-row-top{display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%}
.mc-row-top b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#111b21}
.mc-row-time{font-size:.72rem;color:#667781;font-style:normal;flex:0 0 auto}
.mc-row-sub{font-size:.83rem;color:#667781;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mc-pill{background:#25d366;color:#fff;border-radius:999px;font-size:.7rem;font-weight:800;padding:2px 7px;font-style:normal;flex:0 0 auto}
.mc-main{flex:1;display:flex;flex-direction:column;min-width:0;background:#efeae2}
.mc-welcome{margin:auto;text-align:center;padding:40px 24px;max-width:420px;color:#111b21}
.mc-welcome-em{font-size:52px;margin-bottom:8px}
.mc-head{display:flex;align-items:center;gap:10px;padding:9px 14px;background:#f0f2f5;border-bottom:1px solid #e1e4e6;min-height:58px}
.mc-head-av{width:38px;height:38px;flex:0 0 38px;font-size:.8rem}
.mc-head-txt{display:flex;flex-direction:column;min-width:0;flex:1}
.mc-head-txt b{color:#111b21;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mc-head-txt small{color:#667781;font-size:.75rem}
.mc-msgs{flex:1;overflow:auto;padding:18px 7% 14px;display:flex;flex-direction:column;gap:3px;background:#efeae2;background-image:radial-gradient(rgba(0,0,0,.028) 1.1px,transparent 1.1px),radial-gradient(rgba(0,0,0,.028) 1.1px,transparent 1.1px);background-size:26px 26px;background-position:0 0,13px 13px;position:relative}
.mc-day{align-self:center;background:#fff;color:#54656f;font-size:.72rem;font-weight:700;padding:5px 12px;border-radius:8px;box-shadow:0 1px 1px rgba(11,20,26,.13);margin:10px 0 6px;text-transform:uppercase;letter-spacing:.03em}
.mc-msg{display:flex;flex-direction:column;max-width:72%;margin-top:2px}
.mc-msg.mine{align-self:flex-end;align-items:flex-end}
.mc-bubble{position:relative;background:#fff;border-radius:8px 0 8px 8px;padding:7px 10px 20px;line-height:1.45;white-space:pre-wrap;word-break:break-word;box-shadow:0 1px .5px rgba(11,20,26,.13);font-size:.93rem;color:#111b21}
.mc-msg.mine .mc-bubble{background:#d9fdd3;border-radius:0 8px 8px 8px}
.mc-bubble b{display:block;margin-bottom:4px}
.mc-btime{position:absolute;right:8px;bottom:5px;font-size:.68rem;color:#667781;white-space:nowrap;display:inline-flex;gap:3px;align-items:center}
.mc-ticks{color:#667781;font-size:.78rem;font-style:normal}
.mc-ticks.read{color:#53bdeb}
.mc-jump{position:sticky;bottom:6px;align-self:center;background:#00a884;color:#fff;border:0;border-radius:50%;width:38px;height:38px;font-size:1rem;cursor:pointer;box-shadow:0 2px 8px rgba(11,20,26,.3)}
.mc-conv{padding:8px 12px;background:#f0f2f5;border-top:1px solid #e1e4e6}
.mc-conv-new{display:flex;flex-direction:column;gap:10px;margin:auto;max-width:560px;width:100%;padding:20px 12px;background:#f0f2f5}
.mc-field{width:100%;box-sizing:border-box;background:#fff;border:0;outline:0;border-radius:18px;padding:11px 16px;font:inherit;font-size:.9rem;color:#111b21;resize:none}
.mc-subject{border-radius:10px}
.mc-compose{display:flex;align-items:flex-end;gap:8px}
.mc-compose .mc-reply{flex:1}
.mc-round-send{width:44px;height:44px;flex:0 0 44px;border-radius:50%;border:0;background:#00a884;color:#fff;font-size:1.15rem;cursor:pointer;box-shadow:0 2px 6px rgba(11,20,26,.2)}
.mc-round-send:hover{background:#029876}
.mc-round-send:disabled{opacity:.6;cursor:default}
.mc-compose-row{display:flex;gap:10px;align-items:center}
.mc-hint{font-size:.75rem}
.mc-emoji-bar{display:flex;flex-wrap:wrap;gap:4px;background:#fff;border-radius:12px;padding:8px;margin-bottom:8px}
.mc-emoji{background:none;border:0;font-size:1.25rem;cursor:pointer;padding:4px 6px;border-radius:8px}
.mc-emoji:hover{background:#f0f2f5}
.mc-picker{background:#fff}
.mc-nav-badge{margin-left:6px;background:#25d366;color:#fff;border-radius:999px;font-size:.66rem;font-weight:800;padding:1px 7px;display:inline-block}
@media (max-width:820px){
  .mc-shell{position:relative}
  .mc-side{width:100%;flex:1 1 auto}
  .mc-main{position:absolute;inset:0;transform:translateX(100%);transition:transform .18s ease;z-index:5}
  .mc-shell.mc-thread-open .mc-main{transform:translateX(0)}
  .mc-msg{max-width:86%}
  .mc-msgs{padding:14px 4% 12px}
}
`;
  document.head.appendChild(st);
})();
