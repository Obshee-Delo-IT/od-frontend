import { ALL_FILM_CATEGORY_IDS, HOME_FILM_CATEGORY_IDS } from '@/shared/config/filmCategories';
import { WP_TAGS, wpCache } from './cacheTags';
import { extractFirstImage } from './extractFirstImage';
import { wpBaseUrl, wpFetch } from './httpClient';
import { resolveMediaUrl } from './mediaUrl';
import { stripHtml } from './newsPreview';

interface FilmSummary {
  id: number;
  title: string;
  link: string;
  thumbnailUrl: string | null;
}

interface FilmsResult {
  items: FilmSummary[];
  /**
   * How many videos the **catalogue** holds — all four categories, not the
   * row's narrower scope. It labels the CTA, and the CTA goes to `/video/`,
   * so it has to count what the visitor finds there.
   */
  catalogueTotal: number;
}

interface RawPost {
  id?: number;
  link?: string;
  title?: { rendered?: string };
  content?: { rendered?: string };
  featured_media?: number;
  _embedded?: { 'wp:featuredmedia'?: Array<{ source_url?: string }> };
}

/**
 * The newest films for the home page's «Фильмы» row, plus the catalogue's size.
 *
 * **Scoped to «Фильмы» and «Мультфильмы»** (`HOME_FILM_CATEGORY_IDS`) — 35 of the
 * catalogue's 83.
 * `format=video` on its own is not «a film»: «Видео события» — event reports
 * with a video attached — carry the same post format, and there are more of them
 * (115) than there are films (83), so an unscoped query returns whichever posts
 * are newest and the row fills up with screenings and volunteers' meet-ups.
 * That is what it did until 2026-08-22, and the two visible on the home page
 * were a report from Serbia and a slёt in Yakutia.
 *
 * The second request is a count-only probe (`per_page=1`, headers read, body
 * discarded) over `ALL_FILM_CATEGORY_IDS`: the CTA says «Все видео (83)» and
 * leads to `/video/`, so the number has to be the catalogue's, not this row's.
 * Hard-coding it is not an option — the ids and the counts are per-environment.
 */
export const fetchFilms = async (limit = 6): Promise<FilmsResult> => {
  const [res, countRes] = await Promise.all([
    wpFetch(
      `/wp/v2/posts?format=video&categories=${HOME_FILM_CATEGORY_IDS.join(',')}&per_page=${limit}&_embed=1`,
      wpCache([WP_TAGS.posts, WP_TAGS.films])
    ),
    wpFetch(
      `/wp/v2/posts?format=video&categories=${ALL_FILM_CATEGORY_IDS.join(',')}&per_page=1&_fields=id`,
      wpCache([WP_TAGS.posts, WP_TAGS.films])
    ),
  ]);
  const catalogueTotal = countRes.ok ? Number(countRes.headers.get('x-wp-total') ?? 0) : 0;
  if (!res.ok) {
    return { items: [], catalogueTotal };
  }
  const data = (await res.json()) as RawPost[];
  const items = await Promise.all(
    data.map(async (post) => ({
      id: post.id ?? 0,
      title: stripHtml(post.title?.rendered),
      link: post.link ?? '#',
      thumbnailUrl: await resolveMediaUrl(
        post._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? extractFirstImage(post.content?.rendered, wpBaseUrl)
      ),
    }))
  );
  return { items, catalogueTotal };
};
