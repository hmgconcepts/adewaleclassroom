/* ═══════════════════════════════════════════════════════════════════════
   ADEWALE CLASSROOM — Messages Center (v44 / round-8 item 5)
   Real two-way threads inside the portal. Students and parents message
   their tutors and the admins; tutors message staff plus the families of
   their own classes; admins can reach everyone. Backed by the v44 RPCs:
     tc_message_directory() — who I may write to
     tc_message_send()      — validated send (+ notification row)
     tc_message_threads()   — inbox list with unread counts
     tc_message_thread()    — one conversation, marked read on open
     tc_message_unread()    — badge counter (also fed to the nav badge)
   The old WhatsApp / Email / SMS deep links survive as per-contact quick
   actions — they cost nothing and work on every phone.
   ═══════════════════════════════════════════════════════════════════════ */
window.MessagesCenter = (function () {
  "use strict";

  let threads = [], directory = [], active = null, activeName = "", unread = 0, pollTimer = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function initials(n) {
    return String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
  }
  function roleLabel(r) {
    return { admin: "Admin", owner: "Owner", director: "Director", lead_tutor: "Lead tutor", super_admin: "Admin", tutor: "Tutor", staff: "Staff", learner: "Learner", parent: "Parent" }[r] || (r || "");
  }

  async function rpc(fn, args) {
    if (!window.sb || !window.sb.rpc) throw new Error("Sign in to use messages.");
    const { data, error } = await window.sb.rpc(fn, args || {});
    if (error) throw new Error(error.message);
    return data;
  }

  /* ── layout ─────────────────────────────────────────────────────── */
  function render(rootId) {
    const root = document.getElementById(rootId || "messages-root");
    if (!root) return;
    root.innerHTML = `
      <div class="mc-shell">
        <div class="mc-side">
          <div class="mc-side-head">
            <strong>✉️ Your messages</strong>
            <button class="btn btn-sm" id="mc-new" type="button">✏️ New</button>
          </div>
          <div id="mc-threads" class="mc-list"><p class="muted mc-pad">Loading…</p></div>
        </div>
        <div class="mc-main" id="mc-main">
          <div class="mc-empty">
            <div class="mc-empty-em">💬</div>
            <b>Pick a conversation, or start a new message</b>
            <p class="muted">Your tutors and the admins reply here — nothing leaves the portal, so it works even without airtime.</p>
          </div>
        </div>
      </div>`;
    root.querySelector("#mc-new").addEventListener("click", renderPicker);
    loadAll(rootId);
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => { if (document.visibilityState === "visible") refreshBadges(); }, 45000);
  }

  async function loadAll(rootId) {
    try {
      const [t, d] = await Promise.all([rpc("tc_message_threads"), rpc("tc_message_directory")]);
      threads = Array.isArray(t) ? t : [];
      directory = Array.isArray(d) ? d : [];
      renderThreads();
      if (active) openThread(active, activeName, true);   /* keep the open conversation fresh */
      refreshBadges();
    } catch (e) {
      const host = document.getElementById("mc-threads");
      if (host) host.innerHTML = '<p class="mc-pad muted">' + esc(e.message) + "</p>";
    }
  }

  function renderThreads() {
    const host = document.getElementById("mc-threads");
    if (!host) return;
    if (!threads.length) {
      host.innerHTML = '<p class="mc-pad muted">No conversations yet. Tap <b>✏️ New</b> to message your tutor or the admin.</p>';
      return;
    }
    host.innerHTML = threads.map((t) => `
      <button type="button" class="mc-row${t.other === active ? " sel" : ""}" data-mc-open="${esc(t.other)}">
        <span class="mc-avatar">${esc(initials(t.other_name))}</span>
        <span class="mc-row-body">
          <span class="mc-row-top"><b>${esc(t.other_name)}</b>${Number(t.unread) > 0 ? '<i class="mc-dot">' + Number(t.unread) + "</i>" : ""}</span>
          <span class="mc-row-sub">${esc(t.last_body || "")}</span>
          <span class="mc-row-time">${esc(roleLabel(t.role))} · ${esc(t.last_at || "")}</span>
        </span>
      </button>`).join("");
    host.querySelectorAll("[data-mc-open]").forEach((b) =>
      b.addEventListener("click", () => openThread(b.getAttribute("data-mc-open"))));
  }

  /* ── new message picker (directory + WA/email/SMS quick links) ──── */
  function renderPicker() {
    const main = document.getElementById("mc-main");
    if (!main) return;
    const groups = { staff: [], family: [] };
    for (const p of directory) (["learner", "parent"].includes(p.role) ? groups.family : groups.staff).push(p);
    const row = (p) => `
      <button type="button" class="mc-row" data-mc-to="${esc(p.id)}">
        <span class="mc-avatar">${esc(initials(p.name))}</span>
        <span class="mc-row-body">
          <span class="mc-row-top"><b>${esc(p.name)}</b></span>
          <span class="mc-row-time">${esc(roleLabel(p.role))}</span>
        </span>
      </button>`;
    main.innerHTML = `
      <div class="mc-head">
        <strong>✏️ New message</strong>
        <button class="btn btn-sm btn-ghost mc-back" type="button">← Back</button>
      </div>
      <div class="mc-list mc-picker">
        <p class="mc-sec">Tutors &amp; admins</p>
        ${groups.staff.length ? groups.staff.map(row).join("") : '<p class="mc-pad muted">No staff found.</p>'}
        ${groups.family.length ? '<p class="mc-sec">Families</p>' + groups.family.map(row).join("") : ""}
      </div>`;
    main.querySelector(".mc-back").addEventListener("click", () => {
      const back = document.querySelector(".mc-row.sel");
      if (back) openThread(active); else render("messages-root");
    });
    main.querySelectorAll("[data-mc-to]").forEach((b) =>
      b.addEventListener("click", () => openComposer(b.getAttribute("data-mc-to"), directory)));
  }

  function openComposer(toId, list) {
    const p = (list || directory).find((x) => x.id === toId);
    const main = document.getElementById("mc-main");
    if (!main || !p) return;
    main.innerHTML = `
      <div class="mc-head">
        <strong>To: ${esc(p.name)} <span class="muted">· ${esc(roleLabel(p.role))}</span></strong>
        <button class="btn btn-sm btn-ghost mc-back" type="button">← Back</button>
      </div>
      <div class="mc-conv">
        <input class="input mc-subject" maxlength="200" placeholder="Subject (optional — e.g. Question about homework)">
        <textarea class="input mc-body" rows="5" maxlength="5000" placeholder="Write your message…"></textarea>
        <div class="mc-compose-row">
          <button class="btn btn-primary" id="mc-send" type="button">Send ➤</button>
          <span class="muted mc-hint">Goes straight to their portal inbox — they also get a notification.</span>
        </div>
      </div>`;
    main.querySelector(".mc-back").addEventListener("click", renderPicker);
    const send = async () => {
      const body = main.querySelector(".mc-body").value.trim();
      const subject = main.querySelector(".mc-subject").value.trim();
      if (!body) { main.querySelector(".mc-body").focus(); return; }
      const btn = main.querySelector("#mc-send");
      btn.disabled = true; btn.textContent = "Sending…";
      try {
        await rpc("tc_message_send", { p_to: p.id, p_subject: subject, p_body: body });
        active = p.id; activeName = p.name;
        await loadAll();
        openThread(p.id, p.name, true);
      } catch (e) {
        btn.disabled = false; btn.textContent = "Send ➤";
        alert(e.message);
      }
    };
    main.querySelector("#mc-send").addEventListener("click", send);
    main.querySelector(".mc-body").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send();
    });
    main.querySelector(".mc-body").focus();
  }

  /* ── conversation view ──────────────────────────────────────────── */
  async function openThread(other, name, silent) {
    const main = document.getElementById("mc-main");
    if (!main) return;
    if (!silent) { active = other; activeName = name || (threads.find((t) => t.other === other) || {}).other_name || "Conversation"; }
    main.innerHTML = '<div class="mc-empty"><p class="muted">Loading conversation…</p></div>';
    let msgs;
    try { msgs = await rpc("tc_message_thread", { p_other: other }); }
    catch (e) { main.innerHTML = '<div class="mc-empty"><p class="muted">' + esc(e.message) + "</p></div>"; return; }
    msgs = Array.isArray(msgs) ? msgs : [];
    main.innerHTML = `
      <div class="mc-head">
        <strong>💬 ${esc(activeName)}</strong>
        <button class="btn btn-sm btn-ghost" id="mc-reply-new" type="button">✏️ New message</button>
      </div>
      <div class="mc-msgs">${msgs.length ? msgs.map((m) => `
        <div class="mc-msg${m.mine ? " mine" : ""}">
          <div class="mc-bubble">
            ${m.subject ? "<b>" + esc(m.subject) + "</b>" : ""}
            <span>${esc(m.body).replace(/\n/g, "<br>")}</span>
          </div>
          <div class="mc-meta">${m.mine ? "You" : esc(m.sender_name)} · ${esc(m.at)}${m.mine ? (m.read ? " · read ✓✓" : " · sent ✓") : ""}</div>
        </div>`).join("") : '<p class="mc-pad muted">Say hello — this is the start of your conversation.</p>'}
      </div>
      <div class="mc-conv">
        <textarea class="input mc-reply" rows="3" maxlength="5000" placeholder="Reply… (Ctrl+Enter sends)"></textarea>
        <div class="mc-compose-row">
          <button class="btn btn-primary" id="mc-reply-send" type="button">Send ➤</button>
        </div>
      </div>`;
    const box = main.querySelector(".mc-msgs");
    if (box) box.scrollTop = box.scrollHeight;
    main.querySelector("#mc-reply-new").addEventListener("click", renderPicker);
    const sendReply = async () => {
      const ta = main.querySelector(".mc-reply");
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
    main.querySelector(".mc-reply").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendReply();
    });
    renderThreads();
    refreshBadges();
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

