"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { toPng, toJpeg, toSvg } from "html-to-image";
import { TableData, Background } from "@/lib/types";
import { detectAndParse } from "@/lib/parser";
import { exportData, downloadText, ExportFormat } from "@/lib/exporters";
import { themes, getTheme } from "@/lib/themes";
import { presetBackgrounds, backgroundToCss } from "@/lib/backgrounds";
import { FONT_OPTIONS } from "@/lib/fonts";
import { transformThemeForLightMode, transformBackgroundForLightMode } from "@/lib/lightMode";
import WindowFrame from "@/components/WindowFrame";
import {
  Download, Upload, ChevronDown, Image, FileJson, FileSpreadsheet,
  FileText, Database, Sun, Moon, X,
} from "lucide-react";

// ─── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "pastepretty-heatmap";

const SAMPLE_HEATMAP = `| Hour | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|------|-----|-----|-----|-----|-----|-----|-----|
| 6AM | 12 | 15 | 14 | 11 | 13 | 8 | 5 |
| 9AM | 45 | 52 | 48 | 55 | 50 | 22 | 15 |
| 12PM | 62 | 58 | 65 | 60 | 63 | 35 | 28 |
| 3PM | 55 | 60 | 58 | 62 | 57 | 40 | 32 |
| 6PM | 38 | 42 | 40 | 45 | 35 | 48 | 42 |
| 9PM | 25 | 28 | 22 | 30 | 45 | 52 | 48 |`;

const EXPORT_FORMATS: { id: ExportFormat; label: string; ext: string; icon: React.ReactNode }[] = [
  { id: "png", label: "PNG Image", ext: "png", icon: <Image size={13} /> },
  { id: "jpg", label: "JPG Image", ext: "jpg", icon: <Image size={13} /> },
  { id: "svg", label: "SVG Image", ext: "svg", icon: <Image size={13} /> },
  { id: "json", label: "JSON", ext: "json", icon: <FileJson size={13} /> },
  { id: "csv", label: "CSV", ext: "csv", icon: <FileSpreadsheet size={13} /> },
  { id: "markdown", label: "Markdown", ext: "md", icon: <FileText size={13} /> },
  { id: "postgresql", label: "PostgreSQL", ext: "sql", icon: <Database size={13} /> },
];

// ─── Color Scales ───────────────────────────────────────────────────────────

type ColorScaleType = "sequential" | "diverging";

interface ColorScale {
  id: string;
  label: string;
  type: ColorScaleType;
  colors: [string, string] | [string, string, string]; // [low, high] or [low, mid, high]
}

const COLOR_SCALES: ColorScale[] = [
  { id: "blue", label: "Blue", type: "sequential", colors: ["#e8f4fd", "#1565c0"] },
  { id: "green", label: "Green", type: "sequential", colors: ["#e8f5e9", "#2e7d32"] },
  { id: "red", label: "Red", type: "sequential", colors: ["#ffeaea", "#c62828"] },
  { id: "purple", label: "Purple", type: "sequential", colors: ["#f3e5f5", "#6a1b9a"] },
  { id: "orange", label: "Orange", type: "sequential", colors: ["#fff3e0", "#e65100"] },
  { id: "blue-red", label: "Blue-Red", type: "diverging", colors: ["#1565c0", "#f5f5f5", "#c62828"] },
  { id: "green-red", label: "Green-Red", type: "diverging", colors: ["#2e7d32", "#f5f5f5", "#c62828"] },
];

// ─── Heatmap State ──────────────────────────────────────────────────────────

interface HeatmapState {
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
  colorScaleId: string;
  cellGap: number;
  cellRadius: number;
  cellSize: number; // 0 = auto-fit
  showValues: boolean;
  showRowLabels: boolean;
  showColLabels: boolean;
  showLegend: boolean;
}

