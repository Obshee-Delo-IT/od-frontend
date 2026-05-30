import { cache } from 'react';
import { client } from './httpClient';

interface FetchLatestNewsOptions {
  perPage?: number;
}

export const fetchLatestNews = async ({ perPage = 5 }: FetchLatestNewsOptions = {}) => {
  const { data } = await client.GET('/wp/v2/posts', {
    params: {
      query: {
        per_page: perPage,
      },
    },
  });

  return data ?? [];
};

export const cachedFetchLatestNews = cache(fetchLatestNews);
