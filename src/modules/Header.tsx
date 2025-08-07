'use client';

import { Button, IconButton } from '@radix-ui/themes';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import Logo from '@/ui/assets/icons/logo.svg';
import { Accordion } from '@/ui/components/Accordion';
import { ButtonGroup } from '@/ui/components/ButtonGroup';
import { CrossIcon, MenuIcon, SearchIcon } from '@/ui/components/Icons';
import { Input } from '@/ui/components/input';
import { Link } from '@/ui/components/Link';
import css from './Header.module.css';

const Header = () => {
  const [isOpen, setIsOpen] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = (event: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className={css.header}>
      <div className={clsx(css.container, css.headerDesktop)}>
        <div className={css.top}>
          <div className={css.logoCont}>
            <Logo className={css.logo} />
          </div>
          <div className={css.searchBar}>
            <div className={css.input}>
              <Input color="red" placeholder="Поиск по сайту" rightIcon={<SearchIcon />} />
            </div>
            <Button size="4" variant="outline">
              Оказать помощь
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
      </div>
      <div className={clsx(css.container, css.headerMobile)}>
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
      {isOpen ? (
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
              <Button size="3">Оказать помощь</Button>
            </div>
          </div>
          <div className={css.menuMobile_overlay} />
        </>
      ) : (
        ''
      )}
    </div>
  );
};

Header.displayName = 'Header';

export { Header };
