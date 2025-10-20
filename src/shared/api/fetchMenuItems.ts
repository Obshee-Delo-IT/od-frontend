import { paths } from '@/types/generated/wp-json-openapi';
import { client } from './httpClient';

export const fetchMenuItems = (query: paths['/wp/v2/menu-items']['get']['parameters']['query']) =>
  client.GET('/wp/v2/menu-items', {
    params: {
      query,
    },
  });
