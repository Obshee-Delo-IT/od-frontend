import { setTimeout as sleep } from 'node:timers/promises';
import { WP_TAGS, wpCache } from '@/shared/api/cacheTags';
import { wpFetch } from '@/shared/api/httpClient';
import { catalogueHref, FILM_CATEGORIES, type FilmCategorySegment } from '@/shared/config/filmCategories';
import { ARTICLES_HREF } from '@/shared/config/newsCategories';
import { canonicalUrl } from '@/shared/config/site';
import type { MetadataRoute } from 'next';

/**
 * `/sitemap.xml` (F4).
 *
 * The live site publishes one from a WP plugin; at cutover the frontend takes
 * the domain and that URL 404s, removing the discovery path for the whole post
 * archive at the exact moment the URL set changes. This replaces it, in the
 * same `https://host/<id>/` form Yandex has already ingested.
 *
 * Every URL is built with `canonicalUrl()`: Next writes `<loc>` **verbatim** —
 * no `metadataBase`, no trailing-slash normalisation and, importantly, no XML
 * escaping — so a slashless URL here would advertise a 301 and a stray `&`
 * would invalidate the whole document. That is also why no `?page=` URL appears
 * below; pagination is discovered by crawling, and every post is listed
 * directly regardless.
 *
 * Daily is far more often than this archive changes; new posts also reach
 * crawlers through the `/<id>` ISR window and the linked-from-home feed.
 */
export const revalidate = 86400;

/** WP caps `per_page` at 100 — 200 answers 400. */
const PER_PAGE = 100;

/**
 * Matches `experimental.staticGenerationMaxConcurrency`: the WP host starts
 * 503ing above roughly this much parallelism (see next.config.ts).
 */
const CONCURRENCY = 4;

const ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 500;

/**
 * Refuse to publish a sitemap covering less than this share of the archive.
 * Under ISR a throw leaves the previous body in place, whereas a truncated file
 * actively tells crawlers the missing URLs are gone — the worse of the two.
 */
const MIN_COVERAGE = 0.9;

interface RawPostRef {
  id?: number;
  /** UTC, but WP sends it with no zone designator — see {@link toLastModified}. */
  modified_gmt?: string;
}

interface PostRef {
  id: number;
  lastModified?: Date;
}

interface PostIndex {
  posts: PostRef[];
  /** True when WP answered with the secrets-free stub rather than real data. */
  stubbed: boolean;
}

/**
 * `orderby=id` (not WP's default `date desc`) so the pagination window is
 * stable: a post published mid-crawl would otherwise shift every later page,
 * silently duplicating and skipping ids. `_fields` is not an optimisation but a
 * requirement — the full payload is ~480× larger, ~200 MB across the archive.
 */
const postsPath = (page: number) =>
  `/wp/v2/posts?per_page=${PER_PAGE}&page=${page}&_fields=id,modified_gmt&orderby=id&order=asc`;

/** A page of post refs, or `null` once the retries are spent. */
const fetchPostPage = async (page: number): Promise<Response | null> => {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const res = await wpFetch(postsPath(page), wpCache([WP_TAGS.posts], revalidate));
      if (res.ok) {
        return res;
      }
    } catch {
      // A network-level failure gets the same treatment as a 5xx: retry.
    }
    if (attempt < ATTEMPTS) {
      await sleep(RETRY_BACKOFF_MS * attempt);
    }
  }
  return null;
};

/**
 * WP returns GMT timestamps without the `Z`; `new Date` would read them as
 * container-local and shift every `<lastmod>` with the deployment's timezone.
 * A `Date` (rather than the raw string) because a zone-less `YYYY-MM-DDThh:mm:ss`
 * is not a legal W3C datetime — Next serialises a `Date` via `toISOString()`.
 */
