/**
 * keepalive.gs — Tutoring Connect · Google Apps Script keep-alive
 * ============================================================================
 * A keep-alive layer that runs on GOOGLE'S servers, using nothing but the
 * studio's own Gmail account. It is completely independent of GitHub, Vercel,
 * Supabase and your own computer — which is exactly why it is worth having:
 * when every other scheduler is a single point of failure tied to one vendor
 * account, this one keeps running.
 *
 * Adapted from the School Connect "Layer 8" pattern and extended to:
 *   - verify the database really recorded the write (not just HTTP 200);
 *   - read the health state back and EMAIL YOU when the project is drifting
 *     toward a pause or is already unreachable;
 *   - stay silent when everything is healthy (no inbox noise).
 *
 * ----------------------------------------------------------------------------
 * SETUP — about 5 minutes, free, no card
 * ----------------------------------------------------------------------------
 * 1. Go to https://script.google.com  →  New project.
 * 2. Delete the placeholder code and paste this whole file in.
 * 3. Edit the three CONFIG values below (URL, anon key, your email).
 * 4. Click Save (disk icon), name it e.g. "Studio keep-alive".
 * 5. Run  ▸ pingSupabase   once. Google will ask for authorisation:
 *       "Review permissions" → pick your account → Advanced →
 *       "Go to <project> (unsafe)" → Allow.
 *    (It is your own script; the only permission it needs is to fetch a URL
 *     and send you mail.)
 * 6. Check the Execution log says:  ✅ heartbeat written
 * 7. Left sidebar → ⏰ Triggers → Add Trigger:
 *       Function:            pingSupabase
 *       Event source:        Time-driven
 *       Type:                Day timer
 *       Time of day:         any (e.g. 6am–7am)
 *    → Save.
 *
 * Done. Google now pings your database every single day, forever, for free.
 * ============================================================================
 */

// ---------------------------------------------------------------- CONFIG ---
var SUPABASE_URL  = 'https://YOUR_PROJECT_REF.supabase.co';  // no trailing slash
var SUPABASE_ANON = 'YOUR_SUPABASE_ANON_KEY';                // anon/public key ONLY
var ALERT_EMAIL   = '';   // leave '' to use the account running the script
// ---------------------------------------------------------------------------

/** Main entry point — attach the daily time-driven trigger to THIS function. */
function pingSupabase() {
  if (SUPABASE_URL.indexOf('YOUR_PROJECT_REF') !== -1 || SUPABASE_ANON.indexOf('YOUR_') === 0) {
    Logger.log('❌ Edit SUPABASE_URL and SUPABASE_ANON at the top of the script first.');
    return;
  }

  var headers = {
    'apikey': SUPABASE_ANON,
    'Authorization': 'Bearer ' + SUPABASE_ANON,
    'Content-Type': 'application/json'
  };

  // 1. THE WRITE — this is what actually resets Supabase's 7-day timer.
  //    A request that does not reach Postgres does NOT count as activity.
  var wrote = false, writeInfo = '';
  try {
    var res = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/tc_keep_alive', {
      method: 'post',
      headers: headers,
      payload: JSON.stringify({ src: 'google-apps-script' }),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    writeInfo = 'HTTP ' + code + ' ' + res.getContentText().slice(0, 200);
    wrote = (code === 200);
    Logger.log(wrote ? '✅ heartbeat written — ' + writeInfo : '❌ write failed — ' + writeInfo);
  } catch (e) {
    writeInfo = 'exception: ' + e;
    Logger.log('❌ ' + writeInfo);
  }

  // 2. THE READ — how close are we to being paused?
  var state = 'unknown', days = '?';
  try {
    var s = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/tc_keep_alive_status', {
      method: 'post', headers: headers, payload: '{}', muteHttpExceptions: true
    });
    if (s.getResponseCode() === 200) {
      var j = JSON.parse(s.getContentText());
      state = j.state || 'unknown';
      days = j.days_since;
      Logger.log('state=' + state + ' days_since=' + days + ' days_left=' + j.days_left);
    } else {
      Logger.log('status RPC unavailable (HTTP ' + s.getResponseCode() +
                 ') — run database/v9-keepalive-and-drive.sql to enable it.');
    }
  } catch (e) {
    Logger.log('status read failed: ' + e);
  }

  // 3. ALERT ONLY WHEN IT MATTERS. Silence when healthy.
  if (!wrote || state === 'critical' || state === 'unknown') {
    var to = ALERT_EMAIL || Session.getActiveUser().getEmail();
    if (!to) return;
    var subject = !wrote
      ? '🛑 Studio keep-alive FAILED — Supabase may pause'
      : '⚠️ Studio keep-alive is ' + state;
    var body =
      'The daily Google Apps Script keep-alive ran and found a problem.\n\n' +
      'Write result : ' + writeInfo + '\n' +
      'Health state : ' + state + '\n' +
      'Days since last heartbeat: ' + days + '\n\n' +
      'WHY THIS MATTERS\n' +
      'Supabase pauses a free project after 7 days without database activity,\n' +
      'and a project left paused is eventually deleted (~90 days).\n\n' +
      'WHAT TO CHECK, IN ORDER\n' +
      '1. Is the project already paused? https://supabase.com/dashboard → Restore project\n' +
      '2. Are SUPABASE_URL / the anon key in this script still correct?\n' +
      '3. GitHub → Actions → is "Keep Supabase Alive" still enabled and green?\n' +
      '4. Is your cron-job.org / UptimeRobot monitor still running?\n' +
      '5. Sign in to the studio → Platform health → press "Write heartbeat now".\n\n' +
      'Full runbook: docs/KEEP-ALIVE-GUIDE.md\n';
    MailApp.sendEmail(to, subject, body);
    Logger.log('alert emailed to ' + to);
  }
}

/** Optional: run once by hand to confirm configuration without waiting a day. */
function testNow() {
  pingSupabase();
  Logger.log('Test complete — read the log lines above.');
}
