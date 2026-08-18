import { cache } from 'react';
import { sectionParent } from '@/shared/config/sectionParents';
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
 * The page served at `path` (leading and trailing slash), or `null` when WP has
 * no published page there.
 *
 * `path` is expected decoded, which is what `decodeSegments` hands the route.
 * A page whose slug WP stores percent-encoded — the handful of Cyrillic ones —
 * therefore never matches and falls back to the embed. Fixing that means
 * querying both forms, which is two round trips on every miss to serve pages
 * that between them see no measurable traffic.
 */
export const fetchWpPage = async (path: string): Promise<WpPageContent | null> => {
  const slug = path.split('/').filter(Boolean).pop();
  if (!slug) {
    return null;
  }

  const query = new URLSearchParams({
    slug,
    per_page: '10',
    _fields: 'id,link,parent,title,content,excerpt',
  });
  const res = await wpFetch(`/wp/v2/pages?${query}`, wpCache([WP_TAGS.pages]));
  if (!res.ok) {
    return null;
  }

  const body = (await res.json()) as RawPage[] | null;
  const page = (Array.isArray(body) ? body : []).find(
    (candidate) => candidate.link && pathnameOf(candidate.link) === path
  );
  if (!page?.id) {
    return null;
  }

  const ancestors = await fetchAncestors(page.parent ?? 0);
  /* The ten asset pages under `/materials/` are children of the section in
     WordPress and of a hub in the site — see `sectionParents.ts` for why the
     tree stays flat. */
  const hub = sectionParent(path);

  return {
    id: page.id,
    title: stripHtml(page.title?.rendered),
    contentHtml: page.content?.rendered ?? '',
    description: buildNewsPreview(page.excerpt?.rendered, page.content?.rendered),
    ancestors: hub ? [...ancestors, hub] : ancestors,
  };
};

/** Per-render dedup (page + `generateMetadata`), same pattern as `cachedFetchNews`. */
export const cachedFetchWpPage = cache(fetchWpPage);
