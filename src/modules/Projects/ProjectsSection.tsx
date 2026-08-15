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
 * A static grid of `IllustratedCard`s, three to a row. `/projects/` renders two
 * of them; the home page uses the same cards in a carousel instead, because
 * there they sit below the fold among six other sections.
 */
export const ProjectsSection: React.FC<ProjectsSectionProps> = ({ cards, title, showHeading = true }) => (
  <section className={css.section} aria-label={title}>
    {showHeading && (
      <Heading as="h2" className={css.heading}>
        {title}
      </Heading>
    )}

    <div className={css.grid}>
      {cards.map((card) => (
        <IllustratedCard key={card.id} title={card.title} href={card.href} Illustration={card.Illustration} />
      ))}
    </div>
  </section>
);
