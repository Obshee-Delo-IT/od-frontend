import { describe, expect, it } from 'vitest';
import { HOME_DIRECTIONS, HOME_PROGRAMS } from './homeSections';

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
});
