"use client";

import React, { useMemo } from "react";
import {
  TableData,
  TableTheme,
  ChartConfig,
  BarChartConfig,
  LineChartConfig,
  PieChartConfig,
  VisualizationMode,
} from "@/lib/types";

/** Extract a usable hex color from a theme property that might be a gradient */
function extractColor(cssValue: string): string | null {
  if (!cssValue) return null;
  const hexMatch = cssValue.match(/#([0-9a-fA-F]{3,8})\b/);
  if (hexMatch) {
    const hex = hexMatch[0];
    // Skip near-black colors — they don't work as chart accents
    if (/^#(0[0-9a-fA-F]){3}$/i.test(hex) || hex === "#000000" || hex === "#000") return null;
    return hex;
  }
  return null;
}

/** Lighten a hex color by a factor (0-1) */
function lightenHex(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.round(r + (255 - r) * factor);
  const ng = Math.round(g + (255 - g) * factor);
  const nb = Math.round(b + (255 - b) * factor);
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}

export function generateChartColors(theme: TableTheme, count: number): string[] {
  // Curated palette with good contrast on both dark and light backgrounds
  const basePalette = [
    "#6e56cf", "#3ECF8E", "#36B6F0", "#F97316",
    "#EF4444", "#A855F7", "#EC4899", "#14B8A6",
    "#EAB308", "#6366F1", "#8B5CF6", "#06B6D4",
  ];

  // Try to derive a lead color from theme accent/header
  const accentColor = extractColor(theme.accentText) || extractColor(theme.headerText) || extractColor(theme.headerBg);
  if (accentColor) {
    // Replace the first slot with the theme accent, and remove any duplicate
    basePalette[0] = accentColor;
    const dupIdx = basePalette.indexOf(accentColor, 1);
    if (dupIdx > 0) basePalette[dupIdx] = "#F472B6";
  }

  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    colors.push(basePalette[i % basePalette.length]);
  }
  return colors;
}

function parseNumericValue(val: string): number {
  const cleaned = val.replace(/[,$%]/g, "").trim();
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
}

/** Format a number for axis/value labels: 1200 -> 1.2K, 2500000 -> 2.5M */
function formatValue(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1_000_000) {
    const v = val / 1_000_000;
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + "M";
  }
  if (abs >= 10_000) {
    const v = val / 1_000;
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + "K";
  }
  return val % 1 === 0 ? String(val) : val.toFixed(1);
}

function niceScale(maxVal: number): number {
  if (maxVal <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(maxVal)));
  const residual = maxVal / mag;
  // Pick nicer breakpoints: 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10
  const niceSteps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  for (const step of niceSteps) {
    if (residual <= step) return step * mag;
  }
  return Math.ceil(residual) * mag;
}

interface ChartProps {
  data: TableData;
  theme: TableTheme;
  config: ChartConfig;
  vizMode: VisualizationMode;
  fontSize: number;
  fontOverride?: string;
  title?: string;
}

