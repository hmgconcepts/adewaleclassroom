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

/* ============================================================
   V48 (round 12) — CREDENTIAL ROAMING ENDPOINT.
   The portal this deck was generated from. cloud-creds.js uses it to
   sync the TURN key, relay credentials and streaming keys through the
   teacher's portal account (owner-only user_settings rows), so they are
   available on EVERY device the teacher signs in from — no re-pasting.
   Baked from this repo's assets/js/config.js.
   ============================================================ */
window.CLASSDECK.SUPABASE = {
  url: 'https://yqwzbttehegvnvkrmxjz.supabase.co',
  anon: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlxd3pidHRlaGVndm52a3JteGp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MzY1NTUsImV4cCI6MjEwMjMxMjU1NX0.mUDfHCQmO3kyb9cwqTjhojh0C3qsLv11YOzc7iomVnw'
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
/* v12: deployment-level relay. Accepts ANY shape the Settings box accepts:
   [ {urls|url: "turn:…" | ["turn:…",…], username, credential}, … ],
   { iceServers: [ … ] }, a single metered.ca object, or plain
   turn:host:443|user|pass lines — see cdParseRelayInput() in js/rtc.js. */
window.CD_RELAY = { iceServers: [] };
