import { verifyAdmin } from "../helpers.js";

// functions/api/attendance/index.js
export async function onRequest(ctx) {
  const ADMIN_SECRET = ctx.env.ADMIN_SECRET;
  const IMGBB_KEY    = ctx.env.IMGBB_KEY;

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret, Authorization",
  };

  const json = (d, s = 200) => new Response(JSON.stringify(d), {
    status: s, headers: { ...cors, "Content-Type": "application/json" }
  });
  const csv = (body, filename) => new Response(body, {
    headers: { ...cors, "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${filename}"` }
  });
  const err = (msg, s = 400) => json({ error: msg }, s);

  // Haversine formula — returns distance in metres between two lat/lng points
  function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = x => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  if (ctx.request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  // ── POST: Guard check-in ──────────────────────────────────────────────────
  if (ctx.request.method === "POST") {
    let body;
    try { body = await ctx.request.json(); } catch { return err("Invalid JSON"); }

    const { guard_name, guard_mobile, location_id, lat, lng, accuracy, selfie } = body;

    if (!guard_name || !location_id || lat == null || lng == null)
      return err("guard_name, location_id, lat, lng are required");

    // Fetch store — including lat, lng, radius for server-side geofence check
    const loc = await ctx.env.DB.prepare(
      "SELECT id, name, lat, lng, radius FROM locations WHERE id = ?"
    ).bind(location_id).first();

    if (!loc) return err("Store not found", 404);

    // ── SERVER-SIDE geofence check — never trust the client ──────────────────
    const dist = Math.round(haversine(lat, lng, loc.lat, loc.lng));
    const inGeofence = dist <= loc.radius;

    if (!inGeofence) {
      return json({
        blocked: true,
        distance: dist,
        radius: loc.radius,
        message: `You are ${dist}m away. Must be within ${loc.radius}m of ${loc.name}.`
      }, 403);
    }

    const timestamp = new Date().toISOString();

    // Upload selfie to ImgBB if provided
    let selfie_url = null;
    if (selfie && IMGBB_KEY) {
      try {
        const base64 = selfie.includes(",") ? selfie.split(",")[1] : selfie;
        const form = new FormData();
        form.append("key", IMGBB_KEY);
        form.append("image", base64);
        form.append("name", `${guard_name}_${location_id}_${timestamp.slice(0, 10)}`);
        const imgRes = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: form });
        const imgData = await imgRes.json();
        if (imgData.success) selfie_url = imgData.data.url;
      } catch (e) {
        console.error("ImgBB upload failed:", e.message);
      }
    }

    await ctx.env.DB.prepare(`
      INSERT INTO attendance
        (guard_name, guard_mobile, location_id, location_name, timestamp, guard_lat, guard_lng, distance, accuracy, in_geofence, selfie_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      guard_name, guard_mobile || null,
      location_id, loc.name, timestamp,
      lat, lng, dist, accuracy || null,
      1, selfie_url
    ).run();

    return json({ success: true, location_name: loc.name, selfie_url, timestamp });
  }

  // ── GET: Fetch attendance records ─────────────────────────────────────────
  if (ctx.request.method === "GET") {
    const secret = ctx.request.headers.get("X-Admin-Secret");
    const isAdmin = (secret && secret === ADMIN_SECRET) || await verifyAdmin(ctx.request, ctx.env);
    if (!isAdmin) return err("Unauthorized", 401);

    const url    = new URL(ctx.request.url);
    const store  = url.searchParams.get("store");
    const date   = url.searchParams.get("date");
    const from   = url.searchParams.get("from");
    const to     = url.searchParams.get("to");
    const format = url.searchParams.get("format");
    const limit  = parseInt(url.searchParams.get("limit")) || 1000;

    let query = `SELECT id, guard_name, guard_mobile, location_id, location_name, timestamp,
                        guard_lat, guard_lng, distance, accuracy, in_geofence, selfie_url,
                        checkout_time, checkout_type, working_hours
                 FROM attendance WHERE 1=1`;
    const params = [];

    if (store) { query += " AND location_id = ?"; params.push(store); }
    if (date)  { query += " AND timestamp LIKE ?"; params.push(date + "%"); }
    if (from)  { query += " AND timestamp >= ?";   params.push(from + "T00:00:00"); }
    if (to)    { query += " AND timestamp <= ?";   params.push(to + "T23:59:59"); }

    query += " ORDER BY timestamp DESC LIMIT ?";
    params.push(limit);

    let stmt = ctx.env.DB.prepare(query);
    if (params.length) stmt = stmt.bind(...params);
    const { results } = await stmt.all();

    if (format === "csv") {
      const header = "Date,Check-in Time,Guard Name,Mobile,Store,Store ID,Check-out Time,Working Hours,Checkout Type,Distance (m),GPS Accuracy (m),Latitude,Longitude,Selfie URL\n";
      const rows = results.map(r => {
        const ts = new Date(r.timestamp);
        const d  = ts.toISOString().slice(0, 10);
        const t  = ts.toTimeString().slice(0, 5);
        const cout = r.checkout_time ? new Date(r.checkout_time).toTimeString().slice(0, 5) : "";
        return [d, t, r.guard_name, r.guard_mobile || "", r.location_name, r.location_id,
                cout, r.working_hours || "", r.checkout_type || "",
                r.distance, r.accuracy || "", r.guard_lat || "", r.guard_lng || "",
                r.selfie_url || ""].join(",");
      }).join("\n");

      const filename = store
        ? `attendance_${store}_${date || "all"}.csv`
        : `attendance_full_${new Date().toISOString().slice(0, 10)}.csv`;

      return csv(header + rows, filename);
    }

    return json(results);
  }

  return err("Method not allowed", 405);
}
