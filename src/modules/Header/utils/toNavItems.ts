import { NavItem, SourceNavItem } from '../types';
import { mapWpMenuItemToNavItem } from './mapWpMenuItemToNavItem';
import { sortNavItems } from './sortNavItems';

export const toNavItems = (wpItems: SourceNavItem[] = []): NavItem[] => {
  const map = new Map();
  sortNavItems(wpItems).forEach((item) => {
    const mappedItem = mapWpMenuItemToNavItem(item);
    if (mappedItem.parent === 0) {
      map.set(mappedItem.id, mappedItem);
    } else {
      map.get(mappedItem.parent)?.content.push(mappedItem);
    }
  });
  return Array.from(map.values());
};
