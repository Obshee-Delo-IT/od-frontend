import { WP_TAGS, wpCache } from './cacheTags';
import { extractFirstImage } from './extractFirstImage';
import { wpBaseUrl, wpFetch } from './httpClient';
import { resolveMediaUrl } from './mediaUrl';
import { buildNewsPreview } from './newsPreview';

/** A single downloadable variant of a film, as held in the generic ACF slots. */
export interface VideoDownload {
  url: string;
  /** Full pill text, e.g. «Полн. версия • 35 мин • 1,5 Гб» or «656 Мб • 35 мин». */
  label: string;
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
  /** Kinescope video id — the on-site player embed (E4), when populated. */
  kinescopeId: string | null;
  /** «Смотреть онлайн» destination, when present. */
  watchUrl: string | null;
  trailerUrl: string | null;
  /** Populated download slots, in slot order. */
  downloads: VideoDownload[];
  share: VideoShareLinks;
  /** Full-size «плакат» artwork URL — canonical source for the poster card. */
  posterImageUrl: string | null;
  /** «Скачать плакат» destination. */
  posterDownloadUrl: string | null;
}

export interface VideoListResult {
  items: VideoSummary[];
  totalPages: number;
  total: number;
}

export interface FetchVideoListParams {
  page?: number;
  perPage?: number;
  /**
   * WP category id, or a list of them (OR-matched by WP) — the children of
   * «Видео» 85. Omit to query every `format=video` post, which also pulls in
   * the «Видео события» event reports.
   */
  category?: number | number[];
}

/** How many generic `download_N_*` slots the ACF group defines. */
const DOWNLOAD_SLOTS = 5;

/** ACF group `group_film_meta` — all fields are flat url/text, empty string when unset. */
interface RawAcf {
  kinescope_id?: string;
  watch_url?: string;
  trailer_url?: string;
  share_vk?: string;
  share_youtube?: string;
  share_rutube?: string;
  poster_image_url?: string;
  poster_download_url?: string;
  /** download_1_url, download_1_label, … download_5_label. */
  [key: `download_${number}_${'url' | 'label'}`]: string | undefined;
}

export interface RawVideoPost {
  id?: number;
  link?: string;
  date?: string;
  format?: string;
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

/** Collect the populated `download_N_*` slots; a URL without a label gets a generic one. */
const toDownloads = (acf: RawAcf): VideoDownload[] => {
  const downloads: VideoDownload[] = [];
  for (let slot = 1; slot <= DOWNLOAD_SLOTS; slot += 1) {
    const url = trimOrNull(acf[`download_${slot}_url`]);
    if (url) {
      downloads.push({ url, label: trimOrNull(acf[`download_${slot}_label`]) ?? 'Скачать фильм' });
    }
  }
  return downloads;
};

/**
 * Map a raw `format=video` post (with `_embed`) to the film summary shape the
 * `/video` pages consume — shared between {@link fetchVideoList} and `fetchVideo`.
 */
export const mapVideoSummary = async (post: RawVideoPost): Promise<VideoSummary> => {
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
    kinescopeId: trimOrNull(acf.kinescope_id),
    watchUrl: trimOrNull(acf.watch_url),
    trailerUrl: trimOrNull(acf.trailer_url),
    downloads: toDownloads(acf),
    share: {
      vk: trimOrNull(acf.share_vk),
      youtube: trimOrNull(acf.share_youtube),
      rutube: trimOrNull(acf.share_rutube),
    },
    posterImageUrl: trimOrNull(acf.poster_image_url),
    posterDownloadUrl: trimOrNull(acf.poster_download_url),
  };
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
  const categories = (Array.isArray(category) ? category : [category]).filter(Boolean);
  if (categories.length > 0) {
    query.set('categories', categories.join(','));
  }

  const res = await wpFetch(`/wp/v2/posts?${query.toString()}`, wpCache([WP_TAGS.posts, WP_TAGS.films]));
  if (!res.ok) {
    return { items: [], totalPages: 0, total: 0 };
  }

  const totalPages = Number(res.headers.get('x-wp-totalpages') ?? 0);
  const total = Number(res.headers.get('x-wp-total') ?? 0);
  const data = (await res.json()) as RawVideoPost[];

  const items: VideoSummary[] = await Promise.all(data.map(mapVideoSummary));

  return { items, totalPages, total };
};
