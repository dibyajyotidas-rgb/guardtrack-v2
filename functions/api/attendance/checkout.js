// functions/api/attendance/checkout.js
// POST /api/attendance/checkout — guard checks out
// GET  /api/attendance/checkout?store=x&guard=y — get today's check-in status

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret",
};
const j = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const e = (msg, s = 400) => j({ error: msg }, s);

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

// GET — check if guard has checked in today (used by guard page on load)
export async function onRequestGet(ctx) {
  const url = new URL(ctx.request.url);
  const store = url.searchParams.get("store");
  const guard = url.searchParams.get("guard");
  const today = new Date().toISOString().slice(0, 10);

  if (!store || !guard) return e("store and guard required");

  const record = await ctx.env.DB.prepare(
    `SELECT id, guard_name, guard_mobile, timestamp, checkout_time, checkout_type, working_hours
     FROM attendance
     WHERE location_id = ? AND guard_name = ? AND timestamp LIKE ?
     ORDER BY timestamp DESC LIMIT 1`
  ).bind(store, guard, today + "%").first();

  return j({ record: record || null });
}

// POST — guard checks out
export async function onRequestPost(ctx) {
  let body;
  try { body = await ctx.request.json(); } catch { return e("Invalid JSON"); }

  const { attendance_id, guard_name, location_id } = body;
  if (!attendance_id && !(guard_name && location_id)) {
    return e("attendance_id or (guard_name + location_id) required");
  }

  const checkout_time = new Date().toISOString();
  const today = new Date().toISOString().slice(0, 10);

  // Find the latest check-in record for this guard today
  let record;
  if (attendance_id) {
    record = await ctx.env.DB.prepare(
      "SELECT id, timestamp, checkout_time FROM attendance WHERE id = ?"
    ).bind(attendance_id).first();
  } else {
    record = await ctx.env.DB.prepare(
      `SELECT id, timestamp, checkout_time FROM attendance
       WHERE location_id = ? AND guard_name = ? AND timestamp LIKE ?
       ORDER BY timestamp DESC LIMIT 1`
    ).bind(location_id, guard_name, today + "%").first();
  }

  if (!record) return e("No check-in found for today", 404);
  if (record.checkout_time) return e("Already checked out", 400);

  // Calculate working hours
  const checkin = new Date(record.timestamp);
  const checkout = new Date(checkout_time);
  const working_hours = Math.round(((checkout - checkin) / 3600000) * 100) / 100;

  await ctx.env.DB.prepare(
    "UPDATE attendance SET checkout_time = ?, checkout_type = 'manual', working_hours = ? WHERE id = ?"
  ).bind(checkout_time, working_hours, record.id).run();

  return j({ success: true, checkout_time, working_hours });
}
