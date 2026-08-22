import { ALL_FILM_CATEGORY_IDS } from '@/shared/config/filmCategories';
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

interface RawPost {
  id?: number;
  link?: string;
  title?: { rendered?: string };
  content?: { rendered?: string };
  featured_media?: number;
  _embedded?: { 'wp:featuredmedia'?: Array<{ source_url?: string }> };
}

/**
 * The newest films for the home page's «Фильмы» row.
 *
 * **Scoped to the four catalogue categories, exactly as `/video/` is.**
 * `format=video` on its own is not «a film»: «Видео события» — event reports
 * with a video attached — carry the same post format, and there are more of them
 * (115) than there are films (83), so an unscoped query returns whichever posts
 * are newest and the row fills up with screenings and volunteers' meet-ups.
 * That is what it did until 2026-08-22, and the two visible on the home page
 * were a report from Serbia and a slёt in Yakutia. `ALL_FILM_CATEGORY_IDS` is
 * the same union the catalogue's «Все» tab uses, so the two agree by
 * construction rather than by being edited together.
 */
export const fetchFilms = async (limit = 6): Promise<FilmSummary[]> => {
  const res = await wpFetch(
    `/wp/v2/posts?format=video&categories=${ALL_FILM_CATEGORY_IDS.join(',')}&per_page=${limit}&_embed=1`,
    wpCache([WP_TAGS.posts, WP_TAGS.films])
  );
  if (!res.ok) {
    return [];
  }
  const data = (await res.json()) as RawPost[];
  return Promise.all(
    data.map(async (post) => ({
      id: post.id ?? 0,
      title: stripHtml(post.title?.rendered),
      link: post.link ?? '#',
      thumbnailUrl: await resolveMediaUrl(
        post._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? extractFirstImage(post.content?.rendered, wpBaseUrl)
      ),
    }))
  );
};
