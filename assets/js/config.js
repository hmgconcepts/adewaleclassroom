/* ADEWALE CLASSROOM — generated Tutoring Connect studio (HMG Technologies / HMG Concepts). */
window.TC = window.TC || {};
window.PRACTICE = {
  name: 'ADEWALE CLASSROOM',
  shortName: 'ADC',
  motto: 'Independent progress. Visible to parents. Built for Nigerian and international learners.',
  theme: { id: 'gosa', primary: '#0506ae', accent: '#964eec', primaryLight: '#4f46e5', accentLight: '#a78bfa', primaryDark: '#3730a3', bg: '#f8fafc' },
  layout: 'academy',
  font: { id: 'plusjakarta', family: 'Plus Jakarta Sans', serif: 'Plus Jakarta Sans', css: 'Plus+Jakarta+Sans:wght@400;500;600;700;800' },
  address: 'Lagos, Nigeria — strictly virtual',
  phone: '2348100866322',
  email: '',
  siteUrl: '',
  timezone: 'Africa/Lagos',
  currency: '₦',
  logoExt: 'svg',
  logoUrl: 'assets/img/logo.svg',
  socials: {
    facebook: '',
    instagram: 'https://instagram.com/cssadewale',
    x: 'https://x.com/cssadewale',
    linkedin: 'https://linkedin.com/in/adewalesamsonadeagbo',
    youtube: 'https://youtube.com/@hmgconcepts',
    tiktok: '',
    whatsapp: 'https://wa.me/2348100866322'
  },
  hmg: {
    concepts: 'https://hmgconcepts.pages.dev/',
    technologies: 'https://hmgtechnologies.pages.dev/',
    academy: 'https://hmgacademy.pages.dev/',
    media: 'https://hmgmedia.pages.dev/',
    gospel: 'https://hmggospel.pages.dev/',
    founder: 'https://cssadewale.pages.dev/'
  },
  license: { model: 'lifetime', plan: 'One-time ownership', status: 'active', expires_on: null, grace_days: 7 },
  demo: { enabled: false }
};

window.TC.esc = window.TC.esc || function (s) {
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
};

const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
window.sb = null;
if (window.supabase && SUPABASE_URL && !SUPABASE_URL.includes('YOUR_') && SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('YOUR_')) {
  window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
}
window.TC_CONFIRM_FREE_EMAIL = true;
window.TC_CONFIRM_FREE_WA = true;
window.TC_CONFIRM_FREE_SMS = true;
console.log('[ADEWALE CLASSROOM] Tutoring Connect by HMG Technologies / HMG Concepts');
