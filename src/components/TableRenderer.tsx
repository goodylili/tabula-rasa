"use client";

import React from "react";
import { TableData, TableTheme } from "@/lib/types";

interface TableRendererProps {
  data: TableData;
  theme: TableTheme;
  fontSize: number;
  showGrid: boolean;
  stripedRows: boolean;
  title?: string;
}

export default function TableRenderer({
  data,
  theme,
  fontSize,
  showGrid,
  stripedRows,
  title,
}: TableRendererProps) {
  const isGradient = (val: string) => val.includes("gradient") || val.includes("linear") || val.includes("radial");

  return (
    <div
      style={{
        fontFamily: theme.fontFamily,
        borderRadius: theme.borderRadius,
        boxShadow: theme.shadow,
        overflow: "hidden",
        width: "100%",
      }}
    >
      {title && (
        <div
          style={{
            background: isGradient(theme.headerBg) ? theme.headerBg : theme.headerBg,
            color: theme.headerText,
            padding: "14px 20px 10px",
            fontSize: `${fontSize + 2}px`,
            fontWeight: 700,
            letterSpacing: "0.01em",
            borderBottom: `1px solid ${theme.borderColor}`,
          }}
        >
          {title}
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
            <tr>
              {data.headers.map((header, i) => (
                <th
                  key={i}
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
                    borderBottom: showGrid ? `2px solid ${theme.borderColor}` : "none",
                    borderRight: showGrid && i < data.headers.length - 1
                      ? `1px solid ${theme.borderColor}`
                      : "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, ri) => {
              const isAlt = stripedRows && ri % 2 === 1;
              return (
                <tr
                  key={ri}
                  style={{
                    background: isAlt ? theme.altRowBg : theme.rowBg,
                    transition: "background 0.15s",
                  }}
                >
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      style={{
                        color: theme.rowText,
                        padding: "11px 18px",
                        borderBottom: showGrid
                          ? `1px solid ${theme.borderColor}`
                          : "none",
                        borderRight:
                          showGrid && ci < row.length - 1
                            ? `1px solid ${theme.borderColor}`
                            : "none",
                        whiteSpace: "nowrap",
                        maxWidth: "300px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
