"use client";

import React from "react";

interface WindowFrameProps {
  style: "mac" | "windows" | "none";
  children: React.ReactNode;
  title?: string;
  borderRadius?: number;
}

export default function WindowFrame({ style, children, title, borderRadius }: WindowFrameProps) {
  if (style === "none") return <>{children}</>;

  if (style === "mac") {
    return (
      <div
        style={{
          background: "var(--window-bg)",
          backdropFilter: "blur(20px)",
          borderRadius: borderRadius != null ? `${borderRadius}px` : "12px",
          overflow: "hidden",
          boxShadow: "none",
          border: "1px solid var(--border-subtle)",
        }}
      >
        {/* Mac titlebar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "13px 16px",
            background: "var(--window-surface)",
            borderBottom: "1px solid var(--window-border)",
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
                color: "var(--text-faint)",
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
        background: "var(--window-bg)",
        backdropFilter: "blur(20px)",
        borderRadius: borderRadius != null ? `${borderRadius}px` : "8px",
        overflow: "hidden",
        boxShadow: "none",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          background: "var(--window-surface)",
          borderBottom: "1px solid var(--window-border)",
        }}
      >
        <span
          style={{
            color: "var(--text-muted)",
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
                color: "var(--text-faint)",
                fontSize: "11px",
                borderRadius: "3px",
                background: "var(--surface)",
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
