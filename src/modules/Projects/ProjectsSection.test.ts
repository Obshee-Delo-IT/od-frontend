import { describe, expect, it } from 'vitest';
import { toCardRows } from './ProjectsSection';
import type { ProjectCardData } from './ProjectsSection';

const cards = (count: number): ProjectCardData[] =>
  Array.from({ length: count }, (_, i) => ({ id: i, title: `${i}`, href: '/', Illustration: () => null }));

const shape = (count: number) => toCardRows(cards(count)).map((row) => row.length);

describe('toCardRows', () => {
  it('splits five cards 2 + 3, the way Figma draws «Проекты»', () => {
    expect(shape(5)).toEqual([2, 3]);
  });

  it('spends the remainder on wide rows, never leaving a row short', () => {
    // Rows of three unless the count doesn't divide by three; then the wide
    // two-card row absorbs the difference, up front.
    expect(shape(2)).toEqual([2]);
    expect(shape(3)).toEqual([3]);
    expect(shape(4)).toEqual([2, 2]);
    expect(shape(6)).toEqual([3, 3]);
    expect(shape(7)).toEqual([2, 2, 3]);
    expect(shape(8)).toEqual([2, 3, 3]);
  });

  it('never drops or duplicates a card', () => {
    for (const count of Array.from({ length: 13 }, (_, i) => i)) {
      expect(
        toCardRows(cards(count))
          .flat()
          .map((card) => card.id)
      ).toEqual(cards(count).map((card) => card.id));
    }
  });
});
