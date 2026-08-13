'use client';

import Nextlink from 'next/link';
import { MouseEvent } from 'react';
import { Accordion } from '@/shared/ui/components/Accordion';
import { Button } from '@/shared/ui/components/Button';
import { Link } from '@/shared/ui/components/Link';
import css from './MobileMenu.module.css';
import { NavItem } from './types';

interface MobileMenuItem extends NavItem {
  active?: boolean;
}

interface MobileMenuProps {
  id: string;
  items: MobileMenuItem[];
  donateUrl: string;
  onClose: () => void;
}

/**
 * The `header-mob` open state (`1336:10127` with a group expanded,
 * `1336:10153` collapsed).
 *
 * Rows are 42 tall — the `Links`/Small cell with 10px above and below and a
 * gray-4 rule under each. The current section is the same cell in its Active
 * colour (red-8, `1336:10038`), which is exactly `Link color="red"`. Children
 * indent 15px and stack on a 10px gap (`1336:10034`).
 */
export const MobileMenu = ({ id, items, donateUrl, onClose }: MobileMenuProps) => {
  /**
   * Closing on navigation can't be derived from the pathname alone: tapping the
   * row for the page you are already on changes nothing, so the sheet would stay
   * up with scroll still locked. Any link tap closes it.
   */
  const closeOnLinkTap = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('a')) {
      onClose();
    }
  };

  return (
    <>
      <div id={id} className={css.menu} onClick={closeOnLinkTap}>
        {items.map((item) =>
          item.content.length === 0 ? (
            <div key={item.id} className={css.row}>
              <Link
                href={item.href}
                size="3"
                color={item.active ? 'red' : 'primary'}
                aria-current={item.active ? 'page' : undefined}
              >
                {item.text}
              </Link>
            </div>
          ) : (
            <Accordion
              className={css.group}
              type="multiple"
              key={item.id}
              items={[
                {
                  value: item.id,
                  text: item.text,
                  // A section with children renders as the accordion's own
                  // label, so the Active colour has to come through here or the
                  // current section goes unmarked the moment WP gives it a child.
                  active: item.active,
                  content: (
                    <div className={css.submenu}>
                      {item.content.map((child) => (
                        <Link key={child.id} href={child.href} size="3" color="primary">
                          {child.text}
                        </Link>
                      ))}
                    </div>
                  ),
                },
              ]}
            />
          )
        )}
        <div className={css.donate}>
          <Button asChild size="small">
            <Nextlink href={donateUrl} target="_blank" rel="noopener noreferrer">
              Оказать помощь
            </Nextlink>
          </Button>
        </div>
      </div>
      <div className={css.overlay} onClick={onClose} />
    </>
  );
};
