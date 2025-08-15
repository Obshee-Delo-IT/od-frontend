'use client';

import { Button, Container, IconButton } from '@radix-ui/themes';
import clsx from 'clsx';
import Nextlink from 'next/link';
import { useEffect, useState } from 'react';
// import Logo from '@/ui/assets/icons/logo.svg';
import { Accordion } from '@/ui/components/Accordion';
import { ButtonGroup } from '@/ui/components/ButtonGroup';
import { CrossIcon, MenuIcon, SearchIcon } from '@/ui/components/Icons';
import { Input } from '@/ui/components/input';
import { Link } from '@/ui/components/Link';
import css from './HeaderClient.module.css';
import { NavItem } from './types';
import { Logo } from '../../ui/components/Logo';

interface HeaderClientProps {
  navItems?: NavItem[];
}

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
      <Container size="4" className={clsx(css.container, css.headerDesktop)}>
        <div className={css.top}>
          <Logo />
          {/* <div className={css.logoCont}>
            <Logo className={css.logo} />
          </div> */}
          <div className={css.searchBar}>
            <div className={css.input}>
              <Input color="red" id="headerSearch" placeholder="Поиск по сайту" rightIcon={<SearchIcon />} />
            </div>
            <Button asChild size="4" variant="outline">
              <Nextlink href="/test">Оказать помощь</Nextlink>
            </Button>
          </div>
        </div>
        <div className={css.bottom}>
          <ButtonGroup items={navItems} />
        </div>
      </Container>
      <Container size="4" className={clsx(css.container)}>
        <div className={css.headerMobile}>
          {/* <div className={css.logoCont}>
            <Logo className={css.logo} />
          </div> */}
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
                <Nextlink href="/test">Оказать помощь</Nextlink>
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
