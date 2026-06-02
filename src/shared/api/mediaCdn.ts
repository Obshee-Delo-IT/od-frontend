/**
 * Object-storage (CDN) base URL for offloaded WordPress media.
 *
 * Committed as the default so the host is always allowlisted for `next/image`
 * and the CDN rewrite works without per-environment setup. Override it — or
 * disable the rewrite by setting it to an empty string — via the `WP_MEDIA_CDN`
 * environment variable.
 */
export const DEFAULT_WP_MEDIA_CDN = 'https://obshee-delo.website.yandexcloud.net';

export const getWpMediaCdn = (): string =>
  process.env.WP_MEDIA_CDN !== undefined ? process.env.WP_MEDIA_CDN : DEFAULT_WP_MEDIA_CDN;
