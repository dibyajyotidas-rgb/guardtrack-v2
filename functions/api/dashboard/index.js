// functions/api/dashboard/index.js
import { json, err, cors, verifyAdmin } from "../helpers.js";

export async function onRequestOptions() { return cors(); }

export async function onRequestGet(ctx) {
  if (!(await verifyAdmin(ctx.request, ctx.env))) return err("Unauthorized", 401);

  const today = new Date().toISOString().slice(0, 10);

  const [guardsToday, storesToday, storeBreakdown, totalStores] = await Promise.all([
    ctx.env.DB.prepare(
      "SELECT COUNT(DISTINCT guard_name) as count FROM attendance WHERE timestamp LIKE ?"
    ).bind(today + "%").first(),

    ctx.env.DB.prepare(
      "SELECT COUNT(DISTINCT location_id) as count FROM attendance WHERE timestamp LIKE ?"
    ).bind(today + "%").first(),

    ctx.env.DB.prepare(`
      SELECT location_id, location_name,
             COUNT(DISTINCT guard_name) AS guard_count,
             MAX(timestamp) AS last_checkin
      FROM attendance
      WHERE timestamp LIKE ?
      GROUP BY location_id, location_name
      ORDER BY last_checkin DESC
    `).bind(today + "%").all(),

    ctx.env.DB.prepare("SELECT COUNT(*) as count FROM locations").first(),
  ]);

  // Get all registered locations
  const { results: allLocations } = await ctx.env.DB.prepare(
    "SELECT id, name, address FROM locations ORDER BY name"
  ).all();

  // Get active location IDs today
  const activeIds = new Set((storeBreakdown.results || []).map(s => s.location_id));

  // Inactive = registered locations with no check-in today
  const inactive_stores = allLocations.filter(l => !activeIds.has(l.id));

  return json({
    today,
    guards_present:  guardsToday?.count  || 0,
    stores_active:   storesToday?.count  || 0,
    total_stores:    totalStores?.count  || 0,
    stores_inactive: (totalStores?.count || 0) - (storesToday?.count || 0),
    store_breakdown: storeBreakdown.results || [],
    inactive_stores,
  });
}
