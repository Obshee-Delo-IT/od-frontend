import { extractFirstImage } from './extractFirstImage';
import { wpBaseUrl, wpFetch } from './httpClient';

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
  const res = await wpFetch(`/wp/v2/posts?format=video&per_page=${limit}&_embed=1`);
  if (!res.ok) {
    return [];
  }
  const data = (await res.json()) as RawPost[];
  return data.map((post) => ({
    id: post.id ?? 0,
    title: post.title?.rendered ?? '',
    link: post.link ?? '#',
    thumbnailUrl:
      post._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? extractFirstImage(post.content?.rendered, wpBaseUrl),
  }));
};
