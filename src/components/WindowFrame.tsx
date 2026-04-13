"use client";

import React from "react";
import { TableTheme } from "@/lib/types";

interface WindowFrameProps {
  style: "mac" | "windows" | "none";
  children: React.ReactNode;
  title?: string;
  borderRadius?: number;
  theme?: TableTheme;
}

export default function WindowFrame({ style, children, title, borderRadius, theme }: WindowFrameProps) {
  if (style === "none") return <>{children}</>;

  // Derive frame colors from the theme when available, fall back to CSS vars
  const frameBg = theme?.rowBg || "var(--window-bg)";
  const surfaceBg = theme?.headerBg || "var(--window-surface)";
  const borderColor = theme?.borderColor || "var(--window-border)";
  const titleColor = theme?.rowText || "var(--text-faint)";
  const btnColor = theme?.rowText || "var(--text-faint)";
  const btnBg = theme?.altRowBg || "var(--surface)";

  if (style === "mac") {
    return (
      <div
        style={{
          background: frameBg,
          borderRadius: borderRadius != null ? `${borderRadius}px` : "12px",
          overflow: "hidden",
          boxShadow: "none",
          border: `1px solid ${borderColor}`,
        }}
      >
        {/* Mac titlebar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "13px 16px",
            background: surfaceBg,
            borderBottom: `1px solid ${borderColor}`,
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
                color: titleColor,
                fontSize: "12px",
                fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
                marginLeft: "-44px",
                opacity: 0.6,
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
        background: frameBg,
        borderRadius: borderRadius != null ? `${borderRadius}px` : "8px",
        overflow: "hidden",
        boxShadow: "none",
        border: `1px solid ${borderColor}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          background: surfaceBg,
          borderBottom: `1px solid ${borderColor}`,
        }}
      >
        <span
          style={{
            color: titleColor,
            fontSize: "12px",
            fontFamily: "Segoe UI, sans-serif",
            opacity: 0.7,
          }}
        >
          {title ?? "PastePretty"}
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
                color: btnColor,
                fontSize: "11px",
                borderRadius: "3px",
                background: btnBg,
                opacity: 0.6,
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
