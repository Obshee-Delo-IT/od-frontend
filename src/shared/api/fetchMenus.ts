import { paths } from '@/types/generated/wp-json-openapi';
import { client } from './httpClient';

export const fetchMenus = (query: paths['/wp/v2/menus']['get']['parameters']['query']) =>
  client.GET('/wp/v2/menus', {
    params: {
      query,
    },
  });
