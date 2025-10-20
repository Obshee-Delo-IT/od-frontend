import { client } from './httpClient';

export const fetchFooter = () =>
  client.GET('/wp/v2/widgets', {
    params: {
      query: {
        sidebar: 'sidebar_bottom',
      },
    },
  });
