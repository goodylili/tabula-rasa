"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
const STORAGE_KEY = "pastepretty-area";

const SAMPLE_AREA_MARKDOWN = `| Quarter | Revenue | Expenses | Profit |
|---------|---------|----------|--------|
| Q1 2024 | 4200 | 3100 | 1100 |
| Q2 2024 | 4800 | 3400 | 1400 |
| Q3 2024 | 5100 | 3200 | 1900 |
| Q4 2024 | 5900 | 3800 | 2100 |
| Q1 2025 | 6200 | 4100 | 2100 |
| Q2 2025 | 7100 | 4400 | 2700 |`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AreaChartConfig {
  labelColumn: number;
  valueColumns: number[];
  showLegend: boolean;
  showValues: boolean;
  curveType: "linear" | "smooth";
  mode: "overlay" | "stacked";
  fillOpacity: number;   // 0.1 – 0.5
  lineWidth: number;     // 1 – 5
  showDots: boolean;
}

interface AreaState {
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
  chart: AreaChartConfig;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseNumericValue(val: string): number {
  const cleaned = val.replace(/[,$%]/g, "").trim();
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
}

function niceScale(maxVal: number): number {
  if (maxVal <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(maxVal)));
  return Math.ceil(maxVal / mag) * mag;
}

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2)
    return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

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
  return d;
}

function generateChartColors(theme: TableTheme, count: number): string[] {
  const palette = [
    theme.headerBg.includes("gradient") ? "#6e56cf" : theme.headerBg,
    "#3ECF8E", "#36B6F0", "#F97316", "#EF4444", "#A855F7",
    "#EC4899", "#14B8A6", "#EAB308", "#6366F1", "#8B5CF6", "#06B6D4",
  ];
  return Array.from({ length: count }, (_, i) => palette[i % palette.length]);
}

function linearPath(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
}

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------
function buildDefaultState(): AreaState {
  const td = detectAndParse(SAMPLE_AREA_MARKDOWN);
  return {
    rawInput: SAMPLE_AREA_MARKDOWN,
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
    chart: {
      labelColumn: 0,
      valueColumns: [1, 2, 3],
      showLegend: true,
      showValues: true,
      curveType: "smooth",
      mode: "overlay",
      fillOpacity: 0.2,
      lineWidth: 2.5,
      showDots: true,
    },
  };
}

function loadState(): AreaState {
  if (typeof window === "undefined") return buildDefaultState();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      parsed.tableData = detectAndParse(parsed.rawInput, parsed.inputFormat === "auto" ? undefined : parsed.inputFormat);
      if (parsed.chart) {
        parsed.chart = { ...buildDefaultState().chart, ...parsed.chart };
      }
      return { ...buildDefaultState(), ...parsed };
    }
  } catch { /* ignore */ }
  return buildDefaultState();
}

