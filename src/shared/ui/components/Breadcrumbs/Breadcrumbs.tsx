import { Text } from '@radix-ui/themes';
import { Fragment } from 'react';
import css from './Breadcrumbs.module.css';
import { Link } from '../Link';
import ChevronRight from '@/ui/assets/icons/chevron-right.svg';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  Separator?: React.ReactNode;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  Separator = <ChevronRight width={18} height={18} color="var(--gray-5)" aria-hidden="true" />,
}) => (
  <nav aria-label="Навигация" className={css.container}>
    {items.map((item, index) => {
      const isLast = index === items.length - 1;

      return (
        <Fragment key={index}>
          <>
            {item.href ? (
              <Link href={item.href} size="3" color="lightgrey">
                {item.label}
              </Link>
            ) : (
              <Text size="3" color="gray" weight={isLast ? 'bold' : 'regular'} aria-current="page">
                {item.label}
              </Text>
            )}
            {!isLast && Separator}
          </>
        </Fragment>
      );
    })}
  </nav>
);
