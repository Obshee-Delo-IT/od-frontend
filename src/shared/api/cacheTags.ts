/**
 * Cache tags for every WordPress request, and the window they live in (B3).
 *
 * **Why tag at all.** A tag on a `fetch` is what makes the *page* built from it
 * purgeable, not just the JSON: Next records the tags of every fetch a render
 * touched on that route's ISR entry, so `revalidateTag('wp:post:123')` drops
 * both the cached WP response and the prerendered `/123/`. Untagged data can
 * only be waited out — which is the state this replaces, and the reason a WP
 * edit took up to an hour to appear. The purge itself is `/api/revalidate/`
 * (B4); this module is the vocabulary both ends have to agree on.
 *
 * **Granularity.** Deliberately coarse. WordPress holds news, articles, films
 * and event reports in the single `post` type, so any post edit purges
 * `wp:posts` and with it every listing — cheaper than teaching the webhook
 * which of the ~8 200 posts appears in which listing, and wrong only in that it
 * regenerates a few pages that didn't change. `wp:post:<id>` narrows it to the
 * one detail page; `wp:films` is the catalogue's slice; `wp:menus` and
 * `wp:widgets` are the header and footer, which change on a different schedule
 * from content and shouldn't be collateral in a post purge.
 */

/**
 * Default freshness for WP data, in seconds. Matches the `revalidate = 3600` on
 * the routes that consume it: a shorter window here would refetch WP without
 * the page ever rebuilding, and a longer one would let a rebuilt page serve
 * data older than itself.
 */
export const WP_REVALIDATE_SECONDS = 3600;

/** The namespace every tag in this file starts with — see {@link isWpTag}. */
const WP_TAG_PREFIX = 'wp';

export const WP_TAGS = {
  /** Every WP response. A full-content purge, for schema or environment moves. */
  all: WP_TAG_PREFIX,
  /** Any post list or post detail — WP keeps news, articles and films in one type. */
  posts: 'wp:posts',
  /**
   * WP `page` content served natively (D6). Coarse on purpose: the pages are a
   * handful and nothing lists them, so there is no per-page tag to be worth the
   * vocabulary — a single page can still be purged by `paths` on the webhook.
   */
  pages: 'wp:pages',
  /** The `format=video` slice: the catalogue, its categories, the film pages. */
  films: 'wp:films',
  /** Nav menus (`/wp/v2/menus` + `/wp/v2/menu-items`) — the header. */
  menus: 'wp:menus',
  /** Widget sidebars (`/wp/v2/widgets`) — the footer. */
  widgets: 'wp:widgets',
  /** `/wp/v2/search` results (B7). */
  search: 'wp:search',
} as const;

/** The tag for one post's detail page, e.g. `wp:post:39664`. */
export const postTag = (id: number | string): string => `${WP_TAG_PREFIX}:post:${id}`;

/**
 * Whether a tag belongs to this namespace. The revalidate webhook validates
 * against it so a leaked secret can purge WP content and nothing else — Next's
 * own implicit route tags (`_N_T_/…`) are addressable by the same API, and
 * accepting them would hand a caller the whole render cache.
 */
export const isWpTag = (tag: string): boolean => tag === WP_TAG_PREFIX || tag.startsWith(`${WP_TAG_PREFIX}:`);

/** A `RequestInit` fragment carrying Next's cache directives. */
interface WpCacheInit {
  next: {
    revalidate: number;
    tags: string[];
  };
}

/**
 * Cache directives for a WP request: `wpFetch(path, wpCache([WP_TAGS.posts]))`,
 * or spread into the typed client — `client.GET(path, { params, ...wpCache([…]) })`.
 *
 * {@link WP_TAGS.all} is added to every request, so one purge can clear
 * everything without every call site remembering to list it.
 */
export const wpCache = (tags: string[], revalidate: number = WP_REVALIDATE_SECONDS): WpCacheInit => ({
  next: { revalidate, tags: [WP_TAGS.all, ...tags] },
});
