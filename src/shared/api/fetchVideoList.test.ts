import { afterEach, describe, expect, it, vi } from 'vitest';

const wpFetch = vi.fn();

vi.mock('./httpClient', () => ({
  wpFetch: (...args: unknown[]) => wpFetch(...args),
  wpBaseUrl: 'https://wp.test',
}));

vi.mock('./mediaUrl', () => ({
  resolveMediaUrl: vi.fn(async (url: string | null) => url),
}));

import { fetchVideoList } from './fetchVideoList';

const makeResponse = (body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers });

afterEach(() => {
  wpFetch.mockReset();
});

describe('fetchVideoList', () => {
  it('maps acf fields, builds downloads only when a url is set, and reads pagination headers', async () => {
    wpFetch.mockResolvedValue(
      makeResponse(
        [
          {
            id: 71561,
            title: { rendered: 'Наркотики' },
            link: 'https://wp.test/?p=71561',
            date: '2023-08-30T06:52:13',
            categories: [581, 52],
            _embedded: { 'wp:featuredmedia': [{ source_url: 'https://wp.test/a.jpg' }] },
            acf: {
              watch_url: '',
              trailer_url: '',
              download_1_url: 'https://disk.yandex.ru/i/full',
              download_1_label: 'Полн. версия • 30 мин • 872 Мб',
              download_2_url: 'https://disk.yandex.ru/i/short',
              download_2_label: 'Сокр. версия • 23 мин • 350 Мб',
              share_vk: 'https://vk.com/x',
              share_youtube: '',
              share_rutube: '',
              poster_image_url: 'https://wp.test/uploads/плакат.jpg',
              poster_download_url: 'https://disk.yandex.ru/d/poster',
            },
          },
        ],
        { 'x-wp-total': '203', 'x-wp-totalpages': '21' }
      )
    );

    const result = await fetchVideoList({ page: 2, perPage: 10 });

    expect(result.total).toBe(203);
    expect(result.totalPages).toBe(21);

    const [film] = result.items;
    expect(film.id).toBe(71561);
    expect(film.categories).toEqual([581, 52]);
    expect(film.watchUrl).toBeNull();
    expect(film.downloads).toEqual([
      { url: 'https://disk.yandex.ru/i/full', label: 'Полн. версия • 30 мин • 872 Мб' },
      { url: 'https://disk.yandex.ru/i/short', label: 'Сокр. версия • 23 мин • 350 Мб' },
    ]);
    expect(film.share).toEqual({ vk: 'https://vk.com/x', youtube: null, rutube: null });
    expect(film.posterImageUrl).toBe('https://wp.test/uploads/плакат.jpg');
    expect(film.posterDownloadUrl).toBe('https://disk.yandex.ru/d/poster');

    const requestedPath = wpFetch.mock.calls[0][0] as string;
    expect(requestedPath).toContain('format=video');
    expect(requestedPath).toContain('page=2');
    expect(requestedPath).toContain('per_page=10');
  });

  it('skips empty download slots and falls back to a generic label when a slot has no label', async () => {
    wpFetch.mockResolvedValue(
      makeResponse(
        [
          {
            id: 1,
            title: { rendered: 'Фильм' },
            acf: { download_1_url: 'https://disk.yandex.ru/i/full', download_1_label: '', download_2_url: '' },
          },
        ],
        { 'x-wp-total': '1', 'x-wp-totalpages': '1' }
      )
    );

    const [film] = (await fetchVideoList()).items;
    expect(film.downloads).toEqual([{ url: 'https://disk.yandex.ru/i/full', label: 'Скачать фильм' }]);
  });

  it('passes the category filter through to the query', async () => {
    wpFetch.mockResolvedValue(makeResponse([], { 'x-wp-total': '0', 'x-wp-totalpages': '0' }));

    await fetchVideoList({ category: 581 });

    expect(wpFetch.mock.calls[0][0]).toContain('categories=581');
  });

  it('returns an empty result for a non-2xx response', async () => {
    wpFetch.mockResolvedValue(new Response('Bad Request', { status: 400 }));

    expect(await fetchVideoList({ page: 999 })).toEqual({ items: [], totalPages: 0, total: 0 });
  });
});
