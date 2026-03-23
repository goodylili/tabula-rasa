"use client";

import React, { forwardRef } from "react";
import { AppState } from "@/lib/types";
import { getTheme } from "@/lib/themes";
import { backgroundToCss } from "@/lib/backgrounds";
import TableRenderer from "./TableRenderer";
import WindowFrame from "./WindowFrame";

interface PreviewCanvasProps {
  state: AppState;
  exporting?: boolean;
  onCellEdit?: (rowIndex: number, colIndex: number, value: string) => void;
  onHeaderEdit?: (colIndex: number, value: string) => void;
}

const PreviewCanvas = forwardRef<HTMLDivElement, PreviewCanvasProps>(
  ({ state, exporting = false, onCellEdit, onHeaderEdit }, ref) => {
    const baseTheme = getTheme(state.themeId);
    // Merge custom color overrides on top of theme
    const theme = {
      ...baseTheme,
      ...(state.customHeaderBg && { accentBg: state.customHeaderBg, headerBg: state.customHeaderBg }),
      ...(state.customHeaderText && { accentText: state.customHeaderText, headerText: state.customHeaderText }),
      ...(state.customRowBg && { rowBg: state.customRowBg }),
      ...(state.customAltRowBg && { altRowBg: state.customAltRowBg }),
      ...(state.customRowText && { rowText: state.customRowText }),
      ...(state.customBorderColor && { borderColor: state.customBorderColor }),
    };
    const bgCss = backgroundToCss(state.background);

    if (!state.tableData) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-5xl mb-4" style={{ opacity: 0.3 }}>T</div>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
              Paste JSON, CSV, Markdown, or PostgreSQL to preview
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex items-start justify-center overflow-auto p-8">
        <div
          ref={ref}
          style={{
            background: bgCss,
            padding: "48px",
            borderRadius: `${state.borderRadius}px`,
            display: "inline-block",
          }}
        >
          <WindowFrame style={state.windowStyle} title={state.title || undefined} borderRadius={state.borderRadius}>
            <TableRenderer
              data={state.tableData}
              theme={theme}
              fontSize={state.fontSize}
              showGrid={state.showGrid}
              stripedRows={state.stripedRows}
              highlightFirstRow={state.highlightFirstRow}
              highlightFirstCol={state.highlightFirstCol}
              showRowNumbers={state.showRowNumbers}
              fontOverride={state.fontFamily || undefined}
              title={state.windowStyle === "none" ? state.title : undefined}
              interactive={!exporting}
              onCellEdit={onCellEdit}
              onHeaderEdit={onHeaderEdit}
            />
          </WindowFrame>
        </div>
      </div>
    );
  }
);

PreviewCanvas.displayName = "PreviewCanvas";
export default PreviewCanvas;
