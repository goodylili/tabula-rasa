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
  const trimmed = input.trim();

  // Helper: parse SQL VALUES tuples, respecting quoted strings
  const parseValueTuples = (valuesStr: string): string[][] => {
    const rows: string[][] = [];
    // Match each (...) tuple
    const tupleRegex = /\(([^)]*(?:'[^']*'[^)]*)*)\)/g;
    let match;
    while ((match = tupleRegex.exec(valuesStr)) !== null) {
      const inner = match[1];
      const cells: string[] = [];
      let current = "";
      let inQuote = false;
      for (let i = 0; i < inner.length; i++) {
        const ch = inner[i];
        if (inQuote) {
          if (ch === "'" && inner[i + 1] === "'") {
            current += "'";
            i++;
          } else if (ch === "'") {
            inQuote = false;
          } else {
            current += ch;
          }
        } else {
          if (ch === "'") {
            inQuote = true;
          } else if (ch === ",") {
            cells.push(current.trim());
            current = "";
          } else {
            current += ch;
          }
        }
      }
      cells.push(current.trim());
      // Clean up NULL values
      rows.push(cells.map((c) => (c.toUpperCase() === "NULL" ? "" : c)));
    }
    return rows;
  };

  // Helper: parse CREATE TABLE column definitions (respects parentheses in types like VARCHAR(50))
  const parseCreateColumns = (body: string): { headers: string[]; types: string[] } => {
    const headers: string[] = [];
    const types: string[] = [];
    let depth = 0;
    let current = "";

    for (const ch of body) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;

      if (ch === "," && depth === 0) {
        const def = current.trim();
        if (def && !def.match(/^\s*(PRIMARY|UNIQUE|CHECK|FOREIGN|CONSTRAINT)/i)) {
          const parts = def.split(/\s+/);
          headers.push(parts[0].replace(/"/g, ""));
          types.push(parts.slice(1).join(" "));
        }
        current = "";
      } else {
        current += ch;
      }
    }
    // Last column
    const def = current.trim();
    if (def && !def.match(/^\s*(PRIMARY|UNIQUE|CHECK|FOREIGN|CONSTRAINT)/i)) {
      const parts = def.split(/\s+/);
      headers.push(parts[0].replace(/"/g, ""));
      types.push(parts.slice(1).join(" "));
    }

    return { headers, types };
  };

  // Try CREATE TABLE — use non-greedy match to find the closing ) of the column list
  // by finding the ); that ends the statement
  const createMatch = trimmed.match(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[\w."]+\s*\(([\s\S]+?)\)\s*;/i
  );
  if (createMatch) {
    const { headers, types } = parseCreateColumns(createMatch[1]);

    // Look for INSERT statements following
    const insertMatch = trimmed.match(
      /INSERT\s+INTO\s+[\w."]+\s*(?:\([^)]+\))?\s*VALUES\s*([\s\S]+)/i
    );
    if (insertMatch) {
      const rows = parseValueTuples(insertMatch[1]);
      if (rows.length > 0) return { headers, rows };
    }

    return { headers, rows: [types] };
  }

  // Try INSERT INTO only
  const insertOnly = trimmed.match(
    /INSERT\s+INTO\s+[\w."]+\s*\(([^)]+)\)\s*VALUES\s*([\s\S]+)/i
  );
  if (insertOnly) {
    const headers = insertOnly[1].split(",").map((h) => h.trim().replace(/"/g, ""));
    const rows = parseValueTuples(insertOnly[2]);
    if (rows.length > 0) return { headers, rows };
  }

  // Try psql output format (pipe-separated with +--- separator)
  const lines = trimmed.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length >= 3) {
    const sepIdx = lines.findIndex((l) => /^[-+]+$/.test(l));
    if (sepIdx >= 1) {
      const parseRow = (line: string): string[] => {
        const parts = line.split("|").map((c) => c.trim());
        // Remove empty leading/trailing from outer pipes
        if (parts.length > 0 && parts[0] === "") parts.shift();
        if (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
        return parts;
      };

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
