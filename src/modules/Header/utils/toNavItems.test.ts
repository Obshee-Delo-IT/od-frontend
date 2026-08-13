import { describe, expect, it } from 'vitest';
import { SourceNavItem } from '../types';
import { toNavItems } from './toNavItems';

const wpItem = (id: number, parent: number, title: string, url: string): SourceNavItem => ({
  id,
  parent,
  url,
  title: { rendered: title },
});

describe('toNavItems', () => {
  it('returns an empty array when given no items', () => {
    expect(toNavItems()).toEqual([]);
    expect(toNavItems([])).toEqual([]);
  });

  it('maps WP menu items into nav items keyed by top-level entries', () => {
    const result = toNavItems([wpItem(1, 0, 'Главная', '/')]);

    expect(result).toEqual([
      {
        id: 1,
        parent: 0,
        href: '/',
        text: 'Главная',
        content: [],
      },
    ]);
  });

  it('nests children under their parents', () => {
    const result = toNavItems([
      wpItem(1, 0, 'О нас', '/about'),
      wpItem(2, 1, 'Команда', '/about/team'),
      wpItem(3, 1, 'Документы', '/about/docs'),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(result[0].content.map((c) => c.id)).toEqual([2, 3]);
  });

  it('drops orphan children whose parent is not in the input', () => {
    const result = toNavItems([wpItem(2, 99, 'Сирота', '/orphan')]);

    expect(result).toEqual([]);
  });

  it('rewrites internal absolute URLs to paths, children included', () => {
    const result = toNavItems(
      [
        wpItem(1, 0, 'О нас', 'https://wp.test/about/'),
        wpItem(2, 1, 'Команда', 'https://wp.test/about/team/'),
        wpItem(3, 0, 'Общее дело-ПРО', 'https://od-pro.example/'),
      ],
      ['https://wp.test']
    );

    expect(result[0].href).toBe('/about/');
    expect(result[0].content[0].href).toBe('/about/team/');
    expect(result[1].href).toBe('https://od-pro.example/');
  });

  it('drops the entries navOverrides hides, children with them', () => {
    const result = toNavItems([
      wpItem(1, 0, 'ГЛАВНАЯ', '/'),
      wpItem(56658, 0, 'ОБЩЕЕДЕЛО-ПРО', 'https://общеедело-про.рф'),
      wpItem(2, 56658, 'Конкурс', 'https://общеедело-про.рф/contest/'),
    ]);

    expect(result.map((item) => item.text)).toEqual(['ГЛАВНАЯ']);
  });
});
