import { Container } from '@radix-ui/themes';
import parse from 'html-react-parser';
import { Fragment } from 'react';
import { fetchFooter } from '@/shared/api';
import css from './Footer.module.css';

export const Footer = async () => {
  const { data } = await fetchFooter();

  return (
    <footer className={css.footer} id="footer">
      <Container size="4" className={css.container}>
        <div className={css.footerWrap}>
          {data?.map((block) => (
            <Fragment key={block.id}>{!!block.rendered && parse(block.rendered)}</Fragment>
          ))}
        </div>
      </Container>
    </footer>
  );
};
