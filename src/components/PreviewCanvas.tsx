"use client";

import React, { forwardRef } from "react";
import { AppState } from "@/lib/types";
import { getTheme } from "@/lib/themes";
import { backgroundToCss } from "@/lib/backgrounds";
import TableRenderer from "./TableRenderer";
import WindowFrame from "./WindowFrame";

interface PreviewCanvasProps {
  state: AppState;
}

const PreviewCanvas = forwardRef<HTMLDivElement, PreviewCanvasProps>(
  ({ state }, ref) => {
    const theme = getTheme(state.themeId);
    const bgCss = backgroundToCss(state.background);

    if (!state.tableData) {
      return (
        <div className="flex-1 flex items-center justify-center bg-[#0a0a10]">
          <div className="text-center">
            <div className="text-5xl mb-4">⬛</div>
            <p className="text-zinc-500 text-sm">Paste JSON or a Markdown table to preview</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex items-center justify-center bg-[#0a0a10] overflow-auto p-8">
        {/* This outer div is exported */}
        <div
          ref={ref}
          style={{
            background: bgCss,
            padding: "48px",
            borderRadius: "20px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: "500px",
          }}
        >
          <div style={{ width: "100%", maxWidth: "900px" }}>
            <WindowFrame style={state.windowStyle} title={state.title || undefined}>
              <TableRenderer
                data={state.tableData}
                theme={theme}
                fontSize={state.fontSize}
                showGrid={state.showGrid}
                stripedRows={state.stripedRows}
                title={state.windowStyle === "none" ? state.title : undefined}
              />
            </WindowFrame>
          </div>
        </div>
      </div>
    );
  }
);

PreviewCanvas.displayName = "PreviewCanvas";
export default PreviewCanvas;
