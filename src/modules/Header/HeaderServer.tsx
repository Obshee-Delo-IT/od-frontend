import { HeaderClient } from './HeaderClient';
import { ResultNavItem, SourceNavItem } from './types';

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

  function sortNavItems(items: SourceNavItem[]): ResultNavItem[] {
    return items
      .map((item) => ({
        id: item.id,
        parent: item.parent,
        href: item.url,
        text: item.title.rendered,
        content: [],
      }))
      .sort((a, b) => {
        if (a.parent === b.parent) {
          return 0;
        }
        return a.parent === 0 ? -1 : 1;
      });
  }

  const sorted = sortNavItems(bodyNav);
  const map = new Map();

  for (const item of sorted) {
    if (item.parent === 0) {
      map.set(item.id, item);
    } else {
      map.get(item.parent)?.content.push(item);
    }
  }
  const nav = Array.from(map.values());

  return <HeaderClient navItems={nav} />;
};

HeaderServer.displayName = 'HeaderServer';

export { HeaderServer };
