import { customFetch } from '@/lib/customFetch';

interface fetchSimilarNewsProps {
  category: number;
  region: number;
}

export const fetchSimilarNews = async ({ category, region }: fetchSimilarNewsProps) =>
  (await customFetch(`/wp-json/wp/v2/posts?categories=${category}&categories=${region}`)).json();
