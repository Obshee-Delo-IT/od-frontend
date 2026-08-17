import { WP_TAGS, wpCache } from './cacheTags';
import { extractFirstImage } from './extractFirstImage';
import { wpBaseUrl, wpFetch } from './httpClient';
import { resolveMediaUrl } from './mediaUrl';
import { stripHtml } from './newsPreview';
import type { NewsSummary } from './fetchLatestNews';

export interface NewsListResult {
  items: NewsSummary[];
  totalPages: number;
  total: number;
}

export interface FetchNewsListParams {
  page?: number;
  perPage?: number;
  /** WP category id; omit for «Все». */
  category?: number;
}

interface RawPost {
  id?: number;
  link?: string;
  date?: string;
  title?: { rendered?: string };
  content?: { rendered?: string };
  _embedded?: { 'wp:featuredmedia'?: Array<{ source_url?: string }> };
}

/**
 * Paginated post list for the /news listing. Reads `X-WP-Total{,Pages}` so the
 * caller can render real pagination. WP returns a 400 for an out-of-range page,
 * so a non-2xx response is treated as «no results» rather than thrown.
 */
export const fetchNewsList = async ({
  page = 1,
  perPage = 15,
  category,
}: FetchNewsListParams = {}): Promise<NewsListResult> => {
  const query = new URLSearchParams({ per_page: String(perPage), page: String(page), _embed: '1' });
  if (category) {
    query.set('categories', String(category));
  }

  // The listing route is dynamic (driven by search params), so cache the WP
  // response per (page, category) for an hour instead of refetching every hit.
  const res = await wpFetch(`/wp/v2/posts?${query.toString()}`, wpCache([WP_TAGS.posts]));
  if (!res.ok) {
    return { items: [], totalPages: 0, total: 0 };
  }

  const totalPages = Number(res.headers.get('x-wp-totalpages') ?? 0);
  const total = Number(res.headers.get('x-wp-total') ?? 0);
  const data = (await res.json()) as RawPost[];

  const items: NewsSummary[] = await Promise.all(
    data.map(async (post) => ({
      id: post.id ?? 0,
      title: stripHtml(post.title?.rendered),
      link: post.link ?? '#',
      date: post.date ?? null,
      thumbnailUrl: await resolveMediaUrl(
        post._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? extractFirstImage(post.content?.rendered, wpBaseUrl)
      ),
      excerpt: null,
    }))
  );

  return { items, totalPages, total };
};
