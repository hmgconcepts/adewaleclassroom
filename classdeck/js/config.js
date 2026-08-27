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
  logoUrl: '../assets/img/logo.svg',
  primary: '#0506ae',
  accent: '#964eec',
  requirePortalSession: false,
  studentJoinFree: true
};
window.CD_CONFIG = Object.assign({}, window.CD_CONFIG || {}, window.CLASSDECK.BRAND);
window.APP_NAME = window.CLASSDECK.BRAND.productName;
window.SCHOOL_NAME = window.CLASSDECK.BRAND.studioName;
console.log('[Classroom Deck] branded for', window.CLASSDECK.BRAND.studioName);
