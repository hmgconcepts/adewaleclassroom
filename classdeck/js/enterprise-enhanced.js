"use strict";
(function(){
if(window.__entSuiteLoaded) return; window.__entSuiteLoaded = true;

window.HMGFlyer = {
  _img: null,
  set: function(f) {
    var self = this;
    return new Promise(function(r) {
      var fr = new FileReader();
      fr.onload = function(e) {
        var i = new Image();
        i.onload = function() {
          var c = document.createElement("canvas");
          var k = Math.min(1, 640 / Math.max(i.naturalWidth, i.naturalHeight));
          c.width = Math.round(i.naturalWidth * k);
          c.height = Math.round(i.naturalHeight * k);
          c.getContext("2d").drawImage(i, 0, 0, c.width, c.height);
          var d = c.toDataURL("image/jpeg", 0.8);
          try { localStorage.setItem("hmg_flyer_img", d); } catch(e) {}
          self._img = new Image(); self._img.src = d; r(true);
        }; i.src = e.target.result;
      }; fr.readAsDataURL(f);
    });
  },
  clear: function() { localStorage.removeItem("hmg_flyer_img"); this._img = null; },
  get: function() { if(!this._img) { try { var d = localStorage.getItem("hmg_flyer_img"); if(d) { this._img = new Image(); this._img.src = d; } } catch(e) {} } return (this._img && this._img.complete && this._img.naturalWidth) ? this._img : null; },
  has: function() { return !!this.get(); },
  draw: function(ctx, W, H) {
    var i = this.get(); if(!i) return;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    var s = Math.min(W/i.naturalWidth, H/i.naturalHeight) * 0.92;
    ctx.drawImage(i, (W-i.naturalWidth*s)/2, (H-i.naturalHeight*s)/2, i.naturalWidth*s, i.naturalHeight*s);
    ctx.fillStyle = "rgba(16,20,43,.7)"; ctx.fillRect(0, H-50, W, 50);
    ctx.fillStyle = "#ffb347"; ctx.font = "bold 18px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("Learn more - visit our website", W/2, H-25);
  }
};

try { var d = localStorage.getItem("hmg_flyer_img"); if(d) { window.HMGFlyer._img = new Image(); window.HMGFlyer._img.src = d; } } catch(e) {}

window.drawHMGWatermark = function(ctx, W, H) {
  if(!ctx || !W || !H) return;
  try { ctx.save(); ctx.globalAlpha = .075; ctx.fillStyle = "#fff";
    ctx.font = "bold 16px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.translate(W/2, H/2); ctx.rotate(-Math.PI/6);
    var t = "HMG ACADEMY CLASS DECK * buildingmyictcareer@gmail.com * " + new Date().getFullYear();
    for(var y = -600; y < 600; y += 130) { ctx.fillText(t, 0, y, W*1.6); }
    ctx.restore(); } catch(e) {}
};

var _c = window.drawComposite;
if(typeof _c === "function") {
  window.drawComposite = function() { _c();
    try { if(typeof COMP !== "undefined" && COMP.ctx && COMP.w && COMP.h) window.drawHMGWatermark(COMP.ctx, COMP.w, COMP.h); } catch(e) {}
  };
}

window.drawCBTOverlay = function(ctx, W, H, url) {
  if(!ctx || !url) return;
  try { var bh = Math.round(H * 0.055);
    ctx.fillStyle = "rgba(30,42,120,.92)"; ctx.fillRect(0, H-bh-6, W, bh);
    ctx.fillStyle = "#ffb347";
    ctx.font = "bold " + Math.round(bh*0.5) + "px system-ui";
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("Take the quiz: " + url, 14, H - bh/2 - 6);
  } catch(e) {}
};

/* Wire flyer upload + clear buttons in the HMG recording dialog */
  document.addEventListener("click", function(e) {
    if (e.target && e.target.id === "hmgRecFlyerBtn") {
      var f = document.getElementById("hmgRecFlyerFile");
      if (f) f.click();
    }
    if (e.target && e.target.id === "hmgRecFlyerClear") {
      if (window.HMGFlyer) window.HMGFlyer.clear();
      var st = document.getElementById("hmgRecFlyerStatus");
      if (st) st.textContent = "Flyer cleared";
    }
  });
  var flyerFile = document.getElementById("hmgRecFlyerFile");
  if (flyerFile) {
    flyerFile.addEventListener("change", async function(e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      if (window.HMGFlyer && typeof window.HMGFlyer.set === "function") {
        await window.HMGFlyer.set(f);
        var st = document.getElementById("hmgRecFlyerStatus");
        if (st) st.textContent = "✓ Flyer uploaded (" + Math.round(f.size/1024) + "KB)";
      }
    });
  }

  /* Store CBT link from dialog field into localStorage for the recorded video */
  document.addEventListener("click", function(e) {
    if (e.target && e.target.id === "hmgRecBegin") {
      var cbtField = document.querySelector('.hmgRecField[data-key="cbtLink"]');
      if (cbtField) {
        try { localStorage.setItem("hmg_cbt_link", cbtField.value.trim()); } catch(e) {}
      }
    }
  });
  /* Also save CBT link on HMGREC.begin (enhancements.js handler) */
  var _origHmgBegin = window.HMGREC && window.HMGREC.begin;
  if (window.HMGREC && typeof _origHmgBegin === "function") {
    window.HMGREC.begin = function() {
      var cbtField = document.querySelector('.hmgRecField[data-key="cbtLink"]');
      if (cbtField) {
        try { localStorage.setItem("hmg_cbt_link", cbtField.value.trim()); } catch(e) {}
      }
      return _origHmgBegin.apply(this, arguments);
    };
  }

  console.log("[Enterprise] Loaded - flyer, watermark, CBT link, teaching kit");
})();
