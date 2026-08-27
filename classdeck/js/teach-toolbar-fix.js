/* teach-toolbar-fix.js — V36
   Ensures every topbar control works even if an earlier script threw,
   a modal is missing, or an overlay intercepted clicks.
*/
(function (w, d) {
  'use strict';
  function $(s, r) { return (r || d).querySelector(s); }
  function toast(m, t) {
    try { if (typeof w.toast === 'function') return w.toast(m, t || '', 3200); } catch (e) {}
    console.log('[deck]', m);
  }
  function openModalSafe(id) {
    var m = $(id);
    if (!m) { toast('Panel not available on this page', 'err'); return; }
    m.classList.add('open');
  }
  function toggleDrawerSafe(id) {
    var el = $(id);
    if (!el) { toast('Drawer not available', 'err'); return; }
    // close others
    d.querySelectorAll('.drawer.open').forEach(function (x) {
      if (x !== el) x.classList.remove('open');
    });
    el.classList.toggle('open');
  }
  function ensureTimerModal() {
    if ($('#mTimer')) return;
    var m = d.createElement('div');
    m.id = 'mTimer';
    m.className = 'modal-back';
    m.innerHTML = '<div class="modal" style="max-width:360px">' +
      '<h3 style="margin:0 0 10px">⏱ Class countdown</h3>' +
      '<label class="muted" style="font-size:12px">Minutes</label>' +
      '<input class="input" id="acdTimerMins" type="number" min="1" max="180" value="40" style="margin:6px 0 12px">' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button type="button" class="btn primary" id="acdTimerStart">Start</button>' +
      '<button type="button" class="btn" id="acdTimerStop">Stop</button>' +
      '<button type="button" class="btn ghost" data-close="#mTimer">Close</button>' +
      '</div></div>';
    d.body.appendChild(m);
    m.addEventListener('click', function (e) {
      if (e.target === m) m.classList.remove('open');
      if (e.target && e.target.getAttribute('data-close')) m.classList.remove('open');
    });
    var iv = null;
    $('#acdTimerStart').onclick = function () {
      var mins = Math.max(1, Number($('#acdTimerMins').value) || 40);
      var left = mins * 60;
      var chip = $('#timerVal');
      if (iv) clearInterval(iv);
      iv = setInterval(function () {
        left--;
        if (chip) {
          var mm = String(Math.floor(Math.max(0, left) / 60)).padStart(2, '0');
          var ss = String(Math.max(0, left) % 60).padStart(2, '0');
          chip.textContent = mm + ':' + ss;
        }
        if (left <= 0) {
          clearInterval(iv); iv = null;
          toast('Time is up', 'ok');
          try { if (w.room && w.room.announce) w.room.announce('⏱ Time is up'); } catch (e) {}
        }
      }, 1000);
      m.classList.remove('open');
      toast('Timer started · ' + mins + ' min', 'ok');
    };
    $('#acdTimerStop').onclick = function () {
      if (iv) clearInterval(iv); iv = null;
      toast('Timer stopped');
      m.classList.remove('open');
    };
  }

  function bind(id, fn) {
    var el = d.getElementById(id);
    if (!el) return;
    // Remove disabled leftovers
    el.disabled = false;
    el.classList.remove('hide');
    el.style.pointerEvents = 'auto';
    el.style.zIndex = '30';
    // Capture phase so we still fire if something stops bubbling
    el.addEventListener('click', function (e) {
      try { fn(e); } catch (err) {
        console.error('[toolbar]', id, err);
        toast((err && err.message) || ('Could not open ' + id), 'err');
      }
    }, true);
  }

  function wire() {
    ensureTimerModal();
    // Kill any residual full-screen blockers
    d.querySelectorAll('#authGate, .auth-gate').forEach(function (g) {
      g.style.display = 'none';
      g.style.pointerEvents = 'none';
      try { g.remove(); } catch (e) {}
    });

    bind('btnSettings', function () {
      if (typeof w.openModal === 'function' && $('#mSettings')) openModalSafe('#mSettings');
      else openModalSafe('#mSettings');
    });
    bind('btnStudents', function () {
      try { if (typeof w.renderRoster === 'function') w.renderRoster(); } catch (e) {}
      try { if (typeof w.renderWaiting === 'function') w.renderWaiting(); } catch (e) {}
      if (typeof w.toggleDrawer === 'function') w.toggleDrawer('#drawerStudents');
      else toggleDrawerSafe('#drawerStudents');
    });
    bind('btnChat', function () {
      if (typeof w.toggleDrawer === 'function') w.toggleDrawer('#drawerChat');
      else toggleDrawerSafe('#drawerChat');
    });
    bind('btnPoll', function () {
      if (typeof w.toggleDrawer === 'function') w.toggleDrawer('#drawerPoll');
      else toggleDrawerSafe('#drawerPoll');
    });
    bind('btnQuiz', function () {
      try { if (typeof w.refreshQuizBanks === 'function') w.refreshQuizBanks(); } catch (e) {}
      try { if (typeof w.renderLeaderboard === 'function') w.renderLeaderboard(); } catch (e) {}
      if (typeof w.toggleDrawer === 'function') w.toggleDrawer('#drawerQuiz');
      else toggleDrawerSafe('#drawerQuiz');
    });
    bind('btnBoards', function () {
      if (typeof w.toggleDrawer === 'function') w.toggleDrawer('#drawerBoards');
      else toggleDrawerSafe('#drawerBoards');
    });
    bind('btnActivity', function () {
      if (typeof w.toggleDrawer === 'function') w.toggleDrawer('#drawerActivity');
      else toggleDrawerSafe('#drawerActivity');
    });
    bind('btnCalc', function () {
      var box = $('#calcBox');
      if (!box) { toast('Calculator not on this page', 'err'); return; }
      box.classList.toggle('hide');
    });
    bind('btnTimer', function () { openModalSafe('#mTimer'); });
    bind('btnLessons', function () {
      try { if (typeof w.renderLessons === 'function') w.renderLessons(); } catch (e) {}
      openModalSafe('#mLessons');
    });
    bind('btnFocus', function () {
      if (typeof w.setFocus === 'function') w.setFocus(true);
      else {
        var st = $('.studio');
        if (st) st.classList.add('focus');
        var h = $('#focusHandle'); if (h) h.classList.remove('hide');
      }
    });
    bind('btnFull', function () {
      if (typeof w.setFocus === 'function') w.setFocus(true);
      var el = d.documentElement;
      if (el.requestFullscreen) el.requestFullscreen().catch(function () {});
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    });
    bind('btnLayout', function () {
      // fall through to original if present by dispatching a trusted secondary path
      try {
        var modes = ['split', 'left', 'right'];
        var cur = (w.layoutMode || 'split');
        var i = modes.indexOf(cur);
        var next = modes[(i + 1) % modes.length];
        w.layoutMode = next;
        if (typeof w.applyLayout === 'function') w.applyLayout(next);
        else {
          var studio = $('.studio');
          if (studio) {
            studio.classList.remove('layout-split', 'layout-left', 'layout-right');
            studio.classList.add('layout-' + next);
          }
        }
        toast('Layout: ' + next);
      } catch (e) { toast('Layout change failed', 'err'); }
    });
    bind('btnSwap', function () {
      try {
        if (typeof w.swapPanes === 'function') w.swapPanes();
        else toast('Swap panes');
      } catch (e) { toast('Swap failed', 'err'); }
    });
    bind('btnPiP', function () {
      try {
        if (d.pictureInPictureElement) {
          if (typeof w.exitClassDeckPiP === 'function') w.exitClassDeckPiP();
          else d.exitPictureInPicture();
        } else if (typeof w.enterClassDeckPiP === 'function') {
          w.enterClassDeckPiP();
        } else {
          toast('PiP: start Go Live first, then try again', 'err');
        }
      } catch (e) { toast('PiP not available on this device', 'err'); }
    });
    bind('btnQR', function () {
      try {
        if (typeof w.openModal === 'function' && $('#mInvite')) openModalSafe('#mInvite');
        else if ($('#mQR')) openModalSafe('#mQR');
        else {
          var code = ($('#roomCodeLbl') && $('#roomCodeLbl').textContent) || '';
          var url = location.origin + location.pathname.replace(/teach\\.html.*/, 'join.html') + '?room=' + encodeURIComponent(code.trim());
          if (navigator.clipboard) navigator.clipboard.writeText(url);
          toast('Invite link copied: ' + url, 'ok', 5000);
        }
      } catch (e) { toast('Invite failed', 'err'); }
    });
    bind('btnGoLive', function () {
      if (typeof w.goLive === 'function') w.goLive();
      else toast('Go Live is starting…');
    });
    bind('btnEndLive', function () {
      if (typeof w.endLive === 'function') w.endLive();
    });
    bind('btnMic', function () {
      var b = $('#btnMic');
      if (b) b.click(); // allow original handler if ours is capture-only double - skip
    });
    // focus handle exits focus
    var fh = $('#focusHandle');
    if (fh) fh.addEventListener('click', function () {
      if (typeof w.setFocus === 'function') w.setFocus(false);
      else {
        var st = $('.studio'); if (st) st.classList.remove('focus');
        fh.classList.add('hide');
      }
    }, true);

    // Make topbar scroll horizontally on narrow screens instead of crushing buttons
    var tb = $('.topbar');
    if (tb) {
      tb.style.flexWrap = 'nowrap';
      tb.style.overflowX = 'auto';
      tb.style.overflowY = 'hidden';
      tb.style.webkitOverflowScrolling = 'touch';
    }
    toast('Classroom Deck toolbar ready', 'ok', 1600);
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { setTimeout(wire, 0); setTimeout(wire, 600); });
  else { setTimeout(wire, 0); setTimeout(wire, 600); }
})(window, document);
