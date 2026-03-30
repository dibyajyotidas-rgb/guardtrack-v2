import { json, err, cors, createAdminToken } from "../helpers.js";

// POST /api/admin/login — authenticate admin, return token
export async function onRequestOptions() { return cors(); }
export async function onRequestPost(ctx) {
  const body = await ctx.request.json();
  const { password } = body;
  const correctPassword = ctx.env.ADMIN_SECRET || ctx.env.ADMIN_PASSWORD || "admin123";

  // Temporary debug — remove after fixing
  if (password !== correctPassword) {
    return err(`Invalid password. Env has ADMIN_SECRET: ${!!ctx.env.ADMIN_SECRET}, ADMIN_PASSWORD: ${!!ctx.env.ADMIN_PASSWORD}`, 401);
  }

  const token = await createAdminToken(ctx.env);
  return json({ token, expires_in: 86400 });
}
