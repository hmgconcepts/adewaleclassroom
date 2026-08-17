// ============================================================================
// Supabase Edge Function — /functions/v1/ping
// Tutoring Connect V9 · free-tier keep-alive + public health endpoint
// ----------------------------------------------------------------------------
// WHY THIS EXISTS
// Supabase pauses a FREE project after 7 days without real DATABASE activity.
// A function that merely returns JSON does NOT reset that timer — the request
// has to reach Postgres. This function therefore calls the tc_keep_alive()
// RPC, which performs an actual write, and then reports how close the project
// is to being paused.
//
// It is designed to be called by an EXTERNAL scheduler (cron-job.org,
// UptimeRobot, GitHub Actions, Vercel cron). External is the important word:
// pg_cron lives inside the database, so it stops the moment the project
// pauses — it can never wake anything up.
//
// DEPLOY (once, ~2 minutes):
//   supabase functions deploy ping --no-verify-jwt
//
//   --no-verify-jwt matters. It makes the endpoint callable with NO headers,
//   so a free monitor that cannot send an Authorization header still works.
//   Nothing sensitive is exposed: the function only writes a heartbeat row and
//   returns counters.
//
// THEN point a scheduler at:
//   https://YOUR-PROJECT.supabase.co/functions/v1/ping
//
// RESPONSES
//   200 {"status":"alive","state":"healthy",...}   heartbeat written
//   200 {"status":"alive","state":"warning"|"critical", ...}
//   503 {"status":"degraded", ...}                 DB write failed — ALERT
//
// The 503 matters: UptimeRobot / cron-job.org treat a non-2xx as a failure and
// will email you. A silent keep-alive is a useless keep-alive.
// ============================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
  "Cache-Control": "no-store, max-age=0",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const started = Date.now();
  const out: Record<string, unknown> = {
    status: "alive",
    service: "tutoring-connect-keepalive",
    timestamp: new Date().toISOString(),
  };

  // SUPABASE_URL / SUPABASE_ANON_KEY are injected automatically into every
  // Edge Function — you do not have to set them yourself.
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    return new Response(JSON.stringify({
      ...out,
      status: "degraded",
      error: "SUPABASE_URL / SUPABASE_ANON_KEY not available to this function.",
    }), { status: 503, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  try {
    const sb = createClient(url, key, { auth: { persistSession: false } });

    // 1. THE WRITE. This is the part that actually resets the 7-day timer.
    const { data: wrote, error: writeErr } = await sb.rpc("tc_keep_alive", { src: "edge-ping" });
    if (writeErr) throw new Error("tc_keep_alive failed: " + writeErr.message);
    out.heartbeat_written_at = wrote;

    // 2. THE READ. Report how close we are to a pause so the caller can alert.
    const { data: status, error: statusErr } = await sb.rpc("tc_keep_alive_status");
    if (!statusErr && status) {
      out.state = (status as Record<string, unknown>).state;
      out.days_since_last_ping = (status as Record<string, unknown>).days_since;
      out.days_until_pause_risk = (status as Record<string, unknown>).days_left;
      out.ping_count = (status as Record<string, unknown>).ping_count;
    } else {
      // Not fatal — the write is what protects the project.
      out.state = "unknown";
      out.status_note = "Run database/v9-keepalive-and-drive.sql to enable status reporting.";
    }

    out.duration_ms = Date.now() - started;
    return new Response(JSON.stringify(out), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    // Return 503 so external monitors register a FAILURE and notify you.
    return new Response(JSON.stringify({
      ...out,
      status: "degraded",
      error: (e as Error).message,
      hint: "Run database/complete-schema.sql (or v9-keepalive-and-drive.sql) in the SQL editor.",
      duration_ms: Date.now() - started,
    }), { status: 503, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
