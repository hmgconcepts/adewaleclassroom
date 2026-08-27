/* teach-toolbar-fix.js — V37
   Robust topbar for ADEWALE CLASSROOM DECK / client Classroom Deck.
*/
(function (w, d) {
  'use strict';

  /* Buttons wired by js/teach.js itself. */
  var TEACH_OWNED = [
    'btnSettings','btnStudents','btnChat','btnPoll','btnQuiz','btnBoards',
    'btnActivity','btnCalc','btnTimer','btnFocus','btnFull','btnLayout',
    'btnSwap','btnPiP','btnRec','btnQR','btnGoLive','btnEndLive'
  ];

  function $(sel, root) {
    try { return (root || d).querySelector(sel); } catch (e) { return null; }
  }
  function toast(msg, type, ms) {
    try { if (typeof w.toast === 'function') return w.toast(msg, type || '', ms || 3500); } catch (e) {}
    console.log('[deck-toolbar]', msg);
  }
  function openModal(id) {
    var m = $(id);
    if (!m) { toast('Panel not available', 'err'); return false; }
    m.classList.add('open');
    return true;
  }
  function toggleDrawer(id) {
    var el = $(id);
    if (!el) { toast('Panel not available — reload', 'err'); return false; }
    d.querySelectorAll('.drawer.open').forEach(function (x) { if (x !== el) x.classList.remove('open'); });
    el.classList.toggle('open');
    return true;
  }
  function ensureTimerModal() {
    if ($('#mTimer')) return;
    var m = d.createElement('div');
    m.id = 'mTimer';
    m.className = 'modal-back';
    m.innerHTML = '<div class="modal" style="max-width:360px"><h3 style="margin:0 0 10px">⏱ Class countdown</h3>' +
      '<label style="font-size:12px;opacity:.75">Minutes</label>' +
      '<input class="input" id="acdTimerMins" type="number" min="1" max="180" value="40" style="margin:6px 0 12px">' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button type="button" class="btn primary" id="acdTimerStart">Start</button>' +
      '<button type="button" class="btn" id="acdTimerStop">Stop</button>' +
      '<button type="button" class="btn ghost" id="acdTimerClose">Close</button></div></div>';
    d.body.appendChild(m);
    var iv = null;
    m.addEventListener('click', function (e) { if (e.target === m) m.classList.remove('open'); });
    d.getElementById('acdTimerClose').onclick = function () { m.classList.remove('open'); };
    d.getElementById('acdTimerStart').onclick = function () {
      var mins = Math.max(1, Number(d.getElementById('acdTimerMins').value) || 40);
      var left = mins * 60;
      var chip = d.getElementById('timerVal');
      if (iv) clearInterval(iv);
      iv = setInterval(function () {
        left--;
        if (chip) chip.textContent = String(Math.floor(Math.max(0, left) / 60)).padStart(2, '0') + ':' + String(Math.max(0, left) % 60).padStart(2, '0');
        if (left <= 0) { clearInterval(iv); iv = null; toast('Time is up', 'ok'); }
      }, 1000);
      m.classList.remove('open');
      toast('Timer · ' + mins + ' min', 'ok');
    };
    d.getElementById('acdTimerStop').onclick = function () { if (iv) clearInterval(iv); iv = null; m.classList.remove('open'); toast('Timer stopped'); };
  }
  function killBlockers() {
    try {
      w.HMG_AUTH_OK = true;
      w.ACD_AUTH_OK = true;
      d.querySelectorAll('#authGate, .auth-gate').forEach(function (g) {
        g.style.display = 'none';
        g.style.pointerEvents = 'none';
        try { g.remove(); } catch (e) {}
      });
      var end = d.getElementById('btnEndLive');
      var live = d.getElementById('liveBadge');
      if (end && live && live.classList.contains('hide')) end.classList.add('hide');
    } catch (e) {}
  }

  function on(id, fn) {
    var el = d.getElementById(id);
    if (!el) return;
    el.disabled = false;
    el.style.pointerEvents = 'auto';
    el.style.zIndex = '50';
    /* V38: teach.js owns every one of these buttons. When it initialises
       cleanly it sets __DECK_TEACH_READY__, and binding here as well would
       double-fire the action in the capture phase (swapPanes() twice = no
       visible change; layout cycling two steps at a time). Only take over
       when teach.js actually failed. The cosmetic/reliability work below
       (killBlockers, topbar scrolling, timer modal) still runs either way. */
    if (w.__DECK_TEACH_READY__ && TEACH_OWNED.indexOf(id) !== -1) return;
    if (el.dataset.acdBound === '1') return;
    el.dataset.acdBound = '1';
    el.addEventListener('click', function (e) {
      try { fn(e); }
      catch (err) {
        console.error('[toolbar]', id, err);
        toast((err && err.message) || String(err), 'err', 5500);
      }
    }, true);
  }

  function wire() {
    killBlockers();
    ensureTimerModal();
    var tb = d.querySelector('.topbar');
    if (tb) {
      tb.style.overflowX = 'auto';
      tb.style.flexWrap = 'nowrap';
      tb.style.webkitOverflowScrolling = 'touch';
    }

    on('btnSettings', function (e) { e.preventDefault(); e.stopPropagation(); openModal('#mSettings'); });
    on('btnStudents', function (e) {
      e.preventDefault(); e.stopPropagation();
      try { if (typeof w.renderRoster === 'function') w.renderRoster(); } catch (err) {}
      try { if (typeof w.renderWaiting === 'function') w.renderWaiting(); } catch (err) {}
      if (typeof w.toggleDrawer === 'function') w.toggleDrawer('#drawerStudents');
      else toggleDrawer('#drawerStudents');
    });
    on('btnChat', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (typeof w.toggleDrawer === 'function') w.toggleDrawer('#drawerChat');
      else toggleDrawer('#drawerChat');
    });
    on('btnPoll', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (typeof w.toggleDrawer === 'function') w.toggleDrawer('#drawerPoll');
      else toggleDrawer('#drawerPoll');
    });
    on('btnQuiz', function (e) {
      e.preventDefault(); e.stopPropagation();
      try { if (typeof w.refreshQuizBanks === 'function') w.refreshQuizBanks(); } catch (err) {}
      try { if (typeof w.renderLeaderboard === 'function') w.renderLeaderboard(); } catch (err) {}
      if (typeof w.toggleDrawer === 'function') w.toggleDrawer('#drawerQuiz');
      else toggleDrawer('#drawerQuiz');
    });
    on('btnBoards', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (typeof w.toggleDrawer === 'function') w.toggleDrawer('#drawerBoards');
      else toggleDrawer('#drawerBoards');
    });
    on('btnActivity', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (typeof w.toggleDrawer === 'function') w.toggleDrawer('#drawerActivity');
      else toggleDrawer('#drawerActivity');
    });
    on('btnCalc', function (e) {
      e.preventDefault(); e.stopPropagation();
      var box = d.getElementById('calcBox');
      if (!box) { toast('Calculator missing', 'err'); return; }
      box.classList.toggle('hide');
      box.style.zIndex = '7000';
    });
    on('btnTimer', function (e) { e.preventDefault(); e.stopPropagation(); openModal('#mTimer'); });
    on('btnLessons', function (e) {
      e.preventDefault(); e.stopPropagation();
      try { if (typeof w.renderLessons === 'function') w.renderLessons(); } catch (err) {}
      openModal('#mLessons');
    });
    on('btnFocus', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (typeof w.setFocus === 'function') w.setFocus(true);
      else {
        var st = d.querySelector('.studio'); if (st) st.classList.add('focus');
        var h = d.getElementById('focusHandle'); if (h) h.classList.remove('hide');
      }
    });
    on('btnFull', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (typeof w.setFocus === 'function') w.setFocus(true);
      var el = d.documentElement;
      try {
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      } catch (err) {}
    });
    on('btnLayout', function (e) {
      e.preventDefault(); e.stopPropagation();
      try {
        var modes = ['split', 'left', 'right'];
        var cur = (typeof w.layoutMode === 'string' && w.layoutMode) || 'split';
        var next = modes[(Math.max(0, modes.indexOf(cur)) + 1) % 3];
        w.layoutMode = next;
        if (typeof w.applyLayout === 'function') w.applyLayout(next);
        else if (typeof w.setLayout === 'function') w.setLayout(next);
        toast('Layout: ' + next);
      } catch (err) { toast((err && err.message) || 'Layout failed', 'err'); }
    });
    on('btnSwap', function (e) {
      e.preventDefault(); e.stopPropagation();
      try {
        if (typeof w.swapPanes === 'function') w.swapPanes();
      } catch (err) { toast((err && err.message) || 'Swap failed', 'err'); }
    });
    on('btnPiP', function (e) {
      e.preventDefault(); e.stopPropagation();
      try {
        if (d.pictureInPictureElement) {
          if (typeof w.exitClassDeckPiP === 'function') w.exitClassDeckPiP();
          else if (d.exitPictureInPicture) d.exitPictureInPicture();
        } else if (typeof w.enterClassDeckPiP === 'function') {
          w.enterClassDeckPiP();
        } else {
          toast('Go Live first, then tap PiP', 'err');
        }
      } catch (err) { toast((err && err.message) || 'PiP unavailable', 'err'); }
    });
    on('btnRec', function (e) {
      e.preventDefault(); e.stopPropagation();
      try {
        if (w.HMGREC && typeof w.HMGREC.open === 'function') return w.HMGREC.open();
        if (d.getElementById('mHmgRecSetup')) return openModal('#mHmgRecSetup');
        if (d.getElementById('mRec')) return openModal('#mRec');
        if (typeof w.startRecording === 'function') return w.startRecording();
        toast('Use Rec after Go Live, or Settings → Recording', 'err');
      } catch (err) { toast((err && err.message) || 'Recording failed', 'err'); }
    });
    on('btnQR', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (d.getElementById('mInvite')) openModal('#mInvite');
      else if (d.getElementById('mQR')) openModal('#mQR');
      else {
        var code = ((d.getElementById('roomCodeLbl') || {}).textContent || '').trim();
        var url = location.href.replace(/teach\.html.*/, 'join.html') + '?room=' + encodeURIComponent(code);
        try { navigator.clipboard.writeText(url); toast('Invite link copied', 'ok'); }
        catch (err) { prompt('Copy invite link', url); }
      }
    });
    on('btnGoLive', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (typeof w.goLive === 'function') w.goLive();
      else toast('Go Live not ready yet', 'err');
    });
    on('btnEndLive', function (e) {
      e.preventDefault(); e.stopPropagation();
      try {
        if (typeof w.endLive === 'function') w.endLive();
        else toast('End not ready', 'err');
      } catch (err) { toast((err && err.message) || 'End failed', 'err', 5500); }
    });

    var fh = d.getElementById('focusHandle');
    if (fh && !w.__DECK_TEACH_READY__ && fh.dataset.acdBound !== '1') {
      fh.dataset.acdBound = '1';
      fh.addEventListener('click', function (e) {
        e.preventDefault();
        try {
          if (typeof w.setFocus === 'function') w.setFocus(false);
          else {
            var st = d.querySelector('.studio'); if (st) st.classList.remove('focus');
            fh.classList.add('hide');
          }
        } catch (err) { toast((err && err.message) || 'Exit focus failed', 'err'); }
      }, true);
    }

    try {
      var end = d.getElementById('btnEndLive');
      var live = d.getElementById('liveBadge');
      if (end && live && live.classList.contains('hide')) end.classList.add('hide');
    } catch (e) {}

    w.ACDToolbar = { rewire: wire, openModal: openModal, toggleDrawer: toggleDrawer };
  }

  function start() {
    wire();
    setTimeout(wire, 300);
    setTimeout(wire, 1200);
    setTimeout(wire, 3000);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();
})(window, document);
