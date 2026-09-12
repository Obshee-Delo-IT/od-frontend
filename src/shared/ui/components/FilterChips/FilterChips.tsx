import clsx from 'clsx';
import NextLink from 'next/link';
import css from './FilterChips.module.css';

export interface FilterChip {
  label: string;
  /** Precomputed destination — the listing as this chip would leave it. */
  href: string;
  active?: boolean;
}

interface FilterChipsProps {
  chips: FilterChip[];
  /** Names the strip for a screen reader; it renders as a `<nav>`. */
  label: string;
  className?: string;
}

/**
 * A row of filter chips, each a link to the listing it would produce.
 *
 * **Links, not buttons, and no state of its own.** Every chip already knows the
 * URL it leads to, so the whole filter is server-rendered markup: it works with
 * JavaScript off, the back button walks the selections, and a selection can be
 * shared as a link. That holds for a multi-select strip too — see
 * {@link toggleFilmTopic}, which turns «this chip, toggled» into the next href.
 *
 * Shared by `/news/`'s single-select categories and `/video/`'s multi-select
 * topics; the difference is entirely in which chips arrive flagged `active`.
 */
export const FilterChips: React.FC<FilterChipsProps> = ({ chips, label, className }) => (
  <nav className={clsx(css.root, className)} aria-label={label}>
    {chips.map((chip) => (
      <NextLink
        key={chip.label}
        href={chip.href}
        className={clsx(css.chip, chip.active && css.active)}
        aria-current={chip.active ? 'true' : undefined}
      >
        {chip.label}
      </NextLink>
    ))}
  </nav>
);
