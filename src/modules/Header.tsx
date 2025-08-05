import { Button } from '@radix-ui/themes';
import Logo from '@/ui/assets/icons/logo.svg';
import SearchIcon from '@/ui/assets/icons/search.svg';
import { Input } from '@/ui/components/input';
import css from './Header.module.css';

export const Header = () => (
  <div className={css.wrapper}>
    <div className={css.container}>
      <Logo className={css.logo} />
      <div className={css.input}>
        <Input color="red" placeholder="Поиск по сайту" rightIcon={<SearchIcon />} />
      </div>
      <Button size="4" color="gray" variant="soft">
        Оказать помощь
      </Button>
    </div>
  </div>
);
