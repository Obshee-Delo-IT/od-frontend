import { WP_TAGS, wpCache } from './cacheTags';
import { client } from './httpClient';

interface fetchSimilarNewsProps {
  category: number;
  region: number;
  /** The post being read — WordPress lists it among its own neighbours (JRN-07). */
  exclude?: number;
}

export const fetchSimilarNews = async ({ category, region, exclude }: fetchSimilarNewsProps) =>
  client.GET('/wp/v2/posts', {
    params: {
      query: { categories: [category, region], ...(exclude === undefined ? {} : { exclude: [exclude] }) },
    },
    ...wpCache([WP_TAGS.posts]),
  });
