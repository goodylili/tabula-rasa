"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { toPng, toJpeg, toSvg } from "html-to-image";
import { TableData, TableTheme, Background } from "@/lib/types";
import { detectAndParse } from "@/lib/parser";
import { exportData, downloadText, ExportFormat, sanitizeFilename } from "@/lib/exporters";
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
const STORAGE_KEY = "pastepretty-funnel";

const SAMPLE_FUNNEL_MARKDOWN = `| Stage | Users |
|-------|-------|
| Visited Website | 10000 |
| Signed Up | 4200 |
| Activated | 2800 |
| Subscribed | 1400 |
| Renewed | 950 |`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface FunnelChartConfig {
  labelColumn: number;
  valueColumn: number;
  direction: "vertical" | "horizontal";
  alignment: "center" | "left";
  gap: number;        // 0–12 px
  cornerRadius: number; // 0–8 px
  showLabels: boolean;
  showValues: boolean;
  showDropoff: boolean;
}

interface FunnelState {
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
  chart: FunnelChartConfig;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseNumericValue(val: string): number {
  const cleaned = val.replace(/[,$%]/g, "").trim();
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
}

function generateChartColors(theme: TableTheme, count: number): string[] {
  const palette = [
    theme.headerBg.includes("gradient") ? "#6e56cf" : theme.headerBg,
    "#3ECF8E", "#36B6F0", "#F97316", "#EF4444", "#A855F7",
    "#EC4899", "#14B8A6", "#EAB308", "#6366F1", "#8B5CF6", "#06B6D4",
  ];
  return Array.from({ length: count }, (_, i) => palette[i % palette.length]);
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------
function buildDefaultState(): FunnelState {
  const td = detectAndParse(SAMPLE_FUNNEL_MARKDOWN);
  return {
    rawInput: SAMPLE_FUNNEL_MARKDOWN,
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
      valueColumn: 1,
      direction: "vertical",
      alignment: "center",
      gap: 4,
      cornerRadius: 4,
      showLabels: true,
      showValues: true,
      showDropoff: true,
    },
  };
}

function loadState(): FunnelState {
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

function autoDetectColumns(td: TableData): { labelColumn: number; valueColumn: number } {
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
    valueColumn: numericCols.length > 0 ? numericCols[0] : 1,
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
// Funnel Chart SVG Renderer
// ---------------------------------------------------------------------------
function FunnelChartSVG({
  data,
  theme,
  config,
  fontSize,
  fontFamily,
  title,
}: {
  data: TableData;
  theme: TableTheme;
  config: FunnelChartConfig;
  fontSize: number;
  fontFamily: string;
  title?: string;
}) {
  const labels = useMemo(
    () => data.rows.map((row) => row[config.labelColumn] || ""),
    [data.rows, config.labelColumn]
  );

  const values = useMemo(
    () => data.rows.map((row) => parseNumericValue(row[config.valueColumn] || "0")),
    [data.rows, config.valueColumn]
  );

  const colors = useMemo(
    () => generateChartColors(theme, values.length),
    [theme, values.length]
  );

  const maxValue = values.length > 0 ? Math.max(...values, 1) : 1;
  const stageCount = values.length;
  const isVertical = config.direction === "vertical";
  const isCentered = config.alignment === "center";

  // --- Vertical layout ---
  const stageH = 48;
  const dropoffH = config.showDropoff ? 24 : 0;
  const labelMarginLeft = config.showLabels ? 160 : 0;
  const valueMarginRight = config.showValues ? 100 : 0;
  const funnelMaxW = 420;
  const totalH_v = stageCount * stageH + Math.max(0, stageCount - 1) * (config.gap + dropoffH);
  const totalW_v = labelMarginLeft + funnelMaxW + valueMarginRight;

  // --- Horizontal layout ---
  const stageW_h = 80;
  const dropoffW_h = config.showDropoff ? 40 : 0;
  const funnelMaxH_h = 300;
  const labelH_h = config.showLabels ? 40 : 0;
  const valueH_h = config.showValues ? 28 : 0;
  const totalW_h = stageCount * stageW_h + Math.max(0, stageCount - 1) * (config.gap + dropoffW_h);
  const totalH_h = valueH_h + funnelMaxH_h + labelH_h + 20;

  const svgW = isVertical ? totalW_v : totalW_h + 40;
  const svgH = isVertical ? totalH_v + 20 : totalH_h;

  // Build trapezoid paths for vertical funnel
  function verticalTrapezoid(index: number): string {
    const ratio = maxValue > 0 ? values[index] / maxValue : 0;
    const nextRatio = index < stageCount - 1 ? values[index + 1] / maxValue : ratio * 0.7;
    const topW = ratio * funnelMaxW;
    const bottomW = (index < stageCount - 1 ? nextRatio : ratio * 0.7) * funnelMaxW;
    const yOff = index * (stageH + config.gap + dropoffH);
    const r = config.cornerRadius;

    if (isCentered) {
      const cx = labelMarginLeft + funnelMaxW / 2;
      const x1 = cx - topW / 2;
      const x2 = cx + topW / 2;
      const x3 = cx + bottomW / 2;
      const x4 = cx - bottomW / 2;
      return roundedTrapezoid(x1, yOff, x2, yOff, x3, yOff + stageH, x4, yOff + stageH, r);
    } else {
      const x1 = labelMarginLeft;
      const x2 = labelMarginLeft + topW;
      const x3 = labelMarginLeft + bottomW;
      const x4 = labelMarginLeft;
      return roundedTrapezoid(x1, yOff, x2, yOff, x3, yOff + stageH, x4, yOff + stageH, r);
    }
  }

  // Build trapezoid paths for horizontal funnel
  function horizontalTrapezoid(index: number): string {
    const ratio = maxValue > 0 ? values[index] / maxValue : 0;
    const nextRatio = index < stageCount - 1 ? values[index + 1] / maxValue : ratio * 0.7;
    const leftH = ratio * funnelMaxH_h;
    const rightH = (index < stageCount - 1 ? nextRatio : ratio * 0.7) * funnelMaxH_h;
    const xOff = index * (stageW_h + config.gap + dropoffW_h) + 20;
    const baseY = valueH_h + funnelMaxH_h;
    const r = config.cornerRadius;

    if (isCentered) {
      const cy = valueH_h + funnelMaxH_h / 2;
      const y1 = cy - leftH / 2;
      const y2 = cy + leftH / 2;
      const y3 = cy + rightH / 2;
      const y4 = cy - rightH / 2;
      return roundedTrapezoid(xOff, y1, xOff + stageW_h, y4, xOff + stageW_h, y3, xOff, y2, r);
    } else {
      const y1 = baseY - leftH;
      const y2 = baseY;
      const y3 = baseY;
      const y4 = baseY - rightH;
      return roundedTrapezoid(xOff, y1, xOff + stageW_h, y4, xOff + stageW_h, y3, xOff, y2, r);
    }
  }

  // Rounded trapezoid using quadratic bezier at corners
  function roundedTrapezoid(
    x1: number, y1: number, // top-left
    x2: number, y2: number, // top-right
    x3: number, y3: number, // bottom-right
    x4: number, y4: number, // bottom-left
    r: number
  ): string {
    if (r === 0) {
      return `M${x1},${y1} L${x2},${y2} L${x3},${y3} L${x4},${y4} Z`;
    }

    // Clamp radius so it doesn't exceed half a side length
    const sides = [
      Math.hypot(x2 - x1, y2 - y1),
      Math.hypot(x3 - x2, y3 - y2),
      Math.hypot(x4 - x3, y4 - y3),
      Math.hypot(x1 - x4, y1 - y4),
    ];
    const minSide = Math.min(...sides);
    const cr = Math.min(r, minSide / 3);

    const pts = [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
      { x: x3, y: y3 },
      { x: x4, y: y4 },
    ];

    let d = "";
    for (let i = 0; i < 4; i++) {
      const prev = pts[(i + 3) % 4];
      const curr = pts[i];
      const next = pts[(i + 1) % 4];

      // Direction vectors
      const dxIn = curr.x - prev.x;
      const dyIn = curr.y - prev.y;
      const lenIn = Math.hypot(dxIn, dyIn) || 1;
      const dxOut = next.x - curr.x;
      const dyOut = next.y - curr.y;
      const lenOut = Math.hypot(dxOut, dyOut) || 1;

      // Points offset from corner by cr
      const ax = curr.x - (dxIn / lenIn) * cr;
      const ay = curr.y - (dyIn / lenIn) * cr;
      const bx = curr.x + (dxOut / lenOut) * cr;
      const by = curr.y + (dyOut / lenOut) * cr;

      if (i === 0) {
        d += `M${ax},${ay}`;
      } else {
        d += ` L${ax},${ay}`;
      }
      d += ` Q${curr.x},${curr.y} ${bx},${by}`;
    }
    d += " Z";
    return d;
  }

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
        <svg width={svgW} height={svgH} style={{ fontFamily }}>
          {isVertical ? (
            // ---- VERTICAL FUNNEL ----
            <>
              {values.map((val, i) => {
                const yOff = i * (stageH + config.gap + dropoffH);
                const ratio = maxValue > 0 ? val / maxValue : 0;
                const barW = ratio * funnelMaxW;
                const cx = labelMarginLeft + funnelMaxW / 2;

                return (
                  <g key={i}>
                    {/* Trapezoid stage */}
                    <path d={verticalTrapezoid(i)} fill={colors[i]} />

                    {/* Label on the left */}
                    {config.showLabels && (
                      <text
                        x={labelMarginLeft - 12}
                        y={yOff + stageH / 2 + 1}
                        textAnchor="end"
                        dominantBaseline="middle"
                        fill={theme.rowText}
                        fontSize={fontSize - 3}
                        fontWeight={500}
                      >
                        {labels[i].length > 20 ? labels[i].slice(0, 19) + "\u2026" : labels[i]}
                      </text>
                    )}

                    {/* Value on the right or centered on bar */}
                    {config.showValues && (
                      <text
                        x={isCentered ? cx : labelMarginLeft + barW / 2}
                        y={yOff + stageH / 2 + 1}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="white"
                        fontSize={fontSize - 2}
                        fontWeight={700}
                      >
                        {formatNumber(val)}
                      </text>
                    )}

                    {/* Drop-off annotation between stages */}
                    {config.showDropoff && i < stageCount - 1 && (
                      (() => {
                        const nextVal = values[i + 1];
                        const pct = val > 0 ? ((val - nextVal) / val * 100).toFixed(1) : "0.0";
                        const annotY = yOff + stageH + config.gap / 2 + dropoffH / 2;
                        return (
                          <text
                            x={isCentered ? cx : labelMarginLeft + barW / 2}
                            y={annotY}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill={theme.rowText}
                            fontSize={fontSize - 5}
                            fontWeight={500}
                            opacity={0.6}
                          >
                            -{pct}%
                          </text>
                        );
                      })()
                    )}
                  </g>
                );
              })}
            </>
          ) : (
            // ---- HORIZONTAL FUNNEL ----
            <>
              {values.map((val, i) => {
                const xOff = i * (stageW_h + config.gap + dropoffW_h) + 20;
                const ratio = maxValue > 0 ? val / maxValue : 0;
                const barH = ratio * funnelMaxH_h;
                const cy = valueH_h + funnelMaxH_h / 2;
                const baseY = valueH_h + funnelMaxH_h;

                return (
                  <g key={i}>
                    {/* Trapezoid stage */}
                    <path d={horizontalTrapezoid(i)} fill={colors[i]} />

                    {/* Value above stage */}
                    {config.showValues && (
                      <text
                        x={xOff + stageW_h / 2}
                        y={isCentered ? cy : baseY - barH / 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="white"
                        fontSize={fontSize - 3}
                        fontWeight={700}
                      >
                        {formatNumber(val)}
                      </text>
                    )}

                    {/* Label below */}
                    {config.showLabels && (
                      <text
                        x={xOff + stageW_h / 2}
                        y={valueH_h + funnelMaxH_h + labelH_h / 2 + 8}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={theme.rowText}
                        fontSize={fontSize - 5}
                        fontWeight={500}
                      >
                        {labels[i].length > 10 ? labels[i].slice(0, 9) + "\u2026" : labels[i]}
                      </text>
                    )}

                    {/* Drop-off between stages */}
                    {config.showDropoff && i < stageCount - 1 && (
                      (() => {
                        const nextVal = values[i + 1];
                        const pct = val > 0 ? ((val - nextVal) / val * 100).toFixed(1) : "0.0";
                        const annotX = xOff + stageW_h + config.gap / 2 + dropoffW_h / 2;
                        return (
                          <text
                            x={annotX}
                            y={cy}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill={theme.rowText}
                            fontSize={fontSize - 6}
                            fontWeight={500}
                            opacity={0.6}
                          >
                            -{pct}%
                          </text>
                        );
                      })()
                    )}
                  </g>
                );
              })}
            </>
          )}
        </svg>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Input Drawer (inline, self-contained)
// ---------------------------------------------------------------------------
function FunnelInputDrawer({
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
  inputFormat: FunnelState["inputFormat"];
  tableData: TableData | null;
  title: string;
  onChange: (patch: Partial<FunnelState>) => void;
}) {
  if (!open) return null;

  const FORMATS = [
    { id: "auto", label: "Auto" },
    { id: "json", label: "JSON" },
    { id: "csv", label: "CSV" },
    { id: "markdown", label: "Markdown" },
    { id: "postgresql", label: "PostgreSQL" },
  ] as const;

  const handleFormatSwitch = (fmt: FunnelState["inputFormat"]) => {
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
              onClick={() => handleFormatSwitch(fmt.id as FunnelState["inputFormat"])}
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
            Paste table data. First non-numeric column is used as stage labels; first numeric column as values.
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
  state: FunnelState;
  onChange: (patch: Partial<FunnelState>) => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (open && anchorRef.current) {
      setRect(anchorRef.current.getBoundingClientRect());
    }
  }, [open, anchorRef]);

  if (!open) return null;

  const fields: { key: keyof FunnelState; label: string; themeDefault: string }[] = [
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
                onChange={(e) => onChange({ [f.key]: e.target.value } as Partial<FunnelState>)}
                className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                style={{ background: "transparent" }}
              />
              {val && (
                <button
                  onClick={() => onChange({ [f.key]: "" } as Partial<FunnelState>)}
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
export default function FunnelPage() {
  const [state, setState] = useState<FunnelState>(buildDefaultState);
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
  }, [state.padding, state.fontSize, state.chart.direction]);

  // --- State change helper ---
  const handleChange = useCallback((patch: Partial<FunnelState>) => {
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

  const handleChartChange = useCallback((patch: Partial<FunnelChartConfig>) => {
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
      link.download = `${sanitizeFilename(state.title, "pastepretty-funnel")}.${imgFormat}`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [state.title]);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setExportOpen(false);
      if (format === "png" || format === "jpg" || format === "svg") {
        await handleExportImage(format);
        return;
      }
      if (!state.tableData) return;
      const content = exportData(state.tableData, format, state.title || "funnel_chart");
      const ext = EXPORT_FORMATS.find((f) => f.id === format)?.ext ?? "txt";
      downloadText(content, `${sanitizeFilename(state.title, "pastepretty-funnel")}.${ext}`);
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
    <div className="h-[100dvh] flex flex-col overflow-hidden" style={{ background: "var(--background)" }}>
      {/* -- Header -------------------------------------------------------- */}
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
                Funnel Chart
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
                  <FunnelChartSVG
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
                    Paste table data to generate a funnel chart
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
        <div className="sub-control-row px-5 py-2 flex-wrap" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
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
              Font Size
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

        {/* Row 2: Label column, Value column, Window, Padding, Border Radius */}
        <div className="sub-control-row px-5 py-2 flex-wrap" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
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

          {/* Value column */}
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
              Values
            </span>
            <select
              value={state.chart.valueColumn}
              onChange={(e) => handleChartChange({ valueColumn: Number(e.target.value) })}
              className="text-xs rounded-lg px-2 py-1.5 focus:outline-none"
              style={{
                background: "var(--surface)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              {state.tableData?.headers.map((h, i) => {
                if (i === state.chart.labelColumn) return null;
                return (
                  <option key={i} value={i}>
                    {h}
                  </option>
                );
              })}
            </select>
          </label>

          {/* Window style */}
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
              Window
            </span>
            <select
              value={state.windowStyle}
              onChange={(e) => handleChange({ windowStyle: e.target.value as FunnelState["windowStyle"] })}
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

          {/* Size */}
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
              Size
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

          {/* Border Radius */}
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
              Radius
            </span>
            <select
              value={state.borderRadius}
              onChange={(e) => handleChange({ borderRadius: Number(e.target.value) })}
              className="text-xs rounded-lg px-2 py-1.5 focus:outline-none"
              style={{
                background: "var(--surface)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
                width: "56px",
              }}
            >
              {[0, 4, 8, 12, 16, 24, 32].map((r) => (
                <option key={r} value={r}>
                  {r}px
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Row 3: Direction, Alignment, Gap, Corner Radius, Show toggles */}
        <div className="sub-control-row px-5 py-2 flex-wrap">
          {/* Direction */}
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
              Direction
            </span>
            <div className="flex">
              {(["vertical", "horizontal"] as const).map((dir) => (
                <button
                  key={dir}
                  onClick={() => handleChartChange({ direction: dir })}
                  className="px-2.5 py-1.5 text-[11px] font-medium transition-all first:rounded-l-lg last:rounded-r-lg capitalize"
                  style={{
                    background: state.chart.direction === dir ? "var(--accent)" : "var(--surface)",
                    color: state.chart.direction === dir ? "white" : "var(--text-muted)",
                    border: `1px solid ${state.chart.direction === dir ? "transparent" : "var(--border-subtle)"}`,
                  }}
                >
                  {dir === "vertical" ? "Vertical" : "Horizontal"}
                </button>
              ))}
            </div>
          </label>

          {/* Alignment */}
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
              Align
            </span>
            <div className="flex">
              {(["center", "left"] as const).map((al) => (
                <button
                  key={al}
                  onClick={() => handleChartChange({ alignment: al })}
                  className="px-2.5 py-1.5 text-[11px] font-medium transition-all first:rounded-l-lg last:rounded-r-lg capitalize"
                  style={{
                    background: state.chart.alignment === al ? "var(--accent)" : "var(--surface)",
                    color: state.chart.alignment === al ? "white" : "var(--text-muted)",
                    border: `1px solid ${state.chart.alignment === al ? "transparent" : "var(--border-subtle)"}`,
                  }}
                >
                  {al === "center" ? "Center" : "Left"}
                </button>
              ))}
            </div>
          </label>

          {/* Gap slider */}
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
              Gap
            </span>
            <input
              type="range"
              min={0}
              max={12}
              step={1}
              value={state.chart.gap}
              onChange={(e) => handleChartChange({ gap: Number(e.target.value) })}
              className="w-16 h-1 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: "var(--accent)" }}
            />
            <span className="text-[10px] tabular-nums w-6" style={{ color: "var(--text-muted)" }}>
              {state.chart.gap}px
            </span>
          </label>

          {/* Corner Radius slider */}
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>
              Corner
            </span>
            <input
              type="range"
              min={0}
              max={8}
              step={1}
              value={state.chart.cornerRadius}
              onChange={(e) => handleChartChange({ cornerRadius: Number(e.target.value) })}
              className="w-16 h-1 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: "var(--accent)" }}
            />
            <span className="text-[10px] tabular-nums w-6" style={{ color: "var(--text-muted)" }}>
              {state.chart.cornerRadius}px
            </span>
          </label>

          {/* Show Labels toggle */}
          <button
            onClick={() => handleChartChange({ showLabels: !state.chart.showLabels })}
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wider transition-all"
            style={{
              background: state.chart.showLabels ? "var(--accent)" : "var(--surface)",
              color: state.chart.showLabels ? "white" : "var(--text-muted)",
              border: `1px solid ${state.chart.showLabels ? "transparent" : "var(--border-subtle)"}`,
            }}
          >
            Labels
          </button>

          {/* Show Values toggle */}
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

          {/* Show Drop-off toggle */}
          <button
            onClick={() => handleChartChange({ showDropoff: !state.chart.showDropoff })}
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wider transition-all"
            style={{
              background: state.chart.showDropoff ? "var(--accent)" : "var(--surface)",
              color: state.chart.showDropoff ? "white" : "var(--text-muted)",
              border: `1px solid ${state.chart.showDropoff ? "transparent" : "var(--border-subtle)"}`,
            }}
          >
            Drop-off
          </button>
        </div>
      </footer>

      {/* -- Input Drawer -------------------------------------------------- */}
      <FunnelInputDrawer
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
