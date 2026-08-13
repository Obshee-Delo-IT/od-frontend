import { afterEach, describe, expect, it, vi } from 'vitest';

const wpFetch = vi.fn();

vi.mock('./httpClient', () => ({
  wpFetch: (...args: unknown[]) => wpFetch(...args),
  wpBaseUrl: 'https://wp.test',
}));

import { fetchSearch } from './fetchSearch';

const makeResponse = (body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers });

const requestedPath = () => wpFetch.mock.calls[0][0] as string;

afterEach(() => {
  wpFetch.mockReset();
});

describe('fetchSearch', () => {
  it('maps hits and reads the pagination headers', async () => {
    wpFetch.mockResolvedValue(
      makeResponse(
        [{ id: 71933, title: 'Спасибо за жизнь', url: 'https://wp.test/71933/', type: 'post', subtype: 'post' }],
        {
          'x-wp-total': '12',
          'x-wp-totalpages': '2',
        }
      )
    );

    const result = await fetchSearch({ query: 'жизнь' });

    expect(result).toEqual({
      total: 12,
      totalPages: 2,
      items: [
        {
          id: 71933,
          title: 'Спасибо за жизнь',
          href: '/71933/',
          sourceUrl: 'https://wp.test/71933/',
          subtype: 'post',
        },
      ],
    });
  });

  it('links posts to /<id>/, not to the WordPress permalink', async () => {
    // WP reports its own origin; following that would walk visitors off the
    // site and into the WordPress install.
    wpFetch.mockResolvedValue(makeResponse([{ id: 7, title: 'x', url: 'https://wp.test/?p=7', subtype: 'post' }]));

    expect((await fetchSearch({ query: 'x' })).items[0].href).toBe('/7/');
  });

  it('keeps the path for pages, which the fallback serves at the live URL', async () => {
    wpFetch.mockResolvedValue(
      makeResponse([{ id: 3, title: 'О нас', url: 'https://wp.test/about/team', subtype: 'page' }])
    );

    // Slash-terminated to match `trailingSlash: true`; the bare form is a redirect.
    expect((await fetchSearch({ query: 'о нас' })).items[0].href).toBe('/about/team/');
  });

  it('falls back to the home page rather than emitting a broken link', async () => {
    wpFetch.mockResolvedValue(makeResponse([{ id: 3, title: 'битый', url: 'not a url', subtype: 'category' }]));

    expect((await fetchSearch({ query: 'битый' })).items[0].href).toBe('/');
  });

  it('coerces the string ids WP uses for terms', async () => {
    wpFetch.mockResolvedValue(
      makeResponse([{ id: '85', title: 'Видео', url: 'https://wp.test/category/video/', subtype: 'category' }])
    );

    expect((await fetchSearch({ query: 'видео' })).items[0].id).toBe(85);
  });

  it('never asks WordPress for an empty query', async () => {
    // `?search=` matches everything: WP would answer with the first page of the
    // whole archive, presented to the user as search results.
    expect(await fetchSearch({ query: '   ' })).toEqual({ items: [], totalPages: 0, total: 0 });
    expect(wpFetch).not.toHaveBeenCalled();
  });

  it('trims the term and passes paging through', async () => {
    wpFetch.mockResolvedValue(makeResponse([]));

    await fetchSearch({ query: '  алкоголь  ', page: 3, perPage: 25 });

    expect(requestedPath()).toContain(`search=${encodeURIComponent('алкоголь')}`);
    expect(requestedPath()).toContain('page=3');
    expect(requestedPath()).toContain('per_page=25');
    expect(requestedPath()).not.toContain('subtype=');
  });

  it('caps per_page at the WP maximum', async () => {
    wpFetch.mockResolvedValue(makeResponse([]));

    await fetchSearch({ query: 'x', perPage: 500 });

    expect(requestedPath()).toContain('per_page=100');
  });

  it('narrows by subtype when asked, single or many', async () => {
    wpFetch.mockResolvedValue(makeResponse([]));

    await fetchSearch({ query: 'x', subtype: 'post' });
    expect(requestedPath()).toContain('subtype=post');

    wpFetch.mockReset();
    wpFetch.mockResolvedValue(makeResponse([]));
    await fetchSearch({ query: 'x', subtype: ['post', 'page'] });
    expect(requestedPath()).toContain(`subtype=${encodeURIComponent('post,page')}`);
  });

  it('treats a non-2xx as no results, the way the other listings do', async () => {
    wpFetch.mockResolvedValue(new Response('Bad Request', { status: 400 }));

    expect(await fetchSearch({ query: 'x', page: 999 })).toEqual({ items: [], totalPages: 0, total: 0 });
  });

  it('tags the response so a content edit can purge it', async () => {
    wpFetch.mockResolvedValue(makeResponse([]));

    await fetchSearch({ query: 'x' });

    expect(wpFetch.mock.calls[0][1]).toEqual({
      next: { revalidate: 3600, tags: ['wp', 'wp:posts', 'wp:search'] },
    });
  });
});
