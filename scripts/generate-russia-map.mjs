#!/usr/bin/env node
/**
 * Regenerate `src/modules/RussiaMap/regions.generated.ts` — the clickable map of
 * Russia on `/contacts/` (D4).
 *
 * The live page draws that map with **jqvmap**: jQuery 1.7.2 off a Google CDN,
 * `jquery.vmap.js`, `jquery.vmap.russia.js`, and an inline `onRegionClick` whose
 * whole body is a `switch` over the region code doing
 * `parent.location.assign("/contacts/<slug>/")`. None of it survives here — the
 * `../wp-includes/…` script paths resolve against *our* origin and 404, and a
 * page's content is not where a third-party jQuery belongs. So the map becomes a
 * static inline SVG: one real `<a href>` per region, no client JavaScript.
 *
 * Two inputs, and the order matters:
 *
 * 1. **The old `switch`**, read out of `wp/tests/fixtures/contacts.before.html` —
 *    48 live cases plus 15 commented-out ones, which name regions whose pages
 *    still exist. Those are the editor's own code→URL decisions and win outright.
 * 2. **Name matching** against the published children of page 529, for the
 *    regions the switch never covered. Region names and page titles disagree in
 *    form («Республика Башкортостан» vs «Башкортостан», «Ханты-Мансийский АО»),
 *    so both sides are normalised down to a sorted token set before comparing.
 *
 * A wrong guess sends a visitor to a 404, so an unmatched region is emitted
 * **unlinked** rather than linked to the closest-looking page, and every one is
 * printed. Every emitted href is checked against the real page list before the
 * file is written — the script fails rather than shipping a dead link.
 *
 *   node --env-file=.env scripts/generate-russia-map.mjs
 *   node --env-file=.env scripts/generate-russia-map.mjs --dry-run
 */

import fs from 'node:fs';
import path from 'node:path';
import { readArgs } from './lib/args.mjs';
import { plainText, readEnv, wpFetch } from './lib/wp.mjs';

const REPO = path.resolve(import.meta.dirname, '..');
const SOURCE = 'wp-includes/js/jquery.vmap.russia.js';
const SWITCH_FILE = path.join(REPO, 'wp/tests/fixtures/contacts.before.html');
const OUTPUT = path.join(REPO, 'src/modules/RussiaMap/regions.generated.ts');

/** The `/contacts/` index, whose published children are the regional pages. */
const CONTACTS_PARENT = 529;

/**
 * Хабаровский край is the one branch page that lives outside `/contacts/` — it
 * sits at the WordPress root, so the parent=529 listing cannot see it. The old
 * `switch` had no case for it either; this is the one hand-written link.
 */
const EXTRA_PAGES = { '/khabarovskiy/': 'Хабаровский край' };

/**
 * The one region name matching cannot reach and the old `switch` never had a
 * case for: WordPress titles Chechnya «Республика Чечня», jqvmap calls it
 * «Чеченская Республика», and no normalisation makes «чечня» and «чеченская»
 * the same token. It is the same subject, so it is written down rather than
 * guessed at.
 */
const CODE_ALIASES = { cc: '/contacts/chechnya/' };

const OPTIONS = { 'dry-run': { type: 'boolean', default: false } };

/**
 * `jQuery.fn.vectorMap('addMap', 'russia', { "width": …, "pathes": {…} })` —
 * the argument object is plain JSON, so the braces around it are all that has to
 * be found. `JSON.parse` then does the rest, which beats a regex over 162 KB.
 */
const parseVectorMap = (source) => {
  const start = source.indexOf('{', source.indexOf('addMap'));
  const end = source.lastIndexOf('}');
  const { width, height, pathes } = JSON.parse(source.slice(start, end + 1));
  return { width, height, regions: pathes };
};

/**
 * Every `case "xx": … assign("/path/")`, commented-out ones included.
 *
 * The input is a **capture of the page as it was before D4 rewrote it** — the
 * same fixture `wp/tests/od-pages.test.php` runs the body transform against, and
 * the reason this generator reads it from `wp/tests/fixtures/` rather than from
 * WordPress: once `od_pages_contacts()` has run, od-dev's page 529 no longer
 * carries the jqvmap block, and the 48+15 pairings the editor made by hand
 * exist nowhere else. Only some of them name matching can recover.
 */
