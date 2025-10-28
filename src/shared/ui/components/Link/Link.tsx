import { Link as RadixLink, LinkProps as RadixLinkProps } from '@radix-ui/themes';
import clsx from 'clsx';
import NextLink, { LinkProps as NextLinkProps } from 'next/link';
import { PropsWithChildren, ReactNode } from 'react';
import css from './Link.module.css';

interface LinkProps extends Omit<NextLinkProps, 'passHref'>, Omit<RadixLinkProps, 'href' | 'color' | 'asChild'> {
  color?: 'red' | 'gray' | 'white' | 'lightgrey' | 'darkgrey';
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Link: React.FC<PropsWithChildren<LinkProps>> = ({
  size,
  color = 'red',
  children,
  leftIcon = null,
  rightIcon = null,
  href,
  ...props
}) => {
  const mappedColor = color === 'gray' || color === 'red' ? color : undefined;

  return (
    <RadixLink
      underline="none"
      size={size}
      color={mappedColor}
      className={clsx(css.link, {
        [css.whiteLink]: color === 'white',
        [css.lightgrey]: color === 'lightgrey',
        [css.darkgrey]: color === 'darkgrey',
        [css.inlineFlex]: leftIcon || rightIcon,
      })}
      asChild
      {...props}
    >
      <NextLink href={href} {...props}>
        {leftIcon}
        <span>{children}</span>
        {rightIcon}
      </NextLink>
    </RadixLink>
  );
};
