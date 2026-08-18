import { Text } from '@radix-ui/themes';
import { Fragment } from 'react';
import ChevronRight from '@/shared/ui/assets/icons/chevron-right.svg';
import css from './Breadcrumbs.module.css';
import { Link } from '../Link';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

/* Figma `_Breadcrumbs Base` strokes the chevron in the parent link's own colour. */
const separator = <ChevronRight width={18} height={18} color="var(--gray-6)" aria-hidden="true" />;

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => (
  <nav aria-label="Навигация" className={css.container}>
    {items.map((item, index) => {
      const isLast = index === items.length - 1;

      return (
        <Fragment key={index}>
          <>
            {item.href ? (
              <Link href={item.href} size="3" color="gray">
                {item.label}
              </Link>
            ) : (
              /* The page's own crumb is `#344051` = `--gray-8`, two steps darker
                 than the links beside it — Radix's `gray` gives every crumb the
                 parent colour, which is right for a link and not for this one. */
              <Text size="3" weight={isLast ? 'bold' : 'regular'} aria-current="page" className={css.current}>
                {item.label}
              </Text>
            )}
            {!isLast && separator}
          </>
        </Fragment>
      );
    })}
  </nav>
);
