import { PropsWithChildren } from 'react';
import { GutenbergCarouselAdapter } from './Carousel/CarouselAdapter';
import css from './gutenberg-provider.module.css';

/**
 * Custom component that encapsulates gutenberg styles
 *
 * @see /ui/styles/gutenberg.css
 */
export const GutenbergProvider = ({ children }: PropsWithChildren) => (
  <div className={css.gutenberg}>
    {children}
    <GutenbergCarouselAdapter />
  </div>
);

export const GutenbergExcludeProvider = ({ children }: PropsWithChildren) => (
  <div className="gutenbergExclude">{children}</div>
);
