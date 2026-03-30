// functions/api/attendance/auto-checkout.js
// Called by a Cloudflare Cron trigger at midnight
// Auto-checks out any guards who haven't checked out after 23 hours

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret",
};
const j = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost(ctx) {
  // Secure with admin secret
  const secret = ctx.request.headers.get("X-Admin-Secret");
  if (secret !== ctx.env.ADMIN_SECRET) return j({ error: "Unauthorized" }, 401);

  const now = new Date();
  const cutoff = new Date(now.getTime() - 23 * 3600000).toISOString();

  // Find all records with no checkout older than 23 hours
  const { results } = await ctx.env.DB.prepare(
    `SELECT id, timestamp FROM attendance
     WHERE checkout_time IS NULL AND timestamp < ?`
  ).bind(cutoff).all();

  let count = 0;
  for (const r of results) {
    const checkin = new Date(r.timestamp);
    const working_hours = Math.round(((now - checkin) / 3600000) * 100) / 100;
    await ctx.env.DB.prepare(
      "UPDATE attendance SET checkout_time = ?, checkout_type = 'auto', working_hours = ? WHERE id = ?"
    ).bind(now.toISOString(), working_hours, r.id).run();
    count++;
  }

  return j({ success: true, auto_checked_out: count });
}
