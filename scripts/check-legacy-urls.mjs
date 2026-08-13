/**
 * Verification gate 12 — do the live site's real URLs still resolve? (A8)
 *
 *   pnpm url:check                                  # against localhost:3000
 *   pnpm url:check -- --base https://stage.example  # against a deploy
 *   pnpm url:check -- --top 500 --fail-under 95
 *
 * The redesign changes URL shapes: the live site serves every post at a bare
 * `/<id>/` and the film catalogue at `/video/filmy|multy|…/`. Those shapes are
 * 59 % of all entry traffic, so a launch that 404s them is a launch that throws
 * away most of the site's search visibility. This replays the real URLs —
 * ranked by the entry visits each one actually earns — and reports what breaks,
 * weighted by traffic rather than by URL count.
 *
 * Input is the Yandex Metrica **«Страницы входа»** CSV export (Отчёты →
 * Стандартные отчёты → Содержание → Страницы входа → export). Point `--csv` at
 * it; the default is the copy under `~/Documents/od/ya.metrika/`.
 *
 * A 404 here is not automatically a bug. Expect two benign classes:
 *  - **Pages not yet redesigned** — every `/about/*`, `/materials/*`, … until
 *    A6's legacy fallback lands. That's what `--section-report` quantifies.
 *  - **Posts missing from the environment you're testing** — od-dev is a stale
 *    copy of prod and lacks the newest posts, so ids like 73381 404 locally and
 *    resolve on prod.
 * What must never appear is a *shape* failure: `/<id>/` or `/video/<slug>/`
 * failing across the board.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseCsv } from './lib/csv.mjs';

const DEFAULT_CSV = path.join(os.homedir(), 'Documents/od/ya.metrika');

const parseArgs = (argv) => {
  const args = { base: 'http://localhost:3000', csv: null, top: 200, concurrency: 8, failUnder: 0 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--base') {
      args.base = argv[(i += 1)].replace(/\/$/, '');
    } else if (arg === '--csv') {
      args.csv = argv[(i += 1)];
    } else if (arg === '--top') {
      args.top = Number(argv[(i += 1)]);
    } else if (arg === '--concurrency') {
      args.concurrency = Number(argv[(i += 1)]);
    } else if (arg === '--fail-under') {
      args.failUnder = Number(argv[(i += 1)]);
    } else if (arg !== '--') {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
};

/** Newest «Страницы входа» export in the directory, or the file itself. */
const resolveCsv = (given) => {
  const target = given ?? DEFAULT_CSV;
  if (!fs.existsSync(target)) {
    throw new Error(`No Metrica export at ${target} — pass --csv <file>.`);
  }
  if (!fs.statSync(target).isDirectory()) {
    return target;
  }
  const candidates = fs
    .readdirSync(target)
    .filter((name) => name.startsWith('Страницы входа') && name.endsWith('.csv'))
    .sort();
  if (candidates.length === 0) {
    throw new Error(`No «Страницы входа» CSV in ${target}.`);
  }
  return path.join(target, candidates.at(-1));
};

/**
 * Entry paths and their visit counts, biggest first. The export is a tree — the
 * `Страница входа` column is the leaf, so summing it double-counts nothing.
 * Rows carrying a query string are tracking noise (`?fbclid=…`), not URLs
 * anyone needs to keep working.
 */
const readEntryPaths = (file) => {
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  const header = rows[0];
  const urlColumn = header.indexOf('Страница входа');
  const visitsColumn = header.indexOf('Визиты');
  if (urlColumn < 0 || visitsColumn < 0) {
    throw new Error('Not a «Страницы входа» export — missing the «Страница входа»/«Визиты» columns.');
  }

  const visits = new Map();
  for (const row of rows.slice(2)) {
    const match = /^https?:\/\/([^/]+)(\/.*)?$/.exec((row[urlColumn] ?? '').trim());
    if (!match || !match[1].includes('obshee-delo.ru')) {
      continue;
    }
    const pathname = match[2] || '/';
    if (pathname.includes('?')) {
      continue;
    }
    visits.set(pathname, (visits.get(pathname) ?? 0) + Number(row[visitsColumn] || 0));
  }
  return [...visits.entries()].sort((a, b) => b[1] - a[1]).map(([pathname, count]) => ({ pathname, count }));
};

