// Shared helpers for all API routes
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
export function csv(content, filename) {
  return new Response(content, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Access-Control-Allow-Origin": "*",
    },
  });
}
export function err(message, status = 400) {
  return json({ error: message }, status);
}
export function cors() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
// Haversine — server-side geofence verification
export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
// Simple admin token check — reads ADMIN_SECRET
export async function verifyAdmin(request, env) {
  const auth = request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7);
  const [ts, sig] = token.split(".");
  if (!ts || !sig) return false;
  if (Date.now() - parseInt(ts) > 86400000) return false;
  // Check against ADMIN_SECRET (falls back to ADMIN_PASSWORD for compatibility)
  const secret = env.ADMIN_SECRET || env.ADMIN_PASSWORD || "admin123";
  const expected = await hmacSign(ts, secret);
  return sig === expected;
}
export async function createAdminToken(env) {
  const ts = String(Date.now());
  const secret = env.ADMIN_SECRET || env.ADMIN_PASSWORD || "admin123";
  const sig = await hmacSign(ts, secret);
  return `${ts}.${sig}`;
}
async function hmacSign(data, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
// Generate a store ID from name
export function generateStoreId(name) {
  return "store_" + name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) + "_" + Math.random().toString(36).slice(2, 6);
}