// ---------------------------------------------------------------------------
// BAR CHART
// ---------------------------------------------------------------------------
function BarChart({
  labels,
  datasets,
  colors,
  theme,
  fontSize,
  fontFamily,
  showValues,
  showLegend,
  cfg,
}: {
  labels: string[];
  datasets: { name: string; values: number[] }[];
  colors: string[];
  theme: TableTheme;
  fontSize: number;
  fontFamily: string;
  showValues: boolean;
  showLegend: boolean;
  cfg: BarChartConfig;
}) {
  const horizontal = cfg.orientation === "horizontal";
  const stacked = cfg.barStyle === "stacked";
  const gridLines = 5;

  // Compute max value (stacked sums per label if stacked)
  const allValues = stacked
    ? labels.map((_, li) => datasets.reduce((sum, ds) => sum + (ds.values[li] || 0), 0))
    : datasets.flatMap((d) => d.values);
  const niceMax = niceScale(Math.max(...allValues, 1));

  // Subtle text color at reduced opacity for axes
  const axisColor = theme.rowText;
  const axisOpacity = 0.55;
  const gridColor = theme.borderColor;
  const gridOpacity = 0.4;

  if (horizontal) {
    // --- Horizontal bars ---
    const rowH = stacked ? 34 : Math.max(22, datasets.length * 22 + cfg.barGap * (datasets.length - 1));
    const rowGap = 14;
    const marginTop = 16;
    const marginBottom = 32;
    const marginLeft = 96;
    const marginRight = 40;
    const chartH = marginTop + labels.length * (rowH + rowGap) + marginBottom;
    const chartW = 540;
    const plotW = chartW - marginLeft - marginRight;
    const plotH = chartH - marginTop - marginBottom;

    return (
      <svg width={chartW} height={chartH + (showLegend ? 44 : 0)} style={{ fontFamily }}>
        {/* Vertical grid lines */}
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const x = marginLeft + (i / gridLines) * plotW;
          const val = (i / gridLines) * niceMax;
          return (
            <g key={i}>
              <line
                x1={x} y1={marginTop} x2={x} y2={marginTop + plotH}
                stroke={gridColor} strokeWidth={1}
                strokeDasharray={i === 0 ? "none" : "3,4"} opacity={gridOpacity}
              />
              <text x={x} y={marginTop + plotH + 18} textAnchor="middle"
                fill={axisColor} fontSize={fontSize - 4} opacity={axisOpacity}>
                {formatValue(val)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {labels.map((label, li) => {
          const groupY = marginTop + li * (rowH + rowGap);
          let stackX = marginLeft;
          return (
            <g key={li}>
              <text x={marginLeft - 10} y={groupY + rowH / 2 + 4} textAnchor="end"
                fill={axisColor} fontSize={fontSize - 3} opacity={0.75}>
                {label.length > 12 ? label.slice(0, 11) + "\u2026" : label}
              </text>
              {stacked ? (
                datasets.map((ds, di) => {
                  const val = ds.values[li] || 0;
                  const w = (val / niceMax) * plotW;
                  const x = stackX;
                  stackX += w;
                  const isLast = di === datasets.length - 1;
                  return (
                    <g key={di}>
                      <rect x={x} y={groupY} width={Math.max(0, w)} height={rowH}
                        fill={colors[di]} rx={isLast ? cfg.barRadius : 0}
                        opacity={0.9} />
                      {showValues && val > 0 && w > 30 && (
                        <text x={x + w / 2} y={groupY + rowH / 2 + 4} textAnchor="middle"
                          fill="white" fontSize={fontSize - 5} fontWeight={600} opacity={0.95}>
                          {formatValue(val)}
                        </text>
                      )}
                    </g>
                  );
                })
              ) : (
                datasets.map((ds, di) => {
                  const barH = (rowH - cfg.barGap * (datasets.length - 1)) / datasets.length;
                  const val = ds.values[li] || 0;
                  const w = (val / niceMax) * plotW;
                  const y = groupY + di * (barH + cfg.barGap);
                  return (
                    <g key={di}>
                      <rect x={marginLeft} y={y} width={Math.max(0, w)} height={barH}
                        fill={colors[di]} rx={cfg.barRadius} ry={cfg.barRadius}
                        opacity={0.9} />
                      {showValues && val > 0 && (
                        <text x={marginLeft + w + 8} y={y + barH / 2 + 4} textAnchor="start"
                          fill={axisColor} fontSize={fontSize - 5} fontWeight={600}>
                          {formatValue(val)}
                        </text>
                      )}
                    </g>
                  );
                })
              )}
            </g>
          );
        })}

        {/* Legend */}
        {showLegend && (
          <g transform={`translate(${marginLeft}, ${chartH + 6})`}>
            {datasets.map((ds, i) => {
              const prevW = datasets.slice(0, i).reduce((acc, d) => acc + d.name.length * 7 + 36, 0);
              return (
                <g key={i} transform={`translate(${prevW}, 0)`}>
                  <rect width={10} height={10} fill={colors[i]} rx={3} y={1} />
                  <text x={16} y={10} fill={axisColor} fontSize={fontSize - 4} opacity={0.8}>{ds.name}</text>
                </g>
              );
            })}
          </g>
        )}
      </svg>
    );
  }

  // --- Vertical bars (default) ---
  const chartW = Math.max(500, labels.length * (stacked ? 52 : datasets.length * 34 + 44) + 80);
  const chartH = 340;
  const marginTop = 24;
  const marginBottom = 56;
  const marginLeft = 56;
  const marginRight = 20;
  const plotW = chartW - marginLeft - marginRight;
  const plotH = chartH - marginTop - marginBottom;

  const barGroupW = plotW / labels.length;
  const barW = stacked
    ? Math.min(44, barGroupW - 12)
    : Math.min(30, (barGroupW - 12 - cfg.barGap * (datasets.length - 1)) / datasets.length);

  return (
    <svg width={chartW} height={chartH + (showLegend ? 44 : 0)} style={{ fontFamily }}>
      <defs>
        {/* Gradient overlays for depth on bars */}
        {colors.map((color, i) => (
          <linearGradient key={i} id={`bar-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.12} />
            <stop offset="100%" stopColor="#000000" stopOpacity={0.08} />
          </linearGradient>
        ))}
      </defs>

      {/* Grid lines */}
      {Array.from({ length: gridLines + 1 }).map((_, i) => {
        const y = marginTop + plotH - (i / gridLines) * plotH;
        const val = (i / gridLines) * niceMax;
        return (
          <g key={i}>
            <line x1={marginLeft} y1={y} x2={chartW - marginRight} y2={y}
              stroke={gridColor} strokeWidth={1}
              strokeDasharray={i === 0 ? "none" : "3,4"} opacity={gridOpacity} />
            <text x={marginLeft - 10} y={y + 4} textAnchor="end"
              fill={axisColor} fontSize={fontSize - 4} opacity={axisOpacity}>
              {formatValue(val)}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {labels.map((label, li) => {
        const groupX = marginLeft + li * barGroupW;
        let stackY = marginTop + plotH;
        return (
          <g key={li}>
            {stacked ? (
              datasets.map((ds, di) => {
                const val = ds.values[li] || 0;
                const h = (val / niceMax) * plotH;
                stackY -= h;
                const x = groupX + (barGroupW - barW) / 2;
                const isTop = di === datasets.length - 1;
                return (
                  <g key={di}>
                    <rect x={x} y={stackY} width={barW} height={Math.max(0, h)}
                      fill={colors[di]} rx={isTop ? cfg.barRadius : 0} opacity={0.9} />
                    <rect x={x} y={stackY} width={barW} height={Math.max(0, h)}
                      fill={`url(#bar-grad-${di})`} rx={isTop ? cfg.barRadius : 0} />
                    {showValues && val > 0 && h > 18 && (
                      <text x={x + barW / 2} y={stackY + h / 2 + 4} textAnchor="middle"
                        fill="white" fontSize={fontSize - 5} fontWeight={600} opacity={0.95}>
                        {formatValue(val)}
                      </text>
                    )}
                  </g>
                );
              })
            ) : (
              datasets.map((ds, di) => {
                const val = ds.values[li] || 0;
                const h = (val / niceMax) * plotH;
                const x = groupX + (barGroupW - datasets.length * (barW + cfg.barGap) + cfg.barGap) / 2 + di * (barW + cfg.barGap);
                const y = marginTop + plotH - h;
                return (
                  <g key={di}>
                    <rect x={x} y={y} width={barW} height={h}
                      fill={colors[di]} rx={cfg.barRadius} ry={cfg.barRadius} opacity={0.9} />
                    <rect x={x} y={y} width={barW} height={h}
                      fill={`url(#bar-grad-${di})`} rx={cfg.barRadius} ry={cfg.barRadius} />
                    {showValues && val > 0 && (
                      <text x={x + barW / 2} y={y - 8} textAnchor="middle"
                        fill={axisColor} fontSize={fontSize - 5} fontWeight={600}>
                        {formatValue(val)}
                      </text>
                    )}
                  </g>
                );
              })
            )}
            <text x={groupX + barGroupW / 2} y={marginTop + plotH + 20} textAnchor="middle"
              fill={axisColor} fontSize={fontSize - 4} opacity={0.75}>
              {label.length > 12 ? label.slice(0, 11) + "\u2026" : label}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      {showLegend && (
        <g transform={`translate(${marginLeft}, ${chartH + 8})`}>
          {datasets.map((ds, i) => {
            const prevW = datasets.slice(0, i).reduce((acc, d) => acc + d.name.length * 7 + 36, 0);
            return (
              <g key={i} transform={`translate(${prevW}, 0)`}>
                <rect width={10} height={10} fill={colors[i]} rx={3} y={1} />
                <text x={16} y={10} fill={axisColor} fontSize={fontSize - 4} opacity={0.8}>{ds.name}</text>
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// LINE CHART
// ---------------------------------------------------------------------------

// Attempt monotone cubic interpolation for smooth curves
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

function LineChart({
  labels,
  datasets,
  colors,
  theme,
  fontSize,
  fontFamily,
  showValues,
  showLegend,
  cfg,
}: {
  labels: string[];
  datasets: { name: string; values: number[] }[];
  colors: string[];
  theme: TableTheme;
  fontSize: number;
  fontFamily: string;
  showValues: boolean;
  showLegend: boolean;
  cfg: LineChartConfig;
}) {
  const chartW = Math.max(500, labels.length * 80 + 100);
  const chartH = 340;
  const marginTop = 24;
  const marginBottom = 56;
  const marginLeft = 56;
  const marginRight = 20;
  const plotW = chartW - marginLeft - marginRight;
  const plotH = chartH - marginTop - marginBottom;

  const allValues = datasets.flatMap((d) => d.values);
  const maxVal = Math.max(...allValues, 1);
  const minVal = Math.min(...allValues, 0);
  const niceMax = niceScale(maxVal);
  const niceMin = Math.min(0, minVal);
  const niceRange = niceMax - niceMin || 1;
  const gridLines = 5;

  const axisColor = theme.rowText;
  const axisOpacity = 0.55;
  const gridColor = theme.borderColor;
  const gridOpacity = 0.4;

  const getX = (i: number) => marginLeft + (i / Math.max(1, labels.length - 1)) * plotW;
  const getY = (v: number) => marginTop + plotH - ((v - niceMin) / niceRange) * plotH;

  return (
    <svg width={chartW} height={chartH + (showLegend ? 44 : 0)} style={{ fontFamily }}>
      <defs>
        {/* Area fill gradients — fade from color to transparent */}
        {colors.map((color, i) => (
          <linearGradient key={`area-${i}`} id={`line-area-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        ))}
        {/* Glow filter for lines */}
        <filter id="line-glow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Grid */}
      {Array.from({ length: gridLines + 1 }).map((_, i) => {
        const y = marginTop + plotH - (i / gridLines) * plotH;
        const val = niceMin + (i / gridLines) * niceRange;
        return (
          <g key={i}>
            <line x1={marginLeft} y1={y} x2={chartW - marginRight} y2={y}
              stroke={gridColor} strokeWidth={1}
              strokeDasharray={i === 0 ? "none" : "3,4"} opacity={gridOpacity} />
            <text x={marginLeft - 10} y={y + 4} textAnchor="end"
              fill={axisColor} fontSize={fontSize - 4} opacity={axisOpacity}>
              {formatValue(val)}
            </text>
          </g>
        );
      })}

      {/* X-axis labels */}
      {labels.map((label, i) => (
        <text key={i} x={getX(i)} y={marginTop + plotH + 20} textAnchor="middle"
          fill={axisColor} fontSize={fontSize - 4} opacity={0.7}>
          {label.length > 12 ? label.slice(0, 11) + "\u2026" : label}
        </text>
      ))}

      {/* Lines + areas + dots */}
      {datasets.map((ds, di) => {
        const pts = ds.values.map((v, i) => ({ x: getX(i), y: getY(v) }));

        const lineD = cfg.curveType === "smooth"
          ? smoothPath(pts)
          : pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

        // Build area path
        const areaBottom = `L${getX(ds.values.length - 1)},${getY(niceMin)} L${getX(0)},${getY(niceMin)} Z`;
        const areaD = `${lineD} ${areaBottom}`;

        return (
          <g key={di}>
            {cfg.showArea && (
              <path d={areaD} fill={`url(#line-area-${di})`} />
            )}
            {/* Subtle glow line behind for depth */}
            <path d={lineD} fill="none" stroke={colors[di]}
              strokeWidth={cfg.lineWidth + 3} strokeLinejoin="round" strokeLinecap="round"
              opacity={0.15} />
            {/* Main line */}
            <path d={lineD} fill="none" stroke={colors[di]}
              strokeWidth={cfg.lineWidth} strokeLinejoin="round" strokeLinecap="round" />
            {cfg.showDots && ds.values.map((v, i) => (
              <g key={i}>
                {/* Outer glow ring */}
                <circle cx={getX(i)} cy={getY(v)} r={cfg.lineWidth + 4}
                  fill={colors[di]} opacity={0.15} />
                {/* Dot */}
                <circle cx={getX(i)} cy={getY(v)} r={cfg.lineWidth + 1.5}
                  fill={theme.rowBg} stroke={colors[di]} strokeWidth={2} />
                {showValues && (
                  <text x={getX(i)} y={getY(v) - cfg.lineWidth - 10} textAnchor="middle"
                    fill={axisColor} fontSize={fontSize - 5} fontWeight={600}>
                    {formatValue(v)}
                  </text>
                )}
              </g>
            ))}
            {!cfg.showDots && showValues && ds.values.map((v, i) => (
              <text key={i} x={getX(i)} y={getY(v) - 10} textAnchor="middle"
                fill={axisColor} fontSize={fontSize - 5} fontWeight={600}>
                {formatValue(v)}
              </text>
            ))}
          </g>
        );
      })}

      {/* Legend */}
      {showLegend && (
        <g transform={`translate(${marginLeft}, ${chartH + 8})`}>
          {datasets.map((ds, i) => {
            const prevW = datasets.slice(0, i).reduce((acc, d) => acc + d.name.length * 7 + 36, 0);
            return (
              <g key={i} transform={`translate(${prevW}, 0)`}>
                <line x1={0} y1={6} x2={14} y2={6} stroke={colors[i]}
                  strokeWidth={cfg.lineWidth} strokeLinecap="round" />
                {cfg.showDots && <circle cx={7} cy={6} r={3} fill={colors[i]} />}
                <text x={20} y={10} fill={axisColor} fontSize={fontSize - 4} opacity={0.8}>{ds.name}</text>
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// PIE CHART
// ---------------------------------------------------------------------------
function PieChart({
  labels: rawLabels,
  values: rawValues,
  colors,
  theme,
  fontSize,
  fontFamily,
  showValues,
  showLegend,
  cfg,
}: {
  labels: string[];
  values: number[];
  colors: string[];
  theme: TableTheme;
  fontSize: number;
  fontFamily: string;
  showValues: boolean;
  showLegend: boolean;
  cfg: PieChartConfig;
}) {
  const size = 340;
  const cx = size / 2;
  const cy = size / 2;
  const r = 124;
  const innerR = cfg.innerRadius;
  const isDonut = innerR > 0;
  const sliceGap = rawValues.length > 1 ? 1.5 : 0; // px gap between slices

  // Optionally sort slices by value (largest first)
  const indices = rawLabels.map((_, i) => i);
  if (cfg.sortSlices) {
    indices.sort((a, b) => Math.abs(rawValues[b]) - Math.abs(rawValues[a]));
  }
  const labels = indices.map((i) => rawLabels[i]);
  const values = indices.map((i) => rawValues[i]);
  const sortedColors = indices.map((i) => colors[i % colors.length]);

  const total = values.reduce((a, b) => a + Math.abs(b), 0) || 1;
  const legendW = showLegend ? 190 : 0;
  const totalW = size + legendW;

  const axisColor = theme.rowText;

  const startRad = (cfg.startAngle - 90) * (Math.PI / 180);

  /* eslint-disable react-hooks/preserve-manual-memoization */
  const slices = useMemo(() => {
    return values.map((val, i) => {
      const priorSum = values.slice(0, i).reduce((s, v) => s + Math.abs(v), 0);
      const portion = Math.abs(val) / total;
      const startAngle = startRad + (priorSum / total) * 2 * Math.PI;
      const endAngle = startAngle + portion * 2 * Math.PI;

      // Offset each slice slightly away from center for gap effect
      const midAngle = startAngle + (endAngle - startAngle) / 2;
      const gapOffset = sliceGap > 0 && values.length > 1 ? sliceGap : 0;
      const offX = gapOffset * Math.cos(midAngle);
      const offY = gapOffset * Math.sin(midAngle);

      const x1 = cx + offX + r * Math.cos(startAngle);
      const y1 = cy + offY + r * Math.sin(startAngle);
      const x2 = cx + offX + r * Math.cos(endAngle);
      const y2 = cy + offY + r * Math.sin(endAngle);
      const largeArc = portion > 0.5 ? 1 : 0;

      let d: string;
      if (isDonut) {
        const ix1 = cx + offX + innerR * Math.cos(startAngle);
        const iy1 = cy + offY + innerR * Math.sin(startAngle);
        const ix2 = cx + offX + innerR * Math.cos(endAngle);
        const iy2 = cy + offY + innerR * Math.sin(endAngle);
        d = [
          `M ${ix1} ${iy1}`,
          `L ${x1} ${y1}`,
          `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
          `L ${ix2} ${iy2}`,
          `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1}`,
          "Z",
        ].join(" ");
      } else {
        d = [
          `M ${cx + offX} ${cy + offY}`,
          `L ${x1} ${y1}`,
          `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
          "Z",
        ].join(" ");
      }

      const outsideLabelR = r + 26;
      const insideLabelR = isDonut ? (r + innerR) / 2 : r * 0.62;
      const outsideX = cx + outsideLabelR * Math.cos(midAngle);
      const outsideY = cy + outsideLabelR * Math.sin(midAngle);
      const insideX = cx + insideLabelR * Math.cos(midAngle);
      const insideY = cy + insideLabelR * Math.sin(midAngle);

      return { d, portion, outsideX, outsideY, insideX, insideY, val, label: labels[i], midAngle };
    });
  }, [values, labels, cx, cy, r, innerR, isDonut, total, startRad, sliceGap]);
  /* eslint-enable react-hooks/preserve-manual-memoization */

  return (
    <svg width={totalW} height={size} style={{ fontFamily }}>
      <defs>
        {/* Subtle highlight gradient on each slice */}
        {sortedColors.map((color, i) => (
          <linearGradient key={i} id={`pie-grad-${i}`} x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.15} />
            <stop offset="50%" stopColor="#ffffff" stopOpacity={0} />
            <stop offset="100%" stopColor="#000000" stopOpacity={0.1} />
          </linearGradient>
        ))}
        {/* Donut center shadow */}
        {isDonut && (
          <radialGradient id="donut-shadow" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="transparent" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.08)" />
          </radialGradient>
        )}
      </defs>

      {/* Slices */}
      {slices.map((slice, i) => (
        <g key={i}>
          <path d={slice.d} fill={sortedColors[i]} />
          {/* Highlight overlay */}
          <path d={slice.d} fill={`url(#pie-grad-${i})`} />
          {showValues && slice.portion > 0.04 && cfg.labelPosition !== "none" && (
            <text
              x={cfg.labelPosition === "inside" ? slice.insideX : slice.outsideX}
              y={cfg.labelPosition === "inside" ? slice.insideY : slice.outsideY}
              textAnchor="middle" dominantBaseline="central"
              fill={cfg.labelPosition === "inside" ? "white" : axisColor}
              fontSize={fontSize - 4} fontWeight={600}
              opacity={cfg.labelPosition === "inside" ? 0.95 : 0.85}>
              {(slice.portion * 100).toFixed(0)}%
            </text>
          )}
        </g>
      ))}

      {/* Donut center overlay for depth */}
      {isDonut && (
        <circle cx={cx} cy={cy} r={innerR} fill="transparent" />
      )}

      {/* Center total (donut only) */}
      {isDonut && (
        <>
          <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="central"
            fill={axisColor} fontSize={fontSize + 2} fontWeight={700} letterSpacing="-0.02em">
            {formatValue(total)}
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" dominantBaseline="central"
            fill={axisColor} fontSize={fontSize - 5} opacity={0.4} fontWeight={500}
            letterSpacing="0.06em" style={{ textTransform: "uppercase" }}>
            total
          </text>
        </>
      )}

      {/* Legend */}
      {showLegend && (
        <g transform={`translate(${size + 12}, ${Math.max(20, (size - labels.length * 26) / 2)})`}>
          {labels.map((label, i) => (
            <g key={i} transform={`translate(0, ${i * 26})`}>
              <rect width={10} height={10} fill={sortedColors[i]} rx={3} y={1} />
              <text x={18} y={10} fill={axisColor} fontSize={fontSize - 4} opacity={0.85}>
                {label.length > 14 ? label.slice(0, 13) + "\u2026" : label}
              </text>
              <text x={175} y={10} textAnchor="end" fill={axisColor}
                fontSize={fontSize - 4} opacity={0.5} fontWeight={500}>
                {formatValue(values[i])}
              </text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// MAIN EXPORT
// ---------------------------------------------------------------------------
export default function ChartRenderer({
  data,
  theme,
  config,
  vizMode,
  fontSize,
  fontOverride,
  title,
}: ChartProps) {
  const fontFamily = fontOverride || theme.fontFamily;

  const labels = useMemo(() => {
    return data.rows.map((row) => row[config.labelColumn] || "");
  }, [data.rows, config.labelColumn]);

  const datasets = useMemo(() => {
    return config.valueColumns.map((colIdx) => ({
      name: data.headers[colIdx] || `Column ${colIdx + 1}`,
      values: data.rows.map((row) => parseNumericValue(row[colIdx] || "0")),
    }));
  }, [data, config.valueColumns]);

  const colors = useMemo(() => {
    const auto = generateChartColors(theme, Math.max(datasets.length, labels.length));
    const custom = config.customColors;
    if (!custom || Object.keys(custom).length === 0) return auto;
    if (vizMode === "bar" || vizMode === "line") {
      return datasets.map((ds, i) => custom[ds.name] || auto[i]);
    }
    // pie: keyed by label
    return labels.map((label, i) => custom[label] || auto[i]);
  }, [theme, datasets, labels, config.customColors, vizMode]);

  return (
    <div style={{ fontFamily, overflow: "hidden", width: "100%" }}>
      {title && (
        <div
          style={{
            background: theme.headerBg,
            color: theme.headerText,
            padding: "10px 24px",
            fontSize: `${fontSize + 2}px`,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            borderBottom: `1px solid ${theme.borderColor}`,
            display: "flex",
            alignItems: "center",
            minHeight: "44px",
          }}
        >
          <span>{title}</span>
        </div>
      )}

      <div
        style={{
          background: theme.rowBg,
          padding: "28px 24px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "320px",
          overflowX: "auto",
        }}
      >
        {vizMode === "bar" && (
          <BarChart labels={labels} datasets={datasets} colors={colors} theme={theme}
            fontSize={fontSize} fontFamily={fontFamily}
            showValues={config.showValues} showLegend={config.showLegend} cfg={config.bar} />
        )}
        {vizMode === "line" && (
          <LineChart labels={labels} datasets={datasets} colors={colors} theme={theme}
            fontSize={fontSize} fontFamily={fontFamily}
            showValues={config.showValues} showLegend={config.showLegend} cfg={config.line} />
        )}
        {vizMode === "pie" && (
          <PieChart labels={labels} values={datasets[0]?.values || []} colors={colors} theme={theme}
            fontSize={fontSize} fontFamily={fontFamily}
            showValues={config.showValues} showLegend={config.showLegend} cfg={config.pie} />
        )}
      </div>
    </div>
  );
}
