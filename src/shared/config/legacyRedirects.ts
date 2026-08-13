import { catalogueHref, resolveFilmCategory, type FilmCategorySegment } from './filmCategories';

/**
 * WordPress's own catalogue alias `/category/video/<segment>/` spells the
 * categories differently from the site's `/video/<segment>/` pages. Low volume
 * overall, but `/category/video/mult/` alone is 256 entries.
 */
const WP_CATEGORY_ALIASES: Record<string, FilmCategorySegment> = {
  movies: 'filmy',
  mult: 'multy',
  roliki: 'roliki',
  famous: 'famous-people',
};

/** `/category/<slug>/` for news → the filter key the `/news/` chips use. */
const NEWS_CATEGORY_ALIASES: Record<string, string> = {
  novosti: 'nashi-dela',
  articles: 'articles',
};

/** A legacy path segment as a page number; junk and «page 1» alike mean 1. */
const pageNumber = (value: string | undefined): number => {
  const page = Number(value);
  return Number.isFinite(page) && page > 1 ? Math.floor(page) : 1;
};

/** Page 1 is the bare index, so it never acquires a second address. */
const newsHref = (page: number): string => (page > 1 ? `/news/?page=${page}` : '/news/');

/**
 * URL compatibility with the live site we're replacing (A8).
 *
 * Every shape here is one the **live** site serves — measured on 91 days of
 * Yandex Metrica they carry ~13 % of all site entries. URLs that only ever
 * existed on our own unlaunched rebuild are deliberately absent: nothing links
 * to them and no search index holds them, so a rule for one would be dead code
 * outliving its reason.
 *
 * The two biggest legacy shapes aren't redirects at all — `/<id>/` posts (46 %
 * of entries) are rendered by `app/[...slug]/page.tsx`, and the catalogue
 * categories are real routes under `/video/<segment>/`.
 *
 * **Why a function and not a `redirects()` table.** Next strips the trailing
 * slash off a `redirects()` destination and its own `trailingSlash`
 * normalisation then 301s it back on, making every legacy URL a two-hop chain.
 * Returning the final, already-normalised path from the proxy collapses that to
 * one hop. Config redirects also run *before* the proxy, so a rule left there
 * would silently shadow this.
 *
 * Returns the destination path (**with** its trailing slash, so Next has
 * nothing left to normalise), or `null` to let the request through untouched.
 */
export const resolveLegacyUrl = (pathname: string): string | null => {
  const [first, second, third, fourth, fifth] = pathname.split('/').filter(Boolean);

  if (first === 'video') {
    // «Короткометражки» has no WP category — the live page is a curated list.
    if (second === 'short') {
      return '/video/';
    }
    // WP paginated a category with a path segment; we use a query param.
    const segment = resolveFilmCategory(second);
    if (segment && third === 'page') {
      return catalogueHref({ segment, page: pageNumber(fourth) });
    }
    // Everything else under `/video/` is served here: the index and each category.
    return null;
  }

  if (first === 'news' && second === 'page') {
    return newsHref(pageNumber(third));
  }

  // The live home is a paginated feed whose later pages are the news archive.
  if (first === 'page' && second) {
    return newsHref(pageNumber(second));
  }

  if (first === 'category') {
    if (second === 'video') {
      // Either `/category/video/<segment>/page/N/` or `/category/video/page/N/`.
      const segment = WP_CATEGORY_ALIASES[third] ?? null;
      return catalogueHref({ segment, page: pageNumber(segment ? fifth : fourth) });
    }
    const news = NEWS_CATEGORY_ALIASES[second];
    if (news) {
      return `/news/?category=${news}`;
    }
  }

  return null;
};
