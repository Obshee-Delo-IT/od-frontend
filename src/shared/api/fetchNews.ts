import { cache } from 'react';
import { postTag, WP_TAGS, wpCache } from './cacheTags';
import { client } from './httpClient';

export const fetchNews = async (id: string) => {
  const { data } = await client.GET(`/wp/v2/posts/{id}`, {
    params: {
      path: {
        id,
      },
    },
    ...wpCache([WP_TAGS.posts, postTag(id)]),
  });

  return data;
};

export const cachedFetchNews = cache(fetchNews);
