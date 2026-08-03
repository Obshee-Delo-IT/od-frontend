/**
 * Minimal WordPress REST helpers for the film-worksheet scripts.
 *
 * Zero-dependency and standalone from `src/shared/api/httpClient.ts` — these run
 * under plain `node --env-file=.env`, outside the Next.js module graph.
 */

/** Children of the «Видео» (85) taxonomy — the film catalogue. */
export const FILM_CATEGORY_IDS = [581, 580, 86, 559];

export const FILM_CATEGORY_NAMES = {
  581: 'Фильмы',
  580: 'Мультфильмы',
  86: 'Ролики',
  559: 'Известные люди',
  52: 'Видео события',
};

/** How many generic `download_N_*` slots `group_film_meta` defines. */
export const DOWNLOAD_SLOTS = 5;

/** Every writable ACF field, in worksheet column order. */
export const ACF_FIELDS = [
  'kinescope_id',
  'watch_url',
  'trailer_url',
  'share_vk',
  'share_youtube',
  'share_rutube',
  'poster_image_url',
  'poster_download_url',
  ...Array.from({ length: DOWNLOAD_SLOTS }, (_, i) => [`download_${i + 1}_url`, `download_${i + 1}_label`]).flat(),
];

export const readEnv = () => {
  const { WP_USER, WP_PASSWORD, WP_BASE } = process.env;
  if (!WP_USER || !WP_PASSWORD || !WP_BASE) {
    throw new Error('WP_USER, WP_PASSWORD and WP_BASE must be set — run via `node --env-file=.env …`.');
  }
  return {
    base: WP_BASE.replace(/\/$/, ''),
    auth: `Basic ${Buffer.from(`${WP_USER}:${WP_PASSWORD}`).toString('base64')}`,
  };
};

export const wpFetch = async ({ base, auth }, path, init = {}) =>
  fetch(`${base}/wp-json${path}`, {
    ...init,
    headers: { Authorization: auth, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  });

/** Every `format=video` post in the given categories, following pagination. */
export const fetchAllFilms = async (env, { categories = FILM_CATEGORY_IDS, fields } = {}) => {
  const films = [];
  const query = new URLSearchParams({ format: 'video', per_page: '100' });
  if (categories.length > 0) {
    query.set('categories', categories.join(','));
  }
  if (fields) {
    query.set('_fields', fields.join(','));
  }

  for (let page = 1; ; page += 1) {
    query.set('page', String(page));
    const res = await wpFetch(env, `/wp/v2/posts?${query}`);
    if (!res.ok) {
      throw new Error(`WP returned ${res.status} for page ${page}: ${(await res.text()).slice(0, 200)}`);
    }
    films.push(...(await res.json()));
    if (page >= Number(res.headers.get('x-wp-totalpages') ?? 1)) {
      return films;
    }
  }
};

/** Strip HTML tags and decode the handful of entities WP titles actually use. */
export const plainText = (html = '') =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/\s+/g, ' ')
    .trim();
