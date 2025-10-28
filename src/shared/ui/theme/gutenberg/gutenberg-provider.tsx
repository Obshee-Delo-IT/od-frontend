import { GutenbergCarouselAdapter } from './Carousel/CarouselAdapter';
import css from './gutenberg-provider.module.css';
import { Box } from '../../components/Box';
import { BoxProps } from '../../components/Box/Box';

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
  <Box className={css.gutenberg} as={as} {...props}>
    {children}
    <GutenbergCarouselAdapter />
  </Box>
);
