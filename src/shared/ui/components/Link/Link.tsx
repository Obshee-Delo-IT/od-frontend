import { Link as RadixLink, LinkProps as RadixLinkProps } from '@radix-ui/themes';
import clsx from 'clsx';
import NextLink, { LinkProps as NextLinkProps } from 'next/link';
import { PropsWithChildren, ReactNode } from 'react';
import css from './Link.module.css';

/**
 * The three colours of the Figma `Links` component set (`1330:36653`), plus one
 * repo extra:
 *
 * - `primary` — gray-9 body link. The flyout rows, the mobile menu and every
 *   in-copy link use it.
 * - `red` — the CTA link.
 * - `white` — links on the red header / dark footer.
 * - `gray` — **not** in the `Links` set. It is the gray-6 of the separate
 *   `_Breadcrumbs Base` component (`1321:5894`) and of secondary consent copy;
 *   kept so those call sites don't hard-code a colour of their own.
 *
 * Sizes map onto the Radix `size` prop: Figma **Large** = `size="4"` (18px),
 * **Small** and **Extra Small** = `size="3"` (16px) — the last two are
 * identical in Figma.
 */
type LinkColor = 'primary' | 'red' | 'white' | 'gray';

interface LinkProps extends Omit<NextLinkProps, 'passHref'>, Omit<RadixLinkProps, 'href' | 'color' | 'asChild'> {
  color?: LinkColor;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  /** Figma's fourth state. Renders the disabled colour and takes the link out of the tab order. */
  disabled?: boolean;
}

export const Link: React.FC<PropsWithChildren<LinkProps>> = ({
  // Radix owns these: it turns them into `rt-*` classes, so they have to be set
  // on `RadixLink` itself. They used to ride along in the rest-spread; when the
  // spread moved to `NextLink` they type-checked at every call site and silently
  // did nothing — `underline="always"` and `weight="bold"` both stopped working.
  size,
  underline = 'none',
  weight,
  trim,
  truncate,
  wrap,
  highContrast,
  color = 'red',
  children,
  leftIcon = null,
  rightIcon = null,
  href,
  disabled = false,
  className,
  ...props
}) => (
  <RadixLink
    underline={underline}
    size={size}
    weight={weight}
    trim={trim}
    truncate={truncate}
    wrap={wrap}
    highContrast={highContrast}
    className={clsx(
      css.link,
      css[color],
      {
        [css.disabled]: disabled,
        [css.inlineFlex]: leftIcon || rightIcon,
      },
      className
    )}
    asChild
  >
    <NextLink href={href} aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : undefined} {...props}>
      {leftIcon}
      <span>{children}</span>
      {rightIcon}
    </NextLink>
  </RadixLink>
);
