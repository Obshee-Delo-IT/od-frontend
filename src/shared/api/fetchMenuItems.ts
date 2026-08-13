import { paths } from '@/types/generated/wp-json-openapi';
import { WP_TAGS, wpCache } from './cacheTags';
import { client } from './httpClient';

export const fetchMenuItems = (query: paths['/wp/v2/menu-items']['get']['parameters']['query']) =>
  client.GET('/wp/v2/menu-items', {
    params: {
      query,
    },
    // Same tag as the menu it belongs to: the two are one thing to an editor,
    // and purging the container without its items would rebuild an empty nav.
    ...wpCache([WP_TAGS.menus]),
  });
