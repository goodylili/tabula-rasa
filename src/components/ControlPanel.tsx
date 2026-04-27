"use client";

import React from "react";
import { AppState, Background } from "@/lib/types";
import { themes } from "@/lib/themes";
import { presetBackgrounds } from "@/lib/backgrounds";
import { FONT_OPTIONS } from "@/lib/fonts";
import { Section, Field, Segmented, Switch, Slider, Select, Swatch } from "./ui/Primitives";

type BgKind = "preset" | "solid" | "gradient" | "none";

function parseGradientStops(gradient: string | undefined): { from: string; to: string; angle: number } {
  const fallback = { from: "#1a1a1a", to: "#3a3a3a", angle: 135 };
  if (!gradient) return fallback;
  const angleMatch = gradient.match(/(-?\d+)deg/);
  const hexes = gradient.match(/#[0-9a-fA-F]{3,8}/g);
  if (!hexes || hexes.length < 2) return fallback;
  return {
    angle: angleMatch ? Number(angleMatch[1]) : 135,
    from: hexes[0],
    to: hexes[hexes.length - 1],
  };
}

function buildGradient(angle: number, from: string, to: string): string {
  return `linear-gradient(${angle}deg, ${from}, ${to})`;
}

function GradientStops({
  background,
  onChange,
}: {
  background: Background;
  onChange: (bg: Background) => void;
}) {
  const { from, to, angle } = parseGradientStops(background.gradient);
  const update = (next: { from?: string; to?: string; angle?: number }) => {
    onChange({
      type: "gradient",
      gradient: buildGradient(next.angle ?? angle, next.from ?? from, next.to ?? to),
    });
  };
  return (
    <>
      <Field label="From" inline>
        <Swatch color={from} onChange={(c) => update({ from: c })} ariaLabel="Gradient start" />
      </Field>
      <Field label="To" inline>
        <Swatch color={to} onChange={(c) => update({ to: c })} ariaLabel="Gradient end" />
      </Field>
      <Field label="Angle">
        <Slider
          value={angle}
          min={0}
          max={360}
          step={5}
          onChange={(v) => update({ angle: v })}
          format={(v) => `${v}°`}
        />
      </Field>
    </>
  );
}

interface ControlPanelProps {
  state: AppState;
  onChange: (patch: Partial<AppState>) => void;
}

const WINDOW_OPTS = [
  { value: "mac", label: "Mac" },
  { value: "windows", label: "Windows" },
  { value: "none", label: "None" },
] as const;

export default function ControlPanel({ state, onChange }: ControlPanelProps) {
  const themeOpts = themes.map((t) => ({ value: t.id, label: t.name, group: t.group }));
  const bgOpts = presetBackgrounds.map((b) => ({ value: b.label, label: b.label }));
  const fontOpts = FONT_OPTIONS.map((f) => ({ value: f.id, label: f.label }));

  const currentBgLabel =
    presetBackgrounds.find((b) => {
      if (b.bg.type !== state.background.type) return false;
      if (b.bg.type === "gradient") return b.bg.gradient === state.background.gradient;
      if (b.bg.type === "solid") return b.bg.color === state.background.color;
      return b.bg.type === state.background.type;
    })?.label ?? "";

  const handleBgChange = (label: string) => {
    const preset = presetBackgrounds.find((b) => b.label === label);
    if (preset) onChange({ background: preset.bg });
  };

  const bgKind: BgKind =
    state.background.type === "none"
      ? "none"
      : currentBgLabel
      ? "preset"
      : state.background.type === "solid"
      ? "solid"
      : state.background.type === "gradient"
      ? "gradient"
      : "preset";

  const isChart = state.vizMode !== "table";

  return (
    <div className="cp">
      <Section title="Appearance">
        <Field label="Theme">
          <Select value={state.themeId} options={themeOpts} onChange={(v) => onChange({ themeId: v })} />
        </Field>

        <Field label="Background">
          <Segmented<BgKind>
            value={bgKind}
            options={[
              { value: "preset", label: "Preset" },
              { value: "solid", label: "Solid" },
              { value: "gradient", label: "Gradient" },
              { value: "none", label: "None" },
            ]}
            onChange={(kind) => {
              if (kind === "none") {
                onChange({ background: { type: "none" } });
              } else if (kind === "solid") {
                onChange({ background: { type: "solid", color: state.background.color ?? "#0d0d0d" } });
              } else if (kind === "gradient") {
                const s = parseGradientStops(state.background.gradient);
                onChange({
                  background: {
                    type: "gradient",
                    gradient: `linear-gradient(${s.angle}deg, ${s.from}, ${s.to})`,
                  },
                });
              } else {
                const first = presetBackgrounds.find((b) => b.bg.type !== "none");
                if (first) onChange({ background: first.bg });
              }
            }}
          />
        </Field>

        {bgKind === "preset" && (
          <Field label="Preset">
            <Select
              value={currentBgLabel}
              options={bgOpts}
              onChange={handleBgChange}
              placeholder="Select preset"
            />
          </Field>
        )}

        {bgKind === "solid" && (
          <Field label="Color" inline>
            <Swatch
              color={state.background.color ?? "#0d0d0d"}
              onChange={(color) => onChange({ background: { type: "solid", color } })}
              ariaLabel="Background color"
            />
          </Field>
        )}

        {bgKind === "gradient" && (
          <GradientStops
            background={state.background}
            onChange={(bg) => onChange({ background: bg })}
          />
        )}

        <Field label="Font">
          <Select value={state.fontFamily} options={fontOpts} onChange={(v) => onChange({ fontFamily: v })} />
        </Field>

        <Field label="Font size">
          <Segmented
            value={state.fontSize}
            options={[
              { value: 12, label: "12" },
              { value: 14, label: "14" },
              { value: 16, label: "16" },
              { value: 18, label: "18" },
            ]}
            onChange={(v) => onChange({ fontSize: v })}
          />
        </Field>
      </Section>

      <Section title="Custom colors">
        <Field label="Header bg" inline>
          <Swatch
            color={state.customHeaderBg || "#000000"}
            onChange={(v) => onChange({ customHeaderBg: v })}
            ariaLabel="Header background"
          />
        </Field>
        <Field label="Header text" inline>
          <Swatch
            color={state.customHeaderText || "#ffffff"}
            onChange={(v) => onChange({ customHeaderText: v })}
            ariaLabel="Header text"
          />
        </Field>
        <Field label="Row bg" inline>
          <Swatch
            color={state.customRowBg || "#000000"}
            onChange={(v) => onChange({ customRowBg: v })}
            ariaLabel="Row background"
          />
        </Field>
        <Field label="Alt row bg" inline>
          <Swatch
            color={state.customAltRowBg || "#0a0a0a"}
            onChange={(v) => onChange({ customAltRowBg: v })}
            ariaLabel="Alternate row background"
          />
        </Field>
        <Field label="Row text" inline>
          <Swatch
            color={state.customRowText || "#ffffff"}
            onChange={(v) => onChange({ customRowText: v })}
            ariaLabel="Row text"
          />
        </Field>
        <Field label="Border" inline>
          <Swatch
            color={state.customBorderColor || "#222222"}
            onChange={(v) => onChange({ customBorderColor: v })}
            ariaLabel="Border color"
          />
        </Field>
        {(state.customHeaderBg ||
          state.customHeaderText ||
          state.customRowBg ||
          state.customAltRowBg ||
          state.customRowText ||
          state.customBorderColor) && (
          <button
            type="button"
            className="seg-btn"
            style={{
              alignSelf: "flex-start",
              padding: "6px 12px",
              border: "0.5px solid var(--border-strong)",
              borderRadius: 6,
              background: "transparent",
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
            onClick={() =>
              onChange({
                customHeaderBg: "",
                customHeaderText: "",
                customRowBg: "",
                customAltRowBg: "",
                customRowText: "",
                customBorderColor: "",
              })
            }
          >
            Reset
          </button>
        )}
      </Section>

      <Section title="Layout">
        <Field label="Window">
          <Segmented
            value={state.windowStyle}
            options={WINDOW_OPTS.map((o) => ({ value: o.value, label: o.label }))}
            onChange={(v) => onChange({ windowStyle: v as AppState["windowStyle"] })}
          />
        </Field>

        <Field label="Padding">
          <Slider
            value={state.padding}
            min={0}
            max={128}
            step={4}
            onChange={(v) => onChange({ padding: v })}
          />
        </Field>

        <Field label="Card radius">
          <Slider
            value={state.borderRadius}
            min={0}
            max={48}
            step={1}
            onChange={(v) => onChange({ borderRadius: v })}
          />
        </Field>

        <Field label="Inner radius">
          <Slider
            value={state.vizBorderRadius}
            min={0}
            max={32}
            step={1}
            onChange={(v) => onChange({ vizBorderRadius: v })}
          />
        </Field>
      </Section>

      {!isChart && (
        <Section title="Table style">
          <Field label="Row lines" inline>
            <Switch checked={state.showGrid} onChange={(v) => onChange({ showGrid: v })} ariaLabel="Row lines" />
          </Field>
          <Field label="Column lines" inline>
            <Switch
              checked={state.showColumnLines}
              onChange={(v) => onChange({ showColumnLines: v })}
              ariaLabel="Column lines"
            />
          </Field>
          <Field label="Striped rows" inline>
            <Switch
              checked={state.stripedRows}
              onChange={(v) => onChange({ stripedRows: v })}
              ariaLabel="Striped rows"
            />
          </Field>
          <Field label="Highlight first row" inline>
            <Switch
              checked={state.highlightFirstRow}
              onChange={(v) => onChange({ highlightFirstRow: v })}
              ariaLabel="Highlight first row"
            />
          </Field>
          <Field label="Highlight first column" inline>
            <Switch
              checked={state.highlightFirstCol}
              onChange={(v) => onChange({ highlightFirstCol: v })}
              ariaLabel="Highlight first column"
            />
          </Field>
          <Field label="Row numbers" inline>
            <Switch
              checked={state.showRowNumbers}
              onChange={(v) => onChange({ showRowNumbers: v })}
              ariaLabel="Show row numbers"
            />
          </Field>
        </Section>
      )}

      {state.vizMode === "bar" && (
        <Section title="Bar chart">
          <Field label="Orientation">
            <Segmented
              value={state.chartConfig.bar.orientation}
              options={[
                { value: "vertical", label: "Vertical" },
                { value: "horizontal", label: "Horizontal" },
              ]}
              onChange={(v) =>
                onChange({
                  chartConfig: { ...state.chartConfig, bar: { ...state.chartConfig.bar, orientation: v } },
                })
              }
            />
          </Field>
          <Field label="Style">
            <Segmented
              value={state.chartConfig.bar.barStyle}
              options={[
                { value: "grouped", label: "Grouped" },
                { value: "stacked", label: "Stacked" },
              ]}
              onChange={(v) =>
                onChange({
                  chartConfig: { ...state.chartConfig, bar: { ...state.chartConfig.bar, barStyle: v } },
                })
              }
            />
          </Field>
          <Field label="Bar radius">
            <Slider
              value={state.chartConfig.bar.barRadius}
              min={0}
              max={12}
              onChange={(v) =>
                onChange({
                  chartConfig: { ...state.chartConfig, bar: { ...state.chartConfig.bar, barRadius: v } },
                })
              }
            />
          </Field>
          <Field label="Bar gap">
            <Slider
              value={state.chartConfig.bar.barGap}
              min={0}
              max={24}
              onChange={(v) =>
                onChange({
                  chartConfig: { ...state.chartConfig, bar: { ...state.chartConfig.bar, barGap: v } },
                })
              }
            />
          </Field>
        </Section>
      )}

      {state.vizMode === "line" && (
        <Section title="Line chart">
          <Field label="Curve">
            <Segmented
              value={state.chartConfig.line.curveType}
              options={[
                { value: "linear", label: "Linear" },
                { value: "smooth", label: "Smooth" },
              ]}
              onChange={(v) =>
                onChange({
                  chartConfig: { ...state.chartConfig, line: { ...state.chartConfig.line, curveType: v } },
                })
              }
            />
          </Field>
          <Field label="Area fill" inline>
            <Switch
              checked={state.chartConfig.line.showArea}
              onChange={(v) =>
                onChange({
                  chartConfig: { ...state.chartConfig, line: { ...state.chartConfig.line, showArea: v } },
                })
              }
              ariaLabel="Area fill"
            />
          </Field>
          <Field label="Dots" inline>
            <Switch
              checked={state.chartConfig.line.showDots}
              onChange={(v) =>
                onChange({
                  chartConfig: { ...state.chartConfig, line: { ...state.chartConfig.line, showDots: v } },
                })
              }
              ariaLabel="Dots"
            />
          </Field>
          <Field label="Line width">
            <Slider
              value={state.chartConfig.line.lineWidth}
              min={1}
              max={5}
              step={0.5}
              onChange={(v) =>
                onChange({
                  chartConfig: { ...state.chartConfig, line: { ...state.chartConfig.line, lineWidth: v } },
                })
              }
            />
          </Field>
        </Section>
      )}

      {state.vizMode === "pie" && (
        <Section title="Pie chart">
          <Field label="Inner radius">
            <Slider
              value={state.chartConfig.pie.innerRadius}
              min={0}
              max={80}
              onChange={(v) =>
                onChange({
                  chartConfig: { ...state.chartConfig, pie: { ...state.chartConfig.pie, innerRadius: v } },
                })
              }
            />
          </Field>
          <Field label="Labels">
            <Segmented
              value={state.chartConfig.pie.labelPosition}
              options={[
                { value: "outside", label: "Outside" },
                { value: "inside", label: "Inside" },
                { value: "none", label: "None" },
              ]}
              onChange={(v) =>
                onChange({
                  chartConfig: {
                    ...state.chartConfig,
                    pie: { ...state.chartConfig.pie, labelPosition: v },
                  },
                })
              }
            />
          </Field>
          <Field label="Sort slices" inline>
            <Switch
              checked={state.chartConfig.pie.sortSlices}
              onChange={(v) =>
                onChange({
                  chartConfig: { ...state.chartConfig, pie: { ...state.chartConfig.pie, sortSlices: v } },
                })
              }
              ariaLabel="Sort slices"
            />
          </Field>
        </Section>
      )}

      {isChart && (
        <Section title="Chart options">
          <Field label="Legend" inline>
            <Switch
              checked={state.chartConfig.showLegend}
              onChange={(v) => onChange({ chartConfig: { ...state.chartConfig, showLegend: v } })}
              ariaLabel="Legend"
            />
          </Field>
          <Field label="Values" inline>
            <Switch
              checked={state.chartConfig.showValues}
              onChange={(v) => onChange({ chartConfig: { ...state.chartConfig, showValues: v } })}
              ariaLabel="Values"
            />
          </Field>
        </Section>
      )}
    </div>
  );
}
