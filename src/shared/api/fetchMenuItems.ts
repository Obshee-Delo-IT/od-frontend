import { customFetch } from '@/lib/customFetch';

interface FetchMenuItemsProps {
  menuId: number;
}

export const fetchMenuItems = ({ menuId }: FetchMenuItemsProps) =>
  customFetch(`/wp-json/wp/v2/menu-items/?menus=${menuId}`);
