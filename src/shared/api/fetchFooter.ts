import { WP_TAGS, wpCache } from './cacheTags';
import { client } from './httpClient';

export const fetchFooter = () =>
  client.GET('/wp/v2/widgets', {
    params: {
      query: {
        sidebar: 'sidebar_bottom',
      },
    },
    // Root-layout fetch, like the header's — see fetchMenus.
    ...wpCache([WP_TAGS.widgets]),
  });
