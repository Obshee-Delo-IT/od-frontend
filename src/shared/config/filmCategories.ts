import { TOPIC_PARAM, type FilmTopicKey } from './filmTopics';

/**
 * The film catalogue — children of the «Видео» (85) taxonomy.
 *
 * Keyed by the URL segment, because the URL segment *is* the identity: each
 * category is a page at `/video/<segment>/`, and `/video/multy/` and
 * `/video/filmy/` are the #2 and #3 entry pages on the whole site (1 174 and
 * 1 106 entries in 91 days).
 *
 * **Values are WordPress slugs, and the term ids are looked up from them** —
 * `shared/api/termIds.ts`. They used to be the ids themselves, and that is the
 * bug this replaces: a term id is assigned by the install that creates the
 * term, so the ids the setup scripts produced on od-stage are not the ids the
 * same scripts produced on od-wp. «Короткометражные» is 671 on one and 670 on
 * the other, and after the cutover `/video/short/` on the live site queried a
 * category that install doesn't have and answered «Фильмов не найдено» with
 * twelve films sitting behind it (2026-09-16). A slug is written by the script,
 * so it is the same everywhere, which is what makes one build serve every tier.
 *
 * Note the slugs are not the segments: WordPress holds `movies`, `mult` and
 * `famous`, while the URLs this site must keep are `/video/filmy/`,
 * `/video/multy/` and `/video/famous-people/`. The keys are live URLs —
 * renaming one 404s real traffic.
 *
 * `short` («Короткометражные») is the newest of the five and was for a long time
 * the odd one out: the nav pointed at `/video/short/`, no such WP category
 * existed, and the proxy 301'd the whole item to `/video/`. The category is
 * real now — `create-short-category` in `wp/scripts/od-wp.php` creates it and
 * tags the twelve films the old curated page listed — so the segment is served
 * here and the redirect is gone. The films are mostly «Ролики» as well; a film
 * carries as many categories as it belongs to, and «Все» de-duplicates.
 */
export const FILM_CATEGORY_SLUGS = {
  filmy: 'movies',
  multy: 'mult',
  roliki: 'roliki',
  short: 'short',
  'famous-people': 'famous',
} as const;

export type FilmCategorySegment = keyof typeof FILM_CATEGORY_SLUGS;

/**
 * Declaration order — the filter tab order, and the order «Все» queries in.
 *
 * «Все» is the union of the five sub-categories, not every `format=video`
 * post: the unfiltered query is dominated by «Видео события» (52) event
 * reports, which aren't part of the film catalogue.
 */
export const FILM_CATEGORY_SEGMENTS = Object.keys(FILM_CATEGORY_SLUGS) as FilmCategorySegment[];

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
  segment && Object.hasOwn(FILM_CATEGORY_SLUGS, segment) ? (segment as FilmCategorySegment) : null;

/**
 * The canonical address of a catalogue page; `null` is «Все».
 *
 * Sole source of catalogue URL shape — the filter, pagination, canonical tags
 * and the redirect table all build links here, so links and redirects can't
 * drift into pointing at each other. Always slash-terminated before the query,
 * since `trailingSlash: true` makes the slashless twin a 301.
 *
 * `topics` is the subject filter ({@link FILM_TOPICS}), and it comes **before**
 * `page` in the query so one selection has one address whichever order the
 * caller passes things in. The parts are joined by hand rather than through
 * `URLSearchParams`, which would percent-encode the separating comma and turn a
 * readable `?topic=alcohol,tobacco` into `?topic=alcohol%2Ctobacco`; topic keys
 * are `[a-z-]+` and need no encoding.
 */
export const catalogueHref = ({
  segment,
  page = 1,
  topics = [],
}: {
  segment: FilmCategorySegment | null;
  page?: number;
  topics?: FilmTopicKey[];
}): string => {
  const path = segment ? `/video/${segment}/` : '/video/';
  const query: string[] = [];
  if (topics.length > 0) {
    query.push(`${TOPIC_PARAM}=${topics.join(',')}`);
  }
  if (page > 1) {
    query.push(`page=${page}`);
  }

  return query.length > 0 ? `${path}?${query.join('&')}` : path;
};

/**
 * The home page's «Фильмы» row: «Фильмы» and «Мультфильмы» only.
 *
 * 35 posts of the catalogue's 83. The categories left out are «Ролики» (13
 * short promo clips), «Короткометражные» (12) and «Известные люди» (36 — the
 * largest of them, so an unfiltered «newest» row was mostly talking heads); all
 * three read as filler beside a full-length film. The catalogue is unchanged:
 * the row's CTA leads to `/video/`, where «Все» is still every sub-category.
 */
export const HOME_FILM_SEGMENTS: FilmCategorySegment[] = ['filmy', 'multy'];
