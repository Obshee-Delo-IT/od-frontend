import { Button, IconButton } from '@radix-ui/themes';
import clsx from 'clsx';
import Logo from '@/ui/assets/icons/logo.svg';
import { ButtonGroup } from '@/ui/components/ButtonGroup';
import { MenuIcon, SearchIcon } from '@/ui/components/Icons';
import { Input } from '@/ui/components/input';
import css from './Header.module.css';

export const Header = () => (
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
      <IconButton variant="surface" radius="medium">
        <SearchIcon />
      </IconButton>
      <IconButton variant="outline" radius="medium">
        <MenuIcon />
      </IconButton>
    </div>
  </div>
);
