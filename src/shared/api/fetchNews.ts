import { cache } from 'react';
import { customFetch } from '@/lib/customFetch';

export const fetchNews = async (id: string) => {
  const response = await customFetch(`/wp-json/wp/v2/posts/${id}`);
  const data = await response.json();
  return data;
};

export const cachedFetchNews = cache(fetchNews);
