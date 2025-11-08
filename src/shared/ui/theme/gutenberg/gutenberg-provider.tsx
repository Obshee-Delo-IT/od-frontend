import { GutenbergCarouselAdapter } from './Carousel/CarouselAdapter';
import { Box } from '../../components/Box';
import { BoxProps } from '../../components/Box/Box';

import './gutenberg-provider.css';

type GutenbergProviderProps<T extends keyof HTMLElementTagNameMap = 'div'> = Omit<BoxProps<T>, 'className'>;

/**
 * Custom component that encapsulates gutenberg styles
 *
 * @see /ui/styles/gutenberg.css
 */
export const GutenbergProvider = <T extends keyof HTMLElementTagNameMap = 'div'>({
  children,
  as,
  ...props
}: GutenbergProviderProps<T>) => (
  <Box className="gutenberg" as={as} {...props}>
    {children}
    <GutenbergCarouselAdapter />
  </Box>
);
