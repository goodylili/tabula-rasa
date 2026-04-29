"use client";

import React, { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "@/lib/types";
import { getTheme } from "@/lib/themes";
import { backgroundToCss, isImageBackground } from "@/lib/backgrounds";
import { transformThemeForLightMode, transformBackgroundForLightMode } from "@/lib/lightMode";
import TableRenderer from "./TableRenderer";
import ChartRenderer from "./ChartRenderer";
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

    let bgCss = backgroundToCss(state.background);
    if (colorMode === "light") {
      bgCss = transformBackgroundForLightMode(bgCss);
    }
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [scaleInfo, setScaleInfo] = useState({ scale: 1, contentScrollHeight: 0 });
    const scale = scaleInfo.scale;
    const contentScrollHeight = scaleInfo.contentScrollHeight;

    const updateScale = useCallback(() => {
      if (exporting || !containerRef.current || !contentRef.current) {
        setScaleInfo({ scale: 1, contentScrollHeight: 0 });
        return;
      }
      const container = containerRef.current;
      const content = contentRef.current;

      // Available space (canvas-stage padding: 50/40/100 desktop, 36/16/130 mobile)
      const padX = window.innerWidth < 768 ? 32 : 80;
      const padY = window.innerWidth < 768 ? 166 : 150;
      const availW = container.clientWidth - padX;
      const availH = container.clientHeight - padY;

      // Natural content size (measure at scale 1)
      content.style.transform = "scale(1)";
      content.style.transformOrigin = "top center";
      const contentW = content.scrollWidth;
      const contentH = content.scrollHeight;

      if (contentW <= 0 || contentH <= 0) { setScaleInfo({ scale: 1, contentScrollHeight: contentH }); return; }

      const scaleX = availW / contentW;
      const scaleY = availH / contentH;
      const newScale = Math.min(1, scaleX, scaleY);

      // Don't scale below 0.3 — at that point just scroll
      setScaleInfo({ scale: Math.max(0.3, newScale), contentScrollHeight: contentH });
    }, [exporting]);

    useEffect(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional layout measurement that must set state
      updateScale();
    }, [
      state.tableData, state.padding, state.fontSize, state.windowStyle,
      state.showGrid, state.showRowNumbers, state.borderRadius, state.vizBorderRadius,
      state.fontFamily, state.title, state.vizMode, state.chartConfig,
      exporting, updateScale,
    ]);

    useEffect(() => {
      if (!containerRef.current) return;
      const observer = new ResizeObserver(() => updateScale());
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }, [updateScale]);

    if (!state.tableData) {
      return (
        <div className="canvas-stage">
          <div style={{ textAlign: "center", color: "var(--text-dim)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase" }}>
              No data
            </div>
            <p style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
              Paste JSON, CSV, Markdown, or PostgreSQL
            </p>
          </div>
        </div>
      );
    }

    const isTransparent = state.background.type === "none";

    return (
      <div
        ref={containerRef}
        className="canvas-stage"
      >
        <div
          style={{
            transform: exporting ? undefined : `scale(${scale})`,
            transformOrigin: "top center",
            // Reserve the scaled height so the container doesn't collapse
            ...(scale < 1 && !exporting && contentScrollHeight > 0 ? {
              marginBottom: `${-(contentScrollHeight * (1 - scale))}px`,
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
              ...(isImageBackground(state.background) && {
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }),
              ...(isTransparent && {
                outline: "1px dashed var(--border)",
                outlineOffset: "-1px",
              }),
            }}
          >
            <WindowFrame style={state.windowStyle} title={state.title || undefined} borderRadius={state.vizBorderRadius} theme={theme}>
              {state.vizMode === "table" ? (
                <TableRenderer
                  data={state.tableData}
                  theme={theme}
                  fontSize={state.fontSize}
                  showGrid={state.showGrid}
                  showColumnLines={state.showColumnLines}
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
              ) : (
                <ChartRenderer
                  data={state.tableData}
                  theme={theme}
                  config={state.chartConfig}
                  vizMode={state.vizMode}
                  fontSize={state.fontSize}
                  fontOverride={state.fontFamily || undefined}
                  title={state.windowStyle === "none" ? state.title : undefined}
                />
              )}
            </WindowFrame>
          </div>
        </div>
      </div>
    );
  }
);

PreviewCanvas.displayName = "PreviewCanvas";
export default PreviewCanvas;
