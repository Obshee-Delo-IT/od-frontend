/**
 * Children of the «Видео» (85) taxonomy — the film catalogue.
 *
 * Keyed by the `?category=` slug the `/video` index uses; values are WP
 * category ids. **Single source of truth**: the index filter, the related-films
 * scope on a film page and the legacy redirect table all read from here. The
 * ids differ per WordPress environment (blocker B5 in the prod-migration
 * runbook), so this is the one place to change when promoting to stage/prod.
 */
export const FILM_CATEGORY_IDS = {
  movies: 581,
  mult: 580,
  roliki: 86,
  famous: 559,
} as const;

export type FilmCategorySlug = keyof typeof FILM_CATEGORY_IDS;

/**
 * «Все» is the union of the four sub-categories, not every `format=video`
 * post: the unfiltered query is dominated by «Видео события» (52) event
 * reports, which aren't part of the film catalogue.
 */
export const ALL_FILM_CATEGORY_IDS: number[] = Object.values(FILM_CATEGORY_IDS);

/**
 * The live site's catalogue URL segments → our `?category=` slug. Two legacy
 * shapes exist for the same content (`/video/<segment>/` and
 * `/category/video/<segment>/`) and both are redirected — see
 * `legacyRedirects`.
 *
 * `short` («короткометражки») has no counterpart: no such category exists in
 * WP, the live page is a hand-curated list, so it lands on the full catalogue.
 */
export const LEGACY_FILM_SEGMENTS: Record<string, FilmCategorySlug> = {
  filmy: 'movies',
  multy: 'mult',
  roliki: 'roliki',
  'famous-people': 'famous',
};
