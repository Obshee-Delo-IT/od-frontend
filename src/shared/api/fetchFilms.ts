import { WP_TAGS, wpCache } from './cacheTags';
import { extractFirstImage } from './extractFirstImage';
import { wpBaseUrl, wpFetch } from './httpClient';
import { resolveMediaUrl } from './mediaUrl';

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

export const fetchFilms = async (limit = 6): Promise<FilmSummary[]> => {
  const res = await wpFetch(
    `/wp/v2/posts?format=video&per_page=${limit}&_embed=1`,
    wpCache([WP_TAGS.posts, WP_TAGS.films])
  );
  if (!res.ok) {
    return [];
  }
  const data = (await res.json()) as RawPost[];
  return Promise.all(
    data.map(async (post) => ({
      id: post.id ?? 0,
      title: post.title?.rendered ?? '',
      link: post.link ?? '#',
      thumbnailUrl: await resolveMediaUrl(
        post._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? extractFirstImage(post.content?.rendered, wpBaseUrl)
      ),
    }))
  );
};
