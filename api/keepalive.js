/**
 * api/keepalive.js — Vercel serverless keep-alive (Tutoring Connect V9)
 * ----------------------------------------------------------------------------
 * Layer 7 of the keep-alive stack. Triggered by the Vercel cron entry in
 * vercel.json, and also callable by ANY external scheduler.
 *
 * IMPORTANT FREE-TIER FACT (verified Aug 2026): on the Vercel **Hobby** plan
 * cron jobs may run at most ONCE PER DAY, fire with roughly ±59 minutes of
 * precision, and Vercel explicitly does NOT guarantee timely execution. That
 * is fine as a redundant layer, but it must never be your only one — which is
 * exactly why this endpoint is also designed to be called externally.
 *
 * V9 changes:
 *   - actually VERIFIES the database write instead of reporting the HTTP status
 *     of a request it never inspected (V8 returned ok:true for a 4xx body);
 *   - reports how close the project is to being paused;
 *   - returns 503 on failure so monitors raise an alert instead of staying green;
 *   - accepts GET and HEAD so any uptime monitor can call it;
 *   - optional shared secret via KEEPALIVE_SECRET.
 */
export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  const secret = process.env.KEEPALIVE_SECRET || '';

  res.setHeader('Cache-Control', 'no-store, max-age=0');

  // Optional protection. Leave KEEPALIVE_SECRET unset to keep the endpoint open
  // (harmless: it only writes a heartbeat row and returns counters).
  if (secret) {
    const supplied = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') ||
                     (req.query && req.query.key) || '';
    if (supplied !== secret) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
  }

  if (!url || !key) {
    return res.status(503).json({
      ok: false,
      error: 'SUPABASE_URL and SUPABASE_ANON_KEY are not set.',
      fix: 'Vercel → Project → Settings → Environment Variables → add both → redeploy.'
    });
  }

  const headers = {
    apikey: key,
    Authorization: 'Bearer ' + key,
    'Content-Type': 'application/json'
  };
  const started = Date.now();

  try {
    // 1. The write that actually resets Supabase's 7-day inactivity timer.
    const w = await fetch(url + '/rest/v1/rpc/tc_keep_alive', {
      method: 'POST', headers, body: JSON.stringify({ src: 'vercel-cron' })
    });
    const writeBody = await w.text();

    if (!w.ok) {
      // V8 BUG: this path used to return ok:true with a 200, so a broken
      // keep-alive looked perfectly healthy in Vercel's logs.
      return res.status(503).json({
        ok: false,
        stage: 'heartbeat-write',
        httpStatus: w.status,
        error: writeBody.slice(0, 300),
        hint: 'Run database/complete-schema.sql in the Supabase SQL editor.',
        at: new Date().toISOString()
      });
    }

    // 2. Read back how close we are to a pause, so this endpoint doubles as
    //    a health check for an external monitor.
    let state = 'unknown', daysSince = null, daysLeft = null;
    try {
      const s = await fetch(url + '/rest/v1/rpc/tc_keep_alive_status', {
        method: 'POST', headers, body: '{}'
      });
      if (s.ok) {
        const j = await s.json();
        if (j) { state = j.state; daysSince = j.days_since; daysLeft = j.days_left; }
      }
    } catch (_) { /* non-fatal: the write is what matters */ }

    if (req.method === 'HEAD') return res.status(200).end();

    return res.status(200).json({
      ok: true,
      heartbeatWrittenAt: writeBody.replace(/"/g, ''),
      state,
      daysSinceLastPing: daysSince,
      daysUntilPauseRisk: daysLeft,
      durationMs: Date.now() - started,
      at: new Date().toISOString()
    });
  } catch (e) {
    return res.status(503).json({
      ok: false,
      error: String((e && e.message) || e),
      at: new Date().toISOString()
    });
  }
}
