import { NavItem, SourceNavItem } from '../types';
import { toInternalHref } from './toInternalHref';

export function mapWpMenuItemToNavItem(item: SourceNavItem, internalOrigins: string[] = []): NavItem {
  return {
    id: item.id,
    parent: item.parent,
    href: toInternalHref(item.url, internalOrigins),
    text: item.title.rendered,
    content: [],
  };
}
