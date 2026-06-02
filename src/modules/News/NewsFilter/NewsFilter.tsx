import clsx from 'clsx';
import NextLink from 'next/link';
import css from './NewsFilter.module.css';

export interface NewsFilterOption {
  label: string;
  /** Category key; `null` means «Все» (no filter). */
  value: string | null;
}

export interface NewsFilterProps {
  options: NewsFilterOption[];
  active: string | null;
  buildHref: (value: string | null) => string;
  className?: string;
}

export const NewsFilter: React.FC<NewsFilterProps> = ({ options, active, buildHref, className }) => (
  <nav className={clsx(css.root, className)} aria-label="Фильтр новостей">
    {options.map((option) => {
      const isActive = option.value === active;

      return (
        <NextLink
          key={option.value ?? 'all'}
          href={buildHref(option.value)}
          className={clsx(css.chip, isActive && css.active)}
          aria-current={isActive ? 'true' : undefined}
        >
          {option.label}
        </NextLink>
      );
    })}
  </nav>
);
