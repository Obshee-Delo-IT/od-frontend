import { afterEach, describe, expect, it, vi } from 'vitest';

const wpFetch = vi.fn();

vi.mock('./httpClient', () => ({
  wpFetch: (...args: unknown[]) => wpFetch(...args),
  wpBaseUrl: 'https://wp.test',
}));

vi.mock('./mediaUrl', () => ({
  resolveMediaUrl: vi.fn(async (url: string | null) => url),
}));

import { fetchNewsList } from './fetchNewsList';

const makeResponse = (body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers });

afterEach(() => {
  wpFetch.mockReset();
});

describe('fetchNewsList', () => {
  it('maps posts and reads the pagination headers', async () => {
    wpFetch.mockResolvedValue(
      makeResponse(
        [
          {
            id: 7,
            title: { rendered: 'Заголовок' },
            link: 'https://wp.test/?p=7',
            date: '2025-01-02T10:00:00',
            _embedded: { 'wp:featuredmedia': [{ source_url: 'https://wp.test/a.jpg' }] },
          },
        ],
        { 'x-wp-total': '42', 'x-wp-totalpages': '3' }
      )
    );

    const result = await fetchNewsList({ page: 2, perPage: 15 });

    expect(result.total).toBe(42);
    expect(result.totalPages).toBe(3);
    expect(result.items).toEqual([
      {
        id: 7,
        title: 'Заголовок',
        link: 'https://wp.test/?p=7',
        date: '2025-01-02T10:00:00',
        thumbnailUrl: 'https://wp.test/a.jpg',
        excerpt: null,
      },
    ]);

    const requestedPath = wpFetch.mock.calls[0][0] as string;
    expect(requestedPath).toContain('page=2');
    expect(requestedPath).toContain('per_page=15');
    expect(requestedPath).not.toContain('categories=');
  });

  it('passes the category filter through to the query', async () => {
    wpFetch.mockResolvedValue(makeResponse([], { 'x-wp-total': '0', 'x-wp-totalpages': '0' }));

    await fetchNewsList({ category: 578 });

    expect(wpFetch.mock.calls[0][0]).toContain('categories=578');
  });

  it('returns an empty result for a non-2xx response', async () => {
    wpFetch.mockResolvedValue(new Response('Bad Request', { status: 400 }));

    expect(await fetchNewsList({ page: 999 })).toEqual({ items: [], totalPages: 0, total: 0 });
  });
});
