/** RFC 4180 CSV read/write — enough for the film worksheet, no dependencies. */

const BOM = '﻿';

export const stringifyCsv = (rows, { delimiter = ',' } = {}) => {
  const escape = (value) => {
    const text = value == null ? '' : String(value);
    return /["\n\r]|^\s|\s$/.test(text) || text.includes(delimiter) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  // The BOM makes Excel read the file as UTF-8 instead of a legacy codepage,
  // which otherwise mangles every Cyrillic label.
  return BOM + rows.map((row) => row.map(escape).join(delimiter)).join('\r\n') + '\r\n';
};

/** Parse CSV text into an array of row arrays. Handles quotes, embedded delimiters and CRLF. */
export const parseCsv = (text, { delimiter = ',' } = {}) => {
  const input = text.startsWith(BOM) ? text.slice(1) : text;
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (quoted) {
      if (char !== '"') {
        field += char;
      } else if (input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = false;
      }
      continue;
    }

    if (char === '"' && field === '') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') {
        i += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop trailing blank lines produced by the final newline.
  return rows.filter((entry) => entry.some((value) => value.trim() !== ''));
};

/** Parse into objects keyed by the header row. */
export const parseCsvRecords = (text, options) => {
  const [header, ...rows] = parseCsv(text, options);
  if (!header) {
    return [];
  }
  return rows.map((row) => Object.fromEntries(header.map((key, index) => [key.trim(), row[index] ?? ''])));
};
