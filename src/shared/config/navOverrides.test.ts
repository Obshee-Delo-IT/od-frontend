import { describe, expect, it } from 'vitest';
import { isNavLabelHidden } from './navOverrides';

describe('isNavLabelHidden', () => {
  it('hides «ОБЩЕЕДЕЛО-ПРО», the label both WordPress installs use', () => {
    expect(isNavLabelHidden('ОБЩЕЕДЕЛО-ПРО')).toBe(true);
  });

  it('hides «Заказать материалы», the child of «Материалы» this site does not surface', () => {
    expect(isNavLabelHidden('Заказать материалы')).toBe(true);
  });

  it('tolerates the whitespace and casing WP editors introduce', () => {
    expect(isNavLabelHidden('  общеедело-про  ')).toBe(true);
  });

  it('keeps every other entry', () => {
    ['ГЛАВНАЯ', 'О НАС', 'ПРОГРАММЫ', 'ФИЛЬМЫ', 'МАТЕРИАЛЫ', 'КОНТАКТЫ', ''].forEach((label) => {
      expect(isNavLabelHidden(label)).toBe(false);
    });
  });
});
