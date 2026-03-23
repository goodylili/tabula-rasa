"use client";

import React, { useRef } from "react";
import { AppState, Background } from "@/lib/types";
import { themes } from "@/lib/themes";
import { presetBackgrounds } from "@/lib/backgrounds";

interface ControlPanelProps {
  state: AppState;
  onChange: (patch: Partial<AppState>) => void;
  onExport: () => void;
  exporting: boolean;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-2">
      {children}
    </div>
  );
}

function Section({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="mb-6">
      <Label>{title}</Label>
      {children}
    </div>
  );
}

export default function ControlPanel({ state, onChange, onExport, exporting }: ControlPanelProps) {
  const colorRef = useRef<HTMLInputElement>(null);

  const setBackground = (bg: Background) => onChange({ background: bg });

  return (
    <div className="h-full overflow-y-auto flex flex-col gap-1 p-5 bg-[#0f0f14] text-white">
      {/* Input */}
      <Section title="Input">
        <div className="flex gap-2 mb-2">
          {(["auto", "json", "markdown"] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => onChange({ inputFormat: fmt })}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                state.inputFormat === fmt
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {fmt === "auto" ? "Auto" : fmt.toUpperCase()}
            </button>
          ))}
        </div>
        <textarea
          value={state.rawInput}
          onChange={(e) => onChange({ rawInput: e.target.value })}
          placeholder="Paste JSON or Markdown table here…"
          className="w-full h-36 bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm font-mono text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </Section>

      {/* Title */}
      <Section title="Title">
        <input
          type="text"
          value={state.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Optional table title…"
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </Section>

      {/* Theme */}
      <Section title="Theme">
        <div className="grid grid-cols-3 gap-2">
          {themes.map((theme) => (
            <button
              key={theme.id}
              onClick={() => onChange({ themeId: theme.id })}
              title={theme.name}
              className={`relative h-12 rounded-lg overflow-hidden border-2 transition-all ${
                state.themeId === theme.id
                  ? "border-indigo-500 scale-[1.03]"
                  : "border-transparent hover:border-zinc-600"
              }`}
              style={{
                background: theme.headerBg.includes("gradient")
                  ? theme.headerBg
                  : theme.headerBg,
              }}
            >
              <div
                className="absolute bottom-0 left-0 right-0 h-5"
                style={{ background: theme.rowBg }}
              />
              <span
                className="absolute bottom-1 left-0 right-0 text-center text-[9px] font-medium"
                style={{ color: theme.rowText }}
              >
                {theme.name}
              </span>
            </button>
          ))}
        </div>
      </Section>

      {/* Background */}
      <Section title="Background">
        <div className="grid grid-cols-4 gap-2 mb-3">
          {presetBackgrounds.map(({ label, bg }) => (
            <button
              key={label}
              onClick={() => setBackground(bg)}
              title={label}
              className={`h-10 rounded-lg border-2 transition-all relative ${
                JSON.stringify(state.background) === JSON.stringify(bg)
                  ? "border-indigo-500 scale-[1.05]"
                  : "border-transparent hover:border-zinc-600"
              }`}
              style={{
                background:
                  bg.type === "none"
                    ? "repeating-conic-gradient(#333 0% 25%, #222 0% 50%) 0 0 / 12px 12px"
                    : bg.type === "gradient"
                    ? bg.gradient
                    : bg.color,
              }}
            >
              <span className="absolute inset-0 flex items-end justify-center pb-1 text-[8px] text-white/60">
                {label}
              </span>
            </button>
          ))}
        </div>
        {/* Custom solid color */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => colorRef.current?.click()}
            className="w-8 h-8 rounded-md border border-zinc-700 overflow-hidden"
            style={{ background: state.background.color ?? "#1a1a2e" }}
            title="Custom color"
          />
          <input
            ref={colorRef}
            type="color"
            defaultValue={state.background.color ?? "#1a1a2e"}
            onChange={(e) => setBackground({ type: "solid", color: e.target.value })}
            className="sr-only"
          />
          <span className="text-xs text-zinc-500">Custom color</span>

          {/* Custom gradient text */}
          <input
            type="text"
            placeholder="CSS gradient…"
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            onBlur={(e) => {
              if (e.target.value.trim()) {
                setBackground({ type: "gradient", gradient: e.target.value.trim() });
              }
            }}
          />
        </div>
      </Section>

      {/* Window Style */}
      <Section title="Window Frame">
        <div className="flex gap-2">
          {(["mac", "windows", "none"] as const).map((s) => (
            <button
              key={s}
              onClick={() => onChange({ windowStyle: s })}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                state.windowStyle === s
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {s === "mac" ? "macOS" : s === "windows" ? "Windows" : "None"}
            </button>
          ))}
        </div>
      </Section>

      {/* Options */}
      <Section title="Options">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">Grid lines</span>
            <button
              onClick={() => onChange({ showGrid: !state.showGrid })}
              className={`w-10 h-5 rounded-full transition-all relative ${
                state.showGrid ? "bg-indigo-600" : "bg-zinc-700"
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                  state.showGrid ? "left-5" : "left-0.5"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">Striped rows</span>
            <button
              onClick={() => onChange({ stripedRows: !state.stripedRows })}
              className={`w-10 h-5 rounded-full transition-all relative ${
                state.stripedRows ? "bg-indigo-600" : "bg-zinc-700"
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                  state.stripedRows ? "left-5" : "left-0.5"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">Font size</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onChange({ fontSize: Math.max(10, state.fontSize - 1) })}
                className="w-6 h-6 bg-zinc-800 rounded text-zinc-300 text-sm hover:bg-zinc-700"
              >
                −
              </button>
              <span className="text-sm text-zinc-200 w-6 text-center">{state.fontSize}</span>
              <button
                onClick={() => onChange({ fontSize: Math.min(24, state.fontSize + 1) })}
                className="w-6 h-6 bg-zinc-800 rounded text-zinc-300 text-sm hover:bg-zinc-700"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </Section>

      {/* Export */}
      <div className="mt-auto pt-4">
        <button
          onClick={onExport}
          disabled={exporting}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all text-sm shadow-lg shadow-indigo-900/40"
        >
          {exporting ? "Exporting…" : "Export PNG"}
        </button>
      </div>
    </div>
  );
}
