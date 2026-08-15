import { Heading } from '@radix-ui/themes';
import { IllustratedCard } from '@/shared/ui/components/IllustratedCard';
import css from './ProjectsSection.module.css';

export interface ProjectCardData {
  id: string | number;
  title: string;
  href: string;
  Illustration: React.FC<React.SVGProps<SVGElement>>;
}

interface ProjectsSectionProps {
  cards: ProjectCardData[];
  /** Names the section for assistive tech, and is the visible heading unless suppressed. */
  title: string;
  /**
   * Figma `projects` (`706:1775`) shows a heading only above «Проекты» — the
   * programmes above it are named by the page's own H1, so their section
   * carries the title as a label and draws nothing.
   */
  showHeading?: boolean;
}

/**
 * Splits a section into the two row shapes the mock draws: three portrait cards,
 * or two wide ones. Whatever doesn't divide by three is spent on wide rows
 * first, and they lead — so five cards read 2 + 3 exactly as Figma draws
 * «Проекты», four read 2 + 2, six read 3 + 3, and no row is ever left short.
 *
 * Exported for its own test: the arithmetic is the whole feature, and the config
 * it runs on changes whenever a card is hidden or restored.
 */
export const toCardRows = (cards: ProjectCardData[]): ProjectCardData[][] => {
  // A remainder of 1 needs two wide rows (4 = 2 + 2), a remainder of 2 needs one.
  const wideRows = (3 - (cards.length % 3)) % 3;
  const rows: ProjectCardData[][] = [];
  let taken = 0;

  while (taken < cards.length) {
    const size = rows.length < wideRows ? 2 : 3;
    rows.push(cards.slice(taken, taken + size));
    taken += size;
  }

  return rows;
};

/**
 * The static card rows of `/projects/`. The home page uses the same cards in a
 * carousel instead, because there they sit below the fold among six other
 * sections.
 */
export const ProjectsSection: React.FC<ProjectsSectionProps> = ({ cards, title, showHeading = true }) => (
  <section className={css.section} aria-label={title}>
    {showHeading && (
      <Heading as="h2" className={css.heading}>
        {title}
      </Heading>
    )}

    <div className={css.rows}>
      {toCardRows(cards).map((row) => (
        <div key={row[0].id} className={row.length > 2 ? css.grid : css.wideGrid}>
          {row.map((card) => (
            <IllustratedCard
              key={card.id}
              title={card.title}
              href={card.href}
              Illustration={card.Illustration}
              wide={row.length <= 2}
            />
          ))}
        </div>
      ))}
    </div>
  </section>
);
