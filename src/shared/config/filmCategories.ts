/**
 * The film catalogue — children of the «Видео» (85) taxonomy.
 *
 * Keyed by the URL segment, because the URL segment *is* the identity: each
 * category is a page at `/video/<segment>/`, and `/video/multy/` and
 * `/video/filmy/` are the #2 and #3 entry pages on the whole site (1 174 and
 * 1 106 entries in 91 days). Values are WP category ids.
 *
 * **Single source of truth**: the catalogue pages, the related-films scope on a
 * film page, the SSG seed and the legacy redirects all read from here. The ids
 * differ per WordPress environment (blocker B5 in the prod-migration runbook),
 * so this is the one place to change when promoting to stage or prod.
 *
 * «Короткометражки» is deliberately absent — no such category exists in WP, the
 * live page is a hand-curated list, so `/video/short/` redirects to the full
 * catalogue. Adding it here would turn that redirect into a 200 showing the
 * wrong films, since `/video/[segment]` serves exactly these keys.
 */
export const FILM_CATEGORIES = {
  filmy: 581,
  multy: 580,
  roliki: 86,
  'famous-people': 559,
} as const;

export type FilmCategorySegment = keyof typeof FILM_CATEGORIES;

/**
 * «Все» is the union of the four sub-categories, not every `format=video`
 * post: the unfiltered query is dominated by «Видео события» (52) event
 * reports, which aren't part of the film catalogue.
 */
export const ALL_FILM_CATEGORY_IDS: number[] = Object.values(FILM_CATEGORIES);

/**
 * The catalogue category a URL segment addresses, or `null` if it names none —
 * which the route turns into a 404 rather than quietly serving «Все», so
 * `/video/<anything>/` can't spawn an unbounded family of soft-404 duplicates.
 *
 * `hasOwn` rather than `in`: the value comes straight off the URL, and
 * `/video/constructor/` would otherwise resolve to something off
 * `Object.prototype`.
 */
export const resolveFilmCategory = (segment: string | undefined | null): FilmCategorySegment | null =>
  segment && Object.hasOwn(FILM_CATEGORIES, segment) ? (segment as FilmCategorySegment) : null;

/**
 * The canonical address of a catalogue page; `null` is «Все».
 *
 * Sole source of catalogue URL shape — the filter, pagination, canonical tags
 * and the redirect table all build links here, so links and redirects can't
 * drift into pointing at each other. Always slash-terminated before the query,
 * since `trailingSlash: true` makes the slashless twin a 301.
 */
export const catalogueHref = ({
  segment,
  page = 1,
}: {
  segment: FilmCategorySegment | null;
  page?: number;
}): string => {
  const path = segment ? `/video/${segment}/` : '/video/';
  return page > 1 ? `${path}?page=${page}` : path;
};
