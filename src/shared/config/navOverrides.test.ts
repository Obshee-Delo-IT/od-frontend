import { describe, expect, it } from 'vitest';
import { isNavLabelHidden } from './navOverrides';

describe('isNavLabelHidden', () => {
  it('hides «ОБЩЕЕДЕЛО-ПРО», the label both WordPress installs use', () => {
    expect(isNavLabelHidden('ОБЩЕЕДЕЛО-ПРО')).toBe(true);
  });

  it('tolerates the whitespace and casing WP editors introduce', () => {
    expect(isNavLabelHidden('  общеедело-про  ')).toBe(true);
  });

  it('keeps every other entry', () => {
    ['ГЛАВНАЯ', 'О НАС', 'ПРОГРАММЫ', 'ФИЛЬМЫ', 'МАТЕРИАЛЫ', 'Заказать материалы', 'КОНТАКТЫ', ''].forEach((label) => {
      expect(isNavLabelHidden(label)).toBe(false);
    });
  });
});
