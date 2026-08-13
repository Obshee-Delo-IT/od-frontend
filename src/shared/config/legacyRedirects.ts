import { FILM_CATEGORY_IDS, LEGACY_FILM_SEGMENTS } from './filmCategories';

/**
 * URL compatibility with the site we're replacing (A8).
 *
 * Measured on 91 days of Yandex Metrica, the shapes handled here carry ~13 % of
 * all site entries and the redesign serves none of them natively. The biggest
 * legacy shape — a bare `/<id>/` post, 46 % of entries — is **not** here: it is
 * rendered directly by `app/[...slug]/page.tsx`, so it takes no redirect at all.
 *
 * **Why this is a function and not a `redirects()` table.** Next strips the
 * trailing slash off a `redirects()` destination and its own `trailingSlash`
 * normalisation then 308s it back on, making every legacy URL a two-hop chain.
 * Returning the final, already-normalised path from `middleware.ts` collapses
 * that to one hop. The middleware's `matcher` is scoped to these four prefixes,
 * so nothing else pays for it.
 *
 * Returns the destination path (**with** its trailing slash, so Next has
 * nothing left to normalise), or `null` to let the request through untouched.
 */
export const resolveLegacyUrl = (pathname: string): string | null => {
  const segments = pathname.split('/').filter(Boolean);
  const [first, second, third] = segments;

  if (first === 'video') {
    // The catalogue index itself, and `/video/<id>` which folds into `/<id>`.
    if (!second) {
      return null;
    }
    if (/^\d+$/.test(second)) {
      return `/${second}/`;
    }
    // «короткометражки» has no WP category — the live page is a curated list,
    // so it lands on the full catalogue.
    if (second === 'short') {
      return '/video/';
    }
    const slug = LEGACY_FILM_SEGMENTS[second];
    // NB the index resolves `?category=` by *slug*, not by category id — an id
    // silently falls back to «Все».
    return slug ? `/video/?category=${slug}` : null;
  }

  if (first === 'news') {
    if (!second) {
      return null;
    }
    if (/^\d+$/.test(second)) {
      return `/${second}/`;
    }
    // WP paginates with a path segment; we use a query param.
    if (second === 'page' && /^\d+$/.test(third ?? '')) {
      return third === '1' ? '/news/' : `/news/?page=${third}`;
    }
    return null;
  }

  // The live home is a paginated feed; its later pages are the news archive.
  if (first === 'page' && /^\d+$/.test(second ?? '')) {
    return second === '1' ? '/' : `/news/?page=${second}`;
  }

  if (first === 'category') {
    // `/category/video/*` is a second, older alias of the catalogue — low total
    // volume, but `/category/video/mult/` alone is 256 entries. Its segments
    // (`movies`, `mult`, `roliki`, `famous`) are already our own slugs.
    if (second === 'video') {
      const rest = segments.slice(2);
      const slug = rest[0] && rest[0] !== 'page' ? rest[0] : null;
      const pageAt = slug ? 1 : 0;
      const page = rest[pageAt] === 'page' && /^\d+$/.test(rest[pageAt + 1] ?? '') ? rest[pageAt + 1] : null;

      const query = new URLSearchParams();
      if (slug && slug in FILM_CATEGORY_IDS) {
        query.set('category', slug);
      }
      if (page && page !== '1') {
        query.set('page', page);
      }
      const search = query.toString();
      return search ? `/video/?${search}` : '/video/';
    }
    if (second === 'novosti') {
      return '/news/?category=47';
    }
    if (second === 'articles') {
      return '/news/?category=578';
    }
  }

  return null;
};
