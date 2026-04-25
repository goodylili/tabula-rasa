"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { toPng, toJpeg, toSvg } from "html-to-image";
import { AppState, VisualizationMode } from "@/lib/types";
import { detectAndParse, SAMPLE_MARKDOWN, SAMPLE_CHART_MARKDOWN } from "@/lib/parser";
import { sanitizeFilename } from "@/lib/exporters";
import { getTheme } from "@/lib/themes";
import ControlPanel from "@/components/ControlPanel";
import PreviewCanvas from "@/components/PreviewCanvas";
import InputDrawer from "@/components/InputDrawer";
import { Sun, Moon, X } from "lucide-react";

const STORAGE_KEY = "pastepretty-state";

const DEFAULT_STATE: AppState = {
  rawInput: SAMPLE_MARKDOWN,
  inputFormat: "auto",
  tableData: detectAndParse(SAMPLE_MARKDOWN),
  themeId: "vercel",
  background: { type: "none" },
  windowStyle: "mac",
  fontSize: 14,
  showGrid: true,
  showColumnLines: false,
  stripedRows: false,
  highlightFirstRow: false,
  highlightFirstCol: true,
  showRowNumbers: true,
  borderRadius: 14,
  vizBorderRadius: 12,
  padding: 24,
  fontFamily: "",
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
    bar: { orientation: "vertical", barStyle: "grouped", barRadius: 3, barGap: 2 },
    line: { curveType: "smooth", showArea: true, showDots: true, lineWidth: 2.5 },
    pie: { innerRadius: 50, labelPosition: "outside", sortSlices: false, startAngle: 0 },
    customColors: {},
  },
};

function loadState(): AppState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      parsed.tableData = detectAndParse(
        parsed.rawInput,
        parsed.inputFormat === "auto" ? undefined : parsed.inputFormat
      );
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

const VIZ_TABS: { mode: VisualizationMode; label: string }[] = [
  { mode: "table", label: "Table" },
  { mode: "bar", label: "Bar" },
  { mode: "line", label: "Line" },
  { mode: "pie", label: "Pie" },
];