/* Inject the badge styles once (kept local so the page stays self-contained). */
(function () {
  if (document.getElementById("mc-styles")) return;
  const st = document.createElement("style");
  st.id = "mc-styles";
  st.textContent = `
.mc-shell{display:flex;gap:14px;min-height:64vh;background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden}
.mc-side{width:300px;flex:0 0 300px;border-right:1px solid #e2e8f0;display:flex;flex-direction:column;background:#f8fafc}
.mc-side-head{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid #e2e8f0}
.mc-main{flex:1;display:flex;flex-direction:column;min-width:0}
.mc-list{flex:1;overflow:auto;max-height:70vh}
.mc-pad{padding:14px}
.mc-sec{margin:10px 14px 4px;font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#64748b}
.mc-row{display:flex;gap:10px;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid #eef2f7;padding:10px 12px;cursor:pointer;align-items:center}
.mc-row:hover{background:#eef2ff}
.mc-row.sel{background:#e0e7ff}
.mc-avatar{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#0506ae,#964eec);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.8rem;flex:0 0 38px}
.mc-row-body{min-width:0;display:flex;flex-direction:column;gap:2px}
.mc-row-top{display:flex;justify-content:space-between;align-items:center;gap:8px}
.mc-row-top b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mc-row-sub{font-size:.82rem;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mc-row-time{font-size:.72rem;color:#94a3b8}
.mc-dot{background:#dc2626;color:#fff;border-radius:999px;font-size:.68rem;font-weight:800;padding:1px 7px;font-style:normal}
.mc-empty{margin:auto;text-align:center;padding:40px 20px;max-width:420px}
.mc-empty-em{font-size:44px}
.mc-head{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #e2e8f0}
.mc-msgs{flex:1;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:10px;max-height:52vh;background:#f8fafc}
.mc-msg{display:flex;flex-direction:column;max-width:78%}
.mc-msg.mine{align-self:flex-end;align-items:flex-end}
.mc-bubble{background:#fff;border:1px solid #e2e8f0;border-radius:14px 14px 14px 4px;padding:10px 12px;line-height:1.5;white-space:pre-wrap;word-break:break-word}
.mc-msg.mine .mc-bubble{background:#e0e7ff;border-color:#c7d2fe;border-radius:14px 14px 4px 14px}
.mc-bubble b{display:block;margin-bottom:4px}
.mc-meta{font-size:.7rem;color:#94a3b8;margin-top:3px}
.mc-conv{padding:12px 16px;border-top:1px solid #e2e8f0;display:flex;flex-direction:column;gap:8px;background:#fff}
.mc-conv .input{width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;font:inherit}
.mc-compose-row{display:flex;gap:10px;align-items:center}
.mc-hint{font-size:.75rem}
.mc-picker{background:#fff}
.mc-nav-badge{margin-left:6px;background:#dc2626;color:#fff;border-radius:999px;font-size:.66rem;font-weight:800;padding:1px 6px;display:inline-block}
@media (max-width:820px){.mc-shell{flex-direction:column}.mc-side{width:auto;flex:none;border-right:0;border-bottom:1px solid #e2e8f0}.mc-list{max-height:34vh}.mc-msgs{max-height:44vh}}
`;
  document.head.appendChild(st);
})();
