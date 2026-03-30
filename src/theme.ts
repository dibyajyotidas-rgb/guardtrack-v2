export const C = {
  bg: "#FAFAFA", // Very light, clean gray
  surface: "#FFFFFF",
  border: "#E2E8F0",
  borderLight: "#F1F5F9",
  text: "#0F172A", // Slate dark
  textMid: "#475569",
  textSub: "#64748B",
  textMute: "#94A3B8",
  accent: "#1E293B", // Professional slate accent
  accentLight: "#F8FAFC",
  accentMid: "#E2E8F0",
  green: "#10B981", 
  greenLight: "#ECFDF5", 
  red: "#EF4444", 
  redLight: "#FEF2F2",
  amber: "#F59E0B", 
  amberLight: "#FFFBEB",
  blue: "#2563EB",
};

export const font = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'";

export const T = {
  h1: { fontSize: 24, fontWeight: 600 as const, color: C.text, margin: 0, letterSpacing: "-0.02em" },
  h2: { fontSize: 18, fontWeight: 600 as const, color: C.text, margin: 0, letterSpacing: "-0.01em" },
  h3: { fontSize: 15, fontWeight: 500 as const, color: C.text, margin: 0 },
  body: { fontSize: 14, color: C.textMid, lineHeight: 1.5 },
  small: { fontSize: 13, color: C.textSub },
  label: { fontSize: 11, fontWeight: 600 as const, color: C.textSub, textTransform: "uppercase" as const, letterSpacing: "0.05em" },
};
