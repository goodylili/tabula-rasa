"use client";

import React, { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "@/lib/types";
import { getTheme } from "@/lib/themes";
import { backgroundToCss } from "@/lib/backgrounds";
import { transformThemeForLightMode } from "@/lib/lightMode";
import TableRenderer from "./TableRenderer";
import WindowFrame from "./WindowFrame";

interface PreviewCanvasProps {
  state: AppState;
  exporting?: boolean;
  colorMode?: "dark" | "light";
  onCellEdit?: (rowIndex: number, colIndex: number, value: string) => void;
  onHeaderEdit?: (colIndex: number, value: string) => void;
}

const PreviewCanvas = forwardRef<HTMLDivElement, PreviewCanvasProps>(
  ({ state, exporting = false, colorMode = "dark", onCellEdit, onHeaderEdit }, ref) => {
    const baseTheme = getTheme(state.themeId);
    let theme = {
      ...baseTheme,
      ...(state.customHeaderBg && { accentBg: state.customHeaderBg, headerBg: state.customHeaderBg }),
      ...(state.customHeaderText && { accentText: state.customHeaderText, headerText: state.customHeaderText }),
      ...(state.customRowBg && { rowBg: state.customRowBg }),
      ...(state.customAltRowBg && { altRowBg: state.customAltRowBg }),
      ...(state.customRowText && { rowText: state.customRowText }),
      ...(state.customBorderColor && { borderColor: state.customBorderColor }),
    };

    if (colorMode === "light") {
      theme = transformThemeForLightMode(theme);
    }

    const bgCss = backgroundToCss(state.background);
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    const updateScale = useCallback(() => {
      if (exporting || !containerRef.current || !contentRef.current) {
        setScale(1);
        return;
      }
      const container = containerRef.current;
      const content = contentRef.current;

      // Available space (minus padding)
      const padX = window.innerWidth < 640 ? 32 : 64; // p-4 or p-8
      const padY = padX;
      const availW = container.clientWidth - padX;
      const availH = container.clientHeight - padY;

      // Natural content size (measure at scale 1)
      content.style.transform = "scale(1)";
      content.style.transformOrigin = "top center";
      const contentW = content.scrollWidth;
      const contentH = content.scrollHeight;

      if (contentW <= 0 || contentH <= 0) { setScale(1); return; }

      const scaleX = availW / contentW;
      const scaleY = availH / contentH;
      const newScale = Math.min(1, scaleX, scaleY);

      // Don't scale below 0.3 — at that point just scroll
      setScale(Math.max(0.3, newScale));
    }, [exporting]);

    useEffect(() => {
      updateScale();
    }, [
      state.tableData, state.padding, state.fontSize, state.windowStyle,
      state.showGrid, state.showRowNumbers, state.borderRadius,
      state.fontFamily, state.title, exporting, updateScale,
    ]);

    useEffect(() => {
      if (!containerRef.current) return;
      const observer = new ResizeObserver(() => updateScale());
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }, [updateScale]);

    if (!state.tableData) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-5xl mb-4" style={{ opacity: 0.3 }}>T</div>
            <p className="text-sm" style={{ color: "var(--text-subtle)" }}>
              Paste JSON, CSV, Markdown, or PostgreSQL to preview
            </p>
          </div>
        </div>
      );
    }

    const isTransparent = state.background.type === "none";

    return (
      <div
        ref={containerRef}
        className="flex-1 flex items-start justify-center overflow-auto p-4 sm:p-8"
      >
        <div
          style={{
            transform: exporting ? undefined : `scale(${scale})`,
            transformOrigin: "top center",
            // Reserve the scaled height so the container doesn't collapse
            ...(scale < 1 && !exporting && contentRef.current ? {
              marginBottom: `${-(contentRef.current.scrollHeight * (1 - scale))}px`,
            } : {}),
          }}
        >
          <div
            ref={(node) => {
              // Forward ref for export + keep internal ref
              (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
              if (typeof ref === "function") ref(node);
              else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
            }}
            style={{
              background: bgCss,
              padding: `${state.padding}px`,
              borderRadius: `${state.borderRadius}px`,
              display: "inline-block",
              ...(isTransparent && {
                outline: "1px dashed var(--border)",
                outlineOffset: "-1px",
              }),
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
      </div>
    );
  }
);

PreviewCanvas.displayName = "PreviewCanvas";
export default PreviewCanvas;
