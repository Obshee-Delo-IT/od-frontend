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
 * `short` («Короткометражные») is the newest of the five and was for a long time
 * the odd one out: the nav pointed at `/video/short/`, no such WP category
 * existed, and the proxy 301'd the whole item to `/video/`. The category is
 * real now — `create-short-category` in `wp/scripts/od-wp.php` creates it and
 * tags the twelve films the old curated page listed — so the segment is served
 * here and the redirect is gone. The films are mostly «Ролики» as well; a film
 * carries as many categories as it belongs to, and «Все» de-duplicates.
 */
export const FILM_CATEGORIES = {
  filmy: 581,
  multy: 580,
  roliki: 86,
  short: 671,
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

/**
 * The home page's «Фильмы» row: «Фильмы» and «Мультфильмы» only.
 *
 * 35 posts of the catalogue's 83. The two categories left out are «Ролики» (13
 * short promo clips) and «Известные люди» (36 — the largest of the four, so an
 * unfiltered «newest» row was mostly talking heads); both read as filler beside
 * a full-length film. The catalogue is unchanged: the row's CTA leads to
 * `/video/`, where «Все» is still all four categories.
 */
export const HOME_FILM_CATEGORY_IDS: number[] = [FILM_CATEGORIES.filmy, FILM_CATEGORIES.multy];
