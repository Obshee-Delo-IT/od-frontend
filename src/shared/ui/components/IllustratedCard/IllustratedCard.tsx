import { Link } from '@/shared/ui/components/Link';
import css from './IllustratedCard.module.css';

export interface IllustratedCardProps {
  title: string;
  href: string;
  /** The card's drawing, imported as a component by `@svgr/webpack`. */
  Illustration: React.FC<React.SVGProps<SVGElement>>;
  /**
   * Figma `Frame 33845` — the 598×280 landscape card that fills a row of two,
   * drawing beside the text instead of above it. `/materials/` picks it per
   * row; see `toCardRows`.
   */
  wide?: boolean;
  /**
   * `h3` under a section heading, `h2` where the section draws none — see
   * `CardSection`. Only the level differs; the styling is the card's own.
   */
  headingAs?: 'h2' | 'h3';
}

/**
 * Figma `Frame 33823/24/25` — white 12px-radius card, 25px padding, a 200-tall
 * illustration box, then the title and a «Подробнее» link. The whole card is
 * clickable: the link's `::after` is stretched over it.
 *
 * Shared because the same card appears in three shapes — the home page's
 * `Directions` carousel, `/materials/`'s rows, and the `wide` variant those
 * rows of two use.
 */
export const IllustratedCard: React.FC<IllustratedCardProps> = ({
  title,
  href,
  Illustration,
  wide = false,
  headingAs: Title = 'h3',
}) => (
  <article className={wide ? `${css.card} ${css.wide}` : css.card}>
    <div className={css.illustration}>
      <Illustration aria-hidden="true" />
    </div>
    <div className={css.body}>
      <Title className={css.title}>{title}</Title>
      <Link href={href} color="red" underline="always" size="3" aria-label={`${title} — подробнее`}>
        Подробнее
      </Link>
    </div>
  </article>
);
