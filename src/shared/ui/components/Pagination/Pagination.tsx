import clsx from 'clsx';
import NextLink from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon } from '@/shared/ui/components/Icons';
import { DOTS, getPaginationRange } from './getPaginationRange';
import css from './Pagination.module.css';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  /** Maps a page number to its href (query string is the caller's concern). */
  buildHref: (page: number) => string;
  className?: string;
}

/** Pages either side of the current one, before the range collapses to «…». */
const SIBLINGS = 1;

export const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, buildHref, className }) => {
  if (totalPages <= 1) {
    return null;
  }

  const items = getPaginationRange(currentPage, totalPages, SIBLINGS);
  const prevDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= totalPages;

  return (
    <nav className={clsx(css.root, className)} aria-label="Навигация по страницам">
      {prevDisabled ? (
        <span className={clsx(css.arrow, css.disabled)} aria-hidden="true">
          <ChevronLeftIcon />
        </span>
      ) : (
        <NextLink href={buildHref(currentPage - 1)} className={css.arrow} aria-label="Предыдущая страница" rel="prev">
          <ChevronLeftIcon />
        </NextLink>
      )}

      <ul className={css.list}>
        {items.map((item, index) =>
          item === DOTS ? (
            <li key={`dots-${index}`} className={css.dots} aria-hidden="true">
              {DOTS}
            </li>
          ) : (
            <li key={item}>
              <NextLink
                href={buildHref(item)}
                className={clsx(css.page, item === currentPage && css.active)}
                aria-label={`Страница ${item}`}
                aria-current={item === currentPage ? 'page' : undefined}
              >
                {item}
              </NextLink>
            </li>
          )
        )}
      </ul>

      {nextDisabled ? (
        <span className={clsx(css.arrow, css.disabled)} aria-hidden="true">
          <ChevronRightIcon />
        </span>
      ) : (
        <NextLink href={buildHref(currentPage + 1)} className={css.arrow} aria-label="Следующая страница" rel="next">
          <ChevronRightIcon />
        </NextLink>
      )}
    </nav>
  );
};
