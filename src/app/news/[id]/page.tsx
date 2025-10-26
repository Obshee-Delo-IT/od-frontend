import { Text } from '@radix-ui/themes';
import dayjs from 'dayjs';
import { Metadata } from 'next';
import { SubscribeToNews } from '@/modules/News';
import { ImagePreviewClient } from '@/modules/News/ImagePreview';
import { SimilarNews } from '@/modules/News/SimilarNews';
import { parsePost } from '@/modules/News/utils';
import { cachedFetchNews } from '@/shared/api/fetchNews';
import { Box } from '@/shared/ui/components/Box';
import { Breadcrumbs } from '@/shared/ui/components/Breadcrumbs';
import { GutenbergProvider } from '@/shared/ui/theme';

export const dynamicParams = true;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await cachedFetchNews(id);

  return {
    title: data?.title?.rendered,
    openGraph: {
      type: 'website',
      countryName: 'Russia',
      title: data?.title?.rendered,
      locale: 'ru-RU',
    },
  };
}

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const data = await cachedFetchNews(id);

  const breadcrumbItems = [
    { label: 'Главная', href: '/' },
    { label: 'Новости', href: '/news' },
    { label: data?.title?.rendered ?? '' },
  ];

  const parsed = parsePost(data?.content?.rendered);
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
      <GutenbergProvider>
        <Box
          mb={{
            mobile: 20,
            smallDesktop: 24,
            desktop: 32,
          }}
        >
          <ImagePreviewClient>{parsed.header}</ImagePreviewClient>
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
            mobile: 'column',
          }}
          gap={{
            mobile: 48,
            smallDesktop: 40,
            desktop: 40,
          }}
        >
          <ImagePreviewClient>
            <Box as="section">{parsed.body}</Box>
          </ImagePreviewClient>
          <Box as="aside" position="relative">
            <Box position="sticky" top={8}>
              <SimilarNews />
              <SubscribeToNews variant="small" />
            </Box>
          </Box>
        </Box>
      </GutenbergProvider>
    </Box>
  );
};

export default Page;
