import { describe, expect, it, vi } from 'vitest';

const wpFetch = vi.fn();

vi.mock('./httpClient', () => ({
  wpFetch: (...args: unknown[]) => wpFetch(...args),
  wpBaseUrl: 'https://wp.test',
}));

vi.mock('./mediaUrl', () => ({
  resolveMediaUrl: vi.fn(async (url: string | null) => url),
}));

import { FILM_CATEGORIES, HOME_FILM_CATEGORY_IDS } from '@/shared/config/filmCategories';
import { fetchFilms } from './fetchFilms';

describe('fetchFilms', () => {
  it('scopes the home row to the catalogue categories, not to every format=video post', async () => {
    wpFetch.mockResolvedValue(new Response('[]', { status: 200 }));

    await fetchFilms(12);

    // The silent failure this guards: without the filter the newest posts win,
    // and «Видео события» outnumber the films 115 to 83.
    const [url] = wpFetch.mock.calls[0];
    expect(url).toContain(`categories=${HOME_FILM_CATEGORY_IDS.join(',')}`);
    expect(url).toContain('per_page=12');
  });

  it('leaves «Ролики» out of the row while the catalogue keeps them', () => {
    expect(HOME_FILM_CATEGORY_IDS).not.toContain(FILM_CATEGORIES.roliki);
  });

  it('reports the scope total from X-WP-Total, not the page length', async () => {
    wpFetch.mockResolvedValue(
      new Response('[{"id":1,"title":{"rendered":"Фильм"}}]', { headers: { 'x-wp-total': '71' } })
    );

    const { items, total } = await fetchFilms(12);

    expect(items).toHaveLength(1);
    expect(total).toBe(71);
  });

  it('falls back to an empty result when WordPress answers non-2xx', async () => {
    wpFetch.mockResolvedValue(new Response('', { status: 500 }));

    expect(await fetchFilms(12)).toEqual({ items: [], total: 0 });
  });
});
