import { components } from '@/types/generated/wp-json-openapi';
import { WP_TAGS, wpCache } from './cacheTags';
import { wpFetch } from './httpClient';
import { stripHtml } from './newsPreview';

/** WP's own search payload — id, title, url, type, subtype and nothing else. */
type RawSearchResult = components['schemas']['search-result'];

/** The object subtypes od-dev's search can return, per the generated schema. */
export type SearchSubtype = NonNullable<RawSearchResult['subtype']>;

export interface SearchHit {
  id: number;
  title: string;
  /** Where to link on *this* site — see {@link toHref}. */
  href: string;
  /** WP's own URL for the object, kept for debugging and for odd subtypes. */
  sourceUrl: string;
  subtype: SearchSubtype | null;
}

export interface SearchResult {
  items: SearchHit[];
  totalPages: number;
  total: number;
}

export interface FetchSearchParams {
  /** The user's query. Empty or whitespace-only returns nothing, see below. */
  query: string;
  page?: number;
  perPage?: number;
  /** Narrow to certain object subtypes; omit for everything WP indexes. */
  subtype?: SearchSubtype | SearchSubtype[];
}

/** WP caps `per_page` at 100. */
const MAX_PER_PAGE = 100;

/**
 * A hit's address on this site.
 *
 * Posts live at the bare `/<id>/` (A8), which is not the URL WP reports — WP
 * hands back its own permalink on the `WP_BASE` origin, and linking to that
 * would send visitors off to the WordPress install. Everything else keeps its
 * path: pages are the A6 fallback's territory and are served at the same path
 * the live site uses. A URL we can't parse falls back to the search page's own
 * address rather than emitting a broken link.
 */
const toHref = (result: RawSearchResult): string => {
  if (result.subtype === 'post' && result.id) {
    return `/${result.id}/`;
  }
  try {
    const { pathname } = new URL(String(result.url));
    return pathname.endsWith('/') ? pathname : `${pathname}/`;
  } catch {
    return '/';
  }
};

/**
 * Site-wide search — `GET /wp/v2/search` (B7).
 *
 * The endpoint is WP core's, and for this content volume (~8 200 posts, 174
 * pages) it is enough; Algolia/Meilisearch stay deferred until relevance
 * actually becomes a complaint. It returns only id/title/url/type/subtype — no
 * excerpt, no thumbnail — so a results UI that wants either has to fetch the
 * posts separately.
 *
 * **An empty query never reaches WordPress.** `?search=` with no term is not an
 * error there, it is a match-everything: WP would answer with the first page of
 * the entire archive, which as search results is nonsense.
 *
 * Mirrors {@link fetchNewsList}: `X-WP-Total{,Pages}` for real pagination, and a
 * non-2xx (an out-of-range page, mainly) is «no results» rather than a throw.
 */
export const fetchSearch = async ({
  query,
  page = 1,
  perPage = 10,
  subtype,
}: FetchSearchParams): Promise<SearchResult> => {
  const term = query.trim();
  if (!term) {
    return { items: [], totalPages: 0, total: 0 };
  }

  const params = new URLSearchParams({
    search: term,
    per_page: String(Math.min(perPage, MAX_PER_PAGE)),
    page: String(page),
  });
  const subtypes = subtype === undefined ? [] : [subtype].flat();
  if (subtypes.length > 0) {
    params.set('subtype', subtypes.join(','));
  }

  const res = await wpFetch(`/wp/v2/search?${params.toString()}`, wpCache([WP_TAGS.posts, WP_TAGS.search]));
  if (!res.ok) {
    return { items: [], totalPages: 0, total: 0 };
  }

  const totalPages = Number(res.headers.get('x-wp-totalpages') ?? 0);
  const total = Number(res.headers.get('x-wp-total') ?? 0);
  const data = (await res.json()) as RawSearchResult[];

  const items = data.map((result) => ({
    // `id` is `number | string` in the schema — terms report theirs as a string.
    id: Number(result.id ?? 0),
    // WP hands search titles back as HTML, the same as every other
    // `title.rendered`: «&#171;Общее&nbsp;Дело&#187;» would print literally.
    title: stripHtml(result.title),
    href: toHref(result),
    sourceUrl: result.url ?? '',
    subtype: result.subtype ?? null,
  }));

  return { items, totalPages, total };
};
