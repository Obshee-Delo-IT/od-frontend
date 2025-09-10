import parse from 'html-react-parser';
import { Fragment } from 'react';
import { customFetch } from '@/lib/customFetch';

export const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;

  const fetchNews = () => customFetch(`/wp-json/wp/v2/posts/${id}`);
  const newsResponse = await fetchNews();
  const newsBody = await newsResponse.json();

  return (
    <div>
      <Fragment key={id}>{parse(newsBody.content.rendered)}</Fragment>
    </div>
  );
};
