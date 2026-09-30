/* ADEWALE CLASSROOM DECK — branded live teaching workspace (V36) */
window.CLASSDECK = window.CLASSDECK || {};
window.CLASSDECK.BRAND = {
  productName: 'ADEWALE CLASSROOM DECK',
  shortName: 'Classroom Deck',
  studioName: 'ADEWALE CLASSROOM',
  tagline: 'Teach live inside ADEWALE CLASSROOM — whiteboard, materials and learners in one place.',
  founder: 'Adewale Samson Adeagbo',
  ecosystem: 'HMG Concepts Ecosystem',
  email: 'hmgconcepts@gmail.com',
  whatsapp: 'https://wa.me/2348100866322',
  siteUrl: 'https://adewaleclassroom.vercel.app',
  parentPortal: '../index.html',
  portalSessions: '../sessions.html',
  portalCalendar: '../calendar.html',
  portalLogin: '../login.html',
  logoUrl: '../assets/img/logo.png',
  primary: '#0506ae',
  accent: '#964eec',
  requirePortalSession: false,
  studentJoinFree: true
};
window.CD_CONFIG = Object.assign({}, window.CD_CONFIG || {}, window.CLASSDECK.BRAND);
window.APP_NAME = window.CLASSDECK.BRAND.productName;
window.SCHOOL_NAME = window.CLASSDECK.BRAND.studioName;
console.log('[Classroom Deck] branded for', window.CLASSDECK.BRAND.studioName);

/* ============================================================
   👑 FOUNDER / OWNER ACCOUNT — lifetime access, never expires
   (RESTORED v11.0.3 — this block was accidentally dropped from a
   later config rewrite, which broke the documented owner login:
   auth.js reads window.HMG_OWNER on every deploy. Change the email/
   password here and it is honoured automatically by js/auth.js.)
   ============================================================ */
window.HMG_OWNER = {
  email: "buildingmyictcareer@gmail.com",
  password: "Walex@28120215",
  name: "Adewale Samson Adeagbo"
};

/* 📶 OPTIONAL DEPLOYMENT-LEVEL TURN RELAY (v11).
   Paste a JSON array of ICE servers here to ship a relay with THIS
   deployment (the teacher can still override it per-studio in
   Settings → Relay). Free TURN: Cloudflare dashboard → TURN, or
   metered.ca (free plan). Leave empty to use the built-in servers. */
window.CD_RELAY = { iceServers: [] };
