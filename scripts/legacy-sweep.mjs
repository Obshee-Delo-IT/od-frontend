/**
 * Verification V19 — does the A6 transform survive *every* legacy page? (A6)
 *
 *   pnpm legacy:sweep                                   # against localhost:3000
 *   pnpm legacy:sweep -- --base https://stage.example
 *   pnpm legacy:sweep -- --limit 20 --verbose
 *
 * The transform's unit tests run against three captured pages. This runs it
 * against all ~172, end to end through the real route, and answers the two
 * questions those three cannot:
 *
 *  - **ASM8** — does any page lose an external script? Removing chrome is only
 *    safe because no `wp_footer` bootstrap sits inside it. This diffs the
 *    `<script src>` set of the upstream page against our proxied copy and
 *    reports every loss. **Any loss is a failure.**
 *  - **ASM1** — how many pages have no `<section id="middle">`? After design
 *    D14 that is informational rather than fatal (the transform removes chrome
 *    instead of keeping the content section), so it is reported as a count, not
 *    an error.
 *
 * It also checks the invariants that are cheap to see from outside: exactly one
 * `<base>` and no `target` on it, no surviving Metrica reference, no chrome
 * element left behind, and no in-content link still addressing a legacy *page*.
 *
 * Needs a running server (`pnpm dev`) with `WP_LEGACY_BASE` set, and network
 * access to the legacy origin. Deliberately not part of `pnpm test`: it is a
 * one-off sweep against a live site, and the test suite never touches the
 * network.
 */

const DEFAULT_LEGACY = 'https://obshee-delo.ru';

/**
 * The same chromeless hint the proxy sends (`LEGACY_EMBED_QUERY`). The upstream
 * comparison **must** carry it: measured on the live origin, `?od_embed=1`
 * bypasses WP Rocket's page cache, so the origin serves an unoptimised render —
 * 70 130 bytes against 87 843, 48 script tags against 53, and none of
 * wp-rocket's own assets. Diffing the cached page against our copy of the
 * uncached one reports five phantom "lost scripts" on every page.
 */
const EMBED_QUERY = 'od_embed=1';

const OPTIONS = {
  base: { type: 'string', default: 'http://localhost:3000' },
  legacy: { type: 'string', default: DEFAULT_LEGACY },
  sitemap: { type: 'string' },
  limit: { type: 'string', default: '0' },
  concurrency: { type: 'string', default: '4' },
  verbose: { type: 'boolean', default: false },
};

const get = async (url) => {
  const response = await fetch(url, {
    headers: { accept: 'text/html', 'user-agent': 'od-frontend legacy-sweep' },
  });
  return { status: response.status, html: response.ok ? await response.text() : '' };
};

/**
 * The same masking the transform uses, in miniature: blank the contents of
 * comments, `<script>` and `<style>` so tag-like text inside them is not
 * counted as markup. Without it the polyfill's `document.write('<scr'+'ipt>')`
 * shows up as six phantom scripts.
 */
const maskInert = (html) => {
  const lower = html.toLowerCase();
  let out = '';
  let index = 0;
  while (index < html.length) {
    const open = html.indexOf('<', index);
    if (open < 0) {
      out += html.slice(index);
      break;
    }
    out += html.slice(index, open);
    if (lower.startsWith('<!--', open)) {
      const close = lower.indexOf('-->', open + 4);
      const end = close < 0 ? html.length : close + 3;
      out += ' '.repeat(end - open);
      index = end;
      continue;
    }
    const raw = /^<(script|style)\b/.exec(lower.slice(open, open + 8));
    if (raw) {
      const tagEnd = html.indexOf('>', open);
      if (tagEnd < 0) {
        out += html.slice(open);
        break;
      }
      const close = lower.indexOf(`</${raw[1]}`, tagEnd + 1);
      if (close < 0) {
        out += html.slice(open, tagEnd + 1) + ' '.repeat(html.length - tagEnd - 1);
        break;
      }
      out += html.slice(open, tagEnd + 1) + ' '.repeat(close - tagEnd - 1);
      index = close;
      continue;
    }
    out += '<';
    index = open + 1;
  }
  return out;
};

const scriptSources = (html) => {
  const sources = new Set();
  for (const tag of maskInert(html).match(/<script\b[^>]*>/gi) ?? []) {
    const src = /\ssrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
    if (src) {
      sources.add((src[2] ?? src[3] ?? src[4]).trim());
    }
  }
  return sources;
};

const count = (html, pattern) => (maskInert(html).match(pattern) ?? []).length;

const ASSET_PATH = /^\/(?:wp-content|wp-includes|wp-json)\//i;

/** In-content links that still resolve to a legacy *page* — the LCP-011 invariant. */
const leakingLinks = (html, pageUrl, legacyOrigin) => {
  const base = /<base\b[^>]*\shref\s*=\s*["']([^"']+)["']/i.exec(maskInert(html))?.[1] ?? pageUrl;
  const self = new URL(base);
  const leaks = [];
  for (const tag of maskInert(html).match(/<a\b[^>]*>/gi) ?? []) {
    const href = /\shref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
    if (!href) {
      continue;
    }
    const value = (href[2] ?? href[3] ?? href[4]).replace(/&amp;/g, '&');
    let url;
    try {
      url = new URL(value, base);
    } catch {
      continue;
    }
    if (url.origin !== legacyOrigin || ASSET_PATH.test(url.pathname)) {
      continue;
    }
    if (url.pathname === self.pathname && url.search === self.search) {
      continue; // a same-document fragment never leaves the page
    }
    leaks.push(value);
  }
  return leaks;
};

