import { Heading } from '@radix-ui/themes';
import clsx from 'clsx';
import { Breadcrumbs, type BreadcrumbItem } from '../Breadcrumbs';
import css from './PageHeader.module.css';

export interface PageHeaderProps {
  /** Page title — rendered as the red uppercase H1. */
  title: string;
  /** Breadcrumb trail; omitted on pages without one (e.g. the projects index). */
  breadcrumbs?: BreadcrumbItem[];
  /** Optional tabs row, typically a `<Tabs />` element. */
  tabs?: React.ReactNode;
  className?: string;
}

/**
 * Top-of-page block from Figma `page header` (1335:7682): breadcrumbs row +
 * red uppercase heading + an optional tabs row. The red site nav above it is
 * the global Header, rendered by the layout — not part of this composition.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, breadcrumbs, tabs, className }) => (
  <header className={clsx(css.root, className)}>
    {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}

    <Heading as="h1" className={css.title}>
      {title}
    </Heading>

    {tabs}
  </header>
);
