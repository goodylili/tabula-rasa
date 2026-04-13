"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
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
  Download, Upload, ChevronDown, Image, FileJson, FileSpreadsheet,
  FileText, Database, Sun, Moon, X,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────

const STORAGE_KEY = "pastepretty-scatter";

const SAMPLE_SCATTER_MD = `| City | Population | GDP | Area | Region |
|------|-----------|-----|------|--------|
| Tokyo | 14000 | 1920 | 2194 | Asia |
| Delhi | 11300 | 293 | 1484 | Asia |
| Shanghai | 24900 | 688 | 6341 | Asia |
| London | 9000 | 731 | 1572 | Europe |
| Paris | 11000 | 764 | 2844 | Europe |
| NYC | 8300 | 1540 | 783 | Americas |
| São Paulo | 12300 | 699 | 1521 | Americas |
| Sydney | 5300 | 400 | 12368 | Oceania |`;

type PointShape = "circle" | "square" | "diamond";

interface ScatterState {
  rawInput: string;
  inputFormat: "json" | "markdown" | "csv" | "postgresql" | "auto";
  tableData: TableData | null;
  themeId: string;
  background: Background;
  windowStyle: "mac" | "windows" | "none";
  fontSize: number;
  padding: number;
  fontFamily: string;
  borderRadius: number;
  title: string;
  // Custom color overrides
  customHeaderBg: string;
  customHeaderText: string;
  customRowBg: string;
  customAltRowBg: string;
  customRowText: string;
  customBorderColor: string;
  // Scatter-specific
  xColumn: number;
  yColumn: number;
  sizeColumn: number; // -1 = none
  groupColumn: number; // -1 = none
  pointShape: PointShape;
  pointSize: number; // 4-20
  pointOpacity: number; // 0.3-1.0
  showGrid: boolean;
  showRegression: boolean;
  showLegend: boolean;
  showValues: boolean;
}

const EXPORT_FORMATS: { id: ExportFormat; label: string; ext: string; icon: React.ReactNode }[] = [
  { id: "png", label: "PNG Image", ext: "png", icon: <Image size={13} /> },
  { id: "jpg", label: "JPG Image", ext: "jpg", icon: <Image size={13} /> },
  { id: "svg", label: "SVG Image", ext: "svg", icon: <Image size={13} /> },
  { id: "json", label: "JSON", ext: "json", icon: <FileJson size={13} /> },
  { id: "csv", label: "CSV", ext: "csv", icon: <FileSpreadsheet size={13} /> },
  { id: "markdown", label: "Markdown", ext: "md", icon: <FileText size={13} /> },
  { id: "postgresql", label: "PostgreSQL", ext: "sql", icon: <Database size={13} /> },
];

// ─── Helpers ─────────────────────────────────────────────────────

function parseNumericValue(val: string): number | null {
  if (!val || val.trim() === "") return null;
  const cleaned = val.replace(/[,$%\s]/g, "").trim();
  if (cleaned === "" || isNaN(Number(cleaned))) return null;
  return Number(cleaned);
}

function isNumericColumn(data: TableData, colIndex: number): boolean {
  let numericCount = 0;
  for (const row of data.rows) {
    const v = parseNumericValue(row[colIndex] ?? "");
    if (v !== null) numericCount++;
  }
  return numericCount >= Math.max(1, data.rows.length * 0.5);
}

/** Produce "nice" axis scale: [niceMin, niceMax, step] */
function niceScale(dataMin: number, dataMax: number, maxTicks = 8): { min: number; max: number; step: number } {
  if (dataMin === dataMax) {
    const v = dataMin || 1;
    return { min: v - 1, max: v + 1, step: 1 };
  }
  const range = dataMax - dataMin;
  const roughStep = range / (maxTicks - 1);
  const pow = Math.pow(10, Math.floor(Math.log10(roughStep)));
  let niceFrac: number;
  const frac = roughStep / pow;
  if (frac <= 1) niceFrac = 1;
  else if (frac <= 2) niceFrac = 2;
  else if (frac <= 5) niceFrac = 5;
  else niceFrac = 10;
  const step = niceFrac * pow;
  const niceMin = Math.floor(dataMin / step) * step;
  const niceMax = Math.ceil(dataMax / step) * step;
  return { min: niceMin, max: niceMax, step };
}

function generateChartColors(theme: TableTheme, count: number): string[] {
  const palette = [
    theme.headerBg.includes("gradient") ? "#6e56cf" : theme.headerBg,
    "#3ECF8E", "#36B6F0", "#F97316", "#EF4444", "#A855F7",
    "#EC4899", "#14B8A6", "#EAB308", "#6366F1", "#8B5CF6", "#06B6D4",
  ];
  return Array.from({ length: count }, (_, i) => palette[i % palette.length]);
}

function linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number } | null {
  if (points.length < 2) return null;
  const n = points.length;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) * (p.x - meanX);
  }
  if (den === 0) return null;
  const slope = num / den;
  const intercept = meanY - slope * meanX;
  return { slope, intercept };
}