export default function Home() {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [inputOpen, setInputOpen] = useState(false);
  const [colorMode, setColorMode] = useState<"dark" | "light">("dark");
  const [sheetOpen, setSheetOpen] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

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

  const toggleColorMode = useCallback(() => {
    setColorMode((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("pastepretty-color-mode", next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setInterval(() => {
      try {
        const toSave = { ...state } as Record<string, unknown>;
        delete toSave.tableData;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } catch {}
    }, 1000);
    return () => clearInterval(timer);
  }, [state, hydrated]);

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (sheetOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sheetOpen]);

  const handleChange = useCallback((patch: Partial<AppState>) => {
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
        next.chartConfig = { ...next.chartConfig, customColors: {} };
      }

      if ("rawInput" in patch || "inputFormat" in patch) {
        next.tableData = detectAndParse(
          next.rawInput,
          next.inputFormat === "auto" ? undefined : next.inputFormat
        );
      }

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
            next.rawInput = SAMPLE_CHART_MARKDOWN;
            next.tableData = detectAndParse(SAMPLE_CHART_MARKDOWN);
            next.chartConfig = {
              ...next.chartConfig,
              labelColumn: 0,
              valueColumns: [1, 2, 3],
              showLegend: true,
              showValues: true,
            };
          } else {
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

  const handleExport = useCallback(
    async (imgFormat: "png" | "jpg" | "svg" = "png") => {
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
        link.download = `${sanitizeFilename(state.title, "pastepretty")}.${imgFormat}`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error("Export failed:", err);
      } finally {
        setExporting(false);
      }
    },
    [state.title]
  );

  const handleCellEdit = useCallback((rowIndex: number, colIndex: number, value: string) => {
    setState((prev) => {
      if (!prev.tableData) return prev;
      const newRows = prev.tableData.rows.map((r) => [...r]);
      newRows[rowIndex][colIndex] = value;
      return { ...prev, tableData: { ...prev.tableData, rows: newRows } };
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

  const isTransparent = state.background.type === "none";
  const toggleTransparent = () => {
    if (isTransparent) {
      const t = getTheme(state.themeId);
      handleChange({ background: { type: "gradient", gradient: t.defaultBg } });
    } else {
      handleChange({ background: { type: "none" } });
    }
  };

  const tabs = (
    <div className="viz-tabs" role="tablist" aria-label="Visualization mode">
      {VIZ_TABS.map((t) => (
        <button
          key={t.mode}
          role="tab"
          aria-selected={state.vizMode === t.mode}
          data-active={state.vizMode === t.mode}
          className="viz-tab"
          onClick={() => handleChange({ vizMode: t.mode })}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-left">
          <span className="brand-mark">
            <span className="brand-logomark" aria-hidden />
            <span className="brand-org">goodylili</span>
            <span className="brand-slash">/</span>
            <span className="brand-name">pastepretty</span>
            <span className="brand-version">V1</span>
          </span>
        </div>

        <div className="app-header-center">{tabs}</div>

        <div className="app-header-right">
          <button
            className="icon-btn"
            onClick={toggleColorMode}
            aria-label={colorMode === "dark" ? "Switch to light" : "Switch to dark"}
          >
            {colorMode === "dark" ? <Sun size={14} strokeWidth={2} /> : <Moon size={14} strokeWidth={2} />}
          </button>
        </div>
      </header>

      <div className="app-header-tabs-mobile">{tabs}</div>

      <div className="app-body">
        <aside className="app-sidebar">
          <ControlPanel state={state} onChange={handleChange} />
        </aside>

        <main className="app-canvas">
          <div className="page-indicator" aria-hidden>
            <span className="current">01</span>
            <span>/</span>
            <span>01</span>
          </div>

          <PreviewCanvas
            ref={canvasRef}
            state={state}
            exporting={exporting}
            colorMode={colorMode}
            onCellEdit={handleCellEdit}
            onHeaderEdit={handleHeaderEdit}
          />

          <div className="float-pill" role="toolbar" aria-label="Export controls">
            <button
              type="button"
              className="pill-btn"
              onClick={toggleTransparent}
              aria-pressed={isTransparent}
              title="Toggle transparent background"
            >
              <span
                aria-hidden
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  border: "1px solid currentColor",
                  display: "inline-block",
                  background: isTransparent ? "currentColor" : "transparent",
                }}
              />
              <span className="pill-label-md">Transparent</span>
            </button>

            <button
              type="button"
              className="pill-btn"
              onClick={() => setInputOpen(true)}
              title="Edit data"
            >
              <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>+</span>
              <span className="pill-label-md">Data</span>
            </button>

            <button
              type="button"
              className="pill-btn pill-primary"
              onClick={() => handleExport("png")}
              disabled={exporting}
            >
              {exporting ? "Exporting…" : "Export"}
            </button>
          </div>
        </main>
      </div>

      {/* Mobile customize trigger */}
      <button
        type="button"
        className="sheet-trigger"
        onClick={() => setSheetOpen(true)}
        aria-label="Customize"
      >
        Customize
      </button>

      {/* Mobile bottom sheet */}
      <div
        className="sheet-backdrop"
        data-open={sheetOpen}
        onClick={() => setSheetOpen(false)}
        aria-hidden
      />
      <div
        className="sheet"
        data-open={sheetOpen}
        role="dialog"
        aria-modal="true"
        aria-label="Customize"
      >
        <div className="sheet-handle" aria-hidden />
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 16px" }}>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setSheetOpen(false)}
            aria-label="Close"
            style={{ width: 28, height: 28, border: 0 }}
          >
            <X size={14} />
          </button>
        </div>
        <div className="sheet-body">
          <ControlPanel state={state} onChange={handleChange} />
        </div>
      </div>

      <InputDrawer
        open={inputOpen}
        onClose={() => setInputOpen(false)}
        state={state}
        onChange={handleChange}
      />

      <style jsx>{`
        @media (max-width: 480px) {
          :global(.pill-label-md) { display: none; }
        }
      `}</style>
    </div>
  );
}
