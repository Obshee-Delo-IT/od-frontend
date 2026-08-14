import { isNavLabelHidden } from '@/shared/config/navOverrides';
import { NavItem, SourceNavItem } from '../types';
import { toInternalHref } from './toInternalHref';

/**
 * Top-level entries first, so a child is never read before the parent it has to
 * attach to — WordPress returns menu items in editor order, which interleaves
 * them. A comparator that only separates the two tiers keeps each tier in the
 * order WP sent it, which is the order editors arranged.
 */
const parentsFirst = (items: SourceNavItem[]): SourceNavItem[] =>
  [...items].sort((a, b) => {
    if (a.parent === b.parent) {
      return 0;
    }
    return a.parent === 0 ? -1 : 1;
  });

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
  const map = new Map<number, NavItem>();
  parentsFirst(wpItems).forEach((item) => {
    if (isNavLabelHidden(item.title.rendered)) {
      return;
    }

    const mapped: NavItem = {
      id: item.id,
      parent: item.parent,
      href: toInternalHref(item.url, internalOrigins),
      text: item.title.rendered,
      content: [],
    };
    if (mapped.parent === 0) {
      map.set(mapped.id, mapped);
    } else {
      map.get(mapped.parent)?.content.push(mapped);
    }
  });
  return Array.from(map.values());
};
