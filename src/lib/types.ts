export interface TableData {
  headers: string[];
  rows: string[][];
}

export type BackgroundType = "solid" | "gradient" | "mesh" | "image" | "none";

export interface Background {
  type: BackgroundType;
  color?: string;
  gradient?: string;
  meshColors?: string[];
  imageUrl?: string;
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

export type VisualizationMode = "table" | "bar" | "line" | "pie";

export interface BarChartConfig {
  orientation: "vertical" | "horizontal";
  barStyle: "grouped" | "stacked";
  barRadius: number; // 0–12
  barGap: number; // 0–24 px gap between bars within a group
}

export interface LineChartConfig {
  curveType: "linear" | "smooth";
  showArea: boolean;
  showDots: boolean;
  lineWidth: number; // 1–5
}

export interface PieChartConfig {
  innerRadius: number; // 0 = full pie, >0 = donut
  labelPosition: "outside" | "inside" | "none";
  sortSlices: boolean;
  startAngle: number; // degrees, 0 = 12 o'clock
}

export interface ChartConfig {
  labelColumn: number; // column index for labels
  valueColumns: number[]; // column indices for values
  showLegend: boolean;
  showValues: boolean;
  bar: BarChartConfig;
  line: LineChartConfig;
  pie: PieChartConfig;
  customColors: Record<string, string>; // keyed by column header (bar/line) or label value (pie)
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
  showColumnLines: boolean;
  stripedRows: boolean;
  highlightFirstRow: boolean;
  highlightFirstCol: boolean;
  showRowNumbers: boolean;
  borderRadius: number;
  vizBorderRadius: number;
  padding: number;
  fontFamily: string;
  // Custom color overrides (empty string = use theme default)
  customHeaderBg: string;
  customHeaderText: string;
  customRowBg: string;
  customAltRowBg: string;
  customRowText: string;
  customBorderColor: string;
  title: string;
  // Visualization
  vizMode: VisualizationMode;
  chartConfig: ChartConfig;
}
