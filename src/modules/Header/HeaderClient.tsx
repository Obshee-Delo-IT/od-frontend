'use client';

import { Button, Container, IconButton, Link } from '@radix-ui/themes';
import clsx from 'clsx';
import Nextlink from 'next/link';
import { useEffect, useState } from 'react';
import { Accordion } from '@/shared/ui/components/Accordion';
import { ButtonGroup } from '@/shared/ui/components/ButtonGroup';
import { SearchIcon, CrossIcon, MenuIcon } from '@/shared/ui/components/Icons';
import { Input } from '@/shared/ui/components/input';
import { Logo } from '@/shared/ui/components/Logo';
import css from './HeaderClient.module.css';
import { NavItem } from './types';

interface HeaderClientProps {
  navItems?: NavItem[];
}

// Same donation destination as the home Hero CTA.
const DONATE_URL = 'https://xn--d1aadek5agm.xn----9sbkcac6brh7h.xn--p1ai/';

const HeaderClient = ({ navItems }: HeaderClientProps) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen]);

  return (
    <div className={css.header}>
      <Container size="4" className={clsx(css.headerDesktop)}>
        <div className={css.top}>
          <Nextlink href="/" className={css.link}>
            <Logo size="lg" />
          </Nextlink>
          <div className={css.searchBar}>
            <div className={css.input}>
              <Input color="red" id="headerSearch" placeholder="Поиск по сайту" rightIcon={<SearchIcon />} />
            </div>
            <Button asChild size="4" variant="outline">
              <Nextlink href={DONATE_URL} target="_blank" rel="noopener noreferrer">
                Оказать помощь
              </Nextlink>
            </Button>
          </div>
        </div>
        <div className={css.bottom}>
          <ButtonGroup items={navItems} />
        </div>
      </Container>
      <Container size="4" className={clsx(css.container)}>
        <div className={css.headerMobile}>
          <Nextlink href="/" className={css.link}>
            <Logo size="sm" />
          </Nextlink>
          <div className={css.mobileButtons}>
            <IconButton variant="surface" radius="medium" className={css.searchBtn}>
              <SearchIcon />
            </IconButton>
            {isOpen ? (
              <IconButton variant="outline" radius="medium" onClick={() => setIsOpen(false)}>
                <CrossIcon />
              </IconButton>
            ) : (
              <IconButton variant="outline" radius="medium" onClick={() => setIsOpen(true)}>
                <MenuIcon />
              </IconButton>
            )}
          </div>
        </div>
      </Container>
      {isOpen && (
        <>
          <div className={css.menuMobile}>
            {navItems?.map((item) => {
              if (item.content.length === 0) {
                return (
                  <Link key={item.id} href={item.href} color="gray" className={css.menuMobile_link}>
                    {item.text}
                  </Link>
                );
              } else {
                return (
                  <Accordion
                    className={css.menuMobile_accordion}
                    type="multiple"
                    key={item.id}
                    items={[
                      {
                        value: item.id,
                        text: item.text,
                        content: item.content.map((cont) => (
                          <div className={css.accordion_link} key={cont.id}>
                            <Link color="gray" href={cont.href}>
                              {cont.text}
                            </Link>
                          </div>
                        )),
                      },
                    ]}
                  />
                );
              }
            })}
            <div className={css.menuMobile_button}>
              <Button asChild size="3">
                <Nextlink href={DONATE_URL} target="_blank" rel="noopener noreferrer">
                  Оказать помощь
                </Nextlink>
              </Button>
            </div>
          </div>
          <div className={css.menuMobile_overlay} onClick={() => setIsOpen(false)} />
        </>
      )}
    </div>
  );
};

HeaderClient.displayName = 'HeaderClient';

export { HeaderClient };
