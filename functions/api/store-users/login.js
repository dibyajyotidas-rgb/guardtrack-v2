// functions/api/store-users/login.js
// Handles POST /api/store-users/login

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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
  try {
    const { email, password } = await ctx.request.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password required" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }

    const user = await ctx.env.DB.prepare(
      "SELECT id, email, location_id, location_name FROM store_users WHERE email = ? AND password = ?"
    ).bind(email.toLowerCase().trim(), password).first();

    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid email or password" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }

    const token = await createToken(ctx.env);
    return new Response(JSON.stringify({ success: true, token, user }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" }
    });
  }
}
