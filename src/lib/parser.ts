import { TableData } from "./types";

export function parseMarkdownTable(input: string): TableData | null {
  const lines = input
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return null;

  const parseRow = (line: string): string[] =>
    line
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim());

  const headers = parseRow(lines[0]);
  // Skip separator line (--|--|--)
  const separatorIdx = lines.findIndex((l) => /^[\|\s\-:]+$/.test(l));
  if (separatorIdx === -1) return null;

  const rows = lines
    .slice(separatorIdx + 1)
    .map(parseRow)
    .filter((r) => r.length > 0);

  return { headers, rows };
}

export function parseJSON(input: string): TableData | null {
  try {
    const parsed = JSON.parse(input);

    // Array of objects: [{name: "Alice", age: 30}, ...]
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object") {
      const headers = Object.keys(parsed[0]);
      const rows = parsed.map((item) =>
        headers.map((h) => {
          const val = item[h];
          return val === null || val === undefined ? "" : String(val);
        })
      );
      return { headers, rows };
    }

    // Object with headers + rows keys
    if (parsed.headers && Array.isArray(parsed.headers) && parsed.rows && Array.isArray(parsed.rows)) {
      return {
        headers: parsed.headers.map(String),
        rows: parsed.rows.map((r: unknown[]) => r.map((c) => (c === null || c === undefined ? "" : String(c)))),
      };
    }

    // Object of arrays (column-based): {name: ["Alice", "Bob"], age: [30, 25]}
    if (typeof parsed === "object" && !Array.isArray(parsed)) {
      const headers = Object.keys(parsed);
      if (headers.length > 0 && Array.isArray(parsed[headers[0]])) {
        const rowCount = parsed[headers[0]].length;
        const rows: string[][] = [];
        for (let i = 0; i < rowCount; i++) {
          rows.push(headers.map((h) => {
            const val = parsed[h][i];
            return val === null || val === undefined ? "" : String(val);
          }));
        }
        return { headers, rows };
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function detectAndParse(input: string): TableData | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Try JSON first
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const result = parseJSON(trimmed);
    if (result) return result;
  }

  // Try Markdown
  if (trimmed.includes("|")) {
    const result = parseMarkdownTable(trimmed);
    if (result) return result;
  }

  return null;
}

export const SAMPLE_MARKDOWN = `| Language   | Paradigm       | Typing   | Year |
|------------|----------------|----------|------|
| Go         | Concurrent     | Static   | 2009 |
| Rust       | Systems        | Static   | 2010 |
| TypeScript | Multi-paradigm | Static   | 2012 |
| Python     | Multi-paradigm | Dynamic  | 1991 |
| Haskell    | Functional     | Static   | 1990 |`;

export const SAMPLE_JSON = `[
  {"Name": "Alice", "Role": "Engineer", "Level": "Senior", "Years": 5},
  {"Name": "Bob", "Role": "Designer", "Level": "Mid", "Years": 3},
  {"Name": "Carol", "Role": "Manager", "Level": "Staff", "Years": 8},
  {"Name": "Dave", "Role": "Engineer", "Level": "Junior", "Years": 1}
]`;
