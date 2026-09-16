import { WP_TAGS, wpCache } from './cacheTags';
import { extractFirstImage } from './extractFirstImage';
import { wpBaseUrl, wpFetch } from './httpClient';
import { resolveMediaUrl } from './mediaUrl';
import { buildNewsPreview, stripHtml } from './newsPreview';

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
  /**
   * The thumbnail's pixels, when it came from the featured image — WP puts them
   * in the `_embed` payload for free, and the film card states them so a crawler
   * can lay the share out before it has fetched the file. `null` for the body
   * image and the Kinescope poster, whose sizes nothing here knows.
   */
  thumbnailSize: { width?: number; height?: number } | null;
  /**
   * What the **social card** should advertise, which is not always what the
   * page shows. The visible thumbnail falls back to the body's first image, and
   * on a film that is as likely to be the «Скачать с Яндекс.Диска» button
   * (294×68, measured on 50161 and 50167) as a frame — a card that renders
   * blank in Facebook and WhatsApp. So the card takes the editor's featured
   * image or the Kinescope poster, and otherwise nothing, which `ogCardImage`
   * turns into the branded card.
   */
  cardImageUrl: string | null;
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

interface VideoListResult {
  items: VideoSummary[];
  totalPages: number;
  total: number;
}

interface FetchVideoListParams {
  page?: number;
  perPage?: number;
  /**
   * WP category id, or a list of them (OR-matched by WP) — the children of
   * «Видео» 85. Omit to query every `format=video` post, which also pulls in
   * the «Видео события» event reports.
   */
  category?: number | number[];
  /**
   * WP `post_tag` ids — the subject topics (`shared/config/filmTopics.ts`).
   *
   * OR-matched within the taxonomy, like categories, and AND-ed against them
   * across taxonomies: `category: 580, tags: [213, 216]` is «мультфильмы про
   * алкоголь или табак». Empty or omitted filters nothing.
   */
  tags?: number[];
}

/** How many generic `download_N_*` slots the ACF group defines. */
const DOWNLOAD_SLOTS = 5;

/**
 * Kinescope's own poster for a video — the still its player shows before play.
 * Public and token-free: the URL 302s to the CDN copy, so nothing has to be
 * uploaded to WordPress and a re-encoded video brings its new still with it.
 *
 * The fallback of last resort for a card's artwork. **36 of the 86 catalogue
 * films have none at all** — no featured image and no image in the body — and
 * 31 of those have a player, so this fills all but five (B-VIDEO2). It is not a
 * substitute for the editorial gap: a plain video frame is worse than key art,
 * and `pnpm film:covers` still wants running when covers arrive.
 */
const kinescopePosterUrl = (kinescopeId: string | null): string | null =>
  kinescopeId ? `https://kinescope.io/${kinescopeId}/poster.jpg` : null;

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
  _embedded?: {
    'wp:featuredmedia'?: Array<{ source_url?: string; media_details?: { width?: number; height?: number } }>;
  };
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
  const kinescopeId = trimOrNull(acf.kinescope_id);
  const featured = post._embedded?.['wp:featuredmedia']?.[0];
  // `resolveMediaUrl` answers null only for a nullish source, so a non-null
  // `resolved` means the URL above it is the one that won — which is what makes
  // it safe to attach the featured image's dimensions to it.
  const resolved = await resolveMediaUrl(featured?.source_url ?? extractFirstImage(post.content?.rendered, wpBaseUrl));
  const fromFeatured = Boolean(featured?.source_url);
  const title = stripHtml(post.title?.rendered);
  return {
    id: post.id ?? 0,
    title,
    link: post.link ?? '#',
    date: post.date ?? null,
    thumbnailUrl: resolved ?? kinescopePosterUrl(kinescopeId),
    thumbnailSize:
      resolved && fromFeatured
        ? { width: featured?.media_details?.width, height: featured?.media_details?.height }
        : null,
    cardImageUrl: (fromFeatured ? resolved : null) ?? kinescopePosterUrl(kinescopeId),
    excerpt: buildNewsPreview(post.excerpt?.rendered, post.content?.rendered, title),
    categories: post.categories ?? [],
    kinescopeId,
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
  tags,
}: FetchVideoListParams = {}): Promise<VideoListResult> => {
  const query = new URLSearchParams({
    format: 'video',
    per_page: String(perPage),
    page: String(page),
    _embed: '1',
  });
  const categories = (Array.isArray(category) ? category : [category]).filter(Boolean);
  // A filter that resolved to nothing is not «no filter». The ids come from
  // `termIds.ts`, which drops a slug the install doesn't have, and an omitted
  // `categories` would answer with every `format=video` post — the «Видео
  // события» event reports included. Empty in, empty out; `undefined` is how a
  // caller says «unfiltered».
  if ((category !== undefined && categories.length === 0) || (tags !== undefined && tags.length === 0)) {
    return { items: [], totalPages: 0, total: 0 };
  }
  if (categories.length > 0) {
    query.set('categories', categories.join(','));
  }
  if (tags && tags.length > 0) {
    query.set('tags', tags.join(','));
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
