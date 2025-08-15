import { customFetch } from './customFetch';

interface FetchMenuItemsProps {
  menuId: number;
}

export const fetchMenuItems = ({ menuId }: FetchMenuItemsProps) =>
  customFetch({ addUrl: `/wp-json/wp/v2/menu-items/?menus=${menuId}` });
