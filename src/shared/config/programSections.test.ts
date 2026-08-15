import { describe, expect, it } from 'vitest';
import { DIRECTIONS, PROGRAMS } from './programSections';

const ALL = [...PROGRAMS, ...DIRECTIONS];

describe('programme sections config', () => {
  it('omits the three directions that have no page', () => {
    // Adding one back needs its page to exist first — all three 404 upstream, so
    // the A6 fallback has nothing to embed either. The omission is what hides
    // «ОД ИТ» on the home page *and* on /projects/: both read this array.
    expect(DIRECTIONS.map((card) => card.title)).toEqual(['Общее дело ПРО', 'Видеоматериалы', 'Онлайн курсы']);
  });

  it('points every programme at the legacy page the fallback can embed', () => {
    expect(PROGRAMS.map((card) => card.href)).toEqual(['/healthy-russia/', '/healthy-kids/', '/healthy-youth/']);
  });

  it('gives every card its own drawing', () => {
    // Figma pairs drawing to card by name, not position — «Общее дело ПРО» is
    // the charts illustration on both pages. Two cards sharing one component
    // means a mis-paired import, and also duplicates the SVG's internal ids.
    expect(new Set(ALL.map((card) => card.Illustration)).size).toBe(ALL.length);
  });
});
