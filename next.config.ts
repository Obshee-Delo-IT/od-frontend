import { getWpMediaCdn } from './src/shared/api/mediaCdn';
import { svgoConfig } from './src/shared/config/svgo';
import type { NextConfig } from 'next';

const mediaCdn = getWpMediaCdn();

const nextConfig: NextConfig = {
  output: 'standalone',

  // `pnpm-workspace.yaml` at the repo root makes Next trace files from the
  // workspace root rather than from here, and the standalone build then nests
  // itself one directory deep — `/app/app/server.js` inside the image, while the
  // Dockerfile's `CMD node server.js` looks in `/app`. The container exited on
  // `Cannot find module '/app/server.js'` and never served a request. Pinning
  // the trace root to this directory flattens the output, which is what every
  // `COPY --from=builder /app/.next/standalone ./` in the world assumes.
  outputFileTracingRoot: import.meta.dirname,

  // The live site serves every URL with a trailing slash. Matching it means the
  // ~59 % of entries that land on a legacy URL are served directly rather than
  // through a 308 — and a rollback to the old site keeps working. Note this
  // makes `/health` redirect to `/health/`; point the Coolify probe at the
  // latter (see the runbook).
  //
  // The legacy redirects that go with this live in `src/middleware.ts`, NOT in
  // a `redirects()` table here: a table would emit a slashless destination that
  // this setting then 308s again, doubling every hop.
  trailingSlash: true,

  turbopack: {
    rules: {
      '*.svg': {
        loaders: [
          {
            loader: '@svgr/webpack',
            // Shared with the test pipeline — see svgo.config.ts for why each
            // plugin is there.
            //
            // Every icon on this site is decorative: each icon-only control
            // (Carousel, Pagination, the header's search and menu buttons, the
            // footer's social links) carries its own `aria-label`, so hiding the
            // glyph app-wide removes ~25 anonymous `img` nodes from the
            // accessibility tree and takes no accessible name with it. A call
            // site that ever needs the opposite passes `aria-hidden={false}` —
            // svgr spreads props after these.
            options: { svgoConfig, svgProps: { 'aria-hidden': 'true' } },
          },
        ],
        as: '*.js',
      },
    },
  },

  images: {
    remotePatterns: [
      new URL('/**', process.env.WP_BASE || 'https://wp.invalid'),
      new URL('/**', 'https://xn----9sbkcac6brh7h.xn--p1ai'),
      // Media offloaded to object storage (see resolveMediaUrl). Defaulted in
      // mediaCdn.ts so the host is always allowlisted; disable with WP_MEDIA_CDN="".
      ...(mediaCdn ? [new URL('/**', mediaCdn)] : []),
      // The player's own poster, the fallback for a film with no artwork in
      // WordPress (kinescopePosterUrl). `/<id>/poster.jpg` 302s to the CDN, and
      // the optimizer follows that itself — only the src it is given is matched
      // here, so the edge host needs no entry of its own.
      new URL('/**', 'https://kinescope.io'),
    ],
    // Keep optimized images cached for a day. Re-uploads get a new filename
    // (new URL → new cache key) so this doesn't stale edits; on expiry Next
    // serves the cached image and revalidates in the background.
    //
    // That only holds for URLs that change with their content. A file under
    // `public/` keeps its path across builds, so the cache — an on-disk store
    // on a persistent volume, which a redeploy therefore does not flush —
    // answers with the old bytes for a day after the file is replaced. Import
    // a local image instead of pointing at its `public/` path: the URL is
    // content-hashed, so a new export is a new key (`Home/sections/Hero.tsx`).
    minimumCacheTTL: 86400,
  },
  reactCompiler: true,

  /**
   * Frame policy for the public pages (SEC-10). The only frame policy this repo
   * had was the one the `/legacy/*` proxy sets on its own fragment — so the
   * indexable parent pages, the ones with the site's own links and the film
   * player, could be framed by anyone.
   *
   * `frame-ancestors 'self'` and not a fuller CSP: this site renders
   * WordPress-authored HTML, and a `script-src` here would need to describe
   * every embed an editor may add. `X-Frame-Options` rides along for the
   * crawlers and scanners that still only read that one.
   *
   * `/legacy/` is excluded because its route handler sets both headers itself,
   * and two identical policies on one response is noise.
   */
  async headers() {
    return [
      {
        source: '/((?!legacy/).*)',
        headers: [
          { key: 'x-frame-options', value: 'SAMEORIGIN' },
          { key: 'content-security-policy', value: "frame-ancestors 'self'" },
        ],
      },
    ];
  },

  // od-dev WP is slow (~1.5s/request) and starts 503ing under the build's
  // parallel prerender of ~46 ISR seed pages — retry failed pages and keep
  // the export concurrency modest instead of failing the whole build.
  experimental: {
    staticGenerationRetryCount: 3,
    staticGenerationMaxConcurrency: 4,
    // Pages and fetch responses regenerated at runtime stay in the in-memory
    // LRU below instead of being written to disk. On disk nothing is ever
    // evicted: every URL a crawler or scanner asked for once stayed forever —
    // ~5 GB/day of fetch-cache plus GBs of ISR output inside the container, and
    // the 40 GB VPS disk filled up (servers-agent 2026-09-25-od-vps-disk-full-
    // next-rce). Measured: almost nothing was ever read back from disk, so the
    // disk copy bought no hit rate. Pages prerendered at build are still read
    // from disk. Cost: a cold cache after every restart/deploy.
    isrFlushToDisk: false,
  },

  // The LRU that now holds all runtime cache (default 50 MB). The container is
  // limited to 1 GB and used ~180 MB before this.
  cacheMaxMemorySize: 256 * 1024 * 1024,
};

export default nextConfig;
