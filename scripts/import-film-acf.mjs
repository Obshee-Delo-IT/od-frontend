/**
 * Write a filled-in film worksheet back into the `group_film_meta` ACF fields.
 *
 *   pnpm film:import                       # dry run against .scratch/film-worksheet.csv
 *   pnpm film:import -- --apply            # actually write
 *   pnpm film:import -- --in sheet.csv --delimiter ';' --only 70570,71933
 *
 * Rules:
 *  - Dry run by default. Nothing is written without `--apply`.
 *  - Only fields whose cell differs from the live value are sent.
 *  - An EMPTY cell means «leave WordPress alone» — it never clears a field, so a
 *    partially filled sheet is always safe to import.
 *  - To deliberately clear a field, put a single `-` in the cell.
 *  - `hint_*` and the read-only meta columns (title/category/wp_link) are ignored.
 */

import fs from 'node:fs';
import { parseCsvRecords } from './lib/csv.mjs';
import { ACF_FIELDS, readEnv, wpFetch } from './lib/wp.mjs';

const CLEAR_TOKEN = '-';

/**
 * od-dev is slow and intermittently answers with a 503 HTML error page, which
 * would otherwise blow up `res.json()` mid-run. Retry, and hand back an error
 * instead of throwing so one bad post can't abort the other 98.
 */
const requestJson = async (env, path, init, attempts = 3) => {
  let lastError = 'unknown error';
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await wpFetch(env, path, init);
      const body = await res.text();
      if (!res.ok) {
        lastError = `HTTP ${res.status}: ${body.slice(0, 120).replace(/\s+/g, ' ')}`;
      } else {
        try {
          return { data: JSON.parse(body) };
        } catch {
          lastError = `non-JSON response: ${body.slice(0, 120).replace(/\s+/g, ' ')}`;
        }
      }
    } catch (error) {
      lastError = error.message;
    }
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  return { error: lastError };
};

const parseArgs = (argv) => {
  const args = { in: '.scratch/film-worksheet.csv', delimiter: ',', apply: false, only: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--in') {
      args.in = argv[(i += 1)];
    } else if (arg === '--delimiter') {
      args.delimiter = argv[(i += 1)];
    } else if (arg === '--apply') {
      args.apply = true;
    } else if (arg === '--only') {
      args.only = new Set(argv[(i += 1)].split(',').map((id) => id.trim()));
    } else if (arg !== '--') {
      // `pnpm run x -- --flag` forwards the bare separator too.
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const env = readEnv();

  const records = parseCsvRecords(fs.readFileSync(args.in, 'utf8'), { delimiter: args.delimiter });
  if (records.length === 0) {
    throw new Error(`No rows found in ${args.in} — wrong --delimiter?`);
  }

  const targets = records.filter((row) => /^\d+$/.test(row.id?.trim() ?? '') && (!args.only || args.only.has(row.id.trim())));
  console.log(`${args.apply ? 'APPLY' : 'DRY RUN'} — ${targets.length} rows from ${args.in}\n`);

  let changedPosts = 0;
  let changedFields = 0;
  let failed = 0;

  for (const row of targets) {
    const id = row.id.trim();

    const read = await requestJson(env, `/wp/v2/posts/${id}?_fields=id,title,acf`);
    if (read.error) {
      console.log(`✗ ${id} — could not read post (${read.error})`);
      failed += 1;
      continue;
    }
    const post = read.data;
    const live = post.acf ?? {};

    const patch = {};
    const diff = [];
    for (const field of ACF_FIELDS) {
      const cell = (row[field] ?? '').trim();
      if (cell === '') {
        continue; // Blank never clears — see the header comment.
      }
      const next = cell === CLEAR_TOKEN ? '' : cell;
      const current = String(live[field] ?? '').trim();
      if (next !== current) {
        patch[field] = next;
        diff.push(`    ${field}: ${current || '∅'} → ${next || '∅'}`);
      }
    }

    if (diff.length === 0) {
      continue;
    }

    changedPosts += 1;
    changedFields += diff.length;
    console.log(`${args.apply ? '→' : '·'} ${id} ${String(post.title?.rendered ?? '').slice(0, 60)}`);
    console.log(diff.join('\n'));

    if (!args.apply) {
      continue;
    }

    // A write is not safe to retry blindly, but ACF writes are idempotent —
    // the same patch applied twice lands the same values.
    const write = await requestJson(env, `/wp/v2/posts/${id}`, {
      method: 'POST',
      body: JSON.stringify({ acf: patch }),
    });
    if (write.error) {
      console.log(`  ✗ write failed (${write.error})`);
      failed += 1;
      continue;
    }

    // ACF silently drops values for fields it doesn't recognise, so confirm.
    const saved = write.data.acf ?? {};
    const rejected = Object.keys(patch).filter((field) => String(saved[field] ?? '').trim() !== patch[field]);
    if (rejected.length > 0) {
      console.log(`  ✗ not persisted: ${rejected.join(', ')}`);
      failed += 1;
    }
  }

  console.log(
    `\n${changedFields} field(s) across ${changedPosts} post(s)${failed ? `, ${failed} failure(s)` : ''}.` +
      (args.apply ? '' : '\nRe-run with --apply to write.')
  );
  process.exitCode = failed > 0 ? 1 : 0;
};

await main();
