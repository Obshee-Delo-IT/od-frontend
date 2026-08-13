import {
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuContentProps,
} from '@radix-ui/react-navigation-menu';
import { Text } from '@radix-ui/themes';
import clsx from 'clsx';
import NextLink from 'next/link';
import { PropsWithChildren, ReactNode } from 'react';
import ChevronDownIcon from '@/shared/ui/assets/icons/chevron-down.svg';
import css from './ButtonGroupItem.module.css';

interface ButtonGroupItemProps {
  active?: boolean;
  contentProps?: Omit<NavigationMenuContentProps, 'asChild' | 'children'>;
  href: string;
  content?: ReactNode;
}

export const ButtonGroupItem: React.FC<PropsWithChildren<ButtonGroupItemProps>> = ({
  contentProps,
  content,
  href,
  children,
  active = false,
}) => (
  <NavigationMenuItem className={css.item}>
    <NavigationMenuTrigger asChild>
      <Text
        size="3"
        asChild
        className={clsx(css.base, {
          [css.baseActive]: active,
        })}
      >
        <NextLink href={href} className={css.link} aria-current={active ? 'page' : undefined}>
          <div className={css.text}>{children}</div>
          {!!content && <ChevronDownIcon className={css.icon} width={20} height={20} />}
        </NextLink>
      </Text>
    </NavigationMenuTrigger>

    {!!content && (
      <NavigationMenuContent {...contentProps} className={clsx(css.content, contentProps?.className)}>
        {content}
      </NavigationMenuContent>
    )}
  </NavigationMenuItem>
);
