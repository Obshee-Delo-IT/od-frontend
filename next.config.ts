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
    minimumCacheTTL: 86400,
  },
  reactCompiler: true,

  // od-dev WP is slow (~1.5s/request) and starts 503ing under the build's
  // parallel prerender of ~46 ISR seed pages — retry failed pages and keep
  // the export concurrency modest instead of failing the whole build.
  experimental: {
    staticGenerationRetryCount: 3,
    staticGenerationMaxConcurrency: 4,
  },
};

export default nextConfig;
