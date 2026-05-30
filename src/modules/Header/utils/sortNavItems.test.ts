import { describe, expect, it } from 'vitest';
import { SourceNavItem } from '../types';
import { sortNavItems } from './sortNavItems';

const item = (id: number, parent: number): SourceNavItem => ({
  id,
  parent,
  url: `/url/${id}`,
  title: { rendered: `Item ${id}` },
});

describe('sortNavItems', () => {
  it('keeps top-level items (parent === 0) before nested items', () => {
    const input = [item(1, 10), item(2, 0), item(3, 10), item(4, 0)];

    const result = sortNavItems(input);

    const tops = result.filter((i) => i.parent === 0).map((i) => i.id);
    const nested = result.filter((i) => i.parent !== 0).map((i) => i.id);
    const sortedIds = result.map((i) => i.id);

    expect(sortedIds.slice(0, tops.length)).toEqual(tops);
    expect(sortedIds.slice(tops.length)).toEqual(nested);
  });

  it('returns the same array reference (sorts in place)', () => {
    const input = [item(1, 0)];

    expect(sortNavItems(input)).toBe(input);
  });

  it('handles an empty list', () => {
    expect(sortNavItems([])).toEqual([]);
  });
});
