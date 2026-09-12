import { catalogueMetadata, cataloguePage, catalogueTopics, VideoCatalogue } from '@/modules/Video/VideoCatalogue';
import type { Metadata } from 'next';

export const revalidate = 3600;

interface VideoPageProps {
  searchParams: Promise<{ page?: string | string[]; topic?: string | string[] }>;
}

/**
 * The catalogue at large, «Все». Its categories are real pages under
 * `/video/<segment>/` rather than a filter on this one, so the only parameters
 * here are `?page=` and `?topic=` — the subject filter, which *is* a query
 * parameter because a topic selection is not a page anybody links to.
 */
export const generateMetadata = async ({ searchParams }: VideoPageProps): Promise<Metadata> => {
  const query = await searchParams;
  return catalogueMetadata(null, cataloguePage(query.page), catalogueTopics(query.topic));
};

const Page = async ({ searchParams }: VideoPageProps) => {
  const query = await searchParams;
  return <VideoCatalogue segment={null} page={cataloguePage(query.page)} topics={catalogueTopics(query.topic)} />;
};

export default Page;
