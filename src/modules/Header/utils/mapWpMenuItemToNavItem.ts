import { NavItem, SourceNavItem } from '../types';

export function mapWpMenuItemToNavItem(item: SourceNavItem): NavItem {
  return {
    id: item.id,
    parent: item.parent,
    href: item.url,
    text: item.title.rendered,
    content: [],
  };
}
