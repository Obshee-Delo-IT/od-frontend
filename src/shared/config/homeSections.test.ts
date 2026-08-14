import { describe, expect, it } from 'vitest';
import { HOME_DIRECTIONS, HOME_PROGRAMS, MERGE_HOME_SECTIONS, shouldMergeHomeSections } from './homeSections';

describe('home sections config', () => {
  it('hides the three directions that have no page', () => {
    const titles = HOME_DIRECTIONS.map((card) => card.title);

    expect(titles).not.toContain('Бизнес-клуб');
    expect(titles).not.toContain('ОД ИТ');
    expect(titles).not.toContain('Наставничество');
    expect(titles).toEqual(['Общее дело ПРО', 'Видеоматериалы']);
  });

  it('points every programme at the legacy page the fallback can embed', () => {
    expect(HOME_PROGRAMS.map((card) => card.href)).toEqual(['/healthy-russia/', '/healthy-kids/', '/healthy-youth/']);
  });

  it('merges only when one of the groups is under three cards', () => {
    expect(shouldMergeHomeSections(3, 3)).toBe(false);
    expect(shouldMergeHomeSections(3, 2)).toBe(true);
    expect(shouldMergeHomeSections(2, 5)).toBe(true);
  });

  it('merges what ships today — two directions is under the floor', () => {
    expect(MERGE_HOME_SECTIONS).toBe(true);
  });
});
