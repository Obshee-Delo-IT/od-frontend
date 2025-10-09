import { PropsWithChildren } from 'react';
import { GutenbergCarouselAdapter } from './Carousel/CarouselAdapter';
import css from './WithGutenberg.module.css';

/**
 * Custom component that encapsulates gutenberg styles
 *
 * @see /ui/styles/gutenberg.css
 */
export const WithGutenberg = ({ children }: PropsWithChildren) => (
  <div className={css.gutenberg}>
    {children}
    <GutenbergCarouselAdapter />
  </div>
);
