"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toPng, toJpeg, toSvg } from "html-to-image";
import { AppState } from "@/lib/types";
import { detectAndParse, SAMPLE_MARKDOWN, SAMPLE_CHART_MARKDOWN } from "@/lib/parser";
import { exportData, downloadText, ExportFormat } from "@/lib/exporters";
import { getTheme } from "@/lib/themes";
import ControlPanel from "@/components/ControlPanel";
import PreviewCanvas from "@/components/PreviewCanvas";
import InputDrawer from "@/components/InputDrawer";
import { Download, Upload, ChevronDown, Image, FileJson, FileSpreadsheet, FileText, Database, Sun, Moon, Table, BarChart3, LineChart, PieChart } from "lucide-react";
import { VisualizationMode } from "@/lib/types";

const STORAGE_KEY = "pastepretty-state";

const DEFAULT_STATE: AppState = {
  rawInput: SAMPLE_MARKDOWN,
  inputFormat: "auto",
  tableData: detectAndParse(SAMPLE_MARKDOWN),
  themeId: "vercel",
  background: {
    type: "none",
  },
  windowStyle: "mac",
  fontSize: 18,
  showGrid: true,
  stripedRows: true,
  highlightFirstRow: true,
  highlightFirstCol: true,
  showRowNumbers: true,
  borderRadius: 32,
  vizBorderRadius: 12,
  padding: 64,
  fontFamily: "'Noto Sans Mono', monospace",
  customHeaderBg: "",
  customHeaderText: "",
  customRowBg: "",
  customAltRowBg: "",
  customRowText: "",
  customBorderColor: "",
  title: "",
  vizMode: "table",
  chartConfig: {
    labelColumn: 0,
    valueColumns: [1],
    showLegend: true,
    showValues: true,
    bar: {
      orientation: "vertical",
      barStyle: "grouped",
      barRadius: 3,
      barGap: 2,
    },
    line: {
      curveType: "smooth",
      showArea: true,
      showDots: true,
      lineWidth: 2.5,
    },
    pie: {
      innerRadius: 50,
      labelPosition: "outside",
      sortSlices: false,
      startAngle: 0,
    },
    customColors: {},
  },
};

function loadState(): AppState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Re-parse table data from raw input
      parsed.tableData = detectAndParse(parsed.rawInput, parsed.inputFormat === "auto" ? undefined : parsed.inputFormat);
      // Deep-merge chartConfig so new sub-configs (bar/line/pie) get defaults
      if (parsed.chartConfig) {
        parsed.chartConfig = {
          ...DEFAULT_STATE.chartConfig,
          ...parsed.chartConfig,
          bar: { ...DEFAULT_STATE.chartConfig.bar, ...parsed.chartConfig.bar },
          line: { ...DEFAULT_STATE.chartConfig.line, ...parsed.chartConfig.line },
          pie: { ...DEFAULT_STATE.chartConfig.pie, ...parsed.chartConfig.pie },
        };
      }
      return { ...DEFAULT_STATE, ...parsed };
    }
  } catch {}
  return DEFAULT_STATE;
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

