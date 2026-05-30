import { cache } from 'react';
import { client } from './httpClient';

// TODO: confirm the films category ID in WP and replace.
// Films are filed under /wp/v2/posts and selected by category.
export const FILMS_CATEGORY_ID = 0;

interface FetchFilmsOptions {
  perPage?: number;
  categoryId?: number;
}

export const fetchFilms = async ({ perPage = 6, categoryId = FILMS_CATEGORY_ID }: FetchFilmsOptions = {}) => {
  if (!categoryId) {
    return [];
  }

  const { data } = await client.GET('/wp/v2/posts', {
    params: {
      query: {
        per_page: perPage,
        categories: [categoryId],
      },
    },
  });

  return data ?? [];
};

export const cachedFetchFilms = cache(fetchFilms);
