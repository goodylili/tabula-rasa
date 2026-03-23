"use client";

import React, { useCallback, useRef, useState } from "react";
import { toPng, toJpeg, toSvg } from "html-to-image";
import { AppState } from "@/lib/types";
import { detectAndParse, SAMPLE_MARKDOWN } from "@/lib/parser";
import { exportData, downloadText, ExportFormat } from "@/lib/exporters";
import ControlPanel from "@/components/ControlPanel";
import PreviewCanvas from "@/components/PreviewCanvas";
import InputDrawer from "@/components/InputDrawer";
import { Download, Upload, ChevronDown, Image, FileJson, FileSpreadsheet, FileText, Database } from "lucide-react";

const DEFAULT_STATE: AppState = {
  rawInput: SAMPLE_MARKDOWN,
  inputFormat: "auto",
  tableData: detectAndParse(SAMPLE_MARKDOWN),
  themeId: "candy",
  background: {
    type: "gradient",
    gradient: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
  },
  windowStyle: "mac",
  fontSize: 14,
  showGrid: true,
  stripedRows: true,
  highlightFirstRow: false,
  highlightFirstCol: false,
  borderRadius: 12,
  title: "",
};

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
  const [exporting, setExporting] = useState(false);
  const [inputOpen, setInputOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback((patch: Partial<AppState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
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

        // Auto-detect format from extension
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
      // Reset input so same file can be imported again
      e.target.value = "";
    },
    []
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "hsl(0, 0%, 5%)" }}>
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
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold text-white"
            style={{ background: "var(--accent)" }}
          >
            T
          </div>
          <span className="font-semibold text-sm tracking-tight text-white">tabula-rasa</span>
          <span className="text-xs ml-1" style={{ color: "rgba(255,255,255,0.35)" }}>
            by Goodness
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Import */}
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
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.7)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
          >
            <Upload size={13} />
            Import
          </button>

          {/* Edit Table Data */}
          <button
            onClick={() => setInputOpen(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.7)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
          >
            Edit Data
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportOpen(!exportOpen)}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: "var(--accent)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
            >
              <Download size={14} />
              {exporting ? "Exporting..." : "Export"}
              <ChevronDown size={12} style={{ opacity: 0.6 }} />
            </button>

            {exportOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
                <div
                  className="absolute right-0 top-full mt-2 z-50 rounded-xl overflow-hidden shadow-2xl"
                  style={{
                    background: "hsl(0,0%,12%)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    minWidth: "180px",
                  }}
                >
                  {EXPORT_FORMATS.map((fmt) => (
                    <button
                      key={fmt.id}
                      onClick={() => handleExport(fmt.id)}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs transition-colors text-left"
                      style={{ color: "rgba(255,255,255,0.8)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span style={{ opacity: 0.6 }}>{fmt.icon}</span>
                      {fmt.label}
                      <span className="ml-auto" style={{ color: "rgba(255,255,255,0.3)", fontSize: "10px" }}>
                        .{fmt.ext}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Center — Preview area */}
      <main className="flex-1 overflow-auto flex items-center justify-center relative">
        <PreviewCanvas ref={canvasRef} state={state} exporting={exporting} />
      </main>

      {/* Bottom — Floating Control Panel */}
      <ControlPanel state={state} onChange={handleChange} />

      {/* Input Drawer */}
      <InputDrawer
        open={inputOpen}
        onClose={() => setInputOpen(false)}
        state={state}
        onChange={handleChange}
      />
    </div>
  );
}