export default function Home() {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [inputOpen, setInputOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [controlsCollapsed, setControlsCollapsed] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [colorMode, setColorMode] = useState<"dark" | "light">("dark");
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const exportBtnRef = useRef<HTMLButtonElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  // Track mobile breakpoint
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    handler(mql);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Load color mode preference
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

  // Auto-save to localStorage every second
  useEffect(() => {
    if (!hydrated) return;
    const timer = setInterval(() => {
      try {
        const toSave = { ...state };
        delete (toSave as Record<string, unknown>).tableData; // Don't save parsed data
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } catch {}
    }, 1000);
    return () => clearInterval(timer);
  }, [state, hydrated]);

  const handleChange = useCallback((patch: Partial<AppState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };

      // When theme changes, reset background and custom colors
      if ("themeId" in patch && patch.themeId !== prev.themeId) {
        const newTheme = getTheme(patch.themeId!);
        next.background = { type: "gradient", gradient: newTheme.defaultBg };
        next.customHeaderBg = "";
        next.customHeaderText = "";
        next.customRowBg = "";
        next.customAltRowBg = "";
        next.customRowText = "";
        next.customBorderColor = "";
        next.chartConfig = { ...next.chartConfig, customColors: {} };
      }

      if ("rawInput" in patch || "inputFormat" in patch) {
        next.tableData = detectAndParse(next.rawInput, next.inputFormat === "auto" ? undefined : next.inputFormat);
      }

      // When switching to a chart mode, check if data has numeric columns
      if ("vizMode" in patch && patch.vizMode !== "table" && prev.vizMode === "table") {
        const td = next.tableData;
        if (td) {
          const hasNumeric = td.headers.some((_, ci) =>
            td.rows.some((row) => {
              const cleaned = (row[ci] || "").replace(/[,$%]/g, "").trim();
              return cleaned !== "" && !isNaN(Number(cleaned));
            })
          );
          if (!hasNumeric) {
            // Swap to chart-friendly sample data
            next.rawInput = SAMPLE_CHART_MARKDOWN;
            next.tableData = detectAndParse(SAMPLE_CHART_MARKDOWN);
            next.chartConfig = { ...next.chartConfig, labelColumn: 0, valueColumns: [1, 2, 3], showLegend: true, showValues: true };
          } else {
            // Auto-select: first non-numeric col as label, numeric cols as values
            const numericCols = td.headers
              .map((_, ci) => ci)
              .filter((ci) =>
                td.rows.some((row) => {
                  const cleaned = (row[ci] || "").replace(/[,$%]/g, "").trim();
                  return cleaned !== "" && !isNaN(Number(cleaned));
                })
              );
            const labelCol = td.headers.findIndex((_, ci) => !numericCols.includes(ci));
            next.chartConfig = {
              ...next.chartConfig,
              labelColumn: labelCol >= 0 ? labelCol : 0,
              valueColumns: numericCols.length > 0 ? numericCols : [1],
            };
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
      link.download = `pastepretty-${state.themeId}.${imgFormat}`;
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
      const content = exportData(state.tableData, format, state.title || "my_table");
      const ext = EXPORT_FORMATS.find((f) => f.id === format)?.ext ?? "txt";
      downloadText(content, `pastepretty.${ext}`);
    },
    [handleExportImage, state.tableData, state.title]
  );

  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
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
    },
    []
  );

  // Handle inline cell edits from the table
  const handleCellEdit = useCallback((rowIndex: number, colIndex: number, value: string) => {
    setState((prev) => {
      if (!prev.tableData) return prev;
      const newRows = prev.tableData.rows.map((r) => [...r]);
      newRows[rowIndex][colIndex] = value;
      const newData = { ...prev.tableData, rows: newRows };
      // Rebuild rawInput from the edited data
      const exportData2 = (await_import: typeof import("@/lib/exporters")) => exportData;
      void exportData2;
      return { ...prev, tableData: newData };
    });
  }, []);

  const handleHeaderEdit = useCallback((colIndex: number, value: string) => {
    setState((prev) => {
      if (!prev.tableData) return prev;
      const newHeaders = [...prev.tableData.headers];
      newHeaders[colIndex] = value;
      return { ...prev, tableData: { ...prev.tableData, headers: newHeaders } };
    });
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--background)" }}>
      {/* Header */}
      <header
        className="shrink-0"
        style={{
          background: "var(--panel-bg)",
          borderBottom: "1px solid var(--panel-border)",
        }}
      >
        {/* Top row: Brand + Actions */}
        <div
          className="flex items-center justify-between px-5"
          style={{ height: "52px" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: "var(--accent)",
                boxShadow: "0 2px 8px rgba(110,86,207,0.3)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="6" height="4" rx="1" fill="white" opacity="0.9" />
                <rect x="9" y="1" width="6" height="4" rx="1" fill="white" opacity="0.6" />
                <rect x="1" y="7" width="6" height="4" rx="1" fill="white" opacity="0.6" />
                <rect x="9" y="7" width="6" height="4" rx="1" fill="white" opacity="0.4" />
                <rect x="1" y="12" width="14" height="3" rx="1" fill="white" opacity="0.3" />
              </svg>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-sm tracking-tight nav-brand-text" style={{ color: "var(--foreground)" }}>
                PastePretty
              </span>
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-md nav-brand-text"
                style={{
                  color: "var(--text-muted)",
                  background: "var(--surface)",
                }}
              >
                by Goodness
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 header-actions">
            {/* Light/Dark toggle */}
            <button
              onClick={toggleColorMode}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-all shrink-0"
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
              title="Import file"
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
              title="Edit table data"
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
                      backdropFilter: "none",
                      WebkitBackdropFilter: "none",
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

        {/* Visualization mode tabs */}
        <div
          className="flex items-center gap-1 px-5 pb-2 viz-tabs"
        >
          {([
            { mode: "table" as VisualizationMode, icon: <Table size={13} />, label: "Table" },
            { mode: "bar" as VisualizationMode, icon: <BarChart3 size={13} />, label: "Bar Chart" },
            { mode: "line" as VisualizationMode, icon: <LineChart size={13} />, label: "Line Chart" },
            { mode: "pie" as VisualizationMode, icon: <PieChart size={13} />, label: "Pie Chart" },
          ]).map(({ mode, icon, label }) => (
            <button
              key={mode}
              onClick={() => handleChange({ vizMode: mode })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: state.vizMode === mode ? "var(--accent)" : "transparent",
                color: state.vizMode === mode ? "white" : "var(--text-muted)",
              }}
              onMouseEnter={(e) => {
                if (state.vizMode !== mode) e.currentTarget.style.background = "var(--surface)";
              }}
              onMouseLeave={(e) => {
                if (state.vizMode !== mode) e.currentTarget.style.background = "transparent";
              }}
            >
              {icon}
              <span className="nav-btn-label">{label}</span>
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden flex relative">
        <PreviewCanvas
          ref={canvasRef}
          state={state}
          exporting={exporting}
          colorMode={colorMode}
          onCellEdit={handleCellEdit}
          onHeaderEdit={handleHeaderEdit}
        />
      </main>

      <ControlPanel
        state={state}
        onChange={handleChange}
        collapsed={isMobile ? controlsCollapsed : undefined}
        onToggleCollapse={isMobile ? () => setControlsCollapsed((c) => !c) : undefined}
      />

      <InputDrawer
        open={inputOpen}
        onClose={() => setInputOpen(false)}
        state={state}
        onChange={handleChange}
      />
    </div>
  );
}
