"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { AppState, Background } from "@/lib/types";
import { themes, getTheme } from "@/lib/themes";
import { presetBackgrounds } from "@/lib/backgrounds";
import { FONT_OPTIONS } from "@/lib/fonts";
import { ChevronDown } from "lucide-react";

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
          minWidth: "120px",
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
  return <div className="self-stretch w-px my-1" style={{ background: "var(--border-subtle)" }} />;
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
      <span className="text-[10px] truncate" style={{ color: "var(--text-secondary)", width: "60px" }}>
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
  const hasCustom = state.customHeaderBg || state.customHeaderText || state.customRowBg ||
    state.customAltRowBg || state.customRowText || state.customBorderColor;

  const getPopoverStyle = (): React.CSSProperties => {
    if (!triggerRef.current) return {};
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const popoverW = 220;
    // Keep popover within viewport horizontally
    const left = Math.min(rect.right - popoverW, Math.max(8, rect.left));

    if (spaceAbove > spaceBelow) {
      return { position: "fixed", bottom: window.innerHeight - rect.top + 8, left, width: `${popoverW}px` };
    } else {
      return { position: "fixed", top: rect.bottom + 8, left, width: `${popoverW}px` };
    }
  };

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
          <div className="w-3 h-3 rounded-full" style={{ background: state.customHeaderBg || theme.accentBg, border: "1px solid var(--swatch-border)" }} />
          <div className="w-3 h-3 rounded-full" style={{ background: state.customRowBg || theme.rowBg, border: "1px solid var(--swatch-border)" }} />
          <div className="w-3 h-3 rounded-full" style={{ background: state.customRowText || theme.rowText, border: "1px solid var(--swatch-border)" }} />
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
                style={{ background: "var(--surface)", color: "var(--text-muted)" }}
              >
                Reset to theme defaults
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
    presetBackgrounds.find(
      (p) => JSON.stringify(p.bg) === JSON.stringify(state.background)
    )?.label ?? "Custom";

  const panelContent = (
    <>
      {/* Row 1: Appearance */}
      <div className="control-row">
        <ControlGroup label="Theme">
          <Dropdown
            value={state.themeId}
            options={themeOptions}
            onChange={(id) => onChange({ themeId: id })}
          />
        </ControlGroup>

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
                border: "2px solid var(--border-strong)",
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

        <ControlGroup label="Colors">
          <ColorPopover state={state} onChange={onChange} theme={currentTheme} />
        </ControlGroup>

        <Divider />

        <ControlGroup label="Font">
          <Dropdown
            value={state.fontFamily}
            options={FONT_OPTIONS.map((f) => ({ id: f.id, label: f.label }))}
            onChange={(id) => onChange({ fontFamily: id })}
          />
        </ControlGroup>

        <ControlGroup label="Size">
          <SegmentToggle
            values={["12", "14", "16", "18"]}
            active={String(state.fontSize)}
            onChange={(v) => onChange({ fontSize: Number(v) })}
          />
        </ControlGroup>

        <ControlGroup label="Title">
          <input
            type="text"
            value={state.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Untitled"
            className="rounded-lg text-xs font-medium placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
            style={{
              height: "28px",
              background: "var(--surface)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-subtle)",
              padding: "0 10px",
              width: "120px",
            }}
          />
        </ControlGroup>
      </div>

      {/* Row 2: Layout & Toggles */}
      <div className="control-row">
        <ControlGroup label="Window">
          <SegmentToggle
            values={["mac", "windows", "none"]}
            labels={["macOS", "Win", "None"]}
            active={state.windowStyle}
            onChange={(v) => onChange({ windowStyle: v as AppState["windowStyle"] })}
          />
        </ControlGroup>

        <ControlGroup label="Padding">
          <SegmentToggle
            values={["0", "16", "32", "48", "64", "128"]}
            active={String(state.padding)}
            onChange={(v) => onChange({ padding: Number(v) })}
          />
        </ControlGroup>

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
              style={{ color: "var(--text-muted)", width: "24px" }}
            >
              {state.borderRadius}
            </span>
          </div>
        </ControlGroup>

        <Divider />

        <ControlGroup label="Grid">
          <Toggle on={state.showGrid} onToggle={() => onChange({ showGrid: !state.showGrid })} />
        </ControlGroup>

        <ControlGroup label="Striped">
          <Toggle on={state.stripedRows} onToggle={() => onChange({ stripedRows: !state.stripedRows })} />
        </ControlGroup>

        <ControlGroup label="1st Row">
          <Toggle on={state.highlightFirstRow} onToggle={() => onChange({ highlightFirstRow: !state.highlightFirstRow })} />
        </ControlGroup>

        <ControlGroup label="1st Col">
          <Toggle on={state.highlightFirstCol} onToggle={() => onChange({ highlightFirstCol: !state.highlightFirstCol })} />
        </ControlGroup>

        <ControlGroup label="Row #">
          <Toggle on={state.showRowNumbers} onToggle={() => onChange({ showRowNumbers: !state.showRowNumbers })} />
        </ControlGroup>
      </div>
    </>
  );

  return (
    <div className="shrink-0 pb-4 px-4">
      <div
        className="panel-glow control-panel-grid px-5 py-3.5 rounded-2xl mx-auto"
        style={{
          background: "var(--panel-bg)",
          border: "1px solid var(--panel-border)",
          boxShadow: "none",
        }}
      >
        {/* Mobile toggle bar */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="control-panel-toggle flex items-center justify-between w-full text-xs font-medium"
            style={{ color: "var(--text-secondary)" }}
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
    </div>
  );
}
