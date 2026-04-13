"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
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

const STORAGE_KEY = "pastepretty-treemap";

const SAMPLE_TREEMAP_DATA = `| Category | Revenue | Department |
|----------|---------|------------|
| Electronics | 4500 | Retail |
| Clothing | 3200 | Retail |
| Groceries | 2800 | Retail |
| Cloud Services | 5100 | Tech |
| Consulting | 2200 | Services |
| Advertising | 1800 | Marketing |
| Subscriptions | 3600 | Tech |
| Support | 1200 | Services |
| Logistics | 900 | Operations |
| Training | 600 | HR |`;

const TREEMAP_PALETTE = [
  "#6e56cf", "#3ECF8E", "#36B6F0", "#FF6A00", "#ff79c6",
  "#F6821F", "#8AB4F8", "#635BFF", "#A8FF53", "#FF4F00",
  "#00DC82", "#55d799", "#5A67D8", "#6C47FF", "#a6e22e",
  "#2aa198", "#FFCF73", "#CF2F98", "#4CC8C8", "#88c0d0",
];

// ─── Types ──────────────────────────────────────────────────────────────────

interface TreemapState {
  rawInput: string;
  inputFormat: "json" | "markdown" | "csv" | "postgresql" | "auto";
  tableData: TableData | null;
  themeId: string;
  background: Background;
  windowStyle: "mac" | "windows" | "none";
  fontSize: number;
  fontFamily: string;
  title: string;
  padding: number;
  borderRadius: number;
  labelColumn: number;
  valueColumn: number;
  groupColumn: number; // -1 = none
  cellGap: number;
  cellRadius: number;
  cellBorderWidth: number;
  cellBorderColor: string;
  showValues: boolean;
  showPercentages: boolean;
  showLegend: boolean;
}

interface TreemapItem {
  label: string;
  value: number;
  group: string;
  color: string;
}

interface TreemapRect {
  x: number;
  y: number;
  w: number;
  h: number;
  item: TreemapItem;
}

interface GroupHeaderRect {
  x: number;
  y: number;
  w: number;
  h: number;
  group: string;
}

// ─── Default State ──────────────────────────────────────────────────────────

const DEFAULT_STATE: TreemapState = {
  rawInput: SAMPLE_TREEMAP_DATA,
  inputFormat: "auto",
  tableData: detectAndParse(SAMPLE_TREEMAP_DATA),
  themeId: "vercel",
  background: { type: "none" },
  windowStyle: "mac",
  fontSize: 14,
  fontFamily: "'Noto Sans Mono', monospace",
  title: "",
  padding: 64,
  borderRadius: 32,
  labelColumn: 0,
  valueColumn: 1,
  groupColumn: 2,
  cellGap: 3,
  cellRadius: 4,
  cellBorderWidth: 1,
  cellBorderColor: "",
  showValues: true,
  showPercentages: false,
  showLegend: true,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseNumericValue(val: string): number {
  if (!val) return 0;
  const cleaned = val.replace(/[,$%\s]/g, "").trim();
  const n = Number(cleaned);
  return isNaN(n) ? 0 : Math.abs(n);
}

function loadState(): TreemapState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      parsed.tableData = detectAndParse(
        parsed.rawInput,
        parsed.inputFormat === "auto" ? undefined : parsed.inputFormat
      );
      return { ...DEFAULT_STATE, ...parsed };
    }
  } catch { /* ignore */ }
  return DEFAULT_STATE;
}

// Determine text color for contrast against a background hex
function textColorForBg(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return "#ffffff";
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? "#000000" : "#ffffff";
}

// ─── Squarified Treemap Algorithm ───────────────────────────────────────────

