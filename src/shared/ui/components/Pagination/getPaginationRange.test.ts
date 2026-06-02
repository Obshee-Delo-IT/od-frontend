import { describe, expect, it } from 'vitest';
import { DOTS, getPaginationRange } from './getPaginationRange';

describe('getPaginationRange', () => {
  it('lists every page when the total fits without ellipsis', () => {
    expect(getPaginationRange(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('collapses the tail when near the start', () => {
    expect(getPaginationRange(1, 18)).toEqual([1, 2, 3, 4, 5, DOTS, 18]);
    expect(getPaginationRange(3, 18)).toEqual([1, 2, 3, 4, 5, DOTS, 18]);
  });

  it('collapses the head when near the end', () => {
    expect(getPaginationRange(18, 18)).toEqual([1, DOTS, 14, 15, 16, 17, 18]);
  });

  it('collapses both sides in the middle', () => {
    expect(getPaginationRange(9, 18)).toEqual([1, DOTS, 8, 9, 10, DOTS, 18]);
  });

  it('honours a wider sibling count', () => {
    expect(getPaginationRange(9, 18, 2)).toEqual([1, DOTS, 7, 8, 9, 10, 11, DOTS, 18]);
  });
});
