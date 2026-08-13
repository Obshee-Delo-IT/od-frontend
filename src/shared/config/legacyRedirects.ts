import { LEGACY_FILM_SEGMENTS } from './filmCategories';

export interface LegacyRedirect {
  source: string;
  destination: string;
  permanent: boolean;
}

/**
 * URL compatibility with the site we're replacing (A8).
 *
 * Measured on 91 days of Yandex Metrica, the live URL shapes below carry ~13 %
 * of all site entries and the redesign serves none of them natively. The
 * biggest legacy shape — a bare `/<id>/` post, 46 % of entries — is **not**
 * here: it is rendered directly by `app/[...slug]/page.tsx`, so it takes no
 * redirect at all.
 *
 * **These are two-hop chains** and can't be made single-hop from here: Next
 * strips the trailing slash off a redirect destination, then its own
 * `trailingSlash` normalisation 308s it back on — `/video/filmy/` →
 * `/video?category=movies` → `/video/?category=movies`. Harmless; search
 * engines follow chains this short and pass full equity. Collapsing them would
 * mean a `middleware.ts` on every request, which isn't worth it here.
 *
 * Order matters — Next takes the first match.
 */
export const legacyRedirects = (): LegacyRedirect[] => [
  // The live catalogue sub-pages → the `?category=` filter. 3 328 entries.
  // NB the index filters by *slug*, not by category id: `?category=581` would
  // silently fall back to «Все».
  ...Object.entries(LEGACY_FILM_SEGMENTS).map(([segment, slug]) => ({
    source: `/video/${segment}`,
    destination: `/video?category=${slug}`,
    permanent: true,
  })),
  // No «короткометражки» category exists in WP — the live page is a curated
  // list, so it lands on the full catalogue.
  { source: '/video/short', destination: '/video', permanent: true },

  // `/category/video/*` is a second, older alias of the same catalogue — low
  // total volume, but `/category/video/mult/` alone is 256 entries. Its
  // segments (`movies`, `mult`, `roliki`) happen to be our own slugs already,
  // so one rule covers them; an unrecognised one degrades to «Все».
  { source: '/category/video/:segment/page/:page(\\d+)', destination: '/video?page=:page', permanent: true },
  { source: '/category/video/:segment', destination: '/video?category=:segment', permanent: true },
  { source: '/category/video', destination: '/video', permanent: true },

  { source: '/category/novosti', destination: '/news?category=47', permanent: true },
  { source: '/category/articles', destination: '/news?category=578', permanent: true },

  // WP paginates with a path segment; we use a query param.
  { source: '/news/page/:page(\\d+)', destination: '/news?page=:page', permanent: true },
  // The live home is a paginated feed; its later pages are the news archive.
  { source: '/page/:page(\\d+)', destination: '/news?page=:page', permanent: true },

  // The redesigned detail URLs fold into the canonical legacy `/<id>`, so one
  // piece of content never has two live addresses.
  { source: '/news/:id(\\d+)', destination: '/:id', permanent: true },
  { source: '/video/:id(\\d+)', destination: '/:id', permanent: true },
];