const section = (pathname) => {
  const [first] = pathname.split('/').filter(Boolean);
  if (!first) {
    return '/';
  }
  return /^\d+$/.test(first) ? '/<id>/' : `/${first}/`;
};

const check = async (base, pathname) => {
  try {
    // `redirect: 'follow'` on purpose — a 308 into a working page is a pass;
    // what we're hunting is the URL that ends nowhere.
    const res = await fetch(base + encodeURI(pathname), { redirect: 'follow' });
    return res.status;
  } catch (error) {
    return `ERR ${error.code ?? error.name}`;
  }
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const csv = resolveCsv(args.csv);
  const targets = readEntryPaths(csv).slice(0, args.top);
  if (targets.length === 0) {
    throw new Error('The export produced no obshee-delo.ru entry URLs.');
  }

  console.log(`${path.basename(csv)} → top ${targets.length} entry URLs against ${args.base}\n`);

  const results = [];
  const queue = targets.slice();
  await Promise.all(
    Array.from({ length: Math.min(args.concurrency, targets.length) }, async () => {
      for (let target = queue.shift(); target; target = queue.shift()) {
        results.push({ ...target, status: await check(args.base, target.pathname) });
        process.stderr.write('.');
      }
    })
  );
  process.stderr.write('\n\n');

  const totalVisits = results.reduce((sum, result) => sum + result.count, 0);
  const byStatus = new Map();
  for (const result of results) {
    const bucket = byStatus.get(result.status) ?? { urls: 0, visits: 0 };
    byStatus.set(result.status, { urls: bucket.urls + 1, visits: bucket.visits + result.count });
  }

  console.log(`${results.length} URLs covering ${totalVisits} entry visits`);
  for (const [status, bucket] of [...byStatus].sort((a, b) => b[1].visits - a[1].visits)) {
    console.log(
      `  ${String(status).padEnd(4)} ${String(bucket.urls).padStart(4)} URLs  ` +
        `${String(bucket.visits).padStart(6)} visits (${((bucket.visits / totalVisits) * 100).toFixed(1)}%)`
    );
  }

  const failed = results.filter((result) => result.status !== 200).sort((a, b) => b.count - a.count);
  const okVisits = totalVisits - failed.reduce((sum, result) => sum + result.count, 0);
  const coverage = (okVisits / totalVisits) * 100;

  if (failed.length > 0) {
    const bySection = new Map();
    for (const result of failed) {
      const key = section(result.pathname);
      const bucket = bySection.get(key) ?? { visits: 0, examples: [] };
      bucket.visits += result.count;
      if (bucket.examples.length < 3) {
        bucket.examples.push(result.pathname);
      }
      bySection.set(key, bucket);
    }
    console.log(`\nNot reachable — ${failed.length} URLs, grouped by section:`);
    for (const [key, bucket] of [...bySection].sort((a, b) => b[1].visits - a[1].visits)) {
      console.log(`  ${String(bucket.visits).padStart(6)} visits  ${key.padEnd(20)} ${bucket.examples.join(', ')}`);
    }
    console.log('\n  A whole section here means «not redesigned yet» (A6). A scattering of');
    console.log('  /<id>/ means those posts are absent from the WordPress you pointed at.');
  }

  console.log(`\nEntry-traffic coverage: ${coverage.toFixed(1)}%`);
  if (args.failUnder > 0 && coverage < args.failUnder) {
    console.error(`FAIL — below the --fail-under ${args.failUnder}% threshold.`);
    process.exitCode = 1;
  }
};

await main();
