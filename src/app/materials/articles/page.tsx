import { NewsGrid } from '@/modules/News';
import { NewsletterSignup } from '@/modules/NewsletterSignup';
import { fetchNewsList } from '@/shared/api';
import { ARTICLES_HREF, NEWS_CATEGORIES } from '@/shared/config/newsCategories';
import { canonicalUrl } from '@/shared/config/site';
import { Box } from '@/shared/ui/components/Box';
import { PageHeader } from '@/shared/ui/components/PageHeader';
import type { Metadata } from 'next';

export const revalidate = 3600;

const TITLE = 'Статьи для газет и журналов';
const DESCRIPTION =
  'Статьи о вреде алкоголя, табака и других психоактивных веществ — материалы «Общего дела» для газет и журналов.';

/**
 * WP caps `per_page` at 100. The collection is 19 posts after ten years and
 * grows by two or three a year, so it renders whole — matching the legacy page,
 * which was a single hand-written scroll with no pagination. No `?page=`
 * variants means no near-duplicate second addresses for a crawler to work
 * through; revisit only if the category ever approaches 100.
 */
const PER_PAGE = 100;

export const generateMetadata = (): Metadata => {
  const url = canonicalUrl(ARTICLES_HREF);
  return {
    title: `${TITLE} — ОБЩЕЕ ДЕЛО`,
    description: DESCRIPTION,
    alternates: { canonical: url },
    openGraph: { url, title: TITLE, description: DESCRIPTION },
  };
};

/**
 * `/materials/articles/` — a thin alias over the «Статьи» category (578).
 *
 * **Why a route and not a redirect, and not a D8 build either.** The live page
 * is a hand-curated list of 14 links, every one of them a post in category 578
 * that `/[...slug]` already renders; the category holds 19, so this listing is
 * that page's superset and nothing is lost. It is a real route rather than a
 * 301 to `/news/?category=articles` because 114 entry visits in 91 days land
 * here from search — this is the address the collection is known by, so it is
 * the one that answers 200 and self-canonicalises. The index's «Статьи» chip
 * canonicalises *here* (see `newsCategories.ts`), which is what keeps the pair
 * from becoming two addresses for one collection.
 *
 * Its five child pages (`/materials/articles/about-beer/` and friends) are
 * ordinary WP pages under 12 views each and are untouched by this route — they
 * fall through to the catch-all and ride the A6 fallback with the rest of
 * `/materials/`.
 */
const Page = async () => {
  const { items } = await fetchNewsList({ perPage: PER_PAGE, category: NEWS_CATEGORIES.articles });

  const breadcrumbItems = [
    { label: 'Главная', href: '/' },
    { label: 'Материалы', href: '/materials/' },
    { label: 'Статьи' },
  ];

  return (
    <Box display="flex" flexDirection="column" gap={40} py={48}>
      <PageHeader title={TITLE} breadcrumbs={breadcrumbItems} />

      <NewsGrid items={items} emptyMessage="Статей не найдено." />

      <NewsletterSignup />
    </Box>
  );
};

export default Page;