const toLastModified = (modifiedGmt?: string): Date | undefined => {
  if (!modifiedGmt) {
    return undefined;
  }
  const parsed = new Date(`${modifiedGmt.replace(/Z$/, '')}Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const toPostRefs = (payload: unknown): PostRef[] =>
  (Array.isArray(payload) ? (payload as RawPostRef[]) : [])
    .filter((post): post is RawPostRef & { id: number } => typeof post.id === 'number')
    .map((post) => ({ id: post.id, lastModified: toLastModified(post.modified_gmt) }));

/**
 * Every published post id, as `X-WP-TotalPages` pages of 100.
 *
 * Throws when the first page never answers: without it there is no page count,
 * and guessing would publish a sitemap missing most of the archive.
 */
const collectPosts = async (): Promise<PostIndex> => {
  const first = await fetchPostPage(1);
  if (!first) {
    throw new Error(`sitemap: WordPress did not answer for the first page of posts after ${ATTEMPTS} attempts`);
  }

  const totalPagesHeader = first.headers.get('x-wp-totalpages');
  if (totalPagesHeader === null) {
    // The stub client (no WP credentials, e.g. a CI build) answers `200 []`
    // with no `X-WP-*` headers. Indistinguishable from real data by body
    // alone, and it must not look like an outage or the build would fail.
    return { posts: [], stubbed: true };
  }

  const totalPages = Number(totalPagesHeader) || 0;
  const total = Number(first.headers.get('x-wp-total') ?? 0);
  const posts = toPostRefs(await first.json());

  const pending = Array.from({ length: Math.max(totalPages - 1, 0) }, (_, index) => index + 2);
  let cursor = 0;
  let missingPages = 0;

  const takeNext = () => {
    const page = pending[cursor];
    cursor += 1;
    return page;
  };

  const worker = async () => {
    for (let page = takeNext(); page !== undefined; page = takeNext()) {
      const res = await fetchPostPage(page);
      if (res) {
        posts.push(...toPostRefs(await res.json()));
      } else {
        missingPages += 1;
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker));

  if (missingPages > 0) {
    const detail = `${missingPages} of ${totalPages} WordPress pages failed, ${posts.length}/${total} posts collected`;
    if (total > 0 && posts.length < total * MIN_COVERAGE) {
      throw new Error(`sitemap: ${detail} — refusing to publish a truncated sitemap`);
    }
    // eslint-disable-next-line no-console
    console.warn(`[sitemap] ${detail}; publishing the rest.`);
  }

  // Ascending id keeps the file byte-stable between regenerations — the worker
  // pool completes pages out of order.
  return { posts: posts.sort((a, b) => a.id - b.id), stubbed: false };
};

const sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: canonicalUrl('/'), changeFrequency: 'daily', priority: 1 },
    { url: canonicalUrl('/news/'), changeFrequency: 'daily', priority: 0.8 },
    { url: canonicalUrl('/materials/'), changeFrequency: 'monthly', priority: 0.6 },
    // The «Статьи» collection's own address — a live-site URL with real search
    // traffic, and the canonical target of the index's «Статьи» chip.
    { url: canonicalUrl(ARTICLES_HREF), changeFrequency: 'monthly', priority: 0.6 },
    { url: canonicalUrl(catalogueHref({ segment: null })), changeFrequency: 'weekly', priority: 0.8 },
    // Enumerated from the shared map, and addressed through the same helper the
    // catalogue links with, so a new segment can't be forgotten here or drift
    // into a URL that redirects. `/video/short/` is absent by construction: it
    // names no category and 301s to «Все».
    ...Object.keys(FILM_CATEGORIES).map((segment) => ({
      url: canonicalUrl(catalogueHref({ segment: segment as FilmCategorySegment })),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];

  const { posts, stubbed } = await collectPosts();
  if (stubbed) {
    // eslint-disable-next-line no-console
    console.warn('[sitemap] WordPress is not configured — publishing the static URLs only.');
    return staticEntries;
  }

  return [
    ...staticEntries,
    // `/<id>/` is the only address a post has — the one the live site uses and
    // search engines already hold.
    ...posts.map((post) => ({
      url: canonicalUrl(`/${post.id}/`),
      lastModified: post.lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
};

export default sitemap;
