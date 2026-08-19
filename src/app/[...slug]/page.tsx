import { notFound } from 'next/navigation';
import { cache } from 'react';
import { LegacyEmbed } from '@/modules/Legacy';
import { NewsArticle, newsMetadata } from '@/modules/News/NewsArticle';
import { FilmPage, filmMetadata } from '@/modules/Video/FilmPage';
import { WpPage, wpPageMetadata } from '@/modules/WpPage';
import { cachedFetchVideo } from '@/shared/api';
import { postTag, WP_TAGS, wpCache } from '@/shared/api/cacheTags';
import { cachedFetchNews } from '@/shared/api/fetchNews';
import { cachedFetchWpPage } from '@/shared/api/fetchWpPage';
import { client, wpFetch } from '@/shared/api/httpClient';
import { ALL_FILM_CATEGORY_IDS } from '@/shared/config/filmCategories';
import { isLegacyEmbedPage } from '@/shared/config/legacyEmbedPages';
import { canonicalUrl } from '@/shared/config/site';
import { decodeSegments, isEmbeddable, legacyPathname, loadLegacyDocument } from '@/shared/legacy';
import type { Metadata } from 'next';

/**
 * Legacy-URL catch-all (A8).
 *
 * The live site serves **every** post — news, article, film, event report — at
 * a bare `/<id>/`, and those URLs carry 46 % of all site entries (Yandex
 * Metrica, 91 days). So `/<id>` is the canonical post URL here too: we render
 * the page at the address search engines already know instead of redirecting to a
 * redesigned one. `/news/<id>` and `/video/<id>` redirect *into* this route
 * (see `next.config.ts`), not the other way round.
 *
 * A non-numeric path is a **WordPress page rendered natively** (D6) whenever WP
 * has one published at it: the same URL, the same content, rendered by us. That
 * is the default and needs no configuration — `shared/config/legacyEmbedPages.ts`
 * lists only the exceptions, pages whose markup still wants the old theme.
 *
 * Everything else is the **A6 legacy fallback**: `LegacyEmbed`, whose iframe
 * pulls the old page through `/legacy/*` so that every not-yet-redesigned page
 * keeps its live URL. Adding a native route for one of them retires both
 * branches automatically — App Router precedence gives a real route priority
 * over this catch-all, and nothing here needs editing.
 */
export const dynamicParams = true;
export const revalidate = 3600;

const legacyPostId = (slug: string[] | undefined) => (slug?.length === 1 && /^\d+$/.test(slug[0]) ? slug[0] : null);

/**
 * Split a trailing `page/<n>` off the slug — `/about/smi/page/2/` is page 2 of
 * the `core/query` block in `/about/smi/` (D3).
 *
 * A path segment rather than the `?page=` the site's own listings use, because
 * this route also serves `/<id>` and `searchParams` here would make **every**
 * post page dynamic. See `resolveQueryPagination`, which writes these links.
 *
 * Three segments minimum, so the proxy keeps `/page/N/` (the live home's
 * paginated feed) and `/news/page/N/`.
 */
const splitPageNumber = (slug: string[] | undefined): { base: string[] | undefined; pageNumber: number } => {
  const depth = slug?.length ?? 0;
  if (!slug || depth < 3 || slug[depth - 2] !== 'page' || !/^\d+$/.test(slug[depth - 1])) {
    return { base: slug, pageNumber: 1 };
  }
  // `page/1` renders page 1 and canonicalises onto the page's own address —
  // core never links to it, but a visitor can type it.
  return { base: slug.slice(0, -2), pageNumber: Math.max(1, Number(slug[depth - 1])) };
};

/**
 * The path to ask WordPress for, or `null` when this slug is not to be answered
 * from WP at all — an exception in `shared/config/legacyEmbedPages.ts`, or a
 * slug the path allowlist rejects.
 *
 * Decoded before it is matched, for the same reason the legacy loader decodes:
 * the router hands segments percent-encoded.
 */
const nativeWpPath = (slug: string[] | undefined): string | null => {
  const segments = decodeSegments(slug);
  if (!segments) {
    return null;
  }
  const path = legacyPathname(segments);
  return isLegacyEmbedPage(path) ? null : path;
};

/**
 * Which detail page a legacy `/<id>` resolves to, or `null` when no such post
 * exists. Deliberately a cheap `_fields` probe rather than a full fetch: the
 * page component re-fetches what it needs, and this has to run in
 * `generateMetadata` too. `cache()` dedups the two calls within one render.
 *
 * A raw `wpFetch` (not the openapi client) because the client's middleware
 * throws on a non-2xx — here a 404 is an expected answer, not an error.
 */
const resolvePostKind = cache(async (id: string): Promise<'film' | 'news' | null> => {
  const res = await wpFetch(`/wp/v2/posts/${id}?_fields=id,format`, wpCache([WP_TAGS.posts, postTag(id)]));
  if (!res.ok) {
    return null;
  }
  const post = (await res.json()) as { id?: number; format?: string } | null;
  if (!post?.id) {
    return null;
  }
  return post.format === 'video' ? 'film' : 'news';
});

/**
 * Untagged on purpose, unlike every other WP call (B3): this runs once per
 * build to pick the ISR seed, and its result is a list of ids rather than
 * rendered content — there is nothing for `/api/revalidate/` to usefully purge,
 * and a cache window here would only risk a rebuild reusing a stale seed. Posts
 * that miss the seed are served on demand via `dynamicParams`.
 */
