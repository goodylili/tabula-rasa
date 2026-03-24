"use client";

import React from "react";
import { AppState } from "@/lib/types";
import { exportData } from "@/lib/exporters";
import { X } from "lucide-react";

interface InputDrawerProps {
  open: boolean;
  onClose: () => void;
  state: AppState;
  onChange: (patch: Partial<AppState>) => void;
}

const FORMATS = [
  { id: "auto", label: "Auto" },
  { id: "json", label: "JSON" },
  { id: "csv", label: "CSV" },
  { id: "markdown", label: "Markdown" },
  { id: "postgresql", label: "PostgreSQL" },
] as const;

export default function InputDrawer({ open, onClose, state, onChange }: InputDrawerProps) {
  if (!open) return null;

  const handleFormatSwitch = (fmt: AppState["inputFormat"]) => {
    // If switching to a specific format and we have table data, convert the textarea content
    if (fmt !== "auto" && state.tableData) {
      const converted = exportData(state.tableData, fmt, state.title || "my_table");
      onChange({ rawInput: converted, inputFormat: fmt });
    } else {
      onChange({ inputFormat: fmt });
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ background: "var(--overlay)" }}
        onClick={onClose}
      />

      <div
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col input-drawer"
        style={{
          width: "min(420px, 100vw)",
          background: "var(--panel-bg)",
          borderLeft: "1px solid var(--panel-border)",
          boxShadow: `-8px 0 32px var(--shadow-color)`,
        }}
      >
        <div
          className="flex items-center justify-between px-5 shrink-0"
          style={{
            height: "50px",
            borderBottom: "1px solid var(--panel-border)",
          }}
        >
          <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Table Data</span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
            style={{
              color: "var(--text-muted)",
              background: "var(--surface)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
          >
            <X size={14} />
          </button>
        </div>

        {/* Format Buttons */}
        <div className="flex gap-1.5 px-5 pt-4 pb-2 flex-wrap">
          {FORMATS.map((fmt) => (
            <button
              key={fmt.id}
              onClick={() => handleFormatSwitch(fmt.id as AppState["inputFormat"])}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background:
                  state.inputFormat === fmt.id
                    ? "var(--accent)"
                    : "var(--surface)",
                color:
                  state.inputFormat === fmt.id
                    ? "white"
                    : "var(--text-muted)",
                border: `1px solid ${
                  state.inputFormat === fmt.id
                    ? "transparent"
                    : "var(--border-subtle)"
                }`,
              }}
            >
              {fmt.label}
            </button>
          ))}
        </div>

        {/* Hint */}
        <div className="px-5 pb-2">
          <p style={{ fontSize: "11px", color: "var(--text-subtle)", lineHeight: "1.4" }}>
            Switch formats to convert the current table data. Paste any format and use Auto to detect.
          </p>
        </div>

        {/* Textarea */}
        <div className="flex-1 px-5 pb-5 pt-1">
          <textarea
            value={state.rawInput}
            onChange={(e) => onChange({ rawInput: e.target.value })}
            placeholder={`Paste your table data here...\n\nSupported formats:\n• JSON: [{...}, {...}]\n• CSV: col1,col2\\nval1,val2\n• Markdown: | col1 | col2 |\n• PostgreSQL: CREATE TABLE / INSERT INTO`}
            className="w-full h-full rounded-xl text-sm font-mono resize-none focus:outline-none focus:ring-1"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
              padding: "16px",
            }}
          />
        </div>
      </div>
    </>
  );
}
