import { notFound } from 'next/navigation';
import { cache } from 'react';
import { NewsArticle, newsMetadata } from '@/modules/News/NewsArticle';
import { FilmPage, filmMetadata } from '@/modules/Video/FilmPage';
import { cachedFetchVideo } from '@/shared/api';
import { postTag, WP_TAGS, wpCache } from '@/shared/api/cacheTags';
import { cachedFetchNews } from '@/shared/api/fetchNews';
import { client, wpFetch } from '@/shared/api/httpClient';
import { ALL_FILM_CATEGORY_IDS } from '@/shared/config/filmCategories';
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
 * Non-numeric paths `notFound()` for now. **This is the seam A6 fills**: the
 * legacy-page fallback replaces that branch with the chromeless iframe proxy,
 * at which point every not-yet-redesigned page keeps its live URL too.
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

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const id = legacyPostId(slug);
  if (!id) {
    return {};
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
    // A6 renders the legacy page here instead.
    notFound();
  }

  const kind = await resolvePostKind(id);
  if (!kind) {
    notFound();
  }

  return kind === 'film' ? <FilmPage id={id} /> : <NewsArticle id={id} />;
};

export default Page;
