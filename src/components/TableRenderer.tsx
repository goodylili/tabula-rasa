"use client";

import React, { useMemo, useState } from "react";
import { TableData, TableTheme } from "@/lib/types";
import { ArrowUp, ArrowDown, ArrowUpDown, Search } from "lucide-react";

interface TableRendererProps {
  data: TableData;
  theme: TableTheme;
  fontSize: number;
  showGrid: boolean;
  stripedRows: boolean;
  highlightFirstRow?: boolean;
  highlightFirstCol?: boolean;
  borderRadius?: number;
  title?: string;
  interactive?: boolean;
}

type SortDir = "asc" | "desc" | null;

export default function TableRenderer({
  data,
  theme,
  fontSize,
  showGrid,
  stripedRows,
  highlightFirstRow = false,
  highlightFirstCol = false,
  borderRadius,
  title,
  interactive = false,
}: TableRendererProps) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [filters, setFilters] = useState<Record<number, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  const isGradient = (val: string) =>
    val.includes("gradient") || val.includes("linear") || val.includes("radial");

  const handleSort = (colIdx: number) => {
    if (!interactive) return;
    if (sortCol === colIdx) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") {
        setSortCol(null);
        setSortDir(null);
      }
    } else {
      setSortCol(colIdx);
      setSortDir("asc");
    }
  };

  const handleFilter = (colIdx: number, value: string) => {
    setFilters((prev) => ({ ...prev, [colIdx]: value }));
  };

  const processedRows = useMemo(() => {
    let rows = [...data.rows];

    if (interactive) {
      Object.entries(filters).forEach(([col, term]) => {
        if (term.trim()) {
          const colIdx = Number(col);
          const lower = term.toLowerCase();
          rows = rows.filter((row) =>
            (row[colIdx] ?? "").toLowerCase().includes(lower)
          );
        }
      });
    }

    if (interactive && sortCol !== null && sortDir !== null) {
      rows.sort((a, b) => {
        const aVal = a[sortCol] ?? "";
        const bVal = b[sortCol] ?? "";
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        const isNumeric = !isNaN(aNum) && !isNaN(bNum) && aVal !== "" && bVal !== "";

        let cmp: number;
        if (isNumeric) {
          cmp = aNum - bNum;
        } else {
          cmp = aVal.localeCompare(bVal);
        }
        return sortDir === "desc" ? -cmp : cmp;
      });
    }

    return rows;
  }, [data.rows, filters, sortCol, sortDir, interactive]);

  const hasActiveFilters = Object.values(filters).some((v) => v.trim());

  // Determine cell background and text color based on position
  const getCellStyle = (ri: number, ci: number) => {
    const isHighlightedRow = highlightFirstRow && ri === 0;
    const isHighlightedCol = highlightFirstCol && ci === 0;
    const isHighlighted = isHighlightedRow || isHighlightedCol;

    // For striping, offset index when first row is highlighted so stripe pattern
    // starts fresh on the non-highlighted rows
    const stripeIndex = highlightFirstRow ? ri - 1 : ri;
    const isAlt = !isHighlighted && stripedRows && stripeIndex % 2 === 1;

    let bg: string;
    let color: string = theme.rowText;

    if (isHighlighted) {
      bg = theme.accentBg;
      color = theme.accentText;
    } else if (isAlt) {
      bg = theme.altRowBg;
    } else {
      bg = theme.rowBg;
    }

    return {
      background: bg,
      color,
      padding: "11px 18px",
      borderBottom: showGrid ? `1px solid ${theme.borderColor}` : "none",
      borderRight:
        showGrid && ci < data.headers.length - 1
          ? `1px solid ${theme.borderColor}`
          : "none",
      whiteSpace: "nowrap" as const,
      fontWeight: isHighlighted ? 600 : 400,
    };
  };

  return (
    <div
      style={{
        fontFamily: theme.fontFamily,
        borderRadius: borderRadius != null ? `${borderRadius}px` : theme.borderRadius,
        boxShadow: theme.shadow,
        overflow: "hidden",
        width: "100%",
      }}
    >
      {/* Title bar — only when there's a title */}
      {title && (
        <div
          style={{
            background: isGradient(theme.headerBg) ? theme.headerBg : theme.headerBg,
            color: theme.headerText,
            padding: "10px 20px",
            fontSize: `${fontSize + 2}px`,
            fontWeight: 700,
            letterSpacing: "0.01em",
            borderBottom: `1px solid ${theme.borderColor}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: "42px",
          }}
        >
          <span>{title}</span>
        </div>
      )}

      {/* Interactive toolbar — separate from title, only in interactive mode */}
      {interactive && (
        <div
          style={{
            background: theme.rowBg,
            color: theme.rowText,
            padding: "6px 16px",
            borderBottom: `1px solid ${theme.borderColor}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "8px",
            fontSize: `${fontSize - 2}px`,
          }}
        >
          {hasActiveFilters && (
            <button
              onClick={() => setFilters({})}
              style={{
                padding: "2px 8px",
                borderRadius: "4px",
                background: "rgba(255,255,255,0.1)",
                color: theme.rowText,
                border: "none",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: `${fontSize - 2}px`,
              }}
            >
              Clear filters
            </button>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              background: showFilters ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)",
              border: "none",
              borderRadius: "6px",
              padding: "4px 8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              color: theme.rowText,
              fontSize: `${fontSize - 2}px`,
            }}
          >
            <Search size={11} />
            Filter
          </button>
          <span style={{ opacity: 0.5 }}>
            {processedRows.length} row{processedRows.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: showGrid ? "collapse" : "separate",
            borderSpacing: showGrid ? 0 : "0 2px",
            fontSize: `${fontSize}px`,
          }}
        >
          <thead>
            {/* Filter row */}
            {interactive && showFilters && (
              <tr>
                {data.headers.map((_, i) => (
                  <th
                    key={`filter-${i}`}
                    style={{
                      background: isGradient(theme.headerBg)
                        ? theme.rowBg
                        : theme.headerBg,
                      padding: "6px 12px",
                      borderBottom: `1px solid ${theme.borderColor}`,
                      borderRight:
                        showGrid && i < data.headers.length - 1
                          ? `1px solid ${theme.borderColor}`
                          : "none",
                    }}
                  >
                    <input
                      type="text"
                      value={filters[i] ?? ""}
                      onChange={(e) => handleFilter(i, e.target.value)}
                      placeholder="Filter..."
                      style={{
                        width: "100%",
                        background: "rgba(255,255,255,0.08)",
                        border: `1px solid ${theme.borderColor}`,
                        borderRadius: "4px",
                        padding: "3px 8px",
                        fontSize: `${fontSize - 2}px`,
                        color: theme.rowText,
                        outline: "none",
                        fontFamily: theme.fontFamily,
                      }}
                    />
                  </th>
                ))}
              </tr>
            )}

            {/* Header row */}
            <tr>
              {data.headers.map((header, i) => (
                <th
                  key={i}
                  onClick={() => handleSort(i)}
                  style={{
                    background: isGradient(theme.headerBg)
                      ? theme.headerBg
                      : theme.headerBg,
                    color: theme.headerText,
                    padding: "12px 18px",
                    textAlign: "left",
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    fontSize: `${fontSize - 1}px`,
                    borderBottom: showGrid
                      ? `2px solid ${theme.borderColor}`
                      : "none",
                    borderRight:
                      showGrid && i < data.headers.length - 1
                        ? `1px solid ${theme.borderColor}`
                        : "none",
                    whiteSpace: "nowrap",
                    cursor: interactive ? "pointer" : "default",
                    userSelect: interactive ? "none" : "auto",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {header}
                    {interactive && (
                      <span style={{ opacity: sortCol === i ? 1 : 0.3, display: "inline-flex" }}>
                        {sortCol === i && sortDir === "asc" ? (
                          <ArrowUp size={12} />
                        ) : sortCol === i && sortDir === "desc" ? (
                          <ArrowDown size={12} />
                        ) : (
                          <ArrowUpDown size={12} />
                        )}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processedRows.length === 0 && interactive ? (
              <tr>
                <td
                  colSpan={data.headers.length}
                  style={{
                    color: theme.rowText,
                    padding: "24px 18px",
                    textAlign: "center",
                    opacity: 0.5,
                    background: theme.rowBg,
                  }}
                >
                  No rows match the current filters
                </td>
              </tr>
            ) : (
              processedRows.map((row, ri) => (
                <tr
                  key={ri}
                  style={{ transition: "background 0.15s" }}
                >
                  {row.map((cell, ci) => (
                    <td key={ci} style={getCellStyle(ri, ci)}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
