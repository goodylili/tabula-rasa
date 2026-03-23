"use client";

import React from "react";

interface WindowFrameProps {
  style: "mac" | "windows" | "none";
  children: React.ReactNode;
  title?: string;
}

export default function WindowFrame({ style, children, title }: WindowFrameProps) {
  if (style === "none") return <>{children}</>;

  if (style === "mac") {
    return (
      <div
        style={{
          background: "rgba(30,30,40,0.85)",
          backdropFilter: "blur(20px)",
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Mac titlebar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "13px 16px",
            background: "rgba(255,255,255,0.04)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ff5f57" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#febc2e" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#28c840" }} />
          {title && (
            <span
              style={{
                flex: 1,
                textAlign: "center",
                color: "rgba(255,255,255,0.4)",
                fontSize: "12px",
                fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
                marginLeft: "-44px",
              }}
            >
              {title}
            </span>
          )}
        </div>
        <div>{children}</div>
      </div>
    );
  }

  // Windows style
  return (
    <div
      style={{
        background: "rgba(30,30,40,0.85)",
        backdropFilter: "blur(20px)",
        borderRadius: "8px",
        overflow: "hidden",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          background: "rgba(255,255,255,0.04)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span
          style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: "12px",
            fontFamily: "Segoe UI, sans-serif",
          }}
        >
          {title ?? "tabula-rasa"}
        </span>
        <div style={{ display: "flex", gap: "8px" }}>
          {["─", "□", "✕"].map((icon, i) => (
            <div
              key={i}
              style={{
                width: 24,
                height: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(255,255,255,0.4)",
                fontSize: "11px",
                borderRadius: "3px",
                background: "rgba(255,255,255,0.05)",
              }}
            >
              {icon}
            </div>
          ))}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}