function autoDetectColumns(td: TableData): { labelColumn: number; valueColumns: number[] } {
  const numericCols = td.headers
    .map((_, ci) => ci)
    .filter((ci) =>
      td.rows.some((row) => {
        const cleaned = (row[ci] || "").replace(/[,$%]/g, "").trim();
        return cleaned !== "" && !isNaN(Number(cleaned));
      })
    );
  const labelCol = td.headers.findIndex((_, ci) => !numericCols.includes(ci));
  return {
    labelColumn: labelCol >= 0 ? labelCol : 0,
    valueColumns: numericCols.length > 0 ? numericCols : [1],
  };
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
// Area Chart SVG Renderer
// ---------------------------------------------------------------------------
function AreaChartSVG({
  data,
  theme,
  config,
  fontSize,
  fontFamily,
  title,
}: {
  data: TableData;
  theme: TableTheme;
  config: AreaChartConfig;
  fontSize: number;
  fontFamily: string;
  title?: string;
}) {
  const labels = useMemo(
    () => data.rows.map((row) => row[config.labelColumn] || ""),
    [data.rows, config.labelColumn]
  );

  const datasets = useMemo(
    () =>
      config.valueColumns.map((colIdx) => ({
        name: data.headers[colIdx] || `Column ${colIdx + 1}`,
        values: data.rows.map((row) => parseNumericValue(row[colIdx] || "0")),
      })),
    [data, config.valueColumns]
  );

  const colors = useMemo(
    () => generateChartColors(theme, datasets.length),
    [theme, datasets.length]
  );

  const isStacked = config.mode === "stacked";
  const gridLines = 5;

  // Compute stacked values (cumulative) and determine max
  const stackedData = useMemo(() => {
    if (!isStacked) return null;
    const stacked: number[][] = [];
    for (let di = 0; di < datasets.length; di++) {
      stacked[di] = datasets[di].values.map((v, li) => {
        const below = di > 0 ? stacked[di - 1][li] : 0;
        return below + v;
      });
    }
    return stacked;
  }, [datasets, isStacked]);

  const maxVal = useMemo(() => {
    if (isStacked && stackedData) {
      return Math.max(...stackedData[stackedData.length - 1], 1);
    }
    return Math.max(...datasets.flatMap((d) => d.values), 1);
  }, [datasets, isStacked, stackedData]);

  const niceMax = niceScale(maxVal);

  const chartW = Math.max(500, labels.length * 80 + 100);
  const chartH = 340;
  const marginTop = 30;
  const marginBottom = 60;
  const marginLeft = 60;
  const marginRight = 20;
  const plotW = chartW - marginLeft - marginRight;
  const plotH = chartH - marginTop - marginBottom;

  const getX = (i: number) => marginLeft + (i / Math.max(1, labels.length - 1)) * plotW;
  const getY = (v: number) => marginTop + plotH - (v / niceMax) * plotH;

  // Build unique gradient id per series
  const gradientId = (di: number) => `area-grad-${di}`;

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
          background: theme.rowBg,
          padding: "24px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "300px",
          overflowX: "auto",
        }}
      >
        <svg
          width={chartW}
          height={chartH + (config.showLegend ? 40 : 0)}
          style={{ fontFamily }}
        >
          <defs>
            {datasets.map((_, di) => (
              <linearGradient key={di} id={gradientId(di)} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors[di]} stopOpacity={config.fillOpacity} />
                <stop offset="100%" stopColor={colors[di]} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>

          {/* Grid lines */}
          {Array.from({ length: gridLines + 1 }).map((_, i) => {
            const y = marginTop + plotH - (i / gridLines) * plotH;
            const val = (i / gridLines) * niceMax;
            return (
              <g key={i}>
                <line
                  x1={marginLeft} y1={y} x2={chartW - marginRight} y2={y}
                  stroke={theme.borderColor} strokeWidth={1}
                  strokeDasharray={i === 0 ? "none" : "4,4"} opacity={0.5}
                />
                <text
                  x={marginLeft - 10} y={y + 4} textAnchor="end"
                  fill={theme.rowText} fontSize={fontSize - 4} opacity={0.7}
                >
                  {val % 1 === 0 ? val : val.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* X-axis labels */}
          {labels.map((label, i) => (
            <text
              key={i} x={getX(i)} y={marginTop + plotH + 20} textAnchor="middle"
              fill={theme.rowText} fontSize={fontSize - 4} opacity={0.8}
            >
              {label.length > 12 ? label.slice(0, 11) + "\u2026" : label}
            </text>
          ))}

          {/* Area fills + lines — draw in reverse order so first series is on top */}
          {(() => {
            // For stacked: draw from last (top) to first (bottom)
            const order = isStacked
              ? [...Array(datasets.length).keys()].reverse()
              : [...Array(datasets.length).keys()];

            return order.map((di) => {
              const ds = datasets[di];

              // For stacked, the "top" of this series is stackedData[di]
              // and the "bottom" is stackedData[di-1] (or 0)
              let topValues: number[];
              let bottomValues: number[];
              if (isStacked && stackedData) {
                topValues = stackedData[di];
                bottomValues = di > 0 ? stackedData[di - 1] : ds.values.map(() => 0);
              } else {
                topValues = ds.values;
                bottomValues = ds.values.map(() => 0);
              }

              const topPts = topValues.map((v, i) => ({ x: getX(i), y: getY(v) }));
              const bottomPts = bottomValues.map((v, i) => ({ x: getX(i), y: getY(v) }));

              const buildLine = config.curveType === "smooth" ? smoothPath : linearPath;

              const topPathD = buildLine(topPts);
              const bottomPtsReversed = [...bottomPts].reverse();
              const bottomPathD = bottomPtsReversed
                .map((p, i) => `${i === 0 ? "L" : "L"}${p.x},${p.y}`)
                .join(" ");

              const areaD = `${topPathD} ${bottomPathD} Z`;

              return (
                <g key={di}>
                  {/* Filled area */}
                  <path
                    d={areaD}
                    fill={`url(#${gradientId(di)})`}
                  />
                  {/* Stroke line on top */}
                  <path
                    d={topPathD}
                    fill="none"
                    stroke={colors[di]}
                    strokeWidth={config.lineWidth}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {/* Dots */}
                  {config.showDots &&
                    topPts.map((pt, i) => (
                      <circle
                        key={i}
                        cx={pt.x} cy={pt.y}
                        r={config.lineWidth + 2}
                        fill={colors[di]}
                        stroke={theme.rowBg}
                        strokeWidth={2}
                      />
                    ))}
                  {/* Value labels */}
                  {config.showValues &&
                    ds.values.map((v, i) => (
                      <text
                        key={i}
                        x={topPts[i].x}
                        y={topPts[i].y - (config.showDots ? config.lineWidth + 8 : 8)}
                        textAnchor="middle"
                        fill={theme.rowText}
                        fontSize={fontSize - 5}
                        fontWeight={500}
                      >
                        {v % 1 === 0 ? v : v.toFixed(1)}
                      </text>
                    ))}
                </g>
              );
            });
          })()}

          {/* Legend */}
          {config.showLegend && datasets.length > 1 && (
            <g transform={`translate(${marginLeft}, ${chartH + 10})`}>
              {datasets.map((ds, i) => (
                <g key={i} transform={`translate(${i * 120}, 0)`}>
                  <rect width={14} height={10} fill={colors[i]} rx={2} y={1} opacity={config.fillOpacity + 0.3} />
                  <line
                    x1={0} y1={6} x2={14} y2={6}
                    stroke={colors[i]} strokeWidth={config.lineWidth} strokeLinecap="round"
                  />
                  <text x={20} y={10} fill={theme.rowText} fontSize={fontSize - 4}>
                    {ds.name}
                  </text>
                </g>
              ))}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Input Drawer (inline, self-contained)
// ---------------------------------------------------------------------------
function AreaInputDrawer({
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
  inputFormat: AreaState["inputFormat"];
  tableData: TableData | null;
  title: string;
  onChange: (patch: Partial<AreaState>) => void;
}) {
  if (!open) return null;

  const FORMATS = [
    { id: "auto", label: "Auto" },
    { id: "json", label: "JSON" },
    { id: "csv", label: "CSV" },
    { id: "markdown", label: "Markdown" },
    { id: "postgresql", label: "PostgreSQL" },
  ] as const;

  const handleFormatSwitch = (fmt: AreaState["inputFormat"]) => {
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
            Chart Data
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
              onClick={() => handleFormatSwitch(fmt.id as AreaState["inputFormat"])}
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
            Paste table data. First non-numeric column is used as labels; numeric columns as series.
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
  state: AreaState;
  onChange: (patch: Partial<AreaState>) => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (open && anchorRef.current) {
      setRect(anchorRef.current.getBoundingClientRect());
    }
  }, [open, anchorRef]);

  if (!open) return null;

  const fields: { key: keyof AreaState; label: string; themeDefault: string }[] = [
    { key: "customHeaderBg", label: "Header Bg", themeDefault: theme.headerBg },
    { key: "customHeaderText", label: "Header Text", themeDefault: theme.headerText },
    { key: "customRowBg", label: "Chart Bg", themeDefault: theme.rowBg },
    { key: "customRowText", label: "Text", themeDefault: theme.rowText },
    { key: "customBorderColor", label: "Border", themeDefault: theme.borderColor },
  ];

  return createPortal(
    <>
      <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={onClose} />
      <div
        className="rounded-xl p-4"
        style={{
          position: "fixed",
          top: rect ? rect.top - 240 : 200,
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
                onChange={(e) => onChange({ [f.key]: e.target.value } as Partial<AreaState>)}
                className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                style={{ background: "transparent" }}
              />
              {val && (
                <button
                  onClick={() => onChange({ [f.key]: "" } as Partial<AreaState>)}
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
export default function AreaPage() {
  const [state, setState] = useState<AreaState>(buildDefaultState);
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
  }, [state.padding, state.fontSize, state.chart.valueColumns.length]);

  // --- State change helper ---
  const handleChange = useCallback((patch: Partial<AreaState>) => {
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
        // Auto-detect columns on new data
        if (next.tableData) {
          const detected = autoDetectColumns(next.tableData);
          next.chart = { ...next.chart, ...detected };
        }
      }

      return next;
    });
  }, []);

  const handleChartChange = useCallback((patch: Partial<AreaChartConfig>) => {
    setState((prev) => ({
      ...prev,
      chart: { ...prev.chart, ...patch },
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
      link.download = `pastepretty-area-${state.themeId}.${imgFormat}`;
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
      const content = exportData(state.tableData, format, state.title || "area_chart");
      const ext = EXPORT_FORMATS.find((f) => f.id === format)?.ext ?? "txt";
      downloadText(content, `pastepretty-area.${ext}`);
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
      const cols = td ? autoDetectColumns(td) : {};
      setState((prev) => ({
        ...prev,
        rawInput: text,
        inputFormat: "auto",
        tableData: td,
        chart: { ...prev.chart, ...cols },
      }));
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  // --- Computed theme ---
  const rawTheme = getTheme(state.themeId);
  const theme: TableTheme = useMemo(() => {
    let t = colorMode === "light" ? transformThemeForLightMode(rawTheme) : rawTheme;
    // Apply custom overrides
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
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header
        className="shrink-0"
        style={{ background: "var(--panel-bg)", borderBottom: "1px solid var(--panel-border)" }}
      >
        <div className="flex items-center justify-between px-3 sm:px-5" style={{ height: "52px" }}>
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link
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
            </Link>
            <div className="flex items-baseline gap-2">
              <span className="nav-brand-text font-bold text-sm tracking-tight" style={{ color: "var(--foreground)" }}>
                PastePretty
              </span>
              <span
                className="nav-brand-text text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                style={{ color: "var(--text-muted)", background: "var(--surface)" }}
              >
                Area Chart
              </span>
            </div>
          </div>

          {/* Actions */}
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
              title="Edit chart data"
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

      {/* ── Preview Canvas ────────────────────────────────────────────── */}
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
                  <AreaChartSVG
                    data={state.tableData}
                    theme={theme}
                    config={state.chart}
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
                    Paste table data to generate an area chart
                  </div>
                )}
              </WindowFrame>
            </div>
          </div>
        </div>
      </main>

      {/* ── Control Panel ─────────────────────────────────────────────── */}
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
              placeholder="Chart title..."
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

        {/* Row 2: Labels, Values, Window, Padding, Legend, Values toggle */}
        <div className="sub-control-row px-5 py-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          {/* Label column */}
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
              Labels
            </span>
            <select
              value={state.chart.labelColumn}
              onChange={(e) => handleChartChange({ labelColumn: Number(e.target.value) })}
              className="text-xs rounded-lg px-2 py-1.5 focus:outline-none"
              style={{
                background: "var(--surface)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              {state.tableData?.headers.map((h, i) => (
                <option key={i} value={i}>
                  {h}
                </option>
              ))}
            </select>
          </label>

          {/* Value columns (multi-select via checkboxes) */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
              Values
            </span>
            <div className="flex gap-1 flex-wrap">
              {state.tableData?.headers.map((h, i) => {
                if (i === state.chart.labelColumn) return null;
                const isNumeric = state.tableData!.rows.some((row) => {
                  const cleaned = (row[i] || "").replace(/[,$%]/g, "").trim();
                  return cleaned !== "" && !isNaN(Number(cleaned));
                });
                if (!isNumeric) return null;
                const active = state.chart.valueColumns.includes(i);
                return (
                  <button
                    key={i}
                    onClick={() => {
                      const cols = active
                        ? state.chart.valueColumns.filter((c) => c !== i)
                        : [...state.chart.valueColumns, i];
                      if (cols.length > 0) handleChartChange({ valueColumns: cols });
                    }}
                    className="px-2 py-1 rounded-md text-[11px] font-medium transition-all"
                    style={{
                      background: active ? "var(--accent)" : "var(--surface)",
                      color: active ? "white" : "var(--text-muted)",
                      border: `1px solid ${active ? "transparent" : "var(--border-subtle)"}`,
                    }}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Window style */}
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
              Window
            </span>
            <select
              value={state.windowStyle}
              onChange={(e) => handleChange({ windowStyle: e.target.value as AreaState["windowStyle"] })}
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

          {/* Legend toggle */}
          <button
            onClick={() => handleChartChange({ showLegend: !state.chart.showLegend })}
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wider transition-all"
            style={{
              background: state.chart.showLegend ? "var(--accent)" : "var(--surface)",
              color: state.chart.showLegend ? "white" : "var(--text-muted)",
              border: `1px solid ${state.chart.showLegend ? "transparent" : "var(--border-subtle)"}`,
            }}
          >
            Legend
          </button>

          {/* Values toggle */}
          <button
            onClick={() => handleChartChange({ showValues: !state.chart.showValues })}
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wider transition-all"
            style={{
              background: state.chart.showValues ? "var(--accent)" : "var(--surface)",
              color: state.chart.showValues ? "white" : "var(--text-muted)",
              border: `1px solid ${state.chart.showValues ? "transparent" : "var(--border-subtle)"}`,
            }}
          >
            Values
          </button>
        </div>

        {/* Row 3: Curve, Mode, Opacity, Line Width, Dots */}
        <div className="sub-control-row px-5 py-2">
          {/* Curve type */}
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
              Curve
            </span>
            <div className="flex">
              {(["linear", "smooth"] as const).map((ct) => (
                <button
                  key={ct}
                  onClick={() => handleChartChange({ curveType: ct })}
                  className="px-2.5 py-1.5 text-[11px] font-medium transition-all first:rounded-l-lg last:rounded-r-lg"
                  style={{
                    background: state.chart.curveType === ct ? "var(--accent)" : "var(--surface)",
                    color: state.chart.curveType === ct ? "white" : "var(--text-muted)",
                    border: `1px solid ${state.chart.curveType === ct ? "transparent" : "var(--border-subtle)"}`,
                  }}
                >
                  {ct === "linear" ? "Straight" : "Smooth"}
                </button>
              ))}
            </div>
          </label>

          {/* Mode */}
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
              Mode
            </span>
            <div className="flex">
              {(["overlay", "stacked"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => handleChartChange({ mode: m })}
                  className="px-2.5 py-1.5 text-[11px] font-medium transition-all first:rounded-l-lg last:rounded-r-lg capitalize"
                  style={{
                    background: state.chart.mode === m ? "var(--accent)" : "var(--surface)",
                    color: state.chart.mode === m ? "white" : "var(--text-muted)",
                    border: `1px solid ${state.chart.mode === m ? "transparent" : "var(--border-subtle)"}`,
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </label>

          {/* Opacity slider */}
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
              Opacity
            </span>
            <input
              type="range"
              min={0.05}
              max={0.5}
              step={0.05}
              value={state.chart.fillOpacity}
              onChange={(e) => handleChartChange({ fillOpacity: Number(e.target.value) })}
              className="w-20 h-1 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: "var(--accent)" }}
            />
            <span className="text-[10px] tabular-nums w-6" style={{ color: "var(--text-muted)" }}>
              {state.chart.fillOpacity.toFixed(2)}
            </span>
          </label>

          {/* Line width slider */}
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
              Line
            </span>
            <input
              type="range"
              min={1}
              max={5}
              step={0.5}
              value={state.chart.lineWidth}
              onChange={(e) => handleChartChange({ lineWidth: Number(e.target.value) })}
              className="w-16 h-1 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: "var(--accent)" }}
            />
            <span className="text-[10px] tabular-nums w-6" style={{ color: "var(--text-muted)" }}>
              {state.chart.lineWidth}px
            </span>
          </label>

          {/* Dots toggle */}
          <button
            onClick={() => handleChartChange({ showDots: !state.chart.showDots })}
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wider transition-all"
            style={{
              background: state.chart.showDots ? "var(--accent)" : "var(--surface)",
              color: state.chart.showDots ? "white" : "var(--text-muted)",
              border: `1px solid ${state.chart.showDots ? "transparent" : "var(--border-subtle)"}`,
            }}
          >
            Dots
          </button>
        </div>
      </footer>

      {/* ── Input Drawer ──────────────────────────────────────────────── */}
      <AreaInputDrawer
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
