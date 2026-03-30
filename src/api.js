// API client for GuardTrack frontend
const API = "/api";

function getToken() { return localStorage.getItem("guardtrack_token"); }
function authHeaders() {
  const t = getToken();
  return t ? { "Authorization": `Bearer ${t}` } : {};
}

async function request(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...opts.headers },
  });

  if (res.headers.get("Content-Type")?.includes("text/csv")) {
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") || "";
    const match = cd.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : "export.csv";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    return { downloaded: true };
  }

  const contentType = res.headers.get("Content-Type") || "";
  if (!contentType.includes("application/json")) {
    const error = new Error("API returned non-JSON response. Functions may not be deployed.");
    error.status = res.status;
    error.data = { message: "API returned HTML instead of JSON — check Cloudflare Functions deployment" };
    throw error;
  }

  const data = await res.json();
  if (!res.ok) {
    const error = new Error(data.error || data.message || "Request failed");
    error.data = data; error.status = res.status;
    throw error;
  }
  return data;
}

// ── Public (Guard) ────────────────────────────────────────────────────────
export async function getStore(storeId) { return request(`/locations?id=${storeId}`); }

export async function markAttendance({ guard_name, guard_mobile, location_id, lat, lng, accuracy, selfie }) {
  return request("/attendance", {
    method: "POST",
    body: JSON.stringify({ guard_name, guard_mobile, location_id, lat, lng, accuracy, selfie }),
  });
}

// ── Admin Auth ─────────────────────────────────────────────────────────────
export async function adminLogin(password) {
  // POST to /api/admin/login to get a signed HMAC token
  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Invalid password");
  localStorage.setItem("guardtrack_token", data.token);
  localStorage.setItem("guardtrack_role", "admin");
  return data;
}
export function adminLogout() { 
  localStorage.removeItem("guardtrack_token"); 
  localStorage.removeItem("guardtrack_role");
}
export function isAdminLoggedIn() { return !!getToken(); }

// ── Admin: Locations ───────────────────────────────────────────────────────
export async function getLocations() { return request("/locations"); }
export async function createLocation(loc) {
  return request("/locations", { method: "POST", body: JSON.stringify(loc) });
}
export async function updateLocation(loc) {
  return request("/locations", { method: "PUT", body: JSON.stringify(loc) });
}
export async function deleteLocation(id) {
  return request(`/locations?id=${id}`, { method: "DELETE" });
}

// ── Admin: Attendance ──────────────────────────────────────────────────────
export async function getStoreStats() { return request("/attendance/stats"); }
export async function getStoreDays(storeId) { return request(`/attendance/days?store=${storeId}`); }
export async function getAttendance({ store, date, from, to, limit } = {}) {
  const p = new URLSearchParams();
  if (store) p.set("store", store);
  if (date)  p.set("date", date);
  if (from)  p.set("from", from);
  if (to)    p.set("to", to);
  if (limit) p.set("limit", String(limit));
  return request(`/attendance?${p}`);
}
export async function exportAttendanceCsv({ store, date, from, to } = {}) {
  const p = new URLSearchParams({ format: "csv" });
  if (store) p.set("store", store);
  if (date)  p.set("date", date);
  if (from)  p.set("from", from);
  if (to)    p.set("to", to);
  p.set("limit", "50000");
  return request(`/attendance?${p}`);
}

// ── Admin: Selfie ──────────────────────────────────────────────────────────
export async function getSelfie(recordId) { return request(`/selfie/${recordId}`); }

// ── Guard: Check-in status + Checkout ─────────────────────────────────────
export async function getCheckinStatus(store, guard) {
  return request(`/attendance/checkout?store=${encodeURIComponent(store)}&guard=${encodeURIComponent(guard)}`);
}
export async function checkOut({ attendance_id, guard_name, location_id }) {
  return request("/attendance/checkout", {
    method: "POST",
    body: JSON.stringify({ attendance_id, guard_name, location_id }),
  });
}

// ── Admin: Live Dashboard ──────────────────────────────────────────────────
export async function getDashboardStats() { return request("/dashboard"); }

// ── Admin: Store Users ─────────────────────────────────────────────────────
export async function getStoreUsers() { return request("/store-users"); }
export async function createStoreUser({ email, password, location_id, location_name }) {
  return request("/store-users", {
    method: "POST",
    body: JSON.stringify({ email, password, location_id, location_name }),
  });
}
export async function deleteStoreUser(id) {
  return request(`/store-users?id=${id}`, { method: "DELETE" });
}
export async function storeUserLogin({ email, password }) {
  const res = await fetch("/api/store-users/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Invalid credentials");
  localStorage.setItem("guardtrack_token", data.token || password);
  localStorage.setItem("guardtrack_role", "store");
  return data;
}
