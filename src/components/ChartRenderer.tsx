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

function generateChartColors(theme: TableTheme, count: number): string[] {
  const palette = [
    theme.headerBg.includes("gradient") ? "#6e56cf" : theme.headerBg,
    "#3ECF8E",
    "#36B6F0",
    "#F97316",
    "#EF4444",
    "#A855F7",
    "#EC4899",
    "#14B8A6",
    "#EAB308",
    "#6366F1",
    "#8B5CF6",
    "#06B6D4",
  ];
  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    colors.push(palette[i % palette.length]);
  }
  return colors;
}

function parseNumericValue(val: string): number {
  const cleaned = val.replace(/[,$%]/g, "").trim();
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
}

function niceScale(maxVal: number): number {
  if (maxVal <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(maxVal)));
  return Math.ceil(maxVal / mag) * mag;
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

  if (horizontal) {
    // --- Horizontal bars ---
    const rowH = stacked ? 32 : Math.max(20, datasets.length * 20 + cfg.barGap * (datasets.length - 1));
    const rowGap = 12;
    const marginTop = 20;
    const marginBottom = 30;
    const marginLeft = 90;
    const marginRight = 40;
    const chartH = marginTop + labels.length * (rowH + rowGap) + marginBottom;
    const chartW = 540;
    const plotW = chartW - marginLeft - marginRight;
    const plotH = chartH - marginTop - marginBottom;

    return (
      <svg width={chartW} height={chartH + (showLegend ? 40 : 0)} style={{ fontFamily }}>
        {/* Vertical grid lines */}
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const x = marginLeft + (i / gridLines) * plotW;
          const val = (i / gridLines) * niceMax;
          return (
            <g key={i}>
              <line
                x1={x} y1={marginTop} x2={x} y2={marginTop + plotH}
                stroke={theme.borderColor} strokeWidth={1}
                strokeDasharray={i === 0 ? "none" : "4,4"} opacity={0.5}
              />
              <text x={x} y={marginTop + plotH + 16} textAnchor="middle"
                fill={theme.rowText} fontSize={fontSize - 4} opacity={0.7}>
                {val % 1 === 0 ? val : val.toFixed(1)}
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
              <text x={marginLeft - 8} y={groupY + rowH / 2 + 4} textAnchor="end"
                fill={theme.rowText} fontSize={fontSize - 4} opacity={0.8}>
                {label.length > 10 ? label.slice(0, 9) + "\u2026" : label}
              </text>
              {stacked ? (
                datasets.map((ds, di) => {
                  const val = ds.values[li] || 0;
                  const w = (val / niceMax) * plotW;
                  const x = stackX;
                  stackX += w;
                  return (
                    <g key={di}>
                      <rect x={x} y={groupY} width={Math.max(0, w)} height={rowH}
                        fill={colors[di]} rx={di === datasets.length - 1 ? cfg.barRadius : 0} />
                      {showValues && val > 0 && w > 24 && (
                        <text x={x + w / 2} y={groupY + rowH / 2 + 4} textAnchor="middle"
                          fill="white" fontSize={fontSize - 5} fontWeight={500}>
                          {val % 1 === 0 ? val : val.toFixed(1)}
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
                        fill={colors[di]} rx={cfg.barRadius} ry={cfg.barRadius} />
                      {showValues && val > 0 && (
                        <text x={marginLeft + w + 6} y={y + barH / 2 + 4} textAnchor="start"
                          fill={theme.rowText} fontSize={fontSize - 5} fontWeight={500}>
                          {val % 1 === 0 ? val : val.toFixed(1)}
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
        {showLegend && datasets.length > 1 && (
          <g transform={`translate(${marginLeft}, ${chartH + 4})`}>
            {datasets.map((ds, i) => (
              <g key={i} transform={`translate(${i * 120}, 0)`}>
                <rect width={12} height={12} fill={colors[i]} rx={2} />
                <text x={18} y={10} fill={theme.rowText} fontSize={fontSize - 4}>{ds.name}</text>
              </g>
            ))}
          </g>
        )}
      </svg>
    );
  }

  // --- Vertical bars (default) ---
  const chartW = Math.max(500, labels.length * (stacked ? 48 : datasets.length * 32 + 40) + 80);
  const chartH = 340;
  const marginTop = 30;
  const marginBottom = 60;
  const marginLeft = 60;
  const marginRight = 20;
  const plotW = chartW - marginLeft - marginRight;
  const plotH = chartH - marginTop - marginBottom;

  const barGroupW = plotW / labels.length;
  const barW = stacked
    ? Math.min(40, barGroupW - 12)
    : Math.min(28, (barGroupW - 12 - cfg.barGap * (datasets.length - 1)) / datasets.length);

  return (
    <svg width={chartW} height={chartH + (showLegend ? 40 : 0)} style={{ fontFamily }}>
      {/* Grid lines */}
      {Array.from({ length: gridLines + 1 }).map((_, i) => {
        const y = marginTop + plotH - (i / gridLines) * plotH;
        const val = (i / gridLines) * niceMax;
        return (
          <g key={i}>
            <line x1={marginLeft} y1={y} x2={chartW - marginRight} y2={y}
              stroke={theme.borderColor} strokeWidth={1}
              strokeDasharray={i === 0 ? "none" : "4,4"} opacity={0.5} />
            <text x={marginLeft - 10} y={y + 4} textAnchor="end"
              fill={theme.rowText} fontSize={fontSize - 4} opacity={0.7}>
              {val % 1 === 0 ? val : val.toFixed(1)}
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
                return (
                  <g key={di}>
                    <rect x={x} y={stackY} width={barW} height={Math.max(0, h)}
                      fill={colors[di]} rx={di === datasets.length - 1 ? cfg.barRadius : 0} />
                    {showValues && val > 0 && h > 16 && (
                      <text x={x + barW / 2} y={stackY + h / 2 + 4} textAnchor="middle"
                        fill="white" fontSize={fontSize - 5} fontWeight={500}>
                        {val % 1 === 0 ? val : val.toFixed(1)}
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
                      fill={colors[di]} rx={cfg.barRadius} ry={cfg.barRadius} />
                    {showValues && val > 0 && (
                      <text x={x + barW / 2} y={y - 6} textAnchor="middle"
                        fill={theme.rowText} fontSize={fontSize - 5} fontWeight={500}>
                        {val % 1 === 0 ? val : val.toFixed(1)}
                      </text>
                    )}
                  </g>
                );
              })
            )}
            <text x={groupX + barGroupW / 2} y={marginTop + plotH + 20} textAnchor="middle"
              fill={theme.rowText} fontSize={fontSize - 4} opacity={0.8}>
              {label.length > 12 ? label.slice(0, 11) + "\u2026" : label}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      {showLegend && datasets.length > 1 && (
        <g transform={`translate(${marginLeft}, ${chartH + 10})`}>
          {datasets.map((ds, i) => (
            <g key={i} transform={`translate(${i * 120}, 0)`}>
              <rect width={12} height={12} fill={colors[i]} rx={2} />
              <text x={18} y={10} fill={theme.rowText} fontSize={fontSize - 4}>{ds.name}</text>
            </g>
          ))}
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
  const marginTop = 30;
  const marginBottom = 60;
  const marginLeft = 60;
  const marginRight = 20;
  const plotW = chartW - marginLeft - marginRight;
  const plotH = chartH - marginTop - marginBottom;

  const allValues = datasets.flatMap((d) => d.values);
  const maxVal = Math.max(...allValues, 1);
  const minVal = Math.min(...allValues, 0);
  const range = maxVal - minVal || 1;
  const niceMax = niceScale(maxVal);
  const niceMin = Math.min(0, minVal);
  const niceRange = niceMax - niceMin || 1;
  const gridLines = 5;

  const getX = (i: number) => marginLeft + (i / Math.max(1, labels.length - 1)) * plotW;
  const getY = (v: number) => marginTop + plotH - ((v - niceMin) / niceRange) * plotH;

  return (
    <svg width={chartW} height={chartH + (showLegend ? 40 : 0)} style={{ fontFamily }}>
      {/* Grid */}
      {Array.from({ length: gridLines + 1 }).map((_, i) => {
        const y = marginTop + plotH - (i / gridLines) * plotH;
        const val = niceMin + (i / gridLines) * niceRange;
        return (
          <g key={i}>
            <line x1={marginLeft} y1={y} x2={chartW - marginRight} y2={y}
              stroke={theme.borderColor} strokeWidth={1}
              strokeDasharray={i === 0 ? "none" : "4,4"} opacity={0.5} />
            <text x={marginLeft - 10} y={y + 4} textAnchor="end"
              fill={theme.rowText} fontSize={fontSize - 4} opacity={0.7}>
              {val % 1 === 0 ? val : val.toFixed(1)}
            </text>
          </g>
        );
      })}

      {/* X-axis labels */}
      {labels.map((label, i) => (
        <text key={i} x={getX(i)} y={marginTop + plotH + 20} textAnchor="middle"
          fill={theme.rowText} fontSize={fontSize - 4} opacity={0.8}>
          {label.length > 12 ? label.slice(0, 11) + "\u2026" : label}
        </text>
      ))}

      {/* Lines + dots */}
      {datasets.map((ds, di) => {
        const pts = ds.values.map((v, i) => ({ x: getX(i), y: getY(v) }));

        const lineD = cfg.curveType === "smooth"
          ? smoothPath(pts)
          : pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

        // Build area path by appending bottom baseline
        const areaBottom = `L${getX(ds.values.length - 1)},${getY(niceMin)} L${getX(0)},${getY(niceMin)} Z`;
        const areaD = `${lineD} ${areaBottom}`;

        return (
          <g key={di}>
            {cfg.showArea && <path d={areaD} fill={colors[di]} opacity={0.1} />}
            <path d={lineD} fill="none" stroke={colors[di]}
              strokeWidth={cfg.lineWidth} strokeLinejoin="round" strokeLinecap="round" />
            {cfg.showDots && ds.values.map((v, i) => (
              <g key={i}>
                <circle cx={getX(i)} cy={getY(v)} r={cfg.lineWidth + 2}
                  fill={colors[di]} stroke={theme.rowBg} strokeWidth={2} />
                {showValues && (
                  <text x={getX(i)} y={getY(v) - cfg.lineWidth - 8} textAnchor="middle"
                    fill={theme.rowText} fontSize={fontSize - 5} fontWeight={500}>
                    {v % 1 === 0 ? v : v.toFixed(1)}
                  </text>
                )}
              </g>
            ))}
            {!cfg.showDots && showValues && ds.values.map((v, i) => (
              <text key={i} x={getX(i)} y={getY(v) - 8} textAnchor="middle"
                fill={theme.rowText} fontSize={fontSize - 5} fontWeight={500}>
                {v % 1 === 0 ? v : v.toFixed(1)}
              </text>
            ))}
          </g>
        );
      })}

      {/* Legend */}
      {showLegend && datasets.length > 1 && (
        <g transform={`translate(${marginLeft}, ${chartH + 10})`}>
          {datasets.map((ds, i) => (
            <g key={i} transform={`translate(${i * 120}, 0)`}>
              <line x1={0} y1={6} x2={14} y2={6} stroke={colors[i]}
                strokeWidth={cfg.lineWidth} strokeLinecap="round" />
              {cfg.showDots && <circle cx={7} cy={6} r={3} fill={colors[i]} />}
              <text x={20} y={10} fill={theme.rowText} fontSize={fontSize - 4}>{ds.name}</text>
            </g>
          ))}
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
  const r = 120;
  const innerR = cfg.innerRadius;
  const isDonut = innerR > 0;

  // Optionally sort slices by value (largest first)
  const indices = rawLabels.map((_, i) => i);
  if (cfg.sortSlices) {
    indices.sort((a, b) => Math.abs(rawValues[b]) - Math.abs(rawValues[a]));
  }
  const labels = indices.map((i) => rawLabels[i]);
  const values = indices.map((i) => rawValues[i]);
  const sortedColors = indices.map((i) => colors[i % colors.length]);

  const total = values.reduce((a, b) => a + Math.abs(b), 0) || 1;
  const legendW = showLegend ? 180 : 0;
  const totalW = size + legendW;

  const startRad = (cfg.startAngle - 90) * (Math.PI / 180); // convert degrees, 0 = 12 o'clock

  const slices = useMemo(() => {
    let angle = startRad;
    return values.map((val, i) => {
      const portion = Math.abs(val) / total;
      const startAngle = angle;
      const endAngle = angle + portion * 2 * Math.PI;
      angle = endAngle;

      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const largeArc = portion > 0.5 ? 1 : 0;

      let d: string;
      if (isDonut) {
        const ix1 = cx + innerR * Math.cos(startAngle);
        const iy1 = cy + innerR * Math.sin(startAngle);
        const ix2 = cx + innerR * Math.cos(endAngle);
        const iy2 = cy + innerR * Math.sin(endAngle);
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
          `M ${cx} ${cy}`,
          `L ${x1} ${y1}`,
          `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
          "Z",
        ].join(" ");
      }

      const midAngle = startAngle + (endAngle - startAngle) / 2;
      const outsideLabelR = r + 24;
      const insideLabelR = isDonut ? (r + innerR) / 2 : r * 0.65;
      const outsideX = cx + outsideLabelR * Math.cos(midAngle);
      const outsideY = cy + outsideLabelR * Math.sin(midAngle);
      const insideX = cx + insideLabelR * Math.cos(midAngle);
      const insideY = cy + insideLabelR * Math.sin(midAngle);

      return { d, portion, outsideX, outsideY, insideX, insideY, val, label: labels[i] };
    });
  }, [values, labels, cx, cy, r, innerR, isDonut, total, startRad]);

  return (
    <svg width={totalW} height={size} style={{ fontFamily }}>
      {/* Slices */}
      {slices.map((slice, i) => (
        <g key={i}>
          <path d={slice.d} fill={sortedColors[i]} />
          {showValues && slice.portion > 0.04 && cfg.labelPosition !== "none" && (
            <text
              x={cfg.labelPosition === "inside" ? slice.insideX : slice.outsideX}
              y={cfg.labelPosition === "inside" ? slice.insideY : slice.outsideY}
              textAnchor="middle" dominantBaseline="central"
              fill={cfg.labelPosition === "inside" ? "white" : theme.rowText}
              fontSize={fontSize - 4} fontWeight={500}>
              {(slice.portion * 100).toFixed(0)}%
            </text>
          )}
        </g>
      ))}

      {/* Center total (donut only) */}
      {isDonut && (
        <>
          <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="central"
            fill={theme.rowText} fontSize={fontSize - 2} fontWeight={600}>
            {total % 1 === 0 ? total : total.toFixed(1)}
          </text>
          <text x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="central"
            fill={theme.rowText} fontSize={fontSize - 5} opacity={0.5}>
            total
          </text>
        </>
      )}

      {/* Legend */}
      {showLegend && (
        <g transform={`translate(${size + 10}, 20)`}>
          {labels.map((label, i) => (
            <g key={i} transform={`translate(0, ${i * 24})`}>
              <rect width={10} height={10} fill={sortedColors[i]} rx={2} y={1} />
              <text x={16} y={10} fill={theme.rowText} fontSize={fontSize - 4}>
                {label.length > 16 ? label.slice(0, 15) + "\u2026" : label}
              </text>
              <text x={168} y={10} textAnchor="end" fill={theme.rowText}
                fontSize={fontSize - 4} opacity={0.6}>
                {values[i]}
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

  const colors = useMemo(
    () => generateChartColors(theme, Math.max(datasets.length, labels.length)),
    [theme, datasets.length, labels.length]
  );

  return (
    <div style={{ fontFamily, overflow: "hidden", width: "100%" }}>
      {title && (
        <div
          style={{
            background: theme.headerBg,
            color: theme.headerText,
            padding: "10px 20px",
            fontSize: `${fontSize + 2}px`,
            fontWeight: 700,
            letterSpacing: "0.01em",
            borderBottom: `1px solid ${theme.borderColor}`,
            display: "flex",
            alignItems: "center",
            minHeight: "42px",
          }}
        >
          <span>{title}</span>
        </div>
      )}

      <div
        style={{
          background: theme.rowBg,
          padding: "24px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "300px",
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
