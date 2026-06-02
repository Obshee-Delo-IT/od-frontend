import { toFullSizeImageUrl } from './imageUrl';
import { getWpMediaCdn } from './mediaCdn';

const stripTrailingSlash = (value?: string | null): string => (value ? value.replace(/\/+$/, '') : '');

/**
 * Map a WordPress-origin media URL to its CDN (object-storage) equivalent.
 * Returns null when the CDN is disabled (`WP_MEDIA_CDN=""`) or the URL isn't
 * under the WP origin, so callers fall back to the original URL. Pure (no I/O)
 * and reads env per call so it stays testable.
 */
export const toCdnUrl = (wpUrl: string): string | null => {
  const wpOrigin = stripTrailingSlash(process.env.WP_BASE);
  const cdnBase = stripTrailingSlash(getWpMediaCdn());
  if (!cdnBase || !wpOrigin || !wpUrl.startsWith(`${wpOrigin}/`)) {
    return null;
  }
  return cdnBase + wpUrl.slice(wpOrigin.length);
};

// Memoise CDN existence so we don't re-probe the same object every render. The
// page is ISR (revalidate 3600), so a 1h TTL lines up with regeneration.
const CDN_PROBE_TTL_MS = 60 * 60 * 1000;
const cdnProbeCache = new Map<string, { ok: boolean; at: number }>();

/**
 * Whether an object exists on the CDN. The bucket 301-redirects missing keys
 * (to an error page) rather than 404ing, so we probe with `redirect: 'manual'`
 * and count only a direct 200 as present. Network/timeout errors count as
 * "absent" so we fall back to the WP origin.
 */
const existsOnCdn = async (url: string): Promise<boolean> => {
  const cached = cdnProbeCache.get(url);
  const now = Date.now();
  if (cached && now - cached.at < CDN_PROBE_TTL_MS) {
    return cached.ok;
  }
  let ok = false;
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(3000) });
    ok = res.status === 200;
  } catch {
    ok = false;
  }
  cdnProbeCache.set(url, { ok, at: now });
  return ok;
};

/**
 * Resolve a raw WordPress image URL to the best full-size source for
 * `next/image`: the CDN copy when it's there (fast, reliable object storage),
 * otherwise the WP origin (e.g. freshly published media not yet offloaded).
 * With no `WP_MEDIA_CDN` set this is just the full-size WP URL.
 */
export const resolveMediaUrl = async (rawUrl: string | null | undefined): Promise<string | null> => {
  const wpUrl = toFullSizeImageUrl(rawUrl);
  if (!wpUrl) {
    return null;
  }
  const cdnUrl = toCdnUrl(wpUrl);
  if (!cdnUrl) {
    return wpUrl;
  }
  return (await existsOnCdn(cdnUrl)) ? cdnUrl : wpUrl;
};
