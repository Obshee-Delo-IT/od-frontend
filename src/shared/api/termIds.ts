import { cache } from 'react';
import {
  FILM_CATEGORY_SEGMENTS,
  FILM_CATEGORY_SLUGS,
  HOME_FILM_SEGMENTS,
  type FilmCategorySegment,
} from '@/shared/config/filmCategories';
import { FILM_TOPICS, type FilmTopicKey } from '@/shared/config/filmTopics';
import { WP_TAGS, wpCache } from './cacheTags';
import { wpFetch } from './httpClient';

/**
 * WordPress term ids, looked up from the slugs the config holds.
 *
 * **Why a lookup and not a number in a config file.** A term id is handed out
 * by the install that creates the term, so the same setup script produces
 * different ids on different installs — `wp/scripts/od-wp.php` made
 * «Короткометражные» 671 on od-stage and 670 on od-wp, and the nine topic tags
 * one apart from each other on the two. One repository builds every tier, so a
 * hard-coded id can only ever be right on one of them: after the cutover
 * `/video/short/` answered «Фильмов не найдено» over twelve films, `?topic=drugs`
 * listed the «Манипуляция» films and `?topic=gadgets` listed none (2026-09-16).
 * Slugs are written by the script and are identical everywhere, so the id is
 * resolved from the install that is actually being read.
 *
 * One request per taxonomy per render pass (`cache`), and one per hour across
 * passes — it carries the same tags and window as every other WP call, so a
 * `wp` purge refreshes it and nothing else has to know it exists.
 */
interface RawTerm {
  id?: number;
  slug?: string;
}

/**
 * Slug → id for one taxonomy. Keyed on the joined slug list rather than an
 * array, because `cache` compares arguments by identity and a fresh array would
 * miss every time.
 */
const termIdsBySlug = cache(async (taxonomy: 'categories' | 'tags', slugs: string): Promise<Record<string, number>> => {
  const query = slugs.split(',').map(encodeURIComponent).join(',');
  const res = await wpFetch(`/wp/v2/${taxonomy}?slug=${query}&per_page=100&_fields=id,slug`, wpCache([WP_TAGS.films]));
  if (!res.ok) {
    return {};
  }

  const terms = (await res.json()) as RawTerm[];
  return Object.fromEntries(terms.filter((term) => term.id && term.slug).map((term) => [term.slug, term.id]));
});

/**
 * The ids of the given catalogue segments, in the order given.
 *
 * A slug WordPress doesn't have is dropped, so an empty list means «none of
 * these categories exist here» — which {@link fetchVideoList} answers with no
 * results rather than with every `format=video` post. Silently widening to the
 * event reports is the one failure mode worse than an empty page.
 */
export const filmCategoryIds = async (segments: readonly FilmCategorySegment[]): Promise<number[]> => {
  const bySlug = await termIdsBySlug('categories', Object.values(FILM_CATEGORY_SLUGS).join(','));
  return segments.map((segment) => bySlug[FILM_CATEGORY_SLUGS[segment]]).filter((id): id is number => Boolean(id));
};

/** «Все» — the union of the catalogue's sub-categories. */
export const allFilmCategoryIds = (): Promise<number[]> => filmCategoryIds(FILM_CATEGORY_SEGMENTS);

/** The home page's «Фильмы» row — see {@link HOME_FILM_SEGMENTS}. */
export const homeFilmCategoryIds = (): Promise<number[]> => filmCategoryIds(HOME_FILM_SEGMENTS);

/** The `post_tag` ids a topic selection queries, in chip order. */
export const filmTopicIds = async (topics: readonly FilmTopicKey[]): Promise<number[]> => {
  const bySlug = await termIdsBySlug('tags', Object.values(FILM_TOPICS).join(','));
  return topics.map((topic) => bySlug[FILM_TOPICS[topic]]).filter((id): id is number => Boolean(id));
};