function squarify(
  items: TreemapItem[],
  rect: { x: number; y: number; w: number; h: number },
  gap: number
): TreemapRect[] {
  if (items.length === 0 || rect.w <= 0 || rect.h <= 0) return [];

  const totalValue = items.reduce((s, it) => s + it.value, 0);
  if (totalValue <= 0) return [];

  // Normalize values to areas
  const totalArea = rect.w * rect.h;
  const areas = items.map((it) => (it.value / totalValue) * totalArea);

  const result: TreemapRect[] = [];
  let remaining = items.map((it, i) => ({ item: it, area: areas[i] }));
  let currentRect = { ...rect };

  while (remaining.length > 0) {
    const isWide = currentRect.w >= currentRect.h;
    const sideLen = isWide ? currentRect.h : currentRect.w;

    if (remaining.length === 1) {
      const { item } = remaining[0];
      result.push({
        x: currentRect.x + gap / 2,
        y: currentRect.y + gap / 2,
        w: Math.max(0, currentRect.w - gap),
        h: Math.max(0, currentRect.h - gap),
        item,
      });
      break;
    }

    // Find optimal strip
    const strip = [remaining[0]];
    let stripArea = remaining[0].area;

    const worstRatio = (s: typeof strip, side: number) => {
      const sArea = s.reduce((acc, r) => acc + r.area, 0);
      let worst = 0;
      for (const r of s) {
        const stripLen = sArea / side;
        const cellLen = r.area / stripLen;
        const ratio = Math.max(cellLen / stripLen, stripLen / cellLen);
        worst = Math.max(worst, ratio);
      }
      return worst;
    };

    for (let i = 1; i < remaining.length; i++) {
      const candidate = [...strip, remaining[i]];
      const oldW = worstRatio(strip, sideLen);
      const newW = worstRatio(candidate, sideLen);
      if (newW <= oldW) {
        strip.push(remaining[i]);
        stripArea += remaining[i].area;
      } else {
        break;
      }
    }

    // Lay out the strip
    const stripLen = stripArea / sideLen;
    let offset = 0;

    for (const r of strip) {
      const cellLen = r.area / stripLen;
      let rx: number, ry: number, rw: number, rh: number;

      if (isWide) {
        rx = currentRect.x + gap / 2;
        ry = currentRect.y + offset + gap / 2;
        rw = Math.max(0, stripLen - gap);
        rh = Math.max(0, cellLen - gap);
      } else {
        rx = currentRect.x + offset + gap / 2;
        ry = currentRect.y + gap / 2;
        rw = Math.max(0, cellLen - gap);
        rh = Math.max(0, stripLen - gap);
      }

      result.push({ x: rx, y: ry, w: rw, h: rh, item: r.item });
      offset += cellLen;
    }

    // Update remaining rect
    if (isWide) {
      currentRect = {
        x: currentRect.x + stripLen,
        y: currentRect.y,
        w: currentRect.w - stripLen,
        h: currentRect.h,
      };
    } else {
      currentRect = {
        x: currentRect.x,
        y: currentRect.y + stripLen,
        w: currentRect.w,
        h: currentRect.h - stripLen,
      };
    }

    remaining = remaining.slice(strip.length);
  }

  return result;
}

// ─── Export Formats ─────────────────────────────────────────────────────────

const EXPORT_FORMATS: { id: ExportFormat; label: string; ext: string; icon: React.ReactNode }[] = [
  { id: "png", label: "PNG Image", ext: "png", icon: <Image size={13} /> },
  { id: "jpg", label: "JPG Image", ext: "jpg", icon: <Image size={13} /> },
  { id: "svg", label: "SVG Image", ext: "svg", icon: <Image size={13} /> },
  { id: "json", label: "JSON", ext: "json", icon: <FileJson size={13} /> },
  { id: "csv", label: "CSV", ext: "csv", icon: <FileSpreadsheet size={13} /> },
  { id: "markdown", label: "Markdown", ext: "md", icon: <FileText size={13} /> },
  { id: "postgresql", label: "PostgreSQL", ext: "sql", icon: <Database size={13} /> },
];

const INPUT_FORMATS = [
  { id: "auto", label: "Auto" },
  { id: "json", label: "JSON" },
  { id: "csv", label: "CSV" },
  { id: "markdown", label: "Markdown" },
  { id: "postgresql", label: "PostgreSQL" },
] as const;

// ─── Component ──────────────────────────────────────────────────────────────

