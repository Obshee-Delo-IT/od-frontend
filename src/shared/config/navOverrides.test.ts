import { describe, expect, it } from 'vitest';
import { isNavLabelHidden, SHOW_PRO_IN_NAV } from './navOverrides';

describe('isNavLabelHidden', () => {
  it('hides «ОБЩЕЕДЕЛО-ПРО», the label both WordPress installs use', () => {
    expect(isNavLabelHidden('ОБЩЕЕДЕЛО-ПРО')).toBe(true);
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

describe('SHOW_PRO_IN_NAV', () => {
  it('is the single switch behind the hiding', () => {
    expect(isNavLabelHidden('ОБЩЕЕДЕЛО-ПРО')).toBe(!SHOW_PRO_IN_NAV);
  });
});
