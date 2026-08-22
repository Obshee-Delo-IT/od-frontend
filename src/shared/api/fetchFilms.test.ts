import { describe, expect, it, vi } from 'vitest';

const wpFetch = vi.fn();

vi.mock('./httpClient', () => ({
  wpFetch: (...args: unknown[]) => wpFetch(...args),
  wpBaseUrl: 'https://wp.test',
}));

vi.mock('./mediaUrl', () => ({
  resolveMediaUrl: vi.fn(async (url: string | null) => url),
}));

import { ALL_FILM_CATEGORY_IDS } from '@/shared/config/filmCategories';
import { fetchFilms } from './fetchFilms';

describe('fetchFilms', () => {
  it('scopes the home row to the catalogue categories, not to every format=video post', async () => {
    wpFetch.mockResolvedValue(new Response('[]', { status: 200 }));

    await fetchFilms(6);

    // The silent failure this guards: without the filter the newest posts win,
    // and «Видео события» outnumber the films 115 to 83.
    const [url] = wpFetch.mock.calls[0];
    expect(url).toContain(`categories=${ALL_FILM_CATEGORY_IDS.join(',')}`);
    expect(url).toContain('per_page=6');
  });
});
