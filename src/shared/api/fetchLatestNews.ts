import { WP_TAGS, wpCache } from './cacheTags';
import { extractFirstImage } from './extractFirstImage';
import { wpBaseUrl, wpFetch } from './httpClient';
import { resolveMediaUrl } from './mediaUrl';
import { buildNewsPreview } from './newsPreview';

export interface NewsSummary {
  id: number;
  title: string;
  link: string;
  date: string | null;
  thumbnailUrl: string | null;
  excerpt: string | null;
}

interface RawPost {
  id?: number;
  link?: string;
  date?: string;
  title?: { rendered?: string };
  content?: { rendered?: string };
  excerpt?: { rendered?: string };
  featured_media?: number;
  _embedded?: { 'wp:featuredmedia'?: Array<{ source_url?: string }> };
}

export const fetchLatestNews = async (limit = 4): Promise<NewsSummary[]> => {
  const res = await wpFetch(`/wp/v2/posts?per_page=${limit}&_embed=1`, wpCache([WP_TAGS.posts]));
  if (!res.ok) {
    return [];
  }
  const data = (await res.json()) as RawPost[];
  return Promise.all(
    data.map(async (post, index) => ({
      id: post.id ?? 0,
      title: post.title?.rendered ?? '',
      link: post.link ?? '#',
      date: post.date ?? null,
      thumbnailUrl: await resolveMediaUrl(
        post._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? extractFirstImage(post.content?.rendered, wpBaseUrl)
      ),
      // Only the lead item is shown as the featured card with a text preview;
      // the rest are compact cards (date + title only), so skip the work.
      excerpt: index === 0 ? buildNewsPreview(post.excerpt?.rendered, post.content?.rendered) : null,
    }))
  );
};
