import { describe, expect, it, vi } from 'vitest';

const wpFetch = vi.fn();

vi.mock('./httpClient', () => ({
  wpFetch: (...args: unknown[]) => wpFetch(...args),
  wpBaseUrl: 'https://wp.test',
}));

vi.mock('./mediaUrl', () => ({
  resolveMediaUrl: vi.fn(async (url: string | null) => url),
}));

/* The ids are per install and resolved from slugs at request time, so the
   numbers here are only stand-ins — what the test pins is which *scope* each
   of the two requests carries. */
const HOME_IDS = [581, 580];
const ALL_IDS = [581, 580, 86, 670, 559];
const ids = vi.hoisted(() => ({ home: [581, 580], all: [581, 580, 86, 670, 559] }));

vi.mock('./termIds', () => ({
  homeFilmCategoryIds: async () => ids.home,
  allFilmCategoryIds: async () => ids.all,
}));

import { HOME_FILM_SEGMENTS } from '@/shared/config/filmCategories';
import { fetchFilms } from './fetchFilms';

describe('fetchFilms', () => {
  it('scopes the home row to the catalogue categories, not to every format=video post', async () => {
    wpFetch.mockResolvedValue(new Response('[]', { status: 200 }));

    await fetchFilms(12);

    // The silent failure this guards: without the filter the newest posts win,
    // and «Видео события» outnumber the films 115 to 83.
    const [url] = wpFetch.mock.calls[0];
    expect(url).toContain(`categories=${HOME_IDS.join(',')}`);
    expect(url).toContain('per_page=12');
  });

  it('leaves «Ролики», «Короткометражные» and «Известные люди» out of the row', () => {
    expect(HOME_FILM_SEGMENTS).toEqual(['filmy', 'multy']);
  });

  it('asks for nothing at all when no category resolved', async () => {
    // An empty `categories=` is a 400 and dropping the parameter would answer
    // with the «Видео события» event reports — so a WordPress that didn't
    // answer (or the credential-free CI stub) yields an empty row, not a wrong
    // one.
    const callsBefore = wpFetch.mock.calls.length;
    ids.home = [];
    ids.all = [];

    expect(await fetchFilms(12)).toEqual({ items: [], catalogueTotal: 0 });
    expect(wpFetch.mock.calls).toHaveLength(callsBefore);

    ids.home = HOME_IDS;
    ids.all = ALL_IDS;
  });

  it('counts the whole catalogue for the CTA, not the row it renders', async () => {
    // Second call: a count-only probe over all four categories. The CTA says
    // «Все видео (83)» and leads to /video/, so 35 — the row's own scope —
    // would be the wrong number to print.
    wpFetch
      .mockResolvedValueOnce(
        new Response('[{"id":1,"title":{"rendered":"Фильм"}}]', { headers: { 'x-wp-total': '35' } })
      )
      .mockResolvedValueOnce(new Response('[{"id":1}]', { headers: { 'x-wp-total': '83' } }));

    const { items, catalogueTotal } = await fetchFilms(12);

    expect(items).toHaveLength(1);
    expect(catalogueTotal).toBe(83);
    expect(wpFetch.mock.calls[1][0]).toContain(`categories=${ALL_IDS.join(',')}`);
  });

  it('falls back to an empty result when WordPress answers non-2xx', async () => {
    wpFetch.mockResolvedValue(new Response('', { status: 500 }));

    expect(await fetchFilms(12)).toEqual({ items: [], catalogueTotal: 0 });
  });
});
