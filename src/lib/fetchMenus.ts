//   const url = process.env.WP_BASE;
//   const response = await fetch(`${url}/wp-json/wp/v2/menus?slug=main-navigation`, {
//     method: 'GET',
//     headers: {
//       Authorization: 'Basic ' + btoa(`${process.env.WP_USER}:${process.env.WP_PASSWORD}`),
//     },
//   });
//   const body = await response.json();
//   const id = body[0].id;
import { customFetch } from './customFetch';

interface fetchMenusProps {
  slug: string;
}

export const fetchMenus = ({ slug }: fetchMenusProps) => customFetch({ addUrl: `/wp-json/wp/v2/menus?slug=${slug}` });
