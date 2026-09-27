import { WP_TAGS, wpCache } from './cacheTags';
import { client } from './httpClient';

interface fetchSimilarNewsProps {
  category: number;
  region: number;
  /** The post being read — WordPress lists it among its own neighbours (JRN-07). */
  exclude?: number;
}

/**
 * `_fields` keeps only what the rail renders. Without it every article cached
 * ten full posts (~265 KB) under its own key — `exclude` makes the key unique
 * per article — and this one query was ~45 % of the prod fetch-cache, which
 * filled the VPS disk (servers-agent 2026-09-25-od-vps-disk-full-next-rce).
 * With it the response is ~5 KB. `_fields` is not in the generated schema,
 * hence the spread.
 */
const SIMILAR_FIELDS = { _fields: 'id,date,title' };

export const fetchSimilarNews = async ({ category, region, exclude }: fetchSimilarNewsProps) =>
  client.GET('/wp/v2/posts', {
    params: {
      query: {
        categories: [category, region],
        ...(exclude === undefined ? {} : { exclude: [exclude] }),
        ...SIMILAR_FIELDS,
      },
    },
    ...wpCache([WP_TAGS.posts]),
  });
