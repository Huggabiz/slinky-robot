/**
 * Minimal RFC-4180-ish CSV parser. Handles:
 * - Quoted fields (double-quote wraps)
 * - Doubled quotes ("") as an escaped quote inside a quoted field
 * - Embedded newlines inside quoted fields
 * - CRLF / LF / CR line endings
 *
 * Does NOT handle: alternate delimiters, BOM stripping, encoding detection,
 * streaming. Good enough for the NPD process database export format; swap
 * for papaparse if we hit edge cases.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (c === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }

    if (c === '\r') {
      // Normalise CRLF and bare CR; treat the next LF (if any) as part of
      // the same line terminator rather than an empty row.
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      if (text[i] === '\n') i += 1;
      continue;
    }

    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }

    field += c;
    i += 1;
  }

  // Flush trailing field/row if the file doesn't end with a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * Parse a CSV string and return { headers, rows }, dropping fully-empty
 * rows that typically come from trailing blank lines.
 */
export function parseCsvWithHeaders(text: string): {
  headers: string[];
  rows: string[][];
} {
  const all = parseCsv(text).filter((row) =>
    row.some((cell) => cell.length > 0),
  );
  if (all.length === 0) {
    return { headers: [], rows: [] };
  }
  const [headers, ...rest] = all;
  return { headers, rows: rest };
}