const DEFAULT_STATE: HeatmapState = {
  rawInput: SAMPLE_HEATMAP,
  inputFormat: "auto",
  tableData: detectAndParse(SAMPLE_HEATMAP),
  themeId: "vercel",
  background: { type: "none" },
  windowStyle: "mac",
  fontSize: 13,
  borderRadius: 32,
  padding: 64,
  fontFamily: "'Noto Sans Mono', monospace",
  title: "",
  colorScaleId: "blue",
  cellGap: 2,
  cellRadius: 4,
  cellSize: 0,
  showValues: true,
  showRowLabels: true,
  showColLabels: true,
  showLegend: true,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseNumericValue(val: string): number | null {
  if (!val || val.trim() === "") return null;
  const cleaned = val.replace(/[$,%]/g, "").trim();
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}

function hexToRgb(hex: string): [number, number, number] {
  hex = hex.replace("#", "");
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (v: number) => Math.round(Math.max(0, Math.min(255, v * 255))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function interpolateColor(colorA: string, colorB: string, t: number): string {
  const [h1, s1, l1] = rgbToHsl(...hexToRgb(colorA));
  const [h2, s2, l2] = rgbToHsl(...hexToRgb(colorB));
  // Handle hue interpolation (shortest path)
  let dh = h2 - h1;
  if (dh > 0.5) dh -= 1;
  if (dh < -0.5) dh += 1;
  const h = h1 + dh * t;
  const s = s1 + (s2 - s1) * t;
  const l = l1 + (l2 - l1) * t;
  return hslToHex(h < 0 ? h + 1 : h > 1 ? h - 1 : h, s, l);
}

function getHeatmapColor(value: number, min: number, max: number, scale: ColorScale): string {
  if (max === min) return scale.colors[scale.colors.length - 1];
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));

  if (scale.type === "sequential") {
    return interpolateColor(scale.colors[0], scale.colors[1], t);
  }
  // Diverging: 0 -> colorA, 0.5 -> mid, 1 -> colorB
  const colors = scale.colors as [string, string, string];
  if (t < 0.5) {
    return interpolateColor(colors[0], colors[1], t * 2);
  }
  return interpolateColor(colors[1], colors[2], (t - 0.5) * 2);
}

/** Determine readable text color (black or white) for a background hex */
function contrastText(bgHex: string): string {
  const [r, g, b] = hexToRgb(bgHex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#1a1a1a" : "#ffffff";
}

function loadState(): HeatmapState {
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

// ─── Input Drawer (inline) ──────────────────────────────────────────────────

function HeatmapInputDrawer({
  open, onClose, rawInput, inputFormat, onChangeRaw, onChangeFormat,
}: {
  open: boolean; onClose: () => void;
  rawInput: string; inputFormat: HeatmapState["inputFormat"];
  onChangeRaw: (v: string) => void;
  onChangeFormat: (v: HeatmapState["inputFormat"]) => void;
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
          <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Heatmap Data</span>
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
              onClick={() => onChangeFormat(fmt.id as HeatmapState["inputFormat"])}
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
            First column = row labels. Remaining columns = numeric data grid. Headers become column labels.
          </p>
        </div>
        <div className="flex-1 px-5 pb-5 pt-1">
          <textarea
            value={rawInput}
            onChange={(e) => onChangeRaw(e.target.value)}
            placeholder="Paste your matrix data here..."
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

// ─── Heatmap SVG Renderer ───────────────────────────────────────────────────

function HeatmapRenderer({
  data, colorScale, cellGap, cellRadius, cellSize, showValues, showRowLabels,
  showColLabels, showLegend, fontSize, fontFamily, theme, title,
}: {
  data: TableData;
  colorScale: ColorScale;
  cellGap: number;
  cellRadius: number;
  cellSize: number;
  showValues: boolean;
  showRowLabels: boolean;
  showColLabels: boolean;
  showLegend: boolean;
  fontSize: number;
  fontFamily: string;
  theme: { headerBg: string; headerText: string; rowBg: string; rowText: string; borderColor: string };
  title?: string;
}) {
  // Parse grid: first col = row labels, remaining cols = data
  const colHeaders = data.headers.slice(1);
  const rowLabels = data.rows.map((r) => r[0] ?? "");
  const numericGrid: (number | null)[][] = data.rows.map((row) =>
    row.slice(1).map((cell) => parseNumericValue(cell))
  );

  // Find min/max
  const allValues = numericGrid.flat().filter((v): v is number => v !== null);
  const minVal = allValues.length > 0 ? Math.min(...allValues) : 0;
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 1;

  const numRows = numericGrid.length;
  const numCols = colHeaders.length;
  const autoSize = cellSize === 0;
  const cSize = autoSize ? Math.max(36, Math.min(56, Math.floor(400 / Math.max(numCols, numRows, 1)))) : cellSize;

  const labelFontSize = Math.max(10, fontSize - 2);
  const valueFontSize = Math.max(9, fontSize - 3);
  const rowLabelWidth = showRowLabels ? Math.max(40, Math.max(...rowLabels.map((l) => l.length)) * labelFontSize * 0.6 + 12) : 0;
  const colLabelHeight = showColLabels ? labelFontSize + 20 : 0;
  const titleHeight = title ? fontSize + 16 : 0;
  const legendHeight = showLegend ? 40 : 0;

  const gridWidth = numCols * (cSize + cellGap) - cellGap;
  const gridHeight = numRows * (cSize + cellGap) - cellGap;

  const totalWidth = rowLabelWidth + gridWidth + 24;
  const totalHeight = titleHeight + colLabelHeight + gridHeight + legendHeight + (legendHeight ? 16 : 0) + 16;

  const gridX = rowLabelWidth + 12;
  const gridY = titleHeight + colLabelHeight;

  return (
    <svg
      width={totalWidth}
      height={totalHeight}
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ fontFamily, display: "block" }}
    >
      <rect width={totalWidth} height={totalHeight} fill={theme.rowBg} rx="0" />

      {/* Title */}
      {title && (
        <text
          x={totalWidth / 2} y={fontSize + 4}
          textAnchor="middle" fill={theme.headerText}
          fontSize={fontSize} fontWeight="600" fontFamily={fontFamily}
        >
          {title}
        </text>
      )}

      {/* Column labels */}
      {showColLabels && colHeaders.map((label, ci) => {
        const cx = gridX + ci * (cSize + cellGap) + cSize / 2;
        return (
          <text
            key={`col-${ci}`}
            x={cx} y={titleHeight + colLabelHeight - 6}
            textAnchor="middle" fill={theme.rowText}
            fontSize={labelFontSize} fontFamily={fontFamily}
          >
            {label}
          </text>
        );
      })}

      {/* Row labels */}
      {showRowLabels && rowLabels.map((label, ri) => {
        const cy = gridY + ri * (cSize + cellGap) + cSize / 2;
        return (
          <text
            key={`row-${ri}`}
            x={rowLabelWidth + 4} y={cy + labelFontSize / 3}
            textAnchor="end" fill={theme.rowText}
            fontSize={labelFontSize} fontFamily={fontFamily}
          >
            {label}
          </text>
        );
      })}

      {/* Cells */}
      {numericGrid.map((row, ri) =>
        row.map((val, ci) => {
          const x = gridX + ci * (cSize + cellGap);
          const y = gridY + ri * (cSize + cellGap);
          const fillColor = val !== null
            ? getHeatmapColor(val, minVal, maxVal, colorScale)
            : theme.rowBg;
          const textColor = val !== null ? contrastText(fillColor) : theme.rowText;
          return (
            <g key={`cell-${ri}-${ci}`}>
              <rect
                x={x} y={y} width={cSize} height={cSize}
                rx={cellRadius} ry={cellRadius}
                fill={fillColor}
                stroke={theme.borderColor} strokeWidth={0.5}
              />
              {showValues && val !== null && (
                <text
                  x={x + cSize / 2} y={y + cSize / 2 + valueFontSize / 3}
                  textAnchor="middle" fill={textColor}
                  fontSize={valueFontSize} fontWeight="500" fontFamily={fontFamily}
                >
                  {val}
                </text>
              )}
            </g>
          );
        })
      )}

      {/* Legend */}
      {showLegend && (() => {
        const legendY = gridY + gridHeight + 16;
        const legendW = Math.min(gridWidth, 240);
        const legendX = gridX + (gridWidth - legendW) / 2;
        const legendH = 12;
        const steps = 40;
        const stepW = legendW / steps;

        return (
          <g>
            {/* Gradient bar */}
            {Array.from({ length: steps }).map((_, i) => {
              const t = i / (steps - 1);
              const val = minVal + t * (maxVal - minVal);
              const color = getHeatmapColor(val, minVal, maxVal, colorScale);
              return (
                <rect
                  key={`legend-${i}`}
                  x={legendX + i * stepW} y={legendY}
                  width={stepW + 0.5} height={legendH}
                  rx={i === 0 ? 3 : i === steps - 1 ? 3 : 0}
                  ry={i === 0 ? 3 : i === steps - 1 ? 3 : 0}
                  fill={color}
                />
              );
            })}
            {/* Min label */}
            <text
              x={legendX} y={legendY + legendH + 14}
              textAnchor="start" fill={theme.rowText}
              fontSize={10} fontFamily={fontFamily}
            >
              {minVal}
            </text>
            {/* Max label */}
            <text
              x={legendX + legendW} y={legendY + legendH + 14}
              textAnchor="end" fill={theme.rowText}
              fontSize={10} fontFamily={fontFamily}
            >
              {maxVal}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function HeatmapPage() {
  const [state, setState] = useState<HeatmapState>(DEFAULT_STATE);
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
    state.borderRadius, state.fontFamily, state.title, state.colorScaleId,
    state.cellGap, state.cellRadius, state.cellSize, state.showValues,
    state.showRowLabels, state.showColLabels, state.showLegend,
    exporting, updateScale,
  ]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => updateScale());
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [updateScale]);

  // State updater
  const handleChange = useCallback((patch: Partial<HeatmapState>) => {
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
      link.download = `pastepretty-heatmap-${state.themeId}.${imgFormat}`;
      link.href = dataUrl;
      link.click();
    } catch (err) { console.error("Export failed:", err); }
    finally { setExporting(false); }
  }, [state.themeId]);

  const handleExport = useCallback(async (format: ExportFormat) => {
    setExportOpen(false);
    if (format === "png" || format === "jpg" || format === "svg") {
      await handleExportImage(format);
      return;
    }
    if (!state.tableData) return;
    const content = exportData(state.tableData, format, state.title || "heatmap");
    const ext = EXPORT_FORMATS.find((f) => f.id === format)?.ext ?? "txt";
    downloadText(content, `pastepretty-heatmap.${ext}`);
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
  const colorScale = COLOR_SCALES.find((s) => s.id === state.colorScaleId) ?? COLOR_SCALES[0];
  const fontFamily = state.fontFamily || theme.fontFamily;

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

  const colorScaleOptions = COLOR_SCALES.map((s) => ({
    id: s.id, label: s.label,
    extra: (
      <span className="w-4 h-3 rounded-sm shrink-0 inline-block"
        style={{
          background: s.type === "sequential"
            ? `linear-gradient(90deg, ${s.colors[0]}, ${s.colors[1]})`
            : `linear-gradient(90deg, ${s.colors[0]}, ${s.colors[1]}, ${s.colors[2]})`,
          border: "1px solid var(--swatch-border)",
        }} />
    ),
  }));

  const fontOptions = FONT_OPTIONS.map((f) => ({ id: f.id, label: f.label }));

  const windowOptions = [
    { id: "mac", label: "macOS" },
    { id: "windows", label: "Windows" },
    { id: "none", label: "None" },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--background)" }}>
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
                  heatmap
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2 header-actions">
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
              <span className="nav-btn-label hidden sm:inline">Import</span>
            </button>

            <button onClick={() => setInputOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}>
              <FileText size={13} />
              <span className="nav-btn-label hidden sm:inline">Edit Data</span>
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
              <div className="text-5xl mb-4" style={{ opacity: 0.3 }}>H</div>
              <p className="text-sm" style={{ color: "var(--text-subtle)" }}>
                Paste matrix data to preview as a heatmap
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
                  <HeatmapRenderer
                    data={state.tableData}
                    colorScale={colorScale}
                    cellGap={state.cellGap}
                    cellRadius={state.cellRadius}
                    cellSize={state.cellSize}
                    showValues={state.showValues}
                    showRowLabels={state.showRowLabels}
                    showColLabels={state.showColLabels}
                    showLegend={state.showLegend}
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
        {/* Row 1: Theme, Background, Colors, Font, Size, Title */}
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

          <ControlGroup label="Color Scale">
            <Dropdown value={state.colorScaleId} options={colorScaleOptions}
              onChange={(id) => handleChange({ colorScaleId: id })} />
          </ControlGroup>

          <ControlGroup label="Font">
            <Dropdown value={state.fontFamily} options={fontOptions}
              onChange={(id) => handleChange({ fontFamily: id })} />
          </ControlGroup>

          <SliderControl label="Font Size" value={state.fontSize} min={10} max={20}
            onChange={(v) => handleChange({ fontSize: v })} />

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

        {/* Row 2: Cell Gap, Cell Radius, Cell Size, Window, Padding */}
        <div className="sub-control-row px-5 pb-2"
          style={{ scrollbarWidth: "thin" }}>
          <SliderControl label="Cell Gap" value={state.cellGap} min={0} max={4}
            onChange={(v) => handleChange({ cellGap: v })} />

          <SliderControl label="Cell Radius" value={state.cellRadius} min={0} max={8}
            onChange={(v) => handleChange({ cellRadius: v })} />

          <SliderControl label="Cell Size" value={state.cellSize} min={0} max={60}
            onChange={(v) => handleChange({ cellSize: v })} />

          <ControlGroup label="Window">
            <Dropdown value={state.windowStyle} options={windowOptions}
              onChange={(id) => handleChange({ windowStyle: id as HeatmapState["windowStyle"] })} />
          </ControlGroup>

          <SliderControl label="Size" value={state.padding} min={0} max={128} step={8}
            onChange={(v) => handleChange({ padding: v })} />

          <SliderControl label="Radius" value={state.borderRadius} min={0} max={48}
            onChange={(v) => handleChange({ borderRadius: v })} />
        </div>

        {/* Row 3: Toggles */}
        <div className="sub-control-row px-5 pb-3"
          style={{ scrollbarWidth: "thin" }}>
          <ControlGroup label="Show Values">
            <Toggle on={state.showValues} onToggle={() => handleChange({ showValues: !state.showValues })} />
          </ControlGroup>
          <ControlGroup label="Row Labels">
            <Toggle on={state.showRowLabels} onToggle={() => handleChange({ showRowLabels: !state.showRowLabels })} />
          </ControlGroup>
          <ControlGroup label="Col Labels">
            <Toggle on={state.showColLabels} onToggle={() => handleChange({ showColLabels: !state.showColLabels })} />
          </ControlGroup>
          <ControlGroup label="Legend">
            <Toggle on={state.showLegend} onToggle={() => handleChange({ showLegend: !state.showLegend })} />
          </ControlGroup>
        </div>
      </footer>

      {/* ── Input Drawer ── */}
      <HeatmapInputDrawer
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
