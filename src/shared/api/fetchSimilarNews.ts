import { customFetch } from '@/lib/customFetch';

interface fetchSimilarNewsProps {
  category: number;
  region: number;
}

export const fetchSimilarNews = ({ category, region }: fetchSimilarNewsProps) => {
  customFetch(`/wp/v2/posts?categories=${category}&categories=${region}`);
};
