import parse from 'html-react-parser';
import { Metadata } from 'next';
import { cachedFetchNews } from '@/shared/api/fetchNews';
import { Box } from '@/ui/components/Box';
import { Breadcrumbs } from '@/ui/components/Breadcrumbs/Breadcrumbs';
import { GutenbergProvider } from '@/ui/theme';
import css from './page.module.css';

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
    { label: data.title.rendered },
  ];

  return (
    <div className={css.container}>
      <Box
        mb={{
          mobile: 24,
          smallDesktop: 24,
          desktop: 20,
        }}
      >
        <Breadcrumbs items={breadcrumbItems} />
      </Box>
      <GutenbergProvider>{parse(data.content.rendered)}</GutenbergProvider>
    </div>
  );
};

export default Page;
