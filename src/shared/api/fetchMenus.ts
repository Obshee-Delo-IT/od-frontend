import { paths } from '@/types/generated/wp-json-openapi';
import { WP_TAGS, wpCache } from './cacheTags';
import { client } from './httpClient';

export const fetchMenus = (query: paths['/wp/v2/menus']['get']['parameters']['query']) =>
  client.GET('/wp/v2/menus', {
    params: {
      query,
    },
    // The header renders in the root layout, so this runs on every dynamic
    // request. Cached, the nav costs WP one request an hour instead of one
    // per page view; tagged, an editor's menu change doesn't wait that hour out.
    ...wpCache([WP_TAGS.menus]),
  });
