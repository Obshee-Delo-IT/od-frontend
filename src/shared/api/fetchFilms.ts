import { HOME_FILM_CATEGORY_IDS } from '@/shared/config/filmCategories';
import { WP_TAGS, wpCache } from './cacheTags';
import { extractFirstImage } from './extractFirstImage';
import { wpBaseUrl, wpFetch } from './httpClient';
import { resolveMediaUrl } from './mediaUrl';
import { stripHtml } from './newsPreview';

export interface FilmSummary {
  id: number;
  title: string;
  link: string;
  thumbnailUrl: string | null;
}

export interface FilmsResult {
  items: FilmSummary[];
  /** How many films the scope holds in total — the row shows `limit` of them. */
  total: number;
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
 * The newest films for the home page's «Фильмы» row, plus how many there are.
 *
 * **Scoped to the catalogue categories minus «Ролики»** (`HOME_FILM_CATEGORY_IDS`).
 * `format=video` on its own is not «a film»: «Видео события» — event reports
 * with a video attached — carry the same post format, and there are more of them
 * (115) than there are films (83), so an unscoped query returns whichever posts
 * are newest and the row fills up with screenings and volunteers' meet-ups.
 * That is what it did until 2026-08-22, and the two visible on the home page
 * were a report from Serbia and a slёt in Yakutia.
 *
 * `total` comes from `X-WP-Total` and exists so the CTA can say how many films
 * the row is a slice of — a carousel gives no clue that it holds 12 of 71.
 */
export const fetchFilms = async (limit = 6): Promise<FilmsResult> => {
  const res = await wpFetch(
    `/wp/v2/posts?format=video&categories=${HOME_FILM_CATEGORY_IDS.join(',')}&per_page=${limit}&_embed=1`,
    wpCache([WP_TAGS.posts, WP_TAGS.films])
  );
  if (!res.ok) {
    return { items: [], total: 0 };
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
  return { items, total: Number(res.headers.get('x-wp-total') ?? items.length) };
};
