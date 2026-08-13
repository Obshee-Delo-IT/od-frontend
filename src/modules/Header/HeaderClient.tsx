'use client';

import clsx from 'clsx';
import Nextlink from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/shared/ui/components/Button';
import { ButtonGroup } from '@/shared/ui/components/ButtonGroup';
import { IconButton } from '@/shared/ui/components/IconButton';
import { SearchIcon, CrossIcon, MenuIcon } from '@/shared/ui/components/Icons';
import { Input } from '@/shared/ui/components/input';
import { Logo } from '@/shared/ui/components/Logo';
import css from './HeaderClient.module.css';
import { MobileMenu } from './MobileMenu';
import { NavItem } from './types';
import { isNavItemActive } from './utils/isNavItemActive';

interface HeaderClientProps {
  navItems?: NavItem[];
}

// Same donation destination as the home Hero CTA.
const DONATE_URL = 'https://xn--d1aadek5agm.xn----9sbkcac6brh7h.xn--p1ai/';

const MOBILE_MENU_ID = 'header-mobile-menu';

/**
 * Figma `header-v2` (`1229:4371`) plus its 1200 / 900 demos, and `header-mob`
 * (`1248:4486`) with the menu open state (`1336:10127`).
 *
 * `header-mob` is its own 48-tall component rather than a squeezed desktop bar,
 * so the two layouts are separate subtrees swapped at `--mobile`, not one tree
 * restyled.
 *
 * The search field is presentational until B7 lands a `/search/` route — the
 * data layer (`fetchSearch`) exists, the page does not, so submitting it would
 * only 404.
 */
const HeaderClient = ({ navItems }: HeaderClientProps) => {
  const pathname = usePathname();
  /**
   * The drawer remembers *where* it was opened rather than whether it is open,
   * so a navigation closes it by deriving `false` — a tap on a menu link
   * doesn't unmount the header, and back/forward would otherwise leave the
   * sheet covering the new page. Deriving also keeps this out of an effect,
   * which `react-hooks/set-state-in-effect` rightly rejects.
   */
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const isOpen = openedAt !== null && openedAt === pathname;

  const setIsOpen = (open: boolean) => setOpenedAt(open ? pathname : null);

  const items = (navItems ?? []).map((item) => ({
    ...item,
    active: isNavItemActive(pathname, item.href),
  }));

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenedAt(null);
      }
    };

    /**
     * The drawer belongs to `header-mob`; the desktop bar has no button to close
     * it with. Widening past the mobile tier while it is open would otherwise
     * leave a white sheet over the page — and, worse, the scroll lock on with no
     * way to release it.
     */
    const leftMobile = window.matchMedia('(min-width: 900px)');
    const closeOnWiden = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setOpenedAt(null);
      }
    };

    document.addEventListener('keydown', closeOnEscape);
    leftMobile.addEventListener('change', closeOnWiden);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      leftMobile.removeEventListener('change', closeOnWiden);
    };
  }, [isOpen]);

  return (
    <header className={clsx(css.header, { [css.open]: isOpen })}>
      <div className={css.desktop}>
        <div className={css.inner}>
          <div className={css.top}>
            <Nextlink href="/" className={css.logoLink}>
              <Logo size="lg" />
            </Nextlink>
            <div className={css.actions}>
              <div className={css.search}>
                <Input
                  color="red"
                  id="headerSearch"
                  placeholder="Поиск по сайту"
                  aria-label="Поиск по сайту"
                  rightIcon={<SearchIcon />}
                />
              </div>
              <Button asChild variant="white" size="large">
                <Nextlink href={DONATE_URL} target="_blank" rel="noopener noreferrer">
                  Оказать помощь
                </Nextlink>
              </Button>
            </div>
          </div>
          <nav className={css.nav} aria-label="Основная навигация">
            <ButtonGroup items={items} />
          </nav>
        </div>
      </div>

      <div className={css.mobileBar}>
        <Nextlink href="/" className={css.logoLink}>
          <Logo size="sm" />
        </Nextlink>
        <div className={css.mobileActions}>
          <IconButton aria-label="Поиск по сайту" variant="contained" className={css.searchButton}>
            <SearchIcon />
          </IconButton>
          <IconButton
            aria-label={isOpen ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={isOpen}
            aria-controls={MOBILE_MENU_ID}
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <CrossIcon /> : <MenuIcon />}
          </IconButton>
        </div>
      </div>

      {isOpen && (
        <MobileMenu id={MOBILE_MENU_ID} items={items} donateUrl={DONATE_URL} onClose={() => setIsOpen(false)} />
      )}
    </header>
  );
};

HeaderClient.displayName = 'HeaderClient';

export { HeaderClient };
