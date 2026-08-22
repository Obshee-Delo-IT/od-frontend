import { describe, expect, it, vi } from 'vitest';
import { NewsArticle } from '@/modules/News/NewsArticle';
import { FilmPage } from '@/modules/Video/FilmPage';

/**
 * The catch-all's numeric branch only serves published posts.
 *
 * Every WP request is signed with the `od-frontend` application password, and
 * that account is an administrator. WordPress's *single-item* post route takes
 * no `status` argument — unlike the collection route, which defaults to
 * `publish` — so `check_read_permission()` falls through to
 * `current_user_can('read_post')` and returns drafts, pending, private and
 * future-dated posts in full. Before the guard in `resolvePostKind` that meant
 * `/<id>/` published anything an editor had not: on od-stage 2026-08-22,
 * `https://new.obshee-delo.ru/73790/` answered 200 with a draft's title in
 * `<title>` and its body in the page, to an anonymous request. Ids are
 * sequential, so the exposed set was enumerable by diffing against the sitemap.
 *
 * Each test uses a **distinct id**: `resolvePostKind` runs through React's
 * `cache()`, which memoises per call site, so a reused id would serve one test
 * the previous one's answer.
 */

const wpFetch = vi.fn<(path: string, init?: unknown) => Promise<Response>>();

vi.mock('@/shared/api/httpClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api/httpClient')>()),
  wpFetch: (path: string, init?: unknown) => wpFetch(path, init),
}));

vi.mock('@/shared/api/fetchNews', () => ({ cachedFetchNews: vi.fn().mockResolvedValue(null) }));
vi.mock('@/shared/api/fetchWpPage', () => ({
  cachedFetchWpPage: vi.fn().mockResolvedValue(null),
  fetchWpPage: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api')>()),
  cachedFetchVideo: vi.fn().mockResolvedValue(null),
}));

class NotFound extends Error {}

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new NotFound('NEXT_NOT_FOUND');
  },
}));

const { default: Page, generateMetadata } = await import('./page');

const render = (id: string) => Page({ params: Promise.resolve({ slug: [id] }) });
const metadata = (id: string) => generateMetadata({ params: Promise.resolve({ slug: [id] }) });

/** What `?_fields=id,format,status` comes back with. */
const post = (id: number, status: string, format = 'standard') =>
  new Response(JSON.stringify({ id, format, status }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('the numeric branch declines unpublished posts', () => {
  it.each(['draft', 'pending', 'private', 'future', 'trash'])('404s on a %s post', async (status) => {
    const id = `9000${status.length}${status.charCodeAt(0)}`;
    wpFetch.mockResolvedValue(post(Number(id), status));

    await expect(render(id)).rejects.toBeInstanceOf(NotFound);
  });

  it('asks WordPress for the status in the first place', async () => {
    wpFetch.mockClear().mockResolvedValue(post(91001, 'draft'));

    await expect(render('91001')).rejects.toBeInstanceOf(NotFound);
    expect(wpFetch).toHaveBeenCalledWith(expect.stringContaining('_fields=id,format,status'), expect.anything());
  });

  it('gives an unpublished post no metadata either, so nothing leaks through <title>', async () => {
    wpFetch.mockResolvedValue(post(91002, 'draft'));

    await expect(metadata('91002')).resolves.toEqual({});
  });
});

describe('the numeric branch still serves published posts', () => {
  it('renders an article', async () => {
    wpFetch.mockResolvedValue(post(91003, 'publish'));

    const element = await render('91003');

    expect(element.type).toBe(NewsArticle);
  });

  it('renders a film', async () => {
    wpFetch.mockResolvedValue(post(91004, 'publish', 'video'));

    const element = await render('91004');

    expect(element.type).toBe(FilmPage);
  });
});
