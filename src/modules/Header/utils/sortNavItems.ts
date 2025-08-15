import { SourceNavItem } from '../types';

export function sortNavItems(items: SourceNavItem[]) {
  return items.sort((a, b) => {
    if (a.parent === b.parent) {
      return 0;
    }
    return a.parent === 0 ? -1 : 1;
  });
}
