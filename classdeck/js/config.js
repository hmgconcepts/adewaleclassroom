/* ADEWALE CLASSROOM DECK — live teaching workspace
   Tailored for ADEWALE CLASSROOM (Tutoring Connect studio).
   Founder: Adewale Samson Adeagbo — HMG Concepts Ecosystem.
   No separate Class Deck login: teachers already signed into ADEWALE CLASSROOM.
   Students still join free with a room code / link (no account required).
   No AI API. Free PeerJS / browser WebRTC stack.
*/
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
  primary: '#0506ae',
  accent: '#964eec',
  requirePortalSession: false,  // teacher studio checks Adewale Classroom auth
  studentJoinFree: true
};
// Back-compat aliases many Class Deck scripts read
window.CD_CONFIG = Object.assign({}, window.CD_CONFIG || {}, window.CLASSDECK.BRAND);
window.APP_NAME = 'ADEWALE CLASSROOM DECK';
window.SCHOOL_NAME = 'ADEWALE CLASSROOM';
console.log('[ADEWALE CLASSROOM DECK] ready — synced with ADEWALE CLASSROOM portal');
