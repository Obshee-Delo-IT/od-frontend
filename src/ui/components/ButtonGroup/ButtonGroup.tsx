import { NavigationMenu, NavigationMenuList } from '@radix-ui/react-navigation-menu';
import React from 'react';
import css from './ButtonGroup.module.css';
import { ButtonGroupItem } from './ButtonGroupItem';
import { ButtonGroupSubMenu } from './ButtonGroupSubMenu';
import { SubMenuLink } from './types';

interface ButtonGroupItem {
  id: number;
  href: string;
  text?: string;
  active?: boolean;
  content?: SubMenuLink[];
}

interface ButtonGroupProps {
  items?: ButtonGroupItem[];
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({ items = [] }) => (
  <NavigationMenu className={css.root}>
    <NavigationMenuList className={css.list}>
      {items.map(({ href, id, content, text, active }) => (
        <ButtonGroupItem
          key={id}
          href={href}
          active={active}
          content={content?.length ? <ButtonGroupSubMenu links={content} /> : null}
        >
          {text}
        </ButtonGroupItem>
      ))}
    </NavigationMenuList>
  </NavigationMenu>
);
