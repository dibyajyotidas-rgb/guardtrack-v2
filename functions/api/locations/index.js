import { verifyAdmin } from "../helpers.js";

// functions/api/locations/index.js
export async function onRequest(ctx) {
  const ADMIN_SECRET = ctx.env.ADMIN_SECRET;

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret",
  };

  const json = (d, s = 200) => new Response(JSON.stringify(d), {
    status: s, headers: { ...cors, "Content-Type": "application/json" }
  });

  if (ctx.request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  // GET — public
  if (ctx.request.method === "GET") {
    const url = new URL(ctx.request.url);
    const id = url.searchParams.get("id");

    if (id) {
      const loc = await ctx.env.DB.prepare(
        `SELECT id, name, address, lat, lng, radius,
                vendor_name, area_manager_name, area_manager_phone, zippee_poc_name
         FROM locations WHERE id = ?`
      ).bind(id).first();
      if (!loc) return json({ error: "Store not found" }, 404);
      return json(loc);
    }

    const { results } = await ctx.env.DB.prepare(
      `SELECT id, name, address, lat, lng, radius,
              vendor_name, area_manager_name, area_manager_phone, zippee_poc_name
       FROM locations ORDER BY name`
    ).all();
    return json(results);
  }

  // Auth for write operations
  const secret = ctx.request.headers.get("X-Admin-Secret") || "";
  const isAdmin = (secret && secret === ADMIN_SECRET) || await verifyAdmin(ctx.request, ctx.env);
  if (!isAdmin) return json({ error: "Unauthorized" }, 401);

  if (ctx.request.method === "POST") {
    const { name, address, lat, lng, radius, vendor_name, area_manager_name, area_manager_phone, zippee_poc_name } = await ctx.request.json();
    if (!name || !lat || !lng) return json({ error: "name, lat, lng required" }, 400);
    const id = "store_" + name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) + "_" + Math.random().toString(36).slice(2, 6);
    try {
      await ctx.env.DB.prepare(
        `INSERT INTO locations (id, name, address, lat, lng, radius, vendor_name, area_manager_name, area_manager_phone, zippee_poc_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, name, address || "", lat, lng, radius || 150,
        vendor_name || null, area_manager_name || null, area_manager_phone || null, zippee_poc_name || null).run();
      return json({ success: true, id });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  if (ctx.request.method === "PUT") {
    const { id, name, address, lat, lng, radius, vendor_name, area_manager_name, area_manager_phone, zippee_poc_name } = await ctx.request.json();
    if (!id) return json({ error: "id required" }, 400);
    try {
      await ctx.env.DB.prepare(
        `UPDATE locations SET name=?, address=?, lat=?, lng=?, radius=?,
         vendor_name=?, area_manager_name=?, area_manager_phone=?, zippee_poc_name=?
         WHERE id=?`
      ).bind(name, address || "", lat, lng, radius || 150,
        vendor_name || null, area_manager_name || null, area_manager_phone || null, zippee_poc_name || null, id).run();
      return json({ success: true });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  if (ctx.request.method === "DELETE") {
    const id = new URL(ctx.request.url).searchParams.get("id");
    if (!id) return json({ error: "id required" }, 400);
    await ctx.env.DB.prepare("DELETE FROM locations WHERE id = ?").bind(id).run();
    return json({ success: true });
  }

  return json({ error: "Method not allowed" }, 405);
}
