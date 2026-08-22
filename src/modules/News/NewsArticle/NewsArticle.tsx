import { Text } from '@radix-ui/themes';
import { NewsletterSignup } from '@/modules/NewsletterSignup';
import { extractFirstImage } from '@/shared/api/extractFirstImage';
import { cachedFetchNews } from '@/shared/api/fetchNews';
import { wpBaseUrl } from '@/shared/api/httpClient';
import { toFullSizeImageUrl } from '@/shared/api/imageUrl';
import { buildNewsPreview, stripHtml } from '@/shared/api/newsPreview';
import { canonicalUrl, OG_DEFAULT_IMAGE } from '@/shared/config/site';
import { formatDate } from '@/shared/lib/formatDate';
import { parsePost, resolveContentHtml } from '@/shared/lib/wpContent';
import { Box } from '@/shared/ui/components/Box';
import { Breadcrumbs } from '@/shared/ui/components/Breadcrumbs';
import { ImagePreviewClient } from '@/shared/ui/components/ImagePreview';
import { GutenbergProvider } from '@/shared/ui/theme';
import { SimilarNews } from '../SimilarNews';
import css from './NewsArticle.module.css';
import type { Metadata } from 'next';

export interface NewsArticleProps {
  /** WP post id, from the legacy `/<id>` URL. */
  id: string;
}

/**
 * `id` is passed in rather than read off the post because the canonical URL is
 * the legacy `/<id>/` this route was reached by — the same address the sitemap
 * publishes and `/news/<id>` redirects to.
 */
export const newsMetadata = (post: Awaited<ReturnType<typeof cachedFetchNews>>, id: string): Metadata => {
  const title = stripHtml(post?.title?.rendered) || undefined;
  // Same source as the film page: WP's excerpt, stripped of markup, falling
  // back to the body for the many posts that have no manual excerpt.
  const description = buildNewsPreview(post?.excerpt?.rendered, post?.content?.rendered) ?? undefined;
  const url = canonicalUrl(`/${id}/`);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      countryName: 'Russia',
      // Open Graph wants the underscore form; `ru-RU` is silently ignored.
      locale: 'ru_RU',
      title,
      description,
      // WP omits the zone designator on its GMT timestamps.
      publishedTime: post?.date_gmt ? `${post.date_gmt}Z` : undefined,
      modifiedTime: post?.modified_gmt ? `${post.modified_gmt}Z` : undefined,
      /* The body's first image rather than `featured_media`: that is an id, and
         resolving it costs a second request on a route that has to stay
         statically generatable — while `content.rendered` is already here, and
         on this site's posts the lead photo is the first thing in it. Full-size,
         because the `-WxH` variants 500 on the media CDN. */
      images: [toFullSizeImageUrl(extractFirstImage(post?.content?.rendered, wpBaseUrl)) ?? OG_DEFAULT_IMAGE],
    },
  };
};

/**
 * The news/article detail page. Lives in the module rather than in `app/`
 * because the canonical URL is the legacy `/<id>` (see A8 in the implementation
 * plan), and that route is a catch-all dispatcher shared with films.
 */
export const NewsArticle = async ({ id }: NewsArticleProps) => {
  const data = await cachedFetchNews(id);

  const [category, region] = data?.categories ?? [];

  const breadcrumbItems = [
    { label: 'Главная', href: '/' },
    { label: 'Новости', href: '/news' },
    { label: stripHtml(data?.title?.rendered) },
  ];

  const parsed = parsePost(await resolveContentHtml(data?.content?.rendered, true));
  const date = formatDate(data?.date);

  return (
    <Box
      pt={{
        mobile: 8,
        smallDesktop: 8,
        desktop: 20,
      }}
      pb={{
        mobile: 32,
        smallDesktop: 32,
        desktop: 64,
      }}
    >
      <Box
        mb={{
          mobile: 24,
          smallDesktop: 24,
          desktop: 20,
        }}
      >
        <Breadcrumbs items={breadcrumbItems} />
      </Box>
      <Box
        mb={{
          mobile: 20,
          smallDesktop: 24,
          desktop: 32,
        }}
      >
        <ImagePreviewClient>
          <GutenbergProvider>{parsed.header}</GutenbergProvider>
        </ImagePreviewClient>
      </Box>
      <Box
        mb={{
          mobile: 40,
          smallDesktop: 32,
          desktop: 32,
        }}
      >
        <Text size="3" color="gray">
          {date}
        </Text>
      </Box>

      <Box
        display="flex"
        flexDirection={{
          smallDesktop: 'column',
        }}
        gap={{
          mobile: 48,
          smallDesktop: 40,
          desktop: 40,
        }}
      >
        <ImagePreviewClient>
          <GutenbergProvider as="section">{parsed.body}</GutenbergProvider>
        </ImagePreviewClient>
        <Box as="aside" position="relative" className={css.aside}>
          <Box display="flex" flexDirection="column" position="sticky" top={32} gap={20}>
            <SimilarNews category={category} region={region} />
            <NewsletterSignup variant="narrow" title="Подписаться" />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
