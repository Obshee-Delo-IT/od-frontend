import { resolveNavOverride } from '@/shared/config/navOverrides';
import { NavItem, SourceNavItem } from '../types';
import { toInternalHref } from './toInternalHref';

export function mapWpMenuItemToNavItem(item: SourceNavItem, internalOrigins: string[] = []): NavItem {
  // A corrected destination still goes through `toInternalHref`, so an override
  // may point back at this site without hard-coding the origin.
  const href = resolveNavOverride(item.url)?.href ?? item.url;

  return {
    id: item.id,
    parent: item.parent,
    href: toInternalHref(href, internalOrigins),
    text: item.title.rendered,
    content: [],
  };
}
