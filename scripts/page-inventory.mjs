#!/usr/bin/env node
/**
 * Where every WordPress page is served from, and how much traffic each way carries.
 *
 * Four buckets, and the point of the script is that all four are *derived* rather
 * than listed: a page is
 *
 * 1. **shadowed** — a native route or a proxy redirect owns its URL, so the page
 *    never reaches `[...slug]` at all;
 * 2. **redesigned** — `wp/scripts/od-pages.php`'s registry rewrites its content,
 *    and the repo's CSS draws it;
 * 3. **passthrough** — it renders through `modules/WpPage` exactly as the editor
 *    left it;
 * 4. **iframe** — it is on `shared/config/legacyEmbedPages.ts`, the A6 opt-out list.
 *
 * The counts come from `/wp/v2/pages` plus those two source files, so they cannot
 * drift from the code the way a hand-written table in `docs/` does — which is why
 * this exists. `docs/page-inventory.md` is this script's output, dated.
 *
 * With `--csv` (default: the newest exports under `~/Documents/od/ya.metrika/`) it
 * also weights the buckets by Yandex Metrica pageviews and entry visits. Entry
 * visits are what search sends; pageviews are what a visitor actually looks at,
 * and the two rank the buckets differently — see `docs/implementation-notes.md` §7.
 *
 *   node --env-file=.env scripts/page-inventory.mjs
 *   node --env-file=.env scripts/page-inventory.mjs --list passthrough
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readArgs } from './lib/args.mjs';
import { parseCsv } from './lib/csv.mjs';
import { readEnv, wpFetch } from './lib/wp.mjs';

const REPO = path.resolve(import.meta.dirname, '..');
const DEFAULT_CSV = path.join(os.homedir(), 'Documents/od/ya.metrika');

const OPTIONS = {
  csv: { type: 'string' },
  list: { type: 'string' },
  top: { type: 'string', default: '15' },
};

/** URLs a native route or a `src/proxy.ts` redirect owns, so `[...slug]` never sees them. */
const SHADOWED = [
  '/',
  '/news/',
  '/materials/articles/',
  '/video/',
  '/video/short/', // 301 to /video/
  '/video/filmy/',
  '/video/multy/',
  '/video/roliki/',
  '/video/famous-people/',
];

