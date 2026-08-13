import { getWpMediaCdn } from './src/shared/api/mediaCdn';
import type { NextConfig } from 'next';

const mediaCdn = getWpMediaCdn();

const nextConfig: NextConfig = {
  output: 'standalone',

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
  // webpack: (config) => {
  //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //   const fileLoaderRule = config.module.rules.find((rule: any) => rule.test?.test?.('.svg'));

  //   config.module.rules.push(
  //     {
  //       ...fileLoaderRule,
  //       test: /\.svg$/i,
  //       resourceQuery: /url/,
  //     },

  //     {
  //       test: /\.svg$/i,
  //       issuer: fileLoaderRule.issuer,
  //       resourceQuery: { not: [...fileLoaderRule.resourceQuery.not, /url/] },
  //       use: ['@svgr/webpack'],
  //     }
  //   );

  //   fileLoaderRule.exclude = /\.svg$/i;

  //   return config;
  // },
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
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