/**
 * Where the transform was told the new site lives — read out of the injected
 * runtime's own config, so the sweep cannot disagree with the server about it.
 */
const siteOriginOf = (html) => /"siteOrigin"\s*:\s*"([^"]+)"/.exec(html)?.[1] ?? null;

const inspect = async ({ base, legacy }, path) => {
  const [upstream, proxied] = await Promise.all([get(`${legacy}${path}?${EMBED_QUERY}`), get(`${base}/legacy${path}`)]);

  if (proxied.status !== 200) {
    return { path, ok: false, reason: `proxy answered ${proxied.status} (upstream ${upstream.status})` };
  }

  const lost = [...scriptSources(upstream.html)].filter(
    (src) => !src.includes('mc.yandex.ru') && !scriptSources(proxied.html).has(src)
  );
  const bases = maskInert(proxied.html).match(/<base\b[^>]*>/gi) ?? [];
  const problems = [];

  if (lost.length > 0) {
    problems.push(`lost ${lost.length} script(s): ${lost.slice(0, 3).join(', ')}`);
  }
  if (bases.length !== 1) {
    problems.push(`${bases.length} <base> elements`);
  }
  if (bases.some((tag) => /\starget\s*=/i.test(tag))) {
    problems.push('<base> carries a target');
  }
  if (count(proxied.html, /mc\.yandex\.ru/gi) > 0) {
    problems.push('Metrica survived');
  }
  if (/<(header|section|footer)\b[^>]*\bid=["'](header|bottom|footer)["']/i.test(maskInert(proxied.html))) {
    problems.push('chrome survived');
  }
  // Only meaningful when the two origins differ. They are the same string on a
  // developer's machine (`SITE_URL` is unset and defaults to production), and
  // there a rewritten link is indistinguishable from an un-rewritten one.
  const site = siteOriginOf(proxied.html);
  const linksComparable = site !== null && site !== legacy;
  const leaks = linksComparable ? leakingLinks(proxied.html, `${legacy}${path}`, legacy) : [];
  if (leaks.length > 0) {
    problems.push(`${leaks.length} link(s) still on the legacy origin: ${leaks.slice(0, 2).join(', ')}`);
  }

  return {
    path,
    ok: problems.length === 0,
    reason: problems.join('; '),
    boundaryMiss: !/<section\b[^>]*\bid=["']middle["']/i.test(maskInert(upstream.html)),
    linksComparable,
    upstreamScripts: scriptSources(upstream.html).size,
    bytes: proxied.html.length,
  };
};

const run = async () => {
  const args = readArgs(OPTIONS);
  const base = origin(args.base);
  const legacy = origin(args.legacy);
  const limit = Number(args.limit);
  const sitemapUrl = args.sitemap ?? `${legacy}/page-sitemap.xml`;

  const sitemap = await get(sitemapUrl);
  if (sitemap.status !== 200) {
    throw new Error(`Could not read ${sitemapUrl}: HTTP ${sitemap.status}`);
  }
  let paths = [...sitemap.html.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => new URL(match[1].trim()).pathname)
    .filter((path) => path !== '/');
  paths = [...new Set(paths)];
  if (limit > 0) {
    paths = paths.slice(0, limit);
  }

  console.log(`Sweeping ${paths.length} legacy pages: ${legacy} → ${base}/legacy/*\n`);

  const results = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < paths.length) {
      const path = paths[(cursor += 1) - 1];
      try {
        results.push(await inspect(args, path));
      } catch (error) {
        results.push({ path, ok: false, reason: `threw: ${error.message}` });
      }
      if (args.verbose) {
        const last = results[results.length - 1];
        console.log(`  ${last.ok ? 'ok  ' : 'FAIL'} ${last.path}${last.reason ? ` — ${last.reason}` : ''}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Number(args.concurrency) }, worker));

  const failed = results.filter((result) => !result.ok);
  const boundaryMisses = results.filter((result) => result.boundaryMiss);

  console.log(`\n  pages swept:        ${results.length}`);
  console.log(`  clean:              ${results.length - failed.length}`);
  console.log(`  failures:           ${failed.length}`);
  console.log(`  boundary misses:    ${boundaryMisses.length} (ASM1 — informational since design D14)`);

  if (results.some((result) => result.linksComparable === false)) {
    console.log(
      `\n  Note: the link check was skipped — the server's SITE_URL is the legacy origin,\n` +
        `  so a rewritten link and an un-rewritten one are the same string. Set SITE_URL\n` +
        `  to this deployment's own origin to make it meaningful.`
    );
  }

  if (boundaryMisses.length > 0) {
    console.log(`\n  Pages with no section#middle:`);
    for (const result of boundaryMisses.slice(0, 20)) {
      console.log(`    ${result.path}`);
    }
  }
  if (failed.length > 0) {
    console.log(`\n  Failures:`);
    for (const result of failed) {
      console.log(`    ${result.path} — ${result.reason}`);
    }
    process.exitCode = 1;
    return;
  }
  const linksChecked = results.every((result) => result.linksComparable !== false);
  console.log(
    `\n  No page lost a script or kept its chrome${linksChecked ? ', and none leaked a link' : ''}.` +
      ` ASM8 holds across the sweep.`
  );
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
