import { client } from './httpClient';

export interface FilmSummary {
  id: number;
  title: string;
  link: string;
  thumbnailUrl: string | null;
}

export const fetchFilms = async (limit = 6): Promise<FilmSummary[]> => {
  const { data } = await client.GET('/wp/v2/posts', {
    params: { query: { format: 'video', per_page: limit, _embed: '1' } as never },
  });

  if (!data) {
    return [];
  }

  return data.map((post) => ({
    id: post.id ?? 0,
    title: post.title?.rendered ?? '',
    link: post.link ?? '#',
    thumbnailUrl: extractFeaturedImage(post),
  }));
};

const extractFeaturedImage = (post: Record<string, unknown>): string | null => {
  const embedded = (post as { _embedded?: { 'wp:featuredmedia'?: Array<{ source_url?: string }> } })._embedded;
  return embedded?.['wp:featuredmedia']?.[0]?.source_url ?? null;
};
