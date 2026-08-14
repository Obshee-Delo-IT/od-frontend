import { notFound } from 'next/navigation';
import { cache } from 'react';
import { LegacyEmbed } from '@/modules/Legacy';
import { NewsArticle, newsMetadata } from '@/modules/News/NewsArticle';
import { FilmPage, filmMetadata } from '@/modules/Video/FilmPage';
import { cachedFetchVideo } from '@/shared/api';
import { postTag, WP_TAGS, wpCache } from '@/shared/api/cacheTags';
import { cachedFetchNews } from '@/shared/api/fetchNews';
import { client, wpFetch } from '@/shared/api/httpClient';
import { ALL_FILM_CATEGORY_IDS } from '@/shared/config/filmCategories';
import { canonicalUrl } from '@/shared/config/site';
import { isEmbeddable, legacyPathname, loadLegacyDocument } from '@/shared/legacy';
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
 * Non-numeric paths are the **A6 legacy fallback**: an eligible one renders
 * `LegacyEmbed`, whose iframe pulls the old page through `/legacy/*` so that
 * every not-yet-redesigned page keeps its live URL. Adding a native route for
 * one of them retires its fallback automatically — App Router precedence gives
 * a real route priority over this catch-all, and nothing here needs editing.
 */
export const dynamicParams = true;
export const revalidate = 3600;

const legacyPostId = (slug: string[] | undefined) => (slug?.length === 1 && /^\d+$/.test(slug[0]) ? slug[0] : null);

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
const loadLegacyPage = cache(async (slug: string[]) => loadLegacyDocument(slug, 'revalidate'));

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const id = legacyPostId(slug);
  if (!id) {
    if (!isEmbeddable(slug)) {
      return {};
    }
    // Always **our** canonical, never the legacy origin's: after cutover that
    // origin is a private frozen copy, and pointing at it would canonicalise
    // the site onto a host nobody can reach.
    const alternates = { canonical: canonicalUrl(legacyPathname(slug)) };
    const legacy = await loadLegacyPage(slug);
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

    const legacy = await loadLegacyPage(slug);
    // `notFound()` only for an answer the upstream gave definitively — a 404 or
    // a 410 — because this route's `revalidate = 3600` would cache it. A
    // transient 5xx or a timeout still renders the embed: the iframe fetches
    // independently, so the content appears the moment the origin recovers
    // rather than an hour later (LPF-005).
    if (legacy.status === 'disabled' || legacy.status === 'missing') {
      notFound();
    }

    // The embed and nothing else: the root layout already supplies the header,
    // `Container` and footer.
    return <LegacyEmbed slug={slug} />;
  }

  const kind = await resolvePostKind(id);
  if (!kind) {
    notFound();
  }

  return kind === 'film' ? <FilmPage id={id} /> : <NewsArticle id={id} />;
};

export default Page;
