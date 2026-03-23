import { TableData } from "./types";

export function exportToJSON(data: TableData): string {
  const rows = data.rows.map((row) => {
    const obj: Record<string, string> = {};
    data.headers.forEach((h, i) => {
      obj[h] = row[i] ?? "";
    });
    return obj;
  });
  return JSON.stringify(rows, null, 2);
}

export function exportToCSV(data: TableData): string {
  const escape = (val: string): string => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const header = data.headers.map(escape).join(",");
  const rows = data.rows.map((row) => row.map(escape).join(","));
  return [header, ...rows].join("\n");
}

export function exportToMarkdown(data: TableData): string {
  const pad = (val: string, width: number) => val.padEnd(width);

  const colWidths = data.headers.map((h, i) => {
    const cellWidths = data.rows.map((r) => (r[i] ?? "").length);
    return Math.max(h.length, ...cellWidths);
  });

  const headerRow = "| " + data.headers.map((h, i) => pad(h, colWidths[i])).join(" | ") + " |";
  const separator = "| " + colWidths.map((w) => "-".repeat(w)).join(" | ") + " |";
  const bodyRows = data.rows.map(
    (row) => "| " + row.map((c, i) => pad(c ?? "", colWidths[i])).join(" | ") + " |"
  );

  return [headerRow, separator, ...bodyRows].join("\n");
}

export function exportToPostgreSQL(data: TableData, tableName = "my_table"): string {
  const sanitize = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9_]/g, "_");

  const safeName = sanitize(tableName);
  const safeHeaders = data.headers.map(sanitize);

  // Infer types
  const colTypes = data.headers.map((_, i) => {
    const values = data.rows.map((r) => r[i] ?? "");
    const allInt = values.every((v) => v === "" || /^-?\d+$/.test(v));
    if (allInt) return "INTEGER";
    const allNum = values.every((v) => v === "" || /^-?\d+\.?\d*$/.test(v));
    if (allNum) return "NUMERIC";
    const maxLen = Math.max(...values.map((v) => v.length), 1);
    return maxLen <= 50 ? `VARCHAR(${Math.max(maxLen * 2, 50)})` : "TEXT";
  });

  const createCols = safeHeaders
    .map((h, i) => `    ${h} ${colTypes[i]}`)
    .join(",\n");

  const createTable = `CREATE TABLE ${safeName} (\n${createCols}\n);`;

  if (data.rows.length === 0) return createTable;

  const escapeSQL = (val: string): string => {
    if (val === "") return "NULL";
    return `'${val.replace(/'/g, "''")}'`;
  };

  const insertRows = data.rows
    .map(
      (row) =>
        `    (${row.map(escapeSQL).join(", ")})`
    )
    .join(",\n");

  const insert = `INSERT INTO ${safeName} (${safeHeaders.join(", ")})\nVALUES\n${insertRows};`;

  return `${createTable}\n\n${insert}`;
}

export type ExportFormat = "json" | "csv" | "markdown" | "postgresql" | "png" | "jpg" | "svg";

export function exportData(data: TableData, format: ExportFormat, tableName?: string): string {
  switch (format) {
    case "json":
      return exportToJSON(data);
    case "csv":
      return exportToCSV(data);
    case "markdown":
      return exportToMarkdown(data);
    case "postgresql":
      return exportToPostgreSQL(data, tableName);
    default:
      return "";
  }
}

export function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
