/**
 * The two filters the `/news/` chips expose, keyed by the value that appears in
 * `?category=` and mapped to the WP category id behind it.
 *
 * **Key by the filter value, not the id.** Pointing a link or a redirect at
 * `?category=578` answers **200 with an unfiltered list** — the index resolves
 * by key, so an unknown value silently degrades instead of erroring. That bug
 * shipped twice during A8; `legacyRedirects.test.ts` now asserts against it.
 *
 * The ids are environment-specific (blocker B5 in the prod-migration runbook),
 * so this is the one place to change when repointing `WP_BASE` — the same role
 * `filmCategories.ts` plays for the catalogue.
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
