import { HeaderClient } from './HeaderClient';
import { toNavItems } from './utils/toNavItems';

const HeaderServer = async () => {
  const url = process.env.WP_BASE;
  const response = await fetch(`${url}/wp-json/wp/v2/menus?slug=main-navigation`, {
    method: 'GET',
    headers: {
      Authorization: 'Basic ' + btoa(`${process.env.WP_USER}:${process.env.WP_PASSWORD}`),
    },
  });
  const body = await response.json();

  const id = body[0].id;

  const responseNav = await fetch(`${url}/wp-json/wp/v2/menu-items/?menus=${id}`, {
    method: 'GET',
    headers: {
      Authorization: 'Basic ' + btoa(`${process.env.WP_USER}:${process.env.WP_PASSWORD}`),
    },
  });
  const bodyNav = await responseNav.json();

  const navItems = toNavItems(bodyNav);

  return <HeaderClient navItems={navItems} />;
};

export { HeaderServer };
