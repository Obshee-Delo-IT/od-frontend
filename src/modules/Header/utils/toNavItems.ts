import { stripHtml } from '@/shared/api/newsPreview';
import { toInternalHref } from '@/shared/lib/wpContent/toInternalHref';
import { NavItem, SourceNavItem } from '../types';

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
 * The menu is taken as WordPress sends it. Entries this site shouldn't surface
 * are deleted in WordPress instead of filtered here — «Заказать материалы» and
 * «ОБЩЕЕДЕЛО-ПРО» were, on 2026-08-15, which retired the label filter that used
 * to live in `shared/config/navOverrides.ts`. See `docs/next-steps.md`.
 */
export const toNavItems = (wpItems: SourceNavItem[] = [], internalOrigins: string[] = []): NavItem[] => {
  const map = new Map<number, NavItem>();
  parentsFirst(wpItems).forEach((item) => {
    const mapped: NavItem = {
      id: item.id,
      parent: item.parent,
      href: toInternalHref(item.url, internalOrigins),
      text: stripHtml(item.title.rendered),
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
