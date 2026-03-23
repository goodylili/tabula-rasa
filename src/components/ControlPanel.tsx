"use client";

import React, { useRef, useState } from "react";
import { AppState, Background } from "@/lib/types";
import { themes, getTheme } from "@/lib/themes";
import { presetBackgrounds } from "@/lib/backgrounds";
import { FONT_OPTIONS } from "@/lib/fonts";
import { ChevronDown } from "lucide-react";

interface ControlPanelProps {
  state: AppState;
  onChange: (patch: Partial<AppState>) => void;
}

function ControlLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[11px] font-medium mb-1.5 select-none"
      style={{ color: "rgba(255,255,255,0.4)" }}
    >
      {children}
    </div>
  );
}

function ControlGroup({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col">
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
        background: on ? "var(--accent)" : "rgba(255,255,255,0.12)",
      }}
    >
      <div
        className="absolute top-[2px] w-4 h-4 rounded-full bg-white transition-all"
        style={{ left: on ? "18px" : "2px" }}
      />
    </button>
  );
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
  const ref = useRef<HTMLDivElement>(null);
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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 rounded-lg text-xs font-medium transition-all"
        style={{
          height: "28px",
          background: "rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.85)",
          border: "1px solid rgba(255,255,255,0.08)",
          minWidth: "120px",
        }}
      >
        {selected?.extra}
        <span className="flex-1 text-left truncate">{selected?.label}</span>
        <ChevronDown size={12} style={{ opacity: 0.5 }} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute bottom-full mb-2 left-0 z-50 rounded-xl overflow-hidden shadow-2xl"
            style={{
              background: "hsl(0,0%,12%)",
              border: "1px solid rgba(255,255,255,0.1)",
              maxHeight: "340px",
              overflowY: "auto",
              minWidth: "200px",
            }}
          >
            {groups.map((group) => (
              <div key={group.name}>
                {group.name && (
                  <div
                    className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: "rgba(255,255,255,0.3)" }}
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
                      color: value === opt.id ? "white" : "rgba(255,255,255,0.7)",
                      background: value === opt.id ? "rgba(255,255,255,0.08)" : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (value !== opt.id) e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                    }}
                    onMouseLeave={(e) => {
                      if (value !== opt.id) e.currentTarget.style.background = value === opt.id ? "rgba(255,255,255,0.08)" : "transparent";
                    }}
                  >
                    {opt.extra}
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
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
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.08)",
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
            color: active === v ? "white" : "rgba(255,255,255,0.5)",
          }}
        >
          {labels ? labels[i] : v}
        </button>
      ))}
    </div>
  );
}

