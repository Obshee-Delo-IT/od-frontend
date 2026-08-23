import { fetchMenuItems, fetchMenus } from '@/shared/api';
import { wpBaseUrl } from '@/shared/api/httpClient';
import { internalOrigins } from '@/shared/config/site';
import { HeaderClient } from './HeaderClient';
import { SourceNavItem } from './types';
import { toNavItems } from './utils/toNavItems';

const HeaderServer = async () => {
  const { data: menuIdBody } = await fetchMenus({ slug: 'main-navigation' });
  const menuId = menuIdBody?.[0]?.id;

  // Fail closed, not open: openapi-fetch drops an array whose every entry is
  // undefined, so `menus: [undefined]` went out as an unfiltered
  // /wp/v2/menu-items and the header rendered *every* menu's top-level items —
  // a WordPress with no `main-navigation` produced a nav of foreign links
  // rather than none (DATA-02).
  const { data } = menuId === undefined ? { data: [] } : await fetchMenuItems({ menus: [menuId] });
  // WP hands back absolute URLs against its own origin; anything pointing at
  // WordPress or at us is rewritten to a path so the nav stays on this site.
  const menuItems = toNavItems(data as SourceNavItem[], internalOrigins(wpBaseUrl));

  return <HeaderClient navItems={menuItems} />;
};

export { HeaderServer };
