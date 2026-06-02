export const DOTS = '…';

export type PaginationItem = number | typeof DOTS;

const range = (start: number, end: number): number[] =>
  Array.from({ length: Math.max(end - start + 1, 0) }, (_, i) => start + i);

/**
 * Builds a compact page list with ellipses, e.g. `[1, 2, 3, 4, 5, …, 18]` or
 * `[1, …, 7, 8, 9, …, 18]`. `siblings` is how many pages flank the current one.
 */
export const getPaginationRange = (current: number, total: number, siblings = 1): PaginationItem[] => {
  // first + last + current + 2 dots + siblings on each side
  const maxVisible = siblings * 2 + 5;
  if (total <= maxVisible) {
    return range(1, total);
  }

  const leftSibling = Math.max(current - siblings, 1);
  const rightSibling = Math.min(current + siblings, total);
  const showLeftDots = leftSibling > 2;
  const showRightDots = rightSibling < total - 1;
  const edgeCount = 3 + 2 * siblings;

  if (!showLeftDots && showRightDots) {
    return [...range(1, edgeCount), DOTS, total];
  }
  if (showLeftDots && !showRightDots) {
    return [1, DOTS, ...range(total - edgeCount + 1, total)];
  }
  return [1, DOTS, ...range(leftSibling, rightSibling), DOTS, total];
};
