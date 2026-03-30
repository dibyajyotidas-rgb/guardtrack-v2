// functions/api/store-users/index.js
// No imports — inlined to avoid module resolution issues

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret",
};
const j = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const e = (msg, s = 400) => j({ error: msg }, s);

async function verifyAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7);
  const [ts, sig] = token.split(".");
  if (!ts || !sig) return false;
  if (Date.now() - parseInt(ts) > 86400000) return false;
  const secret = env.ADMIN_SECRET || env.ADMIN_PASSWORD || "admin123";
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const raw = await crypto.subtle.sign("HMAC", key, enc.encode(ts));
  const expected = btoa(String.fromCharCode(...new Uint8Array(raw))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
  return sig === expected;
}

async function createToken(env) {
  const ts = String(Date.now());
  const secret = env.ADMIN_SECRET || env.ADMIN_PASSWORD || "admin123";
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const raw = await crypto.subtle.sign("HMAC", key, enc.encode(ts));
  const sig = btoa(String.fromCharCode(...new Uint8Array(raw))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
  return `${ts}.${sig}`;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost(ctx) {
  const url = new URL(ctx.request.url);

  // ── /api/store-users/login (no auth required) ─────────────────────────────
  if (url.pathname.endsWith("/login")) {
    const { email, password } = await ctx.request.json();
    if (!email || !password) return e("Email and password required", 400);

    const user = await ctx.env.DB.prepare(
      "SELECT id, email, location_id, location_name FROM store_users WHERE email = ? AND password = ?"
    ).bind(email.toLowerCase().trim(), password).first();

    if (!user) return e("Invalid email or password", 401);

    const token = await createToken(ctx.env);
    return j({ success: true, token, user });
  }

  // ── POST /api/store-users — add user (admin only) ─────────────────────────
  if (!(await verifyAdmin(ctx.request, ctx.env))) return e("Unauthorized", 401);

  const { email, password, location_id, location_name } = await ctx.request.json();
  if (!email || !password) return e("email and password required", 400);
  try {
    await ctx.env.DB.prepare(
      "INSERT INTO store_users (email, password, location_id, location_name) VALUES (?, ?, ?, ?)"
    ).bind(email.toLowerCase().trim(), password, location_id || "all", location_name || "All Stores").run();
    return j({ success: true });
  } catch (err) {
    if (err.message?.includes("UNIQUE")) return e("Email already exists", 409);
    return e(err.message, 500);
  }
}

export async function onRequestGet(ctx) {
  if (!(await verifyAdmin(ctx.request, ctx.env))) return e("Unauthorized", 401);
  const { results } = await ctx.env.DB.prepare(
    "SELECT id, email, location_id, location_name, created_at FROM store_users ORDER BY created_at DESC"
  ).all();
  return j(results);
}

export async function onRequestDelete(ctx) {
  if (!(await verifyAdmin(ctx.request, ctx.env))) return e("Unauthorized", 401);
  const id = new URL(ctx.request.url).searchParams.get("id");
  if (!id) return e("id required", 400);
  await ctx.env.DB.prepare("DELETE FROM store_users WHERE id = ?").bind(id).run();
  return j({ success: true });
}
