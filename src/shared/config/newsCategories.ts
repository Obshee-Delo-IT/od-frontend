/**
 * The two filters the `/news/` chips expose, keyed by the value that appears in
 * `?category=` and mapped to the WP category id behind it.
 *
 * **Key by the filter value, not the id.** Pointing a link or a redirect at
 * `?category=578` answers **200 with an unfiltered list** — the index resolves
 * by key, so an unknown value silently degrades instead of erroring. That bug
 * shipped twice during A8; `legacyRedirects.test.ts` now asserts against it.
 *
 * **Ids here and slugs in `filmCategories.ts`, deliberately.** A term id is
 * per install, which is why the catalogue resolves its ids from slugs through
 * `shared/api/termIds.ts` (B5). These two are the exception that needs no
 * lookup: «Новости» and «Статьи» pre-date every clone, so od-dev, od-stage and
 * od-wp all hold them as 47 and 578 — measured 2026-09-16, and again whenever a
 * new tier appears. A term *our own scripts create* never qualifies; those are
 * numbered by whichever install ran the script.
 */
export const NEWS_CATEGORIES = {
  'nashi-dela': 47,
  articles: 578,
} as const;

type NewsCategoryKey = keyof typeof NEWS_CATEGORIES;

/**
 * The filter a `?category=` value names, or `null` for «Все» — which is what an
 * unrecognised value degrades to, since a listing has a sensible unfiltered
 * answer and a 404 here would break bookmarks for no gain.
 *
 * `hasOwn` rather than `in`: the value comes straight off the query string, and
 * `?category=constructor` would otherwise resolve to something off
 * `Object.prototype`.
 */
export const resolveNewsCategory = (value: string | undefined | null): NewsCategoryKey | null =>
  value && Object.hasOwn(NEWS_CATEGORIES, value) ? (value as NewsCategoryKey) : null;

/**
 * The canonical address of the «Статьи» collection.
 *
 * It is the **legacy** URL, not `/news/?category=articles`: `/materials/articles/`
 * carries 114 entry visits in 91 days and whatever inbound links exist, while the
 * query-string form is this rebuild's own invention that nothing outside the site
 * has ever linked to. The chip stays — it is a filter state of the index — but it
 * canonicalises here, so the collection has one address rather than two.
 */
export const ARTICLES_HREF = '/materials/articles/';

/**
 * The alias route's own copy, here rather than in `app/materials/articles/` so
 * `/news/?category=articles` can advertise the same card without importing a
 * route module. It has to be the same card: a network caches one against
 * `og:url`, and both addresses publish the alias's, so two different cards there
 * would mean whichever is scraped first decides what both of them unfurl as.
 */
export const ARTICLES_TITLE = 'Статьи для газет и журналов';
export const ARTICLES_DESCRIPTION =
  'Статьи о вреде алкоголя, табака и других психоактивных веществ — материалы «Общего дела» для газет и журналов.';
