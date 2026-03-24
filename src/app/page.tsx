"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toPng, toJpeg, toSvg } from "html-to-image";
import { AppState } from "@/lib/types";
import { detectAndParse, SAMPLE_MARKDOWN } from "@/lib/parser";
import { exportData, downloadText, ExportFormat } from "@/lib/exporters";
import { getTheme } from "@/lib/themes";
import ControlPanel from "@/components/ControlPanel";
import PreviewCanvas from "@/components/PreviewCanvas";
import InputDrawer from "@/components/InputDrawer";
import { Download, Upload, ChevronDown, Image, FileJson, FileSpreadsheet, FileText, Database, Sun, Moon } from "lucide-react";

const STORAGE_KEY = "tabula-rasa-state";

const DEFAULT_STATE: AppState = {
  rawInput: SAMPLE_MARKDOWN,
  inputFormat: "auto",
  tableData: detectAndParse(SAMPLE_MARKDOWN),
  themeId: "candy",
  background: {
    type: "gradient",
    gradient: "linear-gradient(140deg, #A58EFB, #E9BFF8)",
  },
  windowStyle: "mac",
  fontSize: 14,
  showGrid: true,
  stripedRows: true,
  highlightFirstRow: false,
  highlightFirstCol: false,
  showRowNumbers: false,
  borderRadius: 12,
  padding: 48,
  fontFamily: "",
  customHeaderBg: "",
  customHeaderText: "",
  customRowBg: "",
  customAltRowBg: "",
  customRowText: "",
  customBorderColor: "",
  title: "",
};

function loadState(): AppState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Re-parse table data from raw input
      parsed.tableData = detectAndParse(parsed.rawInput, parsed.inputFormat === "auto" ? undefined : parsed.inputFormat);
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
    const saved = localStorage.getItem("tabula-rasa-color-mode");
    if (saved === "light" || saved === "dark") {
      setColorMode(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  const toggleColorMode = useCallback(() => {
    setColorMode((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("tabula-rasa-color-mode", next);
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
      }

      if ("rawInput" in patch || "inputFormat" in patch) {
        next.tableData = detectAndParse(next.rawInput, next.inputFormat === "auto" ? undefined : next.inputFormat);
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
      link.download = `tabula-rasa-${state.themeId}.${imgFormat}`;
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
      downloadText(content, `tabula-rasa.${ext}`);
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
      {/* Top Nav Bar */}
      <nav
        className="flex items-center justify-between px-5 shrink-0"
        style={{
          height: "50px",
          background: "var(--panel-bg)",
          borderBottom: "1px solid var(--panel-border)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0"
            style={{ background: "var(--accent)" }}
          >
            T
          </div>
          <span className="font-semibold text-sm tracking-tight nav-brand-text" style={{ color: "var(--foreground)" }}>tabula-rasa</span>
          <span className="text-xs ml-1 nav-brand-text" style={{ color: "var(--text-subtle)" }}>
            by Goodness
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Light/Dark toggle */}
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
              border: "1px solid var(--border)",
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
              border: "1px solid var(--border)",
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
                  className="rounded-xl overflow-hidden shadow-2xl"
                  style={{
                    position: "fixed",
                    top: exportBtnRef.current ? exportBtnRef.current.getBoundingClientRect().bottom + 8 : 0,
                    right: exportBtnRef.current ? window.innerWidth - exportBtnRef.current.getBoundingClientRect().right : 0,
                    zIndex: 9999,
                    background: "var(--elevated-bg)",
                    border: "1px solid var(--border)",
                    minWidth: "180px",
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
      </nav>

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
