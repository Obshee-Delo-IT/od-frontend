import { NewsFilter, NewsGrid, type NewsFilterOption } from '@/modules/News';
import { NewsletterSignup } from '@/modules/NewsletterSignup';
import { fetchNewsList } from '@/shared/api';
import { ARTICLES_HREF, NEWS_CATEGORIES, resolveNewsCategory } from '@/shared/config/newsCategories';
import { canonicalUrl } from '@/shared/config/site';
import { Box } from '@/shared/ui/components/Box';
import { PageHeader } from '@/shared/ui/components/PageHeader';
import { Pagination } from '@/shared/ui/components/Pagination';
import type { Metadata } from 'next';

export const revalidate = 3600;

const PER_PAGE = 15;

// «Наши дела» has no dedicated WP category, so it maps to the main «Новости»
// category (47); «Статьи» is the articles category (578); «Все» is unfiltered.
// The ids live in `newsCategories.ts` — see the note there on why nothing may
// point at them directly.
const FILTER_OPTIONS: NewsFilterOption[] = [
  { label: 'Все', value: null },
  { label: 'Наши дела', value: 'nashi-dela' },
  { label: 'Статьи', value: 'articles' },
];

const DESCRIPTION = 'Новости и статьи общероссийской общественной организации «Общее дело»';

interface NewsPageProps {
  searchParams: Promise<{ category?: string | string[]; page?: string | string[] }>;
}

const firstParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const buildHref = ({ category, page }: { category: string | null; page: number }): string => {
  const query = new URLSearchParams();
  if (category) {
    query.set('category', category);
  }
  if (page > 1) {
    query.set('page', String(page));
  }
  const qs = query.toString();
  return qs ? `/news?${qs}` : '/news';
};

/**
 * The *effective* filter and page — an unknown category or a junk page number
 * falls back to the unfiltered first page. Shared with `generateMetadata` so
 * the canonical always describes what was actually rendered: `?category=47`
 * (where the legacy redirects still point) canonicalises to plain `/news/`
 * rather than advertising a filter that isn't applied.
 */
const resolveParams = ({ category, page }: Awaited<NewsPageProps['searchParams']>) => {
  const pageParam = Number(firstParam(page));
  return {
    activeCategory: resolveNewsCategory(firstParam(category)),
    currentPage: Number.isFinite(pageParam) && pageParam > 1 ? Math.floor(pageParam) : 1,
  };
};

/**
 * Every filtered and paginated variant self-canonicalises. Collapsing them onto
 * `/news/` instead would drop pages 2+ out of the index entirely, and they are
 * the only path to older posts for a crawler that doesn't read the sitemap.
 *
 * The one exception is the unpaginated «Статьи» view, which points at
 * `/materials/articles/`: that route lists the same category in full, and it is
 * the address search engines already hold. Page 2+ still self-canonicalises —
 * it is a different slice of posts, not a duplicate of the alias.
 */
export const generateMetadata = async ({ searchParams }: NewsPageProps): Promise<Metadata> => {
  const { activeCategory, currentPage } = resolveParams(await searchParams);
  const isArticlesIndex = activeCategory === 'articles' && currentPage === 1;
  const url = canonicalUrl(
    isArticlesIndex ? ARTICLES_HREF : buildHref({ category: activeCategory, page: currentPage })
  );

  const label = FILTER_OPTIONS.find((option) => option.value === activeCategory)?.label;
  const scope = activeCategory && label ? `Новости: ${label}` : 'Новости';
  const title = `${scope}${currentPage > 1 ? `, страница ${currentPage}` : ''} — ОБЩЕЕ ДЕЛО`;

  return {
    title,
    description: DESCRIPTION,
    alternates: { canonical: url },
    openGraph: { url, title, description: DESCRIPTION },
  };
};

const Page = async ({ searchParams }: NewsPageProps) => {
  const { activeCategory, currentPage } = resolveParams(await searchParams);

  const { items, totalPages } = await fetchNewsList({
    page: currentPage,
    perPage: PER_PAGE,
    category: activeCategory ? NEWS_CATEGORIES[activeCategory] : undefined,
  });

  const breadcrumbItems = [{ label: 'Главная', href: '/' }, { label: 'Новости' }];

  return (
    <Box display="flex" flexDirection="column" gap={40} py={48}>
      <PageHeader title="Новости" breadcrumbs={breadcrumbItems} />

      <NewsFilter
        options={FILTER_OPTIONS}
        active={activeCategory}
        buildHref={(value) => buildHref({ category: value, page: 1 })}
      />

      <NewsGrid items={items} />

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        buildHref={(page) => buildHref({ category: activeCategory, page })}
      />

      <NewsletterSignup variant="card" />
    </Box>
  );
};

export default Page;
