import { FilterChips } from '@/shared/ui/components/FilterChips';

export interface NewsFilterOption {
  label: string;
  /** Category key; `null` means «Все» (no filter). */
  value: string | null;
}

interface NewsFilterProps {
  options: NewsFilterOption[];
  active: string | null;
  buildHref: (value: string | null) => string;
  className?: string;
}

/**
 * The `/news/` category chips — single-select, so exactly one arrives active.
 *
 * A thin adapter over {@link FilterChips}, which is the same strip `/video/`
 * filters topics with; the two differ only in how many chips can be on at once.
 */
export const NewsFilter: React.FC<NewsFilterProps> = ({ options, active, buildHref, className }) => (
  <FilterChips
    label="Фильтр новостей"
    className={className}
    chips={options.map((option) => ({
      label: option.label,
      href: buildHref(option.value),
      active: option.value === active,
    }))}
  />
);