export default function TreemapPage() {
  const [state, setState] = useState<TreemapState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [inputOpen, setInputOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [colorMode, setColorMode] = useState<"dark" | "light">("dark");
  const [previewScale, setPreviewScale] = useState(1);

  const canvasRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const exportBtnRef = useRef<HTMLButtonElement>(null);

  // ── Hydrate from localStorage ───────────────────────────────────────────
  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("pastepretty-color-mode");
    if (saved === "light" || saved === "dark") {
      setColorMode(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  // ── Auto-save ───────────────────────────────────────────────────────────
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

  // ── ResizeObserver for preview scaling ─────────────────────────────────
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const baseW = 800 + state.padding * 2;
      const baseH = 500 + state.padding * 2;
      const scale = Math.min(cw / baseW, ch / baseH, 1) * 0.92;
      setPreviewScale(Math.max(0.2, scale));
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [state.padding]);

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleChange = useCallback((patch: Partial<TreemapState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      if ("themeId" in patch && patch.themeId !== prev.themeId) {
        const newTheme = getTheme(patch.themeId!);
        next.background = { type: "gradient", gradient: newTheme.defaultBg };
        next.cellBorderColor = "";
      }
      if ("rawInput" in patch || "inputFormat" in patch) {
        next.tableData = detectAndParse(
          next.rawInput,
          next.inputFormat === "auto" ? undefined : next.inputFormat
        );
      }
      return next;
    });
  }, []);

  const toggleColorMode = useCallback(() => {
    setColorMode((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("pastepretty-color-mode", next);
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
      if (imgFormat === "jpg") dataUrl = await toJpeg(canvasRef.current, { ...opts, quality: 0.95 });
      else if (imgFormat === "svg") dataUrl = await toSvg(canvasRef.current, opts);
      else dataUrl = await toPng(canvasRef.current, opts);
      const link = document.createElement("a");
      link.download = `pastepretty-treemap-${state.themeId}.${imgFormat}`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [state.themeId]);

  const handleExport = useCallback(async (format: ExportFormat) => {
    setExportOpen(false);
    if (format === "png" || format === "jpg" || format === "svg") {
      await handleExportImage(format);
      return;
    }
    if (!state.tableData) return;
    const content = exportData(state.tableData, format, state.title || "treemap");
    const ext = EXPORT_FORMATS.find((f) => f.id === format)?.ext ?? "txt";
    downloadText(content, `pastepretty-treemap.${ext}`);
  }, [handleExportImage, state.tableData, state.title]);

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

  // ── Derive treemap data ───────────────────────────────────────────────
  const td = state.tableData;
  const headers = td?.headers ?? [];
  const numCols = headers.length;

  let rawTheme = getTheme(state.themeId);
  if (colorMode === "light") rawTheme = transformThemeForLightMode(rawTheme);

  const bgCss = colorMode === "light"
    ? transformBackgroundForLightMode(backgroundToCss(state.background))
    : backgroundToCss(state.background);

  const effectiveBorderColor = state.cellBorderColor || rawTheme.borderColor;
  const fontFamily = state.fontFamily || rawTheme.fontFamily;

  // Build items
  const items: TreemapItem[] = [];
  const groupColorMap = new Map<string, string>();
  let colorIdx = 0;

  if (td && td.rows.length > 0) {
    for (const row of td.rows) {
      const label = row[state.labelColumn] ?? "";
      const value = parseNumericValue(row[state.valueColumn] ?? "");
      const group = state.groupColumn >= 0 ? (row[state.groupColumn] ?? "") : "";
      if (value <= 0) continue;

      let color: string;
      if (state.groupColumn >= 0 && group) {
        if (!groupColorMap.has(group)) {
          groupColorMap.set(group, TREEMAP_PALETTE[colorIdx % TREEMAP_PALETTE.length]);
          colorIdx++;
        }
        color = groupColorMap.get(group)!;
      } else {
        color = TREEMAP_PALETTE[colorIdx % TREEMAP_PALETTE.length];
        colorIdx++;
      }

      items.push({ label, value, group, color });
    }
  }

  // Sort descending for squarified algorithm
  const sortedItems = [...items].sort((a, b) => b.value - a.value);
  const totalValue = sortedItems.reduce((s, it) => s + it.value, 0);

  // Determine if we render grouped treemap
  const hasGroups = state.groupColumn >= 0 && groupColorMap.size > 1;

  // Layout constants
  const BASE_W = 800;
  const BASE_H = 500;
  const GROUP_HEADER_H = 24;

  // Build treemap rects
  let treemapRects: TreemapRect[] = [];
  const groupHeaders: GroupHeaderRect[] = [];

  if (hasGroups) {
    // Group items, then allocate space proportionally
    const groups = new Map<string, TreemapItem[]>();
    for (const item of sortedItems) {
      if (!groups.has(item.group)) groups.set(item.group, []);
      groups.get(item.group)!.push(item);
    }

    // Sort groups by total value descending
    const sortedGroups = [...groups.entries()].sort(
      (a, b) => b[1].reduce((s, it) => s + it.value, 0) - a[1].reduce((s, it) => s + it.value, 0)
    );

    // Use squarified to lay out group blocks
    const groupItems: TreemapItem[] = sortedGroups.map(([g, its]) => ({
      label: g,
      value: its.reduce((s, it) => s + it.value, 0),
      group: g,
      color: groupColorMap.get(g) || TREEMAP_PALETTE[0],
    }));

    const groupRects = squarify(groupItems, { x: 0, y: 0, w: BASE_W, h: BASE_H }, state.cellGap);

    for (const gr of groupRects) {
      const groupName = gr.item.label;
      const groupSubItems = groups.get(groupName) || [];

      groupHeaders.push({
        x: gr.x,
        y: gr.y,
        w: gr.w,
        h: GROUP_HEADER_H,
        group: groupName,
      });

      // Sub-area for children
      const subRect = {
        x: gr.x,
        y: gr.y + GROUP_HEADER_H,
        w: gr.w,
        h: Math.max(0, gr.h - GROUP_HEADER_H),
      };

      const subRects = squarify(groupSubItems, subRect, state.cellGap);
      treemapRects.push(...subRects);
    }
  } else {
    treemapRects = squarify(sortedItems, { x: 0, y: 0, w: BASE_W, h: BASE_H }, state.cellGap);
  }

  // ── Render ────────────────────────────────────────────────────────────

  // Slider component inline
  const Slider = ({ label, value, min, max, step, onChange: onSliderChange }: {
    label: string; value: number; min: number; max: number; step?: number;
    onChange: (v: number) => void;
  }) => (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
        {label}: {value}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={(e) => onSliderChange(Number(e.target.value))}
        className="w-full accent-[var(--accent)]"
        style={{ height: 4 }}
      />
    </label>
  );

  // Toggle component inline
  const Toggle = ({ label, checked, onChange: onToggle }: {
    label: string; checked: boolean; onChange: (v: boolean) => void;
  }) => (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div
        className="relative w-8 h-[18px] rounded-full transition-colors"
        style={{ background: checked ? "var(--accent)" : "var(--surface-hover)" }}
        onClick={() => onToggle(!checked)}
      >
        <div
          className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all"
          style={{ left: checked ? "15px" : "2px" }}
        />
      </div>
      <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
    </label>
  );

  // Select component inline
  const Select = ({ label, value, options, onChange: onSelect }: {
    label: string; value: string | number; options: { value: string | number; label: string }[];
    onChange: (v: string) => void;
  }) => (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onSelect(e.target.value)}
        className="px-2 py-1.5 rounded-lg text-xs"
        style={{
          background: "var(--surface)",
          color: "var(--text-primary)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--background)" }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header
        className="shrink-0"
        style={{
          background: "var(--panel-bg)",
          borderBottom: "1px solid var(--panel-border)",
        }}
      >
        <div className="flex items-center justify-between px-3 sm:px-5" style={{ height: "52px" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "var(--accent)", boxShadow: "0 2px 8px rgba(110,86,207,0.3)" }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="8" height="6" rx="1.5" fill="white" opacity="0.9" />
                <rect x="10" y="1" width="5" height="6" rx="1.5" fill="white" opacity="0.6" />
                <rect x="1" y="8" width="5" height="7" rx="1.5" fill="white" opacity="0.6" />
                <rect x="7" y="8" width="4" height="7" rx="1.5" fill="white" opacity="0.45" />
                <rect x="12" y="8" width="3" height="7" rx="1.5" fill="white" opacity="0.3" />
              </svg>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="nav-brand-text font-bold text-sm tracking-tight" style={{ color: "var(--foreground)" }}>
                PastePretty
              </span>
              <span
                className="nav-brand-text text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                style={{ color: "var(--text-muted)", background: "var(--surface)" }}
              >
                Treemap
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 header-actions">
            <button
              onClick={toggleColorMode}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
              style={{
                background: "var(--surface)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-subtle)",
              }}
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
              style={{
                background: "var(--surface)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-subtle)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
            >
              <Upload size={13} />
              <span className="nav-btn-label">Import</span>
            </button>

            <button
              onClick={() => setInputOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: "var(--surface)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-subtle)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
            >
              <FileText size={13} />
              <span className="nav-btn-label">Edit Data</span>
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
                style={{
                  background: "var(--accent)",
                  borderLeft: "1px solid rgba(255,255,255,0.2)",
                }}
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
                document.body
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main: Preview ─────────────────────────────────────────────── */}
      <main
        ref={previewContainerRef}
        className="flex-1 min-h-0 overflow-hidden flex items-center justify-center relative"
        style={{ background: "var(--background)" }}
      >
        <div
          style={{
            transform: `scale(${previewScale})`,
            transformOrigin: "center center",
            transition: "transform 0.2s ease",
          }}
        >
          <div
            ref={canvasRef}
            style={{
              background: bgCss,
              padding: `${state.padding}px`,
              borderRadius: "0px",
              display: "inline-block",
            }}
          >
            <WindowFrame
              style={state.windowStyle}
              title={state.title || "Treemap"}
              borderRadius={state.borderRadius}
              theme={rawTheme}
            >
              <div
                style={{
                  background: rawTheme.rowBg,
                  borderRadius: state.windowStyle === "none" ? `${state.borderRadius}px` : undefined,
                  overflow: "hidden",
                  padding: "16px",
                }}
              >
                {/* Treemap SVG */}
                <svg
                  width={BASE_W}
                  height={BASE_H}
                  viewBox={`0 0 ${BASE_W} ${BASE_H}`}
                  style={{ display: "block", fontFamily }}
                >
                  {/* Group headers */}
                  {groupHeaders.map((gh, i) => (
                    <g key={`gh-${i}`}>
                      <rect
                        x={gh.x}
                        y={gh.y}
                        width={gh.w}
                        height={gh.h}
                        rx={state.cellRadius}
                        fill={groupColorMap.get(gh.group) || TREEMAP_PALETTE[0]}
                        opacity={0.25}
                      />
                      <text
                        x={gh.x + 8}
                        y={gh.y + GROUP_HEADER_H / 2}
                        dominantBaseline="central"
                        fill={rawTheme.headerText}
                        fontSize={11}
                        fontWeight={600}
                        fontFamily={fontFamily}
                      >
                        {gh.group}
                      </text>
                    </g>
                  ))}

                  {/* Treemap cells */}
                  {treemapRects.map((r, i) => {
                    const textColor = textColorForBg(r.item.color);
                    const canShowLabel = r.w > 40 && r.h > 28;
                    const canShowValue = r.w > 50 && r.h > 44;
                    const pct = totalValue > 0 ? ((r.item.value / totalValue) * 100).toFixed(1) : "0";
                    const valueLine = state.showPercentages
                      ? `${r.item.value.toLocaleString()} (${pct}%)`
                      : r.item.value.toLocaleString();

                    // Adjust font size based on rect size
                    const labelFs = Math.min(state.fontSize, r.w / 8, r.h / 4);
                    const valueFs = Math.min(state.fontSize * 0.8, r.w / 10, r.h / 5);

                    return (
                      <g key={i}>
                        <rect
                          x={r.x}
                          y={r.y}
                          width={r.w}
                          height={r.h}
                          rx={state.cellRadius}
                          fill={r.item.color}
                          stroke={effectiveBorderColor}
                          strokeWidth={state.cellBorderWidth}
                        />
                        {canShowLabel && (
                          <text
                            x={r.x + r.w / 2}
                            y={r.y + (canShowValue && state.showValues ? r.h * 0.4 : r.h / 2)}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill={textColor}
                            fontSize={Math.max(9, labelFs)}
                            fontWeight={600}
                            fontFamily={fontFamily}
                            opacity={0.95}
                          >
                            {r.item.label.length > Math.floor(r.w / (labelFs * 0.6))
                              ? r.item.label.slice(0, Math.floor(r.w / (labelFs * 0.6)) - 1) + "\u2026"
                              : r.item.label}
                          </text>
                        )}
                        {canShowValue && state.showValues && (
                          <text
                            x={r.x + r.w / 2}
                            y={r.y + r.h * 0.62}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill={textColor}
                            fontSize={Math.max(8, valueFs)}
                            fontWeight={400}
                            fontFamily={fontFamily}
                            opacity={0.7}
                          >
                            {valueLine}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* No data state */}
                  {treemapRects.length === 0 && (
                    <text
                      x={BASE_W / 2}
                      y={BASE_H / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={rawTheme.rowText}
                      fontSize={16}
                      fontFamily={fontFamily}
                      opacity={0.5}
                    >
                      No data — paste table data with a numeric column
                    </text>
                  )}
                </svg>

                {/* Legend */}
                {state.showLegend && items.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "12px",
                      marginTop: "12px",
                      justifyContent: "center",
                    }}
                  >
                    {(() => {
                      // Unique legend entries
                      const seen = new Set<string>();
                      const entries: { label: string; color: string }[] = [];
                      for (const item of items) {
                        const key = hasGroups ? item.group : item.label;
                        if (!seen.has(key)) {
                          seen.add(key);
                          entries.push({ label: key, color: item.color });
                        }
                      }
                      return entries.map((e) => (
                        <div
                          key={e.label}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <div
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 2,
                              background: e.color,
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontSize: 11,
                              color: rawTheme.rowText,
                              fontFamily,
                              opacity: 0.8,
                            }}
                          >
                            {e.label}
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            </WindowFrame>
          </div>
        </div>
      </main>

      {/* ── Control Panel ─────────────────────────────────────────────── */}
      <div
        className="shrink-0"
        style={{
          background: "var(--panel-bg)",
          borderTop: "1px solid var(--panel-border)",
        }}
      >
        {/* Row 1: Theme, Background, Colors, Font, Size, Title */}
        <div className="sub-control-row px-5 py-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <Select
            label="Theme"
            value={state.themeId}
            options={themes.map((t) => ({ value: t.id, label: t.name }))}
            onChange={(v) => handleChange({ themeId: v })}
          />
          <Select
            label="Background"
            value={(() => {
              const idx = presetBackgrounds.findIndex(
                (p) => backgroundToCss(p.bg) === backgroundToCss(state.background)
              );
              return idx >= 0 ? String(idx) : "custom";
            })()}
            options={[
              ...presetBackgrounds.map((p, i) => ({ value: String(i), label: p.label })),
              { value: "custom", label: "Custom" },
            ]}
            onChange={(v) => {
              const idx = Number(v);
              if (!isNaN(idx) && presetBackgrounds[idx]) {
                handleChange({ background: presetBackgrounds[idx].bg });
              }
            }}
          />
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>Cell Border</span>
            <div className="flex items-center gap-1">
              <input
                type="color"
                value={effectiveBorderColor}
                onChange={(e) => handleChange({ cellBorderColor: e.target.value })}
                className="w-7 h-7 rounded cursor-pointer"
                style={{ border: "1px solid var(--swatch-border)" }}
              />
            </div>
          </label>
          <Select
            label="Font"
            value={state.fontFamily}
            options={FONT_OPTIONS.map((f) => ({ value: f.id, label: f.label }))}
            onChange={(v) => handleChange({ fontFamily: v })}
          />
          <Slider
            label="Font Size"
            value={state.fontSize}
            min={8}
            max={24}
            onChange={(v) => handleChange({ fontSize: v })}
          />
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>Title</span>
            <input
              type="text"
              value={state.title}
              onChange={(e) => handleChange({ title: e.target.value })}
              placeholder="Treemap"
              className="px-2 py-1.5 rounded-lg text-xs w-28"
              style={{
                background: "var(--surface)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
              }}
            />
          </label>
        </div>

        {/* Row 2: Label col, Value col, Group col, Window, Padding */}
        <div className="sub-control-row px-5 py-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <Select
            label="Label Column"
            value={state.labelColumn}
            options={headers.map((h, i) => ({ value: String(i), label: h || `Col ${i + 1}` }))}
            onChange={(v) => handleChange({ labelColumn: Number(v) })}
          />
          <Select
            label="Value Column"
            value={state.valueColumn}
            options={headers.map((h, i) => ({ value: String(i), label: h || `Col ${i + 1}` }))}
            onChange={(v) => handleChange({ valueColumn: Number(v) })}
          />
          <Select
            label="Group Column"
            value={state.groupColumn}
            options={[
              { value: "-1", label: "None" },
              ...headers.map((h, i) => ({ value: String(i), label: h || `Col ${i + 1}` })),
            ]}
            onChange={(v) => handleChange({ groupColumn: Number(v) })}
          />
          <Select
            label="Window"
            value={state.windowStyle}
            options={[
              { value: "mac", label: "macOS" },
              { value: "windows", label: "Windows" },
              { value: "none", label: "None" },
            ]}
            onChange={(v) => handleChange({ windowStyle: v as "mac" | "windows" | "none" })}
          />
          <Slider
            label="Padding"
            value={state.padding}
            min={0}
            max={128}
            step={8}
            onChange={(v) => handleChange({ padding: v })}
          />
          <Slider
            label="Border Radius"
            value={state.borderRadius}
            min={0}
            max={48}
            onChange={(v) => handleChange({ borderRadius: v })}
          />
        </div>

        {/* Row 3: Cell Gap, Cell Radius, Border Width, Toggles */}
        <div className="sub-control-row px-5 py-2">
          <Slider
            label="Cell Gap"
            value={state.cellGap}
            min={0}
            max={6}
            onChange={(v) => handleChange({ cellGap: v })}
          />
          <Slider
            label="Cell Radius"
            value={state.cellRadius}
            min={0}
            max={8}
            onChange={(v) => handleChange({ cellRadius: v })}
          />
          <Slider
            label="Border Width"
            value={state.cellBorderWidth}
            min={0}
            max={4}
            onChange={(v) => handleChange({ cellBorderWidth: v })}
          />
          <Toggle
            label="Show Values"
            checked={state.showValues}
            onChange={(v) => handleChange({ showValues: v })}
          />
          <Toggle
            label="Show Percentages"
            checked={state.showPercentages}
            onChange={(v) => handleChange({ showPercentages: v })}
          />
          <Toggle
            label="Legend"
            checked={state.showLegend}
            onChange={(v) => handleChange({ showLegend: v })}
          />
        </div>
      </div>

      {/* ── Input Drawer ──────────────────────────────────────────────── */}
      {inputOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: "var(--overlay)" }}
            onClick={() => setInputOpen(false)}
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
              <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Table Data</span>
              <button
                onClick={() => setInputOpen(false)}
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
                  onClick={() => {
                    if (fmt.id !== "auto" && state.tableData) {
                      const converted = exportData(state.tableData, fmt.id as ExportFormat, state.title || "treemap");
                      handleChange({ rawInput: converted, inputFormat: fmt.id as TreemapState["inputFormat"] });
                    } else {
                      handleChange({ inputFormat: fmt.id as TreemapState["inputFormat"] });
                    }
                  }}
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
                Paste table data with a label column and a numeric value column. Optionally include a group column for nested hierarchy.
              </p>
            </div>

            <div className="flex-1 px-5 pb-5 pt-1">
              <textarea
                value={state.rawInput}
                onChange={(e) => handleChange({ rawInput: e.target.value })}
                placeholder={`Paste your table data here...\n\nSupported formats:\n• JSON: [{...}, {...}]\n• CSV: col1,col2\\nval1,val2\n• Markdown: | col1 | col2 |\n• PostgreSQL: CREATE TABLE / INSERT INTO`}
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
      )}
    </div>
  );
}