function formatTickValue(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (abs >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  if (Number.isInteger(v)) return v.toString();
  return v.toFixed(1);
}

// ─── Default state ───────────────────────────────────────────────

function makeDefaultState(): ScatterState {
  return {
    rawInput: SAMPLE_SCATTER_MD,
    inputFormat: "auto",
    tableData: detectAndParse(SAMPLE_SCATTER_MD),
    themeId: "vercel",
    background: { type: "none" },
    windowStyle: "mac",
    fontSize: 18,
    padding: 64,
    fontFamily: "'Noto Sans Mono', monospace",
    borderRadius: 32,
    title: "",
    customHeaderBg: "",
    customHeaderText: "",
    customRowBg: "",
    customAltRowBg: "",
    customRowText: "",
    customBorderColor: "",
    xColumn: 1,
    yColumn: 2,
    sizeColumn: -1,
    groupColumn: -1,
    pointShape: "circle",
    pointSize: 8,
    pointOpacity: 0.85,
    showGrid: true,
    showRegression: false,
    showLegend: true,
    showValues: false,
  };
}

function loadState(): ScatterState {
  if (typeof window === "undefined") return makeDefaultState();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      parsed.tableData = detectAndParse(
        parsed.rawInput,
        parsed.inputFormat === "auto" ? undefined : parsed.inputFormat,
      );
      return { ...makeDefaultState(), ...parsed };
    }
  } catch { /* ignore */ }
  return makeDefaultState();
}

// ─── Input Drawer (inline) ───────────────────────────────────────

const INPUT_FORMATS = [
  { id: "auto", label: "Auto" },
  { id: "json", label: "JSON" },
  { id: "csv", label: "CSV" },
  { id: "markdown", label: "Markdown" },
  { id: "postgresql", label: "PostgreSQL" },
] as const;

function ScatterInputDrawer({
  open,
  onClose,
  state,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  state: ScatterState;
  onChange: (patch: Partial<ScatterState>) => void;
}) {
  if (!open) return null;

  const handleFormatSwitch = (fmt: ScatterState["inputFormat"]) => {
    if (fmt !== "auto" && state.tableData) {
      const converted = exportData(state.tableData, fmt as ExportFormat, state.title || "my_table");
      onChange({ rawInput: converted, inputFormat: fmt });
    } else {
      onChange({ inputFormat: fmt });
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ background: "var(--overlay)" }}
        onClick={onClose}
      />
      <div
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
        style={{
          width: "min(420px, 100vw)",
          background: "var(--panel-bg)",
          borderLeft: "1px solid var(--panel-border)",
          boxShadow: "-8px 0 32px var(--shadow-color)",
        }}
      >
        <div
          className="flex items-center justify-between px-5 shrink-0"
          style={{ height: "50px", borderBottom: "1px solid var(--panel-border)" }}
        >
          <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Scatter Data
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
          {INPUT_FORMATS.map((fmt) => (
            <button
              key={fmt.id}
              onClick={() => handleFormatSwitch(fmt.id as ScatterState["inputFormat"])}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: state.inputFormat === fmt.id ? "var(--accent)" : "var(--surface)",
                color: state.inputFormat === fmt.id ? "white" : "var(--text-muted)",
                border: `1px solid ${state.inputFormat === fmt.id ? "transparent" : "var(--border-subtle)"}`,
              }}
            >
              {fmt.label}
            </button>
          ))}
        </div>

        <div className="px-5 pb-2">
          <p style={{ fontSize: "11px", color: "var(--text-subtle)", lineHeight: "1.4" }}>
            Paste tabular data with numeric columns for X and Y axes. Optionally include a categorical column for grouping.
          </p>
        </div>

        <div className="flex-1 px-5 pb-5 pt-1">
          <textarea
            value={state.rawInput}
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

// ─── SVG Scatter Plot Renderer ───────────────────────────────────

interface ScatterSVGProps {
  data: TableData;
  theme: TableTheme;
  config: ScatterState;
  width: number;
  height: number;
  colorMode: "dark" | "light";
}

