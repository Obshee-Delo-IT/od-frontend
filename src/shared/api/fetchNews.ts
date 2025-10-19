import { cache } from 'react';
import { client } from './httpClient';

export const fetchNews = async (id: string) => {
  const { data } = await client.GET(`/wp/v2/posts/{id}`, {
    params: {
      path: {
        id,
      },
    },
  });

  return data;
};

export const cachedFetchNews = cache(fetchNews);
