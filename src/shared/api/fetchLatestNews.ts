import { extractFirstImage } from './extractFirstImage';
import { wpBaseUrl, wpFetch } from './httpClient';

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

const ENTITIES: Record<string, string> = {
  '&hellip;': '…',
  '&nbsp;': ' ',
  '&amp;': '&',
  '&laquo;': '«',
  '&raquo;': '»',
  '&mdash;': '—',
  '&ndash;': '–',
  '&quot;': '"',
  '&#039;': "'",
  '&#39;': "'",
};

// WP `excerpt.rendered` is HTML (`<p>…[&hellip;]</p>`); reduce it to plain text
// for the featured news card.
const stripHtml = (html?: string): string | null => {
  if (!html) {
    return null;
  }
  const text = html
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-z]+;|&#\d+;/gi, (entity) => ENTITIES[entity] ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return text || null;
};

export const fetchLatestNews = async (limit = 4): Promise<NewsSummary[]> => {
  const res = await wpFetch(`/wp/v2/posts?per_page=${limit}&_embed=1`);
  if (!res.ok) {
    return [];
  }
  const data = (await res.json()) as RawPost[];
  return data.map((post) => ({
    id: post.id ?? 0,
    title: post.title?.rendered ?? '',
    link: post.link ?? '#',
    date: post.date ?? null,
    thumbnailUrl:
      post._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? extractFirstImage(post.content?.rendered, wpBaseUrl),
    excerpt: stripHtml(post.excerpt?.rendered),
  }));
};
