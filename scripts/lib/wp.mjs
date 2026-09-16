/**
 * Minimal WordPress REST helpers for the film-worksheet scripts.
 *
 * Zero-dependency and standalone from `src/shared/api/httpClient.ts` — these run
 * under plain `node --env-file=.env`, outside the Next.js module graph.
 */

/**
 * Children of the «Видео» (85) taxonomy — the film catalogue, by slug.
 *
 * Slugs and not ids for the reason `src/shared/config/filmCategories.ts` gives:
 * a term id is handed out by the install that created the term, so
 * «Короткометражные» is 671 on od-stage and 670 on od-wp, and a script pointed
 * at `.env.prod` with the other tier's number silently exports the wrong shelf.
 */
export const FILM_CATEGORY_SLUGS = ['movies', 'mult', 'roliki', 'short', 'famous'];

/** «Видео события» — event reports, not part of the catalogue but worth naming. */
export const EVENT_CATEGORY_SLUG = 'video-sobytiya';

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

/**
 * Term ids for the given slugs on the install `env` points at: `{slug: id}`.
 * One request; a slug the install doesn't have is simply absent.
 */
export const fetchTermIds = async (env, taxonomy, slugs) => {
  const query = slugs.map(encodeURIComponent).join(',');
  const res = await wpFetch(env, `/wp/v2/${taxonomy}?slug=${query}&per_page=100&_fields=id,slug`);
  if (!res.ok) {
    throw new Error(`WP returned ${res.status} for ${taxonomy} slugs ${slugs.join(',')}`);
  }
  return Object.fromEntries((await res.json()).map((term) => [term.slug, term.id]));
};

/** The catalogue's category ids and names on this install, resolved from slugs. */
export const fetchFilmCategories = async (env) => {
  const res = await wpFetch(env, '/wp/v2/categories?parent=85&per_page=100&_fields=id,slug,name');
  if (!res.ok) {
    throw new Error(`WP returned ${res.status} for the «Видео» children`);
  }
  const children = await res.json();
  const catalogue = children.filter((category) => FILM_CATEGORY_SLUGS.includes(category.slug));
  return {
    ids: FILM_CATEGORY_SLUGS.map((slug) => catalogue.find((category) => category.slug === slug)?.id).filter(Boolean),
    names: Object.fromEntries(children.map((category) => [category.id, plainText(category.name)])),
  };
};

/** Every `format=video` post in the given categories, following pagination. */
export const fetchAllFilms = async (env, { categories = [], fields } = {}) => {
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
