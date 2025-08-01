import { NavigationMenuSub, NavigationMenuList, NavigationMenuItem } from '@radix-ui/react-navigation-menu';
import css from './ButtonGroupSubMenu.module.css';
import { Link } from '../Link';
import { SubMenuLink } from './types';

interface ButtonGroupSubMenuProps {
  links?: SubMenuLink[];
}

export const ButtonGroupSubMenu: React.FC<ButtonGroupSubMenuProps> = ({ links = [] }) => {
  if (!links?.length) {
    return null;
  }

  return (
    <NavigationMenuSub className={css.submenu}>
      <NavigationMenuList className={css.list}>
        {links?.map(({ href, id, text }) => (
          <NavigationMenuItem key={id} className={css.item}>
            <Link color="gray" href={href} className={css.link}>
              {text}
            </Link>
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenuSub>
  );
};
