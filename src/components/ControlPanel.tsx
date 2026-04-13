"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { AppState, Background, ChartConfig, BarChartConfig, LineChartConfig, PieChartConfig } from "@/lib/types";
import { themes, getTheme } from "@/lib/themes";
import { presetBackgrounds } from "@/lib/backgrounds";
import { FONT_OPTIONS } from "@/lib/fonts";
import { ChevronDown, Upload } from "lucide-react";
import { generateChartColors } from "./ChartRenderer";

interface ControlPanelProps {
  state: AppState;
  onChange: (patch: Partial<AppState>) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

function ControlLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[11px] font-medium mb-1.5 select-none"
      style={{ color: "var(--text-faint)" }}
    >
      {children}
    </div>
  );
}

function ControlGroup({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col shrink-0">
      <ControlLabel>{label}</ControlLabel>
      <div className="flex items-center" style={{ height: "28px" }}>
        {children}
      </div>
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="relative rounded-full transition-colors"
      style={{
        width: "36px",
        height: "20px",
        background: on ? "var(--accent)" : "var(--border)",
      }}
    >
      <div
        className="absolute top-[2px] w-4 h-4 rounded-full bg-white transition-all"
        style={{ left: on ? "18px" : "2px" }}
      />
    </button>
  );
}

function usePortalPosition(triggerRef: React.RefObject<HTMLElement | null>, open: boolean) {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const update = useCallback(() => {
    if (!triggerRef.current || !open) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceAbove > spaceBelow) {
      setPos({ top: rect.top - 8, left: rect.left });
    } else {
      setPos({ top: rect.bottom + 8, left: rect.left });
    }
  }, [triggerRef, open]);

  useEffect(() => {
    update();
    if (!open) return;
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, update]);

  return pos;
}

function Dropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: string; label: string; group?: string; extra?: React.ReactNode }[];
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((o) => o.id === value);

  // Group options
  const groups: { name: string; items: typeof options }[] = [];
  let currentGroup: string | null = null;
  for (const opt of options) {
    const g = opt.group ?? "";
    if (g !== currentGroup || groups.length === 0) {
      groups.push({ name: g, items: [] });
      currentGroup = g;
    }
    groups[groups.length - 1].items.push(opt);
  }

  // Calculate portal position
  const getMenuStyle = (): React.CSSProperties => {
    if (!triggerRef.current) return {};
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuMaxH = 340;

    if (spaceAbove > spaceBelow) {
      // Open upward
      const availH = Math.min(menuMaxH, spaceAbove - 16);
      return {
        position: "fixed",
        bottom: window.innerHeight - rect.top + 8,
        left: rect.left,
        maxHeight: `${availH}px`,
      };
    } else {
      // Open downward
      const availH = Math.min(menuMaxH, spaceBelow - 16);
      return {
        position: "fixed",
        top: rect.bottom + 8,
        left: rect.left,
        maxHeight: `${availH}px`,
      };
    }
  };

  return (
    <div>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 rounded-lg text-xs font-medium transition-all"
        style={{
          height: "28px",
          background: "var(--surface)",
          color: "var(--text-primary)",
          border: "1px solid var(--border-subtle)",
          minWidth: "100px",
        }}
      >
        {selected?.extra}
        <span className="flex-1 text-left truncate">{selected?.label}</span>
        <ChevronDown size={12} style={{ opacity: 0.5 }} />
      </button>

      {open && createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setOpen(false)} />
          <div
            className="rounded-xl overflow-hidden"
            style={{
              ...getMenuStyle(),
              zIndex: 9999,
              background: "var(--elevated-bg)",
              border: "1px solid var(--border)",
              overflowY: "auto",
              minWidth: "200px",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
              backdropFilter: "none",
              WebkitBackdropFilter: "none",
            }}
          >
            {groups.map((group) => (
              <div key={group.name}>
                {group.name && (
                  <div
                    className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text-subtle)" }}
                  >
                    {group.name}
                  </div>
                )}
                {group.items.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      onChange(opt.id);
                      setOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors text-left"
                    style={{
                      color: value === opt.id ? "var(--foreground)" : "var(--text-secondary)",
                      background: value === opt.id ? "var(--surface-active)" : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (value !== opt.id) e.currentTarget.style.background = "var(--surface)";
                    }}
                    onMouseLeave={(e) => {
                      if (value !== opt.id) e.currentTarget.style.background = value === opt.id ? "var(--surface-active)" : "transparent";
                    }}
                  >
                    {opt.extra}
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

function SegmentToggle({
  values,
  labels,
  active,
  onChange,
}: {
  values: string[];
  labels?: string[];
  active: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      className="flex rounded-lg overflow-hidden"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      {values.map((v, i) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className="px-2.5 text-xs font-medium transition-all"
          style={{
            height: "28px",
            background: active === v ? "var(--accent)" : "transparent",
            color: active === v ? "white" : "var(--text-muted)",
          }}
        >
          {labels ? labels[i] : v}
        </button>
      ))}
    </div>
  );
}

function Divider() {
  return <div className="self-stretch w-px my-1 shrink-0 hidden sm:block" style={{ background: "var(--border-subtle)" }} />;
}

function ColorSwatch({
  label,
  value,
  fallback,
  onChangeColor,
}: {
  label: string;
  value: string;
  fallback: string;
  onChangeColor: (color: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const display = value || fallback;
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => ref.current?.click()}
        className="w-6 h-6 rounded shrink-0"
        style={{ background: display, border: "1px solid var(--border-strong)" }}
        title={label}
      />
      <input
        ref={ref}
        type="color"
        value={display.startsWith("#") ? display : "#888888"}
        onChange={(e) => onChangeColor(e.target.value)}
        className="sr-only"
      />
      <span className="text-[10px] truncate flex-1" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
    </div>
  );
}

function ColorPopover({
  state,
  onChange,
  theme,
}: {
  state: AppState;
  onChange: (patch: Partial<AppState>) => void;
  theme: ReturnType<typeof getTheme>;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const isTable = state.vizMode === "table";
  const isChart = !isTable;
  const custom = state.chartConfig.customColors || {};

  // Build chart color slots dynamically from data
  const chartSlots: { key: string; label: string; fallback: string }[] = [];
  if (isChart && state.tableData) {
    const autoColors = generateChartColors(theme, Math.max(
      state.chartConfig.valueColumns.length,
      state.tableData.rows.length
    ));
    if (state.vizMode === "pie") {
      state.tableData.rows.forEach((row, i) => {
        const label = row[state.chartConfig.labelColumn] || `Row ${i + 1}`;
        chartSlots.push({ key: label, label, fallback: autoColors[i] || "#888" });
      });
    } else {
      state.chartConfig.valueColumns.forEach((colIdx, i) => {
        const name = state.tableData!.headers[colIdx] || `Column ${colIdx + 1}`;
        chartSlots.push({ key: name, label: name, fallback: autoColors[i] || "#888" });
      });
    }
  }

  const hasTableCustom = state.customHeaderBg || state.customHeaderText || state.customRowBg ||
    state.customAltRowBg || state.customRowText || state.customBorderColor;
  const hasChartCustom = Object.keys(custom).length > 0;
  const hasCustom = isTable ? hasTableCustom : hasChartCustom;

  // Preview dots: first 3 relevant colors
  const previewColors = isTable
    ? [
        state.customHeaderBg || theme.accentBg,
        state.customRowBg || theme.rowBg,
        state.customRowText || theme.rowText,
      ]
    : chartSlots.slice(0, 3).map((s) => custom[s.key] || s.fallback);

  const setChartColor = (key: string, color: string) => {
    onChange({
      chartConfig: {
        ...state.chartConfig,
        customColors: { ...custom, [key]: color },
      },
    });
  };

  const resetChartColors = () => {
    onChange({
      chartConfig: { ...state.chartConfig, customColors: {} },
    });
  };

  const getPopoverStyle = (): React.CSSProperties => {
    if (!triggerRef.current) return {};
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const popoverW = 220;
    const left = Math.min(rect.right - popoverW, Math.max(8, rect.left));

    if (spaceAbove > spaceBelow) {
      return { position: "fixed", bottom: window.innerHeight - rect.top + 8, left, width: `${popoverW}px` };
    } else {
      return { position: "fixed", top: rect.bottom + 8, left, width: `${popoverW}px` };
    }
  };

  const popoverTitle = isTable
    ? "Table Colors"
    : state.vizMode === "pie"
      ? "Slice Colors"
      : "Series Colors";

  return (
    <div>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 rounded-lg text-xs font-medium transition-all"
        style={{
          height: "28px",
          background: "var(--surface)",
          color: hasCustom ? "var(--foreground)" : "var(--text-muted)",
          border: `1px solid ${hasCustom ? "var(--accent)" : "var(--border-subtle)"}`,
        }}
      >
        <div className="flex -space-x-1">
          {previewColors.map((c, i) => (
            <div key={i} className="w-3 h-3 rounded-full" style={{ background: c, border: "1px solid var(--swatch-border)" }} />
          ))}
        </div>
        Customize
      </button>

      {open && createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setOpen(false)} />
          <div
            className="rounded-xl p-4"
            style={{
              ...getPopoverStyle(),
              zIndex: 9999,
              background: "var(--elevated-bg)",
              border: "1px solid var(--border)",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
              backdropFilter: "none",
              WebkitBackdropFilter: "none",
            }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-subtle)" }}>
              {popoverTitle}
            </div>

            {isTable ? (
              <div className="flex flex-col gap-2.5">
                <ColorSwatch label="Header bg" value={state.customHeaderBg} fallback={theme.accentBg} onChangeColor={(c) => onChange({ customHeaderBg: c })} />
                <ColorSwatch label="Header text" value={state.customHeaderText} fallback={theme.accentText} onChangeColor={(c) => onChange({ customHeaderText: c })} />
                <ColorSwatch label="Row bg" value={state.customRowBg} fallback={theme.rowBg} onChangeColor={(c) => onChange({ customRowBg: c })} />
                <ColorSwatch label="Alt row bg" value={state.customAltRowBg} fallback={theme.altRowBg} onChangeColor={(c) => onChange({ customAltRowBg: c })} />
                <ColorSwatch label="Text color" value={state.customRowText} fallback={theme.rowText} onChangeColor={(c) => onChange({ customRowText: c })} />
                <ColorSwatch label="Border" value={state.customBorderColor} fallback={theme.borderColor} onChangeColor={(c) => onChange({ customBorderColor: c })} />
              </div>
            ) : (
              <div className="flex flex-col gap-2.5" style={{ maxHeight: "280px", overflowY: "auto" }}>
                {chartSlots.map((slot) => (
                  <ColorSwatch
                    key={slot.key}
                    label={slot.label}
                    value={custom[slot.key] || ""}
                    fallback={slot.fallback}
                    onChangeColor={(c) => setChartColor(slot.key, c)}
                  />
                ))}
              </div>
            )}

            {hasCustom && (
              <button
                onClick={() => {
                  if (isTable) {
                    onChange({
                      customHeaderBg: "", customHeaderText: "", customRowBg: "",
                      customAltRowBg: "", customRowText: "", customBorderColor: "",
                    });
                  } else {
                    resetChartColors();
                  }
                }}
                className="w-full mt-3 py-1.5 rounded-lg text-[10px] font-medium transition-all"
                style={{ background: "var(--surface)", color: "var(--text-muted)" }}
              >
                Reset to defaults
              </button>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

export default function ControlPanel({ state, onChange, collapsed, onToggleCollapse }: ControlPanelProps) {
  const colorRef = useRef<HTMLInputElement>(null);
  const bgImageRef = useRef<HTMLInputElement>(null);
  const currentTheme = getTheme(state.themeId);

  const setBackground = (bg: Background) => onChange({ background: bg });

  const handleBgImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setBackground({ type: "image", imageUrl: dataUrl });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const themeOptions = themes.map((t) => ({
    id: t.id,
    label: t.name,
    group: t.group,
    extra: (
      <div
        className="w-5 h-3.5 rounded-sm shrink-0"
        style={{
          background: t.headerBg,
          border: "1px solid var(--border)",
        }}
      />
    ),
  }));

  const bgOptions = presetBackgrounds.map(({ label, bg }) => ({
    id: label,
    label,
    extra: (
      <div
        className="w-5 h-3.5 rounded-sm shrink-0"
        style={{
          background:
            bg.type === "none"
              ? "repeating-conic-gradient(#555 0% 25%, #333 0% 50%) 0 0 / 8px 8px"
              : bg.type === "gradient"
              ? bg.gradient
              : bg.color,
          border: "1px solid var(--border)",
        }}
      />
    ),
  }));

  const currentBgLabel =
    state.background.type === "image"
      ? "Image"
      : presetBackgrounds.find(
          (p) => JSON.stringify(p.bg) === JSON.stringify(state.background)
        )?.label ?? "Custom";

  // Build column options for chart config dropdowns
  const columnOptions = state.tableData
    ? state.tableData.headers.map((h, i) => ({ id: String(i), label: h || `Column ${i + 1}` }))
    : [];

  const updateChartConfig = (patch: Partial<ChartConfig>) => {
    onChange({ chartConfig: { ...state.chartConfig, ...patch } });
  };

  // Find numeric columns for auto-selection hint
  const numericColumns = state.tableData
    ? state.tableData.headers.map((_, i) => i).filter((i) =>
        state.tableData!.rows.some((row) => {
          const cleaned = (row[i] || "").replace(/[,$%]/g, "").trim();
          return cleaned !== "" && !isNaN(Number(cleaned));
        })
      )
    : [];

  const panelContent = (
    <div className="control-panel-rows">
      {/* Row 1: Appearance — the most-used controls */}
      <div className="control-row">
        <ControlGroup label="Theme">
          <Dropdown value={state.themeId} options={themeOptions} onChange={(id) => onChange({ themeId: id })} />
        </ControlGroup>
        <ControlGroup label="Background">
          <div className="flex items-center gap-1.5">
            <Dropdown value={currentBgLabel} options={bgOptions}
              onChange={(label) => { const p = presetBackgrounds.find((x) => x.label === label); if (p) setBackground(p.bg); }} />
            <button onClick={() => colorRef.current?.click()} className="w-6 h-6 rounded shrink-0"
              style={{ background: state.background.color ?? state.background.gradient ?? "#1a1a2e", border: "1.5px solid var(--border-strong)" }} title="Custom color" />
            <input ref={colorRef} type="color" defaultValue={state.background.color ?? "#1a1a2e"}
              onChange={(e) => setBackground({ type: "solid", color: e.target.value })} className="sr-only" />
            <button onClick={() => bgImageRef.current?.click()} className="w-6 h-6 rounded shrink-0 flex items-center justify-center"
              style={{ background: state.background.type === "image" ? "var(--accent)" : "var(--surface)", border: "1px solid var(--border-strong)",
                color: state.background.type === "image" ? "var(--accent-text)" : "var(--text-muted)" }} title="Upload image">
              <Upload size={10} />
            </button>
            <input ref={bgImageRef} type="file" accept="image/*" onChange={handleBgImageUpload} className="sr-only" />
          </div>
        </ControlGroup>
        <ControlGroup label="Colors">
          <ColorPopover state={state} onChange={onChange} theme={currentTheme} />
        </ControlGroup>
        <Divider />
        <ControlGroup label="Font">
          <Dropdown value={state.fontFamily} options={FONT_OPTIONS.map((f) => ({ id: f.id, label: f.label }))}
            onChange={(id) => onChange({ fontFamily: id })} />
        </ControlGroup>
        <ControlGroup label="Size">
          <SegmentToggle values={["12", "14", "16", "18"]} active={String(state.fontSize)}
            onChange={(v) => onChange({ fontSize: Number(v) })} />
        </ControlGroup>
        <ControlGroup label="Title">
          <input type="text" value={state.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Untitled"
            className="rounded-md text-xs font-medium focus:outline-none focus:ring-1"
            style={{ height: "28px", background: "var(--surface)", color: "var(--text-primary)",
              border: "1px solid var(--border-subtle)", padding: "0 10px", width: "110px" }} />
        </ControlGroup>
      </div>

      {/* Row 2: Layout + mode-specific */}
      <div className="control-row">
        <ControlGroup label="Window">
          <SegmentToggle values={["mac", "windows", "none"]} labels={["macOS", "Win", "None"]}
            active={state.windowStyle} onChange={(v) => onChange({ windowStyle: v as AppState["windowStyle"] })} />
        </ControlGroup>
        <ControlGroup label="Padding">
          <SegmentToggle values={["0", "16", "32", "48", "64", "128"]} active={String(state.padding)}
            onChange={(v) => onChange({ padding: Number(v) })} />
        </ControlGroup>
        <ControlGroup label="BG Radius">
          <div className="flex items-center gap-1.5">
            <input type="range" min="0" max="32" step="1" value={state.borderRadius}
              onChange={(e) => onChange({ borderRadius: Number(e.target.value) })}
              style={{ width: "52px", accentColor: "var(--accent)" }} />
            <span className="text-[10px] font-medium tabular-nums" style={{ color: "var(--text-muted)", width: "16px" }}>{state.borderRadius}</span>
          </div>
        </ControlGroup>
        <ControlGroup label="Viz Radius">
          <div className="flex items-center gap-1.5">
            <input type="range" min="0" max="32" step="1" value={state.vizBorderRadius}
              onChange={(e) => onChange({ vizBorderRadius: Number(e.target.value) })}
              style={{ width: "52px", accentColor: "var(--accent)" }} />
            <span className="text-[10px] font-medium tabular-nums" style={{ color: "var(--text-muted)", width: "16px" }}>{state.vizBorderRadius}</span>
          </div>
        </ControlGroup>

        <Divider />

        {state.vizMode === "table" ? (
          <>
            <ControlGroup label="Grid">
              <Toggle on={state.showGrid} onToggle={() => onChange({ showGrid: !state.showGrid })} />
            </ControlGroup>
            <ControlGroup label="Striped">
              <Toggle on={state.stripedRows} onToggle={() => onChange({ stripedRows: !state.stripedRows })} />
            </ControlGroup>
            <ControlGroup label="Header">
              <Toggle on={state.highlightFirstRow} onToggle={() => onChange({ highlightFirstRow: !state.highlightFirstRow })} />
            </ControlGroup>
            <ControlGroup label="1st Col">
              <Toggle on={state.highlightFirstCol} onToggle={() => onChange({ highlightFirstCol: !state.highlightFirstCol })} />
            </ControlGroup>
            <ControlGroup label="Row #">
              <Toggle on={state.showRowNumbers} onToggle={() => onChange({ showRowNumbers: !state.showRowNumbers })} />
            </ControlGroup>
          </>
        ) : (
          <>
            <ControlGroup label="Labels">
              <Dropdown value={String(state.chartConfig.labelColumn)} options={columnOptions}
                onChange={(id) => updateChartConfig({ labelColumn: Number(id) })} />
            </ControlGroup>
            <ControlGroup label="Values">
              <div className="flex items-center gap-1 flex-wrap shrink-0">
                {columnOptions.map((col) => {
                  const idx = Number(col.id);
                  const isSelected = state.chartConfig.valueColumns.includes(idx);
                  return (
                    <button key={col.id}
                      onClick={() => { const cols = isSelected ? state.chartConfig.valueColumns.filter((c) => c !== idx) : [...state.chartConfig.valueColumns, idx]; if (cols.length > 0) updateChartConfig({ valueColumns: cols }); }}
                      className="px-2 py-0.5 rounded text-[10px] font-medium transition-all"
                      style={{ background: isSelected ? "var(--accent)" : "var(--surface)", color: isSelected ? "white" : "var(--text-muted)",
                        border: `1px solid ${isSelected ? "var(--accent)" : "var(--border-subtle)"}` }}
                      title={numericColumns.includes(idx) ? "Numeric column" : "Non-numeric column"}>
                      {col.label.length > 10 ? col.label.slice(0, 9) + "\u2026" : col.label}
                    </button>
                  );
                })}
              </div>
            </ControlGroup>
            <ControlGroup label="Legend">
              <Toggle on={state.chartConfig.showLegend} onToggle={() => updateChartConfig({ showLegend: !state.chartConfig.showLegend })} />
            </ControlGroup>
            <ControlGroup label="Vals">
              <Toggle on={state.chartConfig.showValues} onToggle={() => updateChartConfig({ showValues: !state.chartConfig.showValues })} />
            </ControlGroup>
            <Divider />
            {state.vizMode === "bar" && (
              <>
                <ControlGroup label="Direction">
                  <SegmentToggle values={["vertical", "horizontal"]} labels={["Vert", "Horiz"]}
                    active={state.chartConfig.bar.orientation}
                    onChange={(v) => updateChartConfig({ bar: { ...state.chartConfig.bar, orientation: v as BarChartConfig["orientation"] } })} />
                </ControlGroup>
                <ControlGroup label="Style">
                  <SegmentToggle values={["grouped", "stacked"]} labels={["Group", "Stack"]}
                    active={state.chartConfig.bar.barStyle}
                    onChange={(v) => updateChartConfig({ bar: { ...state.chartConfig.bar, barStyle: v as BarChartConfig["barStyle"] } })} />
                </ControlGroup>
                <ControlGroup label="Radius">
                  <div className="flex items-center gap-1.5">
                    <input type="range" min="0" max="12" step="1" value={state.chartConfig.bar.barRadius}
                      onChange={(e) => updateChartConfig({ bar: { ...state.chartConfig.bar, barRadius: Number(e.target.value) } })}
                      style={{ width: "48px", accentColor: "var(--accent)" }} />
                    <span className="text-[10px] font-medium tabular-nums" style={{ color: "var(--text-muted)", width: "14px" }}>{state.chartConfig.bar.barRadius}</span>
                  </div>
                </ControlGroup>
                <ControlGroup label="Gap">
                  <div className="flex items-center gap-1.5">
                    <input type="range" min="0" max="16" step="1" value={state.chartConfig.bar.barGap}
                      onChange={(e) => updateChartConfig({ bar: { ...state.chartConfig.bar, barGap: Number(e.target.value) } })}
                      style={{ width: "48px", accentColor: "var(--accent)" }} />
                    <span className="text-[10px] font-medium tabular-nums" style={{ color: "var(--text-muted)", width: "14px" }}>{state.chartConfig.bar.barGap}</span>
                  </div>
                </ControlGroup>
              </>
            )}
            {state.vizMode === "line" && (
              <>
                <ControlGroup label="Curve">
                  <SegmentToggle values={["linear", "smooth"]} labels={["Straight", "Smooth"]}
                    active={state.chartConfig.line.curveType}
                    onChange={(v) => updateChartConfig({ line: { ...state.chartConfig.line, curveType: v as LineChartConfig["curveType"] } })} />
                </ControlGroup>
                <ControlGroup label="Area">
                  <Toggle on={state.chartConfig.line.showArea}
                    onToggle={() => updateChartConfig({ line: { ...state.chartConfig.line, showArea: !state.chartConfig.line.showArea } })} />
                </ControlGroup>
                <ControlGroup label="Dots">
                  <Toggle on={state.chartConfig.line.showDots}
                    onToggle={() => updateChartConfig({ line: { ...state.chartConfig.line, showDots: !state.chartConfig.line.showDots } })} />
                </ControlGroup>
                <ControlGroup label="Width">
                  <div className="flex items-center gap-1.5">
                    <input type="range" min="1" max="5" step="0.5" value={state.chartConfig.line.lineWidth}
                      onChange={(e) => updateChartConfig({ line: { ...state.chartConfig.line, lineWidth: Number(e.target.value) } })}
                      style={{ width: "48px", accentColor: "var(--accent)" }} />
                    <span className="text-[10px] font-medium tabular-nums" style={{ color: "var(--text-muted)", width: "14px" }}>{state.chartConfig.line.lineWidth}</span>
                  </div>
                </ControlGroup>
              </>
            )}
            {state.vizMode === "pie" && (
              <>
                <ControlGroup label="Style">
                  <SegmentToggle values={["0", "50", "80"]} labels={["Pie", "Donut", "Thin"]}
                    active={String(state.chartConfig.pie.innerRadius)}
                    onChange={(v) => updateChartConfig({ pie: { ...state.chartConfig.pie, innerRadius: Number(v) } })} />
                </ControlGroup>
                <ControlGroup label="Labels">
                  <SegmentToggle values={["outside", "inside", "none"]} labels={["Out", "In", "Off"]}
                    active={state.chartConfig.pie.labelPosition}
                    onChange={(v) => updateChartConfig({ pie: { ...state.chartConfig.pie, labelPosition: v as PieChartConfig["labelPosition"] } })} />
                </ControlGroup>
                <ControlGroup label="Sort">
                  <Toggle on={state.chartConfig.pie.sortSlices}
                    onToggle={() => updateChartConfig({ pie: { ...state.chartConfig.pie, sortSlices: !state.chartConfig.pie.sortSlices } })} />
                </ControlGroup>
                <ControlGroup label="Rotate">
                  <div className="flex items-center gap-1.5">
                    <input type="range" min="0" max="360" step="15" value={state.chartConfig.pie.startAngle}
                      onChange={(e) => updateChartConfig({ pie: { ...state.chartConfig.pie, startAngle: Number(e.target.value) } })}
                      style={{ width: "48px", accentColor: "var(--accent)" }} />
                    <span className="text-[10px] font-medium tabular-nums" style={{ color: "var(--text-muted)", width: "20px" }}>{state.chartConfig.pie.startAngle}&deg;</span>
                  </div>
                </ControlGroup>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div
      className="shrink-0 control-panel-grid"
      style={{
        background: "var(--panel-bg)",
        borderTop: "1px solid var(--panel-border)",
      }}
    >
      {/* Mobile toggle bar */}
      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="control-panel-toggle flex items-center justify-between w-full text-xs font-medium px-5"
          style={{ color: "var(--text-secondary)", height: "36px" }}
        >
          <span>Controls</span>
          <ChevronDown
            size={14}
            style={{
              transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
              transition: "transform 0.2s",
            }}
          />
        </button>
      )}

      {/* Panel content — hidden when collapsed on mobile */}
      <div className={collapsed ? "control-panel-content collapsed" : "control-panel-content"}>
        {panelContent}
      </div>
    </div>
  );
}
