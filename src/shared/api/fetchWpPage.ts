import { cache } from 'react';
import { WP_TAGS, wpCache } from './cacheTags';
import { wpFetch } from './httpClient';
import { buildNewsPreview, stripHtml } from './newsPreview';

/**
 * One WordPress **page** (`post_type=page`), addressed by the path it is served
 * at — the mechanism behind every "manage it in WP, render it natively" page,
 * which is now every path the catch-all reaches bar the exceptions in
 * `shared/config/legacyEmbedPages.ts`.
 *
 * Pages are looked up by **slug, then verified by path**, because WP's REST API
 * has no path lookup: `?slug=` matches the last segment across the whole tree,
 * so two pages under different parents can share one. Comparing `link` against
 * the requested path is what makes `/materials/plakati/` resolve to the child
 * and not to some other `plakati`.
 *
 * A raw `wpFetch` rather than the typed client: an unknown path is an expected
 * answer here (the caller falls back to the legacy embed), and the client's
 * middleware turns any non-2xx into a throw. It also lets `_fields` keep the
 * payload to what the page renders.
 */

export interface WpPageAncestor {
  title: string;
  href: string;
}

export interface WpPageContent {
  id: number;
  /** Plain text — WP renders titles with entities and the odd `<br>`. */
  title: string;
  /** Rendered Gutenberg body, as stored. */
  contentHtml: string;
  /** Meta description, WP's excerpt falling back to the body. */
  description: string | null;
  /**
   * The page's parents, outermost first — the breadcrumb trail above it, which
   * is what the sub-page mocks draw («Материалы → Печатная продукция»).
   * Empty for a top-level page, which is most of them.
   */
  ancestors: WpPageAncestor[];
}

interface RawPage {
  id?: number;
  link?: string;
  parent?: number;
  title?: { rendered?: string };
  content?: { rendered?: string };
  excerpt?: { rendered?: string };
}

/** `https://wp.example/materials/plakati/` → `/materials/plakati/`, decoded. */
const pathnameOf = (link: string): string | null => {
  try {
    return decodeURIComponent(new URL(link).pathname);
  } catch {
    return null;
  }
};

/**
 * Walks `parent` upwards, outermost first.
 *
 * One request per level, so the cap is not a formality: WP allows any depth,
 * and this runs on a route that must stay statically generatable. Three covers
 * every published page on this site (`/about/reviews/letters/` is the deepest),
 * and a fourth level would simply start its trail one page in.
 *
 * A level that fails to load ends the trail rather than failing the page: a
 * breadcrumb is navigation, and half of it beats a 500.
 */
const MAX_ANCESTORS = 3;

const fetchAncestors = async (parentId: number): Promise<WpPageAncestor[]> => {
  const trail: WpPageAncestor[] = [];
  let id = parentId;

  while (id > 0 && trail.length < MAX_ANCESTORS) {
    // Sequential by nature: each level's id comes from the one below it.
    const res = await wpFetch(`/wp/v2/pages/${id}?_fields=link,parent,title`, wpCache([WP_TAGS.pages]));
    if (!res.ok) {
      break;
    }

    const raw = (await res.json()) as RawPage | null;
    const href = raw?.link ? pathnameOf(raw.link) : null;
    if (!href) {
      break;
    }

    trail.unshift({ title: stripHtml(raw?.title?.rendered), href });
    id = raw?.parent ?? 0;
  }

  return trail;
};

/**
 * The page served at `path`, asked for once — optionally with extra query
 * parameters appended to the REST call, which is how a later page of a
 * `core/query` block is requested (see below).
 */
const requestPage = async (path: string, slug: string, extra = ''): Promise<RawPage | null> => {
  const query = new URLSearchParams({
    slug,
    per_page: '10',
    _fields: 'id,link,parent,title,content,excerpt',
  });
  const res = await wpFetch(`/wp/v2/pages?${query}${extra}`, wpCache([WP_TAGS.pages]));
  if (!res.ok) {
    return null;
  }

  const body = (await res.json()) as RawPage[] | null;
  return (
    (Array.isArray(body) ? body : []).find((candidate) => candidate.link && pathnameOf(candidate.link) === path) ?? null
  );
};

/**
 * The parameter a `core/query` block reads its page number from, as it appears
 * in the pagination links WordPress just rendered.
 *
 * Read out of the markup rather than hardcoded because the id in it is the
 * *editor's*: `/about/smi/` is `query-95-page`, `/about/reviews/letters/` is
 * `query-100-page`, and re-saving a page in Gutenberg can assign a new one. The
 * page-1 body always carries the key when there is more than one page, so the
 * body is the authority.
 */
const PAGE_PARAM = /\bquery-\d+-page(?==\d)/;

/** What core's `post-template` renders as, and renders **nothing** at all past the last page. */
const POST_TEMPLATE = 'wp-block-post-template';

/**
 * The page served at `path` (leading and trailing slash), or `null` when WP has
 * no published page there.
 *
 * `path` is expected decoded, which is what `decodeSegments` hands the route.
 * A page whose slug WP stores percent-encoded — the handful of Cyrillic ones —
 * therefore never matches and falls back to the embed. Fixing that means
 * querying both forms, which is two round trips on every miss to serve pages
 * that between them see no measurable traffic.
 *
 * `pageNumber` is the page *of the body's `core/query` block* — the
 * `/about/smi/page/2/` half of D3. Above 1 it returns `null` for anything the
 * block cannot serve, so the route can 404 instead of publishing an address
 * that renders an empty list.
 */
export const fetchWpPage = async (path: string, pageNumber = 1): Promise<WpPageContent | null> => {
  const slug = path.split('/').filter(Boolean).pop();
  if (!slug) {
    return null;
  }

  const page = await requestPage(path, slug);
  if (!page?.id) {
    return null;
  }

  let contentHtml = page.content?.rendered ?? '';

  if (pageNumber > 1) {
    // A second round trip, and only ever for `/…/page/2/` and beyond — the
    // key is not knowable before the first body is in hand, and page 1 is the
    // request the unpaginated URL makes anyway, so ISR shares it.
    const param = contentHtml.match(PAGE_PARAM)?.[0];
    if (!param) {
      return null; // No pagination on this page: `/…/page/2/` is not an address.
    }
    const paged = await requestPage(path, slug, `&${param}=${pageNumber}`);
    const rendered = paged?.content?.rendered ?? '';
    if (!rendered.includes(POST_TEMPLATE)) {
      return null; // Past the last page. A soft-404 would be worse than a 404.
    }
    contentHtml = rendered;
  }

  // Everything but the body is the page's own and identical on every page of
  // it, so it is read from the first response — a title and a description that
  // drifted with the pagination would be a defect, not a feature.
  return {
    id: page.id,
    title: stripHtml(page.title?.rendered),
    contentHtml,
    description: buildNewsPreview(page.excerpt?.rendered, page.content?.rendered),
    ancestors: await fetchAncestors(page.parent ?? 0),
  };
};

/** Per-render dedup (page + `generateMetadata`), same pattern as `cachedFetchNews`. */
export const cachedFetchWpPage = cache(fetchWpPage);
