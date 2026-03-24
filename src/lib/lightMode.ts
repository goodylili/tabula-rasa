import { TableTheme } from "./types";

// Parse hex color to RGB
function hexToRgb(hex: string): [number, number, number] | null {
  hex = hex.replace("#", "");
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  if (hex.length !== 6) return null;
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}

// Convert RGB to HSL
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

// Invert lightness of a color while preserving hue and saturation
function invertLightness(hex: string, options?: { minL?: number; maxL?: number }): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const [h, s, l] = rgbToHsl(...rgb);
  // Flip lightness: dark → light, light → dark
  let newL = 1 - l;
  if (options?.minL != null) newL = Math.max(options.minL, newL);
  if (options?.maxL != null) newL = Math.min(options.maxL, newL);
  const [r, g, b] = hslToRgb(h, s, newL);
  return rgbToHex(r, g, b);
}

// Lighten a hex color to a specific lightness target
function setLightness(hex: string, targetL: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const [h, s] = rgbToHsl(...rgb);
  const [r, g, b] = hslToRgb(h, s * 0.6, targetL); // reduce saturation slightly for light mode
  return rgbToHex(r, g, b);
}

// Transform a CSS color (hex, rgba, gradient) for light mode
function transformColor(color: string, role: "bg" | "text" | "border" | "accent-bg" | "accent-text"): string {
  // Handle gradients — transform individual colors within
  if (color.includes("gradient") || color.includes("linear") || color.includes("radial")) {
    return color.replace(/#[0-9a-fA-F]{3,8}/g, (match) => {
      return transformColor(match, role);
    });
  }

  // Handle rgba — keep as-is (these are usually subtle overlays)
  if (color.startsWith("rgba") || color.startsWith("rgb(")) return color;

  // Handle hex colors based on role
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  const [, , l] = rgbToHsl(...rgb);

  switch (role) {
    case "bg":
      // Dark backgrounds → light backgrounds
      if (l < 0.15) return setLightness(color, 0.98); // near-black → near-white
      if (l < 0.3) return setLightness(color, 0.95);  // dark → very light
      return invertLightness(color, { minL: 0.85, maxL: 0.98 });

    case "text":
      // Light text → dark text
      if (l > 0.7) return setLightness(color, 0.25);  // light text → dark text
      if (l > 0.4) return setLightness(color, 0.35);  // medium text → darker
      return color; // already dark

    case "border":
      // Dark borders → light borders
      if (l < 0.25) return setLightness(color, 0.85);
      return invertLightness(color, { minL: 0.75, maxL: 0.9 });

    case "accent-bg":
      // Header/accent backgrounds — keep the hue but adjust for light mode
      if (l < 0.15) return setLightness(color, 0.92); // very dark accent → light tint
      if (l < 0.4) return setLightness(color, 0.88);
      return color; // bright accents stay as-is

    case "accent-text":
      // Accent text — ensure readable on light accent bg
      if (l > 0.8) return setLightness(color, 0.2);   // white text → dark
      if (l > 0.5) return setLightness(color, 0.3);
      return color; // already dark enough
  }
}

export function transformThemeForLightMode(theme: TableTheme): TableTheme {
  return {
    ...theme,
    headerBg: transformColor(theme.headerBg, "accent-bg"),
    headerText: transformColor(theme.headerText, "accent-text"),
    rowBg: transformColor(theme.rowBg, "bg"),
    altRowBg: transformColor(theme.altRowBg, "bg"),
    rowText: transformColor(theme.rowText, "text"),
    borderColor: transformColor(theme.borderColor, "border"),
    accentBg: transformColor(theme.accentBg, "accent-bg"),
    accentText: transformColor(theme.accentText, "accent-text"),
  };
}
