import { Link } from '@/shared/ui/components/Link';
import css from './IllustratedCard.module.css';

interface IllustratedCardProps {
  title: string;
  href: string;
  /** The card's drawing, imported as a component by `@svgr/webpack`. */
  Illustration: React.FC<React.SVGProps<SVGElement>>;
}

/**
 * Figma `Frame 33823/24/25` — white 12px-radius card, 25px padding, a 200-tall
 * illustration box, then the title and a «Подробнее» link. The whole card is
 * clickable: the link's `::after` is stretched over it.
 *
 * One caller left: the home page's `Directions` carousel. The two surfaces that
 * drew the same card as static rows — `/projects/` and `/materials/` — are
 * WordPress pages since D6g, where the card is a `core/column` classed
 * `od-tile` and `gutenberg.css` styles it. The `wide` variant (598×280, drawing
 * beside the text) and the `headingAs` switch went with them; `.od-tiles--wide`
 * is where that shape lives now.
 */
export const IllustratedCard: React.FC<IllustratedCardProps> = ({ title, href, Illustration }) => (
  <article className={css.card}>
    <div className={css.illustration}>
      <Illustration aria-hidden="true" />
    </div>
    <div className={css.body}>
      <h3 className={css.title}>{title}</h3>
      {/* `underline="hover"`, and the hover is the whole card's: the link's
          `::after` is stretched over it, so the anchor is in `:hover` wherever
          in the card the pointer is. Figma draws it plain. */}
      <Link href={href} color="red" underline="hover" size="3" aria-label={`${title} — подробнее`}>
        Подробнее
      </Link>
    </div>
  </article>
);
