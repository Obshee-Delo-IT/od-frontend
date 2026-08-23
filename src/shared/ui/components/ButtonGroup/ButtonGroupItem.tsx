import { NavigationMenuItem, NavigationMenuTrigger, NavigationMenuContent } from '@radix-ui/react-navigation-menu';
import { Text } from '@radix-ui/themes';
import clsx from 'clsx';
import NextLink from 'next/link';
import { PropsWithChildren, ReactNode } from 'react';
import ChevronDownIcon from '@/shared/ui/assets/icons/chevron-down.svg';
import css from './ButtonGroupItem.module.css';

interface ButtonGroupItemProps {
  active?: boolean;
  href: string;
  content?: ReactNode;
  /** The controlled open value this item answers to — see `ButtonGroup`. */
  value: string;
  /** Set when this item has a flyout: focusing the trigger opens it (GAP-03). */
  onFocus?: () => void;
}

export const ButtonGroupItem: React.FC<PropsWithChildren<ButtonGroupItemProps>> = ({
  content,
  href,
  children,
  value,
  onFocus,
  active = false,
}) => (
  <NavigationMenuItem value={value} className={css.item}>
    <NavigationMenuTrigger asChild>
      <Text
        size="3"
        asChild
        className={clsx(css.base, {
          [css.baseActive]: active,
        })}
      >
        <NextLink href={href} className={css.link} aria-current={active ? 'page' : undefined} onFocus={onFocus}>
          <div className={css.text}>{children}</div>
          {!!content && <ChevronDownIcon className={css.icon} width={20} height={20} />}
        </NextLink>
      </Text>
    </NavigationMenuTrigger>

    {!!content && <NavigationMenuContent className={css.content}>{content}</NavigationMenuContent>}
  </NavigationMenuItem>
);
