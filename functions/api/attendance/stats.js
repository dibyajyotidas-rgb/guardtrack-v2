// functions/api/attendance/stats.js
import { json, err, cors, verifyAdmin } from "../helpers.js";

export async function onRequestOptions() { return cors(); }

export async function onRequestGet(ctx) {
  if (!(await verifyAdmin(ctx.request, ctx.env))) return err("Unauthorized", 401);

  const today = new Date().toISOString().slice(0, 10);

  // Get all locations — table uses id, name, address, lat, lng, radius
  const { results: locations } = await ctx.env.DB.prepare(
    "SELECT id, name, address, lat, lng, radius FROM locations ORDER BY name"
  ).all();

  // attendance table uses location_id to reference locations.id
  const { results: todayCounts } = await ctx.env.DB.prepare(
    "SELECT location_id, COUNT(*) as cnt FROM attendance WHERE timestamp LIKE ? GROUP BY location_id"
  ).bind(today + "%").all();

  const { results: totalCounts } = await ctx.env.DB.prepare(
    "SELECT location_id, COUNT(*) as cnt, COUNT(DISTINCT substr(timestamp, 1, 10)) as day_count FROM attendance GROUP BY location_id"
  ).all();

  const todayMap = Object.fromEntries(todayCounts.map(r => [r.location_id, r.cnt]));
  const totalMap = Object.fromEntries(totalCounts.map(r => [r.location_id, { total: r.cnt, days: r.day_count }]));

  const stats = locations.map(loc => ({
    ...loc,
    today_count:   todayMap[loc.id] || 0,
    total_records: totalMap[loc.id]?.total || 0,
    total_days:    totalMap[loc.id]?.days  || 0,
  }));

  return json(stats);
}