function ScatterPlotSVG({ data, theme, config, width, height, colorMode }: ScatterSVGProps) {
  const t = colorMode === "light" ? transformThemeForLightMode(theme) : theme;
  const fontFamily = config.fontFamily || t.fontFamily;
  const textColor = t.rowText;
  const gridColor = t.borderColor;
  const headerColor = t.headerText;

  // Parse data
  const { xColumn, yColumn, sizeColumn, groupColumn } = config;
  const headers = data.headers;

  interface PointData {
    x: number;
    y: number;
    size: number | null;
    group: string;
    label: string;
    rowIdx: number;
  }

  const points: PointData[] = [];
  for (let ri = 0; ri < data.rows.length; ri++) {
    const row = data.rows[ri];
    const xVal = parseNumericValue(row[xColumn] ?? "");
    const yVal = parseNumericValue(row[yColumn] ?? "");
    if (xVal === null || yVal === null) continue;
    const sVal = sizeColumn >= 0 ? parseNumericValue(row[sizeColumn] ?? "") : null;
    const grp = groupColumn >= 0 ? (row[groupColumn] ?? "Other") : "All";
    const lbl = row[0] ?? `Row ${ri + 1}`;
    points.push({ x: xVal, y: yVal, size: sVal, group: grp, label: lbl, rowIdx: ri });
  }

  if (points.length === 0) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <text x={width / 2} y={height / 2} textAnchor="middle" fill={textColor} fontFamily={fontFamily} fontSize="14">
          No valid numeric data for the selected columns
        </text>
      </svg>
    );
  }

  // Margins
  const margin = { top: 50, right: 40, bottom: 60, left: 70 };
  if (config.showLegend && groupColumn >= 0) margin.right = 160;
  if (config.title) margin.top = 65;
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  // Scales
  const xVals = points.map((p) => p.x);
  const yVals = points.map((p) => p.y);
  const xScale = niceScale(Math.min(...xVals), Math.max(...xVals));
  const yScale = niceScale(Math.min(...yVals), Math.max(...yVals));

  const toSvgX = (v: number) => margin.left + ((v - xScale.min) / (xScale.max - xScale.min)) * plotW;
  const toSvgY = (v: number) => margin.top + plotH - ((v - yScale.min) / (yScale.max - yScale.min)) * plotH;

  // Size scale (for bubble variant)
  let minR = config.pointSize;
  let maxR = config.pointSize;
  if (sizeColumn >= 0) {
    const sizeVals = points.map((p) => p.size).filter((v): v is number => v !== null);
    if (sizeVals.length > 0) {
      const sMin = Math.min(...sizeVals);
      const sMax = Math.max(...sizeVals);
      minR = Math.max(4, config.pointSize * 0.5);
      maxR = config.pointSize * 2.5;
      for (const p of points) {
        if (p.size !== null && sMax > sMin) {
          (p as { _r?: number })._r = minR + ((p.size - sMin) / (sMax - sMin)) * (maxR - minR);
        } else {
          (p as { _r?: number })._r = (minR + maxR) / 2;
        }
      }
    }
  }

  const getRadius = (p: PointData): number => {
    if (sizeColumn >= 0) return (p as { _r?: number })._r ?? config.pointSize;
    return config.pointSize;
  };

  // Groups and colors
  const uniqueGroups = Array.from(new Set(points.map((p) => p.group)));
  const colors = generateChartColors(t, uniqueGroups.length);
  const groupColor = (g: string) => colors[uniqueGroups.indexOf(g) % colors.length];

  // X ticks
  const xTicks: number[] = [];
  for (let v = xScale.min; v <= xScale.max + xScale.step * 0.01; v += xScale.step) {
    xTicks.push(Math.round(v * 1e10) / 1e10);
  }
  const yTicks: number[] = [];
  for (let v = yScale.min; v <= yScale.max + yScale.step * 0.01; v += yScale.step) {
    yTicks.push(Math.round(v * 1e10) / 1e10);
  }

  // Linear regression
  const regression = config.showRegression ? linearRegression(points) : null;

  // Shape renderer
  const renderPoint = (cx: number, cy: number, r: number, fill: string, opacity: number, key: string) => {
    switch (config.pointShape) {
      case "square":
        return (
          <rect
            key={key}
            x={cx - r}
            y={cy - r}
            width={r * 2}
            height={r * 2}
            fill={fill}
            opacity={opacity}
            rx={1}
          />
        );
      case "diamond":
        return (
          <rect
            key={key}
            x={cx - r * 0.85}
            y={cy - r * 0.85}
            width={r * 1.7}
            height={r * 1.7}
            fill={fill}
            opacity={opacity}
            rx={1}
            transform={`rotate(45 ${cx} ${cy})`}
          />
        );
      default:
        return (
          <circle key={key} cx={cx} cy={cy} r={r} fill={fill} opacity={opacity} />
        );
    }
  };

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg">
      {/* Title */}
      {config.title && (
        <text
          x={margin.left + plotW / 2}
          y={28}
          textAnchor="middle"
          fill={headerColor}
          fontFamily={fontFamily}
          fontSize="16"
          fontWeight="600"
        >
          {config.title}
        </text>
      )}

      {/* Grid lines */}
      {config.showGrid && (
        <g>
          {xTicks.map((v, i) => {
            const sx = toSvgX(v);
            return (
              <line
                key={`xg${i}`}
                x1={sx}
                y1={margin.top}
                x2={sx}
                y2={margin.top + plotH}
                stroke={gridColor}
                strokeWidth={0.5}
                strokeDasharray="4 4"
                opacity={0.6}
              />
            );
          })}
          {yTicks.map((v, i) => {
            const sy = toSvgY(v);
            return (
              <line
                key={`yg${i}`}
                x1={margin.left}
                y1={sy}
                x2={margin.left + plotW}
                y2={sy}
                stroke={gridColor}
                strokeWidth={0.5}
                strokeDasharray="4 4"
                opacity={0.6}
              />
            );
          })}
        </g>
      )}

      {/* Axes */}
      <line
        x1={margin.left}
        y1={margin.top + plotH}
        x2={margin.left + plotW}
        y2={margin.top + plotH}
        stroke={gridColor}
        strokeWidth={1}
      />
      <line
        x1={margin.left}
        y1={margin.top}
        x2={margin.left}
        y2={margin.top + plotH}
        stroke={gridColor}
        strokeWidth={1}
      />

      {/* X-axis ticks + labels */}
      {xTicks.map((v, i) => {
        const sx = toSvgX(v);
        return (
          <g key={`xt${i}`}>
            <line x1={sx} y1={margin.top + plotH} x2={sx} y2={margin.top + plotH + 5} stroke={gridColor} strokeWidth={1} />
            <text
              x={sx}
              y={margin.top + plotH + 20}
              textAnchor="middle"
              fill={textColor}
              fontFamily={fontFamily}
              fontSize="10"
              opacity={0.8}
            >
              {formatTickValue(v)}
            </text>
          </g>
        );
      })}

      {/* Y-axis ticks + labels */}
      {yTicks.map((v, i) => {
        const sy = toSvgY(v);
        return (
          <g key={`yt${i}`}>
            <line x1={margin.left - 5} y1={sy} x2={margin.left} y2={sy} stroke={gridColor} strokeWidth={1} />
            <text
              x={margin.left - 10}
              y={sy + 3.5}
              textAnchor="end"
              fill={textColor}
              fontFamily={fontFamily}
              fontSize="10"
              opacity={0.8}
            >
              {formatTickValue(v)}
            </text>
          </g>
        );
      })}

      {/* Axis labels */}
      <text
        x={margin.left + plotW / 2}
        y={height - 10}
        textAnchor="middle"
        fill={textColor}
        fontFamily={fontFamily}
        fontSize="12"
        fontWeight="500"
      >
        {headers[xColumn] ?? "X"}
      </text>
      <text
        x={16}
        y={margin.top + plotH / 2}
        textAnchor="middle"
        fill={textColor}
        fontFamily={fontFamily}
        fontSize="12"
        fontWeight="500"
        transform={`rotate(-90 16 ${margin.top + plotH / 2})`}
      >
        {headers[yColumn] ?? "Y"}
      </text>

      {/* Regression line */}
      {regression && (
        <line
          x1={toSvgX(xScale.min)}
          y1={toSvgY(regression.slope * xScale.min + regression.intercept)}
          x2={toSvgX(xScale.max)}
          y2={toSvgY(regression.slope * xScale.max + regression.intercept)}
          stroke={headerColor}
          strokeWidth={1.5}
          strokeDasharray="6 4"
          opacity={0.6}
        />
      )}

      {/* Data points */}
      {points.map((p, i) => {
        const cx = toSvgX(p.x);
        const cy = toSvgY(p.y);
        const r = getRadius(p);
        const color = groupColor(p.group);
        return (
          <g key={`pt${i}`}>
            {renderPoint(cx, cy, r, color, config.pointOpacity, `shape${i}`)}
            {config.showValues && (
              <text
                x={cx + r + 4}
                y={cy - r - 2}
                fill={textColor}
                fontFamily={fontFamily}
                fontSize="9"
                opacity={0.7}
              >
                {p.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Legend */}
      {config.showLegend && groupColumn >= 0 && uniqueGroups.length > 1 && (
        <g>
          {uniqueGroups.map((g, i) => {
            const lx = margin.left + plotW + 20;
            const ly = margin.top + i * 22;
            return (
              <g key={`leg${i}`}>
                <circle cx={lx + 6} cy={ly + 6} r={5} fill={groupColor(g)} opacity={config.pointOpacity} />
                <text
                  x={lx + 16}
                  y={ly + 10}
                  fill={textColor}
                  fontFamily={fontFamily}
                  fontSize="11"
                >
                  {g}
                </text>
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}

// ─── Main Page ───────────────────────────────────────────────────

export default function ScatterPage() {
  const [state, setState] = useState<ScatterState>(makeDefaultState);
  const [hydrated, setHydrated] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [inputOpen, setInputOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [colorMode, setColorMode] = useState<"dark" | "light">("dark");
  const [previewSize, setPreviewSize] = useState({ w: 800, h: 600 });
  const [colorsOpen, setColorsOpen] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const previewAreaRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const exportBtnRef = useRef<HTMLButtonElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const loaded = loadState();
    // Auto-detect numeric columns
    if (loaded.tableData) {
      const numCols = loaded.tableData.headers
        .map((_, i) => i)
        .filter((i) => isNumericColumn(loaded.tableData!, i));
      if (numCols.length >= 2) {
        if (!numCols.includes(loaded.xColumn)) loaded.xColumn = numCols[0];
        if (!numCols.includes(loaded.yColumn)) loaded.yColumn = numCols[1];
      }
    }
    setState(loaded);
    setHydrated(true);
  }, []);

  // Load color mode preference
  useEffect(() => {
    const saved = localStorage.getItem("pastepretty-color-mode");
    if (saved === "light" || saved === "dark") {
      setColorMode(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  // Auto-save to localStorage
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

  // ResizeObserver for preview area
  useEffect(() => {
    const el = previewAreaRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setPreviewSize({ w: Math.floor(width), h: Math.floor(height) });
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toggleColorMode = useCallback(() => {
    setColorMode((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("pastepretty-color-mode", next);
      return next;
    });
  }, []);

  const handleChange = useCallback((patch: Partial<ScatterState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };

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
        next.tableData = detectAndParse(
          next.rawInput,
          next.inputFormat === "auto" ? undefined : next.inputFormat,
        );
        // Auto-detect columns on data change
        if (next.tableData) {
          const numCols = next.tableData.headers
            .map((_, i) => i)
            .filter((i) => isNumericColumn(next.tableData!, i));
          if (numCols.length >= 2) {
            if (!numCols.includes(next.xColumn)) next.xColumn = numCols[0];
            if (!numCols.includes(next.yColumn)) next.yColumn = numCols[1];
          }
        }
      }

      return next;
    });
  }, []);

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
      link.download = `scatter-${state.themeId}.${imgFormat}`;
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
      const content = exportData(state.tableData, format, state.title || "scatter_data");
      const ext = EXPORT_FORMATS.find((f) => f.id === format)?.ext ?? "txt";
      downloadText(content, `scatter-data.${ext}`);
    },
    [handleExportImage, state.tableData, state.title],
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
      setState((prev) => ({
        ...prev,
        rawInput: text,
        inputFormat: "auto",
        tableData: detectAndParse(text, format),
      }));
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  // Compute derived values — merge custom color overrides into theme
  const baseTheme = getTheme(state.themeId);
  const mergedTheme = {
    ...baseTheme,
    ...(state.customHeaderBg && { accentBg: state.customHeaderBg, headerBg: state.customHeaderBg }),
    ...(state.customHeaderText && { accentText: state.customHeaderText, headerText: state.customHeaderText }),
    ...(state.customRowBg && { rowBg: state.customRowBg }),
    ...(state.customAltRowBg && { altRowBg: state.customAltRowBg }),
    ...(state.customRowText && { rowText: state.customRowText }),
    ...(state.customBorderColor && { borderColor: state.customBorderColor }),
  };
  const effectiveTheme = colorMode === "light" ? transformThemeForLightMode(mergedTheme) : mergedTheme;
  const bgCss = backgroundToCss(state.background);
  const effectiveBg = colorMode === "light" ? transformBackgroundForLightMode(bgCss) : bgCss;

  // Chart dimensions based on preview area + padding
  const pad = state.padding;
  const chartW = Math.max(400, previewSize.w - pad * 2 - 40);
  const chartH = Math.max(300, previewSize.h - pad * 2 - 40);

  // Scale to fit
  const maxDisplayW = previewSize.w * 0.92;
  const maxDisplayH = previewSize.h * 0.92;
  const outerW = chartW + pad * 2;
  const outerH = chartH + pad * 2;
  const scaleX = maxDisplayW / outerW;
  const scaleY = maxDisplayH / outerH;
  const scale = Math.min(scaleX, scaleY, 1);

  // Numeric columns helper
  const numericCols = state.tableData
    ? state.tableData.headers.map((_, i) => i).filter((i) => isNumericColumn(state.tableData!, i))
    : [];
  const allCols = state.tableData ? state.tableData.headers : [];

  // Control panel styling helper
  const controlBtnStyle = (active?: boolean): React.CSSProperties => ({
    background: active ? "var(--accent)" : "var(--surface)",
    color: active ? "white" : "var(--text-secondary)",
    border: `1px solid ${active ? "transparent" : "var(--border-subtle)"}`,
  });

  const selectStyle: React.CSSProperties = {
    background: "var(--surface)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-subtle)",
    fontSize: "12px",
    height: "32px",
    borderRadius: "8px",
    padding: "0 8px",
    outline: "none",
    minWidth: 0,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "10px",
    color: "var(--text-muted)",
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "4px",
    whiteSpace: "nowrap",
  };

  const themeGroups = themes.reduce<Record<string, typeof themes>>((acc, t) => {
    const g = t.group || "Other";
    if (!acc[g]) acc[g] = [];
    acc[g].push(t);
    return acc;
  }, {});

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--background)" }}>
      {/* Header */}
      <header
        className="shrink-0"
        style={{ background: "var(--panel-bg)", borderBottom: "1px solid var(--panel-border)" }}
      >
        <div className="flex items-center justify-between px-3 sm:px-5" style={{ height: "52px" }}>
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "var(--accent)", boxShadow: "0 2px 8px rgba(110,86,207,0.3)" }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="4" cy="4" r="2" fill="white" opacity="0.9" />
                <circle cx="11" cy="6" r="1.5" fill="white" opacity="0.7" />
                <circle cx="7" cy="10" r="2.5" fill="white" opacity="0.6" />
                <circle cx="13" cy="12" r="1.5" fill="white" opacity="0.5" />
                <circle cx="3" cy="13" r="1" fill="white" opacity="0.4" />
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
                scatter
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 header-actions">
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

            <div className="w-px h-5 mx-1 header-separator" style={{ background: "var(--border-subtle)" }} />

            <input ref={fileRef} type="file" accept=".json,.csv,.md,.markdown,.sql,.txt" onChange={handleImportFile} className="sr-only" />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={controlBtnStyle()}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
              title="Import file"
            >
              <Upload size={13} />
              <span className="nav-btn-label hidden sm:inline">Import</span>
            </button>

            <button
              onClick={() => setInputOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={controlBtnStyle()}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
              title="Edit data"
            >
              <FileText size={13} />
              <span className="nav-btn-label hidden sm:inline">Edit Data</span>
            </button>

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

              {exportOpen && createPortal(
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
                        <span className="ml-auto" style={{ color: "var(--text-subtle)", fontSize: "10px" }}>.{fmt.ext}</span>
                      </button>
                    ))}
                  </div>
                </>,
                document.body,
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Preview Area */}
      <div ref={previewAreaRef} className="flex-1 flex items-center justify-center overflow-hidden" style={{ minHeight: 0 }}>
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          <div
            ref={canvasRef}
            style={{
              width: outerW,
              height: outerH,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: effectiveBg,
              padding: pad,
              borderRadius: bgCss === "transparent" ? 0 : undefined,
            }}
          >
            <WindowFrame
              style={state.windowStyle}
              title={state.title || "Scatter Plot"}
              borderRadius={state.borderRadius}
              theme={effectiveTheme}
            >
              <div
                style={{
                  background: effectiveTheme.rowBg,
                  borderRadius: state.windowStyle === "none" ? `${state.borderRadius}px` : undefined,
                  overflow: "hidden",
                }}
              >
                {state.tableData ? (
                  <ScatterPlotSVG
                    data={state.tableData}
                    theme={mergedTheme}
                    config={state}
                    width={chartW}
                    height={chartH}
                    colorMode={colorMode}
                  />
                ) : (
                  <div
                    style={{
                      width: chartW,
                      height: chartH,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: effectiveTheme.rowText,
                      fontFamily: state.fontFamily || effectiveTheme.fontFamily,
                      fontSize: "14px",
                    }}
                  >
                    Paste data to visualize
                  </div>
                )}
              </div>
            </WindowFrame>
          </div>
        </div>
      </div>

      {/* Control Panel */}
      <div
        className="shrink-0"
        style={{
          background: "var(--panel-bg)",
          borderTop: "1px solid var(--panel-border)",
        }}
      >
        {/* Row 1: Theme, Background, Colors, Font, Size, Title */}
        <div
          className="sub-control-row px-5 pt-4 pb-2"
          style={{ scrollbarWidth: "none" }}
        >
          {/* Theme */}
          <div className="flex flex-col shrink-0">
            <div style={labelStyle}>Theme</div>
            <select
              value={state.themeId}
              onChange={(e) => handleChange({ themeId: e.target.value })}
              style={{ ...selectStyle, minWidth: "140px" }}
            >
              {Object.entries(themeGroups).map(([group, items]) => (
                <optgroup key={group} label={group}>
                  {items.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Background */}
          <div className="flex flex-col shrink-0">
            <div style={labelStyle}>Background</div>
            <div className="flex gap-1">
              {presetBackgrounds.slice(0, 8).map((p, i) => {
                const css = backgroundToCss(p.bg);
                const isActive =
                  state.background.type === p.bg.type &&
                  ((p.bg.type === "none" && state.background.type === "none") ||
                    (p.bg.type === "solid" && state.background.color === p.bg.color) ||
                    (p.bg.type === "gradient" && state.background.gradient === p.bg.gradient));
                return (
                  <button
                    key={i}
                    onClick={() => handleChange({ background: p.bg })}
                    title={p.label}
                    className="rounded-md transition-all"
                    style={{
                      width: 24,
                      height: 24,
                      background: css === "transparent"
                        ? "repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 0 0 / 8px 8px"
                        : css,
                      border: isActive ? "2px solid var(--accent)" : "1px solid var(--swatch-border)",
                      boxShadow: isActive ? "0 0 0 1px var(--accent)" : undefined,
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Colors customizer */}
          <div className="flex flex-col shrink-0 relative">
            <div style={labelStyle}>Colors</div>
            <button
              onClick={() => setColorsOpen(!colorsOpen)}
              className="px-3 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5"
              style={{ ...selectStyle, cursor: "pointer" }}
            >
              <div className="flex gap-0.5">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ background: state.customHeaderBg || effectiveTheme.headerBg.includes("gradient") ? (state.customHeaderBg || "#6e56cf") : (state.customHeaderBg || effectiveTheme.headerBg) }}
                />
                <div className="w-3 h-3 rounded-sm" style={{ background: state.customRowBg || effectiveTheme.rowBg }} />
                <div className="w-3 h-3 rounded-sm" style={{ background: state.customRowText || effectiveTheme.rowText }} />
              </div>
              Customize
            </button>
            {colorsOpen && createPortal(
              <>
                <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setColorsOpen(false)} />
                <div
                  className="rounded-xl p-4"
                  style={{
                    position: "fixed",
                    bottom: "140px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 9999,
                    background: "var(--elevated-bg)",
                    border: "1px solid var(--border)",
                    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
                    minWidth: "320px",
                  }}
                >
                  <div className="text-xs font-semibold mb-3" style={{ color: "var(--foreground)" }}>
                    Custom Colors
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Header BG", key: "customHeaderBg", fallback: effectiveTheme.headerBg },
                      { label: "Header Text", key: "customHeaderText", fallback: effectiveTheme.headerText },
                      { label: "Row BG", key: "customRowBg", fallback: effectiveTheme.rowBg },
                      { label: "Alt Row BG", key: "customAltRowBg", fallback: effectiveTheme.altRowBg },
                      { label: "Row Text", key: "customRowText", fallback: effectiveTheme.rowText },
                      { label: "Border", key: "customBorderColor", fallback: effectiveTheme.borderColor },
                    ].map(({ label, key, fallback }) => (
                      <div key={key}>
                        <div style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "4px" }}>{label}</div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={(state[key as keyof ScatterState] as string) || (fallback.startsWith("#") ? fallback : "#6e56cf")}
                            onChange={(e) => handleChange({ [key]: e.target.value } as Partial<ScatterState>)}
                            className="w-6 h-6 rounded cursor-pointer"
                            style={{ border: "1px solid var(--border-subtle)", padding: 0 }}
                          />
                          <input
                            type="text"
                            value={(state[key as keyof ScatterState] as string) || ""}
                            onChange={(e) => handleChange({ [key]: e.target.value } as Partial<ScatterState>)}
                            placeholder="theme"
                            className="flex-1 text-[10px] px-1.5 py-1 rounded-md"
                            style={{
                              background: "var(--surface)",
                              color: "var(--text-primary)",
                              border: "1px solid var(--border-subtle)",
                              outline: "none",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() =>
                      handleChange({
                        customHeaderBg: "",
                        customHeaderText: "",
                        customRowBg: "",
                        customAltRowBg: "",
                        customRowText: "",
                        customBorderColor: "",
                      })
                    }
                    className="mt-3 text-[10px] px-2 py-1 rounded-md"
                    style={{ color: "var(--text-muted)", background: "var(--surface)", border: "1px solid var(--border-subtle)" }}
                  >
                    Reset to Theme
                  </button>
                </div>
              </>,
              document.body,
            )}
          </div>

          {/* Font */}
          <div className="flex flex-col shrink-0">
            <div style={labelStyle}>Font</div>
            <select
              value={state.fontFamily}
              onChange={(e) => handleChange({ fontFamily: e.target.value })}
              style={{ ...selectStyle, minWidth: "130px" }}
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </div>

          {/* Font Size */}
          <div className="flex flex-col shrink-0">
            <div style={labelStyle}>Size</div>
            <select
              value={state.fontSize}
              onChange={(e) => handleChange({ fontSize: Number(e.target.value) })}
              style={{ ...selectStyle, width: "65px" }}
            >
              {[10, 12, 14, 16, 18, 20, 22, 24].map((s) => (
                <option key={s} value={s}>{s}px</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div className="flex flex-col shrink-0">
            <div style={labelStyle}>Title</div>
            <input
              type="text"
              value={state.title}
              onChange={(e) => handleChange({ title: e.target.value })}
              placeholder="Chart title..."
              className="rounded-lg text-xs"
              style={{
                ...selectStyle,
                minWidth: "140px",
                padding: "0 10px",
              }}
            />
          </div>
        </div>

        {/* Row 2: X-Axis, Y-Axis, Size Column, Group Column, Window, Padding */}
        <div
          className="sub-control-row px-5 py-2"
          style={{ scrollbarWidth: "none" }}
        >
          {/* X-Axis */}
          <div className="flex flex-col shrink-0">
            <div style={labelStyle}>X-Axis</div>
            <select
              value={state.xColumn}
              onChange={(e) => handleChange({ xColumn: Number(e.target.value) })}
              style={{ ...selectStyle, minWidth: "120px" }}
            >
              {numericCols.map((ci) => (
                <option key={ci} value={ci}>{allCols[ci]}</option>
              ))}
            </select>
          </div>

          {/* Y-Axis */}
          <div className="flex flex-col shrink-0">
            <div style={labelStyle}>Y-Axis</div>
            <select
              value={state.yColumn}
              onChange={(e) => handleChange({ yColumn: Number(e.target.value) })}
              style={{ ...selectStyle, minWidth: "120px" }}
            >
              {numericCols.map((ci) => (
                <option key={ci} value={ci}>{allCols[ci]}</option>
              ))}
            </select>
          </div>

          {/* Size Column (bubble) */}
          <div className="flex flex-col shrink-0">
            <div style={labelStyle}>Size Column</div>
            <select
              value={state.sizeColumn}
              onChange={(e) => handleChange({ sizeColumn: Number(e.target.value) })}
              style={{ ...selectStyle, minWidth: "120px" }}
            >
              <option value={-1}>None</option>
              {numericCols.map((ci) => (
                <option key={ci} value={ci}>{allCols[ci]}</option>
              ))}
            </select>
          </div>

          {/* Group Column */}
          <div className="flex flex-col shrink-0">
            <div style={labelStyle}>Group By</div>
            <select
              value={state.groupColumn}
              onChange={(e) => handleChange({ groupColumn: Number(e.target.value) })}
              style={{ ...selectStyle, minWidth: "120px" }}
            >
              <option value={-1}>None</option>
              {allCols.map((name, ci) => (
                <option key={ci} value={ci}>{name}</option>
              ))}
            </select>
          </div>

          {/* Window style */}
          <div className="flex flex-col shrink-0">
            <div style={labelStyle}>Window</div>
            <div className="flex gap-1">
              {(["mac", "windows", "none"] as const).map((ws) => (
                <button
                  key={ws}
                  onClick={() => handleChange({ windowStyle: ws })}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                  style={controlBtnStyle(state.windowStyle === ws)}
                >
                  {ws === "mac" ? "macOS" : ws === "windows" ? "Windows" : "None"}
                </button>
              ))}
            </div>
          </div>

          {/* Padding */}
          <div className="flex flex-col shrink-0">
            <div style={labelStyle}>Padding</div>
            <select
              value={state.padding}
              onChange={(e) => handleChange({ padding: Number(e.target.value) })}
              style={{ ...selectStyle, width: "70px" }}
            >
              {[0, 16, 32, 48, 64, 80, 96, 128].map((p) => (
                <option key={p} value={p}>{p}px</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 3: Shape, Point Size, Opacity, Grid, Regression, Legend, Values */}
        <div
          className="sub-control-row px-5 pt-2 pb-4"
          style={{ scrollbarWidth: "none" }}
        >
          {/* Shape */}
          <div className="flex flex-col shrink-0">
            <div style={labelStyle}>Shape</div>
            <div className="flex gap-1">
              {(["circle", "square", "diamond"] as const).map((sh) => (
                <button
                  key={sh}
                  onClick={() => handleChange({ pointShape: sh })}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all capitalize"
                  style={controlBtnStyle(state.pointShape === sh)}
                >
                  {sh}
                </button>
              ))}
            </div>
          </div>

          {/* Point Size */}
          <div className="flex flex-col shrink-0">
            <div style={labelStyle}>Point Size ({state.pointSize}px)</div>
            <input
              type="range"
              min={4}
              max={20}
              step={1}
              value={state.pointSize}
              onChange={(e) => handleChange({ pointSize: Number(e.target.value) })}
              className="w-24 h-8 accent-[var(--accent)]"
              style={{ accentColor: "var(--accent)" }}
            />
          </div>

          {/* Opacity */}
          <div className="flex flex-col shrink-0">
            <div style={labelStyle}>Opacity ({state.pointOpacity.toFixed(2)})</div>
            <input
              type="range"
              min={0.3}
              max={1}
              step={0.05}
              value={state.pointOpacity}
              onChange={(e) => handleChange({ pointOpacity: Number(e.target.value) })}
              className="w-24 h-8"
              style={{ accentColor: "var(--accent)" }}
            />
          </div>

          {/* Toggles */}
          {[
            { label: "Grid", key: "showGrid" as const, val: state.showGrid },
            { label: "Regression", key: "showRegression" as const, val: state.showRegression },
            { label: "Legend", key: "showLegend" as const, val: state.showLegend },
            { label: "Values", key: "showValues" as const, val: state.showValues },
          ].map(({ label, key, val }) => (
            <div className="flex flex-col shrink-0" key={key}>
              <div style={labelStyle}>{label}</div>
              <button
                onClick={() => handleChange({ [key]: !val } as Partial<ScatterState>)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                style={controlBtnStyle(val)}
              >
                {val ? "On" : "Off"}
              </button>
            </div>
          ))}

          {/* Border Radius */}
          <div className="flex flex-col shrink-0">
            <div style={labelStyle}>Radius</div>
            <select
              value={state.borderRadius}
              onChange={(e) => handleChange({ borderRadius: Number(e.target.value) })}
              style={{ ...selectStyle, width: "65px" }}
            >
              {[0, 4, 8, 12, 16, 24, 32].map((r) => (
                <option key={r} value={r}>{r}px</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Input Drawer */}
      <ScatterInputDrawer
        open={inputOpen}
        onClose={() => setInputOpen(false)}
        state={state}
        onChange={handleChange}
      />
    </div>
  );
}
