import { fetchMenus } from '@/lib';
import { fetchMenuItems } from '@/lib/fetchMenuItems';
import { HeaderClient } from './HeaderClient';
import { toNavItems } from './utils/toNavItems';

const HeaderServer = async () => {
  const menuIdResponse = await fetchMenus({ slug: 'main-navigation' });
  const menuIdBody = await menuIdResponse.json();
  const menuId = menuIdBody[0].id;

  const menuItemsResponse = await fetchMenuItems({ menuId: menuId });
  const menuItemsBody = await menuItemsResponse.json();
  const menuItems = toNavItems(menuItemsBody);

  return <HeaderClient navItems={menuItems} />;
};

export { HeaderServer };
