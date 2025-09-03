import { customFetch } from '@/lib/customFetch';

export const fetchFooter = () => customFetch(`/wp-json/wp/v2/widgets?sidebar=sidebar_bottom`);
