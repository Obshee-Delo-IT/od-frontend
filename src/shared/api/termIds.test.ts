import { describe, expect, it, vi } from 'vitest';

const wpFetch = vi.fn();

vi.mock('./httpClient', () => ({
  wpFetch: (...args: unknown[]) => wpFetch(...args),
}));

import { FILM_TOPICS } from '@/shared/config/filmTopics';
import { allFilmCategoryIds, filmCategoryIds, filmTopicIds } from './termIds';

/** od-wp's numbers — the install whose ids the repository used to disagree with. */
const CATEGORIES = [
  { id: 581, slug: 'movies' },
  { id: 580, slug: 'mult' },
  { id: 86, slug: 'roliki' },
  { id: 670, slug: 'short' },
  { id: 559, slug: 'famous' },
];

/* A fresh Response per call — a body can only be read once. */
const answering = (terms: Array<{ id: number; slug: string }>) => {
  wpFetch.mockReset();
  wpFetch.mockImplementation(async () => new Response(JSON.stringify(terms), { status: 200 }));
};

describe('filmCategoryIds', () => {
  it('reads the id off the install being queried, not off a constant', async () => {
    // The whole point: «Короткометражные» is 670 here and 671 on od-stage, and
    // one build serves both. A hard-coded id emptied /video/short/ on the live
    // site over twelve films (2026-09-16).
    answering(CATEGORIES);

    expect(await filmCategoryIds(['short'])).toEqual([670]);
  });

  it('asks for every catalogue slug in one request', async () => {
    answering(CATEGORIES);

    await filmCategoryIds(['short']);

    const [url] = wpFetch.mock.calls[0];
    expect(url).toContain('/wp/v2/categories?slug=movies,mult,roliki,short,famous');
    expect(url).toContain('per_page=100');
  });

  it('returns the ids in the order asked for, not the order WordPress answers in', async () => {
    answering(CATEGORIES);

    expect(await allFilmCategoryIds()).toEqual([581, 580, 86, 670, 559]);
  });

  it('drops a slug the install does not have rather than guessing', async () => {
    answering(CATEGORIES.filter((term) => term.slug !== 'short'));

    expect(await filmCategoryIds(['short'])).toEqual([]);
    expect(await allFilmCategoryIds()).toEqual([581, 580, 86, 559]);
  });

  it('answers with nothing when WordPress does not answer', async () => {
    wpFetch.mockReset();
    wpFetch.mockResolvedValue(new Response('', { status: 500 }));

    expect(await allFilmCategoryIds()).toEqual([]);
  });
});

describe('filmTopicIds', () => {
  it('maps a selection to this install’s tag ids, in chip order', async () => {
    answering([
      { id: 213, slug: FILM_TOPICS.alcohol },
      { id: 671, slug: 'drugs' },
      { id: 677, slug: 'gadgets' },
    ]);

    expect(await filmTopicIds(['gadgets', 'alcohol'])).toEqual([677, 213]);
    expect(await filmTopicIds([])).toEqual([]);
  });

  it('percent-encodes the two legacy slugs, which are percent-encoded already', async () => {
    // «Алкоголь» and «Табак» pre-date the topic task, so WordPress holds them
    // under its own encoding of a Russian name. Sending that raw would have WP
    // decode it once too often and match nothing.
    answering([{ id: 213, slug: FILM_TOPICS.alcohol }]);

    await filmTopicIds(['alcohol']);

    const [url] = wpFetch.mock.calls[0];
    expect(url).toContain('%25d0%25b0%25d0%25bb');
    expect(url).toContain(',drugs,manipulation,');
  });
});
