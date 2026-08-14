import { describe, expect, it } from 'vitest';
import { HOME_DIRECTIONS, HOME_PROGRAMS } from './homeSections';

describe('home sections config', () => {
  it('omits the three directions that have no page', () => {
    // Adding one back needs its page to exist first — all three 404 upstream, so
    // the A6 fallback has nothing to embed either.
    expect(HOME_DIRECTIONS.map((card) => card.title)).toEqual(['Общее дело ПРО', 'Видеоматериалы']);
  });

  it('points every programme at the legacy page the fallback can embed', () => {
    expect(HOME_PROGRAMS.map((card) => card.href)).toEqual(['/healthy-russia/', '/healthy-kids/', '/healthy-youth/']);
  });
});
