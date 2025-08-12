'use client';

import { Button, Container, IconButton } from '@radix-ui/themes';
import clsx from 'clsx';
import Nextlink from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Logo from '@/ui/assets/icons/logo.svg';
import { Accordion } from '@/ui/components/Accordion';
import { ButtonGroup } from '@/ui/components/ButtonGroup';
import { CrossIcon, MenuIcon, SearchIcon } from '@/ui/components/Icons';
import { Input } from '@/ui/components/input';
import { Link } from '@/ui/components/Link';
import css from './Header.module.css';

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = (event: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={css.header}>
      <Container size="4" className={clsx(css.container, css.headerDesktop)}>
        <div className={css.top}>
          <div className={css.logoCont}>
            <Logo className={css.logo} />
          </div>
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
          <ButtonGroup
            items={[
              { href: '/test', id: 1, text: 'ГЛАВНАЯ' },
              {
                href: '/test',
                id: 2,
                text: 'О НАС',
                content: [
                  {
                    href: '/test',
                    id: 1,
                    text: 'Общее дело',
                  },
                  {
                    href: '/test',
                    id: 2,
                    text: 'Команда',
                  },
                  {
                    href: '/test',
                    id: 3,
                    text: 'Удостоверение',
                  },
                  {
                    href: '/test',
                    id: 4,
                    text: 'Благодарственные письма',
                  },
                  {
                    href: '/test',
                    id: 5,
                    text: 'Истории активистов',
                  },
                  {
                    href: '/test',
                    id: 6,
                    text: 'Экспертные заключения и документы',
                  },
                ],
              },
              { href: '/test', id: 3, text: 'ПРОГРАММЫ' },
              { href: '/test', id: 4, text: 'ВИДЕО' },
              { href: '/test', id: 6, text: 'ПРИМИ УЧАСТИЕ' },
              { href: '/test', id: 7, text: 'МАТЕРИАЛЫ' },
              { href: '/test', id: 8, text: 'ОБЩЕЕ ДЕЛО-ПРО' },
              { href: '/test', id: 9, text: 'КОНТАКТЫ' },
            ]}
          />
        </div>
      </Container>
      <Container size="4" className={clsx(css.container)}>
        <div className={css.headerMobile}>
          <div className={css.logoCont}>
            <Logo className={css.logo} />
          </div>
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
          <div className={css.menuMobile} ref={menuRef}>
            <Link href="/test" color="gray" className={css.menuMobile_link}>
              ГЛАВНАЯ
            </Link>
            <Accordion
              className={css.menuMobile_accordion}
              type="multiple"
              items={[
                {
                  value: 1,
                  text: 'О НАС',
                  content: (
                    <>
                      <div className={css.accordion_link}>
                        <Link color="gray" href="/test">
                          Общее дело
                        </Link>
                      </div>
                      <div className={css.accordion_link}>
                        <Link href="/test" color="gray">
                          Команда
                        </Link>
                      </div>
                      <div className={css.accordion_link}>
                        <Link href="/test" color="gray">
                          Удостоверение
                        </Link>
                      </div>
                      <div className={css.accordion_link}>
                        <Link href="/test" color="gray">
                          Благодарственные письма
                        </Link>
                      </div>
                      <div className={css.accordion_link}>
                        <Link href="/test" color="gray">
                          Истории активистов
                        </Link>
                      </div>
                      <div className={css.accordion_link}>
                        <Link href="/test" color="gray">
                          Экспертные заключения и документы
                        </Link>
                      </div>
                    </>
                  ),
                },
              ]}
            />
            <Link href="/test" color="gray" className={css.menuMobile_link}>
              ПРОГРАММЫ
            </Link>
            <Link href="/test" className={css.menuMobile_link}>
              ВИДЕО
            </Link>
            <Link href="/test" color="gray" className={css.menuMobile_link}>
              ПРИМИ УЧАСТИЕ
            </Link>
            <Link href="/test" color="gray" className={css.menuMobile_link}>
              МАТЕРИАЛЫ
            </Link>
            <Link href="/test" color="gray" className={css.menuMobile_link}>
              ОБЩЕЕ ДЕЛО-ПРО
            </Link>
            <Link href="/test" color="gray" className={css.menuMobile_link}>
              КОНТАКТЫ
            </Link>{' '}
            <div className={css.menuMobile_button}>
              <Button asChild size="3">
                <Nextlink href="/test">Оказать помощь</Nextlink>
              </Button>
            </div>
          </div>
          <div className={css.menuMobile_overlay} />
        </>
      )}
    </div>
  );
};

Header.displayName = 'Header';

export { Header };
