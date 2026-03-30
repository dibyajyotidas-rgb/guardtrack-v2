import React, { useState, useEffect, useRef, useCallback } from "react";
import { BrowserRouter, Routes, Route, useParams, useNavigate, Link } from "react-router-dom";
import * as api from "./api";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/s/:storeId" element={<GuardPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/store/:storeId" element={<AdminStorePage />} />
        <Route path="/admin/store/:storeId/:day" element={<AdminDayPage />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </BrowserRouter>
  );
}

import { C, T, font } from "./theme";
import { Shell, Card, Btn, Input, Badge, Divider, Loader, Spinner, EmptyState, InfoRow } from "./components";

// ── LANDING ───────────────────────────────────────────────────────────────────
function LandingPage() {
  return (
    <Shell bg={C.surface}>
      <div style={{ maxWidth: 400, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
        <img src="/logo.jpeg" alt="Zippee" style={{ height: 48, width: "auto", objectFit: "contain", marginBottom: 20 }} />
        <p style={{ ...T.body, color: C.textSub, marginBottom: 28, lineHeight: 1.6 }}>Security guard attendance management system</p>
        <Link to="/admin" style={{ padding: "10px 22px", background: C.accent, color: "#fff", borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: "none", display: "inline-block", fontFamily: font }}>Open Admin Dashboard →</Link>
      </div>
    </Shell>
  );
}

// ── GUARD PAGE ────────────────────────────────────────────────────────────────
function GuardPage() {
  const { storeId } = useParams();
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [step, setStep] = useState("name");
  const [guardName, setGuardName] = useState("");
  const [guardMobile, setGuardMobile] = useState("");
  const [selfieData, setSelfieData] = useState(null);
  const [result, setResult] = useState(null);
  const [blockInfo, setBlockInfo] = useState(null);
  const [checkinRecord, setCheckinRecord] = useState(null);
  const [checkoutResult, setCheckoutResult] = useState(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    api.getStore(storeId).then(async (s) => {
      setStore(s); setLoading(false);
      try {
        const saved = JSON.parse(localStorage.getItem("guardtrack_guard") || "{}");
        const today = new Date().toISOString().slice(0, 10);
        if (saved.date === today && saved.store === storeId && saved.name) {
          setGuardName(saved.name); setGuardMobile(saved.mobile || "");
          try {
            const { record } = await api.getCheckinStatus(storeId, saved.name);
            if (record) {
              setCheckinRecord(record);
              if (record.checkout_time) { setCheckoutResult({ checkout_time: record.checkout_time, working_hours: record.working_hours, checkout_type: record.checkout_type }); setStep("checked_out"); }
              else setStep("checkout");
            }
          } catch {}
        } else localStorage.removeItem("guardtrack_guard");
      } catch { localStorage.removeItem("guardtrack_guard"); }
    }).catch(() => { setError("Store not found"); setLoading(false); });
  }, [storeId]);

  const stopCamera = useCallback(() => { if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; } }, []);
  const startCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 480 } } });
      streamRef.current = s;
      if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play(); }
    } catch { setStep("name"); }
  }, []);
  useEffect(() => { if (step === "selfie") startCamera(); else stopCamera(); return stopCamera; }, [step, startCamera, stopCamera]);

  const captureSelfie = () => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c) return;
    const scale = Math.min(480 / v.videoWidth, 480 / v.videoHeight, 1);
    c.width = v.videoWidth * scale; c.height = v.videoHeight * scale;
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
    const data = c.toDataURL("image/jpeg", 0.6);
    setSelfieData(data); stopCamera(); setStep("verifying");
    submitAttendance(data);
  };

  const submitAttendance = (selfie) => {
    if (!navigator.geolocation) { setStep("gps_error"); return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const res = await api.markAttendance({ guard_name: guardName, guard_mobile: guardMobile, location_id: storeId, lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy), selfie });
        localStorage.setItem("guardtrack_guard", JSON.stringify({ name: guardName, mobile: guardMobile, date: new Date().toISOString().slice(0, 10), store: storeId }));
        setResult(res); setStep("done");
        setTimeout(async () => { try { const { record } = await api.getCheckinStatus(storeId, guardName); if (record) setCheckinRecord(record); } catch {} }, 800);
      } catch (e) {
        if (e.status === 403 && e.data) setBlockInfo(e.data);
        else setBlockInfo({ distance: null, radius: store?.radius || 100, message: e.message || "Could not verify location" });
        setStep("blocked");
      }
    }, () => setStep("gps_error"), { enableHighAccuracy: true, timeout: 15000 });
  };

  const handleCheckout = async () => {
    setCheckingOut(true);
    try {
      const res = await api.checkOut({ guard_name: guardName, location_id: storeId });
      setCheckoutResult(res); setStep("checked_out");
    } catch (e) { alert(e.message || "Checkout failed"); }
    setCheckingOut(false);
  };

  const reset = () => {
    setStep("name"); setGuardName(""); setGuardMobile(""); setSelfieData(null);
    setResult(null); setBlockInfo(null); setCheckinRecord(null); setCheckoutResult(null);
    localStorage.removeItem("guardtrack_guard");
  };

  if (loading) return <Shell><Loader text="Loading store..." /></Shell>;
  if (error) return <Shell><div style={{ maxWidth: 400, margin: "80px auto", padding: 20 }}><Card><p style={{ ...T.body, textAlign: "center", color: C.red }}>{error}</p></Card></div></Shell>;

  return (
    <Shell bg={C.bg}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.jpeg" alt="Zippee" style={{ height: 32, width: "auto", objectFit: "contain" }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{store.name}</div>
            <div style={{ fontSize: 11, color: C.textMute }}>{store.address}</div>
          </div>
        </div>
        <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 8, padding: "6px 10px", textAlign: "center" }}>
          <div style={{ fontSize: 9, color: C.amber, fontWeight: 700, letterSpacing: ".5px" }}>EMERGENCY</div>
            <a href="tel:9818255272" style={{ display: "block", fontSize: 12, color: C.amber, fontWeight: 700, textDecoration: "none" }}>9818255272</a>
            <a href="tel:+911244430029" style={{ display: "block", fontSize: 12, color: C.amber, fontWeight: 700, textDecoration: "none" }}>+911244430029</a>
          </div>
      </div>

      <div style={{ maxWidth: 420, margin: "0 auto", padding: "24px 16px" }}>
        {step === "name" && (
          <Card>
            <h2 style={{ ...T.h2, marginBottom: 4 }}>Mark Attendance</h2>
            <p style={{ ...T.small, marginBottom: 20 }}>Enter your details to check in</p>
            <Input label="Full Name" value={guardName} onChange={setGuardName} placeholder="Rajesh Kumar" />
            <Input label="Mobile Number" value={guardMobile} onChange={setGuardMobile} placeholder="9818255272" type="tel" maxLength={10} />
            <Btn fullWidth disabled={!guardName.trim() || !guardMobile.trim()}
              onClick={async () => {
                const name = guardName.trim(), mobile = guardMobile.trim();
                if (!name || !mobile) return;
                setGuardName(name); setGuardMobile(mobile);
                try {
                  const { record } = await api.getCheckinStatus(storeId, name);
                  if (record) {
                    setCheckinRecord(record);
                    if (record.checkout_time) { setCheckoutResult({ checkout_time: record.checkout_time, working_hours: record.working_hours, checkout_type: record.checkout_type }); setStep("checked_out"); }
                    else setStep("checkout");
                  } else setStep("selfie");
                } catch { setStep("selfie"); }
              }}>Continue →</Btn>
          </Card>
        )}
        {step === "selfie" && (
          <Card>
            <button onClick={() => setStep("name")} style={{ background: "none", border: "none", color: C.accent, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 14 }}>← Back</button>
            <h2 style={{ ...T.h2, marginBottom: 4 }}>Take a Selfie</h2>
            <p style={{ ...T.small, marginBottom: 16 }}>{guardName} · {store.name}</p>
            <div style={{ background: "#000", borderRadius: 10, overflow: "hidden", width: "100%", aspectRatio: "1/1", marginBottom: 14 }}>
              <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
            </div>
            <canvas ref={canvasRef} style={{ display: "none" }} />
            <Btn fullWidth onClick={captureSelfie}>Capture & Verify Location</Btn>
          </Card>
        )}
        {step === "verifying" && (
          <Card style={{ textAlign: "center" }}>
            {selfieData && <img src={selfieData} alt="" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: `2px solid ${C.border}`, marginBottom: 12 }} />}
            <p style={{ ...T.h3, marginBottom: 4 }}>{guardName}</p>
            <Spinner />
            <p style={{ ...T.small }}>Verifying your location…</p>
          </Card>
        )}
        {step === "done" && result && (
          <Card>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ width: 48, height: 48, background: C.greenLight, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}><CheckIcon size={22} color={C.green} /></div>
              <h2 style={{ ...T.h2, marginBottom: 4 }}>Checked In</h2>
              <p style={{ ...T.small }}>{new Date(result.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · {result.location_name}</p>
            </div>
            <Divider />
            <div style={{ paddingTop: 16 }}>
              <p style={{ ...T.small, marginBottom: 10, textAlign: "center" }}>Tap below when your shift ends</p>
              <Btn fullWidth variant="ghost" onClick={() => { setCheckinRecord({ timestamp: result.timestamp }); setStep("checkout"); }}>Check Out</Btn>
            </div>
          </Card>
        )}
        {step === "checkout" && checkinRecord && (
          <Card>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ width: 48, height: 48, background: C.accentMid, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}><ClockIcon size={22} color={C.accent} /></div>
              <h2 style={{ ...T.h2, marginBottom: 4 }}>End Shift</h2>
              <p style={{ ...T.small }}>{guardName} · {store.name}</p>
            </div>
            <Divider />
            <div style={{ padding: "14px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: C.textSub }}>Checked in at</span>
                <span style={{ fontWeight: 600, color: C.green }}>{new Date(checkinRecord.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
            <Divider />
            <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <Btn fullWidth variant="danger" disabled={checkingOut} onClick={handleCheckout}>{checkingOut ? "Processing…" : "Confirm Check Out"}</Btn>
              <p style={{ ...T.small, textAlign: "center", cursor: "pointer", color: C.accent }} onClick={reset}>Not {guardName}? Switch guard</p>
            </div>
          </Card>
        )}
        {step === "checked_out" && checkoutResult && (
          <Card>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ width: 48, height: 48, background: C.greenLight, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}><CheckIcon size={22} color={C.green} /></div>
              <h2 style={{ ...T.h2, marginBottom: 4 }}>Shift Complete</h2>
              <p style={{ ...T.small }}>{guardName} · {store.name}</p>
            </div>
            <Divider />
            <div style={{ padding: "14px 0", display: "flex", flexDirection: "column", gap: 10 }}>
              {checkinRecord && <InfoRow label="Check-in" value={new Date(checkinRecord.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} />}
              <InfoRow label="Check-out" value={new Date(checkoutResult.checkout_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} valueColor={C.green} />
              <InfoRow label="Hours Worked" value={`${checkoutResult.working_hours} hrs`} valueColor={C.accent} />
            </div>
          </Card>
        )}
        {step === "blocked" && (
          <Card>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ width: 48, height: 48, background: C.redLight, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}><XIcon size={22} color={C.red} /></div>
              <h2 style={{ ...T.h2, marginBottom: 4 }}>Outside Geofence</h2>
              <p style={{ ...T.small }}>You must be within {blockInfo?.radius || store.radius}m of {store.name}</p>
            </div>
            <Divider />
            <div style={{ padding: "14px 0", display: "flex", flexDirection: "column", gap: 8 }}>
              {blockInfo?.distance != null && <InfoRow label="Your distance" value={`${blockInfo.distance}m`} valueColor={C.red} />}
              <InfoRow label="Required" value={`Within ${blockInfo?.radius || store.radius}m`} />
            </div>
            <Divider />
            <div style={{ paddingTop: 16 }}><Btn fullWidth onClick={reset}>Try Again</Btn></div>
          </Card>
        )}
        {step === "gps_error" && (
          <Card style={{ textAlign: "center" }}>
            <div style={{ width: 48, height: 48, background: C.amberLight, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><AlertIcon size={22} color={C.amber} /></div>
            <h2 style={{ ...T.h2, marginBottom: 8 }}>Location Access Denied</h2>
            <p style={{ ...T.small, marginBottom: 16 }}>Please enable GPS permissions in your browser and try again.</p>
            <Btn fullWidth onClick={reset}>Try Again</Btn>
          </Card>
        )}
      </div>
    </Shell>
  );
}

// ── ADMIN PAGE ────────────────────────────────────────────────────────────────
function AdminPage() {
  const [authState, setAuthState] = useState(() => {
    const token = localStorage.getItem("guardtrack_token");
    if (!token) return "none";
    try {
      const [ts] = token.split(".");
      if (Date.now() - parseInt(ts) > 86400000) { localStorage.removeItem("guardtrack_token"); return "none"; }
      return "logged_in";
    } catch { return "none"; }
  });
  const [role, setRole] = useState(() => localStorage.getItem("guardtrack_role") || "admin");
  const [tab, setTab] = useState("dashboard");

  if (authState === "none") return (
    <Shell bg={C.bg}>
      <AdminHeader />
      <AdminLogin onLogin={(r) => { setRole(r); setAuthState("logged_in"); }} />
    </Shell>
  );

  return (
    <Shell bg={C.bg}>
      <AdminHeader onLogout={() => { api.adminLogout(); setAuthState("none"); }} />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 40px" }}>
        <AdminTabs tabs={[
          { key: "dashboard", label: "Dashboard" },
          { key: "attendance", label: "Attendance" },
          { key: "locations", label: "Locations" },
          ...(role === "admin" ? [{ key: "users", label: "User Access" }] : []),
        ]} active={tab} onChange={setTab} />
        {tab === "dashboard"  && <AdminDashboard />}
        {tab === "attendance" && <AdminAttendanceList />}
        {tab === "locations"  && <AdminLocationsList readOnly={role === "store"} />}
        {tab === "users"      && role === "admin" && <AdminUserAccess />}
      </div>
    </Shell>
  );
}

function AdminHeader({ onLogout }) {
  return (
    <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <Link to="/admin" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
        <img src="/logo.jpeg" alt="Zippee" style={{ height: 32, width: "auto", objectFit: "contain" }} />
      </Link>
      {onLogout && <Btn variant="ghost" size="sm" onClick={onLogout}>Sign out</Btn>}
    </div>
  );
}

function AdminTabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: 28, marginTop: 4 }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          style={{ padding: "14px 16px", border: "none", background: "none", cursor: "pointer", fontSize: 14, fontWeight: active === t.key ? 600 : 400, color: active === t.key ? C.accent : C.textSub, borderBottom: `2px solid ${active === t.key ? C.accent : "transparent"}`, marginBottom: -1, fontFamily: font, transition: "all .15s" }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function AdminLogin({ onLogin }) {
  const [mode, setMode] = useState("admin");
  const [pass, setPass] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdmin = async () => { setLoading(true); setErr(""); try { await api.adminLogin(pass); onLogin("admin"); } catch { setErr("Invalid password"); } setLoading(false); };
  const handleUser = async () => { setLoading(true); setErr(""); try { await api.storeUserLogin({ email, password: pass }); onLogin("store"); } catch { setErr("Invalid email or password"); } setLoading(false); };

  return (
    <div style={{ maxWidth: 360, margin: "80px auto", padding: "0 20px" }}>
      <Card>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <img src="/logo.jpeg" alt="Zippee" style={{ height: 40, width: "auto", objectFit: "contain", marginBottom: 12 }} />
          <h2 style={{ ...T.h2, marginBottom: 4 }}>Sign in</h2>
          <p style={{ ...T.small }}>GuardTrack Admin</p>
        </div>
        <div style={{ display: "flex", background: C.bg, borderRadius: 8, padding: 3, marginBottom: 20 }}>
          {[["admin","Admin"], ["user","Store User"]].map(([k, label]) => (
            <button key={k} onClick={() => { setMode(k); setErr(""); setPass(""); setEmail(""); }}
              style={{ flex: 1, padding: "7px 0", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 500, fontSize: 13, background: mode === k ? C.surface : "transparent", color: mode === k ? C.text : C.textSub, boxShadow: mode === k ? "0 1px 3px rgba(0,0,0,.08)" : "none", fontFamily: font }}>
              {label}
            </button>
          ))}
        </div>
        {mode === "user" && <Input label="Email" value={email} onChange={setEmail} placeholder="user@company.com" type="email" />}
        <Input label="Password" value={pass} onChange={setPass} placeholder="Enter password" type="password" />
        {err && <p style={{ color: C.red, fontSize: 12, margin: "-8px 0 12px" }}>{err}</p>}
        <Btn fullWidth disabled={loading} onClick={mode === "admin" ? handleAdmin : handleUser}>{loading ? "Signing in…" : "Sign in"}</Btn>
      </Card>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dashTab, setDashTab] = useState("active");
  const today = new Date().toISOString().slice(0, 10);

  const load = () => { setLoading(true); api.getDashboardStats().then(s => { setStats(s); setLoading(false); }).catch(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  if (loading) return <Loader />;
  if (!stats) return <EmptyState text="Could not load dashboard" />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div><h2 style={{ ...T.h1, marginBottom: 2 }}>Overview</h2><p style={{ ...T.small, margin: 0 }}>{formatDate(today)}</p></div>
        <Btn variant="ghost" size="sm" onClick={load}>Refresh</Btn>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 28 }}>
        {[{ label: "Active Stores", value: stats.stores_active, sub: "today" }, { label: "No Activity", value: stats.stores_inactive, sub: "stores" }, { label: "Guards Present", value: stats.guards_present, sub: "today" }, { label: "Total Stores", value: stats.total_stores, sub: "registered" }].map(c => (
          <Card key={c.label} pad={18}>
            <p style={{ ...T.label, marginBottom: 8 }}>{c.label}</p>
            <p style={{ fontSize: 32, fontWeight: 700, color: C.text, margin: "0 0 2px", lineHeight: 1 }}>{c.value}</p>
            <p style={{ ...T.small, margin: 0 }}>{c.sub}</p>
          </Card>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["active","Active"], ["inactive","No Check-in"]].map(([k, label]) => (
          <button key={k} onClick={() => setDashTab(k)}
            style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${dashTab === k ? C.accent : C.border}`, background: dashTab === k ? C.accentLight : C.surface, color: dashTab === k ? C.accent : C.textSub, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: font }}>
            {label} · {k === "active" ? stats.store_breakdown?.length || 0 : stats.stores_inactive}
          </button>
        ))}
      </div>
      {dashTab === "active" && (!stats.store_breakdown?.length ? <EmptyState text="No attendance recorded today yet." /> : (
        <Card pad={0}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>{["Store","Guards Today","Last Check-in","Status"].map(h => <th key={h} style={{ padding: "11px 16px", textAlign: "left", ...T.label }}>{h}</th>)}</tr></thead>
            <tbody>
              {stats.store_breakdown.map((s, i) => {
                const t = new Date(s.last_checkin);
                const time = isNaN(t) ? s.last_checkin : t.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
                return (
                  <tr key={s.location_id} style={{ borderTop: i === 0 ? "none" : `1px solid ${C.borderLight}` }}>
                    <td style={{ padding: "12px 16px" }}><p style={{ fontWeight: 600, fontSize: 13, margin: "0 0 2px" }}>{s.location_name || s.location_id}</p><p style={{ ...T.small, margin: 0, color: C.textMute }}>{s.location_id}</p></td>
                    <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: 16, color: C.text }}>{s.guard_count}</td>
                    <td style={{ padding: "12px 16px", color: C.textMid }}>{time}</td>
                    <td style={{ padding: "12px 16px" }}><Badge color="green">Active</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ))}
      {dashTab === "inactive" && (!stats.inactive_stores?.length ? <EmptyState text="All stores have check-ins today." /> : (
        <Card pad={0}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>{["Store","Address","Status"].map(h => <th key={h} style={{ padding: "11px 16px", textAlign: "left", ...T.label }}>{h}</th>)}</tr></thead>
            <tbody>
              {stats.inactive_stores.map((s, i) => (
                <tr key={s.id} style={{ borderTop: i === 0 ? "none" : `1px solid ${C.borderLight}` }}>
                  <td style={{ padding: "12px 16px" }}><p style={{ fontWeight: 600, fontSize: 13, margin: "0 0 2px" }}>{s.name}</p><p style={{ ...T.small, margin: 0, color: C.textMute }}>{s.id}</p></td>
                  <td style={{ padding: "12px 16px", color: C.textSub }}>{s.address || "—"}</td>
                  <td style={{ padding: "12px 16px" }}><Badge color="red">No Check-in</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}

// ── ATTENDANCE ────────────────────────────────────────────────────────────────
function AdminAttendanceList() {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { api.getStoreStats().then(s => { setStats(s); setLoading(false); }).catch(() => setLoading(false)); }, []);

  if (loading) return <Loader />;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={T.h1}>Attendance</h2>
        <Btn variant="ghost" size="sm" onClick={() => api.exportAttendanceCsv({})}>Export CSV</Btn>
      </div>
      <Card pad={0}>
        {!stats.length ? <EmptyState text="No stores yet" /> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>{["Store","Address","Today","Total"].map(h => <th key={h} style={{ padding: "11px 16px", textAlign: "left", ...T.label }}>{h}</th>)}</tr></thead>
            <tbody>
              {stats.map((s, i) => (
                <tr key={s.id} onClick={() => navigate(`/admin/store/${s.id}`)} style={{ borderTop: i === 0 ? "none" : `1px solid ${C.borderLight}`, cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = C.bg} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "12px 16px", fontWeight: 600 }}>{s.name}</td>
                  <td style={{ padding: "12px 16px", color: C.textSub }}>{s.address || "—"}</td>
                  <td style={{ padding: "12px 16px" }}><span style={{ fontWeight: 700, color: s.today_count > 0 ? C.green : C.textMute }}>{s.today_count}</span></td>
                  <td style={{ padding: "12px 16px", color: C.textSub }}>{s.total_records}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function AdminStorePage() {
  const { storeId } = useParams();
  const [days, setDays] = useState([]);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7)); // "YYYY-MM"
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => { Promise.all([api.getStore(storeId), api.getStoreDays(storeId)]).then(([s, d]) => { setStore(s); setDays(d); setLoading(false); }).catch(() => setLoading(false)); }, [storeId]);

  // Build list of unique months from days data
  const months = [...new Set(days.map(d => d.day.slice(0, 7)))].sort((a, b) => b.localeCompare(a));

  // Generate every calendar day for the selected month
  const getDaysInMonth = (ym) => {
    const [y, m] = ym.split("-").map(Number);
    const count = new Date(y, m, 0).getDate();
    const result = [];
    for (let i = 1; i <= count; i++) {
      result.push(`${ym}-${String(i).padStart(2, "0")}`);
    }
    return result;
  };
  const activityMap = Object.fromEntries(days.map(d => [d.day, d]));
  const allDaysInMonth = getDaysInMonth(selectedMonth)
    .filter(d => d <= today) // don't show future dates
    .reverse(); // newest first

  if (loading) return <Shell bg={C.bg}><AdminHeader /><Loader /></Shell>;
  return (
    <Shell bg={C.bg}>
      <AdminHeader />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
        <Link to="/admin" style={{ fontSize: 13, color: C.accent, textDecoration: "none", fontWeight: 500 }}>← All Stores</Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "16px 0 20px" }}>
          <div><h2 style={{ ...T.h1, marginBottom: 2 }}>{store?.name}</h2><p style={{ ...T.small, margin: 0 }}>{store?.address}</p></div>
          <Btn variant="ghost" size="sm" onClick={() => api.exportAttendanceCsv({ store: storeId })}>Export CSV</Btn>
        </div>

        {/* Month filter */}
        {months.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {months.map(m => {
              const label = new Date(m + "-01").toLocaleDateString("en-IN", { month: "short", year: "numeric" });
              const active = selectedMonth === m;
              return (
                <button key={m} onClick={() => setSelectedMonth(m)}
                  style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${active ? C.accent : C.border}`, background: active ? C.accentLight : C.surface, color: active ? C.accent : C.textSub, fontSize: 13, fontWeight: active ? 600 : 400, cursor: "pointer", fontFamily: font }}>
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {!allDaysInMonth.length ? <EmptyState text="No dates to show yet." /> : (
          <Card pad={0}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>{["Date","Guards","Check-ins",""].map(h => <th key={h} style={{ padding: "11px 16px", textAlign: "left", ...T.label }}>{h}</th>)}</tr></thead>
              <tbody>
                {allDaysInMonth.map((dateStr, i) => {
                  const isToday = dateStr === today;
                  const d = activityMap[dateStr];
                  const hasActivity = !!d;
                  return (
                    <tr key={dateStr}
                      onClick={() => hasActivity && navigate(`/admin/store/${storeId}/${dateStr}`)}
                      style={{ borderTop: i === 0 ? "none" : `1px solid ${C.borderLight}`, cursor: hasActivity ? "pointer" : "default", background: hasActivity ? "transparent" : C.bg }}
                      onMouseEnter={e => { if (hasActivity) e.currentTarget.style.background = C.bg; }}
                      onMouseLeave={e => { e.currentTarget.style.background = hasActivity ? "transparent" : C.bg; }}>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontWeight: 500, color: hasActivity ? C.text : C.textMute }}>{formatDate(dateStr)}</span>
                        {isToday && <span style={{ marginLeft: 8 }}><Badge color="blue">Today</Badge></span>}
                      </td>
                      <td style={{ padding: "12px 16px", color: hasActivity ? C.textMid : C.textMute }}>{hasActivity ? d.guard_count : "—"}</td>
                      <td style={{ padding: "12px 16px", color: hasActivity ? C.textMid : C.textMute }}>{hasActivity ? d.checkin_count : "—"}</td>
                      <td style={{ padding: "12px 16px" }}>
                        {!hasActivity && <Badge color="red">No Activity</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </Shell>
  );
}

function AdminDayPage() {
  const { storeId, day } = useParams();
  const [records, setRecords] = useState([]);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewSelfie, setViewSelfie] = useState(null);
  const today = new Date().toISOString().slice(0, 10);
  const isToday = day === today;

  useEffect(() => { Promise.all([api.getStore(storeId), api.getAttendance({ store: storeId, date: day })]).then(([s, recs]) => { setStore(s); setRecords(recs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))); setLoading(false); }).catch(() => setLoading(false)); }, [storeId, day]);

  if (loading) return <Shell bg={C.bg}><AdminHeader /><Loader /></Shell>;
  return (
    <Shell bg={C.bg}>
      <AdminHeader />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
        <Link to={`/admin/store/${storeId}`} style={{ fontSize: 13, color: C.accent, textDecoration: "none", fontWeight: 500 }}>← {store?.name}</Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "16px 0 20px" }}>
          <div><h2 style={{ ...T.h1, marginBottom: 2 }}>{formatDate(day)} {isToday && <Badge color="blue">Today</Badge>}</h2><p style={{ ...T.small, margin: 0 }}>{records.length} check-in{records.length !== 1 ? "s" : ""}</p></div>
          <Btn variant="ghost" size="sm" onClick={() => api.exportAttendanceCsv({ store: storeId, date: day })}>Export CSV</Btn>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {records.map(r => {
            const autoCheckout = r.checkout_type === "auto";
            const noCheckout = !r.checkout_time;
            return (
              <Card key={r.id} pad={16} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <SelfieThumb recordId={r.id} selfieUrl={r.selfie_url} onClick={() => setViewSelfie(r)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 14, margin: "0 0 2px" }}>{r.guard_name}</p>
                  {r.guard_mobile && <p style={{ ...T.small, margin: "0 0 3px", color: C.textMute }}>{r.guard_mobile}</p>}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: C.textSub, flexWrap: "wrap" }}>
                    <span>In: <strong>{new Date(r.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</strong></span>
                    {r.checkout_time && !autoCheckout && <span>Out: <strong style={{ color: C.green }}>{new Date(r.checkout_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</strong></span>}
                    {r.working_hours && !autoCheckout && <span style={{ color: C.accent, fontWeight: 600 }}>{r.working_hours} hrs</span>}
                    {autoCheckout && <span style={{ color: C.amber, fontWeight: 500 }}>Did not check out</span>}
                    {noCheckout && !autoCheckout && <span style={{ color: C.textMute }}>On shift</span>}
                  </div>
                </div>
                <div style={{ textAlign: "right", fontSize: 12, color: C.textSub, flexShrink: 0 }}>
                  <span style={{ color: C.green, fontWeight: 600 }}>{r.distance}m</span>
                  {r.accuracy && <div style={{ color: C.textMute }}>±{r.accuracy}m</div>}
                </div>
              </Card>
            );
          })}
        </div>
        {viewSelfie && (
          <div onClick={() => setViewSelfie(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            {viewSelfie.selfie_url ? <img src={viewSelfie.selfie_url} alt="" style={{ maxWidth: "90%", maxHeight: "80vh", borderRadius: 12 }} /> : <Spinner />}
          </div>
        )}
      </div>
    </Shell>
  );
}

// ── LOCATIONS ─────────────────────────────────────────────────────────────────
function AdminLocationsList({ readOnly = false }) {
  const [locs, setLocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formTab, setFormTab] = useState("basic");
  const [form, setForm] = useState({ name: "", address: "", lat: "", lng: "", radius: 150, vendor_name: "", area_manager_name: "", area_manager_phone: "", zippee_poc_name: "" });
  const [copied, setCopied] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const load = () => { api.getLocations().then(setLocs).finally(() => setLoading(false)); };
  useEffect(load, []);
  const baseUrl = window.location.origin + "/s/";

  const openAdd = () => { setForm({ name: "", address: "", lat: "", lng: "", radius: 150, vendor_name: "", area_manager_name: "", area_manager_phone: "", zippee_poc_name: "" }); setEditId(null); setFormTab("basic"); setShowForm(true); };
  const openEdit = (loc) => { setForm({ name: loc.name, address: loc.address || "", lat: String(loc.lat), lng: String(loc.lng), radius: loc.radius, vendor_name: loc.vendor_name || "", area_manager_name: loc.area_manager_name || "", area_manager_phone: loc.area_manager_phone || "", zippee_poc_name: loc.zippee_poc_name || "" }); setEditId(loc.id); setFormTab("basic"); setShowForm(true); };
  const save = async () => {
    const payload = { name: form.name, address: form.address, lat: parseFloat(form.lat), lng: parseFloat(form.lng), radius: Number(form.radius), vendor_name: form.vendor_name, area_manager_name: form.area_manager_name, area_manager_phone: form.area_manager_phone, zippee_poc_name: form.zippee_poc_name };
    if (!payload.name || isNaN(payload.lat) || isNaN(payload.lng)) return;
    if (editId) await api.updateLocation({ id: editId, ...payload }); else await api.createLocation(payload);
    setShowForm(false); load();
  };
  const del = async (id) => { if (!window.confirm("Delete this store?")) return; await api.deleteLocation(id); load(); };
  const copyLink = (id) => { navigator.clipboard?.writeText(baseUrl + id); setCopied(id); setTimeout(() => setCopied(null), 2000); };

  if (loading) return <Loader />;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div><h2 style={T.h1}>Locations</h2><p style={{ ...T.small, margin: "2px 0 0" }}>{locs.length} stores</p></div>
        {!readOnly && <Btn size="sm" onClick={openAdd}>+ Add Store</Btn>}
      </div>

      {!readOnly && showForm && (
        <Card style={{ marginBottom: 16 }}>
          <h3 style={{ ...T.h3, marginBottom: 14 }}>{editId ? "Edit" : "Add"} Location</h3>
          <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
            {[["basic","Store Details"], ["contacts","Contacts"]].map(([k, label]) => (
              <button key={k} onClick={() => setFormTab(k)}
                style={{ padding: "8px 14px", border: "none", background: "none", cursor: "pointer", fontSize: 13, fontWeight: formTab === k ? 600 : 400, color: formTab === k ? C.accent : C.textSub, borderBottom: `2px solid ${formTab === k ? C.accent : "transparent"}`, marginBottom: -1, fontFamily: font }}>
                {label}
              </button>
            ))}
          </div>
          {formTab === "basic" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "span 2" }}><Input label="Store Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Dark Store — Sector 18" /></div>
              <div style={{ gridColumn: "span 2" }}><Input label="Address" value={form.address} onChange={v => setForm(f => ({ ...f, address: v }))} placeholder="Area, City" /></div>
              <Input label="Latitude" value={form.lat} onChange={v => setForm(f => ({ ...f, lat: v }))} placeholder="28.5355" />
              <Input label="Longitude" value={form.lng} onChange={v => setForm(f => ({ ...f, lng: v }))} placeholder="77.3910" />
              <div style={{ gridColumn: "span 2" }}>
                <label style={{ ...T.label, display: "block", marginBottom: 6 }}>Geofence Radius: {form.radius}m</label>
                <input type="range" min={25} max={500} step={25} value={form.radius} onChange={e => setForm(f => ({ ...f, radius: Number(e.target.value) }))} style={{ width: "100%", accentColor: C.accent }} />
                <div style={{ display: "flex", justifyContent: "space-between", ...T.small }}><span>25m</span><span>500m</span></div>
              </div>
            </div>
          )}
          {formTab === "contacts" && (
            <div>
              <Input label="Vendor Name" value={form.vendor_name} onChange={v => setForm(f => ({ ...f, vendor_name: v }))} placeholder="e.g. Acme Security Pvt Ltd" />
              <Input label="Area Manager Name" value={form.area_manager_name} onChange={v => setForm(f => ({ ...f, area_manager_name: v }))} placeholder="e.g. Suresh Sharma" />
              <Input label="Area Manager Phone" value={form.area_manager_phone} onChange={v => setForm(f => ({ ...f, area_manager_phone: v }))} placeholder="e.g. 9818255272" type="tel" />
              <Input label="Zippee POC Name" value={form.zippee_poc_name} onChange={v => setForm(f => ({ ...f, zippee_poc_name: v }))} placeholder="e.g. Rahul Verma" />
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <Btn onClick={save}>Save</Btn>
            <Btn variant="ghost" onClick={() => setShowForm(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {locs.map(loc => {
          const expanded = expandedId === loc.id;
          const hasContacts = loc.vendor_name || loc.area_manager_name || loc.zippee_poc_name;
          return (
            <Card key={loc.id} pad={0}>
              <div style={{ padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 14, margin: "0 0 2px" }}>{loc.name}</p>
                  <p style={{ ...T.small, margin: 0 }}>{loc.address} · {loc.radius}m fence</p>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                  {hasContacts && <button onClick={() => setExpandedId(expanded ? null : loc.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: C.accent, fontWeight: 500, fontFamily: font, padding: "4px 8px" }}>{expanded ? "Hide" : "Details"}</button>}
                  {!readOnly && <><Btn variant="ghost" size="sm" onClick={() => openEdit(loc)}>Edit</Btn><Btn variant="ghost" size="sm" onClick={() => del(loc.id)} style={{ color: C.red }}>Delete</Btn></>}
                </div>
              </div>
              {expanded && hasContacts && (
                <div style={{ borderTop: `1px solid ${C.borderLight}`, padding: "14px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                  {loc.vendor_name && <div><p style={{ ...T.label, marginBottom: 3 }}>Vendor</p><p style={{ fontSize: 13, fontWeight: 500, margin: 0, color: C.textMid }}>{loc.vendor_name}</p></div>}
                  {loc.area_manager_name && <div><p style={{ ...T.label, marginBottom: 3 }}>Area Manager</p><p style={{ fontSize: 13, fontWeight: 500, margin: 0, color: C.textMid }}>{loc.area_manager_name}</p>{loc.area_manager_phone && <a href={`tel:${loc.area_manager_phone}`} style={{ fontSize: 12, color: C.accent, textDecoration: "none" }}>{loc.area_manager_phone}</a>}</div>}
                  {loc.zippee_poc_name && <div><p style={{ ...T.label, marginBottom: 3 }}>Zippee POC</p><p style={{ fontSize: 13, fontWeight: 500, margin: 0, color: C.textMid }}>{loc.zippee_poc_name}</p></div>}
                </div>
              )}
              <div style={{ borderTop: `1px solid ${C.borderLight}`, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, background: C.bg, borderRadius: "0 0 12px 12px" }}>
                <code style={{ fontSize: 11, color: C.textSub, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{baseUrl}{loc.id}</code>
                <Btn variant="ghost" size="sm" onClick={() => copyLink(loc.id)} style={{ flexShrink: 0, color: copied === loc.id ? C.green : C.textMid }}>{copied === loc.id ? "Copied!" : "Copy"}</Btn>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── USER ACCESS ───────────────────────────────────────────────────────────────
function AdminUserAccess() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [formErr, setFormErr] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => { api.getStoreUsers().then(u => { setUsers(u); setLoading(false); }).catch(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setFormErr("");
    if (!form.email || !form.password) { setFormErr("All fields are required"); return; }
    setSaving(true);
    try { await api.createStoreUser({ email: form.email, password: form.password, location_id: "all", location_name: "All Stores" }); setShowForm(false); setForm({ email: "", password: "" }); load(); }
    catch (e) { setFormErr(e.message || "Error adding user"); }
    setSaving(false);
  };
  const del = async (id) => { if (!window.confirm("Remove access?")) return; await api.deleteStoreUser(id); load(); };

  if (loading) return <Loader />;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div><h2 style={T.h1}>User Access</h2><p style={{ ...T.small, margin: "2px 0 0" }}>Users can view all stores. Cannot add or edit locations.</p></div>
        <Btn size="sm" onClick={() => { setShowForm(true); setFormErr(""); }}>+ Add User</Btn>
      </div>
      {showForm && (
        <Card style={{ marginBottom: 16 }}>
          <h3 style={{ ...T.h3, marginBottom: 16 }}>Add User</h3>
          <Input label="Email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="user@company.com" type="email" />
          <Input label="Password" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} placeholder="Set a password" />
          {formErr && <p style={{ color: C.red, fontSize: 12, margin: "-8px 0 12px" }}>{formErr}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <Btn disabled={saving} onClick={save}>{saving ? "Saving…" : "Add User"}</Btn>
            <Btn variant="ghost" onClick={() => setShowForm(false)}>Cancel</Btn>
          </div>
        </Card>
      )}
      {!users.length && !showForm ? <EmptyState text="No users added yet." /> : (
        <Card pad={0}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>{["Email","Access","Created",""].map((h, i) => <th key={i} style={{ padding: "11px 16px", textAlign: "left", ...T.label }}>{h}</th>)}</tr></thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} style={{ borderTop: i === 0 ? "none" : `1px solid ${C.borderLight}` }}>
                  <td style={{ padding: "12px 16px", fontWeight: 500 }}>{u.email}</td>
                  <td style={{ padding: "12px 16px" }}><Badge color="blue">All Stores</Badge></td>
                  <td style={{ padding: "12px 16px", color: C.textSub }}>{u.created_at?.slice(0, 10) || "—"}</td>
                  <td style={{ padding: "12px 16px" }}><Btn variant="ghost" size="sm" onClick={() => del(u.id)} style={{ color: C.red }}>Remove</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ── SHARED ────────────────────────────────────────────────────────────────────
function SelfieThumb({ recordId, selfieUrl, onClick }) {
  const [src, setSrc] = useState(selfieUrl || null);
  useEffect(() => { if (!selfieUrl && recordId) api.getSelfie(recordId).then(d => d?.selfie && setSrc(d.selfie)).catch(() => {}); }, [recordId, selfieUrl]);
  if (!src) return <div style={{ width: 40, height: 40, borderRadius: "50%", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: `1px solid ${C.border}` }}><UserIcon size={16} color={C.textMute} /></div>;
  return <img src={src} alt="" onClick={onClick} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", border: `1px solid ${C.border}`, cursor: "pointer", flexShrink: 0 }} />;
}

// ── ICONS ─────────────────────────────────────────────────────────────────────
function CheckIcon({ size = 18, color = "currentColor" }) { return <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>; }
function XIcon({ size = 18, color = "currentColor" }) { return <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function ClockIcon({ size = 18, color = "currentColor" }) { return <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
function AlertIcon({ size = 18, color = "currentColor" }) { return <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>; }
function UserIcon({ size = 18, color = "currentColor" }) { return <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }

// ── UTILS ─────────────────────────────────────────────────────────────────────
function formatDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
