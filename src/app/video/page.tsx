import { catalogueMetadata, cataloguePage, VideoCatalogue } from '@/modules/Video/VideoCatalogue';
import type { Metadata } from 'next';

export const revalidate = 3600;

interface VideoPageProps {
  searchParams: Promise<{ page?: string | string[] }>;
}

/**
 * The catalogue at large, «Все». Its categories are real pages under
 * `/video/<segment>/` rather than a filter on this one, so the only parameter
 * here is `?page=`.
 */
export const generateMetadata = async ({ searchParams }: VideoPageProps): Promise<Metadata> =>
  catalogueMetadata(null, cataloguePage((await searchParams).page));

const Page = async ({ searchParams }: VideoPageProps) => (
  <VideoCatalogue segment={null} page={cataloguePage((await searchParams).page)} />
);

export default Page;
