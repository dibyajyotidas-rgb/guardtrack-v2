import { json, err, cors, verifyAdmin } from "../helpers.js";

// GET /api/selfie/:id — serves selfie base64 from D1 by attendance record ID

export async function onRequestOptions() { return cors(); }

export async function onRequestGet(ctx) {
  if (!(await verifyAdmin(ctx.request, ctx.env)))
    return err("Unauthorized", 401);

  // Extract record ID from the URL
  const url = new URL(ctx.request.url);
  const id = url.pathname.replace("/api/selfie/", "").trim();

  if (!id) return err("Record ID required", 400);

  const record = await ctx.env.DB.prepare(
    "SELECT selfie_data FROM attendance WHERE id = ?"
  ).bind(id).first();

  if (!record || !record.selfie_data) return err("Selfie not found", 404);

  // selfie_data is a base64 data URL like "data:image/jpeg;base64,..."
  // Return it as JSON so the frontend can use it directly as img src
  return json({ selfie: record.selfie_data });
}
