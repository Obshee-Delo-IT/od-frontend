import { customFetch } from '@/lib/customFetch';

interface fetchMenusProps {
  slug: string;
}

export const fetchMenus = ({ slug }: fetchMenusProps) => customFetch(`/wp-json/wp/v2/menus?slug=${slug}`);
