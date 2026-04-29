"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { toPng, toJpeg, toSvg } from "html-to-image";
import { TableData, Background } from "@/lib/types";
import { detectAndParse } from "@/lib/parser";
import { exportData, downloadText, ExportFormat, sanitizeFilename } from "@/lib/exporters";
import { themes, getTheme } from "@/lib/themes";
import { presetBackgrounds, backgroundToCss } from "@/lib/backgrounds";
import { FONT_OPTIONS } from "@/lib/fonts";
import { transformThemeForLightMode, transformBackgroundForLightMode } from "@/lib/lightMode";
import WindowFrame from "@/components/WindowFrame";
import {
  Download, Upload, ChevronDown, Image, FileJson, FileSpreadsheet,
  FileText, Database, Sun, Moon, Github, X,
} from "lucide-react";

// ─── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "pastepretty-comparison";

const SAMPLE_COMPARISON = `| Metric | Q1 2024 | Q2 2024 |
|--------|---------|---------|
| Revenue | $42,000 | $55,000 |
| Users | 12,400 | 18,200 |
| Conversion | 3.2% | 4.2% |
| Churn Rate | 2.1% | 1.3% |
| Avg Order | $85 | $92 |
| NPS Score | 42 | 58 |`;

const EXPORT_FORMATS: { id: ExportFormat; label: string; ext: string; icon: React.ReactNode }[] = [
  { id: "png", label: "PNG Image", ext: "png", icon: <Image size={13} /> },
  { id: "jpg", label: "JPG Image", ext: "jpg", icon: <Image size={13} /> },
  { id: "svg", label: "SVG Image", ext: "svg", icon: <Image size={13} /> },
  { id: "json", label: "JSON", ext: "json", icon: <FileJson size={13} /> },
  { id: "csv", label: "CSV", ext: "csv", icon: <FileSpreadsheet size={13} /> },
  { id: "markdown", label: "Markdown", ext: "md", icon: <FileText size={13} /> },
  { id: "postgresql", label: "PostgreSQL", ext: "sql", icon: <Database size={13} /> },
];

type LayoutVariant = "side-by-side" | "stacked" | "with-bars";
type NumberFormat = "auto" | "currency" | "percent" | "compact" | "plain";

// ─── Comparison State ───────────────────────────────────────────────────────

interface ComparisonState {
  rawInput: string;
  inputFormat: "json" | "markdown" | "csv" | "postgresql" | "auto";
  tableData: TableData | null;
  themeId: string;
  background: Background;
  windowStyle: "mac" | "windows" | "none";
  fontSize: number;
  borderRadius: number;
  padding: number;
  fontFamily: string;
  title: string;
  labelColumn: number;
  columnA: number;
  columnB: number;
  layout: LayoutVariant;
  columnsPerRow: number;
  cardGap: number;
  showDelta: boolean;
  showPercentage: boolean;
  showBars: boolean;
  showSubLabels: boolean;
  cardBorderRadius: number;
  numberFormat: NumberFormat;
}

const DEFAULT_STATE: ComparisonState = {
  rawInput: SAMPLE_COMPARISON,
  inputFormat: "auto",
  tableData: detectAndParse(SAMPLE_COMPARISON),
  themeId: "vercel",
  background: { type: "none" },
  windowStyle: "mac",
  fontSize: 14,
  borderRadius: 32,
  padding: 64,
  fontFamily: "'Noto Sans Mono', monospace",
  title: "",
  labelColumn: 0,
  columnA: 1,
  columnB: 2,
  layout: "side-by-side",
  columnsPerRow: 2,
  cardGap: 16,
  showDelta: true,
  showPercentage: true,
  showBars: false,
  showSubLabels: true,
  cardBorderRadius: 12,
  numberFormat: "auto",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseNumericValue(val: string): number | null {
  if (!val || val.trim() === "") return null;
  const cleaned = val.replace(/[$,\s]/g, "").replace(/%$/, "");
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}

function isPercentValue(val: string): boolean {
  return /\d\s*%/.test(val.trim());
}

function isCurrencyValue(val: string): boolean {
  return /^\s*\$/.test(val.trim());
}

function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (abs >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n % 1 !== 0 ? n.toFixed(1) : String(n);
}

function formatNumber(n: number, fmt: NumberFormat, originalVal: string): string {
  if (fmt === "currency" || (fmt === "auto" && isCurrencyValue(originalVal))) {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return (n < 0 ? "-" : "") + "$" + formatCompact(abs);
    return (n < 0 ? "-" : "") + "$" + abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  if (fmt === "percent" || (fmt === "auto" && isPercentValue(originalVal))) {
    return n.toFixed(1) + "%";
  }
  if (fmt === "compact") return formatCompact(n);
  if (fmt === "plain") return n.toLocaleString("en-US");
  // auto: use compact for large numbers
  if (Math.abs(n) >= 10_000) return formatCompact(n);
  if (n % 1 !== 0) return n.toFixed(1);
  return n.toLocaleString("en-US");
}

function formatDelta(delta: number, fmt: NumberFormat, originalA: string): string {
  const sign = delta > 0 ? "+" : "";
  if (fmt === "currency" || (fmt === "auto" && isCurrencyValue(originalA))) {
    const abs = Math.abs(delta);
    const val = abs >= 1_000_000 ? formatCompact(abs) : "$" + abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return (delta >= 0 ? "+" : "-") + (abs >= 1_000_000 ? "$" : "") + (abs >= 1_000_000 ? formatCompact(abs) : abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }));
  }
  if (fmt === "percent" || (fmt === "auto" && isPercentValue(originalA))) {
    return sign + delta.toFixed(1) + "pp";
  }
  if (Math.abs(delta) >= 10_000) return sign + formatCompact(delta);
  if (delta % 1 !== 0) return sign + delta.toFixed(1);
  return sign + delta.toLocaleString("en-US");
}

