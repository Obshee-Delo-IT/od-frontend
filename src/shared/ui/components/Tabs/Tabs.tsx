import clsx from 'clsx';
import NextLink from 'next/link';
import css from './Tabs.module.css';

export type TabsSize = 'large' | 'small';

export interface TabItem {
  /** Visible label. */
  label: string;
  /** Stable key matched against `activeValue`. */
  value: string;
  /** Destination — each tab is a link, so the strip works in RSC with no client JS. */
  href: string;
  /** Figma «… / Disabled». Greys the tab out and drops the link (renders a non-interactive span). */
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  /** `value` of the active tab; renders the red «Primary» fill. */
  activeValue?: string | null;
  size?: TabsSize;
  className?: string;
  'aria-label'?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  items,
  activeValue = null,
  size = 'large',
  className,
  'aria-label': ariaLabel = 'Разделы',
}) => (
  <nav className={clsx(css.root, className)} aria-label={ariaLabel}>
    {items.map((item) => {
      const isActive = item.value === activeValue;
      const classes = clsx(css.tab, css[`size-${size}`], isActive && css.active, item.disabled && css.disabled);

      if (item.disabled) {
        return (
          <span key={item.value} className={classes} aria-disabled="true">
            {item.label}
          </span>
        );
      }

      return (
        <NextLink key={item.value} href={item.href} className={classes} aria-current={isActive ? 'page' : undefined}>
          {item.label}
        </NextLink>
      );
    })}
  </nav>
);
