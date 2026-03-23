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

    if (parsed.headers && Array.isArray(parsed.headers) && parsed.rows && Array.isArray(parsed.rows)) {
      return {
        headers: parsed.headers.map(String),
        rows: parsed.rows.map((r: unknown[]) => r.map((c) => (c === null || c === undefined ? "" : String(c)))),
      };
    }

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

export function parseCSV(input: string): TableData | null {
  const lines = input.trim().split("\n");
  if (lines.length < 2) return null;

  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          cells.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const headers = parseLine(lines[0]);
  if (headers.length < 2) return null;

  const rows = lines.slice(1)
    .map(parseLine)
    .filter((r) => r.some((c) => c.length > 0));

  if (rows.length === 0) return null;
  return { headers, rows };
}

export function parsePostgreSQL(input: string): TableData | null {
  // Parses PostgreSQL \d output or psql query result format:
  //  column1 | column2 | column3
  // ---------+---------+---------
  //  val1    | val2    | val3
  //
  // Also handles CREATE TABLE and INSERT INTO statements.

  const trimmed = input.trim();

  // Try CREATE TABLE
  const createMatch = trimmed.match(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[\w."]+\s*\(([\s\S]+)\)/i
  );
  if (createMatch) {
    const body = createMatch[1];
    const colDefs = body
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.match(/^\s*(PRIMARY|UNIQUE|CHECK|FOREIGN|CONSTRAINT)/i));

    const headers = colDefs.map((def) => {
      const parts = def.split(/\s+/);
      return parts[0].replace(/"/g, "");
    });
    const types = colDefs.map((def) => {
      const parts = def.split(/\s+/);
      return parts.slice(1).join(" ");
    });

    // If there are INSERT statements following, parse data from them
    const insertMatch = trimmed.match(
      /INSERT\s+INTO\s+[\w."]+\s*(?:\([^)]+\))?\s*VALUES\s*([\s\S]+)/i
    );
    if (insertMatch) {
      const valuesStr = insertMatch[1];
      const rowMatches = valuesStr.match(/\(([^)]+)\)/g);
      if (rowMatches) {
        const rows = rowMatches.map((rm) =>
          rm
            .replace(/^\(|\)$/g, "")
            .split(",")
            .map((v) => v.trim().replace(/^'|'$/g, ""))
        );
        return { headers, rows };
      }
    }

    // Just the schema, show types as a single row
    return { headers, rows: [types] };
  }

  // Try INSERT INTO only
  const insertOnly = trimmed.match(
    /INSERT\s+INTO\s+[\w."]+\s*\(([^)]+)\)\s*VALUES\s*([\s\S]+)/i
  );
  if (insertOnly) {
    const headers = insertOnly[1].split(",").map((h) => h.trim().replace(/"/g, ""));
    const valuesStr = insertOnly[2];
    const rowMatches = valuesStr.match(/\(([^)]+)\)/g);
    if (rowMatches) {
      const rows = rowMatches.map((rm) =>
        rm
          .replace(/^\(|\)$/g, "")
          .split(",")
          .map((v) => v.trim().replace(/^'|'$/g, ""))
      );
      return { headers, rows };
    }
  }

  // Try psql output format (pipe-separated with +--- separator)
  const lines = trimmed.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length >= 3) {
    const sepIdx = lines.findIndex((l) => /^[-+]+$/.test(l));
    if (sepIdx >= 1) {
      const parseRow = (line: string): string[] =>
        line.split("|").map((c) => c.trim()).filter((_, i, arr) => {
          // psql sometimes has empty leading/trailing from | at edges
          if (i === 0 && arr[0] === "") return false;
          if (i === arr.length - 1 && arr[arr.length - 1] === "") return false;
          return true;
        });

      const headers = parseRow(lines[sepIdx - 1]);
      const rows = lines
        .slice(sepIdx + 1)
        .filter((l) => !l.match(/^\(\d+ rows?\)$/))
        .map(parseRow)
        .filter((r) => r.length > 0);

      if (headers.length > 0 && rows.length > 0) {
        return { headers, rows };
      }
    }
  }

  return null;
}

export function detectAndParse(input: string, format?: string): TableData | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (format === "csv") return parseCSV(trimmed);
  if (format === "postgresql") return parsePostgreSQL(trimmed);
  if (format === "json") return parseJSON(trimmed);
  if (format === "markdown") return parseMarkdownTable(trimmed);

  // Auto-detect
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const result = parseJSON(trimmed);
    if (result) return result;
  }

  if (/CREATE\s+TABLE|INSERT\s+INTO/i.test(trimmed)) {
    const result = parsePostgreSQL(trimmed);
    if (result) return result;
  }

  if (trimmed.includes("|")) {
    // Try markdown first
    const mdResult = parseMarkdownTable(trimmed);
    if (mdResult) return mdResult;
    // Then psql
    const pgResult = parsePostgreSQL(trimmed);
    if (pgResult) return pgResult;
  }

  // Try CSV last (very permissive)
  if (trimmed.includes(",")) {
    const result = parseCSV(trimmed);
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
