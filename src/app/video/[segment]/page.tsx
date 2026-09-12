import { notFound } from 'next/navigation';
import { catalogueMetadata, cataloguePage, catalogueTopics, VideoCatalogue } from '@/modules/Video/VideoCatalogue';
import { FILM_CATEGORIES, resolveFilmCategory } from '@/shared/config/filmCategories';
import type { Metadata } from 'next';

export const revalidate = 3600;

interface CategoryPageProps {
  params: Promise<{ segment: string }>;
  searchParams: Promise<{ page?: string | string[]; topic?: string | string[] }>;
}

/** Only the four real categories exist, so prerender all of them. */
export const generateStaticParams = () => Object.keys(FILM_CATEGORIES).map((segment) => ({ segment }));

export const generateMetadata = async ({ params, searchParams }: CategoryPageProps): Promise<Metadata> => {
  const segment = resolveFilmCategory((await params).segment);
  if (!segment) {
    return {};
  }
  const query = await searchParams;
  return catalogueMetadata(segment, cataloguePage(query.page), catalogueTopics(query.topic));
};

/**
 * A catalogue category — `/video/filmy/`, `/video/multy/`, `/video/roliki/`,
 * `/video/famous-people/`.
 *
 * These are live-site URLs and two of them are the #2 and #3 entry pages on the
 * whole site, so they answer 200 here rather than folding into a `?category=`
 * query that a crawler would attribute back to `/video/`.
 */
const Page = async ({ params, searchParams }: CategoryPageProps) => {
  const segment = resolveFilmCategory((await params).segment);
  // Any other segment is a 404, not the unfiltered catalogue: this route
  // outranks the `/[...slug]` catch-all, so without the guard
  // `/video/<anything>/` would answer 200 with a copy of `/video/` — an
  // unbounded family of near-duplicate pages for a crawler to work through.
  if (!segment) {
    notFound();
  }

  const query = await searchParams;
  return <VideoCatalogue segment={segment} page={cataloguePage(query.page)} topics={catalogueTopics(query.topic)} />;
};

export default Page;
