import { fetchMenuItems, fetchMenus } from '@/shared/api';
import { HeaderClient } from './HeaderClient';
import { SourceNavItem } from './types';
import { toNavItems } from './utils/toNavItems';

const HeaderServer = async () => {
  const { data: menuIdBody } = await fetchMenus({ slug: 'main-navigation' });
  const menuId = menuIdBody?.[0]?.id;

  const { data } = await fetchMenuItems({ menus: [menuId!] });
  const menuItems = toNavItems(data as SourceNavItem[]);

  return <HeaderClient navItems={menuItems} />;
};

export { HeaderServer };
