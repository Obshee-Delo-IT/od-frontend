'use client';

import { NavigationMenu, NavigationMenuList } from '@radix-ui/react-navigation-menu';
import React, { useState } from 'react';
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

/**
 * Controlled rather than left to Radix's own open state, and for one reason:
 * with `asChild` the trigger is the section's `<a href>`, so Enter on it follows
 * the link instead of opening the flyout and Tab moves to the next top-level
 * cell — the 9 child links under «О НАС» and the 4 under «МАТЕРИАЛЫ» were
 * unreachable without a mouse (GAP-03).
 *
 * Focusing a trigger now opens its flyout, exactly as hovering does, which puts
 * the children next in the tab order. Radix still owns every other transition —
 * pointer leave, Escape, focus leaving the menu — through `onValueChange`.
 */
export const ButtonGroup: React.FC<ButtonGroupProps> = ({ items = [] }) => {
  const [openItem, setOpenItem] = useState('');

  return (
    <NavigationMenu value={openItem} onValueChange={setOpenItem} className={css.root}>
      <NavigationMenuList className={css.list}>
        {items.map(({ href, id, content, text, active }) => (
          <ButtonGroupItem
            key={id}
            value={String(id)}
            href={href}
            active={active}
            content={content?.length ? <ButtonGroupSubMenu links={content} /> : null}
            onFocus={content?.length ? () => setOpenItem(String(id)) : undefined}
          >
            {text}
          </ButtonGroupItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  );
};