function formatPercentChange(pctChange: number): string {
  const sign = pctChange > 0 ? "+" : "";
  return sign + pctChange.toFixed(1) + "%";
}

function loadState(): ComparisonState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      parsed.tableData = detectAndParse(parsed.rawInput, parsed.inputFormat === "auto" ? undefined : parsed.inputFormat);
      return { ...DEFAULT_STATE, ...parsed };
    }
  } catch { /* ignore */ }
  return DEFAULT_STATE;
}

// ─── Inline UI Components ───────────────────────────────────────────────────

function ControlLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-medium mb-1.5 select-none" style={{ color: "var(--text-faint)" }}>
      {children}
    </div>
  );
}

function ControlGroup({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col">
      <ControlLabel>{label}</ControlLabel>
      <div className="flex items-center" style={{ height: "28px" }}>{children}</div>
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="relative rounded-full transition-colors"
      style={{ width: "36px", height: "20px", background: on ? "var(--accent)" : "var(--border)" }}
    >
      <div
        className="absolute top-[2px] w-4 h-4 rounded-full bg-white transition-all"
        style={{ left: on ? "18px" : "2px" }}
      />
    </button>
  );
}

function Dropdown({
  value, options, onChange,
}: {
  value: string;
  options: { id: string; label: string; group?: string; extra?: React.ReactNode }[];
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((o) => o.id === value);

  const groups: { name: string; items: typeof options }[] = [];
  let currentGroup: string | null = null;
  for (const opt of options) {
    const g = opt.group ?? "";
    if (g !== currentGroup || groups.length === 0) {
      groups.push({ name: g, items: [] });
      currentGroup = g;
    }
    groups[groups.length - 1].items.push(opt);
  }

  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuMaxH = 340;
    if (spaceAbove > spaceBelow) {
      setMenuStyle({
        position: "fixed", bottom: window.innerHeight - rect.top + 6,
        left: rect.left, maxHeight: Math.min(menuMaxH, spaceAbove - 16),
        zIndex: 9999,
      });
    } else {
      setMenuStyle({
        position: "fixed", top: rect.bottom + 6,
        left: rect.left, maxHeight: Math.min(menuMaxH, spaceBelow - 16),
        zIndex: 9999,
      });
    }
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap"
        style={{
          height: "28px", background: "var(--surface)",
          color: "var(--text-primary)", border: "1px solid var(--border-subtle)",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
      >
        {selected?.extra}
        <span style={{ maxWidth: "110px", overflow: "hidden", textOverflow: "ellipsis" }}>
          {selected?.label ?? value}
        </span>
        <ChevronDown size={10} style={{ opacity: 0.5, marginLeft: "auto" }} />
      </button>
      {open && createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setOpen(false)} />
          <div
            className="rounded-xl overflow-auto"
            style={{
              ...menuStyle,
              background: "var(--elevated-bg)", border: "1px solid var(--border)",
              minWidth: "160px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
            }}
          >
            {groups.map((group, gi) => (
              <div key={gi}>
                {group.name && (
                  <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text-faint)" }}>{group.name}</div>
                )}
                {group.items.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => { onChange(opt.id); setOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors text-left"
                    style={{
                      color: opt.id === value ? "var(--accent)" : "var(--text-primary)",
                      background: opt.id === value ? "var(--surface)" : "transparent",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = opt.id === value ? "var(--surface)" : "transparent")}
                  >
                    {opt.extra}
                    {opt.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>, document.body
      )}
    </>
  );
}

function SliderControl({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <ControlGroup label={`${label}: ${value}`}>
      <input
        type="range" min={min} max={max} step={step ?? 1} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 h-1 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: "var(--accent)", background: "var(--border)" }}
      />
    </ControlGroup>
  );
}

// ─── Input Drawer ───────────────────────────────────────────────────────────

function ComparisonInputDrawer({
  open, onClose, rawInput, inputFormat, onChangeRaw, onChangeFormat,
}: {
  open: boolean; onClose: () => void;
  rawInput: string; inputFormat: ComparisonState["inputFormat"];
  onChangeRaw: (v: string) => void;
  onChangeFormat: (v: ComparisonState["inputFormat"]) => void;
}) {
  if (!open) return null;
  const FORMATS = [
    { id: "auto", label: "Auto" }, { id: "json", label: "JSON" },
    { id: "csv", label: "CSV" }, { id: "markdown", label: "Markdown" },
    { id: "postgresql", label: "PostgreSQL" },
  ] as const;

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "var(--overlay)" }} onClick={onClose} />
      <div
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
        style={{
          width: "min(420px, 100vw)", background: "var(--panel-bg)",
          borderLeft: "1px solid var(--panel-border)", boxShadow: "-8px 0 32px var(--shadow-color)",
        }}
      >
        <div className="flex items-center justify-between px-5 shrink-0"
          style={{ height: "50px", borderBottom: "1px solid var(--panel-border)" }}>
          <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Comparison Data</span>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
            style={{ color: "var(--text-muted)", background: "var(--surface)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}>
            <X size={14} />
          </button>
        </div>
        <div className="flex gap-1.5 px-5 pt-4 pb-2 flex-wrap">
          {FORMATS.map((fmt) => (
            <button key={fmt.id}
              onClick={() => onChangeFormat(fmt.id as ComparisonState["inputFormat"])}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: inputFormat === fmt.id ? "var(--accent)" : "var(--surface)",
                color: inputFormat === fmt.id ? "white" : "var(--text-muted)",
                border: `1px solid ${inputFormat === fmt.id ? "transparent" : "var(--border-subtle)"}`,
              }}>
              {fmt.label}
            </button>
          ))}
        </div>
        <div className="px-5 pb-2">
          <p style={{ fontSize: "11px", color: "var(--text-subtle)", lineHeight: "1.4" }}>
            Each row becomes a comparison card. Select a label column and two value columns to compare.
          </p>
        </div>
        <div className="flex-1 px-5 pb-5 pt-1">
          <textarea
            value={rawInput}
            onChange={(e) => onChangeRaw(e.target.value)}
            placeholder="Paste your comparison data here..."
            className="w-full h-full rounded-xl text-sm font-mono resize-none focus:outline-none focus:ring-1"
            style={{
              background: "var(--surface)", border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)", padding: "16px",
            }}
          />
        </div>
      </div>
    </>
  );
}

