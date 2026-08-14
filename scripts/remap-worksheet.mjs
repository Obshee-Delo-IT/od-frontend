/**
 * Transplant a filled film worksheet onto another environment's post ids.
 *
 *   pnpm film:remap -- --from .scratch/film-worksheet-filled.csv \
 *                      --onto .scratch/film-worksheet-prod.csv \
 *                      --out  .scratch/film-worksheet-prod-filled.csv
 *
 * Post ids are per-environment: the sheet we filled against od-dev cannot be
 * imported into od-stage or prod, because row `71933` is a different post (or no
 * post) there. This joins the two sheets **by title** and rewrites the ids, so
 * the ACF values survive the environment change.
 *
 * Rules:
 *  - The target sheet (`--onto`, a fresh `pnpm film:export` from that env) owns
 *    the row set and the ids. Rows it doesn't have are reported, not invented.
 *  - Only cells that are empty in the target are filled — an environment that
 *    already holds a value keeps it, same guarantee as the importer.
 *  - Titles are matched casefolded, ё=е, punctuation and «» stripped, whitespace
 *    collapsed. Ambiguous or unmatched titles are listed for a human; nothing is
 *    guessed, because a wrong match puts the wrong video on a public page.
 *  - Source rows with no id (films that exist only on the target env) are matched
 *    by title too — that's how they finally get one.
 */

import fs from 'node:fs';
import { readArgs } from './lib/args.mjs';
import { parseCsv, stringifyCsv } from './lib/csv.mjs';
import { ACF_FIELDS } from './lib/wp.mjs';

const OPTIONS = {
  from: { type: 'string' },
  onto: { type: 'string' },
  out: { type: 'string' },
  delimiter: { type: 'string', default: ',' },
};

const requireArgs = (args) => {
  for (const key of ['from', 'onto', 'out']) {
    if (!args[key]) {
      throw new Error(`--${key} is required`);
    }
  }
  return args;
};

const normaliseTitle = (title) =>
  title
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const readSheet = (file, delimiter) => {
  const rows = parseCsv(fs.readFileSync(file, 'utf8'), { delimiter });
  const header = rows[0];
  return { header, body: rows.slice(1), col: (name) => header.indexOf(name) };
};

const main = () => {
  const args = requireArgs(readArgs(OPTIONS));
  const from = readSheet(args.from, args.delimiter);
  const onto = readSheet(args.onto, args.delimiter);

  if (JSON.stringify(from.header) !== JSON.stringify(onto.header)) {
    throw new Error('Sheets have different columns — regenerate both with the same pnpm film:export version.');
  }

  // Index the source by normalised title; a title used twice is unusable as a key.
  const sourceByTitle = new Map();
  const ambiguous = new Set();
  for (const row of from.body) {
    const key = normaliseTitle(row[from.col('title')] ?? '');
    if (!key) {
      continue;
    }
    if (sourceByTitle.has(key)) {
      ambiguous.add(key);
    }
    sourceByTitle.set(key, row);
  }

  const fieldCols = ACF_FIELDS.map((field) => ({ field, index: onto.col(field) }));
  let matched = 0;
  let filledCells = 0;
  const filledPerField = {};
  const unmatchedTarget = [];
  const skippedAmbiguous = [];

  for (const row of onto.body) {
    const title = row[onto.col('title')] ?? '';
    const key = normaliseTitle(title);
    const source = sourceByTitle.get(key);

    if (!source) {
      unmatchedTarget.push(title);
      continue;
    }
    if (ambiguous.has(key)) {
      skippedAmbiguous.push(title);
      continue;
    }

    matched += 1;
    for (const { field, index } of fieldCols) {
      const incoming = (source[index] ?? '').trim();
      if (incoming !== '' && (row[index] ?? '').trim() === '') {
        row[index] = incoming;
        filledCells += 1;
        filledPerField[field] = (filledPerField[field] ?? 0) + 1;
      }
    }
    // Carry the cover-art pointer so `pnpm film:covers` works on the new env too.
    const coverCol = onto.col('hint_featured_image');
    if (coverCol !== -1 && (row[coverCol] ?? '').trim() === '') {
      row[coverCol] = (source[coverCol] ?? '').trim();
    }
    sourceByTitle.delete(key);
  }

  // Whatever is left in the index had no row in the target env.
  const unmatchedSource = [...sourceByTitle.values()]
    .map((row) => row[from.col('title')])
    .filter((title) => normaliseTitle(title ?? ''));

  fs.writeFileSync(args.out, stringifyCsv([onto.header, ...onto.body], { delimiter: args.delimiter }));

  console.log(`Wrote ${onto.body.length} rows → ${args.out}`);
  console.log(`\nmatched ${matched} of ${onto.body.length} target rows; filled ${filledCells} empty cells`);
  Object.entries(filledPerField)
    .sort((a, b) => b[1] - a[1])
    .forEach(([field, count]) => console.log(`    ${field.padEnd(22)} ${count}`));

  const report = (label, list) => {
    if (list.length > 0) {
      console.log(`\n${list.length} ${label}:`);
      list.forEach((title) => console.log(`    ${title}`));
    }
  };
  report('target film(s) with no source data', unmatchedTarget);
  report('source film(s) with no row in the target env — check these by hand', unmatchedSource);
  report('title(s) skipped as ambiguous in the source sheet', skippedAmbiguous);
};

main();
