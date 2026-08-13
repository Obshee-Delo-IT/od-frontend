import { Text } from '@radix-ui/themes';
import dayjs from 'dayjs';
import { cachedFetchNews } from '@/shared/api/fetchNews';
import { Box } from '@/shared/ui/components/Box';
import { Breadcrumbs } from '@/shared/ui/components/Breadcrumbs';
import { GutenbergProvider } from '@/shared/ui/theme';
import { ImagePreviewClient } from '../ImagePreview';
import { SimilarNews } from '../SimilarNews';
import css from './NewsArticle.module.css';
import { SubscribeToNews } from '../SubscribeToNews/SubscribeToNews';
import { parsePost, resolveContentImages } from '../utils';
import type { Metadata } from 'next';

export interface NewsArticleProps {
  /** WP post id, from the legacy `/<id>` URL. */
  id: string;
}

export const newsMetadata = (post: Awaited<ReturnType<typeof cachedFetchNews>>): Metadata => ({
  title: post?.title?.rendered,
  openGraph: {
    type: 'website',
    countryName: 'Russia',
    title: post?.title?.rendered,
    locale: 'ru-RU',
  },
});

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
    { label: data?.title?.rendered ?? '' },
  ];

  const parsed = parsePost(await resolveContentImages(data?.content?.rendered));
  const date = dayjs(data?.date).format('DD.MM.YYYY');

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
            <SubscribeToNews variant="small" />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
