import { afterEach, describe, expect, it, vi } from 'vitest';

const wpFetch = vi.fn();

vi.mock('./httpClient', () => ({
  wpFetch: (...args: unknown[]) => wpFetch(...args),
  wpBaseUrl: 'https://wp.test',
}));

vi.mock('./mediaUrl', () => ({
  resolveMediaUrl: vi.fn(async (url: string | null) => url),
}));

import { fetchVideo } from './fetchVideo';

const makeResponse = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

const filmPost = {
  id: 71933,
  format: 'video',
  title: { rendered: 'Спасибо за жизнь' },
  link: 'https://wp.test/?p=71933',
  date: '2023-08-28T10:00:00',
  categories: [581],
  content: { rendered: '<p>О фильме</p>' },
  _embedded: { 'wp:featuredmedia': [{ source_url: 'https://wp.test/poster.jpg' }] },
  acf: {
    kinescope_id: ' abc123 ',
    watch_url: '',
    download_1_url: 'https://disk.yandex.ru/i/full',
    download_1_label: 'Полн. версия • 35 мин • 1,5 Гб',
  },
};

afterEach(() => {
  wpFetch.mockReset();
});

describe('fetchVideo', () => {
  it('maps a film post including content and a trimmed kinescope id', async () => {
    wpFetch.mockResolvedValue(makeResponse(filmPost));

    const film = await fetchVideo('71933');

    expect(wpFetch.mock.calls[0][0]).toBe('/wp/v2/posts/71933?_embed=1');
    expect(film?.id).toBe(71933);
    expect(film?.title).toBe('Спасибо за жизнь');
    expect(film?.kinescopeId).toBe('abc123');
    expect(film?.thumbnailUrl).toBe('https://wp.test/poster.jpg');
    expect(film?.contentHtml).toBe('<p>О фильме</p>');
    expect(film?.downloads).toEqual([
      { url: 'https://disk.yandex.ru/i/full', label: 'Полн. версия • 35 мин • 1,5 Гб' },
    ]);
  });

  it('returns null for a post that is not format=video', async () => {
    wpFetch.mockResolvedValue(makeResponse({ ...filmPost, format: 'standard' }));

    expect(await fetchVideo('123')).toBeNull();
  });

  it('returns null for a non-2xx response', async () => {
    wpFetch.mockResolvedValue(new Response('Not Found', { status: 404 }));

    expect(await fetchVideo('999999')).toBeNull();
  });

  it('rejects a non-numeric id without hitting the API', async () => {
    expect(await fetchVideo('not-a-number')).toBeNull();
    expect(wpFetch).not.toHaveBeenCalled();
  });
});
