"use client";

import React, { useCallback, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { AppState } from "@/lib/types";
import { detectAndParse, SAMPLE_MARKDOWN } from "@/lib/parser";
import ControlPanel from "@/components/ControlPanel";
import PreviewCanvas from "@/components/PreviewCanvas";

const DEFAULT_STATE: AppState = {
  rawInput: SAMPLE_MARKDOWN,
  inputFormat: "auto",
  tableData: detectAndParse(SAMPLE_MARKDOWN),
  themeId: "midnight",
  background: {
    type: "gradient",
    gradient: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
  },
  windowStyle: "mac",
  fontSize: 14,
  showGrid: true,
  stripedRows: true,
  title: "",
};

export default function Home() {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleChange = useCallback((patch: Partial<AppState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };

      // Re-parse whenever input or format changes
      if ("rawInput" in patch || "inputFormat" in patch) {
        next.tableData = detectAndParse(next.rawInput);
      }

      return next;
    });
  }, []);

  const handleExport = useCallback(async () => {
    if (!canvasRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(canvasRef.current, {
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `tabula-rasa-${state.themeId}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [state.themeId]);

  return (
    <div className="h-screen flex flex-col bg-[#0a0a10] text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-800/60 bg-[#0f0f14]">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-sm font-bold">
            T
          </div>
          <span className="font-semibold text-sm tracking-tight">tabula-rasa</span>
          <span className="text-xs text-zinc-600 hidden sm:block">
            Beautiful table visualizations
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span>JSON</span>
          <span className="text-zinc-700">·</span>
          <span>Markdown</span>
          <span className="text-zinc-700">·</span>
          <span>12 themes</span>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div className="w-72 flex-shrink-0 border-r border-zinc-800/60 overflow-hidden flex flex-col">
          <ControlPanel
            state={state}
            onChange={handleChange}
            onExport={handleExport}
            exporting={exporting}
          />
        </div>

        {/* Preview */}
        <PreviewCanvas ref={canvasRef} state={state} />
      </div>
    </div>
  );
}