// ─── Comparison Card Renderer ───────────────────────────────────────────────

interface CardData {
  label: string;
  valueA: number | null;
  valueB: number | null;
  rawA: string;
  rawB: string;
  delta: number | null;
  pctChange: number | null;
  isPercent: boolean;
}

function ComparisonCards({
  data, labelCol, colA, colB, layout, columnsPerRow, cardGap, showDelta,
  showPercentage, showBars, showSubLabels, cardBorderRadius, numberFormat,
  fontSize, fontFamily, theme, title,
}: {
  data: TableData;
  labelCol: number;
  colA: number;
  colB: number;
  layout: LayoutVariant;
  columnsPerRow: number;
  cardGap: number;
  showDelta: boolean;
  showPercentage: boolean;
  showBars: boolean;
  showSubLabels: boolean;
  cardBorderRadius: number;
  numberFormat: NumberFormat;
  fontSize: number;
  fontFamily: string;
  theme: {
    headerBg: string; headerText: string; rowBg: string; altRowBg: string;
    rowText: string; borderColor: string; accentBg: string; accentText: string;
  };
  title?: string;
}) {
  const headerA = data.headers[colA] ?? "A";
  const headerB = data.headers[colB] ?? "B";

  const cards: CardData[] = data.rows.map((row) => {
    const label = row[labelCol] ?? "";
    const rawA = row[colA] ?? "";
    const rawB = row[colB] ?? "";
    const a = parseNumericValue(rawA);
    const b = parseNumericValue(rawB);
    const delta = a !== null && b !== null ? b - a : null;
    const pctChange = a !== null && b !== null && Math.abs(a) > 0 ? ((b - a) / Math.abs(a)) * 100 : null;
    const isPct = isPercentValue(rawA) || isPercentValue(rawB);
    return { label, valueA: a, valueB: b, rawA, rawB, delta, pctChange, isPercent: isPct };
  });

  // For bar widths, find max absolute value across all cards
  const allValues = cards.flatMap((c) => [c.valueA, c.valueB]).filter((v): v is number => v !== null);
  const maxVal = allValues.length > 0 ? Math.max(...allValues.map(Math.abs)) : 1;

  const valueFontSize = Math.max(20, fontSize * 1.8);
  const labelFontSize = fontSize;
  const smallFontSize = Math.max(10, fontSize - 2);

  const gridWidth = columnsPerRow === 1 ? 400 : columnsPerRow === 2 ? 640 : 900;

  // Determine if headerBg is a gradient or plain color for card accents
  const isGradientHeader = theme.headerBg.includes("gradient") || theme.headerBg.includes("linear");
  const cardAccentBg = isGradientHeader ? theme.accentBg : theme.headerBg;
  const cardAccentText = isGradientHeader ? theme.accentText : theme.headerText;

  return (
    <div style={{ fontFamily, minWidth: gridWidth }}>
      {/* Title */}
      {title && (
        <div style={{
          textAlign: "center", fontSize: fontSize + 4, fontWeight: 700,
          color: theme.headerText, marginBottom: cardGap + 8, fontFamily,
        }}>
          {title}
        </div>
      )}

      {/* Cards grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columnsPerRow}, 1fr)`,
        gap: `${cardGap}px`,
      }}>
        {cards.map((card, idx) => {
          const deltaPositive = card.delta !== null && card.delta > 0;
          const deltaNegative = card.delta !== null && card.delta < 0;
          const deltaZero = card.delta !== null && card.delta === 0;
          const deltaColor = deltaPositive ? "#22c55e" : deltaNegative ? "#ef4444" : theme.rowText;
          const arrowUp = "\u2191";
          const arrowDown = "\u2193";

          const barWidthA = card.valueA !== null && maxVal > 0 ? (Math.abs(card.valueA) / maxVal) * 100 : 0;
          const barWidthB = card.valueB !== null && maxVal > 0 ? (Math.abs(card.valueB) / maxVal) * 100 : 0;

          const formattedA = card.valueA !== null ? formatNumber(card.valueA, numberFormat, card.rawA) : card.rawA;
          const formattedB = card.valueB !== null ? formatNumber(card.valueB, numberFormat, card.rawB) : card.rawB;
          const formattedDelta = card.delta !== null ? formatDelta(card.delta, numberFormat, card.rawA) : "";
          const formattedPct = card.pctChange !== null
            ? (card.isPercent ? (card.delta !== null ? formatDelta(card.delta, "percent", card.rawA) : "") : formatPercentChange(card.pctChange))
            : "";

          return (
            <div key={idx} style={{
              background: theme.rowBg,
              border: `1px solid ${theme.borderColor}`,
              borderRadius: `${cardBorderRadius}px`,
              overflow: "hidden",
            }}>
              {/* Card header with metric label */}
              <div style={{
                padding: `${Math.max(10, fontSize - 2)}px ${Math.max(14, fontSize)}px`,
                borderBottom: `1px solid ${theme.borderColor}`,
                background: theme.altRowBg,
              }}>
                <div style={{
                  fontSize: labelFontSize, fontWeight: 600,
                  color: theme.rowText, fontFamily,
                }}>
                  {card.label}
                </div>
              </div>

              {/* Card body */}
              <div style={{ padding: `${Math.max(14, fontSize)}px ${Math.max(14, fontSize)}px` }}>
                {layout === "side-by-side" && (
                  <div>
                    {/* Two values side by side */}
                    <div style={{ display: "flex", gap: "16px" }}>
                      {/* Value A */}
                      <div style={{ flex: 1 }}>
                        {showSubLabels && (
                          <div style={{ fontSize: smallFontSize, color: theme.rowText, opacity: 0.6, marginBottom: 4, fontFamily }}>
                            {headerA}
                          </div>
                        )}
                        <div style={{
                          fontSize: valueFontSize, fontWeight: 700,
                          color: theme.rowText, fontFamily, lineHeight: 1.1,
                        }}>
                          {formattedA}
                        </div>
                      </div>

                      {/* Divider */}
                      <div style={{ width: 1, background: theme.borderColor, alignSelf: "stretch", margin: "4px 0" }} />

                      {/* Value B */}
                      <div style={{ flex: 1 }}>
                        {showSubLabels && (
                          <div style={{ fontSize: smallFontSize, color: theme.rowText, opacity: 0.6, marginBottom: 4, fontFamily }}>
                            {headerB}
                          </div>
                        )}
                        <div style={{
                          fontSize: valueFontSize, fontWeight: 700,
                          color: theme.rowText, fontFamily, lineHeight: 1.1,
                        }}>
                          {formattedB}
                        </div>
                      </div>
                    </div>

                    {/* Delta row */}
                    {(showDelta || showPercentage) && card.delta !== null && (
                      <div style={{
                        marginTop: 12, display: "flex", alignItems: "center", gap: 8,
                        flexWrap: "wrap",
                      }}>
                        {showDelta && (
                          <span style={{
                            fontSize: smallFontSize + 1, fontWeight: 600, color: deltaColor,
                            fontFamily, display: "inline-flex", alignItems: "center", gap: 2,
                          }}>
                            {deltaPositive ? arrowUp : deltaNegative ? arrowDown : ""}{formattedDelta}
                          </span>
                        )}
                        {showPercentage && formattedPct && (
                          <span style={{
                            fontSize: smallFontSize, fontWeight: 500,
                            color: deltaColor, opacity: 0.8, fontFamily,
                            padding: "2px 6px", borderRadius: 4,
                            background: deltaPositive ? "rgba(34,197,94,0.12)" : deltaNegative ? "rgba(239,68,68,0.12)" : "transparent",
                          }}>
                            {formattedPct}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Optional bars */}
                    {showBars && (
                      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {showSubLabels && (
                            <span style={{ fontSize: smallFontSize - 1, color: theme.rowText, opacity: 0.5, width: 44, fontFamily, textAlign: "right" }}>
                              {headerA}
                            </span>
                          )}
                          <div style={{ flex: 1, height: 8, background: theme.altRowBg, borderRadius: 4, overflow: "hidden" }}>
                            <div style={{
                              width: `${barWidthA}%`, height: "100%",
                              background: cardAccentBg, borderRadius: 4,
                              transition: "width 0.3s ease",
                            }} />
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {showSubLabels && (
                            <span style={{ fontSize: smallFontSize - 1, color: theme.rowText, opacity: 0.5, width: 44, fontFamily, textAlign: "right" }}>
                              {headerB}
                            </span>
                          )}
                          <div style={{ flex: 1, height: 8, background: theme.altRowBg, borderRadius: 4, overflow: "hidden" }}>
                            <div style={{
                              width: `${barWidthB}%`, height: "100%",
                              background: deltaPositive ? "#22c55e" : deltaNegative ? "#ef4444" : cardAccentBg,
                              borderRadius: 4,
                              transition: "width 0.3s ease",
                            }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {layout === "stacked" && (
                  <div>
                    {/* Value A */}
                    <div>
                      {showSubLabels && (
                        <div style={{ fontSize: smallFontSize, color: theme.rowText, opacity: 0.6, marginBottom: 4, fontFamily }}>
                          {headerA}
                        </div>
                      )}
                      <div style={{
                        fontSize: valueFontSize, fontWeight: 700,
                        color: theme.rowText, fontFamily, lineHeight: 1.1,
                      }}>
                        {formattedA}
                      </div>
                    </div>

                    {/* Delta in between */}
                    {(showDelta || showPercentage) && card.delta !== null && (
                      <div style={{
                        margin: "10px 0", display: "flex", alignItems: "center", gap: 8,
                        padding: "6px 0", borderTop: `1px dashed ${theme.borderColor}`,
                        borderBottom: `1px dashed ${theme.borderColor}`,
                      }}>
                        {showDelta && (
                          <span style={{
                            fontSize: smallFontSize + 1, fontWeight: 600, color: deltaColor,
                            fontFamily, display: "inline-flex", alignItems: "center", gap: 2,
                          }}>
                            {deltaPositive ? arrowUp : deltaNegative ? arrowDown : ""}{formattedDelta}
                          </span>
                        )}
                        {showPercentage && formattedPct && (
                          <span style={{
                            fontSize: smallFontSize, fontWeight: 500,
                            color: deltaColor, opacity: 0.8, fontFamily,
                            padding: "2px 6px", borderRadius: 4,
                            background: deltaPositive ? "rgba(34,197,94,0.12)" : deltaNegative ? "rgba(239,68,68,0.12)" : "transparent",
                          }}>
                            {formattedPct}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Value B */}
                    <div>
                      {showSubLabels && (
                        <div style={{ fontSize: smallFontSize, color: theme.rowText, opacity: 0.6, marginBottom: 4, fontFamily }}>
                          {headerB}
                        </div>
                      )}
                      <div style={{
                        fontSize: valueFontSize, fontWeight: 700,
                        color: theme.rowText, fontFamily, lineHeight: 1.1,
                      }}>
                        {formattedB}
                      </div>
                    </div>
                  </div>
                )}

                {layout === "with-bars" && (
                  <div>
                    {/* Value A with bar */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
                        {showSubLabels && (
                          <span style={{ fontSize: smallFontSize, color: theme.rowText, opacity: 0.6, fontFamily }}>
                            {headerA}
                          </span>
                        )}
                        <span style={{
                          fontSize: valueFontSize * 0.8, fontWeight: 700,
                          color: theme.rowText, fontFamily, lineHeight: 1.1,
                        }}>
                          {formattedA}
                        </span>
                      </div>
                      <div style={{ height: 10, background: theme.altRowBg, borderRadius: 5, overflow: "hidden" }}>
                        <div style={{
                          width: `${barWidthA}%`, height: "100%",
                          background: cardAccentBg, borderRadius: 5,
                          transition: "width 0.3s ease",
                        }} />
                      </div>
                    </div>

                    {/* Value B with bar */}
                    <div style={{ marginBottom: (showDelta || showPercentage) && card.delta !== null ? 14 : 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
                        {showSubLabels && (
                          <span style={{ fontSize: smallFontSize, color: theme.rowText, opacity: 0.6, fontFamily }}>
                            {headerB}
                          </span>
                        )}
                        <span style={{
                          fontSize: valueFontSize * 0.8, fontWeight: 700,
                          color: theme.rowText, fontFamily, lineHeight: 1.1,
                        }}>
                          {formattedB}
                        </span>
                      </div>
                      <div style={{ height: 10, background: theme.altRowBg, borderRadius: 5, overflow: "hidden" }}>
                        <div style={{
                          width: `${barWidthB}%`, height: "100%",
                          background: deltaPositive ? "#22c55e" : deltaNegative ? "#ef4444" : cardAccentBg,
                          borderRadius: 5,
                          transition: "width 0.3s ease",
                        }} />
                      </div>
                    </div>

                    {/* Delta footer */}
                    {(showDelta || showPercentage) && card.delta !== null && (
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        paddingTop: 10, borderTop: `1px solid ${theme.borderColor}`,
                      }}>
                        {showDelta && (
                          <span style={{
                            fontSize: smallFontSize + 1, fontWeight: 600, color: deltaColor,
                            fontFamily, display: "inline-flex", alignItems: "center", gap: 2,
                          }}>
                            {deltaPositive ? arrowUp : deltaNegative ? arrowDown : ""}{formattedDelta}
                          </span>
                        )}
                        {showPercentage && formattedPct && (
                          <span style={{
                            fontSize: smallFontSize, fontWeight: 500,
                            color: deltaColor, opacity: 0.8, fontFamily,
                            padding: "2px 6px", borderRadius: 4,
                            background: deltaPositive ? "rgba(34,197,94,0.12)" : deltaNegative ? "rgba(239,68,68,0.12)" : "transparent",
                          }}>
                            {formattedPct}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ComparisonPage() {
  const [state, setState] = useState<ComparisonState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [inputOpen, setInputOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [colorMode, setColorMode] = useState<"dark" | "light">("dark");
  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const exportBtnRef = useRef<HTMLButtonElement>(null);
  const [scale, setScale] = useState(1);

  // Hydrate from localStorage
  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  // Color mode preference
  useEffect(() => {
    const saved = localStorage.getItem("pastepretty-color-mode");
    if (saved === "light" || saved === "dark") {
      setColorMode(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  const toggleColorMode = useCallback(() => {
    setColorMode((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("pastepretty-color-mode", next);
      return next;
    });
  }, []);

  // Auto-save
  useEffect(() => {
    if (!hydrated) return;
    const timer = setInterval(() => {
      try {
        const toSave = { ...state };
        delete (toSave as Record<string, unknown>).tableData;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } catch { /* ignore */ }
    }, 1000);
    return () => clearInterval(timer);
  }, [state, hydrated]);

  // Scaling
  const updateScale = useCallback(() => {
    if (exporting || !containerRef.current || !contentRef.current) {
      setScale(1);
      return;
    }
    const container = containerRef.current;
    const content = contentRef.current;
    const padX = window.innerWidth < 640 ? 32 : 64;
    const padY = padX;
    const availW = container.clientWidth - padX;
    const availH = container.clientHeight - padY;
    content.style.transform = "scale(1)";
    content.style.transformOrigin = "top center";
    const contentW = content.scrollWidth;
    const contentH = content.scrollHeight;
    if (contentW <= 0 || contentH <= 0) { setScale(1); return; }
    const scaleX = availW / contentW;
    const scaleY = availH / contentH;
    setScale(Math.max(0.3, Math.min(1, scaleX, scaleY)));
  }, [exporting]);

  useEffect(() => { updateScale(); }, [
    state.tableData, state.padding, state.fontSize, state.windowStyle,
    state.borderRadius, state.fontFamily, state.title, state.layout,
    state.columnsPerRow, state.cardGap, state.showDelta, state.showPercentage,
    state.showBars, state.showSubLabels, state.cardBorderRadius,
    state.labelColumn, state.columnA, state.columnB, state.numberFormat,
    exporting, updateScale,
  ]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => updateScale());
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [updateScale]);

  // State updater
  const handleChange = useCallback((patch: Partial<ComparisonState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      if ("themeId" in patch && patch.themeId !== prev.themeId) {
        const newTheme = getTheme(patch.themeId!);
        next.background = { type: "gradient", gradient: newTheme.defaultBg };
      }
      if ("rawInput" in patch || "inputFormat" in patch) {
        next.tableData = detectAndParse(next.rawInput, next.inputFormat === "auto" ? undefined : next.inputFormat);
      }
      return next;
    });
  }, []);

  // Export handlers
  const handleExportImage = useCallback(async (imgFormat: "png" | "jpg" | "svg") => {
    if (!canvasRef.current) return;
    setExporting(true);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      const opts = { pixelRatio: 2, cacheBust: true };
      let dataUrl: string;
      if (imgFormat === "jpg") dataUrl = await toJpeg(canvasRef.current, { ...opts, quality: 0.95 });
      else if (imgFormat === "svg") dataUrl = await toSvg(canvasRef.current, opts);
      else dataUrl = await toPng(canvasRef.current, opts);
      const link = document.createElement("a");
      link.download = `${sanitizeFilename(state.title, "pastepretty-comparison")}.${imgFormat}`;
      link.href = dataUrl;
      link.click();
    } catch (err) { console.error("Export failed:", err); }
    finally { setExporting(false); }
  }, [state.title]);

  const handleExport = useCallback(async (format: ExportFormat) => {
    setExportOpen(false);
    if (format === "png" || format === "jpg" || format === "svg") {
      await handleExportImage(format);
      return;
    }
    if (!state.tableData) return;
    const content = exportData(state.tableData, format, state.title || "comparison");
    const ext = EXPORT_FORMATS.find((f) => f.id === format)?.ext ?? "txt";
    downloadText(content, `${sanitizeFilename(state.title, "pastepretty-comparison")}.${ext}`);
  }, [handleExportImage, state.tableData, state.title]);

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      handleChange({ rawInput: text, inputFormat: "auto" });
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [handleChange]);

  // Theme with light-mode transform
  const baseTheme = getTheme(state.themeId);
  let theme = { ...baseTheme };
  if (colorMode === "light") theme = transformThemeForLightMode(theme);
  let bgCss = backgroundToCss(state.background);
  if (colorMode === "light") bgCss = transformBackgroundForLightMode(bgCss);
  const isTransparent = state.background.type === "none";
  const fontFamily = state.fontFamily || theme.fontFamily;

  // Column options from table data
  const columnOptions = state.tableData
    ? state.tableData.headers.map((h, i) => ({ id: String(i), label: h }))
    : [];

  // Theme options for dropdown
  const themeOptions = themes.map((t) => ({
    id: t.id, label: t.name, group: t.group,
    extra: (
      <span className="w-3 h-3 rounded-sm shrink-0 inline-block"
        style={{ background: t.headerBg, border: "1px solid var(--swatch-border)" }} />
    ),
  }));

  const bgOptions = presetBackgrounds.map((p) => ({
    id: p.label, label: p.label,
    extra: (
      <span className="w-3 h-3 rounded-sm shrink-0 inline-block"
        style={{ background: backgroundToCss(p.bg), border: "1px solid var(--swatch-border)" }} />
    ),
  }));

  const fontOptions = FONT_OPTIONS.map((f) => ({ id: f.id, label: f.label }));

  const windowOptions = [
    { id: "mac", label: "macOS" },
    { id: "windows", label: "Windows" },
    { id: "none", label: "None" },
  ];

  const layoutOptions = [
    { id: "side-by-side", label: "Side by Side" },
    { id: "stacked", label: "Stacked" },
    { id: "with-bars", label: "With Bars" },
  ];

  const colsPerRowOptions = [
    { id: "1", label: "1" },
    { id: "2", label: "2" },
    { id: "3", label: "3" },
  ];

  const numberFormatOptions = [
    { id: "auto", label: "Auto" },
    { id: "currency", label: "Currency ($)" },
    { id: "percent", label: "Percent (%)" },
    { id: "compact", label: "Compact (1.2K)" },
    { id: "plain", label: "Plain" },
  ];

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden" style={{ background: "var(--background)" }}>
      {/* ── Header ── */}
      <header className="shrink-0" style={{ background: "var(--panel-bg)", borderBottom: "1px solid var(--panel-border)" }}>
        <div className="flex items-center justify-between px-3 sm:px-5" style={{ height: "52px" }}>
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3" style={{ textDecoration: "none" }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "var(--accent)", boxShadow: "0 2px 8px rgba(110,86,207,0.3)" }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="1" width="6" height="4" rx="1" fill="white" opacity="0.9" />
                  <rect x="9" y="1" width="6" height="4" rx="1" fill="white" opacity="0.6" />
                  <rect x="1" y="7" width="6" height="4" rx="1" fill="white" opacity="0.6" />
                  <rect x="9" y="7" width="6" height="4" rx="1" fill="white" opacity="0.4" />
                  <rect x="1" y="12" width="14" height="3" rx="1" fill="white" opacity="0.3" />
                </svg>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="nav-brand-text font-bold text-sm tracking-tight" style={{ color: "var(--foreground)" }}>
                  PastePretty
                </span>
                <span className="nav-brand-text text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                  style={{ color: "var(--text-muted)", background: "var(--surface)" }}>
                  comparison
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2 header-actions">
            <a
              href="https://github.com/goodylili/pastepretty"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
              style={{ background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
              title="Open source — star us on GitHub"
              aria-label="Star goodylili/pastepretty on GitHub"
            >
              <Github size={14} />
            </a>
            <button onClick={toggleColorMode}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
              style={{ background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
              title={colorMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
              {colorMode === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            <div className="w-px h-5 mx-1 header-separator" style={{ background: "var(--border-subtle)" }} />

            <input ref={fileRef} type="file" accept=".json,.csv,.md,.markdown,.sql,.txt"
              onChange={handleImportFile} className="sr-only" />
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}>
              <Upload size={13} />
              <span className="nav-btn-label">Import</span>
            </button>

            <button onClick={() => setInputOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}>
              <FileText size={13} />
              <span className="nav-btn-label">Edit Data</span>
            </button>

            <div className="flex items-center">
              <button onClick={() => handleExport("png")} disabled={exporting}
                className="flex items-center gap-2 px-4 py-1.5 rounded-l-lg text-xs font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: "var(--accent)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}>
                <Download size={14} />
                {exporting ? "Exporting..." : "Export"}
              </button>
              <button ref={exportBtnRef} onClick={() => setExportOpen(!exportOpen)} disabled={exporting}
                className="flex items-center py-1.5 px-2 rounded-r-lg text-white transition-all disabled:opacity-50"
                style={{ background: "var(--accent)", borderLeft: "1px solid rgba(255,255,255,0.2)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}>
                <ChevronDown size={12} style={{ opacity: 0.7 }} />
              </button>
              {exportOpen && createPortal(
                <>
                  <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setExportOpen(false)} />
                  <div className="rounded-xl overflow-hidden"
                    style={{
                      position: "fixed",
                      top: exportBtnRef.current ? exportBtnRef.current.getBoundingClientRect().bottom + 8 : 0,
                      right: exportBtnRef.current ? window.innerWidth - exportBtnRef.current.getBoundingClientRect().right : 0,
                      zIndex: 9999, background: "var(--elevated-bg)", border: "1px solid var(--border)",
                      minWidth: "180px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
                    }}>
                    {EXPORT_FORMATS.map((fmt) => (
                      <button key={fmt.id} onClick={() => handleExport(fmt.id)}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs transition-colors text-left"
                        style={{ color: "var(--text-primary)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                        <span style={{ opacity: 0.6 }}>{fmt.icon}</span>
                        {fmt.label}
                        <span className="ml-auto" style={{ color: "var(--text-subtle)", fontSize: "10px" }}>.{fmt.ext}</span>
                      </button>
                    ))}
                  </div>
                </>, document.body
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Preview Canvas ── */}
      <main className="flex-1 min-h-0 overflow-hidden flex relative">
        {!state.tableData ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl mb-4" style={{ opacity: 0.3 }}>&#x2194;</div>
              <p className="text-sm" style={{ color: "var(--text-subtle)" }}>
                Paste tabular data to preview as comparison cards
              </p>
            </div>
          </div>
        ) : (
          <div ref={containerRef} className="flex-1 flex items-center justify-center overflow-auto p-4 sm:p-8">
            <div style={{
              transform: exporting ? undefined : `scale(${scale})`,
              transformOrigin: "top center",
              ...(scale < 1 && !exporting && contentRef.current ? {
                marginBottom: `${-(contentRef.current.scrollHeight * (1 - scale))}px`,
              } : {}),
            }}>
              <div
                ref={(node) => {
                  (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
                  if (typeof canvasRef === "function") (canvasRef as (n: HTMLDivElement | null) => void)(node);
                  else if (canvasRef) (canvasRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
                }}
                style={{
                  background: bgCss, padding: `${state.padding}px`,
                  borderRadius: `${state.borderRadius}px`, display: "inline-block",
                  ...(isTransparent && { outline: "1px dashed var(--border)", outlineOffset: "-1px" }),
                }}
              >
                <WindowFrame style={state.windowStyle} title={state.title || undefined} borderRadius={state.borderRadius} theme={theme}>
                  <ComparisonCards
                    data={state.tableData}
                    labelCol={state.labelColumn}
                    colA={state.columnA}
                    colB={state.columnB}
                    layout={state.layout}
                    columnsPerRow={state.columnsPerRow}
                    cardGap={state.cardGap}
                    showDelta={state.showDelta}
                    showPercentage={state.showPercentage}
                    showBars={state.showBars}
                    showSubLabels={state.showSubLabels}
                    cardBorderRadius={state.cardBorderRadius}
                    numberFormat={state.numberFormat}
                    fontSize={state.fontSize}
                    fontFamily={fontFamily}
                    theme={theme}
                    title={state.windowStyle === "none" ? state.title : undefined}
                  />
                </WindowFrame>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Control Panel ── */}
      <footer className="shrink-0" style={{ background: "var(--panel-bg)", borderTop: "1px solid var(--panel-border)" }}>
        {/* Row 1: Theme, Background, Font, Size, Number Format, Title */}
        <div className="sub-control-row px-5 pt-3 pb-2"
          style={{ scrollbarWidth: "thin" }}>
          <ControlGroup label="Theme">
            <Dropdown value={state.themeId} options={themeOptions}
              onChange={(id) => handleChange({ themeId: id })} />
          </ControlGroup>

          <ControlGroup label="Background">
            <Dropdown
              value={presetBackgrounds.find((p) => {
                const css = backgroundToCss(p.bg);
                return css === backgroundToCss(state.background);
              })?.label ?? "Custom"}
              options={bgOptions}
              onChange={(label) => {
                const preset = presetBackgrounds.find((p) => p.label === label);
                if (preset) handleChange({ background: preset.bg });
              }}
            />
          </ControlGroup>

          <ControlGroup label="Font">
            <Dropdown value={state.fontFamily} options={fontOptions}
              onChange={(id) => handleChange({ fontFamily: id })} />
          </ControlGroup>

          <SliderControl label="Font Size" value={state.fontSize} min={10} max={20}
            onChange={(v) => handleChange({ fontSize: v })} />

          <ControlGroup label="Format">
            <Dropdown value={state.numberFormat} options={numberFormatOptions}
              onChange={(id) => handleChange({ numberFormat: id as NumberFormat })} />
          </ControlGroup>

          <ControlGroup label="Title">
            <input
              type="text" value={state.title} placeholder="Untitled"
              onChange={(e) => handleChange({ title: e.target.value })}
              className="px-2.5 rounded-lg text-xs font-medium focus:outline-none focus:ring-1"
              style={{
                height: "28px", width: "120px", background: "var(--surface)",
                color: "var(--text-primary)", border: "1px solid var(--border-subtle)",
              }}
            />
          </ControlGroup>
        </div>

        {/* Row 2: Label Column, Column A, Column B, Layout, Window, Padding */}
        <div className="sub-control-row px-5 pb-2"
          style={{ scrollbarWidth: "thin" }}>
          {columnOptions.length > 0 && (
            <>
              <ControlGroup label="Label Column">
                <Dropdown value={String(state.labelColumn)} options={columnOptions}
                  onChange={(id) => handleChange({ labelColumn: Number(id) })} />
              </ControlGroup>

              <ControlGroup label="Column A">
                <Dropdown value={String(state.columnA)} options={columnOptions}
                  onChange={(id) => handleChange({ columnA: Number(id) })} />
              </ControlGroup>

              <ControlGroup label="Column B">
                <Dropdown value={String(state.columnB)} options={columnOptions}
                  onChange={(id) => handleChange({ columnB: Number(id) })} />
              </ControlGroup>
            </>
          )}

          <ControlGroup label="Layout">
            <Dropdown value={state.layout} options={layoutOptions}
              onChange={(id) => handleChange({ layout: id as LayoutVariant })} />
          </ControlGroup>

          <ControlGroup label="Window">
            <Dropdown value={state.windowStyle} options={windowOptions}
              onChange={(id) => handleChange({ windowStyle: id as ComparisonState["windowStyle"] })} />
          </ControlGroup>

          <SliderControl label="Size" value={state.padding} min={0} max={128} step={8}
            onChange={(v) => handleChange({ padding: v })} />
        </div>

        {/* Row 3: Columns per row, Card Gap, Show Delta, Show Percentage, Show Bars, Sub-Labels, Card Radius, Border Radius */}
        <div className="sub-control-row px-5 pb-3"
          style={{ scrollbarWidth: "thin" }}>
          <ControlGroup label="Columns">
            <Dropdown value={String(state.columnsPerRow)} options={colsPerRowOptions}
              onChange={(id) => handleChange({ columnsPerRow: Number(id) })} />
          </ControlGroup>

          <SliderControl label="Card Gap" value={state.cardGap} min={4} max={32} step={2}
            onChange={(v) => handleChange({ cardGap: v })} />

          <ControlGroup label="Delta">
            <Toggle on={state.showDelta} onToggle={() => handleChange({ showDelta: !state.showDelta })} />
          </ControlGroup>

          <ControlGroup label="Percentage">
            <Toggle on={state.showPercentage} onToggle={() => handleChange({ showPercentage: !state.showPercentage })} />
          </ControlGroup>

          <ControlGroup label="Bars">
            <Toggle on={state.showBars} onToggle={() => handleChange({ showBars: !state.showBars })} />
          </ControlGroup>

          <ControlGroup label="Sub-Labels">
            <Toggle on={state.showSubLabels} onToggle={() => handleChange({ showSubLabels: !state.showSubLabels })} />
          </ControlGroup>

          <SliderControl label="Card Radius" value={state.cardBorderRadius} min={0} max={24}
            onChange={(v) => handleChange({ cardBorderRadius: v })} />

          <SliderControl label="Radius" value={state.borderRadius} min={0} max={48}
            onChange={(v) => handleChange({ borderRadius: v })} />
        </div>
      </footer>

      {/* ── Input Drawer ── */}
      <ComparisonInputDrawer
        open={inputOpen}
        onClose={() => setInputOpen(false)}
        rawInput={state.rawInput}
        inputFormat={state.inputFormat}
        onChangeRaw={(v) => handleChange({ rawInput: v })}
        onChangeFormat={(v) => handleChange({ inputFormat: v })}
      />
    </div>
  );
}