export async function generateStaticParams() {
  const [films, posts] = await Promise.all([
    wpFetch(`/wp/v2/posts?format=video&categories=${ALL_FILM_CATEGORY_IDS.join(',')}&per_page=20&_fields=id`)
      .then((res) => (res.ok ? (res.json() as Promise<Array<{ id?: number }>>) : []))
      .catch(() => []),
    client
      .GET('/wp/v2/posts', { params: { query: { per_page: 20 } } })
      .then((response) => response.data ?? [])
      .catch(() => []),
  ]);

  return [...films, ...posts].filter((post) => post.id).map((post) => ({ slug: [String(post.id)] }));
}

/**
 * One legacy load per render pass, shared by `generateMetadata` and the page —
 * the same trick `resolvePostKind` uses above.
 *
 * Keyed by the **path string**, not the slug array. `cache()` memoises on
 * reference equality of its arguments, and `await params` hands each caller its
 * own array instance, so keying on the array misses every time and the wrapper
 * silently does nothing.
 *
 * Note what it does *not* buy: the iframe's `/legacy/*` request is a separate
 * HTTP request from the browser, so `cache()` cannot span the two. That one is
 * bounded by the proxy's own store instead, which both surfaces share.
 *
 * The `'revalidate'` policy is not optional and not a preference. `revalidate`
 * above is module-level and shared with the numeric branch, so this render must
 * stay statically generatable; an uncached fetch discovered during it aborts the
 * render and production answers **500**, where `next dev` answers 200. That gap
 * between the two modes is why this was found by a production build rather than
 * by any test. `connection()` does not rescue it either — under a module-level
 * `revalidate` it raises the same `DYNAMIC_SERVER_USAGE`.
 *
 * The proxy route keeps `'no-store'`, so the surface that serves the visitor
 * the actual content still refuses to reuse a failure.
 */
const loadLegacyPage = cache(async (path: string) => loadLegacyDocument(path.split('/').filter(Boolean), 'revalidate'));

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const id = legacyPostId(slug);
  if (!id) {
    // The shape guard runs first, before anything is fetched: `/favicon.png/`
    // and `/legacy/…` are not pages in either sense, and now that WordPress is
    // asked about every other path, "not a page at all" has to be settled
    // without a round trip.
    if (!isEmbeddable(slug)) {
      return {};
    }
    const { base, pageNumber } = splitPageNumber(slug);
    const nativePath = nativeWpPath(base);
    if (nativePath) {
      const page = await cachedFetchWpPage(nativePath, pageNumber);
      if (page) {
        return wpPageMetadata({ page, path: nativePath, pageNumber });
      }
    }
    if (pageNumber > 1) {
      return {};
    }
    // Always **our** canonical, never the legacy origin's: after cutover that
    // origin is a private frozen copy, and pointing at it would canonicalise
    // the site onto a host nobody can reach.
    const path = legacyPathname(slug);
    const alternates = { canonical: canonicalUrl(path) };
    const legacy = await loadLegacyPage(path);
    if (legacy.status !== 'ok') {
      // The upstream is unreachable or the page is gone; the layout's defaults
      // apply. `undefined` rather than an empty string, so Next falls back
      // instead of emitting a blank title.
      return { alternates };
    }
    return {
      title: legacy.document.title ?? undefined,
      description: legacy.document.description ?? undefined,
      alternates,
    };
  }

  const kind = await resolvePostKind(id);
  if (kind === 'film') {
    const film = await cachedFetchVideo(id);
    return film ? filmMetadata(film) : {};
  }
  if (kind === 'news') {
    return newsMetadata(await cachedFetchNews(id), id);
  }
  return {};
}

const Page = async ({ params }: { params: Promise<{ slug: string[] }> }) => {
  const { slug } = await params;
  const id = legacyPostId(slug);
  if (!id) {
    if (!isEmbeddable(slug)) {
      notFound();
    }

    // WordPress first, the embed when it has nothing published here. Which way
    // round matters: this is the branch that decides whether a page the editors
    // maintain is served as ours or as a frame of the old site, and the answer
    // is "ours unless listed otherwise".
    const { base, pageNumber } = splitPageNumber(slug);
    const nativePath = nativeWpPath(base);
    if (nativePath) {
      const page = await cachedFetchWpPage(nativePath, pageNumber);
      if (page) {
        return <WpPage page={page} path={nativePath} pageNumber={pageNumber} />;
      }
    }

    // A `/page/N/` WordPress could not serve is not a legacy address either —
    // the old site paginated `/news/` and `/category/*`, and the proxy answers
    // for both before this route sees them.
    if (pageNumber > 1) {
      notFound();
    }

    const legacy = await loadLegacyPage(legacyPathname(slug));
    // `notFound()` only for an answer the upstream gave definitively — a 404 or
    // a 410 — because this route's `revalidate = 3600` would cache it. A
    // transient 5xx or a timeout still renders the embed: the iframe fetches
    // independently, so the content appears the moment the origin recovers
    // rather than an hour later (LPF-005).
    if (legacy.status === 'disabled' || legacy.status === 'missing') {
      notFound();
    }

    // The embed and nothing else: the root layout already supplies the header,
    // the page column and the footer.
    //
    // Keyed by path so a client-side navigation between two fallback pages
    // remounts it. Without the key React reuses the instance, the frame reloads
    // but the measured `height` state does not, and the new page renders at the
    // old page's height until its first report arrives.
    return <LegacyEmbed key={legacyPathname(slug)} slug={slug} />;
  }

  const kind = await resolvePostKind(id);
  if (!kind) {
    notFound();
  }

  return kind === 'film' ? <FilmPage id={id} /> : <NewsArticle id={id} />;
};

export default Page;