const parseSwitch = (html) =>
  new Map(
    [...html.matchAll(/case "([a-z-]+)":\s*parent\.location\.assign\("([^"]+)"\)/g)].map(([, code, href]) => [
      code,
      href,
    ])
  );

/**
 * A region name or a page title reduced to a comparable core: the words that
 * name the place, with everything that only names its *kind* dropped.
 *
 * Sorted, because «Республика Саха (Якутия)» is «Республика Якутия (Саха)» in
 * WordPress and both mean the same subject.
 */
const NOISE = /^(республика|край|область|автономный|автономная|округ|ао|г|и|области|краю)$/;

const normalise = (value) =>
  plainText(value)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^а-я0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word && !NOISE.test(word))
    .sort()
    .join(' ');

const fetchRegionPages = async (env) => {
  const res = await wpFetch(
    env,
    `/wp/v2/pages?parent=${CONTACTS_PARENT}&per_page=100&status=publish&_fields=link,title`
  );
  if (!res.ok) {
    throw new Error(`GET /wp/v2/pages?parent=${CONTACTS_PARENT} -> ${res.status}`);
  }
  const pages = new Map(
    (await res.json()).map(({ link, title }) => [decodeURIComponent(new URL(link).pathname), plainText(title.rendered)])
  );
  for (const [href, title] of Object.entries(EXTRA_PAGES)) {
    pages.set(href, title);
  }
  return pages;
};

/** `{ code: {path, name} }` + the two link sources → the emitted region table. */
const buildRegions = (vectorMap, cases, pages) => {
  const byNormalisedTitle = new Map();
  for (const [href, title] of pages) {
    byNormalisedTitle.set(normalise(title), href);
  }

  const used = new Set();
  const regions = Object.entries(vectorMap.regions).map(([code, { path: d, name }]) => {
    /* The switch first: it is the editor's own decision, and it pairs regions
       with pages that no amount of name matching would ("Республика Северная
       Осетия" → `/contacts/alaniya/"). A case naming a page that has since been
       deleted is dropped here rather than emitted as a 404. */
    const fromSwitch = cases.get(code);
    const href =
      (fromSwitch && pages.has(fromSwitch) ? fromSwitch : null) ??
      byNormalisedTitle.get(normalise(name)) ??
      CODE_ALIASES[code];
    if (href) {
      used.add(href);
    }
    return { code, name, path: d, href: href ?? null };
  });

  return { regions, used };
};

/**
 * The `viewBox`, cropped to the drawn continent rather than the plugin's own box.
 *
 * jqvmap declares 990×593, and the 82 paths only occupy `5.74 53.09 979.36
 * 477.31` of it (measured once with `SVGGraphicsElement.getBBox()` in a browser —
 * the numbers are frozen 2016 plugin data and do not move). Rendering the
 * declared box puts 116 units of empty space above and below the map, which the
 * card's own padding then adds to: the map read visibly smaller inside its card
 * than Figma's does inside the mock's. Cropped, the air around it is 9 % of the
 * map's height against the mock's 8 %.
 *
 * Two units of slack on each side so a stroke on an edge region is not clipped.
 */
const VIEW_BOX = '4 51 983 481';

