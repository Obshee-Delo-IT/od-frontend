import { describe, expect, it } from 'vitest';
import { DIRECTIONS, PROGRAMS, SPLIT_HOME_SECTIONS } from './programSections';

const ALL = [...PROGRAMS, ...DIRECTIONS];

describe('programme sections config', () => {
  it('omits the three directions that have no page', () => {
    // Adding one back needs its page to exist first — all three 404 upstream, so
    // the A6 fallback has nothing to embed either. This hides «ОД ИТ» on the
    // home page; /projects/ is a WordPress page since D6g and carries its own.
    expect(DIRECTIONS.map((card) => card.title)).toEqual(['Общее дело ПРО', 'Видеоматериалы', 'Онлайн курсы']);
  });

  it('points every programme at the page WordPress serves', () => {
    expect(PROGRAMS.map((card) => card.href)).toEqual(['/healthy-russia/', '/healthy-kids/', '/healthy-youth/']);
  });

  it('splits the home carousels once the directions fill a row', () => {
    // The merge only exists to stop a one- or two-card carousel reading as a
    // stub above the fold; three is a full row at desktop.
    expect(SPLIT_HOME_SECTIONS).toBe(DIRECTIONS.length >= 3);
    expect(SPLIT_HOME_SECTIONS).toBe(true);
  });

  it('gives every card its own drawing', () => {
    // Figma pairs drawing to card by name, not position — «Общее дело ПРО» is
    // the charts illustration wherever it appears. Two cards sharing one component
    // means a mis-paired import, and also duplicates the SVG's internal ids.
    expect(new Set(ALL.map((card) => card.Illustration)).size).toBe(ALL.length);
  });
});
