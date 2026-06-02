import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
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
      // Media offloaded to object storage (see resolveMediaUrl); optional.
      ...(process.env.WP_MEDIA_CDN ? [new URL('/**', process.env.WP_MEDIA_CDN)] : []),
    ],
    // Keep optimized images cached for a day. Re-uploads get a new filename
    // (new URL → new cache key) so this doesn't stale edits; on expiry Next
    // serves the cached image and revalidates in the background.
    minimumCacheTTL: 86400,
  },
  reactCompiler: true,
};

export default nextConfig;
