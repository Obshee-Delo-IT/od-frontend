import { isNavLabelHidden } from '@/shared/config/navOverrides';
import { NavItem, SourceNavItem } from '../types';
import { mapWpMenuItemToNavItem } from './mapWpMenuItemToNavItem';
import { sortNavItems } from './sortNavItems';

/**
 * `internalOrigins` are the hosts whose absolute URLs belong to this site — the
 * WordPress origin and our own — so their menu links come out site-relative
 * instead of sending visitors to the CMS. See {@link toInternalHref}.
 *
 * Entries WordPress carries but this site doesn't surface are dropped here per
 * {@link isNavLabelHidden}. A hidden top-level item takes its children with it:
 * they land in the same orphan branch as a child whose parent was never in the
 * input, so nothing leaks into the nav without its heading.
 */
export const toNavItems = (wpItems: SourceNavItem[] = [], internalOrigins: string[] = []): NavItem[] => {
  const map = new Map();
  sortNavItems(wpItems).forEach((item) => {
    if (isNavLabelHidden(item.title.rendered)) {
      return;
    }

    const mappedItem = mapWpMenuItemToNavItem(item, internalOrigins);
    if (mappedItem.parent === 0) {
      map.set(mappedItem.id, mappedItem);
    } else {
      map.get(mappedItem.parent)?.content.push(mappedItem);
    }
  });
  return Array.from(map.values());
};
