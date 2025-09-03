import { Container } from '@radix-ui/themes';
import parse from 'html-react-parser';
import { Fragment } from 'react';
import { fetchFooter } from '@/shared/api';
import css from './Footer.module.css';

type FooterBlock = {
  id: string;
  rendered: string;
};

export const Footer = async () => {
  const footerResponse = await fetchFooter();
  const footerBody = await footerResponse.json();

  return (
    <div className={css.footer} id="footer">
      <Container size="4" className={css.container}>
        <div className={css.footerWrap}>
          {footerBody.map((block: FooterBlock) => (
            <Fragment key={block.id}>{parse(block.rendered)}</Fragment>
          ))}
        </div>
      </Container>
    </div>
  );
};
