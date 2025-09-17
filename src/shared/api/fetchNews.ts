import { customFetch } from '@/lib/customFetch';

export const fetchNews = (id: string) => customFetch(`/wp-json/wp/v2/posts/${id}`);