/** The `od_pages_registry()` paths — read from the script rather than restated. */
const readRedesigned = () => {
  const php = fs.readFileSync(path.join(REPO, 'wp/scripts/od-pages.php'), 'utf8');
  // Everything after the profile loop addresses `profile` records, not pages.
  const start = php.indexOf('function od_pages_registry');
  const end = php.indexOf('// One entry per person', start);
  return new Set([...php.slice(start, end).matchAll(/'path' => '([^']+)'/g)].map(([, slug]) => `/${slug}/`));
};

const readEmbedded = () => {
  const ts = fs.readFileSync(path.join(REPO, 'src/shared/config/legacyEmbedPages.ts'), 'utf8');
  const list = ts.slice(ts.indexOf('export const LEGACY_EMBED_PAGES'));
  return new Set([...list.matchAll(/'(\/[^']*)'/g)].map(([, entry]) => entry));
};

const fetchPagePaths = async (env) => {
  const paths = new Set();
  for (let page = 1; ; page += 1) {
    const res = await wpFetch(env, `/wp/v2/pages?status=publish&per_page=100&_fields=link&page=${page}`);
    if (!res.ok) {
      throw new Error(`GET /wp/v2/pages?page=${page} -> ${res.status}`);
    }
    const batch = await res.json();
    batch.forEach(({ link }) => paths.add(decodeURIComponent(new URL(link).pathname)));
    if (batch.length < 100) {
      return [...paths].sort();
    }
  }
};

const BUCKETS = ['native route', 'WP page, redesigned', 'WP page, passthrough', 'A6 iframe', 'no page — 404', 'other'];

/** Metrica truncates a long path with an ellipsis; nothing can be said about those rows. */
const TRUNCATED = '…';

/**
 * Which bucket a *requested* URL lands in. Wider than the page inventory, because
 * Metrica reports URLs that are posts, redirects and dead links too.
 */
const classify = (requested, { pages, redesigned, embedded }) => {
  const url = requested.endsWith('/') ? requested : `${requested}/`;
  if (url.includes(TRUNCATED)) {
    return 'other';
  }
  if (/^\/(\d+\/+|)$/.test(url)) {
    return 'native route'; // home, and post detail at /<id>/ — stray slashes and all
  }
  if (/^\/(news\/|)page\/\d+\/$/.test(url) || url.startsWith('/category/') || url.startsWith('/profile/')) {
    return 'native route';
  }
  if (SHADOWED.includes(url) || SHADOWED.some((base) => base !== '/' && url.startsWith(`${base}page/`))) {
    return 'native route';
  }
  // A listed path takes its children's pagination with it (`/actual/page/2/`).
  const paginationParent = url.replace(/page\/\d+\/$/, '');
  if (embedded.has(url) || embedded.has(paginationParent)) {
    return 'A6 iframe';
  }
  if (redesigned.has(url)) {
    return 'WP page, redesigned';
  }
  if (pages.has(url)) {
    return 'WP page, passthrough';
  }
  if (/^\/wp-(content|admin|json|login)/.test(url)) {
    return 'other';
  }
  return 'no page — 404'; // or the automatic iframe fallback, if the frozen copy has it
};

/** The newest export whose filename starts with `prefix`. */
const resolveCsv = (given, prefix) => {
  const target = given ?? DEFAULT_CSV;
  if (!fs.existsSync(target)) {
    return null;
  }
  if (!fs.statSync(target).isDirectory()) {
    return target;
  }
  const found = fs
    .readdirSync(target)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.csv'))
    .sort()
    .at(-1);
  return found ? path.join(target, found) : null;
};

/** Sum one Metrica export's metric column per bucket. Both exports are leaf rows only. */
const weigh = (file, metric, config) => {
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  const [header] = rows;
  const urlColumn = header.findIndex((name) => name === 'Адрес страницы' || name === 'Страница входа');
  const metricColumn = header.indexOf(metric);
  if (urlColumn < 0 || metricColumn < 0) {
    throw new Error(`${path.basename(file)}: no «${metric}» column — wrong export?`);
  }

  const totals = new Map(BUCKETS.map((bucket) => [bucket, 0]));
  const perPath = new Map();
  for (const row of rows.slice(2)) {
    const url = (row[urlColumn] ?? '').trim();
    if (!url.includes('obshee-delo.ru')) {
      continue;
    }
    const requested = decodeURIComponent(new URL(url).pathname);
    const bucket = classify(requested, config);
    const value = Number(row[metricColumn] || 0);
    totals.set(bucket, totals.get(bucket) + value);
    const key = `${bucket}\t${requested}`;
    perPath.set(key, (perPath.get(key) ?? 0) + value);
  }
  return { totals, perPath, file };
};

const percent = (value, sum) => `${((value / sum) * 100).toFixed(1)} %`;

const report = (label, { totals, file }) => {
  const sum = [...totals.values()].reduce((a, b) => a + b, 0);
  console.log(`\n${label} — ${path.basename(file)}, ${sum} total`);
  for (const bucket of BUCKETS) {
    const value = totals.get(bucket);
    if (value > 0) {
      console.log(`  ${percent(value, sum).padStart(7)}  ${String(value).padStart(6)}  ${bucket}`);
    }
  }
};

const main = async () => {
  const args = readArgs(OPTIONS);
  const config = {
    pages: new Set(await fetchPagePaths(readEnv())),
    redesigned: readRedesigned(),
    embedded: readEmbedded(),
  };

  const owned = [...config.pages].map((page) => [page, classify(page, config)]);
  const counted = new Map(BUCKETS.map((bucket) => [bucket, owned.filter(([, entry]) => entry === bucket)]));

  console.log(`published pages: ${config.pages.size}`);
  for (const bucket of BUCKETS) {
    const pages = counted.get(bucket);
    if (pages.length > 0) {
      console.log(`  ${String(pages.length).padStart(4)}  ${bucket}`);
    }
  }

  if (args.list) {
    const match = BUCKETS.find((bucket) => bucket.includes(args.list));
    if (!match) {
      throw new Error(`--list must match one of: ${BUCKETS.join(' · ')}`);
    }
    console.log(`\n${match}:`);
    counted.get(match).forEach(([page]) => console.log(`  ${page}`));
  }

  const views = resolveCsv(args.csv, 'Популярное');
  const entries = resolveCsv(args.csv, 'Страницы входа');
  if (!views && !entries) {
    console.log(`\nNo Metrica export under ${args.csv ?? DEFAULT_CSV} — skipping the traffic weighting.`);
    return;
  }

  const weighted = [
    views && ['pageviews', weigh(views, 'Просмотры', config)],
    entries && ['entry visits', weigh(entries, 'Визиты', config)],
  ].filter(Boolean);
  weighted.forEach(([label, result]) => report(label, result));

  const top = Number(args.top);
  for (const [label, { perPath }] of weighted) {
    for (const bucket of ['WP page, redesigned', 'WP page, passthrough', 'A6 iframe', 'no page — 404']) {
      const rows = [...perPath.entries()]
        .filter(([key]) => key.startsWith(`${bucket}\t`))
        .sort((a, b) => b[1] - a[1])
        .slice(0, top);
      console.log(`\ntop ${bucket} by ${label}`);
      rows.forEach(([key, value]) => console.log(`  ${String(value).padStart(6)}  ${key.split('\t')[1]}`));
    }
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
