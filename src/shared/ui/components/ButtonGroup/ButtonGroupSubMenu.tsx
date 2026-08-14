import { NavigationMenuSub, NavigationMenuList, NavigationMenuItem } from '@radix-ui/react-navigation-menu';
import css from './ButtonGroupSubMenu.module.css';
import { Link } from '../Link';
import { SubMenuLink } from './types';

interface ButtonGroupSubMenuProps {
  links: SubMenuLink[];
}

/** Only rendered for an item that has children — `ButtonGroup` checks. */
export const ButtonGroupSubMenu: React.FC<ButtonGroupSubMenuProps> = ({ links }) => (
  <NavigationMenuSub className={css.submenu}>
    <NavigationMenuList className={css.list}>
      {links.map(({ href, id, text }) => (
        <NavigationMenuItem key={id} className={css.item}>
          <Link color="primary" size="3" href={href} className={css.link}>
            {text}
          </Link>
        </NavigationMenuItem>
      ))}
    </NavigationMenuList>
  </NavigationMenuSub>
);
