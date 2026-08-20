/**
 * Regenerate `src/types/generated/wp-json-openapi.ts` from a WordPress install.
 *
 *   pnpm generate:types                                  # the host in redocly.yml
 *   pnpm generate:types -- --from https://od.webtm.ru    # another tier
 *   pnpm generate:types -- --keep                        # leave the patched schema on disk
 *
 * A wrapper around `openapi-typescript` rather than a direct call, for three
 * reasons that each cost an afternoon once:
 *
 *  1. **WordPress 7.1 emits a schema openapi-typescript refuses.** Core's new
 *     `view-config` declares eight properties as `[]` where a schema object
 *     belongs, and the generator stops at the first one:
 *     `#/components/schemas/view-config/default_view/filters: invalid property
 *     value. Expected Schema Object or boolean, got Array`. Rewriting those to
 *     `{}` is enough, and it is narrow enough to be safe — see `patchSchema`.
 *  2. **`redocly.yml` always wins over a path argument.** Passing a URL or a
 *     file to the CLI while that config declares an api is answered with
 *     «APIs are specified both in Redocly Config and CLI argument. Only using
 *     Redocly config» — and then the *config's* host is generated from, quietly
 *     overwriting the committed file with the wrong install's types. So the
 *     generator runs from a directory where no such config exists.
 *  3. **The output needs Prettier or the diff is unreadable.** The CLI emits
 *     double quotes and four-space indent, so skipping it buries the real change
 *     in ~35 000 lines of formatting.
 *
 * `--from` is the flag to reach for when repointing a tier: `redocly.yml` stays
 * the default so `pnpm generate:types` on a fresh clone still means something,
 * but it is not the source of truth for which install the types describe.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readArgs } from './lib/args.mjs';

const REPO = path.resolve(import.meta.dirname, '..');
const OUTPUT = path.join(REPO, 'src/types/generated/wp-json-openapi.ts');
const CONFIG = path.join(REPO, 'redocly.yml');

const OPTIONS = {
  from: { type: 'string' },
  keep: { type: 'boolean', default: false },
};

/** The `root:` of the first api in `redocly.yml`, so the default host has one home. */
const configuredRoot = () => {
  const found = fs.readFileSync(CONFIG, 'utf8').match(/^\s*root:\s*(\S+)/m);
  if (!found) {
    throw new Error(`no \`root:\` in ${path.relative(REPO, CONFIG)} — pass --from <url>`);
  }
  return found[1];
};

/**
 * Rewrite `{}` over every empty array that sits **where a schema object belongs**:
 * the direct value of a key inside a `properties` map. That is exactly the eight
 * `view-config` nodes and nothing else — measured on WP 7.1, which also carries
 * 39 legal `default: []`, and those must survive untouched or every list-valued
 * field in the API loses its default.
 *
 * @param {unknown} node    The document, walked in place.
 * @param {string[]} trail  Where we are, for the report.
 * @param {string[]} fixed  Accumulates the JSON pointers rewritten.
 */
const patchSchema = (node, trail, fixed) => {
  if (Array.isArray(node)) {
    node.forEach((item, index) => patchSchema(item, [...trail, String(index)], fixed));
    return;
  }
  if (node === null || typeof node !== 'object') {
    return;
  }

  const inProperties = trail.at(-1) === 'properties';
  for (const [key, value] of Object.entries(node)) {
    if (inProperties && Array.isArray(value) && value.length === 0) {
      node[key] = {};
      fixed.push(`#/${[...trail, key].join('/')}`);
      continue;
    }
    patchSchema(value, [...trail, key], fixed);
  }
};

const main = async () => {
  const args = readArgs(OPTIONS);
  const root = args.from ?? configuredRoot();

  const res = await fetch(root);
  if (!res.ok) {
    throw new Error(`GET ${root} -> ${res.status}`);
  }
  const schema = await res.json();

  const fixed = [];
  patchSchema(schema, [], fixed);
  console.log(`${root}: ${(JSON.stringify(schema).length / 1024).toFixed(0)} KiB`);
  console.log(`patched ${fixed.length} empty-array schema node(s)${fixed.length ? ':' : ''}`);
  for (const pointer of fixed) {
    console.log(`  ${pointer}`);
  }

  // A directory of its own, because that is what keeps `redocly.yml` out of the
  // generator's discovery path — see the header.
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'od-wp-openapi-'));
  const patched = path.join(work, 'wp-json-openapi.json');
  fs.writeFileSync(patched, JSON.stringify(schema));

  try {
    execFileSync(path.join(REPO, 'node_modules/.bin/openapi-typescript'), [patched, '--output', OUTPUT], {
      cwd: work,
      stdio: 'inherit',
    });
    execFileSync(path.join(REPO, 'node_modules/.bin/prettier'), ['--write', OUTPUT], { stdio: 'inherit' });
  } finally {
    if (args.keep) {
      console.log(`kept ${patched}`);
    } else {
      fs.rmSync(work, { recursive: true, force: true });
    }
  }

  const lines = fs.readFileSync(OUTPUT, 'utf8').split('\n').length;
  console.log(`${path.relative(REPO, OUTPUT)}: ${lines} lines`);
};

await main();
