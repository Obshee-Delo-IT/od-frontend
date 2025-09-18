import parse, { DOMNode, domToReact, Element } from 'html-react-parser';
import { Fragment } from 'react';
import { Footer } from '@/modules/Footer';
import { HeaderClient } from '@/modules/Header/HeaderClient';
import { fetchNews } from '@/shared/api';
import { Carousel } from './modules';
import css from './page.module.css';
import { extractImages } from './utils';

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;

  const newsResponse = await fetchNews(id);
  const newsBody = await newsResponse.json();

  const date = new Date(newsBody.date).toLocaleDateString('ru-RU');

  const images = extractImages(newsBody.content.rendered);

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
      if (domNode instanceof Element && domNode.name === 'figure') {
        return <Carousel images={images} />;
      }
    },
  };

  return (
    <>
      <HeaderClient />
      <div className={css.news}>
        <Fragment key={id}>{parse(newsBody.content.rendered, options)}</Fragment>
      </div>
      <Footer />
    </>
  );
};

export default Page;