function Divider() {
  return <div className="self-stretch w-px my-1" style={{ background: "rgba(255,255,255,0.08)" }} />;
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
        style={{ background: display, border: "1px solid rgba(255,255,255,0.2)" }}
        title={label}
      />
      <input
        ref={ref}
        type="color"
        value={display.startsWith("#") ? display : "#888888"}
        onChange={(e) => onChangeColor(e.target.value)}
        className="sr-only"
      />
      <span className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.6)", width: "60px" }}>
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
  const hasCustom = state.customHeaderBg || state.customHeaderText || state.customRowBg ||
    state.customAltRowBg || state.customRowText || state.customBorderColor;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 rounded-lg text-xs font-medium transition-all"
        style={{
          height: "28px",
          background: "rgba(255,255,255,0.06)",
          color: hasCustom ? "white" : "rgba(255,255,255,0.5)",
          border: `1px solid ${hasCustom ? "var(--accent)" : "rgba(255,255,255,0.08)"}`,
        }}
      >
        <div className="flex -space-x-1">
          <div className="w-3 h-3 rounded-full" style={{ background: state.customHeaderBg || theme.accentBg, border: "1px solid rgba(0,0,0,0.3)" }} />
          <div className="w-3 h-3 rounded-full" style={{ background: state.customRowBg || theme.rowBg, border: "1px solid rgba(0,0,0,0.3)" }} />
          <div className="w-3 h-3 rounded-full" style={{ background: state.customRowText || theme.rowText, border: "1px solid rgba(0,0,0,0.3)" }} />
        </div>
        Customize
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute bottom-full mb-2 right-0 z-50 rounded-xl p-4 shadow-2xl"
            style={{
              background: "hsl(0,0%,12%)",
              border: "1px solid rgba(255,255,255,0.1)",
              width: "220px",
            }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
              Custom Colors
            </div>
            <div className="flex flex-col gap-2.5">
              <ColorSwatch label="Header bg" value={state.customHeaderBg} fallback={theme.accentBg} onChangeColor={(c) => onChange({ customHeaderBg: c })} />
              <ColorSwatch label="Header text" value={state.customHeaderText} fallback={theme.accentText} onChangeColor={(c) => onChange({ customHeaderText: c })} />
              <ColorSwatch label="Row bg" value={state.customRowBg} fallback={theme.rowBg} onChangeColor={(c) => onChange({ customRowBg: c })} />
              <ColorSwatch label="Alt row bg" value={state.customAltRowBg} fallback={theme.altRowBg} onChangeColor={(c) => onChange({ customAltRowBg: c })} />
              <ColorSwatch label="Text color" value={state.customRowText} fallback={theme.rowText} onChangeColor={(c) => onChange({ customRowText: c })} />
              <ColorSwatch label="Border" value={state.customBorderColor} fallback={theme.borderColor} onChangeColor={(c) => onChange({ customBorderColor: c })} />
            </div>
            {hasCustom && (
              <button
                onClick={() => onChange({
                  customHeaderBg: "", customHeaderText: "", customRowBg: "",
                  customAltRowBg: "", customRowText: "", customBorderColor: "",
                })}
                className="w-full mt-3 py-1.5 rounded-lg text-[10px] font-medium transition-all"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
              >
                Reset to theme defaults
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function ControlPanel({ state, onChange }: ControlPanelProps) {
  const colorRef = useRef<HTMLInputElement>(null);
  const currentTheme = getTheme(state.themeId);

  const setBackground = (bg: Background) => onChange({ background: bg });

  const themeOptions = themes.map((t) => ({
    id: t.id,
    label: t.name,
    group: t.group,
    extra: (
      <div
        className="w-5 h-3.5 rounded-sm shrink-0"
        style={{
          background: t.headerBg,
          border: "1px solid rgba(255,255,255,0.1)",
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
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      />
    ),
  }));

  const currentBgLabel =
    presetBackgrounds.find(
      (p) => JSON.stringify(p.bg) === JSON.stringify(state.background)
    )?.label ?? "Custom";

  return (
    <div className="shrink-0 pb-4 px-4 overflow-x-auto">
      <div
        className="panel-glow flex items-start gap-5 px-5 py-3.5 rounded-2xl mx-auto w-fit max-w-full"
        style={{
          background: "var(--panel-bg)",
          border: "1px solid var(--panel-border)",
          boxShadow: "none",
        }}
      >
        {/* Theme */}
        <ControlGroup label="Theme">
          <Dropdown
            value={state.themeId}
            options={themeOptions}
            onChange={(id) => onChange({ themeId: id })}
          />
        </ControlGroup>

        {/* Background */}
        <ControlGroup label="Background">
          <div className="flex items-center gap-2">
            <Dropdown
              value={currentBgLabel}
              options={bgOptions}
              onChange={(label) => {
                const preset = presetBackgrounds.find((p) => p.label === label);
                if (preset) setBackground(preset.bg);
              }}
            />
            <button
              onClick={() => colorRef.current?.click()}
              className="w-7 h-7 rounded-lg shrink-0 transition-all"
              style={{
                background: state.background.color ?? state.background.gradient ?? "#1a1a2e",
                border: "2px solid rgba(255,255,255,0.15)",
              }}
              title="Custom color"
            />
            <input
              ref={colorRef}
              type="color"
              defaultValue={state.background.color ?? "#1a1a2e"}
              onChange={(e) => setBackground({ type: "solid", color: e.target.value })}
              className="sr-only"
            />
          </div>
        </ControlGroup>

        {/* Window Frame */}
        <ControlGroup label="Window">
          <SegmentToggle
            values={["mac", "windows", "none"]}
            labels={["macOS", "Win", "None"]}
            active={state.windowStyle}
            onChange={(v) => onChange({ windowStyle: v as AppState["windowStyle"] })}
          />
        </ControlGroup>

        <Divider />

        {/* Grid */}
        <ControlGroup label="Grid">
          <Toggle on={state.showGrid} onToggle={() => onChange({ showGrid: !state.showGrid })} />
        </ControlGroup>

        {/* Striped */}
        <ControlGroup label="Striped">
          <Toggle on={state.stripedRows} onToggle={() => onChange({ stripedRows: !state.stripedRows })} />
        </ControlGroup>

        {/* Highlight First Row */}
        <ControlGroup label="1st Row">
          <Toggle on={state.highlightFirstRow} onToggle={() => onChange({ highlightFirstRow: !state.highlightFirstRow })} />
        </ControlGroup>

        {/* Highlight First Column */}
        <ControlGroup label="1st Col">
          <Toggle on={state.highlightFirstCol} onToggle={() => onChange({ highlightFirstCol: !state.highlightFirstCol })} />
        </ControlGroup>

        {/* Row Numbers */}
        <ControlGroup label="Row #">
          <Toggle on={state.showRowNumbers} onToggle={() => onChange({ showRowNumbers: !state.showRowNumbers })} />
        </ControlGroup>

        <Divider />

        {/* Font Size */}
        <ControlGroup label="Size">
          <SegmentToggle
            values={["12", "14", "16", "18"]}
            active={String(state.fontSize)}
            onChange={(v) => onChange({ fontSize: Number(v) })}
          />
        </ControlGroup>

        {/* Font */}
        <ControlGroup label="Font">
          <Dropdown
            value={state.fontFamily}
            options={FONT_OPTIONS.map((f) => ({ id: f.id, label: f.label }))}
            onChange={(id) => onChange({ fontFamily: id })}
          />
        </ControlGroup>

        {/* Border Radius */}
        <ControlGroup label="Radius">
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="32"
              step="1"
              value={state.borderRadius}
              onChange={(e) => onChange({ borderRadius: Number(e.target.value) })}
              style={{
                width: "70px",
                accentColor: "var(--accent)",
              }}
            />
            <span
              className="text-xs font-medium tabular-nums"
              style={{ color: "rgba(255,255,255,0.5)", width: "24px" }}
            >
              {state.borderRadius}
            </span>
          </div>
        </ControlGroup>

        {/* Title */}
        <ControlGroup label="Title">
          <input
            type="text"
            value={state.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Untitled"
            className="rounded-lg text-xs font-medium placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
            style={{
              height: "28px",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.85)",
              border: "1px solid rgba(255,255,255,0.08)",
              padding: "0 10px",
              width: "120px",
            }}
          />
        </ControlGroup>

        <Divider />

        {/* Colors */}
        <ControlGroup label="Colors">
          <ColorPopover state={state} onChange={onChange} theme={currentTheme} />
        </ControlGroup>
      </div>
    </div>
  );
}
