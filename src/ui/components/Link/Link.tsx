import { Link as RadixLink, LinkProps as RadixLinkProps } from '@radix-ui/themes';
import clsx from 'clsx';
import NextLink, { LinkProps as NextLinkProps } from 'next/link';
import { PropsWithChildren, ReactNode } from 'react';
import css from './Link.module.css';

interface LinkProps extends Omit<NextLinkProps, 'passHref'>, Pick<RadixLinkProps, 'size'> {
  color?: 'red' | 'gray' | 'white';
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Link: React.FC<PropsWithChildren<LinkProps>> = ({
  size,
  color = 'red',
  children,
  leftIcon,
  rightIcon,
  ...props
}) => {
  const mappedColor = color !== 'white' ? color : undefined;

  return (
    <NextLink {...props} passHref legacyBehavior>
      <RadixLink
        underline="none"
        size={size}
        color={mappedColor}
        className={clsx(css.link, {
          [css.whiteLink]: color === 'white',
        })}
      >
        {!!leftIcon && <span>{leftIcon}</span>}
        {children}
        {!!rightIcon && <span>{rightIcon}</span>}
      </RadixLink>
    </NextLink>
  );
};
