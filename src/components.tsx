import React, { CSSProperties, ReactNode } from "react";
import { C, T, font } from "./theme";

export function Shell({ children, bg = C.bg }: { children: ReactNode; bg?: string }) {
  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: font, color: C.text, transition: "background 0.2s ease" }}>
      {children}
    </div>
  );
}

export function Card({ children, style, pad = 24 }: { children: ReactNode; style?: CSSProperties; pad?: number }) {
  return (
    <div style={{ 
      background: C.surface, 
      borderRadius: 16, 
      border: `1px solid ${C.border}`, 
      padding: pad, 
      boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.03)", 
      ...style 
    }}>
      {children}
    </div>
  );
}

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "danger" | "ghost" | "subtle";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}

export function Btn({ children, variant = "primary", size = "md", fullWidth, style, disabled, ...props }: BtnProps) {
  const base: CSSProperties = { 
    border: "none", 
    borderRadius: 8, 
    fontWeight: 500, 
    cursor: disabled ? "not-allowed" : "pointer", 
    display: "inline-flex", 
    alignItems: "center", 
    justifyContent: "center", 
    gap: 8, 
    transition: "all 0.15s ease", 
    opacity: disabled ? 0.6 : 1, 
    fontFamily: font,
    ...style 
  };
  
  const sizes: Record<string, CSSProperties> = { 
    sm: { padding: "8px 14px", fontSize: 13 }, 
    md: { padding: "10px 20px", fontSize: 14 }, 
    lg: { padding: "12px 24px", fontSize: 15 } 
  };
  
  const variants: Record<string, CSSProperties> = { 
    primary: { background: C.accent, color: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: `1px solid ${C.accent}` }, 
    danger: { background: C.red, color: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }, 
    ghost: { background: "transparent", color: C.textMid, border: `1px solid ${C.border}` }, 
    subtle: { background: C.bg, color: C.textMid, border: `1px solid transparent` } 
  };
  
  return (
    <button 
      disabled={disabled} 
      style={{ ...base, ...sizes[size], ...variants[variant], width: fullWidth ? "100%" : undefined }}
      onMouseOver={(e) => {
        if (!disabled) {
          if (variant === "primary") e.currentTarget.style.opacity = "0.9";
          if (variant === "ghost") { e.currentTarget.style.background = C.accentLight; e.currentTarget.style.color = C.text; }
        }
      }}
      onMouseOut={(e) => {
        if (!disabled) {
          if (variant === "primary") e.currentTarget.style.opacity = "1";
          if (variant === "ghost") { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textMid; }
        }
      }}
      {...props}
    >
      {children}
    </button>
  );
}

interface InputProps {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  style?: CSSProperties;
}

export function Input({ label, value, onChange, placeholder, type = "text", maxLength, style }: InputProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ ...T.label, display: "block", marginBottom: 6 }}>{label}</label>}
      <input 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        placeholder={placeholder} 
        type={type} 
        maxLength={maxLength}
        style={{ 
          width: "100%", 
          padding: "12px 14px", 
          border: `1px solid ${C.border}`, 
          borderRadius: 8, 
          fontSize: 14, 
          color: C.text, 
          outline: "none", 
          boxSizing: "border-box", 
          fontFamily: font, 
          background: C.surface, 
          transition: "border 0.2s ease, box-shadow 0.2s ease",
          ...style 
        }} 
        onFocus={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.boxShadow = `0 0 0 3px ${C.border}`; }}
        onBlur={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none"; }}
      />
    </div>
  );
}

export function Badge({ children, color = "green" }: { children: ReactNode; color?: "green" | "red" | "amber" | "blue" | "gray" }) {
  const map: Record<string, { bg: string; text: string; border?: string }> = { 
    green: { bg: C.greenLight, text: C.green }, 
    red: { bg: C.redLight, text: C.red }, 
    amber: { bg: C.amberLight, text: C.amber }, 
    blue: { bg: C.accentLight, text: C.blue },
    gray: { bg: C.bg, text: C.textMid, border: C.border }
  };
  const c = map[color] || map.green;
  return (
    <span style={{ 
      background: c.bg, 
      color: c.text, 
      border: c.border ? `1px solid ${c.border}` : "1px solid transparent",
      fontSize: 12, 
      fontWeight: 500, 
      padding: "3px 10px", 
      borderRadius: 16 
    }}>
      {children}
    </span>
  );
}

export function Divider() { 
  return <div style={{ height: 1, background: C.borderLight, margin: "24px -24px" }} />; 
}

export function Loader({ text = "Loading..." }: { text?: string }) {
  return (
    <div style={{ textAlign: "center", padding: 60, color: C.textMute }}>
      <div style={{ width: 24, height: 24, border: `2px solid ${C.borderLight}`, borderTopColor: C.textMid, borderRadius: "50%", margin: "0 auto 16px", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)} to{transform:rotate(360deg)}}`}</style>
      <p style={{ ...T.small, margin: 0, fontWeight: 500 }}>{text}</p>
    </div>
  );
}

export function Spinner({ size = 24 }: { size?: number }) {
  return (
    <>
      <div style={{ width: size, height: size, border: `2px solid ${C.borderLight}`, borderTopColor: C.textMid, borderRadius: "50%", margin: "20px auto", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)} to{transform:rotate(360deg)}}`}</style>
    </>
  );
}

export function EmptyState({ text }: { text: string }) { 
  return (
    <div style={{ textAlign: "center", padding: "48px 24px", color: C.textSub, fontSize: 14, background: C.bg, borderRadius: 12, border: `1px dashed ${C.border}` }}>
      {text}
    </div>
  ); 
}

export function InfoRow({ label, value, valueColor }: { label: ReactNode; value: ReactNode; valueColor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "8px 0" }}>
      <span style={{ color: C.textSub }}>{label}</span>
      <span style={{ fontWeight: 500, color: valueColor || C.text }}>{value}</span>
    </div>
  );
}
