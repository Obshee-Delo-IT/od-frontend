import { getWpMediaCdn } from './src/shared/api/mediaCdn';
import type { NextConfig } from 'next';

const mediaCdn = getWpMediaCdn();

// Children of «Видео» 85, mirroring VIDEO_CATEGORY_IDS in modules/Video/FilmPage.
const FILM_CATEGORIES = { filmy: 581, multy: 580, roliki: 86, 'famous-people': 559 } as const;

/**
 * URL compatibility with the site we're replacing (A8).
 *
 * Measured on 91 days of Yandex Metrica: the live URL shapes below carry 59 %
 * of all site entries, and the redesign doesn't serve any of them natively.
 * Bare `/<id>` posts are handled by rendering, not redirecting — see
 * `app/[...slug]/page.tsx`; what's left here are the shapes with no
 * one-to-one route.
 */
const legacyRedirects = async () => [
  // The five live catalogue sub-pages → the `?category=` filter. 3 328 entries.
  ...Object.entries(FILM_CATEGORIES).map(([slug, category]) => ({
    source: `/video/${slug}`,
    destination: `/video?category=${category}`,
    permanent: true,
  })),
  // No «короткометражки» category exists in WP (see the video-taxonomy note in
  // the plan) — the live page is a curated list, so send it to the catalogue.
  { source: '/video/short', destination: '/video', permanent: true },

  // `/category/video/*` is a second, older alias of the same catalogue. Low
  // total volume but `/category/video/mult/` alone is 256 entries.
  { source: '/category/video/movies', destination: `/video?category=${FILM_CATEGORIES.filmy}`, permanent: true },
  { source: '/category/video/mult', destination: `/video?category=${FILM_CATEGORIES.multy}`, permanent: true },
  { source: '/category/video/roliki', destination: `/video?category=${FILM_CATEGORIES.roliki}`, permanent: true },
  { source: '/category/video', destination: '/video', permanent: true },
  { source: '/category/video/:slug/page/:page(\\d+)', destination: '/video?page=:page', permanent: true },
  { source: '/category/novosti', destination: '/news?category=47', permanent: true },
  { source: '/category/articles', destination: '/news?category=578', permanent: true },

  // WP paginates with a path segment; we use a query param.
  { source: '/news/page/:page(\\d+)', destination: '/news?page=:page', permanent: true },
  // The live home is a paginated feed; its later pages are the news archive.
  { source: '/page/:page(\\d+)', destination: '/news?page=:page', permanent: true },

  // The redesigned detail URLs fold into the canonical legacy `/<id>` so one
  // piece of content never has two live addresses.
  { source: '/news/:id(\\d+)', destination: '/:id', permanent: true },
  { source: '/video/:id(\\d+)', destination: '/:id', permanent: true },
];

const nextConfig: NextConfig = {
  output: 'standalone',

  // The live site serves every URL with a trailing slash. Matching it means the
  // ~59 % of entries that land on a legacy URL are served directly rather than
  // through a 308 — and a rollback to the old site keeps working. Note this
  // makes `/health` redirect to `/health/`; point the Coolify probe at the
  // latter (see the runbook).
  trailingSlash: true,

  redirects: legacyRedirects,
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
