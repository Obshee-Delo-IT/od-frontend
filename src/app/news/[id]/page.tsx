import parse, { DOMNode, domToReact, Element } from 'html-react-parser';
import { Metadata } from 'next';
import { Fragment } from 'react';
import { cachedFetchNews } from '@/shared/api/fetchNews';
import { WithGutenberg } from '@/ui/components/WithGutenberg';
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
  // console.log(data);
  // console.log(JSON.stringify(data));
  const date = new Date(data.date).toLocaleDateString('ru-RU');

  // const images = extractImages(data?.content?.rendered);

  const options = {
    replace: (domNode: DOMNode) => {
      if (domNode instanceof Element && domNode.name === 'h2') {
        return (
          <>
            <p className={css.date}>{date}</p>
            <h2 {...domNode.attribs}>{domToReact(domNode.children as DOMNode[], options)}</h2>
          </>
        );
      }
      // if (domNode instanceof Element && domNode.name === 'figure') {
      //   return (
      //     <>
      //       <div className={css.carousel}>
      //         <Carousel images={images} />
      //       </div>
      //     </>
      //   );
      // }
    },
  };

  return (
    <div className={css.news}>
      <WithGutenberg key={id}>{parse(data.content.rendered, options)}</WithGutenberg>
    </div>
  );
};

export default Page;
