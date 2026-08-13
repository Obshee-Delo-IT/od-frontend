import { fileUrl } from '@/shared/config/site';
import type { MetadataRoute } from 'next';

/**
 * `/robots.txt` (F4). The live site's file is not ported verbatim: it carries
 * `Disallow: /*?`, which would make every paginated listing (`/news/?page=2`,
 * `/video/filmy/?page=2`) uncrawlable, and a pile of `/wp-*` rules for paths
 * that don't exist on this origin.
 *
 * Pagination is deliberately left crawlable and indexable — each paginated
 * variant self-canonicalises (see the listing routes). Blocking it here would
 * be strictly worse than a `noindex`: a blocked URL is never fetched, so no
 * directive on the page is ever read.
 *
 * Note a Yandex `Clean-param` line for the usual `utm_*`/`yclid`/`fbclid`
 * noise cannot be expressed here — Next's robots serialiser emits only
 * User-Agent/Allow/Disallow/Crawl-delay/Host/Sitemap. If it turns out to be
 * needed, this file has to become a plain Route Handler at `robots.txt/route.ts`.
 */
const robots = (): MetadataRoute.Robots => ({
  rules: [
    {
      userAgent: '*',
      allow: '/',
      disallow: [
        // The Coolify liveness probe: `text/plain`, `no-store`, no content.
        // Slashed because `trailingSlash: true` makes `/health` a 308.
        '/health/',
        // Search has no route yet (the header input is inert until B7), but WP
        // trained crawlers on `?s=` and it is an unbounded URL space either way.
        '/search',
        '/*?s=',
      ],
    },
  ],
  sitemap: fileUrl('/sitemap.xml'),
});

export default robots;
