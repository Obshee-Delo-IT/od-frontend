import { extractFirstImage } from './extractFirstImage';
import { wpBaseUrl, wpFetch } from './httpClient';
import { resolveMediaUrl } from './mediaUrl';
import { buildNewsPreview } from './newsPreview';

/** A single downloadable cut of a film (full or short), as held in ACF. */
export interface VideoDownload {
  url: string;
  /** Free-text running time, e.g. «35 мин». */
  duration: string | null;
  /** Free-text file size, e.g. «1,5 Гб». */
  size: string | null;
}

export interface VideoShareLinks {
  vk: string | null;
  youtube: string | null;
  rutube: string | null;
}

export interface VideoSummary {
  id: number;
  title: string;
  link: string;
  date: string | null;
  thumbnailUrl: string | null;
  excerpt: string | null;
  categories: number[];
  /** «Смотреть онлайн» destination, when present. */
  watchUrl: string | null;
  trailerUrl: string | null;
  downloadFull: VideoDownload | null;
  downloadShort: VideoDownload | null;
  share: VideoShareLinks;
}

export interface VideoListResult {
  items: VideoSummary[];
  totalPages: number;
  total: number;
}

export interface FetchVideoListParams {
  page?: number;
  perPage?: number;
  /** WP category id (child of «Видео» 85); omit for «Все». */
  category?: number;
}

/** ACF group `group_film_meta` — all fields are flat url/text, empty string when unset. */
interface RawAcf {
  watch_url?: string;
  trailer_url?: string;
  download_full_url?: string;
  download_full_duration?: string;
  download_full_size?: string;
  download_short_url?: string;
  download_short_duration?: string;
  download_short_size?: string;
  share_vk?: string;
  share_youtube?: string;
  share_rutube?: string;
}

interface RawPost {
  id?: number;
  link?: string;
  date?: string;
  title?: { rendered?: string };
  content?: { rendered?: string };
  excerpt?: { rendered?: string };
  categories?: number[];
  acf?: RawAcf;
  _embedded?: { 'wp:featuredmedia'?: Array<{ source_url?: string }> };
}

const trimOrNull = (value?: string): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/** Build a download cut only when its URL is set — durations/sizes may be blank. */
const toDownload = (url?: string, duration?: string, size?: string): VideoDownload | null => {
  const href = trimOrNull(url);
  if (!href) {
    return null;
  }
  return { url: href, duration: trimOrNull(duration), size: trimOrNull(size) };
};

/**
 * Paginated list of `format=video` posts (the «Фильмы» catalogue), reading the
 * `group_film_meta` ACF fields exposed under `post.acf.*`. Most films currently
 * carry only the download fields; the card renders each affordance only when its
 * field is non-empty, so empty share/trailer values simply don't appear.
 *
 * Mirrors {@link fetchNewsList}: reads `X-WP-Total{,Pages}` for real pagination
 * and treats a non-2xx (e.g. an out-of-range page) as «no results».
 */
export const fetchVideoList = async ({
  page = 1,
  perPage = 10,
  category,
}: FetchVideoListParams = {}): Promise<VideoListResult> => {
  const query = new URLSearchParams({
    format: 'video',
    per_page: String(perPage),
    page: String(page),
    _embed: '1',
  });
  if (category) {
    query.set('categories', String(category));
  }

  const res = await wpFetch(`/wp/v2/posts?${query.toString()}`, { next: { revalidate: 3600 } });
  if (!res.ok) {
    return { items: [], totalPages: 0, total: 0 };
  }

  const totalPages = Number(res.headers.get('x-wp-totalpages') ?? 0);
  const total = Number(res.headers.get('x-wp-total') ?? 0);
  const data = (await res.json()) as RawPost[];

  const items: VideoSummary[] = await Promise.all(
    data.map(async (post) => {
      const acf = post.acf ?? {};
      return {
        id: post.id ?? 0,
        title: post.title?.rendered ?? '',
        link: post.link ?? '#',
        date: post.date ?? null,
        thumbnailUrl: await resolveMediaUrl(
          post._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? extractFirstImage(post.content?.rendered, wpBaseUrl)
        ),
        excerpt: buildNewsPreview(post.excerpt?.rendered, post.content?.rendered),
        categories: post.categories ?? [],
        watchUrl: trimOrNull(acf.watch_url),
        trailerUrl: trimOrNull(acf.trailer_url),
        downloadFull: toDownload(acf.download_full_url, acf.download_full_duration, acf.download_full_size),
        downloadShort: toDownload(acf.download_short_url, acf.download_short_duration, acf.download_short_size),
        share: {
          vk: trimOrNull(acf.share_vk),
          youtube: trimOrNull(acf.share_youtube),
          rutube: trimOrNull(acf.share_rutube),
        },
      };
    })
  );

  return { items, totalPages, total };
};
