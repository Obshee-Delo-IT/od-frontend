import { client } from './httpClient';

interface fetchSimilarNewsProps {
  category: number;
  region: number;
}

export const fetchSimilarNews = async ({ category, region }: fetchSimilarNewsProps) =>
  client.GET('/wp/v2/posts', {
    params: {
      query: { categories: [category, region] },
    },
  });