/** Prettier's own preference: single quotes, unless the value holds one. */
const quote = (value) =>
  value === null ? 'null' : /['\\]/.test(value) ? JSON.stringify(value) : `'${JSON.stringify(value).slice(1, -1)}'`;

const serialise = ({ width, height }, regions) => `/**
 * GENERATED — run \`pnpm map:generate\` instead of editing this file.
 *
 * The ${regions.length} regions of the jqvmap «russia» map (${width}×${height}), each with the
 * \`d\` the old page's plugin drew and the \`/contacts/…\` page it links to, where
 * there is one. See \`scripts/generate-russia-map.mjs\` for how the links are
 * derived — and for why an unmatched region is emitted with \`href: null\` rather
 * than pointed at the nearest-looking page.
 */

export interface MapRegion {
  /** jqvmap's ISO-2-ish region code, the SVG element id. */
  code: string;
  name: string;
  /** SVG path \`d\`, in the ${width}×${height} viewBox. */
  path: string;
  /** The region's page, or \`null\` when no page answers for it. */
  href: string | null;
}

/** Cropped to the drawn map; the plugin's own box is ${width}×${height}. */
export const RUSSIA_MAP_VIEW_BOX = '${VIEW_BOX}';

export const RUSSIA_MAP_REGIONS: MapRegion[] = [
${regions
  .map(
    ({ code, name, path: d, href }) =>
      `  { code: ${quote(code)}, name: ${quote(name)}, href: ${quote(href)}, path: ${quote(d)} },`
  )
  .join('\n')}
];
`;

const main = async () => {
  const { 'dry-run': dryRun } = readArgs(OPTIONS);
  const env = readEnv();

  const res = await fetch(`${env.base}/${SOURCE}`);
  if (!res.ok) {
    throw new Error(`GET /${SOURCE} -> ${res.status}`);
  }
  const vectorMap = parseVectorMap(await res.text());
  if (!fs.existsSync(SWITCH_FILE)) {
    throw new Error(`${path.relative(REPO, SWITCH_FILE)} is missing — see \`parseSwitch\`; it cannot be re-fetched.`);
  }
  const cases = parseSwitch(fs.readFileSync(SWITCH_FILE, 'utf8'));
  const pages = await fetchRegionPages(env);
  const { regions, used } = buildRegions(vectorMap, cases, pages);

  const dead = regions.filter(({ href }) => href && !pages.has(href));

  // An alias is a hint for a name matching cannot reach, not a promise that the
  // page is there: production keeps Chechnya in the trash where od-dev publishes
  // it. So an alias with no page greys its region like any other unlinked one —
  // out loud, because the alias is then only a note about a name.
  const aliases = new Set(Object.values(CODE_ALIASES));
  for (const region of dead.filter(({ href }) => aliases.has(href))) {
    console.log(`alias ${region.code} → ${region.href}: no published page, greyed`);
    region.href = '';
  }

  const fatal = dead.filter(({ href }) => href && !aliases.has(href));
  if (fatal.length > 0) {
    throw new Error(`${fatal.length} href(s) match no published page: ${fatal.map(({ href }) => href).join(', ')}`);
  }

  const linked = regions.filter(({ href }) => href);

  const file = serialise(vectorMap, regions);
  const pathBytes = regions.reduce((sum, { path: d }) => sum + Buffer.byteLength(d), 0);

  console.log(`${SOURCE}: ${vectorMap.width}×${vectorMap.height}, ${regions.length} regions`);
  console.log(`switch cases: ${cases.size}, region pages: ${pages.size}`);
  console.log(`linked: ${linked.length}, unlinked: ${regions.length - linked.length}`);
  console.log(
    `path data: ${(pathBytes / 1024).toFixed(1)} KiB, file: ${(Buffer.byteLength(file) / 1024).toFixed(1)} KiB`
  );

  const unlinked = regions.filter(({ href }) => !href);
  if (unlinked.length > 0) {
    console.log(`\nRegions with no page — drawn, not clickable:`);
    unlinked.forEach(({ code, name }) => console.log(`  ${code}  ${name}`));
  }

  const orphans = [...pages].filter(([href]) => !used.has(href));
  if (orphans.length > 0) {
    console.log(`\nPages with no region on the map — reachable only from the accordion:`);
    orphans.forEach(([href, title]) => console.log(`  ${href.padEnd(34)} ${title}`));
  }

  const droppedCases = [...cases].filter(([, href]) => !pages.has(href));
  if (droppedCases.length > 0) {
    console.log(`\nOld switch cases dropped — the page they named is gone:`);
    droppedCases.forEach(([code, href]) => console.log(`  ${code}  ${href}`));
  }

  if (dryRun) {
    console.log(`\n--dry-run: ${path.relative(REPO, OUTPUT)} not written.`);
    return;
  }
  fs.writeFileSync(OUTPUT, file);
  console.log(`\nWrote ${path.relative(REPO, OUTPUT)}.`);
};

await main();
