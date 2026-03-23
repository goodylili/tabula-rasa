export interface TableData {
  headers: string[];
  rows: string[][];
}

export type BackgroundType = "solid" | "gradient" | "mesh" | "none";

export interface Background {
  type: BackgroundType;
  color?: string;
  gradient?: string;
  meshColors?: string[];
}

export interface TableTheme {
  id: string;
  name: string;
  group?: string;
  headerBg: string;
  headerText: string;
  rowBg: string;
  altRowBg: string;
  rowText: string;
  borderColor: string;
  fontFamily: string;
  borderRadius: string;
  shadow: string;
  // Used for first-row / first-col highlights
  accentBg: string;
  accentText: string;
  defaultBg: string; // CSS background for the outer frame when this theme is selected
}

export interface ExportSettings {
  scale: number;
  format: "png" | "svg";
  padding: number;
}

export interface AppState {
  rawInput: string;
  inputFormat: "json" | "markdown" | "csv" | "postgresql" | "auto";
  tableData: TableData | null;
  themeId: string;
  background: Background;
  windowStyle: "mac" | "windows" | "none";
  fontSize: number;
  showGrid: boolean;
  stripedRows: boolean;
  highlightFirstRow: boolean;
  highlightFirstCol: boolean;
  borderRadius: number;
  fontFamily: string;
  title: string;
}
