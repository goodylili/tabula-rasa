"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toPng, toJpeg, toSvg } from "html-to-image";
import { TableData, TableTheme, Background } from "@/lib/types";
import { detectAndParse } from "@/lib/parser";
import { exportData, downloadText, ExportFormat } from "@/lib/exporters";
import { themes, getTheme } from "@/lib/themes";
import { presetBackgrounds, backgroundToCss } from "@/lib/backgrounds";
import { FONT_OPTIONS } from "@/lib/fonts";
import { transformThemeForLightMode, transformBackgroundForLightMode } from "@/lib/lightMode";
import WindowFrame from "@/components/WindowFrame";
import {
  Download, Upload, ChevronDown, Image, FileJson, FileSpreadsheet, FileText,
  Database, Sun, Moon, X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STORAGE_KEY = "pastepretty-stat-card";

const SAMPLE_STAT_MARKDOWN = `| Metric | Jan | Feb | Mar | Apr | May | Jun |
|--------|-----|-----|-----|-----|-----|-----|
| Revenue | $42K | $45K | $48K | $52K | $55K | $61K |
| Users | 12400 | 13100 | 14200 | 15800 | 16900 | 18200 |
| Conversion | 3.2% | 3.4% | 3.1% | 3.8% | 4.0% | 4.2% |
| Churn | 2.1% | 1.9% | 2.0% | 1.7% | 1.5% | 1.3% |`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type LayoutVariant = "compact" | "trend" | "sparkline" | "full";
type NumberSize = "lg" | "xl" | "2xl";
type LabelPosition = "above" | "below";

interface StatCardConfig {
  layout: LayoutVariant;
  numberSize: NumberSize;
  labelPosition: LabelPosition;
  columnsPerRow: number;
  cardGap: number;
  showTrend: boolean;
  showSparkline: boolean;
  cardBorderRadius: number;
}

interface StatCardState {
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
  customHeaderBg: string;
  customHeaderText: string;
  customRowBg: string;
  customAltRowBg: string;
  customRowText: string;
  customBorderColor: string;
  title: string;
  card: StatCardConfig;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a string value to a raw number, stripping $, K, M, B, %, commas */
function parseNumericValue(val: string): number {
  const s = val.trim();
  if (!s) return 0;

  // strip $ and commas
  let cleaned = s.replace(/[$,]/g, "");

  // handle percentage
  const isPercent = cleaned.endsWith("%");
  if (isPercent) cleaned = cleaned.replace(/%$/, "");

  // handle K/M/B suffixes (case insensitive)
  let multiplier = 1;
  const upper = cleaned.toUpperCase();
  if (upper.endsWith("K")) {
    multiplier = 1_000;
    cleaned = cleaned.slice(0, -1);
  } else if (upper.endsWith("M")) {
    multiplier = 1_000_000;
    cleaned = cleaned.slice(0, -1);
  } else if (upper.endsWith("B")) {
    multiplier = 1_000_000_000;
    cleaned = cleaned.slice(0, -1);
  }

  const num = Number(cleaned);
  if (isNaN(num)) return 0;
  return num * multiplier;
}

/** Detect format type from raw string value */
function detectFormat(val: string): "currency" | "percent" | "number" {
  const s = val.trim();
  if (s.startsWith("$")) return "currency";
  if (s.endsWith("%")) return "percent";
  return "number";
}

/** Format a number for display using compact notation */
function formatCompactNumber(rawValue: string): string {
  const s = rawValue.trim();
  // If already formatted (has K/M/B or $), keep as-is
  const upper = s.toUpperCase();
  if (
    upper.includes("K") ||
    upper.includes("M") ||
    upper.includes("B")
  ) {
    return s;
  }

  const fmt = detectFormat(s);
  const num = parseNumericValue(s);

  if (fmt === "percent") {
    return `${num}%`;
  }

  const prefix = fmt === "currency" ? "$" : "";

  const abs = Math.abs(num);
  if (abs >= 1_000_000_000) {
    return `${prefix}${(num / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  }
  if (abs >= 1_000_000) {
    return `${prefix}${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (abs >= 10_000) {
    return `${prefix}${(num / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  if (abs >= 1_000) {
    return `${prefix}${num.toLocaleString("en-US")}`;
  }
  if (Number.isInteger(num)) {
    return `${prefix}${num}`;
  }
  return `${prefix}${num.toFixed(1)}`;
}

/** Compute percentage change between two values */
function computeTrend(prevRaw: string, currRaw: string): number {
  const prev = parseNumericValue(prevRaw);
  const curr = parseNumericValue(currRaw);
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

/** Determine if a trend direction is "good" (up is good for most, down is good for churn-like) */
function isTrendPositive(trend: number, label: string): boolean {
  const lower = label.toLowerCase();
  // For "churn", "error", "bounce", "cost" — down is good
  const invertedMetrics = ["churn", "error", "bounce", "cost", "expense", "bug", "incident", "latency"];
  const isInverted = invertedMetrics.some((m) => lower.includes(m));
  return isInverted ? trend <= 0 : trend >= 0;
}

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------
function buildDefaultState(): StatCardState {
  const td = detectAndParse(SAMPLE_STAT_MARKDOWN);
  return {
    rawInput: SAMPLE_STAT_MARKDOWN,
    inputFormat: "auto",
    tableData: td,
    themeId: "vercel",
    background: { type: "none" },
    windowStyle: "mac",
    fontSize: 18,
    borderRadius: 32,
    padding: 64,
    fontFamily: "'Noto Sans Mono', monospace",
    customHeaderBg: "",
    customHeaderText: "",
    customRowBg: "",
    customAltRowBg: "",
    customRowText: "",
    customBorderColor: "",
    title: "",
    card: {
      layout: "full",
      numberSize: "xl",
      labelPosition: "above",
      columnsPerRow: 2,
      cardGap: 16,
      showTrend: true,
      showSparkline: true,
      cardBorderRadius: 12,
    },
  };
}

function loadState(): StatCardState {
  if (typeof window === "undefined") return buildDefaultState();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      parsed.tableData = detectAndParse(parsed.rawInput, parsed.inputFormat === "auto" ? undefined : parsed.inputFormat);
      if (parsed.card) {
        parsed.card = { ...buildDefaultState().card, ...parsed.card };
      }
      return { ...buildDefaultState(), ...parsed };
    }
  } catch { /* ignore */ }
  return buildDefaultState();
}

// ---------------------------------------------------------------------------
// Export formats
// ---------------------------------------------------------------------------
const EXPORT_FORMATS: { id: ExportFormat; label: string; ext: string; icon: React.ReactNode }[] = [
  { id: "png", label: "PNG Image", ext: "png", icon: <Image size={13} /> },
  { id: "jpg", label: "JPG Image", ext: "jpg", icon: <Image size={13} /> },
  { id: "svg", label: "SVG Image", ext: "svg", icon: <Image size={13} /> },
  { id: "json", label: "JSON", ext: "json", icon: <FileJson size={13} /> },
  { id: "csv", label: "CSV", ext: "csv", icon: <FileSpreadsheet size={13} /> },
  { id: "markdown", label: "Markdown", ext: "md", icon: <FileText size={13} /> },
  { id: "postgresql", label: "PostgreSQL", ext: "sql", icon: <Database size={13} /> },
];

// ---------------------------------------------------------------------------
// Sparkline SVG Component
// ---------------------------------------------------------------------------
function Sparkline({
  values,
  width = 120,
  height = 40,
  color,
  lineWidth = 2,
}: {
  values: number[];
  width?: number;
  height?: number;
  color: string;
  lineWidth?: number;
}) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const padY = 4;
  const plotH = height - padY * 2;
  const plotW = width;

  const points = values.map((v, i) => ({
    x: (i / (values.length - 1)) * plotW,
    y: padY + plotH - ((v - min) / range) * plotH,
  }));

  // Smooth catmull-rom path
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }

  // Gradient fill
  const gradId = `spark-grad-${Math.random().toString(36).slice(2, 8)}`;
  const areaD =
    d +
    ` L${points[points.length - 1].x},${height} L${points[0].x},${height} Z`;

  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradId})`} />
      <path d={d} fill="none" stroke={color} strokeWidth={lineWidth} strokeLinecap="round" strokeLinejoin="round" />
      {/* End dot */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r={lineWidth + 1}
        fill={color}
        stroke="none"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Trend Arrow Component
// ---------------------------------------------------------------------------
function TrendIndicator({
  trend,
  positive,
  fontSize,
}: {
  trend: number;
  positive: boolean;
  fontSize: number;
}) {
  const isUp = trend >= 0;
  const color = positive ? "#10B981" : "#EF4444";
  const arrowSize = Math.max(8, fontSize * 0.5);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      {/* Triangle arrow */}
      <svg width={arrowSize} height={arrowSize} viewBox="0 0 10 10" style={{ flexShrink: 0 }}>
        {isUp ? (
          <polygon points="5,1 9,8 1,8" fill={color} />
        ) : (
          <polygon points="5,9 9,2 1,2" fill={color} />
        )}
      </svg>
      <span
        style={{
          color,
          fontSize: `${Math.max(11, fontSize * 0.65)}px`,
          fontWeight: 600,
          lineHeight: 1,
        }}
      >
        {Math.abs(trend).toFixed(1)}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single Stat Card Component
// ---------------------------------------------------------------------------
function SingleStatCard({
  label,
  values,
  theme,
  config,
  fontSize,
  fontFamily,
  accentColor,
}: {
  label: string;
  values: string[];
  theme: TableTheme;
  config: StatCardConfig;
  fontSize: number;
  fontFamily: string;
  accentColor: string;
}) {
  const lastValue = values[values.length - 1] || "0";
  const prevValue = values.length >= 2 ? values[values.length - 2] : lastValue;
  const trend = computeTrend(prevValue, lastValue);
  const positive = isTrendPositive(trend, label);
  const displayValue = formatCompactNumber(lastValue);

  const numericValues = values.map(parseNumericValue);

  const showTrend =
    config.showTrend && (config.layout === "trend" || config.layout === "full");
  const showSparkline =
    config.showSparkline &&
    (config.layout === "sparkline" || config.layout === "full") &&
    numericValues.length >= 2;

  const numberSizeMap: Record<NumberSize, number> = {
    lg: fontSize * 2,
    xl: fontSize * 2.5,
    "2xl": fontSize * 3.2,
  };
  const numFontSize = numberSizeMap[config.numberSize];

  return (
    <div
      style={{
        background: theme.rowBg,
        border: `1px solid ${theme.borderColor}`,
        borderRadius: `${config.cardBorderRadius}px`,
        boxShadow: theme.shadow,
        padding: `${fontSize * 1.2}px ${fontSize * 1.4}px`,
        fontFamily,
        display: "flex",
        flexDirection: "column",
        gap: `${fontSize * 0.5}px`,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      {/* Label above */}
      {config.labelPosition === "above" && (
        <div
          style={{
            fontSize: `${fontSize * 0.75}px`,
            fontWeight: 500,
            color: theme.rowText,
            opacity: 0.7,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </div>
      )}

      {/* Big number row */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: `${fontSize * 0.6}px`,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: `${numFontSize}px`,
            fontWeight: 700,
            color: theme.rowText,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          {displayValue}
        </span>
        {showTrend && (
          <TrendIndicator trend={trend} positive={positive} fontSize={fontSize} />
        )}
      </div>

      {/* Label below */}
      {config.labelPosition === "below" && (
        <div
          style={{
            fontSize: `${fontSize * 0.75}px`,
            fontWeight: 500,
            color: theme.rowText,
            opacity: 0.7,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </div>
      )}

      {/* Sparkline */}
      {showSparkline && (
        <div style={{ marginTop: `${fontSize * 0.3}px` }}>
          <Sparkline
            values={numericValues}
            width={Math.max(100, 160)}
            height={36}
            color={accentColor}
            lineWidth={2}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Card Grid Renderer
// ---------------------------------------------------------------------------
function StatCardGrid({
  data,
  theme,
  config,
  fontSize,
  fontFamily,
  title,
}: {
  data: TableData;
  theme: TableTheme;
  config: StatCardConfig;
  fontSize: number;
  fontFamily: string;
  title?: string;
}) {
  // Each row is a metric. Column 0 = label, columns 1..n = values over time.
  const metrics = useMemo(() => {
    return data.rows.map((row) => ({
      label: row[0] || "",
      values: row.slice(1),
    }));
  }, [data.rows]);

  const accentColor = useMemo(() => {
    const hbg = theme.headerBg;
    return hbg.includes("gradient") ? "#6e56cf" : hbg;
  }, [theme.headerBg]);

  return (
    <div style={{ fontFamily, overflow: "hidden", width: "100%" }}>
      {title && (
        <div
          style={{
            background: theme.headerBg,
            color: theme.headerText,
            padding: "10px 20px",
            fontSize: `${fontSize + 2}px`,
            fontWeight: 700,
            letterSpacing: "0.01em",
            borderBottom: `1px solid ${theme.borderColor}`,
            display: "flex",
            alignItems: "center",
            minHeight: "42px",
          }}
        >
          <span>{title}</span>
        </div>
      )}

      <div
        style={{
          background: theme.altRowBg,
          padding: `${config.cardGap}px`,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${config.columnsPerRow}, 1fr)`,
            gap: `${config.cardGap}px`,
          }}
        >
          {metrics.map((metric, i) => (
            <SingleStatCard
              key={i}
              label={metric.label}
              values={metric.values}
              theme={theme}
              config={config}
              fontSize={fontSize}
              fontFamily={fontFamily}
              accentColor={accentColor}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Input Drawer
// ---------------------------------------------------------------------------
function StatCardInputDrawer({
  open,
  onClose,
  rawInput,
  inputFormat,
  tableData,
  title,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  rawInput: string;
  inputFormat: StatCardState["inputFormat"];
  tableData: TableData | null;
  title: string;
  onChange: (patch: Partial<StatCardState>) => void;
}) {
  if (!open) return null;

  const FORMATS = [
    { id: "auto", label: "Auto" },
    { id: "json", label: "JSON" },
    { id: "csv", label: "CSV" },
    { id: "markdown", label: "Markdown" },
    { id: "postgresql", label: "PostgreSQL" },
  ] as const;

  const handleFormatSwitch = (fmt: StatCardState["inputFormat"]) => {
    if (fmt !== "auto" && tableData) {
      const converted = exportData(tableData, fmt as ExportFormat, title || "my_table");
      onChange({ rawInput: converted, inputFormat: fmt });
    } else {
      onChange({ inputFormat: fmt });
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.5)" }}
        onClick={onClose}
      />
      <div
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
        style={{
          width: "min(420px, 100vw)",
          background: "var(--panel-bg)",
          borderLeft: "1px solid var(--panel-border)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.3)",
        }}
      >
        <div
          className="flex items-center justify-between px-5 shrink-0"
          style={{ height: "50px", borderBottom: "1px solid var(--panel-border)" }}
        >
          <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Stat Card Data
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
            style={{ color: "var(--text-muted)", background: "var(--surface)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex gap-1.5 px-5 pt-4 pb-2 flex-wrap">
          {FORMATS.map((fmt) => (
            <button
              key={fmt.id}
              onClick={() => handleFormatSwitch(fmt.id as StatCardState["inputFormat"])}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: inputFormat === fmt.id ? "var(--accent)" : "var(--surface)",
                color: inputFormat === fmt.id ? "white" : "var(--text-muted)",
                border: `1px solid ${inputFormat === fmt.id ? "transparent" : "var(--border-subtle)"}`,
              }}
            >
              {fmt.label}
            </button>
          ))}
        </div>

        <div className="px-5 pb-2">
          <p style={{ fontSize: "11px", color: "var(--text-subtle)", lineHeight: "1.4" }}>
            Each row = one stat card. First column = label, remaining columns = values over time. Last value = big number.
          </p>
        </div>

        <div className="flex-1 px-5 pb-5 pt-1">
          <textarea
            value={rawInput}
            onChange={(e) => onChange({ rawInput: e.target.value })}
            placeholder="Paste your table data here..."
            className="w-full h-full rounded-xl text-sm font-mono resize-none focus:outline-none focus:ring-1"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
              padding: "16px",
            }}
          />
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Color Customizer Popover
// ---------------------------------------------------------------------------
function ColorCustomizerPopover({
  open,
  onClose,
  theme,
  state,
  onChange,
  anchorRef,
}: {
  open: boolean;
  onClose: () => void;
  theme: TableTheme;
  state: StatCardState;
  onChange: (patch: Partial<StatCardState>) => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}) {
  if (!open) return null;

  const fields: { key: keyof StatCardState; label: string; themeDefault: string }[] = [
    { key: "customHeaderBg", label: "Header Bg", themeDefault: theme.headerBg },
    { key: "customHeaderText", label: "Header Text", themeDefault: theme.headerText },
    { key: "customRowBg", label: "Card Bg", themeDefault: theme.rowBg },
    { key: "customAltRowBg", label: "Grid Bg", themeDefault: theme.altRowBg },
    { key: "customRowText", label: "Text", themeDefault: theme.rowText },
    { key: "customBorderColor", label: "Border", themeDefault: theme.borderColor },
  ];

  const rect = anchorRef.current?.getBoundingClientRect();

  return createPortal(
    <>
      <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={onClose} />
      <div
        className="rounded-xl p-4"
        style={{
          position: "fixed",
          top: rect ? rect.top - 260 : 200,
          left: rect ? rect.left : 200,
          zIndex: 9999,
          background: "var(--elevated-bg)",
          border: "1px solid var(--border)",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
          minWidth: "220px",
        }}
      >
        <div className="text-xs font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
          Custom Colors
        </div>
        {fields.map((f) => {
          const val = state[f.key] as string;
          const effective = val || (f.themeDefault.includes("gradient") ? "#6e56cf" : f.themeDefault);
          return (
            <div key={f.key} className="flex items-center gap-2 mb-2">
              <label className="text-[11px] w-20 shrink-0" style={{ color: "var(--text-muted)" }}>
                {f.label}
              </label>
              <input
                type="color"
                value={effective}
                onChange={(e) => onChange({ [f.key]: e.target.value } as Partial<StatCardState>)}
                className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                style={{ background: "transparent" }}
              />
              {val && (
                <button
                  onClick={() => onChange({ [f.key]: "" } as Partial<StatCardState>)}
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ color: "var(--text-muted)", background: "var(--surface)" }}
                >
                  Reset
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------
export default function StatCardPage() {
  const [state, setState] = useState<StatCardState>(buildDefaultState);
  const [hydrated, setHydrated] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [inputOpen, setInputOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [colorPopoverOpen, setColorPopoverOpen] = useState(false);
  const [colorMode, setColorMode] = useState<"dark" | "light">("dark");
  const [canvasScale, setCanvasScale] = useState(1);

  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const exportBtnRef = useRef<HTMLButtonElement>(null);
  const colorBtnRef = useRef<HTMLButtonElement>(null);

  // --- Hydrate from localStorage ---
  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  // --- Color mode ---
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

  // --- Auto-save ---
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

  // --- ResizeObserver for scaling ---
  useEffect(() => {
    const wrapper = canvasWrapperRef.current;
    const inner = innerRef.current;
    if (!wrapper || !inner) return;

    const observer = new ResizeObserver(() => {
      const wrapW = wrapper.clientWidth;
      const wrapH = wrapper.clientHeight;
      const innerW = inner.scrollWidth;
      const innerH = inner.scrollHeight;
      if (innerW === 0 || innerH === 0) return;
      const scale = Math.min(wrapW / innerW, wrapH / innerH, 1);
      setCanvasScale(Math.max(0.1, scale * 0.92));
    });
    observer.observe(wrapper);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [state.padding, state.fontSize, state.card.columnsPerRow, state.card.cardGap]);

  // --- State change helper ---
  const handleChange = useCallback((patch: Partial<StatCardState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };

      // Theme change: reset background + custom colors
      if ("themeId" in patch && patch.themeId !== prev.themeId) {
        const newTheme = getTheme(patch.themeId!);
        next.background = { type: "gradient", gradient: newTheme.defaultBg };
        next.customHeaderBg = "";
        next.customHeaderText = "";
        next.customRowBg = "";
        next.customAltRowBg = "";
        next.customRowText = "";
        next.customBorderColor = "";
      }

      if ("rawInput" in patch || "inputFormat" in patch) {
        next.tableData = detectAndParse(next.rawInput, next.inputFormat === "auto" ? undefined : next.inputFormat);
      }

      return next;
    });
  }, []);

  const handleCardChange = useCallback((patch: Partial<StatCardConfig>) => {
    setState((prev) => ({
      ...prev,
      card: { ...prev.card, ...patch },
    }));
  }, []);

  // --- Export ---
  const handleExportImage = useCallback(async (imgFormat: "png" | "jpg" | "svg") => {
    if (!canvasRef.current) return;
    setExporting(true);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      const opts = { pixelRatio: 2, cacheBust: true };
      let dataUrl: string;
      if (imgFormat === "jpg") {
        dataUrl = await toJpeg(canvasRef.current, { ...opts, quality: 0.95 });
      } else if (imgFormat === "svg") {
        dataUrl = await toSvg(canvasRef.current, opts);
      } else {
        dataUrl = await toPng(canvasRef.current, opts);
      }
      const link = document.createElement("a");
      link.download = `pastepretty-stat-card-${state.themeId}.${imgFormat}`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [state.themeId]);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setExportOpen(false);
      if (format === "png" || format === "jpg" || format === "svg") {
        await handleExportImage(format);
        return;
      }
      if (!state.tableData) return;
      const content = exportData(state.tableData, format, state.title || "stat_cards");
      const ext = EXPORT_FORMATS.find((f) => f.id === format)?.ext ?? "txt";
      downloadText(content, `pastepretty-stat-card.${ext}`);
    },
    [handleExportImage, state.tableData, state.title]
  );

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      let format: string | undefined;
      const name = file.name.toLowerCase();
      if (name.endsWith(".json")) format = "json";
      else if (name.endsWith(".csv")) format = "csv";
      else if (name.endsWith(".md") || name.endsWith(".markdown")) format = "markdown";
      else if (name.endsWith(".sql")) format = "postgresql";

      const td = detectAndParse(text, format);
      setState((prev) => ({
        ...prev,
        rawInput: text,
        inputFormat: "auto",
        tableData: td,
      }));
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  // --- Computed theme ---
  const rawTheme = getTheme(state.themeId);
  const theme: TableTheme = useMemo(() => {
    let t = colorMode === "light" ? transformThemeForLightMode(rawTheme) : rawTheme;
    if (state.customHeaderBg) t = { ...t, headerBg: state.customHeaderBg };
    if (state.customHeaderText) t = { ...t, headerText: state.customHeaderText };
    if (state.customRowBg) t = { ...t, rowBg: state.customRowBg };
    if (state.customAltRowBg) t = { ...t, altRowBg: state.customAltRowBg };
    if (state.customRowText) t = { ...t, rowText: state.customRowText };
    if (state.customBorderColor) t = { ...t, borderColor: state.customBorderColor };
    return t;
  }, [rawTheme, colorMode, state.customHeaderBg, state.customHeaderText, state.customRowBg, state.customAltRowBg, state.customRowText, state.customBorderColor]);

  const bgCss = useMemo(() => {
    const raw = backgroundToCss(state.background);
    return colorMode === "light" ? transformBackgroundForLightMode(raw) : raw;
  }, [state.background, colorMode]);

  const fontFamily = state.fontFamily || theme.fontFamily;

  // --- Grouped themes ---
  const themeGroups = useMemo(() => {
    const groups: Record<string, typeof themes> = {};
    for (const t of themes) {
      const g = t.group || "Other";
      if (!groups[g]) groups[g] = [];
      groups[g].push(t);
    }
    return groups;
  }, []);

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--background)" }}>
      {/* -- Header -------------------------------------------------------- */}
      <header
        className="shrink-0"
        style={{ background: "var(--panel-bg)", borderBottom: "1px solid var(--panel-border)" }}
      >
        <div className="flex items-center justify-between px-3 sm:px-5" style={{ height: "52px" }}>
          {/* Brand */}
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "var(--accent)", boxShadow: "0 2px 8px rgba(110,86,207,0.3)" }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="6" height="4" rx="1" fill="white" opacity="0.9" />
                <rect x="9" y="1" width="6" height="4" rx="1" fill="white" opacity="0.6" />
                <rect x="1" y="7" width="6" height="4" rx="1" fill="white" opacity="0.6" />
                <rect x="9" y="7" width="6" height="4" rx="1" fill="white" opacity="0.4" />
                <rect x="1" y="12" width="14" height="3" rx="1" fill="white" opacity="0.3" />
              </svg>
            </a>
            <div className="flex items-baseline gap-2">
              <span className="nav-brand-text font-bold text-sm tracking-tight" style={{ color: "var(--foreground)" }}>
                PastePretty
              </span>
              <span
                className="nav-brand-text text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                style={{ color: "var(--text-muted)", background: "var(--surface)" }}
              >
                Stat Card
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="header-actions flex items-center gap-2">
            <button
              onClick={toggleColorMode}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
              style={{ background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
              title={colorMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {colorMode === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            <div className="header-separator w-px h-5 mx-1" style={{ background: "var(--border-subtle)" }} />

            <input
              ref={fileRef}
              type="file"
              accept=".json,.csv,.md,.markdown,.sql,.txt"
              onChange={handleImportFile}
              className="sr-only"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
              title="Import file"
            >
              <Upload size={13} />
              <span className="nav-btn-label">Import</span>
            </button>

            <button
              onClick={() => setInputOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
              title="Edit card data"
            >
              <FileText size={13} />
              <span className="nav-btn-label">Edit Data</span>
            </button>

            {/* Export split button */}
            <div className="flex items-center">
              <button
                onClick={() => handleExport("png")}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-1.5 rounded-l-lg text-xs font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: "var(--accent)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
              >
                <Download size={14} />
                {exporting ? "Exporting..." : "Export"}
              </button>
              <button
                ref={exportBtnRef}
                onClick={() => setExportOpen(!exportOpen)}
                disabled={exporting}
                className="flex items-center py-1.5 px-2 rounded-r-lg text-white transition-all disabled:opacity-50"
                style={{ background: "var(--accent)", borderLeft: "1px solid rgba(255,255,255,0.2)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
              >
                <ChevronDown size={12} style={{ opacity: 0.7 }} />
              </button>

              {exportOpen &&
                createPortal(
                  <>
                    <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setExportOpen(false)} />
                    <div
                      className="rounded-xl overflow-hidden"
                      style={{
                        position: "fixed",
                        top: exportBtnRef.current ? exportBtnRef.current.getBoundingClientRect().bottom + 8 : 0,
                        right: exportBtnRef.current ? window.innerWidth - exportBtnRef.current.getBoundingClientRect().right : 0,
                        zIndex: 9999,
                        background: "var(--elevated-bg)",
                        border: "1px solid var(--border)",
                        minWidth: "180px",
                        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
                      }}
                    >
                      {EXPORT_FORMATS.map((fmt) => (
                        <button
                          key={fmt.id}
                          onClick={() => handleExport(fmt.id)}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs transition-colors text-left"
                          style={{ color: "var(--text-primary)" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <span style={{ opacity: 0.6 }}>{fmt.icon}</span>
                          {fmt.label}
                          <span className="ml-auto" style={{ color: "var(--text-subtle)", fontSize: "10px" }}>
                            .{fmt.ext}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>,
                  document.body
                )}
            </div>
          </div>
        </div>
      </header>

      {/* -- Preview Canvas ------------------------------------------------ */}
      <main ref={canvasWrapperRef} className="flex-1 min-h-0 overflow-hidden flex items-center justify-center relative">
        <div
          style={{
            transform: `scale(${canvasScale})`,
            transformOrigin: "center center",
            transition: "transform 0.2s ease",
          }}
        >
          <div
            ref={canvasRef}
            style={{
              background: bgCss,
              padding: `${state.padding}px`,
              borderRadius: exporting ? 0 : undefined,
            }}
          >
            <div ref={innerRef}>
              <WindowFrame style={state.windowStyle} title={state.title || undefined} borderRadius={state.borderRadius} theme={theme}>
                {state.tableData ? (
                  <StatCardGrid
                    data={state.tableData}
                    theme={theme}
                    config={state.card}
                    fontSize={state.fontSize}
                    fontFamily={fontFamily}
                    title={state.title || undefined}
                  />
                ) : (
                  <div
                    style={{
                      background: theme.rowBg,
                      color: theme.rowText,
                      padding: "60px 40px",
                      textAlign: "center",
                      fontFamily,
                      fontSize: `${state.fontSize}px`,
                      borderRadius: `${state.borderRadius}px`,
                    }}
                  >
                    Paste table data to generate stat cards
                  </div>
                )}
              </WindowFrame>
            </div>
          </div>
        </div>
      </main>

      {/* -- Control Panel ------------------------------------------------- */}
      <footer
        className="shrink-0"
        style={{
          background: "var(--panel-bg)",
          borderTop: "1px solid var(--panel-border)",
        }}
      >
        {/* Row 1: Theme, Background, Colors, Font, Size, Title */}
        <div className="sub-control-row px-5 py-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          {/* Theme */}
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
              Theme
            </span>
            <select
              value={state.themeId}
              onChange={(e) => handleChange({ themeId: e.target.value })}
              className="text-xs rounded-lg px-2 py-1.5 focus:outline-none"
              style={{
                background: "var(--surface)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              {Object.entries(themeGroups).map(([group, ts]) => (
                <optgroup key={group} label={group}>
                  {ts.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          {/* Background */}
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
              Background
            </span>
            <div className="flex items-center gap-1">
              {presetBackgrounds.slice(0, 8).map((preset) => {
                const css = backgroundToCss(preset.bg);
                const isActive =
                  state.background.type === preset.bg.type &&
                  ((preset.bg.type === "none") ||
                    (preset.bg.type === "solid" && state.background.color === preset.bg.color) ||
                    (preset.bg.type === "gradient" && state.background.gradient === preset.bg.gradient));
                return (
                  <button
                    key={preset.label}
                    onClick={() => handleChange({ background: preset.bg })}
                    title={preset.label}
                    className="w-5 h-5 rounded-md transition-all"
                    style={{
                      background: css === "transparent"
                        ? "repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 0 0 / 8px 8px"
                        : css,
                      border: isActive ? "2px solid var(--accent)" : "1px solid var(--swatch-border)",
                      transform: isActive ? "scale(1.15)" : "scale(1)",
                    }}
                  />
                );
              })}
              <input
                type="color"
                value={state.background.type === "solid" ? state.background.color || "#0d0d0d" : "#0d0d0d"}
                onChange={(e) => handleChange({ background: { type: "solid", color: e.target.value } })}
                className="w-5 h-5 rounded-md cursor-pointer border-0 p-0"
                title="Custom color"
                style={{ background: "transparent" }}
              />
            </div>
          </label>

          {/* Color customizer */}
          <button
            ref={colorBtnRef}
            onClick={() => setColorPopoverOpen(!colorPopoverOpen)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wider transition-all"
            style={{
              background: colorPopoverOpen ? "var(--accent)" : "var(--surface)",
              color: colorPopoverOpen ? "white" : "var(--text-muted)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div className="w-3 h-3 rounded-sm" style={{ background: theme.headerBg.includes("gradient") ? "#6e56cf" : theme.headerBg }} />
            Colors
          </button>
          <ColorCustomizerPopover
            open={colorPopoverOpen}
            onClose={() => setColorPopoverOpen(false)}
            theme={theme}
            state={state}
            onChange={handleChange}
            anchorRef={colorBtnRef}
          />

          {/* Font */}
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
              Font
            </span>
            <select
              value={state.fontFamily}
              onChange={(e) => handleChange({ fontFamily: e.target.value })}
              className="text-xs rounded-lg px-2 py-1.5 focus:outline-none"
              style={{
                background: "var(--surface)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
                maxWidth: "140px",
              }}
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          {/* Font size */}
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
              Size
            </span>
            <select
              value={state.fontSize}
              onChange={(e) => handleChange({ fontSize: Number(e.target.value) })}
              className="text-xs rounded-lg px-2 py-1.5 focus:outline-none"
              style={{
                background: "var(--surface)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
                width: "56px",
              }}
            >
              {[10, 12, 14, 16, 18, 20, 22, 24].map((s) => (
                <option key={s} value={s}>
                  {s}px
                </option>
              ))}
            </select>
          </label>

          {/* Title */}
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
              Title
            </span>
            <input
              type="text"
              value={state.title}
              onChange={(e) => handleChange({ title: e.target.value })}
              placeholder="Card title..."
              className="text-xs rounded-lg px-2 py-1.5 focus:outline-none"
              style={{
                background: "var(--surface)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
                width: "130px",
              }}
            />
          </label>
        </div>

        {/* Row 2: Layout, Number Size, Label Position, Window, Padding */}
        <div className="sub-control-row px-5 py-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          {/* Layout variant */}
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
              Layout
            </span>
            <div className="flex">
              {(["compact", "trend", "sparkline", "full"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => handleCardChange({ layout: v })}
                  className="px-2.5 py-1.5 text-[11px] font-medium transition-all first:rounded-l-lg last:rounded-r-lg capitalize"
                  style={{
                    background: state.card.layout === v ? "var(--accent)" : "var(--surface)",
                    color: state.card.layout === v ? "white" : "var(--text-muted)",
                    border: `1px solid ${state.card.layout === v ? "transparent" : "var(--border-subtle)"}`,
                  }}
                >
                  {v === "compact" ? "Compact" : v === "trend" ? "Trend" : v === "sparkline" ? "Spark" : "Full"}
                </button>
              ))}
            </div>
          </label>

          {/* Number size */}
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
              Number
            </span>
            <div className="flex">
              {(["lg", "xl", "2xl"] as const).map((sz) => (
                <button
                  key={sz}
                  onClick={() => handleCardChange({ numberSize: sz })}
                  className="px-2.5 py-1.5 text-[11px] font-medium transition-all first:rounded-l-lg last:rounded-r-lg uppercase"
                  style={{
                    background: state.card.numberSize === sz ? "var(--accent)" : "var(--surface)",
                    color: state.card.numberSize === sz ? "white" : "var(--text-muted)",
                    border: `1px solid ${state.card.numberSize === sz ? "transparent" : "var(--border-subtle)"}`,
                  }}
                >
                  {sz}
                </button>
              ))}
            </div>
          </label>

          {/* Label position */}
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
              Label
            </span>
            <div className="flex">
              {(["above", "below"] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() => handleCardChange({ labelPosition: pos })}
                  className="px-2.5 py-1.5 text-[11px] font-medium transition-all first:rounded-l-lg last:rounded-r-lg capitalize"
                  style={{
                    background: state.card.labelPosition === pos ? "var(--accent)" : "var(--surface)",
                    color: state.card.labelPosition === pos ? "white" : "var(--text-muted)",
                    border: `1px solid ${state.card.labelPosition === pos ? "transparent" : "var(--border-subtle)"}`,
                  }}
                >
                  {pos}
                </button>
              ))}
            </div>
          </label>

          {/* Window style */}
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
              Window
            </span>
            <select
              value={state.windowStyle}
              onChange={(e) => handleChange({ windowStyle: e.target.value as StatCardState["windowStyle"] })}
              className="text-xs rounded-lg px-2 py-1.5 focus:outline-none"
              style={{
                background: "var(--surface)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <option value="mac">macOS</option>
              <option value="windows">Windows</option>
              <option value="none">None</option>
            </select>
          </label>

          {/* Padding */}
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
              Padding
            </span>
            <select
              value={state.padding}
              onChange={(e) => handleChange({ padding: Number(e.target.value) })}
              className="text-xs rounded-lg px-2 py-1.5 focus:outline-none"
              style={{
                background: "var(--surface)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
                width: "56px",
              }}
            >
              {[0, 16, 32, 48, 64, 80, 96, 128].map((p) => (
                <option key={p} value={p}>
                  {p}px
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Row 3: Columns, Gap, Show Trend, Show Sparkline, Border Radius */}
        <div className="sub-control-row px-5 py-2">
          {/* Columns per row */}
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
              Columns
            </span>
            <div className="flex">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => handleCardChange({ columnsPerRow: n })}
                  className="px-2.5 py-1.5 text-[11px] font-medium transition-all first:rounded-l-lg last:rounded-r-lg"
                  style={{
                    background: state.card.columnsPerRow === n ? "var(--accent)" : "var(--surface)",
                    color: state.card.columnsPerRow === n ? "white" : "var(--text-muted)",
                    border: `1px solid ${state.card.columnsPerRow === n ? "transparent" : "var(--border-subtle)"}`,
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </label>

          {/* Card gap slider */}
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
              Gap
            </span>
            <input
              type="range"
              min={4}
              max={32}
              step={2}
              value={state.card.cardGap}
              onChange={(e) => handleCardChange({ cardGap: Number(e.target.value) })}
              className="w-20 h-1 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: "var(--accent)" }}
            />
            <span className="text-[10px] tabular-nums w-6" style={{ color: "var(--text-muted)" }}>
              {state.card.cardGap}px
            </span>
          </label>

          {/* Show Trend toggle */}
          <button
            onClick={() => handleCardChange({ showTrend: !state.card.showTrend })}
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wider transition-all"
            style={{
              background: state.card.showTrend ? "var(--accent)" : "var(--surface)",
              color: state.card.showTrend ? "white" : "var(--text-muted)",
              border: `1px solid ${state.card.showTrend ? "transparent" : "var(--border-subtle)"}`,
            }}
          >
            Trend
          </button>

          {/* Show Sparkline toggle */}
          <button
            onClick={() => handleCardChange({ showSparkline: !state.card.showSparkline })}
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wider transition-all"
            style={{
              background: state.card.showSparkline ? "var(--accent)" : "var(--surface)",
              color: state.card.showSparkline ? "white" : "var(--text-muted)",
              border: `1px solid ${state.card.showSparkline ? "transparent" : "var(--border-subtle)"}`,
            }}
          >
            Sparkline
          </button>

          {/* Card border radius */}
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
              Radius
            </span>
            <input
              type="range"
              min={0}
              max={24}
              step={2}
              value={state.card.cardBorderRadius}
              onChange={(e) => handleCardChange({ cardBorderRadius: Number(e.target.value) })}
              className="w-16 h-1 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: "var(--accent)" }}
            />
            <span className="text-[10px] tabular-nums w-6" style={{ color: "var(--text-muted)" }}>
              {state.card.cardBorderRadius}px
            </span>
          </label>
        </div>
      </footer>

      {/* -- Input Drawer -------------------------------------------------- */}
      <StatCardInputDrawer
        open={inputOpen}
        onClose={() => setInputOpen(false)}
        rawInput={state.rawInput}
        inputFormat={state.inputFormat}
        tableData={state.tableData}
        title={state.title}
        onChange={handleChange}
      />
    </div>
  );
}
