"use client";

import React, { useEffect, useRef, useState } from "react";

/* ─── Section ───────────────────────────────────────────── */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="cp-section">
      <div className="cp-section-title">{title}</div>
      {children}
    </section>
  );
}

/* ─── Field (label + control, stacked) ─────────────────── */
export function Field({
  label,
  children,
  inline = false,
}: {
  label: string;
  children: React.ReactNode;
  inline?: boolean;
}) {
  if (inline) {
    return (
      <div className="cp-field-row">
        <span className="cp-label">{label}</span>
        {children}
      </div>
    );
  }
  return (
    <div className="cp-field">
      <span className="cp-label">{label}</span>
      {children}
    </div>
  );
}

/* ─── Segmented ─────────────────────────────────────────── */
export interface SegmentedOption<T extends string | number> {
  value: T;
  label: React.ReactNode;
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          data-active={value === o.value}
          className="seg-btn"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Switch ────────────────────────────────────────────── */
export function Switch({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className="sw"
      data-on={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="sw-thumb" />
    </button>
  );
}

/* ─── Slider ────────────────────────────────────────────── */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="sl-wrap">
      <input
        type="range"
        className="sl"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="sl-value">{format ? format(value) : value}</span>
    </div>
  );
}

/* ─── Select (custom) ───────────────────────────────────── */
export interface SelectOption {
  value: string;
  label: string;
  group?: string;
}

export function Select({
  value,
  options,
  onChange,
  placeholder = "Select…",
}: {
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  // group options by `group`
  const groups: { name: string | undefined; items: SelectOption[] }[] = [];
  for (const opt of options) {
    const g = groups.find((x) => x.name === opt.group);
    if (g) g.items.push(opt);
    else groups.push({ name: opt.group, items: [opt] });
  }

  return (
    <div className="sel" ref={ref}>
      <button
        type="button"
        className="sel-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected?.label ?? placeholder}
        </span>
        <span className="sel-caret">▾</span>
      </button>
      {open && (
        <div className="sel-menu" role="listbox">
          {groups.map((g, gi) => (
            <React.Fragment key={gi}>
              {g.name && <div className="sel-group">{g.name}</div>}
              {g.items.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={value === o.value}
                  data-active={value === o.value}
                  className="sel-option"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  {o.label}
                </button>
              ))}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Color swatch ──────────────────────────────────────── */
export function Swatch({
  color,
  onChange,
  ariaLabel,
}: {
  color: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <button
      type="button"
      className="swatch"
      aria-label={ariaLabel ?? "Pick color"}
      onClick={() => ref.current?.click()}
    >
      <span className="swatch-inner" style={{ background: color || "transparent" }} />
      <input
        ref={ref}
        type="color"
        value={color || "#000000"}
        onChange={(e) => onChange(e.target.value)}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
      />
    </button>
  );
}
