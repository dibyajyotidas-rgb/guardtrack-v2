import { json, err, cors, verifyAdmin } from "../helpers.js";

// GET /api/attendance/days?store=store_xxx
// Returns list of days with guard count and check-in count for that store

export async function onRequestOptions() { return cors(); }

export async function onRequestGet(ctx) {
  if (!(await verifyAdmin(ctx.request, ctx.env)))
    return err("Unauthorized", 401);

  const url = new URL(ctx.request.url);
  const store = url.searchParams.get("store");

  if (!store) return err("store param required");

  const { results } = await ctx.env.DB.prepare(
    `SELECT
       substr(timestamp, 1, 10) as day,
       COUNT(*) as checkin_count,
       COUNT(DISTINCT guard_name) as guard_count,
       GROUP_CONCAT(DISTINCT guard_name) as guards
     FROM attendance
     WHERE location_id = ?
     GROUP BY day
     ORDER BY day DESC
     LIMIT 365`
  ).bind(store).all();

  return json(results);
}
