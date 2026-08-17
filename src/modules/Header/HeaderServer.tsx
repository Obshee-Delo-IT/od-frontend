import { fetchMenuItems, fetchMenus } from '@/shared/api';
import { wpBaseUrl } from '@/shared/api/httpClient';
import { internalOrigins } from '@/shared/config/site';
import { HeaderClient } from './HeaderClient';
import { SourceNavItem } from './types';
import { toNavItems } from './utils/toNavItems';

const HeaderServer = async () => {
  const { data: menuIdBody } = await fetchMenus({ slug: 'main-navigation' });
  const menuId = menuIdBody?.[0]?.id;

  const { data } = await fetchMenuItems({ menus: [menuId!] });
  // WP hands back absolute URLs against its own origin; anything pointing at
  // WordPress or at us is rewritten to a path so the nav stays on this site.
  const menuItems = toNavItems(data as SourceNavItem[], internalOrigins(wpBaseUrl));

  return <HeaderClient navItems={menuItems} />;
};

export { HeaderServer };
